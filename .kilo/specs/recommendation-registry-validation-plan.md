/* @lifecycle ACTIVE — TASK-020 Validation & Hardening Plan */

# Recommendation Registry Validation & Hardening Plan v1.0

**Spec For:** TASK-020
**Prerequisite:** TASK-019 (Implementation)
**Status:** Draft
**Last Updated:** 2026-06-07

---

## Current State Assessment

The Recommendation Registry was implemented in TASK-019 (16 source files, 6 new Prisma models) but has **never been compiled, migrated, or tested**. Multiple critical gaps exist between "implemented" and "production-validated."

### Gap Analysis

| Dimension | Status | Risk |
|-----------|--------|------|
| Source Code | ✅ Written (16 files) | — |
| Dependency `@nestjs/schedule` | ❌ **Missing** | Build will fail on import |
| Prisma Migration | ❌ **Never applied** | No database tables exist |
| Prisma Client Generation | ❌ **Never run** | TypeScript cannot resolve Prisma types |
| TypeScript Compilation | ❌ **Never run** | Unknown number of type errors |
| Unit Tests | ❌ **Zero tests** | No coverage |
| Integration Tests | ❌ **Zero tests** | No lifecycle validation |
| Build Validation | ❌ **Never run** | Unknown build status |
| CI Pipeline | ❌ **None** | No automated gates |
| Work Queue | ❌ **Not updated** | TASK-019/020 not recorded |
| Runtime Spec Doc | ❌ **Missing from disk** | No persisted design reference |
| Known Bugs | ⚠️ 2 identified in accuracy.service.ts | Wrong function calls in createSnapshot |

### Known Bugs (Pre-Validation)

**Bug 1 — `accuracy.service.ts` line ~270: `reversalRate` computation passes arrow function instead of array**
```
// Current (broken):
reversalRate: await this.computeReversalRate(all => all),

// Should be:
reversalRate: this.computeReversalRate(allRecommendations),
```
Impact: `AccuracySnapshot` creation will crash or produce NaN.

**Bug 2 — `accuracy.service.ts` line ~263-265: `falsePositiveRate` computation uses warning text instead of actual metric**
```
// Current (broken — checks if warning string exists instead of using computed value):
falsePositiveRate: metrics.warnings.find(...) ? undefined : null,

// Should be:
falsePositiveRate: metrics.falsePositiveRate,
```
Impact: `AccuracySnapshot` stores `null`/`undefined` for false positive rate instead of the computed value.

---

## Phase 1 — Infrastructure Validation

### 1.1 Dependency Audit

| Dependency | Required By | Status | Action |
|------------|-------------|--------|--------|
| `@nestjs/schedule` | checkpoint.scheduler.ts, accuracy.scheduler.ts | ❌ **Missing** | `npm install @nestjs/schedule` |
| `@prisma/client` | All services (PrismaService) | ⚠️ Present but stale | `prisma generate` after migration |
| `class-validator` | DTOs | ✅ Present | — |
| `class-transformer` | DTOs | ✅ Present | — |

**Task 1.1.1:** Install `@nestjs/schedule`
```bash
cd backend && npm install @nestjs/schedule
```

**Task 1.1.2:** Verify `ScheduleModule.forRoot()` is properly configured in `recommendation.module.ts`

### 1.2 Prisma Migration Plan

**Current state:** `backend/prisma/migrations/` directory does not exist. No migration has been run.

**Task 1.2.1:** Start PostgreSQL
```bash
cd backend && docker compose up -d
```

**Task 1.2.2:** Apply migration
```bash
cd backend && npx prisma migrate dev --name add_recommendation_registry
```

**Task 1.2.3:** Generate Prisma client
```bash
cd backend && npx prisma generate
```

**Task 1.2.4:** Verify all 6 new tables exist
```
Tables to verify:
- recommendations
- recommendation_options
- checkpoints
- decision_memories
- trust_scores
- accuracy_snapshots
```

### 1.3 Build Validation

**Task 1.3.1:** First-pass build attempt
```bash
cd backend && npm run build
```

**Expected compilation issues (non-exhaustive):**
- `@nestjs/schedule` missing → compiler error on `ScheduleModule`, `@Cron`, `CronExpression`
- Prisma types missing → compiler error on Prisma model references
- Any import path mismatches

