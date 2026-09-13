import { createClient } from 'npm:@supabase/supabase-js@2';

const ELM_BASE_URL = 'https://www.londonprayertimes.com/api/times/';
const DAYS_BACK = 7;
const DAYS_AHEAD = 60;

const TIME_FIELDS = [
  'fajr', 'fajr_jamat', 'sunrise',
  'dhuhr', 'dhuhr_jamat',
  'asr', 'asr_2', 'asr_jamat',
  'magrib', 'magrib_jamat',
  'isha', 'isha_jamat',
] as const;

function addDays(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function normalizeTime(value: unknown, field: string, dateIso: string): string | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  if ((field === 'dhuhr' || field === 'dhuhr_jamat') && h > 16) {
    console.warn(`[fetch-elm-timetable] Ignoring invalid ${field} "${value}" for ${dateIso}`);
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

Deno.serve(async (_req) => {
  const apiKey = Deno.env.get('LPT_API_KEY');
  if (!apiKey) {
    console.error('[fetch-elm-timetable] LPT_API_KEY secret is not set');
    return new Response(JSON.stringify({ error: 'LPT_API_KEY not configured' }), { status: 500 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Supabase credentials missing' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const today = new Date().toISOString().slice(0, 10);
  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = -DAYS_BACK; i < DAYS_AHEAD; i++) {
    const dateIso = addDays(today, i);
    try {
      const url = `${ELM_BASE_URL}?format=json&key=${apiKey}&date=${dateIso}&24hours=true`;
      const resp = await fetch(url);
      if (!resp.ok) {
        errors.push(`${dateIso}: HTTP ${resp.status}`);
        continue;
      }
      const json = await resp.json().catch(() => null);
      if (!json || typeof json !== 'object') {
        errors.push(`${dateIso}: invalid JSON`);
        continue;
      }
      const raw = json as Record<string, unknown>;
      const row: Record<string, unknown> = { date: dateIso, fetched_at: new Date().toISOString() };
      for (const field of TIME_FIELDS) {
        row[field] = normalizeTime(raw[field], field, dateIso);
      }
      rows.push(row);
    } catch (err) {
      errors.push(`${dateIso}: ${err}`);
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('elm_timetable')
      .upsert(rows, { onConflict: 'date' });
    if (error) {
      console.error('[fetch-elm-timetable] upsert error:', error.message);
      return new Response(JSON.stringify({ error: error.message, fetched: rows.length }), { status: 500 });
    }
  }

  console.log(`[fetch-elm-timetable] upserted ${rows.length} rows, ${errors.length} errors`);
  return new Response(
    JSON.stringify({ upserted: rows.length, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
