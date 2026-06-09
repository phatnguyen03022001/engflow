/* @lifecycle ACTIVE — Unit tests for SelfHealService */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SelfHealService } from '../services/self-heal.service';
import { MetricService } from '../services/metric.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('SelfHealService', () => {
  let service: SelfHealService;
  let prisma: any;
  let metricService: any;

  const baseExecution = (overrides: Record<string, unknown> = {}) => ({
    id: 'exec-1',
    executionId: 'exec-001',
    finalOutcome: 'FAILED',
    retryCount: 0,
    requestSummary: 'Test execution',
    routerRoute: 'LEVEL_1',
    routerConfidence: 0.9,
    routerRisk: 'low',
    routerReason: 'test',
    planSummary: null,
    planTaskCount: null,
    archReviewed: false,
    archRevisionNeeded: false,
    preVerifyDecision: null,
    preVerifyFlags: null,
    codeAttempts: 0,
    codeFirstAttemptSuccess: null,
    postVerifyDecision: null,
    postVerifyIssues: null,
    debugSuccess: null,
    totalDurationMs: null,
    committedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      agentExecution: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      driftEvent: {
        findUnique: jest.fn(),
      },
    };

    metricService = {
      onExecutionCommitted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelfHealService,
        { provide: PrismaService, useValue: prisma },
        { provide: MetricService, useValue: metricService },
      ],
    }).compile();

    service = module.get<SelfHealService>(SelfHealService);
  });

  describe('retryFailedExecution', () => {
    it('should retry a FAILED execution', async () => {
      prisma.agentExecution.findUnique.mockResolvedValue(baseExecution());
      prisma.agentExecution.update.mockResolvedValue(
        baseExecution({ retryCount: 1, finalOutcome: 'RETRYING' }),
      );

      const result = await service.retryFailedExecution('exec-001');

      expect(result.retried).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(result.reason).toContain('Retry attempt');
      expect(prisma.agentExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { executionId: 'exec-001' },
          data: expect.objectContaining({
            retryCount: { increment: 1 },
            finalOutcome: 'RETRYING',
          }),
        }),
      );
      expect(metricService.onExecutionCommitted).toHaveBeenCalledWith('exec-001');
    });

    it('should skip execution when finalOutcome is not FAILED', async () => {
      prisma.agentExecution.findUnique.mockResolvedValue(
        baseExecution({ finalOutcome: 'COMMITTED' }),
      );

      const result = await service.retryFailedExecution('exec-001');

      expect(result.retried).toBe(false);
      expect(result.reason).toContain('COMMITTED');
      expect(prisma.agentExecution.update).not.toHaveBeenCalled();
    });

    it('should skip execution when max retries reached', async () => {
      prisma.agentExecution.findUnique.mockResolvedValue(
        baseExecution({ retryCount: 2 }),
      );

      const result = await service.retryFailedExecution('exec-001');

      expect(result.retried).toBe(false);
      expect(result.reason).toContain('Max retries');
      expect(prisma.agentExecution.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when execution does not exist', async () => {
      prisma.agentExecution.findUnique.mockResolvedValue(null);

      await expect(
        service.retryFailedExecution('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('healDrift', () => {
    const mockDriftEvent = {
      id: 'drift-001',
      sourcePath: 'src/auth/login.ts',
      isResolved: false,
      resolvedAt: null,
      severity: 'CRITICAL',
      title: 'Auth drift',
      description: 'Auth module drift detected',
      detectorType: 'STRUCTURE',
      expectedValue: null,
      actualValue: null,
      detectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should retry executions related to a drift event', async () => {
      prisma.driftEvent.findUnique.mockResolvedValue(mockDriftEvent);
      prisma.agentExecution.findMany.mockResolvedValue([
        baseExecution({ executionId: 'exec-001', requestSummary: 'Fix login/auth issue' }),
        baseExecution({ executionId: 'exec-002', requestSummary: 'Update login.ts config' }),
      ]);
      prisma.agentExecution.findUnique
        .mockResolvedValueOnce(baseExecution({ executionId: 'exec-001', retryCount: 0 }))
        .mockResolvedValueOnce(baseExecution({ executionId: 'exec-002', retryCount: 0 }));
      prisma.agentExecution.update.mockResolvedValue(
        baseExecution({ retryCount: 1, finalOutcome: 'RETRYING' }),
      );

      const result = await service.healDrift('drift-001');

      expect(result.retried).toBe(2);
      expect(prisma.driftEvent.findUnique).toHaveBeenCalledWith({
        where: { id: 'drift-001' },
      });
      expect(prisma.agentExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            finalOutcome: 'FAILED',
            retryCount: { lt: 2 },
          }),
        }),
      );
    });

    it('should skip if drift event already resolved', async () => {
      prisma.driftEvent.findUnique.mockResolvedValue({
        ...mockDriftEvent,
        isResolved: true,
        resolvedAt: new Date(),
      });

      const result = await service.healDrift('drift-001');

      expect(result.retried).toBe(0);
      expect(prisma.agentExecution.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when drift event does not exist', async () => {
      prisma.driftEvent.findUnique.mockResolvedValue(null);

      await expect(service.healDrift('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.agentExecution.findMany).not.toHaveBeenCalled();
    });

    it('should return 0 retried when no matching failed executions', async () => {
      prisma.driftEvent.findUnique.mockResolvedValue(mockDriftEvent);
      prisma.agentExecution.findMany.mockResolvedValue([]);

      const result = await service.healDrift('drift-001');

      expect(result.retried).toBe(0);
    });
  });

  describe('retryAllFailed', () => {
    it('should retry all eligible failed executions', async () => {
      const failedExecs = [
        baseExecution({ executionId: 'exec-001', retryCount: 0 }),
        baseExecution({ executionId: 'exec-002', retryCount: 0 }),
      ];
      prisma.agentExecution.findMany.mockResolvedValue(failedExecs);
      prisma.agentExecution.findUnique.mockResolvedValue(failedExecs[0]);
      prisma.agentExecution.findUnique.mockResolvedValue(failedExecs[1]);
      prisma.agentExecution.update.mockResolvedValue(
        baseExecution({ retryCount: 1, finalOutcome: 'RETRYING' }),
      );

      const result = await service.retryAllFailed();

      expect(result.total).toBe(2);
      expect(result.retried).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should handle errors during individual retries gracefully', async () => {
      const failedExecs = [
        baseExecution({ executionId: 'exec-001', retryCount: 0 }),
      ];
      prisma.agentExecution.findMany.mockResolvedValue(failedExecs);
      prisma.agentExecution.findUnique.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.retryAllFailed();

      expect(result.total).toBe(1);
      expect(result.retried).toBe(0);
      expect(result.errors).toBe(1);
    });
  });
});
