'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider, useAdminFeedback } from '../../../lib/admin-web/adminFeedback';
import { evaluateLocalAdminPolicy, mapMosquePolicyRow } from '../../../lib/admin/localAdminPolicy';
import type { MosqueOption } from '../../../components/admin/web/AdminTopBar';
import AdminShell from '../../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel } from '../../../components/admin/web/AdminPrimitives';
import AdminDataTable from '../../../components/admin/web/AdminDataTable';
import AdminFilterPills from '../../../components/admin/web/AdminFilterPills';
import { assignLocalAdminMembership, removeLocalAdminMembership } from '../../../lib/api/admin/localAdminAssignments';
import { assignMuezzinMembership, removeMuezzinMembership } from '../../../lib/api/admin/muezzinAssignments';
import { resolveApiUrl, supportsServerApi } from '../../../lib/api/apiBaseUrl';

type UserRole = 'user' | 'local_admin' | 'main_admin' | 'muezzin';
type GlobalRoleFilter = 'all' | 'user' | 'main_admin';

type UserRow = {
  id: string;
  email: string | null;
  role: UserRole;
  created_at: string | null;
};

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
};

type UserAccessPayload = {
  users: UserRow[];
  totalCount: number;
  mosques: MosqueRow[];
  adminAssignments: Record<string, string[]>;
  muezzinAssignments: Record<string, string[]>;
};

type DisplayGlobalRole = 'user' | 'main_admin';

const PAGE_SIZE = 20;
const USER_TABLE_COLUMNS = [
  { key: 'email', label: 'Email', width: '18%' },
  { key: 'role', label: 'Global Role', width: '12%' },
  { key: 'local_admins', label: 'Local Admin Of', width: '23%' },
  { key: 'muezzins', label: 'Muezzin Of', width: '23%' },
  { key: 'created', label: 'Created', width: '12%' },
  { key: 'actions', label: 'Actions', width: '12%' },
];

function normalizeDisplayedGlobalRole(role: UserRole): DisplayGlobalRole {
  return role === 'main_admin' ? 'main_admin' : 'user';
}

function isLegacyScopedGlobalRole(role: UserRole) {
  return role === 'local_admin' || role === 'muezzin';
}

function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseRoleParam(value: string | string[] | undefined): GlobalRoleFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'user' || raw === 'main_admin' ? raw : 'all';
}

function parseSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : '';
}

function buildUsersRoute(search: string, page: number, roleFilter: GlobalRoleFilter) {
  const params = new URLSearchParams();
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    params.set('search', trimmedSearch);
  }
  if (page > 0) {
    params.set('page', String(page));
  }
  if (roleFilter !== 'all') {
    params.set('role', roleFilter);
  }
  const query = params.toString();
  return query ? `/admin/users?${query}` : '/admin/users';
}

async function loadUserAccessViaServer(page: number, search: string, roleFilter: GlobalRoleFilter): Promise<UserAccessPayload> {
  if (!supportsServerApi()) {
    throw new Error('Admin user access API is unavailable in this runtime.');
  }

  const endpoint = resolveApiUrl('/api/admin/users-access');
  if (!endpoint) {
    throw new Error('Could not resolve the admin user access endpoint.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh the page and sign in again.');
  }

  const url = new URL(endpoint);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  if (search.trim()) {
    url.searchParams.set('search', search.trim());
  }
  if (roleFilter !== 'all') {
    url.searchParams.set('role', roleFilter);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to load the user access matrix.');
  }

  return {
    users: (payload.users ?? []) as UserRow[],
    totalCount: payload.totalCount ?? 0,
    mosques: (payload.mosques ?? []) as MosqueRow[],
    adminAssignments: (payload.adminAssignments ?? {}) as Record<string, string[]>,
    muezzinAssignments: (payload.muezzinAssignments ?? {}) as Record<string, string[]>,
  };
}

