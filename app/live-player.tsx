// app/live-player.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LivePlayer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; city?: string; country?: string }>();
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(70);

  const mosqueName = params.name || 'Mosque';
  const location = [params.city, params.country].filter(Boolean).join(', ');

  const changeVolume = (delta: number) => {
    setVolume((v) => Math.min(100, Math.max(0, v + delta)));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>{'<'}</Text>
          </Pressable>
          <Text style={styles.title}>Live Adhan</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.headerRow}>
            <Text style={styles.mosque} numberOfLines={1}>
              {mosqueName}
            </Text>
            {location ? (
              <Text style={styles.subtle} numberOfLines={1}>
                {location}
              </Text>
            ) : null}
          </View>
          <View style={styles.liveRow}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>🔴 LIVE</Text>
            </View>
          </View>

          <View style={styles.playerArea}>
            <Pressable onPress={() => setPlaying((p) => !p)} style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.9 }]}>
              <Text style={styles.playText}>{playing ? 'Pause' : 'Listen'}</Text>
            </Pressable>
            <Text style={styles.playNote}>Live Adhan stream</Text>
          </View>

          <View style={styles.volumeRow}>
            <Text style={styles.volumeLabel}>Volume</Text>
            <View style={styles.volumeControls}>
              <Pressable onPress={() => changeVolume(-10)} hitSlop={8} style={styles.volBtn}>
                <Text style={styles.volBtnText}>-</Text>
              </Pressable>
              <View style={styles.volumeTrack}>
                <View style={[styles.volumeFill, { width: `${volume}%` }]} />
              </View>
              <Pressable onPress={() => changeVolume(10)} hitSlop={8} style={styles.volBtn}>
                <Text style={styles.volBtnText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.volumeValue}>{volume}%</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  body: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { fontSize: 22, color: '#111111', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111111' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  headerRow: { gap: 4 },
  mosque: { fontSize: 18, fontWeight: '800', color: '#111111' },
  subtle: { color: '#585858', fontSize: 13 },
  liveRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: { backgroundColor: '#FFE5E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  liveText: { color: '#FF453A', fontWeight: '800', fontSize: 12 },
  playerArea: { alignItems: 'center', marginTop: 20, gap: 8 },
  playButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E7BF6',
  },
  playText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  playNote: { color: '#585858', fontSize: 13 },
  volumeRow: { marginTop: 20, gap: 8 },
  volumeLabel: { fontWeight: '700', color: '#111111', fontSize: 14 },
  volumeControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  volBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  volBtnText: { fontSize: 16, fontWeight: '800', color: '#111111' },
  volumeTrack: { flex: 1, height: 8, borderRadius: 8, backgroundColor: '#E5E7EB' },
  volumeFill: { height: '100%', borderRadius: 8, backgroundColor: '#1E7BF6' },
  volumeValue: { color: '#585858', fontSize: 13 },
  shadow: { shadowColor: '#111111', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
