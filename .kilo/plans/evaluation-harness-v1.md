/* @lifecycle ACTIVE — Execution Plan: Agent Evaluation Harness v1 (ADR-003) */

# Agent Evaluation Harness v1 — Implementation Plan

**Author:** Planner Agent
**Date:** 2026-06-08
**Status:** Ready for CODE
**ADR Reference:** docs/decisions/003-agent-evaluation-harness-v1.md

---

## 1. Overview

Implement Agent Evaluation Harness v1 per ADR-003: 4 Prisma models, ~18 files in `backend/src/evaluation/`, 7 API endpoints, metric computation (Router/Planner/Code/Debug), unit tests, seed data from historical tasks (TASK-001, TASK-021, TASK-022, TASK-A) plus 6 synthetic executions.

### Current state

| Item | Status |
|------|--------|
| Backend build | ✅ Zero errors |
| Existing tests (72 unit) | ✅ Pass |
| Prisma schema (10 models) | ✅ Recommendation registry exists |
| Evaluation module | ❌ Does not exist |
| PostgreSQL + Docker | ✅ Already running from prior tasks |

### Expected outcomes

1. 4 Prisma models: `AgentExecution`, `ExecutionPhase`, `AgentMetric`, `MetricDimension`
2. ~18 files in `backend/src/evaluation/` (module, controller, 5 services, 4 DTOs, interfaces, scheduler, 5 test specs)
3. 7 REST endpoints under `/api/v1/evaluations/` — all JWT-guarded
4. Metric computation engine: Router accuracy, Planner accuracy/revision rate, Code first-attempt/overall success, Debug success rate
5. 5 unit test suites (~45-50 tests total), all passing, ≥80% service coverage
6. Seed data: 10 execution traces with phase histories
7. Build zero errors, tests pass, work queue updated

---

## 2. Execution Steps

### Phase A — Schema & Module Foundation

---

#### Step A1: Add 4 Prisma Models to schema.prisma

**File:** `backend/prisma/schema.prisma`

Insert after the `AccuracySnapshot` model (line 284), before closing:

```prisma
// ─── Agent Evaluation Harness (ADR-003) ─────────────────────────────────────

model AgentExecution {
  id                      String    @id @default(uuid())
  executionId             String    @unique @map("execution_id")
  requestSummary          String    @map("request_summary")
  routerRoute             String    @map("router_route")
  routerConfidence        Float     @map("router_confidence")
  routerRisk              String    @map("router_risk")
  routerReason            String    @map("router_reason")
  planSummary             String?   @map("plan_summary")
  planTaskCount           Int?      @map("plan_task_count")
  archReviewed            Boolean   @default(false) @map("arch_reviewed")
  archRevisionNeeded      Boolean   @default(false) @map("arch_revision_needed")
  preVerifyDecision       String?   @map("pre_verify_decision")
  preVerifyFlags          Json?     @map("pre_verify_flags")
  codeAttempts            Int       @default(0) @map("code_attempts")
  codeFirstAttemptSuccess Boolean?  @map("code_first_attempt_success")
  postVerifyDecision      String?   @map("post_verify_decision")
  postVerifyIssues        Json?     @map("post_verify_issues")
  retryCount              Int       @default(0) @map("retry_count")
  debugSuccess            Boolean?  @map("debug_success")
  finalOutcome            String    @map("final_outcome")
  totalDurationMs         Int?      @map("total_duration_ms")
  committedAt             DateTime? @map("committed_at")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  phases ExecutionPhase[]

  @@index([finalOutcome])
  @@index([routerRoute])
  @@index([createdAt])
  @@index([routerRoute, finalOutcome])
  @@map("agent_executions")
}

model ExecutionPhase {
  id              String    @id @default(uuid())
  phaseId         String    @unique @map("phase_id")
  executionId     String    @map("execution_id")
  agentType       String    @map("agent_type")
  phaseOrder      Int       @map("phase_order")
  input           Json?     @map("input")
  output          Json?     @map("output")
  decision        String?   @map("decision")
  decisionReason  String?   @map("decision_reason")
  durationMs      Int?      @map("duration_ms")
  modelUsed       String?   @map("model_used")
  transitionedTo  String?   @map("transitioned_to")
  recordedAt      DateTime  @default(now()) @map("recorded_at")

  execution AgentExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId])
  @@index([agentType])
  @@index([executionId, phaseOrder])
  @@map("execution_phases")
}

model AgentMetric {
  id                    String   @id @default(uuid())
  agentType             String   @map("agent_type")
  metricName            String   @map("metric_name")
  metricValue           Float    @map("metric_value")
  sampleSize            Int      @map("sample_size")
  confidenceIntervalLow  Float?   @map("confidence_interval_low")
  confidenceIntervalHigh Float?   @map("confidence_interval_high")
  window                String   @map("window")
  computedAt            DateTime @map("computed_at")
  createdAt             DateTime @default(now()) @map("created_at")

  dimensions MetricDimension[]

  @@unique([agentType, metricName, window, computedAt])
  @@index([agentType])
  @@index([computedAt])
  @@map("agent_metrics")
}

model MetricDimension {
  id             String  @id @default(uuid())
  metricId       String  @map("metric_id")
  dimensionKey   String  @map("dimension_key")
  dimensionValue String  @map("dimension_value")
  count          Int     @map("count")
  value          Float   @map("value")

  metric AgentMetric @relation(fields: [metricId], references: [id], onDelete: Cascade)

  @@index([metricId])
  @@index([metricId, dimensionKey, dimensionValue])
  @@map("metric_dimensions")
}
```

