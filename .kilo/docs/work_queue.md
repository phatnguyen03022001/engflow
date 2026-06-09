/* @lifecycle ACTIVE — Work queue tracking completed and pending tasks */

# Work Queue

## Active

## Finished
### TASK-033 — Layer 9 Stabilization & Smoke Test
- **Status**: Completed
- **Date**: 2026-06-09
- **Delivered**:
  - Seed data: DeepSeek provider, 2 models, 15 routes, 3 fallback chains
  - Fixed: recommendation.module.ts missing MemoryModule import
  - Fixed: cost-tracker.service.ts modelId validation (500→404)
  - All 7 endpoints smoke-tested and verified
- **Build**: zero errors
- **Tests**: 267/267 pass

### TASK-032 — Layer 9: Model Registry v1 (ADR-010)
- **Status**: Completed
- **Date**: 2026-06-09
- **Delivered**:
  - 5 Prisma models (ModelProvider, ModelRegistry, ModelRoute, FallbackChain, CostLog)
  - Module: backend/src/model-registry/ (18 files)
  - 4 services: Registry, Router, CostTracker, Fallback
  - 16 API endpoints
  - Auth: RolesGuard + agent API key pattern
  - Integration: metric.service.ts onExecutionCommitted() → CostLog
  - Tests: 67 new unit tests
- **Build**: zero errors
- **Tests**: 266/266 pass (19 suites)
- **Schema**: 15 → 20 models

### TASK-029 — DecisionMemory Generalization
- **Status**: Completed
- **Date**: 2026-06-08
- **Delivered**:
  - AgentMemory model (Prisma schema + migration)
  - MemoryModule (service, controller, scheduler, DTOs, interfaces)
  - Context retrieval APIs (similar, patterns/successful, patterns/failed, summary)
  - Evaluation integration (onExecutionCommitted in MetricService)
  - DecisionMemory backward-compatible delegation (dual-write)
  - Migration tooling (prisma/migrate-decision-memory.ts)
  - Test coverage (35 new unit tests, E2E mock fixes, 182/182 pass)
- **Build**: zero errors
- **Tests**: 182/182 unit pass, 3/3 e2e pass
### TASK-028 — CI/CD Foundation
- **Status**: Done
- **Date**: 2026-06-08
- **Steps executed**:
  1. Created `.github/workflows/ci.yml` — CI pipeline with 4 jobs: lint-and-validate, test-backend, build-frontend, docker-build
  2. Created `.kilo/validate/check-constitution.sh` — Constitution compliance checker (§4, §8)
  3. Added `engines: { node: ">=20" }` to `backend/package.json`
  4. Created `.nvmrc` — Node.js 20 version enforcement
  5. Fixed `backend/src/main.ts` → replaced `console.log` with NestJS `Logger`
  6. CI workflow features: lifecycle validation on PR changed files, constitution checks, Prisma client caching, coverage artifact upload, Docker build on main only
- **New files**: 4 (ci.yml, check-constitution.sh, .nvmrc)
- **Modified files**: 2 (backend/package.json, backend/src/main.ts)
- **Build**: zero errors
- **Tests**: 147/147 unit pass, 3/3 e2e pass
- **Constitution validation**: PASS (no violations)
- **Lifecycle validation**: PASS (all new/modified files valid)
### TASK-027 — Phase A Governance Foundation
- **Status**: Done
- **Date**: 2026-06-08
- **Steps executed**:
  1. Created `.kilo/rules/domain/` — 4 files: module-patterns, prisma-conventions, dto-validation, shared-utilities
  2. Created `.kilo/rules/quality/` — 3 files: testing-standards, code-review-checklist, code-standards
  3. Created `.kilo/rules/execution/` — 4 files: build-process, test-execution, docker-conventions, workflow-conventions
  4. Created `.kilo/rules/performance/` — 3 files: database-query, api-performance, caching-conventions
  5. Added 3 agent blocks (`code`, `pre_verify`, `post_verify`) to `.kilo/kilo.jsonc` with prompts, permissions, and model assignments
  6. Implemented `.kilo/validate/lifecycle-validator.sh` — validates ADR-008 lifecycle declarations with `--fix` support
  7. Updated `docs/architecture.md` Layer 1 description to include all 4 new rule categories
