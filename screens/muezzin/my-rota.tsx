import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { getMuezzinRotaForRange } from '../../lib/api/muezzin/schedule';
import { RotaPrayerName, StaffRotaEntry } from '../../lib/types/muezzin';

const PRAYERS: RotaPrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const parseDateString = (value: string) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatWeekRange = (start: Date) => {
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const endLabel = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${startLabel} \u2013 ${endLabel}`;
};

const formatLongDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const prayerLabel = (name: RotaPrayerName) => name.charAt(0).toUpperCase() + name.slice(1);

const resolveAssigneeName = (
  entry: StaffRotaEntry | null,
  profileNames: Record<string, string>,
  userId: string | null
) => {
  if (!entry) return 'Unassigned';
  const assigned = entry.muezzin_user_id ?? entry.staff_user_id ?? null;
  if (!assigned) return 'Unassigned';
  if (assigned === userId) return 'You';
  return profileNames[assigned] ?? 'Assigned muezzin';
};

type SelectedCell = {
  date: Date;
  prayer: RotaPrayerName;
  entry: StaffRotaEntry | null;
} | null;

export default function MyRotaScreen() {
  const currentWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const earliestWeekStart = useMemo(() => addDays(currentWeekStart, -7), [currentWeekStart]);
  const latestWeekStart = useMemo(() => addDays(currentWeekStart, 21), [currentWeekStart]);
  const fetchRangeStart = earliestWeekStart;
  const fetchRangeEnd = useMemo(() => addDays(latestWeekStart, 6), [latestWeekStart]);

  const [weekStart, setWeekStart] = useState<Date>(currentWeekStart);
  const [entries, setEntries] = useState<StaffRotaEntry[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [mosqueName, setMosqueName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);

  const loadRota = useCallback(async () => {
    setRefreshing(true);
    try {
      const { entries: rows, profileNames: names, mosqueName: name, userId: uid, error: apiErr } =
        await getMuezzinRotaForRange(fetchRangeStart, fetchRangeEnd);
      setEntries(rows ?? []);
      setProfileNames(names ?? {});
      setMosqueName(name ?? null);
      setUserId(uid ?? null);
      setError(apiErr ? apiErr.message ?? 'Unable to load rota' : null);
    } catch (err: any) {
      setEntries([]);
      setProfileNames({});
      setError(err?.message ?? 'Unable to load rota');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchRangeEnd, fetchRangeStart]);

  useFocusEffect(
    useCallback(() => {
      loadRota();
    }, [loadRota])
  );

  const handleWeekChange = useCallback(
    (delta: 1 | -1) => {
      const next = addDays(weekStart, delta * 7);
      if (next < earliestWeekStart || next > latestWeekStart) return;
      setWeekStart(next);
    },
    [earliestWeekStart, latestWeekStart, weekStart]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 40 && Math.abs(gesture.dy) < 25,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 50) {
          handleWeekChange(-1);
        } else if (gesture.dx < -50) {
          handleWeekChange(1);
        }
      },
    })
  ).current;

  const entriesByDate = useMemo(() => {
    const map: Record<string, Partial<Record<RotaPrayerName, StaffRotaEntry>>> = {};
    entries.forEach((entry) => {
      if (!entry?.date || !entry.prayer_name) return;
      const parsedDate = parseDateString(entry.date);
      const key = parsedDate ? formatDateKey(parsedDate) : entry.date;
      if (!map[key]) map[key] = {};
      map[key][entry.prayer_name] = entry;
    });
    return map;
  }, [entries]);

  const selectedWeekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, idx) => addDays(weekStart, idx)),
    [weekStart]
  );

  const upcomingWeeks = useMemo(() => {
    return [1, 2, 3].map((offset) => {
      const start = addDays(currentWeekStart, offset * 7);
      const end = addDays(start, 6);
      const grouped: Record<string, RotaPrayerName[]> = {};
      entries.forEach((entry) => {
        const dateObj = parseDateString(entry.date);
        if (!dateObj) return;
        if (dateObj < start || dateObj > end) return;
        const assignee = entry.muezzin_user_id ?? entry.staff_user_id;
        if (!assignee || assignee !== userId) return;
        const dateKey = formatDateKey(dateObj);
        grouped[dateKey] = grouped[dateKey] ?? [];
        if (!grouped[dateKey].includes(entry.prayer_name)) {
          grouped[dateKey].push(entry.prayer_name);
        }
      });
      const days = Object.entries(grouped)
        .map(([dateKey, prayers]) => ({
          key: dateKey,
          date: parseDateString(dateKey),
          prayers: prayers.sort((a, b) => PRAYERS.indexOf(a) - PRAYERS.indexOf(b)),
        }))
        .filter((d) => d.date)
        .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
      return { start, end, days };
    });
  }, [currentWeekStart, entries, userId]);

  const canGoPrev = weekStart.getTime() > earliestWeekStart.getTime();
  const canGoNext = weekStart.getTime() < latestWeekStart.getTime();

  const handleSelectCell = (date: Date, prayer: RotaPrayerName, entry: StaffRotaEntry | null) => {
    setSelectedCell({ date, prayer, entry });
  };

  const dismissSheet = () => setSelectedCell(null);

  const renderAssignmentPill = (entry: StaffRotaEntry | null) => {
    const assignedUser = entry?.muezzin_user_id ?? entry?.staff_user_id ?? null;
    const status = !entry || !assignedUser ? 'empty' : assignedUser === userId ? 'you' : 'other';
    const label = resolveAssigneeName(entry, profileNames, userId);
    const pillStyles = [
      styles.assignmentPill,
      status === 'you' ? styles.assignmentPillYou : null,
      status === 'other' ? styles.assignmentPillOther : null,
      status === 'empty' ? styles.assignmentPillEmpty : null,
    ];

    return (
      <View style={pillStyles}>
        {status === 'you' && <Ionicons name="mic-outline" size={16} color="#0B7A30" style={{ marginRight: 6 }} />}
        <Text
          style={[
            styles.assignmentText,
            status === 'you' ? styles.assignmentTextYou : null,
            status === 'other' ? styles.assignmentTextOther : null,
            status === 'empty' ? styles.assignmentTextEmpty : null,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    );
  };

  const renderWeekCard = () => {
    return (
      <View style={styles.card}>
        <View style={styles.weekHeader} {...panResponder.panHandlers}>
          <Pressable
            onPress={() => handleWeekChange(-1)}
            disabled={!canGoPrev}
            style={[styles.weekArrow, !canGoPrev && styles.disabledButton]}
          >
            <Ionicons name="chevron-back" size={18} color={canGoPrev ? '#0F172A' : '#94A3B8'} />
          </Pressable>
          <View style={styles.weekTitleBlock}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>
            <Text style={styles.weekHint}>{weekStart.getTime() === currentWeekStart.getTime() ? 'Current week' : 'Swipe or use arrows'}</Text>
          </View>
          <Pressable
            onPress={() => handleWeekChange(1)}
            disabled={!canGoNext}
            style={[styles.weekArrow, !canGoNext && styles.disabledButton]}
          >
            <Ionicons name="chevron-forward" size={18} color={canGoNext ? '#0F172A' : '#94A3B8'} />
          </Pressable>
        </View>

        {selectedWeekDays.map((day) => {
          const dateKey = formatDateKey(day);
          const prayersForDay = entriesByDate[dateKey] ?? {};
          return (
            <View key={dateKey} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View>
                  <Text style={styles.dayLabel}>{WEEKDAY_LABELS[day.getDay()]}</Text>
                  <Text style={styles.dayDateLong}>{day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
                <View style={styles.dayChip}>
                  <Ionicons name="calendar" size={14} color="#0EA5E9" style={{ marginRight: 6 }} />
                  <Text style={styles.dayChipText}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
                </View>
              </View>

              <View style={styles.prayersRow}>
                {PRAYERS.map((prayer) => {
                  const entry = prayersForDay[prayer] ?? null;
                  return (
                    <Pressable
                      key={`${dateKey}-${prayer}`}
                      style={({ pressed }) => [styles.prayerItem, pressed && styles.prayerItemPressed]}
                      onPress={() => handleSelectCell(day, prayer, entry)}
                    >
                      <Text style={styles.prayerLabel}>{prayerLabel(prayer)}</Text>
                      {renderAssignmentPill(entry)}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadRota} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Rota</Text>
          <Text style={styles.headerSubtitle}>{mosqueName ?? 'View your upcoming adhan duties'}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load rota</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading your schedule…</Text>
          </View>
        ) : (
          renderWeekCard()
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Upcoming Weeks</Text>
          {upcomingWeeks.map((week, idx) => (
            <View key={week.start.toISOString()} style={styles.weekCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.weekCardTitle}>Week of {formatWeekRange(week.start)}</Text>
                <View style={styles.weekBadge}>
                  <Text style={styles.weekBadgeText}>+{idx + 1}</Text>
                </View>
              </View>
              {week.days.length ? (
                week.days.map((day) => (
                  <View key={day.key} style={styles.weekSummaryRow}>
                    <Text style={styles.weekSummaryDay}>
                      {day.date ? WEEKDAY_LABELS[day.date.getDay()] : 'Day'}
                    </Text>
                    <Text style={styles.weekSummaryPrayers}>
                      {day.prayers.map(prayerLabel).join(', ')}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noAssignments}>No assignments yet.</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!selectedCell} animationType="slide" transparent onRequestClose={dismissSheet}>
        <Pressable style={styles.sheetBackdrop} onPress={dismissSheet}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={styles.sheetIcon}>
                <Ionicons name="calendar-outline" size={18} color="#0EA5E9" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.sheetTitle}>{selectedCell ? prayerLabel(selectedCell.prayer) : ''}</Text>
                <Text style={styles.sheetSubtitle}>
                  {selectedCell?.date ? formatLongDate(selectedCell.date) : ''}
                </Text>
              </View>
            </View>

            <View style={styles.sheetRow}>
              <Text style={styles.sheetRowLabel}>Assigned to</Text>
              <Text style={styles.sheetRowValue}>
                {resolveAssigneeName(selectedCell?.entry ?? null, profileNames, userId)}
              </Text>
            </View>
            <View style={[styles.sheetRow, { marginTop: 8 }]}>
              <Text style={styles.sheetRowLabel}>Notes</Text>
              <Text style={styles.sheetRowValue} numberOfLines={3}>
                {selectedCell?.entry?.notes ? selectedCell.entry.notes : 'No notes'}
              </Text>
            </View>

            <Pressable style={styles.closeButton} onPress={dismissSheet}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 17,
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  weekRange: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  weekArrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  dayCard: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  dayDateLong: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  prayersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  prayerItem: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    minHeight: 86,
    justifyContent: 'space-between',
  },
  prayerItemPressed: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0EA5E9',
  },
  prayerLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  assignmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: '#E2E8F0',
  },
  assignmentPillYou: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  assignmentPillOther: {
    backgroundColor: '#E2E8F0',
  },
  assignmentPillEmpty: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  assignmentTextYou: {
    color: '#0B7A30',
  },
  assignmentTextOther: {
    color: '#0F172A',
  },
  assignmentTextEmpty: {
    color: '#9CA3AF',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
  },
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  weekCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
  },
  weekBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  weekSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  weekSummaryDay: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekSummaryPrayers: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  noAssignments: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    minHeight: 220,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  sheetRow: {
    marginTop: 6,
  },
  sheetRowLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  sheetRowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    marginTop: 18,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
