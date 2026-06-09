# Samagama Portal — Feature Catalogue & Implementation Details

> **Purpose:** This document enumerates every feature of the Samagama internship portal, explains what it does from the user's perspective, and outlines how each feature is implemented at a high level. It is intended for project stakeholders, reviewers, and engineers onboarding to the codebase.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Authentication & Session Management](#2-authentication--session-management)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [FAQ Discovery & Management](#4-faq-discovery--management)
5. [Community Q&A](#5-community-qa)
6. [Moderation Workflows](#6-moderation-workflows)
7. [Yaksha RAG Chatbot](#7-yaksha-rag-chatbot)
8. [Flag / Report System](#8-flag--report-system)
9. [Spurti Points & Leaderboard](#9-spurti-points--leaderboard)
10. [Student Dashboard & Home Page](#10-student-dashboard--home-page)
11. [Moderator Dashboard](#11-moderator-dashboard)
12. [Admin Dashboard & System Intelligence](#12-admin-dashboard--system-intelligence)
13. [User Management](#13-user-management)
14. [Audit Logging](#14-audit-logging)
15. [System Settings](#15-system-settings)
16. [Analytics & Observability](#16-analytics--observability)
17. [Theme & UI Framework](#17-theme--ui-framework)
18. [Shared Package & Validation](#18-shared-package--validation)
19. [Embedding & Similarity Engine](#19-embedding--similarity-engine)
20. [LLM Server (RAG Backend)](#20-llm-server-rag-backend)
21. [Infrastructure & DevOps](#21-infrastructure--devops)
22. [Implementation Status Summary](#22-implementation-status-summary)

---

## 1. System Overview

### What It Is

Samagama is a full-stack internship portal that replaces a legacy system with categorized FAQ discovery, moderated community Q&A, and an AI-powered chatbot grounded in approved knowledge.

### Architecture at a Glance

| Layer     | Technology                                     | Purpose                                                |
| --------- | ---------------------------------------------- | ------------------------------------------------------ |
| Frontend  | React 18 + Vite + TypeScript                   | Single-page application with role-based UI             |
| API State | TanStack Query                                 | Server state caching, refetching, and mutations        |
| Forms     | React Hook Form + Zod                          | Form management with shared validation schemas         |
| Backend   | Node 20 + Express 4 + TypeScript               | REST API server with domain-driven service layer       |
| Database  | MongoDB Atlas + Mongoose ODM                   | Document store with text indexes and vector search     |
| Auth      | JWT (access + refresh) + bcryptjs              | Stateless token-based authentication                   |
| Shared    | `@samagama/shared` (npm workspace)             | Zod schemas, enums, constants — single source of truth |
| LLM       | Provider adapter (mock / Gemini / local Llama) | Swappable AI provider for RAG responses                |
| Logging   | Pino                                           | Structured, high-performance server logging            |

### Monorepo Structure

```
samagama-portal/
├── apps/
│   ├── client/          # React + Vite frontend
│   ├── server/          # Express API backend
│   ├── server-remote/   # Remote/alternate server configuration
│   └── rag/             # RAG pipeline + LLM server
├── packages/
│   └── shared/          # Cross-cutting Zod schemas, enums, constants
├── docker-compose.yml   # Container orchestration
└── package.json         # npm workspaces root
```

---

## 2. Authentication & Session Management

### What It Does

Provides secure user registration, login, and session management using JWT tokens. Supports token refresh to maintain sessions without re-authentication.

### User-Facing Features

- **Registration:** Open registration creates a new student account
- **Login:** Email + password authentication returning access and refresh tokens
- **Token Refresh:** Automatic silent renewal of expired access tokens
- **Logout:** Invalidates the current session
- **Profile:** Retrieve the current user's profile (`GET /api/auth/me`)

### High-Level Implementation

| Aspect               | Detail                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Password hashing** | `bcryptjs` with 12 rounds                                                                                |
| **Access token**     | JWT signed with `JWT_ACCESS_SECRET`, 1-hour TTL                                                          |
| **Refresh token**    | JWT signed with `JWT_REFRESH_SECRET`, 7-day TTL                                                          |
| **Token versioning** | Each user has a `tokenVersion` field; bumped on password change to revoke all outstanding refresh tokens |
| **Rate limiting**    | Login endpoint: 10 attempts per 15 minutes per IP                                                        |
| **Client storage**   | Tokens stored in `localStorage`; access token sent as `Authorization: Bearer <token>`                    |
| **Auto-refresh**     | Client intercepts 401 responses and calls `POST /api/auth/refresh` with the refresh token                |

### Key Files

- **Backend:** `auth.service.ts` → `auth.controller.ts` → `auth.routes.ts`
- **Frontend:** `AuthProvider.tsx` (React context), `LoginPage.tsx`, `RequireAuth.tsx` (route guard)
- **Middleware:** `middlewares/auth.ts` (`requireAuth`, `requireRole`)

### API Endpoints

| Method | Path                 | Auth   | Description                                   |
| ------ | -------------------- | ------ | --------------------------------------------- |
| POST   | `/api/auth/register` | Public | Create student account                        |
| POST   | `/api/auth/login`    | Public | Returns access + refresh token + user profile |
| POST   | `/api/auth/refresh`  | Public | Rotate refresh token                          |
| POST   | `/api/auth/logout`   | Public | Invalidate session                            |
| GET    | `/api/auth/me`       | Bearer | Current user profile                          |

---

## 3. Role-Based Access Control (RBAC)

### What It Does

Restricts UI and API access based on three user roles: **student**, **moderator**, and **admin**. Each role sees a tailored navigation sidebar and can access only authorized API endpoints.

### Role Permissions Matrix

| Capability                              | Student | Moderator | Admin |
| --------------------------------------- | :-----: | :-------: | :---: |
| Browse published FAQs                   |   ✅    |    ✅     |  ✅   |
| Submit FAQ feedback (helpful/unhelpful) |   ✅    |    ✅     |  ✅   |
| Ask community/personal questions        |   ✅    |     —     |   —   |
| Submit peer answers                     |   ✅    |     —     |   —   |
| Vote on answers                         |   ✅    |     —     |   —   |
| Use Yaksha chatbot                      |   ✅    |    ✅     |  ✅   |
| Create/edit/archive FAQs                |    —    |    ✅     |  ✅   |
| Manage categories & tags                |    —    |    ✅     |  ✅   |
| Approve/reject answers                  |    —    |    ✅     |  ✅   |
| Respond to personal questions           |    —    |    ✅     |  ✅   |
| Review flagged content                  |    —    |    ✅     |  ✅   |
| View chatbot feedback                   |    —    |    ✅     |  ✅   |
| Manage users (roles, suspend)           |    —    |     —     |  ✅   |
| View audit logs                         |    —    |     —     |  ✅   |
| Configure system settings               |    —    |     —     |  ✅   |
| View admin analytics                    |    —    |     —     |  ✅   |

### High-Level Implementation

- **Backend:** `requireRole(...roles)` middleware checks `req.user.role` against the allowed list. Applied per-route or per-router.
- **Frontend:** `navigation.ts` defines a `navByRole` map — each role gets a distinct sidebar. Route-level `<RequireAuth>` wraps all authenticated pages.
- **Data visibility:** Students only see `published` FAQs and `approved` answers. Moderators/admins see all statuses.

---

## 4. FAQ Discovery & Management

### What It Does

Provides a categorized, tagged, searchable knowledge base of frequently asked questions. Students browse and search FAQs; moderators and admins manage the full lifecycle.

### User-Facing Features

#### For Students

- **Browse FAQs** with category and tag filters
- **Text search** with relevance-ranked results
- **Sort options:** Recently updated, popular (most viewed), most helpful, recently added, text relevance
- **Helpful/unhelpful voting** (one vote per user, switchable, togglable)
- **Recently viewed** list (per-user, capped at 25)
- **Flag FAQs** for incorrect/outdated/duplicate content

#### For Moderators & Admins

- **Full CRUD:** Create FAQ (draft or published), edit, archive
- **Status lifecycle:** `draft → published → outdated → archived`
- **Stat reset on answer change:** When the answer body is edited, helpful/unhelpful/flag counts are reset since they no longer reflect the current content
- **Manual stat resets:** Moderators can independently reset helpful, unhelpful, or flag counters
- **View counts, flag counts** visible in management views
- **Categories & Tags management** (inline tabs within FAQ Management page)
- **Column toggle** — moderators can show/hide table columns
- **FAQ quality scoring** — automated quality score based on helpfulness ratio, flag ratio, and freshness

### High-Level Implementation

| Aspect                   | Detail                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Text search**          | MongoDB compound text index on `(title × 10, summary × 5, answer × 1)` — weighted relevance       |
| **Default sort**         | When no search query: `updatedAt desc, viewCount desc` (Change Spec §7.1)                         |
| **Embedding**            | 384-dimensional vector generated on publish/title change (fire-and-forget, non-blocking)          |
| **Similarity check**     | Cosine similarity against stored embeddings; falls back to text search when embeddings are absent |
| **View tracking**        | Atomic `$inc` on FAQ viewCount + bounded LRU array (`recentlyViewedFaqs`) on the User document    |
| **Feedback idempotency** | Hidden `helpfulVotes[]` and `unhelpfulVotes[]` arrays track per-user votes; switching is allowed  |
| **Quality score**        | Computed as: `0.4 × helpfulRatio + 0.35 × (1 − flagRatio×10) + 0.25 × freshnessScore`             |
| **Analytics**            | Every search query is logged to `SearchLog` collection for unanswered-search surfacing            |

### Key Files

- **Backend:** `faq.service.ts` (417 lines of domain logic), `faq.controller.ts`, `faq.routes.ts`
- **Frontend:** `FaqsPage.tsx` (search, filters, sort), `FaqCard.tsx` (expandable card with voting)
- **Models:** `Faq.model.ts`, `Category.model.ts`, `Tag.model.ts`

### API Endpoints

| Method | Path                     | Auth      | Description                                                         |
| ------ | ------------------------ | --------- | ------------------------------------------------------------------- |
| GET    | `/api/faqs`              | Bearer    | List/search FAQs (text search, filter by category/tag/status, sort) |
| GET    | `/api/faqs/:id`          | Bearer    | Single FAQ detail with user's feedback state                        |
| GET    | `/api/faqs/recent`       | Bearer    | User's recently viewed FAQs                                         |
| POST   | `/api/faqs`              | Mod/Admin | Create FAQ                                                          |
| PATCH  | `/api/faqs/:id`          | Mod/Admin | Update FAQ (with optional stat reset)                               |
| PATCH  | `/api/faqs/:id/archive`  | Mod/Admin | Archive FAQ                                                         |
| POST   | `/api/faqs/:id/view`     | Bearer    | Record a view (increments viewCount, updates recently-viewed)       |
| POST   | `/api/faqs/:id/feedback` | Bearer    | Submit helpful/unhelpful vote                                       |

---

## 5. Community Q&A

### What It Does

A peer-to-peer question and answer system where students ask questions and other students submit answers. Questions can be personal (private to the asker and moderators) or community-wide (visible to all).

### User-Facing Features

#### Multi-Step "Ask a Question" Flow (Change Spec §6)

1. **Draft submission:** Student enters title + description + category + optional screenshot
2. **Existing-answer check:** Server searches for matching FAQs (top 5) and open community questions (top 2)
3. **FAQ match review:** If FAQ matches exist, student decides if their question is already answered
4. **Community question match:** If similar open questions exist, student can "tag me" (express interest) instead of duplicating
5. **Visibility choice:** Student selects `personal` or `community` and submits
6. **Check token enforcement:** A signed JWT token (15-min TTL) is required to submit — proves the user saw suggestions

#### Question Browsing

- **Community page:** Lists all community questions sorted by most recently updated
- **My Questions:** Student sees all their questions (personal + community)
- **Question detail:** Full question with all approved answers, voting, and answer submission
- **Personal question status:** WhatsApp-style display states — `posted → seen → responded`

#### Answering & Voting

- **Peer answers:** Students can answer community questions (not their own)
- **Answer cap:** Server-enforced maximum of 10 answers per community question
- **Up/downvoting:** Idempotent toggle voting on approved answers; same vote twice cancels it
- **Self-vote prevention:** Users cannot vote on their own answers

### High-Level Implementation

| Aspect                  | Detail                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Check token**         | Signed JWT with FNV-1a title hash + userId; 15-min expiry; required for question creation                                     |
| **Similarity cache**    | In-memory TTL cache (60s, 1000 entries) for check-existing results; keyed by `userId\|normalizedTitle\|normalizedDescription` |
| **Personal visibility** | `type: 'personal'` questions: only asker + moderators/admins can see them                                                     |
| **Moderator seen tick** | When a mod/admin opens a personal question, `moderatorViewedAt` is set once, driving the `'seen'` display state               |
| **Answer cap guard**    | `question.answerCount >= COMMUNITY_ANSWER_CAP` → 403 Forbidden                                                                |
| **Vote atomics**        | `$addToSet` / `$pull` on `upvotes[]` / `downvotes[]` arrays with `$inc` on count fields                                       |
| **Tag-me**              | `$addToSet: { taggedStudents: userId }` on the existing question                                                              |
| **Idle bucket filter**  | Questions filterable by idle duration: `last24h`, `over3days` (24h–7d), `over1week` (>7d)                                     |

### Key Files

- **Backend:** `qna.service.ts` (495 lines), `qna.controller.ts`, `qna.routes.ts`
- **Frontend:** `AskQuestionPage.tsx` (multi-step wizard), `CommunityPage.tsx`, `QuestionDetailPage.tsx`, `MyQuestionsPage.tsx`
- **Models:** `Question.model.ts`, `Answer.model.ts`

### API Endpoints

| Method | Path                                   | Auth   | Description                                                   |
| ------ | -------------------------------------- | ------ | ------------------------------------------------------------- |
| POST   | `/api/qna/check-existing`              | Bearer | Similarity search before posting (returns signed check token) |
| POST   | `/api/qna/questions`                   | Bearer | Post a question (requires check token)                        |
| GET    | `/api/qna/questions`                   | Bearer | List questions (with type/status/mine/idle filters)           |
| GET    | `/api/qna/questions/:id`               | Bearer | Question detail (increments view count)                       |
| POST   | `/api/qna/questions/:id/tag-me`        | Bearer | Express interest in an existing question                      |
| GET    | `/api/qna/questions/:id/answers`       | Bearer | List answers on a question                                    |
| POST   | `/api/qna/questions/:id/answers`       | Bearer | Submit a peer answer                                          |
| POST   | `/api/qna/answers/:id/vote/:direction` | Bearer | Upvote/downvote an answer                                     |

---

## 6. Moderation Workflows

### What It Does

Provides moderators and admins with tools to review, approve, reject, or edit student-submitted answers. Includes a pipeline for converting high-quality community answers into FAQs.

### User-Facing Features

#### Answer Moderation

- **Pending answers queue:** FIFO list of answers awaiting moderation
- **Per-question pending view:** Progressive reveal (1 → +2 → all 10 answers)
- **Approve:** Accept the answer; optionally edit the body in the same action (edit-and-approve)
- **Reject:** Decline with optional moderation note
- **Bulk actions:** Approve or reject multiple answers at once
- **Spurti Points on approval:** Moderator can assign custom points (-1 to 5) or use the default (+5)

#### Personal Question Response

- **Direct moderator response:** Moderators can answer personal questions directly, bypassing peer-answer moderation (auto-approved)
- **Minimum response length:** 10 characters minimum, 4000 characters maximum

#### FAQ Conversion Pipeline

- **Mark for FAQ:** Flag an approved answer as eligible for FAQ conversion
- **FAQ candidates page:** Lists all eligible, unconverted answers
- **Convert to FAQ:** Creates a new FAQ draft from the question title + answer body, auto-links categories/tags

### High-Level Implementation

| Aspect                   | Detail                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Approval idempotency** | If answer is already `approved`, the function returns immediately — no double point awards   |
| **Question resolution**  | First approved answer on a question flips the question status to `resolved`                  |
| **Spurti Points**        | `ANSWER_APPROVED_DEFAULT` (+5) awarded to answer author via `$inc` on `User.spurtiPoints`    |
| **FAQ creation**         | `sourceType: 'community_conversion'`; `sourceQuestionId` links back to the original question |
| **Conversion guard**     | `answer.convertedFaqId` prevents double conversion (409 Conflict)                            |

### Key Files

- **Backend:** `moderation.service.ts` (314 lines), `moderation.controller.ts`, `moderation.routes.ts`
- **Frontend:** `UnresolvedQuestionsPage.tsx`, `PendingAnswersPage.tsx`, `ModerationQueueCards.tsx`, `FaqCandidatesPage.tsx`

### API Endpoints

| Method | Path                                    | Auth      | Description                             |
| ------ | --------------------------------------- | --------- | --------------------------------------- |
| GET    | `/api/moderation/pending`               | Mod/Admin | Cross-question pending answers queue    |
| GET    | `/api/moderation/pending/:questionId`   | Mod/Admin | Pending answers for a specific question |
| POST   | `/api/moderation/approve/:answerId`     | Mod/Admin | Approve (optionally edit) an answer     |
| POST   | `/api/moderation/reject/:answerId`      | Mod/Admin | Reject an answer                        |
| POST   | `/api/moderation/respond/:questionId`   | Mod/Admin | Directly respond to a personal question |
| POST   | `/api/moderation/bulk-approve`          | Mod/Admin | Bulk-approve multiple answers           |
| POST   | `/api/moderation/bulk-reject`           | Mod/Admin | Bulk-reject multiple answers            |
| POST   | `/api/moderation/mark-faq/:answerId`    | Mod/Admin | Mark answer as FAQ candidate            |
| GET    | `/api/moderation/faq-candidates`        | Mod/Admin | List FAQ conversion candidates          |
| POST   | `/api/moderation/convert-faq/:answerId` | Mod/Admin | Convert answer to FAQ draft             |

---

## 7. Yaksha RAG Chatbot

### What It Does

An AI-powered chatbot named "Yaksha" that answers student questions using Retrieval-Augmented Generation (RAG). It retrieves relevant FAQ context via embedding similarity, passes it to an LLM, and returns a grounded answer. Includes SSE streaming for long-running queries and hierarchical context summarization for unbounded conversation history.

### User-Facing Features

- **Chat interface:** Real-time conversational UI accessible from every page via a floating action button
- **Source attribution:** Each response shows the FAQ titles used as sources
- **Conversation history:** Session persists for 30 minutes of idle time with rolling window summarization
- **Progress indicator:** "Thinking... (Xs)" elapsed time counter during LLM processing
- **Feedback:** Students can rate each response as `helpful` or `incorrect`
- **Escalation:** `#escalate` (after a fallback) or `#forceescalate [reason]` (anytime) routes the issue to moderators
- **Timeout handling:** 5-minute hard timeout with friendly message instead of abrupt failure

### High-Level Implementation

#### Standard Chat Flow

```
Student message
  → Generate 384-dim query embedding
  → Cosine similarity search against published FAQs (threshold from SystemSettings)
  → Cap results at chatbotMaxSources (default 6)
  → Fallback to text search if no embeddings are populated
  → Assemble RAG payload: system prompt + FAQ context + conversation history + meta-summary
  → Call LLM provider (mock / Gemini / local-llama / ollama / groq)
  → Detect fallback_triggered (bot couldn't answer)
  → Return answer + sources + fallback flag
```

#### LLM Provider Dispatch

| Provider      | Trigger                                         | Detail                                                   |
| ------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `local-llama` | `LLM_PROVIDER=local-llama` + `LLM_BASE_URL` set | Calls LLM server with SSE streaming support              |
| `ollama`      | `LLM_PROVIDER=ollama`                           | Direct SSE streaming to Ollama                           |
| `gemini`      | `LLM_PROVIDER=gemini` + `GEMINI_API_KEY` set    | Calls Google Gemini 2.0 Flash API directly               |
| `groq`        | `LLM_PROVIDER=groq` + `GROQ_API_KEY` set         | Calls Groq API directly (OpenAI-compatible)             |
| `mock`        | Default / fallback                              | Returns top FAQ excerpt as the answer; no external calls |

#### SSE Streaming (local-llama and ollama only)

For long-running LLM inference, the chatbot uses Server-Sent Events (SSE) instead of blocking HTTP requests:

```
Client                    Server                      LLM Server/Ollama
  │                          │                              │
  │──POST /api/chat/stream──→│                              │
  │                          │──POST /internal/llm/────────→│
  │                          │   generate-stream            │
  │←─────────────────────────│                              │
  │  data: {type:"ping"}     │←─ SSE: ping every 5s ───────│
  │  data: {type:"ping"}     │                              │
  │  data: {type:"ping"}     │←─ SSE: response ────────────│
  │←─────────────────────────│                              │
  │  data: {type:"response"}  │                              │
```

**Why SSE instead of WebSocket?**
- Unidirectional (server → client only) — simpler, lower overhead
- Works over HTTP/2 naturally
- No need for a persistent bidirectional connection
- Browser built-in `EventSource` API handles reconnection

**Why not just increase the HTTP timeout?**
- The previous 90-second timeout showed an abrupt error to the user with no progress indication
- SSE allows the client to display "Thinking... (45s)" so users know processing is happening
- A 5-minute hard timeout on the SSE stream provides a clear failure boundary

#### Rolling Window with Hierarchical Summarization

To handle unbounded conversation history without degrading LLM context quality, the chatbot uses a two-level summarization hierarchy:

**Data Structure:**
```typescript
interface SummaryChunk {
  summary: string;      // LLM-generated summary of 10 messages
  messageCount: number; // How many messages this chunk represents
}

interface SessionData {
  userId: string;
  messages: ChatMessage[];      // Always last 10 messages ("recent window")
  summaryChunks: SummaryChunk[]; // Max 10 chunks (covers last 100 messages)
  metaSummary: string;           // Summary of all chunks
  fallbackUnlocked: boolean;
}
```

**Trigger:** When `messages.length >= 20`, the oldest 10 messages are summarized into a chunk.

**LLM Context at Query Time:**
```
System: [Yaksha system prompt + FAQ context]
Meta-summary: [metaSummary from all chunks]
Recent: [last 10 messages]
Current: [user's new message]
```

**Why hierarchical (chunk → meta-summary) instead of flat summarization?**

| Approach | Summarization calls for 100 messages |
|----------|--------------------------------------|
| Flat (re-summarize all each time) | ~90 calls |
| Hierarchical (chunks + meta) | ~11 calls |

Hierarchical summarization is much more efficient for long conversations. The cost of re-summarizing grows logarithmically instead of linearly with conversation length.

**Intuition for keeping last 10 unsummarized:**
- Recent messages contain the most relevant context for the current query
- 10 messages = ~5 conversation turns, which provides enough recent context for follow-up questions
- The meta-summary + chunks capture the overall conversation arc

**When meta-summary is regenerated:**
- After every 10 new chunks (when `summaryChunks.length > MAX_CHUNKS`, oldest chunks are evicted)
- The meta-summary is a "summary of summaries" that captures the overall conversation theme

#### Escalation Flow

1. **`#escalate`:** Only available after `fallback_triggered: true` in the last response
2. **`#forceescalate [reason]`:** Available anytime, no eligibility check
3. Calls `/internal/llm/summarize` for a conversation summary (if LLM server available)
4. Records the escalation as a `ChatFeedback` with `rating: 'incorrect'` → appears in the moderator review inbox
5. Acknowledges the escalation to the student

#### Session Management

| Aspect             | Detail                                           |
| ------------------ | ------------------------------------------------ |
| **Storage**        | In-process TTL cache (no Redis required for MVP) |
| **TTL**            | 30 minutes after last message                    |
| **Max entries**    | 500 concurrent sessions                          |
| **Recent window**  | Last 10 messages sent to LLM                     |
| **Summary chunks** | Max 10 chunks (100 messages total coverage)      |
| **Summarize at**   | 20 messages (triggers after 10 new messages)     |

### Key Files

- **Backend:** `chatbot.service.ts` (~1050 lines), `chatbot.controller.ts`, `chatbot.routes.ts`
- **Frontend:** `ChatbotPage.tsx` (chat UI with SSE handling), `api.ts` (SSE client function)
- **LLM Server:** `apps/rag/llm-server/index.js` (Express server wrapping LM Studio)

### API Endpoints

| Method | Path                           | Auth      | Description                                 |
| ------ | ------------------------------ | --------- | ------------------------------------------- |
| POST   | `/api/chat/query`              | Bearer    | Send a message to Yaksha (RAG + LLM)        |
| POST   | `/api/chat/stream/:sessionId`  | Bearer    | SSE stream for long-running queries         |
| GET    | `/api/chat/session/:sessionId` | Bearer    | Retrieve conversation history + meta-summary |
| POST   | `/api/chat/feedback`           | Bearer    | Rate a bot response (helpful/incorrect)     |
| GET    | `/api/chat/feedback`           | Mod/Admin | List all chatbot feedback                   |
| GET    | `/api/chat/feedback/stats`     | Mod/Admin | Feedback counts (total, helpful, flagged)   |

---

## 8. Flag / Report System

### What It Does

Allows users to report problematic content (FAQs, questions, answers, chatbot responses) with categorized reasons. Moderators review and resolve flags from a centralized inbox.

### User-Facing Features

- **Flag dialog:** Students can flag FAQs with reasons: `incorrect`, `outdated`, `duplicate`, `unclear`, `other`
- **Idempotent flagging:** One active flag per (user, entity) — re-flagging updates the existing flag
- **Flag inbox:** Moderators see all flags with entity titles, reporter names, and status
- **Resolve/dismiss:** Moderators can resolve or dismiss flags with optional notes
- **Spurti Points reward:** Moderators can award/deduct Spurti Points to reporters when resolving flags

### High-Level Implementation

| Aspect                   | Detail                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Denormalized counter** | `flagCount` on the FAQ document tracks live (open + under_review) flags                                       |
| **Counter sync**         | New flag → `$inc: { flagCount: 1 }`; resolve/dismiss → `$inc: { flagCount: -1 }` (guarded by `flagCount > 0`) |
| **Entity title lookup**  | Batch-fetches titles from `faqs` and `questions` collections for display                                      |
| **Unique constraint**    | Partial index ensures one active flag per `(user, entityType, entityId)`                                      |

### Key Files

- **Backend:** `flag.service.ts` (185 lines), `flag.controller.ts`, `flag.routes.ts`
- **Frontend:** `FlagFaqDialog.tsx` (modal with reason selection and details)
- **Model:** `Flag.model.ts`

### API Endpoints

| Method | Path             | Auth      | Description                                   |
| ------ | ---------------- | --------- | --------------------------------------------- |
| POST   | `/api/flags`     | Bearer    | Create or update a flag                       |
| GET    | `/api/flags`     | Mod/Admin | List flags (filterable by entityType, status) |
| PATCH  | `/api/flags/:id` | Mod/Admin | Update flag status (resolve/dismiss)          |

---

## 9. Spurti Points & Leaderboard

### What It Does

A gamification layer that incentivizes student participation in the Community Q&A. Students earn points for helpful contributions and compete on a leaderboard.

### Point Rules (Single Source of Truth: `@samagama/shared/constants.ts`)

| Event                        | Points                          | Notes                                                         |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------- |
| New student registration     | **+100**                        | Initial balance                                               |
| Answer approved by moderator | **+5** (default, range -1 to 5) | Awarded once on first approval (idempotent)                   |
| Answer upvoted               | **+5** per new upvote           | Cancelling an upvote does NOT deduct (prevents toggle-gaming) |
| Flag resolved with reward    | Variable                        | Moderator decides the amount when resolving a flag            |

### Leaderboard

- **Top 20 students** sorted by total Spurti Points balance (descending), then alphabetically
- **Range filter:** `week`, `month`, `all` — filters the secondary metric (approved answers count within the range) but always shows the live points balance
- **My Rank:** If the current student is outside the top 20, their entry is appended with their actual rank

### High-Level Implementation

- Points stored on `User.spurtiPoints` (indexed for leaderboard sort)
- Moderators/admins don't accumulate points (`spurtiPoints` only emitted in API for `role: 'student'`)
- Leaderboard aggregation joins `Answer` collection (approved answers per student in time window) with the `User` collection

### Key Files

- **Backend:** `stats.service.ts` → `getLeaderboard()`, `getStudentHomeStats()`
- **Frontend:** `HomePage.tsx` (leaderboard table + range toggle)
- **Shared:** `constants.ts` → `SPURTI_POINTS`

### API Endpoints

| Method | Path                            | Auth    | Description                                                     |
| ------ | ------------------------------- | ------- | --------------------------------------------------------------- |
| GET    | `/api/stats/student`            | Student | 4 home cards (open Q&A count, unanswered, your answers, points) |
| GET    | `/api/stats/leaderboard?range=` | Student | Top 20 leaderboard + myRank                                     |

---

## 10. Student Dashboard & Home Page

### What It Does

A personalized landing page for students showing community activity stats, quick-access content tabs, and the Spurti Points leaderboard.

### User-Facing Features

#### Four Summary Cards

1. **Open Community Questions** — total `open` + `answered` community questions
2. **Unanswered Community Questions** — community questions with 0 answers
3. **Questions You Answered** — count of the student's approved answers
4. **Spurti Points** — live balance

#### Content Tabs

- Browse FAQs, Community Q&A, My Questions — accessible from the home page
- Idle bucket filter chips: `Last 24h`, `Over 3 days`, `Over 1 week`

#### Leaderboard

- Top 20 students with points, approved answers, and rank
- Time range filter (week / month / all time)
- Highlights the current user's rank

### High-Level Implementation

- Stats aggregated via `statsService.getStudentHomeStats()` — 4 parallel MongoDB count queries
- Idle buckets use a single `$facet` aggregation for consistent card ↔ filter agreement
- Home page is a 16.8KB React component with inline stat cards and tabbed content

### Key Files

- **Backend:** `stats.service.ts`, `stats.controller.ts`, `stats.routes.ts`
- **Frontend:** `HomePage.tsx` (16.9KB), `IdleBucketCards.tsx`

---

## 11. Moderator Dashboard

### What It Does

A centralized command center for moderators showing personal, community, and FAQ metrics across daily and weekly time ranges.

### User-Facing Features

#### Dashboard Cards (5 groups)

1. **Personal Questions:** Total, unanswered, posted today
2. **Community Questions:** Total, answered, unanswered (all-time + today breakdown)
3. **FAQs:** Total, added today, added this week
4. **Flagged FAQs:** Total, flagged today, flagged this week
5. **FAQ Engagement:** Helpful %, unhelpful %, published total

#### Moderator-Specific Pages

- **Unresolved Questions:** Full queue of open/answered community questions with inline answer moderation
- **FAQ Management:** Shared with admin — full CRUD with category/tag tab panels
- **Chatbot Feedback:** Review and manage student feedback on Yaksha responses
- **Moderator Analytics:** Personal performance — approvals today/this week, total approve/reject ratio, avg response time, category breakdown
- **FAQ Candidates:** Approved answers eligible for conversion to FAQ drafts

### High-Level Implementation

- `statsService.getModeratorDashboardStats()` — 17 parallel MongoDB queries in a single `Promise.all`
- Per-moderator stats via `statsService.getModeratorPersonalStats()` — 5 queries + category breakdown aggregation
- Unresolved Questions page is the largest frontend component (17.4KB) — includes per-card pending answer preview, approve/reject/respond actions, and answer expansion

### Key Files

- **Backend:** `stats.service.ts` → `getModeratorDashboardStats()`, `getModeratorPersonalStats()`
- **Frontend:** `ModerationOverviewPage.tsx`, `UnresolvedQuestionsPage.tsx` (17.4KB), `ModerationQueueCards.tsx` (24.3KB), `ModeratorAnalyticsPage.tsx`

---

## 12. Admin Dashboard & System Intelligence

### What It Does

Provides administrators with a system-wide health overview, quality intelligence, and operational analytics.

### User-Facing Features

#### Admin Overview Page

- **Intelligence cards:** Unresolved questions, pending moderation items, FAQs needing review, avg resolution time
- **Quality alerts:** Top 5 lowest-quality FAQs (based on quality score)
- **Published FAQ count, helpful %, flagged count**

#### FAQ Quality Page

- **Quality table:** All published/outdated FAQs with computed quality score (0-100)
- **Classification:** `good` (≥60), `rewrite` (30-59), `archive` (<30)
- **Filterable:** All, needs rewrite, should archive
- **Metrics per FAQ:** Quality score, helpful ratio, flag count, view count, category, last updated

#### Moderation Load Page

- **Pending queue depth**
- **Per-moderator performance:** Total approvals, rejections, approvals this week, avg response time
- **Category backlog:** Pending answers by question category

#### Audit Logs Page

- **Paginated log viewer** with filters for actor, entity type, action, and date range

#### Analytics Endpoints (Admin-Only)

- **Portal overview:** Aggregate counts + 7-day activity snapshot
- **Issue heatmap:** Question volume by day (last N days)
- **Unanswered searches:** Most frequent search queries with 0 results or no click-through
- **FAQ quality ranking:** Worst/best FAQs by quality score with editorial action recommendations
- **Moderation load:** Queue depth, per-moderator stats, category backlog
- **Votes trend:** Daily helpful/unhelpful/flagged counts for the last 7 days

### High-Level Implementation

| Aspect                    | Detail                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Quality score formula** | `0.4 × helpfulRatio + 0.35 × (1 − min(flagRatio×10, 1)) + 0.25 × freshnessScore`    |
| **Freshness scoring**     | ≤7 days: 1.0, ≤30 days: 0.7, ≤90 days: 0.4, >90 days: 0.1                           |
| **Avg resolution time**   | Aggregation of `(updatedAt − createdAt)` for questions resolved in the last 30 days |
| **Analytics caching**     | MongoDB-backed cache with 10-minute TTL (via `AnalyticsCache` collection)           |
| **Search logging**        | Every search query is logged with `normalizedQuery` for frequency analysis          |

### Key Files

- **Backend:** `stats.service.ts`, `analytics.service.ts` (472 lines), `admin.controller.ts`, `admin.routes.ts`
- **Frontend:** `AdminOverviewPage.tsx`, `FaqQualityPage.tsx`, `ModerationLoadPage.tsx`, `AuditLogsPage.tsx`

### API Endpoints

| Method | Path                             | Auth      | Description                   |
| ------ | -------------------------------- | --------- | ----------------------------- |
| GET    | `/api/stats/admin-intelligence`  | Admin     | System health overview        |
| GET    | `/api/stats/moderation-load`     | Admin     | Per-moderator performance     |
| GET    | `/api/stats/faq-quality`         | Mod/Admin | FAQ quality scores            |
| GET    | `/api/stats/votes-trend`         | Mod/Admin | 7-day vote trend              |
| GET    | `/api/admin/overview`            | Admin     | Portal aggregate counts       |
| GET    | `/api/admin/issue-heatmap`       | Admin     | Question volume heatmap       |
| GET    | `/api/admin/unanswered-searches` | Admin     | Failing search queries        |
| GET    | `/api/admin/faq-quality`         | Admin     | Quality ranking with actions  |
| GET    | `/api/admin/moderation-load`     | Admin     | Queue depth + moderator stats |
| GET    | `/api/admin/audit-logs`          | Admin     | Paginated audit log           |

---

## 13. User Management

### What It Does

Admin-only portal for managing user accounts — listing, searching, role changes, and account suspension.

### User-Facing Features

- **User list:** Paginated, filterable by role and status, searchable by name/email
- **Role change:** Promote/demote users between student, moderator, and admin
- **Suspend:** Prevents new logins and submissions; preserves existing content
- **Activate:** Re-enable a suspended account
- **Self-protection:** Admins cannot change their own role or suspend themselves

### High-Level Implementation

- Search uses a case-insensitive regex on `name` and `email` fields
- Every role change, suspension, and activation is logged to the audit trail via `auditService.log()`
- Suspension is "soft" — `user.status = 'suspended'`; login checks `user.status !== 'active'`

### Key Files

- **Backend:** `user.service.ts` (137 lines), `user.controller.ts`, `user.routes.ts`
- **Frontend:** `UserManagementPage.tsx` (19.9KB — the largest admin page)

### API Endpoints

| Method | Path                      | Auth  | Description                        |
| ------ | ------------------------- | ----- | ---------------------------------- |
| GET    | `/api/users`              | Admin | List users (paginated, filterable) |
| PATCH  | `/api/users/:id/role`     | Admin | Change user role                   |
| POST   | `/api/users/:id/suspend`  | Admin | Suspend a user                     |
| POST   | `/api/users/:id/activate` | Admin | Reactivate a user                  |

---

## 14. Audit Logging

### What It Does

Records all sensitive administrative actions with before/after state snapshots for accountability and compliance.

### Tracked Actions

- Role changes (with previous and new role)
- Account suspensions and activations (with previous and new status)
- Answer moderation (approve/reject)
- FAQ edits (with changed fields)
- System settings changes

### Audit Log Structure

```
_id, actorId, action, entityType, entityId, before, after, reason, createdAt
```

### High-Level Implementation

- `auditService.log()` is a fire-and-forget insert into the `AuditLog` collection
- `before` and `after` are stored as generic JSON objects — enables flexible diff rendering in the UI
- Admin retrieval supports pagination and filtering by actor, entity type, action, and date range
- Actor names resolved via `$lookup` / `.populate('actorId', 'name email role')`

### Key Files

- **Backend:** `audit.service.ts`, `audit.controller.ts`, `audit.routes.ts`
- **Frontend:** `AuditLogsPage.tsx` (8.7KB)

### API Endpoints

| Method | Path              | Auth  | Description                       |
| ------ | ----------------- | ----- | --------------------------------- |
| GET    | `/api/audit-logs` | Admin | Paginated audit logs with filters |

---

## 15. System Settings

### What It Does

Admin-configurable global thresholds that control chatbot behavior, duplicate detection, and moderation rules.

### Configurable Settings (Singleton `_id: "global"`)

| Setting                      | Default | Purpose                                        |
| ---------------------------- | ------- | ---------------------------------------------- |
| `duplicateWarnThreshold`     | 0.6     | Warn student if existing match > 60%           |
| `duplicateStrongThreshold`   | 0.8     | Block / strongly warn if > 80%                 |
| `chatbotConfidenceThreshold` | 0.7     | Minimum vector score for RAG context inclusion |
| `chatbotMaxSources`          | 6       | Max FAQ documents bundled into LLM payload     |
| `communityAnswerCap`         | 10      | Max answers per community question             |
| `urgentIdleDays`             | 7       | Days before a question is flagged as urgent    |

### High-Level Implementation

- Stored as a MongoDB singleton document (`_id: "global"`)
- Read by services at runtime (e.g., `chatbot.service.ts` reads thresholds before each query)
- Admin can modify via the Settings page; moderators can only read

### Key Files

- **Backend:** `settings.service.ts`, `settings.controller.ts`, `settings.routes.ts`
- **Frontend:** `SettingsPage.tsx` (6.6KB)

### API Endpoints

| Method | Path            | Auth      | Description            |
| ------ | --------------- | --------- | ---------------------- |
| GET    | `/api/settings` | Mod/Admin | Read system settings   |
| PATCH  | `/api/settings` | Admin     | Update system settings |

---

## 16. Analytics & Observability

### What It Does

A background analytics engine that tracks discrete user events, caches admin-facing aggregations, and surfaces data quality issues.

### Event Types Tracked

- `faq_viewed` — when a student views a FAQ
- `faq_helpful` / `faq_unhelpful` — when a student votes on a FAQ
- `faq_flagged` — when a student flags a FAQ
- Search queries (logged to `SearchLog` collection with query text and result count)

### Cached Aggregations (10-Minute TTL)

- **Portal overview:** Aggregate counts + 7-day activity snapshot
- **Issue heatmap:** Question volume by day
- **Unanswered searches:** Queries with 0 results, grouped by normalized query, sorted by frequency
- **FAQ quality:** Quality scores with editorial action recommendations
- **Moderation load:** Queue depth + per-moderator performance
- **Votes trend:** Daily helpful/unhelpful/flagged counts

### High-Level Implementation

| Aspect                   | Detail                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Event tracking**       | Fire-and-forget — analytics failures are swallowed, never surfacing to the user                 |
| **Cache layer**          | MongoDB `AnalyticsCache` collection with `expiresAt` field; 10-min TTL                          |
| **Search normalization** | Queries are lowercased, trimmed, and whitespace-collapsed before grouping                       |
| **Quality recompute**    | `FaqModel.calculateQualityScore()` is a static method on the model; can be run per-FAQ or batch |

### Key Files

- **Backend:** `analytics.service.ts` (472 lines), `admin.controller.ts`
- **Models:** `AnalyticsEvent.model.ts`, `AnalyticsCache.model.ts`, `SearchLog.model.ts`, `FeedbackEvent.model.ts`
- **Frontend:** `StudentAnalyticsPage.tsx` (student-facing), various admin pages consume these endpoints

---

## 17. Theme & UI Framework

### What It Does

A responsive, theme-aware UI built with React 18 and Vite, featuring dark/light mode toggling and a consistent design system.

### User-Facing Features

- **Dark/light theme toggle** via `data-theme` attribute on `<html>`
- **Responsive layout:** Sidebar navigation + main content area via `AppShell`
- **Floating chatbot button:** Accessible from every authenticated page
- **Role-based navigation:** Different sidebar items per role

### High-Level Implementation

| Aspect                | Detail                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| **Theme tokens**      | CSS custom properties defined in `globals.css`; toggled via `data-theme` |
| **Theme persistence** | `ThemeProvider.tsx` (React context) persists preference in localStorage  |
| **Layout**            | `AppShell.tsx` wraps `Sidebar.tsx` + `<Outlet />` from React Router      |
| **Icons**             | `lucide-react` icon library                                              |
| **Routing**           | React Router v6 with `<Routes>`, `<Route>`, `<Navigate>` for redirects   |
| **API client**        | Shared `apiClient` (axios instance) + TanStack Query hooks per feature   |

### Key Files

- **Layout:** `AppShell.tsx` (3.9KB), `Sidebar.tsx` (5.8KB), `ChatbotFab.tsx`
- **Theme:** `ThemeProvider.tsx`, `styles/globals.css`
- **Routing:** `App.tsx` (80 lines, 4.3KB)

### Client-Side Routes

| Path                         | Component               | Access    |
| ---------------------------- | ----------------------- | --------- |
| `/login`                     | LoginPage               | Public    |
| `/`                          | HomePage                | All roles |
| `/faqs`                      | FaqsPage                | All roles |
| `/community`                 | CommunityPage           | All roles |
| `/community/:id`             | QuestionDetailPage      | All roles |
| `/ask`                       | AskQuestionPage         | All roles |
| `/my-questions`              | MyQuestionsPage         | All roles |
| `/analytics`                 | StudentAnalyticsPage    | All roles |
| `/chatbot`                   | ChatbotPage             | All roles |
| `/moderation`                | ModerationOverviewPage  | Mod/Admin |
| `/moderation/unresolved`     | UnresolvedQuestionsPage | Mod/Admin |
| `/moderation/analytics`      | ModeratorAnalyticsPage  | Mod/Admin |
| `/moderation/faq-candidates` | FaqCandidatesPage       | Mod/Admin |
| `/admin`                     | AdminOverviewPage       | Admin     |
| `/admin/faqs`                | FaqManagementPage       | Mod/Admin |
| `/admin/users`               | UserManagementPage      | Admin     |
| `/admin/bot-feedback`        | ChatbotFeedbackPage     | Mod/Admin |
| `/admin/faq-quality`         | FaqQualityPage          | Mod/Admin |
| `/admin/audit-logs`          | AuditLogsPage           | Admin     |
| `/admin/moderation-load`     | ModerationLoadPage      | Admin     |
| `/admin/settings`            | SettingsPage            | Admin     |

---

## 18. Shared Package & Validation

### What It Does

The `@samagama/shared` npm workspace package is the single source of truth for all data validation schemas, enums, constants, and DTO types shared between the client and server.

### Contents

#### Enums (String Literal Types)

| Enum                               | Values                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `USER_ROLES`                       | `student`, `moderator`, `admin`                          |
| `USER_STATUSES`                    | `active`, `suspended`, `deleted`                         |
| `FAQ_STATUSES`                     | `draft`, `published`, `outdated`, `archived`             |
| `QUESTION_STATUSES`                | `open`, `answered`, `resolved`, `duplicate`, `archived`  |
| `QUESTION_TYPES`                   | `personal`, `community`                                  |
| `ANSWER_STATUSES`                  | `pending`, `approved`, `rejected`, `needs_changes`       |
| `FLAG_REASONS`                     | `incorrect`, `outdated`, `duplicate`, `unclear`, `other` |
| `FLAG_STATUSES`                    | `open`, `under_review`, `resolved`, `dismissed`          |
| `FLAG_ENTITY_TYPES`                | `faq`, `question`, `answer`, `chatbot_response`          |
| `CHAT_FEEDBACK_RATINGS`            | `helpful`, `incorrect`                                   |
| `PERSONAL_QUESTION_DISPLAY_STATES` | `posted`, `seen`, `responded`                            |

#### Constants

| Constant                                | Value  | Purpose                            |
| --------------------------------------- | ------ | ---------------------------------- |
| `SPURTI_POINTS.INITIAL_BALANCE`         | 100    | Starting points for new students   |
| `SPURTI_POINTS.ANSWER_APPROVED_DEFAULT` | 5      | Points on answer approval          |
| `SPURTI_POINTS.ANSWER_UPVOTED`          | 5      | Points per new upvote              |
| `COMMUNITY_ANSWER_CAP`                  | 10     | Max answers per community question |
| `ACCESS_TOKEN_TTL_SECONDS`              | 3600   | 1-hour access token                |
| `REFRESH_TOKEN_TTL_SECONDS`             | 604800 | 7-day refresh token                |
| `RECENT_FAQS_LIMIT`                     | 25     | Max recently-viewed FAQs per user  |
| `DEFAULT_PAGE_SIZE`                     | 20     | Default pagination size            |

#### Zod Schemas

- Validate all API inputs on both client (React Hook Form) and server (Express middleware)
- Each schema exports both the Zod object and an inferred TypeScript type
- Schema directory: `packages/shared/src/schemas/`

### High-Level Implementation

- Built as a TypeScript package compiled to `dist/`
- Both `apps/client` and `apps/server` declare it as a workspace dependency
- Server validation middleware: `validate(schema)` in `middlewares/validate.ts`
- Client validation: `zodResolver(schema)` in React Hook Form

---

## 19. Embedding & Similarity Engine

### What It Does

Generates vector embeddings for text (FAQ titles, search queries) and computes cosine similarity for semantic duplicate detection and RAG retrieval.

### Provider Support

| Provider         | Env Var                                        | Detail                                                                       |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `mock` (default) | `EMBEDDING_PROVIDER=mock`                      | Deterministic char-frequency vectors; no external calls; suitable for dev/CI |
| `gemini`         | `EMBEDDING_PROVIDER=gemini` + `GEMINI_API_KEY` | Google Gemini `text-embedding-004` (768-dim, truncated to 384)               |

### High-Level Implementation

| Aspect                   | Detail                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Dimension**            | 384-dim vectors stored on `Faq.embedding` and `Answer.embedding` fields                                          |
| **Generation trigger**   | Fire-and-forget on FAQ publish/update (never blocks the request)                                                 |
| **Cosine similarity**    | Manual dot-product / magnitude calculation — no external library                                                 |
| **Mock embedding**       | Maps characters to vector indices via `charCode % 384`; L2-normalised so similar strings produce similar vectors |
| **Fallback**             | If any provider fails, silently falls back to `mock`                                                             |
| **FAQ similarity check** | `faqService.checkSimilarity()` — cosine search + text-search fallback                                            |
| **Chatbot retrieval**    | `chatbotService.retrieveFaqSources()` — same pattern for RAG context                                             |

### Key Files

- **Backend:** `embedding.service.ts` (97 lines)

---

## 20. LLM Server (RAG Backend)

### What It Does

A lightweight Express server that wraps LM Studio (local LLM) to expose standardized internal APIs for the main backend to consume. Supports both synchronous generation and SSE streaming, plus conversation summarization for multiple use cases.

### Endpoints

| Method | Path                              | Purpose                                                                   |
| ------ | --------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/internal/llm/generate`          | Generate a RAG-grounded response from FAQ context + conversation history |
| POST   | `/internal/llm/generate-stream`   | SSE streaming version of generate with 5s pings and 5min timeout         |
| POST   | `/internal/llm/summarize`         | Dual-purpose: escalation summary OR rolling window chunk summarization    |
| POST   | `/internal/llm/summarize-chunks`  | Generate meta-summary from an array of chunk summaries                    |

### Authentication

- Bearer token authentication via `INTERNAL_SECRET` environment variable
- Shared between the main server and the LLM server

### High-Level Implementation

| Aspect               | Detail                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Runtime**          | Node.js + Express (JavaScript, not TypeScript)                                                       |
| **LLM backend**      | LM Studio via OpenAI-compatible `/chat/completions` API                                              |
| **Generate**         | Assembles system prompt + RAG context + history into a chat completion call; detects fallback string |
| **Generate-stream**  | SSE with ping every 5s, hard timeout 5min, sends `{type: 'ping'|'response'|'error'|'timeout'}`      |
| **Summarize**        | Dual-mode: escalation (requires `escalation_type`) or rolling window (requires `keepRecentCount`)      |
| **Summarize-chunks** | Takes `chunks[]` array, returns `metaSummary` — used for hierarchical summarization                  |
| **Temperature**      | Generate: 0.2 (factual), Summarize: 0.3 (concise), Meta-summary: 0.3 (coherent)                     |
| **Max tokens**       | Generate: 500, Summarize: 300, Meta-summary: 400                                                     |
| **Markdown cleanup** | Strips ` ```json ` wrappers if the LLM adds them                                                     |

### Rolling Window Summarization Flow

```
messages: [msg1, msg2, ..., msg20, msg21]

When 20 messages reached:
  → toSummarize = messages.slice(0, -10) = [msg1-msg10]
  → POST /internal/llm/summarize { conversation_history: [msg1-msg10], keepRecentCount: 10 }
  → Returns { summary: "...", summarizedCount: 10 }
  → messages becomes [msg11-msg20], chunks = [{summary, messageCount: 10}]

When 10 chunks reached (100 messages total):
  → POST /internal/llm/summarize-chunks { chunks: [chunk1, chunk2, ..., chunk10] }
  → Returns { metaSummary: "..." }
  → Oldest chunks evicted, metaSummary prepended to all future context
```

### Key Files

- `apps/rag/llm-server/index.js` (232 lines)
- `apps/rag/knowledge_base.md` (FAQ knowledge base — 36.6KB)
- `apps/rag/rag-detailed.md` (RAG architecture documentation)

---

## 21. Infrastructure & DevOps

### What It Does

Provides the scaffolding for local development, testing, and deployment.

### Development Setup

```bash
npm install                              # Install all workspaces
npm run build:shared                     # Build shared types
npm run dev:server                       # http://localhost:4000
npm run dev:client                       # http://localhost:5173
```

### Seed Data

| Script               | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `seed:accounts`      | 8 students + 3 moderators + 2 admins (idempotent, preserves balances) |
| `seed:faqs`          | 10 categories, 18 tags, 8 published FAQs                              |
| `seed:chat-feedback` | Demo chatbot feedback rows                                            |

### Security Layers

| Layer                | Implementation                                                |
| -------------------- | ------------------------------------------------------------- |
| **Helmet**           | Sets security headers (CSP, HSTS, etc.)                       |
| **CORS**             | Configurable origins via env; credentials enabled             |
| **Rate limiting**    | Global: 200 req/min/IP; Login: 10/15min/IP                    |
| **Body limit**       | JSON and URL-encoded bodies capped at 1MB                     |
| **bcrypt**           | 12 rounds for password hashing                                |
| **JWT**              | Separate secrets for access/refresh; version-based revocation |
| **Input validation** | Zod schemas on all mutating endpoints                         |

### Docker

- `docker-compose.yml` present for container orchestration

### Testing

| Tool            | Coverage                       |
| --------------- | ------------------------------ |
| Vitest          | Unit + integration test runner |
| Supertest       | API endpoint testing           |
| Testing Library | React component testing        |

### Key Files

- `docker-compose.yml`, `package.json` (workspace root), `tsconfig.base.json`
- `apps/server/src/app.ts` (Express factory), `apps/server/src/index.ts` (server start)
- `apps/server/src/config/env.ts` (Zod-validated environment)

---

## 22. Implementation Status Summary

| Phase | Feature Area                                                 | Status     |
| ----- | ------------------------------------------------------------ | ---------- |
| 0     | Foundation (monorepo, tooling, shared, docs)                 | ✅ Done    |
| 1     | Backend core (Express, Mongo, error handling, auth, RBAC)    | ✅ Done    |
| 2     | Frontend core (Vite, routing, layout, theme, auth flow)      | ✅ Done    |
| 3     | FAQ system (CRUD, text search, feedback, view tracking)      | ✅ Done    |
| 4     | Community Q&A (multi-step Ask, My Questions, moderation)     | ✅ Done    |
| 5     | Moderator + Admin dashboards                                 | ✅ Done    |
| 5b    | Student Home + Analytics + Spurti Points                     | ✅ Done    |
| 5c    | UI Polish Sprint                                             | ✅ Done    |
| 6     | RAG Chatbot (Yaksha — embedding, retrieval, LLM, escalation) | ✅ Done    |
| 7     | Hardening (security review, perf, a11y, full test coverage)  | ⏳ Planned |

### Spec Coverage

- **Student Dashboard Spec:** 33 / 36 (~92%) — remaining 3 items are Phase 7 polish
- **Admin & Moderator Dashboard Spec:** 44 / 44 (100%) ✅

### Known Limitations

- No email verification or password reset flow (planned Phase 7)
- File upload for screenshots requires storage decision (S3 vs GridFS) — pending
- No retry/backoff on axios client (TanStack Query default retry suffices)
- ESLint flat config does not yet include React-specific plugins
- Chat session storage is in-process (not distributed); sessions are lost on server restart
- **Chatbot SSE streaming:** Ollama direct streaming (`callOllamaStream`) lacks an explicit client-side timeout — relies on network-level timeout; consider adding a 5-minute abort timer in a future iteration
- **Chatbot SSE streaming:** SSE line parsing splits on `\n` (single newline) rather than `\n\n` (double newline for strict SSE) — works correctly in practice but may misparse malformed streams
- **Chatbot SSE streaming:** The `sendMutation` React Query hook in `ChatbotPage.tsx` is imported but unused after switching to SSE streaming — button disable logic still works via `!input.trim()`, but the dead code should be cleaned up

---

> **Last Updated:** June 6, 2026
