import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchPublicApiJson } from '../api/publicApiClient';
import { supabase } from '../supabase';

export type NearbyMosque = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  next_prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | null;
  next_adhan_at: string | null;
  minutes_until: number | null;
  schedule_source: 'mosque' | 'calculated' | 'unavailable';
  is_live: boolean;
  live_prayer: string | null;
  live_adhan_id: string | null;
  live_started_at: string | null;
};

export type NearbyCoordinates = {
  latitude: number;
  longitude: number;
};

type NearbyResponse = {
  mosques: NearbyMosque[];
  cached: boolean;
  fresh_as_of: string;
};

export function useMosquesNearby(
  radiusKm = 15,
  suppliedCoordinates: NearbyCoordinates | null = null,
  enabled = true
) {
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [freshAsOf, setFreshAsOf] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<NearbyCoordinates | null>(suppliedCoordinates);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const resolveCoordinates = useCallback(async (freshLocation: boolean) => {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    if (!freshLocation && suppliedCoordinates) return suppliedCoordinates;
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  }, [suppliedCoordinates]);

  const loadNearby = useCallback(async (freshLocation: boolean) => {
    if (!enabled) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    const nextCoordinates = await resolveCoordinates(freshLocation);
    if (!nextCoordinates) {
      if (mountedRef.current) {
        setMosques([]);
        setCoordinates(null);
        setLoading(false);
      }
      return;
    }
    try {
      const query = new URLSearchParams({
        lat: nextCoordinates.latitude.toString(),
        lon: nextCoordinates.longitude.toString(),
        radius: radiusKm.toString(),
        limit: '10',
      });
      const result = await fetchPublicApiJson<NearbyResponse>(
        `/api/mosques/nearby?${query.toString()}`,
        'Nearby mosques',
        12_000
      );
      if (!mountedRef.current) return;
      setMosques(result.mosques ?? []);
      setCoordinates(nextCoordinates);
      setFreshAsOf(result.fresh_as_of ?? new Date().toISOString());
    } catch (fetchError) {
      if (!mountedRef.current) return;
      setError(fetchError instanceof Error ? fetchError.message : 'Nearby mosques could not be loaded.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, radiusKm, resolveCoordinates]);

  const refetch = useCallback(() => loadNearby(true), [loadNearby]);

  useEffect(() => {
    if (!enabled) return;
    void loadNearby(false);
  }, [enabled, loadNearby]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('nearby-mosque-live-context')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => void loadNearby(false))
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadNearby(true);
    });
    return () => {
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [enabled, loadNearby]);

  return { mosques, loading, error, freshAsOf, coordinates, refetch };
}
