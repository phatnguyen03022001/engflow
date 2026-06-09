/* @lifecycle ACTIVE — ADR-010: Model Intelligence & Cost Tracking */

# ADR-010 — Model Intelligence Layer: Registry, Routing, Fallback & Cost Tracking

**Status:** Proposed
**Created:** 2026-06-09
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-002, ADR-003, ADR-008, ADR-009, Constitution §3 §7, Architecture Layers 7–9

---

## Context

The AI Software Factory operates multiple agents (Router, Plan, Architect, Code, PreVerify, PostVerify) each using AI models. Currently:

1. **Model assignments are hardcoded** in `kilo.jsonc` — all agents use `deepseek/deepseek-v4-flash` except Architect which uses `deepseek/deepseek-v4-pro`. There is no mechanism to change models without editing config.
2. **Cost is untracked** — the budget target is 60–80 USD/month but we cannot measure actual spending.
3. **No fallback strategy** — if a model returns 429 (rate limit) or 503 (unavailable), the agent fails with no recovery.
4. **No model performance comparison** — we cannot answer "is deepseek-v4-pro worth the cost premium over flash?"

ADR-003 (Evaluation Harness) records `modelUsed` in ExecutionPhase. ADR-002 (Trust Scores) provides Bayesian quality scoring that can be applied to models. Layer 8 (Observability) lists "Cost Intelligence" as a placeholder. Layer 9 (Model Intelligence) is a one-line placeholder in architecture.md.

**Problem:** Without model intelligence infrastructure, cost optimization is guesswork, model failures cascade into agent failures, and there is no data to justify model upgrades or downgrades.

---

## Decision

### §1. Create Model Intelligence as a New Backend Module

Establish `backend/src/model-registry/` as a NestJS module following the canonical `evaluation/` pattern (ADR-003). The module manages AI model metadata, routing rules, fallback chains, and per-request cost tracking.

### §2. Data Model (5 New Prisma Models)

**`ModelProvider`** — API provider metadata (e.g., DeepSeek, Anthropic, OpenAI).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| providerId | String (unique) | Slug identifier (e.g., `deepseek`, `openai`) |
| name | String | Display name |
| apiBaseUrl | String | Base URL for API calls |
| apiKeyEnv | String | Environment variable name for API key |
| isActive | Boolean | Whether this provider is currently in use |

**`ModelRegistry`** — Individual model entry with capabilities, cost, and quality tracking.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| modelId | String (unique) | Model identifier (e.g., `deepseek/deepseek-v4-flash`) |
| providerId | String (FK) | Parent provider |
| displayName | String | Human-readable name |
| tier | ModelTier enum | FREE, BUDGET, STANDARD, PREMIUM, EXPERIMENTAL |
| capabilities | ModelCapability[] | Enum array: CHAT, JSON_MODE, FUNCTION_CALLING, VISION, TOOL_USE, REASONING, etc. |
| contextWindow | Int | Max input tokens |
| maxOutputTokens | Int | Max output tokens |
| costPer1kInput | Float | USD per 1,000 input tokens |
| costPer1kOutput | Float | USD per 1,000 output tokens |
| avgLatencyMs | Int? | Avg response latency (from L7 harness) |
| successRate | Float? | Request success rate (from L7 harness) |
| qualityScore | Float? | Bayesian trust quality score (ADR-002 integration) |
| isActive | Boolean | Whether model is currently usable |
| deprecatedAt | DateTime? | When the model was deprecated |
| replacedByModelId | String? | Successor model ID |

**`ModelRoute`** — Routing rule mapping agent type + task level to a primary model.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| routeId | String (unique) | Human-readable route ID |
| agentType | String | `ROUTER`, `PLAN`, `ARCHITECT`, `CODE`, `PRE_VERIFY`, `POST_VERIFY` |
| taskType | String | `LEVEL_1`, `LEVEL_2`, `LEVEL_3` |
| primaryModelId | String (FK) | Default model to use |
| priority | Int | Lower = higher priority when multiple routes match |
| maxCostUsd | Float? | Budget ceiling per request |
| maxLatencyMs | Int? | Max acceptable latency |
| isActive | Boolean | Whether this routing rule is active |

