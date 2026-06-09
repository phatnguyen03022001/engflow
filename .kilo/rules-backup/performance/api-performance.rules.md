/* @lifecycle ACTIVE — Performance Rules: API Performance Targets */
/* @tags backend, architecture */

# API Performance

## 1. Purpose

Defines API response time targets, pagination requirements, and response optimization rules.

---

## 2. Response Time Targets

| Endpoint Type | p50 Target | p95 Target | Measurement |
|---------------|-----------|-----------|-------------|
| Read (single entity) | <100ms | <300ms | Response time, no auth overhead |
| Read (list) | <200ms | <500ms | Including pagination overhead |
| Write (create) | <200ms | <500ms | Including validation + DB write |
| Write (update) | <200ms | <500ms | Including validation + DB write |
| Write (bulk) | <500ms | <2s | Including transaction overhead |
| Auth (login/register) | <300ms | <1s | Including password hashing |

## 3. Pagination Rules

| List Size | Requirement | Implementation |
|-----------|-------------|----------------|
| ≤100 items | No pagination required | Simple `findMany()` |
| 100–10,000 items | Offset pagination | `skip`/`take` |
| >10,000 items | Cursor pagination | Deferred — implement when needed |

Default page size: 20 items. Max page size: 100 items.

## 4. Response Size Optimization

- Never return entire entity objects when only subsets are needed
- Use `select` in Prisma queries to limit returned fields
- For list endpoints, prefer flat DTOs over deeply nested structures
- Consider `@Transform` to exclude null/empty fields from response

## 5. N+1 Prevention

Watch for N+1 at these common boundaries:
- Controller → Service loop calling Prisma (batch the queries)
- Service → nested relation access (use `include` or batch)
- Serialization with lazy-loaded relations (eager-load or exclude)

See `database-query.rules.md` for detailed N+1 prevention patterns.

## 6. Endpoint Design for Performance

- Dedicated endpoints > generic over-fetching endpoints
- `POST /api/v1/recommendations/trust-scores/recalculate` >
  `PUT /api/v1/recommendations/:id?recalculateTrustScores=true`
- Batch endpoints > multiple single-call endpoints
- Async processing (cron/scheduler) > synchronous computation for heavy operations

## 7. Current Performance Baseline

Measured from TASK-021 smoke tests:
- Auth register: ~150ms (create user + hash password + generate JWT)
- Auth login: ~100ms (verify password + generate JWT)
- User profile: ~50ms (single user lookup)

---

**End of API Performance**
