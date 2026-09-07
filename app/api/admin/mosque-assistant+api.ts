import type { RequestHandler } from 'expo-router/server';
import { json, requireAdminAccess } from '../../../lib/server/adminAccess';
import { fetchAllMosqueRows } from '../../../lib/api/admin/mosqueDirectory';
import { PRAYERS, PROFILE_FIELDS, safeSourceUrl, validateReview, type Review } from '../../../lib/mosqueAssistant/core';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOB_COLUMNS = 'id,mosque_id,month,origin,status,attempts,error,created_at,updated_at,import_id';
async function owner(request: Request) {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) return auth;
  if (!auth.context.isMainAdmin) return { response: json({ error: 'Only the main admin can use the mosque assistant.' }, 403) };
  return auth;
}
export const GET: RequestHandler = async request => {
  const auth = await owner(request); if ('response' in auth) return auth.response;
  const db = auth.context.supabaseAdmin;
  try {
    const url = new URL(request.url); const id = url.searchParams.get('id');
    if (id) {
      if (!UUID.test(id)) return json({ error: 'Invalid scan ID.' }, 400);
      const { data, error } = await db.from('mosque_assistant_jobs').select(`${JOB_COLUMNS},extraction,sources,approved_review,prepared_review,conversion,prayer_snapshot`).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Scan not found.' }, 404);
      const { prayer_snapshot, ...job } = data;
      const existingRows = Object.values(prayer_snapshot || {}).map((r: any) => Object.fromEntries(['date', ...PRAYERS.flatMap(p => [`${p}_adhan_time`, `${p}_iqama_time`])].map(key => [key, r[key] ?? null])));
      return json({ job: { ...job, existingRows } });
    }
    const page = Math.max(0, Math.min(100000, Number(url.searchParams.get('page')) || 0));
    const status = url.searchParams.get('status');
    let query = db.from('mosque_assistant_jobs').select(JOB_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49);
    if (status && ['queued','running','review','failed','published','rejected','cancelled'].includes(status)) query = query.eq('status', status);
    const [mosques, jobs, workers, counts, automation] = await Promise.all([
      fetchAllMosqueRows(db, `id,name,time_zone,${PROFILE_FIELDS.join(',')}`, { orderBy: 'id' }),
      query,
      db.from('mosque_assistant_workers').select('last_seen_at').order('last_seen_at', { ascending: false }).limit(1),
      Promise.all(['queued','running','review','failed'].map(async s => {
        const r = await db.from('mosque_assistant_jobs').select('id', { count: 'exact', head: true }).eq('status', s);
        if (r.error) throw r.error; return [s, r.count ?? 0];
      })),
      db.from('mosque_assistant_automation').select('enabled,last_checked_at,last_queued,last_error').eq('singleton', true).single(),
    ]);
    if (automation.error) throw automation.error;
    if (mosques.error) throw mosques.error; if (jobs.error) throw jobs.error; if (workers.error) throw workers.error;
    return json({ automation: automation.data, mosques: mosques.data, jobs: jobs.data, total: jobs.count, counts: Object.fromEntries(counts), workerOnline: !!workers.data?.[0] && Date.now() - Date.parse(workers.data[0].last_seen_at) < 120000 });
  } catch (e: any) { return json({ error: e.message || 'Unable to load assistant. Apply the assistant migration first.' }, 500); }
};
function readReview(value: any): Review {
  if (!value || typeof value !== 'object' || !value.profile || typeof value.profile !== 'object' || Array.isArray(value.profile) || !value.mapping || typeof value.mapping !== 'object' || typeof value.timeZone !== 'string' || value.timeZone.length > 100 || typeof value.websiteConfirmed !== 'boolean' || typeof value.warningsAccepted !== 'boolean') throw new Error('Invalid review.');
  if (value.table !== null && (!value.table || typeof value.table.title !== 'string' || typeof value.table.source_url !== 'string' || !Array.isArray(value.table.headers) || value.table.headers.length > 40 || !value.table.headers.every((x: any) => typeof x === 'string' && x.length <= 300) || !Array.isArray(value.table.rows) || value.table.rows.length > 31 || !value.table.rows.every((r: any) => Array.isArray(r) && r.length <= 40 && r.every((x: any) => typeof x === 'string' && x.length <= 300)) || !Array.isArray(value.table.notes) || !value.table.notes.every((x: any) => typeof x === 'string'))) throw new Error('Invalid timetable.');
  return value as Review;
}
export const POST: RequestHandler = async request => {
  const auth = await owner(request); if ('response' in auth) return auth.response;
  const { supabaseAdmin: db, userId } = auth.context;
  try {
    const raw = await request.text(); if (raw.length > 300000) return json({ error: 'Request is too large.' }, 413);
    const body = JSON.parse(raw);
    if (body.action === 'automation') {
      if (typeof body.enabled !== 'boolean') return json({ error: 'Invalid automation setting.' }, 400);
      const { error } = await db.from('mosque_assistant_automation').update({ enabled: body.enabled, last_checked_at: null }).eq('singleton', true);
      if (error) throw error; return json({ ok: true });
    }
    if (body.action === 'scan') {
      if (typeof body.month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month)) return json({ error: 'Choose a valid month.' }, 400);
      if (body.mosqueIds !== null && (!Array.isArray(body.mosqueIds) || !body.mosqueIds.length || body.mosqueIds.length > 10000 || !body.mosqueIds.every((x: any) => typeof x === 'string' && UUID.test(x)))) return json({ error: 'Select valid mosques, or scan all.' }, 400);
      if (body.website && (typeof body.website !== 'string' || !safeSourceUrl(body.website) || body.mosqueIds?.length !== 1)) return json({ error: 'A public HTTPS website override is available for one mosque at a time.' }, 400);
      const { data, error } = await db.rpc('enqueue_mosque_assistant', { p_actor: userId, p_month: body.month, p_ids: body.mosqueIds, p_website: body.website || null });
      if (error) throw error; return json({ queued: data });
    }
    if (typeof body.id !== 'string' || !UUID.test(body.id)) return json({ error: 'Invalid scan ID.' }, 400);
    if (body.action === 'reject' || body.action === 'cancel') {
      const { data, error } = await db.from('mosque_assistant_jobs').update({ status: body.action === 'reject' ? 'rejected' : 'cancelled', reviewed_by: userId, updated_at: new Date().toISOString() }).eq('id', body.id).in('status', body.action === 'reject' ? ['review','failed'] : ['queued','running']).select('id');
      if (error) throw error; return data?.length ? json({ ok: true }) : json({ error: 'Scan state changed; refresh the list.' }, 409);
    }
    if (body.action !== 'publish' && body.action !== 'save') return json({ error: 'Unknown action.' }, 400);
    const review = readReview(body.review);
    const job = await db.from('mosque_assistant_jobs').select('month,status,extraction').eq('id', body.id).maybeSingle();
    if (job.error) throw job.error;
    if (!job.data || job.data.status !== 'review') return json({ error: 'Scan is no longer awaiting review.' }, 409);
    if (body.action === 'save') {
      const { data, error } = await db.from('mosque_assistant_jobs').update({ approved_review: review, updated_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'review').select('id');
      if (error) throw error; return data?.length ? json({ ok: true }) : json({ error: 'Scan state changed.' }, 409);
    }
    const check = validateReview(review, job.data.month);
    if (check.errors.length) return json({ error: check.errors.join('\n') }, 400);
    if ((check.warnings.length || job.data.extraction?.warnings?.length) && !review.warningsAccepted) return json({ error: 'Review and acknowledge the extraction and timetable warnings.' }, 400);
    const { data, error } = await db.rpc('publish_mosque_assistant', { p_actor: userId, p_job: body.id, p_review: review, p_rows: check.rows });
    if (error) return json({ error: error.message }, 409);
    return json({ ok: true, importId: data });
  } catch (e: any) { return json({ error: e.message || 'Unable to process assistant action.' }, 400); }
};
