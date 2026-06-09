/* @lifecycle ACTIVE — Domain Rules: Module Structure and Patterns */
/* @tags backend, architecture */

# Module Patterns

## 1. Purpose

Defines the canonical module structure, naming conventions, and organizational patterns for NestJS backend modules.

---

## 2. Module Structure Convention

Every NestJS backend module follows the `Controller → Service → Prisma → Database` layer pattern.

```
src/<module>/
├── <module>.module.ts           # NestJS @Module decorator
├── <module>.controller.ts       # HTTP request/response handling
├── services/
│   └── <name>.service.ts        # Business logic
├── dto/
│   ├── create-<entity>.dto.ts   # Creation DTOs
│   └── <query>-<entity>.dto.ts  # Query/response DTOs
├── interfaces/
│   └── <name>.interface.ts      # TypeScript interfaces/types
├── schedulers/
│   └── <name>.scheduler.ts      # Cron jobs (when needed)
└── __tests__/
    └── <name>.spec.ts           # Unit tests colocated
```

## 3. Module Registration

- Every module must be registered in `app.module.ts` imports
- Shared modules (SharedModule) must be imported by dependent modules
- Circular imports between modules are forbidden (Constitution §5)

## 4. File Naming

| File Type | Convention | Example |
|-----------|-----------|---------|
| Module | `<name>.module.ts` | `evaluation.module.ts` |
| Controller | `<name>.controller.ts` | `recommendation.controller.ts` |
| Service | `<name>.service.ts` | `trust-score.service.ts` |
| DTO | `<action>-<entity>.dto.ts` | `create-execution.dto.ts` |
| Interface | `<name>.interface.ts` | `metric.interface.ts` |
| Scheduler | `<name>.scheduler.ts` | `metric.scheduler.ts` |
| Test | `<name>.spec.ts` | `execution-trace.service.spec.ts` |
| E2E Test | `<name>.e2e-spec.ts` | `recommendation-flow.e2e-spec.ts` |

## 5. Cross-Module Imports

- Modules import from `SharedModule` for common utilities (PrismaService, filters, interceptors)
- Direct cross-module service calls require explicit provider export + import
- Prefer composing through controllers (HTTP calls) over direct service imports for unrelated modules

## 6. Reference Templates

Existing canonical modules to follow:
- `recommendation/` (21 files) — Recommendation registry (ADR-002)
- `evaluation/` (18 files) — Agent evaluation harness (ADR-003)
- `auth/` (7 files) — Authentication and authorization
- `user/` (5 files) — User management

---

**End of Module Patterns**