**Commands:**
```bash
cd backend && npx prisma migrate dev --name add_evaluation_harness_v1
npx prisma generate
```

**Verify:** `npx prisma migrate status` — all migrations applied
**Fallback:** `npx prisma migrate resolve` on conflict

---

#### Step A2: Interfaces File

**File:** `backend/src/evaluation/interfaces/metric.interface.ts`

Following the `recommendation/` pattern — all enums and interfaces in one file:

```typescript
// @lifecycle ACTIVE — Evaluation harness TypeScript interfaces and enums

export enum RouterRoute {
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  LEVEL_3 = 'LEVEL_3',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum PreVerifyDecision {
  PASS = 'PASS',
  FLAG = 'FLAG',
  BLOCK = 'BLOCK',
}

export enum PostVerifyDecision {
  PASS = 'PASS',
  FLAG = 'FLAG',
  FAIL = 'FAIL',
  BLOCK = 'BLOCK',
}

export enum FinalOutcome {
  COMMITTED = 'COMMITTED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
  ABANDONED = 'ABANDONED',
}

export enum AgentPhaseType {
  ROUTER = 'ROUTER',
  PLAN = 'PLAN',
  ARCHITECT = 'ARCHITECT',
  PRE_VERIFY = 'PRE_VERIFY',
  CODE = 'CODE',
  POST_VERIFY = 'POST_VERIFY',
}

export enum AgentMetricType {
  ROUTER = 'ROUTER',
  PLANNER = 'PLANNER',
  CODE = 'CODE',
  DEBUG = 'DEBUG',
}

export enum MetricName {
  ACCURACY = 'ACCURACY',
  SUCCESS_RATE = 'SUCCESS_RATE',
  FIRST_ATTEMPT_RATE = 'FIRST_ATTEMPT_RATE',
  ESCALATION_RATE = 'ESCALATION_RATE',
  REVISION_RATE = 'REVISION_RATE',
}

export enum MetricWindow {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  ROLLING_7D = 'ROLLING_7D',
  ROLLING_30D = 'ROLLING_30D',
  ALL_TIME = 'ALL_TIME',
}

export interface MetricDimensionEntry {
  dimensionKey: string;
  dimensionValue: string;
  count: number;
  value: number;
}

export interface MetricSnapshot {
  agentType: string;
  metricName: string;
  metricValue: number;
  sampleSize: number;
  confidenceIntervalLow: number | null;
  confidenceIntervalHigh: number | null;
  window: string;
  computedAt: string;
  dimensions: MetricDimensionEntry[];
}

export interface ExecutionSummary {
  routerAccuracy: number | null;
  plannerAccuracy: number | null;
  plannerRevisionRate: number | null;
  codeFirstAttemptRate: number | null;
  codeOverallSuccess: number | null;
  debugSuccessRate: number | null;
  totalExecutions: number;
  computedAt: string;
}
```

