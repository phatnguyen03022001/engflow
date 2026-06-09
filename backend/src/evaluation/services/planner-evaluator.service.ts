// @lifecycle ACTIVE — Planner accuracy and revision rate computation service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { getConfidenceInterval } from '../../shared/utils/confidence-interval.util';

export interface PlannerEvaluationResult {
  plannerAccuracy: number | null;
  plannerAccuracySampleSize: number;
  plannerAccuracyConfidenceInterval: { low: number; high: number; width: number };
  revisionRate: number | null;
  revisionRateSampleSize: number;
  archReviewedCount: number;
  archRevisionNeededCount: number;
}

@Injectable()
export class PlannerEvaluatorService {
  private readonly logger = new Logger(PlannerEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute planner accuracy: (PASS + FLAG) / total plans with planTaskCount > 0.
   * Plans with no pre-verify recorded are assumed accepted.
   */
  async computePlannerAccuracy(): Promise<{
    accuracy: number | null;
    sampleSize: number;
    confidenceInterval: { low: number; high: number; width: number };
  }> {
    const executions = await this.prisma.agentExecution.findMany({
      where: {
        planTaskCount: { gt: 0 },
      },
      select: {
        preVerifyDecision: true,
      },
    });

    if (executions.length === 0) {
      return {
        accuracy: null,
        sampleSize: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
      };
    }

    const accepted = executions.filter(
      (e) =>
        e.preVerifyDecision === null ||
        e.preVerifyDecision === 'PASS' ||
        e.preVerifyDecision === 'FLAG',
    ).length;

    const accuracy = accepted / executions.length;
    const ci = getConfidenceInterval(accuracy, executions.length);

    return {
      accuracy,
      sampleSize: executions.length,
      confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width },
    };
  }

  /**
   * Compute revision rate: archRevisionNeeded / archReviewed.
   */
  async computeRevisionRate(): Promise<{
    rate: number | null;
    sampleSize: number;
    archReviewedCount: number;
    archRevisionNeededCount: number;
  }> {
    const executions = await this.prisma.agentExecution.findMany({
      where: {
        archReviewed: true,
      },
      select: {
        archRevisionNeeded: true,
      },
    });

    const archReviewedCount = executions.length;
    const archRevisionNeededCount = executions.filter(
      (e) => e.archRevisionNeeded === true,
    ).length;

    const rate =
      archReviewedCount > 0 ? archRevisionNeededCount / archReviewedCount : null;

    return {
      rate,
      sampleSize: archReviewedCount,
      archReviewedCount,
      archRevisionNeededCount,
    };
  }

  /**
   * Compute all planner metrics in one call.
   */
  async computeAll(): Promise<PlannerEvaluationResult> {
    const [accuracyResult, revisionResult] = await Promise.all([
      this.computePlannerAccuracy(),
      this.computeRevisionRate(),
    ]);

    return {
      plannerAccuracy: accuracyResult.accuracy,
      plannerAccuracySampleSize: accuracyResult.sampleSize,
      plannerAccuracyConfidenceInterval: accuracyResult.confidenceInterval,
      revisionRate: revisionResult.rate,
      revisionRateSampleSize: revisionResult.sampleSize,
      archReviewedCount: revisionResult.archReviewedCount,
      archRevisionNeededCount: revisionResult.archRevisionNeededCount,
    };
  }
}
