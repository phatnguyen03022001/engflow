/* @lifecycle ACTIVE — ADR Index: Architectural Decision Records */

# Architecture Decision Records

**Last Updated:** 2026-06-10

This file indexes all Architecture Decision Records (ADRs) for the Floweng project.
See `docs/decisions/` for individual ADR documents.

---

## ADR Index

| ID | Title | Status | Summary |
|----|-------|--------|---------|
| ADR-001 | Reuse-First Governance Framework | Active | Establishes a reuse-first governance framework for the Ask agent, including a five-level reuse hierarchy, build justification conditions, time-to-value scoring, over-engineering detection, startup stage awareness, reversibility analysis, and survivability matrix. |
| ADR-002 | Ask Agent as Virtual CTO Advisor | Active | Defines the Ask agent as a Virtual CTO Advisor that provides architectural guidance, recommendation evaluation via Bayesian trust scores, and decision memory for the AI Software Factory. |
| ADR-003 | Agent Evaluation Harness v1 | Active | Creates a backend evaluation module for measuring agent execution performance (Router accuracy, Planner accuracy, Code success rate, Debug success rate) via execution trace recording and metric computation. |
| ADR-008 | Lifecycle Declarations | Active | Establishes a 5-state lifecycle declaration system (ACTIVE, GENERATED, TEMPORARY, EXPERIMENTAL, ARCHIVED) for file governance, defining transition rules, enforcement criteria, and GENERATED file exception. |
| ADR-009 | Prisma v6 Upgrade + UUID v7 | Active | Upgrades Prisma from 5.x to 6.x and migrates all 15 model primary keys from UUID v4 to UUID v7 for improved B-tree index performance. |
| ADR-010 | Model Intelligence & Cost Tracking | Active | Establishes the model intelligence layer with a model registry, routing rules, fallback chains, and per-request cost tracking integrated with the evaluation harness. |
| ADR-011 | Knowledge Graph Design | Active | PostgreSQL JSONB graph for cross-layer traceability between requirements, architecture, code, and tests. |
| ADR-012 | Context Manager Architecture | Active | Multi-source context assembly within memory/ module with tiered token budget strategy. |
| ADR-013 | Drift Detection Mechanism | Active | Cron-based architecture and policy compliance monitoring with auto-resolve capability. |
| ADR-014 | Analytics Dashboard | Active | Unified analytics within evaluation/ module — no separate analytics module. |
| ADR-015 | Runtime Verification Integration | Active | POST_VERIFY executes whitelisted build/lint/test commands. *(§1-2 partially superseded by ADR-017)* |
| ADR-016 | Debug Agent Activation | Active | Activates DEFERRED DEBUG agent with diagnosis-first workflow and 3 evaluation metrics. |
| ADR-017 | Execution Shift to CODE Agent | Active | Runtime verification moves from POST_VERIFY to CODE due to platform permission constraint. CODE executes build/lint/test, POST_VERIFY reviews report. |
| ADR-ASK-001 | Agent Routing Governance Specification | Active | Establishes ASK v2 as the Virtual CTO Router — unified routing + advisory gateway. Defines 8-agent catalog, 4 pillar principles, standardized routing output format, decision matrix, and session management rules. Source of truth for all ASK v2 routing behavior. |

---

**Note:** ADR-ASK-001 introduces the ASK-XXX sub-series for routing governance ADRs, distinct from the product ADR series (ADR-001 through ADR-017).

## Conventions

- **Status:**
  - `Proposed` — Under review, not yet adopted
  - `Active` — Adopted and in effect
  - `Superseded` — Replaced by a newer ADR
  - `Deprecated` — No longer recommended
- ADRs are immutable once finalized. Amendments require a new ADR.

---

**End of ADR Index**
