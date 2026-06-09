// @deprecated — Use MemoryService instead. TASK-029 dual-writes to AgentMemory.
// This service creates both AgentMemory (canonical) and DecisionMemory (compat).

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MemoryService } from '../../memory/services/memory.service';

@Injectable()
export class DecisionMemoryService {
  private readonly logger = new Logger(DecisionMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryService: MemoryService,
  ) {}

  /**
   * Create decision memory from an assessed recommendation.
   */
  async createFromAssessment(recommendationId: string) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }
    if (recommendation.trackingStatus !== 'ASSESSED') {
      throw new Error(
        `Recommendation ${recommendationId} is not ASSESSED (status: ${recommendation.trackingStatus})`,
      );
    }
    if (!recommendation.finalOutcome) {
      throw new Error(
        `Recommendation ${recommendationId} has no final outcome`,
      );
    }

    // Skip ABANDONED outcomes — they don't provide learning signal
    if (recommendation.finalOutcome === 'ABANDONED') {
      return null;
    }

    const memoryId = this.generateMemoryId();

    // Default context factors
    const contextFactors = {
      domain: recommendation.decisionDomain,
      decisionType: recommendation.decisionType,
      confidenceLevel: recommendation.confidenceLevel,
      confidenceScore: recommendation.confidenceScore,
      recommendedOption: recommendation.recommendedOption,
    };

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 2); // 2-year expiry

    // Dual-write: canonical AgentMemory (via MemoryService)
    const outcomeMap: Record<string, 'SUCCESS' | 'FAILURE' | 'MIXED' | 'BLOCKED' | 'ABANDONED'> = {
      SUCCESS: 'SUCCESS',
      MIXED: 'MIXED',
      FAILURE: 'FAILURE',
      ABANDONED: 'ABANDONED',
    };

    try {
      const memOutcome = outcomeMap[recommendation.finalOutcome] ?? 'FAILURE';
      await this.memoryService.createMemory({
        agentType: 'PLAN' as any,
        taskType: 'RECOMMENDATION_ASSESSMENT',
        outcome: memOutcome as any,
        success: recommendation.finalOutcome === 'SUCCESS',
        decision: recommendation.recommendedOption,
        context: contextFactors as Record<string, unknown>,
        domain: recommendation.decisionDomain,
        technology: recommendation.recommendedOption,
        projectId: recommendation.projectId ?? '__global__',
        sourceExecutionId: recommendation.id,
        lessonsLearned: [],
      });
    } catch (error) {
      this.logger.warn(`AgentMemory creation failed (non-blocking): ${(error as Error).message}`);
    }

    // Legacy DecisionMemory write (deprecated)
    const memory = await this.prisma.decisionMemory.upsert({
      where: {
        domain_technology_projectId: {
          domain: recommendation.decisionDomain,
          technology: recommendation.recommendedOption,
          projectId: recommendation.projectId ?? '__global__',
        },
      },
      update: {
        outcome: recommendation.finalOutcome,
        solutionScore: null,
        contextFactors: contextFactors as Prisma.InputJsonValue,
        referenceCount: { increment: 1 },
        lastReferencedAt: new Date(),
        expiresAt,
      },
      create: {
        memoryId,
        domain: recommendation.decisionDomain,
        technology: recommendation.recommendedOption,
        projectId: recommendation.projectId ?? '__global__',
        recommendationId: recommendation.id,
        outcome: recommendation.finalOutcome,
        contextFactors: contextFactors as Prisma.InputJsonValue,
        referenceCount: 1,
        lastReferencedAt: new Date(),
        expiresAt,
      },
    });

    return memory;
  }

  /**
   * Query decision memory by domain.
   */
  async findByDomain(domain: string) {
    return this.prisma.decisionMemory.findMany({
      where: { domain },
      orderBy: [{ decayWeight: 'desc' }, { referenceCount: 'desc' }],
    });
  }

  /**
   * Query decision memory with applicability scoring.
   *
   * APPLICABILITY = SIMILARITY × OUTCOME_WEIGHT × DECAY_WEIGHT
   */
  async queryWithApplicability(
    domain: string,
    context: {
      techStack?: string;
      scale?: string;
      teamSize?: string;
      timeline?: string;
      projectId?: string;
    },
  ) {
    const memories = await this.prisma.decisionMemory.findMany({
      where: { domain },
    });

    type DecisionMemoryResult = { id: string; projectId: string; outcome: string; decayWeight: number; contextFactors: unknown };
    const scored = memories.map((memory: DecisionMemoryResult) => {
      const contextFactors =
        (memory.contextFactors as Record<string, string>) ?? {};

      let similarity = 0.15; // Same-domain baseline

      if (
        context.techStack &&
        contextFactors['techStack'] === context.techStack
      ) {
        similarity += 0.3;
      }
      if (context.scale && contextFactors['scale'] === context.scale) {
        similarity += 0.2;
      }
      if (
        context.projectId &&
        memory.projectId === context.projectId
      ) {
        similarity += 0.15;
      }
      if (
        context.teamSize &&
        contextFactors['teamSize'] === context.teamSize
      ) {
        similarity += 0.1;
      }
      if (
        context.timeline &&
        contextFactors['timeline'] === context.timeline
      ) {
        similarity += 0.1;
      }

      const outcomeWeight =
        memory.outcome === 'SUCCESS' ? 1.0
          : memory.outcome === 'MIXED' ? 0.5
          : 0.2;

      // Decay weight is stored in the database
      const applicabilityScore = similarity * outcomeWeight * memory.decayWeight;

      return {
        ...memory,
        similarity,
        outcomeWeight,
        applicabilityScore: Math.round(applicabilityScore * 100) / 100,
      };
    });

    // Sort by applicability score descending
    scored.sort((a: { applicabilityScore: number }, b: { applicabilityScore: number }) => b.applicabilityScore - a.applicabilityScore);

    return scored;
  }

  /**
   * Get all distinct domains with memory count.
   */
  async getDomainSummary() {
    const domains = await this.prisma.decisionMemory.groupBy({
      by: ['domain'],
      _count: true,
      _max: { createdAt: true },
    });

    const total = await this.prisma.decisionMemory.count();
    const stale = await this.prisma.decisionMemory.count({
      where: { expiresAt: { lte: new Date() } },
    });
    const active = await this.prisma.decisionMemory.count({
      where: { lastReferencedAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
    });

    return {
      totalMemories: total,
      domainsCovered: domains.length,
      activeMemories: active,
      staleMemories: stale,
      domains: domains.map((d: { domain: string; _count: number; _max: { createdAt: Date | null } }) => ({
        domain: d.domain,
        count: d._count,
        lastUpdated: d._max.createdAt,
      })),
    };
  }

  /**
   * Decay weights for all memories (daily cron).
   * decay_weight *= e^(-ln(2)/12)
   */
  async decayAll() {
    const decayFactor = Math.exp(-Math.LN2 / 12); // Monthly decay factor

    await this.prisma.decisionMemory.updateMany({
      data: {
        decayWeight: {
          multiply: decayFactor,
        },
      },
    });

    // Prune memories with weight < 0.1 and age > 24 months
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - 2);

    await this.prisma.decisionMemory.deleteMany({
      where: {
        decayWeight: { lt: 0.1 },
        createdAt: { lte: threshold },
      },
    });

    this.logger.log('Decision memory decay applied and stale entries pruned');
  }

  private generateMemoryId(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 8);
    const hash = Math.random().toString(36).substring(2, 8);
    return `MEM-${timestamp}-${hash}`;
  }
}
