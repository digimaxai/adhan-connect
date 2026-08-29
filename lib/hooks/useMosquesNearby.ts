import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

interface NearbyMosque {
  id: string;
  name: string;
  city: string;
  distance_km: number;
  follower_count: number;
  prayer_times: {
    fajr_time: string | null;
    dhuhr_time: string | null;
    asr_time: string | null;
    maghrib_time: string | null;
    isha_time: string | null;
  };
  is_live: boolean;
}

interface UseMosquesNearbyResult {
  mosques: NearbyMosque[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMosquesNearby(radiusKm: number = 10): UseMosquesNearbyResult {
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMosques = async () => {
    setLoading(true);
    setError(null);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await fetch(
        `/api/mosques/nearby?lat=${location.coords.latitude}&lon=${location.coords.longitude}&radius=${radiusKm}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch nearby mosques');
      }

      const data = (await response.json()) as { mosques: NearbyMosque[]; cached: boolean };
      setMosques(data.mosques);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMosques([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMosques();
  }, [radiusKm]);

  return { mosques, loading, error, refetch: fetchMosques };
}
