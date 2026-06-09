/* @lifecycle ACTIVE — ADR-017: Runtime Verification Relocation to CODE Agent */

# ADR-017 — Runtime Verification Relocation to CODE Agent

**Status:** Active
**Created:** 2026-06-10
**Author:** Architecture Agent
**Supersedes:** ADR-015 §1-2 (partially)
**Superseded By:** None
**References:** ADR-015, ADR-ASK-001 (§2.2), Constitution §7

---

## 1. Context

- ADR-015 granted POST_VERIFY `bash: allow` for whitelisted commands (build/lint/test).
- Platform constraint: `@kilocode/plugin` v7.3.40 blocks sub-task bash execution despite `"bash": "allow"` in `kilo.jsonc`. POST_VERIFY operates as a sub-task agent and cannot execute bash commands reliably.
- CODE agent bash (top-level session) works reliably — CODE inherits `"bash": "allow"` from the global permission block.
- The guard plugin (`.kilo/guard/index.ts`) is a pure state machine validator — it has zero permission logic and is not responsible for the bash blockage. The permission issue is in the Kilo platform binary, not in any file in this repository.
- Discovery during investigation: ADR-015 and ADR-016 exist on disk but are missing from the `docs/decisions.md` index.

---

## 2. Decision

### §1 — Runtime verification execution moves from POST_VERIFY to CODE

CODE executes `npm run build` → `npm run lint` → `npx jest --passWithNoTests` in strict sequential order as its final implementation step. CODE captures full raw stdout+stderr for each command (no AI summarization) and formats a structured **Runtime Verification Report**.

### §2 — POST_VERIFY transitions to review-only

POST_VERIFY receives CODE's Runtime Verification Report and performs a **Raw Output Audit**:
1. **Exit Code Audit** — Any non-zero exit code or "TIMEOUT" → FAIL verdict.
2. **Pattern Scan** — Scan raw output for `Error:`, `Exception`, `FAIL`, `TypeError`, `TS\d+:`, `Module not found`, and other failure patterns.
3. **Cross-Reference** — Check CODE's reported status against POST_VERIFY's own static analysis findings.

POST_VERIFY integrates the Raw Output Audit findings into its gate decision (PASS/FLAG/FAIL) alongside its existing static analysis checks.

### §3 — POST_VERIFY permission preserved

POST_VERIFY's `"bash": "allow"` in `kilo.jsonc` stays unchanged for future platform compatibility. POST_VERIFY does not use bash for verification — it reviews CODE's report. `"edit": "deny"` is also preserved.

### §4 — Execution order preserved

CODE executes the verification commands in the same order ADR-015 defined:

```
Step 1: npm run build       → FAIL blocks all subsequent checks
Step 2: npm run lint        → Runs only if build passes
Step 3: npx jest --passWithNoTests → Runs only if lint passes
```

### §5 — ADR-015 partial supersession

| ADR-015 Section | Status | Notes |
|-----------------|--------|-------|
| §1 (bash: allow) | Config stays, POST_VERIFY doesn't use it | Preserved for future platform compatibility |
| §2 (Sandbox isolation) | Moot | CODE runs directly, not in Docker sandbox. Sandbox hygiene recommendations retained for CODE |
| §3 (Structured output) | Preserved, adapted | Output format now used by CODE for Runtime Verification Report, reviewed by POST_VERIFY |
| §4 (Execution order) | Preserved, now executed by CODE | Same sequential order, same timeout values |

---

## 3. Consequences

### Positive

1. **Runtime verification works.** CODE's top-level bash access bypasses the platform sub-task permission limitation, enabling reliable build/lint/test execution at the gate.

2. **No permission changes.** All `kilo.jsonc` permissions remain unchanged (I1, I2, I4 in the plan invariants). No risk of configuration drift or unintended permission escalation.

3. **No DAG changes.** The Execution Contract state machine (`code → post_verify → COMMIT`) is preserved. No new transitions, no modified transitions. The guard plugin requires zero changes.

4. **POST_VERIFY integrity preserved.** POST_VERIFY still makes the gate decision. It independently audits CODE's raw output — CODE cannot bypass the gate by reporting false results.

5. **Minimal blast radius.** One new file (ADR-017), four edited files (rules, prompts, index). No backend code, no schema, no infrastructure, no guard changes.

### Negative

1. **Self-reported results.** CODE reports its own build/lint/test results, creating a potential conflict of interest. Mitigation: POST_VERIFY performs independent Raw Output Audit (pattern scan + cross-reference against static analysis). Discrepancies trigger FAIL or FLAG.

2. **No Docker sandbox isolation.** CODE runs build/lint/test directly in its environment, not in a containerized sandbox. Mitigation: CODE is expected to follow verification hygiene (clean `dist/`, use test database config, capture full raw output).

3. **Step budget consumption.** Runtime verification adds ~3-5 steps to CODE's 20-step limit. This is acceptable — the verification is three atomic bash calls with no complex logic.

