import { useEffect, useState } from 'react';

interface DailyDua {
  prayer: string;
  dua_arabic: string;
  dua_english: string;
  attribution: string;
  transliteration?: string;
}

interface UseDailyDuaResult {
  dua: DailyDua | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDailyDua(prayer?: string): UseDailyDuaResult {
  const [dua, setDua] = useState<DailyDua | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDua = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = prayer ? `/api/duas/daily?prayer=${prayer}` : '/api/duas/daily';
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch dua');
      }

      const data = (await response.json()) as { dua: DailyDua };
      setDua(data.dua);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDua(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDua();
  }, [prayer]);

  return { dua, loading, error, refetch: fetchDua };
}
