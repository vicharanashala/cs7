# Backend Team — Implementation Status & API Contracts

## Executive Summary

**What we have built:** A production-ready Node.js + MongoDB backend for the Samagama student portal. The server already owns all user data, FAQ management, community Q&A, moderation workflows, role-based access, and audit logging. The LLM/RAG layer is architected as **Phase 6** — the data models already have `embedding` fields reserved, and the environment config already accepts `LLM_PROVIDER` and `EMBEDDING_PROVIDER` switches. Everything the LLM team needs us to own is either already built or plugs into an explicit placeholder.

**What the LLM team needs to know:** You will talk to one endpoint on our server (`POST /api/chat/query` — to be wired in Phase 6). We will call your two endpoints (`/internal/llm/generate` and `/internal/llm/summarize`) from our `chatbotService`. We are the orchestrator. You are stateless compute. That contract from your spec is exactly how we planned it.

---

## 1. System Architecture — What We Own

| Layer              | Technology                                              | Status                      |
| ------------------ | ------------------------------------------------------- | --------------------------- |
| HTTP Server        | Node.js 20 + Express 5                                  | Built                       |
| Database           | MongoDB Atlas (Mongoose ODM)                            | Built                       |
| Auth               | JWT (access + refresh), bcrypt                          | Built                       |
| RBAC               | `student` / `moderator` / `admin` roles                 | Built                       |
| FAQ Management     | Full CRUD + text search + feedback                      | Built                       |
| Community Q&A      | Questions, Answers, votes, moderation                   | Built                       |
| Audit Logging      | All mod/admin actions recorded                          | Built                       |
| Flag/Report System | FAQs, questions, answers, chatbot responses             | Built                       |
| System Settings    | Configurable thresholds (confidence, sources cap, etc.) | Built                       |
| Embedding field    | Reserved on `Faq` and `Answer` models                   | Schema ready, not populated |
| Vector Search      | MongoDB `$vectorSearch` index                           | Phase 6                     |
| Chat Session / RAG | Chatbot query flow                                      | Phase 6                     |
| LLM integration    | Outbound calls to `/generate` and `/summarize`          | Phase 6                     |

---

## 2. MongoDB Collections (Single Source of Truth)

### `users`

```
_id, name, email, passwordHash, role (student|moderator|admin),
status (active|suspended|deleted), tokenVersion, spurtiPoints,
recentlyViewedFaqs[], createdAt, updatedAt
```

- Students start with 100 `spurtiPoints`. Points are awarded by moderators on answer approval.
- `tokenVersion` is bumped on password change to invalidate outstanding refresh tokens.

### `faqs`

```
_id, title, slug, answer, summary,
categories[], tags[],
status (draft|published|archived),
sourceType (manual|community_conversion|imported),
embedding: [Number]  ← Phase 6: vector of FAQ title/question
helpfulCount, unhelpfulCount, viewCount, flagCount,
createdBy, updatedBy, publishedAt, createdAt, updatedAt
```

- **Text index** on `(title × 10, summary × 5, answer × 1)` — used today for keyword search; `$vectorSearch` will replace/augment in Phase 6.
- `embedding` field is `select: false` (never returned in normal queries, only fetched by the RAG pipeline).
- Only `published` FAQs will be fed into vector search.

### `questions` (Community Q&A)

```
_id, title, description, category, tags[],
type (personal|community),
status (open|resolved|closed|duplicate),
askedBy, taggedStudents[],
screenshotUrl, moderatorViewedAt,
existingAnswerCheck { checkedAt, matchedFaqs[], matchedQuestions[] },
viewCount, answerCount, createdAt, updatedAt
```

- **Text index** on `(title × 10, description × 1)` for the "Check Existing Answers" similarity lookup before a student posts.
- Personal questions are invisible to other students — only the asker and moderators see them.

### `answers`

```
_id, questionId, body, answeredBy,
status (pending|approved|rejected|edited_pending),
moderatorId, moderationNote, approvedAt,
embedding: [Number]  ← Phase 6
eligibleForFaqConversion, convertedFaqId,
upvoteCount, downvoteCount, createdAt, updatedAt
```

- Only `approved` answers with high upvotes will be candidates for the RAG `queries` collection (the 7-day TTL collection maps to this + a `verifiedAt` timestamp to be added in Phase 6).

### `chatfeedbacks`

```
_id, chatSessionId, messageIndex,
query (snapshot), answer (snapshot),
rating (helpful|unhelpful|incorrect),
comment, userId,
status (open|reviewed|resolved),
createdAt, updatedAt
```

