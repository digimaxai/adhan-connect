'use client';

import React from 'react';
import { Link, usePathname, useRouter } from 'expo-router';
import { useAdminContext } from '../../../lib/admin-web/adminContext';
import { useAuth } from '../../../lib/auth';

// ─── Icons ────────────────────────────────────────────────────────────────────

const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    <rect x="9"   y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    <rect x="1.5" y="9"   width="5.5" height="5.5" rx="1.5" fill="currentColor" />
    <rect x="9"   y="9"   width="5.5" height="5.5" rx="1.5" fill="currentColor" />
  </svg>
);

const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4.5V8.25L10.75 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.5 13.5V6.5L8 2.5l5.5 4v7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <rect x="5.25" y="8.5" width="2.25" height="3" rx="0.75" fill="currentColor" opacity="0.75" />
    <rect x="8.5"  y="8.5" width="2.25" height="3" rx="0.75" fill="currentColor" opacity="0.75" />
    <path d="M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="6" cy="5.25" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1 14c0-2.485 2.239-4.5 5-4.5s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="5.25" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14.5 14c0-1.657-1.12-3.04-2.5-3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MosqueCtxIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 1.5C4.8 3.5 3.5 5.5 3.5 7.75a3.5 3.5 0 007 0C10.5 5.5 9.2 3.5 7 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M4.5 12.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SignOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M5.5 2H3a1 1 0 00-1 1v9a1 1 0 001 1h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M10.5 10.5l3-3-3-3M13.5 7.5H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Brand crescent moon icon
const CrescentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      fill="white"
      opacity="0.95"
    />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type Props = {
  compact?: boolean;
  isPhone?: boolean;
};

// ─── Active check ─────────────────────────────────────────────────────────────

