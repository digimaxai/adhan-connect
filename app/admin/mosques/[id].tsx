'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider, useAdminContext } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider, useAdminFeedback } from '../../../lib/admin-web/adminFeedback';
import type { MosqueOption } from '../../../components/admin/web/AdminTopBar';
import AdminShell from '../../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel } from '../../../components/admin/web/AdminPrimitives';
import { Button, Modal, Pill, Select, TextInput } from '../../../components/admin/web/ui';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AssignmentUser = {
  id: string;
  email: string | null;
  role: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

type MosqueAdmin = { user_id: string; mosque_id: string };
type MuezzinRow = { user_id: string; mosque_id: string; is_active?: boolean | null };

export default function MosqueProfilePage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <MosqueProfileShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function MosqueProfileShell() {
  const params = useLocalSearchParams<{ id: string }>();
  const routeIdRaw = params?.id;
  const routeId = Array.isArray(routeIdRaw) ? routeIdRaw[0] : routeIdRaw;
  const router = useRouter();
  const { selectedMosqueId, setSelectedMosqueId } = useAdminContext();
  const { notifyError, notifyInfo, notifySuccess } = useAdminFeedback();

  const mosqueId = routeId || selectedMosqueId || '';

  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [tab, setTab] = useState<'overview' | 'admins' | 'muezzins' | 'campaigns'>('overview');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [admins, setAdmins] = useState<MosqueAdmin[]>([]);
  const [muezzins, setMuezzins] = useState<MuezzinRow[]>([]);
  const [peopleById, setPeopleById] = useState<Record<string, AssignmentUser>>({});
  const [userOptions, setUserOptions] = useState<AssignmentUser[]>([]);
  const [assignUserIdAdmin, setAssignUserIdAdmin] = useState('');
  const [assignUserIdMuezzin, setAssignUserIdMuezzin] = useState('');
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [addAdminEmail, setAddAdminEmail] = useState('');
  const [addAdminDisplayName, setAddAdminDisplayName] = useState('');
  const [addAdminError, setAddAdminError] = useState<string | null>(null);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', city: '', country: '', status: 'pending' });
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const upsertPeople = (rows: AssignmentUser[]) => {
    if (!rows?.length) return;
    setPeopleById((prev) => {
      const next = { ...prev };
      rows.forEach((u) => {
        if (u?.id) next[u.id] = u;
      });
      return next;
    });
  };

  const upsertUserOption = (user: AssignmentUser) => {
    setUserOptions((prev) => {
      const index = prev.findIndex((row) => row.id === user.id);
      if (index === -1) return [user, ...prev];
      const next = [...prev];
      next[index] = user;
      return next;
    });
  };

  useEffect(() => {
    if (routeId && selectedMosqueId !== routeId) {
      setSelectedMosqueId(routeId);
    }
  }, [routeId, selectedMosqueId, setSelectedMosqueId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mosquesSelectorRes = await supabase
        .from('mosques')
        .select('id, name, city, country, status')
        .order('name', { ascending: true })
        .limit(500);
      if (!mosquesSelectorRes.error && !cancelled) {
        setMosquesForSelector(mosquesSelectorRes.data ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const usersRes = await supabase
        .from('users')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!usersRes.error && !cancelled) {
        setUserOptions(usersRes.data ?? []);
        upsertPeople(usersRes.data ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mosqueId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const [mosqRes, adminsRes, muezzinRes] = await Promise.all([
          supabase.from('mosques').select('id, name, city, country, status, created_at').eq('id', mosqueId).maybeSingle(),
          supabase.from('mosque_admins').select('user_id, mosque_id').eq('mosque_id', mosqueId),
          supabase.from('muezzins').select('user_id, mosque_id, is_active').eq('mosque_id', mosqueId),
        ]);

        if (!cancelled) {
          setMosque(mosqRes.data ?? null);
          setAdmins(adminsRes.data ?? []);
          setMuezzins(muezzinRes.data ?? []);
        }

        const ids = new Set<string>();
        (adminsRes.data ?? []).forEach((a: MosqueAdmin) => ids.add(a.user_id));
        (muezzinRes.data ?? []).forEach((m: MuezzinRow) => ids.add(m.user_id));
        if (ids.size) {
          const peopleRes = await supabase.from('users').select('id, email, role, created_at').in('id', Array.from(ids));
          if (!peopleRes.error && !cancelled) {
            upsertPeople(peopleRes.data ?? []);
          }
        }
      } catch (error) {
        console.error('mosque workspace load error', error);
        if (!cancelled) setErrorBanner('Unable to load data. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mosqueId]);

  useEffect(() => {
    if (!mosque) return;
    setEditForm({
      name: mosque.name ?? '',
      city: mosque.city ?? '',
      country: mosque.country ?? '',
      status: mosque.status ?? 'pending',
    });
  }, [mosque]);

  const mosqueOptions = useMemo<MosqueOption[]>(
    () =>
      mosquesForSelector.map((m) => ({
        id: m.id,
        name: m.name ?? 'Mosque',
        city: m.city ?? null,
        country: m.country ?? null,
        status: m.status ?? null,
      })),
    [mosquesForSelector]
  );

  const adminAssignedIds = useMemo(() => new Set(admins.map((a) => a.user_id)), [admins]);
  const muezzinAssignedIds = useMemo(() => new Set(muezzins.map((m) => m.user_id)), [muezzins]);
  const adminCandidates = useMemo(
    () => userOptions.filter((u) => u.role === 'local_admin' || u.role === 'main_admin'),
    [userOptions]
  );
  const muezzinCandidates = useMemo(
    () => userOptions.filter((u) => u.role === 'muezzin'),
    [userOptions]
  );

  const locationLabel = [mosque?.city, mosque?.country].filter(Boolean).join(', ');
  const status = mosque?.status ?? null;
  const mosqueName = mosque?.name ?? 'Mosque';

  const updateSelector = (patch: Partial<MosqueRow>) => {
    setMosquesForSelector((prev) => prev.map((m) => (m.id === mosqueId ? { ...m, ...patch } : m)));
  };

  const handleApprove = async () => {
    if (!mosqueId) return;
    const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', mosqueId);
    if (error) {
      notifyError('Mosque approval failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setMosque((prev) => (prev ? { ...prev, status: 'active' } : prev));
    updateSelector({ status: 'active' });
    notifySuccess('Mosque approved.');
  };

  const handleSuspend = async () => {
    if (!mosqueId) return;
    const confirmed = typeof window !== 'undefined' ? window.confirm('Deactivate this mosque?') : true;
    if (!confirmed) return;
    const { error } = await supabase.from('mosques').update({ status: 'inactive' }).eq('id', mosqueId);
    if (error) {
      notifyError('Mosque deactivation failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setMosque((prev) => (prev ? { ...prev, status: 'inactive' } : prev));
    updateSelector({ status: 'inactive' });
    notifySuccess('Mosque deactivated.');
  };

  const handleAssignAdmin = async () => {
    if (!mosqueId || !assignUserIdAdmin) return;
    if (adminAssignedIds.has(assignUserIdAdmin)) {
      setAssignUserIdAdmin('');
      notifyInfo('That user already has local-admin access to this mosque.');
      return;
    }
    const { error } = await supabase.from('mosque_admins').insert({ mosque_id: mosqueId, user_id: assignUserIdAdmin });
    if (error) {
      console.error('assign admin error', error);
      notifyError('Local-admin assignment failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setAdmins((prev) => [...prev, { mosque_id: mosqueId, user_id: assignUserIdAdmin }]);
    setAssignUserIdAdmin('');
    notifySuccess('Local admin assigned.');
  };

  const handleAssignMuezzin = async () => {
    if (!mosqueId || !assignUserIdMuezzin) return;
    if (muezzinAssignedIds.has(assignUserIdMuezzin)) {
      setAssignUserIdMuezzin('');
      notifyInfo('That user already has muezzin access to this mosque.');
      return;
    }
    const { error } = await supabase.from('muezzins').insert({ mosque_id: mosqueId, user_id: assignUserIdMuezzin, is_active: true });
    if (error) {
      console.error('assign muezzin error', error);
      notifyError('Muezzin assignment failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setMuezzins((prev) => [...prev, { mosque_id: mosqueId, user_id: assignUserIdMuezzin, is_active: true }]);
    setAssignUserIdMuezzin('');
    notifySuccess('Muezzin assigned.');
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!mosqueId) return;
    const confirmed = typeof window !== 'undefined' ? window.confirm('Remove this local admin?') : true;
    if (!confirmed) return;
    const { error } = await supabase.from('mosque_admins').delete().eq('mosque_id', mosqueId).eq('user_id', userId);
    if (error) {
      console.error('remove admin error', error);
      notifyError('Removing local-admin access failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
    notifySuccess('Local admin removed.');
  };

  const handleRemoveMuezzin = async (userId: string) => {
    if (!mosqueId) return;
    const confirmed = typeof window !== 'undefined' ? window.confirm('Remove this muezzin?') : true;
    if (!confirmed) return;
    const { error } = await supabase.from('muezzins').delete().eq('mosque_id', mosqueId).eq('user_id', userId);
    if (error) {
      console.error('remove muezzin error', error);
      notifyError('Removing muezzin access failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setMuezzins((prev) => prev.filter((m) => m.user_id !== userId));
    notifySuccess('Muezzin removed.');
  };

  const handleSaveEdit = async () => {
    if (!mosqueId) return;
    const nextName = editForm.name.trim();
    if (!nextName) {
      setEditError('Name is required.');
      return;
    }

    const payload: Record<string, any> = {
      name: nextName,
      status: editForm.status,
      city: editForm.city.trim() || null,
      country: editForm.country.trim() || null,
    };

    setSavingEdit(true);
    try {
      const { error } = await supabase.from('mosques').update(payload).eq('id', mosqueId);
      if (error) {
        setEditError('Save failed. Check console logs.');
        return;
      }
      setMosque((prev) => (prev ? { ...prev, ...payload } : prev));
      updateSelector(payload);
      setEditOpen(false);
      notifySuccess('Mosque details saved.');
      setErrorBanner(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyId = async () => {
    if (!mosque?.id) return;
    try {
      await navigator.clipboard?.writeText(mosque.id);
      notifySuccess('Mosque ID copied.');
    } catch {
      notifyError('Unable to copy the mosque ID in this browser.');
    }
  };

  const openAddAdminModal = () => {
    setAddAdminError(null);
    setAddAdminEmail('');
    setAddAdminDisplayName('');
    setAddAdminOpen(true);
  };

  const closeAddAdminModal = () => {
    setAddAdminOpen(false);
    setAddAdminError(null);
    setAddAdminEmail('');
    setAddAdminDisplayName('');
  };

  const handleAddLocalAdmin = async () => {
    if (!mosqueId) return;
    const normalizedEmail = addAdminEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAddAdminError('Email is required.');
      return;
    }

    setAddAdminError(null);
    setAddingAdmin(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        setAddAdminError('Your session has expired. Refresh the page and sign in again.');
        return;
      }

      const endpoint =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/admin/local-admin-invite`
          : '/api/admin/local-admin-invite';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          displayName: addAdminDisplayName.trim(),
          mosqueId,
        }),
      });

      const rawResponse = await response.text();
      let payload: {
        error?: string;
        invited?: boolean;
        created?: boolean;
        alreadyAssigned?: boolean;
        user?: AssignmentUser;
        mosque?: { id: string; name: string };
      } = {};

      try {
        payload = rawResponse ? (JSON.parse(rawResponse) as typeof payload) : {};
      } catch {
        payload = {};
      }

      if (!response.ok || !payload.user) {
        if (payload.error) {
          setAddAdminError(payload.error);
          return;
        }

        if (response.status === 404) {
          setAddAdminError(
            'The invite endpoint is unavailable. Restart Expo after switching web output to server mode.'
          );
          return;
        }

        if (response.status >= 500) {
          setAddAdminError(
            rawResponse
              ? `Server error: ${rawResponse.slice(0, 180)}`
              : 'Server invite flow failed. Check SUPABASE_SERVICE_ROLE and restart Expo.'
          );
          return;
        }

        setAddAdminError('Unable to add or invite this local admin right now.');
        return;
      }

      const preparedUser = payload.user;
      upsertPeople([preparedUser]);
      upsertUserOption(preparedUser);
      setAdmins((prev) =>
        prev.some((item) => item.user_id === preparedUser.id)
          ? prev
          : [...prev, { mosque_id: mosqueId, user_id: preparedUser.id }]
      );
      closeAddAdminModal();
      if (payload.invited) {
        notifySuccess(
          'Local admin invited.',
          `${preparedUser.email ?? preparedUser.id} has been invited and assigned to ${mosqueName}.`
        );
        return;
      }

      notifySuccess(
        payload.alreadyAssigned ? 'Local admin already assigned.' : 'Local admin added.',
        `${preparedUser.email ?? preparedUser.id} now manages ${mosqueName}.`
      );
    } catch (error) {
      console.error('add local admin exception', error);
      setAddAdminError('Unable to add or invite this local admin right now.');
    } finally {
      setAddingAdmin(false);
    }
  };

  const commandActions = [
    {
      key: 'mosque-back-to-directory',
      label: 'Back to mosque directory',
      description: 'Return to the main mosque network list.',
      keywords: ['back', 'directory', 'mosques'],
      onSelect: () => router.push('/admin/mosques' as any),
    },
    {
      key: 'mosque-edit',
      label: 'Edit mosque',
      description: 'Open the profile and status editor for this mosque.',
      keywords: ['edit', 'mosque', 'profile'],
      onSelect: () => setEditOpen(true),
    },
    {
      key: 'mosque-open-prayer-times',
      label: 'Open prayer times workspace',
      description: 'Manage timetable uploads and day-level overrides for this mosque.',
      keywords: ['prayer', 'times', 'timetable', 'upload'],
      onSelect: () => router.push(`/admin/mosques/${mosqueId}/prayer-times` as any),
    },
    {
      key: 'mosque-add-local-admin',
      label: 'Add or invite local admin',
      description: 'Assign an existing user or send a fresh invite from this mosque workspace.',
      keywords: ['local admin', 'assign', 'invite', 'email'],
      onSelect: () => {
        setTab('admins');
        openAddAdminModal();
      },
    },
    {
      key: 'mosque-open-muezzins',
      label: 'Manage muezzins',
      description: 'Jump directly to the mosque muezzin assignment tab.',
      keywords: ['muezzin', 'assignments'],
      onSelect: () => setTab('muezzins'),
    },
    {
      key: 'mosque-copy-id',
      label: 'Copy mosque ID',
      description: 'Copy the directory identifier to the clipboard.',
      keywords: ['copy', 'id'],
      onSelect: handleCopyId,
    },
  ];

  if (!mosqueId) {
    return (
      <AdminShell
        title="Mosque workspace"
        eyebrow="Directory & Approval"
        mosques={[]}
        notices={<div style={styles.errorBanner}>Missing mosque id.</div>}
      >
        <div />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={mosqueName}
      eyebrow="Mosque Workspace"
      description={locationLabel || 'Manage status, assignments, and configuration for this mosque.'}
      mosques={mosqueOptions}
      commandActions={commandActions}
      notices={
        <>
          {errorBanner ? <div style={styles.errorBanner}>{errorBanner}</div> : null}
        </>
      }
      actions={
        <>
          <Button variant="ghost" onClick={() => router.push('/admin/mosques' as any)}>
            Back to mosques
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/admin/mosques/${mosqueId}/prayer-times` as any)}>
            Prayer times
          </Button>
          <Button variant="primary" onClick={() => setEditOpen(true)} disabled={!mosque}>
            Edit mosque
          </Button>
          <Button variant="secondary" onClick={handleApprove} disabled={status === 'active' || loading}>
            Approve
          </Button>
          <Button variant="danger" onClick={handleSuspend} disabled={status === 'inactive' || loading}>
            Deactivate
          </Button>
        </>
      }
    >
      <div style={styles.metricGrid}>
        <AdminMetricCard label="Status" value={status ?? 'unknown'} detail="Current approval and activity state" />
        <AdminMetricCard label="Local admins" value={admins.length} detail="Assigned mosque-scoped admins" />
        <AdminMetricCard label="Muezzins" value={muezzins.length} detail="Assigned muezzin accounts" />
        <AdminMetricCard
          label="Created"
          value={mosque?.created_at ? new Date(mosque.created_at).toLocaleDateString() : '-'}
          detail="Directory registration date"
        />
      </div>

      <div style={styles.tabRow}>
        {(['overview', 'admins', 'muezzins', 'campaigns'] as const).map((key) => (
          <button key={key} style={tab === key ? styles.tabActive : styles.tab} onClick={() => setTab(key)}>
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div style={styles.overviewGrid}>
          <AdminPanel title="Core profile" subtitle="Key directory data and identifiers for this mosque.">
            <div style={styles.metaList}>
              <div style={styles.metaRow}>
                <span>Status</span>
                <Pill status={status} />
              </div>
              <div style={styles.metaRow}>
                <span>Location</span>
                <span>{locationLabel || '-'}</span>
              </div>
              <div style={styles.metaRow}>
                <span>Mosque ID</span>
                <span style={styles.idText}>{mosque?.id ?? '-'}</span>
              </div>
            </div>
            <div style={styles.inlineActions}>
              <Button variant="ghost" onClick={handleCopyId}>
                Copy mosque ID
              </Button>
            </div>
          </AdminPanel>

          <AdminPanel title="Operational posture" subtitle="Assignments and readiness at a glance.">
            <div style={styles.metaList}>
              <div style={styles.metaRow}>
                <span>Admins assigned</span>
                <strong>{admins.length}</strong>
              </div>
              <div style={styles.metaRow}>
                <span>Muezzins assigned</span>
                <strong>{muezzins.length}</strong>
              </div>
              <div style={styles.metaRow}>
                <span>Workspace mode</span>
                <span>{selectedMosqueId === mosqueId ? 'Selected in context' : 'Not selected'}</span>
              </div>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {tab === 'admins' ? (
        <AdminPanel
          title="Local admin assignments"
          subtitle="Keep mosque-scoped access precise and intentional."
          action={
            <Button variant="secondary" onClick={openAddAdminModal}>
              Add or invite local admin
            </Button>
          }
        >
          <div style={styles.chipRow}>
            {admins.map((a) => {
              const user = peopleById[a.user_id];
              return (
                <span key={a.user_id} style={styles.chip}>
                  {user?.email ?? a.user_id}
                  <button style={styles.chipRemove} onClick={() => handleRemoveAdmin(a.user_id)}>
                    x
                  </button>
                </span>
              );
            })}
            {!admins.length ? <span style={styles.muted}>No admins assigned.</span> : null}
          </div>
          <div style={styles.assignRow}>
            <Select value={assignUserIdAdmin} onChange={(e) => setAssignUserIdAdmin(e.target.value)} style={{ minWidth: 260 }}>
              <option value="">Select user</option>
              {adminCandidates.map((u) => (
                <option key={u.id} value={u.id} disabled={adminAssignedIds.has(u.id)}>
                  {u.email ?? u.id} {adminAssignedIds.has(u.id) ? '(assigned)' : ''}
                </option>
              ))}
            </Select>
            <Button onClick={handleAssignAdmin} disabled={!assignUserIdAdmin || loading}>
              Assign
            </Button>
          </div>
        </AdminPanel>
      ) : null}

      {tab === 'muezzins' ? (
        <AdminPanel title="Muezzin assignments" subtitle="Use explicit role-based assignments without collapsing multi-role support.">
          <div style={styles.chipRow}>
            {muezzins.map((m) => {
              const user = peopleById[m.user_id];
              return (
                <span key={m.user_id} style={styles.chipGreen}>
                  {user?.email ?? m.user_id}
                  <span style={styles.chipStatus}>{m.is_active ? 'active' : 'inactive'}</span>
                  <button style={styles.chipRemove} onClick={() => handleRemoveMuezzin(m.user_id)}>
                    x
                  </button>
                </span>
              );
            })}
            {!muezzins.length ? <span style={styles.muted}>No muezzins assigned.</span> : null}
          </div>
          <div style={styles.assignRow}>
            <Select value={assignUserIdMuezzin} onChange={(e) => setAssignUserIdMuezzin(e.target.value)} style={{ minWidth: 260 }}>
              <option value="">Select user</option>
              {muezzinCandidates.map((u) => (
                <option key={u.id} value={u.id} disabled={muezzinAssignedIds.has(u.id)}>
                  {u.email ?? u.id} {muezzinAssignedIds.has(u.id) ? '(assigned)' : ''}
                </option>
              ))}
            </Select>
            <Button onClick={handleAssignMuezzin} disabled={!assignUserIdMuezzin || loading}>
              Assign
            </Button>
          </div>
        </AdminPanel>
      ) : null}

      {tab === 'campaigns' ? (
        <AdminPanel title="Campaigns" subtitle="Reserved for future implementation once the feature is real and tested.">
          <div style={styles.muted}>No campaigns linked yet.</div>
        </AdminPanel>
      ) : null}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Mosque">
        <div style={styles.modalStack}>
          <div>
            <label style={styles.label}>Name *</label>
            <TextInput value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div style={styles.modalRow}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>City</label>
              <TextInput value={editForm.city} onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Country</label>
              <TextInput value={editForm.country} onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={styles.label}>Status</label>
            <Select value={editForm.status} onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </div>
          {editError ? <div style={styles.errorBanner}>{editError}</div> : null}
          <div style={styles.inlineActions}>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={addAdminOpen} onClose={closeAddAdminModal} title="Add or invite local admin">
        <div style={styles.modalStack}>
          <div>
            <label style={styles.label}>User email *</label>
            <TextInput
              value={addAdminEmail}
              onChange={(e) => setAddAdminEmail(e.target.value)}
              placeholder="name@example.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label style={styles.label}>Display name</label>
            <TextInput
              value={addAdminDisplayName}
              onChange={(e) => setAddAdminDisplayName(e.target.value)}
              placeholder="Optional name for the invite"
            />
          </div>
          <div style={styles.helperText}>
            This assigns an existing account when found, or sends a fresh invite and local-admin assignment for this mosque.
          </div>
          {addAdminError ? <div style={styles.errorBanner}>{addAdminError}</div> : null}
          <div style={styles.inlineActions}>
            <Button
              variant="ghost"
              onClick={closeAddAdminModal}
              disabled={addingAdmin}
            >
              Cancel
            </Button>
            <Button onClick={handleAddLocalAdmin} disabled={addingAdmin}>
              {addingAdmin ? 'Working...' : 'Add or invite'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorBanner: {
    padding: '12px 14px',
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    color: '#b45309',
    border: '1px solid #fdba74',
    fontWeight: 700,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 14px',
    border: '1px solid #dbe4ec',
    borderRadius: 999,
    backgroundColor: '#fff',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
  },
  tabActive: {
    padding: '10px 14px',
    border: '1px solid #0f172a',
    borderRadius: 999,
    backgroundColor: '#0f172a',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  metaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #eef2f7',
    color: '#0f172a',
  },
  idText: {
    wordBreak: 'break-all',
    textAlign: 'right',
    maxWidth: 280,
  },
  inlineActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
    fontWeight: 700,
  },
  chipGreen: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontWeight: 700,
  },
  chipStatus: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    padding: '2px 8px',
    borderRadius: 999,
  },
  chipRemove: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 800,
  },
  assignRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  muted: {
    color: '#64748b',
    fontSize: 13,
  },
  modalStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    color: '#0f172a',
  },
  modalRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#475569',
  },
};
