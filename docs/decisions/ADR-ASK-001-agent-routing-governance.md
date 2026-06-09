/* @lifecycle ACTIVE — ADR-ASK-001: Agent Routing Governance Specification */

# ADR-ASK-001 — Agent Routing Governance Specification

**Status:** Active
**Created:** 2026-06-09
**Author:** Architect Agent
**Supersedes:** None (inaugural ASK-series ADR)
**Superseded By:** None
**References:** ADR-001, ADR-002, ADR-003, ADR-010, ADR-012, Constitution §3 §7 §10, Execution Contract, Architecture L3 & L4

---

## 1. Context

The Floweng AI Software Factory routes all incoming requests through a `Router` agent (defined in `kilo.jsonc`). Separately, ADR-002 defines the `Ask` agent as a "Virtual CTO Advisor" with advisory-only, read-only permissions and an "Influence without Authority" constraint. The Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`) defines the state machine and transition rules for all agents — but does not define **routing governance**: the principles and rules governing WHO routes WHAT to WHOM, and under WHAT constraints.

Currently, the following governance gaps exist:

1. **No unified identity for ASK as a routing system.** Router (classification-only) and Ask (advisory-only) are defined in separate files without a shared governance contract, making the ASK layer appear as two disconnected agents rather than a cohesive Virtual CTO Router.

2. **Router prompt is monolithic and truncated.** The Router's prompt in `kilo.jsonc` exceeds 2,000 characters and is truncated, making the tail of its dispatch instruction non-functional. There is no standalone document declaring the Router's contract.

3. **No routing principles are declared as binding.** The Router prompt contains implicit routing logic (LEVEL_1 → Code, LEVEL_2 → Plan, LEVEL_3 → Plan) but does not declare the principles that constrain these decisions, making them unenforceable when drift occurs.

4. **No agent catalog with responsibility boundaries.** The 7 agents in `kilo.jsonc` (router, plan, architect, ask, code, pre_verify, post_verify) have overlapping responsibility descriptions. The Evaluation Harness (ADR-003) tracks `debugSuccess` but no Debug agent exists to perform defect resolution.

5. **No standardized routing output format.** The Router outputs JSON for classification but the Ask agent outputs freeform text. The ASK v2 system needs a uniform output contract across all routing decisions.

6. **No session management capability.** The current Router cannot determine whether a new session (worktree) should be created for a task — it always routes within the current session.

**This ADR is the foundation.** Without a routing governance specification, every routing matrix, state machine extension, and escalation rule that follows will be ad-hoc and disjointed. This ADR establishes the "source of truth" for ASK v2 routing behavior.

---

## 2. Decision

### 2.1 ASK v2 Identity: Virtual CTO Router

**ASK v2 is the unified routing + advisory gateway of the Floweng AI Software Factory.**

It comprises two agent types operating under a single governance contract:

| Component | Agent Type | Role | Permission Boundary |
|-----------|-----------|------|---------------------|
| **Router** | `router` | Classification + Dispatch | `task: allow`, all others: deny or read-only |
| **Ask** | `ask` | Explanation + Research + Advisory | `edit: deny`, `bash: deny`, `task: deny`, `todowrite: deny` |

Together they form the **Virtual CTO Router** — a system that:
- Classifies incoming requests by complexity, risk, and domain
- Routes tasks to the appropriate execution agent
- Provides advisory context for architectural and strategic decisions
- Maintains a decision registry (Recommendation Registry, ADR-002) as its authoritative memory
- Operates under a strict "Influence without Authority" constraint: ASK may advise, but may never decide, implement, or merge

**ASK v2 is NOT an execution agent.** It is the gateway — the single entry point that determines which agent (or agent chain) will handle a request. It never enters the execution pipeline itself.

### 2.2 Agent Catalog

The following 8 agents constitute the complete Floweng AI Software Factory agent catalog. Every agent has a single, unambiguous responsibility. No two agents share the same responsibility.

| # | Agent | ID | Responsibility | Layer | Can Dispatch? | Can Edit? |
|---|-------|----|---------------|-------|---------------|-----------|
| 1 | **Router** | `router` | **Classification only** — Determine request level (L1/L2/L3), route to next agent, decide session strategy. Never plans, architects, or implements. | L3 (Cognition) | Yes (to any agent) | No |
| 2 | **Ask** | `ask` | **Explain / Research** — Answer questions, explain architecture, research technologies, compare solutions. Advisory output only. Never implements, never routes. | L4 (Agent Registry) | No | No |
| 3 | **Architect** | `architect` | **Architecture governance** — ADR creation, schema review, infrastructure decisions, security and performance review, drift detection. Never implements features. | L6 (Engineering) | Yes (to Plan or PreVerify) | No |
| 4 | **Plan** | `plan` | **Task decomposition** — Break work into executable steps, identify dependencies and risks, produce execution plans. Never writes production code or creates ADRs. | L3 (Cognition) | Yes (to Architect or PreVerify) | No |
| 5 | **Pre Verify** | `pre_verify` | **Gate validation (before)** — Validate plan feasibility, completeness, constraint compliance, and lifecycle declarations. Never modifies code. | L6 (Engineering) | Yes (PASS/FLAG → Code, BLOCK → Architect) | No |
| 6 | **Code** | `code` | **Implementation** — Write production code, tests, refactoring, bug fixes. The only agent authorized to modify source files. | L6 (Engineering) | No (only PostVerify) | Yes |
| 7 | **Debug** | `debug` | **Defect resolution** — Diagnose and fix bugs after PostVerify FAIL or runtime errors. Separate from Code to avoid confirmation bias. Activated per ADR-016. Invoked by POST_VERIFY only (never routed by Router). | L7 (Reliability) | No (only PostVerify) | Yes |
| 8 | **Post Verify** | `post_verify` | **QA gate (after)** — Verify spec compliance, regression, edge cases, security, and lifecycle declarations. Never modifies code. | L6 (Engineering) | Yes (PASS/FLAG → Commit, FAIL → Code/Debug, BLOCK → Architect) | No |

**Responsibility Boundaries (invariant):**

- Only `Code` and `Debug` may modify source files (`edit: allow`)
- Only `Router` may classify and dispatch tasks (`task: allow` for routing)
- Only `Architect` may create ADRs
- Only `Plan` may decompose tasks into execution plans
- Only `PreVerify` and `PostVerify` may gate execution
- `Ask` has zero execution authority — it can only produce text output

### 2.3 Four Pillar Principles

These principles are **non-negotiable** and apply to the entire ASK v2 system (Router + Ask). Any violation of these principles is a governance incident.

#### Principle 1 — ASK Never Implements

> ASK v2 (Router + Ask) shall never write, modify, or generate production code, configuration, schema, or infrastructure.

**Rationale:** Separation of concerns (Constitution §3). The gateway cannot be the builder. If ASK could implement, there would be no independent verification of its routing decisions.

**Enforcement:** Router and Ask agents have `edit: deny` in `kilo.jsonc`. Any attempt to modify files is blocked at the tool permission level.

**Exception:** None. This is absolute.

#### Principle 2 — ASK Never Bypasses Gates

> ASK v2 shall never route a task directly to CODE or COMMIT without passing through the required verification gates (PRE_VERIFY and POST_VERIFY).

**Rationale:** The execution DAG (Constitution §10, Execution Contract §2) is mandatory. Bypassing gates eliminates quality assurance and creates unverified changes.

**Enforcement:** LEVEL_2 and LEVEL_3 tasks MUST route through PLAN → (optional ARCH) → PRE_VERIFY → CODE → POST_VERIFY → COMMIT. LEVEL_1 tasks route through CODE → POST_VERIFY (skip PLAN and PRE_VERIFY). ASK may never route directly to COMMIT under any level.

**Exception:** LEVEL_1 tasks may skip PLAN and PRE_VERIFY per Execution Contract §2.2, but POST_VERIFY is still required before COMMIT.

#### Principle 3 — ASK Never Merges

> ASK v2 shall never perform or authorize git merge, push to main, or any action that modifies the repository's commit history.

**Rationale:** Merge is a COMMIT-level terminal action (Execution Contract §4.7). COMMIT is immutable — once entered, no agent may transition out. ASK operates at the routing layer (before COMMIT) and has no visibility into or authority over the repository's final state.

**Enforcement:** Router and Ask agents have `bash: deny` in `kilo.jsonc`. Git operations are only available to Code and Debug agents (which may commit to worktree branches, not main).

**Exception:** None. This is absolute.

#### Principle 4 — ASK Always Returns a Single Next Agent

> Every ASK routing decision MUST produce exactly one next agent. Ambiguous, multi-target, or conditional routing ("try X, if fails then Y") is forbidden.

**Rationale:** The Execution Contract is a DAG, not a decision tree. Each transition has exactly one target. Conditional routing would create parallel execution paths that the state machine cannot model, leading to orphaned states and race conditions.

**Enforcement:** The Router output format (§2.5) requires exactly one `agent_mode` field. The Runtime Guard rejects any routing output with zero or multiple targets.

**Exception:** None. This is absolute.

### 2.4 Routing Decision Matrix

The Router SHALL determine the next agent based on the classification level and task domain. This matrix is the canonical routing table.

| Classification | Task Domain | Route To | Rationale |
|---------------|-------------|----------|-----------|
| **LEVEL_1** | Any (simple CRUD, DTO, validation, unit test, small refactor, scoped bug fix) | `code` | No planning or architecture review needed. Code handles implementation directly. |
| **LEVEL_2** | Feature-level (auth, payments, search, caching, multi-module, integrations) | `plan` | Requires task decomposition before implementation. Plan produces execution steps. |
| **LEVEL_3** | Architecture-level (schema, infra, framework, security, decomposition) | `plan` | Requires planning AND architecture review. Plan produces task breakdown; Architect reviews before PreVerify. |
| **LEVEL_3** | Architecture-only (ADR creation, drift analysis, technology evaluation — no code to write) | `architect` | No implementation needed. Architect handles analysis, produces ADR, routes to PreVerify if approved. |
| **N/A** | Explanation, research, Q&A, technology comparison | `ask` | Not an execution task. Ask responds with advisory output, no agent transition occurs. |
| **N/A** | Defect resolution (PostVerify FAIL → retry) | `code` (first, max 1) then `debug` (escalation after CODE retry exhausted) | Execution Contract §5. Code retries first (max 1); DEBUG is the escalation path when CODE retry is exhausted. Router never routes to DEBUG directly — only POST_VERIFY invokes DEBUG. |
| **N/A** | Clarification needed (confidence < 0.70) | *(Return to user)* | Router does NOT dispatch. Returns request for clarification. |

**LEVEL_1 bypass rules** (consistent with Execution Contract §2.2):
- LEVEL_1 tasks skip PLAN and PRE_VERIFY
- POST_VERIFY is still required before COMMIT
- If a LEVEL_1 task touches schema, infra, or security → reclassify as LEVEL_3

### 2.5 Standardized Routing Output Format

Every ASK v2 routing decision MUST produce output in the following format. This is the contract between ASK and the execution pipeline.

```text
New session?: YES/NO

