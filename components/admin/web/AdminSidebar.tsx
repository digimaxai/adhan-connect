'use client';

import React from 'react';
import { Link, usePathname } from 'expo-router';
import { useAdminContext } from '../../../lib/admin-web/adminContext';

type NavItem = {
  label: string;
  href: string;
};

function isActive(pathname: string, href: string) {
  if (!href) return false;
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith('/') ? href : `${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { isMosqueMode, selectedMosqueId } = useAdminContext();

  const globalItems: NavItem[] = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Prayer Times', href: '/admin/prayer-times' },
    { label: 'Mosques', href: '/admin/mosques' },
    { label: 'Users', href: '/admin/users' },
  ];

  const mosqueItems: NavItem[] = selectedMosqueId
    ? [
        { label: 'Mosque Profile', href: `/admin/mosques/${selectedMosqueId}` },
        { label: 'Prayer Times', href: `/admin/mosques/${selectedMosqueId}/prayer-times` },
      ]
    : [];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Global</div>
        <nav style={styles.nav}>
          {globalItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                style={{ ...styles.link, ...(active ? styles.linkActive : {}) } as any}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {isMosqueMode ? (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Mosque</div>
          <nav style={styles.nav}>
            {mosqueItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  style={{ ...styles.link, ...(active ? styles.linkActive : {}) } as any}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    minWidth: 260,
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    height: '100%',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94a3b8',
    padding: '4px 8px',
    fontWeight: 700,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  link: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 8,
    color: '#e2e8f0',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  linkActive: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
  },
};
