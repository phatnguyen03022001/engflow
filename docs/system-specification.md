/* @lifecycle ACTIVE — Floweng System Specification v1 */

# Floweng — System Specification v1

**Status:** Active
**Last Updated:** 2026-06-09

---

## 1. Product Overview

- **Product:** Floweng — AI Software Factory
- **Purpose:** Autonomous engineering platform with 10-layer architecture
- **Status:** MVP Phase (12 completed tasks, 267 tests)

## 2. Technology Stack

- Backend: NestJS (TypeScript), Prisma v6, PostgreSQL
- Frontend: Next.js (App Router), TailwindCSS
- Testing: Jest + Supertest
- Infrastructure: Docker Compose, GitHub Actions CI
- AI: DeepSeek API (flash + pro models)
- Rules: Constitution + ADRs + System Contracts + Agent Rules

## 3. 10-Layer Architecture (with Layer Status)

| Layer | Name | Status | Details |
|-------|------|--------|---------|
| L1 | Governance | ✅ Active | 17 rules, 6 ADRs, 2 validators |
| L2 | Knowledge | 🟡 Partial | Memory module OK, no Knowledge Graph |
| L3 | Cognition | 🟡 Partial | Agent definitions OK, Context Manager missing |
| L4 | Agent Registry | ✅ Active | 7 agents (Router, Plan, Architect, Code, PreVerify, PostVerify, Ask) |
| L5 | Execution | 🟡 Partial | Docker + CI OK, sandbox missing |
| L6 | Engineering | ✅ Active | Full pipeline operational |
| L7 | Reliability | 🟡 Partial | Evaluation Harness OK, drift detection missing |
| L8 | Observability | 🟡 Partial | Logging + metrics OK, analytics dashboard missing |
| L9 | Model Intelligence | ✅ Active | ADR-010 implemented, v1 complete |
| L10 | Platform | 🟡 Partial | Scaffold only |

## 4. Backend Module Inventory

| Module | Files | Tests | Status | Endpoints |
|--------|-------|-------|--------|-----------|
| shared/ | 5 | — | ✅ Active | — |
| auth/ | 7 | — | ✅ Active | POST register, POST login |
| user/ | 5 | — | ✅ Active | GET me |
| learning/ | 4 | — | ✅ Active | lessons + exercises CRUD |
| recommendation/ | 21 | 72 | ✅ Active | recommendations + trust scores + checkpoints |
| evaluation/ | 18 | 50 | ✅ Active | executions + metrics + analytics |
| memory/ | 8 | 35 | ✅ Active | agent memories CRUD + context retrieval |
| model-registry/ | 18 | 67 | ✅ Active | providers + models + routes + fallbacks + costs |

## 5. Database Schema Summary

- 20 Prisma models, 6 enums
- Model groups:
  - **Core:** User, Lesson, Exercise, UserLesson
  - **Recommendation:** Recommendation, RecommendationOption, Checkpoint, TrustScore, AccuracySnapshot
  - **Evaluation:** AgentExecution, ExecutionPhase, AgentMetric, MetricDimension
  - **Memory:** AgentMemory, DecisionMemory
  - **Model Registry:** ModelProvider, ModelRegistry, ModelRoute, FallbackChain, CostLog
- All UUID v7 primary keys, snake_case column mapping

## 6. Architecture Decisions

| ID | Title | Status |
|----|-------|--------|
| ADR-001 | Reuse-First Governance | Active |
| ADR-002 | Ask Agent as Virtual CTO Advisor | Active |
| ADR-003 | Agent Evaluation Harness v1 | Active |
| ADR-008 | Lifecycle Declarations | Active |
| ADR-009 | Prisma v6 + UUID v7 | Active |
| ADR-010 | Model Intelligence & Cost Tracking | Active |
| ADR-011 | Knowledge Graph Design | Active |
| ADR-012 | Context Manager Architecture | Active |
| ADR-013 | Drift Detection Mechanism | Active |
| ADR-014 | Analytics Dashboard | Active |

## 7. Implementation Roadmap

### Phase A (Current) — System Specification + Knowledge Foundation

| Task | Status |
|------|--------|
| System Spec Document (task A1) | ✅ Complete |
| ADR-011 Knowledge Graph | ✅ Complete |
| ADR-012 Context Manager | ✅ Complete |
| ADR-013 Drift Detection | ✅ Complete |
| ADR-014 Analytics Dashboard | ✅ Complete |
| Knowledge Graph implementation | 🔲 Pending |
| Context Manager implementation | 🔲 Pending |

### Phase B — Cognition & Reliability

| Task | Status |
|------|--------|
| Drift Detection implementation | 🔲 Pending |
| Analytics API implementation | 🔲 Pending |
| Agent execution optimization | 🔲 Pending |

### Phase C — Observability & Platform

| Task | Status |
|------|--------|
| Analytics dashboard UI | 🔲 Pending |
| Self-healing | 🔲 Pending |
| Frontend admin UI | 🔲 Pending |

## 8. Constraints & Principles

1. Monolith-first (Constitution §3)
2. Simplicity over complexity (Constitution §7)
3. Free-first infrastructure
4. Reuse-first patterns
5. Lifecycle declarations on all new files (ADR-008)
6. Service layer coverage ≥80% (Constitution §6)
7. No `any` types (Constitution §4)

## 9. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Knowledge Graph scope creep | Medium | Start with manual seed, no auto-scan in v1 |
| Context Manager token budget | Medium | Tiered compression strategy |
| Drift Detection false positives | Low | Configurable thresholds |
| Third-party free tier limits | Low | Monitor usage, upgrade only when needed |

## 10. Document Governance

- **Owner:** CTO (Ask Agent)
- **Review cadence:** Per Phase
- **Change process:** PR with Architect review

---

**End of System Specification v1**
