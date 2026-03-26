import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type AssignmentPayload = {
  userId?: string;
  mosqueId?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getSupabaseEnv():
  | { response: Response }
  | {
      supabaseUrl: string;
      serviceRoleKey: string;
    } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return { response: json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500) };
  }

  if (!serviceRoleKey) {
    return { response: json({ error: 'Server is missing SUPABASE_SERVICE_ROLE.' }, 500) };
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

async function requireMainAdmin(
  request: Request
): Promise<{ response: Response } | { supabaseAdmin: SupabaseClient<any, any, any> }> {
  const env = getSupabaseEnv();
  if ('response' in env) {
    return env;
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return { response: json({ error: 'Missing bearer token.' }, 401) };
  }

  const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { response: json({ error: 'Session is invalid or has expired.' }, 401) };
  }

  const { data: requesterProfile, error: requesterError } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (requesterError || !requesterProfile || requesterProfile.role !== 'main_admin') {
    return { response: json({ error: 'Only main admin users can manage local-admin assignments.' }, 403) };
  }

  return { supabaseAdmin };
}

async function parsePayload(request: Request): Promise<{ response: Response } | { userId: string; mosqueId: string }> {
  let body: AssignmentPayload;
  try {
    body = (await request.json()) as AssignmentPayload;
  } catch {
    return { response: json({ error: 'Invalid JSON body.' }, 400) };
  }

  const userId = body.userId?.trim() || '';
  const mosqueId = body.mosqueId?.trim() || '';

  if (!userId) {
    return { response: json({ error: 'A userId is required.' }, 400) };
  }

  if (!mosqueId) {
    return { response: json({ error: 'A mosqueId is required.' }, 400) };
  }

  return { userId, mosqueId };
}

export const POST: RequestHandler = async (request) => {
  const auth = await requireMainAdmin(request);
  if ('response' in auth) {
    return auth.response;
  }

  const payload = await parsePayload(request);
  if ('response' in payload) {
    return payload.response;
  }

  const { supabaseAdmin } = auth;
  const { userId, mosqueId } = payload;

  const { error } = await (supabaseAdmin as SupabaseClient<any, any, any>)
    .from('mosque_admins')
    .insert({ user_id: userId, mosque_id: mosqueId });

  if (error) {
    const message = error.message || 'Unable to assign this local admin.';
    return json({ error: message }, error.code === '23505' || error.code === 'P0001' ? 409 : 500);
  }

  return json({ userId, mosqueId, assigned: true });
};

export const DELETE: RequestHandler = async (request) => {
  const auth = await requireMainAdmin(request);
  if ('response' in auth) {
    return auth.response;
  }

  const payload = await parsePayload(request);
  if ('response' in payload) {
    return payload.response;
  }

  const { supabaseAdmin } = auth;
  const { userId, mosqueId } = payload;

  const { data, error } = await (supabaseAdmin as SupabaseClient<any, any, any>)
    .from('mosque_admins')
    .delete()
    .eq('user_id', userId)
    .eq('mosque_id', mosqueId)
    .select('user_id, mosque_id');

  if (error) {
    return json({ error: error.message || 'Unable to remove this local admin assignment.' }, 500);
  }

  if (!data || data.length === 0) {
    return json({ error: 'This local-admin assignment no longer exists.' }, 404);
  }

  return json({ userId, mosqueId, removed: true });
};
