/* @lifecycle ACTIVE — Performance Rules: Caching Conventions */
/* @tags backend, architecture */

# Caching Conventions

## 1. Purpose

Defines when and how caching should be introduced, what caching strategies to prefer, and what to avoid.

---

## 2. Current State

**No caching infrastructure** is currently deployed. Per Constitution §7 (Simplicity) and the monolith-first principle, caching should only be introduced when there is measurable evidence of a caching-needy bottleneck.

## 3. Caching Decision Tree

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

## 4. Caching Strategy (When Approved)

### 4.1 In-Memory Cache (First Choice)

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

### 4.2 Cache Invalidation

- Each cached entity MUST have a documented invalidation strategy
- Invalidate on write (cache-aside pattern): `set()` after write, or `del()` to invalidate
- Never use time-based expiration alone for cache consistency

## 5. Prohibited Patterns

- No caching of user-specific data without user-scoped cache keys
- No caching without a documented TTL
- No caching without invalidation strategy
- No Redis without an ADR

## 6. Monitoring

When caching is implemented, add:
- Cache hit/miss ratio metrics
- Cache size tracking
- Invalidation rate tracking
- Stale data detection (warn when serving cached data beyond expected freshness)

---

**End of Caching Conventions**
