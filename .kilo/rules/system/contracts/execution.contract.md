/* @lifecycle ACTIVE — Execution Contract: State Machine & Flow Control */
/* @tags all */

# Execution Contract

## 1. Purpose
<!-- @agent: all — This contract governs all agent transitions, execution lock semantics, and terminal states. All agents must understand the state machine they operate within. -->

Defines the canonical execution state machine for Floweng AI Software Factory.
This contract governs all agent transitions, execution lock semantics, and terminal states.

---

## 2. State Machine
<!-- @agent: all — Defines the canonical DAG, transition table, and forbidden transitions. Every agent references this section to understand allowed/forbidden routing. -->

### 2.1 Valid Transitions (DAG)

```
                  ┌──────────┐
                  │  REQUEST │
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │  ROUTER  │
                  └────┬─────┘
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
        ┌─────────┐ ┌──────┐ ┌──────────┐
        │  PLAN   │ │ CODE │ │  ARCH    │
        │(L2/L3)  │ │ (L1) │ │  (L3)    │
        └────┬────┘ └──┬───┘ └────┬─────┘
             │         │          │
             ▼         │          ▼
        ┌─────────┐    │    ┌──────────┐
        │  ARCH   │    │    │  PLAN    │
        │(opt)    │    │    │(revision)│
        └────┬────┘    │    └────┬─────┘
             │         │         │
             ▼         │         ▼
        ┌──────────────┼──────────────┐
        │  PRE_VERIFY  │◄─────────────┘
        └──────┬───────┘
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
   ┌──────┐ ┌──────┐ ┌────────┐
   │PASS  │ │FLAG  │ │ BLOCK  │
   └──┬───┘ └──┬───┘ └───┬────┘
      │        │         │
      ▼        │         ▼
  ┌──────┐     │    ┌──────────┐
  │ CODE │     │    │  ARCH    │
  └──┬───┘     │    └──────────┘
     │         │
     ▼         ▼
  ┌────────────────┐
  │  POST_VERIFY   │
  └───────┬────────┘
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
  ┌───┐ ┌────┐ ┌──────┐
  │PAS│ │FLAG│ │FAIL  │
  └─┬─┘ └─┬──┘ └──┬───┘
    │     │       │
    ▼     │    ┌──┴──────────┐
┌──────┐  │    ▼             ▼
│COMMIT│  │ ┌──────┐   ┌──────────┐
└──────┘  │ │ CODE │   │  DEBUG   │
          │ │(retry│   │(escalate │
          │ │ max 1)│   │ after    │
          │ └──┬───┘   │ CODE     │
          ▼    │       │ retry    │
    ┌──────────┘       │ exhaust) │
    │  COMMIT  │       └────┬─────┘
    │ (with    │            │
    │  flags)  │       ┌────┴────┐
    └──────────┘       ▼         ▼
                 ┌────────┐ ┌──────────┐
                 │  POST  │ │  ARCH    │
                 │ _VERIFY│ │ (BLOCK)  │
                 └────────┘ └──────────┘
```

### 2.2 Allowed Transitions
<!-- @agent: all — Table of 17 allowed transitions. Agents: reference this when routing or transitioning. -->

| From | To | Condition |
|------|----|-----------|
| REQUEST | ROUTER | Always |
| ROUTER | PLAN | LEVEL_2 or LEVEL_3 |
| ROUTER | CODE | LEVEL_1, simple implementation |
| ROUTER | ARCH | LEVEL_3, architecture-only |
| PLAN | ARCH | Architecture review needed |
| PLAN | PRE_VERIFY | No architecture issues |
| ARCH | PLAN | Revision needed (max 1) |
| ARCH | PRE_VERIFY | Architecture approved |
| PRE_VERIFY | CODE | PASS or FLAG |
| PRE_VERIFY | ARCH | BLOCK |
| CODE | POST_VERIFY | Implementation complete |
| POST_VERIFY | COMMIT | PASS or FLAG |
| POST_VERIFY | CODE | FAIL (max 1 retry) |
| POST_VERIFY | debug | FAIL after CODE retry exhausted |
| POST_VERIFY | ARCH | BLOCK |
| debug | POST_VERIFY | Fix applied, re-verify |
| debug | ARCH | BLOCK (cannot fix) |

