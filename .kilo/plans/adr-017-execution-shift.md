# ADR-017 — Shift Runtime Verification Execution to CODE Agent

**Priority:** LEVEL_2 (feature-level prompt/rule change, no schema, no infrastructure)
**Status:** Plan (ready for PreVerify)
**References:** ADR-015, ADR-ASK-001 §2.2, Execution Contract §2, Constitution §7

---

## Summary

ADR-015 established POST_VERIFY as the runtime verification executor (build/lint/test). The Kilo platform (`@kilocode/plugin` v7.3.40) blocks POST_VERIFY bash execution despite `"bash": "allow"` in `kilo.jsonc` — the platform applies different permission resolution for sub-task dispatch (POST_VERIFY) vs. top-level sessions (CODE). The guard plugin at `.kilo/guard/` has zero permission logic and is not responsible for this blockage.

The solution: **CODE executes runtime verification** (build/lint/test) as its final implementation step, captures full raw output, and passes a structured Runtime Verification Report to POST_VERIFY. POST_VERIFY performs independent **review** of CODE's report plus its existing static analysis to make the gate decision. This preserves runtime verification at the gate while working within platform constraints.

**No changes to:** `kilo.jsonc` permissions, execution DAG, guard plugin, or backend code.

---

## Invariants (Must Not Be Violated)

| # | Invariant | Rationale |
|---|-----------|-----------|
| I1 | POST_VERIFY `"bash": "allow"` stays unchanged in `kilo.jsonc` | Future platform compatibility — if platform fixes sub-task permissions, POST_VERIFY can use bash again without config revert |
| I2 | CODE `"bash": "allow"` stays unchanged | CODE must be able to run build/lint/test |
| I3 | No DAG changes — `code → post_verify → COMMIT` path preserved | Execution Contract state machine remains valid |
| I4 | POST_VERIFY `"edit": "deny"` stays unchanged | POST_VERIFY must never modify code |

---

## Tasks

### Task 1 — ADR-017 Document (Governance Foundation)

**File:** `docs/decisions/0017-execution-shift-to-code.md`

**Action:** Create the canonical ADR-017 document following existing ADR format.

**Document outline:**

```markdown
/* @lifecycle ACTIVE — ADR-017: Runtime Verification Relocation to CODE Agent */

# ADR-017 — Runtime Verification Relocation to CODE Agent

**Status:** Active
**Created:** 2026-06-10
**Author:** Architecture Agent
**Supersedes:** ADR-015 §1-2 (partially)
**Superseded By:** None
**References:** ADR-015, ADR-ASK-001 (§2.2), Constitution §7

## 1. Context
- ADR-015 granted POST_VERIFY bash:allow for whitelisted commands (build/lint/test)
- Platform constraint: @kilocode/plugin v7.3.40 blocks sub-task bash execution
- CODE agent bash (top-level session) works reliably
- Guard plugin is a state machine validator — no permission role

## 2. Decision

### §1 — Runtime verification execution moves from POST_VERIFY to CODE
CODE executes npm run build → npm run lint → npx jest --passWithNoTests as its final implementation step. CODE captures full raw stdout+stderr (no AI summarization) and formats a Runtime Verification Report.

### §2 — POST_VERIFY transitions to review-only
POST_VERIFY receives CODE's Runtime Verification Report, performs Raw Output Audit (scan for failure patterns, cross-check exit codes), and integrates findings into gate decision.

### §3 — POST_VERIFY permission preserved
POST_VERIFY's "bash: allow" in kilo.jsonc stays unchanged for future platform compatibility. POST_VERIFY does not use it.

### §4 — Execution order preserved
CODE executes build → lint → test in ADR-015's defined order.

### §5 — ADR-015 partial supersession
- §1 (bash: allow): Config stays, POST_VERIFY doesn't use it
- §2 (Sandbox isolation): Moot — CODE runs directly, not in Docker sandbox
- §3 (Structured output): Preserved, adapted for CODE → POST_VERIFY handoff
- §4 (Execution order): Preserved, now executed by CODE

## 3. Consequences
(Positive: Runtime verification works; no new infrastructure. Negative: Self-reported. Neutral: No schema/backend changes.)
```

**Lifecycle:** `/* @lifecycle ACTIVE — ADR-017: Runtime Verification Relocation to CODE Agent */`

---

### Task 2 — Update `code.rules.md` — Add Mandatory Runtime Verification

