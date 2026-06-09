/* @lifecycle ACTIVE — Quality Rules: Code Review Checklist */
/* @tags backend, coding, testing */

# Code Review Checklist

## 1. Purpose

Defines the mandatory review checklist for all code changes before they are committed.

---

## 2. Pre-Review Requirements

Before starting a review, confirm:
- [ ] Build passes (`npm run build` zero errors)
- [ ] All unit tests pass (`npx jest --passWithNoTests`)
- [ ] Lint passes (if lint configured)
- [ ] Changes are scoped to the task requirements

## 3. Review Dimensions

### 3.1 Correctness
- [ ] Does the code implement the specified requirements?
- [ ] Are edge cases handled (null, empty, boundary values)?
- [ ] Are error states propagated correctly?
- [ ] Is the async/await chain correct (no swallowed promises)?

### 3.2 Constitution Compliance
- [ ] No `any` types — `unknown` with type guards preferred (Constitution §4)
- [ ] No `console.log` in production code (Constitution §4)
- [ ] DTOs use `class-validator` decorators (Constitution §4)
- [ ] Module boundaries respected (Constitution §5)
- [ ] Controllers handle HTTP only, services contain business logic (Constitution §5)

### 3.3 ADR Compliance
- [ ] Schema changes follow Prisma conventions (ADR-002/003 patterns)
- [ ] Lifecycle declarations on all new files (ADR-008)

### 3.4 Security
- [ ] User input validated at controller boundary
- [ ] Auth guards applied to protected endpoints
- [ ] No sensitive data in logs or error responses
- [ ] No SQL injection vectors (Prisma parameterized queries — verify raw queries)

### 3.5 Maintainability
- [ ] No unnecessary abstractions
- [ ] Follows existing module patterns
- [ ] Functions have clear single responsibility
- [ ] Naming is descriptive and consistent with codebase

### 3.6 Testing
- [ ] Tests added/updated for new functionality
- [ ] Existing tests still pass
- [ ] Error cases covered
- [ ] No `.only` or `.skip` in test files

## 4. Review Outcome

| Outcome | Action |
|---------|--------|
| PASS | Route to COMMIT |
| FLAG | Route to COMMIT with documented concerns |
| FAIL | Route back to CODE with specific issues |

---

**End of Code Review Checklist**