- `incorrect` rating = flagged chatbot response → feeds the moderator review inbox.

### `systemsettings` (singleton `_id: "global"`)

```
duplicateWarnThreshold: 0.6,      ← warn student if existing match > 60%
duplicateStrongThreshold: 0.8,    ← block / strongly warn if > 80%
chatbotConfidenceThreshold: 0.7,  ← minimum vector score to include in RAG context
chatbotMaxSources: 6,             ← max docs bundled into your /generate payload
communityAnswerCap: 10,           ← max answers per community question
urgentIdleDays: 7
```

- These are **your thresholds to read.** When we call your `/generate` endpoint we will pre-filter by `chatbotConfidenceThreshold` and cap sources at `chatbotMaxSources` before building the payload.

### `auditlogs`

```
_id, actorId, action, entityType, entityId, before, after, reason, createdAt
```

### `flags`

```
_id, entityType (faq|question|answer|chatbot_response), entityId,
reason, details, status (open|under_review|resolved|dismissed),
reportedBy, reviewedBy, resolutionNote, createdAt, updatedAt
```

- Unique partial index: one active flag per `(user, entityType, entityId)`.

---

## 3. Environment Variables (What Phase 6 Will Use)

```env
# Already validated at startup via Zod — server won't boot if these are wrong

LLM_PROVIDER=local-llama        # mock | gemini | local-llama
EMBEDDING_PROVIDER=gemini       # mock | gemini
GEMINI_API_KEY=...              # only needed if EMBEDDING_PROVIDER=gemini

# To be added in Phase 6:
LLM_BASE_URL=https://<your-server>/internal/llm
LLM_INTERNAL_SECRET=<shared-bearer-token>
```

---

## 4. Current API Surface (All endpoints under `/api`)

### Auth — `/api/auth`

| Method | Path        | Auth   | Description                    |
| ------ | ----------- | ------ | ------------------------------ |
| POST   | `/register` | Public | Create student account         |
| POST   | `/login`    | Public | Returns access + refresh token |
| POST   | `/refresh`  | Public | Rotate refresh token           |
| POST   | `/logout`   | Public | Invalidate session             |
| GET    | `/me`       | Bearer | Current user profile           |

- Login is rate-limited: **10 attempts per 15 minutes per IP**.
- Access token TTL and refresh token TTL are defined in `@samagama/shared`.

### FAQs — `/api/faqs`

| Method | Path            | Auth      | Description                                                   |
| ------ | --------------- | --------- | ------------------------------------------------------------- |
| GET    | `/`             | Bearer    | List/search FAQs (text search, filter by category/tag/status) |
| GET    | `/:id`          | Bearer    | Single FAQ detail                                             |
| GET    | `/recent`       | Bearer    | User's recently viewed FAQs                                   |
| POST   | `/`             | Mod/Admin | Create FAQ                                                    |
| PATCH  | `/:id`          | Mod/Admin | Update FAQ                                                    |
| PATCH  | `/:id/archive`  | Mod/Admin | Archive FAQ                                                   |
| POST   | `/:id/view`     | Bearer    | Record view (increments viewCount)                            |
| POST   | `/:id/feedback` | Bearer    | Submit helpful/unhelpful vote                                 |

### Community Q&A — `/api/qna`

| Method | Path                           | Auth   | Description                                                   |
| ------ | ------------------------------ | ------ | ------------------------------------------------------------- |
| POST   | `/check-existing`              | Bearer | Similarity search before posting (returns signed check token) |
| POST   | `/questions`                   | Bearer | Post a question (requires check token)                        |
| GET    | `/questions`                   | Bearer | List questions                                                |
| GET    | `/questions/:id`               | Bearer | Question detail                                               |
| POST   | `/questions/:id/tag-me`        | Bearer | Express interest in a question                                |
| GET    | `/questions/:id/answers`       | Bearer | List answers on a question                                    |
| POST   | `/questions/:id/answers`       | Bearer | Submit an answer                                              |
| POST   | `/answers/:id/vote/:direction` | Bearer | Upvote/downvote an answer                                     |

### Chatbot — `/api/chat` _(Phase 6 write-paths not yet wired)_

| Method | Path              | Auth      | Description                                                        |
| ------ | ----------------- | --------- | ------------------------------------------------------------------ |
| GET    | `/feedback`       | Mod/Admin | List chatbot feedback                                              |
| GET    | `/feedback/stats` | Mod/Admin | Feedback counts                                                    |
| POST   | `/query`          | Bearer    | **Phase 6** — student sends message, we orchestrate RAG + LLM call |

