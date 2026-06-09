// Search engine Web Worker.
// Runs on a background thread so TF-IDF indexing never blocks the UI.
// Adapted from semantic/search.worker.js: CDN imports → npm, TypeScript types added.
import MiniSearch from 'minisearch';
import localforage from 'localforage';

// ─── Samagama-specific synonym dictionary ─────────────────────────────────────
const SYNONYMS: Record<string, string> = {
  signin: 'login',
  'sign in': 'login',
  invoice: 'billing',
  error: 'bug',
  credential: 'password',
  noc: 'certificate',
  cert: 'certificate',
  zoom: 'meeting',
  vibe: 'platform',
  team: 'group',
  mentor: 'guide',
  stipend: 'payment salary',
  attendance: 'leave',
  phase: 'stage',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchDoc {
  id: string;
  type: 'faq' | 'community';
  title: string;
  content: string;
  tags: string[];
}

type WorkerMessage =
  | { type: 'INIT'; payload: { dataEndpoint: string; token: string | null } }
  | { type: 'SEARCH'; payload: { query: string } };

// ─── State ────────────────────────────────────────────────────────────────────

let miniSearchInstance: MiniSearch<SearchDoc> | null = null;

const lf = localforage.createInstance({ name: 'samagama_search', storeName: 'docs' });

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  // ── INIT: fetch corpus → build TF-IDF index → store payloads in IndexedDB ──
  if (type === 'INIT') {
    const tInit = performance.now();
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (payload.token) headers['Authorization'] = `Bearer ${payload.token}`;
      const response = await fetch(payload.dataEndpoint, { headers });
      if (!response.ok) throw new Error(`Failed to fetch search data: ${response.status}`);

      const raw = (await response.json()) as SearchDoc[] | { data: SearchDoc[] };
      // Handle both plain array and {data:[...]} API envelope.
      const documents: SearchDoc[] = Array.isArray(raw) ? raw : (raw as { data: SearchDoc[] }).data;
      const tFetch = performance.now();

      // Store full payloads in IndexedDB (O(1) lookup during search).
      await lf.clear();
      for (const doc of documents) {
        await lf.setItem(doc.id, doc);
      }

      miniSearchInstance = new MiniSearch<SearchDoc>({
        idField: 'id',
        fields: ['title', 'content', 'tags'],
        // Only 'type' kept in RAM — text bodies live in IndexedDB.
        storeFields: ['type'],
        extractField: (document, fieldName) => {
          if (fieldName === 'tags') return (document as SearchDoc).tags.join(' ');
          return (document as unknown as Record<string, unknown>)[fieldName] as string;
        },
        searchOptions: {
          boost: { tags: 4, title: 2, content: 1 },
          prefix: true,
          fuzzy: 0.2,
        },
      });

      miniSearchInstance.addAll(documents);
      const tIndex = performance.now();

      self.postMessage({
        type: 'READY',
        timing: {
          fetch_ms: (tFetch - tInit).toFixed(1),
          index_ms: (tIndex - tFetch).toFixed(1),
          total_ms: (tIndex - tInit).toFixed(1),
          doc_count: documents.length,
        },
      });
    } catch (error) {
      self.postMessage({ type: 'ERROR', payload: (error as Error).message });
    }
  }

  // ── SEARCH: query index → retrieve payloads → post results ──────────────────
  if (type === 'SEARCH') {
    if (!miniSearchInstance) return;

    const tSearch = performance.now();
    let processedQuery = payload.query.toLowerCase().trim();

    // Expand synonyms (e.g. "noc" → "noc certificate").
    for (const [key, expansion] of Object.entries(SYNONYMS)) {
      if (processedQuery.includes(key)) {
        processedQuery += ` ${expansion}`;
      }
    }

    const rawMatches = miniSearchInstance.search(processedQuery);
    const topMatches = rawMatches.slice(0, 30);
    const tSearchDone = performance.now();

    const populatedResults: (SearchDoc & { score: number })[] = [];
    for (const match of topMatches) {
      const doc = await lf.getItem<SearchDoc>(match.id);
      if (doc) populatedResults.push({ ...doc, score: match.score });
    }
    const tDone = performance.now();

    self.postMessage({
      type: 'RESULTS',
      payload: populatedResults,
      timing: {
        search_ms: (tSearchDone - tSearch).toFixed(1),
        fetch_docs_ms: (tDone - tSearchDone).toFixed(1),
        total_ms: (tDone - tSearch).toFixed(1),
      },
    });
  }
};