---

#### Step A3: DTOs (4 files)

**File A3a:** `backend/src/evaluation/dto/create-execution.dto.ts`

```typescript
// @lifecycle ACTIVE — DTO for creating an execution trace

import {
  IsString, IsNotEmpty, IsOptional, IsNumber,
  IsInt, IsBoolean, IsArray, Min, Max,
} from 'class-validator';

export class CreateExecutionDto {
  @IsString() @IsNotEmpty()
  executionId: string;

  @IsString() @IsNotEmpty()
  requestSummary: string;

  @IsString() @IsNotEmpty()
  routerRoute: string;

  @IsNumber() @Min(0) @Max(1)
  routerConfidence: number;

  @IsString() @IsNotEmpty()
  routerRisk: string;

  @IsString() @IsNotEmpty()
  routerReason: string;

  @IsOptional() @IsString()
  planSummary?: string;

  @IsOptional() @IsInt() @Min(0)
  planTaskCount?: number;

  @IsOptional() @IsBoolean()
  archReviewed?: boolean;

  @IsOptional() @IsBoolean()
  archRevisionNeeded?: boolean;

  @IsOptional() @IsString()
  preVerifyDecision?: string;

  @IsOptional() @IsArray()
  preVerifyFlags?: string[];

  @IsOptional() @IsInt() @Min(0)
  codeAttempts?: number;

  @IsOptional() @IsBoolean()
  codeFirstAttemptSuccess?: boolean;

  @IsOptional() @IsString()
  postVerifyDecision?: string;

  @IsOptional() @IsArray()
  postVerifyIssues?: string[];

  @IsOptional() @IsInt() @Min(0)
  retryCount?: number;

  @IsOptional() @IsBoolean()
  debugSuccess?: boolean;

  @IsString() @IsNotEmpty()
  finalOutcome: string;

  @IsOptional() @IsInt() @Min(0)
  totalDurationMs?: number;

  @IsOptional()
  committedAt?: string;
}
```

**File A3b:** `backend/src/evaluation/dto/create-phase.dto.ts`

```typescript
// @lifecycle ACTIVE — DTO for recording an execution phase

import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsObject, Min,
} from 'class-validator';

export class CreatePhaseDto {
  @IsString() @IsNotEmpty()
  phaseId: string;

  @IsString() @IsNotEmpty()
  agentType: string;

  @IsInt() @Min(1)
  phaseOrder: number;

  @IsOptional() @IsObject()
  input?: Record<string, unknown>;

  @IsOptional() @IsObject()
  output?: Record<string, unknown>;

  @IsOptional() @IsString()
  decision?: string;

  @IsOptional() @IsString()
  decisionReason?: string;

  @IsOptional() @IsInt() @Min(0)
  durationMs?: number;

  @IsOptional() @IsString()
  modelUsed?: string;

  @IsOptional() @IsString()
  transitionedTo?: string;
}
```

**File A3c:** `backend/src/evaluation/dto/query-metrics.dto.ts`

```typescript
// @lifecycle ACTIVE — DTO for querying agent metrics

import { IsOptional, IsString } from 'class-validator';

export class QueryMetricsDto {
  @IsOptional() @IsString()
  agentType?: string;

  @IsOptional() @IsString()
  metricName?: string;

  @IsOptional() @IsString()
  window?: string;

  @IsOptional() @IsString()
  skip?: string;

  @IsOptional() @IsString()
  take?: string;
}
```

**File A3d:** `backend/src/evaluation/dto/query-executions.dto.ts`

```typescript
// @lifecycle ACTIVE — DTO for querying execution traces

import { IsOptional, IsString } from 'class-validator';

export class QueryExecutionsDto {
  @IsOptional() @IsString()
  routerRoute?: string;

  @IsOptional() @IsString()
  finalOutcome?: string;

  @IsOptional() @IsString()
  skip?: string;

  @IsOptional() @IsString()
  take?: string;

  @IsOptional() @IsString()
  from?: string;

  @IsOptional() @IsString()
  to?: string;
}
```

---

#### Step A4: Services (5 files)

