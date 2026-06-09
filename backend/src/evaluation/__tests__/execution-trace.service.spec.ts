// @lifecycle ACTIVE — Unit tests for ExecutionTraceService
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExecutionTraceService } from '../services/execution-trace.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('ExecutionTraceService', () => {
  let service: ExecutionTraceService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    agentExecution: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    executionPhase: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockExecution = {
    id: 'exec-uuid-1',
    executionId: 'TASK-001',
    requestSummary: 'Test execution',
    routerRoute: 'LEVEL_3',
    routerConfidence: 0.9,
    routerRisk: 'low',
    routerReason: 'Complex task',
    planSummary: 'Full plan',
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
    totalDurationMs: 120000,
    committedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionTraceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExecutionTraceService>(ExecutionTraceService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      executionId: 'TASK-001',
      requestSummary: 'Test execution',
      routerRoute: 'LEVEL_3',
      routerConfidence: 0.9,
      routerRisk: 'low',
      routerReason: 'Complex task',
      planSummary: 'Full plan',
      planTaskCount: 3,
      archReviewed: true,
      finalOutcome: 'COMMITTED',
    };

    it('should create an execution successfully', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(null);
      mockPrisma.agentExecution.create.mockResolvedValue(mockExecution);

      const result = await service.create(createDto);

      expect(mockPrisma.agentExecution.findUnique).toHaveBeenCalledWith({
        where: { executionId: 'TASK-001' },
      });
      expect(mockPrisma.agentExecution.create).toHaveBeenCalled();
      expect(result).toEqual(mockExecution);
    });

    it('should throw ConflictException for duplicate executionId', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecution);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.agentExecution.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results without filters', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([mockExecution]);
      mockPrisma.agentExecution.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.agentExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should apply route filter', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);
      mockPrisma.agentExecution.count.mockResolvedValue(0);

      await service.findAll({ routerRoute: 'LEVEL_3' });

      expect(mockPrisma.agentExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { routerRoute: 'LEVEL_3' },
        }),
      );
    });

    it('should return empty results', async () => {
      mockPrisma.agentExecution.findMany.mockResolvedValue([]);
      mockPrisma.agentExecution.count.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findByExecutionId', () => {
    it('should return an execution by executionId', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecution);

      const result = await service.findByExecutionId('TASK-001');

      expect(result).toEqual(mockExecution);
      expect(mockPrisma.agentExecution.findUnique).toHaveBeenCalledWith({
        where: { executionId: 'TASK-001' },
        include: { phases: { orderBy: { phaseOrder: 'asc' } } },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

      await expect(service.findByExecutionId('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addPhase', () => {
    const createPhaseDto = {
      phaseId: 'PHASE-001',
      agentType: 'ROUTER',
      phaseOrder: 1,
      durationMs: 1000,
      modelUsed: 'deepseek-v4',
    };

    it('should add a phase successfully', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.executionPhase.findUnique.mockResolvedValue(null);
      mockPrisma.executionPhase.create.mockResolvedValue({
        id: 'phase-uuid-1',
        phaseId: 'PHASE-001',
        executionId: 'exec-uuid-1',
        agentType: 'ROUTER',
        phaseOrder: 1,
        input: null,
        output: null,
        decision: null,
        decisionReason: null,
        durationMs: 1000,
        modelUsed: 'deepseek-v4',
        transitionedTo: null,
        recordedAt: new Date(),
      });

      const result = await service.addPhase('TASK-001', createPhaseDto);

      expect(mockPrisma.agentExecution.findUnique).toHaveBeenCalledWith({
        where: { executionId: 'TASK-001' },
      });
      expect(mockPrisma.executionPhase.create).toHaveBeenCalled();
      expect(result.phaseId).toBe('PHASE-001');
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

      await expect(
        service.addPhase('nonexistent', createPhaseDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate phaseId', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.executionPhase.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.addPhase('TASK-001', createPhaseDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete an execution', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(mockExecution);
      mockPrisma.agentExecution.delete.mockResolvedValue(mockExecution);

      const result = await service.remove('exec-uuid-1');

      expect(mockPrisma.agentExecution.delete).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        include: { phases: true },
      });
      expect(result).toEqual(mockExecution);
    });

    it('should throw NotFoundException when deleting nonexistent', async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.agentExecution.delete).not.toHaveBeenCalled();
    });
  });

  describe('countByOutcome', () => {
    it('should return counts grouped by finalOutcome', async () => {
      mockPrisma.agentExecution.groupBy.mockResolvedValue([
        { finalOutcome: 'COMMITTED', _count: { id: 5 } },
        { finalOutcome: 'BLOCKED', _count: { id: 2 } },
      ]);

      const result = await service.countByOutcome();

      expect(result.COMMITTED).toBe(5);
      expect(result.BLOCKED).toBe(2);
      expect(result.FAILED).toBe(0);
      expect(result.ABANDONED).toBe(0);
    });

    it('should return zero counts when no executions exist', async () => {
      mockPrisma.agentExecution.groupBy.mockResolvedValue([]);

      const result = await service.countByOutcome();

      expect(result.COMMITTED).toBe(0);
      expect(result.BLOCKED).toBe(0);
      expect(result.FAILED).toBe(0);
      expect(result.ABANDONED).toBe(0);
    });
  });
});
