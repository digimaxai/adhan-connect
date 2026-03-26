'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAdminContext } from '../../../lib/admin-web/adminContext';
import { AdminToastViewport } from '../../../lib/admin-web/adminFeedback';
import { useAdminViewport } from '../../../lib/admin-web/useAdminViewport';
import AdminCommandPalette, { type AdminCommandAction } from './AdminCommandPalette';
import AdminSidebar from './AdminSidebar';
import AdminTopBar, { MosqueOption } from './AdminTopBar';

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
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
  actions,
  mosques,
  onSearch,
  notices,
  commandActions = [],
  children,
}: Props) {
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
          ? 'Open the prayer-times workspace for the mosque currently selected in context.'
          : 'Choose a mosque and publish prayer schedule changes from its workspace.',
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
              description: 'Jump into the mosque currently selected in context mode.',
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
        <div
          style={{
            ...styles.canvas,
            ...(isComfortable ? styles.canvasComfortable : null),
            ...(isCompact ? styles.canvasCompact : null),
            ...(isPhone ? styles.canvasPhone : null),
          }}
        >
          <div
            style={{
              ...styles.hero,
              ...(isComfortable ? styles.heroComfortable : null),
            }}
          >
            <div style={styles.heroGlow} />
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
                {eyebrow ? <div style={styles.eyebrow}>{eyebrow}</div> : null}
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
                    ...styles.actions,
                    ...(isCompact ? styles.actionsCompact : null),
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
    background:
      'radial-gradient(circle at top left, rgba(14,165,233,0.16), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef4f7 100%)',
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
  canvas: {
    width: '100%',
    maxWidth: 1720,
    margin: '0 auto 0 0',
    padding: '24px 28px 32px',
    boxSizing: 'border-box',
    alignSelf: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  canvasComfortable: {
    padding: '22px 24px 28px',
  },
  canvasCompact: {
    padding: '16px',
  },
  canvasPhone: {
    padding: '12px',
    gap: 12,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    borderRadius: 32,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background:
      'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(15,118,110,0.92) 55%, rgba(14,165,233,0.88) 100%)',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.14)',
  },
  heroComfortable: {
    borderRadius: 28,
  },
  heroGlow: {
    position: 'absolute',
    inset: 'auto -14% -45% auto',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.16)',
    filter: 'blur(8px)',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 20,
    padding: '32px 34px',
    flexWrap: 'wrap',
    boxSizing: 'border-box',
  },
  heroInnerCompact: {
    alignItems: 'flex-start',
    padding: '24px 22px',
  },
  heroCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxWidth: 980,
  },
  heroCopyCompact: {
    maxWidth: '100%',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: 'rgba(226, 232, 240, 0.78)',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2.25rem, 1.95rem + 0.85vw, 3.1rem)',
    lineHeight: 1.02,
    fontWeight: 900,
    color: '#f8fafc',
  },
  titleCompact: {
    fontSize: 'clamp(2rem, 1.7rem + 0.7vw, 2.5rem)',
  },
  titlePhone: {
    fontSize: 'clamp(1.7rem, 1.45rem + 0.8vw, 2.1rem)',
  },
  description: {
    margin: 0,
    maxWidth: 820,
    fontSize: 15,
    lineHeight: 1.65,
    color: 'rgba(226, 232, 240, 0.88)',
  },
  descriptionCompact: {
    maxWidth: '100%',
    fontSize: 14,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  actionsCompact: {
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
    gap: 18,
  },
};
