/* @lifecycle ACTIVE — Unit tests for CostAggregatorService (ADR-016) */

import { CostAggregatorService } from '../aggregator/cost-aggregator.service';
import { InMemoryPricingResolver } from '../aggregator/pricing.resolver';
import { TelemetryEvent, ModelPricing } from '../types';

describe('CostAggregatorService', () => {
  const mockPricing: ModelPricing[] = [
    {
      model: 'deepseek/deepseek-v4-flash',
      inputPer1k: 0.001,
      outputPer1k: 0.002,
    },
    {
      model: 'deepseek/deepseek-v4-pro',
      inputPer1k: 0.005,
      outputPer1k: 0.015,
    },
  ];

  const createEvent = (overrides: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
    eventId: 'evt-001',
    executionId: 'exec-001',
    phaseId: 'phase-001',
    agentType: 'code',
    modelUsed: 'deepseek/deepseek-v4-flash',
    tokens: { input: 1000, output: 500 },
    timestamp: Date.now(),
    ...overrides,
  });

  it('should compute cost for single event', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);

    const result = aggregator.aggregate([createEvent()]);

    expect(result).toHaveLength(1);
    expect(result[0].inputCostUsd).toBeCloseTo(0.001);
    expect(result[0].outputCostUsd).toBeCloseTo(0.001);
    expect(result[0].totalCostUsd).toBeCloseTo(0.002);
  });

  it('should handle multiple models', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);

    const events = [
      createEvent({ eventId: 'evt-1', modelUsed: 'deepseek/deepseek-v4-flash', tokens: { input: 1000, output: 500 } }),
      createEvent({ eventId: 'evt-2', modelUsed: 'deepseek/deepseek-v4-pro', tokens: { input: 2000, output: 1000 } }),
    ];

    const result = aggregator.aggregate(events);

    expect(result).toHaveLength(2);
    expect(result[0].model).toBe('deepseek/deepseek-v4-flash');
    expect(result[1].model).toBe('deepseek/deepseek-v4-pro');
  });

  it('should throw PricingNotFoundError for unknown model', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);

    expect(() => aggregator.aggregate([
      createEvent({ modelUsed: 'unknown/model' }),
    ])).toThrow('Pricing not found for model: unknown/model');
  });

  it('should be deterministic (replay-safe)', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);
    const events = [createEvent()];

    const result1 = aggregator.aggregate(events);
    const result2 = aggregator.aggregate(events);

    expect(result1).toEqual(result2);
  });

  it('should handle empty events array', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);

    const result = aggregator.aggregate([]);
    expect(result).toHaveLength(0);
  });
});
