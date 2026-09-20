import { createClient } from 'npm:@supabase/supabase-js@2';
import { planActiveMosqueDeliveries } from '../../../lib/server/adhanDeliveryPlanner.ts';

const READ_DAILY_TIMEOUT_MS = 10_000;

// app/api/prayer-times-daily+api.ts runs in the Expo/Node server runtime (it
// imports expo-router/server and Node-oriented lib/api modules) and cannot be
// imported directly into this Deno function. Call the same route the way any
// other client does: over real HTTP, against the hosted API deployment. This
// crosses one extra network hop every 15 minutes, not per prayer — cheap, and
// it guarantees the planner sees exactly what listeners/admins see, with zero
// duplicated prayer-time logic.
function readDailyOverHttp(apiBaseUrl: string) {
  return async function readDaily(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = `${apiBaseUrl.replace(/\/$/, '')}/api/prayer-times-daily${url.search}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), READ_DAILY_TIMEOUT_MS);
    try {
      return await fetch(target, { signal: controller.signal });
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Fetch failed.' }), { status: 503 });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
async function isVerifiedServiceRoleJwt(supabase: ReturnType<typeof createClient>, authorization: string) {
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return false;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    return !error && data?.claims?.role === 'service_role';
  } catch { return false; }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY')?.trim() || env('SUPABASE_SERVICE_ROLE_KEY');
    const appVariant = env('APP_VARIANT');
    if (appVariant !== 'staging' && appVariant !== 'production') {
      return json({ error: 'APP_VARIANT must be staging or production.' }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const authorization = request.headers.get('authorization') ?? '';
    const suppliedCronSecret = request.headers.get('x-cron-secret') ?? '';
    const { data: cronSecretValid, error: cronSecretError } = suppliedCronSecret
      ? await supabase.rpc('verify_adhan_delivery_plan_secret_v1', { p_secret: suppliedCronSecret })
      : { data: false, error: null };
    const authorized = authorization === `Bearer ${serviceRoleKey}` ||
      await isVerifiedServiceRoleJwt(supabase, authorization) ||
      (!cronSecretError && cronSecretValid === true);
    if (!authorized) return json({ error: 'Unauthorized.' }, 401);

    const requestPayload = await request.json().catch(() => ({})) as { configureSchedule?: boolean };
    let scheduleJobId: number | null = null;
    if (requestPayload.configureSchedule === true) {
      const { data, error } = await supabase.rpc('configure_adhan_delivery_plan_schedule_v1', {
        p_function_url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/adhan-delivery-plan`,
        p_app_variant: appVariant,
      });
      if (error) throw error;
      scheduleJobId = Number(data);
    }

    const apiBaseUrl = env('ADHAN_DELIVERY_PLAN_API_BASE_URL');
    const outcomes = await planActiveMosqueDeliveries(supabase, readDailyOverHttp(apiBaseUrl));
    const totals = outcomes.reduce((sum, o) => ({
      planned: sum.planned + o.planned, unchanged: sum.unchanged + o.unchanged,
      skipped: sum.skipped + o.skipped, errored: sum.errored + (o.errors.length ? 1 : 0),
    }), { planned: 0, unchanged: 0, skipped: 0, errored: 0 });
    return json({ scheduleJobId, mosques: outcomes.length, ...totals, outcomes });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Planning failed.' }, 500);
  }
});
