/* @lifecycle ACTIVE — ADR-016: Event-to-Cost Pipeline Architecture (Plugin-Native Telemetry System) */

# ADR-016 — Event-to-Cost Pipeline: Plugin-Native Telemetry & Cost Aggregation

**Status:** Active
**Created:** 2026-06-10
**Author:** Ask Agent (ADR-016)
**Supersedes:** None
**Superseded By:** None
**References:** ADR-010 (Model Intelligence), ADR-003 (Evaluation Harness), ADR-013 (Drift Detection), ADR-014 (Analytics Dashboard), Constitution §3 §7, Architecture Layers 7–9

---

## 1. Context

### 1.1 Current State

The Floweng AI Software Factory currently has:

1. **Plugin event emission** — `@kilocode/plugin` emits `EventMessageUpdated` containing `AssistantMessage.tokens` (inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens)
2. **Guard event hook (Phase 1)** — `GuardService.event()` captures these events and writes token summaries to `WorkingMemory` as `WorkingMemoryEntry` records
3. **Model Registry (ADR-010)** — stores `costPer1kInput` and `costPer1kOutput` per model, but cost is never computed from actual token usage
4. **Evaluation module** — records `modelUsed` in `ExecutionPhase`, but without token counts, cost cannot be derived
5. **No cost tracking** — the budget target (60–80 USD/month) is unmeasurable

### 1.2 The Problem

The current approach has three critical flaws:

**Flaw 1: Semantic pollution**
Token telemetry is being written to `WorkingMemory` — the execution trace layer. WorkingMemory is designed for agent actions and hop checkpoints, not LLM usage metrics. Mixing these domains creates semantic drift and makes both systems harder to reason about.

**Flaw 2: No cost computation**
Token counts exist in plugin events but are never multiplied by model pricing. The `costPer1kInput`/`costPer1kOutput` fields in ModelRegistry are dead data — stored but never used for actual cost calculation.

**Flaw 3: No replayability**
If pricing changes or a bug is discovered, there is no way to recompute costs from raw token data. The system has no immutable telemetry log — only derived WorkingMemory entries that mix execution context with billing data.

### 1.3 Why This Matters

Cost data is not just observability — it is **financial correctness data**. Unlike logs that can be regenerated, billing-grade telemetry must be:

- **Immutable** — raw events never modified after capture
- **Replayable** — can recompute costs when pricing changes
- **Traceable** — can trace cost back to exact execution, phase, and model
- **Idempotent** — no double-counting on retry or flush

---

## 2. Decision

### §1. Create `.kilo/telemetry/` Module (Event-to-Cost Pipeline)

Establish `.kilo/telemetry/` as a dedicated module following the canonical `.kilo/` pattern. The module implements a **Datadog-style telemetry pipeline** with strict separation between collection, buffering, aggregation, and storage.

### §2. Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Collection                                               │
│  - PluginEventCollector                                             │
│  - Normalizes raw plugin events into TelemetryEvent                 │
│  - NO business logic, NO persistence                                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│  Layer 2: Buffering                                                │
│  - TelemetryBuffer (in-memory)                                     │
│  - Batching: count-based (default: 100 events) + time-based (5s)   │
│  - Flush triggers: batch full, interval elapsed, execution COMMIT  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ flush()
┌─────────────────────────────▼───────────────────────────────────────┐
│  Layer 3: Aggregation                                              │
│  - CostAggregatorService (PURE COMPUTATION)                        │
│  - Input: TelemetryEvent[]                                         │
│  - Output: CostBreakdown[]                                         │
│  - cost = Σ(tokens × modelPricing)                                 │
│  - NO side effects, NO I/O                                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Layer 4a: Trace Store    │  │  Layer 4b: Cost Analytics │
│  - TelemetryEventStore    │  │  - CostLogWriter          │
│  - Raw truth (replayable) │  │  - Derived projection     │
│  - JSON file per exec     │  │  - JSON file (OLAP-style) │
└──────────────────────────┘  └──────────────────────────┘
```

### §3. Data Ownership Model

| Data | Owner | Mutability | Source of Truth |
|------|-------|------------|-----------------|
| Token usage (input/output/reasoning/cache) | Plugin | Immutable after capture | `EventMessageUpdated` |
| Execution trace (phases, hops, transitions) | Guard/WorkingMemory | Append-only | `WorkingMemoryState` |
| Cost (USD) | Aggregator | Derived, recomputable | `CostAggregatorService.compute()` |
| Model pricing | ModelRegistry | Mutable (admin update) | `ModelRegistry` Prisma model |

**Rule: No component may write cost data. Cost is always computed, never stored as source truth.**

### §4. Event Contract (Immutable)

**Cardinality:**
```
1 execution
  └── many phases
        └── many telemetry events
