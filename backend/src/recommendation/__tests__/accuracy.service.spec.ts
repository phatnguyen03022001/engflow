// @lifecycle ACTIVE — Unit tests for AccuracyService
import { Test, TestingModule } from '@nestjs/testing';
import { AccuracyService } from '../services/accuracy.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { FinalOutcome } from '../interfaces/recommendation.interface';

describe('AccuracyService', () => {
  let service: AccuracyService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    recommendation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    accuracySnapshot: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const successRec = { finalOutcome: FinalOutcome.SUCCESS, confidenceScore: 85, confidenceLevel: 'HIGH', regretFlag: false, reversalCount: 0 };
  const failureRec = { finalOutcome: FinalOutcome.FAILURE, confidenceScore: 80, confidenceLevel: 'HIGH', regretFlag: true, reversalCount: 1 };
  const mixedRec = { finalOutcome: FinalOutcome.MIXED, confidenceScore: 60, confidenceLevel: 'MEDIUM', regretFlag: null, reversalCount: 0 };
  const abandonedRec = { finalOutcome: FinalOutcome.ABANDONED, confidenceScore: 40, confidenceLevel: 'LOW', regretFlag: null, reversalCount: 0 };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccuracyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccuracyService>(AccuracyService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeMetrics', () => {
    it('should return metrics with all nulls when no data', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.recommendation.count.mockResolvedValue(0);

      const result = await service.computeMetrics();

      expect(result.totalRecommendations).toBe(0);
      expect(result.totalAssessed).toBe(0);
      expect(result.overallAccuracy).toBeNull();
      expect(result.weightedAccuracy).toBeNull();
      expect(result.brierScore).toBeNull();
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.trend).toBe('STABLE');
    });

    it('should compute overall accuracy correctly', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([
        successRec, successRec, failureRec, mixedRec,
      ]);
      mockPrisma.recommendation.count.mockResolvedValue(10);
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce([successRec, successRec, failureRec, mixedRec]) // main query
        .mockResolvedValueOnce([]); // computeByDecisionType

      const result = await service.computeMetrics();

      // 2 successes + 0.5 mixed = 2.5 out of 4 = 62.5%
      // But wait, computeOverallAccuracy does strict SUCCESS count: 2/4 = 50%
      expect(result.overallAccuracy).toBe(50);
      expect(result.totalAssessed).toBe(4);
      expect(result.totalRecommendations).toBe(10);
    });

    it('should compute Brier score correctly', async () => {
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce([successRec, failureRec]) // main
        .mockResolvedValueOnce([]); // computeByDecisionType
      mockPrisma.recommendation.count.mockResolvedValue(2);

      const result = await service.computeMetrics();

      // Brier = mean of (predicted - actual)^2
      // success: (0.85 - 1)^2 = 0.0225
      // failure: (0.80 - 0)^2 = 0.64
      // mean = 0.33125 → 0.331
      expect(result.brierScore).toBeCloseTo(0.331, 2);
    });

    it('should detect warning when falsePositiveRate > 15%', async () => {
      // HIGH confidence failure = false positive
      const highFailure = { ...failureRec, confidenceLevel: 'HIGH' };
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce([highFailure, successRec]) // 50% FPR
        .mockResolvedValueOnce([]);
      mockPrisma.recommendation.count.mockResolvedValue(2);

      const result = await service.computeMetrics();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].severity).toBe('WARNING');
    });

    it('should set PRELIMINARY status for 10-29 assessments', async () => {
      const recs = Array(15).fill(successRec);
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce(recs)
        .mockResolvedValueOnce([]);
      mockPrisma.recommendation.count.mockResolvedValue(20);

      const result = await service.computeMetrics();

      expect(result.status).toBe('PRELIMINARY');
    });

    it('should set MODERATE status for 30-99 assessments', async () => {
      const recs = Array(50).fill(successRec);
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce(recs)
        .mockResolvedValueOnce([]);
      mockPrisma.recommendation.count.mockResolvedValue(60);

      const result = await service.computeMetrics();

      expect(result.status).toBe('MODERATE');
    });

    it('should set RELIABLE status for 100+ assessments', async () => {
      const recs = Array(100).fill(successRec);
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce(recs)
        .mockResolvedValueOnce([]);
      mockPrisma.recommendation.count.mockResolvedValue(120);

      const result = await service.computeMetrics();

      expect(result.status).toBe('RELIABLE');
    });

    it('should compute IMPROVING trend when second half is better', async () => {
      // First half: 4 SUCCESS + 6 FAILURE = 40% accuracy
      // Second half: 8 SUCCESS + 2 FAILURE = 80% accuracy
      // Trend: (0.8 - 0.4) / 0.4 = 1.0 → direction = 'IMPROVING'
      const firstHalf = [
        ...Array(4).fill(successRec),
        ...Array(6).fill(failureRec),
      ];
      const secondHalf = [
        ...Array(8).fill(successRec),
        ...Array(2).fill(failureRec),
      ];
      const allRecs = [...firstHalf, ...secondHalf];

      // Execution order inside computeMetrics:
      // 1. main query → returns allRecs
      // 2. computeTrend → returns recs with assessedAt
      // 3. computeByDecisionType → returns empty
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce(allRecs) // main query
        .mockResolvedValueOnce(allRecs.map(r => ({ finalOutcome: r.finalOutcome, assessedAt: new Date() }))) // computeTrend
        .mockResolvedValueOnce([]); // computeByDecisionType
      mockPrisma.recommendation.count.mockResolvedValue(20);

      const result = await service.computeMetrics();

      expect(result.trend).toBe('IMPROVING');
    });
  });

  describe('createSnapshot', () => {
    it('should create an accuracy snapshot', async () => {
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce([successRec]) // computeMetrics main
        .mockResolvedValueOnce([]); // computeByDecisionType
      mockPrisma.recommendation.count.mockResolvedValue(5);
      mockPrisma.accuracySnapshot.create.mockResolvedValue({
        id: 'snap-1',
        totalRecommendations: 5,
        totalAssessed: 1,
        overallAccuracy: 100,
        weightedAccuracy: null,
        brierScore: null,
        confidenceCalibration: {},
        falsePositiveRate: null,
        falseNegativeRate: null,
        regretRate: null,
        reversalRate: null,
        forecastAccuracy: null,
        implementationRate: null,
        trend: 'STABLE',
        snapshotDate: new Date(),
      });

      const result = await service.createSnapshot();

      expect(result.id).toBe('snap-1');
      expect(mockPrisma.accuracySnapshot.create).toHaveBeenCalled();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return latest snapshot', async () => {
      const mockSnapshot = {
        id: 'snap-1',
        snapshotDate: new Date(),
        totalRecommendations: 10,
      };
      mockPrisma.accuracySnapshot.findFirst.mockResolvedValue(mockSnapshot);

      const result = await service.getLatestSnapshot();

      expect(result).toEqual(mockSnapshot);
      expect(mockPrisma.accuracySnapshot.findFirst).toHaveBeenCalledWith({
        orderBy: { snapshotDate: 'desc' },
      });
    });

    it('should return null when no snapshots exist', async () => {
      mockPrisma.accuracySnapshot.findFirst.mockResolvedValue(null);

      const result = await service.getLatestSnapshot();

      expect(result).toBeNull();
    });
  });

  describe('computeConfidenceInterval (via private method testing through class)', () => {
    it('should handle the confidence interval computation through public methods', async () => {
      // This is tested indirectly via computeMetrics.
      // We can verify the pattern by checking the interval width shrinks with more data.
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce(Array(100).fill(successRec)) // large sample → narrow CI
        .mockResolvedValueOnce([]);
      mockPrisma.recommendation.count.mockResolvedValue(100);

      const largeSample = await service.computeMetrics();
      expect(largeSample.confidenceInterval).toBeLessThan(50); // Should be narrow
    });
  });
});
