// app/(tabs)/discover.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  distance_km?: number | null;
  is_live?: boolean | null;
};

const MAX_FOLLOW = 3;

export default function DiscoverMosques() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [query, setQuery] = useState('');
  const [locationEnabled] = useState<boolean>(true); // toggle when wiring permissions
  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const followedCount = useMemo(() => followingIds.size, [followingIds]);
  const atLimit = followedCount >= MAX_FOLLOW;
  const contextHeader = locationEnabled ? 'Nearby Mosques' : 'All Mosques';

  const sortMosques = (rows: MosqueRow[]) => {
    return [...rows].sort((a, b) => {
      if (locationEnabled) {
        if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
        if (a.distance_km != null) return -1;
        if (b.distance_km != null) return 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  const fetchFollowing = async () => {
    if (!userId) return;
    const { data } = await supabase.from('subscriptions').select('mosque_id').eq('user_id', userId);
    if (Array.isArray(data)) {
      setFollowingIds(new Set(data.map((d) => d.mosque_id)));
    }
  };

  const searchMosques = async (text: string) => {
    setIsLoading(true);
    try {
      const term = text.trim();
      const { data, error } = await supabase.rpc('search_mosques', { term: term === '' ? null : term });
      if (!error && Array.isArray(data)) {
        setMosques(sortMosques(data as MosqueRow[]));
      } else {
        const { data: fbData, error: fbError } = await supabase
          .from('mosques')
          .select('id,name,city,country')
          .ilike('name', term === '' ? '%' : `%${term}%`)
          .limit(50);
        if (fbError) throw fbError;
        setMosques(sortMosques((fbData as MosqueRow[]) ?? []));
      }
    } catch {
      setMosques([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowing();
    searchMosques('');
  }, [userId]);

  useEffect(() => {
    const t = setTimeout(() => searchMosques(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      fetchFollowing();
      searchMosques(query);
    }, [query, userId])
  );

  const formatDistance = (km?: number | null) => {
    if (km == null || km <= 0) return null;
    if (km < 1) return `${km.toFixed(1)} km`;
    if (km < 1000) return `${km.toFixed(0)} km away`;
    return null;
  };

  const onFollow = async (id: string) => {
    if (!userId) return;
    const isFollowed = followingIds.has(id);
    if (!isFollowed && followedCount >= MAX_FOLLOW) {
      Alert.alert('Maximum Reached', 'You can follow up to 3 mosques. Unfollow a mosque to follow a new one.', [
        { text: 'Manage My Mosques', onPress: () => router.push('/manage-mosques') },
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

  const emptyState = !isLoading && mosques.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>{'<'}</Text>
          </Pressable>
          <Text style={styles.title}>Discover Mosques</Text>
          <View style={{ width: 24 }} />
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

        <Pressable style={[styles.locationChip, !locationEnabled && styles.locationChipWarn]}>
          <Text style={styles.locationText}>{locationEnabled ? '📍 Near me' : '⚠️ Location unavailable'}</Text>
        </Pressable>

        <View style={[styles.followStrip, atLimit && styles.followStripMax]}>
          <Text style={styles.followStripText}>{`⭐ Following ${followedCount} / ${MAX_FOLLOW} mosques`}</Text>
          {atLimit && <Text style={styles.followStripNote}>You have reached the maximum of 3 followed mosques.</Text>}
          <Pressable onPress={() => router.push('/manage-mosques')} hitSlop={8} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Text style={styles.manageLink}>Manage my mosques</Text>
          </Pressable>
        </View>

        <Text style={styles.contextHeader}>{contextHeader}</Text>

        {emptyState && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No mosques found</Text>
            <Text style={styles.emptySubtitle}>Try a different name, city, or postcode.</Text>
          </View>
        )}

        <View style={styles.list}>
          {mosques.map((m) => {
            const isFollowed = followingIds.has(m.id);
            const disabled = !isFollowed && atLimit;
            const distanceLabel = formatDistance(m.distance_km);
            return (
              <View key={m.id} style={[styles.rowCard, styles.shadow]}>
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
                <Pressable
                  onPress={() => onFollow(m.id)}
                  style={({ pressed }) => [
                    isFollowed ? styles.btnOutline : styles.btnPrimary,
                    disabled && styles.btnDisabled,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={isFollowed ? styles.btnOutlineText : styles.btnPrimaryText}>{isFollowed ? 'Following' : 'Follow'}</Text>
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
  body: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  back: { fontSize: 22, color: '#0F172A', fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  searchRow: { position: 'relative', marginTop: 6 },
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
  locationChipWarn: { backgroundColor: '#FFF7ED' },
  locationText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
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
    minWidth: 88,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 88,
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
  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
