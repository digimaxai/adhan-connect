import { useEffect, useState } from 'react';
import { fetchPublicApiJson } from '../api/publicApiClient';

export interface IslamicTip {
  category: string;
  title: string;
  description: string;
  reference?: string;
  icon?: string;
}

interface UseDailyTipResult {
  tip: IslamicTip | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  showNext: () => void;
}

export function useDailyTip(category?: string): UseDailyTipResult {
  const [tip, setTip] = useState<IslamicTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetchTip = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (!category && offset > 0) params.set('offset', String(offset));
      const query = params.toString();
      const data = await fetchPublicApiJson<{ tip: IslamicTip }>(
        `/api/tips/daily${query ? `?${query}` : ''}`,
        'Daily reflection'
      );
      setTip(data.tip ?? null);
    } catch (err) {
      console.warn('[reflection] reminder unavailable', err);
      setError('Check your connection and try again.');
      setTip(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTip();
  }, [category, offset]);

  return {
    tip,
    loading,
    error,
    refetch: fetchTip,
    showNext: () => setOffset((value) => value + 1),
  };
}
