import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

interface LiveAdhan {
  mosque_id: string;
  mosque_name: string;
  mosque_city: string;
  prayer: string;
  adhan_time: string;
  listeners: number;
  started_at: string;
  duration_seconds: number;
  is_live: boolean;
  broadcast_url?: string;
}

interface UseLiveAdhansNearbyResult {
  adhans: LiveAdhan[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>; // Explicit refresh for real-time updates
}

export function useLiveAdhansNearby(radiusKm: number = 15): UseLiveAdhansNearbyResult {
  const [adhans, setAdhans] = useState<LiveAdhan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdhans = async () => {
    setLoading(true);
    setError(null);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await fetch(
        `/api/live-adhans/location?lat=${location.coords.latitude}&lon=${location.coords.longitude}&radius=${radiusKm}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch live adhans');
      }

      const data = (await response.json()) as { adhans: LiveAdhan[]; cached: boolean };
      setAdhans(data.adhans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAdhans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdhans();

    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      void fetchAdhans();
    }, 30000);

    return () => clearInterval(interval);
  }, [radiusKm]);

  // Explicit refresh (for pull-to-refresh, button click, etc.)
  const refresh = async () => {
    await fetchAdhans();
  };

  return { adhans, loading, error, refetch: fetchAdhans, refresh };
}
