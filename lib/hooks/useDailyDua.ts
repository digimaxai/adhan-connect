import { useEffect, useState } from 'react';
import { fetchPublicApiJson } from '../api/publicApiClient';

export interface DailyDua {
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
      const url = prayer
        ? `/api/duas/daily?prayer=${encodeURIComponent(prayer)}`
        : '/api/duas/daily';
      const data = await fetchPublicApiJson<{ dua: DailyDua }>(url, 'Dua');
      setDua(data.dua);
    } catch (err) {
      console.warn('[reflection] dua unavailable', err);
      setError('Check your connection and try again.');
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
