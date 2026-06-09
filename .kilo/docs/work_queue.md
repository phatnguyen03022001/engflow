/* @lifecycle ACTIVE — Work queue tracking completed and pending tasks */

# Work Queue

## Active

## Finished
### ADR-017 — Shift Runtime Verification Execution to CODE Agent
- **Status**: Completed
- **Date**: 2026-06-10
- **Delivered**:
  - ADR-017 document (docs/decisions/0017-execution-shift-to-code.md)
  - CODE prompt updated: Runtime Verification Delegation as final step before code → post_verify
  - POST_VERIFY prompt updated: Raw Output Audit protocol scanning CODE's report for failure patterns
  - code.rules.md — §9-10 added (verification as mandatory DoD item + runtime verification spec)
  - post_verify.rules.md — §3.8 replaced with review-only contract, sandbox note updated
  - docs/decisions.md — ADR Index updated with ADR-015/016/017
- **Invariants**: I1-I4 all preserved (no permission, DAG, or schema changes)
- **Build**: zero errors
- **Tests**: 408/408 backend pass

### Lint Remediation — Constitution §4 Enforcement
- **Status**: Completed
- **Date**: 2026-06-10
- **Delivered**:
  - Removed 3 ESLint errors (0 remaining)
  - Replaced ~80+ `any` type annotations with `unknown`/proper types across ~30 files (evaluation/, memory/, knowledge/, recommendation/, model-registry/, user/, test/e2e/, prisma/)
  - Enabled `@typescript-eslint/no-explicit-any: warn` in .eslintrc.js
  - Fixed `require()` → `import` in analytics.service.spec.ts
  - Fixed `let` → `const` in memory.service.ts:300
- **npm run lint**: exit code 0 (0 errors, 0 no-explicit-any warnings, 38 pre-existing no-unused-vars)
- **npm run build**: zero errors
- **Tests**: 408/408 backend + 61/61 guard pass
- **Changes**: ~30 files edited across 7 modules

### ADR-016 — DEBUG Agent Activation
- **Status**: Completed
- **Date**: 2026-06-10
- **Delivered**:
  - ADR-016 document (docs/decisions/0016-debug-agent-activation.md)
  - DEBUG agent activated in kilo.jsonc (disable removed, task: deny, diagnosis-first prompt)
  - Execution Contract amended with 3 DEBUG transitions (execution.contract.md)
  - Runtime Guard updated with full DEBUG support (types.ts, index.ts) — 9 new tests
  - ADR-ASK-001 governance updated (catalog active, routing matrix, §3 Negative #2 removed)
  - 2 new evaluation metrics in CodeEvaluatorService (debugToCodeEscalationRate, codeRetryAfterDebugSuccessRate)
  - Root Jest config fix (package.json projects) — 28 pre-existing test failures resolved
- **Build**: zero errors
- **Tests**: 408/408 backend + 61/61 guard pass
- **Changes**: 1 new file, 7 edited files, 0 schema changes

### IDOR Audit & Remediation — Authorization Boundary Closure
- **Status**: Completed
- **Date**: 2026-06-09
- **Fixes**:
  - `GET /users/:id` — Added ownership check with admin bypass (Option C). Non-admin users can only access their own profile; admins can access any profile. Closes **HIGH** IDOR vulnerability.
  - `GET /users` — Added `@Roles(UserRole.ADMIN)` guard. Only admin users can enumerate all users. Closes **MEDIUM** authorization gap.
  - `UserController` — Added `RolesGuard` at class level following KnowledgeController reference pattern. The guard is a no-op on routes without `@Roles()` so existing self-service routes (`/users/me`, `/users/me/avatar`) are unaffected.
  - `UserService.findById` — Added JSDoc documenting that callers must verify authorization (defense-in-depth).
- **Tests**: Created `user.controller.spec.ts` with 8 tests covering: self-access, cross-user forbidden, admin bypass, user listing, and profile update.
- **Regression**: No existing E2E tests reference user endpoints. Zero frontend dependencies on `GET /users/:id` or `GET /users` — frontend obtains user data via login/register JWT responses.
- **Build**: zero errors
- **Tests**: 400/400 pass (27 suites)
### F1 Remediation — Mass Assignment Hardening
- **Status**: CLOSED
- **Date**: 2026-06-09
- **Finding**: RecommendationService.create() accepted analytics fields (confidenceScore, weightedScore, scoreMargin, ecs, sqs, cs) from user DTO via spread-ordering override pattern — fragile under refactoring.
- **Fixes**:
  - Eliminated `...data` rest spread entirely — replaced with explicit field mapping of every user-controlled field in Prisma create payload
  - Server-controlled analytics fields sourced exclusively from `analytics` parameter (trusted callers) or safe defaults (REST callers)
  - Added `FORBIDDEN_ANALYTICS_KEYS` runtime guard with Logger.warn — detects and discards injected analytics fields before they reach Prisma
  - Added Logger to RecommendationService for security event logging
- **Tests Added**: 3 new — analytics undefined, minimal DTO defaults, forged-key survival
- **Evidence**: 24/24 tests pass (was 21), 408/408 all suites pass, build zero errors
- **Post-Verify**: All 3 FLAG concerns resolved (spread-order fragility, injection path, schema mapping verified)


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
