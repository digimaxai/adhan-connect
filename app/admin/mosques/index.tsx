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
import AdminDataTable from '../../../components/admin/web/AdminDataTable';
import AdminFilterPills from '../../../components/admin/web/AdminFilterPills';
import ConfirmDialog from '../../../components/admin/web/ConfirmDialog';
import { Button, Menu, MenuItem, Modal, Pill, Select, TextInput } from '../../../components/admin/web/ui';
import { fetchAllMosqueRows } from '../../../lib/api/admin/mosqueDirectory';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
  created_at?: string | null;
};

type StatusFilter = 'all' | 'active' | 'pending' | 'inactive';

function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'active' || raw === 'pending' || raw === 'inactive' ? raw : 'all';
}

const TIMEZONE_OPTIONS = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Europe/Berlin (CET/CEST)', value: 'Europe/Berlin' },
  { label: 'Europe/Amsterdam (CET/CEST)', value: 'Europe/Amsterdam' },
  { label: 'Europe/Madrid (CET/CEST)', value: 'Europe/Madrid' },
  { label: 'Europe/Istanbul (TRT)', value: 'Europe/Istanbul' },
  { label: 'Africa/Cairo (EET)', value: 'Africa/Cairo' },
  { label: 'Africa/Casablanca (WET/WEST)', value: 'Africa/Casablanca' },
  { label: 'Africa/Lagos (WAT)', value: 'Africa/Lagos' },
  { label: 'Africa/Nairobi (EAT)', value: 'Africa/Nairobi' },
  { label: 'Africa/Johannesburg (SAST)', value: 'Africa/Johannesburg' },
  { label: 'Asia/Riyadh (AST +03)', value: 'Asia/Riyadh' },
  { label: 'Asia/Dubai (GST +04)', value: 'Asia/Dubai' },
  { label: 'Asia/Kuwait (AST +03)', value: 'Asia/Kuwait' },
  { label: 'Asia/Baghdad (AST +03)', value: 'Asia/Baghdad' },
  { label: 'Asia/Tehran (IRST +03:30)', value: 'Asia/Tehran' },
  { label: 'Asia/Karachi (PKT +05)', value: 'Asia/Karachi' },
  { label: 'Asia/Kolkata (IST +05:30)', value: 'Asia/Kolkata' },
  { label: 'Asia/Dhaka (BST +06)', value: 'Asia/Dhaka' },
  { label: 'Asia/Jakarta (WIB +07)', value: 'Asia/Jakarta' },
  { label: 'Asia/Kuala_Lumpur (MYT +08)', value: 'Asia/Kuala_Lumpur' },
  { label: 'Asia/Singapore (SGT +08)', value: 'Asia/Singapore' },
  { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
  { label: 'America/Chicago (CST/CDT)', value: 'America/Chicago' },
  { label: 'America/Denver (MST/MDT)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'America/Toronto (EST/EDT)', value: 'America/Toronto' },
  { label: 'America/Vancouver (PST/PDT)', value: 'America/Vancouver' },
  { label: 'Australia/Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
  { label: 'Australia/Perth (AWST)', value: 'Australia/Perth' },
];

const PAGE_SIZE = 20;
const MOSQUE_TABLE_COLUMNS = [
  { key: 'name',    label: 'Name',    width: '24%' },
  { key: 'city',    label: 'City',    width: '16%' },
  { key: 'country', label: 'Country', width: '16%' },
  { key: 'status',  label: 'Status',  width: '12%' },
  { key: 'created', label: 'Created', width: '18%' },
  { key: 'actions', label: 'Actions', width: '14%', align: 'right' as const },
];

export default function MosquesPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <MosquesShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function MosquesShell() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; filter?: string }>();
  const { setSelectedMosqueId, isMosqueMode, selectedMosqueId } = useAdminContext();
  const { notifyError, notifySuccess } = useAdminFeedback();

  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [search, setSearch] = useState(typeof params.search === 'string' ? params.search : '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => parseStatusFilter(params.filter));
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name_asc'>('newest');
  const [refreshTick, setRefreshTick] = useState(0);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createCountry, setCreateCountry] = useState('');
  const [createAllowMultiMosqueLocalAdmins, setCreateAllowMultiMosqueLocalAdmins] = useState(false);
  const [createTimezone, setCreateTimezone] = useState('UTC');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    consequence: string;
    variant: 'danger' | 'warning' | 'neutral';
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', consequence: '', variant: 'neutral', onConfirm: () => {} });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const confirm = (opts: Omit<typeof confirmState, 'open'>) =>
    setConfirmState({ open: true, ...opts });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setSearch(typeof params.search === 'string' ? params.search : '');
  }, [params.search]);

  useEffect(() => {
    const nextFilter = parseStatusFilter(params.filter);
    setStatusFilter((prev) => (prev === nextFilter ? prev : nextFilter));
    setPage(0);
  }, [params.filter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchAllMosqueRows<MosqueRow>(
        supabase,
        'id, name, city, country, status, allow_multi_mosque_local_admins'
      );
      if (!res.error && !cancelled) setMosquesForSelector(res.data ?? []);
    })();
    return () => { cancelled = true; };
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
          .from('mosques')
          .select('id, name, city, country, status, allow_multi_mosque_local_admins, created_at', { count: 'exact' });

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (debouncedSearch) {
          query = query.or(
            `name.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%,country.ilike.%${debouncedSearch}%`
          );
        }
        if (sort === 'newest') query = query.order('created_at', { ascending: false });
        if (sort === 'oldest') query = query.order('created_at', { ascending: true });
        if (sort === 'name_asc') query = query.order('name', { ascending: true });

        const { data, error, count } = await query.range(from, to);
        if (error) {
          if (!cancelled) { setMosques([]); setTotalCount(0); setErrorBanner('Unable to load mosques. Check console logs.'); }
        } else if (!cancelled) {
          setMosques(data ?? []);
          setTotalCount(count ?? 0);
        }
      } catch {
        if (!cancelled) setErrorBanner('Unable to load mosques. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, page, refreshTick, sort, statusFilter]);

  const mosqueOptions = useMemo<MosqueOption[]>(
    () => mosquesForSelector.map((m) => ({ id: m.id, name: m.name ?? 'Mosque', city: m.city ?? null, country: m.country ?? null, status: m.status ?? null })),
    [mosquesForSelector]
  );

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    if (debouncedSearch) filters.push({ key: 'search', label: 'Search', value: debouncedSearch });
    if (statusFilter !== 'all') filters.push({ key: 'status', label: 'Status', value: statusFilter });
    if (sort !== 'newest') filters.push({ key: 'sort', label: 'Sort', value: sort === 'oldest' ? 'Oldest first' : 'Name A-Z' });
    return filters;
  }, [debouncedSearch, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  const pendingCount = mosques.filter((m) => m.status === 'pending').length;
  const inactiveCount = mosques.filter((m) => m.status === 'inactive').length;
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;
  const rowStart = totalCount ? page * PAGE_SIZE + 1 : 0;
  const rowEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  const handleSearch = (term: string) => {
    const next = term.trim();
    setSearch(next);
    setPage(0);
    router.replace((next ? `/admin/mosques?search=${encodeURIComponent(next)}` : '/admin/mosques') as any);
  };

  const clearFilter = (key: string) => {
    if (key === 'search') { handleSearch(''); return; }
    if (key === 'status') { setStatusFilter('all'); setPage(0); return; }
    if (key === 'sort')   { setSort('newest'); setPage(0); }
  };

  const clearAllFilters = () => {
    setStatusFilter('all'); setSort('newest'); setPage(0);
    if (search) { handleSearch(''); return; }
    setSearch('');
  };

  const updateSelectorMosque = (id: string, patch: Partial<MosqueRow>) =>
    setMosquesForSelector((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const triggerRefresh = () => setRefreshTick((v) => v + 1);

  const doApprove = async (id: string) => {
    setConfirmLoading(true);
    const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', id);
    setConfirmLoading(false);
    closeConfirm();
    if (error) { notifyError('Mosque approval failed.', 'Check console logs for the Supabase error details.'); return; }
    setMosques((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'active' } : m)));
    updateSelectorMosque(id, { status: 'active' });
    notifySuccess('Mosque approved.');
    triggerRefresh();
  };

  const doSuspend = async (id: string) => {
    setConfirmLoading(true);
    const { error } = await supabase.from('mosques').update({ status: 'inactive' }).eq('id', id);
    setConfirmLoading(false);
    closeConfirm();
    if (error) { notifyError('Mosque deactivation failed.', 'Check console logs for the Supabase error details.'); return; }
    setMosques((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'inactive' } : m)));
    updateSelectorMosque(id, { status: 'inactive' });
    notifySuccess('Mosque deactivated.');
    triggerRefresh();
  };

  const handleApprove = (m: MosqueRow) =>
    confirm({
      title: `Approve "${m.name}"`,
      description: 'This mosque will become publicly active and visible to listeners and staff.',
      consequence: 'Local admins and muezzins assigned to this mosque will gain immediate access.',
      variant: 'warning',
      onConfirm: () => doApprove(m.id),
    });

  const handleSuspend = (m: MosqueRow) =>
    confirm({
      title: `Deactivate "${m.name}"`,
      description: 'This mosque will be hidden from discovery and live services will stop.',
      consequence: 'Listeners will lose access and any active broadcast will be cut immediately.',
      variant: 'danger',
      onConfirm: () => doSuspend(m.id),
    });

  const handleCreate = async () => {
    setCreateError(null);
    const trimmed = createName.trim();
    if (trimmed.length < 2) { setCreateError('Name must be at least 2 characters.'); return; }

    const payload: Record<string, any> = {
      name: trimmed,
      status: 'pending',
      allow_multi_mosque_local_admins: createAllowMultiMosqueLocalAdmins,
      time_zone: createTimezone || 'UTC',
    };
    if (createCity.trim()) payload.city = createCity.trim();
    if (createCountry.trim()) payload.country = createCountry.trim();

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('mosques')
        .insert(payload)
        .select('id, name, city, country, status, allow_multi_mosque_local_admins, created_at')
        .single();
      if (error) { setCreateError('Create failed. Check console logs.'); return; }
      setCreateOpen(false);
      setCreateName(''); setCreateCity(''); setCreateCountry('');
      setCreateAllowMultiMosqueLocalAdmins(false);
      setCreateTimezone('UTC');
      notifySuccess('Mosque created.', 'The new mosque is now in pending status.');
      if (data) setMosquesForSelector((prev) => [...prev, data].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')));
      setPage(0);
      triggerRefresh();
    } finally {
      setCreating(false);
    }
  };

  const commandActions = [
    { key: 'mosques-create', label: 'Create mosque', description: 'Open the create-mosque workflow.', keywords: ['create', 'mosque', 'new'], onSelect: () => setCreateOpen(true) },
    { key: 'mosques-clear-filters', label: 'Clear mosque filters', description: 'Reset search, status, and sort back to the default view.', keywords: ['clear', 'filters', 'mosques'], onSelect: clearAllFilters },
  ];

  return (
    <AdminShell
      title="Mosque network control"
      breadcrumbs={[{ label: 'Dashboard', href: '/admin' }, { label: 'Mosques' }]}
      description="Search, filter, and act on the mosque network without losing the wider operational picture."
      mosques={mosqueOptions}
      onSearch={handleSearch}
      commandActions={commandActions}
      notices={
        <>
          {isMosqueMode ? (
            <div role="status" style={styles.infoBanner}>
              Mosque context active — actions affect the selected mosque workspace.
            </div>
          ) : null}
          {errorBanner ? <div role="alert" style={styles.errorBanner}>{errorBanner}</div> : null}
        </>
      }
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Create mosque
        </Button>
      }
    >
      <div style={styles.metricGrid}>
        <AdminMetricCard label="Visible mosques" value={mosques.length} detail="Rows currently loaded in this view" />
        <AdminMetricCard label="Pending" value={pendingCount} detail="New or incomplete registrations needing review" />
        <AdminMetricCard label="Inactive" value={inactiveCount} detail="Paused listings outside active service" />
      </div>

      <AdminPanel
        title="Network directory"
        subtitle="Filter the estate, then move directly into review or context-specific work."
      >
        <div style={styles.toolbar}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <TextInput
              placeholder="Search name, city, country"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              aria-label="Search mosques"
            />
          </div>
          <div style={styles.filterRow}>
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(0); }}
              style={{ minWidth: 160 }}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Select
              value={sort}
              onChange={(e) => { setSort(e.target.value as any); setPage(0); }}
              style={{ minWidth: 160 }}
              aria-label="Sort order"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name_asc">Name A-Z</option>
            </Select>
          </div>
        </div>

        <AdminFilterPills items={activeFilters} onClear={clearFilter} onClearAll={clearAllFilters} />

        <AdminDataTable
          columns={MOSQUE_TABLE_COLUMNS}
          loading={loading}
          emptyMessage="No mosques match the current view."
          rowCount={mosques.length}
          footer={
            <div style={styles.tableFooter}>
              <div style={styles.pageInfo}>
                {rowStart && rowEnd ? `Showing ${rowStart}–${rowEnd} of ${totalCount}` : 'No mosques to display'}
              </div>
              <div style={styles.footerActions}>
                <Button variant="ghost" onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev || loading}>
                  Previous
                </Button>
                <span style={styles.pageInfo}>Page {page + 1} of {totalPages}</span>
                <Button variant="ghost" onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext || loading}>
                  Next
                </Button>
              </div>
            </div>
          }
        >
          {mosques.map((m) => (
            <tr key={m.id} className="adm-tr">
              <td style={styles.td}>
                <div style={styles.nameCell}>
                  <div style={styles.primaryText}>{m.name}</div>
                  <div style={styles.secondaryText}>{m.id.slice(0, 8)}</div>
                </div>
              </td>
              <td style={styles.td}>{m.city ?? '—'}</td>
              <td style={styles.td}>{m.country ?? '—'}</td>
              <td style={styles.td}><Pill status={m.status} /></td>
              <td style={styles.td}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                <Menu
                  trigger={
                    <Button variant="ghost" style={{ padding: '8px 10px' }} aria-label={`Actions for ${m.name}`}>
                      Actions ▾
                    </Button>
                  }
                >
                  {m.status !== 'active' ? (
                    <MenuItem onClick={() => handleApprove(m)} disabled={loading}>
                      Approve
                    </MenuItem>
                  ) : null}
                  {m.status !== 'inactive' ? (
                    <MenuItem onClick={() => handleSuspend(m)} disabled={loading} danger>
                      Deactivate
                    </MenuItem>
                  ) : null}
                  <MenuItem onClick={() => setSelectedMosqueId(m.id)} disabled={selectedMosqueId === m.id}>
                    Enter context
                  </MenuItem>
                  <MenuItem onClick={() => router.push(`/admin/mosques/${m.id}` as any)}>
                    View details
                  </MenuItem>
                </Menu>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminPanel>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create mosque">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={styles.label} htmlFor="create-mosque-name">Name *</label>
            <TextInput id="create-mosque-name" value={createName} onChange={(e) => setCreateName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label} htmlFor="create-mosque-city">City</label>
              <TextInput id="create-mosque-city" value={createCity} onChange={(e) => setCreateCity(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label} htmlFor="create-mosque-country">Country</label>
              <TextInput id="create-mosque-country" value={createCountry} onChange={(e) => setCreateCountry(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={styles.label} htmlFor="create-mosque-timezone">Timezone *</label>
            <Select
              id="create-mosque-timezone"
              value={createTimezone}
              onChange={(e) => setCreateTimezone(e.target.value)}
              aria-label="Timezone for prayer time calculations"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </Select>
            <div style={styles.helperText}>
              Used for prayer time calculations. Choose the timezone where this mosque is located.
            </div>
          </div>
          <div>
            <label style={styles.label}>Cross-mosque local-admin access</label>
            <div style={styles.toggleRow}>
              <Button
                variant={createAllowMultiMosqueLocalAdmins ? 'primary' : 'ghost'}
                onClick={() => setCreateAllowMultiMosqueLocalAdmins(true)}
                type="button"
                aria-pressed={createAllowMultiMosqueLocalAdmins}
              >
                Shared
              </Button>
              <Button
                variant={!createAllowMultiMosqueLocalAdmins ? 'primary' : 'ghost'}
                onClick={() => setCreateAllowMultiMosqueLocalAdmins(false)}
                type="button"
                aria-pressed={!createAllowMultiMosqueLocalAdmins}
              >
                Exclusive
              </Button>
            </div>
            <div style={styles.helperText}>
              Exclusive keeps this mosque&apos;s local admins dedicated to this mosque only.
            </div>
          </div>
          {createError ? <div role="alert" style={styles.errorBanner}>{createError}</div> : null}
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.open}
        onClose={closeConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        description={confirmState.description}
        consequence={confirmState.consequence}
        variant={confirmState.variant}
        loading={confirmLoading}
      />
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  infoBanner: {
    padding: '12px 14px',
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d',
    fontWeight: 700,
    fontSize: 14,
  },
  errorBanner: {
    padding: '12px 14px',
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    color: '#b45309',
    border: '1px solid #fdba74',
    fontWeight: 700,
    fontSize: 14,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  toolbar: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  td: {
    padding: '14px 16px',
    fontSize: 14,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  },
  nameCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  primaryText: { fontWeight: 800, color: '#0f172a' },
  secondaryText: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  tableFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  footerActions: { display: 'flex', alignItems: 'center', gap: 12 },
  pageInfo: { fontSize: 14, color: '#475569', fontWeight: 700 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#0f172a' },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  helperText: { marginTop: 8, fontSize: 13, lineHeight: 1.5, color: '#475569' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
};