### 2.3 Forbidden Transitions
<!-- @agent: all — Forbidden transitions that must never occur. Guard enforces these at runtime. -->

| From → To | Reason |
|-----------|--------|
| Any → PLAN | After PLAN finalized, no re-planning |
| CODE → PLAN | Single-pass execution |
| POST_VERIFY → PLAN | Execution complete |
| ROUTER → ROUTER | No re-routing |
| PLAN → PLAN | No re-plan loop |
| CODE → CODE | No self-loop (except retry from POST_VERIFY) |
| debug → plan | No re-planning after execution phase |
| debug → code | DEBUG never delegates back to CODE (prevents delegation loops) |
| debug → pre_verify | Only POST_VERIFY gates DEBUG output |

---

## 3. Execution Lock
<!-- @agent: guard, plan, architect, code, debug — Execution lock governs when state mutations are frozen. Relevant for all agents that participate in locked execution. -->

### 3.1 Lock States

```
LOCKED state: PLAN is frozen, No re-planning allowed,
Only execution agents can proceed, ROUTER is disabled
```

### 3.2 Lock Activation

Lock activates on "plan → pre_verify" (first transition OUT of planning).

### 3.3 Lock Schema

```json
{
  "execution_id": "uuid-v7",
  "state": "IDLE | ROUTING | PLANNING | LOCKED | EXECUTING | VERIFYING | COMMITTED | BLOCKED",
  "phase": "IDLE | ROUTING | PLANNING | ARCH_REVIEWING | PRE_VERIFYING | EXECUTING | POST_VERIFYING | COMMITTED | BLOCKED",
  "plan_hash": "sha256 | null",
  "current_agent": "router | plan | architect | code | debug | pre_verify | post_verify | null",
  "hop_count": 0,
  "locked": false,
  "timestamp": "ISO-8601",
  "retry_count": { "code": 0, "arch_plan_revision": 0 }
}
```

---

## 4. Agent Definitions
<!-- @agent: all — Each subsection defines one agent's allowed and denied transitions. Agents reference their own definition. -->

### 4.1 ROUTER

**Allowed:**
- → PLAN
- → CODE (if LEVEL_1 and no planning required)
- → ARCH (if LEVEL_3 architecture-only)

**Denied:**
- Any backward transition
- Re-entry after PLAN

### 4.2 PLAN

**Allowed:**
- → ARCH (if architecture review needed)
- → PRE_VERIFY (if no architecture issues)

**Denied:**
- → CODE directly
- Any backward transition

### 4.3 ARCH

**Allowed:**
- → PLAN (revision, max 1)
- → PRE_VERIFY (approve)
- → BLOCK (terminal)

### 4.4 PRE_VERIFY

**Allowed:**
- PASS → CODE
- FLAG → CODE (with documented concerns)
- BLOCK → ARCH

### 4.5 CODE

**Allowed:**
- → POST_VERIFY

**Denied:**
- → PLAN
- → ARCH
- → ROUTER

### 4.6 POST_VERIFY

**Allowed:**
- PASS → COMMIT
- FLAG → COMMIT (with documented concerns)
- FAIL → CODE (retry, max 1)
- FAIL → debug (after CODE retry exhausted)
- BLOCK → ARCH

### 4.7 COMMIT

**Actions:**
- Mark task as DONE
- Write execution summary
- Release execution lock
- Set state to COMMITTED

**Immutability:**
- No transitions out of COMMIT
- COMMIT is terminal

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

---

## 5. Retry & Recovery
<!-- @agent: all — Retry limits and recovery paths. Code, debug, architect, and guard agents must respect these limits. -->

| Scenario | Action | Max Retries |
|----------|--------|-------------|
| CODE → POST_VERIFY FAIL | Return to CODE | 1 |
| ARCH → PLAN revision | Return to PLAN | 1 |
| DEBUG → POST_VERIFY FAIL → ARCH | Escalate to ARCH (BLOCK) | 0 |
| Runtime error during CODE | Auto-retry | 2 |
| Guard violation | Block + HUMAN | 0 |

---

## 6. Escalation
<!-- @agent: all — Escalation paths for blocked or security-sensitive transitions. All agents escalate to architect or human as specified. -->

- PreVerify BLOCK → ARCH
- PostVerify BLOCK → ARCH
- Runtime Guard violation → HUMAN
- Architecture conflict → HUMAN
- Security issue → HUMAN

