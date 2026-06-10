/* @lifecycle ACTIVE — ADR-ASK-002: 3-Layer Authority Model Specification */

# ADR-ASK-002 — 3-Layer Authority Model Specification

**Status:** Active
**Created:** 2026-06-10
**Author:** Architect Agent (Deep)
**Supersedes:** None
**Superseded By:** None
**References:** ADR-001, ADR-002, ADR-008, ADR-012, ADR-013, ADR-015, ADR-016, ADR-018, ADR-ASK-001, Constitution §1 §10, Execution Contract, Source of Truth Contract, Architecture L1 & L3

---

## 1. Context

The Floweng AI Software Factory distributes rules and policies across eight document categories (Constitution, ADRs, System Contracts, Agent Rules, Domain Rules, Quality Rules, Execution Rules, Performance Rules) and enforces them through a multi-agent execution pipeline (ROUTER → PLAN → ARCH → PRE_VERIFY → CODE → POST_VERIFY → COMMIT, with DEBUG as recovery per ADR-016).

Three distinct phases of authority currently operate implicitly:

1. **Definition** — Rules are written into documents by the Architect agent (ADR creation) or defined in the Constitution and System Contracts.
2. **Interpretation** — Agents consume rules via context assembly (ADR-012), classify tasks (Router), decompose work (Plan), and advise (Ask) based on their understanding of the defined rules.
3. **Execution** — Rules are enforced at runtime through verification gates (PRE_VERIFY, POST_VERIFY per ADR-015/ADR-018), the Runtime Guard state machine (Execution Contract §2), and drift detection (ADR-013).

**Current gap:** There is no formal model describing how authority cascades from Definition → Interpretation → Execution. Without this model:

- **Conflict resolution is undefined.** When a CODE agent interprets a rule differently than POST_VERIFY, there is no algorithm to determine which interpretation prevails.
- **Enforcement boundaries are undocumented.** It is unclear which execution stage is responsible for enforcing which rule layer.
- **Token budget degradation is unmodeled.** Context assembly budgets (ADR-012) can cause interpretation gaps — an agent may miss a rule because tokens were exhausted. The system has no model for when this causes authority failure.
- **Drift detection has incomplete authority coverage.** ADR-013 monitors code → architecture drift but does not monitor interpretation → definition drift (i.e., agents consistently misinterpreting a rule).

This ADR establishes the formal 3-layer authority model, maps enforcement to specific execution flow stages, defines the conflict resolution algorithm, and specifies token boundary implications per layer.

---

## 2. Decision

### 2.1 The Three Authority Layers

#### Layer 1 — Definition (Source of Truth)

**What it is:** The immutable written rules that constitute the governance foundation of the AI Software Factory. These are static documents stored as repository files.

**Components:**

| Source | File(s) | Authority Priority | Mutation |
|--------|---------|-------------------|----------|
| Constitution | `docs/constitution.md` | 3 | Requires ADR for amendment |
| ADRs | `docs/decisions/*.md` | 2 | Immutable once finalized; superseded by newer ADR |
| System Contracts | `.kilo/rules/system/contracts/*.md` | 5 | Follows execution pipeline |
| Agent Rules | `.kilo/rules/agents/*.md` | 6 | Follows execution pipeline |
| Domain Rules | `.kilo/rules/domain/*.md` | 6 (subordinate to Agent Rules) | Follows execution pipeline |
| Quality Rules | `.kilo/rules/quality/*.md` | 6 (subordinate to Agent Rules) | Follows execution pipeline |
| Execution Rules | `.kilo/rules/execution/*.md` | 6 (subordinate to Agent Rules) | Follows execution pipeline |
| Performance Rules | `.kilo/rules/performance/*.md` | 6 (subordinate to Agent Rules) | Follows execution pipeline |

**Authority:** The Definition layer is the **sole source of truth** per Constitution §1 ("Repository files are the single source of truth. Model memory is never authoritative."). No agent may create, enforce, or interpret a rule that does not derive from a Definition-layer document.

**Mutation gate:** Only the Architect agent may create or modify Definition-layer documents, and only through the ADR process (Constitution §8, Execution Contract §4.3). CODE agents may modify rule files ONLY when explicitly tasked to implement an approved ADR — never to create new rules independently.

