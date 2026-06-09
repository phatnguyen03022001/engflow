/* @lifecycle ACTIVE — ADR-008: Lifecycle Declarations for File Governance */

# ADR-008 — Lifecycle Declarations for File Governance

**Status:** Active
**Created:** 2026-06-08
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** Constitution §8, Code Agent Rules §6, Pre-Verify Agent Rules §3.6, Post-Verify Agent Rules §3.7, Execution Contract

---

## Context

The AI Software Factory operates a multi-agent execution pipeline where agents generate, modify, and review source files. Without a standardized declaration system, agents cannot distinguish between:

1. **Production source files** — actively maintained, governed by Constitution and ADRs
2. **Generated artifacts** — build output, lock files, reports (not subject to governance)
3. **Temporary state** — runtime data, session files (ephemeral)
4. **Experimental/WIP** — drafts, prototypes (limited governance)
5. **Deprecated files** — historical records, no longer in use

The Constitution (§8) mandates lifecycle declarations on all new files. The Code Agent Rules (§6) already define five lifecycle states. However, there is no formal ADR codifying the lifecycle system, its enforcement rules, or its governance implications.

**Problem:** Without a dedicated ADR, the lifecycle system lacks:
- Formal definition of each state's governance authority
- Rules for state transitions
- Enforcement criteria for PreVerify and PostVerify gates
- Clear delineation between GENERATED files (excluded from governance) and ACTIVE files (fully governed)

---

## Decision

### §1. Lifecycle States

| State | Identifier | Governance | Persistence | Example Files |
|-------|-----------|------------|-------------|---------------|
| **ACTIVE** | `ACTIVE` | Full Constitution + ADR authority | Permanent | Source code, config, rules, docs |
| **GENERATED** | `GENERATED` | Excluded from governance authority | Rebuildable | Build output, lock files, reports |
| **TEMPORARY** | `TEMPORARY` | Minimal (cleanup expected) | Ephemeral | Runtime state, session data |
| **EXPERIMENTAL** | `EXPERIMENTAL` | Limited (may bypass some gates) | Until promoted or removed | Drafts, WIP, prototypes |
| **ARCHIVED** | `ARCHIVED` | None (historical record only) | Permanent but inert | Deprecated code, old docs |

### §2. Declaration Format

Every new file MUST include a lifecycle declaration as the first line comment:

```typescript
/* @lifecycle <STATE> — <brief reason> */
```

**Format Rules:**
- Must be the very first line of the file (no blank lines before it)
- STATE must be one of: ACTIVE, GENERATED, TEMPORARY, EXPERIMENTAL, ARCHIVED
- The reason after the em-dash (`—`) should be concise (≤ 60 characters preferred)
- Wrapper: `/* ... */` block comment style for all languages that support it
- For languages without block comment support, use the closest single-line equivalent with `@lifecycle` annotation

### §3. State Assignments by Default

| File Category | Default State | Rationale |
|--------------|---------------|-----------|
| Production source files (`.ts`, `.tsx`, `.js`, `.css`) | ACTIVE | Fully governed |
| Configuration files (`.json`, `.jsonc`, `.yaml`, `.env`, `Dockerfile`) | ACTIVE | Infrastructure as code |
| Rule/contract files (`.rules.md`, `.contract.md`) | ACTIVE | Agent governance |
| Documentation (`.md` in `docs/`) | ACTIVE | Source of truth |
| Build output (`dist/`, `build/`, `.next/`) | GENERATED | Always rebuildable |
| Lock files (`package-lock.json`, `yarn.lock`) | GENERATED | Machine-generated |
| Reports, logs, dumps | GENERATED | Recreatable |
| Session state, temp caches | TEMPORARY | Ephemeral by nature |
| Draft PRDs, WIP specs, prototypes | EXPERIMENTAL | Not yet ready for governance |
| Deprecated modules, old ADR versions | ARCHIVED | Historical reference only |

### §4. Governance by State

| Gate | ACTIVE | GENERATED | TEMPORARY | EXPERIMENTAL | ARCHIVED |
|------|--------|-----------|-----------|--------------|----------|
| Constitution compliance | Required | N/A | N/A | Recommended | N/A |
| ADR compliance | Required | N/A | N/A | Recommended | N/A |
| PreVerify review | Required | Skip | Skip | Recommended | Skip |
| PostVerify review | Required | Skip | Skip | Recommended | Skip |
| Testing required | Required | N/A | N/A | N/A | N/A |
| Lifecycle declaration | Required | Required | Required | Required | Required |

### §5. State Transitions

```
EXPERIMENTAL → ACTIVE   — When promoted to production (requires review)
EXPERIMENTAL → ARCHIVED — When abandoned
ACTIVE → ARCHIVED       — When deprecated (requires ADR for major deprecations)
ACTIVE → EXPERIMENTAL   — Forbidden (demotion not allowed)
GENERATED → ACTIVE      — Forbidden (generated files cannot become source of truth)
TEMPORARY → ACTIVE      — Forbidden (ephemeral data cannot be promoted)
```

### §6. Enforcement

**PreVerify Gate (§3.6):**
- Does the plan identify all new files?
- Are lifecycle states assigned to each file?
- Is the assigned state appropriate for the file type?

**PostVerify Gate (§3.7):**
- Do all new files have a valid `@lifecycle` declaration?
- Is the lifecycle state appropriate?
- Are GENERATED files excluded from governance authority?

**Code Agent (§6):**
- Every new file MUST include a lifecycle declaration
- Default for new source files: ACTIVE
- Format: `/* @lifecycle <STATE> — <brief reason> */`

### §7. GENERATED File Exception

GENERATED files MUST still carry the `@lifecycle GENERATED` declaration but are EXCLUDED from:
- Constitution compliance review
- ADR compliance review
- PreVerify and PostVerify gate checks
- Testing requirements

This ensures GENERATED files are tracked (never orphaned) but not governed.

---

## Consequences

### Positive

1. **Clear governance boundaries** — Agents know which files are subject to which rules
2. **No ambiguity about generated files** — The GENERATED state explicitly exempts build artifacts from governance authority
3. **Lifecycle-aware gating** — PreVerify and PostVerify can skip or adjust checks based on lifecycle state
4. **Graduation path** — EXPERIMENTAL → ACTIVE provides a clear promotion path for prototypes
5. **Archival clarity** — ARCHIVED state prevents dead code from triggering false-positive linting or test requirements

### Negative

1. **Declaration overhead** — Every new file requires a lifecycle comment (mitigated by Code Agent automation)
2. **Transition enforcement** — State transitions require agent discipline (not machine-enforced in v1)
3. **Migration burden** — Existing files without declarations will be grandfathered (new files only)

### Migration Strategy

- **New files only:** This ADR applies to new files created after the adoption date
- **Existing files:** Grandfathered — no requirement to backfill lifecycle declarations
- **Exceptions:** When an existing file undergoes significant modification (≥50% changed), a lifecycle declaration SHOULD be added

---

## Compliance

| Check | Criteria |
|-------|----------|
| File header | First line is `/* @lifecycle <STATE> — <reason> */` |
| Valid state | STATE is one of the 5 defined values |
| Appropriate state | State matches the file's role per §3 |
| No blank line before | Declaration is the first line (blank line before is non-compliant) |

---

**End of ADR-008**
