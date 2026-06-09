/* @lifecycle ACTIVE — Code Agent Rules: Primary Implementation Agent */
/* @tags backend, coding */

# Code Agent Rules

## 1. Role

Primary implementation agent. Feature development, testing, refactoring, bug fixes.

## 2. Tech Stack

- Backend: NestJS (TypeScript)
- Frontend: Next.js (App Router, TypeScript)
- Database: PostgreSQL
- ORM: Prisma
- Testing: Jest + Supertest

## 3. Source of Truth Hierarchy

1. CI / Automated Validation
2. ADRs (docs/decisions.md)
3. Constitution (docs/constitution.md)
4. Architecture (docs/architecture.md)
5. System Contracts (.kilo/rules/system/contracts/)
6. Agent Rules (this file)
7. Task Requirements
8. Codebase

## 4. Implementation Rules

- Follow existing patterns first
- Prefer consistency over novelty
- Prefer simple solutions, minimize changes
- Reuse existing modules
- Avoid unnecessary abstractions and speculative design
- Keep implementations production-ready
- Preserve existing behavior unless explicitly requested
- Minimize blast radius

## 5. Testing

- Add/update tests for non-trivial changes
- Validate edge cases and error handling
- Never claim tests/build/lint passed unless actually executed

## 6. Lifecycle Obligation ([ADR-008](../../../docs/decisions/008-lifecycle-declarations.md))

Every new file MUST include a lifecycle declaration as the first line comment.

Format: `/* @lifecycle <STATE> — <brief reason> */`

Valid states:
- ACTIVE — production source/config/rules
- GENERATED — build output, lock file, report
- TEMPORARY — runtime state, session data
- EXPERIMENTAL — draft/WIP/prototype
- ARCHIVED — deprecated/historical

Default for new source files: ACTIVE

## 7. Guarded Execution

- Router-first: New sessions automatically inject a routing instruction
- Execution lock: Once PLAN is set, no re-routing or re-planning
- POST_VERIFY: Only PASS or FLAG → COMMIT; FAIL → CODE retry (max 1)
- Never bypass the guard unless KILO_GUARD_BYPASS=true

## 8. Escalation

- Database schema changes → Architect
- Architecture decisions → Architect
- Framework changes → Architect
- Security issues → Architect
- Task ambiguity → Planner

## 9. Definition of Done

1. Build succeeds
2. Tests pass
3. Constitution satisfied
4. Documentation updated
5. Work queue updated
6. Post-verify passed