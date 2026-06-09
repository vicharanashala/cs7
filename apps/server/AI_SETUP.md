# AI Provider Setup — Samagama Server

This document explains every AI-powered feature in the Samagama server, how
to configure the provider, the free-tier limits, and the roadmap for future
accuracy improvements.

---

## Features That Use AI

| Feature                                | Where                                          | What the AI does                                                                                                                         |
| -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Check FAQ** (Ask a Question, Step 2) | `qna.service.ts → checkExisting()`             | Converts the student's question into a meaning fingerprint (embedding) and finds the closest FAQ entries by cosine similarity.           |
| **Check Community Questions** (Step 3) | `qna.service.ts → checkExisting()`             | Reuses the same embedding to find semantically similar open community questions — catches paraphrased duplicates that share no keywords. |
| **Yaksha chatbot**                     | `chatbot.service.ts`                           | Retrieves the top matching FAQs by embedding similarity, then passes them to an LLM which writes a conversational answer.                |
| **FAQ embedding on publish**           | `faq.service.ts → scheduleEmbedding()`         | Generates and stores a 384-dim vector for every FAQ when it is published or its title/answer is edited.                                  |
| **Question embedding on create**       | `qna.service.ts → scheduleQuestionEmbedding()` | Generates and stores a 384-dim vector for every new community question so it can be found semantically in future duplicate checks.       |

---

## Provider Options

Switch providers by editing `apps/server/env`. No code changes are needed.

### Option 1 — Ollama (local, free, development)

```env
LLM_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama
GEMINI_API_KEY=          # leave blank
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
```

**One-time setup:**

```bash
ollama pull all-minilm   # embedding model — 45 MB
ollama pull gemma3:4b    # chatbot LLM — 3.3 GB
```

**Pros:** completely free, works offline, no rate limits, no API key.  
**Cons:** requires Ollama running on the same machine; not suitable for production
servers because `gemma3:4b` needs ~5 GB RAM permanently loaded and processes
requests sequentially (one at a time).

---

### Option 2 — Google Gemini API (production, recommended)

```env
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
```

**Get a free API key:** https://aistudio.google.com/apikey  
(Sign in with a Google account → Create API key → copy it here)

#### Free-Tier Rate Limits (as of 2026)

| Model                | Used for                     | Requests/minute | Requests/day    | Cost above free tier  |
| -------------------- | ---------------------------- | --------------- | --------------- | --------------------- |
| `text-embedding-004` | Check FAQ, Check Community Q | **1,500 / min** | Unlimited       | $0.00001 per 1K chars |
| `gemini-2.0-flash`   | Yaksha chatbot replies       | 15 / min        | **1,500 / day** | ~$0.10 per 1M tokens  |

**What this means for a student internship portal:**

- _Check FAQ / Check Community Questions:_ At 1,500 embedding requests per minute,
  even if every student in a cohort of 500 clicked "Check Existing Answers" at
  exactly the same second, you would use 500 of 1,500 slots — well within the
  free limit. The 60-second per-user result cache in `qna.service.ts` further
  reduces real API calls to a small fraction of that.

- _Yaksha chatbot:_ 1,500 requests/day covers a cohort of 300 students asking
  5 chatbot questions each (300 × 5 = 1,500). The 30-minute session cache means
  follow-up questions in the same conversation do not cost extra embedding calls.
  If you exceed the daily limit near the end of an active day, Yaksha
  automatically falls back to the mock provider (returns the top FAQ answer
  verbatim) — no crash, no error shown to students.

**Pros:** scales to thousands of users, highest accuracy, no server RAM cost,
no Ollama dependency, works on any hosting provider.  
**Cons:** requires internet access from the server; usage above the free tier
incurs a small cost (typically < $5/month for a single internship cohort).

---

<!--
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTERNATIVE PROVIDER — Groq API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Groq is a strong alternative to Gemini for the chatbot LLM (not embeddings).
It runs open-source models (Llama 3, Mixtral) on custom inference hardware and
is significantly faster than Gemini — typical response time is 200–500 ms vs.
1–3 seconds for Gemini.

Free-tier limits (as of 2026):
  llama-3.3-70b-versatile  → 30 requests/minute, 14,400 requests/day
  llama-3.1-8b-instant     → 30 requests/minute, 14,400 requests/day
  mixtral-8x7b-32768       → 30 requests/minute, 14,400 requests/day

14,400 chatbot requests/day is ~10× the Gemini free tier, making Groq a
better fit if your cohort is large or very active.

NOTE: Groq does NOT provide an embedding API. You would use Groq for the LLM
(chatbot) and either Gemini or Ollama for embeddings (Check FAQ step).

