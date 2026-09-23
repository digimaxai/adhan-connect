import { useState, useCallback } from 'react';

interface SearchMosque {
  id: string;
  name: string;
  city: string;
  follower_count: number;
}

interface UseMosqueSearchResult {
  results: SearchMosque[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

export function useMosqueSearch(): UseMosqueSearchResult {
  const [results, setResults] = useState<SearchMosque[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/mosques/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error('Failed to search mosques');
      }

      const data = (await response.json()) as { mosques: SearchMosque[] };
      setResults(data.mosques);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}
