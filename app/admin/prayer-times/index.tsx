'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider, useAdminContext } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider } from '../../../lib/admin-web/adminFeedback';
import type { MosqueOption } from '../../../components/admin/web/AdminTopBar';
import AdminShell from '../../../components/admin/web/AdminShell';
import { AdminPanel } from '../../../components/admin/web/AdminPrimitives';
import { Button, Pill } from '../../../components/admin/web/ui';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
};

export default function PrayerTimesHubPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <PrayerTimesHubShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function PrayerTimesHubShell() {
  const router = useRouter();
  const { selectedMosqueId, setSelectedMosqueId } = useAdminContext();
  const [mosques, setMosques] = useState<MosqueRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await supabase
        .from('mosques')
        .select('id, name, city, country, status')
        .order('name', { ascending: true })
        .limit(500);
      if (!cancelled && !res.error) {
        setMosques(res.data ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mosqueOptions = useMemo<MosqueOption[]>(
    () =>
      mosques.map((mosque) => ({
        id: mosque.id,
        name: mosque.name ?? 'Mosque',
        city: mosque.city ?? null,
        country: mosque.country ?? null,
        status: mosque.status ?? null,
      })),
    [mosques]
  );

  const selectedMosque = useMemo(
    () => mosques.find((mosque) => mosque.id === selectedMosqueId) ?? null,
    [mosques, selectedMosqueId]
  );

  const openPrayerTimesWorkspace = (mosqueId: string) => {
    if (selectedMosqueId !== mosqueId) {
      setSelectedMosqueId(mosqueId);
    }
    router.push(`/admin/mosques/${mosqueId}/prayer-times` as any);
  };

  const commandActions = [
    ...(selectedMosque
      ? [
          {
            key: 'open-selected-prayer-times',
            label: 'Open selected mosque prayer times',
            description: 'Enter the prayer-times workspace for the mosque currently in context.',
            keywords: ['prayer', 'times', 'selected', 'mosque'],
            onSelect: () => openPrayerTimesWorkspace(selectedMosque.id),
          },
          {
            key: 'open-selected-mosque-profile',
            label: 'Open selected mosque profile',
            description: 'Return to the selected mosque workspace.',
            keywords: ['mosque', 'profile', 'selected'],
            onSelect: () => router.push(`/admin/mosques/${selectedMosque.id}` as any),
          },
        ]
      : []),
    {
      key: 'open-mosques-directory',
      label: 'Open mosques directory',
      description: 'Browse the network and choose the mosque that needs schedule work.',
      keywords: ['mosques', 'directory'],
      onSelect: () => router.push('/admin/mosques' as any),
    },
  ];

  return (
    <AdminShell
      title="Prayer times workspace"
      eyebrow="Network timetable operations"
      description="Prayer-times publishing is now mosque specific. Enter one mosque workspace at a time to upload a month patch or full-year timetable with a clear overwrite review."
      mosques={mosqueOptions}
      commandActions={commandActions}
      actions={
        selectedMosque ? (
          <>
            <Button variant="ghost" onClick={() => router.push(`/admin/mosques/${selectedMosque.id}` as any)}>
              View mosque
            </Button>
            <Button onClick={() => openPrayerTimesWorkspace(selectedMosque.id)}>
              Open selected mosque workspace
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => router.push('/admin/mosques' as any)}>
            Browse mosques
          </Button>
        )
      }
    >
      <div style={styles.grid}>
        <AdminPanel
          title="Current context"
          subtitle="The import surface only opens inside a mosque route now, so publish actions cannot drift across mosques."
        >
          {selectedMosque ? (
            <div style={styles.contextCard}>
              <div style={styles.contextName}>{selectedMosque.name}</div>
              <div style={styles.contextMeta}>
                {[selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || 'Mosque workspace'}
              </div>
              <div style={styles.inlineActions}>
                <Button variant="secondary" onClick={() => openPrayerTimesWorkspace(selectedMosque.id)}>
                  Open prayer times
                </Button>
                <Button variant="ghost" onClick={() => setSelectedMosqueId(null)}>
                  Clear context
                </Button>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              Select a mosque from the top bar or open one from the list below before uploading a timetable.
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title="Onboarding path"
          subtitle="A new mosque should enter schedule setup immediately after creation instead of being sent to a generic upload page."
        >
          <div style={styles.checklist}>
            <div>1. Create or approve the mosque.</div>
            <div>2. Enter that mosque workspace.</div>
            <div>3. Upload the timetable and confirm whether it is a single month, date-range patch, or full year.</div>
            <div>4. Review overwrite counts before publish.</div>
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Mosque workspaces"
        subtitle="Open the exact mosque that needs an annual timetable or a monthly correction."
      >
        <div style={styles.workspaceList}>
          {mosques.map((mosque) => (
            <div key={mosque.id} style={styles.workspaceRow}>
              <div style={styles.workspaceMeta}>
                <div style={styles.workspaceName}>{mosque.name}</div>
                <div style={styles.workspaceDetail}>
                  {[mosque.city, mosque.country].filter(Boolean).join(', ') || 'Location pending'}
                </div>
              </div>
              <div style={styles.workspaceActions}>
                <Pill status={mosque.status} />
                <Button variant="ghost" onClick={() => setSelectedMosqueId(mosque.id)}>
                  Enter context
                </Button>
                <Button variant="secondary" onClick={() => openPrayerTimesWorkspace(mosque.id)}>
                  Open prayer times
                </Button>
              </div>
            </div>
          ))}
          {!mosques.length ? (
            <div style={styles.emptyState}>No mosques are currently available for prayer-times publishing.</div>
          ) : null}
        </div>
      </AdminPanel>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 14,
  },
  contextCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    border: '1px solid #dbeafe',
    background: 'linear-gradient(135deg, #f8fbff 0%, #eef8ff 100%)',
  },
  contextName: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
  },
  contextMeta: {
    color: '#475569',
    lineHeight: 1.5,
  },
  inlineActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  checklist: {
    display: 'grid',
    gap: 10,
    color: '#334155',
    lineHeight: 1.5,
  },
  workspaceList: {
    display: 'grid',
    gap: 10,
  },
  workspaceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 14,
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    flexWrap: 'wrap',
  },
  workspaceMeta: {
    display: 'grid',
    gap: 4,
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  workspaceDetail: {
    color: '#64748b',
    fontSize: 14,
  },
  workspaceActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  emptyState: {
    color: '#64748b',
    lineHeight: 1.5,
  },
};
