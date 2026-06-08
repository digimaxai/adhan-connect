'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { RequireMainAdmin } from '../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider } from '../../lib/admin-web/adminContext';
import { AdminFeedbackProvider } from '../../lib/admin-web/adminFeedback';
import { useAdminViewport } from '../../lib/admin-web/useAdminViewport';
import AdminShell from '../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel, AdminSectionLabel } from '../../components/admin/web/AdminPrimitives';
import { AdminDonutChart, AdminBarChart, AdminProgressBar, AdminStatRow } from '../../components/admin/web/AdminCharts';
import type { MosqueOption } from '../../components/admin/web/AdminTopBar';
import { fetchAllMosqueRows } from '../../lib/api/admin/mosqueDirectory';

// ─── Types ────────────────────────────────────────────────────────────────────

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  created_at?: string | null;
};

// ─── SVG action card icons ────────────────────────────────────────────────────

const MosqueIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 21V10.5L12 5l9 5.5V21" stroke="#0d9488" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 21v-7h6v7" stroke="#0d9488" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 5V3" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="2.5" r="0.6" fill="#0d9488" />
  </svg>
);

const PrayerTimesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="#0d9488" strokeWidth="1.6" />
    <path d="M12 7.5v5l3.5 2.25" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersActionIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="8.5" cy="7.5" r="3.5" stroke="#0d9488" strokeWidth="1.6" />
    <path d="M2 21v-1.5a6.5 6.5 0 0113 0V21" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M17 11a3.5 3.5 0 010 7" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M21.5 21a6 6 0 00-5-5.94" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 3L18.66 17.5H1.34L10 3z" stroke="#d97706" strokeWidth="1.6" strokeLinejoin="round" fill="#fef3c7" />
    <path d="M10 9v4" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="10" cy="14.5" r="0.75" fill="#d97706" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyRegistrations(mosques: MosqueRow[], count: number = 6) {
  const now = new Date();
  const buckets: { label: string; year: number; month: number; value: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
      value: 0,
    });
  }
  mosques.forEach((m) => {
    if (!m.created_at) return;
    const d = new Date(m.created_at);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.value += 1;
  });
  return buckets.map((b) => ({ label: b.label, value: b.value }));
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const DASHBOARD_REFRESH_MS = 30000;

