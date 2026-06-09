/* @lifecycle ACTIVE — Execution Plan: DecisionMemory Generalization (TASK-029) */

# DecisionMemory Generalization — Implementation Plan

**Author:** Planner Agent
**Date:** 2026-06-08
**Status:** Ready for Pre-Verify
**Gaps unlocked:** GAP-KNOW-004 (full), GAP-COG-002 (partial), GAP-COG-003 (partial)

---

## 1. Overview

Generalize the existing `DecisionMemory` (currently Recommendation/Ask-only) into a canonical `AgentMemory` that serves all agent types: Router, Planner, Architect, Code, Pre-Verify, Post-Verify.

### Current State

| Aspect | Status |
|--------|--------|
| DecisionMemory | Recommendation-only. Fields: domain, technology, recommendationId |
| Memory service | `DecisionMemoryService` in recommendation module, not shared |
| Context retrieval | `findByDomain()` + `queryWithApplicability()` — recommendation-only |
| Evaluation harness integration | None — executions recorded but never fed to memory |
| Data model | `DecisionMemory` uses plain `String` for outcome, no agent type tracking |

### Expected Outcomes

1. `AgentMemory` Prisma model with enums (`AgentType`, `MemoryOutcome`) — canonical memory store
2. `memory/` module with `MemoryService` — shared, injectable, no longer Ask-only
3. Context Retrieval API — similar decisions, top successful/failed patterns
4. Evaluation harness integration — memory created on execution COMMITTED
5. `DecisionMemory` → `AgentMemory` migration — historical data preserved
6. `DecisionMemory` marked deprecated, removal deferred to future task
7. 20 file changes (12 new, 8 edits), build zero errors, all tests pass

---

## 2. Design Decisions (Incorporating Feedback)

### 2.1 Single Canonical Model — No Long-Term Duplication

`AgentMemory` is the canonical model. `DecisionMemory` is a temporary compatibility layer:

- Phase B3: Create `AgentMemory` model with full generalized schema
- Phase D: Migrate existing `DecisionMemory` data into `AgentMemory`
- Phase D: Mark `DecisionMemory` as deprecated in code comments + Prisma schema
- Future: Remove `DecisionMemory` model entirely (deferred ADR)
- No dual-write logic; `DecisionMemoryService.createFromAssessment()` delegates to `MemoryService`

### 2.2 Prisma Enums for Type Safety

Replace all free-text `String` fields with Prisma enums:

```prisma
enum AgentType {
  ROUTER
  PLAN
  ARCHITECT
  CODE
  PRE_VERIFY
  POST_VERIFY
}

enum MemoryOutcome {
  SUCCESS
  FAILURE
  MIXED
  BLOCKED
  ABANDONED
}
```

These are used in `AgentMemory.agentType` and `AgentMemory.outcome`.

### 2.3 Scoring Weights as Configuration

Not hard-coded in service logic:

```typescript
export const MEMORY_SCORING_WEIGHTS = {
  agentType: 0.3,
  taskType: 0.2,
  domain: 0.15,
  // ...
} as const;
```

Defined in `memory/interfaces/scoring-weights.constant.ts`.

### 2.4 Immediate Memory Creation on Commit — No Hourly Scan

Memory creation is event-driven, not poll-based:

```
Execution COMMITTED → MetricService → MemoryService.createFromExecution()
```

Scheduler handles only:
- `decayAll()` — daily at 3AM
- `cleanupStale()` — daily at 3:05AM (prune expired/decayed entries)

### 2.5 Unique Constraint for Idempotency

```prisma
@@unique([sourceExecutionId, agentType])
```

One memory per (execution, agentType) pair. Prevents duplicates on retry.

---

## 3. Execution Phases

### Phase A — Schema (3 steps)

#### Step A1: Add enums to schema.prisma

Insert before `DecisionMemory` model:

```prisma
enum AgentType {
  ROUTER
  PLAN
  ARCHITECT
  CODE
  PRE_VERIFY
  POST_VERIFY
}

enum MemoryOutcome {
  SUCCESS
  FAILURE
  MIXED
  BLOCKED
  ABANDONED
}
```

