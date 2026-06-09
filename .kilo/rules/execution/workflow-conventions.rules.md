/* @lifecycle ACTIVE — Execution Rules: Workflow Conventions */
/* @tags backend, devops */

# Workflow Conventions

## 1. Purpose

Defines the development workflow, branching strategy, and task lifecycle conventions.

---

## 2. Development Workflow

The standard development cycle is:

```
1. Start Docker services           docker compose up -d
2. Ensure Prisma client is current  npx prisma generate
3. Check migration status           npx prisma migrate status
4. Implement changes               (per task requirements)
5. Run build                       npm run build
6. Run tests                       npx jest --passWithNoTests
7. Update work queue                .kilo/docs/work_queue.md
```

## 3. Execution Contract

All changes MUST follow the canonical execution DAG (Execution Contract §2):

```
REQUEST → ROUTER → PLAN → ARCH → PRE_VERIFY → CODE → POST_VERIFY → COMMIT
```

- No bypassing gates without explicit human approval
- CODE retry limited to max 1 per POST_VERIFY FAIL
- ARCH revision limited to max 1 per BLOCK
- Router is the single entry point for all requests

## 4. Branching

- Branches are managed via git worktrees (Agent Manager creates these automatically)
- Worktree naming: human-readable slug (e.g., `thoughtful-coconut`)
- Base branch: `main`
- Never commit directly to `main`
- One worktree per independent task

## 5. Commit Message Format

```
TASK-XXX — Brief descriptive title

Optional details explaining the what and why.
```

Examples:
```
TASK-025 — Implement Agent Evaluation Harness v1
TASK-022 — Seed recommendations + trust score fixes
```

## 6. Task Tracking

- Task status tracked in `.kilo/docs/work_queue.md`
- Each completed task adds a `### TASK-XXX` entry with:
  - Status and date
  - Steps executed
  - Key results (metrics, file counts, test results)
  - Conclusion
- Active tasks listed in the `## Active` section

## 7. Rule Files

- All rule files go in `.kilo/rules/<category>/<name>.rules.md`
- Lifecycle declaration required on all new rule files (ADR-008)
- Rules must NOT contradict higher-priority sources (Constitution, ADRs, System Contracts)
- Rule updates follow the same execution pipeline as code changes

---

**End of Workflow Conventions**
