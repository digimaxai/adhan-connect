'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../components/RequireMainAdmin';
import { AdminContextProvider } from '../lib/adminContext';
import AdminTopBar, { MosqueOption } from '../components/AdminTopBar';
import AdminSidebar from '../components/AdminSidebar';

type UserRow = {
  id: string;
  email: string | null;
  role: 'user' | 'local_admin' | 'main_admin' | 'muezzin';
  created_at: string | null;
};

type Assignment = {
  mosque_id: string;
  user_id: string;
};

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
};

const PAGE_SIZE = 20;

export default function UsersPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <UsersShell />
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function UsersShell() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [adminAssignments, setAdminAssignments] = useState<Record<string, string[]>>({});
  const [muezzinAssignments, setMuezzinAssignments] = useState<Record<string, string[]>>({});

  const [selectedAdminMosque, setSelectedAdminMosque] = useState<Record<string, string>>({});
  const [selectedMuezzinMosque, setSelectedMuezzinMosque] = useState<Record<string, string>>({});

  // Fetch mosques once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mosquesRes = await supabase
          .from('mosques')
          .select('id, name, city, country, status')
          .order('name', { ascending: true })
          .limit(500);
        if (mosquesRes.error) {
          console.error('mosques fetch error', mosquesRes.error);
          if (!cancelled) setErrorBanner('Some data failed to load. Check console logs.');
        } else if (!cancelled) {
          setMosques(mosquesRes.data ?? []);
        }
      } catch (e) {
        console.error('mosques load error', e);
        if (!cancelled) setErrorBanner('Some data failed to load. Check console logs.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch users + assignments on page change
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const usersRes = await supabase
          .from('users')
          .select('id, email, role, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (usersRes.error) {
          console.error('users fetch error', usersRes.error);
          if (!cancelled) setErrorBanner('Some data failed to load. Check console logs.');
          if (!cancelled) {
            setUsers([]);
            setTotalCount(0);
          }
          return;
        }

        const rows = (usersRes.data ?? []) as UserRow[];
        const ids = rows.map((u) => u.id);

        if (!cancelled) {
          setUsers(rows);
          setTotalCount(usersRes.count ?? 0);
        }

        if (!ids.length) return;

        const adminRes = await supabase.from('mosque_admins').select('user_id, mosque_id').in('user_id', ids);
        if (adminRes.error) {
          console.error('mosque_admins fetch error', adminRes.error);
          if (!cancelled) setErrorBanner('Some data failed to load. Check console logs.');
        } else if (!cancelled) {
          const map: Record<string, string[]> = {};
          (adminRes.data ?? []).forEach((row: Assignment) => {
            map[row.user_id] = map[row.user_id] || [];
            map[row.user_id].push(row.mosque_id);
          });
          setAdminAssignments(map);
        }

        const muezzinRes = await supabase.from('muezzins').select('user_id, mosque_id').in('user_id', ids);
        if (muezzinRes.error) {
          console.error('muezzin fetch error', muezzinRes.error);
          if (!cancelled) setErrorBanner('Some data failed to load. Check console logs.');
        } else if (!cancelled) {
          const map: Record<string, string[]> = {};
          (muezzinRes.data ?? []).forEach((row: Assignment) => {
            map[row.user_id] = map[row.user_id] || [];
            map[row.user_id].push(row.mosque_id);
          });
          setMuezzinAssignments(map);
        }
      } catch (e) {
        console.error('users page load error', e);
        if (!cancelled) setErrorBanner('Some data failed to load. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const mosqueOptions = useMemo<MosqueOption[]>(
    () =>
      mosques.map((m) => ({
        id: m.id,
        name: m.name ?? 'Mosque',
        city: m.city ?? null,
        country: m.country ?? null,
        status: m.status ?? null,
      })),
    [mosques]
  );

  const mosqueNameMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    mosques.forEach((m) => {
      map[m.id] = m.name ?? 'Mosque';
    });
    return map;
  }, [mosques]);

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));

  const setRole = async (userId: string, role: UserRow['role']) => {
    const prev = users.find((u) => u.id === userId)?.role;
    const confirmText =
      role === 'user'
        ? 'Demote this user to basic listener? Existing mosque assignments will NOT be removed.'
        : `Change role to ${role}?`;
    const confirmed = typeof window !== 'undefined' ? window.confirm(confirmText) : true;
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', userId);
      if (error) {
        console.error('set role error', error);
        setErrorBanner('Action failed. Check console logs.');
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'set_user_role',
          user_id: userId,
          from_role: prev,
          to_role: role,
          timestamp: new Date().toISOString(),
        });
        setUsers((prevList) => prevList.map((u) => (u.id === userId ? { ...u, role } : u)));
      }
    } catch (e) {
      console.error('set role exception', e);
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const assignLocalAdmin = async (userId: string, mosqueId: string | undefined) => {
    if (!mosqueId) return;
    const already = (adminAssignments[userId] ?? []).includes(mosqueId);
    if (already) return;
    try {
      const { error } = await supabase.from('mosque_admins').insert({ user_id: userId, mosque_id: mosqueId });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (error.code === '23505' || msg.includes('duplicate')) {
          setErrorBanner('Already assigned.');
        } else {
          console.error('assign local admin error', error);
          setErrorBanner('Action failed. Check console logs.');
        }
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'assign_local_admin',
          user_id: userId,
          mosque_id: mosqueId,
          timestamp: new Date().toISOString(),
        });
        setAdminAssignments((prev) => {
          const next = { ...prev };
          next[userId] = [...(next[userId] ?? []), mosqueId];
          return next;
        });
      }
    } catch (e) {
      console.error('assign local admin exception', e);
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const removeLocalAdmin = async (userId: string, mosqueId: string) => {
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Remove this local admin assignment?') : true;
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('mosque_admins')
        .delete()
        .eq('user_id', userId)
        .eq('mosque_id', mosqueId);
      if (error) {
        console.error('remove local admin error', error);
        setErrorBanner('Action failed. Check console logs.');
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'remove_local_admin',
          user_id: userId,
          mosque_id: mosqueId,
          timestamp: new Date().toISOString(),
        });
        setAdminAssignments((prev) => {
          const next = { ...prev };
          next[userId] = (next[userId] ?? []).filter((m) => m !== mosqueId);
          return next;
        });
      }
    } catch (e) {
      console.error('remove local admin exception', e);
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const assignMuezzin = async (userId: string, mosqueId: string | undefined) => {
    if (!mosqueId) return;
    const already = (muezzinAssignments[userId] ?? []).includes(mosqueId);
    if (already) return;
    try {
      const { error } = await supabase
        .from('muezzins')
        .insert({ user_id: userId, mosque_id: mosqueId, is_active: true });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (error.code === '23505' || msg.includes('duplicate')) {
          setErrorBanner('Already assigned.');
        } else {
          console.error('assign muezzin error', error);
          setErrorBanner('Action failed. Check console logs.');
        }
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'assign_muezzin',
          user_id: userId,
          mosque_id: mosqueId,
          timestamp: new Date().toISOString(),
        });
        setMuezzinAssignments((prev) => {
          const next = { ...prev };
          next[userId] = [...(next[userId] ?? []), mosqueId];
          return next;
        });
      }
    } catch (e) {
      console.error('assign muezzin exception', e);
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const removeMuezzin = async (userId: string, mosqueId: string) => {
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Remove this muezzin assignment?') : true;
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('muezzins')
        .delete()
        .eq('user_id', userId)
        .eq('mosque_id', mosqueId);
      if (error) {
        console.error('remove muezzin error', error);
        setErrorBanner('Action failed. Check console logs.');
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'remove_muezzin',
          user_id: userId,
          mosque_id: mosqueId,
          timestamp: new Date().toISOString(),
        });
        setMuezzinAssignments((prev) => {
          const next = { ...prev };
          next[userId] = (next[userId] ?? []).filter((m) => m !== mosqueId);
          return next;
        });
      }
    } catch (e) {
      console.error('remove muezzin exception', e);
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div style={styles.layout}>
      <AdminSidebar />
      <main style={styles.main}>
        <AdminTopBar mosques={mosqueOptions} />
        <div style={styles.content}>
          {errorBanner ? <div style={styles.errorBanner}>{errorBanner}</div> : null}

          <h1 style={styles.pageTitle}>Users</h1>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Local Admin Of</th>
                  <th style={styles.th}>Muezzin Of</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const adminMosques = adminAssignments[u.id] ?? [];
                  const muezzinMosques = muezzinAssignments[u.id] ?? [];
                  return (
                    <tr key={u.id}>
                      <td style={styles.td}>{u.email ?? '—'}</td>
                      <td style={styles.td}>{renderRoleBadge(u.role)}</td>
                      <td style={styles.td}>
                        <div style={styles.pillRow}>
                          {adminMosques.map((mid) => (
                            <span key={mid} style={styles.pill}>
                              {mosqueNameMap[mid] ?? mid}
                              <button
                                style={styles.pillRemove}
                                onClick={() => removeLocalAdmin(u.id, mid)}
                                aria-label="Remove local admin assignment"
                                disabled={loading}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <div style={styles.assignRow}>
                            <select
                              value={selectedAdminMosque[u.id] ?? ''}
                              onChange={(e) =>
                                setSelectedAdminMosque((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              style={styles.select}
                            >
                              <option value="">Select mosque</option>
                              {mosques.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <button
                              style={styles.assignButton}
                              onClick={() => assignLocalAdmin(u.id, selectedAdminMosque[u.id])}
                              disabled={!selectedAdminMosque[u.id] || loading}
                            >
                              Assign
                            </button>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.pillRow}>
                          {muezzinMosques.map((mid) => (
                            <span key={mid} style={styles.pillGreen}>
                              {mosqueNameMap[mid] ?? mid}
                              <button
                                style={styles.pillRemove}
                                onClick={() => removeMuezzin(u.id, mid)}
                                aria-label="Remove muezzin assignment"
                                disabled={loading}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <div style={styles.assignRow}>
                            <select
                              value={selectedMuezzinMosque[u.id] ?? ''}
                              onChange={(e) =>
                                setSelectedMuezzinMosque((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              style={styles.select}
                            >
                              <option value="">Select mosque</option>
                              {mosques.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <button
                              style={styles.assignButton}
                              onClick={() => assignMuezzin(u.id, selectedMuezzinMosque[u.id])}
                              disabled={!selectedMuezzinMosque[u.id] || loading}
                            >
                              Assign
                            </button>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          <button
                            style={styles.actionButton}
                            onClick={() => setRole(u.id, 'local_admin')}
                            disabled={u.role === 'local_admin' || loading}
                          >
                            Promote to Local Admin
                          </button>
                          <button
                            style={styles.actionButton}
                            onClick={() => setRole(u.id, 'muezzin')}
                            disabled={u.role === 'muezzin' || loading}
                          >
                            Promote to Muezzin
                          </button>
                          <button
                            style={styles.actionButtonSecondary}
                            onClick={() => setRole(u.id, 'user')}
                            disabled={u.role === 'user' || loading}
                          >
                            Demote to User
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!users.length && (
                  <tr>
                    <td style={styles.td} colSpan={6}>
                      {loading ? 'Loading…' : 'No users found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            <button style={styles.pageButton} onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev || loading}>
              Previous
            </button>
            <span style={styles.pageInfo}>
              Page {page + 1} of {totalPages}
            </span>
            <button style={styles.pageButton} onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext || loading}>
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function renderRoleBadge(role: UserRow['role']) {
  const style: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  };

  if (role === 'main_admin') {
    return <span style={{ ...style, backgroundColor: '#0f172a', color: '#e2e8f0' }}>main_admin</span>;
  }
  if (role === 'local_admin') {
    return <span style={{ ...style, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>local_admin</span>;
  }
  if (role === 'muezzin') {
    return <span style={{ ...style, backgroundColor: '#dcfce7', color: '#166534' }}>muezzin</span>;
  }
  return <span style={{ ...style, backgroundColor: '#e2e8f0', color: '#0f172a' }}>user</span>;
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
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 12,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    color: '#475569',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '10px 12px',
    fontSize: 14,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: 12,
  },
  pillGreen: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontWeight: 700,
    fontSize: 12,
  },
  pillRemove: {
    border: 'none',
    background: 'transparent',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
  },
  assignRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  select: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#fff',
    fontSize: 13,
  },
  assignButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #0f172a',
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  },
  actionRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #0f172a',
    backgroundColor: '#0f172a',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  actionButtonSecondary: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#fff',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pagination: {
    marginTop: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  pageButton: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  pageInfo: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 700,
  },
};