**Task 1.3.2:** Fix compilation errors iteratively until `npm run build` exits with code 0

**Task 1.3.3:** Verify `dist/` output contains all compiled files:
- `dist/src/recommendation/*.js`
- `dist/src/recommendation/services/*.js`
- `dist/src/recommendation/schedulers/*.js`

### 1.4 Scheduler Validation

Schedulers depend on `@nestjs/schedule` and NestJS lifecycle hooks. Validation steps:

**Task 1.4.1:** Verify `ScheduleModule.forRoot()` is imported in `recommendation.module.ts` (✅ done)

**Task 1.4.2:** Verify each `@Cron()` decorator uses valid `CronExpression` enum values:
| Scheduler | Cron Expression | Purpose |
|-----------|----------------|---------|
| `checkpoint.scheduler.ts` | `EVERY_DAY_AT_2AM` | Process due checkpoints |
| `checkpoint.scheduler.ts` | `EVERY_DAY_AT_3AM` | Decay decision memory |
| `accuracy.scheduler.ts` | `EVERY_DAY_AT_1AM` | Accuracy snapshot + trust score recalc |

**Task 1.4.3:** Verify no overlapping cron times (1AM, 2AM, 3AM — safe, sequential)

**Task 1.4.4:** Error handling review:
- `checkpoint.scheduler.processDueCheckpoints()` — has try/catch per checkpoint with individual error logging
- `accuracy.scheduler.dailyAccuracyUpdate()` — has try/catch per operation
- `checkpoint.scheduler.decayMemory()` — NO error handling (should wrap in try/catch)

### 1.5 CI Impact Assessment

**Current CI state:** No CI configuration exists (no `.github/workflows/`, no `.gitlab-ci.yml`)

**Impact on future CI:**
- New Prisma migrations must run before tests
- `@nestjs/schedule` adds a runtime dependency
- Test suite must include module initialization (ScheduleModule.forRoot())
- 6 new database tables extend migration time

**Task 1.5.1:** Document CI requirements in `.kilo/docs/ci-requirements.md` (out of scope for this task)

---

## Phase 2 — Functional Validation

### 2.1 Recommendation Lifecycle Testing

Test the full CRUD lifecycle for recommendations:

```
CREATE → READ → LIST/FILTER → UPDATE STATUS → FIND BY recId → DELETE
```

**Test 2.1.1:** Create a recommendation with all fields populated
- Input: Valid `CreateRecommendationDto` with 2 options
- Expected: 201 Created, returns recommendation with nested options
- Validate: recId uniqueness, timestamps, default trackingStatus=PENDING

**Test 2.1.2:** Create duplicate recommendation (same recId)
- Expected: 409 Conflict

**Test 2.1.3:** Create recommendation with minimum required fields only
- Expected: 201 Created, nulls for optional fields

**Test 2.1.4:** List recommendations with pagination
- Verify skip/take works, default take=20

**Test 2.1.5:** Filter by mode, decisionType, decisionDomain, trackingStatus
- Each filter returns correct subset

**Test 2.1.6:** Get nonexistent recommendation by UUID
- Expected: 404 NotFound

**Test 2.1.7:** Count by status
- Create recs in different states, verify counts

### 2.2 Checkpoint Lifecycle Testing

```
PENDING → updateStatus(IN_PROGRESS) → checkpoints created (30D, 90D, 180D)
  → assess 30D → assess 90D → assess 180D → auto ASSESSED + finalOutcome
```

**Test 2.2.1:** Transition PENDING → IN_PROGRESS creates 3 checkpoint records
- Verify scheduleAt dates: now+30d, now+90d, now+180d
- Verify checkpoint values: '30D', '90D', '180D'

**Test 2.2.2:** Assess all 3 checkpoints → auto-transitions to ASSESSED
- Assign verdicts: ON_TRACK → ON_TRACK → ON_TRACK → finalOutcome = SUCCESS

**Test 2.2.3:** Mixed verdicts → correct finalOutcome
- Test combinations: [FAILED, _, _] → FAILURE; [PROBLEM, _, _] → MIXED; [CONCERN, _, _] → MIXED

**Test 2.2.4:** Assess checkpoint for nonexistent recommendation → 404

