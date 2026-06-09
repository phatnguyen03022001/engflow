// @lifecycle ACTIVE — Metric orchestration service

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RouterEvaluatorService } from './router-evaluator.service';
import { PlannerEvaluatorService } from './planner-evaluator.service';
import { CodeEvaluatorService } from './code-evaluator.service';
import { ExecutionTraceService } from './execution-trace.service';
import { MemoryService } from '../../memory/services/memory.service';
import { TrustScoreService } from '../../recommendation/services/trust-score.service';
import { CostTrackerService } from '../../model-registry/services/cost-tracker.service';
import { MetricSnapshot, ExecutionSummary, MetricDimensionEntry } from '../interfaces/metric.interface';
import { QueryMetricsDto } from '../dto/query-metrics.dto';

@Injectable()
export class MetricService {
  private readonly logger = new Logger(MetricService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerEvaluatorService: RouterEvaluatorService,
    private readonly plannerEvaluatorService: PlannerEvaluatorService,
    private readonly codeEvaluatorService: CodeEvaluatorService,
    private readonly executionTraceService: ExecutionTraceService,
    private readonly memoryService: MemoryService,
    private readonly trustScoreService: TrustScoreService,
    private readonly costTrackerService: CostTrackerService,
  ) {}

  /**
   * Compute all metrics for a given window and save to database.
   * Returns an array of MetricSnapshots.
   */
  async computeAll(window: string = 'ALL_TIME'): Promise<MetricSnapshot[]> {
    const computedAt = new Date().toISOString();

    const [routerResult, plannerResult, codeResult] = await Promise.all([
      this.routerEvaluatorService.compute(),
      this.plannerEvaluatorService.computeAll(),
      this.codeEvaluatorService.computeAll(),
    ]);

    const snapshots: MetricSnapshot[] = [];

    // Router accuracy
    if (routerResult.accuracy !== null) {
      snapshots.push(await this.saveMetric({
        agentType: 'ROUTER',
        metricName: 'ACCURACY',
        metricValue: routerResult.accuracy,
        sampleSize: routerResult.totalRouted,
        confidenceIntervalLow: routerResult.confidenceInterval.low,
        confidenceIntervalHigh: routerResult.confidenceInterval.high,
        window,
        computedAt,
        dimensions: routerResult.byRoute.map((r) => ({
          dimensionKey: 'route',
          dimensionValue: r.route,
          count: r.total,
          value: r.total > 0 ? r.consistent / r.total : 0,
        })),
      }));
    }

    // Planner accuracy
    if (plannerResult.plannerAccuracy !== null) {
      snapshots.push(await this.saveMetric({
        agentType: 'PLANNER',
        metricName: 'ACCURACY',
        metricValue: plannerResult.plannerAccuracy,
        sampleSize: plannerResult.plannerAccuracySampleSize,
        confidenceIntervalLow: plannerResult.plannerAccuracyConfidenceInterval.low,
        confidenceIntervalHigh: plannerResult.plannerAccuracyConfidenceInterval.high,
        window,
        computedAt,
        dimensions: [],
      }));
    }

    // Planner revision rate
    if (plannerResult.revisionRate !== null) {
      snapshots.push(await this.saveMetric({
        agentType: 'PLANNER',
        metricName: 'REVISION_RATE',
        metricValue: plannerResult.revisionRate,
        sampleSize: plannerResult.revisionRateSampleSize,
        confidenceIntervalLow: null,
        confidenceIntervalHigh: null,
        window,
        computedAt,
        dimensions: [],
      }));
    }

    // Code first-attempt rate
    if (codeResult.firstAttemptRate !== null) {
      snapshots.push(await this.saveMetric({
        agentType: 'CODE',
        metricName: 'FIRST_ATTEMPT_RATE',
        metricValue: codeResult.firstAttemptRate,
        sampleSize: codeResult.firstAttemptSampleSize,
        confidenceIntervalLow: codeResult.firstAttemptConfidenceInterval.low,
        confidenceIntervalHigh: codeResult.firstAttemptConfidenceInterval.high,
        window,
        computedAt,
        dimensions: [],
      }));
    }

    // Code overall success rate
    if (codeResult.overallSuccessRate !== null) {
      snapshots.push(await this.saveMetric({
        agentType: 'CODE',
        metricName: 'SUCCESS_RATE',
        metricValue: codeResult.overallSuccessRate,
        sampleSize: codeResult.overallSuccessSampleSize,
        confidenceIntervalLow: codeResult.overallSuccessConfidenceInterval.low,
        confidenceIntervalHigh: codeResult.overallSuccessConfidenceInterval.high,
        window,
        computedAt,
        dimensions: [],
      }));
    }

    // Debug success rate
    if (codeResult.debugSuccessRate !== null) {
      snapshots.push(await this.saveMetric({
        agentType: 'DEBUG',
        metricName: 'SUCCESS_RATE',
        metricValue: codeResult.debugSuccessRate,
        sampleSize: codeResult.debugSuccessSampleSize,
        confidenceIntervalLow: codeResult.debugSuccessConfidenceInterval.low,
        confidenceIntervalHigh: codeResult.debugSuccessConfidenceInterval.high,
        window,
        computedAt,
        dimensions: [],
      }));
    }

    return snapshots;
  }

