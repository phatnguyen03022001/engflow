/* @lifecycle ACTIVE — System Architecture Document */

# Architecture v1.0

**Status:** Active
**Last Updated:** 2026-06-09

---

## System Overview

**Product:** Floweng — English Learning Platform
**Architecture Pattern:** Modular Monolith
**Tech Stack:**
- **Backend:** NestJS (TypeScript)
- **Frontend:** Next.js (App Router, TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Testing:** Jest + Supertest

---

## AI Software Factory Architecture (10 Layers)

### Layer 1 — Governance
Policy Management, Compliance, Decision Records (ADRs).
Source of truth for all rules and standards.

**Rules:**
- Constitution (`docs/constitution.md`)
- ADRs (`docs/decisions/`)
- System Contracts (`.kilo/rules/system/contracts/`)
- Agent Rules (`.kilo/rules/agents/`)
- Domain Rules (`.kilo/rules/domain/`)
- Quality Rules (`.kilo/rules/quality/`)
- Execution Rules (`.kilo/rules/execution/`)
- Performance Rules (`.kilo/rules/performance/`)
- Lifecycle Validator (`.kilo/validate/lifecycle-validator.sh`)

### Layer 2 — Knowledge
Knowledge Graph, Repository Knowledge, Project Knowledge, Pattern Library.
Semantic understanding of the codebase and domain.

### Layer 3 — Cognition
Orchestrator, Router, Planner, Memory, Context Manager.
Decision-making and workflow coordination.

**Governance:** ASK v2 Routing (ADR-ASK-001) — Virtual CTO Router specification for request classification, agent dispatch, session management, and routing output contracts.

### Layer 4 — Agent Registry
Planning Agents, Architecture Agents, Coding Agents, Verification Agents, Reliability Agents.
Specialized agents with defined responsibilities.

**Catalog:** ADR-ASK-001 §2.2 (Agent Catalog) — definitive 8-agent catalog with single-responsibility boundaries, permission invariants, and layer assignments.

### Layer 5 — Execution
Executor, Tool Runtime, Workspace Manager, Integration Gateway.
Infrastructure for running tasks and managing resources.

### Layer 6 — Engineering
Plan, Architect, PreVerify, Coder, PostVerify.
Core engineering workflow.

### Layer 7 — Reliability
Drift Prevention, Drift Detection (ADR-013), Repair System, Harness (ADR-003).
Agent evaluation, metric computation, execution trace analysis.
System health and consistency.

### Layer 8 — Observability
Telemetry, Cost Intelligence (via L9 Model Registry).
Analytics merged into evaluation/ module (ADR-014).
Execution trace storage, agent metric API, pipeline visibility.

### Layer 9 — Model Intelligence
Model Registry, Model Routing, Fallback Strategy, Model Evaluation, Cost Tracking.
AI model management via `model-registry/` module (ADR-010).

### Layer 10 — Platform
Autonomous Engineering Platform, Self-* Capabilities.
Orchestration of all layers.

---

## Backend Architecture

### Module Structure
```
src/
├── shared/         # Shared utilities and types               ✅ active
├── auth/           # Authentication and authorization         ✅ active
├── user/           # User management                          ✅ active
├── learning/       # Learning modules (courses, lessons, exercises) ✅ active
├── recommendation/ # Recommendation registry (ADR-002)        ✅ active
├── evaluation/     # Agent evaluation harness (ADR-003)       ✅ active
├── memory/         # Agent memory and context retrieval       ✅ active
└── model-registry/ # Model intelligence (ADR-010)             ✅ active
```

### Layer Pattern
```
Controller → Service → Prisma → Database
```

**Rules:**
- Controllers handle HTTP requests and responses only
- Services contain business logic
- Prisma handles database access
- No cross-layer violations

---

## Frontend Architecture

### Directory Structure
```
app/
├── (auth)/         # Authentication pages
├── (dashboard)/    # Main dashboard
├── learn/          # Learning content
├── exercises/      # Exercise pages
├── progress/       # Progress tracking
└── admin/          # Admin interface
```

### Component Pattern
```
Page → Server Component → Client Component (when needed)
```

**Rules:**
- Prefer Server Components
- Use Client Components only when interactivity required
- API calls from Server Components

---

## Cross-Cutting Concerns

### Logging
- Structured logging via @nestjs/common Logger
- Levels: error, warn, log, debug

### Error Handling
- Centralized exception filters
- Consistent error response format
- User-facing: clear error messages

### Validation
- class-validator + class-transformer for DTOs
- Validation at controller boundary

### Testing
- Unit tests: colocated `src/<module>/__tests__/`
- Integration tests: `test/integration/`
- E2E tests: `test/e2e/`
- Coverage threshold: service layer ≥80%

---

## Deployment

**Pattern:** Monolith deployment (single container)
**Database:** PostgreSQL via Docker Compose
**Environment:** Development via Docker, Production (TBD)

---

**End of Document**