**File:** `backend/prisma/schema.prisma` (edit)

---

#### Step A2: Add AgentMemory model

```prisma
// ─── Agent Memory (TASK-029) — Canonical memory store ────────────────────

model AgentMemory {
  id                  String        @id @default(uuid())
  memoryId            String        @unique @map("memory_id")
  agentType           AgentType     @map("agent_type")
  taskType            String        @map("task_type")
  context             Json?         @map("context")
  decision            String?       @map("decision")
  outcome             MemoryOutcome @map("outcome")
  success             Boolean       @map("success")
  confidence          Float?        @map("confidence")
  lessonsLearned      String[]      @map("lessons_learned")

  // Source traceability
  sourceExecutionId   String?       @map("source_execution_id")
  sourcePhaseId       String?       @map("source_phase_id")

  // Compatibility fields (maps from DecisionMemory)
  domain              String?
  technology          String?
  projectId           String        @default("__global__") @map("project_id")

  // Scoring & decay
  applicabilityScore  Float?        @map("applicability_score")
  referenceCount      Int           @default(0) @map("reference_count")
  decayWeight         Float         @default(1.0) @map("decay_weight")

  createdAt           DateTime      @default(now()) @map("created_at")
  lastReferencedAt    DateTime?     @map("last_referenced_at")
  expiresAt           DateTime?     @map("expires_at")

  @@index([agentType])
  @@index([taskType])
  @@index([success])
  @@index([domain])
  @@index([agentType, success])
  @@index([lastReferencedAt])
  @@unique([sourceExecutionId, agentType])
  @@map("agent_memories")
}
```

**File:** `backend/prisma/schema.prisma` (edit — insert after `DecisionMemory`)

---

#### Step A3: Mark existing DecisionMemory as DEPRECATED

Add comment block above `DecisionMemory` model:

```prisma
// @deprecated — Use AgentMemory instead. TASK-029 migration maps all data.
// Removal planned for future ADR.
```

**File:** `backend/prisma/schema.prisma` (edit)

**Commands (A1-A3):**
```bash
cd backend && npx prisma migrate dev --name add_agent_memory
npx prisma generate
```

---

### Phase B — Memory Module (6 steps)

#### Step B1: Interfaces + Constants

**File:** `backend/src/memory/interfaces/agent-memory.interface.ts`

TypeScript enums mirroring Prisma enums (for use in DTOs/services):

```typescript
export enum AgentType {
  ROUTER = 'ROUTER',
  PLAN = 'PLAN',
  ARCHITECT = 'ARCHITECT',
  CODE = 'CODE',
  PRE_VERIFY = 'PRE_VERIFY',
  POST_VERIFY = 'POST_VERIFY',
}

export enum MemoryOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  MIXED = 'MIXED',
  BLOCKED = 'BLOCKED',
  ABANDONED = 'ABANDONED',
}
```

Plus interfaces: `AgentMemoryEntry`, `MemoryQueryResult`, `PatternSummary`, `MemorySummary`.

**File:** `backend/src/memory/interfaces/scoring-weights.constant.ts`

```typescript
export const MEMORY_SCORING_WEIGHTS = {
  agentType: 0.3,
  taskType: 0.2,
  domain: 0.15,
  exactContextMatch: 0.1,
  sameProject: 0.1,
  baseline: 0.15,
} as const;
```

---

#### Step B2: DTOs (3 files)

- **`backend/src/memory/dto/create-memory.dto.ts`**
  - Required: `agentType` (`@IsEnum(AgentType)`), `taskType` (`@IsString() @IsNotEmpty()`), `outcome` (`@IsEnum(MemoryOutcome)`), `success` (`@IsBoolean()`)
  - Optional: `decision`, `confidence` (`@IsNumber() @Min(0) @Max(1)`), `context`, `lessonsLearned`, `domain`, `technology`, `sourceExecutionId`, `sourcePhaseId`

