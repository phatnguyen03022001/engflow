/* @lifecycle ACTIVE — Testing Rules: Test Execution and Environment */
/* @tags backend, testing */

# Testing Rules

## 1. Purpose

Defines how tests are executed, what test environments are required, and how test results are validated.

---

## 2. Running Tests

### 2.1 Unit Tests

```bash
# Run all unit tests
npx jest --passWithNoTests

# Run with coverage
npx jest --coverage

# Run specific test file
npx jest path/to/file.spec.ts

# Run tests matching a pattern
npx jest -t "should create execution"

# Watch mode for TDD
npx jest --watch
```

### 2.2 E2E Tests

E2E tests require a running Docker Compose stack with PostgreSQL:

```bash
# Ensure Docker is running
docker compose up -d

# Run E2E tests
npx jest --config test/jest-e2e.json

# Run E2E tests with specific pattern
npx jest --config test/jest-e2e.json -t "recommendation"
```

## 3. Test Independence

- Every test must be hermetic: no dependency on other tests or execution order
- Use `beforeEach` to set up fresh state; use `afterEach` to clean up
- Never share mutable state between tests via module-level variables
- Use `describe` blocks to organize related tests, not to share state

## 4. Test Database

- Unit tests: mock PrismaService — never hit a real database
- Integration/E2E tests: use real PostgreSQL via Docker Compose
- E2E database is ephemeral: `docker compose down -v` removes all data
- Never point tests at a production database

## 5. CI Execution (Future)

When CI is configured, the test execution order will be:
1. Build check
2. Unit tests (fast feedback)
3. Integration tests
4. E2E tests (full pipeline)

All stages must pass before merge.

## 6. Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Timeout | Async test not resolving | Ensure `await` on async operations, increase timeout for E2E |
| Prisma not connected | Missing Docker/Pg | Run `docker compose up -d` |
| Module not found | Build stale | Run `npm run build` |
| Coverage low | Missing test paths | Add `--collectCoverageFrom` patterns |
| Test pollution | Shared state | Use `beforeEach`/`afterEach` for clean state |

---

**End of Testing Rules**
