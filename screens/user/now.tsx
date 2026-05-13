// app/(tabs)/now.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Animated, Easing, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { labelForPrayer } from '../../lib/adhans';
import { fetchAuthorizedLiveStreamPlayback } from '../../lib/api/liveStreamAccess';
import { getDailyPrayerTimes, type NormalizedPrayerTimes } from '../../lib/api/prayerTimesUnified';
import { computeNextPrayerSummaryAcrossDays } from '../../lib/prayerTimesDisplay';
import { isFreshLiveStream } from '../../lib/liveStreamFreshness';
import { useLiveKitSubscribe } from '../../lib/hooks/useLiveKitSubscribe';

type StreamRow = {
  id: string;
  mosque_id: string;
  type?: string | null;
  status?: string | null;
  started_at?: string | null;
  is_live: boolean;
  livekit_room_name?: string | null;
  mosques?: { name?: string | null; city?: string | null; country?: string | null };
};

const LIVE_REFRESH_MS = 15000;

const heroPatternSvg = `<svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 0 L30 10 L20 20 L10 10 Z M20 20 L30 30 L20 40 L10 30 Z" fill="none" stroke="white" stroke-width="1.2" opacity="0.45"/><circle cx="20" cy="20" r="3" fill="white" opacity="0.45"/></pattern></defs><rect width="320" height="320" fill="url(#p)"/></svg>`;
const heroPatternUri = `data:image/svg+xml;utf8,${encodeURIComponent(heroPatternSvg)}`;

function clampVolume(value: number, fallback = 0.7) {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, Math.round(normalized * 100) / 100));
}