**Test 2.2.5:** Find due checkpoints
- Create IN_PROGRESS rec, manually set one checkpoint scheduleAt in the past
- `findDueCheckpoints()` returns it

**Test 2.2.6:** Auto-assess placeholder returns LOW confidence message

### 2.3 Trust Score Recalculation Testing

Bayesian formula validation:

```
TRUST(d, c) = (SUCCESSES(d, c) + α) / (TOTAL(d, c) + α + β)
```

**Test 2.3.1:** No assessed recommendations → trust scores = prior
- All decision types return their prior trust values (e.g., TC=80%, GLOBAL=60%)

**Test 2.3.2:** Single assessed recommendation (SUCCESS, TC)
- Compute: (1 + 8) / (1 + 8 + 2) = 9/11 = 81.8%
- Verify GLOBAL and TC trust scores updated

**Test 2.3.3:** Single assessed recommendation (FAILURE, BB)
- Compute: (0 + 6) / (1 + 6 + 4) = 6/11 = 54.5%

**Test 2.3.4:** Multiple recommendations, same domain
- 3 SUCCESS + 1 FAILURE in "queue-system" domain
- Verify DOMAIN-level trust score computed correctly

**Test 2.3.5:** Recalculate all levels
- `recalculateAll()` updates GLOBAL, DECISION_TYPE, and DOMAIN levels

**Test 2.3.6:** Confidence interval computation
- score=80%, n=10 → 80% ± 24.8%
- score=80%, n=100 → 80% ± 7.8%
- score=80%, n=0 → 0-100

**Test 2.3.7:** Display labels
- >90 → VERY HIGH, 75-89 → HIGH, 60-74 → MODERATE, 40-59 → LOW, <40 → UNTRUSTED

### 2.4 Decision Memory Generation Testing

**Test 2.4.1:** Create decision memory from ASSESSED recommendation (SUCCESS)
- Verify memoryId format: MEM-{timestamp}-{hash:6}
- Verify domain, technology, outcome populated correctly
- Verify expiresAt = createdAt + 2 years

**Test 2.4.2:** Create from ASSESSED recommendation (ABANDONED)
- Expected: null (skipped, returns null)

**Test 2.4.3:** Create from non-ASSESSED recommendation
- Expected: Error thrown

**Test 2.4.4:** Query by domain
- Create memories in 2 domains, query 1 → returns correct subset

**Test 2.4.5:** Applicability scoring
- Same tech stack → +0.30 similarity
- Different tech stack, same domain → 0.15 similarity (baseline)
- SUCCESS outcome weight = 1.0, FAILURE = 0.2
- Old memory (low decayWeight) → lower applicability

**Test 2.4.6:** Domain summary returns counts and staleness info

### 2.5 Ask Ingestion Testing

**Test 2.5.1:** Parse valid structured record from Ask output
```
---RECOMMENDATION-RECORD---
rec_id: REC-20260607-a1b2c3d4
mode: ADVISOR
decision_type: TC
decision_domain: queue-system
query_summary: "Should we use BullMQ?"
recommended_option: BullMQ
confidence_level: HIGH
confidence_score: 82
---END-RECORD---
```
Expected: 8 fields extracted

**Test 2.5.2:** Parse text with no structured record
- Expected: null, no crash

**Test 2.5.3:** Parse text with missing required fields (missing `confidence_score`)
- Expected: null, warning logged

**Test 2.5.4:** Full ingest flow: Ask output text → recommendation created
- `POST /recommendations/ask-ingest` with valid text → 201 with recommendation

**Test 2.5.5:** Ingest with invalid confidence_score (NaN)
- Expected: null, error logged

---

## Phase 3 — Reliability Validation

### 3.1 Scheduler Failure Scenarios

| Scenario | Expected Behavior | Current Handling |
|----------|-------------------|------------------|
| Database unreachable during checkpoint processing | Error logged per checkpoint, other checkpoints continue | ✅ try/catch per iteration |
| Database unreachable during accuracy snapshot | Error logged, no crash | ✅ try/catch per operation |
| Database unreachable during memory decay | No error handling → **CRASH** | ❌ **No try/catch** |
| Single checkpoint assessment throws | Other checkpoints still process | ✅ try/catch per checkpoint |
| Scheduler fires but no due checkpoints | Returns empty array, logs "Found 0 due checkpoint(s)" | ✅ |

