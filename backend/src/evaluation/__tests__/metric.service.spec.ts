// @lifecycle ACTIVE — Unit tests for MetricService
import { Test, TestingModule } from '@nestjs/testing';
import { MetricService } from '../services/metric.service';
import { MemoryService } from '../../memory/services/memory.service';
import { RouterEvaluatorService } from '../services/router-evaluator.service';
import { PlannerEvaluatorService } from '../services/planner-evaluator.service';
import { CodeEvaluatorService } from '../services/code-evaluator.service';
import { ExecutionTraceService } from '../services/execution-trace.service';
import { TrustScoreService } from '../../recommendation/services/trust-score.service';
import { CostTrackerService } from '../../model-registry/services/cost-tracker.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('MetricService', () => {
  let service: MetricService;

  const mockPrisma = {
    agentExecution: {
      count: jest.fn(),
    },
    agentMetric: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    metricDimension: {
      deleteMany: jest.fn(),
    },
  };

  const mockRouterEvaluator = {
    compute: jest.fn(),
  };

  const mockPlannerEvaluator = {
    computeAll: jest.fn(),
  };

  const mockCodeEvaluator = {
    computeAll: jest.fn(),
  };

  const mockExecutionTraceService = {};

  const mockMemoryService = {
    createFromExecution: jest.fn(),
    createMemory: jest.fn(),
    querySimilar: jest.fn(),
    getTopPatterns: jest.fn(),
    getSummary: jest.fn(),
    decayAll: jest.fn(),
    cleanupStale: jest.fn(),
  };

  const mockTrustScoreService = {
    recordExecutionOutcome: jest.fn(),
  };

  const mockCostTrackerService = {
    recordCost: jest.fn(),
    getCostReport: jest.fn(),
    getProjectedMonthlySpend: jest.fn(),
    recalculate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RouterEvaluatorService, useValue: mockRouterEvaluator },
        { provide: PlannerEvaluatorService, useValue: mockPlannerEvaluator },
        { provide: CodeEvaluatorService, useValue: mockCodeEvaluator },
        { provide: ExecutionTraceService, useValue: mockExecutionTraceService },
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: TrustScoreService, useValue: mockTrustScoreService },
        { provide: CostTrackerService, useValue: mockCostTrackerService },
      ],
    }).compile();

    service = module.get<MetricService>(MetricService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return execution summary with all metrics', async () => {
      mockRouterEvaluator.compute.mockResolvedValue({
        accuracy: 0.8,
        totalRouted: 10,
        outcomeConsistent: 8,
        outcomeInconsistent: 2,
        ambiguous: 0,
        confidenceInterval: { low: 60, high: 100, width: 20 },
        byRoute: [],
      });
      mockPlannerEvaluator.computeAll.mockResolvedValue({
        plannerAccuracy: 0.86,
        plannerAccuracySampleSize: 7,
        plannerAccuracyConfidenceInterval: { low: 60, high: 100, width: 20 },
        revisionRate: 0.33,
        revisionRateSampleSize: 3,
        archReviewedCount: 3,
        archRevisionNeededCount: 1,
      });
      mockCodeEvaluator.computeAll.mockResolvedValue({
        firstAttemptRate: 0.57,
        firstAttemptSampleSize: 7,
        firstAttemptConfidenceInterval: { low: 20, high: 94, width: 37 },
        overallSuccessRate: 0.86,
        overallSuccessSampleSize: 7,
        overallSuccessConfidenceInterval: { low: 60, high: 100, width: 20 },
        debugSuccessRate: 1.0,
        debugSuccessSampleSize: 2,
        debugSuccessConfidenceInterval: { low: 100, high: 100, width: 0 },
      });
      mockPrisma.agentExecution.count.mockResolvedValue(10);

      const result = await service.getSummary();

      expect(result.routerAccuracy).toBe(0.8);
      expect(result.plannerAccuracy).toBe(0.86);
      expect(result.plannerRevisionRate).toBe(0.33);
      expect(result.codeFirstAttemptRate).toBe(0.57);
      expect(result.codeOverallSuccess).toBe(0.86);
      expect(result.debugSuccessRate).toBe(1.0);
      expect(result.totalExecutions).toBe(10);
      expect(result.computedAt).toBeDefined();
    });

    it('should handle null metrics gracefully', async () => {
      mockRouterEvaluator.compute.mockResolvedValue({
        accuracy: null,
        totalRouted: 0,
        outcomeConsistent: 0,
        outcomeInconsistent: 0,
        ambiguous: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
        byRoute: [],
      });
      mockPlannerEvaluator.computeAll.mockResolvedValue({
        plannerAccuracy: null,
        plannerAccuracySampleSize: 0,
        plannerAccuracyConfidenceInterval: { low: 0, high: 100, width: 100 },
        revisionRate: null,
        revisionRateSampleSize: 0,
        archReviewedCount: 0,
        archRevisionNeededCount: 0,
      });
      mockCodeEvaluator.computeAll.mockResolvedValue({
        firstAttemptRate: null,
        firstAttemptSampleSize: 0,
        firstAttemptConfidenceInterval: { low: 0, high: 100, width: 100 },
        overallSuccessRate: null,
        overallSuccessSampleSize: 0,
        overallSuccessConfidenceInterval: { low: 0, high: 100, width: 100 },
        debugSuccessRate: null,
        debugSuccessSampleSize: 0,
        debugSuccessConfidenceInterval: { low: 0, high: 100, width: 100 },
      });
      mockPrisma.agentExecution.count.mockResolvedValue(0);

      const result = await service.getSummary();

      expect(result.routerAccuracy).toBeNull();
      expect(result.plannerAccuracy).toBeNull();
      expect(result.plannerRevisionRate).toBeNull();
      expect(result.codeFirstAttemptRate).toBeNull();
      expect(result.codeOverallSuccess).toBeNull();
      expect(result.debugSuccessRate).toBeNull();
      expect(result.totalExecutions).toBe(0);
    });
  });

  describe('computeAll', () => {
    it('should compute and save all metrics', async () => {
      mockRouterEvaluator.compute.mockResolvedValue({
        accuracy: 0.8,
        totalRouted: 10,
        outcomeConsistent: 8,
        outcomeInconsistent: 2,
        ambiguous: 0,
        confidenceInterval: { low: 60, high: 100, width: 20 },
        byRoute: [
          { route: 'LEVEL_1', total: 5, consistent: 4, inconsistent: 1, ambiguous: 0 },
        ],
      });
      mockPlannerEvaluator.computeAll.mockResolvedValue({
        plannerAccuracy: 0.86,
        plannerAccuracySampleSize: 7,
        plannerAccuracyConfidenceInterval: { low: 60, high: 100, width: 20 },
        revisionRate: 0.33,
        revisionRateSampleSize: 3,
        archReviewedCount: 3,
        archRevisionNeededCount: 1,
      });
      mockCodeEvaluator.computeAll.mockResolvedValue({
        firstAttemptRate: 0.57,
        firstAttemptSampleSize: 7,
        firstAttemptConfidenceInterval: { low: 20, high: 94, width: 37 },
        overallSuccessRate: 0.86,
        overallSuccessSampleSize: 7,
        overallSuccessConfidenceInterval: { low: 60, high: 100, width: 20 },
        debugSuccessRate: 1.0,
        debugSuccessSampleSize: 2,
        debugSuccessConfidenceInterval: { low: 100, high: 100, width: 0 },
      });

      // Each saveMetric calls agentMetric.create
      mockPrisma.agentMetric.create
        .mockResolvedValueOnce({
          id: 'm1',
          agentType: 'ROUTER',
          metricName: 'ACCURACY',
          metricValue: 0.8,
          sampleSize: 10,
          confidenceIntervalLow: 60,
          confidenceIntervalHigh: 100,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        })
        .mockResolvedValueOnce({
          id: 'm2',
          agentType: 'PLANNER',
          metricName: 'ACCURACY',
          metricValue: 0.86,
          sampleSize: 7,
          confidenceIntervalLow: 60,
          confidenceIntervalHigh: 100,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        })
        .mockResolvedValueOnce({
          id: 'm3',
          agentType: 'PLANNER',
          metricName: 'REVISION_RATE',
          metricValue: 0.33,
          sampleSize: 3,
          confidenceIntervalLow: null,
          confidenceIntervalHigh: null,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        })
        .mockResolvedValueOnce({
          id: 'm4',
          agentType: 'CODE',
          metricName: 'FIRST_ATTEMPT_RATE',
          metricValue: 0.57,
          sampleSize: 7,
          confidenceIntervalLow: 20,
          confidenceIntervalHigh: 94,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        })
        .mockResolvedValueOnce({
          id: 'm5',
          agentType: 'CODE',
          metricName: 'SUCCESS_RATE',
          metricValue: 0.86,
          sampleSize: 7,
          confidenceIntervalLow: 60,
          confidenceIntervalHigh: 100,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        })
        .mockResolvedValueOnce({
          id: 'm6',
          agentType: 'DEBUG',
          metricName: 'SUCCESS_RATE',
          metricValue: 1.0,
          sampleSize: 2,
          confidenceIntervalLow: 100,
          confidenceIntervalHigh: 100,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        });

      const result = await service.computeAll('ALL_TIME');

      expect(result).toHaveLength(6);
      expect(mockPrisma.agentMetric.create).toHaveBeenCalledTimes(6);
    });
  });

  describe('recomputeAll', () => {
    it('should delete and recompute metrics', async () => {
      mockPrisma.metricDimension.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.agentMetric.deleteMany.mockResolvedValue({ count: 0 });

      mockRouterEvaluator.compute.mockResolvedValue({
        accuracy: null,
        totalRouted: 0,
        outcomeConsistent: 0,
        outcomeInconsistent: 0,
        ambiguous: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
        byRoute: [],
      });
      mockPlannerEvaluator.computeAll.mockResolvedValue({
        plannerAccuracy: null,
        plannerAccuracySampleSize: 0,
        plannerAccuracyConfidenceInterval: { low: 0, high: 100, width: 100 },
        revisionRate: null,
        revisionRateSampleSize: 0,
        archReviewedCount: 0,
        archRevisionNeededCount: 0,
      });
      mockCodeEvaluator.computeAll.mockResolvedValue({
        firstAttemptRate: null,
        firstAttemptSampleSize: 0,
        firstAttemptConfidenceInterval: { low: 0, high: 100, width: 100 },
        overallSuccessRate: null,
        overallSuccessSampleSize: 0,
        overallSuccessConfidenceInterval: { low: 0, high: 100, width: 100 },
        debugSuccessRate: null,
        debugSuccessSampleSize: 0,
        debugSuccessConfidenceInterval: { low: 0, high: 100, width: 100 },
      });

      const result = await service.recomputeAll('ALL_TIME');

      expect(mockPrisma.metricDimension.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.agentMetric.deleteMany).toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('getMetrics', () => {
    it('should return paginated metrics', async () => {
      mockPrisma.agentMetric.findMany.mockResolvedValue([
        {
          id: 'm1',
          agentType: 'ROUTER',
          metricName: 'ACCURACY',
          metricValue: 0.8,
          sampleSize: 10,
          confidenceIntervalLow: 60,
          confidenceIntervalHigh: 100,
          window: 'ALL_TIME',
          computedAt: new Date(),
          createdAt: new Date(),
          dimensions: [],
        },
      ]);
      mockPrisma.agentMetric.count.mockResolvedValue(1);

      const result = await service.getMetrics({ agentType: 'ROUTER' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply filters correctly', async () => {
      mockPrisma.agentMetric.findMany.mockResolvedValue([]);
      mockPrisma.agentMetric.count.mockResolvedValue(0);

      await service.getMetrics({
        agentType: 'CODE',
        metricName: 'SUCCESS_RATE',
        window: 'ALL_TIME',
      });

      expect(mockPrisma.agentMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            agentType: 'CODE',
            metricName: 'SUCCESS_RATE',
            window: 'ALL_TIME',
          },
        }),
      );
    });
  });
});
