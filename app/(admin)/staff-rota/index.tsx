import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import AdminDateSelector from '@/components/admin/DateSelector';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import {
  MuezzinSummary,
  saveStaffRotaForDate,
  StaffRotaForDay,
} from '@/lib/api/admin/staffRota';
import { loadStaffRotaWorkspace } from '@/lib/api/admin/staffRotaWorkspace';
import { loadMosqueMuezzinWorkspace } from '@/lib/api/admin/muezzinWorkspace';
import { normalizePrayerTimes, NormalizedPrayerTimes } from '@/lib/api/prayerTimesUnified';
import { PrayerName } from '@/lib/adhans';
import { supabase } from '@/lib/supabase';

const prayers: { key: PrayerName; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerPrayer, setPickerPrayer] = useState<PrayerName | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [defaultMuezzinUserId, setDefaultMuezzinUserId] = useState<string | null>(null);

  const dateIso = useMemo(() => formatLocalDate(selectedDate), [selectedDate]);
  const todayIso = formatLocalDate(new Date());
  const isEditingToday = dateIso === todayIso;
  const disableControls = !selectedMosque || loadingData || saving || !prayerTimes;

  const loadData = useCallback(async () => {
    if (!selectedMosque) {
      return;
    }
    setLoadingData(true);
    setError(null);
    setNotice(null);
    try {
      const workspace = await loadStaffRotaWorkspace(selectedMosque.mosqueId, dateIso);
      const normalizedTimes = normalizePrayerTimes(
        (workspace.prayerTimesRow ?? workspace.fallbackPrayerTimesRow) as any
      );
      const rotaMap = workspace.rota;
      let muezzinList = workspace.muezzins;
      if ((muezzinList?.length ?? 0) === 0) {
        try {
          const mosqueWorkspace = await loadMosqueMuezzinWorkspace(selectedMosque.mosqueId);
          muezzinList = mosqueWorkspace.members
            .filter((member) => member.isActive)
            .map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
              user_id: member.userId,
              name: member.displayName,
              isDefault: member.isDefault ?? false,
            }));
        } catch (muezzinError) {
          console.warn('[StaffRotaScreen.loadData] mosque muezzin recovery failed', muezzinError);
        }
      }
      setPrayerTimes(normalizedTimes);
      setMuezzins(muezzinList);
      const resolvedDefaultUserId =
        workspace.defaultMuezzinUserId ??
        muezzinList.find((member) => member.isDefault)?.userId ??
        muezzinList.find((member) => member.isDefault)?.user_id ??
        null;
      setDefaultMuezzinUserId(resolvedDefaultUserId);
      const profileNameMap = await buildNameMap(muezzinList, rotaMap);
      setNameMap(profileNameMap);
      const base = emptyRota(normalizedTimes, resolvedDefaultUserId);
      const merged = mergeRota(base, rotaMap);
      const hasServerRows = rotaMap && Object.keys(rotaMap).length > 0;
      setRota(merged);
      if (!hasServerRows) {
        setNotice(
          resolvedDefaultUserId
            ? 'No manual assignments returned for this date. Mosque default coverage is shown where it applies.'
            : 'No manual assignments returned from the server for this date yet.'
        );
      }
      if (!workspace.prayerTimesRow && !workspace.fallbackPrayerTimesRow) {
        setError('Please create prayer times for this date before assigning staff.');
      }
      if ((muezzinList ?? []).length === 0) {
        setError((prev) => prev ?? 'No active muezzins found for this mosque.');
      }
    } catch (e: any) {
      console.warn('load staff rota', e?.message ?? e);
      setError('Unable to load staff rota.');
      setPrayerTimes(null);
      setDefaultMuezzinUserId(null);
      setRota(emptyRota(null, null));
    } finally {
      setLoadingData(false);
    }
  }, [selectedMosque, dateIso]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleSelectMuezzin = (prayer: PrayerName, userId: string) => {
    setRota((prev) => {
      const base = prev ?? emptyRota(prayerTimes, defaultMuezzinUserId);
      const next = { ...base };
      next[prayer] = {
        muezzinUserId: userId,
        notes: base[prayer]?.notes ?? '',
        adhanTime: prayerTimes?.[prayer]?.adhan ?? base[prayer]?.adhanTime ?? null,
        iqamaTime: prayerTimes?.[prayer]?.iqama ?? base[prayer]?.iqamaTime ?? null,
        assignmentSource: 'manual',
      };
      return next;
    });
  };

  const handleNotesChange = (prayer: PrayerName, text: string) => {
    setRota((prev) => {
      const base = prev ?? emptyRota(prayerTimes, defaultMuezzinUserId);
      const next = { ...base };
      next[prayer] = {
        muezzinUserId: base[prayer]?.muezzinUserId ?? null,
        notes: text,
        adhanTime: prayerTimes?.[prayer]?.adhan ?? base[prayer]?.adhanTime ?? null,
        iqamaTime: prayerTimes?.[prayer]?.iqama ?? base[prayer]?.iqamaTime ?? null,
        assignmentSource: base[prayer]?.assignmentSource === 'default' && text.trim()
          ? 'manual'
          : base[prayer]?.assignmentSource ?? null,
      };
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedMosque || !rota || !prayerTimes) return;
    const hasManualAssignments = Object.values(rota).some((r) => r?.muezzinUserId && r.assignmentSource !== 'default');
    if (!hasManualAssignments) {
      setError('Choose at least one manual muezzin assignment before saving. Default coverage is already active without saving.');
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
      const result = await saveStaffRotaForDate(selectedMosque.mosqueId, selectedDate, rota, assignedBy, selectedMosque.name);
      if (!result.success) {
        setError(result.error ?? 'Unable to save assignments.');
      } else {
        const notifySuffix =
          typeof result.notificationCount === 'number' && result.notificationCount > 0
            ? ` ${result.notificationCount} notification${result.notificationCount === 1 ? '' : 's'} sent.`
            : '';
        setNotice(`Saved staff rota for ${dateIso} (${selectedMosque.name}).${notifySuffix}`);
        Alert.alert('Rota saved', `Assignments saved for ${formatLongDate(selectedDate)}.`);
        await loadData();
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
        <AppText variant="body" style={styles.feedbackText}>
          Loading...
        </AppText>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body">You do not have admin access.</AppText>
      </View>
    );
  }

  const noAdminMosque = !selectedMosque && !mosques.length;
  const hasPrayerTimes = !!prayerTimes;
  const currentRota = rota ?? emptyRota(prayerTimes, defaultMuezzinUserId);
  const hasManualAssignments = Object.values(currentRota).some((r) => r?.muezzinUserId && r.assignmentSource !== 'default');

  return (
    <AdminScreenShell
      title="Staff Rota"
      subtitle="Assign the right muezzin to each prayer."
      backHref="/(admin)"
      backLabel="Back to Console"
      activeTab="rota"
      onGoPrayerTimes={() => router.push('/(admin)/prayer-times')}
      onGoStaffRota={() => router.push('/(admin)/staff-rota')}
      mosqueName={selectedMosque?.name ?? null}
      mosqueMeta={selectedMosque ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || 'Daily rota editor' : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />}
    >
      <AppCard style={styles.utilityCard}>
        <View style={styles.utilityHeader}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Assignment date
          </AppText>
          <AppText variant="title">Rota date</AppText>
        </View>
        <AdminDateSelector
          date={selectedDate}
          onChange={setSelectedDate}
        />
        {!isEditingToday ? (
          <View style={styles.dateWarning}>
            <View style={styles.dateWarningCopy}>
              <AppText variant="caption" style={styles.dateWarningTitle}>
                {dateIso < todayIso ? 'Editing a past date' : 'Editing a future date'}
              </AppText>
              <AppText variant="body" style={styles.dateWarningMessage}>
                Assignments saved here apply only to {formatLongDate(selectedDate)}.
              </AppText>
            </View>
            <Pressable
              onPress={() => setSelectedDate(new Date())}
              style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
            >
              <AppText variant="caption" style={styles.todayButtonText}>
                Go to today
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </AppCard>

      {noAdminMosque ? (
        <AdminBanner
          tone="warning"
          title="No mosque access"
          message="You can only assign staff for mosques where your account has local admin access."
        />
      ) : null}

      {loadingData ? (
        <View style={styles.loader}>
          <ActivityIndicator />
          <AppText variant="body" style={styles.feedbackText}>
            Loading staff rota...
          </AppText>
        </View>
      ) : (
        prayers.map((p) => {
          const row = currentRota[p.key];
          const isDefaultCoverage = row?.assignmentSource === 'default' && !!row.muezzinUserId;
          const selectedName = row?.muezzinUserId
            ? `${isDefaultCoverage ? 'Default: ' : ''}${nameMap[row.muezzinUserId] ??
              muezzins.find((m) => m.userId === row.muezzinUserId || m.user_id === row.muezzinUserId)?.displayName ??
              muezzins.find((m) => m.user_id === row.muezzinUserId)?.name ??
              row.muezzinUserId}`
            : 'Select muezzin';
          return (
            <AppCard key={p.key} style={[styles.card, disableControls && styles.cardDisabled]}>
              <View style={styles.cardHeader}>
                <AppText variant="title">{p.label}</AppText>
                <AppText variant="body" color={tokens.color.text.secondary} style={styles.timeLabel}>
                  Adhan {formatTimeOrDash(row?.adhanTime)} | Iqama {formatTimeOrDash(row?.iqamaTime)}
                </AppText>
              </View>
              <Pressable
                onPress={() => setPickerPrayer(p.key)}
                disabled={disableControls}
                style={({ pressed }) => [styles.selectBtn, pressed && !disableControls && styles.pressed, disableControls && styles.cardDisabled]}
              >
                <AppText variant="body" style={styles.selectText}>
                  {selectedName}
                </AppText>
              </Pressable>
              {isDefaultCoverage ? (
                <AppText variant="caption" style={styles.defaultCoverageNote}>
                  Covered by mosque default. Choose a muezzin here to create a manual rota assignment.
                </AppText>
              ) : null}
              <TextInput
                style={styles.notes}
                placeholder="Notes (optional)"
                placeholderTextColor={tokens.color.text.muted}
                value={row?.notes ?? ''}
                onChangeText={(t) => handleNotesChange(p.key, t)}
                editable={!disableControls}
              />
            </AppCard>
          );
        })
      )}

      {!hasPrayerTimes && !loadingData ? (
        <AdminBanner
          tone="warning"
          title="Prayer times required"
          message="Create prayer times for this date first, then assign muezzins to each prayer."
        />
      ) : null}
      {notice ? <AdminBanner tone="info" title="Staff rota" message={notice} /> : null}
      {error ? <AdminBanner tone="danger" title="Unable to continue" message={error} /> : null}
      <View style={styles.actionRow}>
        <AppButton title={saving ? 'Saving...' : 'Save Assignments'} onPress={handleSave} disabled={saving || disableControls || !rota || !hasManualAssignments} />
      </View>

      <Modal transparent visible={!!pickerPrayer} animationType="fade" onRequestClose={() => setPickerPrayer(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerPrayer(null)} />
        <View style={styles.modalCard}>
          <AppText variant="title" style={styles.modalTitle}>
            Select muezzin
          </AppText>
          {muezzins.length === 0 ? (
            <AppText variant="body" color={tokens.color.text.secondary}>
              No active muezzins found.
            </AppText>
          ) : null}
          {muezzins.map((m) => (
            <Pressable
              key={m.userId ?? m.user_id}
              onPress={() => {
                if (pickerPrayer) handleSelectMuezzin(pickerPrayer, m.userId ?? m.user_id ?? '');
                setPickerPrayer(null);
              }}
              style={({ pressed }) => [styles.modalItem, pressed && styles.pressed]}
              disabled={!m.userId && !m.user_id}
            >
              <AppText variant="body" style={styles.modalItemText}>
                {m.displayName ?? m.name ?? 'Muezzin'}
              </AppText>
            </Pressable>
          ))}
          <Pressable onPress={() => setPickerPrayer(null)} style={styles.modalClose}>
            <AppText variant="body" color={tokens.color.status.info} style={styles.modalCloseText}>
              Cancel
            </AppText>
          </Pressable>
        </View>
      </Modal>
    </AdminScreenShell>
  );
}

function emptyRota(times: NormalizedPrayerTimes | null, defaultMuezzinUserId: string | null): StaffRotaForDay {
  const base: StaffRotaForDay = {};
  prayers.forEach((p) => {
    base[p.key] = {
      muezzinUserId: defaultMuezzinUserId,
      notes: '',
      adhanTime: times?.[p.key]?.adhan ?? null,
      iqamaTime: times?.[p.key]?.iqama ?? null,
      assignmentSource: defaultMuezzinUserId ? 'default' : null,
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
      assignmentSource: value?.assignmentSource ?? merged[key]?.assignmentSource ?? null,
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

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
      const { data, error } = await supabase.from('profiles').select('id, full_name, display_name, email').in('id', missing);
      if (!error && data) {
        data.forEach((row: any) => {
          const label = row.display_name ?? row.full_name ?? row.email ?? row.id;
          map[row.id] = label;
        });
      }
    } catch {
      // ignore lookup errors
    }
  }
  return map;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  pressed: { opacity: 0.9 },
  feedbackText: { marginTop: 8 },
  utilityCard: { gap: tokens.spacing.sm, padding: tokens.spacing.sm, borderRadius: 16 },
  utilityHeader: { gap: 2 },
  dateWarning: {
    marginTop: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  dateWarningCopy: { flex: 1, gap: 3 },
  dateWarningTitle: { color: '#92400E', fontWeight: tokens.typography.weight.extrabold },
  dateWarningMessage: { color: '#78350F', lineHeight: 19, fontSize: 13 },
  todayButton: {
    paddingHorizontal: tokens.spacing.sm,
    minHeight: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    justifyContent: 'center',
  },
  todayButtonText: { color: '#92400E', fontWeight: tokens.typography.weight.extrabold },
  actionRow: { marginTop: tokens.spacing.xs },
  loader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  card: { gap: tokens.spacing.xs, padding: tokens.spacing.sm, borderRadius: 16 },
  cardDisabled: { opacity: 0.6 },
  cardHeader: { gap: 4 },
  timeLabel: { lineHeight: 18, fontSize: 14 },
  selectBtn: {
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: '#F5F9FC',
    borderWidth: 1,
    borderColor: '#E0E7EF',
    justifyContent: 'center',
  },
  selectText: { fontWeight: tokens.typography.weight.extrabold, color: '#0F172A', fontSize: 15 },
  defaultCoverageNote: { color: '#64748B', lineHeight: 18, fontSize: 12 },
  notes: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: tokens.radius.md,
    padding: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
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
  modalTitle: { fontSize: 18 },
  modalItem: { paddingVertical: 8 },
  modalItemText: { fontWeight: tokens.typography.weight.bold, color: '#0F172A' },
  modalClose: { marginTop: 8, alignSelf: 'flex-end' },
  modalCloseText: { fontWeight: tokens.typography.weight.bold },
});