**Task 3.1.1:** Add try/catch to `checkpoint.scheduler.decayMemory()`

### 3.2 Missing Checkpoint Scenarios

| Scenario | Expected Behavior | Risk |
|----------|-------------------|------|
| Recommendation stuck IN_PROGRESS, no checkpoints ever assessed | Stays IN_PROGRESS forever, no final outcome | Low — manual override via API |
| Checkpoint missed (scheduler down for 2 days) | Next cron picks it up (scheduleAt <= now) | Low — no hard deadline |
| Only 2 of 3 checkpoints assessed | `checkAndTransition` sees not all done → does nothing | Correct |
| Checkpoint scheduleAt set far in future (e.g., year 3000) | Never fires, recommendation stuck IN_PROGRESS | Low — edge case |

### 3.3 Invalid Payload Scenarios

| Scenario | DTO Validation | Expected HTTP |
|----------|---------------|---------------|
| Empty body | `class-validator` rejects all required fields | 400 Bad Request |
| `confidenceScore: -1` | `@Min(0)` rejects | 400 |
| `confidenceScore: 101` | `@Max(100)` rejects | 400 |
| `weightedScore: 6` | `@Max(5)` rejects | 400 |
| Invalid UUID for `:id` param | Prisma throws, caught by global filter | 400/500 |
| `trackingStatus: 'INVALID'` | No enum validation on PATCH body | **Accept any string** ⚠️ |
| `mode: ''` | `@IsString()` passes empty string | **Accept empty strings** ⚠️ |

**Known Gap 1 — PATCH /:id/status:** `trackingStatus` is validated as a plain `@Body('trackingStatus') string` with no `class-validator` decorator. It accepts any string, including `'INVALID'`.

**Known Gap 2 — Empty strings:** `@IsString()` in DTOs accepts empty strings. Should add `@IsNotEmpty()` for required fields.

### 3.4 Large Volume Testing

| Scenario | Volume | Metric |
|----------|--------|--------|
| Bulk create | 1000 recommendations (sequential) | Time < 30s, no timeout |
| List with pagination | 1000 records | Page load < 500ms |
| Compute metrics | 1000 ASSESSED recs | Query < 5s |
| Recalculate trust scores | 10 domains, 1000 recs | Query < 10s |
| Executive review | 1000 recs | Generation < 10s |

**Implementation note:** The `computeMetrics()` and `recalculateAll()` queries currently load ALL assessed recommendations into memory (no pagination, no aggregation in SQL). This will become a problem at >10,000 recommendations.

### 3.5 Trust Score Edge Cases

| Scenario | Expected | Risk |
|----------|----------|------|
| 0 assessed recommendations | All scores = prior (no data) | ✅ Correct |
| 1 assessed rec, SUCCESS, TC | TC trust = (1+8)/(1+8+2) = 81.8% | ✅ Correct |
| 1 assessed rec, FAILURE, TC | TC trust = (0+8)/(1+8+2) = 72.7% | ✅ Correct |
| 1000 SUCCESS, 0 FAILURE | Trust approaches 100% (but never reaches it due to prior) | ✅ Correct behavior |
| All MIXED outcomes | Count as 0.5 success each | ✅ Correct |
| Mixed SUCCESS and ABANDONED | ABANDONED counts as 0 | ✅ Correct |

---

## Phase 4 — Test Strategy

### 4.1 Unit Test Matrix

| # | Test File | Service | Test Cases | Priority |
|---|-----------|---------|------------|----------|
| UT01 | `recommendation.service.spec.ts` | `RecommendationService` | create (success, duplicate), findAll (pagination, filters), findById (found, not found), updateStatus (PENDING→IN_PROGRESS creates checkpoints, invalid transition), setFinalOutcome, remove, countByStatus | P0 |
| UT02 | `checkpoint.service.spec.ts` | `CheckpointService` | upsertCheckpoint (create, update, not found), findDueCheckpoints, findByRecommendationId, autoAssess, checkAndTransition (all verdict combinations) | P0 |
| UT03 | `trust-score.service.spec.ts` | `TrustScoreService` | recalculateAll (no data, single rec, multiple recs), getFiltered, getConfidenceInterval (various n), getDisplayLabel | P0 |
| UT04 | `accuracy.service.spec.ts` | `AccuracyService` | computeMetrics (no data, mixed outcomes, by confidence level, by decision type), computeTrend, computeBrierScore | P0 |
| UT05 | `decision-memory.service.spec.ts` | `DecisionMemoryService` | createFromAssessment (SUCCESS, FAILURE, ABANDONED, non-ASSESSED), findByDomain, queryWithApplicability, getDomainSummary, decayAll | P1 |
| UT06 | `executive-review.service.spec.ts` | `ExecutiveReviewService` | generateReport (empty, with data), top 10 extraction, lesson extraction | P1 |
| UT07 | `ask-ingest.service.spec.ts` | `AskIngestService` | parseStructuredRecord (valid, missing fields, no record), fieldsToDto (valid, missing required field, invalid confidence), ingestFromText | P1 |

