// @lifecycle ACTIVE — Unit tests for RouterEvaluatorService
import { Test, TestingModule } from '@nestjs/testing';
import { RouterEvaluatorService } from '../services/router-evaluator.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('RouterEvaluatorService', () => {
  let service: RouterEvaluatorService;
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
        RouterEvaluatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RouterEvaluatorService>(RouterEvaluatorService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null accuracy for empty data', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([]);

    const result = await service.compute();

    expect(result.accuracy).toBeNull();
    expect(result.totalRouted).toBe(0);
    expect(result.byRoute).toHaveLength(0);
  });

  it('should count L1 COMMITTED as consistent', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        routerRoute: 'LEVEL_1',
        codeAttempts: 1,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: null,
      },
    ]);

    const result = await service.compute();

    expect(result.accuracy).toBe(1);
    expect(result.outcomeConsistent).toBe(1);
    expect(result.outcomeInconsistent).toBe(0);
  });

  it('should count L1 with archReviewed as inconsistent', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        routerRoute: 'LEVEL_1',
        codeAttempts: 0,
        finalOutcome: 'COMMITTED',
        archReviewed: true,
        preVerifyDecision: null,
        planTaskCount: null,
      },
    ]);

    const result = await service.compute();

    expect(result.accuracy).toBe(0);
    expect(result.outcomeConsistent).toBe(0);
    expect(result.outcomeInconsistent).toBe(1);
  });

  it('should count L2 with plan+COMMITTED as consistent', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        routerRoute: 'LEVEL_2',
        codeAttempts: 0,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: 3,
      },
    ]);

    const result = await service.compute();

    expect(result.accuracy).toBe(1);
    expect(result.outcomeConsistent).toBe(1);
  });

  it('should handle mixed data correctly', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        routerRoute: 'LEVEL_1',
        codeAttempts: 1,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: null,
      },
      {
        routerRoute: 'LEVEL_1',
        codeAttempts: 0,
        finalOutcome: 'FAILED',
        archReviewed: true,
        preVerifyDecision: null,
        planTaskCount: null,
      },
      {
        routerRoute: 'LEVEL_2',
        codeAttempts: 2,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: 5,
      },
      {
        routerRoute: 'LEVEL_3',
        codeAttempts: 1,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: 4,
      },
    ]);

    const result = await service.compute();

    expect(result.totalRouted).toBe(4);
    expect(result.outcomeConsistent).toBe(3);
    expect(result.outcomeInconsistent).toBe(1);
    expect(result.accuracy).toBe(0.75);
    expect(result.byRoute).toHaveLength(3);
  });

  it('should include route breakdown with correct counts', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        routerRoute: 'LEVEL_1',
        codeAttempts: 1,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: null,
      },
      {
        routerRoute: 'LEVEL_1',
        codeAttempts: 0,
        finalOutcome: 'COMMITTED',
        archReviewed: true,
        preVerifyDecision: null,
        planTaskCount: null,
      },
    ]);

    const result = await service.compute();

    const l1Route = result.byRoute.find((r) => r.route === 'LEVEL_1');
    expect(l1Route).toBeDefined();
    expect(l1Route!.total).toBe(2);
    expect(l1Route!.consistent).toBe(1);
    expect(l1Route!.inconsistent).toBe(1);
  });

  it('should count L3 ambiguous cases separately', async () => {
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        routerRoute: 'LEVEL_3',
        codeAttempts: 1,
        finalOutcome: 'COMMITTED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: 0,
      },
      {
        routerRoute: 'LEVEL_3',
        codeAttempts: 1,
        finalOutcome: 'BLOCKED',
        archReviewed: false,
        preVerifyDecision: null,
        planTaskCount: 1,
      },
    ]);

    const result = await service.compute();

    expect(result.ambiguous).toBe(2);
    expect(result.outcomeConsistent).toBe(0);
    expect(result.outcomeInconsistent).toBe(0);
    // All ambiguous, so accuracy is null (0/0 → evaluated = 0)
    expect(result.accuracy).toBeNull();
  });
});
