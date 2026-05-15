import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';

type DefaultPayload = {
  mosqueId?: string;
  userId?: string | null;
};

async function parsePayload(request: Request): Promise<
  | { response: Response }
  | {
      mosqueId: string;
      userId: string | null;
    }
> {
  let body: DefaultPayload;
  try {
    body = (await request.json()) as DefaultPayload;
  } catch {
    return { response: json({ error: 'Invalid JSON body.' }, 400) };
  }

  const mosqueId = body.mosqueId?.trim() ?? '';
  const userId = typeof body.userId === 'string' ? body.userId.trim() || null : null;

  if (!mosqueId) {
    return { response: json({ error: 'A mosqueId is required.' }, 400) };
  }

  return { mosqueId, userId };
}

export const POST: RequestHandler = async (request) => {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) {
    return auth.response;
  }

  const payload = await parsePayload(request);
  if ('response' in payload) {
    return payload.response;
  }

  const { supabaseAdmin } = auth.context;
  const { mosqueId, userId } = payload;

  if (!hasMosqueAdminAccess(auth.context, mosqueId)) {
    return json({ error: 'You do not have access to this mosque workspace.' }, 403);
  }

  if (userId) {
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('muezzins')
      .select('user_id, is_active')
      .eq('mosque_id', mosqueId)
      .eq('user_id', userId)
      .maybeSingle<{ user_id?: string | null; is_active?: boolean | null }>();

    if (assignmentError && assignmentError.code !== 'PGRST116') {
      return json({ error: assignmentError.message || 'Unable to inspect this muezzin assignment.' }, 500);
    }

    if (!assignment?.user_id || assignment.is_active === false) {
      return json({ error: 'Only an active muezzin for this mosque can be set as the default.' }, 400);
    }
  }

  const { error } = await supabaseAdmin
    .from('mosques')
    .update({ default_muezzin_user_id: userId })
    .eq('id', mosqueId);

  if (error) {
    return json(
      {
        error:
          error.code === '42703'
            ? 'The default muezzin migration has not been applied yet.'
            : error.message || 'Unable to update the default muezzin.',
      },
      500
    );
  }

  return json({ mosqueId, defaultMuezzinUserId: userId });
};
