'use client';

import React from 'react';
import { Link, usePathname } from 'expo-router';
import { useAdminContext } from '../../../lib/admin-web/adminContext';

type NavItem = {
  label: string;
  href: string;
};

type Props = {
  compact?: boolean;
  isPhone?: boolean;
};

function isActive(pathname: string, href: string) {
  if (!href) return false;
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith('/') ? href : `${href}/`);
}

export default function AdminSidebar({ compact = false, isPhone = false }: Props) {
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
    <aside
      style={{
        ...styles.sidebar,
        ...(compact ? styles.sidebarCompact : null),
        ...(isPhone ? styles.sidebarPhone : null),
      }}
    >
      <div
        style={{
          ...styles.section,
          ...(compact ? styles.sectionCompact : null),
        }}
      >
        <div style={styles.sectionTitle}>Global</div>
        <nav style={{ ...styles.nav, ...(compact ? styles.navCompact : null) }}>
          {globalItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                style={
                  {
                    ...styles.link,
                    ...(compact ? styles.linkCompact : null),
                    ...(active ? styles.linkActive : {}),
                  } as any
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {isMosqueMode ? (
        <div
          style={{
            ...styles.section,
            ...(compact ? styles.sectionCompact : null),
          }}
        >
          <div style={styles.sectionTitle}>Mosque</div>
          <nav style={{ ...styles.nav, ...(compact ? styles.navCompact : null) }}>
            {mosqueItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  style={
                    {
                      ...styles.link,
                      ...(compact ? styles.linkCompact : null),
                      ...(active ? styles.linkActive : {}),
                    } as any
                  }
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
    width: 244,
    minWidth: 244,
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: '18px 12px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    height: '100%',
  },
  sidebarCompact: {
    width: '100%',
    minWidth: 0,
    height: 'auto',
    padding: '14px 16px',
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottom: '1px solid rgba(148, 163, 184, 0.24)',
  },
  sidebarPhone: {
    padding: '12px',
    gap: 10,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionCompact: {
    flex: '1 1 260px',
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94a3b8',
    padding: '4px 8px',
    fontWeight: 800,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  link: {
    display: 'block',
    padding: '11px 12px',
    borderRadius: 10,
    color: '#e2e8f0',
    textDecoration: 'none',
    fontSize: 15,
    fontWeight: 700,
  },
  linkCompact: {
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  },
  linkActive: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
  },
};
