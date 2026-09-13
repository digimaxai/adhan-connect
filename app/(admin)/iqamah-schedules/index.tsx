import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { PrayerName } from '@/lib/adhans';
import {
  deleteIqamahSchedule,
  findExpiringWithoutSuccessor,
  IqamahScheduleRow,
  listIqamahSchedules,
  upsertIqamahSchedule,
} from '@/lib/api/admin/iqamahSchedules';

const PRAYERS: { key: PrayerName; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

const isWeb = Platform.OS === 'web';

export default function IqamahSchedulesScreen() {
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque();

  const [schedules, setSchedules] = useState<IqamahScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPrayer, setFormPrayer] = useState<PrayerName>('fajr');
  const [formTime, setFormTime] = useState('');
  const [formStartDate, setFormStartDate] = useState<Date>(new Date());
  const [formHasEndDate, setFormHasEndDate] = useState(false);
  const [formEndDate, setFormEndDate] = useState<Date>(new Date());
  const [formLabel, setFormLabel] = useState('');
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);

  const load = useCallback(async () => {
    if (!selectedMosque) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listIqamahSchedules(selectedMosque.mosqueId);
      setSchedules(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load iqamah schedules.');
    } finally {
      setLoading(false);
    }
  }, [selectedMosque]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const expiring = useMemo(() => findExpiringWithoutSuccessor(schedules), [schedules]);

  const grouped = useMemo(() => {
    const map = new Map<PrayerName, IqamahScheduleRow[]>();
    PRAYERS.forEach((p) => map.set(p.key, []));
    schedules.forEach((row) => {
      map.get(row.prayer)?.push(row);
    });
    return map;
  }, [schedules]);

  const resetForm = () => {
    setEditingId(null);
    setFormPrayer('fajr');
    setFormTime('');
    setFormStartDate(new Date());
    setFormHasEndDate(false);
    setFormEndDate(new Date());
    setFormLabel('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (row: IqamahScheduleRow) => {
    setEditingId(row.id);
    setFormPrayer(row.prayer);
    setFormTime(row.iqama_time);
    setFormStartDate(new Date(`${row.start_date}T00:00:00`));
    setFormHasEndDate(!!row.end_date);
    setFormEndDate(row.end_date ? new Date(`${row.end_date}T00:00:00`) : new Date());
    setFormLabel(row.label ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!selectedMosque) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(formTime.trim())) {
      setError('Enter a valid iqamah time as HH:MM (24-hour).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertIqamahSchedule({
        id: editingId,
        mosqueId: selectedMosque.mosqueId,
        prayer: formPrayer,
        iqamaTime: formTime.trim(),
        startDate: formatLocalDate(formStartDate),
        endDate: formHasEndDate ? formatLocalDate(formEndDate) : null,
        label: formLabel.trim() || null,
      });
      setShowForm(false);
      setNotice(editingId ? 'Iqamah schedule updated.' : 'Iqamah schedule created.');
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Unable to save this iqamah schedule. Check the date range does not overlap an existing one for this prayer.');
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (row: IqamahScheduleRow) => {
    setDeletingId(row.id);
    setError(null);
    try {
      await deleteIqamahSchedule(row.id);
      setNotice('Iqamah schedule deleted.');
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Unable to delete this iqamah schedule.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (row: IqamahScheduleRow) => {
    const message = `Delete the ${row.prayer} iqamah schedule (${row.iqama_time}, from ${row.start_date}${row.end_date ? ` to ${row.end_date}` : ' onward'})? Iqamah for this prayer will fall back to ELM/auto times where no other schedule applies.`;
    if (isWeb) {
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) void performDelete(row);
      return;
    }
    Alert.alert('Delete iqamah schedule?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDelete(row) },
    ]);
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <AppText variant="body" style={{ marginTop: 8 }}>Loading...</AppText>
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

  return (
    <AdminScreenShell
      title="Iqamah Schedules"
      eyebrow="Local Admin"
      subtitle="Set date-range iqamah (congregation) times per prayer instead of editing every day. These apply automatically ahead of ELM/auto times, unless a specific date has its own override."
      backHref="/(admin)/prayer-times"
      backLabel="Prayer Times"
      mosqueName={selectedMosque?.name ?? null}
      mosqueMeta={selectedMosque ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />}
    >
      {!selectedMosque && !mosques.length ? (
        <AdminBanner tone="warning" title="No mosque access" message="You can only manage iqamah schedules for mosques where your account has local admin access." />
      ) : null}

      {expiring.length ? (
        <AdminBanner
          tone="warning"
          title="Schedule expiring soon"
          message={expiring
            .map((row) => `${capitalize(row.prayer)}'s schedule ends ${row.end_date} with nothing configured after — it will fall back to ELM/auto times.`)
            .join(' ')}
        />
      ) : null}

      {notice ? <AdminBanner tone="success" title="Done" message={notice} /> : null}
      {error ? <AdminBanner tone="danger" title="Unable to continue" message={error} /> : null}

      {selectedMosque ? (
        <AppButton title="Add iqamah schedule" onPress={openCreateForm} style={{ marginBottom: 12 }} />
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        PRAYERS.map(({ key, label }) => {
          const rows = grouped.get(key) ?? [];
          if (!rows.length) return null;
          return (
            <AppCard key={key} style={styles.groupCard}>
              <AppText variant="title">{label}</AppText>
              {rows.map((row) => (
                <View key={row.id} style={styles.scheduleRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={styles.scheduleTime}>{row.iqama_time}</AppText>
                    <AppText variant="caption" color={tokens.color.text.secondary}>
                      {row.start_date} {row.end_date ? `to ${row.end_date}` : '— ongoing'}
                      {row.label ? ` · ${row.label}` : ''}
                    </AppText>
                  </View>
                  <AppButton title="Edit" variant="ghost" onPress={() => openEditForm(row)} />
                  <AppButton
                    title={deletingId === row.id ? 'Deleting…' : 'Delete'}
                    variant="ghost"
                    onPress={() => handleDelete(row)}
                    disabled={deletingId === row.id}
                  />
                </View>
              ))}
            </AppCard>
          );
        })
      )}

      {!loading && selectedMosque && schedules.length === 0 ? (
        <AppCard subtle>
          <AppText variant="body" color={tokens.color.text.secondary}>
            No iqamah schedules yet. Iqamah times currently fall back to the ELM timetable&apos;s published jamaat times (or blank on Aladhan-only mosques). Add a schedule to set a custom congregation time for a date range.
          </AppText>
        </AppCard>
      ) : null}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <AppText variant="title">{editingId ? 'Edit iqamah schedule' : 'New iqamah schedule'}</AppText>

            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Prayer</AppText>
            <View style={styles.choiceRow}>
              {PRAYERS.map((p) => (
                <AppButton key={p.key} title={p.label} variant={formPrayer === p.key ? 'primary' : 'ghost'} onPress={() => setFormPrayer(p.key)} />
              ))}
            </View>

            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Iqamah time (24-hour, HH:MM)</AppText>
            <TextInput style={styles.textInput} value={formTime} onChangeText={setFormTime} placeholder="21:00" keyboardType="numbers-and-punctuation" />

            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Start date</AppText>
            <Pressable style={styles.dateButton} onPress={() => setDatePicker('start')}>
              <AppText variant="body">{formatLocalDate(formStartDate)}</AppText>
            </Pressable>

            <View style={styles.choiceRow}>
              <AppButton title="Ongoing (no end date)" variant={!formHasEndDate ? 'primary' : 'ghost'} onPress={() => setFormHasEndDate(false)} />
              <AppButton title="Ends on a date" variant={formHasEndDate ? 'primary' : 'ghost'} onPress={() => setFormHasEndDate(true)} />
            </View>
            {formHasEndDate ? (
              <Pressable style={styles.dateButton} onPress={() => setDatePicker('end')}>
                <AppText variant="body">{formatLocalDate(formEndDate)}</AppText>
              </Pressable>
            ) : null}

            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Label (optional)</AppText>
            <TextInput style={styles.textInput} value={formLabel} onChangeText={setFormLabel} placeholder="e.g. Winter schedule" />

            <View style={styles.modalActions}>
              <AppButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} disabled={saving} />
              <AppButton title={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>

      {datePicker ? (
        <DateTimePicker
          value={datePicker === 'start' ? formStartDate : formEndDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_event, selected) => {
            if (Platform.OS !== 'ios') setDatePicker(null);
            if (!selected) return;
            if (datePicker === 'start') setFormStartDate(selected);
            else setFormEndDate(selected);
          }}
        />
      ) : null}
      {datePicker && Platform.OS === 'ios' ? (
        <AppButton title="Done" onPress={() => setDatePicker(null)} />
      ) : null}
    </AdminScreenShell>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatLocalDate(d: Date) {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  groupCard: { marginBottom: 12, gap: 8 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border.subtle,
  },
  scheduleTime: { fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: tokens.color.bg.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 8, maxHeight: '90%' },
  fieldLabel: { marginTop: 12 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
});
