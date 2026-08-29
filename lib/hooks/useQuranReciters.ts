import { useEffect, useState } from 'react';

interface QuranReciter {
  id: number;
  reciter_name: string;
  english_name: string;
  style: string;
  translated_name: {
    language_name: string;
    name: string;
  };
}

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
      const response = await fetch('/api/quran/reciters');

      if (!response.ok) {
        throw new Error('Failed to fetch reciters');
      }

      const data = (await response.json()) as { reciters: QuranReciter[] };
      setReciters(data.reciters);
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
