const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_STAGING_REF = 'zhrucqghrqkjyzmupdyy';

function parseEnvFile(filePath) {
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env.local. Pull the EAS preview environment before running this test.');
  }

  const env = parseEnvFile(envPath);
  const supabaseUrl = env.SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !anonKey || !serviceRole) {
    throw new Error('Missing staging Supabase URL, anonymous key, or service role in .env.local.');
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  if (projectRef !== EXPECTED_STAGING_REF) {
    throw new Error(`Refusing to run outside staging. Resolved project ref: ${projectRef || 'unknown'}.`);
  }

  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const email = `delivered+adhanconnect-${runId}@resend.dev`;
  const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
  const consentedAt = new Date().toISOString();
  let createdUserId = null;
  let signupStatus = null;
  let signupCode = null;
  let signupMessage = null;
  let cleanupStatus = 'not-needed';

  try {
    const signup = await fetch(
      `${supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent('http://localhost:8082/callback')}`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          data: {
            display_name: 'Email delivery smoke test',
            terms_version: '2026-07-24',
            terms_accepted_at: consentedAt,
            privacy_version: '2026-07-24',
            privacy_acknowledged_at: consentedAt,
            special_category_consent_version: '2026-07-24',
            special_category_consent_at: consentedAt,
            special_category_consent_withdrawn_at: null,
            age_gate_version: '2026-07-24',
            age_16_or_over_confirmed_at: consentedAt,
            consent_source: 'email_signup',
          },
        }),
      }
    );

    signupStatus = signup.status;
    const payload = await signup.json().catch(() => ({}));
    createdUserId = payload?.user?.id ?? payload?.id ?? null;
    signupCode = payload?.code ?? payload?.error_code ?? null;
    signupMessage = payload?.msg ?? payload?.message ?? payload?.error_description ?? null;
  } finally {
    if (!createdUserId) {
      const usersResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
      });
      if (usersResponse.ok) {
        const usersPayload = await usersResponse.json();
        const users = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
        createdUserId = users.find((user) => user?.email?.toLowerCase() === email)?.id ?? null;
      }
    }

    if (createdUserId) {
      const cleanup = await fetch(`${supabaseUrl}/auth/v1/admin/users/${createdUserId}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
      });
      cleanupStatus = cleanup.ok ? 'deleted' : `failed-http-${cleanup.status}`;
    }
  }

  console.log(JSON.stringify({
    project_ref: projectRef,
    recipient: 'Resend delivered test address (labelled)',
    signup_http_status: signupStatus,
    signup_error_code: signupCode,
    signup_error_message: signupMessage,
    verification_required: signupStatus === 200,
    test_user_cleanup: cleanupStatus,
  }, null, 2));

  if (signupStatus !== 200 || cleanupStatus.startsWith('failed-')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Email smoke test failed.');
  process.exitCode = 1;
});
