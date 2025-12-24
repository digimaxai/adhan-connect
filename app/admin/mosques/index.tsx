'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../components/RequireMainAdmin';
import { AdminContextProvider, useAdminContext } from '../lib/adminContext';
import AdminTopBar, { MosqueOption } from '../components/AdminTopBar';
import AdminSidebar from '../components/AdminSidebar';
import { Button, Card, Menu, MenuItem, Modal, Pill, Select, TextInput } from '../components/ui';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const PAGE_SIZE = 20;

export default function MosquesPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <MosquesShell />
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function MosquesShell() {
  const router = useRouter();
  const { setSelectedMosqueId, isMosqueMode, selectedMosqueId } = useAdminContext();

  const [mosques, setMosques] = useState<MosqueRow[]>([]);
  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>(
    'all'
  );
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name_asc'>('newest');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createCountry, setCreateCountry] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Selector fetch once
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

  // List fetch
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
          .select('id, name, city, country, status, created_at', { count: 'exact' });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        if (debouncedSearch) {
          const term = debouncedSearch;
          query = query.or(
            `name.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`
          );
        }

        if (sort === 'newest') query = query.order('created_at', { ascending: false, nullsLast: true });
        if (sort === 'oldest') query = query.order('created_at', { ascending: true, nullsLast: true });
        if (sort === 'name_asc') query = query.order('name', { ascending: true, nullsLast: true });

        const { data, error, count } = await query.range(from, to);

        if (error) {
          console.error('mosques list error', error);
          if (!cancelled) setErrorBanner('Unable to load mosques. Check console logs.');
        } else if (!cancelled) {
          setMosques(data ?? []);
          setTotalCount(count ?? 0);
        }
      } catch (e) {
        console.error('mosques list exception', e);
        if (!cancelled) setErrorBanner('Unable to load mosques. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, sort, statusFilter]);

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

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', id);
      if (error) {
        console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
          action: 'approve',
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          mosque_id: id,
          timestamp: new Date().toISOString(),
        });
        setErrorBanner(
          error.code
            ? `Action failed (code: ${error.code}). Check console logs.`
            : 'Action failed. Check console logs.'
        );
      } else {
        console.log('[ADMIN_ACTION]', {
          action: 'approve_mosque',
          mosque_id: id,
          timestamp: new Date().toISOString(),
        });
        setMosques((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'active' } : m)));
      }
    } catch (e) {
      console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
        action: 'approve',
        message: (e as any)?.message,
        code: (e as any)?.code,
        details: (e as any)?.details,
        hint: (e as any)?.hint,
        mosque_id: id,
        timestamp: new Date().toISOString(),
      });
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const handleSuspend = async (id: string) => {
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm('Deactivate this mosque?')
        : true;
    if (!confirmed) return;
    console.log('[ADMIN_ACTION]', {
      action: 'set_mosque_status',
      to_status: 'inactive',
      mosque_id: id,
      timestamp: new Date().toISOString(),
    });

    try {
      const { error } = await supabase.from('mosques').update({ status: 'inactive' }).eq('id', id);
      if (error) {
        console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
          action: 'suspend',
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          mosque_id: id,
          timestamp: new Date().toISOString(),
        });
        setErrorBanner(
          error.code
            ? `Action failed (code: ${error.code}). Check console logs.`
            : 'Action failed. Check console logs.'
        );
      } else {
        setMosques((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'inactive' } : m)));
      }
    } catch (e) {
      console.error('[ADMIN_MOSQUE_STATUS_ERROR]', {
        action: 'suspend',
        message: (e as any)?.message,
        code: (e as any)?.code,
        details: (e as any)?.details,
        hint: (e as any)?.hint,
        mosque_id: id,
        timestamp: new Date().toISOString(),
      });
      setErrorBanner('Action failed. Check console logs.');
    }
  };

  const handleEnterContext = (id: string) => {
    console.log('[ADMIN_ACTION]', {
      action: 'enter_mosque_context',
      mosque_id: id,
      timestamp: new Date().toISOString(),
    });
    setSelectedMosqueId(id);
  };

  const handleCreate = async () => {
    setSuccessBanner(null);
    setCreateError(null);
    const trimmed = createName.trim();
    if (trimmed.length < 2) {
      setCreateError('Name must be at least 2 characters.');
      return;
    }
    const payload: Record<string, any> = {
      name: trimmed,
      status: 'pending',
    };
    const city = createCity.trim();
    const country = createCountry.trim();
    if (city) payload.city = city;
    if (country) payload.country = country;
    try {
      setCreating(true);
      const { error } = await supabase.from('mosques').insert(payload);
      if (error) {
        console.error('[ADMIN_CREATE_MOSQUE_ERROR]', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          payload,
          timestamp: new Date().toISOString(),
        });
        setCreateError(
          error.code
            ? `Create failed (code: ${error.code}). Check console logs.`
            : 'Create failed. Check console logs.'
        );
      } else {
        setCreateOpen(false);
        setCreateName('');
        setCreateCity('');
        setCreateCountry('');
        setSuccessBanner('Mosque created (pending).');
        setPage(0);
      }
    } catch (e: any) {
      console.error('[ADMIN_CREATE_MOSQUE_ERROR]', {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        payload,
        timestamp: new Date().toISOString(),
      });
      setCreateError('Create failed. Check console logs.');
    } finally {
      setCreating(false);
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
          {isMosqueMode ? (
            <div style={styles.impersonationBanner}>
              ⚠️ Impersonation Mode — Actions affect this mosque only
            </div>
          ) : null}
          {successBanner ? <div style={styles.successBanner}>{successBanner}</div> : null}
          {errorBanner ? <div style={styles.errorBanner}>{errorBanner}</div> : null}

          <div style={styles.headerRow}>
            <h1 style={styles.pageTitle}>Mosques</h1>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create mosque
            </Button>
          </div>

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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
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
                  setSort(e.target.value as any);
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

          <Card>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>City</th>
                  <th style={styles.th}>Country</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th} />
                </tr>
              </thead>
              <tbody>
                {mosques.map((m) => (
                  <tr key={m.id}>
                    <td style={styles.td}>{m.name}</td>
                    <td style={styles.td}>{m.city ?? '—'}</td>
                    <td style={styles.td}>{m.country ?? '—'}</td>
                    <td style={styles.td}>
                      <Pill status={m.status} />
                    </td>
                    <td style={styles.td}>
                      {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <Menu
                        trigger={
                          <Button variant="ghost" style={{ padding: '8px 10px' }}>
                            ⋯
                          </Button>
                        }
                      >
                        <MenuItem
                          onClick={() => handleApprove(m.id)}
                          disabled={loading || m.status === 'active'}
                        >
                          Approve
                        </MenuItem>
                        <MenuItem
                          onClick={() => handleSuspend(m.id)}
                          disabled={loading || m.status === 'inactive'}
                          danger
                        >
                          Deactivate
                        </MenuItem>
                        <MenuItem
                          onClick={() => handleEnterContext(m.id)}
                          disabled={selectedMosqueId === m.id}
                        >
                          Enter context
                        </MenuItem>
                        <MenuItem onClick={() => router.push(`/admin/mosques/${m.id}`)}>
                          View details
                        </MenuItem>
                      </Menu>
                    </td>
                  </tr>
                ))}
                {!mosques.length && (
                  <tr>
                    <td style={styles.td} colSpan={6}>
                      {loading ? 'Loading…' : 'No mosques found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <div style={styles.pagination}>
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
      </main>

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
          {createError ? <div style={styles.errorBanner}>{createError}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
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
  impersonationBanner: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#fef9c3',
    color: '#854d0e',
    border: '1px solid #facc15',
    fontWeight: 700,
    marginBottom: 12,
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
    gap: 10,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  toolbar: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
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
  },
  pagination: {
    marginTop: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
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
};