Agent mode: <agent_id>

Task:
<task description or original request>
```

**Field specifications:**

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `New session?` | Yes | `YES` or `NO` | Whether the Runtime Guard should create a new worktree/session for this task. `YES` when the task is independent, long-running, or conflicts with the current session's scope. `NO` when the task continues or extends the current session. |
| `Agent mode` | Yes | `code`, `plan`, `architect`, `ask`, `debug`, `pre_verify`, `post_verify` | The single next agent to invoke. Must match exactly one agent ID from the catalog (§2.2). |
| `Task` | Yes | Free text | The task description forwarded to the target agent. May be the original request or a refined version from the Router. |

**Validation rules:**
1. `Agent mode` must resolve to a valid agent ID in the catalog
2. The target agent must be an allowed transition per the Execution Contract §2.2
3. `New session?: YES` must not appear when the current session is already LOCKED (Execution Contract §3)
4. Empty or missing `Task` field is a routing error — block and return to user for clarification

**Example (LEVEL_1 routing):**
```text
New session?: NO

Agent mode: code

Task:
Add input validation to the create-user.dto.ts file. Ensure email is validated with @IsEmail() and password has @MinLength(8).
```

**Example (LEVEL_2 routing):**
```text
New session?: YES

Agent mode: plan

Task:
Implement a password reset flow: email token generation, token verification endpoint, password update endpoint, email sending via SMTP. Must integrate with existing auth module.
```

**Example (Ask routing):**
```text
New session?: NO

