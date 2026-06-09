# Samagama Portal — Project Context

> **Audience:** Engineers and AI assistants joining this codebase mid-flight.
> **Goal:** Provide enough context to make confident, in-style contributions without re-reading the entire PRD.
> Keep this file truthful and concise. Update it whenever a decision changes.

---

## Product Mission

Samagama is the internship portal for student interns. The current portal exposes 150+ FAQs as one long scroll, has no community Q&A, and the existing chatbot ("Yaksha") frequently hallucinates. This project replaces those pieces with:

1. Categorized, tagged, freshness-ranked FAQ discovery.
2. Moderated community Q&A.
3. RAG chatbot grounded in approved knowledge using **MongoDB Atlas Vector Search**.
4. Role dashboards for student / moderator / admin.

Authoritative source: [`README.md`](./README.md) (PRD) + the prototype JSX is the visual target.

---

## Stack (Locked)

| Layer         | Choice                                                        | Rationale                    |
| ------------- | ------------------------------------------------------------- | ---------------------------- |
| Frontend      | React 18 + Vite + TypeScript                                  | PRD constraint               |
| API state     | TanStack Query                                                | PRD constraint               |
| Forms         | React Hook Form + Zod                                         | PRD constraint               |
| Backend       | Node 20+ + Express 4 + TypeScript                             | PRD constraint (no Python)   |
| DB            | MongoDB (Atlas in deploy) + Mongoose                          | PRD constraint               |
| Vector search | MongoDB Atlas Vector Search                                   | PRD: no separate vector DB   |
| Auth          | JWT (access + refresh) + bcryptjs                             | PRD constraint               |
| Validation    | Zod (shared between client and server via `@samagama/shared`) | Eliminates duplicate schemas |
| LLM           | Provider adapter (mock / Gemini / local Llama)                | PRD: keep swappable          |
| Logging       | Pino                                                          | Structured + fast            |
| Tests         | Vitest (+ Supertest for API, Testing Library for React)       | One test runner everywhere   |

**Forbidden:** Python services, separate vector DBs, NestJS, GraphQL (MVP), Redux, Firebase/Supabase backends.

---

## Repository Layout

```
samagama-portal/
├── apps/
│   ├── client/                    # React + Vite app
│   │   └── src/
│   │       ├── features/          # Feature folders: auth, faq, qna, moderation, chatbot, admin
│   │       ├── layouts/           # AppShell, Sidebar, ChatbotFab, navigation table
│   │       ├── lib/               # api-client, query helpers
│   │       ├── pages/             # Route-level components
│   │       └── styles/            # globals.css with theme tokens
│   └── server/                    # Express API
│       └── src/
│           ├── config/            # env, logger, database
│           ├── controllers/       # Thin: HTTP -> service
│           ├── services/          # Domain logic
│           ├── middlewares/       # auth, validate, error-handler
│           ├── models/            # Mongoose schemas
│           ├── routes/            # Declarative routers
│           ├── utils/             # api-error, jwt, async-handler
│           └── __tests__/         # Co-located tests
├── packages/
│   └── shared/                    # Zod schemas, enums, constants — single source of truth
├── docs/                          # Architecture decision records (ADRs) live here
├── PROJECT_CONTEXT.md             # ← this file
├── samagama.md                    # Engineering memory log (append-only)
├── README.md                      # PRD
├── eslint.config.js
├── tsconfig.base.json
└── package.json                   # npm workspaces root
```

---

## Architectural Conventions

### Backend

- **Controllers are thin.** They translate HTTP <-> service calls. Zero business logic.
- **All validation happens in middleware** using Zod schemas from `@samagama/shared`. By the time a controller runs, `req.body`/`req.query`/`req.params` are typed.
- **Services own business rules.** They never touch `req`/`res`.
- **Domain errors are `ApiError`.** Throw them; the global error handler maps them to a uniform JSON envelope.
- **Async route handlers** must be wrapped in `asyncHandler` so rejections flow into Express error pipeline.

### Frontend

- **Feature folders** under `src/features/<domain>/` own their components, hooks, and types.
- **Shared components** live in `src/components/ui/` (added when first re-used).
- **Auth state** is centralized in `AuthProvider`; tokens persist in localStorage via `tokenStorage`.
- **Theme** flips via `data-theme` on `<html>`; tokens are CSS custom properties in `globals.css`.
- **Routing** is in `App.tsx`; auth-protected routes live behind `<RequireAuth>`.
- **API calls** go through the shared `apiClient` (axios) and TanStack Query hooks.

### Shared package (`@samagama/shared`)

- Holds **constants**, **enums** (as `as const` tuples), **Zod schemas**, and **DTO types** inferred from those schemas.
- Both client and server import from `@samagama/shared`. **Never duplicate a schema.**

