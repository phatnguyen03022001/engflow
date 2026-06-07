/* @lifecycle ACTIVE — Strategic Plan: Ask Evolution from Advisor to CTO Co-pilot */

# Chiến lược: Biến Ask từ Advisor → CTO Co-pilot
## Tận dụng thư viện có sẵn, build tối thiểu, reuse tối đa

**Tác giả:** Planner Agent  
**Ngày:** 2026-06-08  
**Trạng thái:** Strategic Proposal (chờ phê duyệt)

---

## 📋 Đánh giá hiện trạng

### Những gì ĐÃ CÓ thể tái sử dụng ngay

| Mã nguồn | Trạng thái | Giá trị |
|-----------|-----------|---------|
| `RecommendationService` | ✅ Đã viết (~177 dòng) | CRUD + lifecycle recommendations |
| `TrustScoreService` | ✅ Đã viết (~249 dòng) | Bayesian scoring engine |
| `AccuracyService` | ✅ Đã viết (~376 dòng, 2 bugs) | Metrics dashboard engine |
| `DecisionMemoryService` | ✅ Đã viết (~238 dòng) | Cross-project learning với decay |
| `CheckpointService` | ✅ Đã viết (~192 dòng) | Auto follow-up 30/90/180 ngày |
| `ExecutiveReviewService` | ✅ Đã viết (~192 dòng) | Executive report generation |
| `AskIngestService` | ✅ Đã viết (~147 dòng) | Bridge Ask output → database |
| 2 cron schedulers | ✅ Đã viết | Auto daily trust recalc + checkpoint |
| 6 Prisma models | ✅ Đã migrate | Recommendations, TrustScores, Memories... |
| 15+ API endpoints | ✅ Đã viết | REST API đầy đủ |
| 3 DTOs với class-validator | ✅ Đã viết | Input validation |
| Governance Framework spec | ✅ Có spec (~471 dòng) | Rules cho Ask decision-making |

**Tổng tài sản có thể reuse: ~16 files, ~2,500+ dòng TypeScript, 10 tables PostgreSQL**

### Những gì THIẾU

| Khoảng trống | Mức độ | Giải pháp |
|-------------|--------|-----------|
| Code chưa compile, chưa test | 🔴 Critical | TASK-020 execution |
| 2 bugs trong AccuracyService | 🔴 Critical | Fix before compile |
| No unit tests (0 spec files) | 🟠 High | Viết Jest tests per service |
| No auto-ingestion Ask → system | 🟠 High | Mediator (human/Code Agent) |
| No context injection cho Ask | 🟡 Medium | System prompt engineering |
| Decision Tree runtime | 🟡 Medium | Tận dụng LLM (zero code) |
| Red Team engine | 🟢 Low | Prompt pattern (zero code) |
| Telemetry | 🟢 Low | PostHog free tier ($0) |

---

## 🧠 Nguyên tắc chỉ đạo: Reuse-First

Trước khi build mới, tự áp dụng Reuse-First Governance Framework:

```
Level 1: Code trong repo       → 16 recommendation files, 6 Prisma models
Level 2: OSS libraries         → PostHog (telemetry), Zod (optional)
Level 3: Managed services      → GitHub (telemetry), Vercel (deploy)
Level 4: Commercial            → Chưa cần
Level 5: Custom Build          → Chỉ khi C1-C5 thỏa mãn
```

**Luận điểm trung tâm:** Ask đã có thể "dẫn dắt" mà không cần thêm dòng code mới — chỉ cần code hiện tại CHẠY và KẾT NỐI với Ask.

---

## 🗺️ Lộ trình 4 Phase

### Phase 0: NỀN TẢNG — Make Existing Code Work ⏫

