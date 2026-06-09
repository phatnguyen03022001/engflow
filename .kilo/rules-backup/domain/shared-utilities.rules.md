/* @lifecycle ACTIVE — Domain Rules: Shared Utility Conventions */
/* @tags backend */

# Shared Utilities

## 1. Purpose

Defines rules for shared module utilities, how to add shared code, and what belongs in `SharedModule`.

---

## 2. Directory Structure

```
src/shared/
├── shared.module.ts         # NestJS @Module exporting shared providers
├── filters/
│   └── http-exception.filter.ts   # Centralized error handling
├── interceptors/
│   └── transform.interceptor.ts   # Response transformation
├── prisma/
│   └── prisma.service.ts          # Single Prisma client instance
└── utils/
    └── confidence-interval.util.ts # Pure utility functions
```

## 3. PrismaService

- `PrismaService` is the SINGLE canonical Prisma client
- Never create duplicate Prisma client instances
- Import via `SharedModule` export — never instantiate directly
- Extends `PrismaClient` with `OnModuleInit` lifecycle hook

## 4. Adding Shared Code

New shared utilities require:
1. Placed in appropriate subdirectory (`utils/`, `types/`, etc.)
2. Exported from `SharedModule` providers
3. Pure functions where possible (no side effects)
4. Unit test coverage ≥80%

**Do NOT use `SharedModule` as a dumping ground.** Ask: "Is this utility used by ≥2 modules?" If only 1 module needs it, keep it colocated.

## 5. Shared Types

- Global TypeScript types used across modules go in `shared/`
- Module-specific types stay in their module's `interfaces/` directory

## 6. Existing Shared Utilities

| File | Purpose |
|------|---------|
| `prisma.service.ts` | Prisma client singleton |
| `http-exception.filter.ts` | Centralized exception filter |
| `transform.interceptor.ts` | Response transform interceptor |
| `confidence-interval.util.ts` | Statistical CI computation |

---

**End of Shared Utilities**
