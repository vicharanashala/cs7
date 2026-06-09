# Product Requirements Document: Samagama Internship Portal FAQ, Community Q&A, and Chatbot

## 1. Product Summary

### Product Name

Samagama Internship Portal Enhancement

### Product Type

Web application module for FAQ discovery, community Q&A, moderation, and chatbot-assisted support.

### Technology Stack

The product must use the following stack only for MVP implementation:

| Layer / Purpose                  | Technology                                         | Usage in Product                                                                                             | Notes                                                                  |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Frontend                         | React.js                                           | Student portal, FAQ interface, chatbot UI, community Q&A, moderator dashboard, admin dashboard               | Recommended setup: React with Vite                                     |
| Backend Runtime                  | Node.js                                            | Server runtime for APIs, chatbot orchestration, embedding jobs, analytics, and scheduled tasks               | All backend logic must run in Node.js                                  |
| Backend Framework                | Express.js                                         | REST APIs, authentication middleware, role-based access control, moderation workflow, and admin APIs         | Keep controllers thin and place business logic in services             |
| Database                         | MongoDB                                            | Users, FAQs, categories, tags, questions, answers, flags, chat sessions, feedback, audit logs, and analytics | MongoDB Atlas preferred for deployment                                 |
| Semantic Search / Vector Storage | MongoDB Atlas Vector Search                        | FAQ similarity search, duplicate detection, existing-answer checks, and chatbot retrieval                    | Keeps RAG implementation within MERN; avoid separate vector DB for MVP |
| Authentication                   | JWT + bcrypt in Node.js                            | Login, protected routes, refresh sessions, password hashing, and role-based access                           | Can be replaced by existing Samagama auth if available                 |
| Validation                       | Zod or Joi                                         | Request body validation, form validation rules, and API safety                                               | Use consistently across backend APIs                                   |
| Frontend API State               | TanStack Query                                     | Data fetching, caching, pagination, mutations, and loading states                                            | Recommended for clean React API handling                               |
| Forms                            | React Hook Form                                    | FAQ editor, question submission, answer submission, login, and admin forms                                   | Pair with Zod/Joi validation schema where possible                     |
| LLM Provider Adapter             | Gemini API or Node-compatible local model endpoint | Chatbot answer generation after MongoDB retrieval                                                            | Keep provider swappable through a backend adapter                      |
| Optional RAG Orchestration       | LangChain.js                                       | Optional orchestration for retrieval and prompt chains                                                       | Use only if direct Node.js implementation becomes complex              |

No Python service, separate backend framework, or separate vector database should be introduced for the MVP.

### One-Line Product Description

A MERN-based portal that organizes FAQs with tags and categories, prevents duplicate knowledge entries, enables moderated community Q&A, and powers a continuously updated chatbot using MongoDB-backed semantic retrieval.

---

## 2. Background and Context

The current Samagama internship portal has more than 150 FAQs shown in a single scrollable list. Students struggle to find relevant answers because FAQs are not categorized, tagged, filtered, or freshness-ranked. Many FAQs are stale or overlapping, creating redundant answers and confusion.

The existing chatbot, Yaksha Mini, has reliability issues when semantically similar FAQs exist. It may return incorrect answers and does not automatically update when new FAQs are added, requiring manual knowledge-base syncing.

There is also no structured student community Q&A system where students can post unanswered queries, receive peer responses, and have moderators validate correct answers before they become official knowledge.

The proposed product solves this by combining:

- Categorized and tagged FAQ discovery.
- Freshness and duplicate management.
- Community Q&A with moderation.
- RAG-based chatbot powered through MongoDB vector search.
- Role-based dashboards for students, moderators, and admins.

---

## 3. Goals

### Business and Product Goals

1. Make FAQs easy to discover through search, category filters, tag filters, and status filters.
2. Reduce duplicate FAQ creation by checking semantic similarity before saving new questions.
3. Keep the chatbot knowledge base automatically updated when FAQs are created, edited, approved, or retired.
4. Enable students to post unresolved questions and receive validated answers.
5. Give moderators a reliable workflow to approve, reject, merge, or convert community answers into official FAQs.
6. Give admins visibility into FAQ health, unresolved questions, flagged content, duplicate risk, and chatbot feedback.
7. Build an MVP that can run locally first and then be deployed using free-tier cloud resources.

### Technical Goals

1. Use only MERN stack technologies for core product development.
2. Store all structured and semantic FAQ data in MongoDB.
3. Use MongoDB Atlas Vector Search instead of a separate vector database.
4. Use Node.js services for semantic search, duplicate detection, chatbot orchestration, and embedding updates.
5. Keep model providers swappable through a backend adapter pattern.
6. Ensure every official chatbot answer is grounded in approved FAQ or approved community-answer content.

---

## 4. Non-Goals

The MVP will not include:

1. Native mobile applications.
2. A separate Python AI microservice.
3. A separate vector database such as Pinecone, Weaviate, Chroma, or FAISS.
4. Unmoderated publishing of community answers into official FAQs.
5. Full notification implementation unless separately approved by organizers.
6. Training or fine-tuning a custom LLM.
7. Replacing the entire existing Samagama portal.
8. Complex forum features such as reputation points, badges, nested threads, or private messaging.

---

## 5. Product Scope

## 5.1 MVP Scope

The MVP must include the following modules:

1. Authentication and role-based access.
2. FAQ listing with search, categories, tags, and filters.
3. FAQ creation and editing by authorized users.
4. Auto-tagging suggestions for FAQs.
5. Duplicate detection before FAQ creation.
6. Recently updated and recently viewed FAQ sections.
7. Community Q&A creation by students.
8. Existing-answer check before question submission.
9. Peer answer submission.
10. Moderator approval workflow.
11. Admin dashboard with basic stats.
12. Flag/report system for incorrect or outdated FAQs.
13. RAG-based chatbot using MongoDB Vector Search.
14. Automatic chatbot knowledge refresh when approved FAQs change.

## 5.2 Phase 2 Scope

1. Bulk FAQ import from CSV/JSON.
2. Advanced FAQ deduplication and merge recommendations.
3. FCM-based push notifications, if approved.
4. Pre-login announcement board.
5. More detailed chatbot feedback analytics.
6. Moderator workload assignment.
7. Email digest for unresolved questions.
8. Advanced search ranking using views, freshness, ratings, and resolved status.

## 5.3 Phase 3 Scope

1. Local Llama model deployment through Node-compatible HTTP integration.
2. Advanced answer quality scoring.
3. Student satisfaction analytics.
4. Multilingual support.
5. Institution-level server deployment.
6. Integration with existing Samagama user database, if available.

