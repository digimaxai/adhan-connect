// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fetchAladhanTimes, type AladhanTimings } from '../../lib/api/aladhan';
import { useAuth } from '../../lib/auth';
import {
  AdhanBroadcast,
  canStartBroadcast,
  fetchUpcomingBroadcasts,
  formatTimeWithTz,
  labelForPrayer,
  PrayerName,
  statusBadge,
} from '../../lib/adhans';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../components/AppLogo';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppText } from '../../components/ui/app-text';
import { getDefaultMosqueId } from '../../lib/mosquePreferences';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { getDailyPrayerTimes, type NormalizedPrayerTimes } from '../../lib/api/prayerTimesUnified';
import { computeNextPrayerSummaryAcrossDays, mapNormalizedPrayerTimesToDisplay } from '../../lib/prayerTimesDisplay';
import { isFreshLiveStream } from '../../lib/liveStreamFreshness';
import { tokens } from '../../theme/tokens';

type Mosque = { id: string; name: string; city?: string | null; country?: string | null; status?: string | null; lat?: number | null; lng?: number | null };
type UserLocation = { latitude: number; longitude: number };
type Subscription = { mosque_id: string };
type StreamRow = {
  id?: string;
  mosque_id: string;
  type?: string | null;
  is_live: boolean;
  status?: string | null;
  started_at?: string | null;
  current_prayer?: string | null;
};

const LIVE_REFRESH_MS = 15000;

function buildLiveStreamMap(rows: StreamRow[] | null | undefined) {
  const map: Record<string, StreamRow> = {};
  (rows ?? []).forEach((stream) => {
    if (isFreshLiveStream(stream) && !map[stream.mosque_id]) {
      map[stream.mosque_id] = stream;
    }
  });
  return map;
}

function normalizeSubscriptions(rows: Subscription[] | null | undefined) {
  const seen = new Set<string>();
  return (rows ?? []).reduce<Subscription[]>((acc, row) => {
    if (!row.mosque_id || seen.has(row.mosque_id)) return acc;
    seen.add(row.mosque_id);
    acc.push({ mosque_id: row.mosque_id });
    return acc;
  }, []);
}

