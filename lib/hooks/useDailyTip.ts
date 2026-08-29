import { useEffect, useState } from 'react';

interface IslamicTip {
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
}

export function useDailyTip(category?: string): UseDailyTipResult {
  const [tip, setTip] = useState<IslamicTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTip = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = category ? `/api/tips/daily?category=${category}` : '/api/tips/daily';
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch tip');
      }

      const data = (await response.json()) as { tip: IslamicTip | IslamicTip[] };
      // Handle both single tip and array responses
      const tipData = Array.isArray(data.tip) ? data.tip[0] : data.tip;
      setTip(tipData || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTip(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTip();
  }, [category]);

  return { tip, loading, error, refetch: fetchTip };
}