---

## 6. User Roles and Permissions

## 6.1 Student

### Capabilities

- View FAQs.
- Search and filter FAQs.
- View recently updated FAQs.
- View recently accessed FAQs for their own account.
- Ask questions through the community Q&A flow.
- See suggested existing answers before submitting a new question.
- Answer peer questions.
- Flag incorrect, outdated, duplicate, or unclear FAQs.
- Use chatbot.
- Rate chatbot answers as helpful or not helpful.

### Restrictions

- Cannot directly create official FAQs.
- Cannot approve answers.
- Cannot delete FAQs.
- Cannot manage users or categories.

## 6.2 Moderator

### Capabilities

- All student capabilities.
- Review flagged FAQs.
- Review community answers.
- Approve peer answers.
- Reject answers with reason.
- Convert approved answers into FAQ candidates.
- Suggest FAQ edits.
- Mark community questions as resolved.
- Merge duplicate question threads.

### Restrictions

- Cannot manage system-wide settings unless admin permission is granted.
- Cannot permanently delete records; can only archive or recommend deletion.

## 6.3 Admin

### Capabilities

- All moderator capabilities.
- Create, edit, archive, and restore FAQs.
- Manage categories and tags.
- Manage users and roles.
- View dashboard statistics.
- Configure duplicate detection thresholds.
- Configure chatbot model provider.
- Configure embedding model provider.
- Approve FAQ publishing.
- Export analytics.

---

## 7. Key User Journeys

## 7.1 Student Finds an Existing FAQ

1. Student opens FAQ page.
2. System displays search bar, category chips, tag filters, status filter, recently updated FAQs, and popular FAQs.
3. Student searches for a query such as “NOC issue”.
4. System performs keyword and semantic search.
5. Student applies category or tag filters.
6. Matching FAQs are shown with title, category, tags, update date, and status.
7. Student opens FAQ detail page.
8. System records the FAQ as recently viewed for that student.

## 7.2 Student Asks a New Question

1. Student clicks “Ask a Question”.
2. Student enters title, description, category, and optional attachments or screenshots.
3. Before submission, system runs semantic search against approved FAQs and resolved community questions.
4. System shows possible existing answers.
5. Student can either:
   - Open an existing answer.
   - Continue submitting if results do not solve the issue.
6. Submitted question appears in community feed as “Open”.
7. Peers and moderators can answer.
8. Moderator approves a correct answer.
9. Question status changes to “Resolved”.
10. Approved answer becomes eligible for FAQ conversion.

## 7.3 Moderator Approves an Answer

1. Moderator opens moderation dashboard.
2. Moderator sees pending answers.
3. Moderator reviews answer quality, correctness, and source.
4. Moderator approves, rejects, or requests changes.
5. If approved, answer becomes visible under the community question.
6. Moderator can mark the question as resolved.
7. Moderator can recommend conversion to FAQ.

## 7.4 Admin Creates or Updates an FAQ

1. Admin opens FAQ management dashboard.
2. Admin creates a new FAQ or edits an existing FAQ.
3. System suggests categories and tags.
4. System checks semantic similarity against existing FAQs.
5. If similarity exceeds configured threshold, system warns admin and suggests merge instead of creating duplicate.
6. Admin can:
   - Cancel creation.
   - Merge into existing FAQ.
   - Continue with justification.
7. Once saved, the FAQ is embedded and indexed in MongoDB Atlas Vector Search.
8. Chatbot can immediately retrieve the updated FAQ.

## 7.5 Student Uses Chatbot

1. Student opens chatbot.
2. Student enters a question.
3. Backend generates query embedding.
4. MongoDB Vector Search retrieves top matching approved FAQs and approved community answers.
5. Backend sends retrieved context to configured LLM provider through Node.js.
6. Chatbot returns a grounded answer with links to source FAQs.
7. Student can mark the answer as helpful or incorrect.
8. Incorrect feedback is added to admin/moderator review queue.

---

## 8. Functional Requirements

## 8.1 Authentication and Authorization

### Requirements

| ID       | Requirement                                                                 | Priority |
| -------- | --------------------------------------------------------------------------- | -------- |
| AUTH-001 | Users must be able to log in securely.                                      | P0       |
| AUTH-002 | System must support Student, Moderator, and Admin roles.                    | P0       |
| AUTH-003 | APIs must enforce role-based access control.                                | P0       |
| AUTH-004 | JWT access tokens and refresh tokens should be used for session management. | P0       |
| AUTH-005 | Passwords must be hashed using bcrypt.                                      | P0       |
| AUTH-006 | Admins must be able to change user roles.                                   | P1       |

### Suggestion

If the existing Samagama portal already has authentication, integrate with it through a token verification middleware. If not available, implement standalone JWT authentication for MVP.

---

## 8.2 FAQ Listing and Discovery

### Requirements

| ID      | Requirement                                                                                     | Priority |
| ------- | ----------------------------------------------------------------------------------------------- | -------- |
| FAQ-001 | Students must see FAQs in a structured list, not one long unorganized page.                     | P0       |
| FAQ-002 | FAQs must support categories.                                                                   | P0       |
| FAQ-003 | FAQs must support multiple tags.                                                                | P0       |
| FAQ-004 | FAQs must support multi-category tagging when needed.                                           | P1       |
| FAQ-005 | Users must be able to filter FAQs by category.                                                  | P0       |
| FAQ-006 | Users must be able to filter FAQs by tag.                                                       | P0       |
| FAQ-007 | Users must be able to filter FAQs by status: Open, Resolved, Archived.                          | P0       |
| FAQ-008 | Users must be able to search FAQs by title and content.                                         | P0       |
| FAQ-009 | Search must combine keyword search and semantic search.                                         | P0       |
| FAQ-010 | FAQ cards must show title, short answer preview, tags, category, status, and last updated date. | P0       |
| FAQ-011 | FAQ detail page must show full answer, related FAQs, source metadata, and feedback actions.     | P0       |

### Suggested Implementation

Use a hybrid search approach:

1. MongoDB text index for keyword search.
2. MongoDB Atlas Vector Search for semantic similarity.
3. Backend combines scores and returns ranked results.

This avoids a separate vector DB and keeps the system strictly MERN.

---

## 8.3 FAQ Freshness

### Requirements

