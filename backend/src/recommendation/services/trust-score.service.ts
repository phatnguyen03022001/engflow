// @lifecycle ACTIVE — Bayesian Trust Score computation service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PRIOR_CONFIGS, PriorConfig } from '../interfaces/trust-score.interface';
import { TrustLevel, FinalOutcome } from '../interfaces/recommendation.interface';

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculate trust scores at all levels.
   */
  async recalculateAll() {
    await Promise.all([
      this.recalculateGlobal(),
      this.recalculateByDecisionType(),
      this.recalculateByDomain(),
    ]);
  }

  /**
   * Recalculate GLOBAL trust score.
   */
  async recalculateGlobal() {
    const assessed = await this.prisma.recommendation.findMany({
      where: {
        trackingStatus: 'ASSESSED',
        finalOutcome: { not: null },
      },
      select: { finalOutcome: true },
    });

    const prior = PRIOR_CONFIGS['GLOBAL'];
    const score = this.computeScore(assessed, prior);
    const data = { score, sampleSize: assessed.length, ...this.priorFields(prior) };

    const existing = await this.prisma.trustScore.findFirst({
      where: { level: TrustLevel.GLOBAL, domain: null, decisionType: null },
    });
    if (existing) {
      await this.prisma.trustScore.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.trustScore.create({
        data: { level: TrustLevel.GLOBAL, domain: null, decisionType: null, ...data },
      });
    }

    return { level: TrustLevel.GLOBAL, score, sampleSize: assessed.length };
  }

  /**
   * Recalculate trust scores by decision type (TC, AP, IA, TS, PC, BB).
   */
  async recalculateByDecisionType() {
    const decisionTypes = ['TC', 'AP', 'IA', 'TS', 'PC', 'BB'];
    const results: Array<{ decisionType: string; score: number; sampleSize: number }> = [];

    for (const dt of decisionTypes) {
      const assessed = await this.prisma.recommendation.findMany({
        where: {
          decisionType: dt,
          trackingStatus: 'ASSESSED',
          finalOutcome: { not: null },
        },
        select: { finalOutcome: true },
      });

      const prior = PRIOR_CONFIGS[dt] ?? PRIOR_CONFIGS['GLOBAL'];
      const score = this.computeScore(assessed, prior);
      const data = { score, sampleSize: assessed.length, ...this.priorFields(prior) };

      const existing = await this.prisma.trustScore.findFirst({
        where: { level: TrustLevel.DECISION_TYPE, decisionType: dt },
      });
      if (existing) {
        await this.prisma.trustScore.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.trustScore.create({
          data: { level: TrustLevel.DECISION_TYPE, domain: null, decisionType: dt, ...data },
        });
      }

      results.push({ decisionType: dt, score, sampleSize: assessed.length });
    }

    return results;
  }

  /**
   * Recalculate trust scores by domain.
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

      const existing = await this.prisma.trustScore.findFirst({
        where: { level: TrustLevel.DOMAIN, domain: decisionDomain },
      });
      if (existing) {
        await this.prisma.trustScore.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.trustScore.create({
          data: { level: TrustLevel.DOMAIN, domain: decisionDomain, decisionType: null, ...data },
        });
      }

      results.push({
        domain: decisionDomain,
        score,
        sampleSize: assessed.length,
      });
    }

    return results;
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

  /**
   * Compute 95% confidence interval for a trust score.
   */
  getConfidenceInterval(score: number, sampleSize: number): { lower: number; upper: number; width: number } {
    if (sampleSize < 1) {
      return { lower: 0, upper: 100, width: 100 };
    }

    const p = score / 100;
    const z = 1.96; // 95% confidence
    const margin = z * Math.sqrt((p * (1 - p)) / sampleSize);

    return {
      lower: Math.max(0, Math.round((p - margin) * 100)),
      upper: Math.min(100, Math.round((p + margin) * 100)),
      width: Math.round(margin * 100),
    };
  }

  private priorFields(prior: PriorConfig) {
    return {
      priorAlpha: prior.alpha,
      priorBeta: prior.beta,
    };
  }

  private getDisplayLabel(level: string, score: number): string {
    if (score >= 90) return 'VERY HIGH';
    if (score >= 75) return 'HIGH';
    if (score >= 60) return 'MODERATE';
    if (score >= 40) return 'LOW';
    return 'UNTRUSTED';
  }
}
