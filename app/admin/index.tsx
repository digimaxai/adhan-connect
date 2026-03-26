'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { Button, Pill } from '../../components/admin/web/ui';
import { RequireMainAdmin } from '../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider } from '../../lib/admin-web/adminContext';
import { AdminFeedbackProvider } from '../../lib/admin-web/adminFeedback';
import { useAdminViewport } from '../../lib/admin-web/useAdminViewport';
import AdminShell from '../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel } from '../../components/admin/web/AdminPrimitives';
import { useAuth } from '../../lib/auth';
import type { MosqueOption } from '../../components/admin/web/AdminTopBar';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
};

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

function AdminLanding() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { isComfortable, isCompact, isPhone } = useAdminViewport();
  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mosquesRes, usersRes] = await Promise.all([
        supabase
          .from('mosques')
          .select('id, name, city, country, status')
          .order('name', { ascending: true })
          .limit(500),
        supabase.from('users').select('id', { count: 'exact', head: true }),
      ]);

      if (!cancelled && !mosquesRes.error) setMosques(mosquesRes.data ?? []);
      if (!cancelled && !usersRes.error) setUserCount(usersRes.count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const pendingMosques = mosques.filter((m) => m.status === 'pending').length;
  const inactiveMosques = mosques.filter((m) => m.status === 'inactive').length;
  const activeMosques = mosques.filter((m) => m.status === 'active').length;

  const quickActions = [
    {
      title: 'Review mosques',
      description: 'Approve pending registrations, deactivate listings, and inspect mosque profiles.',
      href: '/admin/mosques',
    },
    {
      title: 'Prayer times',
      description: 'Upload timetable files, review parser output, and publish schedule changes.',
      href: '/admin/prayer-times',
    },
    {
      title: 'Manage users',
      description: 'Set roles, audit assignments, and resolve mismatched access.',
      href: '/admin/users',
    },
  ];

  const priorityItems = [
    { label: 'Pending mosques', value: pendingMosques, tone: pendingMosques ? 'pending' : 'active' },
    { label: 'Inactive mosques', value: inactiveMosques, tone: inactiveMosques ? 'inactive' : 'active' },
    { label: 'User accounts', value: userCount, tone: 'active' },
  ];

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
    {
      key: 'dashboard-sign-out',
      label: 'Sign out',
      description: 'Leave the main admin portal.',
      keywords: ['logout', 'sign out'],
      onSelect: async () => {
        try {
          await signOut?.();
        } finally {
          router.replace('/sign-in' as any);
        }
      },
    },
  ];

  return (
    <AdminShell
      title="Main admin command center"
      eyebrow="System Operations"
      description="Oversee onboarding, access, and service health from one clear operational surface."
      mosques={mosqueOptions}
      onSearch={handleSearch}
      commandActions={commandActions}
      actions={
        <Button
          variant="danger"
          onClick={async () => {
            try {
              await signOut?.();
            } finally {
              router.replace('/sign-in' as any);
            }
          }}
        >
          Sign out
        </Button>
      }
    >
      <div
        style={{
          ...styles.metricGrid,
          ...(isComfortable ? styles.metricGridComfortable : null),
          ...(isPhone ? styles.metricGridPhone : null),
        }}
      >
        <AdminMetricCard label="Registered mosques" value={mosques.length} detail={`${activeMosques} active across the network`} />
        <AdminMetricCard label="Pending approvals" value={pendingMosques} detail="New submissions needing a main admin decision" />
        <AdminMetricCard label="Inactive mosques" value={inactiveMosques} detail="Listings hidden or paused from active service" />
        <AdminMetricCard label="Platform users" value={userCount} detail="Accounts with active access to the platform" />
      </div>

      <div
        style={{
          ...styles.dashboardGrid,
          ...(isComfortable ? styles.dashboardGridComfortable : null),
          ...(isCompact ? styles.dashboardGridCompact : null),
        }}
      >
        <AdminPanel title="Priority queue" subtitle="Start with the highest-value work so the console feels like an operations desk, not a link page.">
          <div style={styles.priorityList}>
            {priorityItems.map((item) => (
              <div
                key={item.label}
                style={{
                  ...styles.priorityRow,
                  ...(isPhone ? styles.priorityRowPhone : null),
                }}
              >
                <div style={styles.priorityMeta}>
                  <div style={styles.priorityLabel}>{item.label}</div>
                  <div style={styles.priorityHint}>Current live count</div>
                </div>
                <div
                  style={{
                    ...styles.priorityValueWrap,
                    ...(isPhone ? styles.priorityValueWrapPhone : null),
                  }}
                >
                  <div style={styles.priorityValue}>{item.value}</div>
                  <Pill status={item.tone} />
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Action surfaces" subtitle="Move straight into the workflows that already exist and matter today.">
          <div style={styles.actionGrid}>
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href as any} style={styles.actionCard as any}>
                <div style={styles.actionTitle}>{action.title}</div>
                <div style={styles.actionDescription}>{action.description}</div>
                <div style={styles.actionLink}>Open workspace</div>
              </Link>
            ))}
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  metricGrid: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  metricGridComfortable: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  metricGridPhone: {
    gridTemplateColumns: '1fr',
  },
  dashboardGrid: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns: 'minmax(0, 1.12fr) minmax(0, 1fr)',
    gap: 18,
  },
  dashboardGridComfortable: {
    gridTemplateColumns: '1fr',
  },
  dashboardGridCompact: {
    gridTemplateColumns: '1fr',
  },
  priorityList: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: 14,
  },
  priorityRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 20,
    padding: '18px 18px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  priorityRowPhone: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  priorityMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  priorityLabel: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  priorityHint: {
    fontSize: 13,
    color: '#64748b',
  },
  priorityValueWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  priorityValueWrapPhone: {
    width: '100%',
    justifyContent: 'space-between',
  },
  priorityValue: {
    fontSize: 28,
    fontWeight: 900,
    color: '#0f172a',
  },
  actionGrid: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 14,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 210,
    padding: '20px',
    borderRadius: 24,
    textDecoration: 'none',
    color: '#0f172a',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.95) 100%)',
    border: '1px solid rgba(14,165,233,0.18)',
    boxShadow: '0 16px 28px rgba(14,165,233,0.08)',
    boxSizing: 'border-box',
  },
  actionTitle: {
    fontSize: 21,
    lineHeight: 1.15,
    fontWeight: 900,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 1.65,
    color: '#475569',
    flex: 1,
  },
  actionLink: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0369a1',
  },
};