**File A4a:** `backend/src/evaluation/services/execution-trace.service.ts`

CRUD for AgentExecution + ExecutionPhase. Methods:
- `create(dto)` — idempotency check on executionId, create record, handle JSONB via Prisma.InputJsonValue
- `findAll(params)` — paginated, filterable by routerRoute, finalOutcome; returns { items, total }
- `findByExecutionId(executionId)` — include phases in order; throw NotFoundException
- `addPhase(executionId, dto)` — find execution, create phase via execution.connect, handle JSONB
- `remove(id)` — find + delete (cascade handles phases)
- `countByOutcome()` — groupBy on finalOutcome, return zero-initialized map

**File A4b:** `backend/src/evaluation/services/router-evaluator.service.ts`

Router accuracy computation. Key logic:
- Outcome-consistent (counts as correct):
  - L1: codeAttempts > 0 AND finalOutcome = 'COMMITTED' (went straight to CODE and succeeded)
  - L2/L3: planTaskCount > 0 AND finalOutcome IN ('COMMITTED','BLOCKED') (plan was appropriate)
  - Default (unmatched): count as consistent (bias toward Router correctness)
- Outcome-inconsistent (counts as wrong):
  - L1: archReviewed = true OR preVerifyDecision = 'BLOCK' (needed escalation — route was too low)
- Ambiguous (not counted as wrong):
  - L3: codeAttempts = 1 AND planTaskCount <= 1 (possible over-classification)

Returns: { accuracy, totalRouted, outcomeConsistent, outcomeInconsistent, ambiguous, confidenceInterval, byRoute }

Imports getConfidenceInterval from ../../recommendation/utils/confidence-interval.util.

**File A4c:** `backend/src/evaluation/services/planner-evaluator.service.ts`

Two independent computations:
- computePlannerAccuracy(): (PASS + FLAG) / total plans with planTaskCount > 0
  - No pre-verify recorded = assumed accepted
- computeRevisionRate(): archRevisionNeeded / archReviewed

**File A4d:** `backend/src/evaluation/services/code-evaluator.service.ts`

Three independent computations:
- computeFirstAttemptRate(): codeFirstAttemptSuccess / codeAttempts >= 1
- computeOverallSuccess(): postVerifyDecision IN ('PASS','FLAG') / codeAttempts >= 1
- computeDebugSuccessRate(): debugSuccess AND retryCount = 1 / retryCount = 1

**File A4e:** `backend/src/evaluation/services/metric.service.ts`

Orchestration service. Methods:
- computeAll(window): Run all 5 evaluators, save each metric via saveMetric()
- getMetrics(filters): Query agent_metric with dimensions, paginated
- getSummary(): Fresh computation (not from stored metrics), return ExecutionSummary
- recomputeAll(window): Delete + recompute (idempotent)
- saveMetric(params): Create AgentMetric + optional MetricDimension records

---

#### Step A5: Controller

**File:** `backend/src/evaluation/evaluation.controller.ts`

```typescript
// @lifecycle ACTIVE — Evaluation harness REST controller

import {
  Controller, Get, Post, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ExecutionTraceService } from './services/execution-trace.service';
import { MetricService } from './services/metric.service';
// ... DTO imports ...
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationController {
  constructor(
    private readonly executionTraceService: ExecutionTraceService,
    private readonly metricService: MetricService,
  ) {}

  @Post('executions') createExecution(@Body() dto: CreateExecutionDto) { /* ... */ }
  @Get('executions') findAllExecutions(@Query() query: QueryExecutionsDto) { /* ... */ }
  @Get('executions/:executionId') findExecution(@Param('executionId') executionId: string) { /* ... */ }
  @Post('executions/:executionId/phases') addPhase(...) { /* ... */ }
  @Get('metrics') getMetrics(@Query() query: QueryMetricsDto) { /* ... */ }
  @Get('metrics/summary') getSummary() { /* ... */ }
  @Post('metrics/recalculate') recalculateMetrics() { /* ... */ }
}
```

Route ordering: Static routes (executions, metrics, metrics/summary, metrics/recalculate) BEFORE parameterized routes (executions/:executionId) to prevent capture. Following the exact pattern from recommendation.controller.ts.

---

