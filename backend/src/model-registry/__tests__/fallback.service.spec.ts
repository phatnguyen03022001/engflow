/* @lifecycle ACTIVE — Unit tests for FallbackService */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FallbackService } from '../services/fallback.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('FallbackService', () => {
  let service: FallbackService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    modelRegistry: {
      findUnique: jest.fn(),
    },
    fallbackChain: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockFlashModel = {
    modelId: 'deepseek/deepseek-v4-flash',
    providerId: 'deepseek',
    displayName: 'DeepSeek v4 Flash',
    tier: 'BUDGET',
    isActive: true,
  };

  const mockProModel = {
    modelId: 'deepseek/deepseek-v4-pro',
    providerId: 'deepseek',
    displayName: 'DeepSeek v4 Pro',
    tier: 'PREMIUM',
    isActive: true,
  };

  const mockInactiveModel = {
    ...mockProModel,
    modelId: 'deepseek/deprecated-model',
    displayName: 'Deprecated Model',
    isActive: false,
  };

  const mockChain1 = {
    chainId: 'fallback-flash-to-pro',
    primaryModelId: 'deepseek/deepseek-v4-flash',
    fallbackModelId: 'deepseek/deepseek-v4-pro',
    priority: 1,
    triggerOnHttpCode: 429,
    triggerOnTimeoutMs: 60000,
    maxRetries: 1,
    isActive: true,
    fallbackModel: mockProModel,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FallbackService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FallbackService>(FallbackService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveFallbackChain', () => {
    it('should resolve a valid fallback chain', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.fallbackChain.findMany.mockResolvedValue([mockChain1]);

      const result = await service.resolveFallbackChain('deepseek/deepseek-v4-flash');

      expect(result).toHaveLength(1);
      expect(result[0].chainId).toBe('fallback-flash-to-pro');
      expect(result[0].model.modelId).toBe('deepseek/deepseek-v4-pro');
      expect(result[0].model.tier).toBe('PREMIUM');
    });

    it('should throw NotFoundException when primary model not found', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveFallbackChain('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no fallback chains exist', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.fallbackChain.findMany.mockResolvedValue([]);

      await expect(
        service.resolveFallbackChain('deepseek/deepseek-v4-flash'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip inactive fallback models', async () => {
      const chainWithInactive = {
        ...mockChain1,
        fallbackModel: mockInactiveModel,
      };

      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.fallbackChain.findMany.mockResolvedValue([chainWithInactive]);

      await expect(
        service.resolveFallbackChain('deepseek/deepseek-v4-flash'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should detect and skip cycles', async () => {
      // Chain that falls back to itself
      const selfChain = {
        ...mockChain1,
        chainId: 'self-chain',
        fallbackModelId: 'deepseek/deepseek-v4-flash',
        fallbackModel: mockFlashModel,
      };

      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.fallbackChain.findMany.mockResolvedValue([selfChain]);

      await expect(
        service.resolveFallbackChain('deepseek/deepseek-v4-flash'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should respect max 3 hops', async () => {
      // Create 4 fallback chains
      const chains = [1, 2, 3, 4].map((i) => ({
        ...mockChain1,
        chainId: `chain-${i}`,
        fallbackModelId: `model-${i}`,
        priority: i,
        fallbackModel: { ...mockProModel, modelId: `model-${i}`, displayName: `Model ${i}` },
      }));

      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.fallbackChain.findMany.mockResolvedValue(chains);

      const result = await service.resolveFallbackChain('deepseek/deepseek-v4-flash');

      expect(result).toHaveLength(3);
    });

    it('should order by priority ASC (as returned by Prisma)', async () => {
      const chains = [
        { ...mockChain1, chainId: 'chain-p1', priority: 1, fallbackModel: { ...mockProModel, modelId: 'model-a' } },
        { ...mockChain1, chainId: 'chain-p2', priority: 2, fallbackModel: { ...mockProModel, modelId: 'model-b' } },
      ];

      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.fallbackChain.findMany.mockResolvedValue(chains);

      const result = await service.resolveFallbackChain('deepseek/deepseek-v4-flash');

      expect(result[0].priority).toBe(1);
      expect(result[1].priority).toBe(2);
    });
  });

  describe('getFallbackChains', () => {
    it('should return all fallback chains', async () => {
      mockPrisma.fallbackChain.findMany.mockResolvedValue([mockChain1]);

      const result = await service.getFallbackChains();

      expect(result).toHaveLength(1);
    });

    it('should filter by primaryModelId', async () => {
      mockPrisma.fallbackChain.findMany.mockResolvedValue([]);

      await service.getFallbackChains({ primaryModelId: 'deepseek/deepseek-v4-flash' });

      expect(mockPrisma.fallbackChain.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { primaryModelId: 'deepseek/deepseek-v4-flash' },
        }),
      );
    });
  });

  describe('createFallbackChain', () => {
    const createDto = {
      chainId: 'fallback-flash-to-pro',
      primaryModelId: 'deepseek/deepseek-v4-flash',
      fallbackModelId: 'deepseek/deepseek-v4-pro',
    };

    it('should create a fallback chain', async () => {
      mockPrisma.modelRegistry.findUnique
        .mockResolvedValueOnce(mockFlashModel)
        .mockResolvedValueOnce(mockProModel);
      mockPrisma.fallbackChain.create.mockResolvedValue({
        ...mockChain1,
        primaryModel: mockFlashModel,
        fallbackModel: mockProModel,
      });

      const result = await service.createFallbackChain(createDto);

      expect(mockPrisma.fallbackChain.create).toHaveBeenCalled();
      expect(result.chainId).toBe('fallback-flash-to-pro');
    });

    it('should throw when primary model not found', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValueOnce(null);

      await expect(service.createFallbackChain(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when fallback model not found', async () => {
      mockPrisma.modelRegistry.findUnique
        .mockResolvedValueOnce(mockFlashModel)
        .mockResolvedValueOnce(null);

      await expect(service.createFallbackChain(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when model falls back to itself', async () => {
      const selfDto = {
        ...createDto,
        fallbackModelId: 'deepseek/deepseek-v4-flash',
      };

      mockPrisma.modelRegistry.findUnique
        .mockResolvedValueOnce(mockFlashModel)
        .mockResolvedValueOnce(mockFlashModel);

      await expect(service.createFallbackChain(selfDto)).rejects.toThrow(
        'A model cannot fall back to itself',
      );
    });
  });
});
