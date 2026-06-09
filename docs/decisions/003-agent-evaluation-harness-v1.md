/* @lifecycle ACTIVE — ADR-003: Agent Evaluation Harness v1 */

# ADR-003 — Agent Evaluation Harness v1

**Status:** Active
**Created:** 2026-06-08
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-001, ADR-002, Constitution §7 §8, Architecture Layer 7 & 8, Execution Contract

---

## Context

The AI Software Factory operates a multi-agent execution pipeline (Router → Plan → Architect → Code → PreVerify → PostVerify) governed by the Execution Contract state machine. Currently, there is **no mechanism to measure agent performance**. We cannot answer:

1. Is the Router correctly classifying requests (LEVEL_1/2/3)?
2. Are Plans accurate and implementable?
3. What is the Code agent's first-attempt success rate?
4. When debug retries occur, do they succeed?

Layer 7 (Reliability) in `architecture.md` lists "Harness" as a placeholder. Layer 8 (Observability) lists "Telemetry, Analytics, Cost Intelligence." Both are currently unbuilt. The Recommendation Registry (`recommendation/` module, ADR-002) evaluates Ask agent recommendation quality (Bayesian Trust Scores) but does NOT evaluate execution agent performance.

**Problem:** Without measurement, there is no feedback loop for agent prompt tuning, no visibility into pipeline health, and no data to justify architecture changes or model upgrades.

---

## Decision

### 1. Create the Agent Evaluation Harness as a New Backend Module

Establish `backend/src/evaluation/` as a new NestJS module following the canonical `recommendation/` pattern. The harness is a **read-side observer** — it collects execution data and computes metrics but does NOT modify agent behavior, execution flow, or gate logic.

### 2. Data Model (4 New Prisma Models)

Following existing conventions (snake_case `@map`, compound indexes, cascade deletes):

**`AgentExecution`** — One record per request traversing the pipeline.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| executionId | String (unique) | Human-readable ID (e.g., `TASK-025-abc123`) |
| requestSummary | String | Truncated version of the original user request |
| routerRoute | String | Router classification: `LEVEL_1`, `LEVEL_2`, `LEVEL_3` |
| routerConfidence | Float | Router confidence score (0.0–1.0) |
| routerRisk | String | Router risk assessment: `low`, `medium`, `high` |
| routerReason | String | Router classification rationale |
| planSummary | String? | Planner's task breakdown summary |
| planTaskCount | Int? | Number of tasks in the plan |
| archReviewed | Boolean | Whether Architect reviewed the plan |
| archRevisionNeeded | Boolean | Whether Architect requested plan revision |
| preVerifyDecision | String? | `PASS`, `FLAG`, `BLOCK` |
| preVerifyFlags | Json? | Array of flag descriptions |
| codeAttempts | Int | Number of CODE execution attempts (≥1) |
| codeFirstAttemptSuccess | Boolean? | Whether first CODE attempt passed PostVerify |
| postVerifyDecision | String? | `PASS`, `FLAG`, `FAIL`, `BLOCK` |
| postVerifyIssues | Json? | Array of issue descriptions |
| retryCount | Int | Number of CODE retries triggered |
| debugSuccess | Boolean? | Whether retry resolved the failure |
| finalOutcome | String | `COMMITTED`, `BLOCKED`, `FAILED`, `ABANDONED` |
| totalDurationMs | Int? | Total pipeline execution time in milliseconds |
| committedAt | DateTime? | When execution reached COMMIT |
| createdAt | DateTime | Record creation timestamp |
| updatedAt | DateTime | Record update timestamp |

Indexes: `executionId` (unique), `finalOutcome`, `routerRoute`, `createdAt`, composite: `(routerRoute, finalOutcome)`.

