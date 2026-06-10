# Plan: Enhance Router Agent Prompt in `kilo.jsonc`

## Summary

Add two missing sections to the Router agent's prompt in `.kilo/kilo.jsonc`:
1. **AgentMemory Context (TASK-30E)** — a `.kilo/helpers/memory-context` invocation line before routing, following the established pattern from PLAN, CODE, ASK, and ARCHITECT agents.
2. **Session Management Rules decision table** — an explicit inline table from ADR-ASK-001 §2.6 with conditions and `YES`/`NO`/`NO (forced)` outcomes for the `New session?` field.

---

## Tasks

### Task 1 — Add AgentMemory Context (TASK-30E) block

**File:** `.kilo/kilo.jsonc` — Router agent's `"prompt"` string (line 51)

**Current state (end of prompt):**
```
\n— Context Mgr (ADR-012) —\nPer ADR-012, call POST /api/v1/memory/context/assemble before routing."
```

**Action:** Insert a new `— AgentMemory Context (TASK-30E) —` block **after** the Context Mgr (ADR-012) block and **before** the closing `"` of the prompt string.

**Exact text to insert:**
```
\n\n— AgentMemory Context (TASK-30E) —\nBefore routing, call .kilo/helpers/memory-context --agent-type ROUTER --task-type <LEVEL> to check relevant patterns from past routing decisions. Pay attention to misclassification patterns and routing errors to avoid repeating previous mistakes.
```

**Pattern rationale** (references from existing agents):
| Agent | Pattern |
|-------|---------|
| PLAN (line 73) | `— AgentMemory (TASK-30E) —\nCall .kilo/helpers/memory-context --agent-type PLAN --task-type <TASK_LEVEL> for past patterns.` |
| CODE (line 225) | `— AgentMemory Context (TASK-30E) —\nBefore implementing, you SHOULD call '.kilo/helpers/memory-context --agent-type CODE --task-type <TASK_LEVEL>' ...` |
| ASK (line 149) | `— AgentMemory Context (TASK-30E) —\nBefore answering, you SHOULD call '.kilo/helpers/memory-context --agent-type ASK --task-type ADVISORY' ...` |
| ARCHITECT (line 98) | `— AgentMemory (TASK-30E) —\nCall .kilo/helpers/memory-context --agent-type ARCHITECT --task-type <TASK_LEVEL> for past patterns.` |

The Router variant follows the ASK/CODE style (more descriptive, with `--agent-type ROUTER` and `--task-type <LEVEL>`) since the Router also performs a classification/decision task.

**Verification:** After change, the end of the Router prompt string should be:
```
\n— Context Mgr (ADR-012) —\nPer ADR-012, call POST /api/v1/memory/context/assemble before routing.\n\n— AgentMemory Context (TASK-30E) —\nBefore routing, call .kilo/helpers/memory-context --agent-type ROUTER --task-type <LEVEL> to check relevant patterns from past routing decisions. Pay attention to misclassification patterns and routing errors to avoid repeating previous mistakes."
```

---

### Task 2 — Add Session Management Rules decision table

**File:** `.kilo/kilo.jsonc` — Router agent's `"prompt"` string (line 51)

**Location:** Insert between the **ROUTING SUMMARY** section and the **ARCHITECT DEEP DETECTION** section, as a new standalone section.

**Current text before insertion point:**
```
\n- Confidence < 0.70 → do NOT route, return to user for clarification\n- Security/schema/infra → always LEVEL_3\n\nARCHITECT DEEP DETECTION:\nIf task mentions: ADR, schema change, migration, security, infrastructure, service decomposition, framework migration → route to architect-deep\nOtherwise, for simple architecture review → route to architect-quick
```

**Action:** Insert the decision table from ADR-ASK-001 §2.6 between the ROUTING SUMMARY list and the ARCHITECT DEEP DETECTION heading.

**Exact text to insert:**
```
\n\nSESSION MANAGEMENT RULES (§2.6):\n| Condition | New session? |\n|-----------|-------------|\n| Task is independent (no shared state with current work) | YES |\n| Task is a continuation/refinement of current session | NO |\n| Task requires different agent than current | YES |\n| Current session is LOCKED (Execution Contract §3) | NO (forced) |\n| Task is LEVEL_3 architecture review | YES |\n| Task is a simple follow-up question | NO |\n\nOVERRIDE: The Runtime Guard may override YES to NO if execution lock is active or resource constraints prevent worktree creation.
```

**Verification:** After change, the sequence between ROUTING SUMMARY and ARCHITECT DEEP DETECTION should be:
```
\n- Security/schema/infra → always LEVEL_3\n\nSESSION MANAGEMENT RULES (§2.6):\n| Condition | New session? |\n|-----------|-------------|\n| Task is independent (no shared state with current work) | YES |\n| Task is a continuation/refinement of current session | NO |\n| Task requires different agent than current | YES |\n| Current session is LOCKED (Execution Contract §3) | NO (forced) |\n| Task is LEVEL_3 architecture review | YES |\n| Task is a simple follow-up question | NO |\n\nOVERRIDE: The Runtime Guard may override YES to NO if execution lock is active or resource constraints prevent worktree creation.\n\nARCHITECT DEEP DETECTION:\n...
```

**Note:** The existing PROCESS section already says "3. Decide New session? per §2.6 Session Management Rules" — this task adds the actual table inline so the Router has explicit conditions without needing to cross-reference an external document.

---

## Dependencies

| Task | Depends On | Description |
|------|-----------|-------------|
| Task 1 | None | AgentMemory block is independent |
| Task 2 | None | Session Management table is independent |

Both tasks can be implemented in a single edit to the `"prompt"` string since they modify the same file and the same field.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| JSONC formatting breakage | Low | High | Use the Edit tool with precise line anchoring; verify string bracketing after edit |
| Escape sequence errors in `\n` | Low | Medium | Double-check the concatenated prompt string — every `\n` must be properly escaped in the JSONC string value |
| Prompt truncation | Low | Medium | Current prompt is ~1,900 chars; adding ~600 chars keeps it under 2,500 — verify it stays under kilo truncation limit (~3,000 chars safe) |

---

## Escalations

None. This is a straightforward prompt text modification within a single configuration file. No schema, infrastructure, security, or ADR changes are required.

---

## Acceptance Criteria

1. **AgentMemory block present:** The Router prompt contains `— AgentMemory Context (TASK-30E) —` followed by a `.kilo/helpers/memory-context --agent-type ROUTER --task-type <LEVEL>` invocation.
2. **Session Management table present:** The Router prompt contains a table with all 6 rows from ADR-ASK-001 §2.6 plus the OVERRIDE note.
3. **File is valid JSONC:** The file can be read by a JSONC-aware parser without syntax errors.
4. **No regression:** Existing Router prompt content (ROLE, PROCESS, OUTPUT CONTRACT, ROUTING SUMMARY, ARCHITECT DEEP DETECTION, Context Mgr block) is preserved unchanged.