**File:** `.kilo/rules/agents/code.rules.md`

**Changes:**

**2a — Add new §10 "Runtime Verification" after §9 (Definition of Done):**

```markdown
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
```

**2b — Update §9 (Definition of Done):**

Insert new item between existing items 5 and 6:
```
5. Runtime Verification passed — build, lint, and test all PASS (added)
6. Work queue updated (renumbered from 5)
```

---

### Task 3 — Update `post_verify.rules.md` — Replace Runtime Execution with Review Protocol

**File:** `.kilo/rules/agents/post_verify.rules.md`

**Changes:**

**3a — Update §1 (Role):**

Replace line 10:
```markdown
Performs runtime verification via whitelisted build/lint/test commands (ADR-015).
```
With:
```markdown
Reviews CODE's Runtime Verification Report (ADR-017). Never executes build/lint/test directly — CODE executes them and passes the report to POST_VERIFY for independent review.
```

**3b — Update §2 (Input):**

Replace line 14:
```markdown
Code implementation output, original plan, acceptance criteria
```
With:
```markdown
Code implementation output, CODE's Runtime Verification Report (build/lint/test results), original plan, acceptance criteria
```

**3c — Replace §3.8 (Runtime Verification) entirely:**

Replace lines 53-67 with:

```markdown
### 3.8 Runtime Verification — Raw Output Audit (ADR-017)

CODE executes `npm run build`, `npm run lint`, and `npx jest --passWithNoTests` in
strict sequential order as its final implementation step. CODE captures FULL raw
stdout+stderr and formats a **Runtime Verification Report**.

POST_VERIFY SHALL perform a Raw Output Audit on CODE's report:

**Check 1 — Exit Code Audit:**
- Any non-zero exit code → FAIL verdict
- "TIMEOUT" in Status column → FAIL verdict
- Missing report or missing command entries → FLAG (severity: MEDIUM)

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
- Cross-check static analysis findings against CODE's reported results
- E.g., if CODE reports "build PASS" but static analysis reveals missing imports
  visible in source code → FLAG (severity: HIGH)
- If CODE reports "test PASS" but static analysis reveals missing test files or
  skipped test blocks → FLAG (severity: MEDIUM)

**Gate Integration:**
| Runtime Audit Result | Gate Effect |
|----------------------|-------------|
| All checks pass (exit 0, no error patterns, no cross-reference conflicts) | Runtime verification supports PASS/FLAG decision |
| Any check fails | Runtime verification supports FAIL decision |
| Report missing or incomplete | FLAG (MEDIUM); continue static analysis |
```

**3d — Update §4 (Output Format):**

Replace the "Runtime Verification Results" table in §4.1, §4.2, and §4.3 to add a note:

```markdown
### Runtime Verification Results
| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS/FAIL | <code> | <seconds>s |
| `npm run lint` | PASS/FAIL | <code> | <seconds>s |
| `npx jest --passWithNoTests` | PASS/FAIL | <code> | <seconds>s |

*Results are transcribed from CODE's Runtime Verification Report after POST_VERIFY's
Raw Output Audit. POST_VERIFY does not execute these commands directly.*
```

**3e — Update §5 (Rules):**

Replace line 142:
```markdown
- Bash only for whitelisted verification commands (`bash: allow` per ADR-015)
```
With:
```markdown
- Runtime verification results from CODE's report, not from own execution (`bash: allow` preserved for future platform compatibility per ADR-017)
```

**3f — Replace §6 (Sandbox / Timeout Isolation Contract) entirely:**

Replace §6 (lines 149-176) with:

```markdown
## 6. Runtime Verification Sandbox Note

The sandbox isolation and timeout contract defined in ADR-015 §2 (containerized
verification, clean dist/, isolated test DB, read-only source, tmpfs artifacts,
no network egress) is no longer enforced by POST_VERIFY, because POST_VERIFY
no longer executes verification commands.

CODE runs build/lint/test directly in its environment. CODE is expected to
follow good verification hygiene:
- Run from a clean state (dist/ removed before build)
- Use the test database configuration (DATABASE_URL pointing to floweng_test)
- Capture full raw output for POST_VERIFY review

Timeout contract (retained for reference, enforced by CODE, not POST_VERIFY):
| Command | Timeout | Action on Exceed |
|---------|---------|------------------|
| `npm run build` | 120 seconds | Treat as FAIL, report TIMEOUT |
| `npm run lint` | 60 seconds | Treat as FAIL, report TIMEOUT |
| `npx jest --passWithNoTests` | 300 seconds | Treat as FAIL, report TIMEOUT |
```

