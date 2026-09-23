const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE are required.');
}

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(parsedUrl.hostname)) {
  throw new Error('SUPABASE_URL is not a hosted Supabase project URL.');
}

const configResponse = await fetch(
  `${supabaseUrl}/rest/v1/notification_dispatch_config?singleton=eq.true&select=shared_secret`,
  {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
    },
  },
);

if (!configResponse.ok) {
  throw new Error(`Unable to read dispatcher configuration (${configResponse.status}).`);
}

const rows = await configResponse.json();
const sharedSecret = rows?.[0]?.shared_secret;
if (typeof sharedSecret !== 'string' || sharedSecret.length < 32) {
  throw new Error('The dispatcher shared secret is missing or invalid.');
}

const configureResponse = await fetch(`${supabaseUrl}/functions/v1/push-dispatch`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': sharedSecret,
  },
  body: JSON.stringify({ configureSchedule: true }),
});

const result = await configureResponse.json().catch(() => null);
if (!configureResponse.ok || result?.ok !== true || !Number.isInteger(result?.scheduleJobId)) {
  throw new Error(
    `Unable to configure dispatcher schedule (${configureResponse.status}): ${result?.error ?? 'unknown response'}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  appVariant: result.appVariant,
  scheduleJobId: result.scheduleJobId,
  dispatcherResponded: true,
}, null, 2));