### 4.2 Integration Test Matrix

| # | Test | Endpoints | Setup |
|----|------|-----------|-------|
| IT01 | Full recommendation lifecycle | POST, GET, PATCH, DELETE | Clean database |
| IT02 | Full checkpoint lifecycle | POST rec → PATCH status → POST checkpoint ×3 → auto ASSESSED | Seeded recommendation |
| IT03 | Trust score recalculation after outcome | POST recs → PATCH → POST checkpoints → POST recalculate | 5+ seeded recommendations |
| IT04 | Decision memory from assessed rec | Full lifecycle → verify decision_memories table | 1 seeded recommendation |
| IT05 | Ask ingestion flow | POST ask-ingest with structured text | Clean database |
| IT06 | Executive review with data | Full lifecycle on 15+ recommendations | 15+ seeded recommendations |
| IT07 | Accuracy dashboard with mixed outcomes | Create mix of SUCCESS/FAILURE/MIXED | 30+ seeded recommendations |

### 4.3 Seed Data Strategy

```typescript
// Fixture 1: Simple recommendation
const rec1 = {
  recId: 'REC-20260607-test-0001',
  mode: 'ADVISOR',
  decisionType: 'TC',
  decisionDomain: 'queue-system',
  querySummary: 'Should we use BullMQ for the job queue?',
  recommendedOption: 'BullMQ',
  weightedScore: 4.5,
  scoreMargin: 1.2,
  justification: 'BullMQ is mature, Redis-based, and native Node.js.',
  confidenceLevel: 'HIGH',
  confidenceScore: 82,
  options: [
    { label: 'A', description: 'BullMQ', score: 4.5 },
    { label: 'B', description: 'RabbitMQ', score: 3.3 },
  ],
};

// Fixture 2: Assessed recommendation (SUCCESS)
// Fixture 3: Assessed recommendation (FAILURE)
// Fixture 4: Pending recommendation (never implemented)
```

**Seed data patterns:**
- 3 recommendations per decision type (18 total minimum)
- 2 recommendations per domain (10+ domains)
- Mix of tracking statuses: 30% PENDING, 30% IN_PROGRESS, 40% ASSESSED
- Mix of outcomes: 60% SUCCESS, 20% MIXED, 15% FAILURE, 5% ABANDONED

### 4.4 Coverage Targets

Per Constitution §6 — Testing:
- **Service layer: ≥80% coverage** (mandatory)
- Statement coverage: ≥80%
- Branch coverage: ≥70%
- Function coverage: ≥90%

**Target files and minimum test count:**

| File | Lines | Min Tests | Priority |
|------|-------|-----------|----------|
| `recommendation.service.ts` | 177 | 10 | P0 |
| `checkpoint.service.ts` | 192 | 8 | P0 |
| `trust-score.service.ts` | 249 | 8 | P0 |
| `accuracy.service.ts` | 376 | 10 | P0 |
| `decision-memory.service.ts` | 238 | 7 | P1 |
| `executive-review.service.ts` | 192 | 4 | P1 |
| `ask-ingest.service.ts` | 147 | 6 | P1 |
| `recommendation.controller.ts` | 168 | 5 | P2 |

---

## Phase 5 — Production Readiness Review

### 5.1 Schema Review

**Recommendation model:**
| Field | Issue | Recommendation |
|-------|-------|----------------|
| `trackingStatus` | Default "PENDING", no enum validation at DB level | Prisma string, validated by application |
| All enum fields | `String` type, not Prisma enum | Acceptable — strings allow flexibility |

