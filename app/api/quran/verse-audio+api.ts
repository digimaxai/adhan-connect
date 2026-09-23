// Expo Router API route: GET /api/quran/verse-audio
// External API only (no Supabase query); audio bytes are served by Quran Foundation's CDN.

import { getVerseAudio, parseVerseKey } from '../../../lib/api/quranAudio';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verseKey = (url.searchParams.get('verseKey') ?? '').trim();
  const reciterId = Number(url.searchParams.get('reciterId'));

  if (!parseVerseKey(verseKey)) {
    return Response.json(
      { error: 'verseKey must use the chapter:verse format, for example 1:1.' },
      { status: 400 }
    );
  }

  if (!Number.isInteger(reciterId) || reciterId < 1) {
    return Response.json(
      { error: 'reciterId must be a positive integer from the recitations endpoint.' },
      { status: 400 }
    );
  }

  try {
    const audio = await getVerseAudio(verseKey, reciterId);
    if (!audio) {
      return Response.json(
        { error: 'Audio is not available for that verse and reciter.' },
        { status: 404 }
      );
    }

    console.log(
      `[METRIC] GET /api/quran/verse-audio | Queries: 0 | External: Quran.com | Verse: ${audio.verse_key} | Reciter: ${reciterId}`
    );

    return Response.json(
      { audio },
      { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
  } catch (error) {
    console.error('[API] GET /api/quran/verse-audio exception:', error);
    return Response.json(
      { error: 'Failed to fetch verse audio.' },
      { status: 502 }
    );
  }
}
