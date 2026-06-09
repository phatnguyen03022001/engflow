/* @lifecycle ACTIVE — Diagnostic Plan: ADR-017 Core Assumption Verification via Canary Test */

# ADR-017 Assumption Verification — Canary Test Protocol

**Priority:** LEVEL_1 (diagnostic — verify-or-falsify single assumption)
**Status:** Plan (ready for PreVerify)
**References:** ADR-017, ADR-015, Execution Contract, `.kilo/kilo.jsonc`
**Author:** Planner Agent (under CTO Executive Order)
**Date:** 2026-06-10

---

## Summary

ADR-017 (`docs/decisions/0017-execution-shift-to-code.md`) was built on a critical unverified premise:

> *"The Kilo platform (`@kilocode/plugin` v7.3.40) blocks POST_VERIFY bash execution despite `"bash": "allow"` in `kilo.jsonc` — the platform applies different permission resolution for sub-task dispatch (POST_VERIFY) vs. top-level sessions (CODE)."*

This premise has **never been empirically verified**. A static configuration audit reveals a direct contradiction:

| Artifact | Claim | Actual Config |
|----------|-------|---------------|
| ADR-017 §1 | POST_VERIFY operates as "sub-task agent" | `.kilo/kilo.jsonc` line 240: `"mode": "primary"` |
| ADR-017 §4.B | POST_VERIFY "cannot be the primary session agent" | Config says `"mode": "primary"` — same as CODE, PLAN, ROUTER |
| Debug agent (reference) | Subagent example | `.kilo/kilo.jsonc` line 189: `"mode": "subagent"` — different from POST_VERIFY |

**The only subagent in the system is DEBUG.** POST_VERIFY is configured identically to CODE (`mode: primary`). If the platform resolves `bash: allow` for CODE (primary), it should also resolve it for POST_VERIFY (also primary).

**Objective:** Empirically verify whether POST_VERIFY can execute bash commands, then either:
- **If BASH_IS_WORKING:** ADR-017's core premise is falsified → recommend reverting to ADR-015 pattern (runtime verification in POST_VERIFY)
- **If BASH_IS_BLOCKED:** ADR-017's premise is confirmed → ADR-017 stands; investigate platform-specific restriction

---

## Tasks

### Task 0 — Static Audit (Pre-Test Verification)

**Action:** Verify current state of all relevant configuration files.

**Checklist:**
- [ ] POST_VERIFY `"bash": "allow"` confirmed in `.kilo/kilo.jsonc` line 250
- [ ] POST_VERIFY `"mode": "primary"` confirmed in `.kilo/kilo.jsonc` line 240
- [ ] POST_VERIFY `"edit": "deny"` confirmed in `.kilo/kilo.jsonc` line 250
- [ ] POST_VERIFY prompt reviewed — contains `"You do NOT execute these commands"` (line 246)
- [ ] CODE `"bash"` not explicitly denied (inherits global `allow`)
- [ ] `@kilocode/plugin` version confirmed at `7.3.40` (`.kilo/package-lock.json`)

**Expected output:** Audit log confirming configuration state.

---

### Task 1 — Canary Test: CODE → POST_VERIFY with Bash Directive

**Objective:** Drive a complete `CODE → POST_VERIFY` cycle where POST_VERIFY is explicitly instructed to execute a harmless bash command and report the result.

**Execution Flow (per Execution Contract §2.2):**

```
ROUTER ──► CODE ──► POST_VERIFY ──► COMMIT
  (LEVEL_1)   (trivial task)   (bash test)
```

#### 1A — ROUTER Dispatch

Route as LEVEL_1 diagnostic task with imperative directive for POST_VERIFY.

**Task description for CODE:**
```
TASK-TEST-POST-VERIFY-BASH — Canary Test: Verify POST_VERIFY bash capability.

Phase 1 (CODE):
1. Confirm `post_verify` has `"bash": "allow"` and `"mode": "primary"` in .kilo/kilo.jsonc
2. Do NOT make any edits to any files
3. Output the following structured message for POST_VERIFY:

===POST_VERIFY_BASH_TEST===
PERFORM THE FOLLOWING STEPS IN ORDER:
Step 1: Execute this bash command: echo "BASH_TEST_START" && ls -la .kilo/
Step 2: If the command succeeds, record: "BASH_IS_WORKING"
Step 3: If the platform blocks bash with a permission error, record: "BASH_IS_BLOCKED"
Step 4: Output a verdict section:
### BASH TEST VERDICT
BASH_IS_WORKING | BASH_IS_BLOCKED
===END_POST_VERIFY_BASH_TEST===

Phase 2 (CODE → POST_VERIFY handoff):
Transition to POST_VERIFY with this bash test directive embedded in the handoff.

CRITICAL RULES:
- edit: deny — never modify any files
- This is a READ-ONLY diagnostic. Do not change kilo.jsonc, rules, prompts, or any source file.
```

#### 1B — CODE Execution

CODE agent:
1. Reads `.kilo/kilo.jsonc` to confirm POST_VERIFY config
2. Outputs the structured bash test directive for POST_VERIFY
3. Hand off to POST_VERIFY with the test instruction in the task

**CODE step budget:** ~3-5 steps (read-only config check + structured output + handoff)

#### 1C — POST_VERIFY Execution