---

## Key Workflows (As-Built / Planned)

### Auth (built ✅)

1. Student registers (open) or admin creates user.
2. Login returns `{ accessToken, refreshToken, user }`.
3. Client stores tokens in localStorage; access token is attached as `Authorization: Bearer …`.
4. On 401 from a stale access token, client calls `/api/auth/refresh` with the refresh token.
5. `tokenVersion` on the User doc is bumped on password change to revoke outstanding refresh tokens.

### FAQ Discovery (planned — Phase 3)

- Hybrid search: Mongo text index (keyword) + Atlas Vector Search (semantic), score-blended (PRD §14.2).
- Default sort when no query: `updatedAt desc, viewCount desc` (Change Spec §7.1).
- Recently viewed list per user, capped at `RECENT_FAQS_LIMIT`.

### Community Q&A — Multi-Step Ask Flow (planned — Phase 4)

Implements Change Spec §6:

1. Student submits draft (title + description + category + optional screenshot).
2. Server runs FAQ similarity check.
3. If FAQ match: student picks "yes/no". If yes, no post.
4. Else server checks open community questions (top 2 by similarity).
5. If question match: student picks "same query / different". If same, server adds student to `taggedStudents`.
6. Else student picks visibility (`personal` | `community`) and submits.

### Moderation (planned — Phase 5)

- Pending answers, flagged FAQs, unresolved questions, duplicate candidates queues.
- Approve / Reject / Edit-and-Approve actions on community answers.
- Approving an answer flips question status to `resolved`.
- Once a community question has `COMMUNITY_ANSWER_CAP` (10) answers, no more answers accepted (server guard) — only upvote/downvote.

### Spurti Points (built ✅)

Gamification layer encouraging Community Q&A participation. Reward rules live in `packages/shared/src/constants.ts` (`SPURTI_POINTS`):

- **Initial balance**: every new student starts at **100** points (set in `auth.service.register` and the seed script).
- **Answer approved**: **+10** points (awarded in `moderation.service.approveAnswer`, idempotent — only on first approval transition).
- **Answer upvoted**: **+5** points per _new_ upvote (awarded in `qna.service.voteAnswer`; cancelling an upvote does NOT subtract — prevents toggle-gaming).

Surfaces:

