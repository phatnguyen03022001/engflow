/* @lifecycle ACTIVE — Governance Framework: Reuse-First Decision Default Bias */

# Reuse-First Governance Framework v1.0

**Status:** Active
**Created:** 2026-06-07
**ADR:** [ADR-001 — Reuse-First Governance Framework](../docs/decisions/001-reuse-first-governance.md)
**Scope:** Governs ALL recommendations produced by the Ask agent.
**Type:** Living Document — updated as new capabilities (TASK-004..017) are built.

---

## §1. Reuse-First Principle

### 1.1 Default Hierarchy

All technical recommendations MUST evaluate options in order:

```
Level 1: Existing Internal Capability
  → Code already in the repository. Libraries already installed.
  → Zero incremental adoption cost.

Level 2: Proven OSS Solution
  → Established open-source project with active maintenance.
  → Strong community, documented track record.
  → Example: BullMQ, Prisma, Zod, tRPC, NextAuth.js.

Level 3: Managed Service
  → Cloud-hosted service with SLA.
  → Example: AWS SQS, Supabase Auth, Vercel, PlanetScale.

Level 4: Commercial Product
  → Paid/licensed software with vendor support.
  → Example: Auth0 Enterprise, Sentry Business, Retool.

Level 5: Custom Build
  → Built from scratch within the codebase.
  → HIGHEST cost in time, maintenance, and risk.
```

### 1.2 Skip Justification

When recommending Level N, the Ask agent MUST explicitly justify why Levels 1 through N−1 were considered and rejected. Each skipped level requires **one sentence** of justification.

Example:
```
Rejecting Level 2 (OSS): No mature OSS queue library exists with
exactly-once semantics and dead-letter support matching our requirements.
```

### 1.3 Default Bias

The default starting position is: **"What existing solution can solve this?"**

The burden of proof is on the person/agent proposing a Custom Build (Level 5).

---

## §2. Build Justification Framework

### 2.1 When Custom Build is Permissible

Custom implementation (Level 5) MAY be recommended ONLY when **at least one** of these conditions is demonstrably true:

| # | Condition | Required Evidence |
|---|-----------|-------------------|
| C1 | **Requirement Gap** — No existing solution satisfies functional or non-functional requirements | List of evaluated alternatives with specific gaps |
| C2 | **Strategic Differentiation** — The capability IS the product's unique value proposition | Connection to core business model and competitive advantage |
| C3 | **Compliance Constraint** — Regulatory requirements prohibit external dependencies | Citation of specific regulation/law (GDPR, HIPAA, SOC2) |
| C4 | **Vendor Lock-In Risk** — Dependency risk exceeds acceptable threshold | Lock-in risk score ≥ 70 (see §7 Reversibility) |
| C5 | **Cost Boundary** — TCO of reuse exceeds acceptable boundary | TCO comparison: build vs reuse over 24-month horizon |

### 2.2 Insufficient Justifications (Anti-Patterns)

These reasons are NOT sufficient alone to justify Custom Build:

- "We can build it better" (without evidence of C1)
- "It's not that complicated" (underestimates maintenance)
- "We'll need custom features later" (premature optimization)
- "Learning opportunity" (engineering vanity)
- "Dependency is bloated" (unless functional requirement gap exists)

---

## §3. Reuse Challenge Engine

### 3.1 Recommendation Pipeline

Every recommendation MUST pass through this pipeline:

```
Recommendation Candidate
        ↓
┌─────────────────────┐
│  REUSE CHALLENGE    │  ← Mandatory gate
│  (§3.2 Checklist)   │
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ BUILD-vs-BUY        │  ← Quantitative analysis
│ (§4 Time-to-Value)  │
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ OVER-ENGINEERING    │  ← Anti-pattern detection
│ DETECTION (§5)      │
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ FINAL               │  ← Scored, justified output
│ RECOMMENDATION      │
└─────────────────────┘
```

### 3.2 Reuse Challenge Checklist

For every recommendation, answer:

