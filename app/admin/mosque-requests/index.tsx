'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider, useAdminFeedback } from '../../../lib/admin-web/adminFeedback';
import type { MosqueOption } from '../../../components/admin/web/AdminTopBar';
import AdminShell from '../../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel } from '../../../components/admin/web/AdminPrimitives';
import AdminDataTable from '../../../components/admin/web/AdminDataTable';
import AdminFilterPills from '../../../components/admin/web/AdminFilterPills';
import { Button, Menu, MenuItem, Select } from '../../../components/admin/web/ui';
import { fetchAllMosqueRows } from '../../../lib/api/admin/mosqueDirectory';

type RequestStatus = 'new' | 'contacted' | 'added' | 'declined';
type RequestType = 'invite_known_mosque' | 'request_new_mosque';

type MosqueAddRequestRow = {
  id: string;
  request_type: RequestType;
  status: RequestStatus;
  mosque_name: string;
  area_description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_website: string | null;
  note: string | null;
  submitted_by: string;
  created_at: string;
};

type UserRow = { id: string; email: string; display_name: string | null };
type MosqueRow = { id: string; name: string; city?: string | null; country?: string | null; status?: string | null };

type StatusFilter = 'all' | RequestStatus;
type TypeFilter = 'all' | RequestType;

const PAGE_SIZE = 20;

const REQUEST_TABLE_COLUMNS = [
  { key: 'mosque',    label: 'Mosque',    width: '20%' },
  { key: 'type',      label: 'Type',      width: '14%' },
  { key: 'contact',   label: 'Contact',   width: '22%' },
  { key: 'submitter', label: 'Submitter', width: '16%' },
  { key: 'submitted', label: 'Submitted', width: '12%' },
  { key: 'status',    label: 'Status',    width: '10%' },
  { key: 'actions',   label: 'Actions',   width: '10%', align: 'right' as const },
];

const STATUS_COLORS: Record<RequestStatus, { bg: string; fg: string }> = {
  new: { bg: '#e0f2fe', fg: '#0369a1' },
  contacted: { bg: '#fef9c3', fg: '#854d0e' },
  added: { bg: '#dcfce7', fg: '#166534' },
  declined: { bg: '#f1f5f9', fg: '#475569' },
};

