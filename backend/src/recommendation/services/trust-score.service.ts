// @lifecycle ACTIVE — Bayesian Trust Score computation service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PRIOR_CONFIGS, PriorConfig, getTrustLabel } from '../interfaces/trust-score.interface';
import { TrustLevel, FinalOutcome } from '../interfaces/recommendation.interface';
import { getConfidenceInterval } from '../../shared/utils/confidence-interval.util';

/** @lifecycle ACTIVE — Known execution outcome strings from the execution trace service */
const KNOWN_EXECUTION_OUTCOMES = ['COMMITTED', 'FAILED', 'BLOCKED', 'ABANDONED'] as const;

/** @lifecycle ACTIVE — Decision types that map from routerRoute */
const DECISION_TYPES = ['TC', 'AP', 'IA', 'TS', 'PC', 'BB'] as const;

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculate trust scores at all levels.
   * Executed sequentially (not Promise.all) to prevent race conditions on
   * the findFirst→create/update pattern within each level.
   */
  async recalculateAll() {
    await this.recalculateGlobal();
    await this.recalculateByDecisionType();
    await this.recalculateByDomain();
  }

  /**
   * Upsert a trust score row transactionally.
   * Using findFirst + conditional create/update wrapped in a transaction to
   * prevent race conditions when multiple callers recalculate simultaneously.
   */
  private async upsertTrustScore(
    where: { level: string; domain?: string | null; decisionType?: string | null },
    data: { score: number; sampleSize: number; priorAlpha: number; priorBeta: number },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.trustScore.findFirst({ where });
      if (existing) {
        await tx.trustScore.update({ where: { id: existing.id }, data });
      } else {
        await tx.trustScore.create({
          data: {
            level: where.level,
            domain: where.domain ?? null,
            decisionType: where.decisionType ?? null,
            ...data,
          },
        });
      }
    });
  }

  /**
   * Recalculate GLOBAL trust score.
   * Merges assessed recommendations + execution outcomes.
   */
  async recalculateGlobal() {
    const assessed = await this.prisma.recommendation.findMany({
      where: {
        trackingStatus: 'ASSESSED',
        finalOutcome: { not: null },
      },
      select: { finalOutcome: true },
    });

    const executionOutcomes = await this.loadExecutionOutcomes();

    const allAssessed = [...assessed, ...executionOutcomes];

    const prior = PRIOR_CONFIGS['GLOBAL'];
    const score = this.computeScore(allAssessed, prior);
    const data = { score, sampleSize: allAssessed.length, ...this.priorFields(prior) };

    await this.upsertTrustScore(
      { level: TrustLevel.GLOBAL, domain: null, decisionType: null },
      data,
    );

    return { level: TrustLevel.GLOBAL, score, sampleSize: allAssessed.length };
  }

  /**
   * Recalculate trust scores by decision type (TC, AP, IA, TS, PC, BB).
   * Merges assessed recommendations + execution outcomes grouped by routerRoute.
   */
  async recalculateByDecisionType() {
    const results: Array<{ decisionType: string; score: number; sampleSize: number }> = [];

    for (const dt of DECISION_TYPES) {
      const assessed = await this.prisma.recommendation.findMany({
        where: {
          decisionType: dt,
          trackingStatus: 'ASSESSED',
          finalOutcome: { not: null },
        },
        select: { finalOutcome: true },
      });

      const executionOutcomes = await this.loadExecutionOutcomes(dt);

      const allAssessed = [...assessed, ...executionOutcomes];

      const prior = PRIOR_CONFIGS[dt] ?? PRIOR_CONFIGS['GLOBAL'];
      const score = this.computeScore(allAssessed, prior);
      const data = { score, sampleSize: allAssessed.length, ...this.priorFields(prior) };

      await this.upsertTrustScore(
        { level: TrustLevel.DECISION_TYPE, domain: null, decisionType: dt },
        data,
      );

      results.push({ decisionType: dt, score, sampleSize: allAssessed.length });
    }

    return results;
  }

  /**
   * Recalculate trust scores by domain.
   * Only recommendation data is used (executions lack decisionDomain).
   */
  async recalculateByDomain() {
    // Load all assessed recs in a single query, then group in-memory
    // to avoid N+1 queries per domain
    const allAssessed = await this.prisma.recommendation.findMany({
      where: { trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
      select: { decisionDomain: true, finalOutcome: true },
    });

    const grouped = new Map<string, Array<{ finalOutcome: string | null }>>();
    for (const rec of allAssessed) {
      const list = grouped.get(rec.decisionDomain) ?? [];
      list.push({ finalOutcome: rec.finalOutcome });
      grouped.set(rec.decisionDomain, list);
    }

    const results: Array<{ domain: string; score: number; sampleSize: number }> = [];

    for (const [decisionDomain, assessed] of grouped) {

      const prior = PRIOR_CONFIGS['GLOBAL'];
      const score = this.computeScore(assessed, prior);
      const data = { score, sampleSize: assessed.length, ...this.priorFields(prior) };

      await this.upsertTrustScore(
        { level: TrustLevel.DOMAIN, domain: decisionDomain, decisionType: null },
        data,
      );

      results.push({
        domain: decisionDomain,
        score,
        sampleSize: assessed.length,
      });
    }

    return results;
  }

  /**
   * Record a single execution outcome and update trust scores in real-time.
   *
   * Updates GLOBAL trust score, and DECISION_TYPE if the execution's
   * routerRoute matches a known decision type.
   *
   * This is the primary real-time path called from onExecutionCommitted().
   * Errors are logged but never thrown — the caller must not be blocked
   * by trust score recording failures.
   */
  async recordExecutionOutcome(
    executionId: string,
    finalOutcome: string,
    retryCount: number,
  ): Promise<void> {
    try {
      // Fetch execution to get routerRoute for decision type mapping
      const execution = await this.prisma.agentExecution.findUnique({
        where: { executionId },
        select: { routerRoute: true },
      });

      if (!execution) {
        this.logger.warn(
          `recordExecutionOutcome: execution ${executionId} not found, skipping`,
        );
        return;
      }

      const mappedOutcome = this.mapExecutionOutcome(finalOutcome, retryCount);
      if (!mappedOutcome) {
        this.logger.warn(
          `recordExecutionOutcome: unrecognized outcome "${finalOutcome}" ` +
          `for execution ${executionId}, skipping`,
        );
        return;
      }

      // Update GLOBAL trust score (re-reads all data, the execution is already in DB)
      await this.recalculateGlobal();

      // Update DECISION_TYPE if routerRoute maps to a known decision type
      const matchedType = this.resolveDecisionType(execution.routerRoute);
      if (matchedType) {
        // Recalculate just the matching type to incorporate the new outcome
        await this.recalculateSingleDecisionType(matchedType);
      }

      this.logger.log(
        `Trust score updated for execution ${executionId} ` +
        `(outcome: ${finalOutcome}, mapped: ${mappedOutcome})`,
      );
    } catch (error) {
      this.logger.error(
        `recordExecutionOutcome: failed for execution ${executionId}: ` +
        `${(error as Error).message}`,
      );
    }
  }

  /**
   * Recalculate a single decision type trust score.
   */
  private async recalculateSingleDecisionType(dt: string): Promise<void> {
    const assessed = await this.prisma.recommendation.findMany({
      where: {
        decisionType: dt,
        trackingStatus: 'ASSESSED',
        finalOutcome: { not: null },
      },
      select: { finalOutcome: true },
    });

    const executionOutcomes = await this.loadExecutionOutcomes(dt);
    const allAssessed = [...assessed, ...executionOutcomes];

    const prior = PRIOR_CONFIGS[dt] ?? PRIOR_CONFIGS['GLOBAL'];
    const score = this.computeScore(allAssessed, prior);
    const data = { score, sampleSize: allAssessed.length, ...this.priorFields(prior) };

    await this.upsertTrustScore(
      { level: TrustLevel.DECISION_TYPE, domain: null, decisionType: dt },
      data,
    );
  }

  /**
   * Load execution outcomes from agent_executions, optionally filtered by routerRoute.
   * Maps raw outcome strings to FinalOutcome via mapExecutionOutcome().
   */
  private async loadExecutionOutcomes(
    routerRoute?: string,
  ): Promise<Array<{ finalOutcome: string | null }>> {
    const where: Record<string, unknown> = {
      finalOutcome: { in: [...KNOWN_EXECUTION_OUTCOMES] },
    };
    if (routerRoute) {
      where.routerRoute = routerRoute;
    }

    const executions = await this.prisma.agentExecution.findMany({
      where,
      select: { finalOutcome: true, retryCount: true },
    });

    return executions
      .map((e) => ({
        finalOutcome: this.mapExecutionOutcome(e.finalOutcome, e.retryCount),
      }))
      .filter((e) => e.finalOutcome !== null) as Array<{ finalOutcome: string }>;
  }

  /**
   * Map an execution finalOutcome + retryCount to the FinalOutcome enum.
   *
   * | AgentExecution.finalOutcome | retryCount | Mapped FinalOutcome | Weight |
   * |-----------------------------|------------|---------------------|--------|
   * | COMMITTED                   | 0          | SUCCESS             | 1.0    |
   * | COMMITTED                   | >0         | MIXED               | 0.5    |
   * | FAILED                      | any        | FAILURE             | 0.0    |
   * | BLOCKED                     | any        | FAILURE             | 0.0    |
   * | ABANDONED                   | any        | ABANDONED           | 0.0    |
   */
  private mapExecutionOutcome(finalOutcome: string, retryCount: number): string | null {
    switch (finalOutcome) {
      case 'COMMITTED':
        return retryCount === 0 ? FinalOutcome.SUCCESS : FinalOutcome.MIXED;
      case 'FAILED':
      case 'BLOCKED':
        return FinalOutcome.FAILURE;
      case 'ABANDONED':
        return FinalOutcome.ABANDONED;
      default:
        return null;
    }
  }

  /**
   * Resolve a routerRoute string to a known decision type, or null if unmatched.
   */
  private resolveDecisionType(routerRoute: string): string | null {
    return DECISION_TYPES.includes(routerRoute as typeof DECISION_TYPES[number])
      ? routerRoute
      : null;
  }

  /**
   * Get all current trust scores.
   */
  async getAll() {
    return this.prisma.trustScore.findMany({
      orderBy: [{ level: 'asc' }, { domain: 'asc' }, { decisionType: 'asc' }],
    });
  }

  /**
   * Get trust scores filtered by level, domain, or decision type.
   */
  async getFiltered(params: { level?: string; domain?: string; decisionType?: string }) {
    const where: Record<string, unknown> = {};
    if (params.level) where.level = params.level;
    if (params.domain) where.domain = params.domain;
    if (params.decisionType) where.decisionType = params.decisionType;

    const scores = await this.prisma.trustScore.findMany({ where });

    // Enrich with display labels
    return scores.map((s: { level: string; domain: string | null; decisionType: string | null; score: number; sampleSize: number; priorAlpha: number; priorBeta: number; lastOutcomeAt: Date | null; decayedAt: Date | null; nextRecalculation: Date | null; createdAt: Date; updatedAt: Date; id: string }) => ({
      ...s,
      displayScore: Math.round(s.score),
      displayLabel: this.getDisplayLabel(s.level, s.score),
    }));
  }

  /**
   * Compute Bayesian trust score.
   *
   * TRUST = (weighted_successes + alpha) / (total + alpha + beta)
   *
   * MIXED outcomes count as 0.5 success.
   */
  private computeScore(
    assessed: Array<{ finalOutcome: string | null }>,
    prior: PriorConfig,
  ): number {
    if (assessed.length === 0) {
      return prior.priorTrust * 100;
    }

    let weightedSuccesses = 0;
    for (const r of assessed) {
      if (r.finalOutcome === FinalOutcome.SUCCESS) {
        weightedSuccesses += 1;
      } else if (r.finalOutcome === FinalOutcome.MIXED) {
        weightedSuccesses += 0.5;
      }
      // FAILURE and ABANDONED count as 0
    }

    const score =
      (weightedSuccesses + prior.alpha) / (assessed.length + prior.alpha + prior.beta);

    return Math.round(score * 100);
  }

  private priorFields(prior: PriorConfig) {
    return {
      priorAlpha: prior.alpha,
      priorBeta: prior.beta,
    };
  }

  private getDisplayLabel(level: string, score: number): string {
    return getTrustLabel(score);
  }
}
