// @lifecycle ACTIVE — Code agent evaluation service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { getConfidenceInterval } from '../../shared/utils/confidence-interval.util';

export interface CodeEvaluationResult {
  firstAttemptRate: number | null;
  firstAttemptSampleSize: number;
  firstAttemptConfidenceInterval: { low: number; high: number; width: number };
  overallSuccessRate: number | null;
  overallSuccessSampleSize: number;
  overallSuccessConfidenceInterval: { low: number; high: number; width: number };
  debugSuccessRate: number | null;
  debugSuccessSampleSize: number;
  debugSuccessConfidenceInterval: { low: number; high: number; width: number };
}

@Injectable()
export class CodeEvaluatorService {
  private readonly logger = new Logger(CodeEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute first-attempt rate: codeFirstAttemptSuccess / codeAttempts >= 1.
   */
  async computeFirstAttemptRate(): Promise<{
    rate: number | null;
    sampleSize: number;
    confidenceInterval: { low: number; high: number; width: number };
  }> {
    const executions = await this.prisma.agentExecution.findMany({
      where: {
        codeAttempts: { gte: 1 },
        codeFirstAttemptSuccess: { not: null },
      },
      select: {
        codeFirstAttemptSuccess: true,
      },
    });

    if (executions.length === 0) {
      return {
        rate: null,
        sampleSize: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
      };
    }

    const successes = executions.filter(
      (e) => e.codeFirstAttemptSuccess === true,
    ).length;

    const rate = successes / executions.length;
    const ci = getConfidenceInterval(rate, executions.length);

    return {
      rate,
      sampleSize: executions.length,
      confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width },
    };
  }

  /**
   * Compute overall success rate: postVerifyDecision IN ('PASS','FLAG') / codeAttempts >= 1.
   */
  async computeOverallSuccessRate(): Promise<{
    rate: number | null;
    sampleSize: number;
    confidenceInterval: { low: number; high: number; width: number };
  }> {
    const executions = await this.prisma.agentExecution.findMany({
      where: {
        codeAttempts: { gte: 1 },
        postVerifyDecision: { not: null },
      },
      select: {
        postVerifyDecision: true,
      },
    });

    if (executions.length === 0) {
      return {
        rate: null,
        sampleSize: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
      };
    }

    const successes = executions.filter(
      (e) =>
        e.postVerifyDecision === 'PASS' || e.postVerifyDecision === 'FLAG',
    ).length;

    const rate = successes / executions.length;
    const ci = getConfidenceInterval(rate, executions.length);

    return {
      rate,
      sampleSize: executions.length,
      confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width },
    };
  }

  /**
   * Compute debug success rate: debugSuccess AND retryCount = 1 / retryCount = 1.
   */
  async computeDebugSuccessRate(): Promise<{
    rate: number | null;
    sampleSize: number;
    confidenceInterval: { low: number; high: number; width: number };
  }> {
    const executions = await this.prisma.agentExecution.findMany({
      where: {
        retryCount: 1,
        debugSuccess: { not: null },
      },
      select: {
        debugSuccess: true,
      },
    });

    if (executions.length === 0) {
      return {
        rate: null,
        sampleSize: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
      };
    }

    const successes = executions.filter(
      (e) => e.debugSuccess === true,
    ).length;

    const rate = successes / executions.length;
    const ci = getConfidenceInterval(rate, executions.length);

    return {
      rate,
      sampleSize: executions.length,
      confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width },
    };
  }

  /**
   * Compute all code metrics in one call.
   */
  async computeAll(): Promise<CodeEvaluationResult> {
    const [firstAttempt, overallSuccess, debugSuccess] = await Promise.all([
      this.computeFirstAttemptRate(),
      this.computeOverallSuccessRate(),
      this.computeDebugSuccessRate(),
    ]);

    return {
      firstAttemptRate: firstAttempt.rate,
      firstAttemptSampleSize: firstAttempt.sampleSize,
      firstAttemptConfidenceInterval: firstAttempt.confidenceInterval,
      overallSuccessRate: overallSuccess.rate,
      overallSuccessSampleSize: overallSuccess.sampleSize,
      overallSuccessConfidenceInterval: overallSuccess.confidenceInterval,
      debugSuccessRate: debugSuccess.rate,
      debugSuccessSampleSize: debugSuccess.sampleSize,
      debugSuccessConfidenceInterval: debugSuccess.confidenceInterval,
    };
  }
}
