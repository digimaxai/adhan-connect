import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Slider,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import { tokens } from '../theme/tokens';

interface QuranPlayerProps {
  verseKey: string;
  verseText: string;
  audioUrl?: string;
  reciterName?: string;
  duration?: number;
  onError?: (error: string) => void;
}

export default function QuranPlayer({
  verseKey,
  verseText,
  audioUrl,
  reciterName = 'Abdul Basit',
  duration = 0,
  onError,
}: QuranPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const loadAudio = async () => {
    if (!audioUrl) {
      setError('Audio not available');
      onError?.('Audio URL not found');
      return;
    }

    setIsLoading(true);
    try {
      // Release previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false, progressUpdateIntervalMillis: 500 }
      );

      // Subscribe to playback status updates
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentTime(status.positionMillis);
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      });

      setSound(newSound);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audio';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) {
      await loadAudio();
      return;
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playback error';
      setError(message);
      onError?.(message);
    }
  };

  const handleSliderChange = async (value: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(value);
      setCurrentTime(value);
    } catch (err) {
      console.error('Seek error:', err);
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Verse Info */}
      <View style={styles.verseInfo}>
        <Text style={styles.verseKey}>{verseKey}</Text>
        <Text style={styles.verseText}>{verseText}</Text>
        <Text style={styles.reciterName}>Reciter: {reciterName}</Text>
      </View>

      {/* Player Controls */}
      <View style={styles.playerCard}>
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Play Button */}
        <Pressable
          style={styles.playButton}
          onPress={togglePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.color.primary} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={60}
              color={tokens.color.primary}
            />
          )}
        </Pressable>

        {/* Progress Bar */}
        {sound && (
          <View style={styles.progressContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration || 1}
              value={currentTime}
              onSlidingComplete={handleSliderChange}
              minimumTrackTintColor={tokens.color.primary}
              maximumTrackTintColor={tokens.color.border.light}
              thumbTintColor={tokens.color.primary}
            />
            <View style={styles.timeDisplay}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        )}

        {/* Additional Controls */}
        <View style={styles.controls}>
          <Pressable style={styles.controlButton}>
            <Ionicons
              name="share-social-outline"
              size={24}
              color={tokens.color.text.muted}
            />
            <Text style={styles.controlLabel}>Share</Text>
          </Pressable>

          <Pressable style={styles.controlButton}>
            <Ionicons
              name="bookmark-outline"
              size={24}
              color={tokens.color.text.muted}
            />
            <Text style={styles.controlLabel}>Save</Text>
          </Pressable>

          <Pressable style={styles.controlButton}>
            <Ionicons
              name="repeat-outline"
              size={24}
              color={tokens.color.text.muted}
            />
            <Text style={styles.controlLabel}>Repeat</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.bg.page,
  },
  verseInfo: {
    marginBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  verseKey: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.primary,
    marginBottom: tokens.spacing.xs,
  },
  verseText: {
    fontSize: tokens.typography.size.md,
    fontWeight: '500',
    color: tokens.color.text.primary,
    lineHeight: 24,
    marginBottom: tokens.spacing.sm,
  },
  reciterName: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
  },
  playerCard: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
  },
  error: {
    color: tokens.color.error,
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.md,
    textAlign: 'center',
  },
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.spacing.md,
  },
  progressContainer: {
    marginVertical: tokens.spacing.md,
  },
  slider: {
    height: 40,
    width: '100%',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  timeText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border.light,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginTop: tokens.spacing.xs,
  },
});
