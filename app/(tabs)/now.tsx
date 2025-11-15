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
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalPlay, setGlobalPlay] = useState(false);

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
    const { data, error } = await supabase
      .from('streams')
      .select('id, mosque_id, type, url, status, is_live')
      .eq('status', 'active')
      .limit(50);
    if (error) setError(error.message);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const Header = () => (
    <View style={[styles.header, { paddingTop: topPad + 8 }]}>
      {/* Top row: title + pill */}
      <View style={styles.headerTopRow}>
        <Text style={styles.h1}>Now Playing</Text>
        <Pressable
          onPress={() => setGlobalPlay(!globalPlay)}
          style={[styles.allPill, globalPlay ? styles.allPause : styles.allPlay]}
          accessibilityRole="button"
          accessibilityLabel={globalPlay ? 'Pause all streams' : 'Play all streams'}
        >
          <Text style={styles.allText}>{globalPlay ? 'Pause All' : 'Play All'}</Text>
        </Pressable>
      </View>

      {/* Subtitle on its own line so nothing overlaps */}
      <Text style={styles.subtleSmall}>Tap Play All or control each stream below</Text>
    </View>
  );

  if (loading) return (<SafeAreaView style={styles.screen}><Header /><Text style={styles.subtle}>Loading…</Text></SafeAreaView>);
  if (error)   return (<SafeAreaView style={styles.screen}><Header /><Text style={styles.error}>Error: {error}</Text></SafeAreaView>);
  if (!rows.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <Text style={styles.subtle}>No active streams found.</Text>
        <Text style={styles.tip}>Add a stream in Supabase → streams (type=hls, status=active, is_live=true).</Text>
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
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<Header />}
        ListHeaderComponentStyle={{ marginBottom: 8 }}
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
              globalPlay={globalPlay}
            />

            <Text style={styles.url} numberOfLines={1}>
              {item.url}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // layout
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, backgroundColor: '#F8FAFC' },

  // header
  header: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingBottom: 8 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },

  // play-all pill
  allPill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  allPlay: { backgroundColor: '#0EA5E9' },
  allPause: { backgroundColor: '#475569' },
  allText: { color: '#fff', fontWeight: '800' },

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