| Task | Hành động |
|------|-----------|
| 0.1 | Fix Bug 1 + Bug 2 trong `accuracy.service.ts` |
| 0.2 | Chạy `npm run build`, fix compilation errors |
| 0.3 | Viết P0 unit tests cho 4 core services (Recommendation, Checkpoint, TrustScore, Accuracy) |
| 0.4 | Chạy `npm test`, đạt ≥80% service coverage |
| 0.5 | Viết integration test: create → assess → trust recalc |

**Kết quả:** Recommendation Registry chạy thật, API hoạt động, có test coverage.

---

### Phase 1: KẾT NỐI — Bridge Ask → System 🔗

**Vấn đề:** Ask có `task: deny, bash: deny, edit: deny` — không thể tự gọi API.

**Giải pháp (zero code mới):** Human-in-the-loop + Mediator

```
Ask output (text + ---RECOMMENDATION-RECORD---)
    ↓
Mediator (human/Code Agent) copy structured record
    ↓
POST /api/v1/recommendations/ask-ingest { text }
    ↓
AskIngestService → RecommendationService → Database
```

**Tự động hóa (sau này):** Code Agent auto-detect structured output trong reply của Ask và gọi API.

---

### Phase 2: PHẢN HỒI — Close The Feedback Loop 🔄

**Cơ chế (prompt engineering, zero code mới):**

Inject vào system prompt của Ask trước mỗi session:

```
Before answering, consider:
- Bayesian Trust Score (global): {score} — {label}
- Best decision type: {type} ({score}%)
- Worst decision type: {type} ({score}%)
- Relevant past decisions in domain: {count}
- Last executive review summary: {summary}
```

**Kết quả:** Ask không "nói mò" — nó nói dựa trên track record thực tế.

---

### Phase 3: MỞ RỘNG — Build Chỉ Những Gì Thiếu 🏗️

| Tính năng | Level | Giải pháp | Chi phí |
|-----------|-------|-----------|---------|
| Decision Tree | L2 (LLM) = chính Ask | Structured output → không cần code tree | **$0** |
| Red Team | L2 (Prompt) | Thêm "Generate counter-arguments" vào prompt | **$0** |
| Telemetry | L2 (PostHog) | `posthog-node`, free tier 1M events | **$0** |
| Dashboard | L1 (Code cũ) | Next.js page gọi GET /stats + Tailwind | **~2h** |

---

## 📊 Tổng chi phí

| Hạng mục | Hiện tại | Sau Phase 0-3 |
|----------|----------|---------------|
| Dòng code NestJS mới | 0 | **0** |
| Bug fixes | 2 open | 0 |
| Unit tests | 0 | **~40 tests** |
| npm packages mới | 0 | 1 (posthog-node) |
| Hosting cost thêm | $0 | $0 |
| Database tables | 4 product | +6 registry (đã migrate) |
| API endpoints | ~10 | +15 recommendation |

---

## ⚡ Ưu tiên ngay

### Phiên này: Phase 0.1 + 0.2
1. Fix 2 bugs trong accuracy.service.ts
2. npm run build, fix lỗi compilation
3. npm test (viết P0 tests)

### Phiên sau: Phase 0.3-0.5 → Phase 1 → Phase 2 → Phase 3

### Không làm:
- ❌ Decision Tree engine riêng (dùng LLM)
- ❌ Red Team engine riêng (dùng prompt)
- ❌ Cho Ask quyền write (giữ advisory-only)
- ❌ Queue system (chưa cần BullMQ)

---

## 🔑 Kết luận

**Ask không cần thêm quyền hay code mới để dẫn dắt dự án.**
Nó chỉ cần:
1. **Code hiện tại chạy được** (Phase 0 — compile + test)
2. **Output được capture vào database** (Phase 1 — mediator)
3. **Nó thấy track record của chính nó** (Phase 2 — context injection)
4. **Dashboard đơn giản** (Phase 3 — reuse existing API)

Toàn bộ chiến lược: **zero new backend code** — chỉ fix, compile, test, kết nối.
Đây là tinh thần **Reuse-First** áp dụng cho chính hệ thống của mình.

---

**End of Plan**
