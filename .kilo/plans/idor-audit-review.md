# IDOR Audit Plan — Authorization Boundary Review

## Summary

Audit all HTTP endpoints in the Floweng backend for Insecure Direct Object Reference (IDOR) vulnerabilities. The audit determines whether user A can read/update/delete user B's data by manipulating an ID parameter in the request.

**Pre-audit findings** (codebase exploration completed):
- Most resources are **system-level** (no `userId` field in schema): Recommendation, AgentMemory, AgentExecution, KnowledgeNode/Edge, ModelRegistry, etc.
- **Only 2 models have user ownership:** `User` (self) and `UserLesson` (via `userId`)
- **UserLesson has no exposed endpoints** — no IDOR risk via API
- **1 confirmed IDOR vulnerability** already detected in pre-audit (`GET /users/:id`)

---

## Phase 1 — Resource Ownership Inventory

### Models with user ownership

| Model | PK | Owner Field | Owner Type | Notes |
|-------|----|-------------|------------|-------|
| User | `id` | self (by `id`) | self | No FK to another user |
| UserLesson | `id` | `userId` | user | FK → User, no endpoints exposed |

### Models WITHOUT user ownership (system-level, NOT in scope)

Recommendation, Checkpoint, RecommendationOption, AgentMemory, DecisionMemory, TrustScore, AccuracySnapshot, AgentExecution, ExecutionPhase, AgentMetric, MetricDimension, ModelProvider, ModelRegistry, ModelRoute, FallbackChain, CostLog, KnowledgeNode, KnowledgeEdge, DriftEvent, Lesson, Exercise

> These are architecturally shared/collaborative resources — no user ownership to bypass. Mark as **NOT APPLICABLE** (N/A) for IDOR.

---

## Phase 2 — Endpoint Inventory

### User Controller (`/users`)

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 1 | `GET /users` | List all users | JWT | — | N/A (list) |
| 2 | `GET /users/me` | Get own profile | JWT | No | Uses `req.user.id` |
| 3 | `PATCH /users/me` | Update own profile | JWT | No | Uses `req.user.id` |
| 4 | `PATCH /users/me/avatar` | Upload avatar | JWT | No | Uses `req.user.id` |
| 5 | `GET /users/:id` | Get user by ID | JWT | `:id` | **NONE** |

### Recommendation Controller (`/recommendations`)

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 6 | `POST /` | Create | JWT | No | System-level |
| 7 | `GET /` | List | JWT | No | System-level |
| 8 | `GET /stats` | Metrics | JWT | No | System-level |
| 9 | `GET /status-summary` | Summary | JWT | No | System-level |
| 10 | `GET /executive-review` | Report | JWT | No | System-level |
| 11 | `GET /trust-scores` | Trust scores | JWT | No | System-level |
| 12 | `POST /trust-scores/recalculate` | Recalc | JWT | No | System-level |
| 13 | `GET /:id` | Get by ID | JWT | `:id` | System-level |
| 14 | `PATCH /:id/status` | Update status | JWT | `:id` | System-level |
| 15 | `DELETE /:id` | Delete | JWT | `:id` | System-level |
| 16 | `POST /:id/checkpoints` | Upsert checkpoint | JWT | `:id` | System-level |
| 17 | `GET /:id/checkpoints` | Get checkpoints | JWT | `:id` | System-level |
| 18 | `GET /decision-memory` | Query | JWT | No | System-level |
| 19 | `GET /accuracy-snapshots/latest` | Snapshot | JWT | No | System-level |
| 20 | `POST /accuracy-snapshots` | Create snapshot | JWT | No | System-level |
| 21 | `POST /ask-ingest` | Ingest | JWT | No | System-level |

### Memory Controller (`/memories`)

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 22 | `POST /` | Create | JWT | No | System-level |
| 23 | `GET /similar` | Query similar | JWT | No | System-level |
| 24 | `GET /patterns/successful` | Patterns | JWT | No | System-level |
| 25 | `GET /patterns/failed` | Failed patterns | JWT | No | System-level |
| 26 | `GET /summary` | Summary | JWT | No | System-level |
| 27 | `GET /agent-context` | Agent context | API key | No | System-level |
| 28 | `POST /context/assemble` | Assemble | JWT | No | System-level |
| 29 | `POST /from-execution/:executionId` | From execution | JWT | `:executionId` | System-level |

