import { load } from '@expo/env';
import { createClient } from '@supabase/supabase-js';

load(process.cwd(), { silent: true });

const EXPECTED_STAGING_REF = 'zhrucqghrqkjyzmupdyy';
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRole) throw new Error('Missing staging Supabase environment variables.');

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (projectRef !== EXPECTED_STAGING_REF) {
  throw new Error(`Refusing dispatcher smoke test for non-staging project ${projectRef}.`);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: config, error: configError } = await supabase
  .from('notification_dispatch_config')
  .select('shared_secret')
  .eq('singleton', true)
  .single();
if (configError || typeof config?.shared_secret !== 'string') {
  throw new Error(`Unable to read staging dispatcher authorization: ${configError?.message ?? 'missing secret'}`);
}

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
let response;
try {
  response = await fetch(`${supabaseUrl}/functions/v1/push-dispatch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      'x-cron-secret': config.shared_secret,
    },
    body: JSON.stringify({ source: 'staging_smoke_test' }),
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}

const payload = await response.json().catch(() => null);
if (!response.ok || payload?.ok !== true || payload?.appVariant !== 'staging') {
  throw new Error(`Staging dispatcher failed (${response.status}): ${payload?.error ?? 'invalid response'}`);
}

console.log(JSON.stringify({
  ok: true,
  projectRef,
  appVariant: payload.appVariant,
  remindersCreated: Number(payload.remindersCreated ?? 0),
  deliveriesCreated: Number(payload.deliveriesCreated ?? 0),
  claimed: Number(payload.claimed ?? 0),
  ticketsUpdated: Number(payload.ticketsUpdated ?? 0),
  receiptsUpdated: Number(payload.receiptsUpdated ?? 0),
}, null, 2));