**3g — Update §7 (Gate Decisions) conditions:**

Replace lines 182-185:

```markdown
| Decision | Action | Condition |
|----------|--------|-----------|
| PASS | Route to COMMIT | Raw Output Audit passes + static analysis clean |
| FLAG | Route to COMMIT (with documented concerns) | Raw Output Audit passes + non-blocking static flags |
| FAIL | Route to CODE (retry, max 1) | Raw Output Audit fails (non-zero exit, error patterns) OR blocking static issue |
| BLOCK | Route to ARCH | Security issue, architecture violation, or repeated FAIL > retry limit |
```

**3h — Keep §8 (Escalation):** No changes needed. It references security escalation and Planner, which are unaffected.

---

### Task 4 — Update CODE Agent Prompt in `kilo.jsonc`

**File:** `.kilo/kilo.jsonc` — CODE block (lines 138–155)

**Change:** Insert "Runtime Verification Delegation" section between the `ESCALATION:` block and the `— Context Manager (ADR-012) —` line.

**Before (current end of CODE prompt, line 148, at `ESCALATION:` and below):**

```
ESCALATION:
- Database schema changes → Architect
- Architecture decisions → Architect
- Framework changes → Architect
- Security issues → Architect
- Task ambiguity → Planner


— Context Manager (ADR-012) —
```

**After (add Runtime Verification section before Context Manager):**

```
ESCALATION:
- Database schema changes → Architect
- Architecture decisions → Architect
- Framework changes → Architect
- Security issues → Architect
- Task ambiguity → Planner

RUNTIME VERIFICATION (ADR-017):
Before transitioning to POST_VERIFY, you MUST execute runtime verification
commands in strict sequential order. This is a mandatory final step.

Build → Lint → Test sequence (never parallel):
1. npm run build
2. npm run lint (only if build passes)
3. npx jest --passWithNoTests (only if lint passes)

Capture FULL raw stdout+stderr for each command — do NOT summarize,
truncate, or filter the output. Record exit codes and approximate duration.

Format results as a Runtime Verification Report and include it in your output:

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

Failure handling: If any command fails, fix the issue and re-run the full
sequence from step 1. Only when all 3 commands pass, transition to POST_VERIFY.
If a command times out (build > 120s, lint > 60s, test > 300s), treat as FAIL
and report TIMEOUT.

— Context Manager (ADR-012) —
```

**Invariant check:** CODE per-agent permission block (lines 149-154) does NOT have an explicit `bash` entry — it inherits the global `"bash": "allow"`. No change needed. This preserves Invariant I2.

---

### Task 5 — Update POST_VERIFY Agent Prompt in `kilo.jsonc`

**File:** `.kilo/kilo.jsonc` — POST_VERIFY block (lines 214–230)

**Changes:**

**5a — Update comment block header (lines 207-213):**

Replace:
```
    // POST_VERIFY (ADR-ASK-001 §2.2, ADR-015)
    // QA gate AFTER CODE execution.
    // Static analysis + runtime verification (build/lint/test).
    // Never modifies code. Uses bash: allow for whitelisted
    // verification commands only (ADR-015 §1).
```
With:
```
    // POST_VERIFY (ADR-ASK-001 §2.2, ADR-015, ADR-017)
    // QA gate AFTER CODE execution.
    // Static analysis + review of CODE's Runtime Verification Report.
    // Never modifies code. bash: allow preserved for future platform
    // compatibility — POST_VERIFY does not currently execute bash.
```

**5b — Replace POST_VERIFY prompt (line 223):**

**Before (current prompt):** Contains RUNTIME VERIFICATION section with bash whitelist, sandbox, timeout, and execution instructions.

**After (replacement prompt):**

