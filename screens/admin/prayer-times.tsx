import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../lib/auth';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { getPrayerTimesByDate, PrayerTimesRow, upsertPrayerTimes } from '../../lib/api/admin/prayerTimes';
import DateSelector from '../../components/admin/DateSelector';

const prayers: Array<{ key: keyof PrayerTimeForm; label: string }> = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

type PrayerTimeForm = {
  fajr: TimePair;
  dhuhr: TimePair;
  asr: TimePair;
  maghrib: TimePair;
  isha: TimePair;
};

type TimePair = { adhan: string | null; iqama: string | null };

const emptyPair: TimePair = { adhan: null, iqama: null };

export default function PrayerTimesAdminScreen() {
  const { authUser } = useAuth();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const userId = authUser?.id ?? '';

  const [mosqueId, setMosqueId] = useState<string | null>(null);
  const [mosqueName, setMosqueName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PrayerTimeForm>({
    fajr: emptyPair,
    dhuhr: emptyPair,
    asr: emptyPair,
    maghrib: emptyPair,
    isha: emptyPair,
  });
  const [pickerState, setPickerState] = useState<{ prayer: keyof PrayerTimeForm; field: 'adhan' | 'iqama' } | null>(null);

  const dateIso = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);

  useEffect(() => {
    const loadAdminMosque = async () => {
      if (!userId || !isAdmin) return;
      const { data, error: err } = await supabase
        .from('mosque_admins')
        .select('mosque_id, mosques(name)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (err) {
        setError('Unable to load mosque access.');
        return;
      }
      if (data) {
        setMosqueId((data as any).mosque_id);
        setMosqueName((data as any).mosques?.name ?? 'Mosque');
      } else {
        setError('No admin mosque found.');
      }
    };
    loadAdminMosque();
  }, [userId, isAdmin]);

  useEffect(() => {
    const load = async () => {
      if (!mosqueId) return;
      setLoading(true);
      setError(null);
      try {
        const row = await getPrayerTimesByDate(mosqueId, dateIso);
        if (row) {
          setForm(mapRowToForm(row));
        } else {
          setForm({
            fajr: emptyPair,
            dhuhr: emptyPair,
            asr: emptyPair,
            maghrib: emptyPair,
            isha: emptyPair,
          });
        }
      } catch (e: any) {
        console.warn('load prayer times', e?.message ?? e);
        setError('Unable to load prayer times.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mosqueId, dateIso]);

  const openTimePicker = (prayer: keyof PrayerTimeForm, field: 'adhan' | 'iqama') => {
    setPickerState({ prayer, field });
  };

  const handleSave = async () => {
    if (!mosqueId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = mapFormToRow(form, selectedDate);
      payload.updated_by = userId || null;
      await upsertPrayerTimes(mosqueId, dateIso, payload);
      Alert.alert('Saved', 'Prayer times updated.');
    } catch (e: any) {
      console.warn('save prayer times', e?.message ?? e);
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTimePicked = (_: any, selected?: Date) => {
    if (Platform.OS !== 'ios') setPickerState(null);
    if (!selected || !pickerState) return;
    const hh = selected.getHours().toString().padStart(2, '0');
    const mm = selected.getMinutes().toString().padStart(2, '0');
    setForm((prev) => ({
      ...prev,
      [pickerState.prayer]: {
        ...prev[pickerState.prayer],
        [pickerState.field]: `${hh}:${mm}`,
      },
    }));
  };

  const pickerValue = (() => {
    if (!pickerState) return null;
    const base = form[pickerState.prayer][pickerState.field];
    const d = new Date(selectedDate);
    if (base) {
      const [h, m] = base.split(':').map((n) => parseInt(n, 10));
      d.setHours(h, m, 0, 0);
    }
    return d;
  })();

  if (roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text>You do not have admin access.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Prayer Times</Text>
      <Text style={styles.subheading}>Manage adhan and iqama times</Text>
      <View style={{ marginTop: 12 }}>
        <DateSelector date={selectedDate} onChange={setSelectedDate} />
      </View>
      {mosqueName ? <Text style={styles.mosqueLabel}>{mosqueName}</Text> : null}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6 }}>Loading prayer times…</Text>
        </View>
      ) : (
        prayers.map((p) => (
          <View key={p.key} style={styles.card}>
            <Text style={styles.cardTitle}>{p.label}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Adhan</Text>
              <TimeButton label={form[p.key].adhan} onPress={() => openTimePicker(p.key, 'adhan')} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Iqama</Text>
              <TimeButton label={form[p.key].iqama} onPress={() => openTimePicker(p.key, 'iqama')} />
            </View>
          </View>
        ))
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={handleSave} disabled={saving || !mosqueId} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
      </Pressable>
      {pickerState && pickerValue ? (
        <DateTimePicker value={pickerValue} mode="time" onChange={handleTimePicked} />
      ) : null}
    </ScrollView>
  );
}

function mapRowToForm(row: PrayerTimesRow): PrayerTimeForm {
  return {
    fajr: { adhan: toHm(row.fajr_adhan_time), iqama: toHm(row.fajr_iqama_time) },
    dhuhr: { adhan: toHm(row.dhuhr_adhan_time), iqama: toHm(row.dhuhr_iqama_time) },
    asr: { adhan: toHm(row.asr_adhan_time), iqama: toHm(row.asr_iqama_time) },
    maghrib: { adhan: toHm(row.maghrib_adhan_time), iqama: toHm(row.maghrib_iqama_time) },
    isha: { adhan: toHm(row.isha_adhan_time), iqama: toHm(row.isha_iqama_time) },
  };
}

function mapFormToRow(form: PrayerTimeForm, date: Date): Partial<PrayerTimesRow> {
  return {
    fajr_adhan_time: combine(date, form.fajr.adhan),
    fajr_iqama_time: combine(date, form.fajr.iqama),
    dhuhr_adhan_time: combine(date, form.dhuhr.adhan),
    dhuhr_iqama_time: combine(date, form.dhuhr.iqama),
    asr_adhan_time: combine(date, form.asr.adhan),
    asr_iqama_time: combine(date, form.asr.iqama),
    maghrib_adhan_time: combine(date, form.maghrib.adhan),
    maghrib_iqama_time: combine(date, form.maghrib.iqama),
    isha_adhan_time: combine(date, form.isha.adhan),
    isha_iqama_time: combine(date, form.isha.iqama),
  };
}

function toHm(val?: string | null) {
  if (!val) return null;
  const d = new Date(val);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function combine(day: Date, hm: string | null) {
  if (!hm) return null;
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function TimeButton({ label, onPress }: { label: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.timeBtn, pressed && { opacity: 0.9 }]}>
      <Text style={styles.timeText}>{label ?? '--:--'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subheading: { color: '#475569' },
  mosqueLabel: { marginTop: 6, color: '#0F172A', fontWeight: '700' },
  loader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#475569', fontWeight: '700' },
  timeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    minWidth: 80,
    alignItems: 'center',
  },
  timeText: { fontWeight: '800', color: '#0F172A' },
  saveBtn: {
    marginTop: 18,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  error: { color: '#DC2626', marginTop: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