**Checkpoint model:**
| Field | Issue | Recommendation |
|-------|-------|----------------|
| `recommendationId_checkpoint` unique constraint | Ensures one 30D, one 90D, one 180D per rec | ✅ Correct |
| `risksMaterialized/Avoided/Missed` | `Json?` arrays | OK |

**DecisionMemory model:**
| Field | Issue | Recommendation |
|-------|-------|----------------|
| `domain_technology_projectId` unique constraint | Prevents duplicate entries for same project | ⚠️ Prisma unique with nullable — see below |

**⚠️ Critical Schema Issue — DecisionMemory unique constraint:**

```prisma
@@unique([domain, technology, projectId])
```

In PostgreSQL, `NULL != NULL` for unique constraints. Two entries with `projectId = null` and the same `domain + technology` would be allowed, but the upsert in `createFromAssessment()` uses the composite unique for the `where` clause. This means:
- Entry 1: `domain: "queue-system", technology: "BullMQ", projectId: null` — created
- Entry 2: `domain: "queue-system", technology: "BullMQ", projectId: null` — **upsert treats as different row** → creates duplicate instead of updating

**Fix:** The code already uses `projectId ?? '__global__'` in the upsert, but the database constraint still allows duplicates. Add a check and use a sentinel or change to `@@unique([domain, technology])`.

### 5.2 Index Review

Current indexes (Prisma auto-generates indexes for `@id`, `@unique`, and foreign keys):

| Table | Missing Indexes | Impact |
|-------|-----------------|--------|
| `recommendations` | `decision_type`, `decision_domain`, `tracking_status`, `(tracking_status, final_outcome)`, `created_at` | Filters scan full table |
| `checkpoints` | `schedule_at`, `(recommendation_id, evaluated_at)` | `findDueCheckpoints()` scans all |
| `decision_memories` | `domain` | Query by domain scans all |
| `accuracy_snapshots` | `snapshot_date` | `getLatestSnapshot()` scans all |

**Recommended indexes to add:**

```prisma
model Recommendation {
  @@index([decisionType])
  @@index([decisionDomain])
  @@index([trackingStatus])
  @@index([trackingStatus, finalOutcome])
  @@index([createdAt])
  @@index([decisionDomain, trackingStatus])
}

model Checkpoint {
  @@index([scheduleAt])
  @@index([recommendationId, evaluatedAt])
}

model DecisionMemory {
  @@index([domain])
  @@index([lastReferencedAt])
}

model AccuracySnapshot {
  @@index([snapshotDate])
}
```

### 5.3 Query Performance Review

| Endpoint | Query Pattern | N+1 Risk | Optimization |
|----------|--------------|----------|--------------|
| `GET /recommendations` | `findMany` with `include: { options: true, checkpoints: true }` | **YES** | Use `select` instead of `include` when not needed |
| `GET /recommendations/stats` | Loads ALL assessed recs into memory | **YES** | Refactor to SQL aggregation at scale |
| `PATCH status IN_PROGRESS` | 1 find + 3 upsert + 1 update = 5 queries | Moderate | Acceptable for now |

**Key Performance Risk:** `GET /recommendations/stats` loads all assessed recommendations into memory. At 10,000+ records this could exceed 100MB.

### 5.4 Scheduler Review

| Aspect | Assessment | Action |
|--------|------------|--------|
| Cron timing | 1AM, 2AM, 3AM daily | ✅ |
| Error handling in checkpoint scheduler | Per-checkpoint try/catch | ✅ |
| Error handling in accuracy scheduler | Per-operation try/catch | ✅ |
| Error handling in memory decay | **No try/catch** | ❌ Add wrapper |
| Idempotency | Daily cron is naturally idempotent | ✅ |
| Startup behavior | If DB is down, first run fails and retries next day | ⚠️ Acceptable |

**Task 5.4.1:** Add try/catch to `checkpoint.scheduler.decayMemory()`

### 5.5 Failure Recovery Review

| Failure | Impact | Recovery | Automation |
|---------|--------|----------|------------|
| Migration fails mid-way | Partial tables created | `prisma migrate dev` rolls back | ✅ |
| Cron misses 2 days | 2-day delayed assessment | Next cron catches up | ✅ |
| Database connection lost mid-request | 500 error | Retry from client | ⚠️ Manual |
| Wrong final outome set | Incorrect metrics | Manual PATCH | ⚠️ Human |