**`FallbackChain`** — Ordered fallback sequence when the primary model fails.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| chainId | String (unique) | Human-readable chain ID |
| primaryModelId | String (FK) | Model that may fail |
| fallbackModelId | String (FK) | Fallback model |
| priority | Int | Order in chain: 1, 2, 3... |
| triggerOnHttpCode | Int? | HTTP status code triggering fallback (e.g., 429, 503) |
| triggerOnTimeoutMs | Int? | Timeout threshold triggering fallback |
| maxRetries | Int | Max retries before fallback |
| isActive | Boolean | Whether this chain is active |

**`CostLog`** — Per-request cost record linked to execution traces.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| modelId | String (FK) | Model used |
| executionId | String | Links to AgentExecution (ADR-003) |
| phaseId | String? | Links to ExecutionPhase |
| inputTokens | Int | Prompt token count |
| outputTokens | Int | Completion token count |
| costUsd | Float | Computed cost in USD |
| latencyMs | Int | Response time in milliseconds |
| wasFallback | Boolean | Whether this was a fallback invocation |
| fallbackFrom | String? | Original model that failed |

**Indexes:** All FK fields indexed. Compound indexes on high-query patterns: `(modelId, recordedAt)` for cost reports, `(agentType, taskType)` for route resolution, `(primaryModelId, priority)` for fallback chain traversal.

### §3. Module Structure (~20 files)

Following the `evaluation/` pattern:

```
backend/src/model-registry/
├── model-registry.module.ts           # NestJS @Module
├── model-registry.controller.ts       # CRUD + cost reports + routing
├── services/
│   ├── model-registry.service.ts        # CRUD for providers + models + routes
│   ├── model-router.service.ts          # Route resolution logic
│   ├── cost-tracker.service.ts          # Cost logging + aggregation
│   └── fallback.service.ts            # Fallback chain execution
├── dto/
│   ├── create-provider.dto.ts
│   ├── create-model.dto.ts
│   ├── create-route.dto.ts
│   ├── create-fallback-chain.dto.ts
│   ├── model-route-query.dto.ts
│   └── cost-report-query.dto.ts
├── interfaces/
│   ├── model-registry.interface.ts
│   └── cost-report.interface.ts
├── schedulers/
│   └── cost-report.scheduler.ts         # Daily cost report generation
└── __tests__/
    ├── model-registry.service.spec.ts
    ├── model-router.service.spec.ts
    ├── cost-tracker.service.spec.ts
    ├── fallback.service.spec.ts
    └── model-registry.controller.spec.ts
```

**Total: ~20 files** (comparable to `recommendation/` at 21, `evaluation/` at 18).

### §4. Fallback Strategy

```
Model Selection Flow:

  Request (agentType, taskType)
       ↓
  ModelRouter.query(agentType, taskType)
       ↓
  Primary Model (e.g., deepseek-v4-flash)
       ↓
  ┌── Success → Return
  │
  └── Failure (429, 503, timeout, error)
            ↓
       FallbackService.getChain(primaryModel)
            ↓
       Secondary Model (e.g., deepseek-v4-pro)
            ↓
       ┌── Success → Return
       │
       └── Failure
                 ↓
            Tertiary Model (or ERROR)
```

**Default seed chains:**
| Primary | Secondary | Tertiary | Rationale |
|---------|-----------|----------|-----------|
| flash | pro | (error) | Default: flash first, pro on failure |
| pro | flash | (error) | Architect: pro first, flash as cost fallback |
| flash | flash (retry) | pro | Retry once before upgrading cost tier |

**Fallback triggers:**
- HTTP 429 (rate limit) → immediate fallback
- HTTP 503 (service unavailable) → immediate fallback
- Timeout > 60s → fallback
- HTTP 4xx (non-rate-limit) → do NOT fallback (request problem, not model problem)

**Safety constraints:**
- Max 3 hops per request
- No cycles (model cannot fallback to itself)
- Cost cap enforcement: `ModelRoute.maxCostUsd` gates the chain — skip models exceeding budget

### §5. Cost Tracking Integration

Integration with **L7 Harness** (ADR-003) and **L8 Observability**:

