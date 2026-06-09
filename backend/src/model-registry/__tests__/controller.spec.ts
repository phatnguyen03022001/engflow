/* @lifecycle ACTIVE — Unit tests for ModelRegistryController */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ModelRegistryController } from '../model-registry.controller';
import { RegistryService } from '../services/registry.service';
import { RouterService } from '../services/router.service';
import { CostTrackerService } from '../services/cost-tracker.service';
import { FallbackService } from '../services/fallback.service';

describe('ModelRegistryController', () => {
  let controller: ModelRegistryController;

  const mockRegistryService = {
    createProvider: jest.fn(),
    getProviders: jest.fn(),
    createModel: jest.fn(),
    getModels: jest.fn(),
    getModel: jest.fn(),
    updateModel: jest.fn(),
    deactivateModel: jest.fn(),
  };

  const mockRouterService = {
    createRoute: jest.fn(),
    getRoutes: jest.fn(),
    resolveRoute: jest.fn(),
  };

  const mockCostTrackerService = {
    recordCost: jest.fn(),
    getCostReport: jest.fn(),
    getProjectedMonthlySpend: jest.fn(),
    recalculate: jest.fn(),
  };

  const mockFallbackService = {
    createFallbackChain: jest.fn(),
    getFallbackChains: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelRegistryController],
      providers: [
        { provide: RegistryService, useValue: mockRegistryService },
        { provide: RouterService, useValue: mockRouterService },
        { provide: CostTrackerService, useValue: mockCostTrackerService },
        { provide: FallbackService, useValue: mockFallbackService },
      ],
    }).compile();

    controller = module.get<ModelRegistryController>(ModelRegistryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('provider endpoints', () => {
    it('createProvider should call registryService.createProvider', async () => {
      const dto = { providerId: 'test', name: 'Test', apiBaseUrl: 'https://test.com', apiKeyEnv: 'TEST_KEY' };
      mockRegistryService.createProvider.mockResolvedValue({ providerId: 'test' });

      const result = await controller.createProvider(dto);

      expect(mockRegistryService.createProvider).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ providerId: 'test' });
    });

    it('getProviders should call registryService.getProviders', async () => {
      mockRegistryService.getProviders.mockResolvedValue([]);

      const result = await controller.getProviders('true');

      expect(mockRegistryService.getProviders).toHaveBeenCalledWith(true);
      expect(result).toEqual([]);
    });
  });

  describe('model endpoints', () => {
    it('createModel should call registryService.createModel', async () => {
      const dto = { modelId: 'test/model', providerId: 'test', displayName: 'Test', contextWindow: 4096, costPer1kInput: 0.1, costPer1kOutput: 0.2 };
      mockRegistryService.createModel.mockResolvedValue({ modelId: 'test/model' });

      const result = await controller.createModel(dto);

      expect(mockRegistryService.createModel).toHaveBeenCalledWith(dto);
      expect(result.modelId).toBe('test/model');
    });

    it('getModels should pass query parameters', async () => {
      mockRegistryService.getModels.mockResolvedValue([]);

      await controller.getModels('BUDGET', 'deepseek', 'true', 'CHAT,REASONING');

      expect(mockRegistryService.getModels).toHaveBeenCalledWith({
        tier: 'BUDGET',
        providerId: 'deepseek',
        isActive: true,
        capabilities: ['CHAT', 'REASONING'],
      });
    });

    it('getModel should call registryService.getModel', async () => {
      mockRegistryService.getModel.mockResolvedValue({ modelId: 'test/model' });

      const result = await controller.getModel('test/model');

      expect(mockRegistryService.getModel).toHaveBeenCalledWith('test/model');
      expect(result.modelId).toBe('test/model');
    });

    it('updateModel should call registryService.updateModel', async () => {
      const dto = { displayName: 'Updated' };
      mockRegistryService.updateModel.mockResolvedValue({ modelId: 'test/model', displayName: 'Updated' });

      const result = await controller.updateModel('test/model', dto);

      expect(mockRegistryService.updateModel).toHaveBeenCalledWith('test/model', dto);
      expect(result.displayName).toBe('Updated');
    });

    it('deactivateModel should call registryService.deactivateModel', async () => {
      mockRegistryService.deactivateModel.mockResolvedValue({ modelId: 'test/model', isActive: false });

      const result = await controller.deactivateModel('test/model');

      expect(mockRegistryService.deactivateModel).toHaveBeenCalledWith('test/model');
      expect(result.isActive).toBe(false);
    });
  });

  describe('route endpoints', () => {
    it('createRoute should call routerService.createRoute', async () => {
      const dto = { routeId: 'test-route', agentType: 'CODE', taskType: 'LEVEL_1', primaryModelId: 'test/model' };
      mockRouterService.createRoute.mockResolvedValue({ routeId: 'test-route' });

      const result = await controller.createRoute(dto);

      expect(mockRouterService.createRoute).toHaveBeenCalledWith(dto);
      expect(result.routeId).toBe('test-route');
    });

    it('getRoutes should call routerService.getRoutes', async () => {
      mockRouterService.getRoutes.mockResolvedValue([]);

      await controller.getRoutes('CODE', 'LEVEL_1');

      expect(mockRouterService.getRoutes).toHaveBeenCalledWith({ agentType: 'CODE', taskType: 'LEVEL_1' });
    });

    it('resolveRoute should validate API key and call routerService.resolveRoute', async () => {
      const originalEnv = process.env.AGENT_API_KEY;
      process.env.AGENT_API_KEY = 'test-agent-key';

      mockRouterService.resolveRoute.mockResolvedValue({ modelId: 'test/model' });

      const result = await controller.resolveRoute('test-agent-key', { agentType: 'CODE', taskType: 'LEVEL_1' });

      expect(mockRouterService.resolveRoute).toHaveBeenCalledWith('CODE', 'LEVEL_1');
      expect(result.modelId).toBe('test/model');

      process.env.AGENT_API_KEY = originalEnv;
    });

    it('resolveRoute should throw UnauthorizedException with wrong API key', () => {
      const originalEnv = process.env.AGENT_API_KEY;
      process.env.AGENT_API_KEY = 'test-agent-key';

      expect(() =>
        controller.resolveRoute('wrong-key', { agentType: 'CODE', taskType: 'LEVEL_1' }),
      ).toThrow(UnauthorizedException);

      expect(mockRouterService.resolveRoute).not.toHaveBeenCalled();

      process.env.AGENT_API_KEY = originalEnv;
    });
  });

  describe('fallback chain endpoints', () => {
    it('createFallbackChain should call fallbackService.createFallbackChain', async () => {
      const dto = { chainId: 'test-chain', primaryModelId: 'model-a', fallbackModelId: 'model-b' };
      mockFallbackService.createFallbackChain.mockResolvedValue({ chainId: 'test-chain' });

      const result = await controller.createFallbackChain(dto);

      expect(mockFallbackService.createFallbackChain).toHaveBeenCalledWith(dto);
      expect(result.chainId).toBe('test-chain');
    });

    it('getFallbackChains should call fallbackService.getFallbackChains', async () => {
      mockFallbackService.getFallbackChains.mockResolvedValue([]);

      await controller.getFallbackChains('model-a', 'true');

      expect(mockFallbackService.getFallbackChains).toHaveBeenCalledWith({
        primaryModelId: 'model-a',
        isActive: true,
      });
    });
  });

  describe('cost log endpoint', () => {
    it('recordCostLog should validate API key and call costTrackerService.recordCost', async () => {
      const originalEnv = process.env.AGENT_API_KEY;
      process.env.AGENT_API_KEY = 'test-agent-key';

      const dto = { modelId: 'test/model', executionId: 'TASK-001', inputTokens: 100, outputTokens: 50, costUsd: 0.01, latencyMs: 100 };
      mockCostTrackerService.recordCost.mockResolvedValue({ id: 'cost-1' });

      const result = await controller.recordCostLog('test-agent-key', dto);

      expect(mockCostTrackerService.recordCost).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('cost-1');

      process.env.AGENT_API_KEY = originalEnv;
    });

    it('recordCostLog should throw UnauthorizedException with wrong API key', () => {
      const originalEnv = process.env.AGENT_API_KEY;
      process.env.AGENT_API_KEY = 'test-agent-key';

      const dto = { modelId: 'test/model', executionId: 'TASK-001', inputTokens: 100, outputTokens: 50, costUsd: 0.01, latencyMs: 100 };

      expect(() =>
        controller.recordCostLog('wrong-key', dto),
      ).toThrow(UnauthorizedException);

      process.env.AGENT_API_KEY = originalEnv;
    });
  });

  describe('cost report endpoints', () => {
    it('getCostReport should call costTrackerService.getCostReport', async () => {
      const query = { window: 'ROLLING_30D' };
      mockCostTrackerService.getCostReport.mockResolvedValue({ summary: { totalCostUsd: 10 } });

      const result = await controller.getCostReport(query);

      expect(mockCostTrackerService.getCostReport).toHaveBeenCalledWith(query);
      expect(result.summary.totalCostUsd).toBe(10);
    });

    it('getProjection should call costTrackerService.getProjectedMonthlySpend', async () => {
      mockCostTrackerService.getProjectedMonthlySpend.mockResolvedValue(45.5);

      const result = await controller.getProjection();

      expect(mockCostTrackerService.getProjectedMonthlySpend).toHaveBeenCalled();
      expect(result).toBe(45.5);
    });

    it('recalculateCosts should call costTrackerService.recalculate', async () => {
      mockCostTrackerService.recalculate.mockResolvedValue({ recalculated: true });

      const result = await controller.recalculateCosts();

      expect(mockCostTrackerService.recalculate).toHaveBeenCalled();
      expect(result.recalculated).toBe(true);
    });
  });
});
