/* @lifecycle ACTIVE — Fallback chain resolution service (ADR-010) */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ResolvedModel, FallbackStep, ModelTier } from '../interfaces/model-registry.interface';

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);
  private readonly maxHops = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the fallback chain for a given primary model.
   * Returns an ordered array of fallback steps (max 3 hops).
   * Validates no cycles: a model cannot appear twice in the same chain.
   * Throws NotFoundException if no fallback chain exists for the model.
   */
  async resolveFallbackChain(modelId: string): Promise<FallbackStep[]> {
    // Verify the primary model exists
    const primaryModel = await this.prisma.modelRegistry.findUnique({
      where: { modelId },
    });
    if (!primaryModel) {
      throw new NotFoundException(
        `Model with modelId "${modelId}" not found`,
      );
    }

    // Query active fallback chains for this primary model
    const chains = await this.prisma.fallbackChain.findMany({
      where: {
        primaryModelId: modelId,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
      include: {
        fallbackModel: {
          include: { provider: true },
        },
      },
    });

    if (chains.length === 0) {
      throw new NotFoundException(
        `No active fallback chain found for model "${modelId}"`,
      );
    }

    // Build fallback steps with cycle detection
    const steps: FallbackStep[] = [];
    const visited = new Set<string>([modelId]); // Track visited models to detect cycles

    for (const chain of chains) {
      if (steps.length >= this.maxHops) {
        this.logger.warn(
          `Max fallback hops (${this.maxHops}) reached for model "${modelId}"; remaining chains skipped`,
        );
        break;
      }

      const fallbackModelId = chain.fallbackModel.modelId;

      // Cycle detection: if we've already seen this model, skip it
      if (visited.has(fallbackModelId)) {
        this.logger.warn(
          `Cycle detected in fallback chain for model "${modelId}": "${fallbackModelId}" already visited. Skipping chain "${chain.chainId}".`,
        );
        continue;
      }

      // Skip inactive fallback models
      if (!chain.fallbackModel.isActive) {
        this.logger.warn(
          `Fallback model "${fallbackModelId}" is inactive; skipping chain "${chain.chainId}".`,
        );
        continue;
      }

      visited.add(fallbackModelId);

      const resolved: ResolvedModel = {
        modelId: chain.fallbackModel.modelId,
        displayName: chain.fallbackModel.displayName,
        providerId: chain.fallbackModel.providerId,
        tier: chain.fallbackModel.tier as unknown as ModelTier,
      };

      steps.push({
        chainId: chain.chainId,
        model: resolved,
        priority: chain.priority,
        triggerOnHttpCode: chain.triggerOnHttpCode,
        triggerOnTimeoutMs: chain.triggerOnTimeoutMs,
        maxRetries: chain.maxRetries,
      });
    }

    if (steps.length === 0) {
      throw new NotFoundException(
        `No valid fallback steps found for model "${modelId}" after cycle/activity validation`,
      );
    }

    this.logger.debug(
      `Resolved ${steps.length} fallback step(s) for model "${modelId}"`,
    );

    return steps;
  }

  /**
   * List all fallback chains with optional filters.
   */
  async getFallbackChains(filters?: { primaryModelId?: string; isActive?: boolean }) {
    const where: Prisma.FallbackChainWhereInput = {};

    if (filters?.primaryModelId) {
      where.primaryModelId = filters.primaryModelId;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.fallbackChain.findMany({
      where,
      orderBy: [{ primaryModelId: 'asc' }, { priority: 'asc' }],
      include: {
        primaryModel: true,
        fallbackModel: true,
      },
    });
  }

  /**
   * Create a new fallback chain entry.
   */
  async createFallbackChain(dto: import('../dto/create-fallback-chain.dto').CreateFallbackChainDto) {
    // Verify both models exist
    const [primary, fallback] = await Promise.all([
      this.prisma.modelRegistry.findUnique({ where: { modelId: dto.primaryModelId } }),
      this.prisma.modelRegistry.findUnique({ where: { modelId: dto.fallbackModelId } }),
    ]);

    if (!primary) {
      throw new NotFoundException(
        `Primary model with modelId "${dto.primaryModelId}" not found`,
      );
    }
    if (!fallback) {
      throw new NotFoundException(
        `Fallback model with modelId "${dto.fallbackModelId}" not found`,
      );
    }

    // Validate no self-referencing fallback
    if (dto.primaryModelId === dto.fallbackModelId) {
      throw new Error('A model cannot fall back to itself');
    }

    return this.prisma.fallbackChain.create({
      data: {
        chainId: dto.chainId,
        primaryModelId: dto.primaryModelId,
        fallbackModelId: dto.fallbackModelId,
        priority: dto.priority ?? 1,
        triggerOnHttpCode: dto.triggerOnHttpCode ?? null,
        triggerOnTimeoutMs: dto.triggerOnTimeoutMs ?? null,
        maxRetries: dto.maxRetries ?? 1,
        isActive: dto.isActive ?? true,
      },
      include: {
        primaryModel: true,
        fallbackModel: true,
      },
    });
  }
}