  /**
   * Get stored metrics with optional filters and pagination.
   */
  async getMetrics(filters: QueryMetricsDto) {
    const skip = filters.skip ? parseInt(filters.skip, 10) : 0;
    const take = filters.take ? parseInt(filters.take, 10) : 20;

    const where: Prisma.AgentMetricWhereInput = {};

    if (filters.agentType) {
      where.agentType = filters.agentType;
    }
    if (filters.metricName) {
      where.metricName = filters.metricName;
    }
    if (filters.window) {
      where.window = filters.window;
    }

    const [items, total] = await Promise.all([
      this.prisma.agentMetric.findMany({
        where,
        skip,
        take,
        orderBy: { computedAt: 'desc' },
        include: { dimensions: true },
      }),
      this.prisma.agentMetric.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get fresh execution summary (not from stored metrics).
   */
  async getSummary(): Promise<ExecutionSummary> {
    const [routerResult, plannerResult, codeResult] = await Promise.all([
      this.routerEvaluatorService.compute(),
      this.plannerEvaluatorService.computeAll(),
      this.codeEvaluatorService.computeAll(),
    ]);

    const totalExecutions =
      (await this.prisma.agentExecution.count()) ?? 0;

    return {
      routerAccuracy: routerResult.accuracy !== null
        ? Math.round(routerResult.accuracy * 100) / 100
        : null,
      plannerAccuracy: plannerResult.plannerAccuracy !== null
        ? Math.round(plannerResult.plannerAccuracy * 100) / 100
        : null,
      plannerRevisionRate: plannerResult.revisionRate !== null
        ? Math.round(plannerResult.revisionRate * 100) / 100
        : null,
      codeFirstAttemptRate: codeResult.firstAttemptRate !== null
        ? Math.round(codeResult.firstAttemptRate * 100) / 100
        : null,
      codeOverallSuccess: codeResult.overallSuccessRate !== null
        ? Math.round(codeResult.overallSuccessRate * 100) / 100
        : null,
      debugSuccessRate: codeResult.debugSuccessRate !== null
        ? Math.round(codeResult.debugSuccessRate * 100) / 100
        : null,
      totalExecutions,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Called when an execution is committed — creates AgentMemory entries
   * and updates TrustScore based on the execution outcome.
   */
  async onExecutionCommitted(executionId: string): Promise<void> {
    try {
      // Fetch execution for its outcome details
      const execution = await this.executionTraceService.findByExecutionId(executionId);

      // Create agent memory (existing behavior)
      await this.memoryService.createFromExecution(executionId);
      this.logger.log(`Memory created from committed execution ${executionId}`);

      // Update trust score from execution outcome (new real-time path)
      await this.trustScoreService.recordExecutionOutcome(
        executionId,
        execution.finalOutcome,
        execution.retryCount,
      );
      this.logger.log(`Trust score updated from committed execution ${executionId}`);

      // Log cost data for each phase with model usage
      if (execution.phases) {
        for (const phase of execution.phases) {
          if (phase.modelUsed) {
            try {
              await this.costTrackerService.recordCost({
                modelId: phase.modelUsed,
                executionId: execution.executionId,
                phaseId: phase.phaseId,
                inputTokens: 0,
                outputTokens: 0,
                costUsd: 0,
                latencyMs: phase.durationMs ?? 0,
                wasFallback: false,
              });
            } catch (costError) {
              this.logger.warn(
                `Failed to record cost for phase ${phase.phaseId}: ${(costError as Error).message}`,
              );
            }
          }
        }
        this.logger.log(`Cost logs recorded for ${executionId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process committed execution ${executionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete existing metrics for a window and recompute.
   */
  async recomputeAll(window: string = 'ALL_TIME'): Promise<MetricSnapshot[]> {
    await this.prisma.metricDimension.deleteMany({
      where: { metric: { window } },
    });
    await this.prisma.agentMetric.deleteMany({
      where: { window },
    });

    return this.computeAll(window);
  }

  /**
   * Save a single metric with optional dimensions.
   */
  private async saveMetric(params: {
    agentType: string;
    metricName: string;
    metricValue: number;
    sampleSize: number;
    confidenceIntervalLow: number | null;
    confidenceIntervalHigh: number | null;
    window: string;
    computedAt: string;
    dimensions: MetricDimensionEntry[];
  }): Promise<MetricSnapshot> {
    const metric = await this.prisma.agentMetric.create({
      data: {
        agentType: params.agentType,
        metricName: params.metricName,
        metricValue: params.metricValue,
        sampleSize: params.sampleSize,
        confidenceIntervalLow: params.confidenceIntervalLow ?? undefined,
        confidenceIntervalHigh: params.confidenceIntervalHigh ?? undefined,
        window: params.window,
        computedAt: new Date(params.computedAt),
        dimensions:
          params.dimensions.length > 0
            ? {
                create: params.dimensions.map((d) => ({
                  dimensionKey: d.dimensionKey,
                  dimensionValue: d.dimensionValue,
                  count: d.count,
                  value: d.value,
                })),
              }
            : undefined,
      },
      include: { dimensions: true },
    });

    return {
      agentType: metric.agentType,
      metricName: metric.metricName,
      metricValue: metric.metricValue,
      sampleSize: metric.sampleSize,
      confidenceIntervalLow: metric.confidenceIntervalLow,
      confidenceIntervalHigh: metric.confidenceIntervalHigh,
      window: metric.window,
      computedAt: metric.computedAt.toISOString(),
      dimensions: metric.dimensions.map((d) => ({
        dimensionKey: d.dimensionKey,
        dimensionValue: d.dimensionValue,
        count: d.count,
        value: d.value,
      })),
    };
  }
}
