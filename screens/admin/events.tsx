import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { supabase } from '@/lib/supabase';

type EventItem = {
  id: string;
  title: string | null;
  start_at: string | null;
  description: string | null;
};

export default function EventsScreen() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { selectedMosque, mosques, loading: mosqueLoading } = useAdminMosque();
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!selectedMosque) {
      setItems([]);
      setError(mosques.length ? 'Select a mosque to review its events.' : null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('events')
        .select('id,title,start_at,description')
        .eq('mosque_id', selectedMosque.mosqueId)
        .order('start_at', { ascending: true, nullsFirst: false });
      if (queryError) throw queryError;
      setItems((data as EventItem[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load mosque events.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMosque, mosques.length]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEvents();
    } finally {
      setRefreshing(false);
    }
  }, [loadEvents]);

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <AppText variant="body" style={styles.loadingText}>Loading...</AppText>
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
      title="Events"
      subtitle="Review the current event feed for the mosque you are managing."
      backHref="/(admin)"
      backLabel="Back to Console"
      mosqueName={selectedMosque?.name ?? null}
      mosqueMeta={selectedMosque ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || 'Event feed' : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />}
    >
      {!selectedMosque && !mosques.length ? (
        <AdminBanner
          tone="warning"
          title="No mosque access"
          message="No admin mosque was found for this account, so there are no local events to review yet."
        />
      ) : null}

      {error ? <AdminBanner tone="danger" title="Events unavailable" message={error} /> : null}

      {loading ? (
        <View style={styles.centeredBlock}>
          <ActivityIndicator />
          <AppText variant="body" style={styles.loadingText}>Loading mosque events...</AppText>
        </View>
      ) : items.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <View style={styles.emptyPill}>
            <AppText variant="caption" style={styles.emptyPillText}>Event feed</AppText>
          </View>
          <AppText variant="title" style={styles.emptyTitle}>No events published</AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            There are no upcoming event records linked to this mosque yet.
          </AppText>
        </AppCard>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push({ pathname: '/(admin)/event/[id]', params: { id: item.id } } as any)}
            style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
          >
            <AppCard style={styles.eventCard}>
              <View style={styles.eventRow}>
                <View style={styles.dateBadge}>
                  <AppText variant="caption" style={styles.dateMonth}>
                    {getDateParts(item.start_at).month}
                  </AppText>
                  <AppText variant="title" style={styles.dateDay}>
                    {getDateParts(item.start_at).day}
                  </AppText>
                </View>
                <View style={styles.eventCopy}>
                  <AppText variant="title" style={styles.eventTitle}>{item.title ?? 'Untitled event'}</AppText>
                  <AppText variant="body" color={tokens.color.text.secondary} style={styles.eventMeta}>
                    {formatDateTime(item.start_at)}
                  </AppText>
                </View>
              </View>
              {item.description ? (
                <AppText variant="caption" color={tokens.color.text.secondary} style={styles.eventDescription}>
                  {item.description}
                </AppText>
              ) : null}
              <View style={styles.eventFooter}>
                <AppText variant="caption" color="#0369A1" style={styles.footerLabel}>
                  Open event
                </AppText>
                <AppText variant="caption" color="#0369A1" style={styles.footerArrow}>
                  {`>`}
                </AppText>
              </View>
            </AppCard>
          </Pressable>
        ))
      )}
    </AdminScreenShell>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return 'Date and time not set';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'Date and time not set';
  return d.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDateParts(value: string | null) {
  if (!value) return { month: 'TBD', day: '--' };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { month: 'TBD', day: '--' };
  return {
    month: d.toLocaleString([], { month: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
  };
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  centeredBlock: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8 },
  emptyCard: { gap: 8, padding: 14, borderRadius: 20, borderColor: '#E2EAF2' },
  emptyPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#EEF7FF',
  },
  emptyPillText: {
    color: '#0369A1',
    fontWeight: tokens.typography.weight.bold,
  },
  emptyTitle: { fontSize: 18 },
  cardPressable: { borderRadius: 16 },
  pressed: { opacity: 0.92 },
  eventCard: { gap: 12, padding: 14, borderRadius: 20, borderColor: '#E1E9F2' },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dateBadge: {
    width: 62,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#F3FAFF',
    borderWidth: 1,
    borderColor: '#D9ECFA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  dateMonth: {
    color: '#0369A1',
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.4,
  },
  dateDay: {
    fontSize: 22,
    lineHeight: 24,
  },
  eventCopy: { flex: 1, gap: 6, paddingTop: 4 },
  eventTitle: { fontSize: 18, lineHeight: 22 },
  eventMeta: { lineHeight: 18, fontSize: 13 },
  eventDescription: { lineHeight: 18 },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  footerLabel: {
    fontWeight: tokens.typography.weight.bold,
  },
  footerArrow: {
    fontWeight: tokens.typography.weight.bold,
  },
});