| ID            | Requirement                                                                | Priority |
| ------------- | -------------------------------------------------------------------------- | -------- |
| FAQ-FRESH-001 | System must show recently updated FAQs.                                    | P0       |
| FAQ-FRESH-002 | System must store last updated timestamp for each FAQ.                     | P0       |
| FAQ-FRESH-003 | System must show recently viewed FAQs per logged-in user.                  | P1       |
| FAQ-FRESH-004 | Admins must be able to mark FAQs as outdated.                              | P1       |
| FAQ-FRESH-005 | Moderators and students must be able to flag outdated FAQs.                | P0       |
| FAQ-FRESH-006 | Archived FAQs must not appear in normal search unless explicitly filtered. | P0       |

### Suggestion

Add a `freshnessScore` derived from last update date, view count, helpfulness rating, and flag count. Do not rely only on date because old FAQs can still be valid.

---

## 8.4 FAQ Duplicate Detection

### Requirements

| ID         | Requirement                                                                | Priority |
| ---------- | -------------------------------------------------------------------------- | -------- |
| DEDUPE-001 | System must check similarity before creating a new FAQ.                    | P0       |
| DEDUPE-002 | System must compare new FAQ title and body against existing approved FAQs. | P0       |
| DEDUPE-003 | If similarity is 60–80% or above, system must show possible duplicates.    | P0       |
| DEDUPE-004 | Admin must be able to merge the new FAQ into an existing FAQ.              | P1       |
| DEDUPE-005 | Admin must be able to override duplicate warning with justification.       | P1       |
| DEDUPE-006 | Duplicate threshold must be configurable by admin.                         | P1       |

### Recommended Thresholds

| Similarity Score | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Below 60%        | Allow creation normally.                                                    |
| 60% to 79%       | Show warning and recommended similar FAQs.                                  |
| 80% or above     | Strongly recommend merge; require admin justification to create separately. |

### Suggestion

Use embeddings and cosine similarity through MongoDB Vector Search. Avoid simple character matching because semantically similar student questions may use different words.

---

## 8.5 Auto-Tagging

### Requirements

| ID      | Requirement                                                     | Priority |
| ------- | --------------------------------------------------------------- | -------- |
| TAG-001 | System must suggest tags when admin creates or edits an FAQ.    | P1       |
| TAG-002 | System must allow manual tag selection through checkboxes.      | P0       |
| TAG-003 | System must allow multiple tags per FAQ.                        | P0       |
| TAG-004 | System must allow admins to create, edit, and archive tags.     | P1       |
| TAG-005 | Existing FAQ migration should include auto-tagging suggestions. | P1       |

### Suggested Implementation

Start with rules plus embeddings:

1. Maintain category keywords such as NOC, certificate, login, technical issue, deadline, stipend, attendance.
2. Suggest tags based on keyword matches.
3. Use embedding similarity to match FAQ content to existing tag descriptions.
4. Let admins approve or edit suggestions.

For MVP, do not depend entirely on an LLM for tagging. Rule-assisted tagging will be cheaper, faster, and easier to debug.

---

## 8.6 Community Q&A

### Requirements

| ID      | Requirement                                                                                | Priority |
| ------- | ------------------------------------------------------------------------------------------ | -------- |
| QNA-001 | Students must be able to post new questions.                                               | P0       |
| QNA-002 | System must check existing FAQs before allowing final submission.                          | P0       |
| QNA-003 | System must show matching FAQs and resolved questions before submission.                   | P0       |
| QNA-004 | Students must be able to continue submission if suggestions are not useful.                | P0       |
| QNA-005 | Students must be able to answer open questions.                                            | P0       |
| QNA-006 | Answers must be hidden or marked pending until moderator approval.                         | P0       |
| QNA-007 | Moderators must approve or reject answers.                                                 | P0       |
| QNA-008 | Approved answers must be visible to students.                                              | P0       |
| QNA-009 | Questions must support statuses: Open, Answered, Resolved, Duplicate, Archived.            | P0       |
| QNA-010 | Moderators must be able to mark a question as duplicate and link it to the original.       | P1       |
| QNA-011 | Resolved community questions must be eligible for chatbot retrieval only after moderation. | P0       |

### Suggestion

Do not immediately convert every resolved community question into an official FAQ. Instead, use a two-step process:

1. Approve community answer.
2. Admin or moderator recommends it for FAQ conversion.

This protects the official FAQ base from low-quality or overly specific content.

---

## 8.7 Moderation Workflow

### Requirements

| ID      | Requirement                                                     | Priority |
| ------- | --------------------------------------------------------------- | -------- |
| MOD-001 | Moderators must have a dashboard of pending answers.            | P0       |
| MOD-002 | Moderators must see flagged FAQs.                               | P0       |
| MOD-003 | Moderators must see unresolved questions.                       | P0       |
| MOD-004 | Moderators must approve, reject, or request changes on answers. | P0       |
| MOD-005 | Rejection must require a reason.                                | P1       |
| MOD-006 | Moderators must be able to mark content as duplicate.           | P1       |
| MOD-007 | Moderators must be able to recommend FAQ conversion.            | P1       |
| MOD-008 | Admins must perform final FAQ publishing.                       | P1       |

### Moderation States

| Entity   | States                                        |
| -------- | --------------------------------------------- |
| Question | Open, Answered, Resolved, Duplicate, Archived |
| Answer   | Pending, Approved, Rejected, Needs Changes    |
| FAQ      | Draft, Published, Outdated, Archived          |
| Flag     | Open, Under Review, Resolved, Dismissed       |

---

## 8.8 Flag and Report System

### Requirements

| ID       | Requirement                                                                        | Priority |
| -------- | ---------------------------------------------------------------------------------- | -------- |
| FLAG-001 | Students must be able to flag FAQs.                                                | P0       |
| FLAG-002 | Students must choose flag reason.                                                  | P0       |
| FLAG-003 | Supported reasons must include incorrect, outdated, duplicate, unclear, and other. | P0       |
| FLAG-004 | Users may optionally add details.                                                  | P1       |
| FLAG-005 | Moderators must review flags.                                                      | P0       |
| FLAG-006 | Admins must see flag count per FAQ.                                                | P0       |
| FLAG-007 | High-flag FAQs should be prioritized in admin dashboard.                           | P1       |

### Suggestion

Allow one active flag per user per FAQ to prevent spam. If a user flags again, update their existing flag instead of creating duplicates.

---

## 8.9 Chatbot and RAG Pipeline

### Requirements