```
AgentExecution.executionId  ← linked via CostLog.executionId
ExecutionPhase.phaseId       ← linked via CostLog.phaseId
ExecutionPhase.modelUsed     ← validated against ModelRegistry.modelId
```

**Cost per request formula:**
```
cost = (inputTokens × costPer1kInput + outputTokens × costPer1kOutput) / 1000
```

**Cost aggregation windows:** Daily, Weekly, Rolling 7D, Rolling 30D, Monthly (aligned with budget target 60–80 USD/month).

**Budget alerting:** If projected monthly spend exceeds 80 USD, scheduler emits a WARNING via NestJS Logger. No external dependency (no Redis, no alerting service).

**ADR-002 Trust Score integration:**
- `ModelRegistry.qualityScore` is updated by the evaluation harness when metrics are recomputed
- Bayesian trust formula from ADR-002 is reused: `score = (successes + α) / (total + α + β)`
- Model selection can prefer higher-quality-score models within the same tier

### §6. API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/model-registry/providers` | JWT (ADMIN) | Register a model provider |
| `GET` | `/api/v1/model-registry/providers` | JWT (ADMIN) | List providers |
| `POST` | `/api/v1/model-registry/models` | JWT (ADMIN) | Register a model |
| `GET` | `/api/v1/model-registry/models` | JWT (ADMIN) | List models (filterable by tier, provider, active) |
| `GET` | `/api/v1/model-registry/models/:modelId` | JWT (ADMIN) | Get model details |
| `PATCH` | `/api/v1/model-registry/models/:modelId` | JWT (ADMIN) | Update model (tier, cost, deprecation) |
| `DELETE` | `/api/v1/model-registry/models/:modelId` | JWT (ADMIN) | Soft-deactivate a model |
| `POST` | `/api/v1/model-registry/routes` | JWT (ADMIN) | Create routing rule |
| `GET` | `/api/v1/model-registry/routes` | JWT (ADMIN) | List routes by agentType, taskType |
| `GET` | `/api/v1/model-registry/route` | Agent API Key | Resolve model for (agentType, taskType) |
| `POST` | `/api/v1/model-registry/fallback-chains` | JWT (ADMIN) | Create fallback chain |
| `GET` | `/api/v1/model-registry/fallback-chains` | JWT (ADMIN) | List fallback chains |
| `POST` | `/api/v1/model-registry/cost-logs` | Agent API Key | Record a cost entry |
| `GET` | `/api/v1/model-registry/costs` | JWT (ADMIN) | Cost reports (daily/weekly/monthly/rolling) |
| `GET` | `/api/v1/model-registry/costs/projection` | JWT (ADMIN) | Projected monthly spend |
| `POST` | `/api/v1/model-registry/costs/recalculate` | JWT (ADMIN) | Force recomputation of cost totals |

**Total: 16 endpoints** (10 admin, 2 runtime agent, 4 cost-focused).

### §7. What This Is NOT

- **NOT a model serving proxy** — the module tracks and routes, it does not proxy API calls
- **NOT a real-time cost enforcement system** — cost caps are advisory (logged, not blocked) in v1
- **NOT a replacement for ADR-003** — model performance metrics come from the existing evaluation harness
- **NOT an external service** — entirely within the NestJS monolith, no new infrastructure

### §8. Integration Strategy (Phased)

**Phase v1 (this ADR): Registry + Cost Tracking**
- Backend module built with CRUD + routing + cost logging
- Manual seeding of providers (DeepSeek), models (flash, pro), routes, fallback chains
- Cost logging via agent API — agents write CostLog after each phase
- Daily cost aggregation via scheduler
- Budget alerts at 80% threshold

**Phase v2 (future ADR): Dynamic Model Selection**
- Quality score integration with evaluation harness
- Automated route optimization based on cost/quality tradeoffs
- Model A/B testing via route priority changes
- Real-time budget enforcement (block over-budget requests)

**Phase v3 (future ADR): Provider Abstraction**
- Model serving proxy integration (lux, openrouter, etc.)
- Provider-level rate limiting per ModelProvider
- Automatic model deprecation and migration

---

## Consequences

### Positive

