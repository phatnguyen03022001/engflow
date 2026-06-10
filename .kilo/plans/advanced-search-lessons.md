/* @lifecycle ACTIVE — Advanced Search: Lessons multi-field search + pagination + infinite scroll */

# Advanced Search — Lesson Module

**Author:** Planner
**Date:** 2026-06-10
**Task Level:** LEVEL_2 (feature planning)
**Status:** Planned

---

## Summary

Add multi-field search (text, difficulty category, date range) with pagination to the backend
`GET /learning/lessons` endpoint, and build a frontend search UI with table display and
infinite scroll on `/learn`. No DB schema changes — leverages existing `Lesson` model fields.
Follows existing pagination patterns (`{ items, total }` response, `skip`/`take` params).

---

## Tasks

### TASK-1: Create shared pagination DTO (backend)

**Input:** No shared pagination DTO exists; 3+ inconsistent inline implementations.

**Output:** `backend/src/shared/dto/query-pagination.dto.ts`

**Actions:**
- Create `QueryPaginationDto` class with:
  - `skip`: `@IsOptional() @Transform(parseInt) @IsInt() @Min(0)` — records to skip
  - `take`: `@IsOptional() @Transform(parseInt) @IsInt() @Min(1) @Max(100)` — page size (default 20)
- Export from `SharedModule` so other modules can reuse
- Follows the most rigorous existing pattern (`QueryDriftEventsDto` — @Transform + @IsInt + @Min/@Max)

**Files:**
- `backend/src/shared/dto/query-pagination.dto.ts` — **CREATE**
- `backend/src/shared/shared.module.ts` — **UPDATE** (add to exports)

**Rationale:** Domain Rules (§4.5) mandate shared pagination types in `shared/`.

---

### TASK-2: Create Lesson query DTO (backend)

**Input:** `CreateLessonDto` exists; no query/filter DTO for Lessons.

**Output:** `backend/src/learning/dto/query-lessons.dto.ts`

**Actions:**
- Create `QueryLessonsDto` with fields:
  - `search?: string` — text search (title OR description)
  - `difficulty?: Difficulty` — category filter (enum)
  - `dateFrom?: Date` — createdAt >= dateFrom
  - `dateTo?: Date` — createdAt <= dateTo
  - `skip?: number` — pagination offset
  - `take?: number` — pagination limit
- Reuse `QueryPaginationDto` from TASK-1 via class extension if possible; otherwise inline.

**Files:**
- `backend/src/learning/dto/query-lessons.dto.ts` — **CREATE**

---

### TASK-3: Update LearningService with search + pagination (backend)

**Input:** `LearningService.getLessons()` returns ALL lessons with `include: { exercises: true }`.

**Output:** Updated `LearningService` with search/filter/paginate.

**Actions:**
- Add `searchLessons(dto: QueryLessonsDto)` method:
  - Build `Prisma.LessonWhereInput` from DTO fields
  - Text search: `{ title: { contains, mode: 'insensitive' } }` OR `{ description: ... }`
  - Category filter: `{ difficulty: dto.difficulty }`
  - Date range: `{ createdAt: { gte: dateFrom, lte: dateTo } }`
  - Parallel `findMany` + `count` with `Promise.all`
  - `select` only needed fields (id, title, description, difficulty, order, createdAt)
  - Default sort: `{ order: 'asc' }`
- Keep existing `getLessons()` or refactor — the controller will call `searchLessons()`

**Files:**
- `backend/src/learning/learning.service.ts` — **UPDATE**
- `backend/src/learning/__tests__/learning.service.spec.ts` — **CREATE**

---

### TASK-4: Update LearningController (backend)

**Input:** `GET /learning/lessons` takes no params, returns all lessons.

**Output:** `GET /learning/lessons` accepts `QueryLessonsDto`.

**Actions:**
- Change `getLessons(@Query() query: QueryLessonsDto)` to accept query DTO
- Wire to `learningService.searchLessons(query)`
- Keep `GET /learning/lessons/:id` and `POST /learning/lessons` unchanged
- Add `@ApiQuery` Swagger decorators for documentation

**API contract change:**
```
Before: GET /learning/lessons → [{ id, title, ..., exercises }, ...]
After:  GET /learning/lessons?search=&difficulty=&dateFrom=&dateTo=&skip=0&take=20
        → { items: [{ id, title, ..., createdAt }], total: N }
```

**Backward compat:** Old callers without query params get first page (20 items) ordered by `order`.

**Files:**
- `backend/src/learning/learning.controller.ts` — **UPDATE**

---

### TASK-5: Add database indexes (optional optimization)

**Input:** `Lesson` model has no explicit indexes.

**Actions:**
- If performance testing shows slow queries, add to `Lesson` model:
  ```prisma
  @@index([difficulty])
  @@index([createdAt])
  ```
- Run `npx prisma migrate dev --name add_lesson_search_indexes`

**Deferred:** OPTIONAL for MVP. Escalate to ARCH if needed.

**Files:**
- `backend/prisma/schema.prisma` — **UPDATE** (only if deferred is unacceptable)

---

### TASK-6: Build search bar component (frontend)

**Input:** No search/filter components exist.

**Output:** `frontend/components/lessons/lesson-search-bar.tsx`

