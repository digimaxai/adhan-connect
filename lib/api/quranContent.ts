// Quran Foundation content wrapper for the mobile chapter and verse browser.
// Text content is static enough for a seven-day server cache.

const QURAN_API_BASE_URL = 'https://api.quran.com/api/v4';
const ENGLISH_TRANSLATION_ID = 20;
const ENGLISH_TRANSLATION_NAME = 'Saheeh International';
const CONTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERSES_PER_PAGE = 50;

export interface QuranChapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name: string;
  revelation_place: 'makkah' | 'madinah' | string;
  verses_count: number;
}

export interface QuranVerse {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  translation: string;
}

interface UpstreamChapter {
  id?: unknown;
  name_simple?: unknown;
  name_arabic?: unknown;
  revelation_place?: unknown;
  verses_count?: unknown;
  translated_name?: { name?: unknown } | null;
}

interface UpstreamVerse {
  id?: unknown;
  verse_key?: unknown;
  verse_number?: unknown;
  text_uthmani?: unknown;
  translations?: Array<{ text?: unknown }>;
}

interface VersePage {
  verses?: UpstreamVerse[];
  pagination?: {
    total_pages?: unknown;
  };
}

const chapterCache = new Map<string, { data: QuranChapter[]; timestamp: number }>();
const verseCache = new Map<string, { data: QuranVerse[]; timestamp: number }>();

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] === '#') {
        const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
        const digits = radix === 16 ? code.slice(2) : code.slice(1);
        const codePoint = Number.parseInt(digits, radix);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      }
      return namedEntities[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTranslation(value: unknown) {
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(
    value
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  );
}

function normalizeChapter(value: UpstreamChapter): QuranChapter | null {
  if (
    !Number.isInteger(value.id) ||
    typeof value.name_simple !== 'string' ||
    typeof value.name_arabic !== 'string' ||
    !Number.isInteger(value.verses_count)
  ) {
    return null;
  }

  const translatedName =
    typeof value.translated_name?.name === 'string'
      ? value.translated_name.name.trim()
      : '';

  return {
    id: value.id as number,
    name_simple: value.name_simple.trim(),
    name_arabic: value.name_arabic.trim(),
    translated_name: translatedName,
    revelation_place:
      typeof value.revelation_place === 'string' ? value.revelation_place : '',
    verses_count: value.verses_count as number,
  };
}

function normalizeVerse(value: UpstreamVerse): QuranVerse | null {
  if (
    !Number.isInteger(value.id) ||
    !Number.isInteger(value.verse_number) ||
    typeof value.verse_key !== 'string' ||
    typeof value.text_uthmani !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id as number,
    verse_key: value.verse_key,
    verse_number: value.verse_number as number,
    text_uthmani: value.text_uthmani,
    translation: normalizeTranslation(value.translations?.[0]?.text),
  };
}

async function fetchVersePage(chapterId: number, page: number): Promise<VersePage> {
  const params = new URLSearchParams({
    language: 'en',
    words: 'false',
    translations: String(ENGLISH_TRANSLATION_ID),
    fields: 'text_uthmani',
    per_page: String(VERSES_PER_PAGE),
    page: String(page),
  });
  const response = await fetch(
    `${QURAN_API_BASE_URL}/verses/by_chapter/${chapterId}?${params.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Quran API error: ${response.status}`);
  return response.json() as Promise<VersePage>;
}

export async function getQuranChapters(): Promise<QuranChapter[]> {
  const cacheKey = 'chapters-en';
  const cached = chapterCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(`${QURAN_API_BASE_URL}/chapters?language=en`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Quran API error: ${response.status}`);

    const data = (await response.json()) as { chapters?: UpstreamChapter[] };
    const chapters = (data.chapters ?? [])
      .map(normalizeChapter)
      .filter((chapter): chapter is QuranChapter => chapter !== null);
    if (chapters.length !== 114) {
      throw new Error(`Quran API returned ${chapters.length} chapters instead of 114.`);
    }

    chapterCache.set(cacheKey, { data: chapters, timestamp: Date.now() });
    return chapters;
  } catch (error) {
    console.error('[Quran API] Failed to fetch chapters:', error);
    if (cached?.data.length) return cached.data;
    throw error;
  }
}

export async function getQuranChapter(chapterId: number): Promise<{
  chapter: QuranChapter;
  verses: QuranVerse[];
  translation: { id: number; name: string };
}> {
  const chapters = await getQuranChapters();
  const chapter = chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new Error('Quran chapter not found.');

  const cacheKey = `chapter-${chapterId}-translation-${ENGLISH_TRANSLATION_ID}`;
  const cached = verseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL_MS) {
    return {
      chapter,
      verses: cached.data,
      translation: { id: ENGLISH_TRANSLATION_ID, name: ENGLISH_TRANSLATION_NAME },
    };
  }

  try {
    const firstPage = await fetchVersePage(chapterId, 1);
    const totalPages = Math.min(
      10,
      Math.max(1, Number(firstPage.pagination?.total_pages) || 1)
    );
    const remainingPages =
      totalPages > 1
        ? await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              fetchVersePage(chapterId, index + 2)
            )
          )
        : [];
    const verses = [firstPage, ...remainingPages]
      .flatMap((page) => page.verses ?? [])
      .map(normalizeVerse)
      .filter((verse): verse is QuranVerse => verse !== null)
      .sort((a, b) => a.verse_number - b.verse_number);

    if (verses.length !== chapter.verses_count) {
      throw new Error(
        `Quran API returned ${verses.length} verses for chapter ${chapterId}; expected ${chapter.verses_count}.`
      );
    }

    verseCache.set(cacheKey, { data: verses, timestamp: Date.now() });
    return {
      chapter,
      verses,
      translation: { id: ENGLISH_TRANSLATION_ID, name: ENGLISH_TRANSLATION_NAME },
    };
  } catch (error) {
    console.error(`[Quran API] Failed to fetch chapter ${chapterId}:`, error);
    if (cached?.data.length) {
      return {
        chapter,
        verses: cached.data,
        translation: { id: ENGLISH_TRANSLATION_ID, name: ENGLISH_TRANSLATION_NAME },
      };
    }
    throw error;
  }
}