async function loadUserAccessViaClient(page: number, search: string, roleFilter: GlobalRoleFilter): Promise<UserAccessPayload> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let usersQuery = supabase
    .from('users')
    .select('id, email, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search.trim()) {
    usersQuery = usersQuery.ilike('email', `%${search.trim()}%`);
  }

  if (roleFilter === 'main_admin') {
    usersQuery = usersQuery.eq('role', 'main_admin');
  } else if (roleFilter === 'user') {
    usersQuery = usersQuery.neq('role', 'main_admin');
  }

  const [usersRes, mosquesRes] = await Promise.all([
    usersQuery,
    supabase
      .from('mosques')
      .select('id, name, city, country, status, allow_multi_mosque_local_admins')
      .order('name', { ascending: true })
      .limit(500),
  ]);

  if (usersRes.error) {
    throw new Error(usersRes.error.message || 'Unable to load users.');
  }

  if (mosquesRes.error) {
    throw new Error(mosquesRes.error.message || 'Unable to load mosques.');
  }

  const users = (usersRes.data ?? []) as UserRow[];
  const ids = users.map((user) => user.id);

  const adminAssignments: Record<string, string[]> = {};
  const muezzinAssignments: Record<string, string[]> = {};

  if (ids.length) {
    const [adminRes, muezzinRes] = await Promise.all([
      supabase.from('mosque_admins').select('user_id, mosque_id').in('user_id', ids),
      supabase.from('muezzins').select('user_id, mosque_id, is_active').in('user_id', ids),
    ]);

    if (adminRes.error) {
      throw new Error(adminRes.error.message || 'Unable to load mosque admin assignments.');
    }

    if (muezzinRes.error) {
      throw new Error(muezzinRes.error.message || 'Unable to load muezzin assignments.');
    }

    for (const row of adminRes.data ?? []) {
      adminAssignments[row.user_id] = adminAssignments[row.user_id] ?? [];
      adminAssignments[row.user_id].push(row.mosque_id);
    }

    for (const row of muezzinRes.data ?? []) {
      if ((row as { is_active?: boolean | null }).is_active === false) continue;
      muezzinAssignments[row.user_id] = muezzinAssignments[row.user_id] ?? [];
      muezzinAssignments[row.user_id].push(row.mosque_id);
    }
  }

  return {
    users,
    totalCount: usersRes.count ?? 0,
    mosques: (mosquesRes.data ?? []) as MosqueRow[],
    adminAssignments,
    muezzinAssignments,
  };
}

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
  const params = useLocalSearchParams<{ search?: string; page?: string; role?: string }>();
  const { notifyError, notifyInfo, notifySuccess } = useAdminFeedback();
  const initialSearch = parseSearchParam(params.search);
  const initialPage = parsePageParam(params.page);
  const initialRoleFilter = parseRoleParam(params.role);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<GlobalRoleFilter>(initialRoleFilter);

  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [adminAssignments, setAdminAssignments] = useState<Record<string, string[]>>({});
  const [muezzinAssignments, setMuezzinAssignments] = useState<Record<string, string[]>>({});

  const [selectedAdminMosque, setSelectedAdminMosque] = useState<Record<string, string>>({});
  const [selectedMuezzinMosque, setSelectedMuezzinMosque] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextSearch = parseSearchParam(params.search);
    const nextPage = parsePageParam(params.page);
    const nextRole = parseRoleParam(params.role);

    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
    setRoleFilter((prev) => (prev === nextRole ? prev : nextRole));
  }, [params.page, params.role, params.search]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorBanner(null);
      try {
        let payload: UserAccessPayload | null = null;

        if (supportsServerApi()) {
          try {
            payload = await loadUserAccessViaServer(page, search, roleFilter);
          } catch (error) {
            console.warn('users page server load fallback', error);
          }
        }

        if (!payload) {
          payload = await loadUserAccessViaClient(page, search, roleFilter);
        }

        if (!cancelled) {
          setUsers(payload.users);
          setTotalCount(payload.totalCount);
          setMosques(payload.mosques);
          setAdminAssignments(payload.adminAssignments);
          setMuezzinAssignments(payload.muezzinAssignments);
          setErrorBanner(null);
        }
      } catch (e) {
        console.error('users page load error', e);
        if (!cancelled) {
          setErrorBanner(
            e instanceof Error ? e.message : 'Unable to load the user access matrix from the server or client fallback.'
          );
          setUsers([]);
          setTotalCount(0);
          setMosques([]);
          setAdminAssignments({});
          setMuezzinAssignments({});
        }
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

  const mosquePolicyMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof mapMosquePolicyRow>> = {};
    mosques.forEach((mosque) => {
      map[mosque.id] = mapMosquePolicyRow(mosque);
    });
    return map;
  }, [mosques]);

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    if (search.trim()) {
      filters.push({ key: 'search', label: 'Search', value: search.trim() });
    }
    if (roleFilter !== 'all') {
      filters.push({ key: 'role', label: 'Global role', value: roleFilter.replace('_', ' ') });
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
    router.replace(buildUsersRoute(next, 0, roleFilter) as any);
  };

  const clearFilter = (key: string) => {
    if (key === 'search') {
      handleSearch('');
      return;
    }
    if (key === 'role') {
      setRoleFilter('all');
      setPage(0);
      router.replace(buildUsersRoute(search, 0, 'all') as any);
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
    router.replace('/admin/users' as any);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    router.replace(buildUsersRoute(search, nextPage, roleFilter) as any);
  };

  const setGlobalRole = async (userId: string, role: Extract<UserRole, 'user' | 'main_admin'>) => {
    const prev = users.find((u) => u.id === userId)?.role;
    const confirmText =
      role === 'user'
        ? 'Set this account back to the base user role? Mosque-scoped assignments will remain intact.'
        : 'Grant main-admin access to this account?';
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
        notifySuccess(
          'Global role updated.',
          role === 'main_admin'
            ? 'This account now has network-wide main-admin access.'
            : 'This account now uses the base user role. Mosque-scoped assignments still control local admin and muezzin access.'
        );
      }
    } catch (e) {
      console.error('set role exception', e);
      notifyError('Role update failed.', 'The request did not complete cleanly.');
    }
  };

  const assignLocalAdmin = async (userId: string, mosqueId: string | undefined) => {
    if (!mosqueId) return;
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole === 'main_admin') {
      notifyError('Main admins do not need local-admin assignments.');
      return;
    }
    const already = (adminAssignments[userId] ?? []).includes(mosqueId);
    if (already) return;
    const targetMosque = mosquePolicyMap[mosqueId];
    if (targetMosque) {
      const assignedMosques = (adminAssignments[userId] ?? [])
        .map((assignedMosqueId) => mosquePolicyMap[assignedMosqueId])
        .filter(Boolean);
      const policyDecision = evaluateLocalAdminPolicy(targetMosque, assignedMosques);
      if (!policyDecision.allowed) {
        notifyError('Assignment blocked.', policyDecision.message ?? 'This assignment is not allowed for this mosque.');
        return;
      }
    }
    try {
      await assignLocalAdminMembership({ userId, mosqueId });
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request did not complete cleanly.';
      if (message.toLowerCase().includes('already')) {
        notifyInfo('That user already has local-admin access to this mosque.');
        return;
      }
      console.error('assign local admin exception', e);
      notifyError('Local-admin assignment failed.', message);
    }
  };

  const removeLocalAdmin = async (userId: string, mosqueId: string) => {
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Remove this local admin assignment?') : true;
    if (!confirmed) return;

    try {
      await removeLocalAdminMembership({ userId, mosqueId });
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request did not complete cleanly.';
      console.error('remove local admin exception', e);
      notifyError('Removing local-admin access failed.', message);
    }
  };

  const assignMuezzin = async (userId: string, mosqueId: string | undefined) => {
    if (!mosqueId) return;
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole === 'main_admin') {
      notifyError('Main admins should not be assigned as mosque-scoped muezzins.');
      return;
    }
    const already = (muezzinAssignments[userId] ?? []).includes(mosqueId);
    if (already) return;
    try {
      await assignMuezzinMembership({ userId, mosqueId });
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request did not complete cleanly.';
      if (message.toLowerCase().includes('already')) {
        notifyInfo('That user already has muezzin access to this mosque.');
        return;
      }
      console.error('assign muezzin exception', e);
      notifyError('Muezzin assignment failed.', message);
    }
  };

  const removeMuezzin = async (userId: string, mosqueId: string) => {
    const confirmed =
      typeof window !== 'undefined' ? window.confirm('Remove this muezzin assignment?') : true;
    if (!confirmed) return;

    try {
      await removeMuezzinMembership({ userId, mosqueId });
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request did not complete cleanly.';
      console.error('remove muezzin exception', e);
      notifyError('Removing muezzin access failed.', message);
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
      key: 'users-filter-main-admins',
      label: 'Show main admins',
      description: 'Filter the access matrix to accounts with global main-admin access.',
      keywords: ['main admin', 'filter'],
      onSelect: () => {
        setRoleFilter('main_admin');
        setPage(0);
        router.replace(buildUsersRoute(search, 0, 'main_admin') as any);
      },
    },
    {
      key: 'users-filter-base-users',
      label: 'Show base users',
      description: 'Filter the access matrix to non-global accounts.',
      keywords: ['user', 'listener', 'filter'],
      onSelect: () => {
        setRoleFilter('user');
        setPage(0);
        router.replace(buildUsersRoute(search, 0, 'user') as any);
      },
    },
  ];

  return (
    <AdminShell
      title="User access and role control"
      eyebrow="Identity & Permissions"
      description="Keep global roles minimal, then grant mosque-scoped local-admin and muezzin access only through explicit assignments."
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
            <label style={styles.filterLabel}>Global role</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                const nextRole = e.target.value as GlobalRoleFilter;
                setRoleFilter(nextRole);
                setPage(0);
                router.replace(buildUsersRoute(search, 0, nextRole) as any);
              }}
              style={styles.select}
            >
              <option value="all">All accounts</option>
              <option value="user">Base user</option>
              <option value="main_admin">Main admin</option>
            </select>
          </div>
          <div style={styles.toolbarCopy}>
            Search from the command bar above, then manage mosque-scoped assignments here without turning profile roles into local-admin or muezzin flags.
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
                  onClick={() => canPrev && goToPage(page - 1)}
                  disabled={!canPrev || loading}
                >
                  Previous
                </button>
                <span style={styles.pageInfo}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  style={styles.pageButton}
                  onClick={() => canNext && goToPage(page + 1)}
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
            const displayRole = normalizeDisplayedGlobalRole(u.role);
            const hasLegacyRole = isLegacyScopedGlobalRole(u.role);
            const isMainAdmin = displayRole === 'main_admin';

            return (
              <tr key={u.id}>
                <td style={styles.td}>
                  <div style={styles.emailCell}>
                    <div style={styles.primaryText}>{u.email ?? '-'}</div>
                    <div style={styles.secondaryText}>User ID: {u.id.slice(0, 8)}</div>
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={styles.roleCell}>
                    {renderRoleBadge(displayRole)}
                    {hasLegacyRole ? (
                      <div style={styles.legacyRoleHint}>Stored as legacy {u.role}. Normalize this account.</div>
                    ) : null}
                  </div>
                </td>
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
                            {m.name} {m.allow_multi_mosque_local_admins ? '(shared)' : '(exclusive)'}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const selectedMosqueId = selectedAdminMosque[u.id] ?? '';
                        if (!selectedMosqueId) return null;
                        const targetMosque = mosquePolicyMap[selectedMosqueId];
                        if (!targetMosque) return null;
                        const assignedMosques = adminMosques
                          .map((assignedMosqueId) => mosquePolicyMap[assignedMosqueId])
                          .filter(Boolean);
                        const policyDecision = evaluateLocalAdminPolicy(targetMosque, assignedMosques);
                        return !policyDecision.allowed ? (
                          <span style={styles.assignmentHint}>{policyDecision.message}</span>
                        ) : (
                          <span style={styles.assignmentHintNeutral}>
                            {targetMosque.allowMultiMosqueLocalAdmins
                              ? 'This mosque allows shared local-admin access.'
                              : 'This mosque keeps local admins exclusive to this mosque.'}
                          </span>
                        );
                      })()}
                      <button
                        style={styles.assignButton}
                        onClick={() => assignLocalAdmin(u.id, selectedAdminMosque[u.id])}
                        disabled={
                          !selectedAdminMosque[u.id] ||
                          loading ||
                          isMainAdmin ||
                          (() => {
                            const selectedMosqueId = selectedAdminMosque[u.id];
                            if (!selectedMosqueId) return false;
                            const targetMosque = mosquePolicyMap[selectedMosqueId];
                            if (!targetMosque) return false;
                            const assignedMosques = adminMosques
                              .map((assignedMosqueId) => mosquePolicyMap[assignedMosqueId])
                              .filter(Boolean);
                            return !evaluateLocalAdminPolicy(targetMosque, assignedMosques).allowed;
                          })()
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
                        disabled={!selectedMuezzinMosque[u.id] || loading || isMainAdmin}
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
                      onClick={() => setGlobalRole(u.id, 'main_admin')}
                      disabled={isMainAdmin || loading}
                    >
                      Grant main admin
                    </button>
                    <button
                      style={styles.actionButtonSecondary}
                      onClick={() => setGlobalRole(u.id, 'user')}
                      disabled={(u.role === 'user' && !hasLegacyRole) || loading}
                    >
                      {hasLegacyRole ? 'Normalize account' : 'Set base account'}
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

function renderRoleBadge(role: DisplayGlobalRole) {
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
  roleCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
  legacyRoleHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#b45309',
    fontWeight: 700,
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
    flexWrap: 'wrap',
  },
  assignmentHint: {
    flexBasis: '100%',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#b45309',
    fontWeight: 700,
  },
  assignmentHintNeutral: {
    flexBasis: '100%',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#475569',
    fontWeight: 600,
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
