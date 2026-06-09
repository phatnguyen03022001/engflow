/* @lifecycle ACTIVE — Domain Rules: Prisma Schema Conventions */
/* @tags backend, database */

# Prisma Conventions

## 1. Purpose

Defines canonical conventions for Prisma schema design, model definition, indexing, and naming.

Reference file: `backend/prisma/schema.prisma`

---

## 2. Model Naming

- Models: singular PascalCase (`Recommendation`, not `Recommendations`)
- Field names: camelCase with `@map("snake_case")` for database columns
- Enums: singular PascalCase (`Difficulty`, `UserRole`)
- Table names: snake_case via `@@map("table_name")`

## 3. Field Conventions

| Field | Type | Convention |
|-------|------|------------|
| Primary Key | `String @id @default(uuid(7))` | UUID v7, never autoincrement |
| Created At | `DateTime @default(now()) @map("created_at")` | Always present |
| Updated At | `DateTime @updatedAt @map("updated_at")` | Always present |
| Foreign Key | `String @map("entity_id")` | snake_case FK name |
| Soft Deletes | Not used (hard deletes with cascade) | Until explicitly needed |

## 4. Index Strategy

- Single-field indexes on columns used in `where` or `orderBy`
- Compound indexes on multi-field query patterns: `@@index([field1, field2])`
- Unique compound constraints: `@@unique([field1, field2])`
- Always add indexes on FK fields used in relations
- Time-range queries should use `createdAt` index

## 5. Relations

- `onDelete: Cascade` for child records (exercises cascade from lesson)
- Required relations use `@relation(fields: [...], references: [...])`
- Always name the relation reference field explicitly
- Use `@@map("table_name")` for all models

## 6. Enum Definitions

- Define before first model that uses them
- PascalCase values: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`
- Default value: `@default(<FIRST_VALUE>)`

## 7. Schema Organization

Use section comment markers to group related models:

```prisma
// ─── Module Name (TASK-XXX) ──────────────────────────────────────
```

Keep models in a single `schema.prisma` file. Extract only if file exceeds 500 lines.

---

**End of Prisma Conventions**