function isActive(pathname: string, href: string) {
  if (!href) return false;
  if (pathname === href) return true;
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href.endsWith('/') ? href : `${href}/`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSidebar({ compact = false, isPhone = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMosqueMode, selectedMosqueId } = useAdminContext();
  const { user, signOut } = useAuth();

  const globalItems: NavItem[] = [
    { label: 'Dashboard',    href: '/admin',               icon: <GridIcon /> },
    { label: 'Prayer Times', href: '/admin/prayer-times',  icon: <ClockIcon /> },
    { label: 'Mosques',      href: '/admin/mosques',        icon: <BuildingIcon /> },
    { label: 'Users',        href: '/admin/users',          icon: <UsersIcon /> },
  ];

  const mosqueItems: NavItem[] = selectedMosqueId
    ? [
        { label: 'Mosque Profile', href: `/admin/mosques/${selectedMosqueId}`,              icon: <BuildingIcon /> },
        { label: 'Prayer Times',   href: `/admin/mosques/${selectedMosqueId}/prayer-times`, icon: <ClockIcon /> },
      ]
    : [];

  const handleSignOut = async () => {
    try { await signOut?.(); } finally { router.replace('/sign-in' as any); }
  };

  // ── Horizontal (compact / phone) layout ───────────────────────────────────
  if (compact || isPhone) {
    return (
      <aside style={styles.sidebarHoriz}>
        <div style={styles.brandHoriz}>
          <span style={styles.brandIconHoriz}>☽</span>
          <span style={styles.brandNameHoriz}>Adhan</span>
        </div>
        <nav style={styles.navHoriz}>
          {globalItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={`adm-sidebar-link${active ? ' adm-sidebar-link-active' : ''}`}
                style={styles.linkHoriz as any}
              >
                {item.icon}
                <span style={styles.linkHorizLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  // ── Full vertical sidebar ─────────────────────────────────────────────────
  return (
    <aside className="adm-sidebar-scroll" style={styles.sidebar}>
      {/* Brand mark */}
      <div style={styles.brand}>
        <div style={styles.brandMark}>
          <CrescentIcon />
        </div>
        <div style={styles.brandText}>
          <div style={styles.brandName}>Adhan Connect</div>
          <div style={styles.brandRole}>Main Admin</div>
        </div>
      </div>

      <div style={styles.divider} />

      {/* Global nav */}
      <div style={styles.navSection}>
        <div style={styles.navSectionLabel}>Navigation</div>
        <nav style={styles.nav}>
          {globalItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={`adm-sidebar-link${active ? ' adm-sidebar-link-active' : ''}`}
                style={styles.link as any}
              >
                <span style={styles.linkIcon}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mosque context nav */}
      {isMosqueMode && mosqueItems.length > 0 ? (
        <div style={styles.navSection}>
          <div style={styles.navSectionLabel}>
            <MosqueCtxIcon />
            Mosque
          </div>
          <nav style={styles.nav}>
            {mosqueItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={`adm-sidebar-link${active ? ' adm-sidebar-link-active' : ''}`}
                  style={styles.link as any}
                >
                  <span style={styles.linkIcon}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      <div style={styles.divider} />

      {/* User section */}
      <div style={styles.userSection}>
        {user?.email ? (
          <div style={styles.userMeta}>
            <div style={styles.userAvatar}>
              {(user.email[0] ?? '?').toUpperCase()}
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userEmail}>{user.email}</div>
              <div style={styles.userBadge}>Main Admin</div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="adm-sidebar-link"
          style={styles.signOutBtn}
          onClick={handleSignOut}
        >
          <span style={styles.linkIcon}><SignOutIcon /></span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'sticky',
    top: 0,
    width: 236,
    minWidth: 236,
    height: '100vh',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, rgba(13,148,136,0.07) 0%, transparent 110px), #0a1628',
    color: '#e2e8f0',
    padding: '0 10px 12px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,0.04)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 10px 16px',
    flexShrink: 0,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(13,148,136,0.35)',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  },
  brandName: {
    fontSize: 14,
    fontWeight: 800,
    color: '#f1f5f9',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  },
  brandRole: {
    fontSize: 11,
    fontWeight: 600,
    color: '#3d566e',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.08)',
    margin: '4px 0',
    flexShrink: 0,
  },
  navSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '12px 0 4px',
    flexShrink: 0,
  },
  navSectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#3d566e',
    padding: '0 12px 5px',
    fontWeight: 800,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 600,
    color: '#8fa3bb',
    textDecoration: 'none',
    borderLeft: '2px solid transparent',
  } as React.CSSProperties,
  linkIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    opacity: 0.85,
  },
  userSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 0 0',
    flexShrink: 0,
  },
  userMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px 6px',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0d9488, #0369a1)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '-0.01em',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: 12,
    fontWeight: 600,
    color: '#8fa3bb',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  userBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0d9488',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 600,
    color: '#4d6678',
    background: 'none',
    border: 'none',
    borderLeft: '2px solid transparent',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    boxSizing: 'border-box',
    letterSpacing: '-0.01em',
  },

  // ── Horizontal styles ──────────────────────────────────────────────────────
  sidebarHoriz: {
    width: '100%',
    background: '#0a1628',
    padding: '10px 16px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid rgba(148,163,184,0.1)',
    flexShrink: 0,
  },
  brandHoriz: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginRight: 8,
    flexShrink: 0,
  },
  brandIconHoriz: {
    fontSize: 18,
    color: '#2dd4bf',
  },
  brandNameHoriz: {
    fontSize: 14,
    fontWeight: 800,
    color: '#f1f5f9',
    letterSpacing: '-0.02em',
  },
  navHoriz: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexWrap: 'wrap',
    flex: 1,
  },
  linkHoriz: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#8fa3bb',
    textDecoration: 'none',
    border: '2px solid transparent',
    borderLeft: '2px solid transparent',
    whiteSpace: 'nowrap',
  },
  linkHorizLabel: {
    fontSize: 13,
  },
};
