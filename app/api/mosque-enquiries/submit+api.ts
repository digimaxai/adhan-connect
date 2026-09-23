import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: RequestHandler = async (request) => {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: 'Sign in to contact your mosque.' }, 401);
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: 'Service unavailable.' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user || auth.user.is_anonymous) return json({ error: 'Sign in to contact your mosque.' }, 401);
  let input: any;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || !uuid(input.id)) return json({ error: 'Invalid request.' }, 400);
  const actor = auth.user.id;
  if (input.action === 'options' || input.action === 'create') {
    if (!uuid(input.mosque_id)) return json({ error: 'Invalid mosque.' }, 400);
    const { data: staff, error: staffError } = await admin.from('mosque_admins').select('user_id').eq('mosque_id', input.mosque_id).limit(1);
    if (staffError) return json({ error: 'Could not check mosque availability.' }, 503);
    if (!staff?.length) return json({ error: 'This mosque is not accepting enquiries in the app yet. Please use its published contact details.' }, 400);
    if (input.action === 'options') {
      const { data: settings, error: settingsError } = await admin.from('mosque_enquiry_settings').select('enabled_categories').eq('mosque_id', input.mosque_id).maybeSingle();
      const { data: defaults, error: defaultsError } = await admin.from('mosque_enquiry_categories').select('id').eq('enabled_by_default', true);
      if (settingsError || defaultsError) return json({ error: 'Could not load contact options.' }, 503);
      return json({ result: { enabled_categories: settings?.enabled_categories ?? (defaults ?? []).map((c) => c.id) } });
    }
  }
  let result;
  if (input.action === 'create') {
    if (!auth.user.email_confirmed_at || !auth.user.email) return json({ error: 'Confirm your account email before submitting an enquiry.' }, 403);
    if (!uuid(input.mosque_id) || typeof input.contact_name !== 'string' || typeof input.category !== 'string' || typeof input.reason !== 'string' || typeof input.details !== 'string' || (input.callback_phone != null && typeof input.callback_phone !== 'string')) return json({ error: 'Check the form fields.' }, 400);
    if (input.callback_phone && (!/^[+()0-9 .-]+$/.test(input.callback_phone) || input.callback_phone.replace(/\D/g, '').length < 7)) return json({ error: 'Enter a valid callback telephone number.' }, 400);
    result = await admin.rpc('create_mosque_enquiry', { p_actor: actor, p_id: input.id, p_mosque: input.mosque_id, p_name: input.contact_name, p_category: input.category, p_reason: input.reason, p_details: input.details, p_phone: input.callback_phone || null });
  } else if (input.action === 'reply') {
    if (!uuid(input.enquiry_id) || typeof input.body !== 'string' || typeof input.as_admin !== 'boolean') return json({ error: 'Invalid reply.' }, 400);
    result = await admin.rpc('reply_mosque_enquiry', { p_actor: actor, p_enquiry: input.enquiry_id, p_id: input.id, p_body: input.body, p_as_admin: input.as_admin });
  } else return json({ error: 'Invalid action.' }, 400);
  if (result.error) {
    const statuses: Record<string, number> = { '42501': 403, '22023': 400, P0429: 429, P0404: 404, '23503': 400, '23514': 400 };
    const status = statuses[result.error.code] ?? 500;
    return json({ error: status === 500 ? 'Could not save your enquiry. Please retry.' : result.error.message }, status);
  }
  const enquiryId = input.action === 'create' ? input.id : input.enquiry_id;
  // Provider idempotency expires; old saved requests must not become a replayable email trigger.
  if (Date.parse(result.data.created_at) < Date.now() - 60 * 60 * 1000) return json({ result: result.data });
  // Contact details and message contents never leave the access-controlled inbox in email alerts.
  try {
    const { data: enquiry } = await admin.from('mosque_enquiries').select('mosque_id, account_id, deleted_by_listener').eq('id', enquiryId).single();
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MOSQUE_REQUEST_NOTIFY_FROM;
    const base = process.env.MOSQUE_REQUEST_ADMIN_URL;
    if (enquiry && !enquiry.deleted_by_listener && apiKey && from && base) {
      const origin = new URL(base).origin;
      const to: string[] = [];
      const isAdminReply = input.action === 'reply' && input.as_admin;
      if (isAdminReply && enquiry.account_id) {
        const { data } = await admin.auth.admin.getUserById(enquiry.account_id);
        if (data.user?.email_confirmed_at && data.user.email) to.push(data.user.email);
      } else {
        const { data: members } = await admin.from('mosque_admins').select('user_id').eq('mosque_id', enquiry.mosque_id);
        for (const member of members ?? []) {
          const { data } = await admin.auth.admin.getUserById(member.user_id);
          if (data.user?.email_confirmed_at && data.user.email) to.push(data.user.email);
        }
      }
      // One recipient per delivery; staff addresses are not exposed to one another.
      await Promise.all([...new Set(to)].map(async (email) => {
        const recipientKey = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)))).map((b) => b.toString(16).padStart(2, '0')).join('');
        const path = isAdminReply ? '/mosque-enquiry' : '/enquiry-detail';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST', signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': `enquiry/${input.id}/${recipientKey}` },
          body: JSON.stringify({ from, to: [email], subject: isAdminReply ? 'Your mosque has replied to your enquiry' : 'A mosque enquiry needs your attention', text: `Sign in to view the enquiry securely:\n${origin}${path}?enquiryId=${enquiryId}\n\nPlease reply in the app; this email inbox is not monitored for replies.` }),
        });
        if (!response.ok) throw new Error('Delivery failed');
      }));
    }
  } catch { console.error('[mosque-enquiries] Notification failed; enquiry was saved.'); }
  return json({ result: result.data });
};
