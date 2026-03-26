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
import { Button, Menu, MenuItem, Modal, Pill, Select, TextInput } from '../../../components/admin/web/ui';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
  created_at?: string | null;
};

const PAGE_SIZE = 20;
const MOSQUE_TABLE_COLUMNS = [
  { key: 'name', label: 'Name', width: '24%' },
  { key: 'city', label: 'City', width: '16%' },
  { key: 'country', label: 'Country', width: '16%' },
  { key: 'status', label: 'Status', width: '12%' },
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
  const params = useLocalSearchParams<{ search?: string }>();
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name_asc'>('newest');
  const [refreshTick, setRefreshTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createCountry, setCreateCountry] = useState('');
  const [createAllowMultiMosqueLocalAdmins, setCreateAllowMultiMosqueLocalAdmins] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

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
      const mosquesSelectorRes = await supabase
        .from('mosques')
        .select('id, name, city, country, status, allow_multi_mosque_local_admins')
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
          console.error('mosques fetch error', error);
          if (!cancelled) {
            setMosques([]);
            setTotalCount(0);
            setErrorBanner('Unable to load mosques. Check console logs.');
          }
        } else if (!cancelled) {
          setMosques(data ?? []);
          setTotalCount(count ?? 0);
        }
      } catch (error) {
        console.error('mosques load exception', error);
        if (!cancelled) setErrorBanner('Unable to load mosques. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, refreshTick, sort, statusFilter]);

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

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    if (debouncedSearch) {
      filters.push({ key: 'search', label: 'Search', value: debouncedSearch });
    }
    if (statusFilter !== 'all') {
      filters.push({ key: 'status', label: 'Status', value: statusFilter });
    }
    if (sort !== 'newest') {
      const sortLabel = sort === 'oldest' ? 'Oldest first' : 'Name A-Z';
      filters.push({ key: 'sort', label: 'Sort', value: sortLabel });
    }
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
    if (key === 'search') {
      handleSearch('');
      return;
    }
    if (key === 'status') {
      setStatusFilter('all');
      setPage(0);
      return;
    }
    if (key === 'sort') {
      setSort('newest');
      setPage(0);
    }
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setSort('newest');
    setPage(0);
    if (search) {
      handleSearch('');
      return;
    }
    setSearch('');
  };

  const updateSelectorMosque = (id: string, patch: Partial<MosqueRow>) => {
    setMosquesForSelector((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const triggerRefresh = () => setRefreshTick((value) => value + 1);

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', id);
    if (error) {
      console.error('mosque approve error', error);
      notifyError('Mosque approval failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setMosques((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'active' } : m)));
    updateSelectorMosque(id, { status: 'active' });
    notifySuccess('Mosque approved.');
    triggerRefresh();
  };

  const handleSuspend = async (id: string) => {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Deactivate this mosque?') : true;
    if (!confirmed) return;
    const { error } = await supabase.from('mosques').update({ status: 'inactive' }).eq('id', id);
    if (error) {
      console.error('mosque deactivate error', error);
      notifyError('Mosque deactivation failed.', 'Check console logs for the Supabase error details.');
      return;
    }
    setMosques((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'inactive' } : m)));
    updateSelectorMosque(id, { status: 'inactive' });
    notifySuccess('Mosque deactivated.');
    triggerRefresh();
  };

  const handleCreate = async () => {
    setCreateError(null);
    const trimmed = createName.trim();
    if (trimmed.length < 2) {
      setCreateError('Name must be at least 2 characters.');
      return;
    }

    const payload: Record<string, any> = {
      name: trimmed,
      status: 'pending',
      allow_multi_mosque_local_admins: createAllowMultiMosqueLocalAdmins,
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
      if (error) {
        console.error('mosque create error', error);
        setCreateError('Create failed. Check console logs.');
        return;
      }

      setCreateOpen(false);
      setCreateName('');
      setCreateCity('');
      setCreateCountry('');
      setCreateAllowMultiMosqueLocalAdmins(false);
      notifySuccess('Mosque created.', 'The new mosque is now in pending status.');
      if (data) {
        setMosquesForSelector((prev) =>
          [...prev, data].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        );
      }
      setPage(0);
      triggerRefresh();
    } finally {
      setCreating(false);
    }
  };

  const commandActions = [
    {
      key: 'mosques-create',
      label: 'Create mosque',
      description: 'Open the create-mosque workflow.',
      keywords: ['create', 'mosque', 'new'],
      onSelect: () => setCreateOpen(true),
    },
    {
      key: 'mosques-clear-filters',
      label: 'Clear mosque filters',
      description: 'Reset search, status, and sort back to the default view.',
      keywords: ['clear', 'filters', 'mosques'],
      onSelect: clearAllFilters,
    },
  ];

  return (
    <AdminShell
      title="Mosque network control"
      eyebrow="Directory & Approval"
      description="Search, filter, and act on the mosque network without losing the wider operational picture."
      mosques={mosqueOptions}
      onSearch={handleSearch}
      commandActions={commandActions}
      notices={
        <>
          {isMosqueMode ? (
            <div style={styles.impersonationBanner}>
              Impersonation mode: actions affect the selected mosque workspace.
            </div>
          ) : null}
          {errorBanner ? <div style={styles.errorBanner}>{errorBanner}</div> : null}
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
        subtitle="Filter the estate, then move directly into review or context-specific work without leaving the admin shell."
      >
        <div style={styles.toolbar}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <TextInput
              placeholder="Search name, city, country"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div style={styles.filterRow}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'active' | 'pending' | 'inactive');
                setPage(0);
              }}
              style={{ minWidth: 160 }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'newest' | 'oldest' | 'name_asc');
                setPage(0);
              }}
              style={{ minWidth: 160 }}
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
                {rowStart && rowEnd ? `Showing ${rowStart}-${rowEnd} of ${totalCount}` : 'No mosques to display'}
              </div>
              <div style={styles.footerActions}>
                <Button
                  variant="ghost"
                  onClick={() => canPrev && setPage((p) => p - 1)}
                  disabled={!canPrev || loading}
                >
                  Previous
                </Button>
                <span style={styles.pageInfo}>
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => canNext && setPage((p) => p + 1)}
                  disabled={!canNext || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          }
        >
          {mosques.map((m) => (
            <tr key={m.id}>
              <td style={styles.td}>
                <div style={styles.nameCell}>
                  <div style={styles.primaryText}>{m.name}</div>
                  <div style={styles.secondaryText}>{m.id.slice(0, 8)}</div>
                </div>
              </td>
              <td style={styles.td}>{m.city ?? '-'}</td>
              <td style={styles.td}>{m.country ?? '-'}</td>
              <td style={styles.td}>
                <Pill status={m.status} />
              </td>
              <td style={styles.td}>{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                <Menu
                  trigger={
                    <Button variant="ghost" style={{ padding: '8px 10px' }}>
                      Actions
                    </Button>
                  }
                >
                  <MenuItem onClick={() => handleApprove(m.id)} disabled={loading || m.status === 'active'}>
                    Approve
                  </MenuItem>
                  <MenuItem onClick={() => handleSuspend(m.id)} disabled={loading || m.status === 'inactive'} danger>
                    Deactivate
                  </MenuItem>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create mosque">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={styles.label}>Name *</label>
            <TextInput value={createName} onChange={(e) => setCreateName(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>City</label>
            <TextInput value={createCity} onChange={(e) => setCreateCity(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Country</label>
            <TextInput value={createCountry} onChange={(e) => setCreateCountry(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Cross-mosque local-admin access</label>
            <div style={styles.toggleRow}>
              <Button
                variant={createAllowMultiMosqueLocalAdmins ? 'primary' : 'ghost'}
                onClick={() => setCreateAllowMultiMosqueLocalAdmins(true)}
                type="button"
              >
                Active
              </Button>
              <Button
                variant={!createAllowMultiMosqueLocalAdmins ? 'primary' : 'ghost'}
                onClick={() => setCreateAllowMultiMosqueLocalAdmins(false)}
                type="button"
              >
                Inactive
              </Button>
            </div>
            <div style={styles.helperText}>
              Inactive keeps this mosque&apos;s local admins exclusive to this mosque. Active allows sharing, but only with other mosques that also allow it.
            </div>
          </div>
          {createError ? <div style={styles.errorBanner}>{createError}</div> : null}
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  impersonationBanner: {
    padding: '12px 14px',
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d',
    fontWeight: 700,
  },
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
    padding: '16px',
    fontSize: 14,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  },
  nameCell: {
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
  pageInfo: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 700,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    color: '#0f172a',
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    color: '#475569',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
};
