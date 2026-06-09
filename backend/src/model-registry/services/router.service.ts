/* @lifecycle ACTIVE — Model route resolution service (ADR-010) */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ResolvedModel, ModelTier } from '../interfaces/model-registry.interface';

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the best model for a given (agentType, taskType) pair.
   * Queries ModelRoute where agentType and taskType match, isActive=true,
   * ordered by priority ASC. Returns the resolved primaryModel.
   * Throws NotFoundException if no matching route or model found.
   */
  async resolveRoute(agentType: string, taskType: string): Promise<ResolvedModel> {
    const route = await this.prisma.modelRoute.findFirst({
      where: {
        agentType,
        taskType,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
      include: {
        primaryModel: {
          include: { provider: true },
        },
      },
    });

    if (!route) {
      throw new NotFoundException(
        `No active route found for agentType="${agentType}" taskType="${taskType}"`,
      );
    }

    if (!route.primaryModel.isActive) {
      throw new NotFoundException(
        `Primary model "${route.primaryModelId}" for route "${route.routeId}" is not active`,
      );
    }

    this.logger.debug(
      `Resolved route: ${agentType}/${taskType} → ${route.primaryModelId} (priority ${route.priority})`,
    );

    return {
      modelId: route.primaryModel.modelId,
      displayName: route.primaryModel.displayName,
      providerId: route.primaryModel.providerId,
      tier: route.primaryModel.tier as unknown as ModelTier,
    };
  }

  /**
   * List all active routes with optional filters.
   */
  async getRoutes(filters?: { agentType?: string; taskType?: string }) {
    const where: Prisma.ModelRouteWhereInput = { isActive: true };

    if (filters?.agentType) {
      where.agentType = filters.agentType;
    }
    if (filters?.taskType) {
      where.taskType = filters.taskType;
    }

    return this.prisma.modelRoute.findMany({
      where,
      orderBy: [{ agentType: 'asc' }, { taskType: 'asc' }, { priority: 'asc' }],
      include: { primaryModel: true },
    });
  }

  /**
   * Create a new routing rule.
   */
  async createRoute(dto: import('../dto/create-route.dto').CreateRouteDto) {
    // Verify model exists
    const model = await this.prisma.modelRegistry.findUnique({
      where: { modelId: dto.primaryModelId },
    });
    if (!model) {
      throw new NotFoundException(
        `Model with modelId "${dto.primaryModelId}" not found`,
      );
    }

    return this.prisma.modelRoute.create({
      data: {
        routeId: dto.routeId,
        agentType: dto.agentType,
        taskType: dto.taskType,
        primaryModelId: dto.primaryModelId,
        priority: dto.priority ?? 0,
        maxCostUsd: dto.maxCostUsd ?? null,
        maxLatencyMs: dto.maxLatencyMs ?? null,
        isActive: dto.isActive ?? true,
      },
      include: { primaryModel: true },
    });
  }
}