#### Step A6: Module

**File:** `backend/src/evaluation/evaluation.module.ts`

```typescript
// @lifecycle ACTIVE — Agent evaluation harness module

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EvaluationController } from './evaluation.controller';
import { ExecutionTraceService } from './services/execution-trace.service';
import { MetricService } from './services/metric.service';
import { RouterEvaluatorService } from './services/router-evaluator.service';
import { PlannerEvaluatorService } from './services/planner-evaluator.service';
import { CodeEvaluatorService } from './services/code-evaluator.service';
import { MetricScheduler } from './schedulers/metric.scheduler';

@Module({
  imports: [ScheduleModule],
  controllers: [EvaluationController],
  providers: [
    ExecutionTraceService,
    MetricService,
    RouterEvaluatorService,
    PlannerEvaluatorService,
    CodeEvaluatorService,
    MetricScheduler,
  ],
  exports: [MetricService],
})
export class EvaluationModule {}
```

---

#### Step A7: Register in AppModule

**File:** `backend/src/app.module.ts`

Add import:
```typescript
import { EvaluationModule } from './evaluation/evaluation.module';
```
Add to imports array (after RecommendationModule):
```typescript
EvaluationModule,
```

---

#### Step A8: Build Verification

```bash
cd backend && npm run build
```

If errors: check import paths (especially getConfidenceInterval path), verify Prisma client regeneration, check DTO decorators.

---

### Phase B — Scheduler & Tests

---

#### Step B1: Scheduler

**File:** `backend/src/evaluation/schedulers/metric.scheduler.ts`

Two scheduled jobs:
- Daily @ 2AM: Compute ROLLING_30D, ROLLING_7D, DAILY windows
- Weekly @ Monday 3AM: Recompute ALL_TIME metrics (delete + recompute)

```typescript
// @lifecycle ACTIVE — Scheduler for periodic metric computation

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricService } from '../services/metric.service';

@Injectable()
export class MetricScheduler {
  private readonly logger = new Logger(MetricScheduler.name);
  constructor(private readonly metricService: MetricService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyMetricComputation() { /* computeAll for each window */ }

  @Cron(CronExpression.EVERY_WEEK)
  async weeklyAllTimeRecompute() { /* recomputeAll('ALL_TIME') */ }
}
```

---

#### Step B2: Unit Tests (5 spec files)

All follow existing test pattern from recommendation.service.spec.ts:
- Test.createTestingModule with mock Prisma object (jest.fn() on each model)
- jest.clearAllMocks() in beforeEach
- Test: success path, error path, edge case (empty data)

**File B2a:** execution-trace.service.spec.ts — ~12 tests (create, findAll, findByExecutionId, addPhase, remove, countByOutcome)
**File B2b:** router-evaluator.service.spec.ts — ~7 tests (empty, L1 correct, L2 correct, L1 incorrect, mixed, byRoute, ambiguous)
**File B2c:** planner-evaluator.service.spec.ts — ~7 tests (empty, all PASS, mixed, FLAG accepted, revision rate)
**File B2d:** code-evaluator.service.spec.ts — ~9 tests (first-attempt rate 3, overall success 3, debug rate 3)
**File B2e:** metric.service.spec.ts — ~6 tests (computeAll, getSummary, getMetrics, recomputeAll, empty data, dimensions)

Run: `cd backend && npx jest --testPathPattern=evaluation --verbose`
Expected: 5 suites, ~40-50 tests, all passing.

---

### Phase C — Seed Data & API Verification

---

#### Step C1: Seed Script

**File:** `backend/prisma/seed-evaluations.ts`

Standalone PrismaClient script (following seed-recommendations.ts pattern). Creates 10 executions:

**Historical (4):**
- TASK-A: LEVEL_1, verify tests, success, 3 phases
- TASK-001: LEVEL_3, MVP scaffold, full pipeline, success, 6 phases
- TASK-021: LEVEL_2, migration+API verify, full pipeline, success, 6 phases
- TASK-022: LEVEL_2, seed+bug fixes, ARCH revision needed, CODE retry, 8 phases

