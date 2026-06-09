// @lifecycle ACTIVE — Unit tests for PlannerEvaluatorService
import { Test, TestingModule } from '@nestjs/testing';
import { PlannerEvaluatorService } from '../services/planner-evaluator.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('PlannerEvaluatorService', () => {
  let service: PlannerEvaluatorService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    agentExecution: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlannerEvaluatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlannerEvaluatorService>(PlannerEvaluatorService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computePlannerAccuracy', () => {
    it('should return null for empty data', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.computePlannerAccuracy();

      expect(result.accuracy).toBeNull();
      expect(result.sampleSize).toBe(0);
    });

    it('should return 1 when all plans pass', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { preVerifyDecision: 'PASS' },
        { preVerifyDecision: 'FLAG' },
        { preVerifyDecision: null },
      ]);

      const result = await service.computePlannerAccuracy();

      expect(result.accuracy).toBe(1);
      expect(result.sampleSize).toBe(3);
    });

    it('should handle BLOCKED plans correctly', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { preVerifyDecision: 'PASS' },
        { preVerifyDecision: 'BLOCK' },
        { preVerifyDecision: 'FLAG' },
      ]);

      const result = await service.computePlannerAccuracy();

      expect(result.accuracy).toBe(2 / 3);
      expect(result.sampleSize).toBe(3);
    });

    it('should treat null preVerifyDecision as accepted', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { preVerifyDecision: null },
        { preVerifyDecision: null },
        { preVerifyDecision: 'BLOCK' },
      ]);

      const result = await service.computePlannerAccuracy();

      expect(result.accuracy).toBe(2 / 3);
    });
  });

  describe('computeRevisionRate', () => {
    it('should return null for empty data', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.computeRevisionRate();

      expect(result.rate).toBeNull();
      expect(result.sampleSize).toBe(0);
    });

    it('should compute revision rate correctly', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { archRevisionNeeded: true },
        { archRevisionNeeded: false },
        { archRevisionNeeded: false },
      ]);

      const result = await service.computeRevisionRate();

      expect(result.rate).toBe(1 / 3);
      expect(result.sampleSize).toBe(3);
      expect(result.archReviewedCount).toBe(3);
      expect(result.archRevisionNeededCount).toBe(1);
    });

    it('should handle zero revisions', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { archRevisionNeeded: false },
      ]);

      const result = await service.computeRevisionRate();

      expect(result.rate).toBe(0);
    });
  });

  describe('computeAll', () => {
    it('should return combined results', async () => {
      mockPrisma.agentExecution.findMany
        .mockResolvedValueOnce([{ preVerifyDecision: 'PASS' }])
        .mockResolvedValueOnce([{ archRevisionNeeded: false }]);

      const result = await service.computeAll();

      expect(result.plannerAccuracy).toBe(1);
      expect(result.revisionRate).toBe(0);
    });
  });
});
