// Quran Foundation API wrapper for verse and continuous chapter recitations.
// External API: https://api.quran.com/api/v4
// Cache strategy: 7 days for reciters, 24 hours for audio metadata.

const QURAN_API_BASE_URL = 'https://api.quran.com/api/v4';
const QURAN_VERSE_AUDIO_BASE_URL = 'https://verses.quran.foundation/';
const ALLOWED_QURAN_AUDIO_HOSTS = new Set([
  'download.quranicaudio.com',
  'mirrors.quranicaudio.com',
  'verses.quran.foundation',
  'verses.quran.com',
]);

// Quran.com's ayah and chapter catalogues use separate identifiers. These
// pairings have been verified against the live chapter-recitation endpoint.
// Reciter 11 is deliberately omitted because its current chapter ID resolves
// to a different voice; it retains the accurate ayah-by-ayah fallback.
const VERIFIED_CHAPTER_RECITER_IDS = new Map<number, number>([
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, 7],
  [8, 8],
  [9, 9],
  [10, 10],
  [12, 12],
]);

export interface QuranReciter {
  id: number;
  reciter_name: string;
  display_name: string;
  style: string | null;
  translated_name: {
    language_name: string;
    name: string;
  } | null;
}

interface UpstreamQuranReciter {
  id?: unknown;
  reciter_name?: unknown;
  style?: unknown;
  translated_name?: {
    language_name?: unknown;
    name?: unknown;
  } | null;
}

interface QuranReciterResponse {
  recitations?: UpstreamQuranReciter[];
}

export interface VerseAudio {
  verse_key: string;
  verse_number: number;
  chapter_number: number;
  audio_url: string;
  duration: number;
  reciter_name: string | null;
  recitation_style: string | null;
}

export interface SurahAudio {
  chapter_number: number;
  reciter_id: number;
  reciter_name: string | null;
  recitation_style: string | null;
  playback_mode: 'continuous' | 'verse_queue';
  continuous_audio_url: string | null;
  duration: number;
  timestamps: SurahAudioTimestamp[];
  tracks: VerseAudio[];
}

export interface SurahAudioTimestamp {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
}

interface UpstreamVerseAudioResponse {
  audio_files?: Array<{
    verse_key?: unknown;
    url?: unknown;
    duration?: unknown;
  }>;
  meta?: {
    reciter_name?: unknown;
    recitation_style?: unknown;
  };
}

interface UpstreamChapterAudioResponse {
  audio_file?: {
    chapter_id?: unknown;
    audio_url?: unknown;
    timestamps?: Array<{
      verse_key?: unknown;
      timestamp_from?: unknown;
      timestamp_to?: unknown;
    }>;
  };
}

const reciterCache = new Map<string, { data: QuranReciter[]; timestamp: number }>();
const verseCache = new Map<string, { data: VerseAudio; timestamp: number }>();
const surahCache = new Map<string, { data: SurahAudio; timestamp: number }>();

const RECITER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeReciter(value: UpstreamQuranReciter): QuranReciter | null {
  if (!Number.isInteger(value.id) || typeof value.reciter_name !== 'string') {
    return null;
  }

  const reciterName = value.reciter_name.trim();
  if (!reciterName) return null;

  const translatedName = normalizeOptionalString(value.translated_name?.name);
  const translatedLanguage = normalizeOptionalString(value.translated_name?.language_name);

  return {
    id: value.id as number,
    reciter_name: reciterName,
    display_name: translatedName ?? reciterName,
    style: normalizeOptionalString(value.style),
    translated_name: translatedName
      ? {
          name: translatedName,
          language_name: translatedLanguage ?? 'english',
        }
      : null,
  };
}

function resolveQuranAudioUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const resolved = new URL(value.trim(), QURAN_VERSE_AUDIO_BASE_URL);
    if (resolved.protocol !== 'https:' || !ALLOWED_QURAN_AUDIO_HOSTS.has(resolved.hostname)) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

export function parseVerseKey(value: string): {
  verseKey: string;
  chapterNumber: number;
  verseNumber: number;
} | null {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(value.trim());
  if (!match) return null;

  const chapterNumber = Number(match[1]);
  const verseNumber = Number(match[2]);
  if (
    !Number.isInteger(chapterNumber) ||
    chapterNumber < 1 ||
    chapterNumber > 114 ||
    !Number.isInteger(verseNumber) ||
    verseNumber < 1
  ) {
    return null;
  }

  return {
    verseKey: `${chapterNumber}:${verseNumber}`,
    chapterNumber,
    verseNumber,
  };
}

