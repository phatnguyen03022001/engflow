// @lifecycle ACTIVE — Unit tests for RecommendationService
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RecommendationService } from '../services/recommendation.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    recommendation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    checkpoint: {
      upsert: jest.fn(),
    },
  };

  const mockRecommendation = {
    id: 'rec-uuid-1',
    recId: 'REC-2026-test-001',
    mode: 'ADVISOR',
    decisionType: 'TC',
    decisionDomain: 'queue-system',
    querySummary: 'Should we use BullMQ?',
    recommendedOption: 'BullMQ',
    weightedScore: 4.5,
    scoreMargin: 1.2,
    justification: 'BullMQ is mature.',
    confidenceLevel: 'HIGH',
    confidenceScore: 82,
    trackingStatus: 'PENDING',
    finalOutcome: null,
    assessedAt: null,
    implementedOption: null,
    regretFlag: null,
    reversalCount: 0,
    projectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [],
    checkpoints: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      recId: 'REC-2026-test-001',
      mode: 'ADVISOR',
      decisionType: 'TC',
      decisionDomain: 'queue-system',
      querySummary: 'Should we use BullMQ?',
      recommendedOption: 'BullMQ',
      justification: 'BullMQ is mature, Redis-based, and native Node.js.',
      confidenceLevel: 'HIGH',
      options: [
        { label: 'A', description: 'BullMQ', score: 4.5 },
        { label: 'B', description: 'RabbitMQ', score: 3.3 },
      ],
    };

    it('should create a recommendation successfully', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      const result = await service.create(createDto);

      expect(mockPrisma.recommendation.findUnique).toHaveBeenCalledWith({
        where: { recId: createDto.recId },
      });
      expect(mockPrisma.recommendation.create).toHaveBeenCalled();
      expect(result).toEqual(mockRecommendation);
    });

    it('should throw ConflictException for duplicate recId', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.recommendation.create).not.toHaveBeenCalled();
    });

    it('should create recommendation without options', async () => {
      const dtoWithoutOptions = { ...createDto, options: undefined };
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      const result = await service.create(dtoWithoutOptions);

      expect(result).toEqual(mockRecommendation);
    });

    it('should ignore forged analytics fields from user input', async () => {
      // Simulate an attacker injecting analytics fields into the request body.
      // The runtime guard detects and discards these, and explicit field mapping
      // ensures they can never reach the Prisma payload regardless of spread ordering.
      const forgedDto = {
        ...createDto,
        confidenceScore: 100,
        weightedScore: 5.0,
        scoreMargin: 99,
        ecs: 85,
        sqs: 100,
        cs: 100,
      };

      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      await service.create(forgedDto);

      // Verify the persisted data uses safe defaults, NOT the forged values.
      // With explicit field mapping, analytics fields are sourced exclusively
      // from the `analytics` parameter; the DTO is never spread into Prisma.
      const createCallArgs = mockPrisma.recommendation.create.mock.calls[0][0];
      expect(createCallArgs.data.confidenceScore).toBe(0);
      expect(createCallArgs.data.weightedScore).toBe(0);
      expect(createCallArgs.data.scoreMargin).toBe(0);
      expect(createCallArgs.data.ecs).toBeNull();
      expect(createCallArgs.data.sqs).toBeNull();
      expect(createCallArgs.data.cs).toBeNull();
    });

    it('should accept analytics from trusted callers', async () => {
      const analytics = {
        confidenceScore: 85,
        weightedScore: 4.2,
        scoreMargin: 1.5,
        ecs: 72,
        sqs: 68,
        cs: 90,
      };

      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      await service.create(createDto, analytics);

      const createCallArgs = mockPrisma.recommendation.create.mock.calls[0][0];
      expect(createCallArgs.data.confidenceScore).toBe(85);
      expect(createCallArgs.data.weightedScore).toBe(4.2);
      expect(createCallArgs.data.scoreMargin).toBe(1.5);
      expect(createCallArgs.data.ecs).toBe(72);
      expect(createCallArgs.data.sqs).toBe(68);
      expect(createCallArgs.data.cs).toBe(90);
    });

    it('should use defaults for partial analytics', async () => {
      const partialAnalytics = {
        confidenceScore: 70,
        weightedScore: 3.5,
        scoreMargin: 0.8,
      };

      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      await service.create(createDto, partialAnalytics);

      const createCallArgs = mockPrisma.recommendation.create.mock.calls[0][0];
      expect(createCallArgs.data.confidenceScore).toBe(70);
      expect(createCallArgs.data.weightedScore).toBe(3.5);
      expect(createCallArgs.data.scoreMargin).toBe(0.8);
      // Optional fields should default to null when not provided
      expect(createCallArgs.data.ecs).toBeNull();
      expect(createCallArgs.data.sqs).toBeNull();
      expect(createCallArgs.data.cs).toBeNull();
    });

    it('should use defaults when analytics is undefined (not provided)', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      await service.create(createDto, undefined);

      const createCallArgs = mockPrisma.recommendation.create.mock.calls[0][0];
      // All six fields must use safe defaults when analytics is null
      expect(createCallArgs.data.confidenceScore).toBe(0);
      expect(createCallArgs.data.weightedScore).toBe(0);
      expect(createCallArgs.data.scoreMargin).toBe(0);
      expect(createCallArgs.data.ecs).toBeNull();
      expect(createCallArgs.data.sqs).toBeNull();
      expect(createCallArgs.data.cs).toBeNull();
    });

    it('should use safe defaults for minimal DTO without analytics', async () => {
      // Minimal valid DTO: only required fields, no analytics.
      const minimalDto = {
        recId: 'REC-2026-min-002',
        mode: 'ADVISOR',
        decisionType: 'TC',
        decisionDomain: 'database',
        querySummary: 'Which DB?',
        recommendedOption: 'PostgreSQL',
        justification: 'Best fit.',
        confidenceLevel: 'HIGH',
      };

      mockPrisma.recommendation.findUnique.mockResolvedValue(null);
      mockPrisma.recommendation.create.mockResolvedValue(mockRecommendation);

      await service.create(minimalDto);

      const createCallArgs = mockPrisma.recommendation.create.mock.calls[0][0];
      // All six analytics fields must have safe defaults.
      // This is the only protection mechanism for REST callers.
      expect(createCallArgs.data.confidenceScore).toBe(0);
      expect(createCallArgs.data.weightedScore).toBe(0);
      expect(createCallArgs.data.scoreMargin).toBe(0);
      expect(createCallArgs.data.ecs).toBeNull();
      expect(createCallArgs.data.sqs).toBeNull();
      expect(createCallArgs.data.cs).toBeNull();

      // Verify user fields are still correctly mapped
      expect(createCallArgs.data.recId).toBe('REC-2026-min-002');
      expect(createCallArgs.data.mode).toBe('ADVISOR');
      expect(createCallArgs.data.recommendedOption).toBe('PostgreSQL');
    });
  });

  describe('findAll', () => {
    it('should return paginated results without filters', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([mockRecommendation]);
      mockPrisma.recommendation.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should apply filters when provided', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.recommendation.count.mockResolvedValue(0);

      await service.findAll({
        mode: 'ADVISOR',
        decisionType: 'TC',
        decisionDomain: 'queue',
        trackingStatus: 'PENDING',
        skip: 10,
        take: 5,
      });

      expect(mockPrisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            mode: 'ADVISOR',
            decisionType: 'TC',
            decisionDomain: 'queue',
            trackingStatus: 'PENDING',
          },
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should return empty results', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.recommendation.count.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return a recommendation by id', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);

      const result = await service.findById('rec-uuid-1');

      expect(result).toEqual(mockRecommendation);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByRecId', () => {
    it('should return a recommendation by recId', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);

      const result = await service.findByRecId('REC-2026-test-001');

      expect(result).toEqual(mockRecommendation);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(service.findByRecId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update tracking status', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'PENDING',
      });
      mockPrisma.recommendation.update.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'IN_PROGRESS',
      });
      mockPrisma.checkpoint.upsert.mockResolvedValue({});

      const result = await service.updateStatus('rec-uuid-1', 'IN_PROGRESS');

      expect(mockPrisma.checkpoint.upsert).toHaveBeenCalledTimes(3);
      expect(mockPrisma.recommendation.update).toHaveBeenCalled();
      expect(result.trackingStatus).toBe('IN_PROGRESS');
    });

    it('should not create checkpoints for non-PENDING transitions', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'IN_PROGRESS',
      });
      mockPrisma.recommendation.update.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'ASSESSED',
      });

      const result = await service.updateStatus('rec-uuid-1', 'ASSESSED');

      expect(mockPrisma.checkpoint.upsert).not.toHaveBeenCalled();
      expect(result.trackingStatus).toBe('ASSESSED');
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent', 'IN_PROGRESS')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setFinalOutcome', () => {
    it('should set final outcome and mark ASSESSED', async () => {
      const assessedRec = {
        ...mockRecommendation,
        trackingStatus: 'ASSESSED',
        finalOutcome: 'SUCCESS',
        assessedAt: expect.any(Date),
      };
      mockPrisma.recommendation.update.mockResolvedValue(assessedRec);

      const result = await service.setFinalOutcome('rec-uuid-1', 'SUCCESS');

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith({
        where: { id: 'rec-uuid-1' },
        data: expect.objectContaining({
          trackingStatus: 'ASSESSED',
          finalOutcome: 'SUCCESS',
        }),
        include: { options: true, checkpoints: true },
      });
      expect(result.trackingStatus).toBe('ASSESSED');
      expect(result.finalOutcome).toBe('SUCCESS');
    });
  });

  describe('remove', () => {
    it('should delete a recommendation', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);
      mockPrisma.recommendation.delete.mockResolvedValue(mockRecommendation);

      const result = await service.remove('rec-uuid-1');

      expect(mockPrisma.recommendation.delete).toHaveBeenCalledWith({
        where: { id: 'rec-uuid-1' },
      });
      expect(result).toEqual(mockRecommendation);
    });

    it('should throw NotFoundException when deleting nonexistent', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.recommendation.delete).not.toHaveBeenCalled();
    });
  });

  describe('countByStatus', () => {
    it('should return counts grouped by status', async () => {
      mockPrisma.recommendation.groupBy.mockResolvedValue([
        { trackingStatus: 'PENDING', _count: 5 },
        { trackingStatus: 'IN_PROGRESS', _count: 3 },
      ]);

      const result = await service.countByStatus();

      expect(result.PENDING).toBe(5);
      expect(result.IN_PROGRESS).toBe(3);
      expect(result.ASSESSED).toBe(0);
    });

    it('should return zero counts when no recommendations exist', async () => {
      mockPrisma.recommendation.groupBy.mockResolvedValue([]);

      const result = await service.countByStatus();

      expect(result.PENDING).toBe(0);
      expect(result.IN_PROGRESS).toBe(0);
      expect(result.ASSESSED).toBe(0);
    });
  });
});