### Evaluation Controller (`/evaluations`)

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 30 | `POST /executions` | Create execution | JWT | No | System-level |
| 31 | `GET /executions` | List executions | JWT | No | System-level |
| 32 | `POST /executions/:executionId/phases` | Add phase | JWT | `:executionId` | System-level |
| 33 | `GET /metrics/summary` | Summary | JWT | No | System-level |
| 34 | `GET /metrics` | Metrics | JWT | No | System-level |
| 35 | `POST /metrics/recalculate` | Recalc | JWT | No | System-level |
| 36 | `GET /analytics/agent-performance` | Perf | JWT | No | System-level |
| 37 | `GET /analytics/throughput` | Throughput | JWT | No | System-level |
| 38 | `GET /analytics/bottlenecks` | Bottlenecks | JWT | No | System-level |
| 39 | `GET /analytics/cost-trends` | Cost | JWT | No | System-level |
| 40 | `GET /drift` | Drift events | JWT | No | System-level |
| 41 | `POST /drift/detect` | Detect drift | JWT | No | System-level |
| 42 | `POST /self-heal` | Retry all | JWT | No | System-level |
| 43 | `POST /self-heal/:executionId` | Retry one | JWT | `:executionId` | System-level |
| 44 | `GET /executions/:executionId` | Get execution | JWT | `:executionId` | System-level |

### Knowledge Controller (`/knowledge`)

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 45 | `POST /nodes` | Create node | JWT+ADMIN | No | System-level |
| 46 | `GET /nodes` | List nodes | JWT | No | System-level |
| 47 | `GET /nodes/:nodeId` | Get node | JWT | `:nodeId` | System-level |
| 48 | `PATCH /nodes/:nodeId` | Update node | JWT+ADMIN | `:nodeId` | System-level |
| 49 | `DELETE /nodes/:nodeId` | Deactivate | JWT+ADMIN | `:nodeId` | System-level |
| 50 | `POST /edges` | Create edge | JWT+ADMIN | No | System-level |
| 51 | `GET /edges` | List edges | JWT | No | System-level |
| 52 | `DELETE /edges/:edgeId` | Delete edge | JWT+ADMIN | `:edgeId` | System-level |
| 53 | `GET /graph/query` | Impact analysis | JWT | query | System-level |
| 54 | `GET /graph/impact` | Impact by depth | JWT | query | System-level |
| 55 | `GET /graph/trace` | Path trace | JWT | query | System-level |
| 56 | `GET /graph/neighbors` | Neighbors | JWT | query | System-level |
| 57 | `POST /sync` | Sync | JWT+ADMIN | No | System-level |

### Learning Controller (`/learning`)

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 58 | `GET /lessons` | List lessons | JWT | No | System-level |
| 59 | `GET /lessons/:id` | Get lesson | JWT | `:id` | System-level |
| 60 | `POST /lessons` | Create lesson | JWT | No | System-level |

### Auth Controller (`/auth`) — public, no auth

| # | Endpoint | Operation | Auth | Param ID | Owner Check |
|---|----------|-----------|------|----------|-------------|
| 61 | `POST /register` | Register | None | No | N/A |
| 62 | `POST /login` | Login | None | No | N/A |

### Model Registry Controller (`/model-registry`)

All endpoints: System-level + ADMIN-only. N/A for IDOR.

---

## Phase 3 — Ownership Validation Trace

### Endpoint-by-endpoint analysis

#### `GET /users/:id` — **CONFIRMED VULNERABLE**

**Controller** (line 79-81):
```typescript
@Get(':id')
findById(@Param('id') id: string) {
  return this.userService.findById(id);
}
```

**Service** (line 24-40):
```typescript
async findById(id: string) {
  const user = await this.prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
  });
  if (!user) throw new NotFoundException('User not found');
  return user;
}
```

**Issue**: The method accepts only `(id: string)` — no `userId` or `actor` parameter. No ownership check. Any authenticated user can supply any `id` and read that user's profile.

**Exposed fields**: `id`, `email`, `name`, `role`, `avatarUrl`, `createdAt`

#### `GET /users` — **AUTHORIZATION GAP (not IDOR but related)**

**Controller** (line 71-74):
```typescript
@Get()
findAll() {
  return this.userService.findAll();
}
```

**Issue**: Missing `@Roles(UserRole.ADMIN)` guard. Any authenticated user can enumerate all users. Not strictly IDOR (no user-to-user data access), but a data exposure concern.

#### `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/avatar` — **SAFE**

