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
5. Runtime Verification passed — build, lint, and test all PASS
6. Work queue updated (renumbered from 5)
7. Post-verify passed (renumbered from 6)

## 10. Runtime Verification (ADR-017)

Before transitioning to POST_VERIFY, CODE MUST execute runtime verification commands
in strict sequential order. This is a mandatory final step of all CODE implementations.

### 10.1 Execution Order

| Step | Command | Failure Behavior |
|------|---------|------------------|
| 1 | `npm run build` | Blocks all subsequent checks |
| 2 | `npm run lint` | Runs only if build passes |
| 3 | `npx jest --passWithNoTests` | Runs only if lint passes |

### 10.2 Output Capture Rules

- Capture FULL raw stdout and stderr for each command
- Do NOT summarize, truncate, or filter the output
- Capture exit codes (0 = pass, non-zero = fail)
- Record approximate duration for each command

### 10.3 Runtime Verification Report Format

CODE SHALL produce a structured report as part of its output before the
`code → post_verify` transition. The report uses the following format:

```markdown
## Runtime Verification Report

| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS/FAIL | <code> | <seconds>s |
| `npm run lint` | PASS/FAIL | <code> | <seconds>s |
| `npx jest --passWithNoTests` | PASS/FAIL | <code> | <seconds>s |

### Build Output
<full raw stdout+stderr>

### Lint Output
<full raw stdout+stderr>

### Test Output
<full raw stdout+stderr>
```

### 10.4 Report Delivery

The Runtime Verification Report MUST be included in the transition to POST_VERIFY.
CODE SHALL present it as part of its final handoff output so POST_VERIFY can review it.

### 10.5 Failure Handling

If any command fails:
1. DO NOT proceed to POST_VERIFY
2. Fix the issue (same as any other implementation bug)
3. Re-run the entire verification sequence from step 1
4. Only when all 3 commands pass, transition to POST_VERIFY

If a command times out (build > 120s, lint > 60s, test > 300s):
1. Treat as a FAIL
2. Report "TIMEOUT" in the Status column
3. Include any partial output captured before timeout