function mergeMosqueRows(baseRows: Mosque[], extraRows: Mosque[]) {
  const byId = new Map<string, Mosque>();
  [...baseRows, ...extraRows].forEach((mosque) => {
    if (!mosque?.id) return;
    const existing = byId.get(mosque.id);
    byId.set(mosque.id, existing ? { ...existing, ...mosque } : mosque);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const formatHm = (val?: string | null) => {
  if (!val) return '--:--';
  const [h, m] = val.split(':');
  return `${h?.padStart(2, '0') ?? '00'}:${m?.padStart(2, '0') ?? '00'}`;
};

// ── Hoisted sub-components ────────────────────────────────────────────────────
// Defined at module scope so React never sees a new component type on re-render,
// which would force unmount → remount (resetting internal state and intervals).

type MuezzinHeroProps = {
  loading: boolean;
  broadcast: AdhanBroadcast | null;
  error: string | null;
  router: ReturnType<typeof useRouter>;
};

const MuezzinHero = React.memo(function MuezzinHero({ loading, broadcast, error, router }: MuezzinHeroProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const startable = broadcast ? canStartBroadcast(broadcast, now) : false;
  const badge = broadcast ? statusBadge(broadcast, now) : null;
  const remaining = (() => {
    if (!broadcast) return null;
    const target = new Date(broadcast.scheduled_for);
    const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    return { text: `In ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`, diffSec };
  })();
  const urgency = (() => {
    if (!remaining) return { color: '#22C55E', label: 'Ready' };
    if (remaining.diffSec < 120) return { color: '#EF4444', label: 'Critical' };
    if (remaining.diffSec < 600) return { color: '#F59E0B', label: 'Soon' };
    return { color: '#22C55E', label: 'Ready' };
  })();

  return (
    <View style={[styles.heroCard, styles.shadow]}>
      <Text style={styles.heroEyebrow}>Muezzin</Text>
      <Text style={styles.heroTitle}>Your next Adhan</Text>
      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <ActivityIndicator color="#0EA5E9" />
          <Text style={styles.heroSubtitle}>Loading</Text>
        </View>
      )}
      {!loading && broadcast && (
        <>
          <Text style={styles.heroSubtitle}>{formatTimeWithTz(broadcast)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
            <View style={[styles.livePill, { backgroundColor: broadcast.status === 'live' ? '#FEE2E2' : '#E2E8F0' }]}>
              <View style={[styles.liveDot, { backgroundColor: broadcast.status === 'live' ? '#DC2626' : '#94A3B8' }]} />
              <Text style={[styles.livePillText, { color: broadcast.status === 'live' ? '#B91C1C' : '#0F172A' }]}>
                {broadcast.status === 'live' ? 'LIVE' : 'Ready'}
              </Text>
            </View>
            {badge && <Text style={styles.heroBadge}>{badge}</Text>}
          </View>
          {remaining && <Text style={[styles.heroCountdown, { color: urgency.color }]}>{remaining.text}</Text>}
          <Text style={[styles.heroUrgency, { color: urgency.color }]}>{urgency.label}</Text>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
            <Pressable
              onPress={() => router.push('/(muezzin)/live-broadcast')}
              style={({ pressed }) => [styles.heroButton, { backgroundColor: startable ? '#EF4444' : '#0EA5E9', opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.heroButtonText}>{startable ? 'Go live' : 'View details'}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(muezzin)/muezzin-home')}
              style={({ pressed }) => [styles.heroButton, { backgroundColor: '#E0F2FE', opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.heroButtonText, { color: '#0369A1' }]}>Schedule</Text>
            </Pressable>
          </View>
        </>
      )}
      {!loading && !broadcast && <Text style={styles.heroSubtitle}>{error || 'No upcoming adhans.'}</Text>}
    </View>
  );
});

type MyMosquesProps = {
  subs: Subscription[];
  mosques: Mosque[];
  liveMosqueIds: Set<string>;
  router: ReturnType<typeof useRouter>;
};

const MyMosques = React.memo(function MyMosques({ subs, mosques, liveMosqueIds, router }: MyMosquesProps) {
  const followedMosques = useMemo(() => {
    const mosqueById = new Map(mosques.map((mosque) => [mosque.id, mosque]));
    return subs.map((sub) => mosqueById.get(sub.mosque_id) ?? { id: sub.mosque_id, name: 'Mosque', city: null, country: null });
  }, [subs, mosques]);

  return (
    <AppCard style={styles.cardContainer}>
      <View style={styles.sectionHeader}>
        <AppText variant="sectionTitle">My Mosques</AppText>
        <Pressable onPress={() => router.push('/manage-mosques')} hitSlop={6}>
          <AppText variant="body" color={tokens.color.text.accent} style={styles.manageLink}>
            Manage
          </AppText>
        </Pressable>
      </View>
      {followedMosques.length ? (
        <View style={styles.myMosquesGrid}>
          {followedMosques.map((m) => {
            const isLive = liveMosqueIds.has(m.id);
            return (
              <Pressable
                key={m.id}
                style={styles.mosqueChip}
                onPress={() =>
                  router.push({
                    pathname: '/mosque/[id]',
                    params: { id: m.id, name: m.name, city: m.city ?? '', country: m.country ?? '' },
                  })
                }
              >
                <View style={styles.mosqueAvatar}>
                  <AppText style={styles.mosqueAvatarText}>{m.name.slice(0, 2).toUpperCase()}</AppText>
                </View>
                <AppText style={styles.mosqueLabel} numberOfLines={1}>
                  {m.name}
                </AppText>
                {m.city ? (
                  <AppText variant="caption" style={styles.mosqueCity} numberOfLines={1}>
                    {m.city}
                  </AppText>
                ) : null}
                {isLive ? (
                  <View style={styles.mosqueLiveBadge}>
                    <AppText variant="caption" color={tokens.color.text.inverse} style={styles.mosqueLiveBadgeText}>
                      LIVE
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ paddingTop: 6 }}>
          <AppText variant="caption" style={styles.cardSubtitle}>
            Follow mosques to get live adhans.
          </AppText>
        </View>
      )}
    </AppCard>
  );
});

// ── Geo helpers ──────────────────────────────────────────────────────────────
const toRad = (deg: number) => deg * (Math.PI / 180);
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Geo sub-components ───────────────────────────────────────────────────────

type LocationChipProps = { status: 'idle' | 'loading' | 'denied'; onPress: () => void };
const LocationChip = React.memo(function LocationChip({ status, onPress }: LocationChipProps) {
  if (status === 'denied') return null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.locationChip, { opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name="location-outline" size={13} color={tokens.color.text.accent} />
      <Text style={styles.locationChipText}>
        {status === 'loading' ? 'Getting location…' : 'Enable nearby features'}
      </Text>
    </Pressable>
  );
});

type TravelBannerProps = { mosqueName: string; distanceKm: number; onDiscover: () => void };
const TravelBanner = React.memo(function TravelBanner({ mosqueName, distanceKm, onDiscover }: TravelBannerProps) {
  return (
    <Pressable onPress={onDiscover} style={({ pressed }) => [styles.travelBanner, { opacity: pressed ? 0.9 : 1 }]}>
      <Ionicons name="location-outline" size={15} color="#92400E" />
      <Text style={styles.travelBannerText} numberOfLines={2}>
        You&apos;re {Math.round(distanceKm)} km from {mosqueName}. Find a mosque near you.
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#92400E" />
    </Pressable>
  );
});

type GeoPrayerCardProps = { times: AladhanTimings };
const GeoPrayerCard = React.memo(function GeoPrayerCard({ times }: GeoPrayerCardProps) {
  return (
    <AppCard style={styles.cardContainer}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location-outline" size={15} color={tokens.color.text.accent} />
          <AppText variant="sectionTitle">Prayer Times Near You</AppText>
        </View>
      </View>
      <AppText variant="caption" style={styles.cardSubtitle}>
        Calculated for your current location
      </AppText>
      <View style={styles.titleDivider} />
      <View style={styles.prayerTable}>
        {(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map((p) => (
          <View key={p} style={styles.prayerRow}>
            <AppText style={styles.prayerName}>{p}</AppText>
            <AppText style={styles.prayerTimeText}>{times[p]?.slice(0, 5) ?? '--:--'}</AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
});

type NearbyLiveEntry = { mosqueId: string; mosque: Mosque; distance: number };
type NearbyLiveCardProps = { entries: NearbyLiveEntry[]; onListen: (mosqueId: string) => void };
const NearbyLiveCard = React.memo(function NearbyLiveCard({ entries, onListen }: NearbyLiveCardProps) {
  if (!entries.length) return null;
  return (
    <AppCard style={[styles.cardContainer, { gap: 10 }]}>
      <AppText variant="sectionTitle">Live Near You</AppText>
      {entries.map(({ mosqueId, mosque, distance }) => (
        <View key={mosqueId} style={styles.otherLiveRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Ionicons name="radio-outline" size={18} color="#0F172A" />
            <View style={{ flex: 1 }}>
              <AppText style={styles.otherLiveName} numberOfLines={1}>{mosque.name}</AppText>
              <AppText variant="caption" style={styles.otherLiveSub} numberOfLines={1}>
                {Math.round(distance)} km away
              </AppText>
            </View>
            <View style={styles.liveBadge}>
              <AppText variant="caption" color={tokens.color.text.inverse} style={styles.liveBadgeText}>LIVE</AppText>
            </View>
          </View>
          <Pressable onPress={() => onListen(mosqueId)} hitSlop={6}>
            <AppText variant="body" color={tokens.color.text.accent} style={styles.listenLink}>Listen</AppText>
          </Pressable>
        </View>
      ))}
    </AppCard>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags();
  const userId = session?.user?.id ?? null;

  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [liveStreams, setLiveStreams] = useState<Record<string, StreamRow>>({});
  const [nextBroadcast, setNextBroadcast] = useState<AdhanBroadcast | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [nextDayPrayerTimes, setNextDayPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  // prayerLoading is ONLY true during initial load for a mosque — never set during background refreshes.
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [prayerError, setPrayerError] = useState<string | null>(null);
  const [muezzinLoading, setMuezzinLoading] = useState(false);
  const [muezzinError, setMuezzinError] = useState<string | null>(null);
  const [defaultMosqueId, setDefaultMosqueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'enabled' | 'denied'>('idle');
  const [geoPrayerTimes, setGeoPrayerTimes] = useState<AladhanTimings | null>(null);

  // Tracks which mosque has already had prayer times loaded.
  // Refreshes for the same mosque reuse existing data (stale-while-revalidate).
  const prayerRequestIdRef = useRef(0);
  const prayerLoadedMosqueRef = useRef<string | null>(null);

  // Dedup refs — prevent spurious setState calls when polled data is unchanged.
  const lastMosqueIdsRef = useRef('');
  const lastSubIdsRef = useRef('');

  const staffPrimaryMosqueId = useMemo(
    () => (roles.isMainAdmin ? null : roles.primaryAdminMosqueId ?? roles.primaryMuezzinMosqueId ?? null),
    [roles.isMainAdmin, roles.primaryAdminMosqueId, roles.primaryMuezzinMosqueId]
  );

  const primaryMosque = useMemo(() => {
    const preferredId = staffPrimaryMosqueId ?? defaultMosqueId ?? subs[0]?.mosque_id ?? mosques[0]?.id;
    const found = mosques.find((m) => m.id === preferredId);
    if (found) return found;
    const altId = staffPrimaryMosqueId ?? defaultMosqueId ?? subs[0]?.mosque_id ?? mosques[0]?.id;
    return mosques.find((m) => m.id === altId) ?? null;
  }, [subs, mosques, defaultMosqueId, staffPrimaryMosqueId]);

  const subscribedIds = useMemo(() => new Set(subs.map((s) => s.mosque_id)), [subs]);

  const loadDefault = React.useCallback(async () => {
    try {
      const stored = await getDefaultMosqueId(userId);
      setDefaultMosqueId(stored ?? null);
      return stored ?? null;
    } catch {
      setDefaultMosqueId(null);
      return null;
    }
  }, [userId]);

  const loadHomeData = React.useCallback(async () => {
    const [mosqueRes, subsRes, streamsRes] = await Promise.all([
      supabase.from('mosques').select('id, name, city, country, status, lat, lng').order('name', { ascending: true }).limit(200),
      userId
        ? supabase.from('subscriptions').select('mosque_id').eq('user_id', userId)
        : Promise.resolve({ data: [] as Subscription[], error: null }),
      supabase
        .from('streams')
        .select('id, mosque_id, type, is_live, status, started_at, current_prayer')
        .eq('is_live', true)
        .order('started_at', { ascending: false, nullsFirst: false }),
    ]);

    let mosqueRows = !mosqueRes.error && mosqueRes.data ? ((mosqueRes.data ?? []) as Mosque[]) : [];
    const subscriptionRows = !subsRes.error && subsRes.data ? normalizeSubscriptions(subsRes.data as Subscription[]) : [];

    const loadedMosqueIds = new Set(mosqueRows.map((mosque) => mosque.id));
    const missingFollowedIds = subscriptionRows
      .map((subscription) => subscription.mosque_id)
      .filter((mosqueId) => !loadedMosqueIds.has(mosqueId));

    if (missingFollowedIds.length) {
      const { data: followedMosques, error: followedMosquesError } = await supabase
        .from('mosques')
        .select('id, name, city, country, status')
        .in('id', missingFollowedIds);

      if (!followedMosquesError && followedMosques) {
        mosqueRows = mergeMosqueRows(mosqueRows, followedMosques as Mosque[]);
      }
    }

    // Dedup — only setState when data has actually changed to avoid cascade re-renders.
    // Sort before joining so a different query order from Supabase doesn't cause a false miss.
    if (!mosqueRes.error || mosqueRows.length) {
      const ids = mosqueRows.map((m) => m.id).sort().join(',');
      if (ids !== lastMosqueIdsRef.current) {
        lastMosqueIdsRef.current = ids;
        setMosques(mosqueRows);
      }
    }
    if (!subsRes.error) {
      const ids = subscriptionRows.map((s) => s.mosque_id).sort().join(',');
      if (ids !== lastSubIdsRef.current) {
        lastSubIdsRef.current = ids;
        setSubs(subscriptionRows);
      }
    }
    if (!streamsRes.error && streamsRes.data) {
      setLiveStreams(buildLiveStreamMap(streamsRes.data as StreamRow[]));
    } else {
      setLiveStreams({});
    }

    return {
      mosques: mosqueRows,
      subs: subscriptionRows,
    };
  }, [userId]);

  const loadPrayerTimes = React.useCallback(
    async (mosqueId?: string | null) => {
      const requestId = ++prayerRequestIdRef.current;

      if (!mosqueId) {
        if (requestId === prayerRequestIdRef.current) {
          prayerLoadedMosqueRef.current = null;
          setPrayerTimes(null);
          setNextDayPrayerTimes(null);
          setPrayerError(null);
          setPrayerLoading(false);
        }
        return;
      }

      // Stale-while-revalidate: only show loading spinner when this mosque has
      // never been loaded before. Background refreshes update data silently.
      const isFirstLoad = prayerLoadedMosqueRef.current !== mosqueId;
      if (isFirstLoad) setPrayerLoading(true);

      try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [normalized, normalizedTomorrow] = await Promise.all([
          getDailyPrayerTimes(mosqueId, today),
          getDailyPrayerTimes(mosqueId, tomorrow),
        ]);
        if (requestId !== prayerRequestIdRef.current) return;
        prayerLoadedMosqueRef.current = mosqueId;
        setPrayerError(null);
        setPrayerTimes(normalized);
        setNextDayPrayerTimes(normalizedTomorrow);
      } catch {
        if (requestId !== prayerRequestIdRef.current) return;
        // On first-load failure, surface the error. On background refresh
        // failure, keep showing the existing stale data silently.
        if (isFirstLoad) {
          setPrayerError('Could not load prayer times.');
          setPrayerTimes(null);
          setNextDayPrayerTimes(null);
        }
      } finally {
        if (requestId === prayerRequestIdRef.current && isFirstLoad) {
          setPrayerLoading(false);
        }
      }
    },
    []
  );

  const loadMuezzin = React.useCallback(async () => {
    if (!roles.isMuezzin) {
      setNextBroadcast(null);
      setMuezzinError(null);
      return;
    }
    setMuezzinLoading(true);
    setMuezzinError(null);
    try {
      const upcoming = await fetchUpcomingBroadcasts(1);
      setNextBroadcast(upcoming[0] ?? null);
      if (!upcoming.length) setMuezzinError('No upcoming adhans scheduled.');
    } catch (e: any) {
      setMuezzinError(e?.message ?? 'Could not load upcoming adhans.');
      setNextBroadcast(null);
    } finally {
      setMuezzinLoading(false);
    }
  }, [roles.isMuezzin]);

  const requestUserLocation = useCallback(async () => {
    if (locationStatus === 'loading') return;
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLocationStatus('enabled');
    } catch {
      setLocationStatus('idle');
    }
  }, [locationStatus]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const storedDefaultId = await loadDefault();
      const { mosques: latestMosques, subs: latestSubs } = await loadHomeData();
      const preferredId = staffPrimaryMosqueId ?? storedDefaultId ?? latestSubs[0]?.mosque_id ?? latestMosques[0]?.id ?? null;
      await Promise.all([loadPrayerTimes(preferredId), loadMuezzin()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadDefault, loadHomeData, loadMuezzin, loadPrayerTimes, staffPrimaryMosqueId]);

  useFocusEffect(
    React.useCallback(() => {
      void loadHomeData();
      void loadDefault();
    }, [loadDefault, loadHomeData])
  );

  useEffect(() => {
    if (roles.isMuezzin) return;

    let cancelled = false;
    const refresh = () => {
      if (!cancelled) {
        void loadHomeData();
      }
    };

    const channel = supabase.channel(`listener-home-live-${userId ?? 'guest'}`);
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
  }, [loadHomeData, roles.isMuezzin, userId]);

  useEffect(() => {
    const id = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!defaultMosqueId) return;
    if (mosques.find((m) => m.id === defaultMosqueId)) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('mosques')
        .select('id, name, city, country, status')
        .eq('id', defaultMosqueId)
        .maybeSingle();
      if (!cancelled && data && !error) {
        setMosques((prev) => [...prev, data]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultMosqueId, mosques]);

  useEffect(() => {
    loadMuezzin();
  }, [loadMuezzin]);

  useEffect(() => {
    loadPrayerTimes(primaryMosque?.id);
  }, [loadPrayerTimes, primaryMosque?.id]);

  // Silently activate location if permission was already granted in a prior session.
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationStatus('enabled');
      } catch { /* location unavailable — stay idle */ }
    })();
  }, []);

  const distanceFromHomeMosque = useMemo(() => {
    if (!userLocation || primaryMosque?.lat == null || primaryMosque?.lng == null) return null;
    return haversineKm(
      userLocation.latitude, userLocation.longitude,
      Number(primaryMosque.lat), Number(primaryMosque.lng)
    );
  }, [userLocation, primaryMosque]);

  const isTravelling = distanceFromHomeMosque !== null && distanceFromHomeMosque > 30;

  // Fetch Aladhan-calculated times for user's current GPS when they're away from home mosque.
  useEffect(() => {
    if (!userLocation || !isTravelling) { setGeoPrayerTimes(null); return; }
    const today = new Date().toISOString().slice(0, 10);
    fetchAladhanTimes(userLocation.latitude, userLocation.longitude, today)
      .then((t) => setGeoPrayerTimes(t));
  }, [userLocation, isTravelling]);

  const prayerTimesDisplay = useMemo(() => mapNormalizedPrayerTimesToDisplay(prayerTimes), [prayerTimes]);
  const nextPrayer = useMemo(
    () => computeNextPrayerSummaryAcrossDays(prayerTimes, nextDayPrayerTimes, new Date(clockMs)),
    [clockMs, prayerTimes, nextDayPrayerTimes]
  );
  const freshLiveStreams = useMemo(() => {
    const next: Record<string, StreamRow> = {};
    Object.entries(liveStreams).forEach(([mosqueId, stream]) => {
      if (isFreshLiveStream(stream, clockMs)) {
        next[mosqueId] = stream;
      }
    });
    return next;
  }, [clockMs, liveStreams]);

  const nearbyLiveEntries = useMemo((): NearbyLiveEntry[] => {
    if (!userLocation) return [];
    return Object.keys(freshLiveStreams)
      .filter((id) => id !== primaryMosque?.id)
      .reduce<NearbyLiveEntry[]>((acc, mosqueId) => {
        const mosque = mosques.find((m) => m.id === mosqueId);
        if (!mosque?.lat || !mosque?.lng) return acc;
        const distance = haversineKm(
          userLocation.latitude, userLocation.longitude,
          Number(mosque.lat), Number(mosque.lng)
        );
        if (distance <= 30) acc.push({ mosqueId, mosque, distance });
        return acc;
      }, [])
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [userLocation, freshLiveStreams, primaryMosque?.id, mosques]);

  const topPad = Platform.OS === 'android' ? 8 : 0;
  const liveInfo = useLiveStreamForMosque(primaryMosque?.id);
  const primaryLiveStream = primaryMosque ? freshLiveStreams[primaryMosque.id] ?? null : null;
  const primaryIsLive = !!primaryLiveStream || liveInfo.isLive;
  const primaryLivePrayerLabel = useMemo(() => {
    const rawPrayer = liveInfo.currentAdhan?.prayer ?? primaryLiveStream?.current_prayer ?? null;
    if (!rawPrayer) return 'Adhan';
    const normalized = rawPrayer.toString().trim().toLowerCase();
    if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(normalized)) {
      return labelForPrayer(normalized as PrayerName);
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [liveInfo.currentAdhan?.prayer, primaryLiveStream?.current_prayer]);
  const primaryLiveStartedLabel = useMemo(() => {
    const startedAt = primaryLiveStream?.started_at ?? liveInfo.currentAdhan?.started_at ?? null;
    if (!startedAt) return 'Broadcasting now';
    return `Started ${new Date(startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }, [liveInfo.currentAdhan?.started_at, primaryLiveStream?.started_at]);
  const liveMosqueIds = useMemo(() => {
    const ids = new Set(Object.keys(freshLiveStreams));
    if (primaryMosque?.id && primaryIsLive) {
      ids.add(primaryMosque.id);
    }
    return ids;
  }, [freshLiveStreams, primaryMosque?.id, primaryIsLive]);

  if (roles.isMuezzin) {
    return (
      <ScreenContainer
        contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.text.accent} />}
      >
        <View style={styles.headerRow}>
          <AppLogo size={30} />
          <AppText variant="title" style={styles.appTitle}>
            Adhan Connect
          </AppText>
          <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>
        <MuezzinHero loading={muezzinLoading} broadcast={nextBroadcast} error={muezzinError} router={router} />
      </ScreenContainer>
    );
  }

  const otherLive = Object.entries(freshLiveStreams).filter(
    ([mosqueId]) => mosqueId !== primaryMosque?.id && subscribedIds.has(mosqueId)
  );

  return (
    <ScreenContainer
      contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.text.accent} />}
    >
      <View style={styles.headerRow}>
        <AppLogo size={30} />
        <AppText variant="title" style={styles.appTitle}>
          Adhan Connect
        </AppText>
        <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
          <Ionicons name="settings-outline" size={22} color="#0F172A" />
        </Pressable>
      </View>

      {locationStatus === 'idle' && (
        <LocationChip status="idle" onPress={requestUserLocation} />
      )}
      {isTravelling && primaryMosque && distanceFromHomeMosque !== null && (
        <TravelBanner
          mosqueName={primaryMosque.name}
          distanceKm={distanceFromHomeMosque}
          onDiscover={() => router.push('/(user)/discover')}
        />
      )}

      {/* Next Prayer / Live hero card */}
      <Pressable
        disabled={!primaryMosque}
        onPress={() => {
          if (primaryMosque) {
            if (primaryIsLive) {
              router.push({ pathname: '/(user)/now', params: { mosqueId: primaryMosque.id } });
              return;
            }
            router.push({
              pathname: '/mosque/[id]',
              params: { id: primaryMosque.id, name: primaryMosque.name, city: primaryMosque.city ?? '', country: primaryMosque.country ?? '' },
            });
          }
        }}
        style={({ pressed }) => [
          styles.nextCard,
          { opacity: primaryMosque ? (pressed ? 0.92 : 1) : 0.7 },
        ]}
      >
        <View style={{ gap: 4 }}>
          <AppText variant="label" style={styles.eyebrow}>
            {primaryIsLive ? 'Live Broadcast' : 'Next Prayer'}
          </AppText>
          {primaryMosque?.name ? (
            <AppText variant="heroSubtle" style={styles.heroSource}>
              {primaryMosque.name}
            </AppText>
          ) : null}
        </View>
        <View style={{ gap: 6, marginTop: 10 }}>
          <AppText variant="hero" style={styles.nextTime}>
            {primaryIsLive ? 'LIVE' : prayerLoading ? 'Loading...' : nextPrayer?.label ?? '--:--'}
          </AppText>
          <AppText style={styles.nextName}>
            {primaryIsLive
              ? primaryLivePrayerLabel
              : prayerLoading
              ? 'Loading prayer times'
              : nextPrayer?.name
              ? labelForPrayer(nextPrayer.name)
              : 'Prayer times unavailable'}
          </AppText>
          <AppText style={styles.nextEta}>
            {primaryIsLive
              ? primaryLiveStartedLabel
              : prayerLoading
              ? 'Checking today\'s schedule...'
              : nextPrayer?.remaining
              ? `In ${nextPrayer.remaining}`
              : prayerError ?? 'Pull to refresh'}
          </AppText>
        </View>
        <View style={{ marginTop: 12 }}>
          {primaryIsLive ? (
            <View style={styles.heroLiveRow}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
              <Ionicons name="radio-outline" size={20} color="#E2E8F0" />
              <Pressable
                onPress={() =>
                  primaryMosque
                    ? router.push({ pathname: '/(user)/now', params: { mosqueId: primaryMosque.id } })
                    : null
                }
                style={({ pressed }) => [styles.listenBtn, { opacity: pressed ? 0.9 : 1 }]}
              >
                <AppText variant="caption" color={tokens.color.text.inverse} style={styles.listenText}>
                  Listen Live
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* Today's Prayer Times — always renders 5 rows; shows --:-- while loading.
          Never swaps the layout structure, eliminating card-height flicker. */}
      <AppCard style={styles.cardContainer}>
        <View style={styles.sectionHeader}>
          <AppText variant="sectionTitle">Today&apos;s Prayer Times</AppText>
        </View>
        {primaryMosque?.name ? (
          <AppText variant="caption" style={styles.cardSubtitle}>
            Based on {primaryMosque.name}
          </AppText>
        ) : null}
        <View style={styles.titleDivider} />
        <View style={styles.prayerTable}>
          {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => (
            <View key={p} style={styles.prayerRow}>
              <AppText style={styles.prayerName}>{p.charAt(0).toUpperCase() + p.slice(1)}</AppText>
              <AppText style={styles.prayerTimeText}>{formatHm(prayerTimesDisplay?.[p] as string)}</AppText>
            </View>
          ))}
        </View>
        {prayerError ? <AppText style={styles.errorText}>{prayerError}</AppText> : null}
      </AppCard>

      {isTravelling && geoPrayerTimes && <GeoPrayerCard times={geoPrayerTimes} />}

      <MyMosques subs={subs} mosques={mosques} liveMosqueIds={liveMosqueIds} router={router} />

      <NearbyLiveCard
        entries={nearbyLiveEntries}
        onListen={(mosqueId) => router.push({ pathname: '/(user)/now', params: { mosqueId } })}
      />

      {otherLive.length > 0 && (
        <AppCard style={[styles.cardContainer, { gap: 10 }]}>
          <AppText variant="sectionTitle">Other Live Broadcasts</AppText>
          {otherLive.map(([mosqueId]) => {
            const m = mosques.find((ms) => ms.id === mosqueId);
            if (!m) return null;
            const city = [m.city, m.country].filter(Boolean).join(', ');
            return (
              <View key={mosqueId} style={styles.otherLiveRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="radio-outline" size={18} color="#0F172A" />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.otherLiveName} numberOfLines={1}>
                      {m.name}
                    </AppText>
                    <AppText variant="caption" style={styles.otherLiveSub} numberOfLines={1}>
                      {city || 'Live broadcast'}
                    </AppText>
                  </View>
                  <View style={styles.liveBadge}>
                    <AppText variant="caption" color={tokens.color.text.inverse} style={styles.liveBadgeText}>
                      LIVE
                    </AppText>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push({ pathname: '/(user)/now', params: { mosqueId } })}
                  hitSlop={6}
                >
                  <AppText variant="body" color={tokens.color.text.accent} style={styles.listenLink}>
                    Listen
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </AppCard>
      )}

      <AppCard subtle style={styles.discoveryCard}>
        <AppText variant="sectionTitle">Find Mosques Near You</AppText>
        <AppText variant="body" style={styles.discoverySubtitle}>
          Discover mosques to follow and listen to live adhans.
        </AppText>
        <AppButton title="Discover" onPress={() => router.push('/(user)/discover')} style={styles.discoveryBtn} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FB' },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 36, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 58, paddingHorizontal: 0 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: 0.2, color: '#0F172A' },

  eyebrow: { color: '#0EA5E9', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  nextCard: { backgroundColor: '#0D1529', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E6E8EB', shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  nextTime: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  nextName: { color: '#B4E0FF', fontSize: 18, fontWeight: '800' },
  nextEta: { color: '#7EE0A3', fontSize: 13, fontWeight: '700' },
  heroSource: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  heroMuted: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  heroLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  liveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F53B57' },
  liveBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  listenBtn: {
    backgroundColor: '#0097F7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  cardSubtitle: { color: '#7A8290', fontSize: 12, marginTop: 2 },
  manageLink: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },

  myMosquesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  mosqueChip: {
    alignItems: 'center',
    width: 92,
    gap: 6,
  },
  mosqueAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosqueAvatarText: { fontWeight: '800', color: '#0369A1', fontSize: 14 },
  mosqueLabel: { fontWeight: '700', fontSize: 13, color: '#0F172A', textAlign: 'center' },
  mosqueCity: { color: '#7A8290', fontSize: 12, textAlign: 'center' },
  mosqueLiveBadge: {
    marginTop: 4,
    backgroundColor: '#F53B57',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mosqueLiveBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.2,
  },

  prayerTable: { marginTop: 8, gap: 8 },
  prayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, minHeight: 44 },
  prayerName: { fontWeight: '700', color: '#0F172A', letterSpacing: 0.1 },
  prayerTimeText: { color: '#0F172A', fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 10 },
  titleDivider: { height: 1, backgroundColor: '#E6E8EB', marginVertical: 12 },

  discoveryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 24,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  discoveryBtn: {
    backgroundColor: '#0097F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    marginTop: 12,
  },
  discoveryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  discoverySubtitle: { color: '#64748B', fontSize: 13, marginTop: 6 },

  heroCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginTop: 12 },
  heroEyebrow: { color: '#67E8F9', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  heroTitle: { color: '#E2E8F0', fontWeight: '800', fontSize: 19, marginTop: 2 },
  heroSubtitle: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  heroBadge: { marginTop: 2, color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  heroCountdown: { marginTop: 6, fontSize: 16, fontWeight: '800' },
  heroUrgency: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  heroButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroButtonText: { color: '#F8FAFC', fontWeight: '800', fontSize: 14 },
  livePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  livePillText: { fontWeight: '800', fontSize: 12, marginLeft: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#DC2626' },

  otherLiveRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E6E8EB',
  },
  otherLiveName: { color: '#0F172A', fontWeight: '700' },
  otherLiveSub: { color: '#64748B', fontSize: 12 },
  listenLink: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },

  errorText: { color: '#F97316', marginTop: 6, fontSize: 12 },
  sourceText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  shadow: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },

  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  locationChipText: { color: '#0369A1', fontWeight: '700', fontSize: 12 },

  travelBanner: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  travelBannerText: { flex: 1, color: '#92400E', fontWeight: '600', fontSize: 13 },
});
