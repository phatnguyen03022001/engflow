/* @lifecycle ACTIVE — Canonical memory service for all agent types (TASK-029) */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, $Enums } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateMemoryDto } from '../dto/create-memory.dto';
import {
  AgentType,
  MemoryOutcome,
  AgentMemoryEntry,
  MemoryQueryResult,
  PatternSummary,
  MemorySummary,
} from '../interfaces/agent-memory.interface';
import { MEMORY_SCORING_WEIGHTS } from '../interfaces/scoring-weights.constant';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a single AgentMemory entry.
   * Uses upsert on @@unique([sourceExecutionId, agentType]) if sourceExecutionId is present,
   * otherwise creates a new record.
   */
  async createMemory(dto: CreateMemoryDto): Promise<AgentMemoryEntry> {
    const memoryId = this.generateMemoryId();
    const context = (dto.context as Prisma.InputJsonValue) ?? undefined;

    if (dto.sourceExecutionId) {
      const existing = await this.prisma.agentMemory.findFirst({
        where: {
          sourceExecutionId: dto.sourceExecutionId,
          agentType: dto.agentType as unknown as $Enums.AgentType,
        },
      });

      if (existing) {
        return this.prisma.agentMemory.update({
          where: { id: existing.id },
          data: {
            outcome: dto.outcome as unknown as $Enums.MemoryOutcome,
            success: dto.success,
            confidence: dto.confidence ?? undefined,
            decision: dto.decision ?? null,
            context: context ?? undefined,
            lessonsLearned: dto.lessonsLearned ?? [],
            referenceCount: { increment: 1 },
            lastReferencedAt: new Date(),
          },
        }) as unknown as AgentMemoryEntry;
      }
    }

    return this.prisma.agentMemory.create({
      data: {
        memoryId,
        agentType: dto.agentType as unknown as $Enums.AgentType,
        taskType: dto.taskType,
        outcome: dto.outcome as unknown as $Enums.MemoryOutcome,
        success: dto.success,
        confidence: dto.confidence ?? undefined,
        decision: dto.decision ?? null,
        context: context ?? undefined,
        lessonsLearned: dto.lessonsLearned ?? [],
        domain: dto.domain ?? null,
        technology: dto.technology ?? null,
        projectId: dto.projectId ?? '__global__',
        sourceExecutionId: dto.sourceExecutionId ?? null,
        sourcePhaseId: dto.sourcePhaseId ?? null,
      },
    }) as unknown as AgentMemoryEntry;
  }

  /**
   * Create AgentMemory entries from an execution trace.
   * Reads AgentExecution + phases and creates 1 AgentMemory per agent type present.
   */
  async createFromExecution(executionId: string): Promise<AgentMemoryEntry[]> {
    const execution = await this.prisma.agentExecution.findUnique({
      where: { executionId },
      include: { phases: true },
    });

    if (!execution) {
      throw new NotFoundException(
        `Execution with executionId "${executionId}" not found`,
      );
    }

    // Map execution FinalOutcome to MemoryOutcome
    const outcomeMap: Record<string, MemoryOutcome> = {
      COMMITTED: MemoryOutcome.SUCCESS,
      BLOCKED: MemoryOutcome.BLOCKED,
      FAILED: MemoryOutcome.FAILURE,
      ABANDONED: MemoryOutcome.ABANDONED,
    };

    // Derive MIXED from retry or flag patterns
    const isMixed =
      execution.finalOutcome === 'COMMITTED' &&
      (execution.retryCount > 0 ||
        execution.preVerifyDecision === 'FLAG' ||
        execution.postVerifyDecision === 'FLAG');

    const executionOutcome = outcomeMap[execution.finalOutcome] ?? MemoryOutcome.ABANDONED;
    const effectiveOutcome = isMixed ? MemoryOutcome.MIXED : executionOutcome;

    // Group phases by agentType to create one memory per agent
    const phasesByAgent = new Map<string, typeof execution.phases>();
    for (const phase of execution.phases) {
      const existing = phasesByAgent.get(phase.agentType) ?? [];
      existing.push(phase);
      phasesByAgent.set(phase.agentType, existing);
    }

    const createdMemories: AgentMemoryEntry[] = [];

    for (const [agentTypeStr, phases] of phasesByAgent) {
      const agentType = agentTypeStr as AgentType;
      const lastPhase = phases[phases.length - 1];
      const lessons = this.deriveLessons(agentTypeStr, execution, phases);

      // Derive per-agent success
      let agentSuccess: boolean;
      let agentOutcome: MemoryOutcome;

      if (execution.finalOutcome === 'COMMITTED') {
        agentSuccess = true;
        agentOutcome = effectiveOutcome;
      } else if (execution.finalOutcome === 'BLOCKED') {
        // Agent succeeded if it didn't produce the block
        const blockProducedByAgent =
          lastPhase?.decision === 'BLOCK' ||
          (agentTypeStr === 'PRE_VERIFY' && execution.preVerifyDecision === 'BLOCK') ||
          (agentTypeStr === 'ARCHITECT' && execution.archRevisionNeeded === false && lastPhase?.decision === 'BLOCK');
        agentSuccess = !blockProducedByAgent;
        agentOutcome = MemoryOutcome.BLOCKED;
      } else {
        agentSuccess = false;
        agentOutcome = MemoryOutcome.FAILURE;
      }

      const memory =       await this.prisma.agentMemory.create({
        data: {
          memoryId: this.generateMemoryId(),
          agentType: agentType as unknown as $Enums.AgentType,
          taskType: execution.routerRoute ?? 'UNKNOWN',
          context: {
            requestSummary: execution.requestSummary,
            routerRoute: execution.routerRoute,
            routerConfidence: execution.routerConfidence,
          } as Prisma.InputJsonValue,
          decision: lastPhase?.decision ?? null,
          outcome: agentOutcome as unknown as $Enums.MemoryOutcome,
          success: agentSuccess,
          lessonsLearned: lessons,
          sourceExecutionId: execution.executionId,
          sourcePhaseId: lastPhase?.phaseId ?? null,
          domain: null,
          technology: null,
          projectId: '__global__',
          referenceCount: 1,
          decayWeight: 1.0,
        },
      }) as unknown as AgentMemoryEntry;

      createdMemories.push(memory);
    }

    return createdMemories;
  }

  /**
   * Query similar memories based on filters with applicability scoring.
   * APPLICABILITY = SIMILARITY × OUTCOME_WEIGHT × DECAY_WEIGHT
   */
  async querySimilar(params: {
    agentType?: AgentType;
    taskType?: string;
    domain?: string;
    success?: boolean;
    contextJson?: string;
    minConfidence?: number;
  }): Promise<MemoryQueryResult[]> {
    const where: Prisma.AgentMemoryWhereInput = {};

    if (params.agentType) {
      where.agentType = params.agentType as unknown as $Enums.AgentType;
    }
    if (params.taskType) {
      where.taskType = params.taskType;
    }
    if (params.domain) {
      where.domain = params.domain;
    }
    if (params.success !== undefined) {
      where.success = params.success;
    }
    if (params.minConfidence !== undefined) {
      where.confidence = { gte: params.minConfidence };
    }

    const memories = await this.prisma.agentMemory.findMany({ where });

    let queryContext: Record<string, string> = {};
    if (params.contextJson) {
      try {
        queryContext = JSON.parse(params.contextJson);
      } catch {
        // Invalid JSON, ignore
      }
    }

    const scored: MemoryQueryResult[] = memories.map((memory) => {
      const memoryContext = (memory.context as Record<string, string>) ?? {};

      let similarity = MEMORY_SCORING_WEIGHTS.baseline;

      // agentType match
      if (params.agentType && memory.agentType === params.agentType) {
        similarity += MEMORY_SCORING_WEIGHTS.agentType;
      }

      // taskType match
      if (params.taskType && memory.taskType === params.taskType) {
        similarity += MEMORY_SCORING_WEIGHTS.taskType;
      }

      // domain match
      if (params.domain && memory.domain === params.domain) {
        similarity += MEMORY_SCORING_WEIGHTS.domain;
      }

      // context field matches
      if (Object.keys(queryContext).length > 0) {
        const matchCount = Object.keys(queryContext).filter(
          (key) => memoryContext[key] === queryContext[key],
        ).length;
        if (matchCount > 0) {
          similarity += MEMORY_SCORING_WEIGHTS.exactContextMatch * (matchCount / Object.keys(queryContext).length);
        }
      }

      const outcomeWeight =
        memory.outcome === 'SUCCESS' ? 1.0
          : memory.outcome === 'MIXED' ? 0.5
          : memory.outcome === 'BLOCKED' ? 0.1
          : 0.2;

      const applicabilityScore = similarity * outcomeWeight * memory.decayWeight;

      return {
        memory: memory as unknown as AgentMemoryEntry,
        similarity: Math.round(similarity * 100) / 100,
        outcomeWeight,
        applicabilityScore: Math.round(applicabilityScore * 100) / 100,
      };
    });

    scored.sort((a, b) => b.applicabilityScore - a.applicabilityScore);
    return scored;
  }

  /**
   * Get top patterns by success rate, grouped by (taskType, domain).
   */
  async getTopPatterns(
    agentType?: AgentType,
    success?: boolean,
    limit: number = 10,
    taskTypeFilter?: string,
  ): Promise<PatternSummary[]> {
    const where: Prisma.AgentMemoryWhereInput = {};

    if (agentType) {
      where.agentType = agentType as unknown as $Enums.AgentType;
    }
    if (taskTypeFilter) {
      where.taskType = taskTypeFilter;
    }

    const memories = await this.prisma.agentMemory.findMany({ where });

    // Group by (taskType, domain)
    const groups = new Map<string, { total: number; successCount: number }>();

    for (const memory of memories) {
      const key = `${memory.taskType}::${memory.domain ?? '__null__'}`;
      const existing = groups.get(key) ?? { total: 0, successCount: 0 };
      existing.total++;
      if (memory.success) {
        existing.successCount++;
      }
      groups.set(key, existing);
    }

    const patterns: PatternSummary[] = Array.from(groups.entries()).map(
      ([key, data]) => {
        const [taskType, domainRaw] = key.split('::');
        const domain = domainRaw === '__null__' ? null : domainRaw;
        return {
          taskType,
          domain,
          totalCount: data.total,
          successCount: data.successCount,
          successRate:
            data.total > 0
              ? Math.round((data.successCount / data.total) * 10000) / 100
              : 0,
        };
      },
    );

    // Sort by success rate
    if (success === true) {
      patterns.sort((a, b) => b.successRate - a.successRate);
    } else if (success === false) {
      patterns.sort((a, b) => a.successRate - b.successRate);
    }

    return patterns.slice(0, limit);
  }

  /**
   * Get aggregate memory summary.
   */
  async getSummary(agentType?: AgentType): Promise<MemorySummary> {
    const where: Prisma.AgentMemoryWhereInput = {};
    if (agentType) {
      where.agentType = agentType as unknown as $Enums.AgentType;
    }

    const totalMemories = await this.prisma.agentMemory.count({ where });
    const activeMemories = await this.prisma.agentMemory.count({
      where: {
        ...where,
        lastReferencedAt: {
          gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        },
      },
    });
    const staleMemories = await this.prisma.agentMemory.count({
      where: {
        ...where,
        expiresAt: { lte: new Date() },
      },
    });

    // Count by agentType
    const grouped = await this.prisma.agentMemory.groupBy({
      by: ['agentType'],
      _count: { id: true },
      where,
    });

    const byAgentType: Record<string, number> = {};
    for (const group of grouped) {
      byAgentType[group.agentType] = group._count.id;
    }

    // Per-domain breakdown
    const domainGroups = await this.prisma.agentMemory.groupBy({
      by: ['domain'],
      _count: { id: true },
      _max: { createdAt: true },
      where: { ...where, domain: { not: null } },
    });

    const perDomainBreakdown = domainGroups.map((d) => ({
      domain: d.domain ?? '',
      count: d._count.id,
      lastUpdated: d._max.createdAt,
    }));

    return {
      totalMemories,
      byAgentType,
      activeMemories,
      staleMemories,
      perDomainBreakdown,
    };
  }

  /**
   * Decay weights for all memories (daily cron).
   * decayWeight *= e^(-ln(2)/12) — monthly half-life.
   */
  async decayAll(): Promise<void> {
    const decayFactor = Math.exp(-Math.LN2 / 12);

    await this.prisma.agentMemory.updateMany({
      data: {
        decayWeight: { multiply: decayFactor },
      },
    });

    this.logger.log('Agent memory decay applied');
  }

  /**
   * Clean up stale memories: delete where decayWeight < 0.1 AND createdAt < 2 years.
   */
  async cleanupStale(): Promise<number> {
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - 2);

    const result = await this.prisma.agentMemory.deleteMany({
      where: {
        decayWeight: { lt: 0.1 },
        createdAt: { lte: threshold },
      },
    });

    this.logger.log(`Cleaned up ${result.count} stale agent memory entries`);
    return result.count;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private generateMemoryId(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 8);
    const hash = Math.random().toString(36).substring(2, 8);
    return `MEM-${timestamp}-${hash}`;
  }

  private deriveLessons(
    agentType: string,
    execution: {
      requestSummary: string;
      routerRoute: string;
      preVerifyDecision: string | null;
      preVerifyFlags: unknown;
      retryCount: number;
      codeAttempts: number;
      postVerifyDecision: string | null;
      postVerifyIssues: unknown;
      archRevisionNeeded: boolean;
      finalOutcome: string;
    },
    phases: { decision: string | null }[],
  ): string[] {
    const lessons: string[] = [];

    switch (agentType) {
      case 'ROUTER':
        lessons.push(
          `Routed '${execution.requestSummary}' to ${execution.routerRoute}`,
        );
        break;
      case 'PRE_VERIFY':
        if (execution.preVerifyDecision === 'BLOCK') {
          const flags =
            (execution.preVerifyFlags as string[])?.join(', ') ?? '';
          lessons.push(`Pre-verify blocked: ${flags}`);
        } else if (execution.preVerifyDecision === 'FLAG') {
          const flags =
            (execution.preVerifyFlags as string[])?.join(', ') ?? '';
          lessons.push(`Pre-verify flagged: ${flags}`);
        }
        break;
      case 'CODE':
        if (execution.retryCount > 0) {
          lessons.push(
            `Code required ${execution.codeAttempts} attempts`,
          );
        }
        break;
      case 'POST_VERIFY':
        if (execution.postVerifyDecision === 'FAIL') {
          const issues =
            (execution.postVerifyIssues as string[])?.join(', ') ?? '';
          lessons.push(`Post-verify failed: ${issues}`);
        }
        break;
      case 'ARCHITECT':
        if (execution.archRevisionNeeded) {
          lessons.push('Architecture revision needed');
        }
        break;
    }

    if (lessons.length === 0) {
      const lastPhase = phases[phases.length - 1];
      lessons.push(
        `${agentType} phase completed with outcome ${lastPhase?.decision ?? execution.finalOutcome}`,
      );
    }

    return lessons;
  }
}
