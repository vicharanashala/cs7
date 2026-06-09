// React bridge to the MiniSearch Web Worker.
// Adapted from semantic/faq_semantic.md §4 — TypeScript, Vite worker syntax.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SearchDoc {
  id: string;
  type: 'faq' | 'community';
  title: string;
  content: string;
  tags: string[];
  score: number;
}

export interface SearchResults {
  faqs: SearchDoc[];
  community: SearchDoc[];
}

interface ReadyTiming {
  fetch_ms: string;
  index_ms: string;
  total_ms: string;
  doc_count: number;
}

type WorkerResponse =
  | { type: 'READY'; timing: ReadyTiming }
  | { type: 'ERROR'; payload: string }
  | { type: 'RESULTS'; payload: SearchDoc[]; timing: object };

/**
 * Spins up the search Web Worker, fetches + indexes the corpus from `dataEndpoint`,
 * and exposes `search`/`clear` plus index status. Results arrive asynchronously via
 * worker messages and are split into FAQ vs community buckets. The worker is torn
 * down on unmount / when the endpoint changes.
 */
export function useUnifiedSearch(dataEndpoint: string) {
  const [results, setResults] = useState<SearchResults>({ faqs: [], community: [] });
  const [isReady, setIsReady] = useState(false);
  const [indexStats, setIndexStats] = useState<ReadyTiming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Vite module worker — bundled at build time, not a CDN import.
    workerRef.current = new Worker(new URL('../workers/searchEngine.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'READY') {
        setIsReady(true);
        setIndexStats(msg.timing);
      }
      if (msg.type === 'ERROR') setError(msg.payload);
      if (msg.type === 'RESULTS') {
        const categorized = msg.payload.reduce<SearchResults>(
          (acc, doc) => {
            if (doc.type === 'faq') acc.faqs.push(doc);
            else if (doc.type === 'community') acc.community.push(doc);
            return acc;
          },
          { faqs: [], community: [] },
        );
        setResults(categorized);
      }
    };

    workerRef.current.onerror = (e) => setError(e.message);

    const token = localStorage.getItem('samagama:accessToken');
    workerRef.current.postMessage({ type: 'INIT', payload: { dataEndpoint, token } });

    return () => {
      workerRef.current?.terminate();
    };
  }, [dataEndpoint]);

  const search = useCallback(
    (query: string) => {
      if (!isReady || !query.trim()) {
        setResults({ faqs: [], community: [] });
        return;
      }
      workerRef.current?.postMessage({ type: 'SEARCH', payload: { query } });
    },
    [isReady],
  );

  const clear = useCallback(() => {
    setResults({ faqs: [], community: [] });
  }, []);

  return { search, clear, results, isReady, indexStats, error };
}