**Token boundary:** Definition documents have no runtime token cost — they exist as files on disk. However, loading them into agent context windows incurs token cost at the Interpretation layer.

---

#### Layer 2 — Interpretation (Cognition)

**What it is:** How agents consume, understand, and apply the Definition layer. This is the cognitive processing layer where rules are translated from static text into actionable constraints.

**Components:**

| Component | Agent(s) | Function | ADR Reference |
|-----------|----------|----------|---------------|
| Context Assembly | ContextManagerService | Selects and loads relevant Definition documents into agent context windows | ADR-012 |
| Task Classification | Router | Interprets task against classification matrix, determines routing (L1/L2/L3) | ADR-ASK-001 §2.4 |
| Task Decomposition | Plan | Interprets requirements against constraints, produces execution plan | Execution Contract §4.2 |
| Advisory Interpretation | Ask | Interprets questions against Reuse-First framework, produces recommendations | ADR-001, ADR-002 |
| Architecture Analysis | Architect | Interprets system against ADRs, detects drift, produces architecture decisions | ADR-013 |

**Key mechanics:**

1. **Context assembly budget (ADR-012 §4):** Each agent receives a tiered token budget for context. Definition documents are included based on agent type and task level. If budget is insufficient, lower-priority rules may be excluded → interpretation gap.

2. **Interpretation fidelity:** An agent's interpretation quality depends on:
   - Which Definition documents were included in its context (budget-dependent)
   - The agent's own prompt fidelity to the Definition layer
   - Whether the agent has been explicitly instructed to reference a specific rule

3. **Interpretation drift:** Over time, an agent's interpretation may diverge from the Definition layer if:
   - Its prompt becomes stale (not updated after ADR changes)
   - It develops habitual patterns that contradict rules
   - Context assembly omits critical rules due to budget constraints

**Token boundary:** Interpretation is budget-constrained. Per ADR-012, context assembly uses a tiered strategy:
- Tier 0 (unconditional): System prompt, agent identity
- Tier 1 (agent-type): Rules relevant to the agent's role
- Tier 2 (task-type): Rules relevant to the specific task
- Tier 3 (optional): Supplementary context if budget remains

An agent operating with a Tier 1-only budget may miss Tier 2 rules → interpretation gap → potential authority failure.

---

#### Layer 3 — Execution (Enforcement)

**What it is:** Runtime enforcement of interpreted rules. This is where the system verifies that the Interpretation layer correctly applied the Definition layer, and where violations are detected and blocked.

**Components:**

| Component | Agent(s) | Function | ADR Reference |
|-----------|----------|----------|---------------|
| Pre-Verify Gate | PreVerify | Validates plan feasibility, completeness, and constraint compliance against Definition layer | ADR-015, ADR-018 |
| Code Implementation | Code | Self-enforces patterns and conventions during implementation | Agent Rules §1 |
| Post-Verify Gate | PostVerify | Runtime verification (build/lint/test) + spec compliance + security + lifecycle validation | ADR-015, ADR-018 |
| Runtime Guard | (System) | Enforces state machine transitions, prevents gate bypass, enforces execution lock | Execution Contract §2-§3 |
| Drift Detection | DriftDetectorService | Cron-based monitoring of architecture/policy compliance | ADR-013 |
| Defect Resolution | Debug | Diagnoses and fixes defects after PostVerify FAIL, with scope constrained by original spec | ADR-016 |

**Key mechanics:**

1. **Gate enforcement:** PRE_VERIFY and POST_VERIFY are the primary enforcement points. Each gate checks the output of a preceding stage against the Definition layer (via its Interpretation). A gate BLOCK or FAIL stops execution.

2. **Runtime Guard:** The state machine enforces the execution DAG. It prevents agents from transitioning to unauthorized states (e.g., CODE → COMMIT without POST_VERIFY). Guard violations escalate to HUMAN.

3. **Drift Detection:** ADR-013 monitors for post-hoc compliance. It detects when the codebase (Execution) has diverged from the architecture (Definition), even if gates passed at the time of change.

4. **Self-enforcement:** CODE and DEBUG agents are expected to self-enforce patterns and conventions during implementation. Gates provide independent verification.

