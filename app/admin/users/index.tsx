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
import { Button, Select } from '../../../components/admin/web/ui';
import UserDrawer from '../../../components/admin/web/UserDrawer';
import { assignLocalAdminMembership, removeLocalAdminMembership } from '../../../lib/api/admin/localAdminAssignments';
import { assignMuezzinMembership, removeMuezzinMembership } from '../../../lib/api/admin/muezzinAssignments';
import { resolveApiUrl, supportsServerApi } from '../../../lib/api/apiBaseUrl';
import { fetchAllMosqueRows } from '../../../lib/api/admin/mosqueDirectory';

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
  { key: 'email', label: 'Email / ID' },
  { key: 'role', label: 'Global Role', width: '13%' },
  { key: 'local_admins', label: 'Local Admin Of', width: '13%' },
  { key: 'muezzins', label: 'Muezzin Of', width: '13%' },
  { key: 'created', label: 'Created', width: '13%' },
  { key: 'actions', label: '', width: '80px' },
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
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (page > 0) params.set('page', String(page));
  if (roleFilter !== 'all') params.set('role', roleFilter);
  const query = params.toString();
  return query ? `/admin/users?${query}` : '/admin/users';
}

async function loadUserAccessViaServer(
  page: number,
  search: string,
  roleFilter: GlobalRoleFilter
): Promise<UserAccessPayload> {
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
  if (search.trim()) url.searchParams.set('search', search.trim());
  if (roleFilter !== 'all') url.searchParams.set('role', roleFilter);
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
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

async function loadUserAccessViaClient(
  page: number,
  search: string,
  roleFilter: GlobalRoleFilter
): Promise<UserAccessPayload> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let usersQuery = supabase
    .from('users')
    .select('id, email, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search.trim()) usersQuery = usersQuery.ilike('email', `%${search.trim()}%`);
  if (roleFilter === 'main_admin') usersQuery = usersQuery.eq('role', 'main_admin');
  else if (roleFilter === 'user') usersQuery = usersQuery.neq('role', 'main_admin');

  const [usersRes, mosquesRes] = await Promise.all([
    usersQuery,
    fetchAllMosqueRows<MosqueRow>(
      supabase,
      'id, name, city, country, status, allow_multi_mosque_local_admins'
    ),
  ]);

  if (usersRes.error) throw new Error(usersRes.error.message || 'Unable to load users.');
  if (mosquesRes.error) throw new Error(mosquesRes.error.message || 'Unable to load mosques.');

  const users = (usersRes.data ?? []) as UserRow[];
  const ids = users.map((u) => u.id);

  const adminAssignments: Record<string, string[]> = {};
  const muezzinAssignments: Record<string, string[]> = {};

  if (ids.length) {
    const [adminRes, muezzinRes] = await Promise.all([
      supabase.from('mosque_admins').select('user_id, mosque_id').in('user_id', ids),
      supabase.from('muezzins').select('user_id, mosque_id, is_active').in('user_id', ids),
    ]);
    if (adminRes.error) throw new Error(adminRes.error.message || 'Unable to load mosque admin assignments.');
    if (muezzinRes.error) throw new Error(muezzinRes.error.message || 'Unable to load muezzin assignments.');
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
  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<GlobalRoleFilter>(initialRoleFilter);

  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [adminAssignments, setAdminAssignments] = useState<Record<string, string[]>>({});
  const [muezzinAssignments, setMuezzinAssignments] = useState<Record<string, string[]>>({});

  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

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
          } catch (err) {
            console.warn('users page server load fallback', err);
          }
        }
        if (!payload) payload = await loadUserAccessViaClient(page, search, roleFilter);
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
            e instanceof Error
              ? e.message
              : 'Unable to load the user access matrix from the server or client fallback.'
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
    return () => { cancelled = true; };
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
    mosques.forEach((m) => { map[m.id] = m.name ?? 'Mosque'; });
    return map;
  }, [mosques]);

  const mosquePolicyMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof mapMosquePolicyRow>> = {};
    mosques.forEach((m) => { map[m.id] = mapMosquePolicyRow(m); });
    return map;
  }, [mosques]);

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    if (search.trim()) filters.push({ key: 'search', label: 'Search', value: search.trim() });
    if (roleFilter !== 'all')
      filters.push({ key: 'role', label: 'Global role', value: roleFilter.replace('_', ' ') });
    return filters;
  }, [roleFilter, search]);

  const visibleAssignmentCount = useMemo(
    () =>
      users.reduce(
        (count, u) =>
          count + (adminAssignments[u.id] ?? []).length + (muezzinAssignments[u.id] ?? []).length,
        0
      ),
    [adminAssignments, muezzinAssignments, users]
  );

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;
  const rowStart = totalCount ? page * PAGE_SIZE + 1 : 0;
  const rowEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  // Always reflect latest role/assignment state in the drawer (handles mutations inside drawer)
  const drawerUser = useMemo(
    () => (drawerUserId ? (users.find((u) => u.id === drawerUserId) ?? null) : null),
    [drawerUserId, users]
  );

  const evaluateAdminPolicy = (
    mosqueId: string,
    currentAdminMosqueIds: string[]
  ): { allowed: boolean; message?: string } => {
    const targetMosque = mosquePolicyMap[mosqueId];
    if (!targetMosque) return { allowed: true };
    const assignedMosques = currentAdminMosqueIds
      .map((id) => mosquePolicyMap[id])
      .filter(Boolean);
    const result = evaluateLocalAdminPolicy(targetMosque, assignedMosques);
    return { allowed: result.allowed, message: result.message ?? undefined };
  };

  const handleSearch = (term: string) => {
    const next = term.trim();
    setPage(0);
    setSearch(next);
    router.replace(buildUsersRoute(next, 0, roleFilter) as any);
  };

  const clearFilter = (key: string) => {
    if (key === 'search') { handleSearch(''); return; }
    if (key === 'role') {
      setRoleFilter('all');
      setPage(0);
      router.replace(buildUsersRoute(search, 0, 'all') as any);
    }
  };

  const clearAllFilters = () => {
    setRoleFilter('all');
    setPage(0);
    if (search) { handleSearch(''); return; }
    setSearch('');
    router.replace('/admin/users' as any);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    router.replace(buildUsersRoute(search, nextPage, roleFilter) as any);
  };

  const handleGrantMainAdmin = async (userId: string) => {
    const prev = users.find((u) => u.id === userId)?.role;
    setSaving(true);
    try {
      const { error } = await supabase.from('users').update({ role: 'main_admin' }).eq('id', userId);
      if (error) {
        notifyError('Role update failed.', error.message);
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'set_user_role',
          user_id: userId,
          from_role: prev,
          to_role: 'main_admin',
          timestamp: new Date().toISOString(),
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: 'main_admin' as UserRole } : u))
        );
        notifySuccess('Main admin granted.', 'This account now has network-wide main-admin access.');
      }
    } catch (e) {
      notifyError('Role update failed.', e instanceof Error ? e.message : 'The request did not complete cleanly.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetBaseAccount = async (userId: string) => {
    const prev = users.find((u) => u.id === userId)?.role;
    setSaving(true);
    try {
      const { error } = await supabase.from('users').update({ role: 'user' }).eq('id', userId);
      if (error) {
        notifyError('Role update failed.', error.message);
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'set_user_role',
          user_id: userId,
          from_role: prev,
          to_role: 'user',
          timestamp: new Date().toISOString(),
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: 'user' as UserRole } : u))
        );
        notifySuccess(
          'Account demoted.',
          'This account now uses the base user role. Mosque-scoped assignments remain intact.'
        );
      }
    } catch (e) {
      notifyError('Role update failed.', e instanceof Error ? e.message : 'The request did not complete cleanly.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignLocalAdmin = async (userId: string, mosqueId: string) => {
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole === 'main_admin') {
      notifyError('Main admins do not need local-admin assignments.');
      return;
    }
    if ((adminAssignments[userId] ?? []).includes(mosqueId)) return;
    const targetMosque = mosquePolicyMap[mosqueId];
    if (targetMosque) {
      const assignedMosques = (adminAssignments[userId] ?? [])
        .map((id) => mosquePolicyMap[id])
        .filter(Boolean);
      const decision = evaluateLocalAdminPolicy(targetMosque, assignedMosques);
      if (!decision.allowed) {
        notifyError('Assignment blocked.', decision.message ?? 'This assignment is not allowed for this mosque.');
        return;
      }
    }
    setSaving(true);
    try {
      await assignLocalAdminMembership({ userId, mosqueId });
      console.log('[ADMIN_ACTION]', {
        action: 'assign_local_admin',
        user_id: userId,
        mosque_id: mosqueId,
        timestamp: new Date().toISOString(),
      });
      setAdminAssignments((prev) => ({
        ...prev,
        [userId]: [...(prev[userId] ?? []), mosqueId],
      }));
      notifySuccess('Local admin assigned.', 'The user now has access to the chosen mosque.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request did not complete cleanly.';
      if (message.toLowerCase().includes('already')) {
        notifyInfo('That user already has local-admin access to this mosque.');
        return;
      }
      notifyError('Local-admin assignment failed.', message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLocalAdmin = async (userId: string, mosqueId: string) => {
    setSaving(true);
    try {
      await removeLocalAdminMembership({ userId, mosqueId });
      console.log('[ADMIN_ACTION]', {
        action: 'remove_local_admin',
        user_id: userId,
        mosque_id: mosqueId,
        timestamp: new Date().toISOString(),
      });
      setAdminAssignments((prev) => ({
        ...prev,
        [userId]: (prev[userId] ?? []).filter((m) => m !== mosqueId),
      }));
      notifySuccess('Local admin removed.', 'Mosque-scoped admin access has been removed.');
    } catch (e) {
      notifyError(
        'Removing local-admin access failed.',
        e instanceof Error ? e.message : 'The request did not complete cleanly.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAssignMuezzin = async (userId: string, mosqueId: string) => {
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole === 'main_admin') {
      notifyError('Main admins should not be assigned as mosque-scoped muezzins.');
      return;
    }
    if ((muezzinAssignments[userId] ?? []).includes(mosqueId)) return;
    setSaving(true);
    try {
      await assignMuezzinMembership({ userId, mosqueId });
      console.log('[ADMIN_ACTION]', {
        action: 'assign_muezzin',
        user_id: userId,
        mosque_id: mosqueId,
        timestamp: new Date().toISOString(),
      });
      setMuezzinAssignments((prev) => ({
        ...prev,
        [userId]: [...(prev[userId] ?? []), mosqueId],
      }));
      notifySuccess('Muezzin assigned.', 'The user now has muezzin access to the chosen mosque.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request did not complete cleanly.';
      if (message.toLowerCase().includes('already')) {
        notifyInfo('That user already has muezzin access to this mosque.');
        return;
      }
      notifyError('Muezzin assignment failed.', message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMuezzin = async (userId: string, mosqueId: string) => {
    setSaving(true);
    try {
      await removeMuezzinMembership({ userId, mosqueId });
      console.log('[ADMIN_ACTION]', {
        action: 'remove_muezzin',
        user_id: userId,
        mosque_id: mosqueId,
        timestamp: new Date().toISOString(),
      });
      setMuezzinAssignments((prev) => ({
        ...prev,
        [userId]: (prev[userId] ?? []).filter((m) => m !== mosqueId),
      }));
      notifySuccess('Muezzin removed.', 'Mosque-scoped muezzin access has been removed.');
    } catch (e) {
      notifyError(
        'Removing muezzin access failed.',
        e instanceof Error ? e.message : 'The request did not complete cleanly.'
      );
    } finally {
      setSaving(false);
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
      breadcrumbs={[
        { label: 'Dashboard', href: '/admin' },
        { label: 'Users' },
      ]}
      mosques={mosqueOptions}
      onSearch={handleSearch}
      commandActions={commandActions}
      notices={
        errorBanner ? (
          <div role="alert" style={styles.errorBanner}>{errorBanner}</div>
        ) : null
      }
    >
      <div style={styles.metricGrid}>
        <AdminMetricCard
          label="Visible users"
          value={users.length}
          detail="Rows currently loaded in this view"
        />
        <AdminMetricCard
          label="Total accounts"
          value={totalCount}
          detail="All user records matching the current filter"
        />
        <AdminMetricCard
          label="Assignments in view"
          value={visibleAssignmentCount}
          detail="Combined local-admin and muezzin mosque assignments in the current result set"
        />
      </div>

      <AdminPanel
        title="Access matrix"
        subtitle="Filter the operator list, validate role posture, then open any user to apply mosque-scoped access where explicitly intended."
      >
        <div style={styles.toolbar}>
          <div style={styles.filterControl}>
            <label style={styles.filterLabel} htmlFor="role-filter">
              Global role
            </label>
            <Select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => {
                const nextRole = e.target.value as GlobalRoleFilter;
                setRoleFilter(nextRole);
                setPage(0);
                router.replace(buildUsersRoute(search, 0, nextRole) as any);
              }}
              aria-label="Filter by global role"
            >
              <option value="all">All accounts</option>
              <option value="user">Base user</option>
              <option value="main_admin">Main admin</option>
            </Select>
          </div>
          <div style={styles.toolbarCopy}>
            Search from the command bar above, then open any user with the Edit button to manage their mosque-scoped roles.
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
                {rowStart && rowEnd
                  ? `Showing ${rowStart}–${rowEnd} of ${totalCount}`
                  : 'No users to display'}
              </div>
              <div style={styles.footerActions}>
                <button
                  className="adm-btn"
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
                  className="adm-btn"
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
            const displayRole = normalizeDisplayedGlobalRole(u.role);
            const hasLegacyRole = isLegacyScopedGlobalRole(u.role);

            return (
              <tr key={u.id} className="adm-tr">
                <td style={styles.td}>
                  <div style={styles.emailCell}>
                    <div style={styles.primaryText}>{u.email ?? '—'}</div>
                    <div style={styles.secondaryText}>ID: {u.id.slice(0, 10)}…</div>
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={styles.roleCell}>
                    {renderRoleBadge(displayRole)}
                    {hasLegacyRole ? (
                      <div style={styles.legacyRoleHint}>Legacy {u.role} — normalize</div>
                    ) : null}
                  </div>
                </td>
                <td style={styles.td}>
                  {adminMosques.length ? (
                    <span style={styles.countBadge}>
                      {adminMosques.length} mosque{adminMosques.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={styles.emptyCount}>—</span>
                  )}
                </td>
                <td style={styles.td}>
                  {muezzinMosques.length ? (
                    <span style={{ ...styles.countBadge, ...styles.countBadgeGreen }}>
                      {muezzinMosques.length} mosque{muezzinMosques.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={styles.emptyCount}>—</span>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={styles.secondaryText}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <Button
                    variant="ghost"
                    onClick={() => setDrawerUserId(u.id)}
                    aria-label={`Edit user ${u.email ?? u.id}`}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminPanel>

      <UserDrawer
        open={drawerUser !== null}
        onClose={() => setDrawerUserId(null)}
        user={drawerUser}
        mosques={mosques}
        adminMosqueIds={drawerUser ? (adminAssignments[drawerUser.id] ?? []) : []}
        muezzinMosqueIds={drawerUser ? (muezzinAssignments[drawerUser.id] ?? []) : []}
        mosqueNameMap={mosqueNameMap}
        onAssignAdmin={handleAssignLocalAdmin}
        onRemoveAdmin={handleRemoveLocalAdmin}
        onAssignMuezzin={handleAssignMuezzin}
        onRemoveMuezzin={handleRemoveMuezzin}
        onGrantMainAdmin={handleGrantMainAdmin}
        onSetBaseAccount={handleSetBaseAccount}
        evaluateAdminPolicy={evaluateAdminPolicy}
        loading={saving}
      />
    </AdminShell>
  );
}

function renderRoleBadge(role: DisplayGlobalRole) {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  };
  if (role === 'main_admin') {
    return <span style={{ ...base, backgroundColor: '#0f172a', color: '#e2e8f0' }}>main_admin</span>;
  }
  return <span style={{ ...base, backgroundColor: '#e2e8f0', color: '#0f172a' }}>user</span>;
}

const styles: Record<string, React.CSSProperties> = {
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  errorBanner: {
    padding: '10px 14px',
    borderRadius: 10,
    backgroundColor: '#fff4e5',
    color: '#b45309',
    border: '1px solid #fb923c',
    fontWeight: 700,
    fontSize: 14,
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
    textTransform: 'uppercase' as const,
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
    padding: '14px 16px',
    fontSize: 14,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  },
  emailCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  roleCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  primaryText: {
    fontWeight: 700,
    color: '#0f172a',
    fontSize: 14,
  },
  secondaryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600,
  },
  legacyRoleHint: {
    fontSize: 11,
    lineHeight: 1.4,
    color: '#b45309',
    fontWeight: 700,
  },
  countBadge: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: 12,
  },
  countBadgeGreen: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  emptyCount: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 600,
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
    gap: 10,
    flexWrap: 'wrap',
  },
  pageButton: {
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    color: '#0f172a',
  },
  pageInfo: {
    fontSize: 13,
    color: '#475569',
    fontWeight: 700,
  },
};