function StatusPill({ status }: { status: RequestStatus }) {
  const config = STATUS_COLORS[status];
  return (
    <span
      style={{
        padding: '4px 9px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: config.bg,
        color: config.fg,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

function requestTypeLabel(type: RequestType) {
  return type === 'invite_known_mosque' ? 'Invite' : 'Request add';
}

export default function MosqueRequestsPage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <MosqueRequestsShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function MosqueRequestsShell() {
  const { notifySuccess, notifyError } = useAdminFeedback();

  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [requests, setRequests] = useState<MosqueAddRequestRow[]>([]);
  const [submitters, setSubmitters] = useState<Record<string, UserRow>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchAllMosqueRows<MosqueRow>(supabase, 'id, name, city, country, status');
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
          .from('mosque_add_requests')
          .select(
            'id, request_type, status, mosque_name, area_description, contact_name, contact_email, contact_phone, contact_website, note, submitted_by, created_at',
            { count: 'exact' }
          )
          .order('created_at', { ascending: false });

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (typeFilter !== 'all') query = query.eq('request_type', typeFilter);

        const { data, error, count } = await query.range(from, to);
        if (error) {
          if (!cancelled) { setRequests([]); setTotalCount(0); setErrorBanner('Unable to load mosque requests. Check console logs.'); }
          return;
        }
        if (cancelled) return;
        const rows = (data ?? []) as MosqueAddRequestRow[];
        setRequests(rows);
        setTotalCount(count ?? 0);

        const submitterIds = Array.from(new Set(rows.map((r) => r.submitted_by).filter(Boolean)));
        if (submitterIds.length) {
          const { data: userRows } = await supabase.from('users').select('id, email, display_name').in('id', submitterIds);
          if (!cancelled && userRows) {
            setSubmitters((prev) => {
              const next = { ...prev };
              (userRows as UserRow[]).forEach((u) => { next[u.id] = u; });
              return next;
            });
          }
        }
      } catch {
        if (!cancelled) setErrorBanner('Unable to load mosque requests. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [page, refreshTick, statusFilter, typeFilter]);

  const mosqueOptions = useMemo<MosqueOption[]>(
    () => mosquesForSelector.map((m) => ({ id: m.id, name: m.name ?? 'Mosque', city: m.city ?? null, country: m.country ?? null, status: m.status ?? null })),
    [mosquesForSelector]
  );

  const newCount = requests.filter((r) => r.status === 'new').length;
  const contactedCount = requests.filter((r) => r.status === 'contacted').length;
  const resolvedCount = requests.filter((r) => r.status === 'added' || r.status === 'declined').length;

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    if (statusFilter !== 'all') filters.push({ key: 'status', label: 'Status', value: statusFilter });
    if (typeFilter !== 'all') filters.push({ key: 'type', label: 'Type', value: requestTypeLabel(typeFilter) });
    return filters;
  }, [statusFilter, typeFilter]);

  const clearFilter = (key: string) => {
    if (key === 'status') setStatusFilter('all');
    if (key === 'type') setTypeFilter('all');
    setPage(0);
  };
  const clearAllFilters = () => { setStatusFilter('all'); setTypeFilter('all'); setPage(0); };

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;
  const rowStart = totalCount ? page * PAGE_SIZE + 1 : 0;
  const rowEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  const triggerRefresh = () => setRefreshTick((v) => v + 1);

  const updateStatus = async (id: string, status: RequestStatus) => {
    const { error } = await supabase
      .from('mosque_add_requests')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { notifyError('Update failed.', 'Check console logs for the Supabase error details.'); return; }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    notifySuccess(`Marked as ${status}.`);
    triggerRefresh();
  };

  return (
    <AdminShell
      title="Mosque requests"
      breadcrumbs={[{ label: 'Dashboard', href: '/admin' }, { label: 'Mosque requests' }]}
      description="Listener-submitted invites and add-requests for mosques not yet on the network."
      mosques={mosqueOptions}
      notices={errorBanner ? <div role="alert" style={styles.errorBanner}>{errorBanner}</div> : null}
    >
      <div style={styles.metricGrid}>
        <AdminMetricCard label="New" value={loading ? '—' : newCount} detail="Awaiting first review" tone={newCount > 0 ? 'warning' : 'success'} />
        <AdminMetricCard label="Contacted" value={loading ? '—' : contactedCount} detail="Follow-up in progress" tone="info" />
        <AdminMetricCard label="Resolved" value={loading ? '—' : resolvedCount} detail="Added or declined" tone="default" />
      </div>

      <AdminPanel
        title="Requests"
        subtitle="Review invites for known mosques and add-requests from listeners, then update their status."
      >
        <div style={styles.toolbar}>
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }}
            style={{ minWidth: 160 }}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="added">Added</option>
            <option value="declined">Declined</option>
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setPage(0); }}
            style={{ minWidth: 160 }}
            aria-label="Filter by request type"
          >
            <option value="all">All types</option>
            <option value="invite_known_mosque">Invite</option>
            <option value="request_new_mosque">Request add</option>
          </Select>
        </div>

        <AdminFilterPills items={activeFilters} onClear={clearFilter} onClearAll={clearAllFilters} />

        <AdminDataTable
          columns={REQUEST_TABLE_COLUMNS}
          loading={loading}
          emptyMessage="No mosque requests match the current view."
          rowCount={requests.length}
          footer={
            <div style={styles.tableFooter}>
              <div style={styles.pageInfo}>
                {rowStart && rowEnd ? `Showing ${rowStart}–${rowEnd} of ${totalCount}` : 'No requests to display'}
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
          {requests.map((r) => {
            const submitter = submitters[r.submitted_by];
            const contactParts = [r.contact_name, r.contact_email, r.contact_phone, r.contact_website].filter(Boolean);
            return (
              <tr key={r.id} className="adm-tr">
                <td style={styles.td}>
                  <div style={styles.nameCell}>
                    <div style={styles.primaryText}>{r.mosque_name}</div>
                    {r.area_description ? <div style={styles.secondaryText}>{r.area_description}</div> : null}
                    {r.note ? <div style={styles.secondaryText}>{r.note}</div> : null}
                  </div>
                </td>
                <td style={styles.td}>{requestTypeLabel(r.request_type)}</td>
                <td style={styles.td}>
                  {contactParts.length ? contactParts.join(' · ') : '—'}
                </td>
                <td style={styles.td}>{submitter?.display_name || submitter?.email || r.submitted_by.slice(0, 8)}</td>
                <td style={styles.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={styles.td}><StatusPill status={r.status} /></td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <Menu
                    trigger={
                      <Button variant="ghost" style={{ padding: '8px 10px' }} aria-label={`Actions for ${r.mosque_name}`}>
                        Actions ▾
                      </Button>
                    }
                  >
                    {r.status !== 'contacted' ? (
                      <MenuItem onClick={() => updateStatus(r.id, 'contacted')} disabled={loading}>
                        Mark contacted
                      </MenuItem>
                    ) : null}
                    {r.status !== 'added' ? (
                      <MenuItem onClick={() => updateStatus(r.id, 'added')} disabled={loading}>
                        Mark added
                      </MenuItem>
                    ) : null}
                    {r.status !== 'declined' ? (
                      <MenuItem onClick={() => updateStatus(r.id, 'declined')} disabled={loading} danger>
                        Decline
                      </MenuItem>
                    ) : null}
                  </Menu>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminPanel>
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
};