Agent mode: ask

Task:
Compare PostgreSQL vs MongoDB for a learning platform with 10K users, complex relational data (courses → lessons → exercises → answers), and reporting requirements. Provide trade-off analysis with Reuse-First scoring.
```

### 2.6 Session Management Rules

The Router's `New session?` decision follows these rules:

| Condition | New session? | Rationale |
|-----------|-------------|-----------|
| Task is independent (no shared state with current work) | `YES` | Isolated worktree prevents conflicts |
| Task is a continuation/refinement of current session | `NO` | Same session preserves context |
| Task requires different agent than current | `YES` | Agent mode switching requires clean state |
| Current session is LOCKED (Execution Contract §3) | `NO` (forced) | Lock prevents new session creation |
| Task is LEVEL_3 architecture review | `YES` | Architecture work requires isolation |
| Task is a simple follow-up question | `NO` | Same session, low overhead |

**Override:** The Runtime Guard may override `New session?: YES` to `NO` if the execution lock is active or resource constraints prevent worktree creation.

### 2.7 ASK v2 Governance Architecture

```
                    ┌──────────────────────────────────┐
                    │         ASK v2 Gateway            │
                    │    (Virtual CTO Router Layer)     │
                    │                                   │
                    │  ┌─────────┐    ┌──────────────┐  │
                    │  │ Router  │◄──►│   Ask Agent  │  │
                    │  │(Classify│    │(Advise/Explain│  │
                    │  │+Route)  │    │  /Research)  │  │
                    │  └────┬────┘    └──────────────┘  │
                    │       │                            │
                    └───────┼────────────────────────────┘
                            │ Single next agent
                            ▼
              ┌─────────────────────────┐
              │   Execution Pipeline    │
              │  PLAN → ARCH → PRE →    │
              │  CODE → POST → COMMIT   │
              └─────────────────────────┘
