/* @lifecycle ACTIVE — ADR-015: Runtime Verification Integration for POST_VERIFY */

# ADR-015 — Runtime Verification Integration: POST_VERIFY Build & Test Execution

**Status:** Active
**Created:** 2026-06-10
**Author:** Code Agent (ADR-015)
**Supersedes:** None
**Superseded By:** None
**References:** ADR-ASK-001 (§2.2, §2.3), ADR-013 (Drift Detection), ADR-003 (Evaluation Harness), Execution Contract (§2, §4.6, §5), Constitution §10, Docker Conventions, Post-Verify Agent Rules

---

## 1. Context

### 1.1 The Avatar Upload Incident

On 2026-06-10, a Code Agent implemented avatar upload functionality using NestJS `FileTypeValidator` with Multer `diskStorage`. The implementation passed POST_VERIFY's visual code review — the code was well-structured, followed module patterns, had proper DTOs, and included lifecycle declarations. However, two critical runtime defects were undetected:

1. **`FileTypeValidator` incompatible with `diskStorage`**: The validator accesses `file.buffer` internally, but Multer's `diskStorage` mode writes directly to disk and populates `file.path` instead of loading into `file.buffer`. This caused a `TypeError: Cannot read properties of undefined (reading 'length')` at runtime — a NestJS framework-level incompatibility invisible to visual review.

2. **Wrong regex target**: The file type validator regex matched against the filename extension (`.png`) rather than the MIME type (`image/png`), allowing files with correct extensions but incorrect content through validation.

**Root cause:** POST_VERIFY operates with `bash: deny`. It cannot run `npm run build`, `npm run lint`, or `npx jest`. Its entire verification capability is limited to static analysis — reading source files and comparing them against patterns, conventions, and acceptance criteria. Runtime errors, TypeScript compilation failures, and test failures are invisible to it.

### 1.2 Why Visual Review Is Structurally Insufficient

Visual code review can detect:
- Style violations, naming inconsistencies
- Missing lifecycle declarations
- Pattern deviations (wrong module structure)
- Obvious security issues (missing guards, unsanitized input)
- Missing DTO validation decorators

Visual code review CANNOT detect:
- TypeScript compilation errors (wrong types, missing imports)
- Runtime framework incompatibilities (NestJS/Multer/class-validator interactions)
- Test failures (logic errors, boundary conditions)
- Lint violations that would fail CI
- Module resolution issues (`dist/` not matching source)

**The POST_VERIFY gate is the last automated quality check before COMMIT.** When it passes code that fails at runtime, the entire gate's purpose is undermined. ADR-013 (Drift Detection) can detect these issues eventually via cron (6-hour intervals), but drift detection is reactive — it catches drift *after* it has been committed. The gate itself must prevent drift from being committed in the first place.

### 1.3 Current Permission State

The current POST_VERIFY agent in `.kilo/kilo.jsonc` has:

```json
"permission": {
  "edit": "deny",
  "bash": "deny"
}
```

Per ADR-ASK-001 §2.2, POST_VERIFY's responsibility boundary is: *"QA gate (after) — Verify spec compliance, regression, edge cases, security, and lifecycle declarations. Never modifies code."* The `bash: deny` prevents it from executing any verification commands, limiting it to read-only static analysis.

---

## 2. Decision

### §1. Permission Change: `bash: allow` with Destructive Restriction

POST_VERIFY's `bash` permission SHALL be changed from `deny` to `allow`, **restricted to a whitelist of non-destructive commands only**. The `edit` permission SHALL remain `deny` — POST_VERIFY can never fix the code it reviews.

**Configuration change in `.kilo/kilo.jsonc`:**

```jsonc
"post_verify": {
  "permission": {
    "bash": "allow",
    "edit": "deny"   // unchanged — never fix, only verify
  }
}
```

**Whitelist — Allowed Commands (exhaustive):**

| Command | Purpose | Destructive? | Rationale |
|---------|---------|-------------|-----------|
| `npm run build` | TypeScript compilation check | No (writes to `dist/`) | Catches type errors, missing imports, module resolution failures |
| `npm run lint` | ESLint rule compliance | No (read-only + report) | Catches style violations, forbidden patterns (`any`, `console.log`) |
| `npx jest --passWithNoTests` | Unit test execution | No (creates coverage reports in `coverage/`) | Catches logic errors, broken tests, regression failures |
| `npx prisma generate` | Prisma client regeneration | No (regenerates client in `node_modules/`) | Required for build if schema changed; not a data modification |

