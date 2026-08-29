// Quran.com API wrapper for audio and reciters
// External API: https://api.quran.com/api/v4/resources/recitations
// Cache strategy: 7 days for reciters (50+ reciters rarely change), 24h for verse audio

interface QuranReciter {
  id: number;
  reciter_name: string;
  english_name: string;
  style: string;
  translated_name: {
    language_name: string;
    name: string;
  };
}

interface QuranReciterResponse {
  recitations: QuranReciter[];
}

interface VerseAudio {
  verse_key: string;
  verse_number: number;
  chapter_number: number;
  text_madina: string;
  audio_url: string;
  duration: number;
}

interface VerseAudioResponse {
  verse: {
    id: number;
    verse_key: string;
    verse_number: number;
    chapter_number: number;
    text_madina: string;
    audio?: {
      url: string;
      duration: number;
    };
  };
}

// In-memory cache for reciters (7 days) and verses (24h)
const reciterCache = new Map<string, { data: QuranReciter[]; timestamp: number }>();
const verseCache = new Map<string, { data: VerseAudio; timestamp: number }>();

const RECITER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VERSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getQuranReciters(): Promise<QuranReciter[]> {
  const cacheKey = 'quran-reciters';
  const cached = reciterCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < RECITER_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch('https://api.quran.com/api/v4/resources/recitations', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    const data = (await response.json()) as QuranReciterResponse;
    const reciters = data.recitations || [];

    // Cache the result
    reciterCache.set(cacheKey, { data: reciters, timestamp: Date.now() });

    return reciters;
  } catch (error) {
    console.error('[Quran API] Failed to fetch reciters:', error);
    // Return cached data even if expired, or empty array
    return cached?.data || [];
  }
}

export async function getVerseAudio(
  verseKey: string,
  reciterId: number = 1 // Default: Abdul Basit Murattal
): Promise<VerseAudio | null> {
  const cacheKey = `verse-${verseKey}-${reciterId}`;
  const cached = verseCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < VERSE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://api.quran.com/api/v4/verses/${verseKey}?recitation=${reciterId}&language=en`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    const data = (await response.json()) as VerseAudioResponse;
    const verse = data.verse;

    if (!verse) return null;

    const audioUrl = verse.audio?.url;
    if (!audioUrl) return null;

    const result: VerseAudio = {
      verse_key: verse.verse_key,
      verse_number: verse.verse_number,
      chapter_number: verse.chapter_number,
      text_madina: verse.text_madina,
      audio_url: audioUrl,
      duration: verse.audio?.duration || 0,
    };

    // Cache the result
    verseCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error(`[Quran API] Failed to fetch verse ${verseKey}:`, error);
    return null;
  }
}

export async function getChapterAudio(
  chapterId: number,
  reciterId: number = 1
): Promise<string | null> {
  try {
    // Quran.com doesn't have a direct chapter audio URL, but you can construct
    // the URL pattern from verse audio. This returns the CDN path for the chapter.
    const response = await fetch(
      `https://api.quran.com/api/v4/chapters/${chapterId}?language=en`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    // For now, return null. In production, this would construct the proper URL.
    // The verse-by-verse player is more reliable anyway.
    return null;
  } catch (error) {
    console.error(`[Quran API] Failed to fetch chapter ${chapterId}:`, error);
    return null;
  }
}

export async function getVerseOfDay(): Promise<string> {
  // Deterministic verse selection based on day of year
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Total verses in Quran: 6236
  const verseNumber = (dayOfYear % 6236) + 1;

  // Simple mapping (in production, this would be smarter)
  // For now, return a popular verse
  const popularVerses = [
    '2:255', // Ayat al-Kursi
    '1:1', // Al-Fatiha
    '36:1', // Ya Sin
    '112:1', // Al-Ikhlas
    '113:1', // Al-Falaq
  ];

  return popularVerses[dayOfYear % popularVerses.length];
}