- **`backend/src/memory/dto/query-memory.dto.ts`**
  - Query params: `agentType?` (`@IsOptional() @IsEnum(AgentType)`), `taskType?`, `domain?`, `success?`, `contextJson?` (stringified JSON for similarity matching), `minConfidence?`

- **`backend/src/memory/dto/top-patterns.dto.ts`**
  - Query params: `agentType?`, `success?` (`@IsOptional() @IsBoolean()`), `taskType?`, `limit?` (`@IsOptional() @IsInt() @Min(1) @Max(50)`, default 10)

---

#### Step B3: MemoryService

**File:** `backend/src/memory/services/memory.service.ts`

| Method | Description |
|--------|-------------|
| `createMemory(dto)` | Creates single AgentMemory. Uses `upsert` on `@@unique([sourceExecutionId, agentType])` if sourceExecutionId present, else `create`. |
| `createFromExecution(executionId)` | Reads AgentExecution + phases → creates 1 AgentMemory per agent type present in the execution. Derives outcome, success, lessons from phase/execution data. |
| `querySimilar(params)` | Filters by `agentType`/`taskType` if provided. Computes `APPLICABILITY = SIMILARITY × OUTCOME_WEIGHT × DECAY_WEIGHT`. Similarity uses `MEMORY_SCORING_WEIGHTS` config. Returns scored results sorted desc. |
| `getTopPatterns(agentType?, success?, limit?)` | Groups by `(taskType, domain)`, aggregates success rate. Returns top limit patterns sorted by success rate desc (for successful) or asc (for failed). |
| `getSummary(agentType?)` | Counts by agentType, total, active (referenced last 180d), stale (expired), per-domain breakdown. |
| `decayAll()` | `decayWeight *= e^(-ln(2)/12)`. Monthly half-life. |
| `cleanupStale()` | Delete where `decayWeight < 0.1 AND createdAt < 2 years`. |

**Deriving lessons from ExecutionPhase data:**
- ROUTER phase → `"Routed '{requestSummary}' to {routerRoute}"`
- PRE_VERIFY with BLOCK → `"Pre-verify blocked: {preVerifyFlags}"`
- PRE_VERIFY with FLAG → `"Pre-verify flagged: {preVerifyFlags}"`
- CODE with retry > 0 → `"Code required {codeAttempts} attempts"`
- POST_VERIFY with FAIL → `"Post-verify failed: {postVerifyIssues}"`
- ARCH with revision needed → `"Architecture revision needed"`
- Default → `"{agentType} phase completed with outcome {finalOutcome}"`

---

#### Step B4: Context Retrieval Controller

