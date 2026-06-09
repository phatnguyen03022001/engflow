// @lifecycle ACTIVE — Unit tests for CheckpointService
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CheckpointService } from '../services/checkpoint.service';
import { DecisionMemoryService } from '../services/decision-memory.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('CheckpointService', () => {
  let service: CheckpointService;
  let prisma: typeof mockPrisma;
  let decisionMemory: typeof mockDecisionMemory;

  const mockPrisma = {
    recommendation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    checkpoint: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockDecisionMemory = {
    createFromAssessment: jest.fn(),
  };

  const mockRecommendation = {
    id: 'rec-uuid-1',
    recId: 'REC-2026-test-001',
    trackingStatus: 'IN_PROGRESS',
  };

  const mockCheckpoint = {
    id: 'cp-uuid-1',
    recommendationId: 'rec-uuid-1',
    checkpoint: '30D',
    evaluatedAt: null,
    checkpointVerdict: null,
    scheduleAt: new Date(),
  };

  const mockAssessedCheckpoint = {
    id: 'cp-uuid-1',
    recommendationId: 'rec-uuid-1',
    checkpoint: '30D',
    evaluatedAt: new Date(),
    checkpointVerdict: 'ON_TRACK',
    scheduleAt: new Date(),
  };

  const mockCheckpointDto = {
    checkpoint: '30D',
    evaluator: 'human',
    wasImplemented: true,
    implementedOption: 'BullMQ',
    problemSolved: true,
    solutionScore: 4,
    checkpointVerdict: 'ON_TRACK',
    verdictConfidence: 'HIGH',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DecisionMemoryService, useValue: mockDecisionMemory },
      ],
    }).compile();

    service = module.get<CheckpointService>(CheckpointService);
    prisma = module.get(PrismaService);
    decisionMemory = module.get(DecisionMemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertCheckpoint', () => {
    it('should upsert a checkpoint and transition if all done', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);
      mockPrisma.checkpoint.upsert.mockResolvedValue({ ...mockAssessedCheckpoint });
      // After upsert, checkAndTransition runs: findMany returns 3 assessed checkpoints
      mockPrisma.checkpoint.findMany.mockResolvedValue([
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
      ]);
      mockPrisma.recommendation.update.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'ASSESSED',
        finalOutcome: 'SUCCESS',
      });

      const result = await service.upsertCheckpoint('rec-uuid-1', mockCheckpointDto);

      expect(mockPrisma.recommendation.findUnique).toHaveBeenCalledWith({
        where: { id: 'rec-uuid-1' },
      });
      expect(mockPrisma.checkpoint.upsert).toHaveBeenCalled();
      expect(result).toBeDefined();
      // DecisionMemory should be created from the auto-transition
      expect(mockDecisionMemory.createFromAssessment).toHaveBeenCalledWith('rec-uuid-1');
    });

    it('should throw NotFoundException if recommendation does not exist', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertCheckpoint('nonexistent', mockCheckpointDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not transition if not all checkpoints are assessed', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);
      mockPrisma.checkpoint.upsert.mockResolvedValue({ ...mockAssessedCheckpoint });
      // Only 1 of 3 assessed
      mockPrisma.checkpoint.findMany.mockResolvedValue([
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
        { evaluatedAt: null, checkpointVerdict: null },
        { evaluatedAt: null, checkpointVerdict: null },
      ]);

      await service.upsertCheckpoint('rec-uuid-1', mockCheckpointDto);

      expect(mockPrisma.recommendation.update).not.toHaveBeenCalled();
      // No transition → no decision memory creation
      expect(mockDecisionMemory.createFromAssessment).not.toHaveBeenCalled();
    });

    it('should determine FAILURE when any verdict is FAILED', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);
      mockPrisma.checkpoint.upsert.mockResolvedValue({ ...mockAssessedCheckpoint });
      mockPrisma.checkpoint.findMany.mockResolvedValue([
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
        { evaluatedAt: new Date(), checkpointVerdict: 'FAILED' },
      ]);
      mockPrisma.recommendation.update.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'ASSESSED',
        finalOutcome: 'FAILURE',
      });

      const result = await service.upsertCheckpoint('rec-uuid-1', mockCheckpointDto);

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ finalOutcome: 'FAILURE' }),
        }),
      );
      // DecisionMemory creation should still fire (non-blocking)
      expect(mockDecisionMemory.createFromAssessment).toHaveBeenCalledWith('rec-uuid-1');
    });

    it('should determine MIXED when any verdict is PROBLEM', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);
      mockPrisma.checkpoint.upsert.mockResolvedValue({ ...mockAssessedCheckpoint });
      mockPrisma.checkpoint.findMany.mockResolvedValue([
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
        { evaluatedAt: new Date(), checkpointVerdict: 'PROBLEM' },
        { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
      ]);
      mockPrisma.recommendation.update.mockResolvedValue({
        ...mockRecommendation,
        trackingStatus: 'ASSESSED',
        finalOutcome: 'MIXED',
      });

      const result = await service.upsertCheckpoint('rec-uuid-1', mockCheckpointDto);

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ finalOutcome: 'MIXED' }),
        }),
      );
      // DecisionMemory creation should still fire (non-blocking)
      expect(mockDecisionMemory.createFromAssessment).toHaveBeenCalledWith('rec-uuid-1');
    });
  });

  describe('findDueCheckpoints', () => {
    it('should return due checkpoints', async () => {
      const dueCheckpoint = {
        ...mockCheckpoint,
        evaluatedAt: null,
        scheduleAt: new Date(Date.now() - 1000),
        recommendation: {
          id: 'rec-uuid-1',
          recId: 'REC-001',
          decisionDomain: 'queue-system',
          trackingStatus: 'IN_PROGRESS',
        },
      };
      mockPrisma.checkpoint.findMany.mockResolvedValue([dueCheckpoint]);

      const result = await service.findDueCheckpoints();

      expect(result).toHaveLength(1);
      expect(mockPrisma.checkpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            evaluatedAt: null,
            scheduleAt: { lte: expect.any(Date) },
          },
        }),
      );
    });

    it('should return empty array when no checkpoints are due', async () => {
      mockPrisma.checkpoint.findMany.mockResolvedValue([]);

      const result = await service.findDueCheckpoints();

      expect(result).toHaveLength(0);
    });
  });

  describe('findByRecommendationId', () => {
    it('should return checkpoints for a recommendation', async () => {
      mockPrisma.checkpoint.findMany.mockResolvedValue([
        mockCheckpoint,
        { ...mockCheckpoint, id: 'cp-uuid-2', checkpoint: '90D' },
        { ...mockCheckpoint, id: 'cp-uuid-3', checkpoint: '180D' },
      ]);

      const result = await service.findByRecommendationId('rec-uuid-1');

      expect(result).toHaveLength(3);
      expect(mockPrisma.checkpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recommendationId: 'rec-uuid-1' },
        }),
      );
    });

    it('should return empty array for recommendation with no checkpoints', async () => {
      mockPrisma.checkpoint.findMany.mockResolvedValue([]);

      const result = await service.findByRecommendationId('rec-uuid-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('autoAssess', () => {
    it('should return LOW confidence placeholder', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(mockRecommendation);

      const result = await service.autoAssess('rec-uuid-1');

      expect(result.confidence).toBe('LOW');
      expect(result.recommendationId).toBe('rec-uuid-1');
      expect(result.message).toContain('Auto-assessment is not yet implemented');
    });

    it('should throw NotFoundException if recommendation does not exist', async () => {
      mockPrisma.recommendation.findUnique.mockResolvedValue(null);

      await expect(service.autoAssess('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