```

A single phase may emit multiple telemetry events (e.g., multiple LLM calls within one agent phase). Each event is uniquely identified by `eventId`.

```typescript
interface TelemetryEvent {
  eventId: string;           // UUID v7 — unique per event, idempotency key
  executionId: string;       // UUID v7 — correlates to ExecutionLock
  phaseId: string;           // UUID v7 — correlates to ExecutionPhase
  agentType: string;         // 'router' | 'plan' | 'architect' | 'code' | 'pre_verify' | 'post_verify'
  modelUsed: string;         // e.g. 'deepseek/deepseek-v4-flash'
  tokens: {
    input: number;           // Input tokens
    output: number;          // Output tokens
    reasoning?: number;      // Reasoning tokens (if model supports)
    cache?: {                // Cache breakdown (if available)
      read: number;
      write: number;
    };
  };
  timestamp: number;         // Unix epoch ms
}
```

**This contract is the boundary between Plugin and the telemetry system. It must not change without ADR revision.**

### §5. Cost Computation Rule (Core Invariant)

```
costUsd = Σ over all events:
  (inputTokens / 1000) × pricing.inputPer1k
  + (outputTokens / 1000) × pricing.outputPer1k
```

Where `pricing` is resolved from `ModelRegistry` at aggregation time, not at ingestion time.

**Invariants:**
- Cost is NEVER written during event ingestion
- Cost is NEVER stored in ExecutionPhase or WorkingMemory
- Cost can be recomputed at any time from raw telemetry events
- Pricing changes require only re-running the aggregator — no data migration

### §6. Backpressure & Reliability Model

**Chosen: At-least-once delivery with idempotency keys**

| Property | Implementation |
|----------|---------------|
| Delivery guarantee | At-least-once |
| Idempotency key | `eventId` (UUID v7, generated by plugin) |
| Deduplication | Buffer deduplicates on append (key-based) |
| Failure handling | Buffer retains events on flush failure; retries on next flush |
| Data loss tolerance | Best effort before COMMIT — in-memory buffer cannot guarantee zero loss on process crash; durable persistence begins after successful flush |

**Rejected alternatives:**
- Exactly-once: Over-engineered for this use case; requires distributed coordination
- Best-effort without idempotency: Unacceptable for cost data — silent loss = incorrect billing

### §7. Storage Strategy

| Data | Storage | Format | Retention |
|------|---------|--------|-----------|
| Raw telemetry events | `.kilo/telemetry/traces/<executionId>.json` | JSON array | Per-execution, archived on COMMIT |
| Cost projections | `.kilo/telemetry/cost/<date>.jsonl` | JSON lines | 90 days rolling |
| Aggregation cache | In-memory only | N/A | Process lifetime |

**No Prisma models for telemetry in Phase 2.** JSON file storage matches the existing WorkingMemory pattern and avoids database schema changes for a system that is still being validated.

### §8. Guard Integration (Minimal Coupling)

`GuardService.event()` is refactored to:

```typescript
event(event: GuardEvent): void {
  // 1. Filter + normalize
  const normalized = this.normalize(event);
  if (!normalized) return;

  // 2. Append to buffer (NO WorkingMemory write)
  this.telemetryBuffer.append(normalized);
}
```

**Guard does NOT:**
- Compute cost
- Write to CostLog
- Access ModelRegistry pricing
- Persist telemetry data

**Guard ONLY:**
- Filter relevant events
- Normalize to TelemetryEvent schema
- Append to TelemetryBuffer

### §9. Flush Strategy

Flush occurs on any of these triggers (first-match):

| Trigger | Condition | Default | Rationale |
|---------|-----------|---------|-----------|
| Count | `buffer.length >= maxEvents` | 100 | Bounded memory, predictable batch size |
| Time | `flushIntervalMs since last flush` | 5000ms | Bounded latency for active sessions |
| Execution | `COMMIT` transition | N/A | Guaranteed delivery for completed work |

Configuration is centralized in `TelemetryBufferConfig`:

```typescript
interface TelemetryBufferConfig {
  maxEvents: number;          // Default: 100
  flushIntervalMs: number;    // Default: 5000
}
```

On flush failure: buffer retains events, logs error, retries on next trigger.

---

## 3. Consequences

### Positive

| Consequence | Impact |
|-------------|--------|
| Financial correctness | Cost data is immutable, replayable, and auditable |
| Pricing flexibility | Model pricing changes require only re-aggregation |
| Debuggability | Raw telemetry + derived cost = full traceability |
| Semantic clarity | WorkingMemory stays pure execution trace; telemetry stays pure metrics |
| Testability | Aggregator is pure function — trivially unit-testable |

### Negative

| Consequence | Mitigation |
|-------------|------------|
| In-memory buffer risk | Process crash loses unflushed events; mitigated by COMMIT-triggered flush and documented as best-effort |
| JSON file query limitations | No SQL queries on telemetry; acceptable for Phase 2, migrate to Prisma if needed |
| Additional complexity | 4 new files; offset by clear boundaries and pure functions |

### Neutral

| Consequence | Note |
|-------------|------|
| No real-time cost dashboard | Cost visibility is batch-based (5s max latency); real-time not required for budget tracking |

---

## 4. Alternatives Considered

### Alternative A: Direct DB Write from Guard

**Description:** Guard writes token data directly to a new `CostLog` Prisma model on each event.

**Rejected because:**
- Violates single responsibility — Guard becomes persistence layer
- No batching — N DB writes per LLM call
- Cost computed at write time — not recomputable if pricing changes
- Couples plugin events to database schema

### Alternative B: Extend WorkingMemory with Token Fields

**Description:** Add `tokens` and `costUsd` fields to `WorkingMemoryEntry`.

**Rejected because:**
- Semantic pollution — execution trace ≠ billing data
- WorkingMemory is append-only context; cost is derived projection
- No replayability — cost computed at write time, not aggregation time
- Violates the data ownership model

### Alternative C: In-Memory Only (No Persistence)

**Description:** Keep all telemetry in memory, no file writes.

**Rejected because:**
- Total data loss on process restart
- No replay capability
- No historical cost analysis
- Unacceptable for financial correctness requirement

---

## 5. Implementation Plan

### Phase 2A: Core Types + Buffer (TASK-046)

| # | File | Description |
|---|------|-------------|
| 1 | `.kilo/telemetry/types.ts` | `TelemetryEvent`, `TokenUsage`, `CostBreakdown`, `ModelPricing`, `TelemetryBufferConfig` |
| 2 | `.kilo/telemetry/buffer/telemetry.buffer.ts` | In-memory buffer with append/drain/dedup by eventId |
| 3 | `.kilo/telemetry/buffer/buffer.model.ts` | Buffer configuration model |
| 4 | Refactor `GuardService.event()` | Append to buffer only, remove WorkingMemory write |

### Phase 2B: Aggregation (TASK-047)

| # | File | Description |
|---|------|-------------|
| 5 | `.kilo/telemetry/aggregator/cost-aggregator.service.ts` | Pure cost computation |
| 6 | `.kilo/telemetry/aggregator/pricing.resolver.ts` | ModelRegistry pricing lookup |

### Phase 2C: Pipeline + Flush (TASK-048)

| # | File | Description |
|---|------|-------------|
| 7 | `.kilo/telemetry/pipeline/telemetry.pipeline.ts` | Orchestration: buffer → trace → aggregate → cost |
| 8 | `.kilo/telemetry/pipeline/flush.scheduler.ts` | Count/time/execution triggers |

### Phase 2D: Storage (TASK-049)

| # | File | Description |
|---|------|-------------|
| 9 | `.kilo/telemetry/trace/telemetry-event.store.ts` | JSON file persistence for raw events |
| 10 | `.kilo/telemetry/analytics/cost-log.writer.ts` | JSON lines writer for cost projections |

---

## 6. Verification Criteria

| Check | Method |
|-------|--------|
| Types compile | `npx tsc --noEmit .kilo/telemetry/` |
| Tests pass | `npx jest .kilo/telemetry/__tests__/` |
| No backend changes | `git diff --name-only \| grep -v "^\.kilo"` |
| Cost correctness | Unit test: known tokens + known pricing = expected cost |
| Idempotency | Duplicate eventIds produce no double-counted cost |
| Replayability | Re-run aggregator on saved events = same cost output |

---

## 7. References

- ADR-010: Model Intelligence & Cost Tracking (pricing model)
- ADR-003: Agent Evaluation Harness v1 (ExecutionPhase pattern)
- ADR-013: Drift Detection (cron scheduler pattern)
- ADR-014: Analytics Dashboard (query consolidation pattern)
- Constitution §3: Module boundaries
- Constitution §7: Simplicity (no Redis without ADR)
- Architecture Layer 8: Observability
- Architecture Layer 9: Model Intelligence

---

**End of ADR-016**