**File:** `backend/src/memory/memory.controller.ts`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/memories` | JWT | Create single memory entry |
| GET | `/memories/similar` | JWT | Query similar memories with applicability scores |
| GET | `/memories/patterns/successful` | JWT | Top successful patterns |
| GET | `/memories/patterns/failed` | JWT | Top failed patterns |
| GET | `/memories/summary` | JWT | Aggregate memory stats |
| POST | `/memories/from-execution/:executionId` | JWT | Create memories from execution trace (manual trigger) |

**Route ordering:** Static routes before parameterized routes (established pattern from recommendation/evaluation controllers).

---

#### Step B5: Module Registration

**File:** `backend/src/memory/memory.module.ts`

```typescript
@Module({
  imports: [ScheduleModule],
  controllers: [MemoryController],
  providers: [MemoryService, MemoryScheduler],
  exports: [MemoryService],
})
export class MemoryModule {}
```

**File:** `backend/src/app.module.ts` (edit)

Add `MemoryModule` to imports array (after `RecommendationModule`, before `EvaluationModule`).

---

#### Step B6: Scheduler

**File:** `backend/src/memory/schedulers/memory.scheduler.ts`

Two jobs:
- `@Cron('0 3 * * *')` — `decayAll()` (daily at 3AM)
- `@Cron('5 3 * * *')` — `cleanupStale()` (daily at 3:05AM, 5 min after decay)

No hourly polling of executions — memory creation is event-driven (see Phase C).

---

### Phase C — Evaluation Harness Integration (1 step)

#### Step C1: Wire memory creation on COMMITTED

**File:** `backend/src/evaluation/evaluation.module.ts` (edit)

Import `MemoryModule`.

**File:** `backend/src/evaluation/services/metric.service.ts` (edit)

Inject `MemoryService`. Add a new method:

```typescript
async onExecutionCommitted(executionId: string) {
  await this.memoryService.createFromExecution(executionId);
}
```

Call this from:
- `ExecutionTraceService.create()` — when `finalOutcome === 'COMMITTED'`
- Or decoupled via a dedicated hook in the controller after execution creation

**Design choice:** Keep it simple — call `onExecutionCommitted()` from `ExecutionTraceService.create()` when the execution is created with `COMMITTED` outcome. For executions that transition TO `COMMITTED` via a phase update, call from the `addPhase()` path when the outcome transitions.

---

### Phase D — Data Migration (3 steps)

#### Step D1: Migration script

**File:** `backend/prisma/migrate-decision-memory.ts`

Standalone PrismaClient script that:

1. Reads all `DecisionMemory` records
2. Maps each to `AgentMemory`:
   - `agentType` = `PLAN` (Ask agent is a planning agent)
   - `taskType` = `RECOMMENDATION_ASSESSMENT`
   - `outcome` = map `SUCCESS→SUCCESS, MIXED→MIXED, FAILURE→FAILURE, ABANDONED→ABANDONED`
   - `success` = `outcome === 'SUCCESS'`
   - `context` = existing `contextFactors` JSON
   - `decision` = `technology` (the recommended option)
   - `domain` = existing `domain`
   - `technology` = existing `technology`
   - `projectId` = existing `projectId`
   - `decayWeight` = existing `decayWeight`
   - `referenceCount` = existing `referenceCount`
   - `lessonsLearned` = derive from `successFactors` + `failureFactors`
3. Creates `AgentMemory` records with `upsert` on `(sourceExecutionId=recommendationId, agentType=PLAN)`
4. Prints migration summary: total processed, succeeded, failed

Verify: `SELECT count(*) as migrated FROM agent_memories WHERE source_execution_id IS NOT NULL` matches `SELECT count(*) FROM decision_memories`

---

#### Step D2: DecisionMemoryService refactor

**File:** `backend/src/recommendation/services/decision-memory.service.ts` (edit)

- Inject `MemoryService`
- `createFromAssessment()` now:
  1. Validates recommendation state (same as before)
  2. Creates `AgentMemory` via `memoryService.createMemory()` with agentType=`PLAN`
  3. Still creates `DecisionMemory` for backward compatibility (temporary dual-write)
  4. Emits deprecation warning log
- `queryWithApplicability()` delegates to `memoryService.querySimilar()`
- `getDomainSummary()` can be deprecated in favor of `memoryService.getSummary('PLAN')`

**Test update:** `backend/src/recommendation/__tests__/decision-memory.service.spec.ts` (edit)
- Update mocks to include `MemoryService`
- Verify both `AgentMemory` and `DecisionMemory` are created
- Verify delegation calls

---

#### Step D3: Mark DecisionMemory deprecated in Prisma

Added in Step A3. Add code-level suppression warnings:

In `decision-memory.service.ts`:
```typescript
// @deprecated — Use AgentMemory via MemoryService instead. TASK-029.
// This service creates both AgentMemory (canonical) and DecisionMemory (compat).
```

---

### Phase E — Testing (3 steps)

#### Step E1: MemoryService unit tests

**File:** `backend/src/memory/__tests__/memory.service.spec.ts`

Test suites:
- `createMemory()` — happy path, duplicate prevention via unique constraint, missing optional fields
- `createFromExecution()` — ROUTER-only execution, full execution with 6 phases, execution with BLOCKED outcome, lessons extraction correctness
- `querySimilar()` — exact match on agentType+taskType, partial match, empty DB, FAILURE outcome with lower weight, FAILURE outcome weight=0.2, decay weight applied
- `getTopPatterns()` — top successful returns highest success rate, top failed returns lowest, agentType filter, domain filter
- `getSummary()` — counts correct, active/stale computed correctly
- `decayAll()` — decay factor applied to all, no error on empty
- `cleanupStale()` — only removes old+decayed entries, preserves recent entries

#### Step E2: MemoryController unit tests

**File:** `backend/src/memory/__tests__/memory.controller.spec.ts`

- Each endpoint returns correct HTTP status
- DTO validation errors (invalid enum values, missing required fields)
- Error propagation (NotFoundException, ConflictException)

#### Step E3: Migration script test

**File:** `backend/prisma/__tests__/migrate-decision-memory.spec.ts` (optional)

Or manual verification checklist:
- [ ] Run `npx tsx prisma/migrate-decision-memory.ts` against seeded DB
- [ ] Verify `AgentMemory` count matches `DecisionMemory` count
- [ ] Verify fields mapped correctly (spot check 3 records)

---

### Phase F — Build & Verification (3 steps)

#### Step F1: Seed sample data

**File:** `backend/prisma/seed-evaluations.ts` (edit)

Add minimal `AgentMemory` sample entries (3–5 records) covering different agent types:
- One ROUTER memory (from SYNTH-001)
- One PLAN memory (from SYNTH-003)
- One CODE memory (from SYNTH-002 with retry)
- One PRE_VERIFY memory (from SYNTH-004 with BLOCK)
- One POST_VERIFY memory (from SYNTH-005)

Not dependent on execution traces — directly inserts into `agent_memories` table.

#### Step F2: Build & Test

```bash
cd backend && npm run build
npx jest --passWithNoTests
```

#### Step F3: Update Work Queue

**File:** `.kilo/docs/work_queue.md` (edit)

Add `TASK-029` entry with file counts, test results, verification status.

---

## 4. File Summary

| # | File | Action |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Edit — add AgentType enum, MemoryOutcome enum, AgentMemory model, deprecation comment on DecisionMemory |
| 2 | `backend/src/memory/interfaces/agent-memory.interface.ts` | New — TS enums + interfaces |
| 3 | `backend/src/memory/interfaces/scoring-weights.constant.ts` | New — MEMORY_SCORING_WEIGHTS config |
| 4 | `backend/src/memory/dto/create-memory.dto.ts` | New |
| 5 | `backend/src/memory/dto/query-memory.dto.ts` | New |
| 6 | `backend/src/memory/dto/top-patterns.dto.ts` | New |
| 7 | `backend/src/memory/services/memory.service.ts` | New |
| 8 | `backend/src/memory/memory.controller.ts` | New |
| 9 | `backend/src/memory/memory.module.ts` | New |
| 10 | `backend/src/memory/schedulers/memory.scheduler.ts` | New |
| 11 | `backend/src/memory/__tests__/memory.service.spec.ts` | New |
| 12 | `backend/src/memory/__tests__/memory.controller.spec.ts` | New |
| 13 | `backend/src/evaluation/evaluation.module.ts` | Edit — import MemoryModule |
| 14 | `backend/src/evaluation/services/metric.service.ts` | Edit — add onExecutionCommitted() |
| 15 | `backend/src/recommendation/services/decision-memory.service.ts` | Edit — inject MemoryService, delegate, dual-write |
| 16 | `backend/src/recommendation/__tests__/decision-memory.service.spec.ts` | Edit — update mocks for MemoryService |
| 17 | `backend/src/app.module.ts` | Edit — register MemoryModule |
| 18 | `backend/prisma/migrate-decision-memory.ts` | New — migration script |
| 19 | `backend/prisma/seed-evaluations.ts` | Edit — add AgentMemory sample seeds |
| 20 | `.kilo/docs/work_queue.md` | Edit |

**Total: 20 file changes (12 new, 8 edits)**

---

## 5. Dependencies

| Step | Depends On | Type |
|------|-----------|------|
| A1–A3 (Schema) | PostgreSQL running | Hard |
| B1 (Interfaces) | A2 (enum types) | Hard |
| B2 (DTOs) | B1 (TS enums) | Hard |
| B3 (MemoryService) | A2 (Prisma client), B2 (DTOs), B1 (weights) | Hard |
| B4 (Controller) | B3 (service) | Hard |
| B5 (Module) | B3 + B4 + B6 | Hard |
| B6 (Scheduler) | B3 (service methods) | Hard |
| C1 (Eval integration) | B5 (MemoryModule export) | Hard |
| D1 (Migration script) | A2 (AgentMemory table exists) | Hard |
| D2 (Refactor DecisionMemory) | B3 + C1 + D1 | Hard |
| E1–E2 (Tests) | B3 + B4 | Soft |
| E3 (Migration test) | D1 | Soft |
| F1 (Seed) | A2 (table exists) | Hard |
| F2 (Build) | All implementation | Hard |

---

## 6. Risks

| Risk | Probability | Impact | Handling |
|------|-----------|--------|---------|
| Prisma enum migration with existing data | Low | High | `prisma migrate dev` handles enum creation; existing string data won't auto-map — migration script handles this |
| Dual-write in DecisionMemoryService slows assessment flow | Low | Low | Both writes are fast Prisma upserts; no external calls |
| Migration script misses field mappings | Low | Medium | Verify: spot-check 3 migrated records. Automated count check in script |
| Route capture in controller | Low | High | All static routes before `:id` params (established pattern) |
| Circular dependency if MemoryModule imports EvaluationModule | Low | High | MemoryModule does NOT import EvaluationModule. MemoryService accepts executionId as string — no direct dependency. |
| DecisionMemory removal cleanup deferred indefinitely | Medium | Low | File F3: work queue entry explicitly notes "DecisionMemory deprecated — pending removal ADR" |

---

## 7. Escalations

| Issue | Escalate To | Trigger |
|-------|-------------|---------|
| DecisionMemory removal timing | Planner + Human | When to schedule removal ADR and cleanup task |
| Schema line count exceeds 500 | Architect | prisma-conventions.rules.md §7 — extract to separate file |
| ADR needed for memory module architecture | Architect | If memory module becomes cross-cutting beyond a simple service |

---

## 8. Success Criteria

- [ ] A1–A3: Migration created and applied — `agent_memories` table with enum columns
- [ ] A1–A3: `npx prisma generate` — client regenerated without errors
- [ ] B1–B6: 10 new files in `backend/src/memory/`
- [ ] B3: `MemoryService.createFromExecution()` creates 1+ AgentMemory per execution
- [ ] B3: Applicability scoring uses `MEMORY_SCORING_WEIGHTS` config (not hard-coded weights)
- [ ] B4: 6 API endpoints operational
- [ ] C1: Committed execution → `onExecutionCommitted()` → AgentMemory created (no hourly scan)
- [ ] D1: Migration script maps all DecisionMemory → AgentMemory with correct field mapping
- [ ] D2: DecisionMemoryService continues to work; creates both models temporarily
- [ ] F2: `npm run build` — zero errors
- [ ] F2: All existing tests pass (including updated decision-memory tests)
- [ ] F2: New memory module tests pass (≥80% service coverage)
- [ ] F3: Work queue updated

---

## 9. Gap Coverage

| Gap | Coverage | How |
|-----|----------|-----|
| GAP-KNOW-004 | ✅ Full | AgentMemory stores every agent decision with outcome. Context retrieval enables "what worked before" queries. |
| GAP-COG-002 | ✅ Partial | First-class Memory module. Remaining: full cognitive architecture (orchestrator, context manager). |
| GAP-COG-003 | ✅ Partial | Context-aware retrieval with configurable scoring weights. Remaining: live context management. |
| B4 Knowledge API | 🏗 Foundation | Context retrieval + top patterns endpoints are the foundation for batch knowledge queries. |
| E4 Metrics Loop | 🏗 Foundation | Execution outcome → Memory → Planning feedback loop established. Remaining: Planner ingestion of memories. |

---

**End of Plan**
