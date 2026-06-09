/* @lifecycle ACTIVE — Quality Rules: Code Standards, Review Checklist, and Testing Standards */
/* @tags backend, coding, testing */

# Quality Rules

## 1. Purpose

Defines TypeScript coding standards, style rules, code review checklist, and testing practices for the Floweng codebase.

---

## 2. TypeScript Configuration

- **Strict mode required** (Constitution §4): `strict: true` in `tsconfig.json`
- No `any` types — use `unknown` with type guards when the type is not known
- Explicit return types on all public methods
- Prefer `interface` over `type` for object shapes (use `type` for unions/intersections)

## 3. Prohibited Patterns (Constitution §4)

| Pattern | Reason | Replacement |
|---------|--------|-------------|
| `any` type | Type safety violation | `unknown` + type guard |
| `console.log()` | Production noise | NestJS `Logger` service |
| Function with >40 lines | Maintainability | Break into smaller functions |
| `// @ts-ignore` | Suppresses real errors | Fix the type issue |

## 4. Imports

Group imports in this order, separated by blank lines:

```typescript
// 1. External/NestJS imports
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';

// 2. Internal module imports
import { Recommendation } from './interfaces/recommendation.interface';
```

- Prefer named exports over default exports
- Use path aliases from `tsconfig.json` where available

## 5. Async Patterns

- Always use `async/await` over raw `.then()` chains
- Never forget `await` in async functions — use `eslint@typescript-eslint/no-floating-promises`
- Handle Promise rejections with try/catch
- Use `Promise.all()` for parallel independent async operations

## 6. Error Handling

- Controllers: let NestJS exception filters handle errors (never try/catch in controllers for expected flow)
- Services: throw NestJS `HttpException` subclasses (`NotFoundException`, `BadRequestException`, etc.)
- Catch unexpected errors at service boundaries and convert to typed exceptions
- Never expose internal error details to clients

## 7. NestJS Best Practices

- `@Injectable()` on all services
- `@Controller()` with path prefix matching module name
- Use NestJS lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`) for connection management
- Prefer constructor injection over `@Inject()` decorator
- Use `@Req()` and `@Res()` only when absolutely necessary (prefer decorators)

## 8. Code Review Checklist

### 8.1 Pre-Review Requirements

Before starting a review, confirm:
- [ ] Build passes (`npm run build` zero errors)
- [ ] All unit tests pass (`npx jest --passWithNoTests`)
- [ ] Lint passes (if lint configured)
- [ ] Changes are scoped to the task requirements

### 8.2 Correctness
- [ ] Does the code implement the specified requirements?
- [ ] Are edge cases handled (null, empty, boundary values)?
- [ ] Are error states propagated correctly?
- [ ] Is the async/await chain correct (no swallowed promises)?

### 8.3 Constitution Compliance
- [ ] No `any` types — `unknown` with type guards preferred (Constitution §4)
- [ ] No `console.log` in production code (Constitution §4)
- [ ] DTOs use `class-validator` decorators (Constitution §4)
- [ ] Module boundaries respected (Constitution §5)
- [ ] Controllers handle HTTP only, services contain business logic (Constitution §5)

### 8.4 ADR Compliance
- [ ] Schema changes follow Prisma conventions (ADR-002/003 patterns)
- [ ] Lifecycle declarations on all new files (ADR-008)

### 8.5 Security
- [ ] User input validated at controller boundary
- [ ] Auth guards applied to protected endpoints
- [ ] No sensitive data in logs or error responses
- [ ] No SQL injection vectors (Prisma parameterized queries — verify raw queries)

### 8.6 Maintainability
- [ ] No unnecessary abstractions
- [ ] Follows existing module patterns
- [ ] Functions have clear single responsibility
- [ ] Naming is descriptive and consistent with codebase

### 8.7 Testing
- [ ] Tests added/updated for new functionality
- [ ] Existing tests still pass
- [ ] Error cases covered
- [ ] No `.only` or `.skip` in test files

### 8.8 Review Outcome

| Outcome | Action |
|---------|--------|
| PASS | Route to COMMIT |
| FLAG | Route to COMMIT with documented concerns |
| FAIL | Route back to CODE with specific issues |

## 9. Testing Standards

### 9.1 Test Framework

- **Runner:** Jest
- **HTTP assertions:** Supertest
- **Location:** Unit tests colocated in `src/<module>/__tests__/`
- **Naming:** `<name>.spec.ts` for unit tests, `<name>.e2e-spec.ts` for E2E tests

### 9.2 Coverage Thresholds

| Layer | Minimum Coverage | Measurement |
|-------|-----------------|-------------|
| Service layer | ≥80% | Line coverage (Constitution §6) |
| Controller layer | ≥70% | Line coverage |
| DTO/validation | ≥60% | Line coverage (key transforms) |
| Overall project | ≥70% | Line coverage |

### 9.3 Test Types

**Unit Tests (Required)**
- Every service method must have at least one unit test
- Mock Prisma using `PrismaService` mock factory pattern
- Test both happy path and error/edge cases
- Tests must be independent: no shared mutable state, no test ordering dependencies

**Integration Tests (Recommended for multi-module changes)**
- Place in `test/integration/`
- Test cross-module interactions through controller endpoints
- Use real PostgreSQL via Docker Compose

**E2E Tests (Required for API contract changes)**
- Place in `test/e2e/`
- Test full request → response cycle including auth, guards, and validation
- Run against a running Docker Compose stack

### 9.4 Test Patterns

```typescript
describe('<ServiceName>', () => {
  describe('<methodName>', () => {
    it('should <expected behavior> when <condition>', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should throw <error> when <edge case>', async () => {
      // ...
    });
  });
});
```

### 9.5 Prohibited Patterns

- `test.skip` or `describe.skip` — never commit skipped tests
- `test.only` — never commit focused tests
- `console.log` in test output — clean test output required
- Tests that depend on execution order — must be hermetic
- Snapshot tests on unstable output (dates, UUIDs, random values)

### 9.6 Running Tests

| Command | Purpose |
|---------|---------|
| `npx jest --passWithNoTests` | Run all unit tests |
| `npx jest --coverage` | Run with coverage report |
| `npx jest --watch` | Watch mode for development |
| `npx jest <pattern>` | Run specific test file |

---

**End of Quality Rules**