**`ExecutionPhase`** — One record per agent phase transition within an execution.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| phaseId | String (unique) | Human-readable phase ID |
| executionId | String (FK → AgentExecution) | Parent execution |
| agentType | String | `ROUTER`, `PLAN`, `ARCHITECT`, `PRE_VERIFY`, `CODE`, `POST_VERIFY` |
| phaseOrder | Int | Sequential order within the execution (1, 2, 3...) |
| input | Json? | Agent input (truncated request/plan) |
| output | Json? | Agent output (structured extract) |
| decision | String? | Gate decision: `PASS`, `FLAG`, `BLOCK`, `FAIL`, `N/A` |
| decisionReason | String? | Rationale for the decision |
| durationMs | Int? | Phase duration in milliseconds |
| modelUsed | String? | Model ID (e.g., `deepseek/deepseek-v4-flash`) |
| transitionedTo | String? | Next agent in the pipeline |
| recordedAt | DateTime | When this phase was recorded |

Indexes: `phaseId` (unique), `executionId`, `agentType`, composite: `(executionId, phaseOrder)`.

**`AgentMetric`** — Aggregated metric snapshots, computed periodically.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| agentType | String | `ROUTER`, `PLANNER`, `CODE`, `DEBUG` |
| metricName | String | `ACCURACY`, `SUCCESS_RATE`, `FIRST_ATTEMPT_RATE`, `ESCALATION_RATE`, `REVISION_RATE` |
| metricValue | Float | Computed metric value (0.0–1.0) |
| sampleSize | Int | Number of executions in the sample |
| confidenceIntervalLow | Float? | Lower bound of 95% CI |
| confidenceIntervalHigh | Float? | Upper bound of 95% CI |
| window | String | `DAILY`, `WEEKLY`, `ROLLING_7D`, `ROLLING_30D`, `ALL_TIME` |
| computedAt | DateTime | When the metric was computed |
| createdAt | DateTime | Record creation timestamp |

Indexes: composite unique `(agentType, metricName, window, computedAt)`, `agentType`, `computedAt`.

**`MetricDimension`** — Dimensional breakdowns for a metric (e.g., Router accuracy by route level).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| metricId | String (FK → AgentMetric) | Parent metric |
| dimensionKey | String | e.g., `router_route`, `decision_type`, `risk_level` |
| dimensionValue | String | e.g., `LEVEL_1`, `PASS`, `high` |
| count | Int | Number of samples in this dimension |
| value | Float | Metric value for this dimension |

Indexes: `metricId`, composite: `(metricId, dimensionKey, dimensionValue)`.

### 3. Module Structure

Following the `recommendation/` pattern:

```
backend/src/evaluation/
├── evaluation.module.ts           # NestJS @Module
├── evaluation.controller.ts       # REST API endpoints
├── services/
│   ├── execution-trace.service.ts      # CRUD for AgentExecution + ExecutionPhase
│   ├── metric.service.ts               # Metric computation + AgentMetric CRUD
│   ├── router-evaluator.service.ts     # Router accuracy computation
│   ├── planner-evaluator.service.ts    # Planner accuracy computation
│   └── code-evaluator.service.ts      # Code + Debug success rate computation
├── dto/
│   ├── create-execution.dto.ts
│   ├── create-phase.dto.ts
│   ├── query-metrics.dto.ts
│   └── execution-response.dto.ts
├── interfaces/
│   └── metric.interface.ts
├── schedulers/
│   └── metric.scheduler.ts        # Daily/Weekly metric computation cron
└── __tests__/
    ├── execution-trace.service.spec.ts
    ├── metric.service.spec.ts
    ├── router-evaluator.service.spec.ts
    ├── planner-evaluator.service.spec.ts
    └── code-evaluator.service.spec.ts
```

**Total: ~18 files** (comparable to `recommendation/` at 21 files).

