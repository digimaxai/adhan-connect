import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateSelector } from '../../components/admin/DateSelector';
import { useAuth } from '../../lib/auth';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { getPrayerTimesByDate } from '../../lib/api/admin/prayerTimes';
import { getMuezzinsForMosque, getStaffRotaByDate, StaffRotaRow, upsertStaffRotaForDate } from '../../lib/api/admin/staffRota';
import { getDailyPrayerTimes } from '../../lib/api/prayerTimesUnified';

type Assignment = {
  prayer: string;
  adhan_time: string | null;
  iqama_time: string | null;
  muezzin_user_id: string | null;
  notes: string;
};

const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export default function StaffRotaScreen() {
  const { authUser } = useAuth();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const userId = authUser?.id ?? '';
  const [mosqueId, setMosqueId] = useState<string | null>(null);
  const [mosqueName, setMosqueName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [muezzins, setMuezzins] = useState<{ user_id: string; name: string }[]>([]);
  const [pickerPrayer, setPickerPrayer] = useState<string | null>(null);

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
        const [times, rota, mz] = await Promise.all([
          getPrayerTimesByDate(mosqueId, dateIso),
          getStaffRotaByDate(mosqueId, dateIso),
          getMuezzinsForMosque(mosqueId),
        ]);
        setMuezzins(mz);
        let timesRow: any = times;
        if (!timesRow) {
          const normalized = await getDailyPrayerTimes(mosqueId, selectedDate);
          if (normalized) {
            timesRow = {
              fajr_adhan_time: normalized.fajr?.adhan ?? null,
              fajr_iqama_time: normalized.fajr?.iqama ?? null,
              dhuhr_adhan_time: normalized.dhuhr?.adhan ?? null,
              dhuhr_iqama_time: normalized.dhuhr?.iqama ?? null,
              asr_adhan_time: normalized.asr?.adhan ?? null,
              asr_iqama_time: normalized.asr?.iqama ?? null,
              maghrib_adhan_time: normalized.maghrib?.adhan ?? null,
              maghrib_iqama_time: normalized.maghrib?.iqama ?? null,
              isha_adhan_time: normalized.isha?.adhan ?? null,
              isha_iqama_time: normalized.isha?.iqama ?? null,
            };
          }
        }
        if (!timesRow) {
          setAssignments({});
          setError('Please create prayer times for this date before assigning staff.');
          return;
        }
        setError(null);
        const base: Record<string, Assignment> = {};
        prayers.forEach((p) => {
          base[p] = {
            prayer: p,
            adhan_time: (timesRow as any)[`${p}_adhan_time`] ?? null,
            iqama_time: (timesRow as any)[`${p}_iqama_time`] ?? null,
            muezzin_user_id: null,
            notes: '',
          };
        });
        rota.forEach((row: StaffRotaRow) => {
          const key = row.prayer_name;
          if (!base[key]) base[key] = { prayer: key, adhan_time: null, iqama_time: null, muezzin_user_id: null, notes: '' };
          base[key].muezzin_user_id = row.muezzin_user_id;
          base[key].adhan_time = row.adhan_time ?? base[key].adhan_time;
          base[key].iqama_time = row.iqama_time ?? base[key].iqama_time;
          base[key].notes = row.notes ?? '';
        });
        setAssignments(base);
      } catch (e: any) {
        console.warn('load staff rota', e?.message ?? e);
        setError('Unable to load staff rota.');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, dateIso]);

  const setAssignment = (prayer: string, patch: Partial<Assignment>) => {
    setAssignments((prev) => ({
      ...prev,
      [prayer]: { ...(prev[prayer] ?? { prayer, adhan_time: null, iqama_time: null, muezzin_user_id: null, notes: '' }), ...patch },
    }));
  };

  const handleSave = async () => {
    if (!mosqueId) return;
    setSaving(true);
    setError(null);
    try {
      const rows = Object.values(assignments).filter((a) => a.muezzin_user_id);
      if (!rows.length) {
        Alert.alert('No assignments', 'Please select at least one muezzin to assign.');
        return;
      }
      await upsertStaffRotaForDate(
        mosqueId,
        dateIso,
        rows.map((a) => ({
          prayer_name: a.prayer,
          muezzin_user_id: a.muezzin_user_id!,
          adhan_time: a.adhan_time,
          iqama_time: a.iqama_time,
          notes: a.notes,
          assigned_by: userId || undefined,
        }))
      );
      console.log('Assignments saved');
      Alert.alert('Saved', 'Staff assignments updated.');
    } catch (e: any) {
      console.warn('save staff rota', e?.message ?? e);
      setError('Unable to save assignments.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !!error && !assignments['fajr'];

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
      <Text style={styles.heading}>Staff Rota</Text>
      <Text style={styles.subheading}>Assign muezzins for selected day</Text>
      <View style={{ marginTop: 12 }}>
        <DateSelector date={selectedDate} onChange={setSelectedDate} />
      </View>
      {mosqueName ? <Text style={styles.mosqueLabel}>{mosqueName}</Text> : null}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6 }}>Loading staff rota…</Text>
        </View>
      ) : (
        prayers.map((p) => {
          const row = assignments[p];
          return (
            <View key={p} style={styles.card}>
              <Text style={styles.cardTitle}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              <Text style={styles.timeLabel}>
                Adhan {row?.adhan_time ? toTimeLabel(row.adhan_time) : '--:--'} · Iqama{' '}
                {row?.iqama_time ? toTimeLabel(row.iqama_time) : '--:--'}
              </Text>
              <Pressable
                onPress={() => setPickerPrayer(p)}
                disabled={disabled}
                style={({ pressed }) => [styles.selectBtn, pressed && { opacity: 0.9 }, disabled && { opacity: 0.5 }]}
              >
                <Text style={styles.selectText}>
                  {row?.muezzin_user_id
                    ? muezzins.find((m) => m.user_id === row.muezzin_user_id)?.name ?? 'Assigned'
                    : 'Select muezzin'}
                </Text>
              </Pressable>
              <TextInput
                style={styles.notes}
                placeholder="Notes (optional)"
                value={row?.notes ?? ''}
                onChangeText={(t) => setAssignment(p, { notes: t })}
                editable={!disabled}
              />
            </View>
          );
        })
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={handleSave}
        disabled={saving || disabled}
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, (saving || disabled) && { opacity: 0.5 }]}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Assignments'}</Text>
      </Pressable>

      <Modal transparent visible={!!pickerPrayer} animationType="fade" onRequestClose={() => setPickerPrayer(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerPrayer(null)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select muezzin</Text>
          {muezzins.map((m) => (
            <Pressable
              key={m.user_id}
              onPress={() => {
                if (pickerPrayer) setAssignment(pickerPrayer, { muezzin_user_id: m.user_id });
                setPickerPrayer(null);
              }}
              style={({ pressed }) => [styles.modalItem, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.modalItemText}>{m.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setPickerPrayer(null)} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

function toTimeLabel(val: string) {
  const d = new Date(val);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  timeLabel: { color: '#475569' },
  selectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  selectText: { fontWeight: '700', color: '#0F172A' },
  notes: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  error: { color: '#DC2626', marginTop: 8 },
  saveBtn: {
    marginTop: 18,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  modalCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '30%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  modalTitle: { fontWeight: '800', fontSize: 16, color: '#0F172A' },
  modalItem: { paddingVertical: 10 },
  modalItemText: { fontWeight: '700', color: '#0F172A' },
  modalClose: { marginTop: 8, alignSelf: 'flex-end' },
  modalCloseText: { color: '#0EA5E9', fontWeight: '700' },
});
