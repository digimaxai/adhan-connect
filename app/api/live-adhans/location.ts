// GET /api/live-adhans/location
// Cost-optimized: 2 queries (streams + adhans with mosque JOIN), 30s cache
// Query count: 2
// Cache: 30 seconds (real-time priority)

import { type NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { isFreshLiveStream } from '../../../lib/liveStreamFreshness';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('lat') ?? '0');
    const longitude = parseFloat(searchParams.get('lon') ?? '0');
    const radiusKm = Math.min(parseFloat(searchParams.get('radius') ?? '15'), 100);

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Missing latitude/longitude parameters' },
        { status: 400 }
      );
    }

    const cacheKey = `live-adhans-${Math.round(latitude * 100)}-${Math.round(longitude * 100)}-${radiusKm}`;

    // Check cache (30 second TTL for real-time data)
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(
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
          latitude,
          longitude
        ),
        started_at,
        updated_at
      `
      )
      .eq('is_live', true)
      .order('started_at', { ascending: false });

    if (streamsError) {
      console.error('[API] GET /api/live-adhans/location streams error:', streamsError);
      return NextResponse.json(
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
        adhan_time,
        status,
        broadcast_url
      `
      )
      .eq('status', 'live')
      .in('mosque_id', liveIds.length > 0 ? liveIds : ['00000000-0000-0000-0000-000000000000']);

    if (adhansError) {
      console.error('[API] GET /api/live-adhans/location adhans error:', adhansError);
      return NextResponse.json(
        { error: 'Failed to fetch adhans' },
        { status: 500 }
      );
    }

    // Combine and filter by distance, freshness
    const adhansByMosque = new Map<string, (typeof liveAdhans)[0]>();
    (liveAdhans || []).forEach((a) => {
      adhansByMosque.set(a.mosque_id, a);
    });

    const nearbyAdhans: LiveAdhan[] = (liveStreams || [])
      .map((stream) => {
        const mosque = stream.mosques as any;
        if (!mosque) return null;

        const distance = getDistance(
          latitude,
          longitude,
          mosque.latitude || 0,
          mosque.longitude || 0
        );

        // Check if stream is fresh (not stale)
        const isFresh = isFreshLiveStream({
          created_at: stream.started_at,
          updated_at: stream.updated_at,
        });

        if (!isFresh) return null;

        const adhan = adhansByMosque.get(stream.mosque_id);

        return {
          mosque_id: mosque.id,
          mosque_name: mosque.name,
          mosque_city: mosque.city || 'Unknown',
          prayer: adhan?.prayer || 'Unknown',
          adhan_time: adhan?.adhan_time || '',
          listeners: 0, // TODO: Calculate from subscriptions if needed
          started_at: stream.started_at,
          duration_seconds: Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000),
          is_live: true,
          broadcast_url: adhan?.broadcast_url,
          distance_km: parseFloat(distance.toFixed(1)),
        };
      })
      .filter(
        (a): a is LiveAdhan & { distance_km: number } =>
          a !== null && a.distance_km <= radiusKm
      )
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 20);

    // Cache the result
    cacheMap.set(cacheKey, { data: nearbyAdhans, timestamp: Date.now() });

    // Metrics logging
    console.log(`[METRIC] GET /api/live-adhans/location | Queries: 2 | Cache: false | Results: ${nearbyAdhans.length}`);

    return NextResponse.json(
      { adhans: nearbyAdhans, cached: false, count: nearbyAdhans.length },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (error) {
    console.error('[API] GET /api/live-adhans/location exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', adhans: [] },
      { status: 500 }
    );
  }
}
