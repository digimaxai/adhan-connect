// GET /api/mosques/search
// Cost-optimized: Single query with COUNT, selective columns, 1-hour cache
// Query count: 1 (with subscriptions count)
// Cache: 1 hour

import { type NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const runtime = 'nodejs';

interface SearchMosque {
  id: string;
  name: string;
  city: string;
  follower_count: number;
}

const cacheMap = new Map<string, { data: SearchMosque[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const cacheKey = `search-${query}`;

    // Check cache
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(
        { mosques: cached.data, cached: true },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      );
    }

    // Query 1: Search by city or mosque name
    const { data: mosques, error } = await supabase
      .from('mosques')
      .select(
        `
        id,
        name,
        city,
        subscriptions (count)
      `
      )
      .eq('status', 'active')
      .or(
        `city.ilike.%${query}%,name.ilike.%${query}%`
      )
      .limit(20);

    if (error) {
      console.error('[API] GET /api/mosques/search error:', error);
      return NextResponse.json(
        { error: 'Failed to search mosques' },
        { status: 500 }
      );
    }

    const results: SearchMosque[] = (mosques || []).map((m) => ({
      id: m.id,
      name: m.name,
      city: m.city || 'Unknown',
      follower_count: m.subscriptions?.[0]?.count || 0,
    }));

    // Cache the result
    cacheMap.set(cacheKey, { data: results, timestamp: Date.now() });

    // Metrics logging
    console.log(`[METRIC] GET /api/mosques/search | Queries: 1 | Cache: false | Results: ${results.length}`);

    return NextResponse.json(
      { mosques: results, cached: false },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error) {
    console.error('[API] GET /api/mosques/search exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
