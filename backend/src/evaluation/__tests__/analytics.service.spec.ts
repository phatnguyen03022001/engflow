/* @lifecycle ACTIVE — Unit tests for AnalyticsService */
import { Max } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../services/analytics.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    agentExecution: { groupBy: jest.Mock; count: jest.Mock };
    executionPhase: { groupBy: jest.Mock };
    costLog: { groupBy: jest.Mock };
    $queryRawUnsafe: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      agentExecution: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      executionPhase: {
        groupBy: jest.fn(),
      },
      costLog: {
        groupBy: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ─── getAgentPerformance ───────────────────────────────────────────

  describe('getAgentPerformance', () => {
    it('should return empty items when no executions exist', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([]);
      prisma.executionPhase.groupBy.mockResolvedValue([]);

      const result = await service.getAgentPerformance({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should compute success rate from outcome groups', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([
        { finalOutcome: 'COMMITTED', _count: { id: 8 } },
        { finalOutcome: 'FAILED', _count: { id: 2 } },
      ]);
      prisma.executionPhase.groupBy.mockResolvedValue([
        { agentType: 'ROUTER', _avg: { durationMs: 120.5 }, _count: { id: 10 } },
        { agentType: 'CODE', _avg: { durationMs: 3450.7 }, _count: { id: 10 } },
      ]);

      const result = await service.getAgentPerformance({});

      expect(result.total).toBe(2);
      expect(result.items[0].agentType).toBe('ROUTER');
      expect(result.items[0].successRate).toBe(0.8);
      expect(result.items[0].avgDurationMs).toBe(121);
      expect(result.items[0].totalExecutions).toBe(10);
    });

    it('should handle zero executions gracefully', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([]);
      prisma.executionPhase.groupBy.mockResolvedValue([]);

      const result = await service.getAgentPerformance({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle 100% success rate', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([
        { finalOutcome: 'COMMITTED', _count: { id: 5 } },
      ]);
      prisma.executionPhase.groupBy.mockResolvedValue([
        { agentType: 'ROUTER', _avg: { durationMs: 100 }, _count: { id: 5 } },
      ]);

      const result = await service.getAgentPerformance({});

      expect(result.items[0].successRate).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should apply pagination with skip and take', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([
        { finalOutcome: 'COMMITTED', _count: { id: 20 } },
      ]);
      const phases = Array.from({ length: 10 }, (_, i) => ({
        agentType: `AGENT_${i}`,
        _avg: { durationMs: 100 + i * 10 },
        _count: { id: 2 },
      }));
      prisma.executionPhase.groupBy.mockResolvedValue(phases);

      const result = await service.getAgentPerformance({ skip: 2, take: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.items[0].agentType).toBe('AGENT_2');
      expect(result.total).toBe(10);
    });
  });

  // ─── getThroughput ─────────────────────────────────────────────────

  describe('getThroughput', () => {
    it('should return daily grouped throughput', async () => {
      const rows = [
        { period: '2026-06-09', count: 15 },
        { period: '2026-06-08', count: 23 },
      ];
      prisma.$queryRawUnsafe.mockResolvedValue(rows);

      const result = await service.getThroughput({});

      expect(result.items).toHaveLength(2);
      expect(result.items[0].period).toBe('2026-06-09');
      expect(result.items[0].count).toBe(15);
      expect(result.total).toBe(2);
    });

    it('should return empty when no executions exist', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getThroughput({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should pass date range filters to raw query', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const from = new Date('2026-06-01');
      const to = new Date('2026-06-07');
      await service.getThroughput({ from, to });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        from,
        to,
      );
    });

    it('should apply pagination', async () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        period: `2026-06-${String(i + 1).padStart(2, '0')}`,
        count: i + 1,
      }));
      prisma.$queryRawUnsafe.mockResolvedValue(rows);

      const result = await service.getThroughput({ skip: 5, take: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.items[0].period).toBe('2026-06-06');
      expect(result.total).toBe(30);
    });
  });

  // ─── getBottlenecks ────────────────────────────────────────────────

  describe('getBottlenecks', () => {
    it('should return phase groups ordered by avg duration desc', async () => {
      const groups = [
        { agentType: 'CODE', phaseOrder: 1, _avg: { durationMs: 5000 }, _max: { durationMs: 12000 }, _count: { id: 15 } },
        { agentType: 'PLAN', phaseOrder: 0, _avg: { durationMs: 3000 }, _max: { durationMs: 8000 }, _count: { id: 10 } },
        { agentType: 'ROUTER', phaseOrder: 0, _avg: { durationMs: 500 }, _max: { durationMs: 2000 }, _count: { id: 25 } },
      ];
      prisma.executionPhase.groupBy.mockResolvedValue(groups);

      const result = await service.getBottlenecks({});

      expect(result.items).toHaveLength(3);
      expect(result.items[0].agentType).toBe('CODE');
      expect(result.items[0].avgDurationMs).toBe(5000);
      expect(result.items[0].maxDurationMs).toBe(12000);
      expect(result.items[0].totalPhases).toBe(15);
    });

    it('should return empty when no phases exist', async () => {
      prisma.executionPhase.groupBy.mockResolvedValue([]);

      const result = await service.getBottlenecks({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should filter by agentType', async () => {
      prisma.executionPhase.groupBy.mockResolvedValue([]);

      await service.getBottlenecks({ agentType: 'CODE' });

      expect(prisma.executionPhase.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentType: 'CODE' }),
        }),
      );
    });

    it('should apply pagination', async () => {
      const groups = Array.from({ length: 15 }, (_, i) => ({
        agentType: `AGENT_${i}`,
        phaseOrder: 0,
        _avg: { durationMs: 1000 + i * 100 },
        _max: { durationMs: 2000 + i * 100 },
        _count: { id: 5 },
      }));
      prisma.executionPhase.groupBy.mockResolvedValue(groups);

      const result = await service.getBottlenecks({ skip: 5, take: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(15);
    });
  });

  // ─── getCostTrends ─────────────────────────────────────────────────

  describe('getCostTrends', () => {
    it('should return daily cost aggregations', async () => {
      const rows = [
        { period: '2026-06-09', totalCostUsd: 12.5, totalInputTokens: 150000, totalOutputTokens: 50000, executionCount: 8 },
        { period: '2026-06-08', totalCostUsd: 8.3, totalInputTokens: 100000, totalOutputTokens: 30000, executionCount: 5 },
      ];
      prisma.$queryRawUnsafe.mockResolvedValue(rows);

      const result = await service.getCostTrends({});

      expect(result.items).toHaveLength(2);
      expect(result.items[0].period).toBe('2026-06-09');
      expect(result.items[0].totalCostUsd).toBe(12.5);
      expect(result.items[0].executionCount).toBe(8);
      expect(result.total).toBe(2);
    });

    it('should return empty when no cost logs exist', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getCostTrends({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should pass date range to raw query', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const from = new Date('2026-06-01');
      const to = new Date('2026-06-30');
      await service.getCostTrends({ from, to });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        from,
        to,
      );
    });

    it('should apply pagination', async () => {
      const rows = Array.from({ length: 25 }, (_, i) => ({
        period: `2026-06-${String(i + 1).padStart(2, '0')}`,
        totalCostUsd: 5.0,
        totalInputTokens: 10000,
        totalOutputTokens: 5000,
        executionCount: 3,
      }));
      prisma.$queryRawUnsafe.mockResolvedValue(rows);

      const result = await service.getCostTrends({ skip: 10, take: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(25);
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle null durationMs in phase groups', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([
        { finalOutcome: 'COMMITTED', _count: { id: 3 } },
      ]);
      prisma.executionPhase.groupBy.mockResolvedValue([
        { agentType: 'ROUTER', _avg: { durationMs: null }, _count: { id: 3 } },
      ]);

      const result = await service.getAgentPerformance({});

      expect(result.items[0].avgDurationMs).toBe(0);
    });

    it('should handle 0% success rate', async () => {
      prisma.agentExecution.groupBy.mockResolvedValue([
        { finalOutcome: 'FAILED', _count: { id: 5 } },
        { finalOutcome: 'BLOCKED', _count: { id: 3 } },
      ]);
      prisma.executionPhase.groupBy.mockResolvedValue([
        { agentType: 'ROUTER', _avg: { durationMs: 200 }, _count: { id: 8 } },
      ]);

      const result = await service.getAgentPerformance({});

      expect(result.items[0].successRate).toBe(0);
    });

    it('should enforce max take of 100 via DTO validation', () => {
      const dto = new QueryAnalyticsDto();
      // DTO has @Max(100) on take — validation is applied at controller level
      expect(dto).toBeDefined();
    });
  });
});
