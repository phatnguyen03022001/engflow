/* @lifecycle ACTIVE — ADR-013: Drift Detection Mechanism */

# ADR-013 — Drift Detection: Architecture & Policy Compliance Monitoring

**Status:** Active
**Created:** 2026-06-09
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-003, ADR-008, ADR-011, Constitution §1

---

## Context

As the Floweng codebase evolves, several forms of drift can occur:

1. **Implementation drift** — actual code structure diverges from what `architecture.md` specifies (e.g., modules added/removed without documentation updates)
2. **Policy drift** — violations of Constitution rules (e.g., `any` types introduced, lifecycle declarations missing, `console.log` in production code)
3. **API contract drift** — actual API endpoints diverge from documented Swagger/OpenAPI spec
4. **Knowledge Graph staleness** — nodes and edges in the Knowledge Graph (ADR-011) become outdated as the codebase changes

Currently, drift is only detected through manual code reviews at the PostVerify gate. There is no automated monitoring between gates or across longer time windows.

---

## Decision

### §1. Cron-Based Scheduler (6-Hour Interval)

Drift detection runs on a 6-hour cron schedule using `@nestjs/schedule` within the existing `evaluation/` module. Each detection cycle produces a `DriftEvent` record.

```
cron: 0 */6 * * *  (every 6 hours)
```

### §2. Three Detector Strategies

#### Strategy A: Structure Check

Compares the actual source tree structure against the module inventory documented in `architecture.md`.

- Scans `backend/src/` for actual module directories
- Parses `architecture.md` for documented modules
- Reports mismatches: missing modules, undocumented modules, file count discrepancies

#### Strategy B: Policy Check

Runs programmatic checks against the codebase for Constitution violations:

- **Lifecycle declaration check** — verify all new files (since last scan) have `@lifecycle` headers (reuses `.kilo/validate/lifecycle-validator.sh`)
- **`any` type check** — grep for `any` type usage in source files (excludes test files)
- **`console.log` check** — grep for `console.log` in production code
- **Coverage threshold check** — verify `npx jest --coverage` meets minimum thresholds

#### Strategy C: API Contract Check

Compares actual registered NestJS routes against documented API surface:

- Uses NestJS `RoutesExplorer` or `DiscoveryService` to enumerate registered routes at runtime
- Cross-references against Swagger/OpenAPI spec if available
- Reports undocumented, deprecated, or mismatched endpoints

### §3. DriftEvent Model

A new Prisma model in the `evaluation/` schema:

**`DriftEvent`**

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| detectorType | DetectorType enum | STRUCTURE, POLICY, API_CONTRACT |
| severity | Severity enum | LOW, MEDIUM, HIGH, CRITICAL |
| title | String | Short description |
| description | Text | Detailed findings |
| sourcePath | String? | File path where drift was detected |
| expectedValue | Text? | What was expected |
| actualValue | Text? | What was found |
| isResolved | Boolean | Whether this drift has been auto-resolved |
| resolvedAt | DateTime? | When drift was resolved |
| detectedAt | DateTime | When drift was first detected |

**`DetectorType` enum:** STRUCTURE, POLICY, API_CONTRACT

**`Severity` enum:** LOW, MEDIUM, HIGH, CRITICAL

### §4. Auto-Resolve Mechanism

Each detector run records the current state. If a previously detected drift is no longer present in the latest scan, the `DriftEvent` is automatically marked as resolved (`isResolved = true`, `resolvedAt = now()`).

This prevents alert fatigue — only active drifts appear in reports.

### §5. Notification

Drift detection outputs are:
1. Written to `DriftEvent` table in PostgreSQL
2. Logged via NestJS `Logger` with appropriate level based on severity
3. Exposed via a read-only API endpoint for dashboard integration

No external notification service (email, Slack) in v1 — deferred to Phase C.

---

## Consequences

### Positive

1. **Continuous compliance** — drift is detected within 6 hours of introduction, not only at review time
2. **Self-healing data** — auto-resolve prevents stale alerts
3. **No new infrastructure** — runs within existing `evaluation/` module, reuses PostgreSQL
4. **Extensible detector pattern** — new detector strategies can be added by implementing a common interface
5. **Knowledge Graph integration** — drift events can be linked to Knowledge Graph nodes (ADR-011) for impact analysis

### Negative

1. **False positives** — structural checks may flag intentional deviations. Mitigated by configurable thresholds and severity levels
2. **Runtime dependency** — API Contract Check requires a running NestJS application. Mitigated by running against the production/staging instance
3. **No auto-remediation** — v1 detects drift but does not fix it. Remediation is manual or via separate agent task

---

## Compliance

| Check | Criteria |
|-------|----------|
| Constitution §1 (Source of Truth) | Ensures architecture.md and codebase remain aligned |
| ADR-003 (Evaluation Harness) | Extends `evaluation/` module — no new module created |
| ADR-008 (Lifecycle) | `@lifecycle ACTIVE` on all new files |
| ADR-011 (Knowledge Graph) | Links drift events to Knowledge Graph nodes |
| Cron pattern | Uses `@nestjs/schedule` within existing module |

---

**End of ADR-013**
