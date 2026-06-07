/* @lifecycle ACTIVE — Constitution: Immutable Rules for Floweng AI Software Factory */

# Constitution v1.0

**Status:** Active
**Last Updated:** 2026-06-07

---

## §1. Source of Truth

Repository files are the single source of truth.
Model memory is never authoritative.
CI output overrides AI judgment.

## §2. Technology Stack

- Backend: TypeScript, NestJS
- Frontend: TypeScript, Next.js (App Router)
- Database: PostgreSQL
- ORM: Prisma
- Testing: Jest + Supertest

New technologies require explicit ADR approval.

## §3. Architecture

- Monolith-first: Modular monolith with clear module boundaries
- Separation of concerns: layers, modules, and services must be cleanly separated
- Patterns over frameworks: prefer established patterns over framework magic

## §4. Code Quality

- All DTOs must use class-validator decorators
- All service methods must have unit tests
- TypeScript strict mode required (no `any` types)
- No console.log in production code

## §5. Module Boundaries

- Controllers handle HTTP requests/responses only
- Services contain business logic
- Modules should be loosely coupled
- Circular dependencies are forbidden

## §6. Testing

- Service layer coverage ≥80%
- Unit tests colocated with source files: `src/<module>/__tests__/`
- Integration tests in: `test/integration/`
- E2E tests in: `test/e2e/`

## §7. Simplicity

- Prefer simple solutions over complex ones
- Avoid premature abstraction
- Favor composition over inheritance
- Each module should have a clear, single responsibility

## §8. Documentation

- All architecture changes must update docs/architecture.md
- Major decisions require ADR in docs/decisions.md
- Lifecycle declarations on all new files (ADR-008)

## §9. Security

- Authentication via JWT
- Password hashing via bcrypt
- Role-based access control (RBAC)
- All user input must be validated

## §10. Change Management

- No direct production changes without review
- All changes follow the execution flow: REQUEST → ROUTER → PLAN → ARCH → PRE_VERIFY → CODE → POST_VERIFY → COMMIT
- No bypassing gates without explicit approval

---

**End of Constitution**