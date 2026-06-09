/* @lifecycle ACTIVE — ADR-011: Knowledge Graph Design for Traceability */

# ADR-011 — Knowledge Graph: Cross-Layer Traceability

**Status:** Active
**Created:** 2026-06-09
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-008, Constitution §3 §8, Architecture L2

---

## Context

Floweng currently lacks traceability between requirements, architecture, code, and tests across the 10-layer AI Software Factory. This creates several problems:

1. **No impact analysis** — when a module changes, there is no way to determine which requirements, architecture decisions, tests, or other modules are affected.
2. **Manual cross-referencing** — architects and code reviewers must manually trace relationships between documents, which is error-prone and inconsistent.
3. **Audit gaps** — there is no machine-readable record linking decisions to their implementations.
4. **Verification blind spots** — PreVerify and PostVerify agents cannot validate whether code changes respect cross-layer constraints.

Architecture Layer 2 (Knowledge) identifies a "Knowledge Graph" as a core capability, but no concrete design exists.

---

## Decision

### §1. PostgreSQL JSONB (No New Database)

The Knowledge Graph uses existing PostgreSQL via two Prisma models (`KnowledgeNode` + `KnowledgeEdge`). Graph traversal is performed using SQL recursive Common Table Expressions (CTEs). This avoids introducing a dedicated graph database (violating Constitution §3 monolith-first principle).

### §2. Data Model

**`KnowledgeNode`** — Represents any entity in the system that can be linked.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| nodeType | NodeType enum | REQUIREMENT, ARCHITECTURE, CODE, TEST, DECISION |
| qualifiedName | String | Unique fully-qualified identifier (e.g., `module:recommendation`) |
| displayName | String | Human-readable label |
| description | Text? | Optional description |
| sourcePath | String? | File path or reference location |
| metadata | JSONB? | Flexible key-value payload |
| isActive | Boolean | Soft-delete support |

**`KnowledgeEdge`** — Directed relationship between two nodes.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID (PK) | Internal ID |
| sourceId | UUID (FK) | Source node |
| targetId | UUID (FK) | Target node |
| edgeType | EdgeType enum | DEPENDS_ON, IMPLEMENTS, TESTS, DECIDES, REFERENCES, SUPERSEDES |
| weight | Float? | Optional relationship strength (for ranking) |
| metadata | JSONB? | Flexible key-value payload |

**`NodeType` enum:** REQUIREMENT, ARCHITECTURE, CODE, TEST, DECISION

**`EdgeType` enum:** DEPENDS_ON, IMPLEMENTS, TESTS, DECIDES, REFERENCES, SUPERSEDES

**Indexes:**
- Compound index on `(sourceId, edgeType)` for outgoing traversal
- Compound index on `(targetId, edgeType)` for incoming traversal
- Index on `qualifiedName` for node lookup

### §3. New `knowledge/` Module

Following the canonical module pattern:

```
backend/src/knowledge/
├── knowledge.module.ts           # NestJS @Module
├── knowledge.controller.ts       # CRUD + query endpoints
├── services/
│   └── knowledge-graph.service.ts  # Graph operations + CTE queries
├── dto/
│   ├── create-node.dto.ts
│   ├── create-edge.dto.ts
│   └── graph-query.dto.ts
├── interfaces/
│   └── knowledge-graph.interface.ts
└── __tests__/
    ├── knowledge-graph.service.spec.ts
    └── knowledge.controller.spec.ts
```

### §4. API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/knowledge/nodes` | JWT (ADMIN) | Create a knowledge node |
| `GET` | `/api/v1/knowledge/nodes` | JWT | List/filter nodes by type |
| `GET` | `/api/v1/knowledge/nodes/:id` | JWT | Get node details with edges |
| `POST` | `/api/v1/knowledge/edges` | JWT (ADMIN) | Create an edge |
| `GET` | `/api/v1/knowledge/graph/traverse` | JWT | Traverse graph from a node |
| `GET` | `/api/v1/knowledge/graph/impact` | JWT | Impact analysis for a node |

### §5. Traversal via Recursive CTE

Graph queries use PostgreSQL recursive CTEs for traversal:

```sql
WITH RECURSIVE traversal AS (
  -- Base: start node
  SELECT id, 0 AS depth FROM knowledge_nodes WHERE id = :startId
  UNION ALL
  -- Recurse: follow outgoing edges
  SELECT e.target_id, t.depth + 1
  FROM traversal t
  JOIN knowledge_edges e ON e.source_id = t.id
  WHERE t.depth < :maxDepth
)
SELECT * FROM traversal;
```

### §6. Manual Seeding (v1)

In v1, the Knowledge Graph is populated via:
- Manual node creation through admin API
- Seed scripts for existing modules and ADRs
- No automatic scanning or extraction

---

## Consequences

### Positive

1. **No new infrastructure** — reuses existing PostgreSQL, zero additional cost
2. **Full audit trail** — every relationship between requirements, architecture, code, and tests is recorded
3. **Impact analysis** — PreVerify/PostVerify can query "what is affected by this change?"
4. **Simple queries** — recursive CTEs are well-understood and well-supported in PostgreSQL
5. **Lifecycle-compliant** — all new files carry `@lifecycle ACTIVE` declarations

### Negative

1. **Slower than dedicated graph DB** — at scale (>10K nodes), recursive CTEs may become slow. Mitigated by depth limits and targeted indexing. Re-evaluate at scale threshold.
2. **Manual seeding required initially** — until auto-scan tooling is built, node/edge creation requires manual API calls or seed scripts
3. **No visual graph browser** — v1 is API-only. Graph visualization (D3.js, Cytoscape) deferred to v2

---

## Compliance

| Check | Criteria |
|-------|----------|
| Constitution §3 (Monolith-first) | No new database — uses existing PostgreSQL |
| Constitution §8 (Documentation) | ADR created for architecture decision |
| ADR-008 (Lifecycle) | `@lifecycle ACTIVE` on all new files |
| ADR-009 (UUID v7) | All primary keys use `@default(uuid(7))` |
| Module pattern | Controller → Service → Prisma, following canonical structure |

---

**End of ADR-011**
