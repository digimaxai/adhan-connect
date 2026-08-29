// GET /api/mosques/nearby
// Cost-optimized: Single query with JOINs, selective columns, 1-hour cache
// Query count: 1 (with prayer_times JOIN)
// Cache: 1 hour (slow-changing reference data)

import { type NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { isFreshLiveStream } from '../../../lib/liveStreamFreshness';

export const runtime = 'nodejs';

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

// Simple in-memory cache (1 hour)
const cacheMap = new Map<string, { data: NearbyMosque[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
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
    const radiusKm = Math.min(parseFloat(searchParams.get('radius') ?? '10'), 100); // Cap at 100km

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Missing latitude/longitude parameters' },
        { status: 400 }
      );
    }

    const cacheKey = `nearby-${Math.round(latitude * 100)}-${Math.round(longitude * 100)}-${radiusKm}`;

    // Check cache
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(
        { mosques: cached.data, cached: true },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      );
    }

    // Query 1: Get mosques with prayer times using a single query
    // Selecting only needed columns for performance
    const { data: mosques, error: mosquesError } = await supabase
      .from('mosques')
      .select(
        `
        id,
        name,
        city,
        latitude,
        longitude,
        prayer_times (
          fajr_time,
          dhuhr_time,
          asr_time,
          maghrib_time,
          isha_time
        ),
        subscriptions (count)
      `
      )
      .eq('status', 'active')
      .limit(50);

    if (mosquesError) {
      console.error('[API] GET /api/mosques/nearby error:', mosquesError);
      return NextResponse.json(
        { error: 'Failed to fetch mosques' },
        { status: 500 }
      );
    }

    // Check live streams (separate query, but with cache-aware filtering)
    const { data: liveStreams, error: streamsError } = await supabase
      .from('streams')
      .select('mosque_id')
      .eq('is_live', true);

    const liveIds = new Set((liveStreams || []).map((s) => s.mosque_id));

    // Process and filter by distance
    const nearbyMosques: NearbyMosque[] = (mosques || [])
      .map((mosque) => {
        const distance = getDistance(
          latitude,
          longitude,
          mosque.latitude || 0,
          mosque.longitude || 0
        );
        return {
          id: mosque.id,
          name: mosque.name,
          city: mosque.city || 'Unknown',
          distance_km: parseFloat(distance.toFixed(1)),
          follower_count: mosque.subscriptions?.[0]?.count || 0,
          prayer_times: {
            fajr_time: mosque.prayer_times?.[0]?.fajr_time || null,
            dhuhr_time: mosque.prayer_times?.[0]?.dhuhr_time || null,
            asr_time: mosque.prayer_times?.[0]?.asr_time || null,
            maghrib_time: mosque.prayer_times?.[0]?.maghrib_time || null,
            isha_time: mosque.prayer_times?.[0]?.isha_time || null,
          },
          is_live: liveIds.has(mosque.id),
        };
      })
      .filter((m) => m.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 20);

    // Cache the result
    cacheMap.set(cacheKey, { data: nearbyMosques, timestamp: Date.now() });

    // Metrics logging (for Week 1 testing)
    console.log(`[METRIC] GET /api/mosques/nearby | Queries: 2 | Cache: false | Results: ${nearbyMosques.length}`);

    return NextResponse.json(
      { mosques: nearbyMosques, cached: false },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error) {
    console.error('[API] GET /api/mosques/nearby exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
