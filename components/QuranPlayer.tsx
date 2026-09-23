import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tokens } from '../theme/tokens';

interface QuranPlayerProps {
  verseKey: string;
  audioUrl?: string;
  reciterName?: string;
  eyebrow?: string;
  duration?: number;
  autoPlay?: boolean;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  onClose?: () => void;
  onError?: (error: string) => void;
  continuousCues?: readonly QuranPlaybackCue[];
  initialPositionMillis?: number;
  onActiveVerseChange?: (verseKey: string, index: number) => void;
}

export interface QuranPlaybackCue {
  verseKey: string;
  startMillis: number;
  endMillis: number;
}

export default function QuranPlayer({
  verseKey,
  audioUrl,
  reciterName = 'Quran recitation',
  eyebrow,
  duration = 0,
  autoPlay = false,
  canGoPrevious = false,
  canGoNext = false,
  onPrevious,
  onNext,
  onComplete,
  onClose,
  onError,
  continuousCues,
  initialPositionMillis = 0,
  onActiveVerseChange,
}: QuranPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeCueIndexRef = useRef(-1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(duration);
  const [error, setError] = useState<string | null>(null);
  const [activeCueIndex, setActiveCueIndex] = useState(-1);

  const reportError = useCallback(
    (value: unknown, fallback: string) => {
      const message = value instanceof Error ? value.message : fallback;
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const unloadAudio = useCallback(async () => {
    const currentSound = soundRef.current;
    soundRef.current = null;
    setIsLoaded(false);
    setIsPlaying(false);
    setHasFinished(false);
    if (currentSound) {
      try {
        await currentSound.unloadAsync();
      } catch {
        // The sound may already have been released by the native audio session.
      }
    }
  }, []);

  const handlePlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      setCurrentTime(status.positionMillis);
      setIsPlaying(status.isPlaying);
      if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
        setResolvedDuration(status.durationMillis);
      }
      if (continuousCues?.length) {
        let nextCueIndex = 0;
        for (let index = 1; index < continuousCues.length; index += 1) {
          if (status.positionMillis < continuousCues[index].startMillis) break;
          nextCueIndex = index;
        }
        if (nextCueIndex !== activeCueIndexRef.current) {
          activeCueIndexRef.current = nextCueIndex;
          setActiveCueIndex(nextCueIndex);
          onActiveVerseChange?.(continuousCues[nextCueIndex].verseKey, nextCueIndex);
        }
      }
      if (status.didJustFinish) {
        setCurrentTime(status.positionMillis);
        setIsPlaying(false);
        setHasFinished(true);
        onComplete?.();
      }
    },
    [continuousCues, onActiveVerseChange, onComplete]
  );

  const loadAudio = useCallback(
    async (shouldPlay: boolean) => {
      if (!audioUrl) {
        reportError(null, 'Audio is not available for this ayah.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setHasFinished(false);
      activeCueIndexRef.current = -1;
      setActiveCueIndex(-1);
      setCurrentTime(Math.max(0, initialPositionMillis));
      try {
        await unloadAudio();
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            shouldPlay,
            positionMillis: Math.max(0, initialPositionMillis),
            progressUpdateIntervalMillis: 250,
          },
          handlePlaybackStatus
        );
        soundRef.current = sound;
        setIsLoaded(true);
        setIsPlaying(shouldPlay);
      } catch (loadError) {
        reportError(loadError, 'Audio could not be played.');
      } finally {
        setIsLoading(false);
      }
    },
    [audioUrl, handlePlaybackStatus, initialPositionMillis, reportError, unloadAudio]
  );

  useEffect(() => {
    if (autoPlay && audioUrl) void loadAudio(true);
    return () => {
      void unloadAudio();
    };
  }, [audioUrl, autoPlay, loadAudio, unloadAudio]);

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current || !isLoaded) {
      await loadAudio(true);
      return;
    }

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else if (hasFinished) {
        setHasFinished(false);
        await soundRef.current.replayAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (playbackError) {
      reportError(playbackError, 'Playback could not be changed.');
    }
  }, [hasFinished, isLoaded, isPlaying, loadAudio, reportError]);

  const handleClose = useCallback(() => {
    void unloadAudio();
    onClose?.();
  }, [onClose, unloadAudio]);

  const hasContinuousNavigation = Boolean(continuousCues?.length);
  const canNavigatePrevious = hasContinuousNavigation
    ? activeCueIndex > 0 ||
      (continuousCues?.[0] ? currentTime > continuousCues[0].startMillis + 1000 : false)
    : canGoPrevious;
  const canNavigateNext = hasContinuousNavigation
    ? activeCueIndex >= 0 && activeCueIndex < (continuousCues?.length ?? 0) - 1
    : canGoNext;
  const showNavigation = hasContinuousNavigation || Boolean(onPrevious || onNext);

  const seekToCue = useCallback(
    async (direction: 'previous' | 'next') => {
      const sound = soundRef.current;
      if (!sound || !continuousCues?.length || activeCueIndexRef.current < 0) return;

      const currentCue = continuousCues[activeCueIndexRef.current];
      const shouldRestartCurrent =
        direction === 'previous' && currentTime - currentCue.startMillis > 3000;
      const nextIndex = shouldRestartCurrent
        ? activeCueIndexRef.current
        : direction === 'previous'
        ? Math.max(0, activeCueIndexRef.current - 1)
        : Math.min(continuousCues.length - 1, activeCueIndexRef.current + 1);

      try {
        setHasFinished(false);
        await sound.setPositionAsync(continuousCues[nextIndex].startMillis);
        if (hasFinished) await sound.playAsync();
      } catch (seekError) {
        reportError(seekError, 'Could not move to that ayah.');
      }
    },
    [continuousCues, currentTime, hasFinished, reportError]
  );

  const handlePrevious = useCallback(() => {
    if (hasContinuousNavigation) {
      void seekToCue('previous');
    } else {
      onPrevious?.();
    }
  }, [hasContinuousNavigation, onPrevious, seekToCue]);

  const handleNext = useCallback(() => {
    if (hasContinuousNavigation) {
      void seekToCue('next');
    } else {
      onNext?.();
    }
  }, [hasContinuousNavigation, onNext, seekToCue]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = (
    resolvedDuration > 0
      ? `${Math.min(100, Math.max(0, (currentTime / resolvedDuration) * 100))}%`
      : '0%'
  ) as `${number}%`;

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        {showNavigation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous ayah"
            accessibilityState={{ disabled: !canNavigatePrevious }}
            disabled={!canNavigatePrevious}
            onPress={handlePrevious}
            style={({ pressed }) => [
              styles.skipButton,
              !canNavigatePrevious && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="play-skip-back" size={19} color={tokens.color.text.secondary} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? `Pause ayah ${verseKey}` : `Play ayah ${verseKey}`}
          onPress={() => void togglePlayback()}
          disabled={isLoading}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.color.text.inverse} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={tokens.color.text.inverse}
            />
          )}
        </Pressable>

        <View style={styles.copy}>
          <Text style={styles.nowPlaying}>{eyebrow ?? `AYAH ${verseKey}`}</Text>
          <Text style={styles.reciterName} numberOfLines={1}>
            {reciterName}
          </Text>
        </View>

        {showNavigation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next ayah"
            accessibilityState={{ disabled: !canNavigateNext }}
            disabled={!canNavigateNext}
            onPress={handleNext}
            style={({ pressed }) => [
              styles.skipButton,
              !canNavigateNext && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="play-skip-forward" size={19} color={tokens.color.text.secondary} />
          </Pressable>
        ) : null}

        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Quran player"
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={tokens.color.text.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: progress }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.timeText}>
          {resolvedDuration > 0 ? formatTime(resolvedDuration) : '–:––'}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error} Tap play to try again.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  mainRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  playButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.text.accent,
  },
  copy: { flex: 1, minWidth: 0 },
  skipButton: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlaying: {
    color: tokens.color.text.accent,
    fontSize: 10,
    fontWeight: tokens.typography.weight.extrabold,
    letterSpacing: 0.8,
  },
  reciterName: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
    marginTop: 3,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 4,
    borderRadius: tokens.radius.pill,
    overflow: 'hidden',
    backgroundColor: tokens.color.border.muted,
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.text.accent,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  timeText: {
    color: tokens.color.text.muted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: tokens.color.status.danger,
    fontSize: tokens.typography.size.xs,
    marginTop: tokens.spacing.xs,
    marginBottom: 2,
  },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.7 },
});
