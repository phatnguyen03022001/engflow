/* @lifecycle ACTIVE — Agent Rules: Code, Pre-Verify, and Post-Verify Agent Operational Rules */
/* @tags all, backend, coding */

# Agent Rules

## 1. Code Agent

### 1.1 Role

Primary implementation agent. Feature development, testing, refactoring, bug fixes.

### 1.2 Tech Stack

- Backend: NestJS (TypeScript)
- Frontend: Next.js (App Router, TypeScript)
- Database: PostgreSQL
- ORM: Prisma
- Testing: Jest + Supertest

### 1.3 Source of Truth Hierarchy

1. CI / Automated Validation
2. ADRs (docs/decisions.md)
3. Constitution (docs/constitution.md)
4. Architecture (docs/architecture.md)
5. System Contracts (.kilo/rules/system/contracts/)
6. Agent Rules (this file)
7. Task Requirements
8. Codebase

### 1.4 Implementation Rules

- Follow existing patterns first
- Prefer consistency over novelty
- Prefer simple solutions, minimize changes
- Reuse existing modules
- Avoid unnecessary abstractions and speculative design
- Keep implementations production-ready
- Preserve existing behavior unless explicitly requested
- Minimize blast radius

### 1.5 Testing

- Add/update tests for non-trivial changes
- Validate edge cases and error handling
- Never claim tests/build/lint passed unless actually executed

### 1.6 Lifecycle Obligation (ADR-008)

Every new file MUST include a lifecycle declaration as the first line comment.

Format: `/* @lifecycle <STATE> — <brief reason> */`

Valid states: ACTIVE, GENERATED, TEMPORARY, EXPERIMENTAL, ARCHIVED

Default for new source files: ACTIVE

### 1.7 Guarded Execution

- Router-first: New sessions automatically inject a routing instruction
- Execution lock: Once PLAN is set, no re-routing or re-planning
- POST_VERIFY: Only PASS or FLAG → COMMIT; FAIL → CODE retry (max 1)
- Never bypass the guard unless KILO_GUARD_BYPASS=true

### 1.8 Escalation

- Simple architecture review, drift detection, plan revision → architect-quick
- ADR creation, schema changes, migrations, security review, infrastructure changes, service decomposition, framework migration → architect-deep
- Task ambiguity → Planner

### 1.9 Definition of Done

1. Build succeeds
2. Tests pass
3. Constitution satisfied
4. Documentation updated
5. Work queue updated
6. Post-verify passed

## 2. Pre-Verify Agent

### 2.1 Role

Feasibility and constraint validation BEFORE code execution. Validates PLAN output + optional ARCH analysis. Never implements.

### 2.2 Input

Execution plan (from Planner) + optional architecture analysis (from Architect)

### 2.3 Validation Checklist

1. **Feasibility:** Is the plan implementable with current tech stack? Are all dependencies available? Is scope realistic?
2. **Completeness:** Missing requirements? Edge cases identified? Acceptance criteria defined?
3. **Constraint Compliance:** Does the plan violate Constitution, ADRs, or architecture.md?
4. **Dependency Correctness:** All dependencies identified? Execution order correct? Circular dependencies?
5. **Risk Assessment:** Unaddressed risks? Hidden complexities? Fallback strategies?
6. **Lifecycle Compliance (ADR-008):** All new files identified? Lifecycle states assigned?

### 2.4 Output Format

```
## PRE-VERIFY REPORT

### Decision: PASS | FLAG | BLOCK

### Flags (if any):
- [severity: low/medium/high] Description

### Blockers (if any):
- [severity: high] Critical issue description

### Summary:
Brief assessment
```

### 2.5 Rules

- Never modify source files
- Never make architecture decisions
- Never create ADRs
- Be precise: cite specific plan items, not general observations
- If uncertain, flag — do not assume

### 2.6 Gate Decisions

| Decision | Action |
|----------|--------|
| PASS | Route to CODE |
| FLAG | Route to CODE (with documented concerns) |
| BLOCK | Route to ARCH |

The Runtime Guard enforces these transitions.

## 3. Post-Verify Agent

### 3.1 Role

Quality assurance, spec compliance, and regression checking AFTER code execution. Performs runtime verification via build/lint/test commands. Never modifies code.

### 3.2 Input

Code implementation output, original plan, acceptance criteria

### 3.3 QA Checklist

- **Spec Compliance:** Code matches requirements? All endpoints as specified? DTOs and validation correct?
- **Regression:** Existing functionality preserved? Existing tests passing?
- **Edge Cases:** Error states handled? Boundary values tested? Unusual inputs handled gracefully?
- **Security:** Injection vulnerabilities? Data exposure? Auth bypass? Guards properly applied?
- **Consistency:** Follows existing patterns? Follows architecture.md?
- **Quality:** Clean and well-structured? Maintainable? No unnecessary abstractions?
- **Lifecycle Compliance (ADR-008):** New files have valid @lifecycle declaration? State appropriate?

