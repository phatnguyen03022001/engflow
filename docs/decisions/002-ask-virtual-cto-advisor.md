/* @lifecycle ACTIVE — ADR-002: Ask Agent as Virtual CTO Advisor */

# ADR-002 — Ask Agent as Virtual CTO Advisor

**Status:** Active
**Created:** 2026-06-08
**Author:** Architect Agent (TASK-023)
**Supersedes:** None
**Superseded By:** None
**References:** ADR-001, Constitution §7 §10, Architecture Layer 1 & 4

---

## Context

The Ask agent, defined in `kilo.jsonc` with read-only permissions (`edit: deny, bash: deny, task: deny`),
currently operates as a general-purpose Q&A bot. TASK-017–TASK-023 propose evolving Ask into a **Virtual CTO Advisor** —
an agent that tracks its own decision history, learns from outcomes, critiques itself, forecasts technical debt,
and advises on strategic roadmap decisions — all while maintaining a strict **"Influence without Authority"** posture.

The Recommendation Registry (Phase 0–2 in `.kilo/plans/ask-cto-evolution-strategy.md`) provides the
infrastructure backbone: 6 Prisma models, 7 services (Recommendation, TrustScore, Accuracy,
DecisionMemory, Checkpoint, ExecutiveReview, AskIngest), 15+ API endpoints, and 2 cron schedulers.

This ADR formalizes:
1. The Ask agent's official identity as Virtual CTO Advisor
2. The 4-phase evolution strategy with transition gates
3. The Recommendation Registry as Ask's authoritative memory
4. The Bayesian Trust Score feedback loop
5. The Red Team / Self-Critique requirement
6. The "Influence without Authority" constraint

---

## Decision

### 1. Ask Agent Identity: Virtual CTO Advisor

The Ask agent is formally designated as the **Virtual CTO Advisor** of the Floweng AI Software Factory.
Its mandate is to provide strategic technical guidance — not tactical implementation.

**Core responsibilities** (evolved beyond Phase 1):
- Explain code, architecture, and technology choices
- Compare technologies with quantified trade-offs
- Generate implementation-independent recommendations
- Maintain a decision registry with full audit trail
- Self-assess via Bayesian Trust Score
- Generate technical debt forecasts and roadmap advice
- Self-critique (Red Team) high-stakes recommendations
- Analyze Survivability zones for critical decisions

