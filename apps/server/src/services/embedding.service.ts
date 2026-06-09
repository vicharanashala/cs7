// Embedding service. Mirrors remote utils/embeddings.js architecture.
//
// Generates 384-dimensional vector embeddings for FAQ titles and question
// titles. These are used for semantic duplicate detection and (Phase 6)
// vector search in MongoDB Atlas.
//
// Provider selection via EMBEDDING_PROVIDER env var:
//   mock   — returns deterministic zero-vector; no external calls (default / CI).
//   gemini — calls Google Gemini embeddings API (requires GEMINI_API_KEY).
//   ollama — calls local Ollama instance using all-minilm model (free, no API key).
//            Run: ollama pull all-minilm   before starting the server.
//
// The remote backend used @xenova/transformers (local ML model). We mirror the
// same interface but keep the provider pluggable so the team can switch to a
// local model later without changing call-sites.
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const EMBEDDING_DIM = 384;

/** Generate a 384-dim embedding for the given text. */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) return new Array(EMBEDDING_DIM).fill(0);

  try {
    switch (env.EMBEDDING_PROVIDER) {
      case 'gemini':
        return await geminiEmbed(text);
      case 'ollama':
        return await ollamaEmbed(text);
      case 'mock':
      default:
        return mockEmbed(text);
    }
  } catch (err) {
    logger.warn(
      { err, provider: env.EMBEDDING_PROVIDER },
      'embedding generation failed — falling back to mock',
    );
    return mockEmbed(text);
  }
}

/**
 * Compose the text used to embed a community question — for BOTH the student's
 * live draft (query side, in checkExisting) and stored questions (index side, in
 * the create path, backfill job, and seed/test scripts).
 *
 * Why title + description (not title alone): a question's `title` is just
 * `deriveTitle(description)` — the first line of the student's free-form text,
 * which is often generic or partial ("NOC issue", "Hi, I have a problem"). An
 * embedding of that line alone discards most of the question's meaning, so the
 * community scan returns loose, low-relevance matches. FAQ titles are
 * admin-curated canonical questions, which is why FAQ search feels sharper.
 *
 * Combining title + description gives the vector the whole question. The query
 * side and the index side MUST use this identical construction — otherwise their
 * vectors sit in mismatched regions of the space and cosine scores collapse.
 */
export function composeQuestionEmbeddingText(title: string, description?: string): string {
  return `${title ?? ''} ${description ?? ''}`.trim();
}

/** Cosine similarity between two equal-length vectors. Returns -1 to 1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Provider implementations ─────────────────────────────────────────────────

/**
 * Mock embedding — deterministic, fast, zero external deps.
 * Maps each character to a float contribution so similar strings
 * produce similar vectors (good enough for dev/test deduplication).
 */
function mockEmbed(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM).fill(0) as number[];
  const norm = text.toLowerCase().trim();
  for (let i = 0; i < norm.length; i++) {
    const idx = norm.charCodeAt(i) % EMBEDDING_DIM;
    vec[idx] += 1 / (i + 1);
  }
  // L2 normalise.
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

/**
 * Ollama all-minilm — runs the all-MiniLM-L6-v2 model locally via Ollama.
 * Produces exactly 384 dimensions. Free, no API key, no internet required.
 * Prerequisite: ollama pull all-minilm
 */
async function ollamaEmbed(text: string): Promise<number[]> {
  const baseUrl = env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const res = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'all-minilm', input: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embed error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { embeddings: number[][] };
  const raw = json.embeddings[0];

  if (!raw || raw.length === 0) throw new Error('Ollama returned empty embedding');

  // all-minilm produces exactly 384 dims — but guard defensively.
  if (raw.length >= EMBEDDING_DIM) return raw.slice(0, EMBEDDING_DIM);
  return [...raw, ...new Array(EMBEDDING_DIM - raw.length).fill(0)];
}

/**
 * Gemini gemini-embedding-001 — natively produces 3072 dims.
 * We request exactly 384 via outputDimensionality so no truncation is needed
 * and the result matches the stored schema validation exactly.
 * Uses SEMANTIC_SIMILARITY task type for best cosine-similarity performance.
 */
async function geminiEmbed(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set — falling back to mock embedding');
    return mockEmbed(text);
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent' +
    `?key=${env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      taskType: 'SEMANTIC_SIMILARITY',
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  // Retry once on 429 after a short back-off (free tier: ~15 req/min).
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 4000));
    const retry = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        taskType: 'SEMANTIC_SIMILARITY',
        outputDimensionality: EMBEDDING_DIM,
      }),
    });
    if (!retry.ok)
      throw new Error(`Gemini embedding API error: ${retry.status} ${retry.statusText}`);
    const retryJson = (await retry.json()) as { embedding: { values: number[] } };
    return retryJson.embedding.values;
  }

  if (!res.ok) {
    throw new Error(`Gemini embedding API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { embedding: { values: number[] } };
  return json.embedding.values;
}
