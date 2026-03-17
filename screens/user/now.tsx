// app/(tabs)/now.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Animated, Easing, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import AppLogo from '../../components/AppLogo';
import { supabase } from '../../lib/supabase';
import { PrayerName } from '../../lib/adhans';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { getDailyPrayerTimes } from '../../lib/api/prayerTimesUnified';

type StreamRow = {
  id: string;
  mosque_id: string;
  type: string;
  url: string;
  status: string;
  is_live: boolean;
  mosques?: { name?: string | null; city?: string | null; country?: string | null };
};

type PrayerTimes = Partial<Record<PrayerName, string | null>>;

const fallbackTimes: Record<PrayerName, string> = {
  fajr: '05:18',
  dhuhr: '12:58',
  asr: '15:27',
  maghrib: '17:42',
  isha: '19:05',
};

const mapNormalizedPrayerTimes = (normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>): PrayerTimes | null => {
  if (!normalized) return null;
  const toHm = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
  const mapped: PrayerTimes = {};
  (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).forEach((name) => {
    mapped[name] = toHm(normalized?.[name]?.adhan ?? null);
  });
  return mapped;
};

const heroPatternSvg = `<svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 0 L30 10 L20 20 L10 10 Z M20 20 L30 30 L20 40 L10 30 Z" fill="none" stroke="white" stroke-width="1.2" opacity="0.45"/><circle cx="20" cy="20" r="3" fill="white" opacity="0.45"/></pattern></defs><rect width="320" height="320" fill="url(#p)"/></svg>`;
const heroPatternUri = `data:image/svg+xml;utf8,${encodeURIComponent(heroPatternSvg)}`;