1. **Measurable cost** — for the first time, we can answer "are we within 60–80 USD/month?"
2. **Resilience** — fallback chains prevent agent failures from transient model outages
3. **Data-driven model selection** — quality scores and cost data enable informed model choices
4. **Budget enforcement** — projected spend alerts prevent surprise bills
5. **Pattern consistency** — follows existing module patterns, zero learning curve
6. **No new infrastructure** — 0 USD additional cost, all within existing PostgreSQL + NestJS monolith

### Negative

1. **Schema growth** — 5 models (+33% from 15 to 20). Mitigated by lean design (8–14 fields each) and consolidation of cost tracking into L9 (avoids separate L8 cost module)
2. **Cold start** — quality scores require execution data to be meaningful. Mitigated by tier-based defaults during v1
3. **CostLog write overhead** — one write per agent phase. Mitigated by append-only design and time-range indexing. Partition strategy deferred to v2 (>100K rows)
4. **Agent API key for cost/route endpoints** — adds key management surface. Mitigated by reusing existing `AGENT_API_KEY` mechanism from the memory module

### Migration Approach

- Schema migration: 5 new models, no existing model changes
- Seed data: 1 provider (DeepSeek), 2 models (flash, pro), 6 default routes, 3 fallback chains
- No backfill needed — CostLog starts empty, accumulates from v1 activation date

---

## Alternatives Considered

### A. Extend EvaluationModule (ADR-003) instead of new module

**Rejected.** The evaluation module is a read-side observer for agent execution metrics. Model intelligence (routing, fallback, cost tracking) is a fundamentally different domain with different data models, different API consumers (agents at runtime vs admins reporting), and different lifecycle. Mixing them would create an over-broad module with unclear responsibility.

### B. Start with cost tracking only, defer model registry

**Rejected.** Cost tracking without model registry cannot attribute costs to specific models. CostLog requires ModelRegistry as a FK reference. The two are inherently coupled — cost data without model metadata is just a number with no actionable insight.

### C. Build as a separate microservice

**Rejected.** Violates Constitution §3 (monolith-first). The model registry has low resource requirements (<16 endpoints, 5 tables), no independent scaling needs, and shares the PostgreSQL database with all other modules. A separate service would add deployment, networking, auth, and data sync complexity with zero compensating benefit.

### D. Use config files instead of database for model registry

**Rejected.** Config files (kilo.jsonc, YAML) cannot support:
- Cost logging and aggregation
- Quality score tracking via evaluation harness
- Fallback chain management with audit trail
- Dynamic route updates without redeployment
- Per-request cost attribution

The model registry has operational data characteristics (written at runtime, queried frequently, needs indexing) that require database storage.

---

## Compliance

| Check | Criteria |
|-------|----------|
| Constitution §3 (Monolith-first) | No new services, databases, or queues |
| Constitution §7 (Simplicity) | 5 models, ~20 files, no new frameworks |
| ADR-008 (Lifecycle) | `@lifecycle ACTIVE` on all new files |
| ADR-009 (UUID v7) | All primary keys use `@default(uuid(7))` |
| Budget target | No new infrastructure cost |
| Module pattern | Controller → Service → Prisma, following `evaluation/` |
| ADR-002 integration | `qualityScore` field on ModelRegistry; Bayesian trust formula reused |

---

## References

- ADR-002 — Ask Agent as Virtual CTO Advisor (`docs/decisions/002-ask-virtual-cto-advisor.md`)
- ADR-003 — Agent Evaluation Harness v1 (`docs/decisions/003-agent-evaluation-harness-v1.md`)
- ADR-008 — Lifecycle Declarations (`docs/decisions/008-lifecycle-declarations.md`)
- ADR-009 — Prisma 6.x Upgrade and UUID v7 (`docs/decisions/009-prisma-v6-upgrade-uuid-v7.md`)
- Constitution §3 (Monolith-first), §7 (Simplicity)
- Architecture v1.0, Layer 7 (Reliability), Layer 8 (Observability), Layer 9 (Model Intelligence)
- Layer 9 Architecture Review (`.kilo/specs/layer9-architecture-review.md`)
- Kilo Config: Agent Definitions (`.kilo/kilo.jsonc`)
- Prisma Schema (`backend/prisma/schema.prisma` — 15 models)

---

**End of ADR-010**
