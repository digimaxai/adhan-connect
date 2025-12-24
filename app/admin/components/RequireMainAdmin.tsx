'use client';

import React, { ReactNode, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';

type Props = {
  children: ReactNode;
  redirectTo?: string; // optional redirect when not authorized
};

/**
 * RequireMainAdmin
 * - Wrap pages/components to enforce users.role === 'main_admin'
 * - Uses existing useAuth hook; does not bypass RLS
 * - Shows a 403 message or redirects when unauthorized
 */
export function RequireMainAdmin({ children, redirectTo }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const isMainAdmin = useMemo(() => user?.role === 'main_admin', [user?.role]);

  // Debug log fires for both authorized and unauthorized users so we can inspect role resolution.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading) return;
    try {
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
          sessionPresent: Boolean(user),
        },
        navigator: {
          userAgent: window.navigator.userAgent,
          language: window.navigator.language,
          platform: window.navigator.platform,
        },
      };
      console.groupCollapsed('[ADMIN_DEBUG] gate check');
      console.info(payload);
      console.groupEnd();
    } catch {
      // swallow
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!isMainAdmin && redirectTo) {
      router.replace(redirectTo);
    }
  }, [loading, isMainAdmin, redirectTo, router]);

  if (loading) {
    return null;
  }

  if (!isMainAdmin) {
    return (
      <div style={styles.forbidden}>
        <h1 style={styles.title}>403 — Forbidden</h1>
        <p style={styles.text}>You must be a system admin (main_admin) to access this area.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Expo Router treats files under app/ as routes; provide a default
// export to satisfy the router while keeping the named export for imports.
export default function RequireMainAdminRouteShim() {
  return null;
}

const styles: Record<string, React.CSSProperties> = {
  forbidden: {
    width: '100%',
    maxWidth: 720,
    margin: '48px auto',
    padding: '24px',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#475569',
  },
};
