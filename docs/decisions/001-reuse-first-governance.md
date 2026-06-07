/* @lifecycle ACTIVE — ADR-001: Reuse-First Governance Framework */

# ADR-001 — Reuse-First Governance Framework

**Status:** Proposed
**Created:** 2026-06-07
**Author:** Architect Agent (TASK-018)
**Supersedes:** None (first ADR)
**Superseded By:** None

---

## Context

The Ask agent (defined in `kilo.jsonc`) currently produces technical recommendations without a default decision bias. Its prompt instructs it to "provide implementation-independent recommendations" but provides no framework for:

1. Establishing a default hierarchy of reuse over custom build
2. Requiring justification when recommending custom implementations
3. Evaluating decisions through a business-aware lens (cost, velocity, maintenance, survivability)
4. Detecting over-engineering patterns
5. Accounting for startup stage maturity

The result is a system that can produce technically correct but engineering-centric recommendations, potentially favoring custom code over existing solutions — a bias that reduces delivery velocity and increases maintenance burden, both of which are existential risks for early-stage startups.

TASK-016 (Factory Dashboard) is the current task. TASK-017 (Ask Enhancement — Recommendation Generation, Risk Analysis, Failure Prediction, Red Team, Scenario Simulation, Counter-Recommendation) is the preceding task. TASK-018 addresses a cross-cutting gap: the absence of a governance framework that enforces **Reuse-First** as the default decision posture.

The tasks referenced in the specification (TASK-004 through TASK-017) are forward references — these capabilities do not yet exist in the codebase. This framework is designed to govern recommendations once those capabilities are built.

---

## Decision

**Establish the Reuse-First Governance Framework** as a binding specification for the Ask agent.

Key architectural decisions embedded in this framework:

1. **Five-Level Reuse Hierarchy** — Default evaluation order from Internal Capability → OSS → Managed Service → Commercial → Custom Build, with mandatory skip justification.

2. **Five Build Justification Conditions (C1–C5)** — Custom build recommendations require demonstrable evidence that at least one of: requirement gap, strategic differentiation, compliance constraint, vendor lock-in, or cost boundary is met.

3. **Reuse Challenge Pipeline** — A mandatory pipeline stage inserted before any recommendation is finalized, consisting of a checklist evaluation (6 questions) and quantitative analysis.

4. **Time-to-Value Scoring** — Six-metric framework (Implementation Time, TTV, Operational Cost, Maintenance Cost, Exit Cost, Learning Cost) producing a 0–100 TTV Score with interpretation bands.

5. **Over-Engineering Detection** — Automatic scanning for five anti-patterns (Premature Optimization, Reinventing The Wheel, Custom Framework Syndrome, Infrastructure Before Product, Build For Scale Not Yet Needed) with severity classification.

6. **Startup Stage Awareness** — Five-stage model (Idea → MVP → Early Customers → Growth → Scale) with stage-appropriate technology guidance tables and transition triggers.

7. **Reversibility Analysis** — 0–100 Reversibility Score with three classifications (Two-Way Door, Difficult To Reverse, One-Way Door) and mandatory escalation protocol for One-Way Door decisions.

8. **Survivability Matrix** — Dual scoring (Confidence + Survivability) producing a four-zone risk matrix (Safe, Caution, Risk, Danger) with zone-specific action protocols.

9. **Standardized Advisory Output** — Prescribed output format ensuring all recommendations include Reuse Analysis, Build Justification, TTV, Over-Engineering Detection, Reversibility, Survivability, and Final Recommendation.

---

## Consequences

### Positive

- **Reduced Over-Engineering** — Default bias toward reuse eliminates unnecessary custom builds before they are proposed.
- **Increased Velocity** — Reuse decisions are faster than build decisions, improving overall delivery speed.
- **Lower Maintenance Burden** — Fewer custom components mean fewer things to maintain, debug, and upgrade.
- **Business Alignment** — Recommendations consider cost and time-to-value, not just technical elegance.
- **Auditability** — Standardized output format enables post-hoc review of recommendation quality.
- **Stage-Appropriate Decisions** — Technology choices match organizational maturity, preventing premature complexity.

### Negative

- **Potential False Positives** — Over-Engineering Detection may flag legitimate architectural decisions as anti-patterns. Mitigated by: findings are warnings, not blocks; human override always available.
- **Scoring Subjectivity** — TTV, Reversibility, and Survivability scores rely on estimates that may be inaccurate. Mitigated by: scores include confidence bands; low-confidence high-stakes decisions escalate to Architect.
- **Governance Overhead** — The output format adds structure to every recommendation, potentially increasing verbosity. Mitigated by: Brevity Rule (§9.2) for obvious Level 1–2 decisions.

### Neutral

- **Speculative** — The framework references capabilities from tasks that have not yet been implemented (TASK-004 through TASK-017). The framework is designed to be versioned and updated as those capabilities are built.
- **Agent Prompt Evolution** — The Ask agent's prompt in `kilo.jsonc` will need to be updated to embed this framework. That is a separate implementation step, not part of this ADR.

---

## Alternatives Considered

### A. No governance framework (status quo)

**Rejected.** The Ask agent would continue producing recommendations without a default reuse bias, leading to engineering-centric decisions that may not serve startup velocity and survivability goals.

### B. Hard rule: never recommend custom build

**Rejected.** Too rigid. Legitimate cases exist (strategic differentiation, compliance) where custom build is appropriate. The framework provides escape hatches (C1–C5) rather than absolute prohibition.

### C. Embed governance in the codebase as a service module

**Rejected as premature.** The current product is Floweng (English learning platform). Adding a governance service to the application code would be misplaced. The governance framework is agent-level policy, not application-level functionality. If Floweng later requires a recommendation engine as a product feature, this framework can be codified into services at that time.

---

## References

- Constitution §7 (Simplicity) — "Prefer simple solutions over complex ones"
- Constitution §8 (Documentation) — "Major decisions require ADR"
- Architecture Layer 1 (Governance) — "Policy Management, Compliance, Decision Records"
- TASK-018 Specification — `.kilo/specs/reuse-first-governance-framework.md`

---

**End of ADR-001**
