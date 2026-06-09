/* @lifecycle ACTIVE — Unit tests for MemoryService (TASK-029) */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MemoryService } from '../services/memory.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AgentType, MemoryOutcome } from '../interfaces/agent-memory.interface';

describe('MemoryService', () => {
  let service: MemoryService;
  let prisma: any;

  const mockPrisma = {
    agentMemory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    agentExecution: {
      findUnique: jest.fn(),
    },
  };

  const mockMemoryRecord = {
    id: 'mem-uuid-1',
    memoryId: 'MEM-20260608-abc123',
    agentType: 'ROUTER',
    taskType: 'LEVEL_1',
    context: { requestSummary: 'Test request', routerRoute: 'LEVEL_1', routerConfidence: 0.9 },
    decision: 'LEVEL_1',
    outcome: 'SUCCESS',
    success: true,
    confidence: 0.85,
    lessonsLearned: ['Routed test request to LEVEL_1'],
    sourceExecutionId: 'EXEC-001',
    sourcePhaseId: 'PHASE-001',
    domain: null,
    technology: null,
    projectId: '__global__',
    applicabilityScore: null,
    referenceCount: 1,
    decayWeight: 1.0,
    createdAt: new Date(),
    lastReferencedAt: null,
    expiresAt: null,
  };

  const mockExecutionRecord = {
    id: 'exec-uuid-1',
    executionId: 'EXEC-001',
    requestSummary: 'Test execution',
    routerRoute: 'LEVEL_3',
    routerConfidence: 0.85,
    routerRisk: 'low',
    routerReason: 'Test',
    planSummary: 'Test plan',
    planTaskCount: 3,
    archReviewed: true,
    archRevisionNeeded: false,
    preVerifyDecision: 'PASS',
    preVerifyFlags: null,
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    postVerifyIssues: null,
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 100000,
    committedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    phases: [
      { id: 'ph-uuid-1', phaseId: 'PH-ROUTER', executionId: 'exec-uuid-1', agentType: 'ROUTER', phaseOrder: 1, input: null, output: null, decision: 'LEVEL_3', decisionReason: null, durationMs: 500, modelUsed: 'test', transitionedTo: 'PLAN', recordedAt: new Date() },
      { id: 'ph-uuid-2', phaseId: 'PH-PLAN', executionId: 'exec-uuid-1', agentType: 'PLAN', phaseOrder: 2, input: null, output: null, decision: 'PASS', decisionReason: 'Plan approved', durationMs: 15000, modelUsed: 'test', transitionedTo: 'ARCH', recordedAt: new Date() },
      { id: 'ph-uuid-3', phaseId: 'PH-ARCH', executionId: 'exec-uuid-1', agentType: 'ARCHITECT', phaseOrder: 3, input: null, output: null, decision: 'PASS', decisionReason: 'Architecture approved', durationMs: 20000, modelUsed: 'test', transitionedTo: 'PRE_VERIFY', recordedAt: new Date() },
      { id: 'ph-uuid-4', phaseId: 'PH-PREVERIFY', executionId: 'exec-uuid-1', agentType: 'PRE_VERIFY', phaseOrder: 4, input: null, output: null, decision: 'PASS', durationMs: 5000, modelUsed: 'test', transitionedTo: 'CODE', recordedAt: new Date() },
      { id: 'ph-uuid-5', phaseId: 'PH-CODE', executionId: 'exec-uuid-1', agentType: 'CODE', phaseOrder: 5, input: null, output: null, decision: 'PASS', durationMs: 45000, modelUsed: 'test', transitionedTo: 'POST_VERIFY', recordedAt: new Date() },
      { id: 'ph-uuid-6', phaseId: 'PH-POSTVERIFY', executionId: 'exec-uuid-1', agentType: 'POST_VERIFY', phaseOrder: 6, input: null, output: null, decision: 'PASS', durationMs: 5000, modelUsed: 'test', transitionedTo: 'COMMIT', recordedAt: new Date() },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createMemory ───────────────────────────────────────────────────────

  describe('createMemory', () => {
    it('should create a new memory entry', async () => {
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      const result = await service.createMemory({
        agentType: AgentType.ROUTER,
        taskType: 'LEVEL_1',
        outcome: MemoryOutcome.SUCCESS,
        success: true,
        decision: 'LEVEL_1',
      });

      expect(mockPrisma.agentMemory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentType: 'ROUTER',
            taskType: 'LEVEL_1',
            outcome: 'SUCCESS',
            success: true,
          }),
        }),
      );
      expect(result).toEqual(mockMemoryRecord);
    });

    it('should update existing memory when sourceExecutionId+agentType duplicate exists', async () => {
      mockPrisma.agentMemory.findFirst.mockResolvedValue(mockMemoryRecord);
      mockPrisma.agentMemory.update.mockResolvedValue({
        ...mockMemoryRecord,
        referenceCount: 2,
      });

      const result = await service.createMemory({
        agentType: AgentType.ROUTER,
        taskType: 'LEVEL_1',
        outcome: MemoryOutcome.SUCCESS,
        success: true,
        sourceExecutionId: 'EXEC-001',
      });

      expect(mockPrisma.agentMemory.findFirst).toHaveBeenCalledWith({
        where: { sourceExecutionId: 'EXEC-001', agentType: 'ROUTER' },
      });
      expect(mockPrisma.agentMemory.update).toHaveBeenCalled();
      expect(mockPrisma.agentMemory.create).not.toHaveBeenCalled();
      expect(result.referenceCount).toBe(2);
    });

    it('should create new memory when sourceExecutionId has no existing match', async () => {
      mockPrisma.agentMemory.findFirst.mockResolvedValue(null);
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      const result = await service.createMemory({
        agentType: AgentType.ROUTER,
        taskType: 'LEVEL_1',
        outcome: MemoryOutcome.SUCCESS,
        success: true,
        sourceExecutionId: 'EXEC-NEW',
      });

      expect(mockPrisma.agentMemory.findFirst).toHaveBeenCalled();
      expect(mockPrisma.agentMemory.create).toHaveBeenCalled();
      expect(result).toEqual(mockMemoryRecord);
    });

    it('should handle optional fields being omitted', async () => {
      mockPrisma.agentMemory.create.mockResolvedValue({
        ...mockMemoryRecord,
        confidence: null,
        domain: null,
        technology: null,
      });

      const result = await service.createMemory({
        agentType: AgentType.CODE,
        taskType: 'BUG_FIX',
        outcome: MemoryOutcome.SUCCESS,
        success: true,
      });

      expect(mockPrisma.agentMemory.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ─── createFromExecution ────────────────────────────────────────────────

  describe('createFromExecution', () => {
    it('should create memories for each agent type in a full execution', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecutionRecord);
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      const result = await service.createFromExecution('EXEC-001');

      expect(mockPrisma.agentExecution.findUnique).toHaveBeenCalledWith({
        where: { executionId: 'EXEC-001' },
        include: { phases: true },
      });
      expect(mockPrisma.agentMemory.create).toHaveBeenCalledTimes(6);
      expect(result).toHaveLength(6);
    });

    it('should throw NotFoundException for non-existent execution', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

      await expect(
        service.createFromExecution('NONEXISTENT'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should derive MIXED outcome from retries', async () => {
      const execWithRetry = {
        ...mockExecutionRecord,
        finalOutcome: 'COMMITTED',
        retryCount: 2,
        codeAttempts: 3,
      };
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execWithRetry);
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      await service.createFromExecution('EXEC-002');

      // All created memories for COMMITTED+retry should have MIXED outcome
      const createCalls = mockPrisma.agentMemory.create.mock.calls;
      for (const call of createCalls) {
        expect(call[0].data.outcome).toBe('MIXED');
      }
    });

    it('should derive BLOCKED outcome for blocked execution', async () => {
      const blockedExec = {
        ...mockExecutionRecord,
        finalOutcome: 'BLOCKED',
        phases: mockExecutionRecord.phases.slice(0, 4),
      };
      mockPrisma.agentExecution.findUnique.mockResolvedValue(blockedExec);
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      await service.createFromExecution('EXEC-003');

      const createCalls = mockPrisma.agentMemory.create.mock.calls;
      for (const call of createCalls) {
        expect(call[0].data.outcome).toBe('BLOCKED');
      }
    });

    it('should derive lessons for ROUTER phase', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecutionRecord);
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      await service.createFromExecution('EXEC-001');

      const createCalls = mockPrisma.agentMemory.create.mock.calls;
      const routerCall = createCalls.find(
        (c: any[]) => c[0].data.agentType === 'ROUTER',
      );
      expect(routerCall).toBeDefined();
      const lessons = routerCall[0].data.lessonsLearned;
      expect(lessons[0]).toContain('Routed');
    });

    it('should create memories for ROUTER-only execution', async () => {
      const routerOnly = {
        ...mockExecutionRecord,
        phases: [
          { id: 'ph-1', phaseId: 'PH-ROUTER', executionId: 'exec-uuid', agentType: 'ROUTER', phaseOrder: 1, input: null, output: null, decision: 'LEVEL_1', decisionReason: null, durationMs: 300, modelUsed: 'test', transitionedTo: 'CODE', recordedAt: new Date() },
        ],
        finalOutcome: 'COMMITTED',
      };
      mockPrisma.agentExecution.findUnique.mockResolvedValue(routerOnly);
      mockPrisma.agentMemory.create.mockResolvedValue(mockMemoryRecord);

      const result = await service.createFromExecution('EXEC-004');

      expect(mockPrisma.agentMemory.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  // ─── querySimilar ───────────────────────────────────────────────────────

  describe('querySimilar', () => {
    it('should return memories sorted by applicability score', async () => {
      const highScore = {
        ...mockMemoryRecord,
        id: 'mem-1',
        agentType: 'ROUTER',
        taskType: 'LEVEL_1',
        outcome: 'SUCCESS',
        decayWeight: 1.0,
      };
      const lowScore = {
        ...mockMemoryRecord,
        id: 'mem-2',
        agentType: 'CODE',
        taskType: 'LEVEL_2',
        outcome: 'FAILURE',
        decayWeight: 0.5,
      };
      mockPrisma.agentMemory.findMany.mockResolvedValue([highScore, lowScore]);

      const result = await service.querySimilar({
        agentType: AgentType.ROUTER,
        taskType: 'LEVEL_1',
      });

      expect(result).toHaveLength(2);
      expect(result[0].memory.id).toBe('mem-1');
      expect(result[0].applicabilityScore).toBeGreaterThanOrEqual(
        result[1].applicabilityScore,
      );
    });

    it('should return empty array when no memories match', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([]);

      const result = await service.querySimilar({
        agentType: AgentType.ARCHITECT,
      });

      expect(result).toHaveLength(0);
    });

    it('should return lower outcomeWeight for FAILURE outcome', async () => {
      const mem = { ...mockMemoryRecord, outcome: 'FAILURE', decayWeight: 1.0 };
      mockPrisma.agentMemory.findMany.mockResolvedValue([mem]);

      const result = await service.querySimilar({});

      expect(result[0].outcomeWeight).toBe(0.2);
    });

    it('should apply decayWeight in scoring', async () => {
      const mem = { ...mockMemoryRecord, outcome: 'SUCCESS', decayWeight: 0.3 };
      mockPrisma.agentMemory.findMany.mockResolvedValue([mem]);

      const result = await service.querySimilar({});

      // applicability = 0.15 (baseline) * 1.0 (SUCCESS) * 0.3 (decayWeight) = 0.045
      expect(result[0].applicabilityScore).toBe(0.05);
    });

    it('should parse contextJson for context matching', async () => {
      const mem = {
        ...mockMemoryRecord,
        context: { techStack: 'NestJS', scale: 'medium' },
      };
      mockPrisma.agentMemory.findMany.mockResolvedValue([mem]);

      const result = await service.querySimilar({
        contextJson: JSON.stringify({ techStack: 'NestJS' }),
      });

      expect(result[0].similarity).toBeGreaterThan(0.15);
    });
  });

  // ─── getTopPatterns ─────────────────────────────────────────────────────

  describe('getTopPatterns', () => {
    it('should return top successful patterns sorted by success rate desc', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([
        { ...mockMemoryRecord, taskType: 'LEVEL_1', domain: 'auth', success: true },
        { ...mockMemoryRecord, taskType: 'LEVEL_1', domain: 'auth', success: true },
        { ...mockMemoryRecord, taskType: 'LEVEL_2', domain: 'db', success: false },
        { ...mockMemoryRecord, taskType: 'LEVEL_2', domain: 'db', success: true },
      ]);

      const result = await service.getTopPatterns(undefined, true, 10);

      expect(result).toHaveLength(2);
      // LEVEL_1::auth has 100% success rate → first
      expect(result[0].taskType).toBe('LEVEL_1');
      expect(result[0].successRate).toBe(100);
    });

    it('should filter by agentType', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([
        { ...mockMemoryRecord, taskType: 'LEVEL_1', agentType: 'ROUTER', success: true },
      ]);

      const result = await service.getTopPatterns(AgentType.ROUTER, true, 10);

      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentType: 'ROUTER' }),
        }),
      );
    });

    it('should respect limit parameter', async () => {
      const mems = Array.from({ length: 20 }, (_, i) => ({
        ...mockMemoryRecord,
        taskType: `TASK-${i}`,
        success: i % 2 === 0,
      }));
      mockPrisma.agentMemory.findMany.mockResolvedValue(mems);

      const result = await service.getTopPatterns(undefined, true, 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── getSummary ─────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('should return correct counts', async () => {
      mockPrisma.agentMemory.count.mockResolvedValueOnce(10); // total
      mockPrisma.agentMemory.count.mockResolvedValueOnce(3); // active
      mockPrisma.agentMemory.count.mockResolvedValueOnce(1); // stale
      mockPrisma.agentMemory.groupBy.mockResolvedValueOnce([
        { agentType: 'ROUTER', _count: { id: 4 } },
        { agentType: 'CODE', _count: { id: 6 } },
      ]);
      mockPrisma.agentMemory.groupBy.mockResolvedValueOnce([
        { domain: 'auth', _count: { id: 3 }, _max: { createdAt: new Date() } },
      ]);

      const result = await service.getSummary();

      expect(result.totalMemories).toBe(10);
      expect(result.activeMemories).toBe(3);
      expect(result.staleMemories).toBe(1);
      expect(result.byAgentType).toEqual({ ROUTER: 4, CODE: 6 });
      expect(result.perDomainBreakdown).toHaveLength(1);
    });

    it('should filter by agentType when provided', async () => {
      mockPrisma.agentMemory.count.mockResolvedValue(5);
      mockPrisma.agentMemory.count.mockResolvedValue(2);
      mockPrisma.agentMemory.count.mockResolvedValue(0);
      mockPrisma.agentMemory.groupBy.mockResolvedValue([]);
      mockPrisma.agentMemory.groupBy.mockResolvedValue([]);

      await service.getSummary(AgentType.CODE);

      expect(mockPrisma.agentMemory.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentType: 'CODE' }),
        }),
      );
    });
  });

  // ─── decayAll ───────────────────────────────────────────────────────────

  describe('decayAll', () => {
    it('should apply decay factor to all memories', async () => {
      const decayFactor = Math.exp(-Math.LN2 / 12);
      mockPrisma.agentMemory.updateMany.mockResolvedValue({ count: 10 });

      await service.decayAll();

      expect(mockPrisma.agentMemory.updateMany).toHaveBeenCalledWith({
        data: {
          decayWeight: { multiply: decayFactor },
        },
      });
    });

    it('should not throw when database is empty', async () => {
      mockPrisma.agentMemory.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.decayAll()).resolves.not.toThrow();
    });
  });

  // ─── cleanupStale ───────────────────────────────────────────────────────

  describe('cleanupStale', () => {
    it('should delete memories with decayWeight < 0.1 and age > 2 years', async () => {
      mockPrisma.agentMemory.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupStale();

      expect(mockPrisma.agentMemory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            decayWeight: { lt: 0.1 },
            createdAt: { lte: expect.any(Date) },
          },
        }),
      );
      expect(result).toBe(3);
    });

    it('should return 0 when no stale entries exist', async () => {
      mockPrisma.agentMemory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupStale();

      expect(result).toBe(0);
    });
  });
});
