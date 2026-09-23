import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useSegments } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuranPlayer from '../../components/QuranPlayer';
import {
  fetchQuranChapter,
  fetchQuranChapters,
  fetchQuranSurahAudio,
  fetchQuranVerseAudio,
  QuranChapter,
  QuranChapterContent,
  QuranSurahAudio,
  QuranVerse,
  QuranVerseAudio,
} from '../../lib/api/quranClient';
import {
  QuranReciter,
  useQuranReciters,
} from '../../lib/hooks/useQuranReciters';
import { tokens } from '../../theme/tokens';

const DEFAULT_CHAPTER_ID = 1;
const DEFAULT_RECITER_ID = 2;
type PlaybackMode = 'verse' | 'surah';

export default function QuranScreen() {
  const router = useRouter();
  const segments = useSegments();
  const isInsideGuidance = segments.some((segment) => segment === 'guidance');
  const {
    reciters,
    loading: loadingReciters,
    error: reciterError,
    refetch: refetchReciters,
  } = useQuranReciters();
  const [chapters, setChapters] = useState<QuranChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState(DEFAULT_CHAPTER_ID);
  const [selectedReciterId, setSelectedReciterId] = useState(DEFAULT_RECITER_ID);
  const [chapterContent, setChapterContent] = useState<QuranChapterContent | null>(null);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState(true);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [chapterReloadKey, setChapterReloadKey] = useState(0);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false);
  const [chapterQuery, setChapterQuery] = useState('');
  const [activeVerse, setActiveVerse] = useState<QuranVerse | null>(null);
  const [verseAudio, setVerseAudio] = useState<QuranVerseAudio | null>(null);
  const [surahAudio, setSurahAudio] = useState<QuranSurahAudio | null>(null);
  const [surahInitialPosition, setSurahInitialPosition] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('verse');
  const [loadingVerseKey, setLoadingVerseKey] = useState<string | null>(null);
  const [loadingSurahAudio, setLoadingSurahAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRequestId = useRef(0);

  const selectedChapter = useMemo(
    () =>
      chapterContent?.chapter ??
      chapters.find((chapter) => chapter.id === selectedChapterId) ??
      null,
    [chapterContent?.chapter, chapters, selectedChapterId]
  );
  const selectedReciter = useMemo(
    () =>
      reciters.find((reciter) => reciter.id === selectedReciterId) ??
      reciters[0] ??
      null,
    [reciters, selectedReciterId]
  );
  const filteredChapters = useMemo(() => {
    const query = chapterQuery.trim().toLocaleLowerCase();
    if (!query) return chapters;
    return chapters.filter((chapter) =>
      [
        String(chapter.id),
        chapter.name_simple,
        chapter.name_arabic,
        chapter.translated_name,
      ].some((value) => value.toLocaleLowerCase().includes(query))
    );
  }, [chapterQuery, chapters]);

  useEffect(() => {
    let active = true;
    setLoadingChapters(true);
    setChaptersError(null);

    void fetchQuranChapters()
      .then((items) => {
        if (active) setChapters(items);
      })
      .catch((error) => {
        if (active) {
          console.warn('[quran] chapters unavailable', error);
          setChaptersError(
            'We could not reach the Qur’an library. Check your connection and try again.'
          );
        }
      })
      .finally(() => {
        if (active) setLoadingChapters(false);
      });

    return () => {
      active = false;
    };
  }, [chapterReloadKey]);

  useEffect(() => {
    let active = true;
    setLoadingChapter(true);
    setChapterError(null);
    setChapterContent(null);
    setActiveVerse(null);
    setVerseAudio(null);
    setSurahAudio(null);
    setSurahInitialPosition(0);
    setPlaybackMode('verse');
    setLoadingSurahAudio(false);
    setAudioError(null);
    audioRequestId.current += 1;

    void fetchQuranChapter(selectedChapterId)
      .then((content) => {
        if (active) setChapterContent(content);
      })
      .catch((error) => {
        if (active) {
          console.warn('[quran] chapter unavailable', error);
          setChapterError(
            'We could not reach the Qur’an library. Check your connection and try again.'
          );
        }
      })
      .finally(() => {
        if (active) setLoadingChapter(false);
      });

    return () => {
      active = false;
    };
  }, [chapterReloadKey, selectedChapterId]);

  useEffect(() => {
    if (reciters.length && !reciters.some((item) => item.id === selectedReciterId)) {
      setSelectedReciterId(reciters[0].id);
    }
  }, [reciters, selectedReciterId]);

  const loadVerseAudio = useCallback(async (verse: QuranVerse, reciterId: number) => {
    const requestId = audioRequestId.current + 1;
    audioRequestId.current = requestId;
    setActiveVerse(verse);
    setVerseAudio(null);
    setSurahAudio(null);
    setSurahInitialPosition(0);
    setPlaybackMode('verse');
    setLoadingSurahAudio(false);
    setAudioError(null);
    setLoadingVerseKey(verse.verse_key);

    try {
      const audio = await fetchQuranVerseAudio(verse.verse_key, reciterId);
      if (audioRequestId.current === requestId) setVerseAudio(audio);
    } catch (error) {
      if (audioRequestId.current === requestId) {
        setAudioError(
          error instanceof Error ? error.message : 'Audio is unavailable for this verse.'
        );
      }
    } finally {
      if (audioRequestId.current === requestId) setLoadingVerseKey(null);
    }
  }, []);

  const loadSurahAudio = useCallback(
    async (reciterId: number, startVerseKey?: string) => {
      if (!chapterContent?.verses.length) return;

      const requestId = audioRequestId.current + 1;
      audioRequestId.current = requestId;
      const requestedVerse =
        chapterContent.verses.find((verse) => verse.verse_key === startVerseKey) ??
        chapterContent.verses[0];

      setPlaybackMode('surah');
      setSurahAudio(null);
      setSurahInitialPosition(0);
      setActiveVerse(requestedVerse);
      setVerseAudio(null);
      setAudioError(null);
      setLoadingVerseKey(null);
      setLoadingSurahAudio(true);

      try {
        const audio = await fetchQuranSurahAudio(chapterContent.chapter.id, reciterId);
        if (audioRequestId.current !== requestId) return;

        const track =
          audio.tracks.find((item) => item.verse_key === requestedVerse.verse_key) ??
          audio.tracks[0];
        const verse =
          chapterContent.verses.find((item) => item.verse_key === track?.verse_key) ??
          requestedVerse;

        if (!track) throw new Error('This reciter has no audio for the selected surah.');
        const timestamp = audio.timestamps.find(
          (item) => item.verse_key === verse.verse_key
        );
        setSurahAudio(audio);
        setSurahInitialPosition(timestamp?.timestamp_from ?? 0);
        setActiveVerse(verse);
        setVerseAudio(track);
      } catch (error) {
        if (audioRequestId.current === requestId) {
          setAudioError(
            error instanceof Error ? error.message : 'Full-surah audio is unavailable.'
          );
        }
      } finally {
        if (audioRequestId.current === requestId) setLoadingSurahAudio(false);
      }
    },
    [chapterContent]
  );

  const handlePlayVerse = useCallback(
    (verse: QuranVerse) => {
      if (!selectedReciter) {
        setReciterPickerOpen(true);
        return;
      }
      void loadVerseAudio(verse, selectedReciter.id);
    },
    [loadVerseAudio, selectedReciter]
  );

  const handlePlaySurah = useCallback(() => {
    if (!selectedReciter) {
      setReciterPickerOpen(true);
      return;
    }
    void loadSurahAudio(selectedReciter.id);
  }, [loadSurahAudio, selectedReciter]);

  const handleSelectChapter = useCallback((chapter: QuranChapter) => {
    setSelectedChapterId(chapter.id);
    setChapterQuery('');
    setChapterPickerOpen(false);
  }, []);

  const handleSelectReciter = useCallback(
    (reciter: QuranReciter) => {
      setSelectedReciterId(reciter.id);
      setReciterPickerOpen(false);
      if (activeVerse && playbackMode === 'surah') {
        void loadSurahAudio(reciter.id, activeVerse.verse_key);
      } else if (activeVerse) {
        void loadVerseAudio(activeVerse, reciter.id);
      }
    },
    [activeVerse, loadSurahAudio, loadVerseAudio, playbackMode]
  );

  const activeTrackIndex = useMemo(() => {
    if (!surahAudio || !activeVerse) return -1;
    return surahAudio.tracks.findIndex(
      (track) => track.verse_key === activeVerse.verse_key
    );
  }, [activeVerse, surahAudio]);

  const playSurahTrack = useCallback(
    (index: number) => {
      const track = surahAudio?.tracks[index];
      if (!track || !chapterContent) return;
      const verse = chapterContent.verses.find(
        (item) => item.verse_key === track.verse_key
      );
      if (!verse) return;
      setActiveVerse(verse);
      setVerseAudio(track);
      setAudioError(null);
    },
    [chapterContent, surahAudio]
  );

  const handleTrackComplete = useCallback(() => {
    if (!surahAudio || activeTrackIndex < 0) return;
    if (activeTrackIndex < surahAudio.tracks.length - 1) {
      playSurahTrack(activeTrackIndex + 1);
    }
  }, [activeTrackIndex, playSurahTrack, surahAudio]);

  const continuousCues = useMemo(
    () =>
      surahAudio?.playback_mode === 'continuous'
        ? surahAudio.timestamps.map((timestamp) => ({
            verseKey: timestamp.verse_key,
            startMillis: timestamp.timestamp_from,
            endMillis: timestamp.timestamp_to,
          }))
        : undefined,
    [surahAudio]
  );

  const handleActiveSurahVerseChange = useCallback(
    (verseKey: string) => {
      const verse = chapterContent?.verses.find((item) => item.verse_key === verseKey);
      if (verse) setActiveVerse(verse);
    },
    [chapterContent]
  );

  const closePlayer = useCallback(() => {
    audioRequestId.current += 1;
    setActiveVerse(null);
    setVerseAudio(null);
    setSurahAudio(null);
    setSurahInitialPosition(0);
    setPlaybackMode('verse');
    setLoadingVerseKey(null);
    setLoadingSurahAudio(false);
    setAudioError(null);
  }, []);

  const renderVerse = useCallback(
    ({ item }: { item: QuranVerse }) => {
      const isActive = activeVerse?.verse_key === item.verse_key;
      const isLoading = loadingVerseKey === item.verse_key;
      return (
        <View style={[styles.verseCard, isActive && styles.verseCardActive]}>
          <View style={styles.verseMetaRow}>
            <View style={[styles.ayahBadge, isActive && styles.ayahBadgeActive]}>
              <Text style={[styles.ayahNumber, isActive && styles.ayahNumberActive]}>
                {item.verse_number}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play verse ${item.verse_key}`}
              onPress={() => handlePlayVerse(item)}
              style={({ pressed }) => [
                styles.versePlayButton,
                isActive && styles.versePlayButtonActive,
                pressed && styles.pressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={tokens.color.text.accent} />
              ) : (
                <Ionicons
                  name={isActive ? 'volume-high' : 'play'}
                  size={18}
                  color={isActive ? tokens.color.text.inverse : tokens.color.text.accent}
                />
              )}
              <Text
                style={[
                  styles.versePlayLabel,
                  isActive && styles.versePlayLabelActive,
                ]}
              >
                {isLoading ? 'Loading' : isActive ? 'Selected' : 'Listen'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.arabicPanel}>
            <Text style={styles.arabicVerse}>{item.text_uthmani}</Text>
          </View>
          {item.translation ? (
            <Text style={styles.translationText}>{item.translation}</Text>
          ) : null}
        </View>
      );
    },
    [activeVerse?.verse_key, handlePlayVerse, loadingVerseKey]
  );

  const listHeader = (
    <View>
      {isInsideGuidance ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Guidance"
          onPress={() => router.replace('/(user)/guidance' as any)}
          hitSlop={10}
          style={({ pressed }) => [styles.guidanceBack, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={19} color={tokens.color.reading.accent} />
          <Text style={styles.guidanceBackText}>Guidance</Text>
        </Pressable>
      ) : null}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Qur’an</Text>
        <Text style={styles.pageSubtitle}>Play a full surah, or listen to any ayah.</Text>
      </View>

      <View style={styles.selectorRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a surah"
          onPress={() => setChapterPickerOpen(true)}
          style={({ pressed }) => [styles.selectorCard, pressed && styles.pressed]}
        >
          <View style={styles.selectorIcon}>
            <Ionicons name="book-outline" size={20} color={tokens.color.text.accent} />
          </View>
          <View style={styles.selectorText}>
            <Text style={styles.selectorLabel}>Surah</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {selectedChapter
                ? `${selectedChapter.id}. ${selectedChapter.name_simple}`
                : loadingChapters
                ? 'Loading…'
                : 'Choose surah'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={tokens.color.text.muted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a reciter"
          onPress={() => setReciterPickerOpen(true)}
          style={({ pressed }) => [styles.selectorCard, pressed && styles.pressed]}
        >
          <View style={styles.selectorIcon}>
            <Ionicons name="mic-outline" size={20} color={tokens.color.text.accent} />
          </View>
          <View style={styles.selectorText}>
            <Text style={styles.selectorLabel}>Reciter</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {selectedReciter?.display_name ??
                (loadingReciters ? 'Loading…' : 'Choose reciter')}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={tokens.color.text.muted} />
        </Pressable>
      </View>

      {selectedChapter ? (
        <View style={styles.chapterHeader}>
          <View style={styles.chapterIdentity}>
            <Text style={styles.chapterArabic}>{selectedChapter.name_arabic}</Text>
            <Text style={styles.chapterName}>{selectedChapter.name_simple}</Text>
            <Text style={styles.chapterMeaning}>{selectedChapter.translated_name}</Text>
            <Text style={styles.chapterMeta}>
              {selectedChapter.verses_count} ayahs ·{' '}
              {selectedChapter.revelation_place === 'makkah' ? 'Makki' : 'Madani'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play the full surah ${selectedChapter.name_simple}`}
            accessibilityHint="Plays the surah as one continuous recitation"
            disabled={loadingChapter || loadingSurahAudio || !chapterContent}
            onPress={handlePlaySurah}
            style={({ pressed }) => [
              styles.fullSurahButton,
              (loadingChapter || loadingSurahAudio || !chapterContent) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.fullSurahIcon}>
              {loadingSurahAudio ? (
                <ActivityIndicator color={tokens.color.reading.accent} />
              ) : (
                <Ionicons name="play" size={22} color={tokens.color.reading.accent} />
              )}
            </View>
            <View style={styles.fullSurahCopy}>
              <Text style={styles.fullSurahTitle}>
                {loadingSurahAudio
                  ? 'Preparing full surah…'
                  : playbackMode === 'surah'
                  ? 'Restart full surah'
                  : 'Play full surah'}
              </Text>
              <Text style={styles.fullSurahSubtitle} numberOfLines={1}>
                All {selectedChapter.verses_count} ayahs ·{' '}
                {selectedReciter?.display_name ?? 'Choose a reciter'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.color.reading.muted} />
          </Pressable>
        </View>
      ) : null}

      {chapterContent ? (
        <Text style={styles.translationCredit}>
          English translation: {chapterContent.translation.name}
        </Text>
      ) : null}
    </View>
  );

  const emptyState = loadingChapter ? (
    <View style={styles.stateCard}>
      <ActivityIndicator color={tokens.color.text.accent} size="large" />
      <Text style={styles.stateTitle}>Opening the surah…</Text>
      <Text style={styles.stateBody}>Arabic text and translation will appear together.</Text>
    </View>
  ) : chapterError ? (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name="refresh-outline" size={22} color={tokens.color.text.accent} />
      </View>
      <Text style={styles.stateTitle}>Qur’an is not available just now</Text>
      <Text style={styles.stateBody}>{chapterError}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setChapterReloadKey((value) => value + 1)}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Try again</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={chapterContent?.verses ?? []}
        keyExtractor={(item) => item.verse_key}
        renderItem={renderVerse}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        contentContainerStyle={[
          styles.content,
          activeVerse ? styles.contentWithPlayer : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {activeVerse ? (
        <View style={styles.playerDock}>
          {loadingVerseKey || loadingSurahAudio ? (
            <View style={styles.playerLoading}>
              <ActivityIndicator color={tokens.color.text.accent} />
              <View style={styles.playerLoadingCopy}>
                <Text style={styles.playerLoadingTitle}>
                  {loadingSurahAudio
                    ? `Preparing ${selectedChapter?.name_simple ?? 'full surah'}`
                    : `Preparing ayah ${activeVerse.verse_key}`}
                </Text>
                <Text style={styles.playerLoadingBody}>{selectedReciter?.display_name}</Text>
              </View>
              <Pressable accessibilityLabel="Close player" onPress={closePlayer} hitSlop={12}>
                <Ionicons name="close" size={24} color={tokens.color.text.muted} />
              </Pressable>
            </View>
          ) : audioError ? (
            <View style={styles.playerError}>
              <View style={styles.playerLoadingCopy}>
                <Text style={styles.playerLoadingTitle}>Audio did not load</Text>
                <Text style={styles.playerLoadingBody}>{audioError}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (!selectedReciter) return;
                  if (playbackMode === 'surah') {
                    void loadSurahAudio(selectedReciter.id, activeVerse.verse_key);
                  } else {
                    void loadVerseAudio(activeVerse, selectedReciter.id);
                  }
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
              <Pressable accessibilityLabel="Close player" onPress={closePlayer} hitSlop={12}>
                <Ionicons name="close" size={24} color={tokens.color.text.muted} />
              </Pressable>
            </View>
          ) : verseAudio ? (
            <QuranPlayer
              key={
                surahAudio?.playback_mode === 'continuous'
                  ? `surah-${selectedChapter?.id ?? 0}-${selectedReciter?.id ?? 0}`
                  : `${verseAudio.verse_key}-${selectedReciter?.id ?? 0}`
              }
              verseKey={activeVerse.verse_key}
              audioUrl={surahAudio?.continuous_audio_url ?? verseAudio.audio_url}
              reciterName={selectedReciter?.display_name}
              eyebrow={
                playbackMode === 'surah' && activeTrackIndex >= 0
                  ? `${selectedChapter?.name_simple ?? 'Full surah'} · Ayah ${
                      activeTrackIndex + 1
                    } of ${surahAudio?.tracks.length ?? 0}`
                  : undefined
              }
              duration={
                surahAudio?.playback_mode === 'continuous'
                  ? surahAudio.duration
                  : verseAudio.duration
              }
              autoPlay
              continuousCues={continuousCues}
              initialPositionMillis={surahInitialPosition}
              onActiveVerseChange={handleActiveSurahVerseChange}
              canGoPrevious={
                playbackMode === 'surah' &&
                surahAudio?.playback_mode === 'verse_queue' &&
                activeTrackIndex > 0
              }
              canGoNext={
                playbackMode === 'surah' &&
                surahAudio?.playback_mode === 'verse_queue' &&
                activeTrackIndex >= 0 &&
                activeTrackIndex < (surahAudio?.tracks.length ?? 0) - 1
              }
              onPrevious={
                playbackMode === 'surah' && surahAudio?.playback_mode === 'verse_queue'
                  ? () => playSurahTrack(activeTrackIndex - 1)
                  : undefined
              }
              onNext={
                playbackMode === 'surah' && surahAudio?.playback_mode === 'verse_queue'
                  ? () => playSurahTrack(activeTrackIndex + 1)
                  : undefined
              }
              onComplete={
                playbackMode === 'surah' && surahAudio?.playback_mode === 'verse_queue'
                  ? handleTrackComplete
                  : undefined
              }
              onClose={closePlayer}
            />
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={chapterPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChapterPickerOpen(false)}
      >
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Choose a surah</Text>
              <Text style={styles.modalSubtitle}>Search by name, Arabic, or number</Text>
            </View>
            <Pressable
              accessibilityLabel="Close surah picker"
              onPress={() => setChapterPickerOpen(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={tokens.color.text.primary} />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={tokens.color.text.muted} />
            <TextInput
              value={chapterQuery}
              onChangeText={setChapterQuery}
              placeholder="Search 114 surahs"
              placeholderTextColor={tokens.color.text.muted}
              autoCorrect={false}
              style={styles.searchInput}
            />
            {chapterQuery ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setChapterQuery('')}>
                <Ionicons name="close-circle" size={20} color={tokens.color.text.muted} />
              </Pressable>
            ) : null}
          </View>
          {loadingChapters ? (
            <View style={styles.modalState}>
              <ActivityIndicator color={tokens.color.text.accent} />
            </View>
          ) : chaptersError && !chapters.length ? (
            <View style={styles.modalState}>
              <View style={styles.stateIcon}>
                <Ionicons name="refresh-outline" size={22} color={tokens.color.text.accent} />
              </View>
              <Text style={styles.stateTitle}>Surahs are not available just now</Text>
              <Text style={styles.stateBody}>{chaptersError}</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setChapterReloadKey((value) => value + 1)}
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredChapters}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const selected = item.id === selectedChapterId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleSelectChapter(item)}
                    style={({ pressed }) => [
                      styles.chapterPickerItem,
                      selected && styles.pickerItemSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.chapterNumberBadge, selected && styles.ayahBadgeActive]}>
                      <Text style={[styles.chapterNumberText, selected && styles.ayahNumberActive]}>
                        {item.id}
                      </Text>
                    </View>
                    <View style={styles.chapterPickerCopy}>
                      <Text style={styles.chapterPickerName}>{item.name_simple}</Text>
                      <Text style={styles.chapterPickerMeta}>
                        {item.translated_name} · {item.verses_count} ayahs
                      </Text>
                    </View>
                    <Text style={styles.chapterPickerArabic}>{item.name_arabic}</Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={tokens.color.text.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalState}>
                  <Text style={styles.stateTitle}>No surahs found</Text>
                  <Text style={styles.stateBody}>Try a different spelling or surah number.</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={reciterPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReciterPickerOpen(false)}
      >
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Choose a reciter</Text>
              <Text style={styles.modalSubtitle}>Used for every ayah you play</Text>
            </View>
            <Pressable
              accessibilityLabel="Close reciter picker"
              onPress={() => setReciterPickerOpen(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={tokens.color.text.primary} />
            </Pressable>
          </View>
          {loadingReciters ? (
            <View style={styles.modalState}>
              <ActivityIndicator color={tokens.color.text.accent} />
            </View>
          ) : reciterError ? (
            <View style={styles.modalState}>
              <Text style={styles.stateTitle}>Reciters are not available just now</Text>
              <Text style={styles.stateBody}>Check your connection and try again.</Text>
              <Pressable style={styles.primaryButton} onPress={() => void refetchReciters()}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={reciters}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const selected = item.id === selectedReciter?.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleSelectReciter(item)}
                    style={({ pressed }) => [
                      styles.reciterPickerItem,
                      selected && styles.pickerItemSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.reciterAvatar}>
                      <Ionicons name="mic" size={19} color={tokens.color.text.accent} />
                    </View>
                    <View style={styles.chapterPickerCopy}>
                      <Text style={styles.chapterPickerName}>{item.display_name}</Text>
                      <Text style={styles.chapterPickerMeta}>{item.style ?? 'Recitation'}</Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={tokens.color.text.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  content: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 120,
  },
  contentWithPlayer: { paddingBottom: 230 },
  pageHeader: { marginBottom: tokens.spacing.lg },
  guidanceBack: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: tokens.spacing.sm,
    paddingRight: tokens.spacing.sm,
  },
  guidanceBackText: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  pageTitle: {
    color: tokens.color.text.primary,
    fontSize: 28,
    fontWeight: tokens.typography.weight.extrabold,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: tokens.color.text.secondary,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    marginTop: tokens.spacing.xs,
  },
  selectorRow: { gap: tokens.spacing.sm, marginBottom: tokens.spacing.lg },
  selectorCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.color.bg.surface,
    borderColor: tokens.color.border.muted,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
  },
  selectorIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bg.tintSoft,
    marginRight: tokens.spacing.sm,
  },
  selectorText: { flex: 1, minWidth: 0 },
  selectorLabel: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  selectorValue: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    marginTop: 2,
  },
  chapterHeader: {
    backgroundColor: tokens.color.reading.surface,
    borderColor: tokens.color.reading.border,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  chapterIdentity: {
    alignItems: 'flex-end',
  },
  chapterName: {
    color: tokens.color.reading.text,
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.extrabold,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  chapterMeaning: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.sm,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  chapterMeta: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.xs,
    marginTop: tokens.spacing.sm,
    textAlign: 'right',
    writingDirection: 'ltr',
    textTransform: 'uppercase',
  },
  chapterArabic: {
    color: tokens.color.reading.accent,
    fontFamily: tokens.typography.reading.arabicFontFamily,
    fontSize: 28,
    lineHeight: 44,
    marginBottom: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fullSurahButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.color.bg.surface,
    borderColor: tokens.color.reading.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    marginTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  fullSurahIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.reading.iconBg,
  },
  fullSurahCopy: { flex: 1, minWidth: 0 },
  fullSurahTitle: {
    color: tokens.color.reading.text,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.extrabold,
  },
  fullSurahSubtitle: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.xs,
    marginTop: 3,
  },
  translationCredit: {
    color: tokens.color.text.muted,
    fontSize: 11,
    marginBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xs,
  },
  verseCard: {
    backgroundColor: tokens.color.bg.surface,
    borderColor: tokens.color.border.muted,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    marginBottom: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  verseCardActive: {
    borderColor: tokens.color.text.accent,
    borderWidth: 2,
    backgroundColor: '#F7FCFF',
  },
  arabicPanel: {
    backgroundColor: tokens.color.reading.arabicSurface,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  verseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  ayahBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.subtle,
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
  },
  ayahBadgeActive: {
    backgroundColor: tokens.color.text.accent,
    borderColor: tokens.color.text.accent,
  },
  ayahNumber: {
    color: tokens.color.text.secondary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  ayahNumberActive: { color: tokens.color.text.inverse },
  versePlayButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.tintSoft,
  },
  versePlayButtonActive: { backgroundColor: tokens.color.text.accent },
  versePlayLabel: {
    color: tokens.color.text.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  versePlayLabelActive: { color: tokens.color.text.inverse },
  arabicVerse: {
    color: '#172033',
    fontFamily: tokens.typography.reading.arabicFontFamily,
    fontSize: tokens.typography.reading.arabicSize,
    lineHeight: tokens.typography.reading.arabicLineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  translationText: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.reading.translationSize,
    lineHeight: tokens.typography.reading.translationLineHeight,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: tokens.color.bg.surface,
    borderColor: tokens.color.border.muted,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.xl,
  },
  stateIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.tintSoft,
  },
  stateTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    textAlign: 'center',
  },
  stateBody: {
    color: tokens.color.text.secondary,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.text.accent,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
  },
  primaryButtonText: {
    color: tokens.color.text.inverse,
    fontWeight: tokens.typography.weight.bold,
  },
  playerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.bg.surface,
    borderTopColor: tokens.color.border.muted,
    borderTopWidth: 1,
    padding: tokens.spacing.sm,
    ...tokens.shadow.card,
  },
  playerLoading: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
  },
  playerError: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  playerLoadingCopy: { flex: 1 },
  playerLoadingTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  playerLoadingBody: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.size.xs,
    marginTop: 3,
  },
  retryButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.tintSoft,
  },
  retryButtonText: {
    color: tokens.color.text.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  modalScreen: { flex: 1, backgroundColor: tokens.color.bg.app },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
  },
  modalTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.extrabold,
  },
  modalSubtitle: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.size.xs,
    marginTop: 3,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
  },
  searchBox: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bg.surface,
    borderColor: tokens.color.border.muted,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.md,
    paddingVertical: tokens.spacing.sm,
  },
  modalList: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  modalState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
  },
  chapterPickerItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderBottomColor: tokens.color.border.subtle,
    borderBottomWidth: 1,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  reciterPickerItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderBottomColor: tokens.color.border.subtle,
    borderBottomWidth: 1,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  pickerItemSelected: {
    backgroundColor: '#F0F9FF',
    borderRadius: tokens.radius.md,
    borderBottomColor: 'transparent',
  },
  chapterNumberBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
  },
  chapterNumberText: {
    color: tokens.color.text.secondary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  chapterPickerCopy: { flex: 1, minWidth: 0 },
  chapterPickerName: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
  },
  chapterPickerMeta: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.size.xs,
    marginTop: 4,
  },
  chapterPickerArabic: {
    color: tokens.color.text.primary,
    fontFamily: tokens.typography.reading.arabicFontFamily,
    fontSize: 19,
    lineHeight: 30,
    marginHorizontal: tokens.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  reciterAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.tintSoft,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
