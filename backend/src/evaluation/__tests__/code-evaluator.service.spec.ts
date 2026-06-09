// @lifecycle ACTIVE — Unit tests for CodeEvaluatorService
import { Test, TestingModule } from '@nestjs/testing';
import { CodeEvaluatorService } from '../services/code-evaluator.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('CodeEvaluatorService', () => {
  let service: CodeEvaluatorService;
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
        CodeEvaluatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CodeEvaluatorService>(CodeEvaluatorService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeFirstAttemptRate', () => {
    it('should return null for empty data', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.computeFirstAttemptRate();

      expect(result.rate).toBeNull();
      expect(result.sampleSize).toBe(0);
    });

    it('should compute rate correctly', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { codeFirstAttemptSuccess: true },
        { codeFirstAttemptSuccess: false },
        { codeFirstAttemptSuccess: true },
      ]);

      const result = await service.computeFirstAttemptRate();

      expect(result.rate).toBe(2 / 3);
      expect(result.sampleSize).toBe(3);
    });

    it('should handle all successes', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { codeFirstAttemptSuccess: true },
        { codeFirstAttemptSuccess: true },
      ]);

      const result = await service.computeFirstAttemptRate();

      expect(result.rate).toBe(1);
    });
  });

  describe('computeOverallSuccessRate', () => {
    it('should return null for empty data', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.computeOverallSuccessRate();

      expect(result.rate).toBeNull();
      expect(result.sampleSize).toBe(0);
    });

    it('should compute rate with PASS and FLAG as success', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { postVerifyDecision: 'PASS' },
        { postVerifyDecision: 'FLAG' },
        { postVerifyDecision: 'FAIL' },
      ]);

      const result = await service.computeOverallSuccessRate();

      expect(result.rate).toBe(2 / 3);
      expect(result.sampleSize).toBe(3);
    });

    it('should handle all failures', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { postVerifyDecision: 'FAIL' },
        { postVerifyDecision: 'FAIL' },
      ]);

      const result = await service.computeOverallSuccessRate();

      expect(result.rate).toBe(0);
    });
  });

  describe('computeDebugSuccessRate', () => {
    it('should return null for empty data', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.computeDebugSuccessRate();

      expect(result.rate).toBeNull();
      expect(result.sampleSize).toBe(0);
    });

    it('should compute debug rate correctly', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { debugSuccess: true },
        { debugSuccess: true },
        { debugSuccess: false },
      ]);

      const result = await service.computeDebugSuccessRate();

      expect(result.rate).toBe(2 / 3);
      expect(result.sampleSize).toBe(3);
    });

    it('should handle all debug successes', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([
        { debugSuccess: true },
        { debugSuccess: true },
      ]);

      const result = await service.computeDebugSuccessRate();

      expect(result.rate).toBe(1);
    });
  });

  describe('computeAll', () => {
    it('should return combined results', async () => {
      mockPrisma.agentExecution.findMany
        .mockResolvedValueOnce([{ codeFirstAttemptSuccess: true }])
        .mockResolvedValueOnce([{ postVerifyDecision: 'PASS' }])
        .mockResolvedValueOnce([{ debugSuccess: true }]);

      const result = await service.computeAll();

      expect(result.firstAttemptRate).toBe(1);
      expect(result.overallSuccessRate).toBe(1);
      expect(result.debugSuccessRate).toBe(1);
    });
  });
});
