'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import AdminSidebar from './components/AdminSidebar';
import AdminTopBar, { MosqueOption } from './components/AdminTopBar';
import { RequireMainAdmin } from './components/RequireMainAdmin';
import { AdminContextProvider } from './lib/adminContext';
import { useAuth } from '../../lib/auth';

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
        <AdminLanding />
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function AdminLanding() {
  const { signOut, user, session } = useAuth();
  const router = useRouter();
  const [mosques, setMosques] = useState<MosqueRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mosquesRes = await supabase
          .from('mosques')
          .select('id, name, city, country, status')
          .order('name', { ascending: true })
          .limit(500);
        if (!mosquesRes.error && !cancelled) {
          setMosques(mosquesRes.data ?? []);
        }
      } catch {
        // ignore errors; top bar can operate without options
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageMosque = window.localStorage.getItem('admin:selected_mosque_id');
    const payload = {
      ts: new Date().toISOString(),
      location: {
        href: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      },
      auth: {
        userId: user?.id ?? null,
        role: user?.role ?? null,
        email: user?.email ?? null,
        sessionPresent: Boolean(session),
      },
      navigator: {
        userAgent: window.navigator.userAgent,
        language: window.navigator.language,
        platform: window.navigator.platform,
      },
      adminContext: {
        selectedMosqueId: storageMosque ?? null,
      },
    };
    // Central debug log to trace admin entry conditions
    console.groupCollapsed('[ADMIN_DEBUG] dashboard mount');
    console.info(payload);
    console.groupEnd();
  }, [session, user?.email, user?.id, user?.role]);

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

  const cards = [
    { label: 'Manage Mosques', href: '/admin/mosques', desc: 'Approve, suspend, and manage mosques.' },
    { label: 'Manage Users', href: '/admin/users', desc: 'Roles and mosque assignments.' },
    { label: 'Campaigns', href: '/admin/campaigns', desc: 'View and manage campaigns.' },
    { label: 'Billing', href: '/admin/billing', desc: 'Plans, payments, and invoices.' },
  ];

  return (
    <div style={styles.layout}>
      <AdminSidebar />
      <main style={styles.main}>
        <AdminTopBar mosques={mosqueOptions} />
        <div style={styles.content}>
          <div style={styles.headerRow}>
            <h1 style={styles.pageTitle}>System Admin Dashboard</h1>
            <button
              style={styles.signOutButton}
              onClick={async () => {
                try {
                  await signOut?.();
                } finally {
                  router.replace('/sign-in');
                }
              }}
            >
              Sign out
            </button>
          </div>
          <div style={styles.cardGrid}>
            {cards.map((card) => (
              <Link key={card.href} href={card.href} style={styles.card}>
                <div style={styles.cardLabel}>{card.label}</div>
                <div style={styles.cardDesc}>{card.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  content: {
    padding: '20px',
    maxWidth: 1440,
    width: '100%',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'block',
    padding: '16px 18px',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    textDecoration: 'none',
    color: '#0f172a',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#475569',
  },
  signOutButton: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #ef4444',
    backgroundColor: '#fff1f2',
    color: '#b91c1c',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

