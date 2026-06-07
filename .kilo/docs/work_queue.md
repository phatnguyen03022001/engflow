# Work Queue

## Active

## Finished
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

### TASK-A — Verify test baseline
- **Status**: Done — 5 suites / 72 tests PASS
- **Date**: 2026-06-08
- **Summary**: All backend unit tests pass. 5 test suites (recommendation.service, accuracy.service, decision-memory.service, trust-score.service, checkpoint.service) — 72 tests, 0 failures, 2.68s. Frontend has no test framework configured.
