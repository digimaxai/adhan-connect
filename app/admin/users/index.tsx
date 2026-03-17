'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider, useAdminFeedback } from '../../../lib/admin-web/adminFeedback';
import type { MosqueOption } from '../../../components/admin/web/AdminTopBar';
import AdminShell from '../../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel } from '../../../components/admin/web/AdminPrimitives';
import AdminDataTable from '../../../components/admin/web/AdminDataTable';
import AdminFilterPills from '../../../components/admin/web/AdminFilterPills';

type UserRole = 'user' | 'local_admin' | 'main_admin' | 'muezzin';

type UserRow = {
  id: string;
  email: string | null;
  role: UserRole;
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
const USER_TABLE_COLUMNS = [
  { key: 'email', label: 'Email', width: '18%' },
  { key: 'role', label: 'Role', width: '12%' },
  { key: 'local_admins', label: 'Local Admin Of', width: '23%' },
  { key: 'muezzins', label: 'Muezzin Of', width: '23%' },
  { key: 'created', label: 'Created', width: '12%' },
  { key: 'actions', label: 'Actions', width: '12%' },
];

export default function UsersPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <UsersShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function UsersShell() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { notifyError, notifyInfo, notifySuccess } = useAdminFeedback();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [search, setSearch] = useState(typeof params.search === 'string' ? params.search : '');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [adminAssignments, setAdminAssignments] = useState<Record<string, string[]>>({});
  const [muezzinAssignments, setMuezzinAssignments] = useState<Record<string, string[]>>({});

  const [selectedAdminMosque, setSelectedAdminMosque] = useState<Record<string, string>>({});
  const [selectedMuezzinMosque, setSelectedMuezzinMosque] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof params.search === 'string') {
      setSearch(params.search);
      return;
    }
    setSearch('');
  }, [params.search]);

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
          return;
        }
        if (!cancelled) {
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        let query = supabase
          .from('users')
          .select('id, email, role, created_at', { count: 'exact' })
          .ilike('email', search ? `%${search}%` : '%');

        if (roleFilter !== 'all') {
          query = query.eq('role', roleFilter);
        }

        const usersRes = await query.order('created_at', { ascending: false }).range(from, to);

        if (usersRes.error) {
          console.error('users fetch error', usersRes.error);
          if (!cancelled) {
            setErrorBanner('Some data failed to load. Check console logs.');
            setUsers([]);
            setTotalCount(0);
            setAdminAssignments({});
            setMuezzinAssignments({});
          }
          return;
        }

        const rows = (usersRes.data ?? []) as UserRow[];
        const ids = rows.map((u) => u.id);

        if (!cancelled) {
          setUsers(rows);
          setTotalCount(usersRes.count ?? 0);
        }

        if (!ids.length) {
          if (!cancelled) {
            setAdminAssignments({});
            setMuezzinAssignments({});
          }
          return;
        }

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
  }, [page, roleFilter, search]);

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

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    if (search.trim()) {
      filters.push({ key: 'search', label: 'Search', value: search.trim() });
    }
    if (roleFilter !== 'all') {
      filters.push({ key: 'role', label: 'Role', value: roleFilter.replace('_', ' ') });
    }
    return filters;
  }, [roleFilter, search]);

  const visibleAssignmentCount = useMemo(
    () =>
      users.reduce(
        (count, user) =>
          count + (adminAssignments[user.id] ?? []).length + (muezzinAssignments[user.id] ?? []).length,
        0
      ),
    [adminAssignments, muezzinAssignments, users]
  );

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;
  const rowStart = totalCount ? page * PAGE_SIZE + 1 : 0;
  const rowEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  const handleSearch = (term: string) => {
    const next = term.trim();
    setPage(0);
    setSearch(next);
    router.replace((next ? `/admin/users?search=${encodeURIComponent(next)}` : '/admin/users') as any);
  };

  const clearFilter = (key: string) => {
    if (key === 'search') {
      handleSearch('');
      return;
    }
    if (key === 'role') {
      setRoleFilter('all');
      setPage(0);
    }
  };

  const clearAllFilters = () => {
    setRoleFilter('all');
    setPage(0);
    if (search) {
      handleSearch('');
      return;
    }
    setSearch('');
  };

  const setRole = async (userId: string, role: UserRole) => {
    const prev = users.find((u) => u.id === userId)?.role;
    const hasAssignments =
      (adminAssignments[userId] ?? []).length > 0 || (muezzinAssignments[userId] ?? []).length > 0;
    if (role === 'user' && hasAssignments) {
      notifyError('Remove mosque assignments before demoting this user.');
      return;
    }
    const confirmText =
      role === 'user'
        ? 'Demote this user to basic listener?'
        : `Change role to ${role}?`;
    const confirmed = typeof window !== 'undefined' ? window.confirm(confirmText) : true;
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', userId);
      if (error) {
        console.error('set role error', error);
        notifyError('Role update failed.', 'Check console logs for the Supabase error details.');
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'set_user_role',
          user_id: userId,
          from_role: prev,
          to_role: role,
          timestamp: new Date().toISOString(),
        });
        setUsers((prevList) => prevList.map((u) => (u.id === userId ? { ...u, role } : u)));
        notifySuccess('User role updated.', `The selected account is now set to ${role}.`);
      }
    } catch (e) {
      console.error('set role exception', e);
      notifyError('Role update failed.', 'The request did not complete cleanly.');
    }
  };

  const assignLocalAdmin = async (userId: string, mosqueId: string | undefined) => {
    if (!mosqueId) return;
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole !== 'local_admin' && currentRole !== 'main_admin') {
      notifyError('Set this user to Local Admin before assigning mosque access.');
      return;
    }
    const already = (adminAssignments[userId] ?? []).includes(mosqueId);
    if (already) return;
    try {
      const { error } = await supabase.from('mosque_admins').insert({ user_id: userId, mosque_id: mosqueId });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (error.code === '23505' || msg.includes('duplicate')) {
          notifyInfo('That user already has local-admin access to this mosque.');
        } else {
          console.error('assign local admin error', error);
          notifyError('Local-admin assignment failed.', 'Check console logs for the Supabase error details.');
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
        setSelectedAdminMosque((prev) => ({ ...prev, [userId]: '' }));
        notifySuccess('Local admin assigned.', 'The user now has access to the chosen mosque.');
      }
    } catch (e) {
      console.error('assign local admin exception', e);
      notifyError('Local-admin assignment failed.', 'The request did not complete cleanly.');
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
        notifyError('Removing local-admin access failed.', 'Check console logs for the Supabase error details.');
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
        notifySuccess('Local admin removed.', 'Mosque-scoped admin access has been removed.');
      }
    } catch (e) {
      console.error('remove local admin exception', e);
      notifyError('Removing local-admin access failed.', 'The request did not complete cleanly.');
    }
  };

  const assignMuezzin = async (userId: string, mosqueId: string | undefined) => {
    if (!mosqueId) return;
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole !== 'muezzin') {
      notifyError('Set this user to Muezzin before assigning mosque access.');
      return;
    }
    const already = (muezzinAssignments[userId] ?? []).includes(mosqueId);
    if (already) return;
    try {
      const { error } = await supabase
        .from('muezzins')
        .insert({ user_id: userId, mosque_id: mosqueId, is_active: true });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (error.code === '23505' || msg.includes('duplicate')) {
          notifyInfo('That user already has muezzin access to this mosque.');
        } else {
          console.error('assign muezzin error', error);
          notifyError('Muezzin assignment failed.', 'Check console logs for the Supabase error details.');
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
        setSelectedMuezzinMosque((prev) => ({ ...prev, [userId]: '' }));
        notifySuccess('Muezzin assigned.', 'The user now has muezzin access to the chosen mosque.');
      }
    } catch (e) {
      console.error('assign muezzin exception', e);
      notifyError('Muezzin assignment failed.', 'The request did not complete cleanly.');
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
        notifyError('Removing muezzin access failed.', 'Check console logs for the Supabase error details.');
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
        notifySuccess('Muezzin removed.', 'Mosque-scoped muezzin access has been removed.');
      }
    } catch (e) {
      console.error('remove muezzin exception', e);
      notifyError('Removing muezzin access failed.', 'The request did not complete cleanly.');
    }
  };

  const commandActions = [
    {
      key: 'users-clear-filters',
      label: 'Clear user filters',
      description: 'Reset the current search and role focus.',
      keywords: ['reset', 'filters', 'users'],
      onSelect: clearAllFilters,
    },
    {
      key: 'users-filter-local-admins',
      label: 'Show local admins',
      description: 'Filter the access matrix to local-admin accounts.',
      keywords: ['local admin', 'filter'],
      onSelect: () => {
        setRoleFilter('local_admin');
        setPage(0);
      },
    },
    {
      key: 'users-filter-muezzins',
      label: 'Show muezzins',
      description: 'Filter the access matrix to muezzin-role accounts.',
      keywords: ['muezzin', 'filter'],
      onSelect: () => {
        setRoleFilter('muezzin');
        setPage(0);
      },
    },
  ];

  return (
    <AdminShell
      title="User access and role control"
      eyebrow="Identity & Permissions"
      description="Review role posture, manage mosque assignments, and resolve access mismatches before they create operational drift."
      mosques={mosqueOptions}
      onSearch={handleSearch}
      commandActions={commandActions}
      notices={
        <>
          {errorBanner ? <div style={styles.errorBanner}>{errorBanner}</div> : null}
          {search ? <div style={styles.searchMeta}>Filtering users by &quot;{search}&quot;</div> : null}
        </>
      }
    >
      <div style={styles.metricGrid}>
        <AdminMetricCard label="Visible users" value={users.length} detail="Rows currently loaded in this view" />
        <AdminMetricCard label="Total accounts" value={totalCount} detail="All user records matching the current filter" />
        <AdminMetricCard
          label="Assignments in view"
          value={visibleAssignmentCount}
          detail="Combined local-admin and muezzin mosque assignments in the current result set"
        />
      </div>

      <AdminPanel
        title="Access matrix"
        subtitle="Filter the operator list, validate role posture, then apply mosque-scoped access only where it is explicitly intended."
      >
        <div style={styles.toolbar}>
          <div style={styles.filterControl}>
            <label style={styles.filterLabel}>Role focus</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as 'all' | UserRole);
                setPage(0);
              }}
              style={styles.select}
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              <option value="local_admin">Local Admin</option>
              <option value="main_admin">Main Admin</option>
              <option value="muezzin">Muezzin</option>
            </select>
          </div>
          <div style={styles.toolbarCopy}>
            Search from the command bar above, then use this table to handle assignments and role cleanup with less scanning.
          </div>
        </div>

        <AdminFilterPills items={activeFilters} onClear={clearFilter} onClearAll={clearAllFilters} />

        <AdminDataTable
          columns={USER_TABLE_COLUMNS}
          loading={loading}
          emptyMessage="No users match the current view."
          rowCount={users.length}
          footer={
            <div style={styles.tableFooter}>
              <div style={styles.pageInfo}>
                {rowStart && rowEnd ? `Showing ${rowStart}-${rowEnd} of ${totalCount}` : 'No users to display'}
              </div>
              <div style={styles.footerActions}>
                <button
                  style={styles.pageButton}
                  onClick={() => canPrev && setPage((p) => p - 1)}
                  disabled={!canPrev || loading}
                >
                  Previous
                </button>
                <span style={styles.pageInfo}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  style={styles.pageButton}
                  onClick={() => canNext && setPage((p) => p + 1)}
                  disabled={!canNext || loading}
                >
                  Next
                </button>
              </div>
            </div>
          }
        >
          {users.map((u) => {
            const adminMosques = adminAssignments[u.id] ?? [];
            const muezzinMosques = muezzinAssignments[u.id] ?? [];
            const availableAdminMosques = mosques.filter((m) => !adminMosques.includes(m.id));
            const availableMuezzinMosques = mosques.filter((m) => !muezzinMosques.includes(m.id));

            return (
              <tr key={u.id}>
                <td style={styles.td}>
                  <div style={styles.emailCell}>
                    <div style={styles.primaryText}>{u.email ?? '-'}</div>
                    <div style={styles.secondaryText}>User ID: {u.id.slice(0, 8)}</div>
                  </div>
                </td>
                <td style={styles.td}>{renderRoleBadge(u.role)}</td>
                <td style={styles.td}>
                  <div style={styles.assignmentStack}>
                    <div style={styles.pillRow}>
                      {adminMosques.length ? (
                        adminMosques.map((mid) => (
                          <span key={mid} style={styles.pill}>
                            {mosqueNameMap[mid] ?? mid}
                            <button
                              type="button"
                              style={styles.pillRemove}
                              onClick={() => removeLocalAdmin(u.id, mid)}
                              aria-label="Remove local admin assignment"
                              disabled={loading}
                            >
                              x
                            </button>
                          </span>
                        ))
                      ) : (
                        <span style={styles.emptyText}>No local-admin assignments</span>
                      )}
                    </div>
                    <div style={styles.assignRow}>
                      <select
                        value={selectedAdminMosque[u.id] ?? ''}
                        onChange={(e) =>
                          setSelectedAdminMosque((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        style={styles.select}
                      >
                        <option value="">Select mosque</option>
                        {availableAdminMosques.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <button
                        style={styles.assignButton}
                        onClick={() => assignLocalAdmin(u.id, selectedAdminMosque[u.id])}
                        disabled={
                          !selectedAdminMosque[u.id] ||
                          loading ||
                          (u.role !== 'local_admin' && u.role !== 'main_admin')
                        }
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={styles.assignmentStack}>
                    <div style={styles.pillRow}>
                      {muezzinMosques.length ? (
                        muezzinMosques.map((mid) => (
                          <span key={mid} style={styles.pillGreen}>
                            {mosqueNameMap[mid] ?? mid}
                            <button
                              type="button"
                              style={styles.pillRemove}
                              onClick={() => removeMuezzin(u.id, mid)}
                              aria-label="Remove muezzin assignment"
                              disabled={loading}
                            >
                              x
                            </button>
                          </span>
                        ))
                      ) : (
                        <span style={styles.emptyText}>No muezzin assignments</span>
                      )}
                    </div>
                    <div style={styles.assignRow}>
                      <select
                        value={selectedMuezzinMosque[u.id] ?? ''}
                        onChange={(e) =>
                          setSelectedMuezzinMosque((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        style={styles.select}
                      >
                        <option value="">Select mosque</option>
                        {availableMuezzinMosques.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <button
                        style={styles.assignButton}
                        onClick={() => assignMuezzin(u.id, selectedMuezzinMosque[u.id])}
                        disabled={!selectedMuezzinMosque[u.id] || loading || u.role !== 'muezzin'}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  {u.created_at ? new Date(u.created_at).toLocaleString() : '-'}
                </td>
                <td style={styles.td}>
                  <div style={styles.actionRow}>
                    <button
                      style={styles.actionButton}
                      onClick={() => setRole(u.id, 'local_admin')}
                      disabled={u.role === 'local_admin' || loading}
                    >
                      Make local admin
                    </button>
                    <button
                      style={styles.actionButton}
                      onClick={() => setRole(u.id, 'muezzin')}
                      disabled={u.role === 'muezzin' || loading}
                    >
                      Make muezzin
                    </button>
                    <button
                      style={styles.actionButtonSecondary}
                      onClick={() => setRole(u.id, 'user')}
                      disabled={u.role === 'user' || loading}
                    >
                      Demote
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminPanel>
    </AdminShell>
  );
}

function renderRoleBadge(role: UserRole) {
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
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
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
  searchMeta: {
    marginBottom: 12,
    fontSize: 13,
    color: '#475569',
    fontWeight: 600,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-end',
  },
  filterControl: {
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#475569',
  },
  toolbarCopy: {
    flex: 1,
    minWidth: 260,
    fontSize: 13,
    lineHeight: 1.5,
    color: '#475569',
    fontWeight: 600,
  },
  td: {
    padding: '16px',
    fontSize: 14,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  emailCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  primaryText: {
    fontWeight: 800,
    color: '#0f172a',
  },
  secondaryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600,
  },
  assignmentStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
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
    color: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 700,
  },
  assignRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  select: {
    minWidth: 170,
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
    minWidth: 180,
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
  tableFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