| # | Question | Output |
|---|----------|--------|
| Q1 | What existing solutions address this need? | List ≥3 alternatives or state "none found after search" |
| Q2 | What is the adoption maturity of each? | Stars, contributors, release frequency, age |
| Q3 | What is the maintenance burden of each? | Lines of integration code, upgrade frequency |
| Q4 | What is the migration cost later? | Estimated effort to switch away (hours) |
| Q5 | What is the lock-in risk of each? | Score 0–100 (see §7) |
| Q6 | What is the implementation speed of each? | Estimated hours to integrate vs build |

---

## §4. Time-to-Value Framework

### 4.1 Metrics

Every recommendation MUST evaluate:

| Metric | Definition | Unit |
|--------|-----------|------|
| **Implementation Time** | Calendar time from start to production | Days |
| **Time-to-Value (TTV)** | Calendar time from start to first measurable benefit | Days |
| **Operational Cost** | Monthly cost to operate (hosting, licenses, APIs) | USD/month |
| **Maintenance Cost** | Monthly effort to maintain, upgrade, debug | Hours/month |
| **Exit Cost** | Effort to migrate away from this solution | Person-days |
| **Learning Cost** | Time for team to become productive | Person-days |

### 4.2 TTV Score Calculation

```
TTV Score = 100 − (penalties)

Penalties:
  Implementation Time > 7 days      → −10 per extra week
  No value before 30 days           → −20
  Operational Cost > $100/month     → −10 per $100
  Maintenance > 10 hrs/month        → −15 per 10 hours
  Exit Cost > 5 person-days          → −10 per 5 days
  Learning Cost > 3 person-days      → −10 per 3 days

Floor: 0. Ceiling: 100.
```

### 4.3 Interpretation

| Score | Meaning |
|-------|---------|
| 90–100 | Excellent TTV — prefer this solution |
| 70–89 | Good TTV — acceptable with monitoring |
| 50–69 | Marginal TTV — requires justification |
| 0–49 | Poor TTV — strong reason required |

---

## §5. Over-Engineering Detection Engine

### 5.1 Detection Patterns

The Ask agent MUST actively scan recommendations for these anti-patterns:

| Pattern | Detection Rule | Risk |
|---------|---------------|------|
| **Premature Optimization** | Recommending scale-out architecture before single-instance proven insufficient | Wasted engineering time |
| **Reinventing The Wheel** | Recommending custom implementation of functionality available in mature OSS | Unnecessary maintenance burden |
| **Custom Framework Syndrome** | Recommending internal abstraction layer before ≥3 concrete use cases exist | Abstraction without evidence |
| **Infrastructure Before Product** | Recommending complex infrastructure (K8s, message queues, CDNs) before product-market fit validated | Capital destruction |
| **Build For Scale Not Yet Needed** | Using projected future load (not current load) as primary architecture driver | Premature complexity |

### 5.2 Finding Format

When a pattern is detected, output:

```text
[Pattern Name]
Evidence: <specific observation from the recommendation>
Risk: <concrete negative outcome if implemented>
Suggested Alternative: <simpler, reuse-first approach>
```

### 5.3 Severity

| Severity | Criteria |
|----------|----------|
| **Critical** | Would add weeks to delivery with no short-term benefit |
| **High** | Would add days to delivery, introduces new dependency |
| **Medium** | Adds complexity without clear justification |
| **Low** | Minor deviation from simplest solution |

---

## §6. Startup Stage Awareness

### 6.1 Stage Definitions

| Stage | Name | Characteristics | Primary Goal |
|-------|------|----------------|-------------|
| **Stage 0** | Idea | No code, validating concept | Problem validation |
| **Stage 1** | MVP | First working version, 0–10 users | Learning velocity |
| **Stage 2** | Early Customers | Paying users, feedback loops | Retention & iteration |
| **Stage 3** | Growth | Scaling users, revenue | Scalability & reliability |
| **Stage 4** | Scale | Mature product, large user base | Optimization & efficiency |

### 6.2 Stage-Appropriate Technology Guidance

