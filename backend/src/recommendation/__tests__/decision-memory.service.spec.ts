// @lifecycle ACTIVE — Unit tests for DecisionMemoryService
import { Test, TestingModule } from '@nestjs/testing';
import { DecisionMemoryService } from '../services/decision-memory.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('DecisionMemoryService', () => {
  let service: DecisionMemoryService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    recommendation: {
      findUnique: jest.fn(),
    },
    decisionMemory: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockRecommendation = {
    id: 'rec-uuid-1',
    recId: 'REC-2026-test-001',
    decisionDomain: 'queue-system',
    decisionType: 'TC',
    confidenceLevel: 'HIGH',
    confidenceScore: 82,
    recommendedOption: 'BullMQ',
    trackingStatus: 'ASSESSED',
    finalOutcome: 'SUCCESS',
    projectId: 'proj-1',
  };

  const mockMemory = {
    id: 'mem-uuid-1',
    memoryId: 'MEM-20260601-abc123',
    domain: 'queue-system',
    technology: 'BullMQ',
    projectId: 'proj-1',
    recommendationId: 'rec-uuid-1',
    outcome: 'SUCCESS',
    contextFactors: {
      domain: 'queue-system',
      decisionType: 'TC',
      confidenceLevel: 'HIGH',
      confidenceScore: 82,
      recommendedOption: 'BullMQ',
    },
    referenceCount: 1,
    decayWeight: 1,
    lastReferencedAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionMemoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DecisionMemoryService>(DecisionMemoryService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFromAssessment', () => {
    it('should create a decision memory from an assessed recommendation', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);
      mockPrisma.decisionMemory.upsert.mockResolvedValue(mockMemory);

      const result = await service.createFromAssessment('rec-uuid-1');

      expect(mockPrisma.recommendation.findUnique).toHaveBeenCalledWith({
        where: { id: 'rec-uuid-1' },
      });
      expect(mockPrisma.decisionMemory.upsert).toHaveBeenCalled();
      expect(result).toEqual(mockMemory);
    });

    it('should throw an error when recommendation is not found', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(
        service.createFromAssessment('nonexistent'),
      ).rejects.toThrow('Recommendation nonexistent not found');
    });

    it('should return null for ABANDONED outcomes', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue({
        ...mockRecommendation,
        finalOutcome: 'ABANDONED',
      });

      const result = await service.createFromAssessment('rec-uuid-1');

      expect(result).toBeNull();
      expect(mockPrisma.decisionMemory.upsert).not.toHaveBeenCalled();
    });

    it('should throw an error when recommendation is not ASSESSED', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'IN_PROGRESS',
        finalOutcome: null,
      });

      await expect(
        service.createFromAssessment('rec-uuid-1'),
      ).rejects.toThrow('is not ASSESSED');
    });

    it('should throw an error when recommendation has no final outcome', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue({
        ...mockRecommendation,
        finalOutcome: null,
      });

      await expect(
        service.createFromAssessment('rec-uuid-1'),
      ).rejects.toThrow('has no final outcome');
    });
  });

  describe('queryWithApplicability', () => {
    const techStackMemory = {
      ...mockMemory,
      id: 'mem-1',
      projectId: 'same-proj',
      outcome: 'SUCCESS',
      decayWeight: 1,
      contextFactors: {
        domain: 'queue-system',
        techStack: 'BullMQ',
        scale: 'large',
        teamSize: '5-10',
        timeline: '3-6months',
      },
    };

    const differentTechMemory = {
      ...mockMemory,
      id: 'mem-2',
      projectId: 'other-proj',
      outcome: 'FAILURE',
      decayWeight: 0.5,
      contextFactors: {
        domain: 'queue-system',
        techStack: 'RabbitMQ',
        scale: 'small',
        teamSize: '1-5',
        timeline: '1-3months',
      },
    };

    it('should return memories sorted by applicability score', async () => {
      mockPrisma.decisionMemory.findMany.mockResolvedValue([
        techStackMemory,
        differentTechMemory,
      ]);

      const result = await service.queryWithApplicability('queue-system', {
        techStack: 'BullMQ',
        scale: 'large',
        teamSize: '5-10',
        timeline: '3-6months',
        projectId: 'same-proj',
      });

      expect(result).toHaveLength(2);
      // First result should have higher applicability (exact tech + scale + team + timeline + project match)
      expect(result[0].id).toBe('mem-1');
      expect(result[0].applicabilityScore).toBeGreaterThan(
        result[1].applicabilityScore,
      );
    });

    it('should return empty array when no memories exist for domain', async () => {
      mockPrisma.decisionMemory.findMany.mockResolvedValue([]);

      const result = await service.queryWithApplicability('empty-domain', {});

      expect(result).toHaveLength(0);
    });

    it('should score exact techStack match higher than baseline', async () => {
      mockPrisma.decisionMemory.findMany.mockResolvedValue([techStackMemory]);

      const result = await service.queryWithApplicability('queue-system', {
        techStack: 'BullMQ',
      });

      expect(result).toHaveLength(1);
      // similarity = 0.15 (baseline) + 0.3 (techStack match) = 0.45
      // applicability = 0.45 * 1.0 (SUCCESS) * 1.0 (decayWeight) = 0.45
      expect(result[0].similarity).toBeGreaterThan(0.15);
      expect(result[0].applicabilityScore).toBe(0.45);
    });

    it('should handle FAILURE outcome with lower outcomeWeight', async () => {
      mockPrisma.decisionMemory.findMany.mockResolvedValue([differentTechMemory]);

      const result = await service.queryWithApplicability('queue-system', {
        techStack: 'RabbitMQ',
      });

      // similarity = 0.15 (baseline) + 0.3 (techStack match) = 0.45
      // applicability = 0.45 * 0.2 (FAILURE) * 0.5 (decayWeight) = 0.045
      expect(result[0].applicabilityScore).toBe(0.05);
    });
  });

  describe('decayAll', () => {
    it('should apply decay factor and prune stale entries', async () => {
      const decayFactor = Math.exp(-Math.LN2 / 12);
      mockPrisma.decisionMemory.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.decisionMemory.deleteMany.mockResolvedValue({ count: 2 });

      await service.decayAll();

      expect(mockPrisma.decisionMemory.updateMany).toHaveBeenCalledWith({
        data: {
          decayWeight: {
            multiply: decayFactor,
          },
        },
      });
      expect(mockPrisma.decisionMemory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            decayWeight: { lt: 0.1 },
            createdAt: { lte: expect.any(Date) },
          },
        }),
      );
    });

    it('should not throw when database is empty', async () => {
      mockPrisma.decisionMemory.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.decisionMemory.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.decayAll()).resolves.not.toThrow();
    });

    it('should only prune entries with decayWeight < 0.1 and age > 2 years', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      mockPrisma.decisionMemory.updateMany.mockResolvedValue({ count: 10 });
      mockPrisma.decisionMemory.deleteMany.mockResolvedValue({ count: 0 });

      await service.decayAll();

      expect(mockPrisma.decisionMemory.deleteMany).toHaveBeenCalledWith({
        where: {
          decayWeight: { lt: 0.1 },
          createdAt: { lte: expect.any(Date) },
        },
      });

      // Verify the threshold date is approximately 2 years ago
      const deleteCall = mockPrisma.decisionMemory.deleteMany.mock.calls[0][0];
      const threshold = deleteCall.where.createdAt.lte as Date;
      const diffMonths =
        (twoYearsAgo.getTime() - threshold.getTime()) / (1000 * 60 * 60 * 24 * 30);
      expect(Math.abs(diffMonths)).toBeLessThan(1);
    });
  });
});