**Token boundary:** Execution enforcement is token-budget-dependent:
- Shallow checks (lifecycle declaration presence, build/lint/test pass/fail) are cheap
- Deep checks (full code review, security analysis, architecture compliance) consume significant tokens
- POST_VERIFY's self-audit (ADR-018 §3.4) balances thoroughness against budget

---

### 2.2 Enforcement Boundary Map

Each execution flow stage is assigned enforcement responsibility for specific authority layers. This map defines **who enforces what, and at which authority layer the enforcement operates.**

| Execution Stage | Definition Responsibility | Interpretation Responsibility | Execution Responsibility |
|----------------|--------------------------|------------------------------|--------------------------|
| **ROUTER** | Reference ADR-ASK-001 routing matrix; reference Execution Contract for allowed transitions | Classify task (L1/L2/L3); determine single next agent; decide session strategy (New session?) | Dispatch to target agent; never enters execution pipeline itself |
| **PLAN** | Reference task requirements against Constitution §3 §7; reference Domain Rules for module patterns | Decompose work into executable steps; estimate complexity; identify dependencies and risks | Produce execution plan; never writes production code |
| **ARCH** | Create/modify Definition-layer documents (ADRs); review architecture against existing ADRs and constitution | Analyze architecture impact; detect drift; evaluate technology choices | Gate approval (approve → PRE_VERIFY, revise → PLAN, block → terminal BLOCK) |
| **PRE_VERIFY** | Validate plan against Constitution; check ADR compliance; verify lifecycle declarations (ADR-008) | Validate feasibility of plan; assess completeness and constraint compliance | Gate decision: PASS → CODE, FLAG → CODE (with concerns), BLOCK → ARCH |
| **CODE** | Read and apply Domain Rules (module patterns, Prisma conventions, DTO validation); follow Quality Rules | Apply patterns to implementation; self-enforce conventions; preserve existing behavior | Write production code and tests; the only agent authorized to modify source files |
| **POST_VERIFY** | Verify implementation against specs and contracts; validate lifecycle declarations; check Constitution compliance | Validate correctness of implementation; self-audit build/lint/test results | Gate decision: PASS → COMMIT, FLAG → COMMIT (with flags), FAIL → CODE (retry 1x) or DEBUG, BLOCK → ARCH |
| **DEBUG** | Reference original task specification; reference relevant ADRs for fix constraints | Diagnose root cause of failure; determine minimal fix scope | Fix defect; never expands scope beyond original specification |
| **COMMIT** | N/A (terminal state) | N/A | Write execution summary; mark task DONE; release execution lock |

**Enforcement invariants:**

1. **No stage may enforce a rule it does not reference.** A gate cannot BLOCK on a rule it did not check. All enforcement decisions must cite the specific Definition-layer document and clause.
2. **Execution cannot override Definition.** If CODE produces output that passes POST_VERIFY but later drift detection reveals a Definition violation, the code is non-compliant regardless of gate outcome.
3. **Interpretation is always budget-constrained.** No enforcement decision at the Execution layer can assume the Interpretation layer had unlimited context. Gaps in interpretation are a known risk, not a system failure.

---

### 2.3 Conflict Resolution Algorithm

When rules at different layers appear to conflict, or when two agents interpret the same rule differently, the following algorithm resolves the conflict:

```
┌─────────────────────────────────────────────────────────────────┐
│                  CONFLICT RESOLUTION ALGORITHM                  │
│                                                                 │
│  Step 1 — PRIORITY RESOLUTION                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Apply Source of Truth Hierarchy (Priority 1-8):          │   │
│  │   CI > ADRs > Constitution > Architecture >              │   │
│  │   System Contracts > Agent Rules >                       │   │
│  │   Task Requirements > Codebase                           │   │
│  │                                                          │   │
│  │ If conflict resolved → DONE                              │   │
│  │ If same priority → proceed to Step 2                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  Step 2 — SPECIFICITY RESOLUTION                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Within same priority tier, the more specific rule wins:  │   │
│  │   Module-specific rule > Domain rule > General rule      │   │
│  │                                                          │   │
│  │ Example: A domain rule saying "use IsEmail() on email    │   │
│  │ fields" overrides a general rule saying "use IsString()" │   │
│  │                                                          │   │
│  │ If conflict resolved → DONE                              │   │
│  │ If specificity equal → proceed to Step 3                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  Step 3 — TEMPORAL RESOLUTION                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Within ADRs: newer ADR supersedes older when the newer   │   │
│  │ ADR explicitly declares "Supersedes: ADR-XXX"            │   │
│  │                                                          │   │
│  │ If neither supersedes → proceed to Step 4                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  Step 4 — ESCALATION                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Unresolvable conflicts escalate to:                      │   │
│  │   1. Architect (if in execution pipeline)                │   │
│  │   2. Human (if Architect cannot resolve or is conflicted)│   │
│  │                                                          │   │
│  │ Escalation MUST include:                                 │   │
│  │   - Both conflicting rules (with citations)              │   │
│  │   - Why Steps 1-3 failed to resolve                     │   │
│  │   - Impact assessment of each resolution path            │   │
│  │                                                          │   │
│  │ Architect response: resolve OR propose ADR amendment     │   │
│  │ Human response: binding resolution                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Conflict resolution rules:**

1. **CI output is always final.** Per Source of Truth Hierarchy, CI/automated validation (Priority 1) overrides all other sources. If CI fails, no ADR, Constitution clause, or agent interpretation can override it.
2. **Model memory is never authoritative.** Per Constitution §1 and Source of Truth Contract, an agent's recollection of a rule does not constitute authority. The written Definition layer is the only valid reference.
3. **Ambiguity in Definition → Architect must clarify.** If a Definition-layer document is ambiguous (two valid interpretations), the Architect must issue an ADR amendment to resolve the ambiguity.
4. **Execution errors from interpretation gaps are NOT conflicts.** If POST_VERIFY detects a violation that CODE missed due to context budget constraints, this is an interpretation gap (risk), not a conflict. The fix is to improve context assembly, not to override the gate.

---

### 2.4 Token Boundary Implications Per Layer

Token budgets constrain each layer differently. This section defines the failure modes and guardrails.

#### Layer 1 — Definition

| Property | Value |
|----------|-------|
| Token cost at rest | Zero (files on disk) |
| Token cost when loaded | Proportional to document size; assembly cost per ADR-012 |
| Failure mode | N/A (Definition layer is source of truth; cannot "fail") |
| Guardrail | Documents must be kept concise; ADRs ≤ 200 lines recommended |

**Implication:** Definition documents have zero runtime cost but incur assembly cost when loaded. Large or verbose documents consume disproportionate budget, crowding out other rules. Keep Definition documents tight.

#### Layer 2 — Interpretation

| Property | Value |
|----------|-------|
| Token budget source | Context assembly tiers (ADR-012) |
| Failure mode | **Interpretation gap** — agent misses a rule because it was excluded from context due to budget constraints |
| Severity | Varies: missing Tier 3 rule (LOW) → missing Tier 1 rule (HIGH) |
| Detection | POST_VERIFY may detect rule violations that CODE missed; Drift Detection (ADR-013) may detect systematic interpretation gaps |
| Guardrail | Tier 0 (unconditional) must include all gate-critical rules; Tier 1 must include all agent-role-critical rules |

**Implication:** Interpretation gaps are the primary token-boundary risk. If a critical rule is budgeted at Tier 2 or 3 and the agent's budget is exhausted at Tier 1, the agent will operate without that rule → enforcement at the Execution layer must catch the resulting violations.

#### Layer 3 — Execution

| Property | Value |
|----------|-------|
| Token budget source | Per-agent execution budget (model-dependent) |
| Failure mode | **Shallow enforcement** — gate performs only cheap checks, missing deep violations |
| Severity | MEDIUM (deep checks are supplementary; cheap checks catch most violations) |
| Detection | Drift Detection (ADR-013) may catch violations missed by shallow gate checks |
| Guardrail | POST_VERIFY self-audit (ADR-018 §3.4) prioritizes checks by severity; critical checks run first |

**Implication:** Execution gates cannot perform unlimited-depth review. They must prioritize. The self-audit strategy in ADR-018 ensures that critical checks (build, lint, test) always run before budget is exhausted on deeper analysis.

#### Cross-Layer Token Flow

```
Definition (0 tokens)
    │
    │  Context Assembly (budgeted)
    ▼