POST_VERIFY receives the task with explicit bash directive. Per the CTO's override:
- The task instructions explicitly tell POST_VERIFY to execute bash (overriding the prompt's default "don't execute" language)
- POST_VERIFY has `"bash": "allow"` in permissions
- POST_VERIFY has `"mode": "primary"` — if platform resolves permissions based on mode, bash should work

**Expected outcomes:**

| Scenario | POST_VERIFY Behavior | Verdict |
|----------|---------------------|---------|
| A | Bash executes successfully, output captured | `BASH_IS_WORKING` |
| B | Bash blocked with permission error message | `BASH_IS_BLOCKED` |
| C | POST_VERIFY refuses/ignores the bash instruction (prompt compliance) | `INCONCLUSIVE — retry with prompt override` |

---

### Task 2 — Verdict Documentation

**Action:** Document the empirical verdict in a structured findings record.

**Output file:** `docs/decisions/0017a-assumption-verification-findings.md`

**Content:**
```markdown
/* @lifecycle ACTIVE — Findings: ADR-017 Assumption Verification */

# ADR-017 Assumption Verification Findings

**Date:** 2026-06-10
**Method:** Isolated canary test (TASK-TEST-POST-VERIFY-BASH)

## Configuration Under Test
- POST_VERIFY mode: primary
- POST_VERIFY bash: allow
- POST_VERIFY edit: deny
- Platform: @kilocode/plugin v7.3.40

## Empirical Result
VERDICT: BASH_IS_WORKING | BASH_IS_BLOCKED

## Raw Output
<captured from POST_VERIFY>

## Implication
- If WORKING: ADR-017 premise falsified → recommend ADR-017 revision
- If BLOCKED: ADR-017 premise confirmed → no action needed

## Recommendation
<based on verdict>
```

**Lifecycle:** `ACTIVE`

---

### Task 3 — (Conditional) ADR-017 Revision Plan

Only if verdict is `BASH_IS_WORKING`.

**Scope:**
- Acknowledge ADR-017 §1 premise as falsified
- Recommend reversion path: revert CODE prompt changes, restore POST_VERIFY runtime verification per ADR-015 pattern
- Do NOT immediately edit files — produce ADR-018 as the superseding decision

**If `BASH_IS_BLOCKED`:**
- Close this diagnostic task
- ADR-017 stands as-is
- Add empirical proof to ADR-017 as supporting evidence

---

## Dependencies

```
Task 0 (Static Audit)    ──► independent (can run immediately)
Task 1 (Canary Test)     ──► depends on Task 0
Task 2 (Verdict Doc)     ──► depends on Task 1
Task 3 (Conditional)     ──► depends on Task 2 verdict
```

**Execution order:** Linear — Task 0 → 1 → 2 → (3 if needed)

**No parallelization:** Each task produces output consumed by the next.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Test doesn't reach POST_VERIFY.** CODE fails to hand off correctly, or the test instruction isn't preserved across the transition. | HIGH — test fails, no verdict | MEDIUM | Design CODE output as structured machine-parseable block. Include explicit handoff instructions. |
| **POST_VERIFY follows prompt over task.** The prompt says "review CODE's report" and POST_VERIFY ignores the bash directive despite task override. | MEDIUM — inconclusive result | LOW | The task/instruction field typically overrides prompt defaults in agent systems. If this occurs, document as "INCONCLUSIVE" and escalate. |
| **False negative due to non-bash reason.** POST_VERIFY fails for reasons unrelated to bash permission (e.g., rate limit, model error, network issue). | MEDIUM — false negative | LOW | Include explicit error type logging in the command. If error is non-permission, flag as INCONCLUSIVE. |
| **CODE edits files despite edit: deny.** Code agent is instructed to be read-only but might attempt modifications. | MEDIUM — config drift | LOW | Task explicitly forbids edits. POST_VERIFY can audit for file changes. Guard plugin enforces no unauthorized edits. |
| **ADR-017 reversion complexity.** If BASH_IS_WORKING, reverting ADR-017 requires coordinated changes across 5+ files. | MEDIUM — effort | LOW (conditional on verdict) | Task 3 defers actual reversion to a separate LEVEL_2 plan. This task only produces the verdict and recommendation. |

---

## Escalations

- **If POST_VERIFY produces INCONCLUSIVE:** Escalate to ARCH for alternative test design. Do NOT retry CODE.
- **If permission architecture conflict discovered:** Escalate to ARCH-DEEP. POST_VERIFY's `bash: allow` + `mode: primary` should work. If it doesn't despite config, the platform has a bug or undocumented restriction requiring investigation.
- **If ADR-017 reversion needed:** Requires ADR-018 (new ADR superseding ADR-017). Escalate to ARCH-DEEP for ADR creation. Do NOT edit ADR-017 directly — ADRs are immutable.
- **No schema changes, no infrastructure changes, no new agents, no DAG changes.**

---

## Files Changed

| File | Action | Task |
|------|--------|------|
| `docs/decisions/0017a-assumption-verification-findings.md` | **CREATE** (if verdict reached) | Task 2 |
| **No other files.** This is a read-only diagnostic task. | | |

**Total: At most 1 new file (findings document). Zero edits to existing files.**

---

## Acceptance Criteria

1. [ ] Task 0 completes — Static audit confirms current config state
2. [ ] Task 1 completes — CODE → POST_VERIFY cycle executed with bash directive
3. [ ] POST_VERIFY produces VERDICT: `BASH_IS_WORKING` or `BASH_IS_BLOCKED`
4. [ ] Verdict and raw output captured in findings document
5. [ ] No files edited (zero modifications to `kilo.jsonc`, rules, prompts, or source code)
6. [ ] If `BASH_IS_WORKING`: Recommendation for ADR-018 documented
7. [ ] If `BASH_IS_BLOCKED`: Findings appended as supporting evidence to ADR-017
8. [ ] No DAG changes, no schema changes, no infrastructure changes

---

*End of Plan — ready for PreVerify review.*
