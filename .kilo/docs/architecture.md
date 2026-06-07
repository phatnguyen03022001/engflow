/* @lifecycle ACTIVE — System Architecture Document */

# Architecture v1.0

**Status:** Active
**Last Updated:** 2026-06-07

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

### Layer 2 — Knowledge
Knowledge Graph, Repository Knowledge, Project Knowledge, Pattern Library.
Semantic understanding of the codebase and domain.

### Layer 3 — Cognition
Orchestrator, Router, Planner, Memory, Context Manager.
Decision-making and workflow coordination.

### Layer 4 — Agent Registry
Planning Agents, Architecture Agents, Coding Agents, Verification Agents, Reliability Agents.
Specialized agents with defined responsibilities.

### Layer 5 — Execution
Executor, Tool Runtime, Workspace Manager, Integration Gateway.
Infrastructure for running tasks and managing resources.

### Layer 6 — Engineering
Plan, Architect, PreVerify, Coder, PostVerify.
Core engineering workflow.

### Layer 7 — Reliability
Drift Prevention, Repair System, Harness.
System health and consistency.

### Layer 8 — Observability
Telemetry, Analytics, Cost Intelligence.
Visibility into system behavior.

### Layer 9 — Model Intelligence
Model Registry, Model Routing, Fallback Strategy, Model Evaluation.
AI model management.

### Layer 10 — Platform
Autonomous Engineering Platform, Self-* Capabilities.
Orchestration of all layers.

---

## Backend Architecture

### Module Structure
```
src/
├── prisma/         # Database access layer
├── auth/           # Authentication and authorization
├── user/           # User management
├── learning/       # Learning modules (courses, lessons, exercises)
├── progress/       # Progress tracking and analytics
├── admin/          # Admin dashboard
└── shared/         # Shared utilities and types
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
