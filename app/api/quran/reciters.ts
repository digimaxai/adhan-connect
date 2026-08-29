// GET /api/quran/reciters
// Cost-optimized: External API only (no DB query), 7-day cache
// Query count: 0 (external API)
// Cache: 7 days

import { type NextRequest, NextResponse } from 'next/server';
import { getQuranReciters } from '../../../lib/api/quranAudio';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const reciters = await getQuranReciters();

    // Metrics logging
    console.log(`[METRIC] GET /api/quran/reciters | Queries: 0 | External: Quran.com | Results: ${reciters.length}`);

    return NextResponse.json(
      { reciters, count: reciters.length },
      { headers: { 'Cache-Control': 'public, max-age=604800' } } // 7 days
    );
  } catch (error) {
    console.error('[API] GET /api/quran/reciters exception:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reciters', reciters: [] },
      { status: 500 }
    );
  }
}
