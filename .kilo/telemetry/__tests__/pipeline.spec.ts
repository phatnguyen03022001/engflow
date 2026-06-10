/* @lifecycle ACTIVE — Integration tests for TelemetryPipeline + FlushScheduler (ADR-016) */

import { CostAggregatorService } from '../aggregator/cost-aggregator.service';
import { InMemoryPricingResolver } from '../aggregator/pricing.resolver';
import { TelemetryBuffer } from '../buffer/telemetry.buffer';
import { TelemetryPipeline } from '../pipeline/telemetry.pipeline';
import { FlushScheduler } from '../pipeline/flush.scheduler';
import { TelemetryEvent, ModelPricing } from '../types';

describe('TelemetryPipeline', () => {
  const mockPricing: ModelPricing[] = [
    { model: 'deepseek/deepseek-v4-flash', inputPer1k: 0.001, outputPer1k: 0.002 },
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

  it('should return empty result for empty events', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);
    const pipeline = new TelemetryPipeline(aggregator);

    const result = pipeline.flush([]);

    expect(result.eventsProcessed).toBe(0);
    expect(result.costBreakdowns).toHaveLength(0);
  });

  it('should aggregate cost for events', () => {
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);
    const pipeline = new TelemetryPipeline(aggregator);

    const result = pipeline.flush([createEvent()]);

    expect(result.eventsProcessed).toBe(1);
    expect(result.costBreakdowns).toHaveLength(1);
    expect(result.costBreakdowns[0].totalCostUsd).toBeCloseTo(0.002);
  });
});

describe('FlushScheduler', () => {
  const mockPricing: ModelPricing[] = [
    { model: 'deepseek/deepseek-v4-flash', inputPer1k: 0.001, outputPer1k: 0.002 },
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

  function createScheduler(eventCount: number = 0) {
    const buffer = new TelemetryBuffer();
    const resolver = new InMemoryPricingResolver(mockPricing);
    const aggregator = new CostAggregatorService(resolver);
    const pipeline = new TelemetryPipeline(aggregator);

    for (let i = 0; i < eventCount; i++) {
      buffer.append(createEvent({ eventId: `evt-${i}` }));
    }

    return { buffer, pipeline, scheduler: new FlushScheduler(buffer, pipeline) };
  }

  describe('COUNT trigger', () => {
    it('should not flush below threshold', () => {
      const { scheduler } = createScheduler(99);
      const result = scheduler.maybeFlush('COUNT');
      expect(result).toBeNull();
    });

    it('should flush at threshold', () => {
      const { scheduler } = createScheduler(100);
      const result = scheduler.maybeFlush('COUNT');
      expect(result).not.toBeNull();
      expect(result!.result.eventsProcessed).toBe(100);
    });
  });

  describe('COMMIT trigger', () => {
    it('should flush on COMMIT regardless of count', () => {
      const { scheduler } = createScheduler(1);
      const result = scheduler.maybeFlush('COMMIT');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('COMMIT');
      expect(result!.result.eventsProcessed).toBe(1);
    });

    it('should flush empty buffer on COMMIT', () => {
      const { scheduler } = createScheduler(0);
      const result = scheduler.maybeFlush('COMMIT');
      expect(result).not.toBeNull();
      expect(result!.result.eventsProcessed).toBe(0);
    });
  });

  describe('retry safety', () => {
    it('should retain events after failed flush', () => {
      const buffer = new TelemetryBuffer();
      const resolver = new InMemoryPricingResolver(mockPricing);
      const aggregator = new CostAggregatorService(resolver);
      
      // Create a pipeline that throws
      const badPipeline = {
        flush: () => { throw new Error('flush failed'); },
      } as any;

      const scheduler = new FlushScheduler(buffer, badPipeline);
      buffer.append(createEvent());

      expect(() => scheduler.maybeFlush('MANUAL')).toThrow('flush failed');
      expect(buffer.size()).toBe(1); // Event retained
    });
  });

  describe('forceFlush', () => {
    it('should flush regardless of threshold', () => {
      const { scheduler } = createScheduler(1);
      const result = scheduler.forceFlush('MANUAL');
      expect(result.result.eventsProcessed).toBe(1);
    });
  });
});
