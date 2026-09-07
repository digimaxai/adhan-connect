import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { nextFridayDate, formatJumuahTime } from '../../lib/jumuah';
import { supabase } from '../../lib/supabase';

type Counts = { id: string; capacity: number | null; attendees: number; parties: number };
type Summary = {
  events: (Counts & { title: string; start_at: string; likes: number; favourites: number })[];
  friday: (Counts & { label: string; salah_at: string; venue: string | null })[];
  friday_date: string;
};

function Capacity({ row }: { row: Counts }) {
  const percent = row.capacity ? Math.round(row.attendees / row.capacity * 100) : null;
  return <>
    <Text style={styles.count}>{row.attendees} attending · {row.parties} {row.parties === 1 ? 'party' : 'parties'}</Text>
    <Text style={styles.detail}>{row.capacity ? `${Math.max(0, row.capacity - row.attendees)} spaces left · ${percent}% of ${row.capacity} capacity` : 'No capacity limit set'}</Text>
    {percent !== null ? <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, percent)}%`, backgroundColor: percent >= 85 ? '#B45309' : '#059669' }]} /></View> : null}
  </>;
}

export function EngagementOverview({ mosqueId, refreshKey }: { mosqueId: string; refreshKey: number }) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setData(null); setError(false);
    void supabase.rpc('get_mosque_engagement', { p_mosque_id: mosqueId, p_friday_date: nextFridayDate() })
      .then(({ data: result, error: failure }) => {
        if (!active) return;
        setError(!!failure); setData(failure ? null : result as Summary); setLoading(false);
      });
    return () => { active = false; };
  // Pull-to-refresh and explicit retries must reload this dashboard section.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, refreshKey, retry]));

  return <View style={styles.card}>
    <Text style={styles.title}>Attendance & engagement</Text>
    <Text style={styles.detail}>Attendance plans help you prepare; they are not checked-in headcounts.</Text>
    {loading ? <ActivityIndicator /> : error ? <>
      <Text style={styles.error}>Unable to load attendance information.</Text>
      <Pressable accessibilityRole="button" style={styles.retry} onPress={() => setRetry(x => x + 1)}><Text style={styles.count}>Retry</Text></Pressable>
    </> : data ? <>
      <Text style={styles.heading}>Friday Jumu’ah · {new Date(`${data.friday_date}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text>
      {!data.friday.length ? <Text style={styles.detail}>No active Friday slots.</Text> : data.friday.map(row => <View key={row.id} style={styles.row}>
        <Text style={styles.name}>{row.label} · {formatJumuahTime(row.salah_at)}</Text>
        {row.venue ? <Text style={styles.detail}>{row.venue}</Text> : null}
        <Capacity row={row} />
      </View>)}
      <Text style={styles.heading}>Upcoming events</Text>
      {!data.events.length ? <Text style={styles.detail}>No upcoming published events.</Text> : data.events.map(row => <View key={row.id} style={styles.row}>
        <Text style={styles.name}>{row.title}</Text>
        <Text style={styles.detail}>{new Date(row.start_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
        <Capacity row={row} />
        <View style={styles.reactions}>
          <Text style={styles.metric}>♡ {row.likes} likes</Text>
          <Text style={styles.metric}>☆ {row.favourites} favourites</Text>
        </View>
      </View>)}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 18, padding: 18, gap: 12 },
  title: { color: '#0F172A', fontSize: 19, fontWeight: '800' },
  heading: { color: '#334155', fontSize: 14, fontWeight: '700', marginTop: 6 },
  row: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, gap: 7 },
  name: { color: '#0F172A', fontSize: 15, fontWeight: '700' },
  count: { color: '#047857', fontSize: 14, fontWeight: '700' },
  detail: { color: '#64748B', fontSize: 12, lineHeight: 18 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { color: '#475569', fontSize: 13, fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 13 },
  retry: { minHeight: 44, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  fill: { height: 5 },
});