```
ROLE: Post-Verify — QA gate after CODE execution (ADR-ASK-001 §2.2, ADR-015, ADR-017). Static analysis + review of CODE's Runtime Verification Report (build/lint/test). Never modifies code.

INPUT: Code implementation output + CODE's Runtime Verification Report + original plan + acceptance criteria.

STATIC QA: Spec compliance | Regression | Edge cases | Security | Consistency | Quality | Lifecycle ADR-008.

RUNTIME VERIFICATION — RAW OUTPUT AUDIT (ADR-017):
CODE has already executed build → lint → test and provided a Runtime Verification Report. You do NOT execute these commands — you review CODE's reported results.

Audit steps:
1. Exit Code Audit: Any non-zero exit code → FAIL verdict. "TIMEOUT" → FAIL.
2. Pattern Scan: Scan raw output for Error:, Exception, FAIL, TypeError, TS\d+:, Module not found.
3. Cross-Reference: Check CODE's reported status against your own static analysis findings.

OUTPUT:
### Decision: PASS | FLAG | FAIL
### Runtime Verification Results (from CODE's report, after Raw Output Audit)
| Command | Status | Exit Code | Duration |
|---------|--------|-----------|----------|
| `npm run build` | PASS/FAIL | <code> | <seconds>s |
| `npm run lint` | PASS/FAIL | <code> | <seconds>s |
| `npx jest --passWithNoTests` | PASS/FAIL | <code> | <seconds>s |
### Failure-to-Task Mapping (FAIL only): #, Error, File, Task Context, Severity
### Failed Tasks for CODE retry: numbered list of TASK: <description>
### Summary

GATE DECISIONS:
| PASS → COMMIT | FLAG → COMMIT (flags) | FAIL → CODE (retry 1) | BLOCK → ARCH |

RULES:
- edit: deny — never fix.
- Map each failure to the Code Agent task.
- Never create ADRs or architecture decisions.
- If CODE's report is missing or incomplete, FLAG (MEDIUM).
- If uncertain, flag.

ESCALATION:
- Security → immediate. Spec ambiguity → Planner.

— Context Mgr (ADR-012) —
POST /api/v1/memory/context/assemble { "agentType": "POST_VERIFY", "taskType": "<TASK_LEVEL>" } before verifying.
```

**Invariant checks:**
- **I1 (bash: allow stays):** Line 227 (`"bash": "allow"`) is untouched. ✅
- **I4 (edit: deny stays):** Line 227 (`"edit": "deny"`) is untouched. ✅

---

### Task 6 — Update `docs/decisions.md` ADR Index

**File:** `docs/decisions.md`

**Changes:** Add ADR-015, ADR-016, and ADR-017 to the ADR Index table.

Insert the following rows in numerical order (after ADR-014, before ADR-ASK-001):

```markdown
| ADR-015 | Runtime Verification Integration | Active | POST_VERIFY executes whitelisted build/lint/test commands. *(§1-2 partially superseded by ADR-017)* |
| ADR-016 | Debug Agent Activation | Active | Activates DEFERRED DEBUG agent with diagnosis-first workflow and 3 evaluation metrics. |
| ADR-017 | Execution Shift to CODE Agent | Active | Runtime verification moves from POST_VERIFY to CODE due to platform permission constraint. CODE executes build/lint/test, POST_VERIFY reviews report. |
```

Also update the "Last Updated" date and note at the bottom to include ADR-XXX series if needed.

---

## Dependencies

```
Task 1 (ADR-017 doc)       ──► independent
Task 2 (code.rules.md)     ──► independent of Task 3
Task 3 (post_verify.md)    ──► independent of Task 2
Task 4 (CODE prompt)       ──► references Task 2 (code.rules.md §10) but no build-time dep
Task 5 (POST_VERIFY prompt)──► references Task 3 (post_verify.rules.md §3.8) but no build-time dep
Task 6 (ADR index)         ──► depends on Task 1 (ADR file must exist first)
```

**Recommended execution order:**

```
    Task 1 ── ADR-017 document
    Task 2 ── code.rules.md
    Task 3 ── post_verify.rules.md
    Task 4 ── CODE prompt (kilo.jsonc)
    Task 5 ── POST_VERIFY prompt (kilo.jsonc)
    Task 6 ── ADR index (decisions.md)
```

All tasks except Task 6 can proceed in any order. Task 6 must be last (ADR file must exist).

