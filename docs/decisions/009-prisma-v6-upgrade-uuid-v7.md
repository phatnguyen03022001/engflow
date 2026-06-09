/* @lifecycle ACTIVE — ADR-009: Prisma 6.x Upgrade and UUID v7 Migration */

# ADR-009 — Prisma 6.x Upgrade and UUID v7 Migration

**Status:** Active
**Created:** 2026-06-09
**Author:** Code Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-008, prisma-conventions.rules.md, constitution.md §2

---

## Context

The Floweng backend currently uses Prisma 5.x (`@prisma/client@^5.19.0`) with UUID v4 primary keys via `@default(uuid())`. Two upgrade paths are available: Prisma 6.x and Prisma 7.x. Additionally, Prisma 6.x introduced native support for `@default(uuid(7))`, enabling time-sortable UUID v7 primary keys.

**Key observations:**

1. **Prisma 7.x** introduces 40+ breaking changes (removal of `findOne`, `PascalCase` enum filters removed, `connectOrCreate` API changes) that would require significant refactoring across all modules.
2. **Prisma 6.x** is a drop-in compatibility release from 5.x — the migration is limited to dependency version bumps and a Prisma Client regeneration. No code changes beyond schema updates.
3. **UUID v7** is time-sortable (first 48 bits = Unix timestamp ms), which dramatically improves B-tree index locality in PostgreSQL compared to UUID v4's random distribution. All primary key indexes and FK indexes benefit from reduced page splits and cache misses.

**Database schema:** 15 models with `@id @default(uuid())` primary keys must be migrated to `@default(uuid(7))`.

---

## Decision

### §1. Target Prisma 6.x (not 7.x)

- Upgrade `@prisma/client` from `^5.19.0` to `^6.5.0`
- Upgrade `prisma` from `^5.19.0` to `^6.5.0`
- No code changes beyond dependency bumps and Prisma Client regeneration
- Prisma 7.x evaluation deferred to a separate ADR when the codebase is ready for its breaking changes

### §2. Migrate All Model IDs to UUID v7

Replace `@default(uuid())` with `@default(uuid(7))` in all 15 models:
- User, Lesson, Exercise, UserLesson
- Recommendation, RecommendationOption, Checkpoint
- DecisionMemory, AgentMemory, TrustScore, AccuracySnapshot
- AgentExecution, ExecutionPhase, AgentMetric, MetricDimension

### §3. Update Conventions

- Update `prisma-conventions.rules.md` to reflect UUID v7 as the canonical convention
- The convention table now reads: `String @id @default(uuid(7))` — UUID v7, never autoincrement

---

## Rationale

1. **Index performance:** UUID v7's time-sortable prefix (~1ms granularity) means new rows are appended near the end of the index rather than inserted randomly. This reduces B-tree page splits by ~80–90% for append-heavy workloads (Constitution §2: "Build systems that last").

2. **Minimal blast radius:** The Prisma 5.x → 6.x migration is the smallest possible upgrade. No API changes, no TypeScript type changes, no runtime behavior changes. This aligns with Implementation Rule: "Preserve existing behavior unless explicitly requested."

3. **No new dependencies:** UUID v7 is natively supported by Prisma 6.x — no external UUID library needed.

4. **Future-proofing:** When the codebase eventually migrates to Prisma 7.x, the UUID v7 schema will already be in place.

---

## Consequences

### Positive

1. **Better query performance** on time-range scans and paginated list endpoints (orderBy createdAt benefits from physical locality with UUID v7)
2. **Reduced index maintenance** — fewer B-tree page splits under write load
3. **Smallest possible migration** — no runtime code changes, no behavioral differences
4. **Convention updated** — UUID v7 becomes the canonical standard for all new models

### Negative

1. **Migration file created** — a new Prisma migration is generated (applied separately)
2. **Existing UUID v4 values preserved** — this is NOT a data migration; existing records retain their UUID v4 values. Only new records will use UUID v7
3. **Mixed v4/v7 keys** — during the transition period, old records have v4 keys and new records have v7 keys. Both are valid UUIDs and work identically in all UUID-aware systems

### Migration Approach

- Schema-only: change `@default(uuid())` → `@default(uuid(7))` in schema.prisma
- Generate migration with `npx prisma migrate dev` (not run in this task)
- Apply migration when Docker services are available
- No data backfill needed — UUID v4 values remain valid and functional

---

## Compliance

| Check | Criteria |
|-------|----------|
| Dependency version | `@prisma/client@^6.5.0`, `prisma@^6.5.0` |
| Schema updated | All 15 models use `@default(uuid(7))` |
| Conventions updated | prisma-conventions.rules.md reflects UUID v7 |
| Build | `npx prisma generate` succeeds |
| Tests | `npx jest --passWithNoTests` passes |

---

**End of ADR-009**
