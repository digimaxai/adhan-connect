import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type SendBody = {
  mosque_id: string;
  body: string;
  sender_type: 'listener' | 'admin';
  listener_id?: string;
};

const RATE_LIMIT = 5;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}


export const POST: RequestHandler = async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration error.' }, 500);

  const authHeader = request.headers.get('authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) return json({ error: 'Missing bearer token.' }, 401);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: 'Invalid or expired session.' }, 401);
  const userId = authData.user.id;

  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body.' }, 400);

  const { mosque_id, body: msgBody, sender_type, listener_id: listenerIdParam } = body;

  if (typeof mosque_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mosque_id)) return json({ error: 'mosque_id is required.' }, 400);
  if (!msgBody || typeof msgBody !== 'string' || msgBody.trim().length < 1 || msgBody.trim().length > 2000) {
    return json({ error: 'Message must be 1 to 2000 characters.' }, 400);
  }
  if (sender_type !== 'listener' && sender_type !== 'admin') return json({ error: 'Invalid sender_type.' }, 400);

  let listenerId: string;

  if (sender_type === 'listener') {
    listenerId = userId;

  } else {
    if (typeof listenerIdParam !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listenerIdParam)) return json({ error: 'listener_id is required for admin replies.' }, 400);
    listenerId = listenerIdParam;
    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from('mosque_admins')
      .select('mosque_id')
      .eq('mosque_id', mosque_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (adminError) return json({ error: 'Could not verify mosque access.' }, 500);
    if (!adminRow) return json({ error: 'Not an admin of this mosque.' }, 403);
  }

  const { data: mosque, error: mosqueError } = await supabaseAdmin
    .from('mosques')
    .select('id, name')
    .eq('id', mosque_id)
    .maybeSingle<{ id: string; name: string }>();
  if (mosqueError) return json({ error: 'Could not load mosque.' }, 500);
  if (!mosque) return json({ error: 'Mosque not found.' }, 404);

  const { data: message, error: insertError } = await supabaseAdmin.rpc('send_mosque_message', {
    p_mosque_id: mosque_id,
    p_listener_id: listenerId,
    p_sender_id: userId,
    p_sender_type: sender_type,
    p_body: msgBody.trim(),
  });
  if (insertError?.code === 'P0429') return json({ error: `You can send up to ${RATE_LIMIT} messages to this mosque per day.` }, 429);
  if (insertError?.code === '42501') return json({ error: 'Not an admin of this mosque.' }, 403);
  if (insertError?.code === 'P0404') return json({ error: 'Listener thread not found.' }, 404);
  if (insertError || !message) return json({ error: 'Failed to send message.' }, 500);

  if (sender_type === 'listener') {
    // Await bounded delivery so serverless runtimes do not discard the request at response time.
    await notifyAdmins(mosque.name, msgBody.trim()).catch(() => {
      console.error('[mosque-messages] Notification delivery failed.');
    });
  }

  return json({ message });
};

async function notifyAdmins(mosqueName: string, msgBody: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.MOSQUE_REQUEST_NOTIFY_EMAIL;
  const fromEmail = process.env.MOSQUE_REQUEST_NOTIFY_FROM;
  if (!apiKey || !notifyEmail || !fromEmail) return;

  const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#0EA5E9,#0369A1);padding:24px;border-radius:12px 12px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:20px;">New Message — ${safe(mosqueName)}</h2>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
      <p style="color:#475569;font-size:14px;">A listener sent a message to <strong>${safe(mosqueName)}</strong>:</p>
      <blockquote style="border-left:3px solid #0EA5E9;margin:16px 0;padding:12px 16px;background:#f0f9ff;color:#0F172A;font-size:15px;border-radius:0 8px 8px 0;">
        ${safe(msgBody)}
      </blockquote>
      <p style="color:#475569;font-size:14px;">Mosque staff can reply from Messages in their mosque dashboard.</p>
    </div>
  </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(5000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: fromEmail,
      to: [notifyEmail],
      subject: `[Adhan Connect] New message for ${mosqueName}`,
      html,
    }),
  });
  if (!response.ok) throw new Error('Notification delivery failed');
}