### 4. API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/evaluations/executions` | JWT (ADMIN) | Record new execution trace |
| `GET` | `/api/v1/evaluations/executions` | JWT (ADMIN) | List executions (paginated, filterable) |
| `GET` | `/api/v1/evaluations/executions/:executionId` | JWT (ADMIN) | Get single execution with phases |
| `POST` | `/api/v1/evaluations/executions/:executionId/phases` | JWT (ADMIN) | Record phase transition |
| `GET` | `/api/v1/evaluations/metrics` | JWT (ADMIN) | Query agent metrics (filter by agent, metric, window) |
| `GET` | `/api/v1/evaluations/metrics/summary` | JWT (ADMIN) | Current snapshot: Router/Planner/Code/Debug rates |
| `POST` | `/api/v1/evaluations/metrics/recalculate` | JWT (ADMIN) | Trigger manual metric recomputation |

### 5. Metric Computation Formulas

**Router Accuracy:**
```
ACCURACY = COUNT(executions WHERE routerRoute IS outcome-consistent) / COUNT(all routed executions)

Outcome-consistent:
  - routerRoute = LEVEL_1 AND codeAttempts > 0 AND finalOutcome = COMMITTED (no escalation needed)
  - routerRoute = LEVEL_2 OR LEVEL_3 AND planTaskCount > 0 AND finalOutcome IN (COMMITTED, BLOCKED) (plan was appropriate)

Outcome-inconsistent:
  - routerRoute = LEVEL_1 AND (archReviewed = true OR preVerifyDecision = BLOCK) — route was too low
  - routerRoute = LEVEL_3 AND codeAttempts = 1 AND planTaskCount = 1 — likely over-classified (v2: requires human annotation)
```

**Planner Accuracy:**
```
ACCURACY = COUNT(executions WHERE preVerifyDecision IN (PASS, FLAG)) / COUNT(executions WHERE planTaskCount > 0)

REVISION_RATE = COUNT(executions WHERE archRevisionNeeded = true) / COUNT(executions WHERE planTaskCount > 0 AND archReviewed = true)
```

**Code Success Rate:**
```
FIRST_ATTEMPT_RATE = COUNT(executions WHERE codeAttempts >= 1 AND codeFirstAttemptSuccess = true) / COUNT(executions WHERE codeAttempts >= 1)

OVERALL_SUCCESS = COUNT(executions WHERE postVerifyDecision IN (PASS, FLAG)) / COUNT(executions WHERE codeAttempts >= 1)
```

**Debug Success Rate:**
```
DEBUG_SUCCESS_RATE = COUNT(executions WHERE retryCount = 1 AND debugSuccess = true) / COUNT(executions WHERE retryCount = 1)
```

### 6. Integration Strategy (Phased)

**Phase v1 (this ADR): Manual Event Recording**
- Backend module and APIs built
- Events recorded manually or via CLI ingestion scripts
- Metrics computed on-demand or via cron
- Seed data from historical tasks (TASK-001, TASK-021, TASK-022, TASK-002 if available)

**Phase v2 (future ADR): Automated Event Emission**
- Runtime Guard plugin (`@kilocode/guard`) emits events at state transitions
- Agent prompts include structured output format for automatic parsing
- Real-time metric dashboards

**Phase v3 (future ADR): Ground Truth Integration**
- Human annotation UI for Router accuracy labeling
- A/B testing framework for prompt variations
- Statistical significance testing between model versions