To integrate Groq:
  1. Get a free API key at https://console.groq.com
  2. Add to the env schema in `config/env.ts`:
       GROQ_API_KEY: z.string().optional(),
       LLM_PROVIDER: z.enum(['mock', 'gemini', 'local-llama', 'ollama', 'groq']).default('mock'),
  3. Add a `callGroqLlm()` function in `chatbot.service.ts` using the
     OpenAI-compatible endpoint: https://api.groq.com/openai/v1/chat/completions
     (Groq's API is a drop-in replacement for the OpenAI chat completions format.)
  4. Set in env:
       LLM_PROVIDER=groq
       GROQ_API_KEY=your_key_here
       EMBEDDING_PROVIDER=gemini   # Groq has no embedding model
       GEMINI_API_KEY=your_gemini_key_here

Example Groq fetch call (same shape as Ollama's /v1/chat/completions):

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.2,
      max_tokens: 500,
      stream: false,
    }),
  });

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END GROQ ALTERNATIVE SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->

---

## Accuracy Improvements — Implemented and Roadmap

### Option A — Raised semantic threshold ✅ Implemented

**File:** `qna.service.ts`, constants `SEMANTIC_THRESHOLD` and `QUESTION_SEMANTIC_THRESHOLD`  
**Change:** Raised from 0.35 → 0.50

At 0.35, loosely related FAQs could appear as matches. At 0.50, only questions
with genuine semantic overlap pass the filter. This reduces noise in the
"Check FAQ" step without missing real matches.

Tuning reference:

- `0.35` — broad; catches distant associations, risks irrelevant results.
- `0.50` — recommended; reliable with both all-minilm and Gemini embeddings.
- `0.65` — strict; only near-identical paraphrases pass.

---

### Option C — Semantic search for community questions ✅ Implemented

**File:** `qna.service.ts → checkExisting()` and `scheduleQuestionEmbedding()`

Previously, Step 3 (Check Community Questions) used MongoDB keyword search
(`$text`). This meant "How do I upload my timesheet?" would not match a
question titled "What is the procedure for logging work hours?" even though
they mean the same thing.

Now:

- When a student submits a new community question, a 384-dim embedding of
  the title is generated and stored on the Question document (fire-and-forget,
  non-blocking).
- `checkExisting()` reuses the same query embedding already computed for the
  FAQ scan to run a cosine similarity scan across community questions.
- Keyword search (`$text`) is kept as a fallback for questions that were
  created before embeddings were enabled.

---

<!--
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION D — LLM Synthesis in the Ask Question flow (FUTURE ROADMAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current state (Options A + C):
  The Ask Question flow finds semantically similar FAQs and community
  questions and displays them as cards. The student reads each card manually
  and decides if their question is already answered.

Option D goal:
  When 1–3 FAQ matches are found, instead of showing raw FAQ cards, call the
  LLM (same Gemini/Ollama instance already used by Yaksha) to synthesize a
  single conversational response:

  "Based on these FAQs, it looks like your question is about internship
   certificate timelines. Here's what the FAQ says: [synthesized answer].
   Does this answer your question?"

  This would make the Ask Question flow identical in quality to the Yaksha
  chatbot — a true RAG (Retrieval-Augmented Generation) experience.

How to implement:

  1. In `qna.service.ts → checkExisting()`, after computing `matchedFaqs`,
     if matchedFaqs.length > 0, call a new helper:

       const synthesis = await synthesizeFaqMatches(queryText, matchedFaqs);

  2. Add `synthesis?: string` to the `ExistingAnswerCheckResult` type in
     `packages/shared/src/schemas/qna.schema.ts`.

  3. Implement `synthesizeFaqMatches()` using the same `callLlm()` pattern
     from `chatbot.service.ts`. System prompt example:

       "You are helping a student check if existing FAQs answer their question.
        Given the student's question and the top matching FAQs below, write a
        single clear paragraph that synthesizes the most relevant answer.
        If the FAQs do not actually answer the question, say so plainly.
        Be concise — 2-3 sentences maximum."

  4. In `AskQuestionPage.tsx`, replace the raw FAQ cards with the synthesized
     paragraph when `check.synthesis` is present. Keep the cards below as
     "Sources" so the student can read the full FAQ if needed.

  5. Add the synthesis result to the `checkExistingCache` so repeated calls
     within 60 seconds do not re-invoke the LLM.

Effort estimate: ~4–6 hours of implementation work.
Prerequisite: LLM_PROVIDER must be set to gemini, ollama, or groq (not mock).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OPTION D SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->

---

## Quick Reference — Switching Providers

```bash
# Development (Ollama, free, local):
LLM_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama

# Production (Gemini, scales to hundreds of users):
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>

# Alternative chatbot LLM (Groq — faster, larger free quota):
# See the Groq section above (commented) for full integration steps.
# LLM_PROVIDER=groq
# EMBEDDING_PROVIDER=gemini   ← Groq has no embedding model
```
