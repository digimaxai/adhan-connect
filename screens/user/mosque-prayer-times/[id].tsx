import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/back-button';
import { getDailyPrayerTimes } from '@/lib/api/prayerTimesUnified';
import { supabase } from '@/lib/supabase';
import { tokens } from '@/theme/tokens';
import { labelForPrayer, PrayerName } from '../../lib/adhans';

const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
type DayTimes = { date: Date; iso: string; adhan: Partial<Record<PrayerName, string | null>>; iqama: Partial<Record<PrayerName, string | null>> };

const hm = (d?: Date | null) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function MosquePrayerTimesPage() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [mosqueName, setMosqueName] = useState<string>(name ?? '');
  const [notOffered, setNotOffered] = useState<string[]>([]);
  const [days, setDays] = useState<DayTimes[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      const [m, ...rows] = await Promise.all([
        supabase.from('mosques').select('name,prayers_not_offered').eq('id', id).maybeSingle(),
        ...Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setHours(12, 0, 0, 0);
          d.setDate(d.getDate() + i);
          return getDailyPrayerTimes(id, d).then((n) => ({ d, n })).catch(() => ({ d, n: null }));
        }),
      ]);
      if (!alive) return;
      if (m.data) {
        setMosqueName(m.data.name ?? '');
        setNotOffered((m.data.prayers_not_offered as string[] | null) ?? []);
      }
      const list: DayTimes[] = rows.map(({ d, n }) => ({
        date: d,
        iso: isoOf(d),
        adhan: Object.fromEntries(PRAYERS.map((p) => [p, hm(n?.[p]?.adhan ?? null)])),
        iqama: Object.fromEntries(PRAYERS.map((p) => [p, hm(n?.[p]?.iqama ?? null)])),
      }));
      setDays(list);
      if (!list.some((x) => PRAYERS.some((p) => x.adhan[p]))) setError('Prayer times are not available for this mosque yet.');
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const day = days[selected];
  const hasIqama = useMemo(() => days.some((x) => PRAYERS.some((p) => x.iqama[p])), [days]);
  const nextKey = useMemo<PrayerName | null>(() => {
    if (!day || selected !== 0) return null;
    const now = new Date();
    for (const p of PRAYERS) {
      const v = day.adhan[p];
      if (!v) continue;
      const [h, m] = v.split(':').map(Number);
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
      if (t > now.getTime()) return p;
    }
    return null;
  }, [day, selected]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <ScreenHeader title="Prayer times" subtitle={mosqueName || undefined} fallbackHref="/(user)/listener-home" />

        {loading ? (
          <ActivityIndicator color="#0369A1" style={{ marginTop: 40 }} />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              {days.map((x, i) => {
                const on = i === selected;
                return (
                  <Pressable key={x.iso} onPress={() => setSelected(i)} style={[styles.dayChip, on && styles.dayChipOn]}>
                    <Text style={[styles.dayChipDow, on && styles.dayChipTextOn]}>{i === 0 ? 'Today' : x.date.toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
                    <Text style={[styles.dayChipDate, on && styles.dayChipTextOn]}>{x.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {!!error && <Text style={styles.error}>{error}</Text>}

            {day && (
              <View style={[styles.card, styles.shadow]}>
                <Text style={styles.cardTitle}>{day.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                <View style={styles.tableHead}>
                  <Text style={[styles.colLabel, { flex: 1, textAlign: 'left' }]}>Prayer</Text>
                  <Text style={styles.colLabel}>Adhan</Text>
                  {hasIqama && <Text style={styles.colLabel}>Iqamah</Text>}
                </View>
                {PRAYERS.map((p) => {
                  const off = notOffered.includes(p);
                  const next = p === nextKey && !off;
                  return (
                    <View key={p} style={[styles.row, next && styles.rowNext]}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.name, next && styles.nameNext]}>{labelForPrayer(p)}</Text>
                        {next && (
                          <View style={styles.nextPill}>
                            <Text style={styles.nextPillText}>Next</Text>
                          </View>
                        )}
                        {off && <Text style={styles.offText}>Not offered here</Text>}
                      </View>
                      <Text style={[styles.time, next && styles.timeNext, off && styles.timeOff]}>{off ? '—' : day.adhan[p] ?? '--:--'}</Text>
                      {hasIqama && <Text style={[styles.iqama, next && styles.timeNext, off && styles.timeOff]}>{off ? '—' : day.iqama[p] ?? '–'}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {days.length > 0 && (
              <View style={[styles.card, styles.shadow]}>
                <Text style={styles.cardTitle}>Next 7 days</Text>
                <View style={styles.weekHead}>
                  <Text style={[styles.colLabel, styles.weekDayCol, { textAlign: 'left' }]}>Day</Text>
                  {PRAYERS.map((p) => (
                    <Text key={p} style={[styles.colLabel, styles.weekCol]}>{labelForPrayer(p).slice(0, 3)}</Text>
                  ))}
                </View>
                {days.map((x, i) => (
                  <Pressable key={x.iso} onPress={() => setSelected(i)} style={[styles.weekRow, i === selected && styles.weekRowOn]}>
                    <Text style={[styles.weekDay, styles.weekDayCol]}>{i === 0 ? 'Today' : x.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</Text>
                    {PRAYERS.map((p) => (
                      <View key={p} style={styles.weekCol}>
                        <Text style={styles.weekTime}>{notOffered.includes(p) ? '—' : x.adhan[p] ?? '–'}</Text>
                        {hasIqama && <Text style={styles.weekIqama}>{notOffered.includes(p) ? '' : x.iqama[p] ?? ''}</Text>}
                      </View>
                    ))}
                  </Pressable>
                ))}
                {hasIqama && (
                  <View style={styles.legend}>
                    <Ionicons name="information-circle-outline" size={13} color={tokens.color.text.muted} />
                    <Text style={styles.legendText}>Adhan time on top, iqamah (congregation) time below.</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  dayStrip: { gap: 8, paddingVertical: 2 },
  dayChip: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tokens.color.border.subtle, minWidth: 64 },
  dayChipOn: { backgroundColor: '#0369A1', borderColor: '#0369A1' },
  dayChipDow: { fontSize: 11, fontWeight: '800', color: tokens.color.text.secondary },
  dayChipDate: { fontSize: 12, fontWeight: '700', color: tokens.color.text.primary, marginTop: 2 },
  dayChipTextOn: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 8 },
  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: tokens.color.text.primary, marginBottom: 4 },
  tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  colLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase', minWidth: 72, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderRadius: 10, paddingHorizontal: 6, marginHorizontal: -6 },
  rowNext: { backgroundColor: '#EFF6FF' },
  name: { fontWeight: '700', color: tokens.color.text.primary, fontSize: 15 },
  nameNext: { color: '#0369A1', fontWeight: '800' },
  nextPill: { backgroundColor: '#0369A1', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  nextPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  offText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  time: { minWidth: 72, textAlign: 'right', fontWeight: '800', color: tokens.color.text.primary, fontSize: 15, fontVariant: ['tabular-nums'] },
  iqama: { minWidth: 72, textAlign: 'right', fontWeight: '700', color: tokens.color.text.secondary, fontSize: 15, fontVariant: ['tabular-nums'] },
  timeNext: { color: '#0369A1' },
  timeOff: { color: tokens.color.text.muted },
  weekHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  weekDayCol: { width: 64, minWidth: 64 },
  weekCol: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  weekRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderRadius: 8, paddingHorizontal: 4, marginHorizontal: -4 },
  weekRowOn: { backgroundColor: '#F1F5F9' },
  weekDay: { fontSize: 12, fontWeight: '800', color: tokens.color.text.primary },
  weekTime: { fontSize: 12, fontWeight: '800', color: tokens.color.text.primary, fontVariant: ['tabular-nums'] },
  weekIqama: { fontSize: 10, fontWeight: '600', color: tokens.color.text.muted, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  legendText: { fontSize: 11, color: tokens.color.text.muted },
  error: { color: tokens.color.status.danger, fontSize: 13 },
});