**Actions:**
- Controlled component with:
  - Text input (placeholder "Search lessons...")
  - Difficulty `<select>` (ALL / BEGINNER / INTERMEDIATE / ADVANCED)
  - Date `<input type="date">` From / To
  - Clear filters button
- Emit `onSearch(params)` callback
- Debounce text input at 300ms before emitting

**Styling:** Tailwind, consistent with dashboard design (white bg, rounded-xl, shadow-sm).

**Files:**
- `frontend/components/lessons/lesson-search-bar.tsx` — **CREATE**

---

### TASK-7: Build lesson table with infinite scroll (frontend)

**Input:** No table component exists; learn page uses card grid.

**Output:** `frontend/components/lessons/lesson-table.tsx`

**Actions:**
- Responsive `<table>` with columns: Title, Difficulty (color badge), Created (date), Actions
- Intersection Observer sentinel at bottom triggers `onLoadMore`
- Show loading indicator while fetching
- Show "All N lessons loaded" when complete
- Show empty state message

**Files:**
- `frontend/components/lessons/lesson-table.tsx` — **CREATE**

---

### TASK-8: Integrate search into learn page (frontend)

**Input:** `/learn` page shows lessons as card grid, no search, no pagination.

**Output:** Updated `/learn` page with SearchBar + LessonTable + infinite scroll.

**Actions:**
- State: filters, items[], total, skip, loading, hasMore
- On filter change: reset skip → 0, clear items, fetch new page
- On load more: increment skip by TAKE (20), append results
- Debounce filter changes (300ms)
- Prevent concurrent fetches with loading guard
- Handle empty, loading, error, and edge case states

**Files:**
- `frontend/app/learn/page.tsx` — **UPDATE**

---

### TASK-9: Add tests

**Input:** No search/pagination tests exist.

**Output:** Backend unit tests covering all search scenarios.

**Actions:**
- Test `searchLessons()`:
  - No params → first page of 20
  - Text search matches title
  - Text search matches description
  - Difficulty filter
  - Date range filter
  - Combined filters
  - skip/take pagination
  - Max take capped at 100
  - Empty results
- Controller test: endpoint returns 200 with correct structure

**Files:**
- `backend/src/learning/__tests__/learning.service.spec.ts` — **CREATE**
- `backend/src/learning/__tests__/learning.controller.spec.ts` — **CREATE**

---

## Dependencies

```
TASK-1 (shared DTO) ──→ TASK-2 (query DTO) ──→ TASK-3 (service) ──→ TASK-4 (controller)
                                                       │
TASK-6 (search bar) ───────────────────────────────────┤
TASK-7 (table + scroll) ───────────────────────────────┤
                                                       ▼
                                                    TASK-8 (page integration)
                                                       │
                                                       ▼
                                                    TASK-9 (tests)
```

TASK-5 (indexes) is independent and can be done anytime after TASK-3.

---

## Execution Order

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 — DTO layer | TASK-1, TASK-2 | Shared pagination DTO + Lesson query DTO |
| 2 — Service | TASK-3 | Search/filter/paginate logic in LearningService |
| 3 — Controller | TASK-4 | Wire endpoint with query params |
| 4 — Indexes | TASK-5 | Optional: add indexes for performance |
| 5 — Components | TASK-6, TASK-7 | Search bar + table with infinite scroll |
| 6 — Integration | TASK-8 | Wire components into learn page |
| 7 — Tests | TASK-9 | Backend unit + integration tests |

---

## API Contract (Final)

```
GET /api/v1/learning/lessons
  Params: search, difficulty, dateFrom, dateTo, skip (0), take (20, max 100)

  Response 200:
    { "data": { "items": [...], "total": N }, "timestamp": "..." }

Errors: 400 (validation), 401 (unauthorized), 429 (rate limit)
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `contains` text search causes full table scan on large data | MEDIUM | Acceptable for MVP (<1K lessons). Future: add `pg_trgm` index. |
| Backward incompatibility (exercises removed from list response) | HIGH | No known callers depend on this. Verify at integration. |
| Infinite scroll race conditions (double-fetch, stale results) | MEDIUM | Use loading guard + abort controller ref. |
| Invalid date strings reaching service | LOW | `@IsDate()` validation catches before service. |
| `class-validator` inheritance issues with shared DTO | LOW | Fallback: inline skip/take fields locally. |
| No frontend component library (table must be hand-built) | LOW | Tailwind has all needed utilities. |

---

## Escalations

- Adding search fields beyond existing Lesson model → ARCH (schema change)
- Need for PostgreSQL full-text search (tsvector/tsquery) → ARCH (new dependency)
- Cross-entity search → out of scope; requires architecture decision
- If LearningModule grows beyond 30 files or warrants extraction → ARCH

---

## Verification Checklist

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npx jest --passWithNoTests` passes
- [ ] Backend: paginated search works with all filter combinations
- [ ] Backend: no regression on `/learning/lessons/:id` and `POST /learning/lessons`
- [ ] Frontend: search bar triggers debounced API calls
- [ ] Frontend: table displays results with correct columns
- [ ] Frontend: infinite scroll loads next page
- [ ] Frontend: filter change resets list and fetches fresh results
- [ ] Frontend: empty / loading / error states handled
