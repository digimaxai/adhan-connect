import { fetchPublicApiJson } from './publicApiClient';

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

export interface QuranVerseAudio {
  verse_key: string;
  verse_number: number;
  chapter_number: number;
  audio_url: string;
  duration: number;
  reciter_name: string | null;
  recitation_style: string | null;
}

export interface QuranSurahAudio {
  chapter_number: number;
  reciter_id: number;
  reciter_name: string | null;
  recitation_style: string | null;
  playback_mode: 'continuous' | 'verse_queue';
  continuous_audio_url: string | null;
  duration: number;
  timestamps: QuranSurahAudioTimestamp[];
  tracks: QuranVerseAudio[];
}

export interface QuranSurahAudioTimestamp {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
}

export interface QuranChapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name: string;
  revelation_place: string;
  verses_count: number;
}

export interface QuranVerse {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  translation: string;
}

export interface QuranChapterContent {
  chapter: QuranChapter;
  verses: QuranVerse[];
  translation: {
    id: number;
    name: string;
  };
}

export async function fetchQuranReciters(): Promise<QuranReciter[]> {
  const data = await fetchPublicApiJson<{ reciters: QuranReciter[] }>(
    '/api/quran/reciters',
    'Quran reciters'
  );
  return Array.isArray(data.reciters) ? data.reciters : [];
}

export async function fetchQuranChapters(): Promise<QuranChapter[]> {
  const data = await fetchPublicApiJson<{ chapters: QuranChapter[] }>(
    '/api/quran/chapters',
    'Quran chapters'
  );
  return Array.isArray(data.chapters) ? data.chapters : [];
}

export async function fetchQuranChapter(chapterId: number): Promise<QuranChapterContent> {
  return fetchPublicApiJson<QuranChapterContent>(
    `/api/quran/chapter?chapterId=${chapterId}`,
    'Quran chapter',
    15000
  );
}

export async function fetchQuranVerseAudio(
  verseKey: string,
  reciterId: number
): Promise<QuranVerseAudio> {
  const params = new URLSearchParams({
    verseKey,
    reciterId: String(reciterId),
  });
  const data = await fetchPublicApiJson<{ audio: QuranVerseAudio }>(
    `/api/quran/verse-audio?${params.toString()}`,
    'Quran audio'
  );
  return data.audio;
}

export async function fetchQuranSurahAudio(
  chapterId: number,
  reciterId: number
): Promise<QuranSurahAudio> {
  const params = new URLSearchParams({
    chapterId: String(chapterId),
    reciterId: String(reciterId),
  });
  const data = await fetchPublicApiJson<{ audio: QuranSurahAudio }>(
    `/api/quran/surah-audio?${params.toString()}`,
    'Full-surah audio',
    15000
  );
  return data.audio;
}
