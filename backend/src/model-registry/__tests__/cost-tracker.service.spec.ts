/* @lifecycle ACTIVE — Unit tests for CostTrackerService */

import { Test, TestingModule } from '@nestjs/testing';
import { CostTrackerService } from '../services/cost-tracker.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('CostTrackerService', () => {
  let service: CostTrackerService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    costLog: {
      create: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    modelRegistry: {
      findUnique: jest.fn(),
    },
  };

  const mockCostLog = {
    id: 'cost-uuid-1',
    modelId: 'deepseek/deepseek-v4-flash',
    executionId: 'TASK-001',
    phaseId: 'PHASE-001',
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.00028,
    latencyMs: 1500,
    wasFallback: false,
    fallbackFrom: null,
    recordedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostTrackerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CostTrackerService>(CostTrackerService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordCost', () => {
    const createCostDto = {
      modelId: 'deepseek/deepseek-v4-flash',
      executionId: 'TASK-001',
      phaseId: 'PHASE-001',
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.00028,
      latencyMs: 1500,
    };

    beforeEach(() => {
      // Default: model exists in registry
      mockPrisma.modelRegistry.findUnique.mockResolvedValue({
        modelId: 'deepseek/deepseek-v4-flash',
      });
    });

    it('should create a cost log entry', async () => {
      mockPrisma.costLog.create.mockResolvedValue(mockCostLog);

      const result = await service.recordCost(createCostDto);

      expect(mockPrisma.modelRegistry.findUnique).toHaveBeenCalledWith({
        where: { modelId: 'deepseek/deepseek-v4-flash' },
      });
      expect(mockPrisma.costLog.create).toHaveBeenCalledWith({
        data: {
          modelId: 'deepseek/deepseek-v4-flash',
          executionId: 'TASK-001',
          phaseId: 'PHASE-001',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.00028,
          latencyMs: 1500,
          wasFallback: false,
          fallbackFrom: null,
        },
      });
      expect(result.costUsd).toBe(0.00028);
      expect(result.executionId).toBe('TASK-001');
    });

    it('should create a cost log without optional phaseId', async () => {
      const minimalDto = {
        modelId: 'deepseek/deepseek-v4-flash',
        executionId: 'TASK-002',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.00014,
        latencyMs: 800,
      };
      mockPrisma.costLog.create.mockResolvedValue({
        ...mockCostLog,
        phaseId: null,
        executionId: 'TASK-002',
      });

      const result = await service.recordCost(minimalDto);

      expect(mockPrisma.costLog.create).toHaveBeenCalled();
      expect(result.executionId).toBe('TASK-002');
    });

    it('should throw NotFoundException when modelId does not exist', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);

      const invalidDto = { ...createCostDto, modelId: 'unknown/model' };

      await expect(service.recordCost(invalidDto)).rejects.toThrow(
        'Model "unknown/model" not found in registry',
      );
      expect(mockPrisma.costLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getCostReport', () => {
    it('should return a cost report with summary and breakdowns', async () => {
      // Mock aggregate
      mockPrisma.costLog.aggregate.mockResolvedValue({
        _sum: { costUsd: 0.01, inputTokens: 10000, outputTokens: 5000 },
        _count: { id: 5 },
        _avg: { costUsd: 0.002 },
      });

      // Mock groupBy model
      mockPrisma.costLog.groupBy.mockResolvedValueOnce([
        {
          modelId: 'deepseek/deepseek-v4-flash',
          _sum: { costUsd: 0.008, inputTokens: 8000, outputTokens: 4000 },
          _count: { id: 4 },
          _avg: { latencyMs: 1200 },
        },
        {
          modelId: 'deepseek/deepseek-v4-pro',
          _sum: { costUsd: 0.002, inputTokens: 2000, outputTokens: 1000 },
          _count: { id: 1 },
          _avg: { latencyMs: 2500 },
        },
      ]);

      // Mock groupBy daily (second call)
      mockPrisma.costLog.groupBy.mockResolvedValueOnce([
        { recordedAt: new Date('2026-06-01'), _sum: { costUsd: 0.005 }, _count: { id: 2 } },
        { recordedAt: new Date('2026-06-02'), _sum: { costUsd: 0.005 }, _count: { id: 3 } },
      ]);

      // Mock model lookups
      mockPrisma.modelRegistry.findUnique
        .mockResolvedValueOnce({ displayName: 'DeepSeek v4 Flash' })
        .mockResolvedValueOnce({ displayName: 'DeepSeek v4 Pro' });

      const report = await service.getCostReport({ window: 'ROLLING_30D' });

      expect(report.summary.totalCostUsd).toBe(0.01);
      expect(report.summary.totalRequests).toBe(5);
      expect(report.summary.window).toBe('ROLLING_30D');
      expect(report.byModel).toHaveLength(2);
      expect(report.byDay).toHaveLength(2);
      expect(report.projection.budgetUsd).toBe(80);
      expect(typeof report.projection.projectedMonthlyUsd).toBe('number');
    });

    it('should return empty report when no cost logs exist', async () => {
      mockPrisma.costLog.aggregate.mockResolvedValue({
        _sum: { costUsd: 0, inputTokens: 0, outputTokens: 0 },
        _count: { id: 0 },
        _avg: { costUsd: 0 },
      });
      mockPrisma.costLog.groupBy.mockResolvedValueOnce([]);
      mockPrisma.costLog.groupBy.mockResolvedValueOnce([]);

      const report = await service.getCostReport({});

      expect(report.summary.totalCostUsd).toBe(0);
      expect(report.summary.totalRequests).toBe(0);
      expect(report.byModel).toHaveLength(0);
      expect(report.byDay).toHaveLength(0);
    });
  });

  describe('getProjectedMonthlySpend', () => {
    it('should calculate projected monthly spend', async () => {
      mockPrisma.costLog.aggregate.mockResolvedValue({
        _sum: { costUsd: 2.0 },
      });

      const projection = await service.getProjectedMonthlySpend();

      expect(typeof projection).toBe('number');
      expect(projection).toBeGreaterThan(0);
    });

    it('should return 0 when no cost data', async () => {
      mockPrisma.costLog.aggregate.mockResolvedValue({
        _sum: { costUsd: 0 },
      });

      const projection = await service.getProjectedMonthlySpend();

      expect(projection).toBe(0);
    });
  });

  describe('recalculate', () => {
    it('should return success message', async () => {
      const result = await service.recalculate();

      expect(result.recalculated).toBe(true);
      expect(result.message).toContain('recalculated');
    });
  });
});