---

## Implementation Order

```
Phase 1: Infrastructure
  Fix Bug 1 + Bug 2 → Install @nestjs/schedule → prisma migrate + generate → npm run build

Phase 2+3: Tests + Reliability
  Write P0 unit tests → npm test → Fix reliability gaps → Write P1 unit tests

Phase 4+5: Integration + Review
  Write integration tests → Apply schema indexes → Add missing error handling → Final build + test → Update docs
```

---

## Task Checklist

### P0 — Critical Path

| # | Task | Type | Est. |
|---|------|------|------|
| 1 | Fix Bug 1: `accuracy.service.ts` `reversalRate` | Code fix | 5m |
| 2 | Fix Bug 2: `accuracy.service.ts` `falsePositiveRate` | Code fix | 5m |
| 3 | Install `@nestjs/schedule` dependency | Infra | 2m |
| 4 | Start Docker PostgreSQL | Infra | 1m |
| 5 | Run Prisma migration + generate | Infra | 5m |
| 6 | Run `npm run build`, fix compilation errors | Infra | 30m |
| 7 | Write `recommendation.service.spec.ts` (10 tests) | Test | 2h |
| 8 | Write `checkpoint.service.spec.ts` (8 tests) | Test | 1.5h |
| 9 | Write `trust-score.service.spec.ts` (8 tests) | Test | 1.5h |
| 10 | Write `accuracy.service.spec.ts` (10 tests) | Test | 2h |
| 11 | Run `npm test`, achieve ≥80% coverage | Validation | 30m |

### P1 — Functional Completeness

| # | Task | Type | Est. |
|---|------|------|------|
| 12 | Write `decision-memory.service.spec.ts` (7 tests) | Test | 1.5h |
| 13 | Write `executive-review.service.spec.ts` (4 tests) | Test | 1h |
| 14 | Write `ask-ingest.service.spec.ts` (6 tests) | Test | 1h |
| 15 | Add try/catch to `checkpoint.scheduler.decayMemory()` | Reliability | 5m |
| 16 | Fix DecisionMemory unique constraint (null projectId) | Schema | 15m |

### P2 — Production Readiness

| # | Task | Type | Est. |
|---|------|------|------|
| 17 | Add database indexes to Prisma schema | Schema | 15m |
| 18 | Apply index migration | Infra | 5m |
| 19 | Write integration tests (7 scenarios) | Test | 3h |
| 20 | Add `@IsNotEmpty()` to required DTO fields | Validation | 15m |
| 21 | Add enum validation for `PATCH /:id/status` | Validation | 10m |
| 22 | Create seed data script | Test | 1h |
| 23 | Create runtime spec doc | Docs | 30m |
| 24 | Update work queue | Docs | 5m |
| 25 | Final build + test run | Validation | 15m |

---

## Success Criteria

| Criterion | Current | Target |
|-----------|---------|--------|
| Migration succeeds | ❌ Not run | ✅ |
| Build succeeds (`npm run build` exit code 0) | ❌ Not run | ✅ |
| Unit tests pass (`npm test` exit code 0) | ❌ No tests | ✅ |
| P0 service coverage | 0% | ≥80% |
| Trust Score computation verified | ❌ Not verified | ✅ |
| Ask ingestion verified | ❌ Not tested | ✅ |
| Checkpoint lifecycle verified | ❌ Not tested | ✅ |
| Schedulers verified | ❌ Not compiled | ✅ |
| Known bugs fixed (Bug 1 + Bug 2) | ❌ Open | ✅ |
| DecisionMemory nullable unique fixed | ❌ Open | ✅ |
| Production risks documented | ❌ Missing | ✅ |

---

## Post-Validation State

After completing all phases:

```
State: PRODUCTION_VALIDATED
Lock: COMMITTED
Dependencies: @nestjs/schedule installed, Prisma migrated
Tests: 45+ unit tests, 7 integration scenarios
Coverage: ≥80% service layer
Bugs: 0 known (2 fixed)
Indexes: ~10 added
Docs: Runtime spec, work queue, API endpoints
```

---

**End of Document**
