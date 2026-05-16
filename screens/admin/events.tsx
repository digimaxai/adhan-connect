import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components/ui/app-text';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { supabase } from '@/lib/supabase';

type Tab = 'events' | 'campaigns' | 'notices';

type EventItem = {
  id: string;
  title: string | null;
  start_at: string | null;
  status: string | null;
  location: string | null;
};

type CampaignItem = {
  id: string;
  title: string | null;
  goal_cents: number | null;
  raised_cents: number | null;
  end_at: string | null;
  status: string | null;
};

type NoticeItem = {
  id: string;
  title: string | null;
  summary: string | null;
  created_at: string | null;
  status: string | null;
  is_urgent: boolean | null;
};

const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'events',    label: 'Events',    icon: 'calendar-outline' },
  { key: 'campaigns', label: 'Campaigns', icon: 'heart-outline' },
  { key: 'notices',   label: 'Notices',   icon: 'megaphone-outline' },
];

function statusChip(status: string | null): { bg: string; color: string; label: string } {
  switch (status) {
    case 'published': return { bg: '#ECFDF5', color: '#059669', label: 'Published' };
    case 'active':    return { bg: '#ECFDF5', color: '#059669', label: 'Active' };
    case 'cancelled': return { bg: '#FEF2F2', color: '#DC2626', label: 'Cancelled' };
    case 'ended':     return { bg: '#F1F5F9', color: '#475569', label: 'Ended' };
    case 'paused':    return { bg: '#FFFBEB', color: '#D97706', label: 'Paused' };
    case 'draft':     return { bg: '#F1F5F9', color: '#475569', label: 'Draft' };
    default:          return { bg: '#ECFDF5', color: '#059669', label: 'Published' };
  }
}

