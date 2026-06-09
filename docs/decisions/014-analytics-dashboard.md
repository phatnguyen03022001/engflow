/* @lifecycle ACTIVE — ADR-014: Analytics Dashboard Architecture */

# ADR-014 — Analytics Dashboard: Unified View Across All Modules

**Status:** Active
**Created:** 2026-06-09
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-003, ADR-010, Constitution §3

---

## Context

The `architecture.md` document currently lists `progress/` (described as "Progress tracking and analytics") and `admin/` as separate planned backend modules. Additionally, Architecture Layer 8 (Observability) lists "Analytics" as a separate concern.

However, analysis of the actual data landscape reveals:

1. **Analytics data is already distributed** — agent execution metrics live in `evaluation/` (ADR-003), cost data lives in `model-registry/` (ADR-010), trust score data lives in `recommendation/` (ADR-002)
2. **A separate `analytics/` module would be a thin aggregation layer** — it would primarily query from other modules, owning minimal data of its own
3. **Module proliferation risk** — creating `progress/`, `admin/`, and `analytics/` as separate modules would add unnecessary abstraction and import complexity
4. **Evaluation module already has analytics endpoints** — `evaluation/` controller already serves metric queries and execution traces

---

## Decision

### §1. No Separate Analytics Module

All analytics query endpoints are consolidated into the existing `evaluation/` controller. This avoids creating a thin aggregation module that adds little value beyond routing queries to existing data sources.

### §2. Query Surface

Four analytics endpoints are added to the `evaluation/` controller:

| Method | Path | Data Source | Purpose |
|--------|------|-------------|---------|
| `GET` | `/api/v1/evaluation/analytics/agent-performance` | evaluation module | Agent success rates, latency, and quality scores |
| `GET` | `/api/v1/evaluation/analytics/throughput` | evaluation module | Executions per time window, concurrency metrics |
| `GET` | `/api/v1/evaluation/analytics/bottlenecks` | evaluation + model-registry | Slowest phases, model latency hotspots |
| `GET` | `/api/v1/evaluation/analytics/cost-trends` | model-registry (CostLog) | Daily/weekly/monthly spend trends |

Each endpoint queries data from the owning module directly through Prisma service injection. No cross-module service calls are needed — all data is in the shared PostgreSQL database.

### §3. Architecture.md Correction

To reflect this decision, the following documentation drifts are corrected:

- **Remove `progress/` module** from planned modules — analytics is merged into `evaluation/`
- **Remove `admin/` module** from planned modules — admin UI is a frontend concern, not a separate backend module
- **Update Layer 8 wording** — remove standalone "Analytics" reference; analytics is a capability of the evaluation module
- **Update model-registry status** from `🚧 planned` to `✅ active` — the module is already implemented per ADR-010

### §4. Frontend Note

The analytics dashboard UI (frontend) is a separate concern. When implemented, it will call these `evaluation/` API endpoints. The frontend `app/(dashboard)/` and `app/admin/` routes are not affected by this decision — they consume API data regardless of which backend module serves it.

---

## Consequences

### Positive

1. **No module proliferation** — avoids creating 3 separate planned modules (`progress/`, `admin/`, `analytics/`) that would add complexity without clear benefit
2. **Simpler data flow** — dashboard queries go directly to data-owning modules, no intermediate aggregation layer
3. **Documentation accuracy** — `architecture.md` now reflects actual module structure
4. **Consistency with existing patterns** — analytics is a read-only concern on evaluation data, which aligns with the evaluation module's observer role

### Negative

1. **Evaluation module scope expands** — the module now serves both evaluation harness (write) and analytics dashboard (read) concerns. Mitigated by clear service separation within the module
2. **No dedicated analytics data model** — some aggregations may require computed views. Mitigated by on-the-fly computation via Prisma queries (no additional models needed in v1)

---

## Compliance

| Check | Criteria |
|-------|----------|
| Constitution §3 (Monolith-first) | No module proliferation — merges into existing `evaluation/` |
| ADR-003 (Evaluation Harness) | Extends evaluation module with analytics query surface |
| ADR-010 (Cost Tracking) | Cost trends query model-registry CostLog data |
| Architecture.md accuracy | Corrected to reflect actual module inventory |

---

**End of ADR-014**
