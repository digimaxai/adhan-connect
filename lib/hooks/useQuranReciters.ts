import { useEffect, useState } from 'react';
import {
  fetchQuranReciters as requestQuranReciters,
  QuranReciter,
} from '../api/quranClient';

export type { QuranReciter } from '../api/quranClient';

interface UseQuranReciterResult {
  reciters: QuranReciter[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQuranReciters(): UseQuranReciterResult {
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReciters = async () => {
    setLoading(true);
    setError(null);
    try {
      setReciters(await requestQuranReciters());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setReciters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReciters();
  }, []);

  return { reciters, loading, error, refetch: fetchReciters };
}