export default function NowScreen() {
  const router = useRouter();

  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [showVolLabel, setShowVolLabel] = useState(false);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [sliderWidth, setSliderWidth] = useState(1);
  const playScale = useRef(new Animated.Value(1)).current;

  const current = useMemo(() => streams.find((s) => s.id === activeId) ?? streams[0] ?? null, [streams, activeId]);
  const liveInfo = useLiveStreamForMosque(current?.mosque_id);
  const followedList = useMemo(() => streams.filter((s) => followedIds.has(s.mosque_id)).slice(0, 3), [streams, followedIds]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, streamsRes] = await Promise.all([
        supabase.from('subscriptions').select('mosque_id').limit(3),
        supabase
          .from('streams')
          .select('id, mosque_id, type, url, status, is_live, mosques(name,city,country)')
          .eq('status', 'active')
          .eq('is_live', true)
          .limit(20),
      ]);
      if (streamsRes.error) throw streamsRes.error;
      const subSet = new Set((subsRes.data ?? []).map((s) => s.mosque_id));
      setFollowedIds(subSet);
      const streamRows = (streamsRes.data ?? []) as StreamRow[];
      setStreams(streamRows);
      setActiveId((prev) => prev ?? streamRows[0]?.id ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load live stream.');
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: false,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const fetchPrayer = async () => {
      const mosqueId = current?.mosque_id;
      if (!mosqueId) {
        setPrayerTimes(null);
        return;
      }
      try {
        const normalized = await getDailyPrayerTimes(mosqueId, new Date());
        setPrayerTimes(mapNormalizedPrayerTimes(normalized));
      } catch {
        setPrayerTimes(null);
      }
    };
    fetchPrayer();
  }, [current?.mosque_id]);

  const fmtHm = (val?: string | null) => {
    if (!val) return '--:--';
    const [h, m] = val.split(':');
    return `${h?.padStart(2, '0') ?? '00'}:${m?.padStart(2, '0') ?? '00'}`;
  };

  const computeNextPrayer = (times: PrayerTimes | null) => {
    const now = new Date();
    const entries: Array<{ name: PrayerName; time: string }> = (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[])
      .map((name) => ({ name, time: (times?.[name] as string) ?? fallbackTimes[name] }))
      .filter((p) => p.time);
    const toDate = (timeStr: string, carryNextDay = false) => {
      const [h, m] = timeStr.split(':').map((t) => parseInt(t, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (carryNextDay && d <= now) d.setDate(d.getDate() + 1);
      return d;
    };
    const upcoming = entries
      .map((p) => ({ ...p, when: toDate(p.time) }))
      .filter((p) => p.when > now)
      .sort((a, b) => a.when.getTime() - b.when.getTime());
    const chosen = upcoming[0] ?? (entries.length ? { ...entries[0], when: toDate(entries[0].time, true) } : null);
    if (!chosen) return null;
    const diffMs = chosen.when.getTime() - now.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(diffMin / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (diffMin % 60).toString().padStart(2, '0');
    return { name: chosen.name, remaining: `${hours}:${minutes}` };
  };

  const nextPrayer = computeNextPrayer(prayerTimes);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const setVolumeClamped = (val: number) => {
    const next = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    setVolume(next);
    soundRef.current?.setVolumeAsync(next).catch(() => {});
    setShowVolLabel(true);
    setTimeout(() => setShowVolLabel(false), 800);
  };

  const adjustVolume = (delta: number) => {
    setVolumeClamped(volume + delta);
  };

  const playStream = async (stream: StreamRow) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const uri = liveInfo.streamUrl ?? stream.url;
      const { sound } = await Audio.Sound.createAsync(
        { uri: uri },
        { shouldPlay: true, volume }
      );
      soundRef.current = sound;
      setActiveId(stream.id);
      setPlaying(true);
    } catch (e) {
      setError((e as any)?.message ?? 'Playback error');
      setPlaying(false);
    }
  };

  const pausePlayback = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    setPlaying(false);
  };

  const togglePlay = () => {
    if (!current) return;
    Haptics.selectionAsync();
    if (activeId === current.id && playing) {
      pausePlayback();
    } else {
      playStream(current);
    }
  };

  const initials = (name?: string | null) => {
    if (!name) return 'MS';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.subtle}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {current?.mosques?.name ?? 'Now Playing'}
        </Text>
        <Ionicons name="ellipsis-horizontal" size={24} color="#0F172A" />
      </View>

      <View style={styles.hero}>
        <LinearGradient colors={['#0A84FF', '#54A9FF']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.heroGradient} />
        <Image source={{ uri: heroPatternUri }} style={styles.heroPattern} contentFit="cover" />
        <View style={styles.heroContent}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="radio-outline" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroTextStack}>
            <Text style={styles.heroTitle}>{current?.mosques?.name ?? 'Adhan Connect'}</Text>
            {current?.mosques?.city ? <Text style={styles.heroSub}>{`${current.mosques.city}${current.mosques.country ? ' - ' + current.mosques.country : ''}`}</Text> : null}
          </View>
        </View>
      </View>

      <View style={[styles.liveCard, styles.shadow]}>
        <View style={styles.liveRow}>
          <Ionicons name="radio-outline" size={20} color="#333333" />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
              <Text style={styles.liveText}>Broadcasting Adhan</Text>
            </View>
            <Text style={styles.liveSubtle} numberOfLines={1}>
              {(current?.mosques?.name ?? 'Mosque') + (current?.mosques?.city ? ` - ${current.mosques.city}` : '')}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={togglePlay}
        disabled={!current}
        onPressIn={() => {
          Animated.timing(playScale, { toValue: 0.95, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }}
        onPressOut={() => {
          Animated.timing(playScale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }}
        style={({ pressed }) => ({ opacity: current ? (pressed ? 0.94 : 1) : 0.6, alignSelf: 'center' })}
      >
        <Animated.View style={[styles.playButton, { transform: [{ scale: playScale }] }]}>
          <Ionicons name={playing ? 'stop' : 'play'} size={32} color="#0A84FF" />
        </Animated.View>
      </Pressable>

      <View style={styles.sliderWrap}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Volume</Text>
          <Text style={[styles.sliderValue, { opacity: showVolLabel ? 1 : 0.35 }]}>{Math.round(volume * 100)}%</Text>
        </View>
        <View style={styles.sliderTrackShadow}>
          <Pressable
            style={styles.sliderTrack}
            onLayout={(e) => setSliderWidth(Math.max(1, e.nativeEvent.layout.width))}
            onPress={(e) => {
              const { locationX } = e.nativeEvent as any;
              const pct = Math.max(0, Math.min(1, locationX / sliderWidth));
              setVolumeClamped(pct);
            }}
          >
            <View style={[styles.sliderFill, { width: `${Math.round(volume * 100)}%` }]} />
            <View style={[styles.sliderThumb, { left: `${Math.round(volume * 100)}%` }]} />
          </Pressable>
        </View>
        <View style={styles.sliderButtons}>
          <Pressable onPress={() => adjustVolume(-0.1)} style={({ pressed }) => [styles.volButton, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="volume-low" size={24} color="#6B7280" />
          </Pressable>
          <Pressable onPress={() => adjustVolume(0.1)} style={({ pressed }) => [styles.volButton, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="volume-high" size={24} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      {followedList.length > 0 && (
        <View style={[styles.followStrip, styles.shadow]}>
          <View style={styles.followHeader}>
            <Text style={styles.stripLabel}>You follow</Text>
            <Text style={styles.stripSub}>Tap a mosque to switch live stream</Text>
          </View>
          <View style={styles.followDivider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followScroller}>
            {followedList.map((f) => {
              const isLive = f.is_live;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    playStream(f);
                  }}
                  style={({ pressed }) => [styles.followChip, { opacity: pressed ? 0.92 : 1 }]}
                >
                  <View style={styles.followAvatar}>
                    <Text style={styles.followAvatarText}>{initials(f.mosques?.name)}</Text>
                  </View>
                  <View style={{ gap: 6, alignItems: 'center' }}>
                    <Text style={styles.followName} numberOfLines={1}>
                      {f.mosques?.name ?? 'Mosque'}
                    </Text>
                    {isLive && <Text style={styles.followLiveText}>LIVE</Text>}
                  </View>
                  {isLive && (
                    <View style={styles.followLivePill}>
                      <Text style={styles.followLivePillText}>LIVE</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {nextPrayer && (
        <View style={styles.nextRow}>
          <Text style={styles.nextValue}>
            Next prayer: {nextPrayer.name.charAt(0).toUpperCase() + nextPrayer.name.slice(1)} in {nextPrayer.remaining}
          </Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </SafeAreaView>
  );
}

// Unload sound on unmount to avoid leaks
NowScreen.unload = () => {
  // no-op placeholder for consistency with Expo router; actual cleanup below
};

// Ensure cleanup
export function useUnloadSound(soundRef: React.MutableRefObject<Audio.Sound | null>) {
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [soundRef]);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FB', paddingHorizontal: 20, paddingBottom: 80, gap: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'android' ? 8 : 0, height: 56 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '600', color: '#000000', paddingHorizontal: 12 },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    height: 200,
    backgroundColor: '#0A84FF',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  heroIconWrap: { transform: [{ translateY: -16 }] },
  heroTextStack: { alignItems: 'center', gap: 6 },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    transform: [{ scale: 1.15 }],
  },
  heroTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 22 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 16 },

  liveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  liveRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FF3B30', borderRadius: 8 },
  liveBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  liveText: { color: '#000000', fontWeight: '700', fontSize: 16 },
  liveSubtle: { color: '#555555', fontWeight: '500', fontSize: 14 },

  playButton: {
    marginTop: 14,
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  sliderWrap: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderLabel: { color: '#555555', fontWeight: '400', fontSize: 14 },
  sliderValue: { color: '#475569', fontWeight: '600' },
  sliderTrackShadow: { borderRadius: 999, shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sliderTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: '#0A84FF' },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: -8 }],
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sliderButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  volButton: { padding: 6 },

  followStrip: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  followHeader: { gap: 4 },
  stripLabel: { color: '#0F172A', fontWeight: '700', fontSize: 18 },
  stripSub: { color: '#777777', fontWeight: '400', fontSize: 13 },
  followDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  followScroller: { paddingVertical: 2, paddingHorizontal: 4, alignItems: 'center', gap: 12, justifyContent: 'center' },
  followChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    width: 80,
    height: 100,
    alignItems: 'center',
    gap: 8,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  followAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followAvatarText: { color: '#0369A1', fontWeight: '800', fontSize: 13 },
  followName: { color: '#0F172A', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  followLiveText: { color: '#EF4444', fontWeight: '700', fontSize: 11 },
  followLivePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  followLivePillText: { color: '#B91C1C', fontWeight: '800', fontSize: 11 },

  nextRow: { marginTop: 12, paddingBottom: 40, alignItems: 'center' },
  nextValue: { color: '#444444', fontWeight: '600', fontSize: 15 },

  subtle: { color: '#64748B', marginTop: 12, paddingHorizontal: 16 },
  error: { color: '#B91C1C', marginTop: 10, fontWeight: '700' },

  shadow: { shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});