| Technology Category | Stage 0–1 (MVP) | Stage 2 (Early) | Stage 3 (Growth) | Stage 4 (Scale) |
|---------------------|-----------------|-----------------|------------------|-----------------|
| **Database** | Supabase/PlanetScale | Same + backups | Same + read replicas | Primary/replica + sharding |
| **Queue** | In-process (none) | BullMQ + Redis | Same + monitoring | Temporal / Kafka |
| **Auth** | NextAuth.js / Clerk | Same | Same + SSO | Same + enterprise SSO |
| **File Storage** | Vercel Blob / S3 | Same | Same + CDN | Same + multi-region |
| **Caching** | None | Redis | Same + CDN | Multi-layer cache |
| **Monitoring** | Console / Vercel Analytics | Sentry | Datadog / Grafana | OpenTelemetry |
| **CI/CD** | GitHub Actions | Same | Same + staging env | Same + canary deploys |
| **Infrastructure** | Vercel / Railway | Same | Same + Docker | Kubernetes |

### 6.3 Stage Transition Triggers

Ask MUST include stage in every recommendation header. Stage is determined by:

```text
IF (no code exists)                                → Stage 0
IF (code exists, no paying users)                  → Stage 1
IF (paying users < 100 AND revenue < $10k/mo)      → Stage 2
IF (users 100–10,000 AND revenue $10k–$100k/mo)    → Stage 3
IF (users > 10,000 OR revenue > $100k/mo)           → Stage 4
```

### 6.4 Examples

```
Question: "Should we use BullMQ or build our own queue?"

Stage 0–1 Answer:
  ✓ BullMQ. $0 cost, 2-line integration. Build a queue
    at this stage is capital destruction. Revisit at Stage 3.

Stage 3–4 Answer:
  Evaluate BullMQ vs Temporal vs SQS based on exactly-once
  semantics, observability, and operational overhead.
  Custom build still NOT recommended unless C1–C5 met.
```

---

## §7. Reversibility Analysis

### 7.1 Reversibility Question

For every recommendation, answer:

> **"Can we undo this decision later without catastrophic cost?"**

### 7.2 Reversibility Score

```
Reversibility Score = 100 − (cost factors)

Cost factors (deduct from 100):
  Proprietary API dependency            → −25
  Data migration required               → −30
  Schema changes required               → −20
  Team re-training needed               → −15
  Contract/cost lock-in                 → −25
  Deep framework integration            → −30

Floor: 0. Ceiling: 100.
```

### 7.3 Classification

| Score | Classification | Meaning |
|-------|---------------|---------|
| 80–100 | **Two-Way Door** | Easily reversible. Low-risk decision. |
| 50–79 | **Difficult To Reverse** | Reversible but expensive. Requires documented migration path. |
| 0–49 | **One-Way Door** | Very difficult or impossible to reverse. Requires ADR and explicit approval. |

### 7.4 One-Way Door Protocol

If classification is "One-Way Door":
1. Decision MUST be escalated to Architect agent for ADR creation
2. Two independent alternatives MUST be evaluated
3. Migration path MUST be documented BEFORE decision is made
4. Reversibility MUST be re-evaluated at each stage transition

---

## §8. Recommendation Survivability

### 8.1 Confidence Score

> **"How likely am I correct that this is the right recommendation?"**

```
Confidence Score = 0–100

Factors:
  Domain expertise                  → +0 to +20
  Prior similar recommendations     → +0 to +15
  Available documentation quality   → +0 to +15
  Community consensus clarity       → +0 to +15
  Requirement clarity               → +0 to +15
  Time pressure (rush?)             → −0 to −20
  Novelty of problem                → −0 to −20

Total capped at 0–100.
```

### 8.2 Survivability Score

> **"If I am wrong, how expensive is the mistake?"**

```
Survivability Score = 100 − (consequence factors)

Consequence factors:
  Financial cost of wrong choice      → −0 to −30
  Time lost reversing decision        → −0 to −25
  Data loss / migration pain          → −0 to −25
  Reputation / trust damage           → −0 to −20

Total capped at 0–100.
HIGH survivability = mistake is cheap.
LOW survivability = mistake is catastrophic.
```

