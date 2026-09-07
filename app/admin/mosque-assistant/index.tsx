'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider } from '../../../lib/admin-web/adminFeedback';
import AdminShell from '../../../components/admin/web/AdminShell';
import { mosqueAssistantRequest as request } from '../../../lib/api/admin/mosqueAssistant';
import { COLUMNS, PROFILE_FIELDS, suggestMapping, safeSourceUrl, validateReview, toCsv, type Extraction, type Review, type ProfileField } from '../../../lib/mosqueAssistant/core';

type Mosque = { id: string; name: string; time_zone: string } & Partial<Record<ProfileField, string | null>>;
type Job = { id: string; mosque_id: string; status: string; month: string; origin?: string; prepared_review?: Review; conversion?: { title: string; status: string; rows: unknown[]; errors: string[] }[]; error?: string; updated_at: string; extraction?: Extraction; approved_review?: Review; import_id?: string; existingRows?: Record<string,string | null>[]; sources?: { url: string; retrieved_at: string; excerpt: string }[] };
const box: React.CSSProperties = { background: '#fff', border: '1px solid #dde7e5', borderRadius: 16, padding: 22, minWidth: 0 };
const button: React.CSSProperties = { border: '1px solid #c8d9d5', borderRadius: 9, background: '#fff', color: '#134e4a', padding: '10px 15px', cursor: 'pointer', fontWeight: 600 };
const primary: React.CSSProperties = { ...button, background: '#0f766e', color: 'white', borderColor: '#0f766e' };
const input: React.CSSProperties = { width: '100%', padding: 9, border: '1px solid #c8d9d5', borderRadius: 7, boxSizing: 'border-box', font: 'inherit' };
const label: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, color: '#405753' };
const names: Record<string,string> = { website: 'Website', address_line1: 'Address', address_line2: 'Address line 2', city: 'City', postcode: 'Postcode', country: 'Country', contact_phone: 'Public phone', contact_email: 'Public email', management_info: 'Management', services_info: 'Services' };
function SourceLink({ url, children }: { url: string; children?: React.ReactNode }) { const safe = safeSourceUrl(url); return safe ? <a href={safe} target="_blank" rel="noopener noreferrer" style={{ color: '#0f766e', overflowWrap: 'anywhere' }}>{children || url} ↗</a> : <span>Invalid source URL</span>; }
export default function MosqueAssistantPage() {
  return <RequireMainAdmin><AdminContextProvider><AdminFeedbackProvider><Workspace /></AdminFeedbackProvider></AdminContextProvider></RequireMainAdmin>;
}
function Workspace() {
  const [mosques, setMosques] = useState<Mosque[]>([]); const [jobs, setJobs] = useState<Job[]>([]);
  const [automation, setAutomation] = useState<{ enabled: boolean; last_checked_at: string | null; last_error: string | null } | null>(null);
  const [counts, setCounts] = useState<Record<string,number>>({}); const [online, setOnline] = useState(false);
  const [page, setPage] = useState(0); const [total, setTotal] = useState(0); const [status, setStatus] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7)); const [website, setWebsite] = useState('');
  const [selected, setSelected] = useState<string[]>([]); const [term, setTerm] = useState('');
  const [job, setJob] = useState<Job | null>(null); const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const data = await request(`?page=${page}&status=${status}`);
    setAutomation(data.automation); setMosques(data.mosques); setJobs(data.jobs); setTotal(data.total); setCounts(data.counts); setOnline(data.workerOnline); setLoaded(true);
  }, [page, status]);
  useEffect(() => { let active = true; let running = false; const load = async () => { if (running) return; running = true; try { if (active) await refresh(); } catch (e) { if (active) setError((e as Error).message); } finally { running = false; } }; void load(); const timer = setInterval(load, 15000); return () => { active = false; clearInterval(timer); }; }, [refresh]);
  async function act(work: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await work(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const currentMosque = mosques.find(m => m.id === job?.mosque_id);
  const validation = useMemo(() => review && job ? validateReview(review, job.month) : null, [review, job]);
  const warnings = [...(job?.extraction?.warnings || []), ...(validation?.warnings || [])];
  function change(patch: Partial<Review>) { setReview(r => r ? { ...r, ...patch, warningsAccepted: false } : r); }
  async function openJob(item: Job) {
    const data = await request(`?id=${item.id}`); const next: Job = data.job; setJob(next);
    const table = next.extraction?.tables[0] || null;
    setReview(next.approved_review || next.prepared_review || { profile: {}, table, mapping: table ? suggestMapping(table.headers) : {}, timeZone: mosques.find(m => m.id === next.mosque_id)?.time_zone || '', websiteConfirmed: false, warningsAccepted: false });
  }
  async function scan(all: boolean) {
    const result = await request('', { action: 'scan', month, mosqueIds: all ? null : selected, website: all ? '' : website });
    setNotice(`${result.queued} mosque scans queued. Mosques already queued or awaiting review were skipped.`); await refresh();
  }
  const visibleMosques = mosques.filter(m => `${m.name} ${m.city || ''} ${m.postcode || ''}`.toLowerCase().includes(term.toLowerCase()));
  const editable = job?.status === 'review';
  return <AdminShell title="Mosque assistant" eyebrow="OWNER ADD-ON" description="Automatic website discovery, mosque information extraction and timetable conversion across your database." mosques={mosques}>
    <div style={{ display: 'grid', gap: 20 }}>
      <div role="status" aria-live="polite" style={{ color: '#405753' }}>{loaded ? (online ? '● Scan worker is online. Queued scans continue when you leave this page.' : '○ Scan worker is offline. Queued scans will start when the worker is running.') : 'Loading mosque assistant…'}</div>
      {error && <div role="alert" style={{ ...box, color: '#991b1b', background: '#fff7f7', whiteSpace: 'pre-wrap' }}>{error}</div>}
      {notice && <div role="status" style={{ ...box, color: '#115e59', background: '#f0fdfa' }}>{notice}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>{['queued','running','review','failed'].map(s => <button key={s} onClick={() => { setStatus(s); setPage(0); }} style={{ ...box, textAlign: 'left', cursor: 'pointer', color: '#134e4a' }}><div style={{ fontSize: 28, fontWeight: 700 }}>{counts[s] || 0}</div><div>{s === 'review' ? 'Awaiting review' : s[0].toUpperCase() + s.slice(1)}</div></button>)}</div>
      <section style={box} aria-label="Automatic discovery">
        <h2 style={{ marginTop: 0 }}>Automatic discovery {automation?.enabled ? 'is enabled' : 'is paused'}</h2>
        <p>The worker checks the mosque database every five minutes. It finds official websites, extracts public details and prayer timetables, and converts schedules into Adhan Connect columns automatically.</p>
        <p>New mosques are picked up automatically. Completed scans are checked weekly; failures retry after a day. Next month’s timetables are checked from the 20th. Your role is to review the prepared results and approve publication.</p>
        <p>{automation?.last_checked_at ? `Last database check: ${new Date(automation.last_checked_at).toLocaleString()}` : 'Waiting for the configured worker to check the database.'}</p>
        {automation?.last_error && <p role="alert">{automation.last_error}</p>}
        <button style={button} disabled={busy || !automation} onClick={() => void act(async () => { await request('', { action: 'automation', enabled: !automation!.enabled }); await refresh(); })}>{automation?.enabled ? 'Pause automatic discovery' : 'Enable automatic discovery'}</button>
      </section>
      <details style={box}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Optional: request an extra scan or correct a website</summary>
      <section aria-label="Start a scan">
        <h2 style={{ marginTop: 0 }}>Discover mosque information</h2>
        <p style={{ color: '#526762' }}>Search official websites for public contact details, management, services and the selected month’s timetable. Results stay in review until you publish.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          <label style={label}>Timetable month<input type="month" value={month} onChange={e => setMonth(e.target.value)} style={input} /></label>
          <label style={label}>Find a mosque<input placeholder="Name, city or postcode" value={term} onChange={e => setTerm(e.target.value)} style={input} /></label>
          <label style={label}>Website override · one mosque<input type="url" placeholder="https://mosque.org" value={website} disabled={selected.length !== 1} onChange={e => setWebsite(e.target.value)} style={input} /></label>
        </div>
        <div style={{ maxHeight: 180, overflow: 'auto', margin: '16px 0', border: '1px solid #e3ebe8', borderRadius: 8 }}>
          {visibleMosques.map(m => <label key={m.id} style={{ display: 'flex', gap: 10, padding: '9px 12px', borderBottom: '1px solid #edf2f0' }}><input type="checkbox" checked={selected.includes(m.id)} onChange={e => { setWebsite(''); setSelected(ids => e.target.checked ? [...ids,m.id] : ids.filter(id => id !== m.id)); }} /><span>{m.name} <small style={{ color: '#60766f' }}>{m.city} {m.postcode}</small></span></label>)}
          {loaded && !visibleMosques.length && <p style={{ padding: 12 }}>No mosques match your search.</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button disabled={busy || !selected.length} style={primary} onClick={() => void act(() => scan(false))}>Scan selected ({selected.length})</button><button disabled={busy || !mosques.length} style={button} onClick={() => void act(() => scan(true))}>Scan all {mosques.length} mosques</button></div>
      </section></details>
      <section style={box} aria-label="Scan history">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}><h2>Scan history</h2><label style={label}>Filter status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} style={input}><option value="">All statuses</option>{['queued','running','review','failed','published','rejected','cancelled'].map(s => <option key={s}>{s}</option>)}</select></label></div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr>{['Mosque','Month','Status','Action'].map(h => <th key={h} style={{ padding: 10 }}>{h}</th>)}</tr></thead><tbody>{jobs.map(j => <tr key={j.id} style={{ borderTop: '1px solid #e3ebe8' }}><td style={{ padding: 10 }}>{mosques.find(m => m.id === j.mosque_id)?.name || 'Mosque'}</td><td>{j.month}</td><td>{j.status}{j.origin === 'automatic' ? ' · automatic' : ''}</td><td><button disabled={busy} style={button} onClick={() => void act(() => openJob(j))}>{j.status === 'review' ? 'Review' : 'Details'}</button></td></tr>)}</tbody></table></div>
        {loaded && !jobs.length && <p>No scans in this view. Start a scan above.</p>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}><button style={button} disabled={!page || busy} onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page+1} · {total} scans</span><button style={button} disabled={(page+1)*50 >= total || busy} onClick={() => setPage(p => p+1)}>Next</button></div>
      </section>
      {job && review && <section style={box} aria-label="Review extracted information">
        <h2 style={{ marginTop: 0 }}>{currentMosque?.name} · {job.month}</h2><p>Status: {job.status}{job.origin === 'automatic' ? ' · discovered automatically' : ''}</p>
        {!!job.conversion?.length && <div style={{ background: '#f0fdfa', padding: 14, borderRadius: 10 }}><strong>Automatic conversion results</strong>{job.conversion.map((c,i) => <p key={i}>{c.title || 'Timetable'}: {c.status === 'converted' ? `${c.rows.length} dates converted` : `needs attention — ${c.errors.join(' ')}`}</p>)}{job.conversion.length > 1 && <p>Multiple timetable variants were converted separately. Select the appropriate schedule below.</p>}</div>}
        {job.error && <p role="alert" style={{ color: '#991b1b' }}>{job.error}</p>}
        {['queued','running'].includes(job.status) && <button disabled={busy} style={button} onClick={() => void act(async () => { await request('', { action: 'cancel', id: job.id }); setJob(null); await refresh(); })}>Cancel scan</button>}
        {job.extraction && <>
          <p>{job.extraction.match_reason}</p>{job.extraction.website && <SourceLink url={job.extraction.website}>Candidate website</SourceLink>}
          <fieldset disabled={!editable || busy} style={{ border: 0, padding: 0, margin: '18px 0', minWidth: 0 }}>
            <label style={{ display: 'flex', gap: 9 }}><input type="checkbox" checked={review.websiteConfirmed} onChange={e => change({ websiteConfirmed: e.target.checked })} />I checked the name and address and confirm these sources belong to this mosque.</label>
            <h3>Profile changes</h3><p>Select the fields to publish. Unselected fields stay unchanged.</p>
            <div style={{ display: 'grid', gap: 14 }}>{PROFILE_FIELDS.map(field => {
              const found = job.extraction?.fields.find(f => f.field === field); if (!found) return null;
              const chosen = review.profile[field];
              return <div key={field} style={{ border: '1px solid #e3ebe8', padding: 14, borderRadius: 10 }}>
                <label style={{ display: 'flex', gap: 9, fontWeight: 600 }}><input type="checkbox" checked={!!chosen} onChange={e => { const profile = { ...review.profile }; if (e.target.checked) profile[field] = { value: found.value, source_url: found.source_url, evidence: found.evidence }; else delete profile[field]; change({ profile }); }} />{names[field]}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginTop: 10 }}><div><small>Current</small><p style={{ whiteSpace: 'pre-wrap' }}>{currentMosque?.[field] || 'Not recorded'}</p></div><label style={label}>Proposed<textarea aria-label={`Proposed ${names[field]}`} rows={field.endsWith('_info') ? 4 : 2} disabled={!chosen} value={chosen?.value ?? found.value} onChange={e => change({ profile: { ...review.profile, [field]: { ...chosen!, value: e.target.value } } })} style={input} /></label></div>
                <small><SourceLink url={found.source_url}>Source</SourceLink> · {found.evidence}</small>
              </div>;
            })}</div>
            {!job.extraction.fields.length && <p>No supported profile information was extracted.</p>}
            <h3>Prayer timetable</h3>
            <label style={label}>Choose a source schedule<select style={input} value={review.table ? String(job.extraction.tables.findIndex(t => t.source_url === review.table?.source_url && t.title === review.table?.title)) : ''} onChange={e => { const table = e.target.value === '' ? null : job.extraction!.tables[Number(e.target.value)]; change({ table, mapping: table ? suggestMapping(table.headers) : {} }); }}><option value="">Do not publish a timetable</option>{job.extraction.tables.map((t,i) => <option key={i} value={i}>{t.title || 'Timetable'} · {t.source_url}</option>)}</select></label>
            {review.table && <>
              <div style={{ margin: '14px 0' }}><SourceLink url={review.table.source_url}>Open original timetable</SourceLink></div>
              <label style={label}>Configured mosque timezone · change this in the mosque workspace if needed<input style={{ ...input, maxWidth: 360 }} value={review.timeZone} readOnly /></label>
              <p>Map beginning/adhan separately from jamaat/iqama. Choose “Ignore” for optional columns you do not need. Missing iqama values preserve any existing iqama times. Correct ambiguous afternoon times using 24-hour values or an explicit PM suffix.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>{COLUMNS.map(c => <label key={c} style={label}>{c}<select style={input} value={review.mapping[c] ?? -1} onChange={e => change({ mapping: { ...review.mapping, [c]: Number(e.target.value) } })}><option value={-1}>Ignore / not provided</option>{review.table!.headers.map((h,i) => <option key={i} value={i}>{i+1}. {h}</option>)}</select></label>)}</div>
              <details style={{ marginTop: 18 }} open><summary>Edit extracted source rows</summary><div style={{ overflow: 'auto', maxHeight: 450, marginTop: 12 }}><table style={{ borderCollapse: 'collapse' }}><thead><tr>{review.table.headers.map((h,i) => <th key={i} style={{ textAlign: 'left', padding: 8 }}>{h}</th>)}<th>Remove</th></tr></thead><tbody>{review.table.rows.map((row,ri) => <tr key={ri}>{review.table!.headers.map((h,ci) => <td key={ci}><input aria-label={`Row ${ri+1} ${h}`} style={{ ...input, minWidth: 100 }} value={row[ci] || ''} onChange={e => { const rows = review.table!.rows.map(r => [...r]); rows[ri][ci] = e.target.value; change({ table: { ...review.table!, rows } }); }} /></td>)}<td><button style={button} onClick={() => change({ table: { ...review.table!, rows: review.table!.rows.filter((_,i) => i !== ri) } })}>Remove {ri+1}</button></td></tr>)}</tbody></table></div></details>
              <button style={{ ...button, marginTop: 12 }} disabled={review.table.rows.length >= 31} onClick={() => change({ table: { ...review.table!, rows: [...review.table!.rows, review.table!.headers.map(() => '')] } })}>Add date row</button>
              <details style={{ marginTop: 16 }}><summary>Existing timetable at scan time · {job.existingRows?.length || 0} dates</summary><p>Published rows replace beginning times on matching dates. Blank iqama values preserve existing iqama times. Dates outside the preview stay unchanged.</p><div style={{ overflow: 'auto', maxHeight: 250 }}><table><thead><tr><th>Date</th>{COLUMNS.slice(1).map(c => <th key={c} style={{ padding: 8 }}>{c}</th>)}</tr></thead><tbody>{job.existingRows?.map(row => <tr key={row.date}><td>{row.date}</td>{COLUMNS.slice(1).map(c => { const field = c.endsWith('_iqama') ? `${c}_time` : `${c}_adhan_time`; let value = row[field] || '—'; try { if (row[field]) value = new Intl.DateTimeFormat('en-GB', { timeZone: review.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(row[field]!)); } catch { /* Keep the stored timestamp if the timezone is invalid. */ } return <td key={c} style={{ padding: 8 }}>{value}</td>; })}</tr>)}</tbody></table></div></details>
              <h4>Adhan Connect preview · {validation?.rows.length || 0} dates</h4><div style={{ maxHeight: 280, overflow: 'auto', background: '#f4f8f6', padding: 12 }}><pre style={{ fontSize: 12 }}>{toCsv(validation?.rows || [])}</pre></div>
            </>}
            {!!validation?.errors.length && <div style={{ color: '#991b1b', marginTop: 16 }}><strong>Before publishing</strong><ul>{validation.errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
            {!!warnings.length && <div style={{ background: '#fffbeb', padding: 16, marginTop: 16, borderRadius: 10 }}><strong>Review notes</strong><ul>{warnings.map((w,i) => <li key={i}>{w}</li>)}</ul><label style={{ display: 'flex', gap: 9 }}><input type="checkbox" checked={review.warningsAccepted} onChange={e => setReview({ ...review, warningsAccepted: e.target.checked })} />I reviewed these notes and verified the proposed changes against the sources.</label></div>}
          </fieldset>
          <details style={{ margin: '16px 0' }}><summary>Source evidence and retrieval dates</summary>{job.sources?.map(s => <div key={s.url} style={{ margin: '14px 0' }}><SourceLink url={s.url} /><small> · Retrieved {new Date(s.retrieved_at).toLocaleString()}</small>{s.excerpt && <p style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>{s.excerpt}</p>}</div>)}</details>
        </>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {editable && <><button style={button} disabled={busy} onClick={() => void act(async () => { await request('', { action: 'save', id: job.id, review }); setNotice('Review draft saved.'); })}>Save review</button><button style={primary} disabled={busy || !!validation?.errors.length || (!!warnings.length && !review.warningsAccepted)} onClick={() => void act(async () => { await request('', { action: 'publish', id: job.id, review }); setNotice('Approved changes published. Prayer times are recorded in import history.'); await openJob(job); await refresh(); })}>Publish approved changes</button></>}
          {review.table && <button style={button} disabled={!!validation?.errors.length} onClick={() => { const blob = new Blob([toCsv(validation?.rows || [])], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mosque-${job.mosque_id}-${job.month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download CSV</button>}
          {['review','failed'].includes(job.status) && <button style={button} disabled={busy} onClick={() => void act(async () => { await request('', { action: 'reject', id: job.id }); setJob(null); await refresh(); setNotice('Scan dismissed. You can select the mosque and scan again.'); })}>Dismiss scan</button>}
          <Link href={`/admin/mosques/${job.mosque_id}/prayer-times` as any} style={{ color: '#0f766e', padding: 10 }}>Prayer times & import history →</Link>
        </div>
      </section>}
    </div>
  </AdminShell>;
}