**Explicitly Denied Commands (non-exhaustive):**

| Command Pattern | Reason for Denial |
|----------------|-------------------|
| `npx prisma migrate dev` / `deploy` | Modifies database schema — destructive |
| `npm install` / `npm ci` | Modifies `node_modules/` and `package-lock.json` — outside review scope |
| `rm`, `mv`, `cp`, `chmod`, `chown` | Filesystem mutation — violates edit: deny intent |
| `git push`, `git merge`, `git commit` | Repository mutation — violates Principle 3 (ADR-ASK-001 §2.3) |
| `docker`, `docker compose` | Container/infrastructure mutation — outside verification scope |
| `npx prisma db push` / `seed` | Database mutation — destructive |
| `curl`, `wget`, `nc` | Network egress — potential exfiltration vector |
| Any command with `&&`, `|`, `;` | Command chaining bypasses whitelist — each command must be standalone |

**Enforcement mechanism:** The Runtime Guard (`@kilocode/guard`) SHALL validate each bash invocation against the whitelist. Non-matching commands are rejected with a guard violation. Command chaining via shell operators (`&&`, `;`, `|`) is forbidden — only single, atomic commands are permitted.

### §2. Sandbox Isolation: Containerized Verification Contract

To prevent malicious or buggy code generated by the Code Agent from compromising the host system during POST_VERIFY's build/test execution, all verification commands SHALL execute within an isolated Docker container.

#### 2.1 Isolation Measures

POST_VERIFY SHALL use the existing `engflow` Docker Compose service container (defined in `backend/docker-compose.yml`, per Docker Conventions). This container already has Node.js 20, the full `node_modules/`, and Prisma — no new infrastructure is required.

However, to prevent artifact pollution between verification runs and between the Code Agent's development environment and POST_VERIFY's verification environment, the following isolation measures apply:

| Measure | Implementation | Enforcement |
|---------|---------------|-------------|
| Clean build | `rm -rf dist/` before each `npm run build` | Prevents stale artifacts from passing verification |
| Isolated test DB | `DATABASE_URL` points to `floweng_test` (not `floweng`) | Prevents test runs from corrupting development data |
| Read-only source | Source files mounted read-only within container | Prevents any process from modifying source during verification |
| No network egress | Container runs with `--network=none` during commands | Prevents data exfiltration by malicious code |
| Ephemeral artifacts | `dist/` and `coverage/` written to tmpfs | Destroyed after verification run |

#### 2.2 Timeout Contract

| Command | Timeout | Action on Exceed |
|---------|---------|------------------|
| `npm run build` | 120 seconds | SIGTERM → SIGKILL after 5s → report FAIL with timeout reason |
| `npm run lint` | 60 seconds | SIGTERM → SIGKILL after 5s → report FAIL with timeout reason |
| `npx jest --passWithNoTests` | 300 seconds | SIGTERM → SIGKILL after 5s → report FAIL with timeout reason |
| Combined total | 480 seconds (8 min) | Sum of all three + buffer |

Timeouts are NOT retried. A timeout is a blocking FAIL that routes to CODE for investigation.

#### 2.3 Host Fallback

If Docker is unavailable, POST_VERIFY SHALL emit a `SANDBOX: HOST_FALLBACK` warning and execute commands directly on the host with reduced sandbox guarantees. Host fallback is accepted for local development only — CI/CD requires Docker mode.

### §3. Structured Failure Output Format

When `npm run build`, `npm run lint`, or `npx jest` fails, POST_VERIFY SHALL produce a structured failure report that explicitly maps each failure to the Code Agent task that introduced it. This replaces the current free-form "Issues" section with a machine-parseable format.

#### 3.1 FAIL Verdict (Runtime Verification Failure)

```markdown
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
| 1 | `<compiler/test error message>` | `<file-path>` | `<line>` | TASK: "<task description>" — <root cause> | HIGH |

### Failed Tasks (for CODE retry)
1. **TASK:** <task description> — <fix guidance>
2. **TASK:** <task description> — <fix guidance>

### Summary
<summary of failures, tasks affected, and recommended fix scope>
```