### 8.3 Survivability Matrix

```
                     HIGH CONFIDENCE           LOW CONFIDENCE
                     (80–100)                  (0–79)

HIGH SURVIVABILITY   ██ SAFE ZONE ██           CAUTION ZONE
(80–100)             Proceed confidently.      Verify with second source.
                     Low stakes, high trust.   Low stakes but uncertain.

LOW SURVIVABILITY    RISK ZONE                 ██ DANGER ZONE ██
(0–79)               High stakes, high trust.  STOP. Escalate to Architect.
                     Document assumptions.     Do NOT proceed without ADR.
```

---

## §9. Advisory Output Extension

### 9.1 Required Output Sections

Every Ask recommendation MUST include these sections:

```markdown
## Recommendation: <Title>

### Stage Context
Stage: <Stage 0–4>
Reasoning: <Why this stage matters for this decision>

### Reuse Analysis
| Level | Solution | Verdict | Reason |
|-------|----------|---------|--------|
| L1: Internal | <existing> | ✓/✗ | <reason> |
| L2: OSS | <options> | ✓/✗ | <reason> |
| L3: Managed | <options> | ✓/✗ | <reason> |
| L4: Commercial | <options> | ✓/✗ | <reason> |
| L5: Custom Build | N/A | ✓/✗ | <C1–C5 justification if ✓> |

### Build Justification (if custom build recommended)
Condition Met: <C1 | C2 | C3 | C4 | C5>
Evidence: <specific evidence>

### Existing Alternatives
<At least 3 evaluated alternatives with brief analysis>

### Time-to-Value
| Metric | Value |
|--------|-------|
| Implementation Time | <days> |
| Time-to-Value | <days> |
| Operational Cost | <$/month> |
| Maintenance Cost | <hours/month> |
| Exit Cost | <person-days> |
| Learning Cost | <person-days> |
| **TTV Score** | **<0–100>** |

### Over-Engineering Detection
<Findings or "No over-engineering patterns detected">

### Reversibility
Score: <0–100>
Classification: <Two-Way Door | Difficult To Reverse | One-Way Door>
Migration Path: <estimate or "N/A — two-way door">

### Survivability
| Metric | Score |
|--------|-------|
| Confidence | <0–100> |
| Survivability | <0–100> |
| Zone | <Safe | Caution | Risk | Danger> |

### Final Recommendation
<Concise recommendation with primary justification>
```

### 9.2 Brevity Rule

For Level 1–2 (internal/OSS) recommendations where the decision is obvious:

- Reuse Analysis table may be condensed to one line: `→ L2: <solution> (obvious winner)`
- Build Justification section may be omitted
- Over-Engineering Detection may be condensed: `"No patterns detected"`
- TTV Score and Survivability scores are still required

For Level 5 (Custom Build) recommendations:

- ALL sections are mandatory, in full detail
- Condition C1–C5 MUST be explicitly cited with evidence

---

## §10. Enforcement

### 10.1 Ask Agent Prompt Integration

This framework is integrated into the Ask agent's system prompt (see `kilo.jsonc`). The agent MUST:

1. Begin every recommendation response by identifying the startup stage
2. Apply Reuse-First hierarchy before suggesting any solution
3. Include TTV, Reversibility, Survivability scores for Level 3+ recommendations
4. Detect and report over-engineering patterns
5. Format output per §9

### 10.2 Pre-Verify Gate

When a recommendation is routed through the execution pipeline, the Pre-Verify agent checks:

- Does the recommendation include Stage Context?
- Does it show evidence of Reuse Challenge evaluation?
- For custom build recommendations: are C1–C5 conditions cited?
- Are scores present and within valid ranges (0–100)?

### 10.3 Audit Trail

All Ask agent recommendation sessions are logged. The governance framework provides the rubric for post-hoc audit of recommendation quality.

---

## §11. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-07 | Architect (TASK-018) | Initial framework |

---

**End of Reuse-First Governance Framework**