**Synthetic (6):**
- SYNTH-001: LEVEL_1, simple CRUD, success, 3 phases
- SYNTH-002: LEVEL_1, bug fix, first attempt FAIL → retry PASS, 5 phases
- SYNTH-003: LEVEL_2, pagination feature, plan+code, success, 5 phases
- SYNTH-004: LEVEL_2, Redis caching, BLOCKED by ARCH, 4 phases
- SYNTH-005: LEVEL_3, RBAC upgrade, ARCH revision needed, success, 8 phases
- SYNTH-006: LEVEL_3, DB migration proposal, BLOCKED, 4 phases

Run: `cd backend && npx ts-node prisma/seed-evaluations.ts`
Verify: SQL COUNT on agent_executions (10) and execution_phases (~48)

---

#### Step C2: API Verification

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"eval-test@test.com","password":"Test123!","name":"EvalTester"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).data.accessToken))")

# Verify all 7 endpoints...
curl http://localhost:3001/api/v1/evaluations/executions -H "Authorization: Bearer $TOKEN"
curl http://localhost:3001/api/v1/evaluations/executions/TASK-022 -H "Authorization: Bearer $TOKEN"
curl http://localhost:3001/api/v1/evaluations/metrics/summary -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3001/api/v1/evaluations/metrics/recalculate -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/v1/evaluations/metrics?agentType=ROUTER" -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3001/api/v1/evaluations/executions -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"executionId":"VERIFY-001","requestSummary":"API test","routerRoute":"LEVEL_1","routerConfidence":0.95,"routerRisk":"low","routerReason":"API test","finalOutcome":"COMMITTED"}'
curl -X POST http://localhost:3001/api/v1/evaluations/executions/VERIFY-001/phases -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"phaseId":"VERIFY-ROUTER","agentType":"ROUTER","phaseOrder":1,"decision":null,"durationMs":1000,"modelUsed":"deepseek/deepseek-v4-flash"}'
```

Expected metric values (after seed + recalculate):
- Router accuracy: ~0.83 (5/6 consistent)
- Planner accuracy: ~0.86 (6/7 PASS+FLAG)
- Planner revision rate: ~0.33 (1/3)
- Code first-attempt rate: ~0.57 (4/7)
- Code overall success: ~0.86 (6/7)
- Debug success rate: ~1.00 (2/2)

---

#### Step C3: Update Work Queue

**File:** `.kilo/docs/work_queue.md`

Add:
```markdown
### TASK-025 — Agent evaluation harness v1 (ADR-003)
- **Status**: Done — 4 Prisma models, 18 files in evaluation/ module, 7 API endpoints,
  metric computation engine, 5 test suites (~45-50 tests), seed data (10 executions, ~48 phases)