- **Conclusion**: Phase A Governance Foundation complete. 15 new files, 3 modified files. Build: zero errors (no runtime code changed). Tests: 147/147 pass.

### TASK-026 — Governance Drift Remediation
### TASK-026 — Governance Drift Remediation
- **Status**: Done
- **Date**: 2026-06-08
- **Steps executed**:
  1. Created ADR-008 (`docs/decisions/008-lifecycle-declarations.md`) formalizing the lifecycle system with 5 states, governance rules, and transition rules
  2. Moved `confidence-interval.util.ts` from `recommendation/utils/` to `shared/utils/` — updated all 6 importers across recommendation and evaluation modules
  3. Deleted duplicate authority copies `.kilo/docs/architecture.md` and `.kilo/docs/constitution.md` (both superseded by `docs/` originals)
  4. Fixed `pre_verify.rules.md` blank line 1 — lifecycle declaration now on line 1 per convention
  5. Added module status markers (✅/🚧) to `docs/architecture.md` backend module structure
  6. Exported `getTrustLabel()` from `trust-score.interface.ts` with SYNC NOTE about kilo.jsonc duplication; `TrustScoreService.getDisplayLabel()` now delegates to it
  7. Updated all ADR-008 references in constitution.md and agent rule files to be hyperlinked
- **Conclusion**: Governance drift remediated. Build: zero errors. Tests: 147/147 pass.

### TASK-021 — Infra verification + API smoke tests
### TASK-021 — Infra verification + API smoke tests
- **Status**: Done
- **Date**: 2026-06-08
- **Steps executed**:
  1. `prisma migrate status` — up to date, 1 migration
  2. `prisma generate` — client regenerated
  3. `POST /api/v1/auth/register` — ✅ 201 (user created, JWT returned)
  4. `POST /api/v1/auth/login` — ✅ 201 (JWT returned)
  5. `GET /api/v1/users/me` — ✅ 200 (profile returned)
- **Conclusion**: Backend infrastructure and auth API verified end-to-end.
### TASK-022 — Seed recommendations + trust score fixes
- **Status**: Done
- **Date**: 2026-06-08
- **Steps executed**:
  1. Cleaned stale seed data from `recommendations`, `recommendation_options`, `checkpoints`, `decision_memories`, `trust_scores`
  2. Ran `npx tsx prisma/seed-recommendations.ts` — 10 recs, 6 checkpoints, 5 decision memories, 12 trust scores
  3. Fixed route ordering: moved `@Get('trust-scores')` and `@Post('trust-scores/recalculate')` before `@Get(':id')` in controller
  4. Fixed Prisma `null` upsert bug: replaced `upsert` (chokes on `null` in compound unique `where`) with `findFirst` + conditional `update`/`create`
  5. Rebuilt container (`docker compose up -d --build app`)
  6. Verified `GET /recommendations/trust-scores` — ✅ 200, 12 rows
  7. Verified `POST /recommendations/trust-scores/recalculate` — ✅ 201
  8. SQL COUNT: `trust_scores`=12, `decision_memories`=5, `recommendations`=10, `checkpoints`=6
- **Conclusion**: Recommendation seed pipeline, trust score APIs, and route ordering fixed and verified.
### TASK-001 — Floweng MVP scaffold (backend + frontend)

### TASK-025 — ADR-003 Agent Evaluation Harness v1
- **Status**: Done
- **Date**: 2026-06-08
- **Steps executed**:
  1. Migrated 4 Prisma models for evaluation schema
  2. Created 18 evaluation/source files
  3. Build: zero errors
  4. Test suite: 50/50 tests pass
  5. Seed data: 10 executions, 52 phases
  6. Verified all 7 API endpoints operational
- **Metrics**: Router accuracy 1.0, Planner accuracy 0.83, Code first-attempt rate 0.75, Debug success rate 1.0
- **Conclusion**: Agent Evaluation Harness v1 fully implemented and verified.

### TASK-A — Verify test baseline
- **Status**: Done — 5 suites / 72 tests PASS
- **Date**: 2026-06-08
- **Summary**: All backend unit tests pass. 5 test suites (recommendation.service, accuracy.service, decision-memory.service, trust-score.service, checkpoint.service) — 72 tests, 0 failures, 2.68s. Frontend has no test framework configured.
