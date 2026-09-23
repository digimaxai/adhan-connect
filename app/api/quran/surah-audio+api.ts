// Expo Router API route: GET /api/quran/surah-audio
// Returns continuous chapter metadata where the reciter mapping is verified,
// with a verse-CDN queue fallback. Audio bytes never pass through this route.

import { getSurahAudio } from '../../../lib/api/quranAudio';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chapterId = Number(url.searchParams.get('chapterId'));
  const reciterId = Number(url.searchParams.get('reciterId'));

  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    return Response.json(
      { error: 'chapterId must be an integer between 1 and 114.' },
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
    const audio = await getSurahAudio(chapterId, reciterId);
    if (!audio) {
      return Response.json(
        { error: 'Full-surah audio is unavailable for that surah and reciter.' },
        { status: 404 }
      );
    }

    console.log(
      `[METRIC] GET /api/quran/surah-audio | Queries: 0 | External: Quran.com | Surah: ${chapterId} | Ayahs: ${audio.tracks.length} | Mode: ${audio.playback_mode} | Reciter: ${reciterId}`
    );

    return Response.json(
      { audio },
      { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
  } catch (error) {
    console.error('[API] GET /api/quran/surah-audio exception:', error);
    return Response.json(
      { error: 'Failed to prepare full-surah audio.' },
      { status: 502 }
    );
  }
}
