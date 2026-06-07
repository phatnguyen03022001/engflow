// @lifecycle ACTIVE — Unit tests for TrustScoreService
import { Test, TestingModule } from '@nestjs/testing';
import { TrustScoreService } from '../services/trust-score.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PRIOR_CONFIGS } from '../interfaces/trust-score.interface';

describe('TrustScoreService', () => {
  let service: TrustScoreService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    recommendation: {
      findMany: jest.fn(),
    },
    trustScore: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const successRec = { finalOutcome: 'SUCCESS' };
  const failureRec = { finalOutcome: 'FAILURE' };
  const mixedRec = { finalOutcome: 'MIXED' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustScoreService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TrustScoreService>(TrustScoreService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recalculateAll', () => {
    it('should recalculate all levels without error', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      await expect(service.recalculateAll()).resolves.not.toThrow();

      // Should have called recalculateGlobal, recalculateByDecisionType, recalculateByDomain
      // Code path: findFirst returns null → create (not upsert)
      expect(mockPrisma.trustScore.create).toHaveBeenCalled();
    });
  });

  describe('recalculateGlobal', () => {
    it('should return prior trust when no data', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const result = await service.recalculateGlobal();

      expect(result.level).toBe('GLOBAL');
      expect(result.score).toBe(60); // GLOBAL prior = 0.6 * 100
      expect(result.sampleSize).toBe(0);
    });

    it('should compute Bayesian score from assessed recommendations', async () => {
      // 3 SUCCESS + 1 FAILURE = (3 + 6) / (4 + 6 + 4) = 9/14 = 64.29 → 64
      mockPrisma.recommendation.findMany.mockResolvedValue([
        successRec, successRec, successRec, failureRec,
      ]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const result = await service.recalculateGlobal();

      expect(result.sampleSize).toBe(4);
      expect(result.score).toBe(64);
    });

    it('should count MIXED as 0.5 success', async () => {
      // 2 SUCCESS + 1 MIXED + 1 FAILURE = (2 + 0.5 + 6) / (4 + 6 + 4) = 8.5/14 = 60.7 → 61
      mockPrisma.recommendation.findMany.mockResolvedValue([
        successRec, successRec, mixedRec, failureRec,
      ]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const result = await service.recalculateGlobal();

      expect(result.sampleSize).toBe(4);
      expect(result.score).toBe(61);
    });
  });

  describe('recalculateByDecisionType', () => {
    it('should compute scores for all decision types', async () => {
      // Return empty for all 6 types
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const results = await service.recalculateByDecisionType();

      expect(results).toHaveLength(6);
      // Each should return prior trust
      expect(results.find(r => r.decisionType === 'TC')?.score).toBe(80); // TC prior = 0.8
      expect(results.find(r => r.decisionType === 'BB')?.score).toBe(60); // BB prior = 0.6
      expect(results.find(r => r.decisionType === 'PC')?.score).toBe(50); // PC prior = 0.5
    });

    it('should compute actual scores when data exists', async () => {
      // For TC: 1 SUCCESS out of 1 = (1 + 8) / (1 + 8 + 2) = 9/11 = 81.8 → 82
      mockPrisma.recommendation.findMany
        .mockResolvedValueOnce([successRec]) // TC
        .mockResolvedValue([]) // AP
        .mockResolvedValue([]) // IA
        .mockResolvedValue([]) // TS
        .mockResolvedValue([]) // PC
        .mockResolvedValue([]); // BB
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const results = await service.recalculateByDecisionType();

      const tcResult = results.find(r => r.decisionType === 'TC');
      expect(tcResult?.score).toBe(82);
      expect(tcResult?.sampleSize).toBe(1);
    });
  });

  describe('recalculateByDomain', () => {
    it('should group by domain and compute scores', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([
        { decisionDomain: 'queue-system', finalOutcome: 'SUCCESS' },
        { decisionDomain: 'queue-system', finalOutcome: 'SUCCESS' },
        { decisionDomain: 'auth', finalOutcome: 'FAILURE' },
      ]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const results = await service.recalculateByDomain();

      expect(results).toHaveLength(2);
      const queueResult = results.find(r => r.domain === 'queue-system');
      // 2 SUCCESS = (2 + 6) / (2 + 6 + 4) = 8/12 = 66.7 → 67
      expect(queueResult?.score).toBe(67);
      expect(queueResult?.sampleSize).toBe(2);

      const authResult = results.find(r => r.domain === 'auth');
      // 0 SUCCESS = (0 + 6) / (1 + 6 + 4) = 6/11 = 54.5 → 55
      expect(authResult?.score).toBe(55);
      expect(authResult?.sampleSize).toBe(1);
    });

    it('should return empty when no data', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.trustScore.upsert.mockResolvedValue({});

      const results = await service.recalculateByDomain();

      expect(results).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all trust scores ordered', async () => {
      const mockScores = [
        { level: 'GLOBAL', domain: null, decisionType: null, score: 60, sampleSize: 0, priorAlpha: 6, priorBeta: 4 },
        { level: 'DECISION_TYPE', domain: null, decisionType: 'TC', score: 80, sampleSize: 0, priorAlpha: 8, priorBeta: 2 },
      ];
      mockPrisma.trustScore.findMany.mockResolvedValue(mockScores);

      const result = await service.getAll();

      expect(result).toHaveLength(2);
      expect(mockPrisma.trustScore.findMany).toHaveBeenCalledWith({
        orderBy: [{ level: 'asc' }, { domain: 'asc' }, { decisionType: 'asc' }],
      });
    });
  });

  describe('getFiltered', () => {
    it('should filter by level and enrich with display labels', async () => {
      mockPrisma.trustScore.findMany.mockResolvedValue([
        { level: 'GLOBAL', domain: null, decisionType: null, score: 95, sampleSize: 20, priorAlpha: 6, priorBeta: 4, lastOutcomeAt: null, decayedAt: null, nextRecalculation: null, createdAt: new Date(), updatedAt: new Date(), id: '1' },
      ]);

      const result = await service.getFiltered({ level: 'GLOBAL' });

      expect(result).toHaveLength(1);
      expect(result[0].displayScore).toBe(95);
      expect(result[0].displayLabel).toBe('VERY HIGH');
    });

    it('should filter by domain and decisionType', async () => {
      mockPrisma.trustScore.findMany.mockResolvedValue([]);

      await service.getFiltered({ domain: 'queue-system', decisionType: 'TC' });

      expect(mockPrisma.trustScore.findMany).toHaveBeenCalledWith({
        where: { domain: 'queue-system', decisionType: 'TC' },
      });
    });
  });

  describe('getConfidenceInterval', () => {
    it('should return full range when sampleSize is 0', () => {
      const result = service.getConfidenceInterval(80, 0);

      expect(result.lower).toBe(0);
      expect(result.upper).toBe(100);
      expect(result.width).toBe(100);
    });

    it('should compute narrower interval for larger samples', () => {
      const smallSample = service.getConfidenceInterval(80, 10);
      const largeSample = service.getConfidenceInterval(80, 100);

      // Larger sample should have smaller width
      expect(largeSample.width).toBeLessThan(smallSample.width);
    });

    it('should compute correct interval for 80% with n=100', () => {
      const result = service.getConfidenceInterval(80, 100);
      // p=0.8, z=1.96, se=sqrt(0.8*0.2/100)=0.04, margin=1.96*0.04=0.0784
      // width = 7.84 → 8
      expect(result.width).toBe(8);
    });
  });
});