### Other Existing Routes

| Route prefix      | Auth                             | Description                               |
| ----------------- | -------------------------------- | ----------------------------------------- |
| `/api/categories` | Mod/Admin (write), Bearer (read) | FAQ category CRUD                         |
| `/api/tags`       | Mod/Admin (write), Bearer (read) | Tag CRUD                                  |
| `/api/moderation` | Mod/Admin                        | Pending answer queue, approve/reject/edit |
| `/api/flags`      | Mod/Admin                        | Flag inbox                                |
| `/api/stats`      | Mod/Admin                        | Dashboard analytics                       |
| `/api/users`      | Admin                            | User management                           |
| `/api/audit-logs` | Admin                            | Audit trail                               |
| `/api/settings`   | Admin (write), Mod (read)        | System settings                           |

---

## 5. Auth Contract (How the Two Servers Communicate)

### Frontend → Our Server

All frontend requests use user JWT access tokens in the `Authorization` header:

```
Authorization: Bearer <user_access_token>
```

Tokens are short-lived (15 min). The frontend uses `POST /api/auth/refresh` to rotate.

### Our Server → LLM Server (Phase 6)

All calls from our Node.js server to your server use a shared internal Bearer token:

```
Authorization: Bearer <LLM_INTERNAL_SECRET>
```

This secret is set in both teams' `.env` files and is never exposed to the frontend.

---

## 6. Phase 6 Integration Plan (RAG + Escalation)

### A. Standard Chat Workflow

When a student sends a message via `POST /api/chat/query`, our server will:

1. Generate a query embedding via `EMBEDDING_PROVIDER` (Gemini API or mock).
2. Run `$vectorSearch` on the `faqs` collection — cosine similarity, minimum score from `systemsettings.chatbotConfidenceThreshold` (default `0.7`), capped at `chatbotMaxSources` (default `6`).
3. Also search `answers` collection for approved community answers with embeddings.
4. Pull the user's chat history from in-process TTL cache (active for 30 min after last message).
5. Assemble and send to your `/internal/llm/generate`:

```json
{
  "system_instruction": "You are a helpful support bot. Use ONLY the provided context to answer. If the answer is not in the context, reply EXACTLY with: 'I don't have an answer for you at the moment. You can escalate it to backend team: Type #escalate'.",
  "rag_context": ["FAQ: <title> — <answer>", "Query: <question> Answer: <approved_answer_body>"],
  "conversation_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "current_message": "<student's message>"
}
```

6. Receive your response:

```json
{
  "status": "success",
  "data": {
    "response_text": "...",
    "fallback_triggered": false
  }
}
```

7. If `fallback_triggered: true` — unlock `#escalate` for that user's next message.
8. Save the exchange to chat history cache and return `response_text` to the frontend.

### B. Escalation Workflow (`#escalate` / `#forceescalate`)

When the backend intercepts an escalation command:

1. For `#escalate`: verify the user's last response had `fallback_triggered: true`.
2. For `#forceescalate [reason]`: no eligibility check — always allowed.
3. Package and send to your `/internal/llm/summarize`:

```json
{
  "escalation_type": "force_escalate",
  "force_reason": "<reason text, if forceescalate>",
  "conversation_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

4. Receive your response:

```json
{
  "status": "success",
  "data": {
    "summary": "...",
    "is_general_query": false
  }
}
```

5. Attach `userId` and insert into the `tickets` collection (to be added Phase 6), or merge into an existing open ticket if similarity > 99%.
6. Alert the frontend that a ticket has been created.

### TTL Index for Verified Queries Collection

The 7-day auto-expiry for verified community Q&A answers will be implemented as:

```js
verifiedQueriesSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }, // 168 hours
);
```

MongoDB Atlas will automatically purge documents from this collection after 7 days.

---

## 7. What We Need From the LLM Team

| Item                  | Detail                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `LLM_BASE_URL`        | The HTTPS base URL of your llama.cpp server                                                                             |
| `LLM_INTERNAL_SECRET` | Agreed shared Bearer secret for internal calls                                                                          |
| JSON schema guarantee | Confirm `is_general_query` (boolean) + `summary` (string) are always returned from `/summarize` with no markdown filler |
| Fallback string       | Confirm the exact fallback string your model outputs so we can match it server-side to set `fallback_triggered: true`   |
| Rate limits           | Any requests-per-minute cap we should respect when calling your server                                                  |
| Embedding dimensions  | The vector dimension size your model uses (so we can create the Atlas vector index with the correct `numDimensions`)    |
