/* @lifecycle ACTIVE — Performance Rules: Database Query Best Practices */
/* @tags backend, database */

# Database Query Performance

## 1. Purpose

Defines database query optimization rules, indexing strategy, and N+1 prevention for Prisma queries.

---

## 2. Field Selection

Always use `select` to fetch only the fields you need:

```typescript
// ❌ Bad: fetches all fields
const users = await prisma.user.findMany();

// ✅ Good: fetches only required fields
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true },
});
```

## 3. Relation Loading

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

## 4. Indexing Rules

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

## 5. Pagination

All list endpoints returning >100 items MUST use pagination:

```typescript
const items = await prisma.recommendation.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});
```

Use cursor-based pagination for high-throughput endpoints (deferred — implement when needed).

## 6. Batch Operations

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

## 7. Query Logging (Development)

```typescript
// In PrismaService constructor
new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

Profile slow queries in development (`prisma:query` log shows duration).

---

**End of Database Query Performance**
