// app/(tabs)/now.tsx
import { Audio } from 'expo-av';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import AudioPlayer from '../../lib/AudioPlayer';
import { supabase } from '../../lib/supabase';

type StreamRow = {
  id: string;
  mosque_id: string;
  type: string;
  url: string;
  status: string;
  is_live: boolean;
};

export default function NowScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [followedStreams, setFollowedStreams] = useState<StreamRow[]>([]);
  const [otherStreams, setOtherStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

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

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [subsRes, streamsRes] = await Promise.all([
        userId
          ? supabase
              .from('subscriptions')
              .select('mosque_id')
              .eq('user_id', userId)
          : Promise.resolve({ data: [] as { mosque_id: string }[], error: null }),
        supabase
          .from('streams')
          .select('id, mosque_id, type, url, status, is_live')
          .eq('status', 'active')
          .eq('is_live', true)
          .limit(100),
      ]);

      if (streamsRes.error) throw streamsRes.error;

      const streams = (streamsRes.data ?? []) as StreamRow[];
      const subIds = new Set((subsRes.data ?? []).map((s) => s.mosque_id));

      const followed = streams.filter((s) => subIds.has(s.mosque_id));
      const others = streams.filter((s) => !subIds.has(s.mosque_id));

      setFollowedStreams(followed);
      setOtherStreams(others);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load streams');
      setFollowedStreams([]);
      setOtherStreams([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Realtime live status updates
  useEffect(() => {
    const channel = supabase
      .channel('live-streams')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          const isLiveActive = row.status === 'active' && row.is_live;

          const updater = (items: StreamRow[]) => {
            const idx = items.findIndex((s) => s.id === row.id);
            if (!isLiveActive && idx === -1) return items;
            if (!isLiveActive && idx !== -1) {
              const copy = [...items];
              copy.splice(idx, 1);
              return copy;
            }
            const updated: StreamRow = {
              id: row.id,
              mosque_id: row.mosque_id,
              type: row.type,
              url: row.url,
              status: row.status,
              is_live: row.is_live,
            };
            if (idx === -1) return [...items, updated];
            const copy = [...items];
            copy[idx] = updated;
            return copy;
          };

          setFollowedStreams((prev) => updater(prev));
          setOtherStreams((prev) => updater(prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const Header = () => (
    <View style={[styles.header, { paddingTop: topPad + 8 }]}>
      <Text style={styles.h1}>Now Playing</Text>
      <Text style={styles.subtleSmall}>Tap a stream to play; only one plays at a time</Text>
    </View>
  );

  if (loading)
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <Text style={styles.subtle}>Loading...</Text>
      </SafeAreaView>
    );
  if (error)
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <Text style={styles.error}>Error: {error}</Text>
      </SafeAreaView>
    );
  if (!followedStreams.length && !otherStreams.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <Text style={styles.subtle}>No active streams found.</Text>
        <Text style={styles.tip}>
          Add a stream in Supabase -> streams (type=hls, status=active, is_live=true).
        </Text>
        <Pressable onPress={load} style={[styles.refreshBtn, styles.shadow]}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={followedStreams}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<Header />}
        ListHeaderComponentStyle={{ marginBottom: 8 }}
        ListEmptyComponent={
          !loading && (
            <Text style={styles.subtle}>You have no live streams from followed mosques.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, styles.shadow]}>
            <View style={styles.cardTopRow}>
              <Text style={styles.badge}>{item.type?.toUpperCase() || 'STREAM'}</Text>
              <Text style={[styles.live, item.is_live ? styles.liveOn : styles.liveOff]}>
                {item.is_live ? 'LIVE' : 'Idle'}
              </Text>
            </View>

            <AudioPlayer
              url={item.url}
              mosqueName={`Mosque ${item.mosque_id.slice(0, 6)}`}
              isActive={activeId === item.id}
              onRequestPlay={() => setActiveId(item.id)}
            />

            <Text style={styles.url} numberOfLines={1}>
              {item.url}
            </Text>
          </View>
        )}
      />

      {!!otherStreams.length && (
        <FlatList
          data={otherStreams}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.listContent, { paddingTop: 0, paddingBottom: 40 }]}
          ListHeaderComponent={
            <View style={[styles.header, { paddingHorizontal: 16 }]}>
              <Text style={styles.sectionLabel}>Other live streams</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, styles.shadow]}>
              <View style={styles.cardTopRow}>
                <Text style={styles.badge}>{item.type?.toUpperCase() || 'STREAM'}</Text>
                <Text style={[styles.live, item.is_live ? styles.liveOn : styles.liveOff]}>
                  {item.is_live ? 'LIVE' : 'Idle'}
                </Text>
              </View>

              <AudioPlayer
                url={item.url}
                mosqueName={`Mosque ${item.mosque_id.slice(0, 6)}`}
                isActive={activeId === item.id}
                onRequestPlay={() => setActiveId(item.id)}
              />

              <Text style={styles.url} numberOfLines={1}>
                {item.url}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // layout
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, backgroundColor: '#F8FAFC' },

  // header
  header: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingBottom: 8 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },

  // cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  shadow: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 3 },
  }) as object,

  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: {
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    overflow: 'hidden',
  },
  live: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    overflow: 'hidden',
    color: '#fff',
  },
  liveOn: { backgroundColor: '#EF4444' },
  liveOff: { backgroundColor: '#94A3B8' },

  // text
  subtle: { color: '#64748B', marginTop: 8, paddingHorizontal: 16 },
  subtleSmall: { color: '#94A3B8', marginTop: 6, fontSize: 12 },
  tip: { color: '#94A3B8', marginTop: 6, fontSize: 12, fontStyle: 'italic', paddingHorizontal: 16 },
  url: { color: '#475569', marginTop: 10, fontSize: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 8 },

  // empty refresh
  refreshBtn: {
    marginTop: 10,
    marginLeft: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#0EA5E9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshText: { color: '#fff', fontWeight: '700' },

  // errors
  error: { color: '#B91C1C', marginTop: 8, paddingHorizontal: 16 },
});