- **Date**: 2026-06-08
```

---

## 3. Dependencies

| Step | Depends On | Type |
|------|-----------|------|
| A1: Prisma schema | PostgreSQL running | Hard |
| A4: Services | A1 (Prisma client types) | Hard |
| A5: Controller | A4 (services) | Hard |
| A6: Module | A4+A5 | Hard |
| A7: AppModule update | A6 | Hard |
| A8: Build verification | A7 | Hard |
| B1: Scheduler | A4 (services) | Hard |
| B2: Unit tests | A4+A5 | Soft |
| C1: Seed script | A1 (schema applied) | Hard |
| C2: API verification | A8 (build) + C1 (seed) + app running | Hard |
| C3: Work queue update | C2 | Hard |

---

## 4. Risks

| Risk | Probability | Impact | Handling |
|------|-----------|--------|---------|
| Prisma migration conflict | Low | High | npx prisma migrate resolve to sync. Delete and recreate migration if needed. |
| Import path error (getConfidenceInterval) | Medium | Medium | Verify path: ../../recommendation/utils/confidence-interval.util from evaluation/services/ |
| Route capture in controller | Low | High | All static routes (metrics, metrics/summary) must precede :id params |
| JSONB null in Prisma create | Medium | Medium | Already experienced in TASK-022. Use ?? undefined fallback for optional JSONB fields |
| Seed phaseId uniqueness | Low | Medium | Seed uses unique phaseId per execution. @@unique on phaseId prevents duplicates |
| Cold start metrics | Low | Medium | 10 seed executions provide sufficient data. recalculate populates agent_metrics table |
| No ADMIN role guard | Low | Low | v1 uses JwtAuthGuard only. Acceptable; RBAC deferred to separate ADR |

---

## 5. Escalations

| Issue | Escalate To | Trigger |
|-------|-------------|---------|
| Prisma schema conflict | Architect | Migration cannot be applied or naming conflict with existing tables |
| RBAC requirement | Architect | Security review mandates ADMIN-only access before merge |
| Scheduler timing conflicts | Architect | Infrastructure constraint (e.g., backup window overlaps with cron) |
| getConfidenceInterval util not reusable | Architect | Function signature mismatch or path resolution failure |

---

## 6. Success Criteria

- [ ] A1: Migration created and applied — 4 new tables in PostgreSQL
- [ ] A1: npx prisma generate — client regenerated without errors
- [ ] A2–A7: 18 files created in backend/src/evaluation/ (module, controller, 5 services, 4 DTOs, interfaces, scheduler)
- [ ] A7: EvaluationModule registered in AppModule
- [ ] A8: npm run build — zero compilation errors
- [ ] B1: Scheduler compiles and registers Cron decorators
- [ ] B2: npx jest --testPathPattern=evaluation --verbose — 5 suites, all passing
- [ ] B2: Service coverage ≥80% for evaluation module
- [ ] C1: Seed script creates 10 executions with ~48 phases
- [ ] C2: POST /api/v1/evaluations/executions returns 201
- [ ] C2: GET /api/v1/evaluations/executions returns paginated { items, total }
- [ ] C2: GET /api/v1/evaluations/executions/TASK-022 returns execution with 8 phases
- [ ] C2: POST /api/v1/evaluations/executions/VERIFY-001/phases returns 201
- [ ] C2: GET /api/v1/evaluations/metrics/summary returns all 6 metric values (none null)
- [ ] C2: POST /api/v1/evaluations/metrics/recalculate returns array of 6 snapshots
- [ ] C2: GET /api/v1/evaluations/metrics?agentType=ROUTER returns stored metric with dimensions
- [ ] C2: Router accuracy ≈0.83, Planner accuracy ≈0.86, Code first-attempt ≈0.57
- [ ] C2: Code overall success ≈0.86, Debug success ≈1.00
- [ ] C3: Work queue updated with TASK-025

---

## 7. File Summary

| # | File | Type |
|---|------|------|
| 1 | backend/prisma/schema.prisma (edit) | Schema |
| 2 | backend/src/evaluation/interfaces/metric.interface.ts | New |
| 3 | backend/src/evaluation/dto/create-execution.dto.ts | New |
| 4 | backend/src/evaluation/dto/create-phase.dto.ts | New |
| 5 | backend/src/evaluation/dto/query-metrics.dto.ts | New |
| 6 | backend/src/evaluation/dto/query-executions.dto.ts | New |
| 7 | backend/src/evaluation/services/execution-trace.service.ts | New |
| 8 | backend/src/evaluation/services/router-evaluator.service.ts | New |
| 9 | backend/src/evaluation/services/planner-evaluator.service.ts | New |
| 10 | backend/src/evaluation/services/code-evaluator.service.ts | New |
| 11 | backend/src/evaluation/services/metric.service.ts | New |
| 12 | backend/src/evaluation/evaluation.controller.ts | New |
| 13 | backend/src/evaluation/evaluation.module.ts | New |
| 14 | backend/src/app.module.ts (edit) | Edit |
| 15 | backend/src/evaluation/schedulers/metric.scheduler.ts | New |
| 16 | backend/src/evaluation/__tests__/execution-trace.service.spec.ts | New |
| 17 | backend/src/evaluation/__tests__/router-evaluator.service.spec.ts | New |
| 18 | backend/src/evaluation/__tests__/planner-evaluator.service.spec.ts | New |
| 19 | backend/src/evaluation/__tests__/code-evaluator.service.spec.ts | New |
| 20 | backend/src/evaluation/__tests__/metric.service.spec.ts | New |
| 21 | backend/prisma/seed-evaluations.ts | New |
| 22 | .kilo/docs/work_queue.md (edit) | Edit |

**Total: 22 file changes (18 new, 4 edits)**