| ID      | Requirement                                                                                  | Priority |
| ------- | -------------------------------------------------------------------------------------------- | -------- |
| BOT-001 | Chatbot must answer questions using approved FAQ and approved community-answer content only. | P0       |
| BOT-002 | Chatbot must retrieve semantically similar content using MongoDB Vector Search.              | P0       |
| BOT-003 | Chatbot knowledge must update automatically when FAQs are created or edited.                 | P0       |
| BOT-004 | Chatbot must show source links for answers.                                                  | P0       |
| BOT-005 | Chatbot must say it does not know when no strong source is found.                            | P0       |
| BOT-006 | Chatbot must not hallucinate policy answers without retrieved context.                       | P0       |
| BOT-007 | Users must be able to mark chatbot answers as helpful or incorrect.                          | P0       |
| BOT-008 | Incorrect chatbot feedback must create a review item for moderators/admins.                  | P1       |
| BOT-009 | Admins must be able to configure model provider from backend settings.                       | P1       |

### Recommended MVP Architecture

Use RAG inside the MERN stack:

1. User sends query from React chatbot UI.
2. Express receives `/api/chat/query` request.
3. Node service generates query embedding using configured embedding provider.
4. MongoDB Atlas Vector Search retrieves top matching FAQs and approved Q&A answers.
5. Node backend builds a prompt using retrieved context.
6. LLM provider generates answer.
7. Backend returns answer, source IDs, confidence score, and suggested related FAQs.
8. User feedback is saved.

### Model Provider Recommendation

For MVP, use a provider adapter pattern:

- `GeminiProvider` for free-tier API-based response generation if available.
- `LocalLlamaProvider` later through a Node HTTP call to an institution-hosted model service.
- `MockProvider` for local development and testing without paid API calls.

### Important MERN Constraint

LangChain can be used only as **LangChain.js** inside Node.js. Do not use Python LangChain for MVP.

### Suggestion

For the first MVP demo, prioritize reliable retrieval and source links over highly conversational answers. A simple answer synthesized from top FAQs is more trustworthy than an expressive but unsupported LLM response.

---

## 8.10 Admin Dashboard

### Requirements

| ID        | Requirement                                                   | Priority |
| --------- | ------------------------------------------------------------- | -------- |
| ADMIN-001 | Admin dashboard must show total FAQs.                         | P0       |
| ADMIN-002 | Dashboard must show FAQs by category.                         | P0       |
| ADMIN-003 | Dashboard must show open community questions.                 | P0       |
| ADMIN-004 | Dashboard must show unresolved questions.                     | P0       |
| ADMIN-005 | Dashboard must show pending moderation items.                 | P0       |
| ADMIN-006 | Dashboard must show most flagged FAQs.                        | P0       |
| ADMIN-007 | Dashboard must show chatbot incorrect feedback count.         | P1       |
| ADMIN-008 | Dashboard must show duplicate candidates.                     | P1       |
| ADMIN-009 | Dashboard must allow FAQ, category, tag, and user management. | P1       |

### Suggested Widgets

1. FAQ count by category.
2. Open vs resolved questions.
3. Pending moderation queue.
4. Top flagged FAQs.
5. Recently updated FAQs.
6. Chatbot helpfulness ratio.
7. Duplicate candidate list.
8. Most searched queries with no answer.

---

## 8.11 Notifications and Announcements

### MVP Decision

Notifications are outside the direct implementation scope unless approved by organizers.

### Requirements for Recommendation Only

| ID        | Requirement                                                                  | Priority |
| --------- | ---------------------------------------------------------------------------- | -------- |
| NOTIF-001 | Team should propose FCM-based push notifications to organizers.              | P2       |
| NOTIF-002 | Team should propose a pre-login announcement board as a simpler alternative. | P2       |
| NOTIF-003 | MVP should not block on notification implementation.                         | P0       |

### Suggestion

Start with an announcement board instead of push notifications. It is easier, cheaper, and fully controllable inside the MERN app. FCM can be added later if push delivery becomes necessary.

---

## 9. Recommended Information Architecture

## 9.1 Main Student Navigation

1. Home
2. FAQs
3. Ask a Question
4. Community Q&A
5. Chatbot
6. My Questions
7. Recently Viewed

## 9.2 Moderator Navigation

1. Moderation Dashboard
2. Pending Answers
3. Flagged FAQs
4. Unresolved Questions
5. Duplicate Candidates
6. FAQ Suggestions

## 9.3 Admin Navigation

1. Admin Overview
2. FAQ Management
3. Category Management
4. Tag Management
5. User Management
6. Moderation Queue
7. Chatbot Feedback
8. Settings
9. Analytics

---

## 10. UX Requirements

## 10.1 FAQ Page

### Required Components

- Search bar.
- Category chips or sidebar filters.
- Tag checkboxes.
- Status dropdown.
- Sort dropdown:
  - Most relevant.
  - Recently updated.
  - Most viewed.
  - Most helpful.
- FAQ cards.
- Empty state with “Ask a Question” CTA.
- Recently updated section.
- Recently viewed section for logged-in users.

### Acceptance Criteria

- Users can find filtered results without page reload.
- Filters can be combined.
- Selected filters are visible and removable.
- Empty results show suggested actions.

## 10.2 Ask Question Flow

### Required Steps

1. Enter question title.
2. Enter question details.
3. Select category.
4. Add optional tags.
5. Click “Check Existing Answers”.
6. System displays matching FAQs and resolved questions.
7. User chooses “This answers my question” or “Submit anyway”.
8. Submitted question appears in user’s My Questions page.

### Acceptance Criteria

- User cannot submit without running existing-answer check.
- User can still submit after reviewing suggestions.
- Matching results should include title, answer preview, category, and similarity reason.

## 10.3 Chatbot UI

### Required Components

- Chat window.
- Input field.
- Loading state.
- Answer body.
- Source FAQ links.
- “Helpful” and “Incorrect” buttons.
- “Ask in Community” fallback button when confidence is low.

### Acceptance Criteria

- Chatbot response must include sources when an answer is generated.
- If no reliable match is found, chatbot should not invent an answer.
- Incorrect feedback must create a review item.

## 10.4 Admin FAQ Editor

### Required Components

- FAQ title field.
- Answer rich text field.
- Category selector.
- Tag multi-select.
- Status selector.
- Auto-tag suggestions.
- Duplicate warning panel.
- Save draft and publish buttons.

### Acceptance Criteria

- Admin sees duplicate candidates before publishing.
- Admin can choose suggested tags.
- FAQ embedding is generated after publish.

---

## 11. System Architecture

## 11.1 High-Level Architecture

### Frontend

React application with role-specific routes:

- Student views.
- Moderator views.
- Admin views.

### Backend

Node.js and Express.js API server with services:

