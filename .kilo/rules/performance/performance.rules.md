/* @lifecycle ACTIVE — Performance Rules: API, Database, and Caching */
/* @tags backend, architecture, database */

# Performance Rules

## 1. Purpose

Defines API response time targets, database query optimization, and caching conventions for the Floweng backend.

---

## 2. API Performance

### 2.1 Response Time Targets

| Endpoint Type | p50 Target | p95 Target | Measurement |
|---------------|-----------|-----------|-------------|
| Read (single entity) | <100ms | <300ms | Response time, no auth overhead |
| Read (list) | <200ms | <500ms | Including pagination overhead |
| Write (create) | <200ms | <500ms | Including validation + DB write |
| Write (update) | <200ms | <500ms | Including validation + DB write |
| Write (bulk) | <500ms | <2s | Including transaction overhead |
| Auth (login/register) | <300ms | <1s | Including password hashing |

### 2.2 Pagination Rules

| List Size | Requirement | Implementation |
|-----------|-------------|----------------|
| ≤100 items | No pagination required | Simple `findMany()` |
| 100–10,000 items | Offset pagination | `skip`/`take` |
| >10,000 items | Cursor pagination | Deferred — implement when needed |

Default page size: 20 items. Max page size: 100 items.

### 2.3 Response Size Optimization

- Never return entire entity objects when only subsets are needed
- Use `select` in Prisma queries to limit returned fields
- For list endpoints, prefer flat DTOs over deeply nested structures
- Consider `@Transform` to exclude null/empty fields from response

### 2.4 N+1 Prevention

Watch for N+1 at these common boundaries:
- Controller → Service loop calling Prisma (batch the queries)
- Service → nested relation access (use `include` or batch)
- Serialization with lazy-loaded relations (eager-load or exclude)

### 2.5 Endpoint Design for Performance

- Dedicated endpoints > generic over-fetching endpoints
- `POST /api/v1/recommendations/trust-scores/recalculate` >
  `PUT /api/v1/recommendations/:id?recalculateTrustScores=true`
- Batch endpoints > multiple single-call endpoints
- Async processing (cron/scheduler) > synchronous computation for heavy operations

### 2.6 Current Performance Baseline

Measured from TASK-021 smoke tests:
- Auth register: ~150ms (create user + hash password + generate JWT)
- Auth login: ~100ms (verify password + generate JWT)
- User profile: ~50ms (single user lookup)

## 3. Database Query Performance

### 3.1 Field Selection

Always use `select` to fetch only the fields you need:

```typescript
// ❌ Bad: fetches all fields
const users = await prisma.user.findMany();

// ✅ Good: fetches only required fields
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true },
});
```

### 3.2 Relation Loading

```typescript
// ❌ Bad: N+1 query — loads relations lazily in a loop
const users = await prisma.user.findMany();
for (const user of users) {
  const lessons = await prisma.userLesson.findMany({ where: { userId: user.id } });
}

// ✅ Good: use include for eager loading (when all children needed)
const users = await prisma.user.findMany({
  include: { userLessons: true },
});

// ✅ Better: batch loading with dedicated queries
const users = await prisma.user.findMany();
const userIds = users.map(u => u.id);
const lessons = await prisma.userLesson.findMany({
  where: { userId: { in: userIds } },
});
```

### 3.3 Indexing Rules

Add indexes based on query patterns:

```prisma
// Single-field index for frequent where/orderBy columns
@@index([email])

// Compound index for multi-field filters
@@index([status, createdAt])

// FK indexes for relation joins
@@index([userId])

// Unique compound for pair uniqueness
@@unique([userId, lessonId])
```

Check `npx prisma validate` after schema changes to verify index coverage.

### 3.4 Pagination

All list endpoints returning >100 items MUST use pagination:

```typescript
const items = await prisma.recommendation.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});
```

Use cursor-based pagination for high-throughput endpoints (deferred — implement when needed).

### 3.5 Batch Operations

```typescript
// Batch create (one transaction, one query)
await prisma.exercise.createMany({
  data: exercises,
});

// Batch update with transaction
await prisma.$transaction(
  updates.map(u => prisma.user.update({ where: { id: u.id }, data: u.data }))
);
```

### 3.6 Query Logging (Development)

```typescript
// In PrismaService constructor
new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

Profile slow queries in development (`prisma:query` log shows duration).

## 4. Caching Conventions

### 4.1 Current State

**No caching infrastructure** is currently deployed. Per Constitution §7 (Simplicity) and the monolith-first principle, caching should only be introduced when there is measurable evidence of a caching-needy bottleneck.

### 4.2 Caching Decision Tree

Before implementing caching, answer:

```
1. Is there a measured performance problem?    → No → Stop. Don't cache.
   ↓ Yes
2. Can the query be optimized instead?         → Yes → Optimize query. Don't cache.
   ↓ No
3. Is the data read > write by ≥10:1?          → No → Cache will stale frequently. Don't cache.
   ↓ Yes
4. Can in-memory cache meet the requirement?   → Yes → Use NestJS in-memory cache (no Redis).
   ↓ No
5. Is Redis the right solution?                → Evaluate. Requires ADR for new dependency.
```

### 4.3 In-Memory Cache (First Choice)

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MyService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getData(key: string) {
    const cached = await this.cacheManager.get(key);
    if (cached) return cached;

    const data = await this.fetchExpensiveData(key);
    await this.cacheManager.set(key, data, 300_000); // 5 min TTL
    return data;
  }
}
```

### 4.4 Cache Invalidation

- Each cached entity MUST have a documented invalidation strategy
- Invalidate on write (cache-aside pattern): `set()` after write, or `del()` to invalidate
- Never use time-based expiration alone for cache consistency

### 4.5 Prohibited Patterns

- No caching of user-specific data without user-scoped cache keys
- No caching without a documented TTL
- No caching without invalidation strategy
- No Redis without an ADR

### 4.6 Monitoring

When caching is implemented, add:
- Cache hit/miss ratio metrics
- Cache size tracking
- Invalidation rate tracking
- Stale data detection (warn when serving cached data beyond expected freshness)

---

**End of Performance Rules**
