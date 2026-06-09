/* @lifecycle ACTIVE — Unit tests for RegistryService */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegistryService } from '../services/registry.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('RegistryService', () => {
  let service: RegistryService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    modelProvider: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    modelRegistry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  const mockModel = {
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
    provider: mockProvider,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RegistryService>(RegistryService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProvider', () => {
    const createDto = {
      providerId: 'deepseek',
      name: 'DeepSeek',
      apiBaseUrl: 'https://api.deepseek.com/v1',
      apiKeyEnv: 'DEEPSEEK_API_KEY',
    };

    it('should create a provider successfully', async () => {
      mockPrisma.modelProvider.findUnique.mockResolvedValue(null);
      mockPrisma.modelProvider.create.mockResolvedValue(mockProvider);

      const result = await service.createProvider(createDto);

      expect(mockPrisma.modelProvider.findUnique).toHaveBeenCalledWith({
        where: { providerId: 'deepseek' },
      });
      expect(mockPrisma.modelProvider.create).toHaveBeenCalled();
      expect(result).toEqual(mockProvider);
    });

    it('should throw ConflictException for duplicate providerId', async () => {
      mockPrisma.modelProvider.findUnique.mockResolvedValue(mockProvider);

      await expect(service.createProvider(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.modelProvider.create).not.toHaveBeenCalled();
    });
  });

  describe('getProviders', () => {
    it('should return active providers by default', async () => {
      mockPrisma.modelProvider.findMany.mockResolvedValue([mockProvider]);

      const result = await service.getProviders();

      expect(result).toHaveLength(1);
      expect(mockPrisma.modelProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should return all providers when includeInactive is true', async () => {
      mockPrisma.modelProvider.findMany.mockResolvedValue([mockProvider]);

      await service.getProviders(true);

      expect(mockPrisma.modelProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('createModel', () => {
    const createDto = {
      modelId: 'deepseek/deepseek-v4-flash',
      providerId: 'deepseek',
      displayName: 'DeepSeek v4 Flash',
      contextWindow: 128000,
      costPer1kInput: 0.14,
      costPer1kOutput: 0.28,
    };

    it('should create a model successfully', async () => {
      mockPrisma.modelProvider.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);
      mockPrisma.modelRegistry.create.mockResolvedValue(mockModel);

      const result = await service.createModel(createDto);

      expect(mockPrisma.modelProvider.findUnique).toHaveBeenCalledWith({
        where: { providerId: 'deepseek' },
      });
      expect(mockPrisma.modelRegistry.create).toHaveBeenCalled();
      expect(result).toEqual(mockModel);
    });

    it('should throw NotFoundException when provider does not exist', async () => {
      mockPrisma.modelProvider.findUnique.mockResolvedValue(null);

      await expect(service.createModel(createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.modelRegistry.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate modelId', async () => {
      mockPrisma.modelProvider.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockModel);

      await expect(service.createModel(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.modelRegistry.create).not.toHaveBeenCalled();
    });
  });

  describe('getModels', () => {
    it('should return all models without filters', async () => {
      mockPrisma.modelRegistry.findMany.mockResolvedValue([mockModel]);

      const result = await service.getModels();

      expect(result).toHaveLength(1);
      expect(mockPrisma.modelRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should apply tier filter', async () => {
      mockPrisma.modelRegistry.findMany.mockResolvedValue([]);

      await service.getModels({ tier: 'BUDGET' });

      expect(mockPrisma.modelRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tier: 'BUDGET' },
        }),
      );
    });

    it('should apply capabilities filter', async () => {
      mockPrisma.modelRegistry.findMany.mockResolvedValue([]);

      await service.getModels({ capabilities: ['CHAT'] });

      expect(mockPrisma.modelRegistry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { capabilities: { hasSome: ['CHAT'] } },
        }),
      );
    });
  });

  describe('getModel', () => {
    it('should return a model by modelId', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockModel);

      const result = await service.getModel('deepseek/deepseek-v4-flash');

      expect(result).toEqual(mockModel);
      expect(mockPrisma.modelRegistry.findUnique).toHaveBeenCalledWith({
        where: { modelId: 'deepseek/deepseek-v4-flash' },
        include: { provider: true },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);

      await expect(service.getModel('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateModel', () => {
    it('should update model fields', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockModel);
      mockPrisma.modelRegistry.update.mockResolvedValue({
        ...mockModel,
        displayName: 'Updated Flash',
      });

      const result = await service.updateModel('deepseek/deepseek-v4-flash', {
        displayName: 'Updated Flash',
      });

      expect(mockPrisma.modelRegistry.update).toHaveBeenCalled();
      expect(result.displayName).toBe('Updated Flash');
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);

      await expect(
        service.updateModel('nonexistent', { displayName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateModel', () => {
    it('should soft-deactivate a model', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(mockModel);
      mockPrisma.modelRegistry.update.mockResolvedValue({
        ...mockModel,
        isActive: false,
        deprecatedAt: new Date(),
      });

      const result = await service.deactivateModel('deepseek/deepseek-v4-flash');

      expect(mockPrisma.modelRegistry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { modelId: 'deepseek/deepseek-v4-flash' },
          data: expect.objectContaining({
            isActive: false,
            deprecatedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.modelRegistry.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivateModel('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