### Neutral

1. **No schema changes.** No Prisma migrations, no model changes, no backend code modifications.
2. **No infrastructure changes.** No new Docker services, no new dependencies, no new agents.
3. **No guard changes.** The guard plugin, types, transitions, and state machine are all untouched.

---

## 4. Alternatives Considered

### A. Fix the Kilo platform sub-task permission bug

**Rejected.** The permission bug is in the `@kilocode/plugin` binary (v7.3.40), which is a platform dependency outside this repository's control. Fixing it requires a platform release and is not actionable from the project side.

### B. Change POST_VERIFY from sub-agent to primary agent mode

**Rejected.** Changing the agent's `mode` from `subagent` (implied by sub-task dispatch) to `primary` would require changing how POST_VERIFY is invoked by the Runtime Guard, which is a DAG-level change. Additionally, POST_VERIFY is inherently a sub-task of the execution pipeline — it cannot be the primary session agent.

### C. Add a "Runtime Verify" agent between CODE and POST_VERIFY

**Rejected.** Introduces a new agent (agent #9) and a new DAG transition, violating Constitution §7 (Simplicity). The verification is already a natural part of CODE's implementation cycle — CODE must verify its own output before handing off. Adding a separate agent would compound the same bash permission issue.

### D. Remove runtime verification entirely; rely on visual review only

**Rejected.** ADR-015 §1.1 (the Avatar Upload Incident) demonstrated that visual review cannot detect TypeScript compilation errors, framework incompatibilities, or test failures. Removing runtime verification would regress the gate's quality assurance capability. ADR-017 preserves runtime verification by moving it to CODE.

---

## 5. Compliance

| Check | Criteria | Status |
|-------|----------|--------|
| Constitution §7 (Simplicity) | No new infrastructure, no new agents, monolith-first | ✅ |
| ADR-ASK-001 §2.2 (Agent Catalog) | All 8 agents preserved; no new agent types | ✅ |
| ADR-ASK-001 §2.3 (Pillar Principles) | Principle 1 (Never Implements): POST_VERIFY `edit: deny` preserved. Principle 2 (Never Bypasses Gates): Runtime verification still happens at the gate — CODE executes, POST_VERIFY audits. Principle 3 (Never Merges): No git operations. Principle 4 (Single Next Agent): POST_VERIFY still routes to COMMIT/CODE/ARCH | ✅ |
| ADR-015 (Runtime Verification) | Partially superseded (§1-2) per §5 of this ADR | ✅ |
| Execution Contract §2.2 (Transitions) | All 17 existing transitions preserved; `code → post_verify` unchanged | ✅ |
| Execution Contract §4.6 (Gate Decisions) | POST_VERIFY gate decisions preserved; Raw Output Audit replaces direct bash execution | ✅ |
| ADR-008 (Lifecycle Declarations) | This file has `@lifecycle ACTIVE`; all new files will have lifecycle declarations | ✅ |

---

## 6. Implementation Notes

This ADR requires the following implementation tasks:

1. **Create this document** (`docs/decisions/0017-execution-shift-to-code.md`)
2. **Update `.kilo/rules/agents/code.rules.md`** — Add §10 (Runtime Verification), update §9 (Definition of Done includes verification)
3. **Update `.kilo/rules/agents/post_verify.rules.md`** — Replace §3.8 with Raw Output Audit protocol, update §1 (Role), §2 (Input), §4 (Output Format), §5 (Rules), §6 (Sandbox Note), §7 (Gate Decisions)
4. **Update `.kilo/kilo.jsonc` CODE prompt** — Add Runtime Verification Delegation section before Context Manager marker
5. **Update `.kilo/kilo.jsonc` POST_VERIFY prompt** — Replace bash execution/whitelist/sandbox with Raw Output Audit
6. **Update `docs/decisions.md` index** — Add ADR-015, ADR-016, ADR-017 entries
7. **No changes to:** guard plugin, execution contract, backend code, Docker config, schema files

---

## 7. References

- ADR-015 — Runtime Verification Integration (`docs/decisions/0015-runtime-verification-post-verify.md`)
- ADR-016 — Debug Agent Activation (`docs/decisions/0016-debug-agent-activation.md`)
- ADR-ASK-001 — Agent Routing Governance Specification (`docs/decisions/ADR-ASK-001-agent-routing-governance.md`)
- ADR-008 — Lifecycle Declarations (`docs/decisions/008-lifecycle-declarations.md`)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Constitution §7 — Simplicity (`docs/constitution.md`)
- `.kilo/kilo.jsonc` — Agent configuration
- `.kilo/guard/index.ts` — Guard runtime (no changes needed)
- `.kilo/rules/agents/code.rules.md` — Code Agent Rules
- `.kilo/rules/agents/post_verify.rules.md` — Post-Verify Agent Rules

---

**End of ADR-017**