All use `req.user.id` from JWT token. Self-owned operations. No parameter-driven access.

#### `GET /recommendations/:id` — **SAFE (system-level)**

Recommendation has no `userId` field. The resource is architecturally shared. No user ownership to bypass.

#### `GET /memories/from-execution/:executionId` — **SAFE (system-level)**

AgentMemory has no `userId`. System-level resource.

#### `GET /evaluations/executions/:executionId` — **SAFE (system-level)**

AgentExecution has no `userId`. System-level resource.

#### `GET /knowledge/nodes/:nodeId` — **SAFE**

KnowledgeNode has no `userId`. System-level. Writes are ADMIN-only.

#### `GET /learning/lessons/:id` — **SAFE (system-level)**

Lesson has no `userId`. System-level.

#### Nested resource: `POST /recommendations/:id/checkpoints`, `GET /recommendations/:id/checkpoints` — **SAFE**

Checkpoint has no owner field. Request is validated by recommendation existence check. System-level.

#### Nested resource: `POST /evaluations/executions/:executionId/phases` — **SAFE**

ExecutionPhase has no owner field. System-level.

---

## Phase 4 — Service Layer Audit

### Service methods that accept only `(id: string)` — potential risk if user-owned

| Service | Method | Signature | Has Owner Check? | Risk |
|---------|--------|-----------|-----------------|------|
| UserService | `findById` | `(id: string)` | ❌ No | HIGH — used by `GET /users/:id` |
| UserService | `update` | `(id: string, dto)` | ✅ Called with `req.user.id` | Safe in current usage |
| UserService | `updateAvatar` | `(userId: string, file)` | ✅ Called with `req.user.id` | Safe |
| RecommendationService | `findById` | `(id: string)` | N/A (system-level) | Safe |
| RecommendationService | `remove` | `(id: string)` | N/A (system-level) | Safe |
| ExecutionTraceService | `findByExecutionId` | `(executionId: string)` | N/A (system-level) | Safe |
| KnowledgeGraphService | `findNodeByNodeId` | `(nodeId: string)` | N/A (system-level) | Safe |
| LearningService | `getLesson` | `(id: string)` | N/A (system-level) | Safe |

**Recommendation**: `UserService.findById(id)` should be refactored to either:
1. Accept an `actorId` parameter and enforce ownership, or
2. Be restricted to ADMIN-only (via `@Roles` guard).

---

## Phase 5 — Query-Level Authorization

### Prisma queries without ownership filter

**`UserService.findById`** (line 25):
```typescript
this.prisma.user.findUnique({ where: { id } });
// ❌ No userId filter — IDOR confirmed
```

**Should be** (for self-owned access):
```typescript
this.prisma.user.findFirst({
  where: { id, id: actorId }, // only if actorId === id
});
```

**All other Prisma queries** in the codebase operate on system-level models without `userId` fields. The authorization boundary is architectural, not per-row.

---

## Phase 6 — Horizontal Privilege Escalation Test Plan

### Test Case 1: User Profile Enumeration

```
Request:
  GET /users
  Authorization: Bearer <user-a-jwt>

Expected: Should fail (403) for non-admin
Actual: Returns all users (AUTHORIZATION GAP)
```

### Test Case 2: User Profile IDOR

```
Setup:
  User A has id = "user-a-uuid"
  User B has id = "user-b-uuid"

Request:
  GET /users/user-b-uuid
  Authorization: Bearer <user-a-jwt>

Expected: Should fail (403 or 404)
Actual: Returns User B's profile with email, name, role (IDOR CONFIRMED)
```

### Test Case 3: All Other Param-driven Endpoints

For every `@Param('id')` or `@Param(':xxx')` endpoint, attempt to access with another user's JWT:

| Endpoint | Attempt | Expected | Risk |
|----------|---------|----------|------|
| `GET /recommendations/:id` | Other user's JWT | System-level, OK | None |
| `DELETE /recommendations/:id` | Other user's JWT | System-level, OK | None |
| `GET /evaluations/executions/:executionId` | Other user's JWT | System-level, OK | None |
| `GET /knowledge/nodes/:nodeId` | Other user's JWT | System-level, OK | None |
| `GET /learning/lessons/:id` | Other user's JWT | System-level, OK | None |
| `GET /memories/from-execution/:executionId` | Other user's JWT | System-level, OK | None |

---

## Phase 7 — Nested Resource Audit

No nested resources are user-owned. All nested routes (checkpoints under recommendations, phases under executions) inherit from system-level parents. No `userId` chain exists to bypass.

