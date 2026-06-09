/* @lifecycle ACTIVE — ADR-012: Context Manager Architecture */

# ADR-012 — Context Manager: Dynamic Context Assembly for Agents

**Status:** Active
**Created:** 2026-06-09
**Author:** Architect Agent
**Supersedes:** None
**Superseded By:** None
**References:** ADR-008, ADR-011, Constitution §7, Architecture L3

---

## Context

Each agent in the Floweng AI Software Factory currently loads its own context independently. This leads to several problems:

1. **Inconsistent context assembly** — each agent has its own logic for loading memories, rules, and ADRs, leading to behavioral differences
2. **No token budget management** — agents may exceed context limits or waste tokens on low-value context
3. **No caching** — context assembled multiple times within the same session is re-computed from scratch
4. **No compression** — all context is loaded at full fidelity regardless of relevance

Architecture Layer 3 (Cognition) identifies a "Context Manager" as a core capability, but no concrete implementation exists. The `memory/` module (8 files, 35 tests) already provides agent memory CRUD and context retrieval — this ADR extends that foundation rather than creating a new module.

---

## Decision

### §1. Extend `memory/` Module (No New Module)

`ContextManagerService` is added to the existing `memory/` module, inheriting from `MemoryService`. This avoids unnecessary module proliferation (Constitution §7).

```
backend/src/memory/
├── memory.module.ts
├── memory.controller.ts
├── services/
│   ├── memory.service.ts              # Existing: CRUD for agent memories
│   └── context-manager.service.ts     # New: multi-source context assembly
├── dto/
│   └── ...
├── interfaces/
│   └── ...
└── __tests__/
    ├── memory.service.spec.ts
    └── context-manager.service.spec.ts  # New tests
```

### §2. Multi-Source Assembly

`ContextManagerService` assembles context from four sources, in priority order:

| Source | Description | Tier |
|--------|-------------|------|
| AgentMemories | Recent agent memories from `memory/` module | Tier 1 |
| KnowledgeGraph | Relevant nodes + edges from `knowledge/` module (ADR-011) | Tier 2 |
| Rules files | Constitution, ADRs, System Contracts, Agent Rules | Tier 3 |
| Architecture docs | `architecture.md`, `system-specification.md` | Tier 3 |

### §3. Token Budget Strategy

Three compression tiers, selected based on task complexity:

| Tier | Budget | Sources Included | Use Case |
|------|--------|-----------------|----------|
| Tier 1 | 8K tokens | Core memories only | Simple LEVEL_1 tasks (bug fixes, minor changes) |
| Tier 2 | 16K tokens | + Knowledge Graph context | LEVEL_2 tasks (feature development) |
| Tier 3 | 32K tokens | + Rules + ADRs | LEVEL_3 tasks (architecture, cross-module changes) |

**Compression techniques:**
- Deduplicate overlapping context
- Truncate low-relevance memories (relevance score < threshold)
- Summarize long rule files rather than including full text
- Strip code examples from rule files when not needed

### §4. In-Memory Caching

Context results are cached using NestJS `cache-manager` with 5-minute TTL. Cache key is `context:{agentType}:{taskType}:{sessionId}`.

**Invalidation:** Cache is invalidated when:
- New agent memories are written for the session
- Knowledge Graph is modified
- TTL expires (5 minutes)

### §5. Integration with Knowledge Graph

When Tier 2 or Tier 3 context is requested, `ContextManagerService` queries the Knowledge Graph (ADR-011) for nodes related to the current task's scope. This enables:
- Finding related modules affected by a change
- Loading relevant ADRs for the module being modified
- Identifying test files related to the code being changed

---

## Consequences

### Positive

1. **Consistent context** — all agents use the same assembly logic, reducing behavioral variance
2. **Token efficiency** — tiered compression prevents context overflow and reduces costs
3. **No new module** — extends existing `memory/` module per Constitution §7
4. **Knowledge-aware** — integrates with ADR-011 Knowledge Graph for relevance-based context selection
5. **Cached performance** — in-memory cache reduces repeated assembly overhead

### Negative

1. **Increased complexity in memory module** — `context-manager.service.ts` adds ~200 lines to the module
2. **Cache staleness** — 5-minute TTL may serve stale context during rapid task iterations
3. **Knowledge Graph dependency** — Tier 2/3 context requires ADR-011 to be implemented first

---

## Compliance

| Check | Criteria |
|-------|----------|
| Constitution §7 (Simplicity) | No new module — extends existing `memory/` |
| Caching conventions | In-memory cache-first, documented TTL and invalidation |
| ADR-011 | Consumes Knowledge Graph for Tier 2+ context |
| ADR-008 (Lifecycle) | `@lifecycle ACTIVE` on all new files |
| Module pattern | Follows existing `memory/` service patterns |

---

**End of ADR-012**