Interpretation (token-constrained)
    │
    │  Agent output (plan, code, gate decision)
    ▼
Execution (token-constrained)
    │
    ▼
COMMIT (terminal)
```

**Critical path:** If Definition → Interpretation consumes excessive tokens (verbose documents), less budget remains for Interpretation → Execution (deep gate checks), creating a compounding quality degradation. Mitigation: Definition documents should be concise; Context Manager should prioritize critical rules.

---

### 2.5 Authority Violation Classification

Violations of the authority model are classified by which layer boundary was crossed:

| Violation | Layer Boundary | Example | Severity |
|-----------|---------------|---------|----------|
| **Definition override** | Execution overrides Definition | CODE ignores ADR-required pattern | HIGH — Block at POST_VERIFY |
| **Interpretation override** | Execution overrides Interpretation | Plan produces decomposition but CODE implements different scope | MEDIUM — Flag at POST_VERIFY |
| **Interpretation gap** | Interpretation misses Definition | Context assembly excludes critical rule due to budget | HIGH if critical rule missed — Improve context assembly |
| **Definition conflict** | Definition contradicts Definition | Two ADRs give conflicting guidance | HIGH — Escalate to Architect (Step 4) |
| **Execution bypass** | Agent skips enforcement | CODE attempts COMMIT without POST_VERIFY | CRITICAL — Runtime Guard blocks |
| **Interpretation drift** | Interpretation diverges from Definition over time | Agent prompt stale; habitual pattern contradicts newer ADR | MEDIUM — Detected by Drift Detection |

---

### 2.6 Relationship to Existing ADRs

| ADR | Relationship to ADR-ASK-002 |
|-----|---------------------------|
| **ADR-001** (Reuse-First Governance) | Definition-layer document governing ASK advisory output. The 3-layer model explains how ADR-001's rules cascade from definition through interpretation (Ask agent) to execution (recommendation validation). |
| **ADR-002** (Ask Virtual CTO Advisor) | Definition-layer document for Ask agent identity. The authority model constrains Ask to Interpretation layer only — Ask may interpret rules for advisory output but never enforce them. |
| **ADR-008** (Lifecycle Declarations) | Definition-layer document for file governance. The authority model explains how lifecycle rules are enforced at PRE_VERIFY and POST_VERIFY (Execution layer). |
| **ADR-012** (Context Manager) | Governs the Interpretation layer's token budget. The authority model defines how budget constraints create interpretation gaps and what guardrails mitigate them. |
| **ADR-013** (Drift Detection) | Governs cross-layer compliance monitoring at the Execution layer. The authority model defines which drift types map to which authority violations. |
| **ADR-015/018** (Runtime Verification) | Govern POST_VERIFY's Execution-layer enforcement. The authority model defines what POST_VERIFY checks and at what depth. |
| **ADR-016** (Debug Agent) | Governs DEBUG's Execution-layer enforcement scope. The authority model constrains DEBUG to fixing defects within original spec — no scope expansion. |
| **ADR-ASK-001** (Agent Routing Governance) | Governs the Router's Interpretation-layer decisions. ADR-ASK-001 defines *who routes to whom*; ADR-ASK-002 defines *how authority flows through* the routed pipeline. |

---

## 3. Consequences

### Positive

1. **Unambiguous conflict resolution.** The 4-step algorithm (Priority → Specificity → Temporal → Escalation) provides a deterministic path for every rule conflict. No more ad-hoc resolution.

2. **Clear enforcement ownership.** The Enforcement Boundary Map (§2.2) assigns every enforcement responsibility to a specific execution stage. POST_VERIFY knows exactly which rules it enforces; CODE knows which rules it self-enforces.

3. **Token budget risk model.** Token boundary implications (§2.4) make interpretation gaps a known, modeled risk rather than a silent failure mode. Context assembly can be tuned to prioritize critical rules.

4. **Drift detection coverage.** ADR-013 now has a taxonomy of authority violations (§2.5) to detect, extending its coverage from code→architecture drift to interpretation→definition drift.

5. **No new infrastructure.** The model formalizes existing behavior. No new modules, services, schemas, or technologies are required.

6. **Complements existing ADRs.** This ADR fills the vertical authority gap without contradicting or duplicating any existing ADR (§2.6 relationship map).

### Negative

1. **Conceptual overhead.** The 3-layer model adds terminology (Definition/Interpretation/Execution) that agents and humans must learn. Mitigated by: the model describes existing behavior; agents already operate within these layers implicitly.

2. **Enforcement of the model itself.** The authority model is a Definition-layer document. It must itself be enforced at the Execution layer — a self-referential problem. Mitigated by: the Runtime Guard and gate agents already enforce the execution DAG; this ADR adds specificity to their enforcement criteria.

3. **Context budget tension.** The model itself consumes Definition-layer tokens when loaded into agent context. Mitigated by: this ADR is concise; the model is referenced, not reloaded in full, by agents that need it.

### Neutral

1. **No code changes.** This ADR is a governance document. It does not modify source code, agent prompts, or infrastructure. Implementation (e.g., updating POST_VERIFY's enforcement checklist, adjusting context assembly tiers) is deferred to follow-up tasks.

2. **No schema changes.** No Prisma migration required.

3. **No new technology.** Purely architectural.

---

## 4. Alternatives Considered

### A. No formal authority model (status quo)

**Rejected.** The implicit model creates ambiguity about conflict resolution, enforcement boundaries, and token budget risks. As the agent pipeline grows (8 agents, 10 architecture layers), undocumented authority flow becomes a reliability risk.

### B. 2-layer model (Definition + Execution, collapse Interpretation into Execution)

**Rejected.** Interpretation (context assembly, task classification, plan decomposition) is a distinct cognitive phase with its own token budget constraints and failure modes. Collapsing it into Execution would obscure interpretation gaps as execution failures, making root cause analysis impossible.

### C. 4-layer model (Definition → Assembly → Interpretation → Execution)

**Rejected.** Splitting Assembly (context loading) from Interpretation (cognitive processing) adds granularity without adding enforcement value. Context assembly is a mechanic of the Interpretation layer, not an independent authority layer. The 3-layer model keeps the structure simple and mappable to execution stages.

### D. Embed authority model in Execution Contract

**Rejected.** The Execution Contract governs state transitions (horizontal). The authority model governs rule cascading (vertical). These are orthogonal concerns. Embedding them in one document would create a monolithic contract that mixes horizontal and vertical concerns.

### E. Machine-enforce the conflict resolution algorithm

**Considered but deferred.** A service that parses conflicting rules and auto-resolves per the algorithm would reduce human escalation. However, rule text is natural language — reliable machine parsing is a hard NLP problem. Deferred until the system has sufficient training data from human-escalated conflicts to automate common patterns.

---

## 5. References

- ADR-001 — Reuse-First Governance Framework (`docs/decisions/001-reuse-first-governance.md`)
- ADR-002 — Ask Agent as Virtual CTO Advisor (`docs/decisions/002-ask-virtual-cto-advisor.md`)
- ADR-008 — Lifecycle Declarations (`docs/decisions/008-lifecycle-declarations.md`)
- ADR-012 — Context Manager Architecture (`docs/decisions/012-context-manager.md`)
- ADR-013 — Drift Detection Mechanism (`docs/decisions/013-drift-detection.md`)
- ADR-015 — Runtime Verification Integration (`docs/decisions/0015-runtime-verification-post-verify.md`)
- ADR-016 — Debug Agent Activation (`docs/decisions/0016-debug-agent-activation.md`)
- ADR-018 — Restore POST_VERIFY Runtime Verification (`docs/decisions/0018-restore-post-verify-verification.md`)
- ADR-ASK-001 — Agent Routing Governance (`docs/decisions/ADR-ASK-001-agent-routing-governance.md`)
- Constitution §1 (Source of Truth), §10 (Change Management)
- Execution Contract (`.kilo/rules/system/contracts/execution.contract.md`)
- Source of Truth Contract (`.kilo/rules/system/contracts/source-of-truth.contract.md`)
- Architecture v1.0, Layer 1 (Governance), Layer 3 (Cognition)

---

**End of ADR-ASK-002**