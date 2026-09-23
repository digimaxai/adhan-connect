import { useMemo } from 'react';
import { useMosquesNearby } from './useMosquesNearby';

/**
 * Compatibility wrapper for the original hook. LIVE state now comes from the
 * same nearby context as prayer times and is refreshed by Realtime, app resume,
 * or an explicit refresh—never by a 30-second GPS poll.
 */
export function useLiveAdhansNearby(radiusKm = 15) {
  const nearby = useMosquesNearby(radiusKm);
  const adhans = useMemo(() => nearby.mosques
    .filter((mosque) => mosque.is_live)
    .map((mosque) => ({
      mosque_id: mosque.id,
      mosque_name: mosque.name,
      mosque_city: mosque.city,
      prayer: mosque.live_prayer ?? 'Adhan',
      adhan_time: mosque.live_started_at ?? '',
      listeners: 0,
      started_at: mosque.live_started_at ?? '',
      duration_seconds: mosque.live_started_at
        ? Math.max(0, Math.floor((Date.now() - new Date(mosque.live_started_at).getTime()) / 1000))
        : 0,
      is_live: true,
      distance_km: mosque.distance_km,
    })), [nearby.mosques]);

  return {
    adhans,
    loading: nearby.loading,
    error: nearby.error,
    refetch: nearby.refetch,
    refresh: nearby.refetch,
  };
}