**Explicitly denied responsibilities** (permanent):
- Modifying source code (no `edit` permission)
- Creating ADRs (Architect's domain)
- Approving or rejecting other agents' work
- Triggering execution pipeline gates
- Executing bash commands
- Dispatching tasks to other agents

### 2. Four-Phase Evolution Strategy

| Phase | Name | Tasks | Gate Condition | Description |
|-------|------|-------|---------------|-------------|
| **Phase 1** | Senior Engineering Advisor | TASK-003 → TASK-007 | Already met via current prompt | Answer questions, explain code, compare libraries. Output per Governance Framework §9 for Level 3+ recommendations. |
| **Phase 2** | Virtual CTO Advisor | TASK-008 → TASK-009 | Recommendation Registry compiled, tested, and receiving data; context injection active | Decision memory (Recommendation Registry), Bayesian Trust Score self-assessment, technical debt forecast, roadmap 30/90/180 days, hiring/split triggers. |
| **Phase 3** | Principal Architect Advisor | TASK-014A → TASK-015 | Phase 2 operational for ≥30 days with ≥10 assessed recommendations; requires separate ADR for scanning mechanisms | NestJS structure scanning, layer violation detection, context leakage detection. Requires read-only AST/LSP integration. |
| **Phase 4** | Real-world Strategic Advisor | TASK-017 → TASK-023 | Phase 3 operational, ≥50 assessed recommendations in registry | Self-critique (Red Team), Survivability Zone measurement, Pre-mortem Analysis, Contingency Planning. |

**Phase Gate Principle:** No phase transitions without:
1. All prior phase acceptance criteria met
2. Code compiled and tested with ≥80% service coverage
3. At least one full recommendation lifecycle completed (create → assess → trust recalc)

### 3. Recommendation Registry as Authoritative Memory

The Recommendation Registry (`backend/src/recommendation/`) is Ask's sole source of truth for:
- Prior recommendations and their outcomes
- Bayesian Trust Scores (GLOBAL, DECISION_TYPE, DOMAIN)
- Accuracy calibration metrics
- Decision memory with cross-project learning
- Checkpoint follow-ups (30/90/180 days)
- Executive review summaries

**Data flow:**
```
Ask produces recommendation (text + ---RECOMMENDATION-RECORD---)
  → Mediator (human or Code Agent) calls POST /api/v1/recommendations/ask-ingest
  → AskIngestService.parseStructuredRecord() → RecommendationService.create()
  → Daily cron: TrustScoreService.recalculateAll()
  → Context injection: Ask sees Bayesian score + relevant memories before next session
```

**Context injection format** (injected into Ask's system prompt per session):
```
Before answering, consider:
- Bayesian Trust Score (global): {score} — {label}
- Best decision type: {type} ({score}%)
- Worst decision type: {type} ({score}%)
- Relevant past decisions in domain: {count}
- Last executive review summary: {summary}
```

### 4. Bayesian Trust Score Feedback Loop

Ask SHALL self-assess recommendation quality via the Bayesian Trust Score system:

- **Formula:** `TRUST = (weighted_successes + α) / (total + α + β)`
- **Prior configs per decision type:**
  - TC (Technology Choice): α=8, β=2, priorTrust=0.8
  - TS (Tool Selection): α=8, β=2, priorTrust=0.8
  - IA (Implementation Approach): α=7, β=3, priorTrust=0.7
  - BB (Build vs Buy): α=6, β=4, priorTrust=0.6
  - PC (Process Change): α=5, β=5, priorTrust=0.5
  - AP (Architecture Pattern): α=5, β=5, priorTrust=0.5
  - GLOBAL: α=6, β=4, priorTrust=0.6
- **Labels:** VERY HIGH (≥90), HIGH (≥75), MODERATE (≥60), LOW (≥40), UNTRUSTED (<40)
- **Recalculation:** Daily via cron (`AccuracyScheduler`)
- **MIXED outcomes** count as 0.5 success (conservative Bayesian treatment)

### 5. Red Team / Self-Critique Requirement

For recommendations with **Confidence Level HIGH AND Survivability Score < 50** (DANGER ZONE per Governance Framework §8.3), Ask SHALL generate a self-critique before finalizing:

```text
# Red Team Assessment

Counter-arguments to my recommendation:
1. [Alternative interpretation of constraints]
2. [Scenario where this recommendation fails]
3. [What observable signal would prove me wrong]

Mitigations:
- [How to detect failure early]
- [Fallback strategy if wrong]
```

This is achieved via prompt engineering — zero new code. The self-critique is included in the advisory output but does not block the recommendation. Survivability scoring uses the framework defined in Governance Framework §8.

### 6. Influence without Authority (Supreme Constraint)

Ask influences the system through a single, read-only side-channel: **the Recommendation Registry**.

- Ask NEVER modifies code, schema, config, or ADRs
- Ask NEVER approves or rejects another agent's output
- Ask NEVER triggers execution pipeline transitions
- Ask's recommendations are ingested by a human or Code Agent — they are advisory, not directive
- The Registry is Ask's voice — what's recorded there is what Ask "said"
- Humans and execution agents decide whether to accept, adapt, or reject Ask's advice

This constraint is permanent and non-negotiable across all phases.

---

## Consequences

### Positive

- **Clear identity:** Ask transitions from ambiguous Q&A bot to well-defined strategic advisor
- **Accountability:** Bayesian Trust Score creates measurable accountability for advice quality
- **Learning loop:** Registry + context injection means Ask improves as outcomes accumulate
- **Governance alignment:** Complements ADR-001 by producing recommendations that follow Reuse-First hierarchy
- **Minimal operational cost:** Phase 0-2 adds zero new backend code — only fixes, tests, and connections
- **No authority creep:** "Influence without Authority" prevents Ask from becoming an execution bottleneck

### Negative

- **Dependency on Phase 0 completion:** All Phase 2-4 capabilities depend on the registry compiling and operating. If Phase 0 stalls, the entire evolution stalls.
- **Cold start problem:** Bayesian scores require assessed recommendations. Until the registry has data, Ask operates on priors only (roughly 50-80% depending on decision type).
- **Phase 3 scope risk:** Architectural scanning (layer violation detection) may require AST parsing tools beyond prompt engineering. If implemented, it must not violate "Influence without Authority" — scanning must be advisory, not enforcement.
- **Prompt truncation:** The current Ask prompt in `kilo.jsonc` exceeds 2,000 characters and may be truncated. Context injection (Phase 2) adds ~200 characters per session — this must fit within model context limits.

### Neutral

- This ADR does not change Ask's permissions in `kilo.jsonc`. All changes are in prompt content and backend connectivity.
- Phase 3-4 capabilities are forward-referenced and require separate ADRs before implementation.

---

## Alternatives Considered

### A. Keep Ask as general-purpose Q&A (status quo)

**Rejected.** The Recommendation Registry infrastructure already exists. Without formalizing Ask's evolution, the registry becomes dead code and the governance framework (ADR-001) lacks its primary recommendation producer.

### B. Give Ask code modification permissions

**Rejected.** Violates "Influence without Authority." Ask must remain advisory-only. If Ask could modify code, it becomes an execution agent, creating confusion with the Architect and Coder agents.

### C. Skip Phase 2 and build Phase 3 first

**Rejected.** Phase 3 (architectural scanning) requires the recommendation registry as its data source. Building Phase 3 without Phase 2 creates an analysis engine with no feedback loop — analysis without accountability.

### D. Build Phase 3-4 as separate agents

**Considered but deferred.** Phase 3 scanning could be a separate "Auditor" agent. Phase 4 self-critique could be a "RedTeam" agent. However, the current monolith-first principle favors consolidating advisory capabilities in one agent (Ask) until a clear need for decomposition emerges. Revisit at Phase 3 gate.

---

## References

- ADR-001 — Reuse-First Governance Framework (`docs/decisions/001-reuse-first-governance.md`)
- Ask Evolution Strategy (`.kilo/plans/ask-cto-evolution-strategy.md`)
- Reuse-First Governance Framework Spec (`.kilo/specs/reuse-first-governance-framework.md`)
- Constitution §7 (Simplicity), §10 (Change Management)
- Architecture v1.0, Layer 1 (Governance), Layer 4 (Agent Registry)
- Kilo Config: Ask Agent Definition (`.kilo/kilo.jsonc`)
- Recommendation Module: `backend/src/recommendation/` (21 files)

---

**End of ADR-002**
