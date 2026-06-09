/* @lifecycle ACTIVE — Unit tests for MemoryController (TASK-029, TASK-30E) */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MemoryController } from '../memory.controller';
import { MemoryService } from '../services/memory.service';
import { ContextManagerService } from '../services/context-manager.service';
import { CreateMemoryDto } from '../dto/create-memory.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AgentType, MemoryOutcome } from '../interfaces/agent-memory.interface';

describe('MemoryController', () => {
  let controller: MemoryController;
  let memoryService: jest.Mocked<MemoryService>;

  const mockMemoryService = {
    createMemory: jest.fn(),
    createFromExecution: jest.fn(),
    querySimilar: jest.fn(),
    getTopPatterns: jest.fn(),
    getSummary: jest.fn(),
    decayAll: jest.fn(),
    cleanupStale: jest.fn(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: ContextManagerService, useValue: { assemble: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MemoryController>(MemoryController);
    memoryService = module.get(MemoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── POST /memories ────────────────────────────────────────────────────

  describe('POST /memories', () => {
    it('should create a memory', async () => {
      const dto: CreateMemoryDto = {
        agentType: AgentType.ROUTER,
        taskType: 'LEVEL_1',
        outcome: MemoryOutcome.SUCCESS,
        success: true,
      };
      const expected = { id: 'mem-1', ...dto };
      mockMemoryService.createMemory.mockResolvedValue(expected);

      const result = await controller.createMemory(dto);

      expect(mockMemoryService.createMemory).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  // ─── GET /memories/similar ─────────────────────────────────────────────

  describe('GET /memories/similar', () => {
    it('should query similar memories', async () => {
      const query = {
        agentType: AgentType.CODE,
        taskType: 'BUG_FIX',
        contextJson: '{"techStack":"NestJS"}',
        minConfidence: 0.5,
      };
      const expected = [{ memory: { id: 'mem-1' }, applicabilityScore: 0.8 }];
      mockMemoryService.querySimilar.mockResolvedValue(expected as any);

      const result = await controller.querySimilar(query as any);

      expect(mockMemoryService.querySimilar).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: AgentType.CODE,
          taskType: 'BUG_FIX',
          contextJson: '{"techStack":"NestJS"}',
          minConfidence: 0.5,
        }),
      );
      expect(result).toEqual(expected);
    });

    it('should handle invalid contextJson gracefully', async () => {
      const query = { contextJson: 'invalid-json' };
      mockMemoryService.querySimilar.mockResolvedValue([]);

      const result = await controller.querySimilar(query as any);

      expect(mockMemoryService.querySimilar).toHaveBeenCalledWith(
        expect.objectContaining({ contextJson: undefined }),
      );
      expect(result).toEqual([]);
    });
  });

  // ─── GET /memories/patterns/successful ──────────────────────────────────

  describe('GET /memories/patterns/successful', () => {
    it('should return top successful patterns', async () => {
      const query = { agentType: AgentType.PLAN, limit: 5 };
      const expected = [{ taskType: 'LEVEL_2', successRate: 100 }];
      mockMemoryService.getTopPatterns.mockResolvedValue(expected as any);

      const result = await controller.getSuccessfulPatterns(query as any);

      expect(mockMemoryService.getTopPatterns).toHaveBeenCalledWith(
        AgentType.PLAN,
        true,
        5,
      );
      expect(result).toEqual(expected);
    });

    it('should default limit to 10 when not provided', async () => {
      mockMemoryService.getTopPatterns.mockResolvedValue([]);

      await controller.getSuccessfulPatterns({} as any);

      expect(mockMemoryService.getTopPatterns).toHaveBeenCalledWith(
        undefined,
        true,
        10,
      );
    });
  });

  // ─── GET /memories/patterns/failed ─────────────────────────────────────

  describe('GET /memories/patterns/failed', () => {
    it('should return top failed patterns', async () => {
      const query = { agentType: AgentType.CODE, limit: 3 };
      const expected = [{ taskType: 'LEVEL_1', successRate: 0 }];
      mockMemoryService.getTopPatterns.mockResolvedValue(expected as any);

      const result = await controller.getFailedPatterns(query as any);

      expect(mockMemoryService.getTopPatterns).toHaveBeenCalledWith(
        AgentType.CODE,
        false,
        3,
      );
      expect(result).toEqual(expected);
    });
  });

  // ─── GET /memories/summary ─────────────────────────────────────────────

  describe('GET /memories/summary', () => {
    it('should return summary without agentType filter', async () => {
      const expected = { totalMemories: 10, byAgentType: { ROUTER: 4 } };
      mockMemoryService.getSummary.mockResolvedValue(expected as any);

      const result = await controller.getSummary(undefined);

      expect(mockMemoryService.getSummary).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expected);
    });

    it('should return summary filtered by agentType', async () => {
      mockMemoryService.getSummary.mockResolvedValue({} as any);

      await controller.getSummary(AgentType.ROUTER);

      expect(mockMemoryService.getSummary).toHaveBeenCalledWith(AgentType.ROUTER);
    });
  });

  // ─── POST /memories/from-execution/:executionId ────────────────────────

  describe('POST /memories/from-execution/:executionId', () => {
    it('should create memories from execution', async () => {
      const expected = [{ id: 'mem-1' }];
      mockMemoryService.createFromExecution.mockResolvedValue(expected as any);

      const result = await controller.createFromExecution('EXEC-001');

      expect(mockMemoryService.createFromExecution).toHaveBeenCalledWith('EXEC-001');
      expect(result).toEqual(expected);
    });
  });
});

// ─── GET /memories/agent-context (HTTP-level tests with supertest) ────

describe('GET /agent-context', () => {
  let app: INestApplication;
  let service: jest.Mocked<MemoryService>;

  const mockService = {
    createMemory: jest.fn(),
    createFromExecution: jest.fn(),
    querySimilar: jest.fn(),
    getTopPatterns: jest.fn(),
    getSummary: jest.fn(),
    decayAll: jest.fn(),
    cleanupStale: jest.fn(),
  };

  beforeAll(async () => {
    process.env.AGENT_API_KEY = 'agent-dev-key';
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [
        { provide: MemoryService, useValue: mockService },
        { provide: ContextManagerService, useValue: { assemble: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    app = module.createNestApplication();
    await app.init();
    service = module.get(MemoryService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns markdown when data exists (200)', async () => {
    mockService.getSummary.mockResolvedValue({
      totalMemories: 5,
      byAgentType: { CODE: 3, PLAN: 2 },
      activeMemories: 4,
      staleMemories: 0,
      perDomainBreakdown: [],
    });
    mockService.getTopPatterns
      .mockResolvedValueOnce([
        {
          taskType: 'BUG_FIX',
          domain: null,
          totalCount: 5,
          successCount: 4,
          successRate: 80,
        },
      ])
      .mockResolvedValueOnce([]);
    mockService.querySimilar.mockResolvedValue([
      {
        memory: {
          id: 'm1',
          taskType: 'BUG_FIX',
          agentType: 'CODE',
        } as any,
        similarity: 0.9,
        outcomeWeight: 1,
        applicabilityScore: 0.85,
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/memories/agent-context')
      .query({ agentType: 'CODE' })
      .set('x-agent-api-key', 'agent-dev-key')
      .expect(200);

    expect(res.text).toContain('Agent Memory Context');
    expect(res.text).toContain('Total memories: 5');
    expect(res.text).toContain('Top Successful Patterns');
    expect(res.text).toContain('Similar Past Executions');
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('returns fallback when no memories (200 with "No memory data")', async () => {
    mockService.getSummary.mockResolvedValue({
      totalMemories: 0,
      byAgentType: {},
      activeMemories: 0,
      staleMemories: 0,
      perDomainBreakdown: [],
    });
    mockService.getTopPatterns.mockResolvedValue([]);
    mockService.querySimilar.mockResolvedValue([]);

    const res = await request(app.getHttpServer())
      .get('/memories/agent-context')
      .set('x-agent-api-key', 'agent-dev-key')
      .expect(200);

    expect(res.text).toContain('No memory data available');
  });

  it('returns 401 when API key invalid', async () => {
    const res = await request(app.getHttpServer())
      .get('/memories/agent-context')
      .set('x-agent-api-key', 'wrong-key')
      .expect(401);

    expect(res.body.message).toContain('Invalid or missing agent API key');
  });

  it('returns 401 when API key missing', async () => {
    const res = await request(app.getHttpServer())
      .get('/memories/agent-context')
      .expect(401);

    expect(res.body.message).toContain('Invalid or missing agent API key');
  });
});
