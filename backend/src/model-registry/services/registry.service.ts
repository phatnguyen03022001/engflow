/* @lifecycle ACTIVE — CRUD service for model providers and models (ADR-010) */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ModelCapability } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { CreateModelDto } from '../dto/create-model.dto';
import { ModelTier } from '../interfaces/model-registry.interface';

@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Providers ────────────────────────────────────────────────────────────

  async createProvider(dto: CreateProviderDto) {
    const existing = await this.prisma.modelProvider.findUnique({
      where: { providerId: dto.providerId },
    });
    if (existing) {
      throw new ConflictException(
        `Provider with providerId "${dto.providerId}" already exists`,
      );
    }

    return this.prisma.modelProvider.create({
      data: {
        providerId: dto.providerId,
        name: dto.name,
        apiBaseUrl: dto.apiBaseUrl,
        apiKeyEnv: dto.apiKeyEnv,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getProviders(includeInactive?: boolean) {
    const where: Prisma.ModelProviderWhereInput = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.modelProvider.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // ─── Models ───────────────────────────────────────────────────────────────

  async createModel(dto: CreateModelDto) {
    // Verify provider exists
    const provider = await this.prisma.modelProvider.findUnique({
      where: { providerId: dto.providerId },
    });
    if (!provider) {
      throw new NotFoundException(
        `Provider with providerId "${dto.providerId}" not found`,
      );
    }

    // Idempotency check
    const existing = await this.prisma.modelRegistry.findUnique({
      where: { modelId: dto.modelId },
    });
    if (existing) {
      throw new ConflictException(
        `Model with modelId "${dto.modelId}" already exists`,
      );
    }

    return this.prisma.modelRegistry.create({
      data: {
        modelId: dto.modelId,
        providerId: dto.providerId,
        displayName: dto.displayName,
        tier: dto.tier ?? 'STANDARD',
        capabilities: dto.capabilities ?? [],
        contextWindow: dto.contextWindow,
        maxOutputTokens: dto.maxOutputTokens ?? 4096,
        costPer1kInput: dto.costPer1kInput,
        costPer1kOutput: dto.costPer1kOutput,
        avgLatencyMs: dto.avgLatencyMs ?? null,
        successRate: dto.successRate ?? null,
        qualityScore: dto.qualityScore ?? null,
        isActive: dto.isActive ?? true,
        replacedByModelId: dto.replacedByModelId ?? null,
      },
    });
  }

  async getModels(filters?: {
    tier?: string;
    providerId?: string;
    isActive?: boolean;
    capabilities?: string[];
  }) {
    const where: Prisma.ModelRegistryWhereInput = {};

    if (filters?.tier) {
      where.tier = filters.tier as ModelTier;
    }
    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.capabilities && filters.capabilities.length > 0) {
      where.capabilities = { hasSome: filters.capabilities as ModelCapability[] };
    }

    return this.prisma.modelRegistry.findMany({
      where,
      orderBy: [{ tier: 'asc' }, { displayName: 'asc' }],
      include: { provider: true },
    });
  }

  async getModel(modelId: string) {
    const model = await this.prisma.modelRegistry.findUnique({
      where: { modelId },
      include: { provider: true },
    });

    if (!model) {
      throw new NotFoundException(`Model with modelId "${modelId}" not found`);
    }

    return model;
  }

  async updateModel(modelId: string, data: Partial<CreateModelDto>) {
    const existing = await this.prisma.modelRegistry.findUnique({
      where: { modelId },
    });
    if (!existing) {
      throw new NotFoundException(`Model with modelId "${modelId}" not found`);
    }

    const updateData: Prisma.ModelRegistryUpdateInput = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.tier !== undefined) updateData.tier = data.tier;
    if (data.capabilities !== undefined) updateData.capabilities = data.capabilities;
    if (data.contextWindow !== undefined) updateData.contextWindow = data.contextWindow;
    if (data.maxOutputTokens !== undefined) updateData.maxOutputTokens = data.maxOutputTokens;
    if (data.costPer1kInput !== undefined) updateData.costPer1kInput = data.costPer1kInput;
    if (data.costPer1kOutput !== undefined) updateData.costPer1kOutput = data.costPer1kOutput;
    if (data.avgLatencyMs !== undefined) updateData.avgLatencyMs = data.avgLatencyMs;
    if (data.successRate !== undefined) updateData.successRate = data.successRate;
    if (data.qualityScore !== undefined) updateData.qualityScore = data.qualityScore;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.replacedByModelId !== undefined) updateData.replacedByModelId = data.replacedByModelId;

    return this.prisma.modelRegistry.update({
      where: { modelId },
      data: updateData,
      include: { provider: true },
    });
  }

  async deactivateModel(modelId: string) {
    const existing = await this.prisma.modelRegistry.findUnique({
      where: { modelId },
    });
    if (!existing) {
      throw new NotFoundException(`Model with modelId "${modelId}" not found`);
    }

    return this.prisma.modelRegistry.update({
      where: { modelId },
      data: {
        isActive: false,
        deprecatedAt: new Date(),
      },
      include: { provider: true },
    });
  }
}