---

## Phase 8 — Admin Boundary Review

### Controllers with `RolesGuard` + `@Roles(UserRole.ADMIN)`

| Controller | Admin-only endpoints | Notes |
|-----------|---------------------|-------|
| KnowledgeController | POST/PATCH/DELETE nodes, POST/DELETE edges, POST sync | ✅ Properly guarded |
| ModelRegistryController | ALL CRUD operations | ✅ Properly guarded |

### Issues found

| Issue | Detail | Severity |
|-------|--------|----------|
| `GET /users` missing admin guard | Any authenticated user can list all users (email, name, role) | MEDIUM |
| `GET /users/:id` no ownership check | Any authenticated user can read any user's profile | **HIGH** |

---

## Deliverable — Final Audit Table

### IDOR Vulnerability Assessment

| Resource | Read | Update | Delete | Status | Notes |
|----------|------|--------|--------|--------|-------|
| User (self via `me`) | SAFE | SAFE | N/A | PASS | Uses `req.user.id` |
| User (by `:id`) | **VULNERABLE** | N/A | N/A | **FAIL** | No ownership check |
| User (list all) | **AUTHORIZATION GAP** | N/A | N/A | **FLAG** | Missing admin guard |
| Recommendation | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| Checkpoint | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| AgentMemory | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| AgentExecution | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| ExecutionPhase | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| AgentMetric | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| KnowledgeNode | SAFE | SAFE | SAFE | PASS | System-level (writes=ADMIN) |
| KnowledgeEdge | SAFE | SAFE | SAFE | PASS | System-level (writes=ADMIN) |
| ModelProvider | SAFE | SAFE | SAFE | PASS | ADMIN-only |
| ModelRegistry | SAFE | SAFE | SAFE | PASS | ADMIN-only |
| ModelRoute | SAFE | SAFE | SAFE | PASS | ADMIN-only |
| FallbackChain | SAFE | SAFE | SAFE | PASS | ADMIN-only |
| CostLog | SAFE | SAFE | SAFE | PASS | System-level |
| DriftEvent | SAFE | SAFE | SAFE | PASS | System-level |
| Lesson | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| Exercise | SAFE | SAFE | SAFE | PASS | System-level, no owner |
| UserLesson | N/A (no endpoint) | N/A | N/A | N/A | Has `userId` but no API exposure |

---

## Recommended Remediations

### Priority 1 (HIGH) — IDOR Fix

**`GET /users/:id`** — Three options:

**Option A — Remove endpoint** (if not needed for business):
```typescript
// Delete the route entirely; only /users/me is needed
```

**Option B — Add admin guard**:
```typescript
@Get(':id')
@Roles(UserRole.ADMIN)
findById(@Param('id') id: string) {
  return this.userService.findById(id);
}
```

**Option C — Ownership check** (if selective cross-user read is needed):
```typescript
@Get(':id')
findById(@Param('id') id: string, @Request() req: any) {
  if (id !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ForbiddenException();
  }
  return this.userService.findById(id);
}
```

### Priority 2 (MEDIUM) — Authorization Gap

**`GET /users`** — Add admin guard:
```typescript
@Get()
@Roles(UserRole.ADMIN)
findAll() {
  return this.userService.findAll();
}
```

### Priority 3 (LOW) — Future-proofing

If `UserLesson` endpoints are added later, the service **must** enforce `userId` on every `:id` lookup:
```typescript
// Required pattern for UserLesson:
async findById(id: string, userId: string) {
  return this.prisma.userLesson.findFirst({
    where: { id, userId },  // ownership enforced at query layer
  });
}
```

Also add `UserLesson` ownership documentation to the shared conventions so future devs don't miss it.

---

## Execution Tasks

1. **Fix `GET /users/:id`** — Add ownership check or admin guard to UserController.findById
2. **Fix `GET /users`** — Add `@Roles(UserRole.ADMIN)` guard
3. **Update `UserService.findById`** — Either remove the method or add an `actorId` parameter
4. **Write unit tests** — Verify IDOR is blocked:
   - User B cannot read User A's profile via `GET /users/:id`
   - Non-admin cannot list all users via `GET /users`
   - User can still read own profile via `GET /users/me`
5. **Regression check** — Verify no existing functionality depends on unrestricted user listing
6. **Document UserLesson ownership pattern** — In `.kilo/rules/` so future module additions enforce `userId` checks
