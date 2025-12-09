import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import DateSelector from '@/components/admin/DateSelector';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { getPrayerTimesByDate } from '@/lib/api/admin/prayerTimes';
import {
  getMuezzinsForMosque,
  getStaffRotaForDate,
  MuezzinSummary,
  saveStaffRotaForDate,
  StaffRotaForDay,
} from '@/lib/api/admin/staffRota';
import { normalizePrayerTimes, NormalizedPrayerTimes } from '@/lib/api/prayerTimesUnified';
import { PrayerName } from '@/lib/adhans';
import { supabase } from '@/lib/supabase';

const prayers: Array<{ key: PrayerName; label: string }> = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

// Simple in-memory cache to preserve selections across tab navigations.
const rotaCache: Record<string, StaffRotaForDay> = {};
const storageCache: Record<string, StaffRotaForDay> = {};

const safeStorage = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    return (mod.default ?? mod) as {
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => Promise<void>;
    };
  } catch {
    return {
      getItem: async () => null,
      setItem: async () => {},
    };
  }
})();

export default function StaffRotaScreen() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rota, setRota] = useState<StaffRotaForDay | null>(null);
  const [muezzins, setMuezzins] = useState<MuezzinSummary[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerPrayer, setPickerPrayer] = useState<PrayerName | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const dateIso = useMemo(() => formatLocalDate(selectedDate), [selectedDate]);
  const disableControls = !selectedMosque || loadingData || saving || !prayerTimes;

  const cacheKey = selectedMosque ? `${selectedMosque.mosqueId}:${dateIso}` : null;
  const lastDateKey = 'staff_rota:last_selected_date';

  // Load last selected date (persisted) on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await safeStorage.getItem(lastDateKey);
        if (cancelled || !raw) return;
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          setSelectedDate(parsed);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCachedRota = React.useCallback(
    (rotaVal: StaffRotaForDay | null) => {
      if (!cacheKey || !rotaVal) return;
      rotaCache[cacheKey] = rotaVal;
      storageCache[cacheKey] = rotaVal;
      safeStorage.setItem(`staff_rota_cache:${cacheKey}`, JSON.stringify(rotaVal)).catch(() => {});
    },
    [cacheKey]
  );

  const getCachedRota = React.useCallback((): StaffRotaForDay | null => {
    if (!cacheKey) return null;
    if (rotaCache[cacheKey]) return rotaCache[cacheKey];
    if (storageCache[cacheKey]) return storageCache[cacheKey];
    return null;
  }, [cacheKey]);

  // Load persisted cache on key change
  useEffect(() => {
    let cancelled = false;
    if (!cacheKey) return;
    safeStorage
      .getItem(`staff_rota_cache:${cacheKey}`)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        storageCache[cacheKey] = parsed;
        setRota((prev) => prev ?? parsed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const loadData = React.useCallback(async () => {
    if (!selectedMosque) {
      return;
    }
    setLoadingData(true);
    setError(null);
    setNotice(null);
    const cached = getCachedRota();
    if (cached) {
      setRota(cached);
    }
    try {
      const [timesRow, rotaMap, muezzinList] = await Promise.all([
        getPrayerTimesByDate(selectedMosque.mosqueId, dateIso),
        getStaffRotaForDate(selectedMosque.mosqueId, selectedDate),
        getMuezzinsForMosque(selectedMosque.mosqueId),
      ]);
      console.log('[StaffRota] load', { mosqueId: selectedMosque.mosqueId, dateIso, rotaCount: Object.keys(rotaMap ?? {}).length });
      const normalizedTimes = normalizePrayerTimes(timesRow as any);
      setPrayerTimes(normalizedTimes);
      setMuezzins(muezzinList);
      const profileNameMap = await buildNameMap(muezzinList, rotaMap);
      setNameMap(profileNameMap);
      const base = emptyRota(normalizedTimes);
      const merged = mergeRota(base, rotaMap);
      const hasServerRows = rotaMap && Object.keys(rotaMap).length > 0;
      if (!hasServerRows && cached) {
        setRota(cached);
        setCachedRota(cached);
        setNotice('Showing cached assignments (no server rows returned). Please verify admin access for staff rota.');
      } else {
        setRota(merged);
        setCachedRota(merged);
        if (!hasServerRows) {
          setNotice('No assignments returned from server. If you expect data, check staff_rota RLS for your admin user.');
        }
      }
      if (!timesRow) {
        setError('Please create prayer times for this date before assigning staff.');
      }
      if ((muezzinList ?? []).length === 0) {
        setError((prev) => prev ?? 'No active muezzins found. If you expect options, please ensure admin access to the muezzins table.');
      }
    } catch (e: any) {
      console.warn('load staff rota', e?.message ?? e);
      setError('Unable to load staff rota.');
      setPrayerTimes(null);
      setRota(emptyRota(null));
    } finally {
      setLoadingData(false);
    }
  }, [selectedMosque?.mosqueId, selectedDate, dateIso]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectMuezzin = (prayer: PrayerName, userId: string) => {
    setRota((prev) => {
      const base = prev ?? emptyRota(prayerTimes);
      const next = { ...base };
      next[prayer] = {
        muezzinUserId: userId,
        notes: base[prayer]?.notes ?? '',
        adhanTime: prayerTimes?.[prayer]?.adhan ?? base[prayer]?.adhanTime ?? null,
        iqamaTime: prayerTimes?.[prayer]?.iqama ?? base[prayer]?.iqamaTime ?? null,
      };
      setCachedRota(next);
      return next;
    });
  };

  const handleNotesChange = (prayer: PrayerName, text: string) => {
    setRota((prev) => {
      const base = prev ?? emptyRota(prayerTimes);
      const next = { ...base };
      next[prayer] = {
        muezzinUserId: base[prayer]?.muezzinUserId ?? null,
        notes: text,
        adhanTime: prayerTimes?.[prayer]?.adhan ?? base[prayer]?.adhanTime ?? null,
        iqamaTime: prayerTimes?.[prayer]?.iqama ?? base[prayer]?.iqamaTime ?? null,
      };
      setCachedRota(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedMosque || !rota || !prayerTimes) return;
    const hasAssignments = Object.values(rota).some((r) => r?.muezzinUserId);
    if (!hasAssignments) {
      setError('Select at least one muezzin before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const assignedBy = authData?.user?.id;
      if (authError || !assignedBy) {
        setError('Unable to verify your account. Please re-login.');
        return;
      }
      console.log('[StaffRota] save', {
        mosqueId: selectedMosque.mosqueId,
        dateIso,
        assignments: rota,
        assignedBy,
      });
      const result = await saveStaffRotaForDate(selectedMosque.mosqueId, selectedDate, rota, assignedBy);
      if (!result.success) {
        setError(result.error ?? 'Unable to save assignments.');
      } else {
        const msg = `Saved staff rota for ${dateIso} (${selectedMosque.name}).`;
        setNotice(msg);
        Alert.alert('Saved', 'Staff rota saved.');
        setCachedRota(rota);
      }
    } catch (e: any) {
      console.warn('save staff rota', e?.message ?? e);
      setError('Unable to save assignments.');
    } finally {
      setSaving(false);
    }
  };

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

  const noAdminMosque = !selectedMosque && !mosques.length;
  const hasPrayerTimes = !!prayerTimes;
  const currentRota = rota ?? emptyRota(prayerTimes);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Staff Rota</Text>
      <Text style={styles.subheading}>Assign muezzins for the selected day</Text>
      <AdminNavRow
        active="rota"
        onGoPrayerTimes={() => router.push('/(admin)/prayer-times')}
        onGoStaffRota={() => router.push('/(admin)/staff-rota')}
      />
      <View style={{ marginTop: 12 }}>
        <DateSelector
          date={selectedDate}
          onChange={(d) => {
            setSelectedDate(d);
            safeStorage.setItem(lastDateKey, d.toISOString()).catch(() => {});
          }}
        />
      </View>
      {selectedMosque ? <Text style={styles.mosqueLabel}>Mosque: {selectedMosque.name}</Text> : null}

      {noAdminMosque ? (
        <Text style={styles.infoText}>
          No admin mosque found. You can only assign staff for mosques where you are a local admin.
        </Text>
      ) : null}

      {loadingData ? (
        <View style={styles.loader}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6 }}>Loading staff rota...</Text>
        </View>
      ) : (
        prayers.map((p) => {
          const row = currentRota[p.key];
          const selectedName = row?.muezzinUserId
            ? nameMap[row.muezzinUserId] ??
              muezzins.find((m) => m.userId === row.muezzinUserId || m.user_id === row.muezzinUserId)?.displayName ??
              muezzins.find((m) => m.user_id === row.muezzinUserId)?.name ??
              row.muezzinUserId
            : 'Select muezzin';
          return (
            <View key={p.key} style={[styles.card, disableControls && styles.cardDisabled]}>
              <Text style={styles.cardTitle}>{p.label}</Text>
              <Text style={styles.timeLabel}>
                Adhan {formatTimeOrDash(row?.adhanTime)} | Iqama {formatTimeOrDash(row?.iqamaTime)}
              </Text>
              <Pressable
                onPress={() => setPickerPrayer(p.key)}
                disabled={disableControls}
                style={({ pressed }) => [styles.selectBtn, pressed && !disableControls && { opacity: 0.9 }, disableControls && { opacity: 0.5 }]}
              >
                <Text style={styles.selectText}>{selectedName}</Text>
              </Pressable>
              <TextInput
                style={styles.notes}
                placeholder="Notes (optional)"
                value={row?.notes ?? ''}
                onChangeText={(t) => handleNotesChange(p.key, t)}
                editable={!disableControls}
              />
            </View>
          );
        })
      )}
      {!hasPrayerTimes && !loadingData ? (
        <Text style={styles.infoText}>Please create prayer times for this date before assigning staff.</Text>
      ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Pressable
          onPress={handleSave}
          disabled={saving || disableControls || !rota}
        style={({ pressed }) => [styles.saveBtn, pressed && !saving && !disableControls && { opacity: 0.9 }, (saving || disableControls || !rota) && { opacity: 0.5 }]}
      >
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Assignments'}</Text>
      </Pressable>

      <Modal transparent visible={!!pickerPrayer} animationType="fade" onRequestClose={() => setPickerPrayer(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerPrayer(null)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select muezzin</Text>
          {muezzins.length === 0 ? <Text style={styles.infoText}>No active muezzins found.</Text> : null}
          {muezzins.map((m) => (
            <Pressable
              key={m.userId ?? m.user_id}
              onPress={() => {
                if (pickerPrayer) handleSelectMuezzin(pickerPrayer, m.userId ?? m.user_id ?? '');
                setPickerPrayer(null);
              }}
              style={({ pressed }) => [styles.modalItem, pressed && { opacity: 0.8 }]}
              disabled={!m.userId && !m.user_id}
            >
              <Text style={styles.modalItemText}>{m.displayName ?? m.name ?? 'Muezzin'}</Text>
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

function emptyRota(times: NormalizedPrayerTimes | null): StaffRotaForDay {
  const base: StaffRotaForDay = {};
  prayers.forEach((p) => {
    base[p.key] = {
      muezzinUserId: null,
      notes: '',
      adhanTime: times?.[p.key]?.adhan ?? null,
      iqamaTime: times?.[p.key]?.iqama ?? null,
    };
  });
  return base;
}

function mergeRota(base: StaffRotaForDay, existing: StaffRotaForDay) {
  const merged: StaffRotaForDay = { ...base };
  Object.entries(existing ?? {}).forEach(([prayer, value]) => {
    const key = prayer as PrayerName;
    merged[key] = {
      muezzinUserId: value?.muezzinUserId ?? merged[key]?.muezzinUserId ?? null,
      notes: value?.notes ?? merged[key]?.notes ?? '',
      adhanTime: value?.adhanTime ?? merged[key]?.adhanTime ?? null,
      iqamaTime: value?.iqamaTime ?? merged[key]?.iqamaTime ?? null,
    };
  });
  return merged;
}

function formatTimeOrDash(val?: Date | null) {
  if (!val) return '--:--';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function buildNameMap(muezzins: MuezzinSummary[], rota: StaffRotaForDay | null) {
  const map: Record<string, string> = {};
  muezzins.forEach((m) => {
    if (m.userId) map[m.userId] = m.displayName ?? m.name ?? 'Muezzin';
    if (m.user_id) map[m.user_id] = m.displayName ?? m.name ?? 'Muezzin';
  });

  const rotaIds = Object.values(rota ?? {})
    .map((r) => r?.muezzinUserId)
    .filter(Boolean) as string[];
  const missing = rotaIds.filter((id) => !map[id]);
  if (missing.length) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email')
        .in('id', missing);
      if (!error && data) {
        data.forEach((row: any) => {
          const label = row.display_name ?? row.full_name ?? row.email ?? row.id;
          map[row.id] = label;
        });
      }
    } catch (e) {
      // ignore lookup errors; fallback to ids
    }
  }
  return map;
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
  notice: { color: '#0F172A', marginTop: 6, fontWeight: '700' },
  infoText: { marginTop: 8, color: '#475569' },
  saveBtn: {
    marginTop: 18,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
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
});

