// lib/AudioPlayer.tsx
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  url: string;
  mosqueName?: string;
  isActive?: boolean;
  onRequestPlay?: () => void;
};

export default function AudioPlayer({ url, mosqueName, isActive, onRequestPlay }: Props) {
  const sound = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

  async function ensureLoaded() {
    if (!sound.current) {
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: url });
      await newSound.setVolumeAsync(volume);
      sound.current = newSound;
    }
  }

  async function togglePlay() {
    try {
      await ensureLoaded();
      if (isPlaying) {
        await sound.current!.pauseAsync();
        setIsPlaying(false);
      } else {
        onRequestPlay?.();
        await sound.current!.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('Audio error', err);
    }
  }

  async function changeVolume(v: number) {
    setVolume(v);
    if (sound.current) await sound.current.setVolumeAsync(v);
  }

  useEffect(() => {
    if (isActive === undefined) return;
    if (!isActive && isPlaying && sound.current) {
      sound.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    return () => { if (sound.current) sound.current.unloadAsync(); };
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{mosqueName ?? 'Stream'}</Text>
        <Pressable
          onPress={togglePlay}
          style={[styles.pillBtn, isPlaying ? styles.pillPause : styles.pillPlay]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause stream' : 'Play stream'}
        >
          <Text style={styles.pillText}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </Pressable>
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.volLabel}>Vol</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          value={volume}
          onValueChange={changeVolume}
        />
        <Text style={styles.volPct}>{Math.round(volume * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  pillPlay: { backgroundColor: '#0E9F6E' },
  pillPause: { backgroundColor: '#475569' },
  pillText: { color: '#fff', fontWeight: '700' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  volLabel: { color: '#64748B', width: 32, textAlign: 'left', marginRight: 8 },
  slider: { flex: 1, height: 36 },
  volPct: { width: 46, textAlign: 'right', color: '#334155', marginLeft: 8 },
});