- Auth service.
- FAQ service.
- Category/tag service.
- Search service.
- Embedding service.
- Chatbot service.
- Q&A service.
- Moderation service.
- Flag service.
- Analytics service.

### Database

MongoDB with collections for:

- Users.
- FAQs.
- Categories.
- Tags.
- Questions.
- Answers.
- Flags.
- Chat sessions.
- Chat feedback.
- Search logs.
- Audit logs.
- System settings.

### Semantic Search

MongoDB Atlas Vector Search using embeddings stored directly in FAQ and approved-answer documents.

---

## 11.2 Recommended Folder Structure

```txt
samagama-portal/
  client/
    src/
      api/
      components/
      features/
        auth/
        faq/
        qna/
        chatbot/
        moderation/
        admin/
      hooks/
      layouts/
      pages/
      routes/
      store/
      utils/
  server/
    src/
      config/
      controllers/
      middlewares/
      models/
      routes/
      services/
        auth.service.js
        faq.service.js
        search.service.js
        embedding.service.js
        chatbot.service.js
        moderation.service.js
        analytics.service.js
      jobs/
      utils/
      validators/
    tests/
  README.md
```

---

## 12. Data Models

## 12.1 User Model

```js
{
  _id: ObjectId,
  name: String,
  email: String,
  passwordHash: String,
  role: "student" | "moderator" | "admin",
  status: "active" | "suspended" | "deleted",
  recentlyViewedFaqs: [
    {
      faqId: ObjectId,
      viewedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## 12.2 FAQ Model

```js
{
  _id: ObjectId,
  title: String,
  slug: String,
  answer: String,
  summary: String,
  categories: [ObjectId],
  tags: [ObjectId],
  status: "draft" | "published" | "outdated" | "archived",
  sourceType: "manual" | "community_conversion" | "imported",
  sourceQuestionId: ObjectId,
  embedding: [Number],
  helpfulCount: Number,
  notHelpfulCount: Number,
  viewCount: Number,
  flagCount: Number,
  duplicateOf: ObjectId,
  createdBy: ObjectId,
  updatedBy: ObjectId,
  publishedAt: Date,
  lastReviewedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 12.3 Category Model

```js
{
  _id: ObjectId,
  name: String,
  slug: String,
  description: String,
  keywords: [String],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 12.4 Tag Model

```js
{
  _id: ObjectId,
  name: String,
  slug: String,
  description: String,
  keywords: [String],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 12.5 Community Question Model

```js
{
  _id: ObjectId,
  title: String,
  description: String,
  categoryId: ObjectId,
  tags: [ObjectId],
  status: "open" | "answered" | "resolved" | "duplicate" | "archived",
  duplicateOf: ObjectId,
  askedBy: ObjectId,
  existingAnswerCheck: {
    checkedAt: Date,
    matchedFaqs: [ObjectId],
    matchedQuestions: [ObjectId]
  },
  viewCount: Number,
  answerCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## 12.6 Answer Model

```js
{
  _id: ObjectId,
  questionId: ObjectId,
  body: String,
  answeredBy: ObjectId,
  status: "pending" | "approved" | "rejected" | "needs_changes",
  moderatorId: ObjectId,
  moderationNote: String,
  approvedAt: Date,
  embedding: [Number],
  eligibleForFaqConversion: Boolean,
  convertedFaqId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## 12.7 Flag Model

```js
{
  _id: ObjectId,
  entityType: "faq" | "question" | "answer" | "chatbot_response",
  entityId: ObjectId,
  reason: "incorrect" | "outdated" | "duplicate" | "unclear" | "other",
  details: String,
  status: "open" | "under_review" | "resolved" | "dismissed",
  reportedBy: ObjectId,
  reviewedBy: ObjectId,
  resolutionNote: String,
  createdAt: Date,
  updatedAt: Date
}
```

## 12.8 Chat Session Model

```js
{
  _id: ObjectId,
  userId: ObjectId,
  messages: [
    {
      role: "user" | "assistant",
      content: String,
      sourceFaqIds: [ObjectId],
      sourceAnswerIds: [ObjectId],
      confidenceScore: Number,
      createdAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## 12.9 Chat Feedback Model

```js
{
  _id: ObjectId,
  chatSessionId: ObjectId,
  messageIndex: Number,
  userId: ObjectId,
  rating: "helpful" | "incorrect",
  comment: String,
  status: "open" | "reviewed" | "resolved",
  createdAt: Date,
  updatedAt: Date
}
```

## 12.10 Audit Log Model

```js
{
  _id: ObjectId,
  actorId: ObjectId,
  action: String,
  entityType: String,
  entityId: ObjectId,
  before: Object,
  after: Object,
  createdAt: Date
}
```

---

## 13. API Requirements

## 13.1 Auth APIs

| Method | Endpoint             | Access                  | Description       |
| ------ | -------------------- | ----------------------- | ----------------- |
| POST   | `/api/auth/register` | Public/Admin-controlled | Register user.    |
| POST   | `/api/auth/login`    | Public                  | Login user.       |
| POST   | `/api/auth/refresh`  | Authenticated           | Refresh token.    |
| POST   | `/api/auth/logout`   | Authenticated           | Logout user.      |
| GET    | `/api/auth/me`       | Authenticated           | Get current user. |

## 13.2 FAQ APIs

| Method | Endpoint                    | Access          | Description                    |
| ------ | --------------------------- | --------------- | ------------------------------ |
| GET    | `/api/faqs`                 | Authenticated   | List/search FAQs with filters. |
| GET    | `/api/faqs/:id`             | Authenticated   | Get FAQ detail.                |
| POST   | `/api/faqs`                 | Admin           | Create FAQ.                    |
| PATCH  | `/api/faqs/:id`             | Admin           | Update FAQ.                    |
| PATCH  | `/api/faqs/:id/archive`     | Admin           | Archive FAQ.                   |
| POST   | `/api/faqs/:id/view`        | Authenticated   | Record view.                   |
| POST   | `/api/faqs/:id/feedback`    | Authenticated   | Helpful/not helpful feedback.  |
| POST   | `/api/faqs/check-duplicate` | Admin/Moderator | Check duplicate candidates.    |
| POST   | `/api/faqs/:id/reembed`     | Admin           | Regenerate FAQ embedding.      |

## 13.3 Category and Tag APIs

| Method | Endpoint              | Access          | Description                |
| ------ | --------------------- | --------------- | -------------------------- |
| GET    | `/api/categories`     | Authenticated   | List categories.           |
| POST   | `/api/categories`     | Admin           | Create category.           |
| PATCH  | `/api/categories/:id` | Admin           | Update category.           |
| DELETE | `/api/categories/:id` | Admin           | Archive category.          |
| GET    | `/api/tags`           | Authenticated   | List tags.                 |
| POST   | `/api/tags`           | Admin           | Create tag.                |
| PATCH  | `/api/tags/:id`       | Admin           | Update tag.                |
| DELETE | `/api/tags/:id`       | Admin           | Archive tag.               |
| POST   | `/api/tags/suggest`   | Admin/Moderator | Suggest tags for FAQ text. |

## 13.4 Community Q&A APIs

| Method | Endpoint                        | Access                | Description                              |
| ------ | ------------------------------- | --------------------- | ---------------------------------------- |
| GET    | `/api/questions`                | Authenticated         | List community questions.                |
| GET    | `/api/questions/:id`            | Authenticated         | Get question detail.                     |
| POST   | `/api/questions/check-existing` | Student               | Find existing answers before submission. |
| POST   | `/api/questions`                | Student               | Create question.                         |
| PATCH  | `/api/questions/:id`            | Owner/Moderator/Admin | Edit question where allowed.             |
| POST   | `/api/questions/:id/answers`    | Authenticated         | Submit answer.                           |
| PATCH  | `/api/answers/:id/approve`      | Moderator/Admin       | Approve answer.                          |
| PATCH  | `/api/answers/:id/reject`       | Moderator/Admin       | Reject answer.                           |
| PATCH  | `/api/questions/:id/resolve`    | Moderator/Admin       | Mark question resolved.                  |
| PATCH  | `/api/questions/:id/duplicate`  | Moderator/Admin       | Mark as duplicate.                       |

## 13.5 Flag APIs

| Method | Endpoint                | Access          | Description            |
| ------ | ----------------------- | --------------- | ---------------------- |
| POST   | `/api/flags`            | Authenticated   | Create or update flag. |
| GET    | `/api/flags`            | Moderator/Admin | List flags.            |
| PATCH  | `/api/flags/:id/status` | Moderator/Admin | Update flag status.    |

## 13.6 Chatbot APIs

| Method | Endpoint                 | Access        | Description              |
| ------ | ------------------------ | ------------- | ------------------------ |
| POST   | `/api/chat/query`        | Authenticated | Send chatbot query.      |
| GET    | `/api/chat/sessions`     | Authenticated | List user chat sessions. |
| GET    | `/api/chat/sessions/:id` | Authenticated | Get chat history.        |
| POST   | `/api/chat/feedback`     | Authenticated | Submit chatbot feedback. |

## 13.7 Admin Analytics APIs

| Method | Endpoint                          | Access | Description                        |
| ------ | --------------------------------- | ------ | ---------------------------------- |
| GET    | `/api/admin/stats`                | Admin  | Get dashboard stats.               |
| GET    | `/api/admin/duplicate-candidates` | Admin  | Get duplicate candidates.          |
| GET    | `/api/admin/unanswered-searches`  | Admin  | Get searches with no good results. |
| GET    | `/api/admin/chatbot-feedback`     | Admin  | Get chatbot feedback stats.        |
| GET    | `/api/admin/audit-logs`           | Admin  | Get audit logs.                    |

---

## 14. Search and Ranking Logic

## 14.1 FAQ Search Inputs

- Search text.
- Category IDs.
- Tag IDs.
- Status.
- Sort option.
- Page and limit.

## 14.2 Ranking Formula

Recommended combined score:

```txt
finalScore =
  0.45 * semanticScore +
  0.25 * keywordScore +
  0.15 * freshnessScore +
  0.10 * helpfulnessScore +
  0.05 * popularityScore
```

## 14.3 Search Behavior

- If query is empty, show curated/recent/popular FAQs.
- If query exists, run both text search and vector search.
- Exclude archived FAQs unless explicitly requested.
- Prioritize published FAQs.
- Include approved community answers only when chatbot or existing-answer check is used.

---

## 15. RAG Pipeline Detail

## 15.1 Indexable Knowledge Sources

Only the following content can be indexed for chatbot retrieval:

1. Published FAQs.
2. Approved community answers attached to resolved questions.
3. Admin-approved converted FAQs.

Draft, pending, rejected, archived, and unmoderated content must not be used as chatbot source material.

## 15.2 Embedding Creation Triggers

Generate or regenerate embeddings when:

- FAQ is published.
- FAQ answer is edited.
- FAQ title is edited.
- FAQ category or tags change significantly.
- Community answer is approved.
- Community answer is converted into FAQ.

## 15.3 Retrieval Rules

- Retrieve top 5 to 8 source documents.
- Minimum similarity threshold should be configurable.
- If no source crosses threshold, chatbot should respond with a fallback:
  - “I could not find a verified answer for this. You can post this in Community Q&A.”

## 15.4 Prompt Guardrails

The backend prompt must instruct the LLM:

1. Answer only from provided context.
2. Do not invent policy, deadline, eligibility, NOC, stipend, or technical process information.
3. Mention uncertainty if context is insufficient.
4. Include source references.
5. Keep answer student-friendly and concise.

---

## 16. Admin-Configurable Settings

| Setting                     | Default                               | Description                                           |
| --------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Duplicate warning threshold | 0.60                                  | Similarity score where warning appears.               |
| Duplicate strong threshold  | 0.80                                  | Similarity score where merge is strongly recommended. |
| Chatbot retrieval threshold | 0.70                                  | Minimum similarity needed for confident answer.       |
| Chatbot max sources         | 6                                     | Number of source chunks used in prompt.               |
| Model provider              | Gemini                                | Default LLM provider for MVP.                         |
| Embedding provider          | Gemini embedding or compatible JS API | Embedding provider used by Node backend.              |
| Allow student answers       | true                                  | Whether students can answer community questions.      |
| Require answer moderation   | true                                  | Must remain true for MVP quality control.             |

---

## 17. Analytics Requirements

## 17.1 Events to Track

- FAQ searched.
- FAQ viewed.
- FAQ marked helpful/not helpful.
- Question submitted.
- Existing-answer suggestion clicked.
- Answer submitted.
- Answer approved/rejected.
- FAQ flagged.
- Chatbot query submitted.
- Chatbot answer marked helpful/incorrect.
- Chatbot fallback triggered.
- Duplicate warning shown.
- Duplicate warning overridden.

## 17.2 Dashboard Metrics

| Metric                    | Purpose                              |
| ------------------------- | ------------------------------------ |
| Total FAQs                | Understand knowledge base size.      |
| FAQs by category          | Identify category distribution.      |
| Most viewed FAQs          | Identify common issues.              |
| Most flagged FAQs         | Prioritize review.                   |
| Open questions            | Monitor unresolved student problems. |
| Pending answers           | Monitor moderation load.             |
| Chatbot helpfulness ratio | Measure answer quality.              |
| Queries with no answer    | Identify FAQ gaps.                   |
| Duplicate warnings        | Understand redundancy risk.          |

---

## 18. Acceptance Criteria

## 18.1 MVP-Level Acceptance Criteria

1. A student can search FAQs by text and filter by category, tag, and status.
2. A student can view recently updated FAQs.
3. A logged-in student can see recently viewed FAQs.
4. A student can ask a question only after reviewing existing answer suggestions.
5. A student can submit an answer to another student’s question.
6. A submitted answer does not become official until moderator approval.
7. A moderator can approve or reject an answer.
8. An admin can create and publish FAQs.
9. The system checks duplicate FAQs before publishing.
10. Published FAQ content is automatically embedded and searchable semantically.
11. Chatbot answers are generated only from approved indexed content.
12. Chatbot provides source links for answers.
13. Chatbot refuses or falls back when no verified answer is found.
14. Users can flag incorrect or outdated FAQs.
15. Admin dashboard shows FAQ count, open questions, pending moderation items, and flagged FAQs.

---

## 19. Non-Functional Requirements

## 19.1 Performance

- FAQ list page should load within 2 seconds for 150–1,000 FAQs.
- Search results should return within 1.5 seconds for normal keyword/filter queries.
- Semantic search should return within 3 seconds.
- Chatbot should return initial response within 8 seconds for MVP.

## 19.2 Security

- Use HTTPS in deployed environment.
- Hash passwords using bcrypt.
- Use JWT with expiration.
- Use refresh token rotation if standalone auth is implemented.
- Sanitize rich text answers to prevent XSS.
- Validate API payloads using Zod or Joi.
- Enforce role checks on all protected routes.
- Rate-limit login, question creation, and chatbot queries.

## 19.3 Reliability

- If LLM provider fails, chatbot should return fallback message.
- If embedding generation fails during FAQ publish, FAQ should save but show indexing status as failed.
- Admin should be able to retry embedding generation.
- All moderation actions should be audit logged.

## 19.4 Accessibility

- All filters must be keyboard accessible.
- Chatbot must support screen reader-friendly messages.
- Buttons must have visible focus states.
- Color cannot be the only indicator of status.

## 19.5 Maintainability

- Services must be modular.
- Model provider must be swappable.
- Business logic must not be placed directly in controllers.
- API validations must be centralized.
- Use consistent error response format.

---

## 20. Technical Recommendations and Suggestions

## 20.1 Use MongoDB Atlas Vector Search Instead of Separate Vector DB

The meeting discussed a vector database for RAG. Since the requirement is strict MERN, MongoDB Atlas Vector Search is the best fit. It allows semantic search without adding Pinecone, Weaviate, Chroma, or FAISS.

## 20.2 Use LangChain.js Only If Needed

LangChain can help with orchestration, but for MVP the RAG flow is simple enough to implement directly in Node.js:

1. Embed query.
2. Retrieve similar documents.
3. Build prompt.
4. Call LLM.
5. Return answer with sources.

Direct implementation is easier to debug. Add LangChain.js later only if chains/tools become complex.

## 20.3 Use Gemini API for MVP, Keep Provider Swappable

Gemini API may be useful for quick MVP because it reduces infrastructure complexity. However, do not hardcode Gemini-specific logic throughout the codebase. Wrap it inside a provider interface.

## 20.4 Avoid Local Llama in First MVP Unless Server Is Confirmed

Hosting Llama 3.2 7B may be difficult on normal free-tier hardware. For local demo, use API-based generation or mock response generation. Add local Llama only after confirming institution server capability.

## 20.5 Build Announcement Board Before Push Notifications

Since notifications are outside the direct team scope, add a simple admin-managed announcement board first. It solves many communication needs without external push setup.

## 20.6 Use Moderated Knowledge Promotion

Do not pipe every community answer into the chatbot. Only approved answers from resolved questions should become retrievable. This is crucial for answer quality.

## 20.7 Keep Duplicate Detection Advisory, Not Fully Blocking

For 80%+ similarity, strongly recommend merge. However, allow admin override with justification because some similar questions may differ in important policy details.

---

## 21. MVP Development Plan

## Sprint 1: Foundation

### Deliverables

- Project setup.
- MongoDB connection.
- User model.
- Auth APIs.
- Role middleware.
- Basic React layout.
- Student, moderator, and admin route guards.

### Exit Criteria

- Users can log in.
- Role-based pages are protected.
- API structure is ready.

## Sprint 2: FAQ Management and Discovery

### Deliverables

- FAQ model.
- Category and tag models.
- FAQ listing page.
- Search and filters.
- FAQ detail page.
- Admin FAQ create/edit page.
- Recently updated FAQs.
- Recently viewed FAQs.

### Exit Criteria

- Admin can create FAQs.
- Student can search and filter FAQs.
- FAQ views are tracked.

## Sprint 3: Community Q&A

### Deliverables

- Question model.
- Answer model.
- Ask Question flow.
- Existing-answer check using keyword search first.
- Community feed.
- My Questions page.
- Answer submission.

### Exit Criteria

- Student can ask and answer questions.
- Existing answer check runs before submission.

## Sprint 4: Moderation and Flags

### Deliverables

- Moderator dashboard.
- Pending answer review.
- Approve/reject flow.
- Flag model and APIs.
- Flagged FAQ review queue.
- Question resolve/duplicate/archive actions.

### Exit Criteria

- Moderators can approve answers.
- Students can flag FAQs.
- Admin/moderator can review flags.

## Sprint 5: Semantic Search and Duplicate Detection

### Deliverables

- Embedding service.
- MongoDB Vector Search setup.
- FAQ embedding generation.
- Semantic search.
- Duplicate detection API.
- Duplicate warning UI.

### Exit Criteria

- System finds semantically similar FAQs.
- Admin sees duplicate warnings before publishing.

## Sprint 6: Chatbot and Admin Analytics

### Deliverables

- Chatbot UI.
- Chatbot query API.
- RAG retrieval.
- LLM provider adapter.
- Source-linked answers.
- Chatbot feedback.
- Admin dashboard stats.

### Exit Criteria

- Chatbot answers from approved sources.
- Feedback is stored.
- Dashboard shows core metrics.

---

## 22. MVP Release Checklist

### Product

- FAQ search works.
- Category and tag filtering work.
- Ask Question flow works.
- Moderation flow works.
- Chatbot returns source-grounded answers.
- Flagging works.
- Admin dashboard works.

### Engineering

- Environment variables configured.
- MongoDB indexes created.
- Vector index configured.
- Auth middleware tested.
- Role permissions tested.
- API validation added.
- Error handling standardized.
- Seed data prepared.

### QA

- Student role tested.
- Moderator role tested.
- Admin role tested.
- Duplicate FAQ flow tested.
- Chatbot fallback tested.
- Flag review tested.
- Mobile responsiveness tested.

### Demo

- Seed at least 150 FAQs.
- Include 8–10 categories.
- Include 20–30 tags.
- Include 10 open community questions.
- Include 5 pending answers.
- Include 5 flagged FAQs.
- Include working chatbot queries for common categories such as NOC, technical issues, certificates, login issues, deadlines, and attendance.

---

## 23. Risks and Mitigations

| Risk                                  | Impact     | Mitigation                                                                  |
| ------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Chatbot gives wrong answer            | High       | Use source-grounded RAG, fallback when confidence is low, collect feedback. |
| Duplicate detection blocks valid FAQs | Medium     | Make blocking advisory and allow admin override with justification.         |
| LLM API rate limit                    | Medium     | Cache embeddings, cache frequent answers, add mock/local provider for demo. |
| Local Llama hosting unavailable       | Medium     | Use API provider for MVP and keep local provider for phase 2.               |
| Moderation backlog grows              | Medium     | Admin dashboard should prioritize high-impact pending items.                |
| Auto-tagging is inaccurate            | Low/Medium | Treat tags as suggestions, require admin confirmation.                      |
| Notifications are outside scope       | Low        | Document FCM and announcement-board recommendation only.                    |

---

## 24. Open Questions

1. What are the initial official categories? Suggested starting categories:
   - NOC
   - Technical Issues
   - Login and Access
   - Certificates
   - Attendance
   - Stipend
   - Deadlines
   - Project Submission
   - Internship Guidelines
   - General
2. Will existing portal authentication be reused?
3. Who has final approval rights for official FAQs?
4. Is Gemini API allowed for MVP demo?
5. Is MongoDB Atlas allowed, or must MongoDB run locally?
6. Will the institution provide a server for local Llama hosting?
7. Should peer answers be visible before approval, or hidden until approval?
8. What data import format exists for the current 150+ FAQs?
9. Should students be allowed to upload screenshots with questions?
10. What exact notification scope, if any, is approved by organizers?

---

## 25. Definition of Done

The MVP is complete when:

1. FAQs are no longer displayed as a single unorganized list.
2. Students can search and filter FAQs effectively.
3. New question submission checks existing answers first.
4. Students can participate in community Q&A.
5. Community answers require moderator approval.
6. Admins can manage FAQs, categories, tags, and users.
7. Duplicate FAQ detection works using semantic similarity.
8. Chatbot retrieves from approved MongoDB-indexed content.
9. Chatbot answers include source links.
10. Incorrect or outdated answers can be flagged.
11. Admin dashboard shows the operational health of FAQs, Q&A, flags, and chatbot feedback.
12. The application can be run locally and demonstrated end-to-end using MERN stack only.

---

## 26. Final Build Recommendation

Build the MVP from scratch unless an existing GitHub repository already has at least 60% of the required modules. A generic FAQ repository may save time on UI but will likely not include semantic duplicate detection, moderated Q&A, role-specific dashboards, and MongoDB Vector Search. Starting from scratch with a clean MERN architecture may be faster and safer than heavily modifying an unsuitable repo.

Use the single technology stack defined in the Product Summary section. Avoid adding additional databases, backend frameworks, Python services, or separate vector stores during MVP development.

---

# Appendix A — Implementation Notes (Non-PRD)

> The sections above are the original Product Requirements Document. Everything below this line is engineering documentation added during implementation. Edit freely without touching the PRD body above.

## Local Development Accounts

Seed all accounts in one command:

```bash
npm --workspace @samagama/server run seed:accounts
```

The script is idempotent — re-running upserts user rows and preserves existing Spurti Points balances.

### Students

Each student starts with **100 Spurti Points** (configurable via `SPURTI_POINTS.INITIAL_BALANCE` in `packages/shared/src/constants.ts`).

| #   | Name      | Email                   | Password     |
| --- | --------- | ----------------------- | ------------ |
| 1   | Abhishek  | abhishek@samagama.test  | Student@2026 |
| 2   | Meena     | meena@samagama.test     | Student@2026 |
| 3   | Harshdeep | harshdeep@samagama.test | Student@2026 |
| 4   | Harshitha | harshitha@samagama.test | Student@2026 |
| 5   | Spandan   | spandan@samagama.test   | Student@2026 |
| 6   | Tejswini  | tejswini@samagama.test  | Student@2026 |
| 7   | Ravi      | ravi@samagama.test      | Student@2026 |
| 8   | Gazal     | gazal@samagama.test     | Student@2026 |

### Moderators

| #   | Name     | Email                  | Password       |
| --- | -------- | ---------------------- | -------------- |
| 1   | Kushagra | kushagra@samagama.test | Moderator@2026 |
| 2   | Jahnvi   | jahnvi@samagama.test   | Moderator@2026 |
| 3   | Joyita   | joyita@samagama.test   | Moderator@2026 |

### Admins

| #   | Name     | Email                  | Password   |
| --- | -------- | ---------------------- | ---------- |
| 1   | Divy     | divy@samagama.test     | Admin@2026 |
| 2   | Anshuman | anshuman@samagama.test | Admin@2026 |

> **Note:** These are development-only credentials seeded against a local MongoDB. The seed script refuses to run with `NODE_ENV=production`. Rotate the passwords before any deployment.

## Spurti Points Rules

Defined in [`packages/shared/src/constants.ts`](packages/shared/src/constants.ts):

| Event                                         | Points awarded |
| --------------------------------------------- | -------------- |
| Initial balance for a new student             | +100           |
| Your peer answer is approved by a moderator   | +10            |
| A new upvote is added to your approved answer | +5             |

Cancelling an upvote does **not** subtract points (prevents gaming the score by toggling). Moderators and admins do not accumulate points.

## Engineering Documentation

- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — architecture map, conventions, current implementation status.
- [`samagama.md`](./samagama.md) — append-only engineering log (every meaningful change documents what / why / tradeoffs).
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — setup, verification gates, commit style.
