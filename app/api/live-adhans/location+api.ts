// Expo Router API route: GET /api/live-adhans/location
// Cost-optimized: 2 queries (streams + adhans with mosque JOIN), 30s cache
// Query count: 2
// Cache: 30 seconds (real-time priority)

// Removed Next.js imports
import { supabase } from '../../../lib/supabase';
import { isFreshLiveAdhan, isFreshLiveStream } from '../../../lib/liveStreamFreshness';

export const runtime = 'nodejs';

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
  distance_km: number;
}

// Simple in-memory cache (30 seconds)
const cacheMap = new Map<string, { data: LiveAdhan[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds for real-time data

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitudeParam = searchParams.get('lat');
    const longitudeParam = searchParams.get('lon');
    const latitude = latitudeParam?.trim() ? Number(latitudeParam) : Number.NaN;
    const longitude = longitudeParam?.trim() ? Number(longitudeParam) : Number.NaN;
    const requestedRadius = Number(searchParams.get('radius') ?? '15');
    const radiusKm = Number.isFinite(requestedRadius) && requestedRadius > 0
      ? Math.min(requestedRadius, 100)
      : 15;

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return Response.json(
        { error: 'Missing latitude/longitude parameters' },
        { status: 400 }
      );
    }

    const cacheKey = `live-adhans-${Math.round(latitude * 100)}-${Math.round(longitude * 100)}-${radiusKm}`;

    // Check cache (30 second TTL for real-time data)
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return Response.json(
        { adhans: cached.data, cached: true, count: cached.data.length },
        { headers: { 'Cache-Control': 'public, max-age=30' } }
      );
    }

    // Query 1: Get live streams with mosque JOIN
    const { data: liveStreams, error: streamsError } = await supabase
      .from('streams')
      .select(
        `
        id,
        mosque_id,
        mosques (
          id,
          name,
          city,
          lat,
          lng
        ),
        started_at,
        updated_at
      `
      )
      .eq('is_live', true)
      .order('started_at', { ascending: false });

    if (streamsError) {
      console.error('[API] GET /api/live-adhans/location streams error:', streamsError);
      return Response.json(
        { error: 'Failed to fetch live streams' },
        { status: 500 }
      );
    }

    // Query 2: Get adhans for live mosques (batch query)
    const liveIds = (liveStreams || []).map((s) => s.mosque_id);

    const { data: liveAdhans, error: adhansError } = await supabase
      .from('adhans')
      .select(
        `
        id,
        mosque_id,
        prayer,
        scheduled_at,
        status,
        started_at,
        ended_at,
        broadcast_started_at,
        broadcast_ended_at
      `
      )
      .eq('status', 'live')
      .in('mosque_id', liveIds.length > 0 ? liveIds : ['00000000-0000-0000-0000-000000000000']);

    if (adhansError) {
      console.error('[API] GET /api/live-adhans/location adhans error:', adhansError);
      return Response.json(
        { error: 'Failed to fetch adhans' },
        { status: 500 }
      );
    }

    // Combine and filter by distance, freshness
    const adhansByMosque = new Map<string, (typeof liveAdhans)[0]>();
    (liveAdhans || []).filter((adhan) => isFreshLiveAdhan(adhan)).forEach((a) => {
      adhansByMosque.set(a.mosque_id, a);
    });

    const nearbyAdhans: LiveAdhan[] = (liveStreams || [])
      .map((stream) => {
        const mosque = stream.mosques as any;
        if (!mosque || mosque.lat == null || mosque.lng == null) return null;

        const distance = getDistance(
          latitude,
          longitude,
          mosque.lat,
          mosque.lng
        );

        // Check if stream is fresh (not stale)
        const isFresh = isFreshLiveStream({
          is_live: true,
          started_at: stream.started_at,
        });

        if (!isFresh) return null;

        const adhan = adhansByMosque.get(stream.mosque_id);

        const startedAt = stream.started_at ?? stream.updated_at ?? new Date().toISOString();
        const result: LiveAdhan = {
          mosque_id: mosque.id,
          mosque_name: mosque.name,
          mosque_city: mosque.city || 'Unknown',
          prayer: adhan?.prayer || 'Unknown',
          adhan_time: adhan?.scheduled_at || '',
          listeners: 0,
          started_at: startedAt,
          duration_seconds: Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
          is_live: true,
          distance_km: parseFloat(distance.toFixed(1)),
        };
        return result;
      })
      .filter(
        (a): a is LiveAdhan => a !== null && a.distance_km <= radiusKm
      )
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 20);

    // Cache the result
    cacheMap.set(cacheKey, { data: nearbyAdhans, timestamp: Date.now() });

    // Metrics logging
    console.log(`[METRIC] GET /api/live-adhans/location | Queries: 2 | Cache: false | Results: ${nearbyAdhans.length}`);

    return Response.json(
      { adhans: nearbyAdhans, cached: false, count: nearbyAdhans.length },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (error) {
    console.error('[API] GET /api/live-adhans/location exception:', error);
    return Response.json(
      { error: 'Internal server error', adhans: [] },
      { status: 500 }
    );
  }
}