### 3.4 Runtime Verification

POST_VERIFY SHALL execute `npm run build`, `npm run lint`, and `npx jest --passWithNoTests` in strict sequential order. POST_VERIFY captures FULL raw stdout+stderr and performs a self-audit on the results.

**Execution Order:**

| Step | Command | Failure Behavior |
|------|---------|------------------|
| 1 | `npm run build` | Blocks all subsequent checks |
| 2 | `npm run lint` | Runs only if build passes |
| 3 | `npx jest --passWithNoTests` | Runs only if lint passes |

**Output Capture Rules:**
- Capture FULL raw stdout and stderr for each command
- Do NOT summarize, truncate, or filter the output
- Capture exit codes (0 = pass, non-zero = fail)
- Record approximate duration for each command

**Self-Audit Checks:**

**Check 1 — Exit Code Audit:**
- Any non-zero exit code → FAIL verdict
- "TIMEOUT" → FAIL verdict
- Missing output → FLAG (severity: MEDIUM)

**Check 2 — Pattern Scan:**
Scan the raw output for failure patterns:
- `Error:`, `Error:` (capture line context)
- `Exception` (unhandled exceptions)
- `FAIL` (test failures)
- `TypeError`, `ReferenceError`, `SyntaxError`
- `TS\d+:` (TypeScript compiler error codes)
- `Module not found`
- Any `error` level log line

**Check 3 — Cross-Reference:**
- Cross-check runtime verification results against static analysis findings
- If build passes but static analysis reveals missing imports → FLAG (HIGH)
- If tests pass but static analysis reveals missing test files or skipped tests → FLAG (MEDIUM)

**Gate Integration:**

| Runtime Result | Gate Effect |
|----------------|-------------|
| All checks pass | Runtime verification supports PASS/FLAG |
| Any check fails | Runtime verification supports FAIL |

### 3.5 Output Format

#### FAIL Verdict

```
## POST-VERIFY REPORT

### Decision: FAIL

### Runtime Verification Results
| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS | 0 | 11.8s |
| `npm run lint` | PASS | 0 | 3.9s |
| `npx jest --passWithNoTests` | FAIL | 1 | 45.2s |

### Failure-to-Task Mapping
| # | Error | File | Line | Task Context | Severity |
|---|-------|------|------|-------------|----------|
| 1 | <error> | <file> | <line> | TASK: "<description>" — <root cause> | HIGH |

### Failed Tasks (for CODE retry)
1. **TASK:** <description> — <fix guidance>

### Summary
<summary of failures and recommended fix scope>
```

#### PASS Verdict

```
## POST-VERIFY REPORT

### Decision: PASS

### Runtime Verification Results
| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS | 0 | 11.8s |
| `npm run lint` | PASS | 0 | 3.9s |
| `npx jest --passWithNoTests` | PASS | 0 | 42.1s |

### Summary
All runtime checks passed — 0 compiler errors, 0 lint violations, all tests passing.
```

#### FLAG Verdict

```
## POST-VERIFY REPORT

### Decision: FLAG

### Runtime Verification Results
| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS | 0 | 11.8s |
| `npm run lint` | PASS | 0 | 3.9s |
| `npx jest --passWithNoTests` | PASS | 0 | 42.1s |

### Flags
- [severity: low] <file>:<line> — <non-blocking concern>

### Summary
Runtime verification passed. <N> low-severity flags.
```

### 3.6 Rules

- Never modify source files — review only (`edit: deny`)
- Bash: allow for whitelisted verification commands (build/lint/test)
- Never make architecture decisions
- Never create ADRs
- Be specific: cite exact code locations
- Map each runtime failure to the Code Agent task that introduced it
- If uncertain, flag — do not assume

### 3.7 Runtime Verification Environment

POST_VERIFY executes verification commands directly on the host. No Docker sandbox is used — the direct execution mode is simpler and has been empirically proven to work without security issues (ADR-018 §5).

Timeout contract (enforced by POST_VERIFY):
| Command | Timeout | Action on Exceed |
|---------|---------|------------------|
| `npm run build` | 120 seconds | Treat as FAIL, report TIMEOUT |
| `npm run lint` | 60 seconds | Treat as FAIL, report TIMEOUT |
| `npx jest --passWithNoTests` | 300 seconds | Treat as FAIL, report TIMEOUT |

### 3.8 Gate Decisions

| Decision | Action | Condition |
|----------|--------|-----------|
| PASS | Route to COMMIT | Runtime checks pass + static analysis clean |
| FLAG | Route to COMMIT (with documented concerns) | Runtime checks pass + non-blocking static flags |
| FAIL | Route to CODE (retry, max 1) | Runtime check fails OR blocking static issue |
| BLOCK | Route to ARCH | Security issue, architecture violation, or repeated FAIL > retry limit |

The Runtime Guard enforces these transitions.

### 3.9 Escalation

- Security issues → escalate immediately
- Spec ambiguity → escalate to Planner with specific questions

---

**End of Agent Rules**
