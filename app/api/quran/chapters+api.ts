// Expo Router API route: GET /api/quran/chapters
// External Quran Foundation content only; no Supabase queries.

import { getQuranChapters } from '../../../lib/api/quranContent';

export const runtime = 'nodejs';

export async function GET(_request: Request) {
  try {
    const chapters = await getQuranChapters();
    console.log(
      `[METRIC] GET /api/quran/chapters | Queries: 0 | External: Quran.com | Results: ${chapters.length}`
    );
    return Response.json(
      { chapters, count: chapters.length },
      { headers: { 'Cache-Control': 'public, max-age=604800' } }
    );
  } catch (error) {
    console.error('[API] GET /api/quran/chapters exception:', error);
    return Response.json(
      { error: 'Failed to fetch Quran chapters.', chapters: [] },
      { status: 502 }
    );
  }
}
