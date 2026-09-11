// app/(tabs)/discover.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { promptForSignIn } from '../../lib/guestAccess';
import { FOLLOWED_MOSQUE_LIMIT } from '../../lib/subscriptionLimits';
import { supabase } from '../../lib/supabase';
import { NearYouNowCard } from '../../components/NearYouNowCard';
import { useMosquesNearby, type NearbyMosque } from '../../lib/hooks/useMosquesNearby';

type MosqueView = 'nearby' | 'following';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  distance_km?: number | null;
  is_live?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

const MOSQUE_SELECT = 'id,name,city,country,lat,lng';

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

const calculateDistanceKm = (from: UserLocation, mosque: MosqueRow) => {
  if (mosque.lat == null || mosque.lng == null) return null;
  const lat = Number(mosque.lat);
  const lng = Number(mosque.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat - from.latitude);
  const dLng = toRadians(lng - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const withDistances = (rows: MosqueRow[], userLocation: UserLocation | null) => {
  if (!userLocation) return rows.map((row) => ({ ...row, distance_km: row.distance_km ?? null }));
  return rows.map((row) => ({ ...row, distance_km: calculateDistanceKm(userLocation, row) }));
};

const sortMosques = (rows: MosqueRow[], userLocation: UserLocation | null) => {
  return [...rows].sort((a, b) => {
    if (userLocation) {
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
      if (a.distance_km != null) return -1;
      if (b.distance_km != null) return 1;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
};

const escapePostgrestSearchTerm = (term: string) => term.replace(/[,%]/g, ' ').trim();

export default function DiscoverMosques() {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ view?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const isMuezzinContext = segments[0] === '(muezzin)';
  const manageMosquesPath = isMuezzinContext
    ? '/(muezzin)/muezzin-manage-mosques'
    : '/(user)/manage-mosques';
  const mosqueDetailPath = isMuezzinContext
    ? '/(muezzin)/listener-mosque/[id]'
    : '/(user)/mosque/[id]';

  const [query, setQuery] = useState('');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'enabled' | 'denied' | 'unavailable'>('idle');
  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<MosqueView>(
    params.view === 'following' ? 'following' : 'nearby'
  );

  const nearby = useMosquesNearby(15, userLocation, viewMode === 'nearby' && !query.trim());
  const hasNearbyLocation = Boolean(userLocation ?? nearby.coordinates);

  const followedCount = useMemo(() => followingIds.size, [followingIds]);
  const atLimit = followedCount >= FOLLOWED_MOSQUE_LIMIT;
  const locationChipText =
    locationStatus === 'loading'
      ? 'Getting location...'
      : hasNearbyLocation
      ? 'Near me'
      : locationStatus === 'denied'
      ? 'Location permission denied'
      : locationStatus === 'unavailable'
      ? 'Location unavailable'
      : 'Near me';

  const fetchFollowing = useCallback(async () => {
    if (!userId) {
      setFollowingIds(new Set());
      return;
    }
    const { data } = await supabase.from('subscriptions').select('mosque_id').eq('user_id', userId);
    if (Array.isArray(data)) {
      setFollowingIds(new Set(data.map((d) => d.mosque_id)));
    }
  }, [userId]);

  const attachMissingCoordinates = useCallback(async (rows: MosqueRow[]) => {
    const missingIds = rows
      .filter((row) => row.id && (row.lat == null || row.lng == null))
      .map((row) => row.id);

    if (!missingIds.length) return rows;

    const { data, error } = await supabase
      .from('mosques')
      .select('id,lat,lng')
      .in('id', Array.from(new Set(missingIds)));

    if (error || !Array.isArray(data)) return rows;

    const coordinateMap = new Map(
      (data as Pick<MosqueRow, 'id' | 'lat' | 'lng'>[]).map((row) => [row.id, { lat: row.lat ?? null, lng: row.lng ?? null }])
    );

    return rows.map((row) => ({ ...row, ...coordinateMap.get(row.id) }));
  }, []);

  const fetchMosqueFallback = useCallback(async (term: string) => {
    const safeTerm = escapePostgrestSearchTerm(term);
    const buildQuery = (select: string) => {
      let request = supabase
        .from('mosques')
        .select(select)
        .order('name', { ascending: true })
        .limit(100);

      if (safeTerm) {
        request = request.or(`name.ilike.%${safeTerm}%,city.ilike.%${safeTerm}%,country.ilike.%${safeTerm}%`);
      }

      return request;
    };

    const { data, error } = await buildQuery(MOSQUE_SELECT);
    if (!error) return ((data as unknown as MosqueRow[]) ?? []);

    const { data: basicData, error: basicError } = await buildQuery('id,name,city,country');
    if (basicError) throw basicError;
    return ((basicData as unknown as MosqueRow[]) ?? []);
  }, []);

  const searchMosques = useCallback(async (text: string, locationOverride?: UserLocation | null) => {
    setIsLoading(true);
    try {
      const term = text.trim();
      const activeLocation = locationOverride === undefined ? userLocation : locationOverride;
      const { data, error } = await supabase.rpc('search_mosques', { term: term === '' ? null : term });
      let rows: MosqueRow[];

      if (!error && Array.isArray(data)) {
        rows = data as MosqueRow[];
      } else {
        rows = await fetchMosqueFallback(term);
      }

      if (activeLocation) rows = await attachMissingCoordinates(rows);

      setMosques(sortMosques(withDistances(rows, activeLocation ?? null), activeLocation ?? null));
    } catch {
      setMosques([]);
    } finally {
      setIsLoading(false);
    }
  }, [attachMissingCoordinates, fetchMosqueFallback, userLocation]);

  useEffect(() => {
    void fetchFollowing();
  }, [fetchFollowing]);

  useEffect(() => {
    if (params.view === 'following' || params.view === 'nearby') {
      setViewMode(params.view);
    }
  }, [params.view]);

  useEffect(() => {
    const t = setTimeout(() => void searchMosques(query), 220);
    return () => clearTimeout(t);
  }, [query, searchMosques]);

  useFocusEffect(
    useCallback(() => {
      void fetchFollowing();
      void searchMosques(query);
    }, [fetchFollowing, query, searchMosques])
  );

  const handleNearMePress = useCallback(async () => {
    if (locationStatus === 'loading') return;
    setLocationStatus('loading');

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setUserLocation(null);
        setLocationStatus('denied');
        Alert.alert('Location permission needed', 'Allow location access to sort mosques nearest to you.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setUserLocation(nextLocation);
      setLocationStatus('enabled');
      setViewMode('nearby');
      await searchMosques(query, nextLocation);
    } catch {
      setUserLocation(null);
      setLocationStatus('unavailable');
      Alert.alert('Location unavailable', 'Could not get your current location. Please try again.');
    }
  }, [locationStatus, query, searchMosques]);

  const formatDistance = (km?: number | null) => {
    if (km == null || km <= 0) return null;
    if (km < 1) return `${km.toFixed(1)} km`;
    if (km < 1000) return `${km.toFixed(0)} km away`;
    return null;
  };

  const onFollow = async (id: string) => {
    if (!userId) {
      promptForSignIn(router, 'follow mosques');
      return;
    }
    const isFollowed = followingIds.has(id);
    if (!isFollowed && followedCount >= FOLLOWED_MOSQUE_LIMIT) {
      Alert.alert('Maximum Reached', `You can follow up to ${FOLLOWED_MOSQUE_LIMIT} mosques. Unfollow a mosque to follow a new one.`, [
        { text: 'Manage My Mosques', onPress: () => router.push(manageMosquesPath as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const next = new Set(followingIds);
    if (isFollowed) {
      await supabase.from('subscriptions').delete().eq('user_id', userId).eq('mosque_id', id);
      next.delete(id);
    } else {
      await supabase.from('subscriptions').insert({ user_id: userId, mosque_id: id });
      next.add(id);
    }
    setFollowingIds(next);
  };

  const openMosque = (mosque: MosqueRow) => {
    router.push({
      pathname: mosqueDetailPath,
      params: {
        id: mosque.id,
        name: mosque.name,
        city: mosque.city ?? '',
        country: mosque.country ?? '',
      },
    } as any);
  };

  const openNearbyLive = (mosque: NearbyMosque) => {
    router.push({
      pathname: isMuezzinContext ? '/(muezzin)/listener-now' : '/(user)/now',
      params: { mosqueId: mosque.id },
    } as any);
  };

  const openDirections = (mosque: NearbyMosque) => {
    const label = encodeURIComponent(mosque.name);
    const destination = `${mosque.latitude},${mosque.longitude}`;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destination}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
    void Linking.openURL(url);
  };

  const isSearching = query.trim().length > 0;
  const directoryMosques = isSearching
    ? mosques
    : viewMode === 'following'
      ? mosques.filter((mosque) => followingIds.has(mosque.id))
      : [];
  const directoryEmpty = !isLoading && directoryMosques.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          {isMuezzinContext ? (
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
              <Text style={styles.back}>{'‹'}</Text>
            </Pressable>
          ) : null}
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Mosques</Text>
            <Text style={styles.subtitle}>Find what is nearby or manage the mosques you follow.</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, city, or postcode"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearButton}>
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          )}
        </View>

        {!isSearching ? (
          <View style={styles.segmentedControl}>
            {(['nearby', 'following'] as const).map((mode) => {
              const selected = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setViewMode(mode)}
                  style={({ pressed }) => [
                    styles.segment,
                    selected && styles.segmentSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {mode === 'nearby' ? 'Nearby' : `Following (${followedCount})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!isSearching && viewMode === 'nearby' ? (
          <Pressable
            onPress={handleNearMePress}
            disabled={locationStatus === 'loading'}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.locationChip,
              hasNearbyLocation && styles.locationChipActive,
              !hasNearbyLocation && locationStatus !== 'idle' && styles.locationChipWarn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.locationText}>{locationChipText}</Text>
          </Pressable>
        ) : null}

        {(isSearching || viewMode === 'following') && userId ? (
          <View style={[styles.followStrip, atLimit && styles.followStripMax]}>
            <Text style={styles.followStripText}>{`Following ${followedCount} / ${FOLLOWED_MOSQUE_LIMIT} mosques`}</Text>
            {atLimit ? (
              <Text style={styles.followStripNote}>
                {`You have reached the maximum of ${FOLLOWED_MOSQUE_LIMIT} followed mosques.`}
              </Text>
            ) : null}
            <Pressable onPress={() => router.push(manageMosquesPath as any)} hitSlop={8} style={styles.manageButton}>
              <Text style={styles.manageLink}>Manage my mosques</Text>
            </Pressable>
          </View>
        ) : (isSearching || viewMode === 'following') ? (
          <View style={styles.followStrip}>
            <Text style={styles.followStripText}>Browsing as a guest</Text>
            <Text style={styles.guestStripNote}>
              {`Open any mosque page. Sign in to follow up to ${FOLLOWED_MOSQUE_LIMIT} mosques.`}
            </Text>
          </View>
        ) : null}

        {!isSearching && viewMode === 'nearby' ? (
          hasNearbyLocation ? (
            <NearYouNowCard
              mosques={nearby.mosques}
              loading={nearby.loading}
              error={nearby.error}
              freshAsOf={nearby.freshAsOf}
              onRefresh={() => void nearby.refetch()}
              onViewMosque={openMosque}
              onListen={openNearbyLive}
              onDirections={openDirections}
              limit={10}
            />
          ) : nearby.loading ? (
            <View style={styles.locationPrompt}>
              <ActivityIndicator color="#2F6B45" />
              <Text style={styles.locationPromptTitle}>Finding nearby mosques…</Text>
              <Text style={styles.locationPromptBody}>Checking your current area.</Text>
            </View>
          ) : (
            <View style={styles.locationPrompt}>
              <View style={styles.locationPromptIcon}>
                <Text style={styles.locationPromptGlyph}>⌖</Text>
              </View>
              <Text style={styles.locationPromptTitle}>See mosques near you</Text>
              <Text style={styles.locationPromptBody}>
                Use your current location to compare upcoming Adhan times and see what is LIVE nearby.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleNearMePress}
                style={({ pressed }) => [styles.locationPromptButton, pressed && styles.pressed]}
              >
                <Text style={styles.locationPromptButtonText}>Use my location</Text>
              </Pressable>
            </View>
          )
        ) : null}

        {(isSearching || viewMode === 'following') ? (
          <Text style={styles.contextHeader}>{isSearching ? 'Search results' : 'Following'}</Text>
        ) : null}

        {(isSearching || viewMode === 'following') && directoryEmpty && (
          isSearching ? (
            <View style={styles.missingCard}>
              <Text style={styles.missingTitle}>
                {query.trim().length > 0 ? `"${query.trim()}" isn't on Adhan Connect yet` : 'No mosques found'}
              </Text>
              <Text style={styles.missingBody}>
                Help us add it — takes 2 minutes and your congregation could be using Adhan Connect within days.
              </Text>
              <View style={styles.missingActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/(user)/mosque-onboarding-hub', params: { name: query.trim() } } as any)}
                  style={({ pressed }) => [styles.missingPrimary, pressed && styles.pressed]}
                >
                  <Text style={styles.missingPrimaryText}>Get it added</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setQuery('')}
                  style={({ pressed }) => [styles.missingGhost, pressed && styles.pressed]}
                >
                  <Text style={styles.missingGhostText}>Try another search</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No followed mosques yet</Text>
              <Text style={styles.emptySubtitle}>Search for a mosque and choose Follow.</Text>
            </View>
          )
        )}

        {!isMuezzinContext && !isLoading && directoryMosques.length > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/(user)/mosque-onboarding-hub', params: query.trim() ? { name: query.trim() } : {} } as any)}
            style={({ pressed }) => [styles.missingStrip, pressed && styles.pressed]}
          >
            <Text style={styles.missingStripText}>Don't see your mosque?</Text>
            <Text style={styles.missingStripLink}>Get it added →</Text>
          </Pressable>
        )}

        <View style={styles.list}>
          {directoryMosques.map((m) => {
            const isFollowed = followingIds.has(m.id);
            const disabled = !isFollowed && atLimit;
            const distanceLabel = formatDistance(m.distance_km);
            return (
              <View
                key={m.id}
                style={[styles.rowCard, styles.shadow]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${m.name}`}
                  onPress={() => openMosque(m)}
                  style={({ pressed }) => [
                    styles.rowMain,
                    pressed && styles.rowCardPressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {m.name}
                      </Text>
                      {m.is_live ? (
                        <View style={styles.livePill}>
                          <Text style={styles.livePillText}>🔴 Live now</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[m.city, m.country].filter(Boolean).join(', ')}
                    </Text>
                    {distanceLabel && <Text style={styles.rowMeta}>{distanceLabel}</Text>}
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    userId
                      ? `${isFollowed ? 'Unfollow' : 'Follow'} ${m.name}`
                      : `Sign in to follow ${m.name}`
                  }
                  onPress={() => void onFollow(m.id)}
                  style={({ pressed }) => [
                    isFollowed ? styles.btnOutline : styles.btnPrimary,
                    disabled && styles.btnDisabled,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={isFollowed ? styles.btnOutlineText : styles.btnPrimaryText}>
                    {userId ? (isFollowed ? 'Following' : 'Follow') : 'Sign in to follow'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10 },
  backButton: { width: 34, height: 38, alignItems: 'flex-start', justifyContent: 'center' },
  back: { fontSize: 34, lineHeight: 36, color: '#0F172A', fontWeight: '400' },
  titleCopy: { flex: 1, gap: 3 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#0F172A', letterSpacing: -0.6 },
  subtitle: { maxWidth: 340, color: '#64748B', fontSize: 13, lineHeight: 19, fontWeight: '500' },
  searchRow: { position: 'relative', marginTop: 10 },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clearButton: { position: 'absolute', right: 10, top: 12, padding: 6 },
  clearText: { fontSize: 16, color: '#94A3B8', fontWeight: '800' },
  locationChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  locationChipActive: { backgroundColor: '#DCFCE7' },
  locationChipWarn: { backgroundColor: '#FFF7ED' },
  locationText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
  segmentedControl: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 14,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#E9EEF3',
  },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentSelected: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  segmentTextSelected: { color: '#183526' },
  locationPrompt: {
    alignItems: 'center',
    marginTop: 16,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D4E4D7',
    backgroundColor: '#F0F6F1',
  },
  locationPromptIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#FFFFFF' },
  locationPromptGlyph: { color: '#2F6B45', fontSize: 25, fontWeight: '800' },
  locationPromptTitle: { marginTop: 14, color: '#183526', fontSize: 19, lineHeight: 24, fontWeight: '900' },
  locationPromptBody: { marginTop: 7, color: '#627466', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  locationPromptButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 22, borderRadius: 13, backgroundColor: '#2F6B45' },
  locationPromptButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  followStrip: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followStripMax: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  followStripText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
  followStripNote: { color: '#B45309', fontSize: 12, marginTop: 4 },
  guestStripNote: { color: '#475569', fontSize: 12, marginTop: 4, lineHeight: 17 },
  manageButton: { marginTop: 6, alignSelf: 'flex-start' },
  manageLink: { color: '#0EA5E9', fontWeight: '800', fontSize: 12 },
  contextHeader: { marginTop: 12, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  list: { marginTop: 12, gap: 10 },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowCardPressed: { opacity: 0.84 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  rowSub: { color: '#475569', fontSize: 13, marginTop: 2 },
  rowMeta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  livePill: { backgroundColor: '#FEE2E2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  livePillText: { color: '#B91C1C', fontWeight: '700', fontSize: 11 },
  btnPrimary: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnOutlineText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  btnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontWeight: '800', fontSize: 15, color: '#0F172A' },
  emptySubtitle: { color: '#64748B', fontSize: 13, marginTop: 6, textAlign: 'center' },

  missingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  missingTitle: { fontWeight: '900', fontSize: 16, color: '#0F172A', lineHeight: 22 },
  missingBody: { fontSize: 13, lineHeight: 19, color: '#64748B', fontWeight: '500' },
  missingActions: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  missingPrimary: {
    backgroundColor: '#2F6B45',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  missingPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  missingGhost: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  missingGhostText: { color: '#475569', fontWeight: '700', fontSize: 14 },

  missingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  missingStripText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  missingStripLink: { fontSize: 13, color: '#0EA5E9', fontWeight: '800' },

  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
