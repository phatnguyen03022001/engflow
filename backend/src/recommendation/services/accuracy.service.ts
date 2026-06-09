// @lifecycle ACTIVE — Accuracy metric computation service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AccuracyMetrics } from '../interfaces/trust-score.interface';
import { FinalOutcome } from '../interfaces/recommendation.interface';
import { getConfidenceInterval } from '../../shared/utils/confidence-interval.util';

@Injectable()
export class AccuracyService {
  private readonly logger = new Logger(AccuracyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute full accuracy metrics from assessed recommendations.
   */
  async computeMetrics(): Promise<AccuracyMetrics> {
    const allRecommendations = await this.prisma.recommendation.findMany({
      where: { trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
      select: {
        finalOutcome: true,
        confidenceScore: true,
        confidenceLevel: true,
        regretFlag: true,
        reversalCount: true,
      },
    });

    const totalRecommendations = await this.prisma.recommendation.count();
    const totalAssessed = allRecommendations.length;

    const overallAccuracy = this.computeOverallAccuracy(allRecommendations);
    const weightedAccuracy = this.computeWeightedAccuracy(allRecommendations);
    const brierScore = this.computeBrierScore(allRecommendations);
    const byConfidenceLevel = this.computeByConfidenceLevel(allRecommendations);
    const falsePositiveRate = this.computeFalsePositiveRate(allRecommendations);
    const falseNegativeRate = this.computeFalseNegativeRate(allRecommendations);
    const regretRate = this.computeRegretRate(allRecommendations);
    const reversalRate = this.computeReversalRate(allRecommendations);
    const implementationRate = await this.computeImplementationRate();
    const trend = await this.computeTrend();

    const ci = getConfidenceInterval(
      overallAccuracy ?? 0,
      totalAssessed,
    );

    const status =
      totalAssessed < 10
        ? 'INSUFFICIENT_DATA'
        : totalAssessed < 30
          ? 'PRELIMINARY'
          : totalAssessed < 100
            ? 'MODERATE'
            : 'RELIABLE';

    const warnings: Array<{ severity: string; message: string }> = [];
    if (falsePositiveRate !== null && falsePositiveRate > 0.15) {
      warnings.push({
        severity: 'WARNING',
        message: `False Positive Rate: ${(falsePositiveRate * 100).toFixed(0)}% (HIGH-confidence recs that failed)`,
      });
    }
    if (regretRate !== null && regretRate > 0.15) {
      warnings.push({
        severity: 'WARNING',
        message: `Regret Rate climbing: ${(regretRate * 100).toFixed(0)}%`,
      });
    }

    return {
      overallAccuracy: overallAccuracy !== null ? Math.round(overallAccuracy * 100) : null,
      weightedAccuracy: weightedAccuracy !== null ? Math.round(weightedAccuracy * 100) : null,
      brierScore: brierScore !== null ? Math.round(brierScore * 1000) / 1000 : null,
      confidenceInterval: Math.round(ci.width),
      sampleSize: totalAssessed,
      totalRecommendations,
      totalAssessed,
      falsePositiveRate: falsePositiveRate !== null ? Math.round(falsePositiveRate * 1000) / 1000 : null,
      falseNegativeRate: falseNegativeRate !== null ? Math.round(falseNegativeRate * 1000) / 1000 : null,
      regretRate: regretRate !== null ? Math.round(regretRate * 1000) / 1000 : null,
      reversalRate: reversalRate !== null ? Math.round(reversalRate * 1000) / 1000 : null,
      implementationRate: implementationRate !== null ? Math.round(implementationRate * 1000) / 1000 : null,
      status,
      trend: trend.direction,
      trendValue: trend.value,
      byConfidenceLevel,
      byDecisionType: await this.computeByDecisionType(),
      warnings,
    };
  }

  /**
   * Create an accuracy snapshot in the database.
   */
  async createSnapshot() {
    const metrics = await this.computeMetrics();

    this.logger.log(
      `Creating accuracy snapshot: ${metrics.totalAssessed} assessed, ` +
      `accuracy=${metrics.overallAccuracy}%, status=${metrics.status}, trend=${metrics.trend}`,
    );

    return this.prisma.accuracySnapshot.create({
      data: {
        totalRecommendations: metrics.totalRecommendations,
        totalAssessed: metrics.totalAssessed,
        overallAccuracy: metrics.overallAccuracy ?? undefined,
        weightedAccuracy: metrics.weightedAccuracy ?? undefined,
        brierScore: metrics.brierScore ?? undefined,
        confidenceCalibration:
          this.calibrationToJson(metrics.byConfidenceLevel),
        falsePositiveRate: metrics.falsePositiveRate ?? undefined,
        falseNegativeRate: metrics.falseNegativeRate ?? undefined,
        regretRate: metrics.regretRate ?? undefined,
        reversalRate: metrics.reversalRate ?? undefined,
        forecastAccuracy: null, // Future
        implementationRate: metrics.implementationRate ?? undefined,
        trend: metrics.trend,
      },
    });
  }

  /**
   * Get the latest accuracy snapshot.
   */
  async getLatestSnapshot() {
    return this.prisma.accuracySnapshot.findFirst({
      orderBy: { snapshotDate: 'desc' },
    });
  }

  // ─── Private computation methods ──────────────────────────────────────────

  private computeOverallAccuracy(
    recs: Array<{ finalOutcome: string | null }>,
  ): number | null {
    if (recs.length === 0) return null;
    const successes = recs.filter(
      (r) => r.finalOutcome === FinalOutcome.SUCCESS,
    ).length;
    return successes / recs.length;
  }

  private computeWeightedAccuracy(
    recs: Array<{ finalOutcome: string | null; confidenceScore: number }>,
  ): number | null {
    const withConfidence = recs.filter((r) => r.confidenceScore > 0);
    if (withConfidence.length === 0) return null;

    let numerator = 0;
    let denominator = 0;

    for (const r of withConfidence) {
      const outcomeBinary =
        r.finalOutcome === FinalOutcome.SUCCESS
          ? 1
          : r.finalOutcome === FinalOutcome.MIXED
            ? 0.5
            : 0;
      numerator += outcomeBinary * (r.confidenceScore / 100);
      denominator += r.confidenceScore / 100;
    }

    return denominator > 0 ? numerator / denominator : null;
  }

  private computeBrierScore(
    recs: Array<{ finalOutcome: string | null; confidenceScore: number }>,
  ): number | null {
    const withConfidence = recs.filter((r) => r.confidenceScore > 0);
    if (withConfidence.length === 0) return null;

    let sumSquaredError = 0;
    for (const r of withConfidence) {
      const predicted = r.confidenceScore / 100;
      const actual =
        r.finalOutcome === FinalOutcome.SUCCESS
          ? 1
          : r.finalOutcome === FinalOutcome.MIXED
            ? 0.5
            : 0;
      sumSquaredError += Math.pow(predicted - actual, 2);
    }

    return Math.round((sumSquaredError / withConfidence.length) * 1000) / 1000;
  }

  private computeByConfidenceLevel(
    recs: Array<{
      finalOutcome: string | null;
      confidenceLevel: string | null;
    }>,
  ): Record<string, { accuracy: number; count: number }> {
    const levels = ['HIGH', 'MEDIUM', 'LOW'];
    const result: Record<string, { accuracy: number; count: number }> = {};

    for (const level of levels) {
      const filtered = recs.filter((r) => r.confidenceLevel === level);
      if (filtered.length === 0) {
        result[level] = { accuracy: 0, count: 0 };
        continue;
      }
      const successes = filtered.filter(
        (r) => r.finalOutcome === FinalOutcome.SUCCESS,
      ).length;
      result[level] = {
        accuracy: Math.round((successes / filtered.length) * 100),
        count: filtered.length,
      };
    }

    return result;
  }

  private async computeByDecisionType(): Promise<
    Record<string, { accuracy: number; count: number }>
  > {
    const decisionTypes = ['TC', 'AP', 'IA', 'TS', 'PC', 'BB'];
    const result: Record<string, { accuracy: number; count: number }> = {};

    // Single query with all assessed recs + decisionType, then group in-memory
    // to avoid 6 separate queries
    const allRecs = await this.prisma.recommendation.findMany({
      where: {
        decisionType: { in: decisionTypes },
        trackingStatus: 'ASSESSED',
        finalOutcome: { not: null },
      },
      select: { decisionType: true, finalOutcome: true },
    });

    const grouped = new Map<string, Array<{ finalOutcome: string | null }>>();
    for (const rec of allRecs) {
      const list = grouped.get(rec.decisionType) ?? [];
      list.push({ finalOutcome: rec.finalOutcome });
      grouped.set(rec.decisionType, list);
    }

    for (const dt of decisionTypes) {
      const recs = grouped.get(dt) ?? [];
      if (recs.length === 0) {
        result[dt] = { accuracy: 0, count: 0 };
        continue;
      }

      const successes = recs.filter(
        (r) => r.finalOutcome === FinalOutcome.SUCCESS,
      ).length;
      result[dt] = {
        accuracy: Math.round((successes / recs.length) * 100),
        count: recs.length,
      };
    }

    return result;
  }

  private computeFalsePositiveRate(
    recs: Array<{
      finalOutcome: string | null;
      confidenceLevel: string | null;
    }>,
  ): number | null {
    const highConfidence = recs.filter((r) => r.confidenceLevel === 'HIGH');
    if (highConfidence.length === 0) return null;

    const falsePositives = highConfidence.filter(
      (r) =>
        r.finalOutcome === FinalOutcome.FAILURE ||
        r.finalOutcome === FinalOutcome.ABANDONED,
    ).length;

    return falsePositives / highConfidence.length;
  }

  private computeFalseNegativeRate(
    recs: Array<{
      finalOutcome: string | null;
      confidenceLevel: string | null;
    }>,
  ): number | null {
    const lowConfidence = recs.filter((r) => r.confidenceLevel === 'LOW');
    if (lowConfidence.length === 0) return null;

    const falseNegatives = lowConfidence.filter(
      (r) => r.finalOutcome === FinalOutcome.SUCCESS,
    ).length;

    return falseNegatives / lowConfidence.length;
  }

  private computeRegretRate(
    recs: Array<{ regretFlag: boolean | null }>,
  ): number | null {
    const withRegretData = recs.filter((r) => r.regretFlag !== null);
    if (withRegretData.length === 0) return null;

    const regretted = withRegretData.filter((r) => r.regretFlag === true).length;
    return regretted / withRegretData.length;
  }

  private computeReversalRate(
    recs: Array<{ reversalCount: number }>,
  ): number | null {
    if (recs.length === 0) return null;
    const totalReversals = recs.reduce(
      (sum, r) => sum + (r.reversalCount ?? 0),
      0,
    );
    return totalReversals / recs.length;
  }

  private async computeImplementationRate(): Promise<number | null> {
    const total = await this.prisma.recommendation.count({
      where: { trackingStatus: { not: 'PENDING' } },
    });
    const implemented = await this.prisma.recommendation.count({
      where: { implementedOption: { not: null } },
    });
    if (total === 0) return null;
    return implemented / total;
  }

  private async computeTrend(): Promise<{
    direction: string;
    value: number;
  }> {
    // Look at last 30 vs first 30 assessed
    const assessed = await this.prisma.recommendation.findMany({
      where: { trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
      orderBy: { assessedAt: 'asc' },
      select: { finalOutcome: true, assessedAt: true },
    });

    if (assessed.length < 20) {
      return { direction: 'STABLE', value: 0 };
    }

    const mid = Math.floor(assessed.length / 2);
    const firstHalf = assessed.slice(0, mid);
    const secondHalf = assessed.slice(mid);

    const firstAccuracy =
      firstHalf.filter((r: { finalOutcome: string | null }) => r.finalOutcome === FinalOutcome.SUCCESS).length /
      firstHalf.length;
    const secondAccuracy =
      secondHalf.filter((r: { finalOutcome: string | null }) => r.finalOutcome === FinalOutcome.SUCCESS).length /
      secondHalf.length;

    const trendValue =
      firstAccuracy > 0
        ? (secondAccuracy - firstAccuracy) / firstAccuracy
        : 0;

    let direction = 'STABLE';
    if (trendValue > 0.1) direction = 'IMPROVING';
    else if (trendValue < -0.1) direction = 'DECLINING';

    return {
      direction,
      value: Math.round(trendValue * 100),
    };
  }

  private calibrationToJson(
    byConfidenceLevel: Record<string, { accuracy: number; count: number }>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [level, data] of Object.entries(byConfidenceLevel)) {
      if (data.count > 0) {
        result[level] = data.accuracy / 100;
      }
    }
    return result;
  }
}