**Mapping rules:**
- Each compiler error or test failure MUST be traced to the Code Agent task that introduced the failing code
- If no task mapping is possible, mark the error as `TASK: UNKNOWN` and escalate to Planner
- Failed tasks are listed individually so the Code Agent retries only the failed tasks, not the entire implementation

#### 3.2 PASS Verdict (All Runtime Checks Pass)

```markdown
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

#### 3.3 FLAG Verdict (Runtime Pass + Static Concerns)

```markdown
## POST-VERIFY REPORT

### Decision: FLAG

### Runtime Verification Results
| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS | 0 | 11.8s |
| `npm run lint` | PASS | 0 | 3.9s |
| `npx jest --passWithNoTests` | PASS | 0 | 42.1s |

### Flags
- [severity: low] `<file>:<line>` — <non-blocking concern>

### Summary
Runtime verification passed. <N> low-severity flags for documentation, coverage, or style.
```

### §4. Verification Execution Order

POST_VERIFY SHALL execute verification in the following deterministic order:

```
Step 1: npm run build       → FAIL here blocks all subsequent checks
Step 2: npm run lint        → Runs only if build passes
Step 3: npx jest --passWithNoTests → Runs only if lint passes
```

**Rationale:** TypeScript compilation errors make lint and test results meaningless (test runner can't even start if the build fails). Lint violations may indicate patterns that tests depend on. This order provides the fastest feedback — build failures are caught first and reported immediately.

POST_VERIFY SHALL NOT attempt all three commands in parallel. The verification is sequential by design to provide a clear failure line.

### §5. Integration with Existing ADRs

#### 5.1 ADR-ASK-001 (Agent Routing Governance)

POST_VERIFY remains agent #8 in the catalog (§2.2). Its responsibility boundary expands from "static analysis only" to "static analysis + runtime verification." Its permission boundary changes from `bash: deny` to `bash: allow` (whitelisted commands only). `edit: deny` is preserved — the conflict of interest principle (ADR-ASK-001 §2.2, Responsibility Boundaries invariant: "Only Code and Debug may modify source files") is maintained.

The Gate Decisions table (§4.6) is extended with explicit conditions:

| Decision | Action | Condition |
|----------|--------|-----------|
| PASS | Route to COMMIT | All runtime checks pass + static analysis clean |
| FLAG | Route to COMMIT (with documented concerns) | All runtime checks pass + non-blocking static flags |
| FAIL | Route to CODE (retry, max 1) | Any runtime command fails OR blocking static issue |
| BLOCK | Route to ARCH | Security issue, architecture violation, or repeated FAIL > retry limit |

#### 5.2 ADR-013 (Drift Detection)

ADR-013 provides cron-based (6-hour) drift detection that catches issues across longer time windows. This ADR provides **real-time gate-level verification** — catching drift *before* it reaches COMMIT. The two are complementary:

| Dimension | ADR-015 (Runtime Verification) | ADR-013 (Drift Detection) |
|-----------|-------------------------------|--------------------------|
| Trigger | Every POST_VERIFY execution | Cron (6-hour interval) |
| Scope | Current CODE output only | Entire codebase |
| Detection | Build errors, test failures, lint violations | Implementation drift, policy drift, API contract drift, KG staleness |
| Timing | Pre-COMMIT gate | Post-COMMIT monitoring |
| Action | Blocks COMMIT → CODE retry | Alerts → ARCH review → auto-resolve or ADR |

#### 5.3 ADR-003 (Evaluation Harness)

The Evaluation Harness already tracks `postVerifySuccess` as a metric. With this ADR, the metric gains a new dimension: `postVerifyRuntimeSuccess` — a boolean indicating whether runtime verification (build + lint + test) passed. This allows tracking how often POST_VERIFY catches issues that visual review alone would have missed.

New evaluation metric: `postVerifyFailToCatchRatio` = (FAIL outcomes at POST_VERIFY) / (total POST_VERIFY executions). This metric measures the effectiveness of the Code Agent — a rising ratio indicates the Code Agent is producing more runtime-broken code that POST_VERIFY must catch.

#### 5.4 Execution Contract (§2, §4.6, §5)

The Execution Contract's transition table (§2.2) already supports the POST_VERIFY → CODE (FAIL, retry max 1) transition. No structural change to the state machine is required. The retry semantics (§5) remain unchanged: CODE gets max 1 retry after POST_VERIFY FAIL.

The new POST_VERIFY → CODE transition now carries structured failure output (§3) that allows the Code Agent to fix only the failed tasks, not re-implement the entire batch.

---

## 3. Consequences

### Positive

1. **Runtime bugs caught at the gate.** The Avatar Upload incident class of defects (build failures, test failures, framework incompatibilities) will be caught by POST_VERIFY before COMMIT, not by production crashes.

2. **Structured failure → targeted retry.** The Failure-to-Task Mapping (§3.1) enables the Code Agent to retry only failed tasks, reducing re-implementation scope and minimizing the blast radius of retries.

3. **No conflict-of-interest.** `edit: deny` is preserved. POST_VERIFY verifies, it never fixes. The separation between verification and implementation is absolute.

4. **Minimal infrastructure change.** POST_VERIFY uses the existing Docker Compose container — no new services, no new images, no new dependencies. Only permission and sandbox configuration change.

5. **Complementary to existing ADRs.** ADR-013 catches drift post-commit; this ADR catches it pre-commit. ADR-003 gains a new metric dimension. ADR-ASK-001's agent catalog is preserved without contradiction.

6. **No new technology.** Docker is already part of the stack (Docker Conventions). Timeout enforcement uses standard Unix `timeout` or Docker's `--stop-timeout`. No new packages or frameworks.

### Negative

1. **POST_VERIFY execution time increases.** Each verification run adds up to 8 minutes (build + lint + test). This increases the gate-to-commit latency. Mitigation: Tests can be parallelized within `npx jest` (already supported); lint and build are fast (<30s each for current codebase size).

2. **Sandbox complexity.** The Docker-based sandbox isolation adds operational complexity. If Docker Compose is not running, POST_VERIFY falls back to host execution with reduced guarantees. The `SANDBOX: HOST_FALLBACK` warning ensures this is visible.

3. **Whitelist maintenance.** The allowed commands whitelist must be maintained as the project evolves (e.g., if a new build tool is introduced). An ADR amendment is required to add commands to the whitelist. This is intentional — command whitelist changes are security-sensitive and deserve architectural review.

4. **False PASS risk.** If the Code Agent writes tests that pass but are wrong (e.g., tests that test the wrong thing, mock incorrectly configured), POST_VERIFY will PASS code that has hidden bugs. Runtime verification catches compile-time and test-execution failures, not logic errors in the test assertions themselves. Mitigation: This is a fundamental limitation of automated verification; ADR-013 (Drift Detection) and human review remain the backstops.

5. **Permission boundary tension.** `bash: allow` for POST_VERIFY introduces a permission that no other gate agent has (PRE_VERIFY remains `bash: deny`). This creates an asymmetry in the gate layer — one gate can execute commands, the other cannot. Mitigation: PRE_VERIFY operates on plans (no code to compile/test); POST_VERIFY operates on implementations (code exists). The asymmetry is inherent to the different verification domains.

### Neutral

1. **No schema changes.** This ADR modifies configuration and behavior, not database models. No Prisma migration is required.

2. **No new backend modules.** The verification is performed by POST_VERIFY through bash commands, not through a new NestJS module. The evaluation module (ADR-003) already has the metric infrastructure to track the new `postVerifyRuntimeSuccess` dimension.

3. **No change to gate flow.** The execution DAG (REQUEST → ROUTER → PLAN → ARCH → PRE_VERIFY → CODE → POST_VERIFY → COMMIT) is unchanged. POST_VERIFY's position and transitions in the DAG are preserved.

---

## 4. Alternatives Considered

### A. Keep POST_VERIFY as visual-only; rely on ADR-013 for runtime catching

**Rejected.** ADR-013 catches issues post-commit (6-hour cron interval). The entire purpose of the POST_VERIFY gate is to prevent broken code from reaching COMMIT. Deferring runtime verification to post-commit drift detection means broken code is committed and deployed before detection — the exact scenario this ADR prevents.

### B. Add a new "Runtime Verify" agent between CODE and POST_VERIFY

**Rejected.** Splits verification into two agents: visual (POST_VERIFY) and runtime (new agent). This adds an unnecessary hop in the execution DAG, increases agent catalog from 8 to 9, and creates coordination overhead (POST_VERIFY must wait for Runtime Verify's output). Monolith-first principle (Constitution §7) favors consolidating verification in a single agent with expanded capability.

### C. Give POST_VERIFY full `bash: allow` (no whitelist)

**Rejected.** Unrestricted bash access to POST_VERIFY introduces risk: a compromised or buggy POST_VERIFY prompt could execute destructive commands. The whitelist is a necessary security control. Additionally, unrestricted bash blurs the line between verification and implementation — POST_VERIFY could accidentally modify files through shell commands even with `edit: deny`.

### D. Execute verification in CI/CD only, not in the agent gate

**Rejected.** This pushes the first runtime verification from the gate (seconds after code is written) to CI (minutes/hours later). The feedback loop is too long. The purpose of agentic gates is fast, in-context verification — catching issues while the Code Agent's context is still fresh.

### E. Allow POST_VERIFY to auto-fix trivial build errors (relax `edit: deny`)

**Rejected.** Violates the "verification-separate-from-implementation" principle. If POST_VERIFY can fix code, it becomes a secondary Code Agent with lower accountability (no POST_VERIFY of its own output). The conflict of interest is unacceptable. The Code Agent must fix its own errors; POST_VERIFY's role is to identify them.

---

## 5. Compliance

| Check | Criteria |
|-------|----------|
| Constitution §10 (Change Management) | Execution flow unchanged; POST_VERIFY remains a gate in the DAG |
| ADR-ASK-001 §2.2 (Agent Catalog) | POST_VERIFY remains agent #8; responsibility expands but core identity preserved |
| ADR-ASK-001 §2.3 (Pillar Principles) | Principle 1 (Never Implements): `edit: deny` maintained. Principle 2 (Never Bypasses Gates): Runtime verification ADDED to gate, not bypassed. Principle 3 (Never Merges): No git operations in whitelist. Principle 4 (Single Next Agent): POST_VERIFY still routes to exactly one target |
| ADR-013 (Drift Detection) | Complementary — pre-commit gate vs. post-commit monitoring |
| ADR-003 (Evaluation Harness) | New `postVerifyRuntimeSuccess` metric dimension added |
| Execution Contract §4.6 | Gate Decisions table extended with explicit conditions; transitions unchanged |
| Docker Conventions | Reuses existing container; no new infrastructure |

---

## 6. Implementation Notes

This ADR requires the following implementation tasks (for the follow-up Plan phase):

1. **Update `.kilo/kilo.jsonc`** — POST_VERIFY: `bash: allow` (replaces `bash: deny`), `edit: deny` (unchanged). Update prompt to include execution order, whitelist, sandbox, and structured output format.
2. **Update `.kilo/rules/agents/post_verify.rules.md`** — Add Runtime Verification section (§3.8), Sandbox/Timeout Isolation Contract (§6), structured output formats, and updated Gate Decisions with conditions.
3. **Configure Runtime Guard** — Implement command whitelist enforcement for POST_VERIFY bash invocations to reject non-whitelisted commands and command chaining.
4. **Add Docker sandbox script** — `backend/scripts/verify-in-sandbox.sh` that initializes the Docker container with isolation constraints and executes build/lint/test in sequence.
5. **Update evaluation metrics** — Add `postVerifyRuntimeSuccess` dimension to the evaluation harness (ADR-003).

---

## 7. References

- ADR-ASK-001 — Agent Routing Governance Specification (`docs/decisions/ADR-ASK-001-agent-routing-governance.md`)
- ADR-013 — Drift Detection Mechanism (`docs/decisions/013-drift-detection.md`)
- ADR-003 — Agent Evaluation Harness (`docs/decisions/003-agent-evaluation-harness-v1.md`)
- ADR-008 — Lifecycle Declarations (`docs/decisions/008-lifecycle-declarations.md`)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Constitution §10 — Change Management (`docs/constitution.md`)
- Docker Conventions (`.kilo/rules/execution/docker-conventions.rules.md`)
- Build Process (`.kilo/rules/execution/build-process.rules.md`)
- Post-Verify Agent Rules (`.kilo/rules/agents/post_verify.rules.md`)
- `.kilo/kilo.jsonc` — Agent configuration

---

**End of ADR-015**
