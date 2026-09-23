// Expo Router API route: GET /api/quran/chapter?chapterId=1
// Returns normalized Arabic verses and an English translation.

import { getQuranChapter } from '../../../lib/api/quranContent';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chapterId = Number(url.searchParams.get('chapterId'));
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    return Response.json(
      { error: 'chapterId must be an integer from 1 to 114.' },
      { status: 400 }
    );
  }

  try {
    const result = await getQuranChapter(chapterId);
    console.log(
      `[METRIC] GET /api/quran/chapter | Queries: 0 | External: Quran.com | Chapter: ${chapterId} | Verses: ${result.verses.length}`
    );
    return Response.json(
      { ...result, count: result.verses.length },
      { headers: { 'Cache-Control': 'public, max-age=604800' } }
    );
  } catch (error) {
    console.error('[API] GET /api/quran/chapter exception:', error);
    return Response.json(
      { error: 'Failed to fetch that Quran chapter.' },
      { status: 502 }
    );
  }
}
