/* @lifecycle ACTIVE — ADR-016: Debug Agent Activation */

# ADR-016 — Debug Agent Activation

**Status:** Active
**Created:** 2026-06-10
**Author:** Architect Agent
**Supersedes:** None (resolves ADR-ASK-001 §2.2 deferred status)
**Superseded By:** None
**References:** ADR-ASK-001 (§2.2, §2.4), ADR-015 (§5.1, §5.4), ADR-003 (§5), Execution Contract (§2, §5), Constitution §7

---

## 1. Context

The Floweng AI Software Factory agent catalog (ADR-ASK-001 §2.2) defines 8 agents, one of which is **Debug** (agent #7) — a defect resolution agent designed to diagnose and fix bugs after PostVerify FAIL or runtime errors. Its purpose is to be functionally separate from Code to avoid **confirmation bias**: a code author reviewing their own defects tends to make the same assumptions that caused the bugs.

**Current state:**

1. **Disabled in kilo.jsonc.** The DEBUG agent block has `"disable": true` and a 3-line placeholder prompt saying "This agent is DEFERRED." It exists in configuration but is non-functional.

2. **Absent from the Execution Contract.** The state machine DAG (`execution.contract.md §2.1`) has no `debug` node. POST_VERIFY's FAIL verdict routes only to CODE (retry, max 1) or ARCH (BLOCK). There is no defect resolution escalation path that preserves separation of concerns.

3. **Unsupported by the Runtime Guard.** The guard's `Agent` type, `RetryCount` interface, allowed transitions table, and phase map all exclude `debug`. Transitions involving `debug` would be rejected as "Unknown transition."

4. **Governance references as deferred.** ADR-ASK-001 §2.2 describes Debug as "*Deferred: requires separate ADR before implementation.*" The Routing Decision Matrix (§2.4) says "`debug` (when implemented)."

5. **Incomplete evaluation metrics.** ADR-003 §5 defines `debugSuccess` but the Evaluation Harness only tracks whether debug succeeded on a single `retryCount = 1` basis. Two additional metrics — escalation rate and code-retry-after-debug rate — are needed to measure the debug pipeline's end-to-end effectiveness.

**Problem:** Without a functional DEBUG agent, defect resolution following PostVerify FAIL is handled by the same CODE agent that produced the defect. This creates a confirmation bias loop: CODE re-examines its own work with the same assumptions, missing the same bugs. The only escalation path is ARCH (BLOCK), which is an architecture governance escalation, not a defect resolution one. This forces architectural review for what are often simple bugs — wasting Architect cycles and delaying fixes.

---

## 2. Decision

### §1 — Activate DEBUG Agent

DEBUG SHALL be activated by removing `"disable": true` from its configuration in `.kilo/kilo.jsonc`, replacing the placeholder prompt with a full diagnosis-first workflow prompt, and updating the description to remove the `(DEFERRED)` annotation.

The activation is purely configuration — no new agent type, no new infrastructure, no new model. DEBUG uses the same model as CODE (`deepseek/deepseek-v4-flash`).

**Configuration changes in `.kilo/kilo.jsonc`:**

| Property | Before | After |
|----------|--------|-------|
| `disable` | `true` | *(removed)* |
| `description` | `"...(DEFERRED)..."` | `"...diagnose and fix bugs..."` |
| `prompt` | 3-line placeholder | Full diagnosis-first workflow |
| `task` permission | `"allow"` *(incorrect)* | `"deny"` *(fix: only Router may dispatch)* |

**Permission boundary:**

| Permission | Value | Rationale |
|------------|-------|-----------|
| `edit` | `allow` | Must modify source files to fix bugs |
| `bash` | `allow` | Must run build/lint/test to verify fixes |
| `task` | `deny` | **Security fix.** Only ROUTER may dispatch tasks. DEBUG is invoked exclusively by POST_VERIFY — it must never route to other agents. |

### §2 — State Machine Integration

The Execution Contract SHALL be extended with 3 new allowed transitions and 3 new forbidden transitions to integrate DEBUG into the execution DAG.

**Allowed transitions:**

| From | To | Condition |
|------|----|-----------|
| POST_VERIFY | debug | FAIL after CODE retry exhausted |
| debug | POST_VERIFY | Fix applied, re-verify |
| debug | architect | BLOCK (cannot fix) |

**Forbidden transitions:**

| From → To | Reason |
|-----------|--------|
| debug → plan | No re-planning after execution phase |
| debug → code | DEBUG never delegates back to CODE (prevents delegation loops) |
| debug → pre_verify | Only POST_VERIFY gates DEBUG output |

**Full defect resolution flow:**

```
CODE → POST_VERIFY (FAIL) → CODE (retry max 1) → POST_VERIFY (FAIL again)
  → DEBUG (escalation)
    → POST_VERIFY (re-verify, fix applied)
      → COMMIT (PASS/FLAG)
    → ARCH (BLOCK, cannot fix)
```

### §3 — Invocation Scope

DEBUG SHALL be invocable ONLY by POST_VERIFY. The Router SHALL NOT route to DEBUG directly. This is enforced by:
- The Execution Contract (§2.2): only `POST_VERIFY → debug` is an allowed transition
- The Routing Matrix (ADR-ASK-001 §2.4): Router routes defect resolution to `code` first, not `debug`
- The Guard: rejects any `router → debug` transition as unknown

DEBUG's outbound transitions are limited to `→ POST_VERIFY` (fix applied) or `→ ARCH` (cannot fix). DEBUG never transitions to PLAN, CODE, PRE_VERIFY, or COMMIT directly.

### §4 — Diagnosis-First Workflow

The DEBUG agent SHALL follow a mandatory **Diagnosis-First Workflow** — it must reproduce, diagnose, and report the root cause **before** applying any fix. This prevents the confirmation bias that the agent is designed to avoid.

**Mandatory steps (enforced via agent prompt — never skip):**

| Step | Action | Output |
|------|--------|--------|
| 1 | **REPRODUCE** — Run the failing commands to reproduce the issue | Console output |
| 2 | **DIAGNOSE** — Analyze error output, trace root cause (missing imports, type mismatches, framework incompatibilities, null/undefined access, wrong API usage) | Root cause identification |
| 3 | **REPORT** — Output structured root cause analysis | `## Root Cause Analysis` with Symptom / Root Cause / Files Affected / Fix Strategy |
| 4 | **FIX** — Apply minimal targeted change addressing the root cause | Source file modification |
| 5 | **VERIFY** — Run `npm run build` to confirm fix resolves compilation | Build output |
| 6 | **VERIFY** — Run `npx jest --passWithNoTests` to confirm no regression | Test output |
| 7 | **ESCALATE** or **HANDOFF** — Route to POST_VERIFY or ARCH | Agent transition |

**Rule:** If the fix requires schema changes, architecture changes, or new dependencies → escalate to ARCH immediately. Do NOT attempt.

### §5 — Retry Semantics

DEBUG SHALL have a maximum of **1 attempt per invocation**. This prevents infinite debug loops and forces timely escalation to ARCH.

| Scenario | Action | Max Retries |
|----------|--------|-------------|
| DEBUG → POST_VERIFY FAIL | Escalate to ARCH (BLOCK) | 0 |

**Comparison with CODE retry:**

| Dimension | CODE Retry | DEBUG Escalation |
|-----------|-----------|------------------|
| Trigger | PostVerify FAIL (first) | PostVerify FAIL after CODE retry exhausted |
| Agent | Same as original implementer | Different agent (no confirmation bias) |
| Max attempts | 1 | 1 |
| After failure | CODE → DEBUG | DEBUG → ARCH |

### §6 — Evaluation Metrics

DEBUG SHALL expose **3 evaluation metrics** computed from existing `AgentExecution` schema fields (no new Prisma models or migrations required):

| Metric | Formula | SQL/Prisma Equivalent | Purpose |
|--------|---------|-----------------------|---------|
| **debugSuccessRate** | `debugSuccess / debugInvoked` | `retryCount > 0 AND debugSuccess IS NOT NULL` → `debugSuccess = true` | How often DEBUG fixes the issue |
| **debugToCodeEscalationRate** | `debugFailedButCommitted / debugInvoked` | `retryCount > 0 AND debugSuccess = false AND finalOutcome = 'COMMITTED'` | How often CODE must re-attempt after DEBUG fails |
| **codeRetryAfterDebugSuccessRate** | `codeFailedBeforeDebug / debugSuccess` | `retryCount > 0 AND debugSuccess = true AND codeFirstAttemptSuccess = false` | How often DEBUG compensates for CODE errors |

All three metrics SHALL be computed as methods in `CodeEvaluatorService` (existing `backend/src/evaluation/services/code-evaluator.service.ts`) and wired into the existing `computeAll()` method and metric persistence pipeline. No new service, module, or controller is required.

---

## 3. Consequences

### Positive

1. **Confirmation bias prevention.** Defect resolution is handled by a different agent (DEBUG) than the original implementer (CODE). The diagnosis-first workflow forces systematic root cause analysis before fixes.

2. **Governance gap closed.** The agent catalog (ADR-ASK-001 §2.2) is now fully realized — all 8 agents are active. No more "deferred" entries.

3. **Measurable debug pipeline.** Three metrics provide visibility into DEBUG effectiveness, escalation patterns, and CODE's dependency on DEBUG. This data enables prompt tuning and model evaluation.

4. **Minimal blast radius.** Activation is configuration-only: one agent block in kilo.jsonc, one contract update, one Guard file set, and additive metric methods. No schema changes, no new modules, no new infrastructure.

5. **Security fix.** The existing DEBUG config incorrectly had `task: allow`. This is corrected to `task: deny` during activation, aligning with ADR-ASK-001's responsibility boundary that only ROUTER may dispatch tasks.

### Negative

1. **DAG complexity increase.** Adding 3 new transitions increases the state machine from 14 to 17 transitions. The DAG diagram is more complex, with a new branching path from POST_VERIFY FAIL.

2. **DEBUG single-attempt limit.** Some bugs may require iterative diagnosis (fix → test → refine). The single-attempt limit forces escalation to ARCH for multi-step fixes. Mitigation: this is intentional — if DEBUG cannot fix in one pass, the issue likely requires architectural review.

3. **Cold start for metrics.** All three DEBUG metrics return `null` until at least one DEBUG invocation completes. This is consistent with existing evaluation metrics behavior.

4. **Prompt enforcement reliance.** The diagnosis-first workflow is enforced via agent prompt, not code. A compromised or modified prompt could skip steps. Mitigation: the workflow is structured as a mandatory prompt directive, which is the same enforcement mechanism used for all other agent behaviors.

### Neutral

1. **No schema changes.** All three evaluation metrics use existing `AgentExecution` fields (`retryCount`, `debugSuccess`, `codeFirstAttemptSuccess`, `finalOutcome`). No Prisma migration.

2. **No new infrastructure.** DEBUG uses the same model, same Docker container, same file system as CODE. No new services, containers, or dependencies.

3. **No new backend modules.** Evaluation metric methods are added to existing `CodeEvaluatorService`. No new service or module files.

4. **POST_VERIFY unchanged.** The gate's permission boundary (`edit: deny`, `bash: allow` for whitelisted commands) and decision logic (PASS/FLAG → COMMIT, FAIL → CODE/DEBUG, BLOCK → ARCH) are preserved per ADR-015.

---

## 4. Alternatives Considered

### A. Extend CODE retry count (3 retries instead of 1 + DEBUG)

**Rejected.** Increasing CODE retries amplifies confirmation bias — the same agent examines its own work with the same assumptions. ADR-ASK-001 §2.2 explicitly separates DEBUG from CODE to avoid this. Empirical data from the Avatar Upload Incident (ADR-015 §1.1) showed that visual review by the same author missed framework incompatibilities — DEBUG exists specifically for these cases.

### B. New agent between CODE and POST_VERIFY

**Rejected.** Inserting an agent between CODE and POST_VERIFY would make it a mandatory pipeline step on every execution, even when there is no defect. This adds latency (~15 steps, ~30s model inference) to every implementation cycle. DEBUG is an escalation path, not a mandatory gating stage. Post-hoc invocation by POST_VERIFY is the correct architecture.

### C. Unlimited DEBUG attempts

**Rejected.** Without an attempt bound, DEBUG could loop indefinitely, consuming model inference budget without escalation. The single-attempt limit forces timely escalation to ARCH when the defect requires architectural intervention. This aligns with Constitution §7 (Simplicity) — bounded loops are simpler to reason about and enforce.

### D. Allow Router to route directly to DEBUG

**Rejected.** DEBUG is a reliability agent (Layer 7), not a primary execution agent (Layer 6). Direct routing from ROUTER would bypass the CODE → POST_VERIFY → FAIL chain that determines whether DEBUG is needed. Only POST_VERIFY has the context to make this determination. This maintains Principle 2 (ADR-ASK-001 §2.3): "ASK Never Bypasses Gates."

### E. Add DEBUG to the mandatory pipeline (always runs after CODE)

**Rejected.** Constitution §7 (Simplicity) favors lean pipelines. DEBUG is only needed when PostVerify FAILs. Making it mandatory would add cost and latency to every execution, including successful ones. On-demand escalation is the simpler, cheaper pattern.

---

## 5. Compliance

| Check | Criteria | Status |
|-------|----------|--------|
| ADR-ASK-001 §2.2 (Agent Catalog) | Agent #7 DEBUG preserved; deferred annotation removed; responsibility boundary unchanged | ✅ |
| ADR-ASK-001 §2.3 (Pillar Principles) | Principle 1 (Never Implements): N/A — DEBUG has `edit: allow`. Principle 2 (Never Bypasses Gates): PostVerify still gates before COMMIT — DEBUG fixes are re-verified. Principle 3 (Never Merges): `task: deny` prevents repository mutation. Principle 4 (Single Next Agent): DEBUG routes to exactly one target (POST_VERIFY or ARCH) | ✅ |
| ADR-ASK-001 §2.4 (Routing Matrix) | Defect resolution row updated: CODE first, DEBUG escalation | ✅ |
| ADR-015 §5.1 (PostVerify Integration) | PostVerify gate decisions table unchanged; new DEBUG transition is additive | ✅ |
| ADR-003 §5 (Metric Formulas) | Debug metrics extended additively; no existing metric formulas modified | ✅ |
| Execution Contract §2.2 (Allowed Transitions) | 3 new transitions added; 14 existing transitions preserved | ✅ |
| Execution Contract §2.3 (Forbidden Transitions) | 3 new forbidden transitions added; 6 existing preserved | ✅ |
| Constitution §7 (Simplicity) | Configuration-only activation; no new modules or infrastructure | ✅ |
| ADR-008 (Lifecycle Declarations) | All new files have `@lifecycle ACTIVE` | ✅ |

---

## 6. Implementation Notes

This ADR requires the following implementation tasks:

1. **Create this document** (`docs/decisions/0016-debug-agent-activation.md`)
2. **Update `.kilo/kilo.jsonc`** — Remove `disable: true`, update description, replace prompt, fix `task: deny`
3. **Update `execution.contract.md`** — DAG, allowed/forbidden transitions, §4.8, §5
4. **Update Runtime Guard** — `types.ts` (add `'debug'` to `Agent`, `debug` to `RetryCount`, 3 new `AllowedTransition` variants), `index.ts` (transition array, phase map, forbidden set, retry counting), `guard.spec.ts` (4 new test blocks)
5. **Update ADR-ASK-001** — Remove deferred annotations from §2.2 and §2.4, remove §3 Negative #2
6. **Add evaluation metrics** — `computeDebugToCodeEscalationRate()` and `computeCodeRetryAfterDebugSuccessRate()` in `CodeEvaluatorService`

---

## 7. References

- ADR-ASK-001 — Agent Routing Governance Specification (`docs/decisions/ADR-ASK-001-agent-routing-governance.md`)
- ADR-015 — Runtime Verification Integration (`docs/decisions/0015-runtime-verification-post-verify.md`)
- ADR-003 — Agent Evaluation Harness v1 (`docs/decisions/003-agent-evaluation-harness-v1.md`)
- ADR-008 — Lifecycle Declarations (`docs/decisions/008-lifecycle-declarations.md`)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Constitution §7 — Simplicity (`docs/constitution.md`)
- `.kilo/kilo.jsonc` — Agent configuration
- `.kilo/guard/types.ts` — Guard runtime type definitions
- `.kilo/guard/index.ts` — Guard runtime implementation

---

**End of ADR-016**
