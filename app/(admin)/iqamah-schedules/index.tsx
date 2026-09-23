import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
    // Show each prayer's ranges as a chronological timeline so it is obvious
    // a future range can be added while a current one is still active.
    map.forEach((rows) => rows.sort((a, b) => a.start_date.localeCompare(b.start_date)));
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
        <>
          <AppButton title="Add iqamah schedule" onPress={openCreateForm} style={{ marginBottom: 6 }} />
          <AppText variant="caption" color={tokens.color.text.secondary} style={{ marginBottom: 12 }}>
            You can add the next date range for a prayer at any time — even while a current range is
            still active — as long as the new range starts after the current one and the dates don&apos;t
            overlap. Overlapping ranges for the same prayer are rejected automatically.
          </AppText>
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        PRAYERS.map(({ key, label }) => {
          const rows = grouped.get(key) ?? [];
          if (!rows.length) return null;
          const todayIso = formatLocalDate(new Date());
          return (
            <AppCard key={key} style={styles.groupCard}>
              <AppText variant="title">{label}</AppText>
              <AppText variant="caption" color={tokens.color.text.secondary}>
                Timeline, earliest first
              </AppText>
              {rows.map((row) => {
                const status: 'current' | 'upcoming' | 'past' =
                  row.start_date > todayIso
                    ? 'upcoming'
                    : row.end_date && row.end_date < todayIso
                      ? 'past'
                      : 'current';
                return (
                  <View key={row.id} style={styles.scheduleRow}>
                    <View
                      style={[
                        styles.statusDot,
                        status === 'current' && styles.statusDotCurrent,
                        status === 'upcoming' && styles.statusDotUpcoming,
                        status === 'past' && styles.statusDotPast,
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.scheduleTopRow}>
                        <AppText variant="body" style={styles.scheduleTime}>{row.iqama_time}</AppText>
                        <View
                          style={[
                            styles.statusBadge,
                            status === 'current' && styles.statusBadgeCurrent,
                            status === 'upcoming' && styles.statusBadgeUpcoming,
                            status === 'past' && styles.statusBadgePast,
                          ]}
                        >
                          <AppText variant="caption" style={styles.statusBadgeText}>
                            {status === 'current' ? 'Current' : status === 'upcoming' ? 'Upcoming' : 'Past'}
                          </AppText>
                        </View>
                      </View>
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
                );
              })}
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
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <AppText variant="title">{editingId ? 'Edit iqamah schedule' : 'New iqamah schedule'}</AppText>

              <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Prayer</AppText>
              <View style={styles.choiceRow}>
                {PRAYERS.map((p) => (
                  <AppButton key={p.key} title={p.label} variant={formPrayer === p.key ? 'primary' : 'ghost'} onPress={() => setFormPrayer(p.key)} />
                ))}
              </View>

              <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Iqamah time (24-hour, HH:MM)</AppText>
              <TextInput style={styles.textInput} value={formTime} onChangeText={setFormTime} placeholder="21:00" keyboardType="numbers-and-punctuation" />

              <View style={styles.dateRangeSection}>
                <AppText variant="caption" color={tokens.color.text.secondary} style={styles.dateRangeSectionLabel}>
                  EFFECTIVE DATES (REQUIRED)
                </AppText>

                <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>
                  Starts on
                </AppText>
                <Pressable style={styles.dateButton} onPress={() => setDatePicker(datePicker === 'start' ? null : 'start')}>
                  <AppText variant="body" style={styles.dateButtonValue}>{formatLocalDate(formStartDate)}</AppText>
                  <AppText variant="caption" color={tokens.color.text.accent}>
                    {datePicker === 'start' ? 'Close' : 'Set start date'}
                  </AppText>
                </Pressable>
                {datePicker === 'start' ? (
                  <View style={styles.inlinePickerWrap}>
                    <DateTimePicker themeVariant="light"
                      value={formStartDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(_event, selected) => {
                        if (Platform.OS !== 'ios') setDatePicker(null);
                        if (!selected) return;
                        setFormStartDate(selected);
                      }}
                    />
                    {Platform.OS === 'ios' ? (
                      <AppButton title="Done" onPress={() => setDatePicker(null)} style={{ marginTop: 8 }} />
                    ) : null}
                  </View>
                ) : null}

                <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>
                  Ends
                </AppText>
                <View style={styles.choiceRow}>
                  <AppButton title="Ongoing — no end date" variant={!formHasEndDate ? 'primary' : 'ghost'} onPress={() => { setFormHasEndDate(false); setDatePicker(null); }} />
                  <AppButton title="Ends on a date" variant={formHasEndDate ? 'primary' : 'ghost'} onPress={() => setFormHasEndDate(true)} />
                </View>
                {formHasEndDate ? (
                  <>
                    <Pressable style={styles.dateButton} onPress={() => setDatePicker(datePicker === 'end' ? null : 'end')}>
                      <AppText variant="body" style={styles.dateButtonValue}>{formatLocalDate(formEndDate)}</AppText>
                      <AppText variant="caption" color={tokens.color.text.accent}>
                        {datePicker === 'end' ? 'Close' : 'Set end date'}
                      </AppText>
                    </Pressable>
                    {datePicker === 'end' ? (
                      <View style={styles.inlinePickerWrap}>
                        <DateTimePicker themeVariant="light"
                          value={formEndDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={(_event, selected) => {
                            if (Platform.OS !== 'ios') setDatePicker(null);
                            if (!selected) return;
                            setFormEndDate(selected);
                          }}
                        />
                        {Platform.OS === 'ios' ? (
                          <AppButton title="Done" onPress={() => setDatePicker(null)} style={{ marginTop: 8 }} />
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    This range stays active until you add a later range or give it an end date.
                  </AppText>
                )}
              </View>

              <AppText variant="caption" color={tokens.color.text.secondary} style={styles.fieldLabel}>Label (optional)</AppText>
              <TextInput style={styles.textInput} value={formLabel} onChangeText={setFormLabel} placeholder="e.g. Winter schedule" />
            </ScrollView>

            <View style={styles.modalActions}>
              <AppButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} disabled={saving} />
              <AppButton title={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>
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
  scheduleTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  statusDotCurrent: { backgroundColor: '#059669' },
  statusDotUpcoming: { backgroundColor: '#2563EB' },
  statusDotPast: { backgroundColor: '#94A3B8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: tokens.radius.pill },
  statusBadgeCurrent: { backgroundColor: '#ECFDF5' },
  statusBadgeUpcoming: { backgroundColor: '#EFF6FF' },
  statusBadgePast: { backgroundColor: '#F1F5F9' },
  statusBadgeText: { fontWeight: tokens.typography.weight.bold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: tokens.color.bg.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 20, maxHeight: '92%' },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { gap: 8, paddingBottom: 12 },
  inlinePickerWrap: { marginTop: 4, marginBottom: 4 },
  fieldLabel: { marginTop: 12 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateRangeSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border.subtle,
    backgroundColor: tokens.color.bg.subtle,
    gap: 2,
  },
  dateRangeSectionLabel: { fontWeight: tokens.typography.weight.bold, letterSpacing: 0.5 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.color.bg.surface,
  },
  dateButtonValue: { fontWeight: tokens.typography.weight.semibold },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border.subtle,
  },
});
