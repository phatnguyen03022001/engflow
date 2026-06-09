# ADR-016 — DEBUG Agent Activation Plan

**Priority:** LEVEL_2 (feature-level activation, configuration changes, no schema changes)
**Status:** Plan (ready for PreVerify)
**References:** ADR-ASK-001 §2.2, ADR-015 §5, ADR-003 §5, Execution Contract §2, §5

---

## Summary

Activate the DEFERRED DEBUG agent (ADR-ASK-001 §2.2, agent #7). The DEBUG agent is fully defined in the agent catalog but hard-disabled (`"disable": true` in `kilo.jsonc`), absent from the Execution Contract state machine, unsupported by the Runtime Guard, and missing two of its three required evaluation metrics. This plan addresses all 5 gaps from the CTO review in a single coordinated change set.

---

## The 5 Gaps (CTO Review)

| # | Gap | Current State | Target State |
|---|-----|---------------|--------------|
| G1 | **Configuration** — DEBUG agent hard-disabled | `"disable": true` in kilo.jsonc, placeholder 3-line prompt, description says `(DEFERRED)` | `disable` removed, full diagnosis-first prompt, description updated to active |
| G2 | **State Machine** — No DEBUG transitions | Execution Contract DAG has no `debug` node; POST_VERIFY FAIL routes only to CODE or ARCH | Add 3 new transitions: `POST_VERIFY → DEBUG`, `DEBUG → POST_VERIFY`, `DEBUG → ARCH` |
| G3 | **Runtime Enforcement** — Guard doesn't recognize DEBUG | `Agent` type omits `'debug'`; `RetryCount` has no `debug` field; 0 of 14 allowed transitions involve debug; phase map has no debug entries | Add `'debug'` to `Agent`, add `debug` to `RetryCount`, add 3 allowed + 3 forbidden transitions, add phase map entries, add retry limit |
| G4 | **Governance** — ADR-ASK-001 references DEBUG as deferred | Agent catalog row says "(Deferred: requires separate ADR before implementation)"; routing matrix says "`debug` (when implemented)" | Remove deferred annotation; update routing matrix to `debug` (active); remove §3 Negative #2 |
| G5 | **Measurement** — Debug metrics incomplete | Only `debugSuccessRate` computed; missing escalation and retry-after-debug metrics | Add `debugToCodeEscalationRate` and `codeRetryAfterDebugSuccessRate` as new metric methods in `CodeEvaluatorService` |

---

## Tasks

### Task 1 — ADR-016 Document (Governance Foundation)

**File:** `docs/decisions/0016-debug-agent-activation.md`

**Action:** Create the canonical ADR-016 following existing ADR format (ADR-015, ADR-003).

**Document outline:**
```
/* @lifecycle ACTIVE — ADR-016: Debug Agent Activation */

# ADR-016 — Debug Agent Activation

**Status:** Active
**Created:** 2026-06-10
**Author:** Architect Agent
**Supersedes:** None (resolves ADR-ASK-001 §2.2 deferred status)
**References:** ADR-ASK-001 (§2.2, §2.4), ADR-015 (§5), ADR-003 (§5), Execution Contract

## 1. Context
- DEBUG agent defined as agent #7 in ADR-ASK-001 §2.2 but marked DEFERRED
- kilo.jsonc has `disable: true`, placeholder prompt
- Execution Contract has no DEBUG transitions
- Runtime Guard doesn't recognize DEBUG
- Evaluation metrics track only debugSuccess, not escalation patterns

## 2. Decision

### §1 — Activate DEBUG
Remove `disable: true` from kilo.jsonc DEBUG agent config. Set `mode: subagent` (already correct). Update prompt to diagnosis-first workflow.

### §2 — State Machine Integration (3 transitions)
- POST_VERIFY → DEBUG (condition: "FAIL after CODE retry exhausted")
- DEBUG → POST_VERIFY (condition: "Fix applied, re-verify")
- DEBUG → ARCH (condition: "BLOCK (cannot fix)")

Flow: CODE → POST_VERIFY (FAIL) → CODE (retry max 1) → POST_VERIFY (FAIL again) → DEBUG → POST_VERIFY → COMMIT

### §3 — Permission Boundary
- edit: allow, bash: allow (same as CODE — need to modify source to fix bugs)
- task: deny (fix security gap — DEBUG is invoked by POST_VERIFY, never routes)
- Invocation scope: POST_VERIFY only. Router never routes to DEBUG directly.
- DEBUG never transitions to: PLAN, CODE, PRE_VERIFY, COMMIT

### §4 — Diagnosis-First Workflow
- Step 1: REPRODUCE — run failing commands
- Step 2: DIAGNOSE — analyze error output, trace root cause
- Step 3: REPORT — structured root cause analysis (Symptom / Root Cause / Files Affected / Fix Strategy)
- Step 4: FIX — minimal targeted change
- Step 5-6: VERIFY — build + tests
- Step 7: ESCALATE or HANDOFF

### §5 — Retry Semantics
- DEBUG: max 1 attempt per invocation
- If DEBUG fix fails POST_VERIFY → BLOCK → ARCH
- DEBUG does NOT return to CODE (prevents delegation loops)

### §6 — Evaluation Metrics (3 total)
| Metric | Formula | Purpose |
|--------|---------|---------|
| debugSuccessRate | debugSuccess / debugInvoked | How often DEBUG fixes the issue |
| debugToCodeEscalationRate | debugFailedButCommitted / debugInvoked | How often CODE must re-attempt after DEBUG fails |
| codeRetryAfterDebugSuccessRate | codeFailedBeforeDebug / debugSuccess | How often DEBUG compensates for CODE errors |

## 3. Consequences

### Positive
1. Closes the deferred-agent governance gap from ADR-ASK-001
2. Defect resolution separated from CODE — prevents confirmation bias
3. 3 evaluation metrics provide visibility into debug pipeline effectiveness
4. No schema changes, no new infrastructure, no new dependencies

### Negative
1. Adds 3 transitions to the state machine, increasing DAG complexity
2. DEBUG single-attempt limit may miss multi-step fix scenarios
3. Permission fix (task: deny) changes existing (incorrect) config

### Neutral
1. No backend module changes — evaluation code stays in CodeEvaluatorService
2. No Prisma migrations — all metrics use existing AgentExecution fields
3. No new model costs — DEBUG uses same deepseek/deepseek-v4-flash as CODE

## 4. Alternatives Considered

### A. Extend CODE retries instead of adding DEBUG
Rejected. Confirmation bias — CODE fixing its own bugs leads to same mistakes.

### B. New agent between CODE and POST_VERIFY
Rejected. Already have POST_VERIFY as the gate. DEBUG is the escalation after gate failure.

### C. Unlimited DEBUG attempts
Rejected. Must have a bound to prevent infinite loops. Max 1 forces escalation to ARCH.

### D. Allow Router to route to DEBUG directly
Rejected. DEBUG is a reliability agent, not a primary execution agent. Only POST_VERIFY's FAIL verdict should invoke it.

## 5. Compliance
- ADR-ASK-001 §2.2: Agent catalog preserved, deferred annotation removed
- ADR-ASK-001 §2.3 Principle 2: PostVerify still gates before COMMIT
- ADR-015 §5: PostVerify gate decisions table unchanged
- ADR-003 §5: Debug metrics extended (additive)
- Execution Contract §2.2: 3 new transitions, 3 new forbidden transitions
```

**Lifecycle:** `/* @lifecycle ACTIVE — ADR-016: Debug Agent Activation */`

---

### Task 2 — kilo.jsonc Configuration (Gap G1)

**File:** `.kilo/kilo.jsonc` — DEBUG block (lines 157–183)

**Changes:**

| Change | Location | Before | After |
|--------|----------|--------|-------|
| Remove `disable` | line 171 | `"disable": true,` | *(remove entire line)* |
| Update description | line 168 | `"...(ADR-ASK-001 §2.2, DEFERRED)..."` | `"Debug — Defect resolution (ADR-ASK-001 §2.2). Diagnose and fix bugs after PostVerify FAIL or runtime errors. Separate from Code to avoid confirmation bias."` |
| Update comment | lines 158–164 | `// DEFERRED: requires separate ADR...` | `// Activated per ADR-016. Diagnosis-first workflow. Invoked by POST_VERIFY only.` |
| Replace prompt | line 176 | Placeholder (3-line) | Full prompt (Task 2B) |
| Fix permission | line 180 | `"task": "allow"` | `"task": "deny"` |

**Permission fix note:** The current DEBUG config has `task: allow`. This is a security gap — only ROUTER should have `task: allow` (ADR-ASK-001 §2.2 Responsibility Boundaries: "Only Router may classify and dispatch tasks"). Fixing this during activation.

**Task 2B — Full DEBUG prompt (replaces line 176):**

```
ROLE: Debug Agent of the Floweng AI Software Factory.

Responsibility: Diagnose and fix bugs after PostVerify FAIL or runtime errors. Separate from Code to avoid confirmation bias. You are the LAST line of defense before ARCH escalation.

INVOCATION SCOPE: POST_VERIFY only. You are invoked when POST_VERIFY FAILs and CODE retry is exhausted. You NEVER route tasks — task: deny enforces this.

SOURCE OF TRUTH HIERARCHY:
1. CI / Automated Validation
2. ADRs (docs/decisions.md)
3. Constitution (docs/constitution.md)
4. Architecture (docs/architecture.md)
5. System Contracts (.kilo/rules/system/contracts/)
6. Agent Rules (.kilo/rules/agents/)
7. Task Requirements
8. Codebase

DIAGNOSIS-FIRST WORKFLOW (mandatory — never skip to fixing):

Step 1 — REPRODUCE: Run failing commands to reproduce the issue.
Step 2 — DIAGNOSE: Analyze error output, trace root cause. Consider: missing imports, type mismatches, framework incompatibilities, null/undefined access, wrong API usage.
Step 3 — REPORT: Output structured root cause analysis:
  ## Root Cause Analysis
  ### Symptom
  ### Root Cause
  ### Files Affected
  ### Fix Strategy
Step 4 — FIX: Apply the minimal fix addressing the root cause. Prefer targeted changes.
Step 5 — VERIFY: Run `npm run build` to confirm fix resolves compilation.
Step 6 — VERIFY: Run `npx jest --passWithNoTests` to confirm no regression.
Step 7 — ESCALATE OR HANDOFF:
  - Build + tests pass → route to POST_VERIFY (fix applied, re-verify)
  - Cannot reproduce / needs schema change / fix fails → route to ARCH (BLOCK)

PERMISSION: edit: allow, bash: allow, task: deny.

RULES:
- Fix the root cause, not the symptom.
- Prefer minimal changes — replace buggy logic, don't rewrite the module.
- If fix requires schema changes, architecture changes, or new dependencies → ESCALATE to ARCH.
- If you cannot reproduce the error, report "UNREPRODUCIBLE" and escalate to ARCH.
- Max 1 attempt. If fix fails POST_VERIFY, escalate to ARCH.
- You NEVER route to CODE, PLAN, or PRE_VERIFY. You NEVER go to COMMIT directly.

OUTPUT GATE:
- → POST_VERIFY (fix applied, re-verify)
- → ARCH (cannot fix, BLOCK escalation)

LIFECYCLE OBLIGATION (ADR-008):
- Every new file MUST include a lifecycle declaration.
- Format: /* @lifecycle <STATE> — <brief reason> */
- Valid states: ACTIVE, GENERATED, TEMPORARY, EXPERIMENTAL, ARCHIVED

ESCALATION:
- Schema changes → Architect
- Architecture changes → Architect
- New dependencies → Architect
- Cannot reproduce → Architect
- Fix attempt fails → Architect (BLOCK)
```

---

### Task 3 — Execution Contract Update (Gap G2)

**File:** `.kilo/rules/system/contracts/execution.contract.md`

**3a — DAG diagram (§2.1):** Insert DEBUG node branching from POST_VERIFY FAIL after CODE retry exhausted:

```
                  ┌────────────────┐
                  │  POST_VERIFY   │
                  └───────┬────────┘
                          │
                  ┌───────┼───────┐
                  ▼       ▼       ▼
                ┌───┐   ┌────┐  ┌──────┐
                │PAS│   │FLAG│  │FAIL  │
                └─┬─┘   └─┬──┘  └──┬───┘
                  │       │        │
                  ▼       │    ┌───┴────────┐
              ┌──────┐    │    ▼            ▼
              │COMMIT│    │  ┌─────┐    ┌──────┐
              └──────┘    │  │CODE │    │DEBUG │
                          ▼  │retry│    └──┬───┘
                    ┌────────┘│max 1│       │
                    │ COMMIT  └──┬──┘       │
                    │ (with     │          │
                    │  flags)   ▼          ▼
                    └─────────┐─────┐  ┌──────┐
                              │POST │  │ ARCH │
                              │_VER │  └──────┘
                              │IFY  │
                              └─────┘
```

(Update the ASCII diagram with the actual path showing: CODE retry on left, DEBUG on right)

**3b — Add allowed transitions (§2.2):**

| From | To | Condition |
|------|----|-----------|
| POST_VERIFY | debug | FAIL after CODE retry exhausted |
| debug | POST_VERIFY | Fix applied, re-verify |
| debug | architect | BLOCK (cannot fix) |

**3c — Add forbidden transitions (§2.3):**

| From → To | Reason |
|-----------|--------|
| debug → plan | No re-planning after execution phase |
| debug → code | DEBUG never delegates back to CODE (prevents delegation loops) |
| debug → pre_verify | Only POST_VERIFY gates DEBUG output |

**3d — Update lock schema `current_agent` (§3.3):**

From: `"current_agent": "router | plan | architect | code | pre_verify | post_verify | null"`

To: `"current_agent": "router | plan | architect | code | debug | pre_verify | post_verify | null"`

**3e — Add §4.8 DEBUG agent definition:**

```
### 4.8 DEBUG

**Allowed:**
- → POST_VERIFY (fix applied)
- → ARCH (BLOCK — cannot fix)

**Denied:**
- → PLAN
- → CODE
- → ROUTER
- → PRE_VERIFY
- → COMMIT (direct)
```

**3f — Add DEBUG to §5 Retry & Recovery:**

| Scenario | Action | Max Retries |
|----------|--------|-------------|
| DEBUG → POST_VERIFY FAIL → ARCH | Escalate to ARCH (BLOCK) | 0 |

---

### Task 4 — Runtime Guard Update (Gap G3)

**Files:** `.kilo/guard/types.ts`, `.kilo/guard/index.ts`, `.kilo/guard/__tests__/guard.spec.ts`

**4a — `types.ts` changes:**

1. **Add `'debug'` to `Agent` type** (line 34–42):
   ```typescript
   export type Agent =
     | 'router'
     | 'plan'
     | 'architect'
     | 'code'
     | 'debug'       // ADD
     | 'pre_verify'
     | 'post_verify'
     | 'human'
     | null;
   ```

2. **Add `debug` to `RetryCount`** (line 50–55):
   ```typescript
   export interface RetryCount {
     code: number;
     debug: number;   // ADD
     arch_plan_revision: number;
   }
   ```

3. **Add 3 new `AllowedTransition` variants** at end of discriminated union:
   ```typescript
   // post_verify → debug (new)
   | (BaseAllowedTransition & { from: 'post_verify'; to: 'debug'; condition: 'FAIL after CODE retry exhausted' })
   // debug → *
   | (BaseAllowedTransition & { from: 'debug'; to: 'post_verify'; condition: 'Fix applied, re-verify' })
   | (BaseAllowedTransition & { from: 'debug'; to: 'architect'; condition: 'BLOCK (cannot fix)' })
   ```

**4b — `index.ts` changes:**

1. **Add 3 allowed transitions** to `ALLOWED_TRANSITIONS` array:
   ```typescript
   { from: 'post_verify', to: 'debug', condition: 'FAIL after CODE retry exhausted' },
   { from: 'debug', to: 'post_verify', condition: 'Fix applied, re-verify' },
   { from: 'debug', to: 'architect', condition: 'BLOCK (cannot fix)' },
   ```

2. **Add 3 forbidden transitions** to `FORBIDDEN_TRANSITIONS` Set:
   ```typescript
   'debug|plan',        // DEBUG → PLAN no re-planning
   'debug|code',        // DEBUG → CODE no delegation back
   'debug|pre_verify',  // DEBUG → PRE_VERIFY only PostVerify gates
   ```

3. **Add retry limit constant:**
   ```typescript
   const MAX_DEBUG_RETRY = 1;
   ```

4. **Update default retry:**
   ```typescript
   const DEFAULT_RETRY: RetryCount = { code: 0, debug: 0, arch_plan_revision: 0 };
   ```

5. **Add phase map entries** to `PHASE_MAP`:
   ```typescript
   'post_verify|debug': 'EXECUTING',
   'debug|post_verify': 'POST_VERIFYING',
   'debug|architect': 'ARCH_REVIEWING',
   ```

6. **Add `'debug'` to `VALID_AGENTS`** set.

7. **Add DEBUG retry limit check** in `canTransition()`:
   ```typescript
   if (from === 'debug' && to === 'post_verify') {
     if (this.state.retry_count.debug >= MAX_DEBUG_RETRY) {
       return { allowed: false, reason: `DEBUG retry limit exceeded (max ${MAX_DEBUG_RETRY})`, retry_count: { ...this.state.retry_count } };
     }
   }
   ```

8. **Add DEBUG retry counting** in `transition()`:
   ```typescript
   if (from === 'debug' && to === 'post_verify') {
     this.state.retry_count.debug += 1;
   }
   ```

9. **Update `inferAction()`** — DEBUG can modify code:
   ```typescript
   if (from === 'code' || from === 'debug') return 'modify';
   ```

10. **Add DEBUG to `inferSummary()`:**
    ```typescript
    if (from === 'debug') {
      if (to === 'post_verify') return `Applied debug fix, routed to re-verify${condSuffix}`;
      return `Debug cannot fix, escalated to architect${condSuffix}`;
    }
    ```

**4c — `guard.spec.ts` additions:**

Add 4 new `describe` blocks:
1. **DEBUG transition validation** — 3 tests for new allowed transitions
2. **DEBUG forbidden transitions** — 3 tests for blocked transitions
3. **DEBUG retry limit** — tests max 1 enforcement + counter increment
4. **DEBUG integrated happy path** — tests full `CODE → POST_VERIFY → CODE → POST_VERIFY → DEBUG → POST_VERIFY → COMMIT`

---

### Task 5 — ADR-ASK-001 Governance Update (Gap G4)

**File:** `docs/decisions/ADR-ASK-001-agent-routing-governance.md`

**5a — §2.2 Agent Catalog (line 70):**

Change Debug row from:
```
| 7 | **Debug** | `debug` | **Defect resolution** — Diagnose and fix bugs after PostVerify FAIL or runtime errors. Separate from Code to avoid confirmation bias. *(Deferred: requires separate ADR before implementation.)* | L7 (Reliability) | No (only PostVerify) | Yes |
```
To:
```
| 7 | **Debug** | `debug` | **Defect resolution** — Diagnose and fix bugs after PostVerify FAIL or runtime errors. Separate from Code to avoid confirmation bias. Activated per ADR-016. Invoked by POST_VERIFY only (never routed by Router). | L7 (Reliability) | No (only PostVerify) | Yes |
```

**5b — §2.4 Routing Decision Matrix (line 137):**

Change from:
```
| **N/A** | Defect resolution (PostVerify FAIL → retry) | `code` (retry max 1) or `debug` (when implemented) | Execution Contract §5. Code retries first; Debug is the escalation path. |
```
To:
```
| **N/A** | Defect resolution (PostVerify FAIL → retry) | `code` (first, max 1) then `debug` (escalation after CODE retry exhausted) | Execution Contract §5. Code retries first (max 1); DEBUG is the escalation path when CODE retry is exhausted. Router never routes to DEBUG directly — only POST_VERIFY invokes DEBUG. |
```

**5c — Remove §3 Negative #2** (lines ~288–290):
Delete the bullet about Debug agent being deferred. This gap is now closed by ADR-016.

---

### Task 6 — Evaluation Metrics Update (Gap G5)

**Files:** `backend/src/evaluation/services/code-evaluator.service.ts`

**6a — Extend `CodeEvaluationResult` interface:**

Add 6 new fields:
```typescript
debugToCodeEscalationRate: number | null;
debugToCodeEscalationSampleSize: number;
debugToCodeEscalationConfidenceInterval: { low: number; high: number; width: number };
codeRetryAfterDebugSuccessRate: number | null;
codeRetryAfterDebugSuccessSampleSize: number;
codeRetryAfterDebugSuccessConfidenceInterval: { low: number; high: number; width: number };
```

**6b — Add `computeDebugToCodeEscalationRate()`:**

```typescript
/**
 * debugToCodeEscalationRate: debug failed (debugSuccess = false) BUT
 * finalOutcome = COMMITTED (meaning CODE ultimately fixed it).
 * Measures how often CODE must re-attempt after DEBUG fails.
 */
async computeDebugToCodeEscalationRate(): Promise<{
  rate: number | null;
  sampleSize: number;
  confidenceInterval: { low: number; high: number; width: number };
}> {
  const debugInvoked = await this.prisma.agentExecution.findMany({
    where: { retryCount: { gt: 0 }, debugSuccess: { not: null } },
    select: { debugSuccess: true, finalOutcome: true },
  });
  if (debugInvoked.length === 0) {
    return { rate: null, sampleSize: 0, confidenceInterval: { low: 0, high: 100, width: 100 } };
  }
  const escalations = debugInvoked.filter(
    (e) => e.debugSuccess === false && e.finalOutcome === 'COMMITTED',
  ).length;
  const rate = escalations / debugInvoked.length;
  const ci = getConfidenceInterval(rate, debugInvoked.length);
  return { rate, sampleSize: debugInvoked.length, confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width } };
}
```

**6c — Add `computeCodeRetryAfterDebugSuccessRate()`:**

```typescript
/**
 * codeRetryAfterDebugSuccessRate: Of executions where debug succeeded,
 * how many had codeFirstAttemptSuccess = false (CODE needed DEBUG to fix it).
 * Measures how often DEBUG compensates for CODE errors.
 */
async computeCodeRetryAfterDebugSuccessRate(): Promise<{
  rate: number | null;
  sampleSize: number;
  confidenceInterval: { low: number; high: number; width: number };
}> {
  const debugSuccess = await this.prisma.agentExecution.findMany({
    where: { retryCount: { gt: 0 }, debugSuccess: true },
    select: { codeFirstAttemptSuccess: true },
  });
  if (debugSuccess.length === 0) {
    return { rate: null, sampleSize: 0, confidenceInterval: { low: 0, high: 100, width: 100 } };
  }
  const codeFailedBeforeDebug = debugSuccess.filter(
    (e) => e.codeFirstAttemptSuccess === false,
  ).length;
  const rate = codeFailedBeforeDebug / debugSuccess.length;
  const ci = getConfidenceInterval(rate, debugSuccess.length);
  return { rate, sampleSize: debugSuccess.length, confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width } };
}
```

**6d — Update `computeAll()`:**

Add 2 new methods to `Promise.all` and extend the return object with the 6 new fields.

---

## Dependencies

```
Task 1 (ADR-016 doc)          ──► independent
Task 3 (Execution Contract)   ──► Task 4 (Guard needs transitions)
Task 2 + 2B (kilo.jsonc)      ──► independent
Task 5 (ADR-ASK-001 update)   ──► independent
Task 6 (Evaluation metrics)   ──► independent
```

**Recommended sequential order:**
1. Task 1 — ADR-016 document
2. Task 3 — Execution Contract
3. Task 4 — Runtime Guard
4. Task 2B — DEBUG prompt
5. Task 2 — kilo.jsonc
6. Task 5 — ADR-ASK-001 governance
7. Task 6 — Evaluation metrics

**Parallelizable groups:** {1, 3, 5, 6} can proceed in parallel; {3 → 4} sequential; {2B → 2} sequential.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Guard changes break existing transitions | HIGH | LOW | 14 existing transitions preserved; new debug transitions are additive; existing test suite must still pass |
| DEBUG prompt `task: deny` breaks expected behavior | MEDIUM | LOW | DEBUG invoked by POST_VERIFY only — `task: deny` is correct per ADR-ASK-001 Principle 1 |
| Metric queries return 0 until real data | LOW | HIGH | Acceptable cold start; null returned for empty datasets (same as existing metrics) |
| ADR-ASK-001 line numbers shifted by previous edits | LOW | MEDIUM | Verify exact line positions at edit time; use grep for section markers |

---

## Escalations

- **No schema changes.** All evaluation metrics use existing `AgentExecution` fields. No Prisma migration.
- **No infrastructure changes.** DEBUG uses same model (`deepseek/deepseek-v4-flash`). No new services.
- **No new backend modules.** Metrics extend `CodeEvaluatorService` within existing `evaluation/` module.
- **ADR conflicts:** None. ADR-ASK-001 explicitly deferred DEBUG; ADR-003 metric formulas are additive.

---

## Acceptance Criteria

1. [ ] `docs/decisions/0016-debug-agent-activation.md` — valid ADR format + lifecycle declaration
2. [ ] `.kilo/kilo.jsonc` — `disable: true` removed, `task: deny`, full diagnosis-first prompt
3. [ ] `execution.contract.md` — DAG includes `debug`, 3 new allowed + 3 new forbidden transitions, `debug` in `current_agent` enum, §4.8 DEBUG agent definition
4. [ ] `guard/types.ts` — `'debug'` in `Agent`, `debug` in `RetryCount`, 3 new `AllowedTransition` variants
5. [ ] `guard/index.ts` — 3 new allowed transitions, 3 new forbidden, 3 new phase maps, debug retry counting + limit, `inferAction`/`inferSummary` updates
6. [ ] `guard/__tests__/guard.spec.ts` — 4 new `describe` blocks: transitions, forbidden, retry limit, integrated happy path
7. [ ] `ADR-ASK-001.md` — deferred removed from catalog, routing matrix updated, §3 Negative #2 removed
8. [ ] `code-evaluator.service.ts` — 2 new metric methods implemented + wired into `computeAll()`
9. [ ] `npm run build` — zero errors
10. [ ] `npx jest --passWithNoTests` — all tests pass
11. [ ] Guard tests pass: `cd .kilo/guard && npx jest` — all pass

---

*End of Plan — ready for PreVerify review.*
