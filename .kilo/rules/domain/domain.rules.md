/* @lifecycle ACTIVE — Domain Rules: Module Patterns, Prisma, DTO, and Shared Utilities */
/* @tags backend, architecture, database */

# Domain Rules

## 1. Purpose

Defines module structure, Prisma schema conventions, DTO validation, and shared utility patterns for the Floweng backend.

---

## 2. Module Patterns

### 2.1 Module Structure Convention

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

### 2.2 Module Registration

- Every module must be registered in `app.module.ts` imports
- Shared modules (SharedModule) must be imported by dependent modules
- Circular imports between modules are forbidden (Constitution §5)

### 2.3 File Naming

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

### 2.4 Cross-Module Imports

- Modules import from `SharedModule` for common utilities (PrismaService, filters, interceptors)
- Direct cross-module service calls require explicit provider export + import
- Prefer composing through controllers (HTTP calls) over direct service imports for unrelated modules

### 2.5 Reference Templates

Existing canonical modules to follow:
- `recommendation/` (21 files) — Recommendation registry (ADR-002)
- `evaluation/` (18 files) — Agent evaluation harness (ADR-003)
- `auth/` (7 files) — Authentication and authorization
- `user/` (5 files) — User management

## 3. Prisma Conventions

Reference file: `backend/prisma/schema.prisma`

### 3.1 Model Naming

- Models: singular PascalCase (`Recommendation`, not `Recommendations`)
- Field names: camelCase with `@map("snake_case")` for database columns
- Enums: singular PascalCase (`Difficulty`, `UserRole`)
- Table names: snake_case via `@@map("table_name")`

### 3.2 Field Conventions

| Field | Type | Convention |
|-------|------|------------|
| Primary Key | `String @id @default(uuid(7))` | UUID v7, never autoincrement |
| Created At | `DateTime @default(now()) @map("created_at")` | Always present |
| Updated At | `DateTime @updatedAt @map("updated_at")` | Always present |
| Foreign Key | `String @map("entity_id")` | snake_case FK name |
| Soft Deletes | Not used (hard deletes with cascade) | Until explicitly needed |

### 3.3 Index Strategy

- Single-field indexes on columns used in `where` or `orderBy`
- Compound indexes on multi-field query patterns: `@@index([field1, field2])`
- Unique compound constraints: `@@unique([field1, field2])`
- Always add indexes on FK fields used in relations
- Time-range queries should use `createdAt` index

### 3.4 Relations

- `onDelete: Cascade` for child records (exercises cascade from lesson)
- Required relations use `@relation(fields: [...], references: [...])`
- Always name the relation reference field explicitly
- Use `@@map("table_name")` for all models

### 3.5 Enum Definitions

- Define before first model that uses them
- PascalCase values: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`
- Default value: `@default(<FIRST_VALUE>)`

### 3.6 Schema Organization

Use section comment markers to group related models:

```prisma
// ─── Module Name (TASK-XXX) ──────────────────────────────────────
```

Keep models in a single `schema.prisma` file. Extract only if file exceeds 500 lines.

## 4. DTO Validation

### 4.1 DTO Location

All DTOs reside in `src/<module>/dto/` as individual files.

### 4.2 DTO Naming

| Purpose | Convention | Example |
|---------|-----------|---------|
| Creation | `Create<Entity>Dto` | `CreateExecutionDto` |
| Update | `Update<Entity>Dto` | `UpdateUserDto` |
| Query parameters | `Query<Entity>Dto` | `QueryExecutionsDto` |
| Response | `<Entity>ResponseDto` (or inline) | `ExecutionResponseDto` |

### 4.3 Validation Decorators

Every DTO MUST use `class-validator` decorators:

```typescript
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Expose, Transform } from 'class-transformer';
```

- Required fields: `@IsString()`, `@IsInt()`, etc.
- Optional fields: `@IsOptional()` + type decorator
- Numeric constraints: `@Min(0)`, `@Max(100)`
- String length: `@MinLength(1)`, `@MaxLength(255)`

### 4.4 Transformation

Use `class-transformer` where needed:

```typescript
@Expose()           // Include in serialization
@Transform(...)     // Value transformation
```

Validation and transformation are applied at the controller boundary via `ValidationPipe` (global).

### 4.5 Shared DTOs

- Simple pagination, ID params, or status filters should use shared types from `shared/`
- Complex module-specific DTOs live in their own module's `dto/` directory

### 4.6 Reference Templates

Canonical DTO examples:
- `recommendation/dto/create-recommendation.dto.ts`
- `recommendation/dto/accuracy-query.dto.ts`
- `evaluation/dto/create-execution.dto.ts`
- `evaluation/dto/query-metrics.dto.ts`

## 5. Shared Utilities

### 5.1 Directory Structure

```
src/shared/
├── shared.module.ts         # NestJS @Module exporting shared providers
├── filters/
│   └── http-exception.filter.ts   # Centralized error handling
├── interceptors/
│   └── transform.interceptor.ts   # Response transformation
├── prisma/
│   └── prisma.service.ts          # Single Prisma client instance
└── utils/
    └── confidence-interval.util.ts # Pure utility functions
```

### 5.2 PrismaService

- `PrismaService` is the SINGLE canonical Prisma client
- Never create duplicate Prisma client instances
- Import via `SharedModule` export — never instantiate directly
- Extends `PrismaClient` with `OnModuleInit` lifecycle hook

### 5.3 Adding Shared Code

New shared utilities require:
1. Placed in appropriate subdirectory (`utils/`, `types/`, etc.)
2. Exported from `SharedModule` providers
3. Pure functions where possible (no side effects)
4. Unit test coverage ≥80%

**Do NOT use `SharedModule` as a dumping ground.** Ask: "Is this utility used by ≥2 modules?" If only 1 module needs it, keep it colocated.

### 5.4 Shared Types

- Global TypeScript types used across modules go in `shared/`
- Module-specific types stay in their module's `interfaces/` directory

### 5.5 Existing Shared Utilities

| File | Purpose |
|------|---------|
| `prisma.service.ts` | Prisma client singleton |
| `http-exception.filter.ts` | Centralized exception filter |
| `transform.interceptor.ts` | Response transform interceptor |
| `confidence-interval.util.ts` | Statistical CI computation |

---

**End of Domain Rules**
