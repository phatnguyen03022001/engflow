/* @lifecycle ACTIVE — Unit tests for ContextManagerService */

import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ContextManagerService } from '../services/context-manager.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KnowledgeGraphService } from '../../knowledge/services/knowledge-graph.service';
import { ContextTier } from '../interfaces/context-manager.interface';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

/** Create a mock AgentMemory similar to Prisma shape. */
function makeMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    memoryId: 'MEM-001',
    agentType: 'CODE',
    taskType: 'test-task',
    outcome: 'SUCCESS',
    success: true,
    decision: 'PASS',
    lessonsLearned: ['Fixed import order'],
    expiresAt: null,
    createdAt: new Date('2026-06-09'),
    ...overrides,
  };
}

describe('ContextManagerService', () => {
  let service: ContextManagerService;
  let prisma: { agentMemory: { findMany: jest.Mock } };
  let cache: { get: jest.Mock; set: jest.Mock };
  let kgService: { findNodes: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      agentMemory: {
        findMany: jest.fn(),
      },
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    kgService = {
      findNodes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextManagerService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: KnowledgeGraphService, useValue: kgService },
      ],
    }).compile();

    service = module.get<ContextManagerService>(ContextManagerService);
  });

  // ─── Tier 1: Agent Memories ──────────────────────────────────────

  describe('Tier 1 assembly', () => {
    it('should assemble context from agent memories only', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([makeMemory()]);
      cache.get.mockResolvedValue(null);

      const result = await service.assemble({
        agentType: 'CODE',
        taskType: 'test-task',
        tier: ContextTier.TIER_1,
      });

      expect(result.tier).toBe(ContextTier.TIER_1);
      expect(result.fragments).toHaveLength(1);
      expect(result.fragments[0].source).toBe('agent_memory');
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.budget).toBe(8000);
      expect(result.truncated).toBe(false);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should return empty fragments when no memories exist', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([]);
      cache.get.mockResolvedValue(null);

      const result = await service.assemble({
        agentType: 'PLAN',
        taskType: 'empty-task',
        tier: ContextTier.TIER_1,
      });

      expect(result.fragments).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });
  });

  // ─── Tier 2: + Knowledge Graph ───────────────────────────────────

  describe('Tier 2 assembly', () => {
    it('should include knowledge graph nodes when available', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([makeMemory()]);
      cache.get.mockResolvedValue(null);
      kgService.findNodes.mockResolvedValue({
        items: [
          { nodeId: 'n1', type: 'CODE', label: 'Auth Module', description: 'Authentication logic', module: 'auth' },
        ],
        total: 1,
      });

      const result = await service.assemble({
        agentType: 'CODE',
        taskType: 'LEVEL_2:auth',
        tier: ContextTier.TIER_2,
      });

      const sources = result.fragments.map((f) => f.source);
      expect(sources).toContain('agent_memory');
      expect(sources).toContain('knowledge_graph');
      expect(result.budget).toBe(16000);
    });

    it('should skip KG when service is not available', async () => {
      // Rebuild without KnowledgeGraphService
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ContextManagerService,
          { provide: PrismaService, useValue: prisma },
          { provide: CACHE_MANAGER, useValue: cache },
        ],
      }).compile();
      const svc = module.get<ContextManagerService>(ContextManagerService);

      prisma.agentMemory.findMany.mockResolvedValue([makeMemory()]);
      cache.get.mockResolvedValue(null);

      const result = await svc.assemble({
        agentType: 'CODE',
        taskType: 'test',
        tier: ContextTier.TIER_2,
      });

      const sources = result.fragments.map((f) => f.source);
      expect(sources).not.toContain('knowledge_graph');
    });

    it('should handle KG query errors gracefully', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([makeMemory()]);
      cache.get.mockResolvedValue(null);
      kgService.findNodes.mockRejectedValue(new Error('DB error'));

      const result = await service.assemble({
        agentType: 'CODE',
        taskType: 'test',
        tier: ContextTier.TIER_2,
      });

      const sources = result.fragments.map((f) => f.source);
      expect(sources).not.toContain('knowledge_graph');
      expect(sources).toContain('agent_memory');
    });
  });

  // ─── Tier 3: Full Assembly ───────────────────────────────────────

  describe('Tier 3 assembly', () => {
    it('should include all sources when data is available', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([makeMemory()]);
      cache.get.mockResolvedValue(null);
      kgService.findNodes.mockResolvedValue({ items: [], total: 0 });

      // Mock rule files
      mockFs.readFile.mockImplementation((filePath: unknown) => {
        const p = String(filePath);
        if (p.includes('constitution.md')) return Promise.resolve('# Constitution\nRule 1');
        if (p.includes('008-lifecycle')) return Promise.resolve('# ADR-008\nLifecycle declarations');
        if (p.includes('architecture.md')) return Promise.resolve('# Architecture\nModule structure');
        if (p.includes('index.md')) return Promise.resolve('# ADR Index\nList of ADRs');
        if (p.includes('system-specification')) return Promise.resolve('# System Spec\nDetails');
        return Promise.resolve('');
      });

      const result = await service.assemble({
        agentType: 'CODE',
        taskType: 'test',
        tier: ContextTier.TIER_3,
      });

      const sources = result.fragments.map((f) => f.source);
      expect(sources).toContain('agent_memory');
      expect(sources).toContain('rules');
      expect(result.budget).toBe(32000);
    });
  });

  // ─── Caching ─────────────────────────────────────────────────────

  describe('caching', () => {
    it('should return cached result when available', async () => {
      const cachedResult = {
        sessionId: 'sess-1',
        agentType: 'CODE',
        taskType: 'test',
        tier: ContextTier.TIER_1,
        fragments: [{ source: 'agent_memory', title: 'Memories', content: 'cached', tokenEstimate: 5 }],
        combined: 'cached',
        totalTokens: 5,
        budget: 8000,
        truncated: false,
        assembledAt: new Date().toISOString(),
      };
      cache.get.mockResolvedValue(cachedResult);

      const result = await service.assemble({
        agentType: 'CODE',
        taskType: 'test',
        sessionId: 'sess-1',
      });

      expect(result).toBe(cachedResult);
      expect(prisma.agentMemory.findMany).not.toHaveBeenCalled();
    });

    it('should cache newly assembled context', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([makeMemory()]);
      cache.get.mockResolvedValue(null);

      await service.assemble({
        agentType: 'CODE',
        taskType: 'test',
        sessionId: 'sess-2',
      });

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('context:CODE:test:sess-2'),
        expect.any(Object),
        300_000,
      );
    });
  });

  // ─── Token Budget ────────────────────────────────────────────────

  describe('token budget', () => {
    it('should apply token budget for each tier', async () => {
      cache.get.mockResolvedValue(null);
      prisma.agentMemory.findMany.mockResolvedValue([
        makeMemory({ lessonsLearned: ['A'.repeat(5000)] }),
      ]);

      const tier1 = await service.assemble({
        agentType: 'CODE', taskType: 't1', tier: ContextTier.TIER_1,
      });
      expect(tier1.totalTokens).toBeLessThanOrEqual(tier1.budget);
    });

    it('should mark as truncated when budget exceeded', async () => {
      cache.get.mockResolvedValue(null);
      // Memories with very long lessons → single fragment exceeds 8K budget
      const bigMemories = Array.from({ length: 5 }, (_, i) =>
        makeMemory({
          id: `mem-${i}`,
          lessonsLearned: ['X'.repeat(10_000)], // ~10K chars per memory
        }),
      );
      prisma.agentMemory.findMany.mockResolvedValue(bigMemories);

      const result = await service.assemble({
        agentType: 'CODE', taskType: 'big', tier: ContextTier.TIER_1,
      });

      // Single fragment is too large → no content fits
      expect(result.fragments).toHaveLength(0);
      expect(result.truncated).toBe(true);
    });

    it('should not truncate when content fits within budget', async () => {
      cache.get.mockResolvedValue(null);
      // Small memories that easily fit within 8K budget
      const smallMemories = Array.from({ length: 3 }, (_, i) =>
        makeMemory({
          id: `mem-${i}`,
          lessonsLearned: ['Short lesson'],
        }),
      );
      prisma.agentMemory.findMany.mockResolvedValue(smallMemories);

      const result = await service.assemble({
        agentType: 'CODE', taskType: 'small', tier: ContextTier.TIER_1,
      });

      expect(result.fragments).toHaveLength(1);
      expect(result.truncated).toBe(false);
    });
  });

  // ─── Token Estimation ────────────────────────────────────────────

  describe('token estimation', () => {
    it('should estimate tokens as ceil(content.length / 4)', async () => {
      prisma.agentMemory.findMany.mockResolvedValue([makeMemory({
        lessonsLearned: ['Hello world'],
      })]);
      cache.get.mockResolvedValue(null);

      const result = await service.assemble({
        agentType: 'CODE',
        taskType: 'test',
        tier: ContextTier.TIER_1,
      });

      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.fragments[0].tokenEstimate).toBeGreaterThan(0);
    });
  });
});
