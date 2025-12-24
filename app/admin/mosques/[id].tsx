'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../components/RequireMainAdmin';
import { AdminContextProvider, useAdminContext } from '../lib/adminContext';
import AdminTopBar, { MosqueOption } from '../components/AdminTopBar';
import AdminSidebar from '../components/AdminSidebar';
import { Button, Card, Modal, Pill, Select, TextInput } from '../components/ui';

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
  created_at?: string | null;
};

type MosqueAdmin = { user_id: string; mosque_id: string };
type MuezzinRow = { user_id: string; mosque_id: string; is_active?: boolean | null };

export default function MosqueProfilePage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <MosqueProfileShell />
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

  const mosqueId = routeId || selectedMosqueId || '';

  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [tab, setTab] = useState<'overview' | 'admins' | 'muezzins' | 'campaigns'>('overview');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [admins, setAdmins] = useState<MosqueAdmin[]>([]);
  const [muezzins, setMuezzins] = useState<MuezzinRow[]>([]);
  const [peopleById, setPeopleById] = useState<Record<string, AssignmentUser>>({});
  const [userOptions, setUserOptions] = useState<AssignmentUser[]>([]);
  const [assignUserIdAdmin, setAssignUserIdAdmin] = useState('');
  const [assignUserIdMuezzin, setAssignUserIdMuezzin] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    country: '',
    status: 'pending',
  });
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
      if (mosquesSelectorRes.error) {
        console.error('mosques selector error', mosquesSelectorRes.error);
      } else if (!cancelled) {
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
      try {
        const usersRes = await supabase
          .from('users')
          .select('id, email, role, created_at')
          .order('created_at', { ascending: false })
          .limit(500);
        if (usersRes.error) {
          console.error('users load error', usersRes.error);
          if (!cancelled) {
            setErrorBanner((prev) => prev ?? 'Some data failed to load. Check console logs.');
          }
        } else if (!cancelled) {
          setUserOptions(usersRes.data ?? []);
          upsertPeople(usersRes.data ?? []);
        }
      } catch (e) {
        console.error('users load exception', e);
        if (!cancelled) {
          setErrorBanner((prev) => prev ?? 'Some data failed to load. Check console logs.');
        }
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
          supabase
            .from('mosques')
            .select('id, name, city, country, status, created_at')
            .eq('id', mosqueId)
            .maybeSingle(),
          supabase.from('mosque_admins').select('user_id, mosque_id').eq('mosque_id', mosqueId),
          supabase.from('muezzins').select('user_id, mosque_id, is_active').eq('mosque_id', mosqueId),
        ]);

        if (mosqRes.error) {
          console.error('mosque load error', mosqRes.error);
          if (!cancelled) setErrorBanner('Unable to load mosque. Check console logs.');
        } else if (!cancelled) {
          setMosque(mosqRes.data ?? null);
        }

        if (adminsRes.error) {
          console.error('admins load error', adminsRes.error);
          if (!cancelled) setErrorBanner((prev) => prev ?? 'Assignments failed to load. Check console logs.');
        } else if (!cancelled) {
          setAdmins(adminsRes.data ?? []);
        }

        if (muezzinRes.error) {
          console.error('muezzins load error', muezzinRes.error);
          if (!cancelled) setErrorBanner((prev) => prev ?? 'Assignments failed to load. Check console logs.');
        } else if (!cancelled) {
          setMuezzins(muezzinRes.data ?? []);
        }

        const ids = new Set<string>();
        (adminsRes.data ?? []).forEach((a: MosqueAdmin) => ids.add(a.user_id));
        (muezzinRes.data ?? []).forEach((m: MuezzinRow) => ids.add(m.user_id));
        if (ids.size) {
          const peopleRes = await supabase
            .from('users')
            .select('id, email, role, created_at')
            .in('id', Array.from(ids));
          if (peopleRes.error) {
            console.error('assignment users load error', peopleRes.error);
            if (!cancelled) {
              setErrorBanner((prev) => prev ?? 'Some data failed to load. Check console logs.');
            }
          } else if (!cancelled) {
            upsertPeople(peopleRes.data ?? []);
          }
        }
      } catch (e) {
        console.error('[ADMIN_MOSQUE_LOAD_ERROR]', e);
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

  const locationLabel = [mosque?.city, mosque?.country].filter(Boolean).join(', ');
  const status = mosque?.status ?? null;
  const mosqueName = mosque?.name ?? 'Mosque';

  const handleApprove = async () => {
    if (!mosqueId) return;
    setSuccessBanner(null);
    try {
      const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', mosqueId);
      if (error) {
        console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
          action: 'approve',
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          mosque_id: mosqueId,
          timestamp: new Date().toISOString(),
        });
        setErrorBanner(
          error.code
            ? `Action failed (code: ${error.code}). Check console logs.`
            : 'Action failed. Check console logs.'
        );
      } else {
        setMosque((prev) => (prev ? { ...prev, status: 'active' } : prev));
        setSuccessBanner('Mosque approved.');
      }
    } catch (e) {
      console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
        action: 'approve',
        message: (e as any)?.message,
        code: (e as any)?.code,
        details: (e as any)?.details,
        hint: (e as any)?.hint,
        mosque_id: mosqueId,
        timestamp: new Date().toISOString(),
      });
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const handleSuspend = async () => {
    if (!mosqueId) return;
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Deactivate this mosque?') : true;
    if (!confirmed) return;
    setSuccessBanner(null);
    try {
      const { error } = await supabase.from('mosques').update({ status: 'inactive' }).eq('id', mosqueId);
      if (error) {
        console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
          action: 'suspend',
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          mosque_id: mosqueId,
          timestamp: new Date().toISOString(),
        });
        setErrorBanner(
          error.code
            ? `Action failed (code: ${error.code}). Check console logs.`
            : 'Action failed. Check console logs.'
        );
      } else {
        setMosque((prev) => (prev ? { ...prev, status: 'inactive' } : prev));
        setSuccessBanner('Mosque deactivated.');
      }
    } catch (e) {
      console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
        action: 'suspend',
        message: (e as any)?.message,
        code: (e as any)?.code,
        details: (e as any)?.details,
        hint: (e as any)?.hint,
        mosque_id: mosqueId,
        timestamp: new Date().toISOString(),
      });
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const handleAssignAdmin = async () => {
    if (!mosqueId || !assignUserIdAdmin) return;
    if (adminAssignedIds.has(assignUserIdAdmin)) {
      setAssignUserIdAdmin('');
      return;
    }
    setSuccessBanner(null);
    try {
      const payload = { mosque_id: mosqueId, user_id: assignUserIdAdmin };
      const { error } = await supabase.from('mosque_admins').insert(payload);
      if (error) {
        const duplicate =
          error.code === '23505' || (error.message || '').toLowerCase().includes('duplicate');
        if (duplicate) {
          setErrorBanner('Already assigned as local admin.');
        } else {
          console.error('assign admin error', error);
          setErrorBanner('Assign failed. Check console logs.');
        }
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'assign_local_admin',
          mosque_id: mosqueId,
          user_id: assignUserIdAdmin,
          timestamp: new Date().toISOString(),
        });
        setAdmins((prev) => [...prev, { mosque_id: mosqueId, user_id: assignUserIdAdmin }]);
        setAssignUserIdAdmin('');
        setSuccessBanner('Local admin assigned.');
      }
    } catch (e) {
      console.error('assign admin exception', e);
      setErrorBanner('Assign failed. Check console logs.');
    }
  };

  const handleAssignMuezzin = async () => {
    if (!mosqueId || !assignUserIdMuezzin) return;
    if (muezzinAssignedIds.has(assignUserIdMuezzin)) {
      setAssignUserIdMuezzin('');
      return;
    }
    setSuccessBanner(null);
    try {
      const payload = { mosque_id: mosqueId, user_id: assignUserIdMuezzin, is_active: true };
      const { error } = await supabase.from('muezzins').insert(payload);
      if (error) {
        const duplicate =
          error.code === '23505' || (error.message || '').toLowerCase().includes('duplicate');
        if (duplicate) {
          setErrorBanner('Already assigned as muezzin.');
        } else {
          console.error('assign muezzin error', error);
          setErrorBanner('Assign failed. Check console logs.');
        }
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'assign_muezzin',
          mosque_id: mosqueId,
          user_id: assignUserIdMuezzin,
          timestamp: new Date().toISOString(),
        });
        setMuezzins((prev) => [
          ...prev,
          { mosque_id: mosqueId, user_id: assignUserIdMuezzin, is_active: true },
        ]);
        setAssignUserIdMuezzin('');
        setSuccessBanner('Muezzin assigned.');
      }
    } catch (e) {
      console.error('assign muezzin exception', e);
      setErrorBanner('Assign failed. Check console logs.');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!mosqueId) return;
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Remove this local admin?') : true;
    if (!confirmed) return;
    setSuccessBanner(null);
    const { error } = await supabase
      .from('mosque_admins')
      .delete()
      .eq('mosque_id', mosqueId)
      .eq('user_id', userId);
    if (error) {
      console.error('remove admin error', error);
      setErrorBanner('Remove failed. Check console logs.');
    } else {
      console.log('[ADMIN_ACTION]', {
        action: 'remove_local_admin',
        mosque_id: mosqueId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
      setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
      setSuccessBanner('Local admin removed.');
    }
  };

  const handleRemoveMuezzin = async (userId: string) => {
    if (!mosqueId) return;
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Remove this muezzin?') : true;
    if (!confirmed) return;
    setSuccessBanner(null);
    const { error } = await supabase
      .from('muezzins')
      .delete()
      .eq('mosque_id', mosqueId)
      .eq('user_id', userId);
    if (error) {
      console.error('remove muezzin error', error);
      setErrorBanner('Remove failed. Check console logs.');
    } else {
      console.log('[ADMIN_ACTION]', {
        action: 'remove_muezzin',
        mosque_id: mosqueId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
      setMuezzins((prev) => prev.filter((m) => m.user_id !== userId));
      setSuccessBanner('Muezzin removed.');
    }
  };

  const handleOpenEdit = () => {
    if (!mosque) return;
    setEditError(null);
    setEditForm({
      name: mosque.name ?? '',
      city: mosque.city ?? '',
      country: mosque.country ?? '',
      status: mosque.status ?? 'pending',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!mosqueId) return;
    const nextName = editForm.name.trim();
    if (!nextName) {
      setEditError('Name is required.');
      return;
    }
    const statusChanged = (mosque?.status ?? 'pending') !== editForm.status;
    if (statusChanged && typeof window !== 'undefined') {
      if (mosque?.status === 'pending' && editForm.status === 'active') {
        const confirmed = window.confirm('Approve this mosque?');
        if (!confirmed) return;
      }
      if (mosque?.status === 'active' && editForm.status === 'inactive') {
        const confirmed = window.confirm('Deactivate this mosque?');
        if (!confirmed) return;
      }
    }

    const payload: Record<string, any> = {
      name: nextName,
      status: editForm.status,
    };
    payload.city = editForm.city.trim() ? editForm.city.trim() : null;
    payload.country = editForm.country.trim() ? editForm.country.trim() : null;

    try {
      setSavingEdit(true);
      const { error } = await supabase.from('mosques').update(payload).eq('id', mosqueId);
      if (error) {
        console.error('[ADMIN_UPDATE_MOSQUE_ERROR]', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          payload,
          timestamp: new Date().toISOString(),
        });
        setEditError(
          error.code
            ? `Save failed (code: ${error.code}). Check console logs.`
            : 'Save failed. Check console logs.'
        );
      } else {
        setMosque((prev) => (prev ? { ...prev, ...payload } : prev));
        setEditOpen(false);
        setSuccessBanner('Saved changes.');
        setErrorBanner(null);
      }
    } catch (e: any) {
      console.error('[ADMIN_UPDATE_MOSQUE_ERROR]', {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        payload,
        timestamp: new Date().toISOString(),
      });
      setEditError('Save failed. Check console logs.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyId = async () => {
    if (!mosque?.id) return;
    try {
      await navigator.clipboard?.writeText(mosque.id);
      setSuccessBanner('Mosque ID copied.');
    } catch {
      setErrorBanner('Unable to copy ID in this browser.');
    }
  };

  if (!mosqueId) {
    return (
      <div style={styles.layout}>
        <AdminSidebar />
        <main style={styles.main}>
          <AdminTopBar mosques={[]} />
          <div style={styles.content}>
            <div style={styles.errorBanner}>Missing mosque id.</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <AdminSidebar />
      <main style={styles.main}>
        <AdminTopBar mosques={mosqueOptions} />
        <div style={styles.content}>
          {errorBanner ? <div style={styles.errorBanner}>{errorBanner}</div> : null}
          {successBanner ? <div style={styles.successBanner}>{successBanner}</div> : null}

          <div style={styles.headerRow}>
            <div style={styles.headerLeft}>
              <Button variant="ghost" onClick={() => router.push('/admin/mosques')}>
                {'<'} Back to Mosques
              </Button>
              <div>
                <h1 style={styles.pageTitle}>{mosqueName}</h1>
                <div style={styles.headerMeta}>
                  <Pill status={status} />
                  {locationLabel ? <span style={styles.metaText}>{locationLabel}</span> : null}
                </div>
              </div>
            </div>
            <div style={styles.headerActions}>
              <Button variant="primary" onClick={handleOpenEdit} disabled={!mosque}>
                Edit Mosque
              </Button>
              <Button
                variant="secondary"
                onClick={handleApprove}
                disabled={status === 'active' || loading}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={handleSuspend}
                disabled={status === 'inactive' || loading}
              >
                Deactivate
              </Button>
            </div>
          </div>

          <div style={styles.tabs}>
            <button
              style={tab === 'overview' ? styles.tabActive : styles.tab}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              style={tab === 'admins' ? styles.tabActive : styles.tab}
              onClick={() => setTab('admins')}
            >
              Admins
            </button>
            <button
              style={tab === 'muezzins' ? styles.tabActive : styles.tab}
              onClick={() => setTab('muezzins')}
            >
              Muezzins
            </button>
            <button
              style={tab === 'campaigns' ? styles.tabActive : styles.tab}
              onClick={() => setTab('campaigns')}
            >
              Campaigns
            </button>
          </div>

          {tab === 'overview' ? (
            <div style={styles.cardGrid}>
              <Card style={styles.card}>
                <div style={styles.cardTitle}>Status</div>
                <div style={styles.cardValue}>
                  <Pill status={status} />
                </div>
              </Card>
              <Card style={styles.card}>
                <div style={styles.cardTitle}>Created</div>
                <div style={styles.cardValue}>
                  {mosque?.created_at ? new Date(mosque.created_at).toLocaleString() : '--'}
                </div>
              </Card>
              <Card style={styles.card}>
                <div style={styles.cardTitle}>Mosque ID</div>
                <div style={styles.cardValue}>
                  <span style={{ wordBreak: 'break-all' }}>{mosque?.id ?? '--'}</span>
                  {mosque?.id ? (
                    <Button variant="ghost" style={{ padding: '6px 10px' }} onClick={handleCopyId}>
                      Copy
                    </Button>
                  ) : null}
                </div>
              </Card>
              <Card style={styles.card}>
                <div style={styles.cardTitle}>Location</div>
                <div style={styles.cardValue}>{locationLabel || '--'}</div>
              </Card>
            </div>
          ) : null}

          {tab === 'admins' ? (
            <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={styles.sectionHeader}>
                <div>
                  <div style={styles.sectionTitle}>Local Admins</div>
                  <div style={styles.sectionSubtitle}>Manage local admin assignments</div>
                </div>
              </div>
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
                <Select
                  value={assignUserIdAdmin}
                  onChange={(e) => setAssignUserIdAdmin(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  <option value="">Select user</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id} disabled={adminAssignedIds.has(u.id)}>
                      {u.email ?? u.id} {adminAssignedIds.has(u.id) ? '(assigned)' : ''}
                    </option>
                  ))}
                </Select>
                <Button onClick={handleAssignAdmin} disabled={!assignUserIdAdmin || loading}>
                  Assign
                </Button>
              </div>
            </Card>
          ) : null}

          {tab === 'muezzins' ? (
            <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={styles.sectionHeader}>
                <div>
                  <div style={styles.sectionTitle}>Muezzins</div>
                  <div style={styles.sectionSubtitle}>Assign and manage muezzins</div>
                </div>
              </div>
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
                <Select
                  value={assignUserIdMuezzin}
                  onChange={(e) => setAssignUserIdMuezzin(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  <option value="">Select user</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id} disabled={muezzinAssignedIds.has(u.id)}>
                      {u.email ?? u.id} {muezzinAssignedIds.has(u.id) ? '(assigned)' : ''}
                    </option>
                  ))}
                </Select>
                <Button onClick={handleAssignMuezzin} disabled={!assignUserIdMuezzin || loading}>
                  Assign
                </Button>
              </div>
            </Card>
          ) : null}

          {tab === 'campaigns' ? (
            <Card style={{ padding: 20, textAlign: 'center' }}>
              <div style={styles.sectionTitle}>Campaigns</div>
              <div style={styles.sectionSubtitle}>No campaigns linked yet.</div>
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" disabled style={{ cursor: 'not-allowed' }}>
                  Create campaign
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </main>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Mosque">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={styles.label}>Name *</label>
            <TextInput
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div style={styles.modalRow}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>City</label>
              <TextInput
                value={editForm.city}
                onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Country</label>
              <TextInput
                value={editForm.country}
                onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label style={styles.label}>Status</label>
            <Select
              value={editForm.status}
              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </div>
          {editError ? <div style={styles.errorBanner}>{editError}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </Modal>
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
  errorBanner: {
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#fff4e5',
    color: '#b45309',
    border: '1px solid #fb923c',
    fontWeight: 700,
    marginBottom: 12,
  },
  successBanner: {
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#ecfdf3',
    color: '#166534',
    border: '1px solid #bbf7d0',
    fontWeight: 700,
    marginBottom: 12,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#475569',
    fontSize: 13,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#0f172a',
  },
  tabActive: {
    padding: '10px 12px',
    border: '1px solid #0f172a',
    borderRadius: 10,
    background: '#0f172a',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#fff',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  card: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    color: '#475569',
    fontWeight: 700,
  },
  cardValue: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: 700,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#475569',
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
    color: '#475569',
    fontSize: 13,
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
};
