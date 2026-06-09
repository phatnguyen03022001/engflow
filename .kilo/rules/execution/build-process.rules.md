/* @lifecycle ACTIVE — Execution Rules: Build Process */
/* @tags backend, infra, devops */

# Build Process

## 1. Purpose

Defines the canonical build process for the Floweng backend application.

---

## 2. Build Commands

| Command | Purpose | When to Run |
|---------|---------|-------------|
| `npm run build` | Compile NestJS TypeScript to JavaScript | Always before commit |
| `npx prisma generate` | Generate Prisma client from schema | After schema changes |
| `npx prisma migrate dev` | Apply schema migrations in development | After model changes |
| `npx prisma migrate deploy` | Apply migrations in production/CI | CI/CD deployment |

## 3. Build Order

```
1. npx prisma generate     # Generate client (if schema changed)
2. npm run build            # Compile TypeScript
3. npx jest --passWithNoTests  # Run tests (verify build integrity)
```

## 4. Prisma Migrations

- Migration naming: `snake_case_descriptive_name` (e.g., `add_evaluation_models`)
- Always review the generated migration SQL before applying
- Never edit generated migration files directly — use `prisma migrate dev --create-only` for custom SQL
- Migration status: `npx prisma migrate status`

## 5. Docker Build

```bash
docker compose up -d --build app    # Rebuild and start app container
docker compose down                  # Stop all containers
docker compose logs -f               # Follow container logs
```

## 6. Build Output

- Compiled output: `backend/dist/` — **GENERATED** per ADR-008
- Never commit `dist/` to version control
- Never modify `dist/` files directly

## 7. Build Failure Recovery

| Error | Action |
|-------|--------|
| TypeScript compilation error | Fix type issues, check imports |
| Prisma client error | Run `npx prisma generate` |
| Module not found | Check `npm install`, verify imports |
| Migration pending | Run `npx prisma migrate dev` |

---

**End of Build Process**
