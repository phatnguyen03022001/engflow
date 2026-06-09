/* @lifecycle ACTIVE — ADR-018: Restore POST_VERIFY Runtime Verification Execution */

# ADR-018 — Restore POST_VERIFY Runtime Verification Execution

**Status:** Active
**Created:** 2026-06-10
**Author:** Architecture Agent (Deep)
**Supersedes:** ADR-017 (entirely)
**Superseded By:** None
**References:** ADR-015, ADR-017, ADR-017a (Findings), ADR-ASK-001 (§2.2), Constitution §7

---

## 1. Context

### 1.1 The ADR-017 False Premise

ADR-017 (`docs/decisions/0017-execution-shift-to-code.md`) relocated runtime verification (`npm run build`, `npm run lint`, `npx jest`) from POST_VERIFY to CODE based on the premise that the Kilo platform blocked POST_VERIFY bash execution due to sub-task dispatch. The ADR stated:

> *"The Kilo platform (`@kilocode/plugin` v7.3.40) blocks POST_VERIFY bash execution despite `"bash": "allow"` in `kilo.jsonc` — the platform applies different permission resolution for sub-task dispatch (POST_VERIFY) vs. top-level sessions (CODE)."*

This premise was **never empirically tested** before ADR-017 was adopted.

### 1.2 Empirical Refutation

On 2026-06-10, an isolated canary test (`TASK-TEST-POST-VERIFY-BASH`, findings at `docs/decisions/0017a-assumption-verification-findings.md`) empirically tested POST_VERIFY's bash capability:

| Command | Result |
|---------|--------|
| `echo "NATIVE_BASH_TEST_SUCCESS"` | ✅ Exit 0 — shell execution works |
| `node -e "console.log('Runtime Node.js execution: OK')"` | ✅ Exit 0 — Node.js runtime accessible |
| `npm run lint -- --help` | ✅ Exit 0 — npm subprocess works, full ESLint help output captured |

**Verdict: BASH_IS_WORKING.** POST_VERIFY can execute bash commands natively with full stdout/stderr capture. No permission errors, no platform blocks.

### 1.3 Configuration Discovery

A static audit of `.kilo/kilo.jsonc` revealed that POST_VERIFY was never a sub-task agent:

- POST_VERIFY `"mode": "primary"` (line 240) — same as CODE, PLAN, ROUTER
- POST_VERIFY `"bash": "allow"` (line 250) — identical to CODE's inherited allow
- The only agent with `"mode": "subagent"` is DEBUG (line 189)
- ADR-017 §4.B stated POST_VERIFY "cannot be the primary session agent" — contradicted by the existing configuration

The premise was false. The entire justification for moving runtime verification to CODE was invalid.

### 1.4 What Worked in ADR-017

ADR-017 introduced several quality-of-verification improvements that are architecture-valuable independent of the false premise:

1. **Structured Runtime Verification Report** — table format with command, status, exit code, duration
2. **Full raw output capture** — no AI summarization or truncation
3. **Pattern scanning** — systematic scan of output for `Error:`, `TypeError`, `TS\d+:`, `Module not found`
4. **Cross-reference** — checking verification results against static analysis findings
5. **Failure-to-Task Mapping** — mapping each failure to the Code Agent task that introduced it
6. **Timeout contract** — standardized timeouts (build 120s, lint 60s, test 300s)

These improvements are preserved in ADR-018. The only change is the actor: POST_VERIFY executes verification itself rather than auditing CODE's self-report.

---

## 2. Decision

### §1 — Restore POST_VERIFY as Runtime Verification Executor

POST_VERIFY SHALL execute `npm run build` → `npm run lint` → `npx jest --passWithNoTests` in strict sequential order as its verification procedure. This restores the ADR-015 design pattern.

POST_VERIFY operates with:
- `"bash": "allow"` — unchanged, empirically confirmed working
- `"mode": "primary"` — unchanged, same as CODE
- `"edit": "deny"` — unchanged, never modifies code

### §2 — Remove CODE's Runtime Verification Burden

CODE SHALL NOT execute build/lint/test before transitioning to POST_VERIFY. The following ADR-017 artifacts are removed:

- CODE prompt: "RUNTIME VERIFICATION (ADR-017)" section removed from `kilo.jsonc`
- CODE rules: §1.10 (Runtime Verification delegation) removed from `agent.rules.md`
- CODE DoD: Item 5 ("Runtime Verification passed") removed from §1.9

CODE's responsibility ends at implementation. Verification is POST_VERIFY's exclusive domain.

### §3 — Preserve ADR-017 Quality Standards as POST_VERIFY Self-Audit

POST_VERIFY SHALL apply the following quality standards to its own verification output (adapted from ADR-017 §2 and ADR-015 §3):

**Structured Report Format:**

```
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

**Self-Audit Protocol:**

1. **Exit Code Check** — Any non-zero exit code or "TIMEOUT" → FAIL verdict
2. **Pattern Scan** — Scan own output for `Error:`, `Exception`, `FAIL`, `TypeError`, `ReferenceError`, `SyntaxError`, `TS\d+:`, `Module not found`
3. **Cross-Reference** — Check verification results against static analysis findings (e.g., if source analysis reveals missing imports but build passes, FLAG)

**Failure-to-Task Mapping:**

When any command fails, POST_VERIFY SHALL map each failure to the Code Agent task that introduced it:
```
### Failed Tasks (for CODE retry)
1. **TASK:** <task description> — <root cause and fix guidance>
```

**Output Capture Rules:**
- Capture FULL raw stdout and stderr for each command
- Do NOT summarize, truncate, or filter the output
- Capture exit codes (0 = pass, non-zero = fail)
- Record approximate duration for each command

**Timeout Contract:**

| Command | Timeout | Action on Exceed |
|---------|---------|------------------|
| `npm run build` | 120 seconds | Treat as FAIL, report "TIMEOUT" |
| `npm run lint` | 60 seconds | Treat as FAIL, report "TIMEOUT" |
| `npx jest --passWithNoTests` | 300 seconds | Treat as FAIL, report "TIMEOUT" |

### §4 — Execution Order

POST_VERIFY SHALL execute verification in deterministic sequential order:

```
Step 1: npm run build       → FAIL blocks all subsequent checks
Step 2: npm run lint        → Runs only if build passes
Step 3: npx jest --passWithNoTests → Runs only if lint passes
```

Rationale: Build failures make lint and test results meaningless. Sequential execution provides fastest feedback — failures are caught and reported immediately.

### §5 — Sandbox: Direct Host Execution

POST_VERIFY executes commands directly on the host. The Docker sandbox isolation specified in ADR-015 §2 is **not restored** in this ADR for the following reasons:

1. The canary test empirically proved direct host execution works without security issues
2. Docker sandbox adds operational complexity (container must be running, clean-state management, tmpfs configuration)
3. POST_VERIFY's `edit: deny` and whitelisted-commands-only policy already constrain its capabilities
4. Constitution §7 (Simplicity) favors simpler solutions when security requirements are met

If a security concern arises in the future, Docker sandbox isolation can be added via a new ADR amendment. The timeout contract (§3) and output capture standards (§3) apply regardless of execution environment.

### §6 — ADR-015 Full Restoration

ADR-015 §1 (bash: allow) is fully restored. ADR-015's original design intent — POST_VERIFY executes runtime verification at the gate — is reactivated. The ADR-017 partial supersession of ADR-015 §1-2 is reversed:

| ADR-015 Section | Status After ADR-018 |
|----------------|----------------------|
| §1 (bash: allow) | Active — POST_VERIFY uses it |
| §2 (Sandbox isolation) | Superseded by ADR-018 §5 (direct host execution) |
| §3 (Structured output) | Active — format preserved and enhanced |
| §4 (Execution order) | Active — sequential order preserved |

### §7 — ADR-017 Supersession

ADR-017 is fully superseded by ADR-018. ADR-017's status changes from `Active` to `Superseded` in the ADR index.

ADR-017 remains as an immutable historical record. Its documentation of the platform investigation, the reasoning at the time, and the alternatives considered remains valuable for future reference. Only the decision itself is superseded.

---

## 3. Consequences

### Positive

1. **Gate integrity restored.** POST_VERIFY is once again the single source of verification truth. No self-reporting conflict of interest — the verifier and the implementer are separate agents.

2. **Empirically grounded.** Unlike ADR-017 (adopted without testing), ADR-018 is based on empirical evidence from the canary test.

3. **Quality standards preserved.** The structured report format, pattern scanning, cross-referencing, failure-to-task mapping, and timeout contracts from ADR-017 are all retained — adapted from auditing CODE's report to auditing POST_VERIFY's own output.

4. **Simpler CODE responsibility.** CODE no longer carries the verification burden. Its step budget (20 steps) is freed from ~3-5 verification steps.

5. **No permission changes.** `bash: allow`, `edit: deny`, and `mode: primary` for POST_VERIFY are all unchanged. No configuration drift.

6. **No DAG changes.** The Execution Contract's `CODE → POST_VERIFY → COMMIT` path is preserved exactly as-is.

### Negative

1. **POST_VERIFY execution time increases.** Each verification run adds up to 8 minutes. However, this was the original ADR-015 design — the time was always part of the gate. ADR-017's move to CODE concealed this time in CODE's execution budget rather than making it visible at the gate.

2. **POST_VERIFY step budget consumption.** The 7-step budget for POST_VERIFY must now accommodate build/lint/test execution. This is acceptable — verification is the primary purpose of the gate.

### Neutral

1. **No new files.** Only edits to existing files (agent.rules.md, kilo.jsonc, decisions.md).
2. **No schema changes.** No Prisma migrations.
3. **No infrastructure changes.** No Docker, no new services.
4. **No new agents.** Agent catalog remains at 8.

---

## 4. Alternatives Considered

### A. Keep ADR-017 as-is despite falsified premise

**Rejected.** ADR-017's core justification was empirically disproven. Maintaining a decision based on a false premise would undermine the ADR governance framework. Self-reported verification (CODE reporting its own results) introduces a conflict of interest that ADR-017 itself acknowledged as a negative consequence. ADR-018 eliminates this conflict.

### B. Add Docker sandbox isolation

**Rejected for this ADR.** Docker sandbox isolation (ADR-015 §2) is a separate concern from the actor (who executes verification). ADR-018's scope is restoring POST_VERIFY as the executor. Docker sandbox can be evaluated in a future ADR if operational security requirements demand it.

### C. Create a new "Verification" agent

**Rejected.** Would add agent #9 and a new DAG transition, violating Constitution §7 (Simplicity) and the monolith-first principle. POST_VERIFY already has the correct permissions and is the natural gate location for verification.

### D. Revert ADR-015 entirely (bash: deny, visual-only)

**Rejected.** The Avatar Upload Incident (ADR-015 §1.1) proved that visual review alone cannot detect TypeScript compilation errors, framework incompatibilities, or test failures. Runtime verification at the gate is essential. ADR-018 preserves this capability.

---

## 5. Supersession Detail

### ADR-017 — Full Supersession

| ADR-017 Section | Supersession |
|----------------|-------------|
| §1 (Runtime verification moves to CODE) | **Superseded** — moves back to POST_VERIFY (ADR-018 §1) |
| §2 (POST_VERIFY review-only) | **Superseded** — POST_VERIFY executes again (ADR-018 §1) |
| §3 (POST_VERIFY permission preserved) | **Preserved in spirit** — bash: allow, edit: deny unchanged (ADR-018 §1) |
| §4 (Execution order preserved) | **Preserved** — same order, executor changed to POST_VERIFY (ADR-018 §4) |
| §5 (ADR-015 partial supersession) | **Superseded** — ADR-015 §1 restored, §2 remains modified (ADR-018 §6) |

### ADR-015 — Partial Modification

| ADR-015 Section | Status After ADR-018 |
|----------------|----------------------|
| §1 (bash: allow) | **Restored to Active** |
| §2 (Sandbox isolation) | **Remains modified** — direct host execution per ADR-018 §5 |
| §3 (Structured output) | **Active** — format preserved and enhanced with ADR-018 §3 additions |
| §4 (Execution order) | **Active** |
| §5 (Integration with ADRs) | **Active** — integration points unchanged |

---

## 6. Compliance

| Check | Criteria | Status |
|-------|----------|--------|
| Constitution §7 (Simplicity) | No new infrastructure, no new agents, reduces CODE complexity | ✅ |
| ADR-ASK-001 §2.2 (Agent Catalog) | All 8 agents preserved; POST_VERIFY identity restored | ✅ |
| ADR-ASK-001 §2.3 (Pillar Principles) | Principle 1 (Never Implements): `edit: deny` preserved. Principle 2 (Never Bypasses Gates): Runtime verification restored to gate. Principle 3 (Never Merges): No git operations. Principle 4 (Single Next Agent): POST_VERIFY routes unchanged | ✅ |
| ADR-015 (Runtime Verification) | Partially restored (§1 active, §2 remains modified) per §6 | ✅ |
| ADR-017 (Execution Shift) | Fully superseded per §7 | ✅ |
| Execution Contract §2.2 (Transitions) | All transitions preserved; `code → post_verify` unchanged | ✅ |
| Execution Contract §4.6 (Gate Decisions) | Gate decisions preserved; conditions updated to reference runtime execution, not Raw Output Audit | ✅ |
| ADR-008 (Lifecycle Declarations) | This file has `@lifecycle ACTIVE` | ✅ |

---

## 7. Implementation Notes

This ADR requires the following implementation tasks (for a follow-up CODE phase):

### Task A — Update `agent.rules.md`
1. **Remove §1.9 item 5** ("Runtime Verification passed") from CODE Definition of Done
2. **Remove §1.10** (CODE Runtime Verification delegation) entirely
3. **Revert §3.1** (POST_VERIFY Role) to: "Quality assurance, spec compliance, and regression checking AFTER code execution. Performs runtime verification via build/lint/test commands. Never modifies code."
4. **Revert §3.2** (Input) to: "Code implementation output, original plan, acceptance criteria"
5. **Replace §3.4** (Raw Output Audit) with: "Runtime Verification" section where POST_VERIFY executes commands directly, applying the same quality standards (exit code check, pattern scan, cross-reference) as self-audit
6. **Revert §3.6** (Rules) line 304 to: "Bash: allow for whitelisted verification commands only"
7. **Replace §3.7** (Sandbox Note) with: "POST_VERIFY executes commands directly on host. Timeout contract enforced by POST_VERIFY."
8. **Update §3.8** (Gate Decisions) conditions to reference "runtime checks pass" instead of "Raw Output Audit passes"

### Task B — Update `kilo.jsonc` CODE prompt
- **Remove** the "RUNTIME VERIFICATION (ADR-017)" section

### Task C — Update `kilo.jsonc` POST_VERIFY prompt
- **Restore** direct execution instructions: "POST_VERIFY executes npm run build → npm run lint → npx jest --passWithNoTests in strict sequential order."
- **Remove** language about "CODE has already executed" and "you review CODE's reported results"
- **Preserve** output format and structured report instructions
- **Preserve** `bash: allow`, `edit: deny`, `mode: primary` permissions — NO changes

### Task D — Update `docs/decisions.md` index
- Change ADR-017 status: `Active` → `Superseded`. Add note: "Superseded by ADR-018."
- Change ADR-015 summary: remove "(§1-2 partially superseded by ADR-017)"
- Add ADR-018 entry

### Task E — No changes to
- Guard plugin (`.kilo/guard/`)
- Execution Contract
- Backend source code
- Docker configuration
- Prisma schema
- Any other agent prompts or permissions

---

## 8. References

- ADR-015 — Runtime Verification Integration (`docs/decisions/0015-runtime-verification-post-verify.md`)
- ADR-017 — Runtime Verification Relocation to CODE Agent (`docs/decisions/0017-execution-shift-to-code.md`)
- ADR-017a — Assumption Verification Findings (`docs/decisions/0017a-assumption-verification-findings.md`)
- ADR-017 — Execution Plan (`.kilo/plans/adr-017-execution-shift.md`)
- Canary Test Plan (`.kilo/plans/adr-017-assumption-verification.md`)
- ADR-ASK-001 — Agent Routing Governance (`docs/decisions/ADR-ASK-001-agent-routing-governance.md`)
- ADR-008 — Lifecycle Declarations (`docs/decisions/008-lifecycle-declarations.md`)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Agent Rules (`.kilo/rules/agents/agent.rules.md`)
- Constitution §7 — Simplicity (`docs/constitution.md`)
- `.kilo/kilo.jsonc` — Agent configuration

---

**End of ADR-018**
