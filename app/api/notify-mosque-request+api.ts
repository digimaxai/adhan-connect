import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type RequestBody = {
  created_at: string;
  request_type: string;
  mosque_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_website?: string | null;
  contact_phone?: string | null;
  submitter_role_at_mosque?: string | null;
  area_description?: string | null;
  note?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestTypeLabel(type: string): string {
  if (type === 'mosque_admin_self') return 'Self-registration (mosque staff)';
  if (type === 'invite_known_mosque') return 'Listener invite';
  return 'Add request';
}

function badgeStyle(type: string): { bg: string; color: string } {
  if (type === 'mosque_admin_self') return { bg: '#dcfce7', color: '#15803d' };
  if (type === 'invite_known_mosque') return { bg: '#dbeafe', color: '#1d4ed8' };
  return { bg: '#f1f5f9', color: '#475569' };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmailHtml(body: RequestBody, adminUrl: string): string {
  const label = requestTypeLabel(body.request_type);
  const badge = badgeStyle(body.request_type);
  const isSelfReg = body.request_type === 'mosque_admin_self';

  const fields: [string, string | null | undefined][] = [
    ['Mosque name', body.mosque_name],
    ['City / area', body.area_description],
    isSelfReg ? ['Their name', body.contact_name] : ['Contact name', body.contact_name],
    isSelfReg ? ['Their role', body.submitter_role_at_mosque] : null,
    isSelfReg ? ['Their email', body.contact_email] : ['Contact email', body.contact_email],
    isSelfReg ? ['Their phone', body.contact_phone] : ['Contact phone', body.contact_phone],
    ['Website', body.contact_website],
    ['Note', body.note],
  ].filter((row): row is [string, string | null | undefined] => row !== null);

  const tableRows = fields
    .filter(([, v]) => v)
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;border-bottom:1px solid #f1f5f9;vertical-align:top;width:130px">${label}</td>
      <td style="padding:10px 14px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1f5f9;word-break:break-word">${escapeHtml(value ?? '')}</td>
    </tr>`
    )
    .join('');

  const priorityNote = isSelfReg
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#166534;font-weight:600">
        ⭐ High-priority lead — this person manages the mosque and is self-registering. Respond within 2 working days.
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New mosque request</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto 48px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,23,42,0.07)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0d9488 0%,#0369a1 100%);padding:28px 32px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.4px;color:rgba(255,255,255,0.6);text-transform:uppercase;margin-bottom:8px">Adhan Connect</div>
      <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.2">New mosque request</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:6px">${new Date(body.created_at).toUTCString()}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">

      <!-- Type badge -->
      <div style="margin-bottom:20px">
        <span style="display:inline-block;padding:5px 14px;border-radius:999px;font-size:12px;font-weight:800;background:${badge.bg};color:${badge.color}">
          ${label}
        </span>
      </div>

      ${priorityNote}

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <tbody>${tableRows}</tbody>
      </table>

      <!-- CTA -->
      <div style="margin-top:28px">
        <a href="${escapeHtml(adminUrl)}"
           style="display:inline-block;padding:13px 24px;background:#0d9488;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:800;letter-spacing:-0.2px">
          Review in admin portal →
        </a>
      </div>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;line-height:1.6">
        Mark the request as <strong>Contacted</strong> once you've reached out. Self-registrations and invites with a contact email can be responded to directly.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const POST: RequestHandler = async (request) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.MOSQUE_REQUEST_NOTIFY_EMAIL;
  const notifyFrom = process.env.MOSQUE_REQUEST_NOTIFY_FROM;
  const adminPortalUrl = process.env.MOSQUE_REQUEST_ADMIN_URL ?? 'https://adhanconnect.com/admin/mosque-requests';

  if (!resendApiKey || !notifyTo || !notifyFrom) {
    // Not configured — skip silently so the form submit still succeeds.
    return json({ skipped: true });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration incomplete.' }, 500);
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ error: 'Session is invalid.' }, 401);
  }

  let payload: { request_id?: unknown } | null;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const requestId = payload?.request_id;
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return json({ error: 'A saved request_id is required.' }, 400);
  }
  const { data: body, error } = await supabaseAdmin.from('mosque_add_requests')
    .select('request_type, mosque_name, contact_name, contact_email, contact_phone, contact_website, submitter_role_at_mosque, area_description, note, created_at')
    .eq('id', requestId).eq('submitted_by', authData.user.id)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .lte('created_at', new Date().toISOString())
    .maybeSingle<RequestBody>();
  if (error) return json({ error: 'Could not load request.' }, 500);
  if (!body) return json({ error: 'Request not found.' }, 404);

  const label = requestTypeLabel(body.request_type);
  const subject = `[Adhan Connect] New ${label}: ${body.mosque_name.trim()}`;
  const html = buildEmailHtml(body, adminPortalUrl);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
        'Idempotency-Key': `mosque-request/${requestId}`,
      },
      body: JSON.stringify({ from: notifyFrom, to: [notifyTo], subject, html }),
    });

    if (!res.ok) {
      console.error('[notify-mosque-request] Resend error:', res.status);
      return json({ error: 'Email delivery failed.' }, 502);
    }
  } catch (err) {
    console.error('[notify-mosque-request] Network error:', err);
    return json({ error: 'Email delivery failed.' }, 502);
  }

  return json({ sent: true });
};
