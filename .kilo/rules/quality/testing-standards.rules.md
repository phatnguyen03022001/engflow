/* @lifecycle ACTIVE — Quality Rules: Testing Standards and Coverage */
/* @tags backend, testing */

# Testing Standards

## 1. Purpose

Defines mandatory testing practices, coverage thresholds, and test organization for all code changes.

---

## 2. Test Framework

- **Runner:** Jest
- **HTTP assertions:** Supertest
- **Location:** Unit tests colocated in `src/<module>/__tests__/`
- **Naming:** `<name>.spec.ts` for unit tests, `<name>.e2e-spec.ts` for E2E tests

## 3. Coverage Thresholds

| Layer | Minimum Coverage | Measurement |
|-------|-----------------|-------------|
| Service layer | ≥80% | Line coverage (Constitution §6) |
| Controller layer | ≥70% | Line coverage |
| DTO/validation | ≥60% | Line coverage (key transforms) |
| Overall project | ≥70% | Line coverage |

## 4. Test Types

### 4.1 Unit Tests (Required)

- Every service method must have at least one unit test
- Mock Prisma using `PrismaService` mock factory pattern
- Test both happy path and error/edge cases
- Tests must be independent: no shared mutable state, no test ordering dependencies

### 4.2 Integration Tests (Recommended for multi-module changes)

- Place in `test/integration/`
- Test cross-module interactions through controller endpoints
- Use real PostgreSQL via Docker Compose

### 4.3 E2E Tests (Required for API contract changes)

- Place in `test/e2e/`
- Test full request → response cycle including auth, guards, and validation
- Run against a running Docker Compose stack

## 5. Test Patterns

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

## 6. Prohibited Patterns

- `test.skip` or `describe.skip` — never commit skipped tests
- `test.only` — never commit focused tests
- `console.log` in test output — clean test output required
- Tests that depend on execution order — must be hermetic
- Snapshot tests on unstable output (dates, UUIDs, random values)

## 7. Running Tests

| Command | Purpose |
|---------|---------|
| `npx jest --passWithNoTests` | Run all unit tests |
| `npx jest --coverage` | Run with coverage report |
| `npx jest --watch` | Watch mode for development |
| `npx jest <pattern>` | Run specific test file |

---

**End of Testing Standards**