- `GET /api/stats/student` — 4 home cards (open community Q&A, unanswered, your approved answers, points balance).
- `GET /api/stats/leaderboard?range=week|month|all` — top 20 students by points balance, with `approvedAnswers` count over the time window. Returns `myRank` if the requester is outside the top 20.
- `PublicUser.spurtiPoints` is emitted only for student accounts (moderators / admins don't accumulate).

### RAG Chatbot (planned — Phase 6)

1. Student query -> embed via `EmbeddingProvider`.
2. Atlas Vector Search retrieves top N approved FAQs + approved community answers.
3. If max similarity < `DEFAULT_CHATBOT_CONFIDENCE_THRESHOLD`, return fallback ("I don't know — post in Community").
4. Otherwise build grounded prompt + call `LLMProvider`.
5. Return `{ answer, sources[], confidence }`.
6. User feedback (helpful/incorrect) goes into review queue.

---

## Data Model Summaries

| Collection   | Key Fields                                                                                                                   | Notes                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| User         | name, email, passwordHash, role, status, tokenVersion, **spurtiPoints**, recentlyViewedFaqs[]                                | `email` unique index. `spurtiPoints` indexed for leaderboard sort.                     |
| Faq          | title, answer, summary, categories[], tags[], status, embedding[], helpfulCount, unhelpfulCount, flagCount, viewCount        | Status: draft/published/outdated/archived. Counts are denormalized for fast filtering. |
| Category     | name, slug, keywords[], isActive                                                                                             |                                                                                        |
| Tag          | name, slug, keywords[], isActive                                                                                             |                                                                                        |
| Question     | title, description, type, status, category, tags[], askedBy, taggedStudents[], moderatorViewedAt, screenshotUrl, answerCount | `type`: personal/community (Change Spec §8.1).                                         |
| Answer       | questionId, body, answeredBy, status, upvotes[], downvotes[], embedding[], moderationNote                                    | Status: pending/approved/rejected/needs_changes.                                       |
| Flag         | entityType, entityId, reason, status, reportedBy                                                                             | Reasons: incorrect/outdated/duplicate/unclear/other.                                   |
| ChatSession  | userId, messages[]                                                                                                           | Each message records sources + confidence.                                             |
| ChatFeedback | chatSessionId, messageIndex, rating, comment                                                                                 |                                                                                        |

---

## Implementation Status

| Phase                                                                    | Status                                                                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 0. Foundation (monorepo, tooling, shared, docs)                          | ✅ Done                                                                                                              |
| 1. Backend core (Express, Mongo, error handling, auth, RBAC)             | ✅ Done                                                                                                              |
| 2. Frontend core (Vite, routing, layout, theme, auth flow, query client) | ✅ Done                                                                                                              |
| 3. FAQ system                                                            | ✅ Done (text search; vector search deferred to Phase 6)                                                             |
| 4. Community Q&A (Change Spec §5–§6)                                     | ✅ Done (multi-step Ask, My Questions, moderation approve flow)                                                      |
| 5. Admin + Moderator dashboards (Dashboard Spec)                         | ✅ Done (FAQ Management, Unresolved Questions, Chatbot Feedback shell)                                               |
| 5b. Student Home + Analytics + Spurti Points                             | ✅ Done (4 home cards, content tabs, leaderboard, range filters)                                                     |
| 5c. UI Polish Sprint                                                     | ✅ Done (FAQ table redesign, column toggle, search, filter panel, moderator dashboard upgrades, flag Spurti rewards) |
| 6. RAG chatbot                                                           | ⏳ Planned (only this blocks the remaining checklist gaps)                                                           |
| 7. Hardening (security review, perf, a11y, full test coverage)           | ⏳ Planned                                                                                                           |

### Spec coverage at a glance

- Student Dashboard Spec: 33 / 36 (~92%) — remaining 3 blocked on Phase 6
- Admin & Moderator Dashboard Spec: 44 / 44 (100%) ✅

---

## Setup

Prereqs: Node ≥20, npm ≥10, MongoDB running locally (or an Atlas URI).

```bash
# 1. Install all workspaces
npm install

# 2. Build the shared package once (so server/client can resolve types)
npm run build:shared

# 3. Configure environment
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
# Then edit apps/server/.env and set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (≥32 chars each).

# 4. Seed accounts and content (idempotent — safe to re-run)
npm --workspace @samagama/server run seed:accounts        # 8 students + 3 moderators + 2 admins
npm --workspace @samagama/server run seed:faqs            # 10 categories, 18 tags, 8 published FAQs
npm --workspace @samagama/server run seed:chat-feedback   # demo chatbot feedback rows

# 5. Run dev servers (in two terminals)
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Seeded Accounts

> Local-development credentials only. The seed script refuses to run with `NODE_ENV=production`. The full table also lives in [`README.md` — Appendix A](./README.md#appendix-a--implementation-notes-non-prd).

| Role      | Example login                                       | Password         |
| --------- | --------------------------------------------------- | ---------------- |
| Student   | abhishek@samagama.test (and 7 others, see appendix) | `Student@2026`   |
| Moderator | kushagra@samagama.test (and 2 others)               | `Moderator@2026` |
| Admin     | divy@samagama.test (and 1 other)                    | `Admin@2026`     |

Each student starts with **100 Spurti Points**. Re-running `seed:accounts` preserves existing balances and Q&A activity — only `name`, `role`, and `passwordHash` are refreshed.

---

## Naming Conventions

- TypeScript files: `kebab-case.ts` for utilities/services, `PascalCase.tsx` for React components.
- Mongoose models: `<Name>.model.ts` exporting `<Name>Model`.
- Zod schemas: `<domain>.schema.ts` exporting `<thing>Schema` and inferring `<Thing>Input`.
- Test files: co-located in `__tests__/` or alongside as `*.test.ts(x)`.
- API routes: `kebab-case` in URLs, plural resource nouns (e.g. `/api/faqs`, `/api/qna/questions`).

---

## Constraints / Hard Lines

- **No Python.** All ML/RAG runs in Node.js.
- **No separate vector DB.** Embeddings live on documents, queried via Atlas Vector Search.
- **No GraphQL** for MVP.
- **No Redux** unless we can prove TanStack Query + React state is insufficient.
- **No business logic in controllers.**
- **No duplicate Zod schemas** between client and server. Both import from `@samagama/shared`.

---

## Known Limitations (At Foundation)

- The auth flow lacks email verification and password reset (planned Phase 7).
- File upload for screenshots (Change Spec §6.1) requires storage decision (S3 vs Mongo GridFS) — pending.
- No retry/backoff yet on the axios client — TanStack Query's default retry suffices for the MVP.
- ESLint flat config does not yet include react-specific plugins; will be added in Phase 7 hardening.

---

## Future Roadmap (Beyond MVP)

See PRD §5.2 / §5.3. High-level:

- Phase 2 PRD scope: bulk FAQ import, advanced dedupe/merge, push notifications.
- Phase 3 PRD scope: local Llama, multilingual, institution server deployment.