This phased approach follows Constitution §7 (simplicity) and ADR-001 (build only what's needed now).

### 7. Non-Functional Requirements

| Concern | Decision |
|---------|----------|
| Performance | Metric computation runs async via cron; API queries are indexed reads; no real-time computation bottlenecks |
| Security | All evaluation endpoints require ADMIN JWT; no public read access to agent performance data |
| Scalability | `AgentExecution` uses time-range indexes; partition strategy deferred to v2 (when row count > 100K) |
| Reliability | Metric computation is idempotent; `recalculate` endpoint allows manual correction |
| Observability | The harness IS the observability tool; it self-reports via standard NestJS logging |

### 8. What This Is NOT

- **NOT an agent behavior modifier** — agents continue operating as defined in `kilo.jsonc`; the harness observes, does not control
- **NOT a replacement for the Runtime Guard** — the Guard enforces state transitions; the harness records and evaluates them
- **NOT a real-time monitoring system** — v1 is batch-oriented; v2 may add real-time capabilities
- **NOT coupled to any specific model** — metrics are model-agnostic; model version is recorded for correlation analysis

---

## Consequences

### Positive

- **Measurable agent quality** — For the first time, we can answer "is the Router getting better?" with data, not intuition
- **Feedback loop for prompt tuning** — Declining metrics signal when agent prompts need refinement
- **Pipeline health visibility** — Bottlenecks (e.g., high ARCH revision rate) become visible
- **Pattern reuse** — Follows the `recommendation/` module pattern, minimizing learning curve
- **No agent disruption** — Read-side observer pattern means zero risk of breaking the execution pipeline
- **Schema consistency** — Uses existing Prisma conventions, PostgreSQL, same naming patterns

### Negative

- **Cold start** — Metrics return 0/NaN until sufficient data accumulates (mitigated by seed data from ~4 historical tasks; statistical significance threshold n≥30 documented)
- **Manual recording overhead** — v1 requires manual event recording (mitigated by CLI ingestion scripts; automation deferred to v2 Runtime Guard integration)
- **Proxy metrics are imperfect** — Router accuracy proxy may misclassify edge cases (mitigated by `AMBIGUOUS` label + confidence band; human review for edge cases)
- **Schema expansion** — Adds 4 models to a schema with 10 existing models (mitigated by lean field design, 8-15 fields each)

### Neutral

- This ADR does not change any agent's permissions, prompts, or behavior in `kilo.jsonc`
- The evaluation module has no dependency on the `recommendation/` module; they are independent domains
- Phase v2 (automated event emission) requires a separate ADR before implementation

---

## Alternatives Considered

### A. Extend the existing AccuracySnapshot model

**Rejected.** `AccuracySnapshot` measures Ask agent recommendation quality (Bayesian Trust Scores, Brier scores, regret rates). Agent execution quality (Router/Planner/Code performance) is a fundamentally different domain with different metrics, different data sources, and different consumers. Mixing them would create a confusing, over-broad model.

### B. Build evaluation as a separate microservice

**Rejected.** Violates Constitution §3 (monolith-first). The evaluation module has low resource requirements (periodic batch computation, <10 API endpoints), no independent scaling needs, and shares the PostgreSQL database. A separate service would add operational complexity (deployment, networking, auth) with no compensating benefit.

### C. Embed evaluation in Runtime Guard plugin

**Rejected.** The `@kilocode/guard` plugin is responsible for enforcement (blocking invalid transitions), not evaluation. Mixing enforcement and evaluation would create a conflict of interest (the enforcer grading itself) and add complexity to a critical-path component. The harness must be an independent observer.

### D. No evaluation harness (status quo)

**Rejected.** Without measurement, we cannot:
- Tune agent prompts with data-driven confidence
- Detect regression when changing models
- Justify architecture investments
- Answer the question "is the factory getting better?"

The cost of building the harness (~18 files, 4 models) is justified by the value of data-driven agent governance.

### E. Real-time streaming evaluation (skip to v2/v3)

**Rejected.** Premature. Real-time evaluation requires Runtime Guard integration and agent prompt changes — both of which carry execution risk. v1 establishes the data layer and computation engine with zero risk to the execution pipeline. Automation can be layered on incrementally.

---

## References

- ADR-001 — Reuse-First Governance Framework (`docs/decisions/001-reuse-first-governance.md`)
- ADR-002 — Ask Agent as Virtual CTO Advisor (`docs/decisions/002-ask-virtual-cto-advisor.md`)
- Constitution §7 (Simplicity), §8 (Documentation)
- Architecture v1.0, Layer 7 (Reliability — Harness), Layer 8 (Observability — Telemetry, Analytics)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Kilo Config: Agent Definitions (`.kilo/kilo.jsonc`)
- Recommendation Module Pattern (`backend/src/recommendation/` — 21 files)
- Prisma Schema (`backend/prisma/schema.prisma` — 10 models)

---

**End of ADR-003**