export async function getQuranReciters(): Promise<QuranReciter[]> {
  const cacheKey = 'quran-reciters';
  const cached = reciterCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < RECITER_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(`${QURAN_API_BASE_URL}/resources/recitations`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    const data = (await response.json()) as QuranReciterResponse;
    const reciters = (data.recitations ?? [])
      .map(normalizeReciter)
      .filter((reciter): reciter is QuranReciter => reciter !== null);

    if (!reciters.length) {
      throw new Error('Quran API returned no valid reciters.');
    }

    reciterCache.set(cacheKey, { data: reciters, timestamp: Date.now() });
    return reciters;
  } catch (error) {
    console.error('[Quran API] Failed to fetch reciters:', error);
    if (cached?.data.length) return cached.data;
    throw error;
  }
}

export async function getVerseAudio(
  verseKey: string,
  reciterId: number = 2 // AbdulBaset AbdulSamad, Murattal
): Promise<VerseAudio | null> {
  const parsedVerse = parseVerseKey(verseKey);
  if (!parsedVerse || !Number.isInteger(reciterId) || reciterId < 1) return null;

  const cacheKey = `verse-${parsedVerse.verseKey}-${reciterId}`;
  const cached = verseCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < VERSE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      verse_key: parsedVerse.verseKey,
      fields: 'verse_key,url,duration',
    });
    const response = await fetch(
      `${QURAN_API_BASE_URL}/quran/recitations/${reciterId}?${params.toString()}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    const data = (await response.json()) as UpstreamVerseAudioResponse;
    const audioFile = data.audio_files?.find(
      (file) => file.verse_key === parsedVerse.verseKey
    );
    const audioUrl = resolveQuranAudioUrl(audioFile?.url);
    if (!audioFile || !audioUrl) return null;

    const durationSeconds = Number(audioFile.duration);
    const result: VerseAudio = {
      verse_key: parsedVerse.verseKey,
      verse_number: parsedVerse.verseNumber,
      chapter_number: parsedVerse.chapterNumber,
      audio_url: audioUrl,
      duration:
        Number.isFinite(durationSeconds) && durationSeconds > 0
          ? Math.round(durationSeconds * 1000)
          : 0,
      reciter_name: normalizeOptionalString(data.meta?.reciter_name),
      recitation_style: normalizeOptionalString(data.meta?.recitation_style),
    };

    verseCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error(`[Quran API] Failed to fetch verse ${parsedVerse.verseKey}:`, error);
    if (cached?.data) return cached.data;
    throw error;
  }
}

export async function getSurahAudio(
  chapterNumber: number,
  reciterId: number = 2
): Promise<SurahAudio | null> {
  if (
    !Number.isInteger(chapterNumber) ||
    chapterNumber < 1 ||
    chapterNumber > 114 ||
    !Number.isInteger(reciterId) ||
    reciterId < 1
  ) {
    return null;
  }

  const cacheKey = `surah-${chapterNumber}-${reciterId}`;
  const cached = surahCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < VERSE_CACHE_TTL_MS) {
    return cached.data;
  }

  const chapterReciterId = VERIFIED_CHAPTER_RECITER_IDS.get(reciterId);
  if (chapterReciterId) {
    try {
      const [response, reciters] = await Promise.all([
        fetch(
          `${QURAN_API_BASE_URL}/chapter_recitations/${chapterReciterId}/${chapterNumber}?segments=true`,
          { headers: { Accept: 'application/json' } }
        ),
        getQuranReciters().catch(() => [] as QuranReciter[]),
      ]);

      if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

      const data = (await response.json()) as UpstreamChapterAudioResponse;
      const audioUrl = resolveQuranAudioUrl(data.audio_file?.audio_url);
      if (Number(data.audio_file?.chapter_id) !== chapterNumber || !audioUrl) {
        throw new Error('Quran API returned invalid chapter audio metadata.');
      }

      const timestamps = (data.audio_file?.timestamps ?? [])
        .map((timestamp): (SurahAudioTimestamp & { verse_number: number }) | null => {
          const parsedVerse = parseVerseKey(String(timestamp.verse_key ?? ''));
          const timestampFrom = Number(timestamp.timestamp_from);
          const timestampTo = Number(timestamp.timestamp_to);
          if (
            !parsedVerse ||
            parsedVerse.chapterNumber !== chapterNumber ||
            !Number.isFinite(timestampFrom) ||
            timestampFrom < 0 ||
            !Number.isFinite(timestampTo) ||
            timestampTo <= timestampFrom
          ) {
            return null;
          }

          return {
            verse_key: parsedVerse.verseKey,
            verse_number: parsedVerse.verseNumber,
            timestamp_from: Math.round(timestampFrom),
            timestamp_to: Math.round(timestampTo),
          };
        })
        .filter(
          (timestamp): timestamp is SurahAudioTimestamp & { verse_number: number } =>
            timestamp !== null
        )
        .sort((a, b) => a.verse_number - b.verse_number);

      const hasCompleteSequence =
        timestamps.length > 0 &&
        timestamps.every(
          (timestamp, index) =>
            timestamp.verse_number === index + 1 &&
            (index === 0 || timestamp.timestamp_from >= timestamps[index - 1].timestamp_from)
        );
      if (!hasCompleteSequence) {
        throw new Error('Quran API returned incomplete chapter timestamps.');
      }

      const reciter = reciters.find((item) => item.id === reciterId) ?? null;
      const normalizedTimestamps = timestamps.map(
        ({ verse_key, timestamp_from, timestamp_to }) => ({
          verse_key,
          timestamp_from,
          timestamp_to,
        })
      );
      const tracks = timestamps.map((timestamp): VerseAudio => ({
        verse_key: timestamp.verse_key,
        verse_number: timestamp.verse_number,
        chapter_number: chapterNumber,
        audio_url: audioUrl,
        duration: timestamp.timestamp_to - timestamp.timestamp_from,
        reciter_name: reciter?.reciter_name ?? null,
        recitation_style: reciter?.style ?? null,
      }));
      const result: SurahAudio = {
        chapter_number: chapterNumber,
        reciter_id: reciterId,
        reciter_name: reciter?.reciter_name ?? null,
        recitation_style: reciter?.style ?? null,
        playback_mode: 'continuous',
        continuous_audio_url: audioUrl,
        duration: timestamps[timestamps.length - 1].timestamp_to,
        timestamps: normalizedTimestamps,
        tracks,
      };

      surahCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.warn(
        `[Quran API] Continuous audio unavailable for surah ${chapterNumber}, falling back to verse audio:`,
        error
      );
    }
  }

  try {
    const params = new URLSearchParams({
      chapter_number: String(chapterNumber),
      fields: 'verse_key,url,duration',
    });
    const response = await fetch(
      `${QURAN_API_BASE_URL}/quran/recitations/${reciterId}?${params.toString()}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    const data = (await response.json()) as UpstreamVerseAudioResponse;
    const reciterName = normalizeOptionalString(data.meta?.reciter_name);
    const recitationStyle = normalizeOptionalString(data.meta?.recitation_style);
    const tracks = (data.audio_files ?? [])
      .map((audioFile): VerseAudio | null => {
        const parsedVerse = parseVerseKey(String(audioFile.verse_key ?? ''));
        const audioUrl = resolveQuranAudioUrl(audioFile.url);
        if (!parsedVerse || parsedVerse.chapterNumber !== chapterNumber || !audioUrl) {
          return null;
        }

        const durationSeconds = Number(audioFile.duration);
        return {
          verse_key: parsedVerse.verseKey,
          verse_number: parsedVerse.verseNumber,
          chapter_number: parsedVerse.chapterNumber,
          audio_url: audioUrl,
          duration:
            Number.isFinite(durationSeconds) && durationSeconds > 0
              ? Math.round(durationSeconds * 1000)
              : 0,
          reciter_name: reciterName,
          recitation_style: recitationStyle,
        };
      })
      .filter((track): track is VerseAudio => track !== null)
      .sort((a, b) => a.verse_number - b.verse_number);

    if (!tracks.length) return null;

    const result: SurahAudio = {
      chapter_number: chapterNumber,
      reciter_id: reciterId,
      reciter_name: reciterName,
      recitation_style: recitationStyle,
      playback_mode: 'verse_queue',
      continuous_audio_url: null,
      duration: tracks.reduce((total, track) => total + track.duration, 0),
      timestamps: [],
      tracks,
    };

    surahCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error(`[Quran API] Failed to fetch surah ${chapterNumber}:`, error);
    if (cached?.data) return cached.data;
    throw error;
  }
}

export async function getVerseOfDay(): Promise<string> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const popularVerses = ['2:255', '1:1', '36:1', '112:1', '113:1'];
  return popularVerses[dayOfYear % popularVerses.length];
}
