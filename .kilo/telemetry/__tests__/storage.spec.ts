/* @lifecycle ACTIVE — Unit tests for TelemetryEventStore + CostLogWriter (ADR-016) */

import * as fs from 'fs';
import * as path from 'path';
import { TelemetryEventStore } from '../trace/telemetry-event.store';
import { CostLogWriter } from '../analytics/cost-log.writer';
import { TelemetryEvent, CostBreakdown } from '../types';

describe('TelemetryEventStore', () => {
  const store = new TelemetryEventStore();
  const executionId = 'test-exec-' + Date.now();

  const createEvent = (overrides: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
    eventId: 'evt-' + Math.random().toString(36).slice(2, 8),
    executionId,
    phaseId: 'phase-001',
    agentType: 'code',
    modelUsed: 'deepseek/deepseek-v4-flash',
    tokens: { input: 1000, output: 500 },
    timestamp: Date.now(),
    ...overrides,
  });

  afterEach(() => {
    // Cleanup test file
    const filePath = path.join(store['dir'], `${executionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  it('should return empty array for non-existent execution', () => {
    const events = store.load('non-existent-exec');
    expect(events).toEqual([]);
  });

  it('should append and load events', () => {
    const events = [createEvent(), createEvent({ eventId: 'evt-2' })];
    store.append(executionId, events);

    const loaded = store.load(executionId);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].eventId).toBe(events[0].eventId);
    expect(loaded[1].eventId).toBe(events[1].eventId);
  });

  it('should append to existing trace (immutable ledger)', () => {
    const batch1 = [createEvent({ eventId: 'evt-1' })];
    store.append(executionId, batch1);

    const batch2 = [createEvent({ eventId: 'evt-2' })];
    store.append(executionId, batch2);

    const loaded = store.load(executionId);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].eventId).toBe('evt-1');
    expect(loaded[1].eventId).toBe('evt-2');
  });

  it('should report exists correctly', () => {
    expect(store.exists(executionId)).toBe(false);
    store.append(executionId, [createEvent()]);
    expect(store.exists(executionId)).toBe(true);
  });

  it('should preserve event data exactly (no mutation)', () => {
    const event = createEvent({ tokens: { input: 999, output: 888, reasoning: 77 } });
    store.append(executionId, [event]);

    const loaded = store.load(executionId);
    expect(loaded[0].tokens.input).toBe(999);
    expect(loaded[0].tokens.output).toBe(888);
    expect(loaded[0].tokens.reasoning).toBe(77);
  });
});

describe('CostLogWriter', () => {
  const writer = new CostLogWriter();
  const date = new Date().toISOString().split('T')[0];
  const filePath = path.join(writer['dir'], `${date}.jsonl`);

  const createBreakdown = (overrides: Partial<CostBreakdown> = {}): CostBreakdown => ({
    eventId: 'cb-' + Math.random().toString(36).slice(2, 8),
    model: 'deepseek/deepseek-v4-flash',
    inputTokens: 1000,
    outputTokens: 500,
    inputCostUsd: 0.001,
    outputCostUsd: 0.001,
    totalCostUsd: 0.002,
    ...overrides,
  });

  afterEach(() => {
    // Cleanup test file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  it('should write empty array without creating file', () => {
    writer.write([]);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should append breakdowns as JSONL', () => {
    const breakdowns = [createBreakdown(), createBreakdown({ eventId: 'cb-2' })];
    writer.write(breakdowns);

    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);

    const parsed = lines.map(l => JSON.parse(l));
    expect(parsed[0].eventId).toBe(breakdowns[0].eventId);
    expect(parsed[1].eventId).toBe(breakdowns[1].eventId);
  });

  it('should append to existing cost log (projection)', () => {
    writer.write([createBreakdown({ eventId: 'cb-1' })]);
    writer.write([createBreakdown({ eventId: 'cb-2' })]);

    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('should write valid JSONL (parseable)', () => {
    const breakdowns = [createBreakdown()];
    writer.write(breakdowns);

    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    const parsed = JSON.parse(lines[0]) as CostBreakdown;
    expect(parsed.totalCostUsd).toBeCloseTo(0.002);
  });
});

describe('Architecture invariant (ADR-016)', () => {
  const invariantExecId = 'invariant-test';
  const rebuildExecId = 'rebuild-test';

  afterEach(() => {
    // Cleanup invariant test files
    const store = new TelemetryEventStore();
    [invariantExecId, rebuildExecId].forEach((id) => {
      const filePath = path.join(store['dir'], `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  it('TelemetryEventStore is source truth — cost cannot be rebuilt without it', () => {
    // If TelemetryEventStore is lost, we have no raw token data
    // → CostAggregator has no input → cannot recompute cost
    // This test documents the invariant, not enforces it
    const store = new TelemetryEventStore();

    // Store is empty → no events → no cost possible
    const events = store.load(invariantExecId);
    expect(events).toHaveLength(0);
    // Without events, aggregator has nothing to process
    // CostLog alone cannot reconstruct token counts
  });

  it('CostLog is projection — can be rebuilt from TelemetryEventStore', () => {
    // If CostLog is lost but TelemetryEventStore exists:
    // 1. Load raw events from store
    // 2. Re-run CostAggregator
    // 3. Re-write CostLog
    // This test documents the rebuildability invariant
    const store = new TelemetryEventStore();
    const event = {
      eventId: 'evt-rebuild',
      executionId: rebuildExecId,
      phaseId: 'phase-1',
      agentType: 'code' as const,
      modelUsed: 'deepseek/deepseek-v4-flash',
      tokens: { input: 1000, output: 500 },
      timestamp: Date.now(),
    };

    store.append(rebuildExecId, [event]);

    // Rebuild: load events → aggregate → write cost log
    const loaded = store.load(rebuildExecId);
    expect(loaded).toHaveLength(1);
    // With loaded events, aggregator can recompute cost
    // → CostLog can be regenerated
  });
});