```

ASK v2 lives **above** the execution pipeline. It governs routing INTO the pipeline but never enters it. Once a task is dispatched to the first execution agent, ASK v2's role is complete for that task. The Execution Contract governs all subsequent transitions.

### 2.8 Relationship to ADR-002

ADR-002 defines the **Ask agent** as a Virtual CTO Advisor — its advisory identity, evolution phases, and the Recommendation Registry as its memory. This ADR (ADR-ASK-001) defines the **ASK v2 system** — the routing governance layer comprising both Router and Ask.

**Boundary:**

| Concern | Governed By |
|---------|-------------|
| Ask agent's advisory responsibilities | ADR-002 |
| Ask agent's evolution phases (1-4) | ADR-002 |
| Ask agent's Reuse-First scoring | ADR-001 |
| Recommendation Registry schema & API | ADR-002 |
| Bayesian Trust Score formula | ADR-002 |
| **Routing decision rules** | **ADR-ASK-001** (this document) |
| **Router classification logic** | **ADR-ASK-001** |
| **Agent catalog** | **ADR-ASK-001** |
| **Output format** | **ADR-ASK-001** |
| **Session management** | **ADR-ASK-001** |
| **Transition mechanics** | Execution Contract |

ADR-002 and ADR-ASK-001 are complementary. ADR-002 answers "what does Ask do?"; ADR-ASK-001 answers "how does ASK v2 route?".

---

## 3. Consequences

### Positive

1. **Single source of truth for routing.** Every routing decision, agent transition, and output format is declared in one document. Future routing matrix extensions, escalation rules, and state machine improvements can reference this ADR as their foundation.

2. **Clear agent responsibility boundaries.** The 8-agent catalog eliminates ambiguity about which agent does what. No two agents share the same responsibility.

3. **Enforceable principles.** The 4 Pillar Principles create clear compliance criteria for PreVerify and PostVerify gates. A routing decision that violates "ASK never bypasses gates" can be detected and blocked.

4. **Standardized output format.** The tri-field output (`New session?` / `Agent mode` / `Task`) enables the Runtime Guard to parse routing decisions programmatically, reducing ambiguity in dispatch.

5. **Debug agent placeholder.** The agent catalog acknowledges the Debug agent's existence, aligning the architecture with the Evaluation Harness (ADR-003) which already tracks `debugSuccess`. This prevents the catalog from drifting from the evaluation metrics.

6. **Session management capability.** The `New session?` decision enables ASK v2 to determine worktree isolation strategy, which is essential for parallel task execution.

7. **Complementary to existing ADRs.** This ADR fills a gap (routing governance) without contradicting or duplicating ADR-001 (Reuse-First), ADR-002 (Ask identity), or the Execution Contract (transition mechanics).

### Negative

1. **kilo.jsonc fragmentation risk.** The Router prompt in `kilo.jsonc` currently embeds routing logic inline. This ADR becomes the source of truth, but `kilo.jsonc` may diverge if not updated. Mitigation: A follow-up task MUST update the Router prompt in `kilo.jsonc` to reference this ADR and derive its behavior from it. Until then, this ADR and `kilo.jsonc` serve as dual sources of truth — the ADR is authoritative per Source of Truth Hierarchy (Priority 2 > Priority 8).

2. **Output format adoption.** Existing tooling (Runtime Guard, kilo CLI) may not parse the standardized output format. Mitigation: The format is designed to be parseable by simple string matching (`New session?:`, `Agent mode:`, `Task:`). Adoption requires no code changes to the Runtime Guard — human mediators can interpret the format.

3. **Dual ADR series.** The ASK- prefix establishes a sub-series alongside the numeric ADR-001 through ADR-014 series. This introduces a naming convention change. Mitigation: The ADR index (`docs/decisions.md`) explicitly declares the ASK sub-series. Future ASK-related ADRs will use the ASK-XXX prefix, keeping them grouped.

### Neutral

1. **No code changes.** This ADR is a governance document — it does not modify `kilo.jsonc`, agent prompts, or the Runtime Guard. Implementation is deferred to follow-up tasks.

2. **No new technology.** This ADR introduces no new dependencies, frameworks, or infrastructure. It is a purely architectural decision.

3. **No schema changes.** The Recommendation Registry (ADR-002) already supports the data model needed for ASK v2. No Prisma migration is required.

---

## 4. Alternatives Considered

### A. Embed routing governance in the Execution Contract (no separate ADR)

**Rejected.** The Execution Contract defines the state machine — how agents transition. Routing governance defines who routes to whom and why. These are distinct concerns. Embedding routing rules in the Execution Contract would create a monolithic document that mixes horizontal (transition) and vertical (routing) concerns, making both harder to maintain.

### B. Unify Router and Ask into a single agent

**Rejected.** Router (classification + dispatch) and Ask (advisory + research) have fundamentally different permission boundaries: Router needs `task: allow` to dispatch; Ask must have `task: deny` per ADR-002 "Influence without Authority." A single agent with split permissions would be internally inconsistent — it would have authority to route but not to advise, or vice versa.

### C. Defer routing governance until Debug agent is implemented

**Rejected.** Routing governance is the foundation. Without it, the Debug agent's integration into the routing matrix would be ad-hoc. Better to define the catalog now and mark Debug as deferred, giving future implementers a clear target architecture.

### D. Use existing ADR numbering (ADR-015) instead of ASK- prefix

**Considered but rejected per task specification.** The task explicitly requests `ADR-ASK-001-agent-routing-governance.md`. The ASK- prefix establishes a logical sub-series for routing governance documents, which are distinct from product ADRs (001-014). This convention makes it easy to locate all ASK-related decisions.

### E. Allow ASK to route multiple agents simultaneously (fan-out)

**Rejected.** The Execution Contract is a DAG, not a parallel execution graph. Fan-out routing (e.g., "route to Code AND Architect") would create parallel execution paths that the state machine cannot model, leading to race conditions and merge conflicts. Single-next-agent routing (Principle 4) is the only safe pattern.

---

## 5. References

- ADR-001 — Reuse-First Governance Framework (`docs/decisions/001-reuse-first-governance.md`)
- ADR-002 — Ask Agent as Virtual CTO Advisor (`docs/decisions/002-ask-virtual-cto-advisor.md`)
- ADR-003 — Agent Evaluation Harness v1 (`docs/decisions/003-agent-evaluation-harness-v1.md`)
- ADR-010 — Model Intelligence Layer (`docs/decisions/010-model-intelligence.md`)
- ADR-012 — Context Manager Architecture (`docs/decisions/012-context-manager.md`)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Source of Truth Hierarchy (`.kilo/rules/system/contracts/source-of-truth.contract.md`)
- Constitution §3 (Architecture), §7 (Simplicity), §10 (Change Management)
- Architecture v1.0, Layer 3 (Cognition), Layer 4 (Agent Registry), Layer 6 (Engineering), Layer 7 (Reliability)
- Kilo Config: Agent Definitions (`.kilo/kilo.jsonc`)

---

**End of ADR-ASK-001**
