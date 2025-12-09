import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import DateSelector from '@/components/admin/DateSelector';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { getPrayerTimesByDate, PrayerTimesRow, upsertPrayerTimes } from '@/lib/api/admin/prayerTimes';
import { useAuth } from '@/lib/auth';

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
  const router = useRouter();
  const { authUser } = useAuth();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque();
  const userId = authUser?.id ?? '';

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
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState<Date | null>(null);
  const isIOS = Platform.OS === 'ios';

  const dateIso = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);
  const disableForNoMosque = !selectedMosque;

  useEffect(() => {
    const load = async () => {
      if (!selectedMosque) {
        setError(mosques.length ? null : null);
        setForm({
          fajr: emptyPair,
          dhuhr: emptyPair,
          asr: emptyPair,
          maghrib: emptyPair,
          isha: emptyPair,
        });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const row = await getPrayerTimesByDate(selectedMosque.mosqueId, dateIso);
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
  }, [selectedMosque?.mosqueId, dateIso, mosques.length]);

  const openTimePicker = (prayer: keyof PrayerTimeForm, field: 'adhan' | 'iqama') => {
    if (disableForNoMosque) return;
    setPickerState({ prayer, field });
    setTempValue(buildPickerValue(form[prayer][field], selectedDate));
    setShowPicker(true);
  };

  const handleSave = async () => {
    if (!selectedMosque) return;
    setSaving(true);
    setError(null);
    try {
      const payload = mapFormToRow(form, selectedDate);
      await upsertPrayerTimes(selectedMosque.mosqueId, dateIso, payload);
      Alert.alert('Saved', 'Prayer times updated.');
    } catch (e: any) {
      console.warn('save prayer times', e?.message ?? e);
      setError(e?.message ? `Could not save changes: ${e.message}` : 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTimePicked = (event: any, selected?: Date) => {
    if (!pickerState) return;
    if (!isIOS) {
      if (event?.type === 'set' && selected) {
        commitPickerValue(selected);
      }
      closePicker(false);
      return;
    }
    if (selected) setTempValue(selected);
  };

  const commitPickerValue = (value: Date) => {
    if (!pickerState) return;
    const hh = value.getHours().toString().padStart(2, '0');
    const mm = value.getMinutes().toString().padStart(2, '0');
    setForm((prev) => ({
      ...prev,
      [pickerState.prayer]: {
        ...prev[pickerState.prayer],
        [pickerState.field]: `${hh}:${mm}`,
      },
    }));
  };

  const closePicker = (commit = false) => {
    if (commit) {
      const valueToCommit =
        tempValue && !isNaN(tempValue.getTime())
          ? tempValue
          : pickerState
          ? buildPickerValue(form[pickerState.prayer][pickerState.field], selectedDate)
          : null;
      if (valueToCommit) commitPickerValue(valueToCommit);
    }
    setShowPicker(false);
    setPickerState(null);
    setTempValue(null);
  };

  const pickerValue = (() => {
    const candidate =
      tempValue && !isNaN(tempValue.getTime())
        ? tempValue
        : pickerState
        ? buildPickerValue(form[pickerState.prayer][pickerState.field], selectedDate)
        : null;
    if (candidate && !isNaN(candidate.getTime())) return candidate;
    return new Date(selectedDate);
  })();

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading...</Text>
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
      <AdminNavRow
        active="prayerTimes"
        onGoPrayerTimes={() => router.push('/(admin)/prayer-times')}
        onGoStaffRota={() => router.push('/(admin)/staff-rota')}
      />
      <View style={{ marginTop: 12 }}>
        <DateSelector date={selectedDate} onChange={setSelectedDate} />
      </View>
      {selectedMosque ? <Text style={styles.mosqueLabel}>Mosque: {selectedMosque.name}</Text> : null}

      {!selectedMosque && !mosques.length ? (
        <Text style={styles.infoText}>
          No admin mosque found. You can only manage prayer times for mosques where you are a local admin.
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6 }}>Loading prayer times...</Text>
        </View>
      ) : (
        prayers.map((p) => (
          <View key={p.key} style={[styles.card, disableForNoMosque && styles.cardDisabled]}>
            <Text style={styles.cardTitle}>{p.label}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Adhan</Text>
              <TimeButton label={form[p.key].adhan} onPress={() => openTimePicker(p.key, 'adhan')} disabled={disableForNoMosque} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Iqama</Text>
              <TimeButton label={form[p.key].iqama} onPress={() => openTimePicker(p.key, 'iqama')} disabled={disableForNoMosque} />
            </View>
          </View>
        ))
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={handleSave}
        disabled={saving || disableForNoMosque}
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, (saving || disableForNoMosque) && { opacity: 0.6 }]}
      >
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </Pressable>
      {pickerState && pickerValue ? (
        <Modal transparent visible={showPicker} animationType="fade" onRequestClose={() => closePicker(false)}>
          <Pressable style={styles.backdrop} onPress={() => closePicker(false)} />
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              onChange={handleTimePicked}
              display={isIOS ? 'spinner' : 'default'}
            />
            {isIOS ? (
              <View style={styles.pickerActions}>
                <Pressable onPress={() => closePicker(false)} style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.pickerBtnText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => closePicker(true)} style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={[styles.pickerBtnText, styles.pickerBtnPrimary]}>Done</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

function AdminNavRow({
  active,
  onGoPrayerTimes,
  onGoStaffRota,
}: {
  active: 'prayerTimes' | 'rota';
  onGoPrayerTimes: () => void;
  onGoStaffRota: () => void;
}) {
  return (
    <View style={styles.navRow}>
      <Pressable
        onPress={onGoPrayerTimes}
        disabled={active === 'prayerTimes'}
        style={({ pressed }) => [
          styles.navPill,
          active === 'prayerTimes' && styles.navPillActive,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={[styles.navText, active === 'prayerTimes' && styles.navTextActive]}>Prayer Times</Text>
      </Pressable>
      <Pressable
        onPress={onGoStaffRota}
        disabled={active === 'rota'}
        style={({ pressed }) => [
          styles.navPill,
          active === 'rota' && styles.navPillActive,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={[styles.navText, active === 'rota' && styles.navTextActive]}>Staff Rota</Text>
      </Pressable>
    </View>
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

function buildPickerValue(hm: string | null, baseDate: Date) {
  const d = new Date(baseDate);
  if (hm) {
    const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
    d.setHours(h, m, 0, 0);
  }
  return d;
}

function TimeButton({ label, onPress, disabled }: { label: string | null; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.timeBtn, pressed && !disabled && { opacity: 0.9 }, disabled && { opacity: 0.6 }]}
    >
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
  cardDisabled: { opacity: 0.6 },
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
  infoText: { marginTop: 8, color: '#475569' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  navPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  navPillActive: { backgroundColor: '#E0F2FE', borderColor: '#0EA5E9' },
  navText: { fontWeight: '700', color: '#0F172A' },
  navTextActive: { color: '#0C4A6E' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  pickerWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '30%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  pickerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E2E8F0' },
  pickerBtnText: { fontWeight: '700', color: '#0F172A' },
  pickerBtnPrimary: { color: '#0C4A6E' },
});
