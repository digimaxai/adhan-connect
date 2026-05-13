'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAdminContext } from '../../../lib/admin-web/adminContext';
import { AdminToastViewport } from '../../../lib/admin-web/adminFeedback';
import { useAdminViewport } from '../../../lib/admin-web/useAdminViewport';
import AdminCommandPalette, { type AdminCommandAction } from './AdminCommandPalette';
import AdminSidebar from './AdminSidebar';
import AdminTopBar, { MosqueOption } from './AdminTopBar';
import { useInjectAdminStyles } from './useInjectAdminStyles';

export type BreadcrumbItem = { label: string; href?: string };

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  mosques: MosqueOption[];
  onSearch?: (term: string) => void;
  notices?: React.ReactNode;
  commandActions?: AdminCommandAction[];
  children: React.ReactNode;
};

export default function AdminShell({
  title,
  eyebrow,
  description,
  breadcrumbs,
  actions,
  mosques,
  onSearch,
  notices,
  commandActions = [],
  children,
}: Props) {
  useInjectAdminStyles();
  const router = useRouter();
  const { selectedMosqueId, setSelectedMosqueId, isMosqueMode } = useAdminContext();
  const { isComfortable, isStacked, isCompact, isPhone } = useAdminViewport();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedMosqueName = useMemo(
    () => mosques.find((m) => m.id === selectedMosqueId)?.name ?? null,
    [mosques, selectedMosqueId]
  );

  const baseActions = useMemo<AdminCommandAction[]>(
    () => [
      {
        key: 'route-dashboard',
        label: 'Open dashboard',
        description: 'Return to the main admin command center.',
        keywords: ['home', 'overview', 'dashboard'],
        onSelect: () => router.push('/admin' as any),
      },
      {
        key: 'route-users',
        label: 'Open users',
        description: 'Manage platform users, roles, and mosque assignments.',
        keywords: ['users', 'roles', 'permissions'],
        onSelect: () => router.push('/admin/users' as any),
      },
      {
        key: 'route-prayer-times',
        label: 'Open prayer times',
        description: selectedMosqueId
          ? 'Open the prayer-times workspace for the selected mosque.'
          : 'Choose a mosque and publish prayer schedule changes.',
        keywords: ['prayer', 'times', 'schedule', 'upload', 'csv'],
        onSelect: () =>
          router.push(
            (selectedMosqueId
              ? `/admin/mosques/${selectedMosqueId}/prayer-times`
              : '/admin/prayer-times') as any
          ),
      },
      {
        key: 'route-mosques',
        label: 'Open mosques',
        description: 'Review the mosque network and approval queue.',
        keywords: ['mosques', 'network', 'directory'],
        onSelect: () => router.push('/admin/mosques' as any),
      },
      ...(selectedMosqueId
        ? [
            {
              key: 'route-selected-mosque',
              label: 'Open selected mosque workspace',
              description: 'Jump into the mosque currently in context.',
              keywords: ['selected', 'mosque', 'context'],
              onSelect: () => router.push(`/admin/mosques/${selectedMosqueId}` as any),
            },
          ]
        : []),
      ...(isMosqueMode
        ? [
            {
              key: 'exit-mosque-context',
              label: 'Exit mosque context',
              description: 'Return to global main-admin mode.',
              keywords: ['context', 'global', 'exit'],
              onSelect: () => setSelectedMosqueId(null),
            },
          ]
        : []),
    ],
    [isMosqueMode, router, selectedMosqueId, setSelectedMosqueId]
  );

  const mosqueActions = useMemo<AdminCommandAction[]>(
    () =>
      mosques.map((mosque) => ({
        key: `mosque-${mosque.id}`,
        label: `Open ${mosque.name}`,
        description: [mosque.city, mosque.country].filter(Boolean).join(', ') || 'Open mosque workspace',
        keywords: ['mosque', mosque.name, mosque.city ?? '', mosque.country ?? '', mosque.status ?? ''],
        onSelect: () => {
          setSelectedMosqueId(mosque.id);
          router.push(`/admin/mosques/${mosque.id}` as any);
        },
      })),
    [mosques, router, setSelectedMosqueId]
  );

  const mergedActions = useMemo(
    () => [...commandActions, ...baseActions, ...mosqueActions],
    [baseActions, commandActions, mosqueActions]
  );

  return (
    <div style={{ ...styles.layout, ...(isStacked ? styles.layoutStacked : null) }}>
      <AdminSidebar compact={isStacked} isPhone={isPhone} />

      <main style={styles.main}>
        <AdminTopBar
          mosques={mosques}
          onSearch={onSearch}
          onOpenCommandPalette={() => setCommandOpen(true)}
          stacked={isStacked}
          compact={isCompact}
          isPhone={isPhone}
        />

        {/* Mosque context strip */}
        {isMosqueMode && selectedMosqueName ? (
          <div style={styles.contextStrip}>
            <div style={styles.contextAccent} />
            <div style={styles.contextLeft}>
              <span style={styles.contextDot} />
              <span style={styles.contextText}>
                Mosque context: <strong>{selectedMosqueName}</strong>
                {' '}— actions on this page affect this mosque only.
              </span>
            </div>
            <button
              type="button"
              className="adm-context-exit"
              style={styles.contextExit}
              onClick={() => setSelectedMosqueId(null)}
            >
              Exit context
            </button>
          </div>
        ) : null}

        <div
          style={{
            ...styles.canvas,
            ...(isComfortable ? styles.canvasComfortable : null),
            ...(isCompact ? styles.canvasCompact : null),
            ...(isPhone ? styles.canvasPhone : null),
          }}
        >
          {/* Page hero */}
          <div
            style={{
              ...styles.hero,
              ...(isComfortable ? styles.heroComfortable : null),
            }}
          >
            {/* Dot grid pattern */}
            <div style={styles.heroPattern} />
            {/* Primary glow — bottom right */}
            <div style={styles.heroGlow} />
            {/* Secondary glow — top left */}
            <div style={styles.heroGlowTL} />

            <div
              style={{
                ...styles.heroInner,
                ...(isCompact ? styles.heroInnerCompact : null),
              }}
            >
              <div
                style={{
                  ...styles.heroCopy,
                  ...(isCompact ? styles.heroCopyCompact : null),
                }}
              >
                {breadcrumbs && breadcrumbs.length > 0 ? (
                  <nav aria-label="Breadcrumb" style={styles.breadcrumb}>
                    {breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 ? (
                          <span style={styles.breadcrumbSep} aria-hidden="true">/</span>
                        ) : null}
                        {crumb.href ? (
                          <a
                            href={crumb.href}
                            className="adm-breadcrumb-link"
                            style={styles.breadcrumbLink}
                            onClick={(e) => { e.preventDefault(); router.push(crumb.href as any); }}
                          >
                            {crumb.label}
                          </a>
                        ) : (
                          <span style={styles.breadcrumbCurrent} aria-current="page">
                            {crumb.label}
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                ) : null}
                {eyebrow && !breadcrumbs?.length ? <div style={styles.eyebrow}>{eyebrow}</div> : null}
                <h1
                  style={{
                    ...styles.title,
                    ...(isCompact ? styles.titleCompact : null),
                    ...(isPhone ? styles.titlePhone : null),
                  }}
                >
                  {title}
                </h1>
                {description ? (
                  <p
                    style={{
                      ...styles.description,
                      ...(isCompact ? styles.descriptionCompact : null),
                    }}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
              {actions ? (
                <div
                  style={{
                    ...styles.heroActions,
                    ...(isCompact ? styles.heroActionsCompact : null),
                  }}
                >
                  {actions}
                </div>
              ) : null}
            </div>
          </div>

          {notices ? <div style={styles.notices}>{notices}</div> : null}
          <div style={styles.content}>{children}</div>
        </div>
      </main>

      <AdminCommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} actions={mergedActions} />
      <AdminToastViewport />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    backgroundColor: '#f4f7fb',
  },
  layoutStacked: {
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  contextStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '9px 20px 9px 16px',
    backgroundColor: '#fffbeb',
    borderBottom: '1px solid #fde68a',
    flexShrink: 0,
    flexWrap: 'wrap',
    position: 'relative',
  },
  contextAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#d97706',
  },
  contextLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  contextDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#d97706',
    flexShrink: 0,
  },
  contextText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 1.4,
  },
  contextExit: {
    padding: '5px 12px',
    borderRadius: 8,
    border: '1px solid #fbbf24',
    backgroundColor: 'transparent',
    color: '#b45309',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    boxSizing: 'border-box',
    letterSpacing: '0.01em',
  },
  canvas: {
    width: '100%',
    maxWidth: 1600,
    margin: '0 auto',
    padding: '24px 28px 48px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  canvasComfortable: {
    padding: '20px 22px 36px',
  },
  canvasCompact: {
    padding: '16px',
    gap: 16,
  },
  canvasPhone: {
    padding: '12px',
    gap: 14,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.05)',
    background: 'linear-gradient(135deg, #0a1628 0%, #0b3d35 48%, #0a3254 80%, #082240 100%)',
    boxShadow: '0 8px 32px rgba(10,22,40,0.22)',
  },
  heroComfortable: {
    borderRadius: 18,
  },
  heroPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)',
    backgroundSize: '28px 28px',
    pointerEvents: 'none',
  },
  heroGlow: {
    position: 'absolute',
    right: '-6%',
    bottom: '-55%',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(13,148,136,0.38) 0%, transparent 68%)',
    pointerEvents: 'none',
  },
  heroGlowTL: {
    position: 'absolute',
    left: '-4%',
    top: '-60%',
    width: 240,
    height: 240,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(3,105,161,0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 20,
    padding: '30px 34px',
    flexWrap: 'wrap',
    boxSizing: 'border-box',
  },
  heroInnerCompact: {
    alignItems: 'flex-start',
    padding: '22px 20px',
  },
  heroCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    maxWidth: 860,
  },
  heroCopyCompact: {
    maxWidth: '100%',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  breadcrumbLink: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'rgba(226, 232, 240, 0.62)',
    textDecoration: 'none',
  },
  breadcrumbSep: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.28)',
    userSelect: 'none',
  },
  breadcrumbCurrent: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'rgba(226, 232, 240, 0.92)',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: '#2dd4bf',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.9rem, 1.6rem + 0.75vw, 2.6rem)',
    lineHeight: 1.06,
    fontWeight: 900,
    color: '#f8fafc',
    letterSpacing: '-0.025em',
  },
  titleCompact: {
    fontSize: 'clamp(1.65rem, 1.45rem + 0.6vw, 2.1rem)',
  },
  titlePhone: {
    fontSize: 'clamp(1.5rem, 1.3rem + 0.7vw, 1.85rem)',
  },
  description: {
    margin: 0,
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.7,
    color: 'rgba(226, 232, 240, 0.72)',
  },
  descriptionCompact: {
    maxWidth: '100%',
    fontSize: 13,
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroActionsCompact: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  notices: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: 20,
  },
};