function formatRefreshTimestamp(timestamp: number | null) {
  if (!timestamp) return 'Loading dashboard data...';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function AdminHomePage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <AdminLanding />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AdminLanding() {
  const router = useRouter();
  const { isComfortable, isCompact, isPhone } = useAdminViewport();

  const [mosques,         setMosques]         = useState<MosqueRow[]>([]);
  const [userCount,       setUserCount]       = useState(0);
  const [muezzinCount,    setMuezzinCount]    = useState(0);
  const [localAdminCount, setLocalAdminCount] = useState(0);
  const [liveStreams,     setLiveStreams]     = useState(0);
  const [refreshing,      setRefreshing]      = useState(false);
  const [refreshError,    setRefreshError]    = useState<string | null>(null);
  const [lastUpdatedAt,   setLastUpdatedAt]   = useState<number | null>(null);
  const [loading,        setLoading]         = useState(true);

  // ── Data fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const refreshDashboard = async (initial = false) => {
      if (inFlight) return;
      inFlight = true;
      if (initial) setLoading(true);
      else setRefreshing(true);

      try {
        const [mosquesRes, usersRes, muezzinsRes, adminsRes, streamsRes] = await Promise.all([
          fetchAllMosqueRows<MosqueRow>(supabase, 'id, name, city, country, status, created_at', {
            orderBy: 'created_at',
            ascending: false,
          }),
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('muezzins').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('mosque_admins').select('id', { count: 'exact', head: true }),
          supabase.from('streams').select('id', { count: 'exact', head: true }).eq('is_live', true),
        ]);

        if (cancelled) return;
        if (!mosquesRes.error)  setMosques(mosquesRes.data ?? []);
        if (!usersRes.error)    setUserCount(usersRes.count ?? 0);
        if (!muezzinsRes.error) setMuezzinCount(muezzinsRes.count ?? 0);
        if (!adminsRes.error)   setLocalAdminCount(adminsRes.count ?? 0);
        if (!streamsRes.error)  setLiveStreams(streamsRes.count ?? 0);

        const errorCount = [mosquesRes, usersRes, muezzinsRes, adminsRes, streamsRes].filter((res) => res.error).length;
        setRefreshError(
          errorCount === 0
            ? null
            : errorCount === 5
              ? 'Dashboard refresh failed. Showing the latest loaded data.'
              : 'Some dashboard metrics could not refresh. Showing the latest loaded data.'
        );
        setLastUpdatedAt(Date.now());
      } catch {
        if (!cancelled) {
          setRefreshError('Dashboard refresh failed. Showing the latest loaded data.');
        }
      } finally {
        inFlight = false;
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void refreshDashboard(true);
    const refreshId = window.setInterval(() => void refreshDashboard(false), DASHBOARD_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────
  const pendingMosques  = mosques.filter((m) => m.status === 'pending').length;
  const inactiveMosques = mosques.filter((m) => m.status === 'inactive').length;
  const activeMosques   = mosques.filter((m) => m.status === 'active').length;
  const monthlyData     = useMemo(() => getMonthlyRegistrations(mosques), [mosques]);

  const donutSegments = [
    { label: 'Active',   value: activeMosques,   color: '#16a34a' },
    { label: 'Pending',  value: pendingMosques,   color: '#d97706' },
    { label: 'Inactive', value: inactiveMosques,  color: '#94a3b8' },
  ].filter((s) => s.value > 0);

  const handleSearch = (term: string) => {
    const value = term.trim();
    if (!value) return;
    if (value.includes('@')) {
      router.push(`/admin/users?search=${encodeURIComponent(value)}` as any);
      return;
    }
    router.push(`/admin/mosques?search=${encodeURIComponent(value)}` as any);
  };

  const mosqueOptions = useMemo<MosqueOption[]>(
    () =>
      mosques.map((m) => ({
        id: m.id,
        name: m.name ?? 'Mosque',
        city: m.city ?? null,
        country: m.country ?? null,
        status: m.status ?? null,
      })),
    [mosques]
  );

  const commandActions = [
    {
      key: 'dashboard-review-mosques',
      label: 'Review mosque approvals',
      description: 'Open the mosque directory focused on operational review.',
      keywords: ['approvals', 'mosques', 'directory'],
      onSelect: () => router.push('/admin/mosques' as any),
    },
    {
      key: 'dashboard-prayer-times',
      label: 'Open prayer times',
      description: 'Go straight to the timetable upload and publish workspace.',
      keywords: ['prayer', 'times', 'schedule', 'upload', 'csv'],
      onSelect: () => router.push('/admin/prayer-times' as any),
    },
    {
      key: 'dashboard-manage-users',
      label: 'Manage user access',
      description: 'Jump straight to user roles and assignments.',
      keywords: ['users', 'permissions', 'roles'],
      onSelect: () => router.push('/admin/users' as any),
    },
  ];

  const twoCol = isComfortable || isCompact || isPhone;
  const refreshState = loading || refreshing ? 'refreshing' : refreshError ? 'warning' : 'fresh';

  return (
    <AdminShell
      title={`${greet()}, Admin`}
      eyebrow="Command Center"
      description="Platform health, network activity, and operational tasks — all in one view."
      mosques={mosqueOptions}
      onSearch={handleSearch}
      commandActions={commandActions}
    >

      {/* ── Needs attention banner ────────────────────────────────────────── */}
      {pendingMosques > 0 ? (
        <div style={styles.attentionBanner}>
          <div style={styles.attentionAccent} />
          <div style={styles.attentionLeft}>
            <div style={styles.attentionIconWrap}>
              <AlertIcon />
            </div>
            <div style={styles.attentionBody}>
              <div style={styles.attentionTitle}>
                {pendingMosques} mosque{pendingMosques !== 1 ? 's' : ''} pending review
              </div>
              <div style={styles.attentionSub}>
                Approve or reject before they appear in the app.
              </div>
            </div>
          </div>
          <Link href="/admin/mosques?filter=pending" style={styles.attentionCta as any}>
            Review now →
          </Link>
        </div>
      ) : null}

      {/* ── Refresh status indicator ──────────────────────────────────────── */}
      <div style={styles.liveRow}>
        <div style={refreshBadgeStyle(refreshState)}>
          <span
            className={refreshState === 'refreshing' ? 'adm-live-pulse' : ''}
            style={refreshDotStyle(refreshState)}
          />
          {loading ? 'Loading' : refreshing ? 'Refreshing' : refreshError ? 'Refresh issue' : 'Auto-refresh'}
        </div>
        <span style={styles.liveNote}>
          {refreshError ?? formatRefreshTimestamp(lastUpdatedAt)}
        </span>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div
        style={{
          ...styles.metricGrid,
          ...(twoCol ? styles.metricGrid2 : null),
          ...(isPhone ? styles.metricGrid1 : null),
        }}
      >
        <AdminMetricCard
          label="Registered mosques"
          value={loading ? '—' : mosques.length}
          detail={`${activeMosques} active across the network`}
          href="/admin/mosques"
          tone="default"
        />
        <AdminMetricCard
          label="Pending approvals"
          value={loading ? '—' : pendingMosques}
          detail="Awaiting main admin decision"
          href="/admin/mosques?filter=pending"
          tone={pendingMosques > 0 ? 'warning' : 'success'}
        />
        <AdminMetricCard
          label="Inactive mosques"
          value={loading ? '—' : inactiveMosques}
          detail="Hidden or paused from active service"
          href="/admin/mosques?filter=inactive"
          tone={inactiveMosques > 0 ? 'danger' : 'success'}
        />
        <AdminMetricCard
          label="Platform users"
          value={loading ? '—' : userCount}
          detail="Accounts with active platform access"
          href="/admin/users"
          tone="info"
        />
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div
        style={{
          ...styles.chartsGrid,
          ...(twoCol ? styles.chartsGrid1 : null),
        }}
      >
        {/* Mosque status distribution */}
        <AdminPanel
          title="Mosque status"
          subtitle="Current distribution across the network."
        >
          <AdminDonutChart
            segments={donutSegments.length ? donutSegments : [{ label: 'None', value: 1, color: '#e2e8f0' }]}
            size={148}
            thickness={26}
            centerLabel={String(mosques.length)}
            centerSub="mosques"
          />
          <div style={styles.panelDivider} />
          <AdminStatRow
            items={[
              { label: 'Active',   value: activeMosques,   color: '#16a34a' },
              { label: 'Pending',  value: pendingMosques,  color: '#d97706' },
              { label: 'Inactive', value: inactiveMosques, color: '#dc2626' },
            ]}
          />
        </AdminPanel>

        {/* Monthly registrations */}
        <AdminPanel
          title="Mosque registrations"
          subtitle="New mosques added over the last 6 months."
          action={
            <span style={styles.chartTotal}>
              {monthlyData.reduce((a, d) => a + d.value, 0)} total
            </span>
          }
        >
          <AdminBarChart data={monthlyData} height={148} barColor="#0d9488" />
        </AdminPanel>

        {/* Platform health bars */}
        <AdminPanel
          title="Platform health"
          subtitle="Coverage and activity across key metrics."
          action={
            liveStreams > 0 ? (
              <span style={styles.liveStreamBadge}>
                <span className="adm-live-pulse" style={styles.liveStreamDot} />
                {liveStreams} live
              </span>
            ) : null
          }
        >
          <div style={styles.progressStack}>
            <AdminProgressBar
              label="Active mosques"
              value={activeMosques}
              max={mosques.length || 1}
              color="#16a34a"
              sublabel={`${activeMosques} of ${mosques.length} registered`}
            />
            <AdminProgressBar
              label="Muezzins assigned"
              value={muezzinCount}
              max={Math.max(muezzinCount, activeMosques * 2, 1)}
              color="#0d9488"
              sublabel={`${muezzinCount} active muezzin${muezzinCount !== 1 ? 's' : ''}`}
            />
            <AdminProgressBar
              label="Local admins"
              value={localAdminCount}
              max={Math.max(localAdminCount, activeMosques, 1)}
              color="#0369a1"
              sublabel={`${localAdminCount} assignment${localAdminCount !== 1 ? 's' : ''}`}
            />
            <AdminProgressBar
              label="User base"
              value={userCount}
              max={Math.max(userCount, 100)}
              color="#7c3aed"
              sublabel={`${userCount} registered account${userCount !== 1 ? 's' : ''}`}
            />
          </div>
        </AdminPanel>
      </div>

      {/* ── Quick action cards ────────────────────────────────────────────── */}
      <div>
        <AdminSectionLabel label="Workspaces" />
        <div style={{ ...styles.actionGrid, ...(isPhone ? styles.actionGrid1 : null), marginTop: 12 }}>
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href as any}
              className="adm-action-card"
              style={styles.actionCard as any}
            >
              <div style={styles.actionIconWrap}>
                {action.icon}
              </div>
              <div style={styles.actionTitle}>{action.title}</div>
              <div style={styles.actionDescription}>{action.description}</div>
              <div style={styles.actionCta}>Open workspace →</div>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const quickActions = [
  {
    title: 'Mosques',
    icon: <MosqueIcon />,
    description: 'Approve registrations, update profiles, and inspect mosque configurations.',
    href: '/admin/mosques',
  },
  {
    title: 'Prayer Times',
    icon: <PrayerTimesIcon />,
    description: 'Upload timetable files, review parser output, and publish schedule changes.',
    href: '/admin/prayer-times',
  },
  {
    title: 'Users',
    icon: <UsersActionIcon />,
    description: 'Set roles, audit assignments, and resolve mismatched access.',
    href: '/admin/users',
  },
];

// ─── Refresh status styles ────────────────────────────────────────────────────

type RefreshState = 'fresh' | 'refreshing' | 'warning';

function refreshBadgeStyle(status: RefreshState): React.CSSProperties {
  const color  = status === 'fresh' ? '#15803d' : status === 'warning' ? '#b45309' : '#0369a1';
  const bg     = status === 'fresh' ? '#f0fdf4' : status === 'warning' ? '#fffbeb' : '#eff6ff';
  const border = status === 'fresh' ? '#bbf7d0' : status === 'warning' ? '#fde68a' : '#bfdbfe';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color,
    padding: '4px 10px',
    borderRadius: 999,
    backgroundColor: bg,
    border: `1px solid ${border}`,
    flexShrink: 0,
    letterSpacing: '0.01em',
  };
}

function refreshDotStyle(status: RefreshState): React.CSSProperties {
  const bg = status === 'fresh' ? '#16a34a' : status === 'warning' ? '#f59e0b' : '#0ea5e9';
  return {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: bg,
    display: 'inline-block',
    flexShrink: 0,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // Attention banner
  attentionBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 20px 14px 16px',
    borderRadius: 14,
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    flexWrap: 'wrap',
    position: 'relative',
    overflow: 'hidden',
  },
  attentionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#d97706',
    borderRadius: '14px 0 0 14px',
  },
  attentionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  attentionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  attentionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#78350f',
    letterSpacing: '-0.01em',
  },
  attentionSub: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 1.4,
  },
  attentionCta: {
    fontSize: 13,
    fontWeight: 800,
    color: '#b45309',
    textDecoration: 'none',
    flexShrink: 0,
    padding: '7px 14px',
    borderRadius: 9,
    border: '1px solid #fbbf24',
    backgroundColor: '#fef3c7',
    letterSpacing: '-0.01em',
  },

  // Live row
  liveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  liveNote: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Metric grid
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
    width: '100%',
  },
  metricGrid2: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  metricGrid1: {
    gridTemplateColumns: '1fr',
  },

  // Charts grid
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1.2fr)',
    gap: 16,
    width: '100%',
  },
  chartsGrid1: {
    gridTemplateColumns: '1fr',
  },

  // Panel divider
  panelDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    margin: '2px 0',
  },

  // Chart helpers
  progressStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  chartTotal: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94a3b8',
  },
  liveStreamBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 700,
    color: '#15803d',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    padding: '3px 9px',
    borderRadius: 999,
  },
  liveStreamDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#16a34a',
    display: 'inline-block',
    flexShrink: 0,
  },

  // Action cards
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 14,
    width: '100%',
  },
  actionGrid1: {
    gridTemplateColumns: '1fr',
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '22px 22px 20px',
    borderRadius: 16,
    textDecoration: 'none',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(148,163,184,0.2)',
    boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
    boxSizing: 'border-box',
    minHeight: 176,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    border: '1px solid #ccfbf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 1.65,
    color: '#475569',
    flex: 1,
  },
  actionCta: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0d9488',
    marginTop: 4,
    letterSpacing: '-0.01em',
  },
};
