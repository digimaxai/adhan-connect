import { createClient } from '@supabase/supabase-js';
import { prepareExtraction } from '../lib/mosqueAssistant/core.ts';
import { extractMosque } from './mosque-assistant/extract.mjs';

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE || !process.env.OPENAI_API_KEY) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE and OPENAI_API_KEY in the worker environment.');
}
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
const workerId = process.env.MOSQUE_ASSISTANT_WORKER_ID || `worker-${process.pid}`;
async function heartbeat() {
  const { error } = await db.from('mosque_assistant_workers').upsert({ id: workerId, last_seen_at: new Date().toISOString() });
  if (error) console.error('Assistant heartbeat failed:', error.code || 'database error');
}
await heartbeat();
const heartbeatTimer = setInterval(() => { void heartbeat(); }, 30000);
try {
  do {
    try {
      const schedule = await db.rpc('schedule_mosque_assistant');
      if (schedule.error) throw schedule.error;
      if (schedule.data?.queued) console.log(`Automatically queued ${schedule.data.queued} mosque scans.`);
      if (schedule.data?.error) console.error(schedule.data.error);
    } catch (e) { console.error('Automatic discovery scheduling failed:', e.message); }
    const claim = await db.rpc('claim_mosque_assistant');
    if (claim.error) throw new Error(`Unable to claim scan: ${claim.error.message}`);
    const job = claim.data?.[0];
    if (!job) {
      if (process.argv.includes('--once')) break;
      await new Promise(r => setTimeout(r, 5000)); continue;
    }
    console.log(`Processing scan ${job.id} (${job.month}), attempt ${job.attempts}.`);
    // A cancelled or reclaimed scan cannot have its results committed by this worker.
    const persist = async patch => {
      const { error } = await db.from('mosque_assistant_jobs').update({ ...patch, updated_at: new Date().toISOString(), lease_until: null }).eq('id', job.id).eq('status', 'running').eq('lease_token', job.lease_token);
      if (error) throw error;
    };
    const leaseTimer = setInterval(() => {
      void db.from('mosque_assistant_jobs').update({ lease_until: new Date(Date.now() + 15 * 60000).toISOString() }).eq('id', job.id).eq('status', 'running').eq('lease_token', job.lease_token).then(({ error }) => { if (error) console.error('Scan lease renewal failed.'); });
    }, 60000);
    try {
      const mosque = await db.from('mosques').select('id,name,address_line1,city,postcode,country,time_zone').eq('id', job.mosque_id).single();
      if (mosque.error) throw mosque.error;
      const result = await extractMosque(mosque.data, job.month, job.website_hint);
      const prepared = prepareExtraction(result.extraction, job.month, mosque.data.time_zone || 'UTC');
      const hasResults = result.extraction.fields.length > 0 || result.extraction.tables.length > 0;
      await persist({ status: hasResults ? 'review' : 'failed', error: hasResults ? null : 'No usable mosque details or timetable found. Automatic discovery will retry after one day.', ...result, prepared_review: prepared.preparedReview, conversion: prepared.conversions });
    } catch (e) {
      await persist({ status: 'failed', error: String(e.message || 'Scan failed.').slice(0, 1000) });
      console.error(`Scan ${job.id} failed; details are available in the owner workspace.`);
    } finally { clearInterval(leaseTimer); }
    if (process.argv.includes('--once')) break;
  } while (!stopping);
} finally { clearInterval(heartbeatTimer); }