**Parallelizable groups:** {1, 2, 3} can proceed in parallel. {4, 5} can proceed in parallel. {6} sequential after 1.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Self-reporting conflict of interest.** CODE could report false positives to bypass the gate. | HIGH | LOW | POST_VERIFY independently scans raw output (Pattern Scan) and cross-references against static analysis. Discrepancies trigger FAIL or FLAG. |
| **Missing Runtime Verification Report.** CODE forgets to include the report. | MEDIUM | LOW | POST_VERIFY prompt explicitly checks for report presence and emits FLAG(MEDIUM) if missing. |
| **CODE prompt step budget exceeded.** Adding verification may consume 3-5 extra steps in CODE's 20-step limit. | LOW | LOW | Verification is 3 atomic bash calls. CODE already runs 20 steps for complex features. If budget is tight, the Code Agent can reduce steps elsewhere. |
| **Platform blocks CODE bash in future.** If Kilo platform changes top-level session permissions too. | LOW | MEDIUM | CODE bash has been stable. If blocked, a new architecture decision is needed regardless. |
| **POST_VERIFY incorrectly reports CODE's results.** Transcription errors from CODE's report to POST_VERIFY's output. | LOW | LOW | Raw output audit uses direct pattern matching on CODE's raw output. POST_VERIFY copies exit codes verbatim. |
| **ADR-015 conflict.** ADR-015 states POST_VERIFY executes commands; ADR-017 states CODE does. | MEDIUM | LOW | ADR-017 explicitly documents ADR-015 §1-2 as partially superseded. Index update notes this. |
| **kilo.jsonc line numbers shift.** Prior edits to kilo.jsonc change the exact line numbers referenced in this plan. | LOW | MEDIUM | Each edit operation should locate the target section by grep pattern match on the comment marker or prompt text, not by hardcoded line number. |

---

## Escalations

- **No `kilo.jsonc` permission changes.** Invariants I1, I2, I4 explicitly prevent any permission changes. If implementation attempts to modify permissions, escalate immediately.
- **No DAG changes.** Invariant I3 prevents any changes to the Execution Contract state machine. The `code → post_verify → COMMIT` path is untouched. Guard plugin, types, and execution-state.json are all unchanged.
- **No schema changes.** No Prisma migrations. No backend code changes.
- **No infrastructure changes.** No Docker, no new services, no new dependencies.
- **No new agents.** Agent catalog stays at 8. No changes to ADR-ASK-001.
- **ADR conflicts:** ADR-017 partially supersedes ADR-015 §1-2. This is documented in both the ADR-017 text and the index. No active contradiction — ADR-017 takes precedence as the newer decision.

---

## Files Changed

| File | Action | Task |
|------|--------|------|
| `docs/decisions/0017-execution-shift-to-code.md` | **CREATE** | Task 1 |
| `.kilo/rules/agents/code.rules.md` | EDIT — add §10, update §9 | Task 2 |
| `.kilo/rules/agents/post_verify.rules.md` | EDIT — replace §3.8, §5, §6, §7 | Task 3 |
| `.kilo/kilo.jsonc` | EDIT — CODE prompt (+RVT section), POST_VERIFY prompt (+raw audit) | Task 4, 5 |
| `docs/decisions.md` | EDIT — add ADR-017 (and ADR-016, ADR-015) to index | Task 6 |

Total: **1 new file, 4 edited files**. No backend code, no schema, no infrastructure, no guard changes.

---

## Acceptance Criteria

1. [ ] `docs/decisions/0017-execution-shift-to-code.md` — valid ADR format + `@lifecycle ACTIVE` declaration
2. [ ] `.kilo/rules/agents/code.rules.md` — §10 added (Runtime Verification), §9 updated (Definition of Done includes verification)
3. [ ] `.kilo/rules/agents/post_verify.rules.md` — §3.8 replaced with Raw Output Audit protocol, §5 rules updated, §6 replaced with sandbox note, §7 gate conditions updated
4. [ ] `.kilo/kilo.jsonc` — CODE prompt includes Runtime Verification Delegation, POST_VERIFY prompt includes Raw Output Audit and removes bash execution/whitelist/sandbox references
5. [ ] `.kilo/kilo.jsonc` — POST_VERIFY permission block untouched (`bash: allow` and `edit: deny` both unchanged)
6. [ ] `.kilo/kilo.jsonc` — CODE permission block untouched (no explicit `bash` block, global `allow` inherited)
7. [ ] `docs/decisions.md` — ADR-015, ADR-016, and ADR-017 added to ADR Index
8. [ ] `npm run build` — zero errors (no backend code changed; verifies file edits didn't break anything)
9. [ ] `npx jest --passWithNoTests` — all tests pass (no code logic changed; verifies no collateral damage)
10. [ ] No changes to: guard plugin (`guard/index.ts`, `guard/types.ts`), execution contract (`execution.contract.md`), ADR-ASK-001, backend source code, Docker config, or any schema files

---

*End of Plan — ready for PreVerify review.*
