import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { cancelCoverRequest, createCoverRequest, volunteerForCoverRequest } from '../../lib/api/coverRequests';
import { loadMyRotaWorkspace } from '../../lib/api/muezzin/rotaWorkspace';
import { MuezzinCoverRequest, RotaPrayerName, StaffRotaEntry } from '../../lib/types/muezzin';

const PRAYERS: RotaPrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (d: Date) => `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
const addDays = (date: Date, days: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };
const startOfWeek = (date: Date) => { const copy = new Date(date); const diff = copy.getDay() === 0 ? -6 : 1 - copy.getDay(); copy.setDate(copy.getDate() + diff); copy.setHours(0, 0, 0, 0); return copy; };
const parseDateString = (value: string) => { const d = new Date(value.includes('T') ? value : `${value}T00:00:00`); return Number.isNaN(d.getTime()) ? null : d; };
const prayerLabel = (value: RotaPrayerName) => value.charAt(0).toUpperCase() + value.slice(1);
const requestStatusLabel = (value: MuezzinCoverRequest['status']) => value.replace(/_/g, ' ');
const formatLongDate = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatWeekRange = (start: Date) => `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - ${addDays(start, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
const formatClockTime = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

type SelectedCell = { date: Date; prayer: RotaPrayerName; entry: StaffRotaEntry | null } | null;

function resolveAssigneeName(entry: StaffRotaEntry | null, profileNames: Record<string, string>, userId: string | null) {
  const assigned = entry?.muezzin_user_id ?? entry?.staff_user_id ?? null;
  if (!assigned) return 'Unassigned';
  if (assigned === userId) return 'You';
  return profileNames[assigned] ?? 'Assigned muezzin';
}

export default function MyRotaScreen() {
  const currentWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const earliestWeekStart = useMemo(() => addDays(currentWeekStart, -7), [currentWeekStart]);
  const latestWeekStart = useMemo(() => addDays(currentWeekStart, 21), [currentWeekStart]);
  const fetchRangeStart = earliestWeekStart;
  const fetchRangeEnd = useMemo(() => addDays(latestWeekStart, 6), [latestWeekStart]);

  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [entries, setEntries] = useState<StaffRotaEntry[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [mosqueId, setMosqueId] = useState<string | null>(null);
  const [mosqueName, setMosqueName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<MuezzinCoverRequest[]>([]);
  const [openRequests, setOpenRequests] = useState<MuezzinCoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [requestReason, setRequestReason] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadRota = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await loadMyRotaWorkspace(fetchRangeStart, fetchRangeEnd);
      setEntries(result.entries ?? []);
      setProfileNames(result.profileNames ?? {});
      setMosqueId(result.mosqueId ?? null);
      setMosqueName(result.mosqueName ?? null);
      setUserId(result.userId ?? null);
      setMyRequests(result.myRequests ?? []);
      setOpenRequests(result.openRequests ?? []);
      setError(result.error ?? null);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load rota');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchRangeEnd, fetchRangeStart]);

  useFocusEffect(useCallback(() => { loadRota(); }, [loadRota]));

  const entriesByDate = useMemo(() => {
    const map: Record<string, Partial<Record<RotaPrayerName, StaffRotaEntry>>> = {};
    entries.forEach((entry) => {
      const parsed = entry?.date ? parseDateString(entry.date) : null;
      if (!parsed || !entry.prayer_name) return;
      const key = formatDateKey(parsed);
      map[key] = map[key] ?? {};
      map[key][entry.prayer_name] = entry;
    });
    return map;
  }, [entries]);

  const myEntriesByDate = useMemo(() => {
    const map: Record<string, StaffRotaEntry[]> = {};
    Object.entries(entriesByDate).forEach(([dateKey, prayers]) => {
      const dayEntries = PRAYERS
        .map((prayer) => prayers[prayer] ?? null)
        .filter((entry): entry is StaffRotaEntry => {
          if (!entry) return false;
          const assigned = entry.muezzin_user_id ?? entry.staff_user_id ?? null;
          return assigned === userId;
        });
      if (dayEntries.length) {
        map[dateKey] = dayEntries;
      }
    });
    return map;
  }, [entriesByDate, userId]);

  const requestBySlot = useMemo(() => {
    const map: Record<string, MuezzinCoverRequest> = {};
    myRequests.forEach((request) => {
      map[`${request.date}:${request.prayer_name}`] = request;
    });
    return map;
  }, [myRequests]);

  const upcomingWeeks = useMemo(() => {
    return [1, 2, 3].map((offset) => {
      const start = addDays(currentWeekStart, offset * 7);
      const rows: { key: string; date: Date; prayers: RotaPrayerName[] }[] = [];
      for (let i = 0; i < 7; i += 1) {
        const date = addDays(start, i);
        const key = formatDateKey(date);
        const prayers = (myEntriesByDate[key] ?? []).map((entry) => entry.prayer_name);
        if (prayers.length) rows.push({ key, date, prayers });
      }
      return { start, rows };
    });
  }, [currentWeekStart, myEntriesByDate]);

  const selectedRequest = useMemo(() => {
    if (!selectedCell) return null;
    return requestBySlot[`${formatDateKey(selectedCell.date)}:${selectedCell.prayer}`] ?? null;
  }, [requestBySlot, selectedCell]);

  const selectedWeekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart]);
  const canGoPrev = weekStart.getTime() > earliestWeekStart.getTime();
  const canGoNext = weekStart.getTime() < latestWeekStart.getTime();

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 40 && Math.abs(gesture.dy) < 25,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 50 && canGoPrev) setWeekStart((prev) => addDays(prev, -7));
      if (gesture.dx < -50 && canGoNext) setWeekStart((prev) => addDays(prev, 7));
    },
  })).current;

  const handleCreateRequest = async (urgency: 'standard' | 'urgent') => {
    if (!selectedCell || !mosqueId) return;
    setActionBusy(urgency);
    setError(null);
    setNotice(null);
    try {
      await createCoverRequest({
        mosqueId,
        date: formatDateKey(selectedCell.date),
        prayerName: selectedCell.prayer,
        reason: requestReason,
        urgency,
      });
      setRequestReason('');
      setNotice(urgency === 'urgent' ? 'Urgent cover request sent.' : 'Cover request sent.');
      await loadRota();
    } catch (err: any) {
      setError(err?.message ?? 'Unable to create this cover request.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setActionBusy(`cancel:${requestId}`);
    setError(null);
    setNotice(null);
    try {
      await cancelCoverRequest(requestId);
      setNotice('Cover request cancelled.');
      await loadRota();
    } catch (err: any) {
      setError(err?.message ?? 'Unable to cancel this request.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleVolunteer = async (requestId: string) => {
    setActionBusy(`volunteer:${requestId}`);
    setError(null);
    setNotice(null);
    try {
      await volunteerForCoverRequest(requestId);
      setNotice('You are now the cover volunteer for this slot.');
      await loadRota();
    } catch (err: any) {
      setError(err?.message ?? 'Unable to volunteer for this request.');
    } finally {
      setActionBusy(null);
    }
  };

  const slotAssignedToMe = !!selectedCell && (selectedCell.entry?.muezzin_user_id ?? selectedCell.entry?.staff_user_id ?? null) === userId;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadRota} />}>
        <View style={styles.header}>
          <Text style={styles.title}>My Rota</Text>
          <Text style={styles.subtitle}>{mosqueName ?? 'View your upcoming adhan duties'}</Text>
        </View>

        {error ? <Banner tone="danger" title="Unable to continue" message={error} /> : null}
        {notice ? <Banner tone="success" title="Updated" message={notice} /> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading your schedule...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.weekHeader} {...panResponder.panHandlers}>
              <Pressable onPress={() => canGoPrev && setWeekStart((prev) => addDays(prev, -7))} disabled={!canGoPrev} style={[styles.arrow, !canGoPrev && styles.arrowDisabled]}>
                <Ionicons name="chevron-back" size={18} color={canGoPrev ? '#0F172A' : '#94A3B8'} />
              </Pressable>
              <View style={styles.weekCenter}>
                <Text style={styles.sectionTitle}>This Week</Text>
                <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>
              </View>
              <Pressable onPress={() => canGoNext && setWeekStart((prev) => addDays(prev, 7))} disabled={!canGoNext} style={[styles.arrow, !canGoNext && styles.arrowDisabled]}>
                <Ionicons name="chevron-forward" size={18} color={canGoNext ? '#0F172A' : '#94A3B8'} />
              </Pressable>
            </View>

            {selectedWeekDays.map((day) => {
              const key = formatDateKey(day);
              const dayEntries = myEntriesByDate[key] ?? [];
              return (
                <View key={key} style={styles.dayBlock}>
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={styles.dayLabel}>{WEEKDAY_LABELS[day.getDay()]}</Text>
                      <Text style={styles.dayMeta}>{day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    </View>
                    <Text style={styles.dayChip}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
                  </View>
                  <View style={styles.prayerGrid}>
                    {dayEntries.length ? dayEntries.map((entry) => {
                      const prayer = entry.prayer_name;
                      const request = requestBySlot[`${key}:${prayer}`];
                      const adhanTime = formatClockTime(entry.adhan_time);
                      const iqamaTime = formatClockTime(entry.iqama_time);
                      return (
                        <Pressable key={`${key}-${prayer}`} style={styles.prayerCard} onPress={() => { setSelectedCell({ date: day, prayer, entry }); setRequestReason(''); }}>
                          <Text style={styles.prayerTitle}>{prayerLabel(prayer)}</Text>
                          {request ? <Text style={styles.badge}>{requestStatusLabel(request.status)}</Text> : null}
                          <Text style={styles.assignee}>{resolveAssigneeName(entry, profileNames, userId)}</Text>
                          <Text style={styles.timeText}>{adhanTime ? `Adhan ${adhanTime}` : 'Adhan time unavailable'}</Text>
                          {iqamaTime ? <Text style={styles.metaText}>{`Iqamah ${iqamaTime}`}</Text> : null}
                          {entry.notes ? <Text style={styles.metaText}>{entry.notes}</Text> : null}
                        </Pressable>
                      );
                    }) : <Text style={styles.emptyText}>No duties assigned.</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <SectionCard title="My active requests" count={myRequests.length}>
          {myRequests.length ? myRequests.map((request) => (
            <ActionRow
              key={request.id}
              title={`${prayerLabel(request.prayer_name)} - ${formatLongDate(parseDateString(request.date) ?? new Date())}`}
              subtitle={`${requestStatusLabel(request.status)}${request.volunteer_name ? ` - ${request.volunteer_name}` : ''}`}
              buttonLabel="Cancel"
              onPress={() => handleCancelRequest(request.id)}
              busy={actionBusy === `cancel:${request.id}`}
              secondary
            />
          )) : <Text style={styles.emptyText}>No active requests. Tap one of your assigned slots if you need cover.</Text>}
        </SectionCard>

        <SectionCard title="Open mosque cover" count={openRequests.length}>
          {openRequests.length ? openRequests.map((request) => (
            <ActionRow
              key={request.id}
              title={`${prayerLabel(request.prayer_name)} - ${formatLongDate(parseDateString(request.date) ?? new Date())}`}
              subtitle={`${request.urgency === 'urgent' ? 'Urgent' : 'Standard'}${request.reason ? ` - ${request.reason}` : ''}`}
              buttonLabel="Volunteer"
              onPress={() => handleVolunteer(request.id)}
              busy={actionBusy === `volunteer:${request.id}`}
            />
          )) : <Text style={styles.emptyText}>Nothing needs peer cover right now.</Text>}
        </SectionCard>

        <SectionCard title="Upcoming Weeks">
          {upcomingWeeks.map((week) => (
            <View key={week.start.toISOString()} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Week of {formatWeekRange(week.start)}</Text>
              {week.rows.length ? week.rows.map((row) => (
                <View key={row.key} style={styles.summaryRow}>
                  <Text style={styles.summaryDay}>{WEEKDAY_LABELS[row.date.getDay()]}</Text>
                  <Text style={styles.summaryPrayers}>{row.prayers.map(prayerLabel).join(', ')}</Text>
                </View>
              )) : <Text style={styles.emptyText}>No assignments yet.</Text>}
            </View>
          ))}
        </SectionCard>
      </ScrollView>

      <Modal visible={!!selectedCell} animationType="slide" transparent onRequestClose={() => setSelectedCell(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCell(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>{selectedCell ? prayerLabel(selectedCell.prayer) : ''}</Text>
            <Text style={styles.sheetSubtitle}>{selectedCell?.date ? formatLongDate(selectedCell.date) : ''}</Text>
            <Text style={styles.sheetMeta}>Assigned to: {resolveAssigneeName(selectedCell?.entry ?? null, profileNames, userId)}</Text>
            <Text style={styles.sheetMeta}>Adhan: {formatClockTime(selectedCell?.entry?.adhan_time) ?? 'Unavailable'}</Text>
            <Text style={styles.sheetMeta}>Iqamah: {formatClockTime(selectedCell?.entry?.iqama_time) ?? 'Unavailable'}</Text>
            <Text style={styles.sheetMeta}>Notes: {selectedCell?.entry?.notes ?? 'No notes'}</Text>

            {slotAssignedToMe ? (
              <View style={styles.sheetBox}>
                <Text style={styles.sheetBoxTitle}>If you cannot attend</Text>
                {selectedRequest ? (
                  <>
                    <Text style={styles.sheetCopy}>Current request: {requestStatusLabel(selectedRequest.status)}</Text>
                    <Pressable style={styles.secondaryWide} onPress={() => handleCancelRequest(selectedRequest.id)}>
                      <Text style={styles.secondaryWideText}>Cancel request</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.sheetCopy}>Standard requests notify local admins and allow peers to volunteer. Urgent cover does the same but treats the first volunteer as provisional backup immediately.</Text>
                    <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor="#94A3B8" value={requestReason} onChangeText={setRequestReason} multiline />
                    <View style={styles.sheetButtons}>
                      <Pressable style={styles.secondaryWide} disabled={actionBusy === 'standard'} onPress={() => handleCreateRequest('standard')}>
                        <Text style={styles.secondaryWideText}>Need cover</Text>
                      </Pressable>
                      <Pressable style={styles.primaryWide} disabled={actionBusy === 'urgent'} onPress={() => handleCreateRequest('urgent')}>
                        <Text style={styles.primaryWideText}>Urgent cover</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            <Pressable style={styles.close} onPress={() => setSelectedCell(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Banner({ tone, title, message }: { tone: 'danger' | 'success'; title: string; message: string }) {
  const style = tone === 'danger' ? styles.errorBanner : styles.successBanner;
  const textStyle = tone === 'danger' ? styles.errorBannerText : styles.successBannerText;
  return (
    <View style={style}>
      <Text style={[styles.bannerTitle, textStyle]}>{title}</Text>
      <Text style={textStyle}>{message}</Text>
    </View>
  );
}

function SectionCard({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        {typeof count === 'number' ? <Text style={styles.sectionCount}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ActionRow({
  title,
  subtitle,
  buttonLabel,
  onPress,
  busy,
  secondary,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  onPress: () => void;
  busy: boolean;
  secondary?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Pressable style={secondary ? styles.rowSecondaryButton : styles.rowPrimaryButton} disabled={busy} onPress={onPress}>
        <Text style={secondary ? styles.rowSecondaryText : styles.rowPrimaryText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 36, gap: 14 },
  header: { paddingTop: 16, paddingBottom: 6 },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A' },
  subtitle: { marginTop: 6, fontSize: 16, color: '#475569' },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 10, fontSize: 15, color: '#475569', fontWeight: '600' },
  bannerTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  errorBanner: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FCA5A5' },
  successBanner: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#86EFAC' },
  errorBannerText: { color: '#B91C1C' },
  successBannerText: { color: '#166534' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  weekCenter: { flex: 1, alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  weekRange: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  arrow: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { opacity: 0.4 },
  dayBlock: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dayLabel: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  dayMeta: { fontSize: 13, color: '#64748B', marginTop: 2 },
  dayChip: { color: '#0369A1', fontSize: 12, fontWeight: '700', backgroundColor: '#E0F2FE', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  prayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  prayerCard: { width: '48%', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, backgroundColor: '#F8FAFC', minHeight: 124, justifyContent: 'space-between' },
  prayerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize', marginTop: 6 },
  assignee: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  timeText: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#0369A1' },
  metaText: { marginTop: 4, fontSize: 12, color: '#64748B' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sectionCount: { minWidth: 28, textAlign: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowSubtitle: { marginTop: 4, fontSize: 12, color: '#64748B' },
  rowPrimaryButton: { backgroundColor: '#0EA5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  rowSecondaryButton: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  rowSecondaryText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  summaryCard: { gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryDay: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  summaryPrayers: { fontSize: 14, color: '#0F172A' },
  emptyText: { fontSize: 14, color: '#64748B' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, minHeight: 260, gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sheetSubtitle: { fontSize: 14, color: '#475569' },
  sheetMeta: { fontSize: 14, color: '#334155' },
  sheetBox: { marginTop: 8, padding: 14, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  sheetBoxTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sheetCopy: { fontSize: 13, lineHeight: 18, color: '#475569' },
  input: { minHeight: 72, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', color: '#0F172A', backgroundColor: '#FFFFFF' },
  sheetButtons: { flexDirection: 'row', gap: 10 },
  primaryWide: { flex: 1, backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryWideText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  secondaryWide: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryWideText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  close: { marginTop: 8, backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  closeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
