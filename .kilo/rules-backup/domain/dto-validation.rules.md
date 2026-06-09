/* @lifecycle ACTIVE — Domain Rules: DTO Design and Validation */
/* @tags backend */

# DTO Validation

## 1. Purpose

Defines DTO naming, validation, and transformation conventions for NestJS backend modules.

---

## 2. DTO Location

All DTOs reside in `src/<module>/dto/` as individual files.

## 3. DTO Naming

| Purpose | Convention | Example |
|---------|-----------|---------|
| Creation | `Create<Entity>Dto` | `CreateExecutionDto` |
| Update | `Update<Entity>Dto` | `UpdateUserDto` |
| Query parameters | `Query<Entity>Dto` | `QueryExecutionsDto` |
| Response | `<Entity>ResponseDto` (or inline) | `ExecutionResponseDto` |

## 4. Validation Decorators

Every DTO MUST use `class-validator` decorators:

```typescript
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Expose, Transform } from 'class-transformer';
```

- Required fields: `@IsString()`, `@IsInt()`, etc.
- Optional fields: `@IsOptional()` + type decorator
- Numeric constraints: `@Min(0)`, `@Max(100)`
- String length: `@MinLength(1)`, `@MaxLength(255)`

## 5. Transformation

Use `class-transformer` where needed:

```typescript
@Expose()           // Include in serialization
@Transform(...)     // Value transformation
```

Validation and transformation are applied at the controller boundary via `ValidationPipe` (global).

## 6. Shared DTOs

- Simple pagination, ID params, or status filters should use shared types from `shared/`
- Complex module-specific DTOs live in their own module's `dto/` directory

## 7. Reference Templates

Canonical DTO examples:
- `recommendation/dto/create-recommendation.dto.ts`
- `recommendation/dto/accuracy-query.dto.ts`
- `evaluation/dto/create-execution.dto.ts`
- `evaluation/dto/query-metrics.dto.ts`

---

**End of DTO Validation**
