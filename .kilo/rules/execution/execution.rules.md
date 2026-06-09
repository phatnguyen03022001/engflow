/* @lifecycle ACTIVE — Execution Rules: Build Process, Docker, and Workflow Conventions */
/* @tags backend, infra, devops */

# Execution Rules

## 1. Purpose

Defines the build process, Docker conventions, and development workflow for the Floweng backend.

---

## 2. Build Process

### 2.1 Build Commands

| Command | Purpose | When to Run |
|---------|---------|-------------|
| `npm run build` | Compile NestJS TypeScript to JavaScript | Always before commit |
| `npx prisma generate` | Generate Prisma client from schema | After schema changes |
| `npx prisma migrate dev` | Apply schema migrations in development | After model changes |
| `npx prisma migrate deploy` | Apply migrations in production/CI | CI/CD deployment |

### 2.2 Build Order

```
1. npx prisma generate     # Generate client (if schema changed)
2. npm run build            # Compile TypeScript
3. npx jest --passWithNoTests  # Run tests (verify build integrity)
```

### 2.3 Prisma Migrations

- Migration naming: `snake_case_descriptive_name` (e.g., `add_evaluation_models`)
- Always review the generated migration SQL before applying
- Never edit generated migration files directly — use `prisma migrate dev --create-only` for custom SQL
- Migration status: `npx prisma migrate status`

### 2.4 Docker Build

```bash
docker compose up -d --build app    # Rebuild and start app container
docker compose down                  # Stop all containers
docker compose logs -f               # Follow container logs
```

### 2.5 Build Output

- Compiled output: `backend/dist/` — **GENERATED** per ADR-008
- Never commit `dist/` to version control
- Never modify `dist/` files directly

### 2.6 Build Failure Recovery

| Error | Action |
|-------|--------|
| TypeScript compilation error | Fix type issues, check imports |
| Prisma client error | Run `npx prisma generate` |
| Module not found | Check `npm install`, verify imports |
| Migration pending | Run `npx prisma migrate dev` |

## 3. Docker Conventions

### 3.1 Container Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   engflow (app)     │◄────│  floweng-db (pg)    │
│   Node.js 20        │     │  PostgreSQL 16      │
│   Port 3001         │     │  Port 5432          │
└─────────────────────┘     └─────────────────────┘
```

### 3.2 Docker Compose (`backend/docker-compose.yml`)

| Service | Image | Container Name | Port |
|---------|-------|----------------|------|
| `postgres` | postgres:16-alpine | `floweng-db` | 5432 |
| `app` | Dockerfile (multi-stage) | `engflow` | 3001 |

**Environment Variables:**

| Variable | Service | Purpose |
|----------|---------|---------|
| `POSTGRES_USER=floweng` | postgres | Database user |
| `POSTGRES_PASSWORD=floweng` | postgres | Database password |
| `POSTGRES_DB=floweng` | postgres | Database name |
| `DATABASE_URL` | app | Full PostgreSQL connection string |
| `JWT_SECRET` | app | JWT signing secret |
| `JWT_EXPIRES_IN=7d` | app | JWT token expiry |
| `PORT=3001` | app | Application listen port |

### 3.3 Health Checks

PostgreSQL service MUST have a health check:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U floweng -d floweng']
  interval: 5s
  timeout: 5s
  retries: 5
```

The app service depends on PostgreSQL health: `condition: service_healthy`.

### 3.4 Volume Management

```bash
# Named volume for persistence
volumes:
  pgdata:    # Stops container → data survives
             # docker compose down -v → data deleted

# View volume location
docker volume inspect engflow_pgdata
```

### 3.5 Common Commands

```bash
docker compose up -d              # Start all services
docker compose up -d --build app  # Rebuild and start app
docker compose logs -f            # View logs
docker compose logs -f app        # View app logs
docker compose down               # Stop all services
docker compose down -v            # Stop and delete volumes (⚠️ destroys data)
```

### 3.6 Production vs Development

- **Development:** Docker Compose with hot-reload via mounted volumes (future)
- **Production:** Multi-stage Dockerfile, minimized image, non-root user (`nestjs`)
- Never use development credentials (`floweng/floweng`) in production
- Never expose `DATABASE_URL` without encryption in production

## 4. Workflow Conventions

### 4.1 Development Workflow

```
1. Start Docker services           docker compose up -d
2. Ensure Prisma client is current  npx prisma generate
3. Check migration status           npx prisma migrate status
4. Implement changes               (per task requirements)
5. Run build                       npm run build
6. Run tests                       npx jest --passWithNoTests
7. Update work queue                .kilo/docs/work_queue.md
```

### 4.2 Execution Contract

All changes MUST follow the canonical execution DAG (Execution Contract §2):

```
REQUEST → ROUTER → PLAN → ARCH → PRE_VERIFY → CODE → POST_VERIFY → COMMIT
```

- No bypassing gates without explicit human approval
- CODE retry limited to max 1 per POST_VERIFY FAIL
- ARCH revision limited to max 1 per BLOCK
- Router is the single entry point for all requests

### 4.3 Branching

- Branches are managed via git worktrees (Agent Manager creates these automatically)
- Worktree naming: human-readable slug (e.g., `thoughtful-coconut`)
- Base branch: `main`
- Never commit directly to `main`
- One worktree per independent task

### 4.4 Commit Message Format

```
TASK-XXX — Brief descriptive title

Optional details explaining the what and why.
```

Examples:
```
TASK-025 — Implement Agent Evaluation Harness v1
TASK-022 — Seed recommendations + trust score fixes
```

### 4.5 Task Tracking

- Task status tracked in `.kilo/docs/work_queue.md`
- Each completed task adds a `### TASK-XXX` entry with:
  - Status and date
  - Steps executed
  - Key results (metrics, file counts, test results)
  - Conclusion
- Active tasks listed in the `## Active` section

### 4.6 Rule Files

- All rule files go in `.kilo/rules/<category>/<name>.rules.md`
- Lifecycle declaration required on all new rule files (ADR-008)
- Rules must NOT contradict higher-priority sources (Constitution, ADRs, System Contracts)
- Rule updates follow the same execution pipeline as code changes

---

**End of Execution Rules**
