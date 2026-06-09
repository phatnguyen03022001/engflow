/* @lifecycle ACTIVE — Unit tests for RouterService */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RouterService } from '../services/router.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('RouterService', () => {
  let service: RouterService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    modelRoute: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    modelRegistry: {
      findUnique: jest.fn(),
    },
  };

  const mockProvider = {
    providerId: 'deepseek',
    name: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFlashModel = {
    modelId: 'deepseek/deepseek-v4-flash',
    providerId: 'deepseek',
    displayName: 'DeepSeek v4 Flash',
    tier: 'BUDGET',
    capabilities: ['CHAT', 'REASONING'],
    contextWindow: 128000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.14,
    costPer1kOutput: 0.28,
    avgLatencyMs: null,
    successRate: null,
    qualityScore: null,
    isActive: true,
    deprecatedAt: null,
    replacedByModelId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoute = {
    routeId: 'route-code-level1',
    agentType: 'CODE',
    taskType: 'LEVEL_1',
    primaryModelId: 'deepseek/deepseek-v4-flash',
    priority: 0,
    maxCostUsd: null,
    maxLatencyMs: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    primaryModel: mockFlashModel,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouterService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RouterService>(RouterService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveRoute', () => {
    it('should resolve a valid route', async () => {
      mockPrisma.modelRoute.findFirst.mockResolvedValue(mockRoute);

      const result = await service.resolveRoute('CODE', 'LEVEL_1');

      expect(mockPrisma.modelRoute.findFirst).toHaveBeenCalledWith({
        where: { agentType: 'CODE', taskType: 'LEVEL_1', isActive: true },
        orderBy: { priority: 'asc' },
        include: {
          primaryModel: { include: { provider: true } },
        },
      });
      expect(result.modelId).toBe('deepseek/deepseek-v4-flash');
      expect(result.tier).toBe('BUDGET');
    });

    it('should throw NotFoundException when no route exists', async () => {
      mockPrisma.modelRoute.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveRoute('UNKNOWN', 'LEVEL_99'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when primary model is inactive', async () => {
      mockPrisma.modelRoute.findFirst.mockResolvedValue({
        ...mockRoute,
        primaryModel: { ...mockFlashModel, isActive: false },
      });

      await expect(
        service.resolveRoute('CODE', 'LEVEL_1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return route with lowest priority', async () => {
      const lowPriority = { ...mockRoute, priority: 0 };
      const highPriority = { ...mockRoute, priority: 1, routeId: 'route-alt' };
      // findFirst with orderBy should return the first by priority
      mockPrisma.modelRoute.findFirst.mockResolvedValue(lowPriority);

      const result = await service.resolveRoute('CODE', 'LEVEL_1');

      expect(result.modelId).toBe('deepseek/deepseek-v4-flash');
    });
  });

  describe('getRoutes', () => {
    it('should return all active routes', async () => {
      mockPrisma.modelRoute.findMany.mockResolvedValue([mockRoute]);

      const result = await service.getRoutes();

      expect(result).toHaveLength(1);
      expect(mockPrisma.modelRoute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('should filter by agentType', async () => {
      mockPrisma.modelRoute.findMany.mockResolvedValue([]);

      await service.getRoutes({ agentType: 'CODE' });

      expect(mockPrisma.modelRoute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, agentType: 'CODE' },
        }),
      );
    });
  });

  describe('createRoute', () => {
    const createDto = {
      routeId: 'route-code-level1',
      agentType: 'CODE',
      taskType: 'LEVEL_1',
      primaryModelId: 'deepseek/deepseek-v4-flash',
    };

    it('should create a route successfully', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockFlashModel);
      mockPrisma.modelRoute.create.mockResolvedValue(mockRoute);

      const result = await service.createRoute(createDto);

      expect(mockPrisma.modelRegistry.findUnique).toHaveBeenCalledWith({
        where: { modelId: 'deepseek/deepseek-v4-flash' },
      });
      expect(mockPrisma.modelRoute.create).toHaveBeenCalled();
      expect(result).toEqual(mockRoute);
    });

    it('should throw NotFoundException when model does not exist', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);

      await expect(service.createRoute(createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.modelRoute.create).not.toHaveBeenCalled();
    });
  });
});
