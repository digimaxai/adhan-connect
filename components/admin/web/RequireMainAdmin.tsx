'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useRoleFlags } from '../../../lib/roles';

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
  const roles = useRoleFlags();
  const isMainAdmin = roles.isMainAdmin;

  // Debug log fires for both authorized and unauthorized users so we can inspect role resolution.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading || roles.loading) return;
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
          resolvedRole: roles.role ?? null,
          isMainAdmin,
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
  }, [isMainAdmin, loading, roles.loading, roles.role, user]);

  useEffect(() => {
    if (loading || roles.loading) return;
    if (!isMainAdmin && redirectTo) {
      router.replace(redirectTo as any);
    }
  }, [loading, roles.loading, isMainAdmin, redirectTo, router]);

  if (loading || roles.loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingTitle}>Checking access...</div>
        <div style={styles.loadingText}>Loading your admin permissions.</div>
      </div>
    );
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

const styles: Record<string, React.CSSProperties> = {
  loading: {
    width: '100%',
    maxWidth: 720,
    margin: '48px auto',
    padding: '32px 24px',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#475569',
  },
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