function fmtDateShort(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateOnly(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCurrency(cents: number | null) {
  if (cents == null) return '—';
  return `£${(cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function pct(raised: number | null, goal: number | null) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round(((raised ?? 0) / goal) * 100));
}

// ── Sub-list components ──────────────────────────────────────────────────────

function EventsList({ events, router }: { events: EventItem[]; router: ReturnType<typeof useRouter> }) {
  if (events.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="calendar-outline" size={32} color={tokens.color.text.muted} />
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.emptyText}>
          No events yet. Tap <AppText variant="body" style={styles.emptyHighlight}>New</AppText> to create your first event.
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.listCard}>
      {events.map((ev, i) => {
        const chip = statusChip(ev.status);
        const isLast = i === events.length - 1;
        return (
          <React.Fragment key={ev.id}>
            <Pressable
              onPress={() => router.push({ pathname: '/(admin)/event/[id]', params: { id: ev.id } } as any)}
              style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
            >
              <View style={styles.eventDateBadge}>
                {ev.start_at ? (
                  <>
                    <AppText style={styles.badgeMonth}>
                      {new Date(ev.start_at).toLocaleString([], { month: 'short' }).toUpperCase()}
                    </AppText>
                    <AppText style={styles.badgeDay}>{new Date(ev.start_at).getDate()}</AppText>
                  </>
                ) : (
                  <AppText style={styles.badgeTbd}>TBD</AppText>
                )}
              </View>
              <View style={styles.listRowBody}>
                <View style={styles.listRowTop}>
                  <AppText variant="body" style={styles.listRowTitle} numberOfLines={1}>{ev.title ?? 'Untitled'}</AppText>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <AppText style={[styles.chipText, { color: chip.color }]}>{chip.label}</AppText>
                  </View>
                </View>
                {(ev.start_at || ev.location) ? (
                  <AppText variant="caption" color={tokens.color.text.secondary} numberOfLines={1}>
                    {[fmtDateShort(ev.start_at), ev.location].filter(Boolean).join(' · ')}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
            </Pressable>
            {!isLast && <View style={styles.divider} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function CampaignsList({ campaigns, router }: { campaigns: CampaignItem[]; router: ReturnType<typeof useRouter> }) {
  if (campaigns.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="heart-outline" size={32} color={tokens.color.text.muted} />
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.emptyText}>
          No campaigns yet. Tap <AppText variant="body" style={styles.emptyHighlight}>New</AppText> to launch your first fundraising campaign.
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.listCard}>
      {campaigns.map((c, i) => {
        const chip = statusChip(c.status);
        const progress = pct(c.raised_cents, c.goal_cents);
        const isLast = i === campaigns.length - 1;
        return (
          <React.Fragment key={c.id}>
            <Pressable
              onPress={() => router.push({ pathname: '/(admin)/campaign/[id]', params: { id: c.id } } as any)}
              style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
            >
              <View style={styles.campaignIconWrap}>
                <Ionicons name="heart" size={18} color="#E11D48" />
              </View>
              <View style={styles.listRowBody}>
                <View style={styles.listRowTop}>
                  <AppText variant="body" style={styles.listRowTitle} numberOfLines={1}>{c.title ?? 'Untitled'}</AppText>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <AppText style={[styles.chipText, { color: chip.color }]}>{chip.label}</AppText>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                </View>
                <AppText variant="caption" color={tokens.color.text.secondary}>
                  {fmtCurrency(c.raised_cents)} raised of {fmtCurrency(c.goal_cents)}
                  {c.end_at ? ` · ends ${fmtDateOnly(c.end_at)}` : ''}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
            </Pressable>
            {!isLast && <View style={styles.divider} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function NoticesList({ notices, router }: { notices: NoticeItem[]; router: ReturnType<typeof useRouter> }) {
  if (notices.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="megaphone-outline" size={32} color={tokens.color.text.muted} />
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.emptyText}>
          No notices yet. Tap <AppText variant="body" style={styles.emptyHighlight}>New</AppText> to post an announcement.
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.listCard}>
      {notices.map((n, i) => {
        const chip = statusChip(n.status);
        const isLast = i === notices.length - 1;
        return (
          <React.Fragment key={n.id}>
            <Pressable
              onPress={() => router.push({ pathname: '/(admin)/announcement/[id]', params: { id: n.id } } as any)}
              style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
            >
              <View style={[styles.noticeIconWrap, n.is_urgent && styles.noticeIconUrgent]}>
                <Ionicons
                  name={n.is_urgent ? 'alert' : 'megaphone'}
                  size={18}
                  color={n.is_urgent ? '#DC2626' : '#7C3AED'}
                />
              </View>
              <View style={styles.listRowBody}>
                <View style={styles.listRowTop}>
                  <AppText variant="body" style={styles.listRowTitle} numberOfLines={1}>{n.title ?? 'Untitled'}</AppText>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <AppText style={[styles.chipText, { color: chip.color }]}>{chip.label}</AppText>
                  </View>
                </View>
                {n.summary ? (
                  <AppText variant="caption" color={tokens.color.text.secondary} numberOfLines={1}>{n.summary}</AppText>
                ) : null}
                {n.created_at ? (
                  <AppText variant="caption" color={tokens.color.text.muted}>{fmtDateOnly(n.created_at)}</AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
            </Pressable>
            {!isLast && <View style={styles.divider} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ContentHubScreen() {
  const router = useRouter();
  const { loading: roleLoading } = useRoleFlags();
  const { selectedMosque, loading: mosqueLoading } = useAdminMosque();
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedTabs = useRef(new Set<Tab>());

  const loadTab = useCallback(async (t: Tab, force = false) => {
    if (!selectedMosque) return;
    if (!force && loadedTabs.current.has(t)) return;
    setLoading(true);
    setError(null);
    try {
      if (t === 'events') {
        const { data, error: e } = await supabase
          .from('events')
          .select('id,title,start_at,status,location')
          .eq('mosque_id', selectedMosque.mosqueId)
          .order('start_at', { ascending: true, nullsFirst: false });
        if (e) throw e;
        setEvents((data ?? []) as EventItem[]);
      } else if (t === 'campaigns') {
        const { data, error: e } = await supabase
          .from('campaigns')
          .select('id,title,goal_cents,raised_cents,end_at,status')
          .eq('mosque_id', selectedMosque.mosqueId)
          .order('created_at', { ascending: false });
        if (e) throw e;
        setCampaigns((data ?? []) as CampaignItem[]);
      } else {
        const { data, error: e } = await supabase
          .from('announcements')
          .select('id,title,summary,created_at,status,is_urgent')
          .eq('mosque_id', selectedMosque.mosqueId)
          .order('created_at', { ascending: false });
        if (e) throw e;
        setNotices((data ?? []) as NoticeItem[]);
      }
      loadedTabs.current.add(t);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load content.');
    } finally {
      setLoading(false);
    }
  }, [selectedMosque]);

  useEffect(() => {
    loadedTabs.current.clear();
    setEvents([]);
    setCampaigns([]);
    setNotices([]);
    if (selectedMosque) loadTab(tab, true);
  }, [selectedMosque?.mosqueId]);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedTabs.current.delete(tab);
    await loadTab(tab, true);
    setRefreshing(false);
  }, [tab, loadTab]);

  const handleNew = () => {
    if (tab === 'events') router.push({ pathname: '/(admin)/event/[id]', params: { id: 'new' } } as any);
    else if (tab === 'campaigns') router.push({ pathname: '/(admin)/campaign/[id]', params: { id: 'new' } } as any);
    else router.push({ pathname: '/(admin)/announcement/[id]', params: { id: 'new' } } as any);
  };

  if (roleLoading || mosqueLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.centered}><ActivityIndicator color={tokens.color.status.info} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* ── Fixed header ── */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push('/(admin)' as any)}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.color.text.primary} />
          </Pressable>
          <View style={styles.headerTitles}>
            {selectedMosque ? (
              <AppText variant="caption" style={styles.headerMosque} numberOfLines={1}>
                {selectedMosque.name}
              </AppText>
            ) : null}
            <AppText variant="sectionTitle" style={styles.headerTitle}>Content</AppText>
          </View>
          {selectedMosque ? (
            <Pressable
              onPress={handleNew}
              style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <AppText style={styles.newBtnText}>New</AppText>
            </Pressable>
          ) : (
            <View style={styles.newBtnPlaceholder} />
          )}
        </View>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={({ pressed }) => [
                  styles.tabPill,
                  active && styles.tabPillActive,
                  pressed && !active && styles.pressed,
                ]}
              >
                <Ionicons name={t.icon} size={14} color={active ? '#2563EB' : tokens.color.text.secondary} />
                <AppText style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />
        }
      >
        {!selectedMosque && (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={28} color={tokens.color.text.muted} />
            <AppText variant="body" color={tokens.color.text.secondary} style={styles.emptyText}>
              Select a mosque in the console to manage its content.
            </AppText>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={tokens.color.status.danger} />
            <AppText variant="caption" color={tokens.color.status.danger} style={{ flex: 1 }}>{error}</AppText>
          </View>
        )}

        {loading && !refreshing && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={tokens.color.status.info} />
          </View>
        )}

        {!loading && selectedMosque && (
          <>
            {tab === 'events'    && <EventsList    events={events}       router={router} />}
            {tab === 'campaigns' && <CampaignsList campaigns={campaigns} router={router} />}
            {tab === 'notices'   && <NoticesList   notices={notices}     router={router} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },

  fixedHeader: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: Platform.OS === 'android' ? tokens.spacing.md : tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
    backgroundColor: tokens.color.bg.app,
    gap: tokens.spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  headerTitles: { flex: 1 },
  headerMosque: { color: '#0369A1', fontWeight: tokens.typography.weight.semibold, fontSize: tokens.typography.size.xs },
  headerTitle: { fontSize: 22, fontWeight: tokens.typography.weight.extrabold, lineHeight: 28 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#2563EB',
  },
  newBtnText: { color: '#fff', fontSize: tokens.typography.size.sm, fontWeight: tokens.typography.weight.bold },
  newBtnPlaceholder: { width: 68 },

  tabBar: { flexDirection: 'row', gap: 8 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    backgroundColor: tokens.color.bg.surface,
  },
  tabPillActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  tabLabel: { fontSize: tokens.typography.size.sm, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.secondary },
  tabLabelActive: { color: '#2563EB', fontWeight: tokens.typography.weight.bold },

  scrollContent: { padding: tokens.spacing.lg, paddingTop: tokens.spacing.md, gap: tokens.spacing.md, paddingBottom: 48 },

  listCard: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    overflow: 'hidden',
    ...({ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 } as any),
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: tokens.color.bg.surface,
  },
  rowPressed: { backgroundColor: '#F8FAFC' },
  listRowBody: { flex: 1, gap: 4 },
  listRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listRowTitle: { flex: 1, fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border.subtle, marginLeft: 60 },

  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radius.pill },
  chipText: { fontSize: 11, fontWeight: tokens.typography.weight.bold },

  eventDateBadge: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeMonth: { fontSize: 9, fontWeight: tokens.typography.weight.bold, color: '#2563EB', letterSpacing: 0.5 },
  badgeDay: { fontSize: 17, fontWeight: tokens.typography.weight.extrabold, color: '#1E3A8A', lineHeight: 20 },
  badgeTbd: { fontSize: 10, fontWeight: tokens.typography.weight.bold, color: tokens.color.text.muted },

  campaignIconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#E11D48' },

  noticeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noticeIconUrgent: { backgroundColor: '#FEF2F2' },

  emptyCard: {
    gap: 12,
    padding: 24,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    alignItems: 'center',
  },
  emptyText: { textAlign: 'center', lineHeight: 22 },
  emptyHighlight: { fontWeight: tokens.typography.weight.bold, color: tokens.color.text.primary },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  loadingBlock: { paddingVertical: 32, alignItems: 'center' },
});