export default function NowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mosqueId?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const requestedMosqueId = typeof params.mosqueId === 'string' ? params.mosqueId : null;

  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [resolvingStreamId, setResolvingStreamId] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [showVolLabel, setShowVolLabel] = useState(false);
  const [prayerTimes, setPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [nextDayPrayerTimes, setNextDayPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackStreamIdRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const autoPlayStreamIdRef = useRef<string | null>(null);
  const [sliderWidth, setSliderWidth] = useState(1);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const playScale = useRef(new Animated.Value(1)).current;

  const current = useMemo(() => streams.find((s) => s.id === activeId) ?? streams[0] ?? null, [streams, activeId]);
  const isLiveKitStream = !!(current?.livekit_room_name);

  const liveKitSubscribe = useLiveKitSubscribe({
    mosqueId: isLiveKitStream ? (current?.mosque_id ?? null) : null,
    livekitRoomName: isLiveKitStream ? (current?.livekit_room_name ?? null) : null,
    autoConnect: false,
  });
  const canPlay = !!current;

  // Keep `playing` in sync with LiveKit subscriber state.
  useEffect(() => {
    if (isLiveKitStream) {
      setPlaying(liveKitSubscribe.isPlaying);
    }
  }, [isLiveKitStream, liveKitSubscribe.isPlaying]);

  useEffect(() => {
    if (!isLiveKitStream) return;
    if (liveKitSubscribe.error) {
      setError(`LiveKit listener: ${liveKitSubscribe.error}`);
      return;
    }
    if (liveKitSubscribe.connectionState === 'connecting' || liveKitSubscribe.connectionState === 'connected') {
      setError(null);
    }
  }, [isLiveKitStream, liveKitSubscribe.connectionState, liveKitSubscribe.error]);
  const followedList = useMemo(() => streams.filter((s) => followedIds.has(s.mosque_id)).slice(0, 3), [streams, followedIds]);
  const safeVolume = useMemo(() => clampVolume(volume), [volume]);

  const load = useCallback(async (options?: { background?: boolean }) => {
    const background = !!options?.background;
    if (!background || !hasLoadedOnceRef.current) {
      setLoading(true);
    }
    if (!background) {
      setError(null);
    }
    try {
      const [subsRes, streamsRes] = await Promise.all([
        userId
          ? supabase.from('subscriptions').select('mosque_id').eq('user_id', userId)
          : Promise.resolve({ data: [] as { mosque_id: string }[], error: null }),
        supabase
          .from('streams')
          .select('id, mosque_id, type, status, started_at, is_live, livekit_room_name, mosques(name,city,country)')
          .eq('is_live', true)
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(20),
      ]);
      if (streamsRes.error) throw streamsRes.error;
      const subSet = new Set((subsRes.data ?? []).map((s) => s.mosque_id));
      setFollowedIds(subSet);
      const dedupedByMosque = new Map<string, StreamRow>();
      ((streamsRes.data ?? []) as StreamRow[]).forEach((stream) => {
        if (!isFreshLiveStream(stream) || dedupedByMosque.has(stream.mosque_id)) return;
        dedupedByMosque.set(stream.mosque_id, stream);
      });
      const streamRows = Array.from(dedupedByMosque.values());
      const visibleStreams =
        subSet.size > 0
          ? streamRows.filter((stream) => subSet.has(stream.mosque_id) || stream.mosque_id === requestedMosqueId)
          : streamRows;
      setStreams(visibleStreams);
      const preferredStream =
        (requestedMosqueId ? visibleStreams.find((stream) => stream.mosque_id === requestedMosqueId) : null) ??
        visibleStreams[0] ??
        null;
      setActiveId((prev) => {
        if (prev && visibleStreams.some((stream) => stream.id === prev)) {
          return prev;
        }
        return preferredStream?.id ?? null;
      });
      hasLoadedOnceRef.current = true;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load live stream.');
      setStreams([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }, [requestedMosqueId, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) {
        void load({ background: true });
      }
    };

    const channel = supabase.channel(`listener-now-live-${userId ?? 'guest'}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, refresh);
    if (userId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        refresh
      );
    }
    channel.subscribe();

    const pollId = setInterval(refresh, LIVE_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [load, userId]);

  useEffect(() => {
    const id = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
        setNextDayPrayerTimes(null);
        return;
      }
      try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [normalized, normalizedTomorrow] = await Promise.all([
          getDailyPrayerTimes(mosqueId, today),
          getDailyPrayerTimes(mosqueId, tomorrow),
        ]);
        setPrayerTimes(normalized);
        setNextDayPrayerTimes(normalizedTomorrow);
      } catch {
        setPrayerTimes(null);
        setNextDayPrayerTimes(null);
      }
    };
    fetchPrayer();
  }, [current?.mosque_id]);
  const nextPrayer = useMemo(
    () => computeNextPrayerSummaryAcrossDays(prayerTimes, nextDayPrayerTimes, new Date(clockMs)),
    [clockMs, prayerTimes, nextDayPrayerTimes]
  );

  // cleanup on unmount
  useEffect(() => {
    return () => {
      playbackStreamIdRef.current = null;
      const webAudio = webAudioRef.current;
      if (webAudio) {
        webAudio.pause();
        webAudio.removeAttribute('src');
        webAudio.load();
      }
      const sound = soundRef.current;
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const setVolumeClamped = (val: number) => {
    const next = clampVolume(val, safeVolume);
    setVolume(next);
    if (webAudioRef.current) {
      webAudioRef.current.volume = next;
    }
    soundRef.current?.setVolumeAsync(next).catch(() => {});
    liveKitSubscribe.setVolume(next);
    setShowVolLabel(true);
    setTimeout(() => setShowVolLabel(false), 800);
  };

  const adjustVolume = (delta: number) => {
    setVolumeClamped(safeVolume + delta);
  };

  const playStream = useCallback(async (stream: StreamRow) => {
    if (stream.livekit_room_name) {
      setActiveId(stream.id);
      setError(null);
      setPlaying(false);
      return;
    }

    try {
      setError(null);
      setResolvingStreamId(stream.id);
      const existingWebAudio = webAudioRef.current;
      if (existingWebAudio) {
        existingWebAudio.pause();
        existingWebAudio.removeAttribute('src');
        existingWebAudio.load();
        webAudioRef.current = null;
      }
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const access = await fetchAuthorizedLiveStreamPlayback(stream.mosque_id, stream.id);
      const uri = access.streamUrl;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.Audio === 'function') {
        const audio = new window.Audio(uri);
        audio.preload = 'auto';
        audio.volume = safeVolume;
        audio.onended = () => {
          if (webAudioRef.current === audio) {
            setPlaying(false);
          }
        };
        audio.onerror = () => {
          if (webAudioRef.current === audio) {
            setError('Playback error');
            setPlaying(false);
          }
        };
        await audio.play();
        webAudioRef.current = audio;
        playbackStreamIdRef.current = stream.id;
        setActiveId(stream.id);
        setPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: uri },
        { shouldPlay: true, volume: safeVolume }
      );
      soundRef.current = sound;
      playbackStreamIdRef.current = stream.id;
      setActiveId(stream.id);
      setPlaying(true);
    } catch (e) {
      setError((e as any)?.message ?? 'Playback error');
      setPlaying(false);
    } finally {
      setResolvingStreamId((prev) => (prev === stream.id ? null : prev));
    }
  }, [safeVolume]);

  const pausePlayback = useCallback(async () => {
    try {
      playbackStreamIdRef.current = null;
      const webAudio = webAudioRef.current;
      if (webAudio) {
        webAudio.pause();
        webAudio.removeAttribute('src');
        webAudio.load();
        webAudioRef.current = null;
      }
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    setPlaying(false);
  }, []);

  useEffect(() => {
    const playbackStreamId = playbackStreamIdRef.current;
    if (!playing || !playbackStreamId) return;

    if (!activeId) {
      void pausePlayback();
      return;
    }

    const playbackStreamStillVisible = streams.some((stream) => stream.id === playbackStreamId);
    if (!playbackStreamStillVisible || playbackStreamId !== activeId) {
      void pausePlayback();
    }
  }, [activeId, pausePlayback, playing, streams]);

  const togglePlay = () => {
    if (!current) return;
    Haptics.selectionAsync();
    // LiveKit streams start on demand. Avoid disconnecting while a phone is still
    // waiting for the remote audio track to arrive.
    if (isLiveKitStream) {
      if (playing) {
        void liveKitSubscribe.disconnect();
        setPlaying(false);
      } else if (
        liveKitSubscribe.connectionState === 'idle' ||
        liveKitSubscribe.connectionState === 'failed'
      ) {
        setActiveId(current.id);
        liveKitSubscribe.setVolume(safeVolume);
        void liveKitSubscribe.connect();
      } else {
        setActiveId(current.id);
        liveKitSubscribe.setVolume(safeVolume);
      }
      return;
    }
    if (activeId === current.id && playing) {
      pausePlayback();
    } else {
      playStream(current);
    }
  };

  useEffect(() => {
    if (!current || !canPlay || playing || resolvingStreamId === current.id) return;
    if (isLiveKitStream) return;
    const shouldAutoPlay = !!requestedMosqueId || streams.length === 1;
    if (!shouldAutoPlay) return;
    if (autoPlayStreamIdRef.current === current.id) return;
    autoPlayStreamIdRef.current = current.id;
    void playStream(current);
  }, [current, canPlay, isLiveKitStream, playing, playStream, requestedMosqueId, resolvingStreamId, streams.length]);

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

  if (!current) {
    const emptyMessage =
      followedIds.size > 0
        ? 'No live Adhan is available from your followed mosques right now.'
        : 'No live Adhan is available right now.';
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nothing live right now</Text>
          <Text style={styles.emptySubtitle}>{emptyMessage}</Text>
        </View>
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
        disabled={!canPlay || resolvingStreamId === current?.id}
        onPressIn={() => {
          Animated.timing(playScale, { toValue: 0.95, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }}
        onPressOut={() => {
          Animated.timing(playScale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }}
        style={({ pressed }) => ({ opacity: canPlay && resolvingStreamId !== current?.id ? (pressed ? 0.94 : 1) : 0.6, alignSelf: 'center' })}
      >
        <Animated.View style={[styles.playButton, { transform: [{ scale: playScale }] }]}>
          <Ionicons name={playing ? 'stop' : 'play'} size={32} color="#0A84FF" />
        </Animated.View>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.sliderWrap}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>Volume</Text>
          <Text style={[styles.sliderValue, { opacity: showVolLabel ? 1 : 0.35 }]}>{Math.round(safeVolume * 100)}%</Text>
        </View>
        <View style={styles.sliderTrackShadow}>
          <Pressable
            style={styles.sliderTrack}
            onLayout={(e) => setSliderWidth(Math.max(1, e.nativeEvent.layout.width))}
            onPress={(e) => {
              const { locationX } = e.nativeEvent as any;
              const pct =
                Number.isFinite(locationX) && Number.isFinite(sliderWidth) && sliderWidth > 0
                  ? Math.max(0, Math.min(1, locationX / sliderWidth))
                  : safeVolume;
              setVolumeClamped(pct);
            }}
          >
            <View style={[styles.sliderFill, { width: `${Math.round(safeVolume * 100)}%` }]} />
            <View style={[styles.sliderThumb, { left: `${Math.round(safeVolume * 100)}%` }]} />
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
                    if (f.livekit_room_name) {
                      setActiveId(f.id);
                      setError(null);
                    } else {
                      playStream(f);
                    }
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

      <View style={styles.nextRow}>
        <Text style={styles.nextValue}>
          {nextPrayer
            ? `Next prayer: ${labelForPrayer(nextPrayer.name)} in ${nextPrayer.remaining}`
            : "Next prayer unavailable from today's timetable"}
        </Text>
      </View>

    </SafeAreaView>
  );
}

// Unload sound on unmount to avoid leaks
NowScreen.unload = () => {
  // no-op placeholder for consistency with Expo router; actual cleanup below
};

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
  audioHint: {
    marginTop: -6,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    paddingHorizontal: 24,
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: '#0F172A', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { color: '#64748B', fontSize: 14, marginTop: 8, textAlign: 'center' },
  error: { color: '#B91C1C', marginTop: 10, fontWeight: '700' },

  shadow: { shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});
