import type { RequestHandler } from 'expo-router/server';
import { json, requireAdminAccess } from '../../../lib/server/adminAccess';
import { loadBroadcastReadiness } from '../../../lib/server/broadcastReadiness';
import type { BroadcastReadinessPostAction } from '../../../lib/types/broadcastReadiness';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POST_ACTIONS = new Set<BroadcastReadinessPostAction>([
  'provision_stream',
  'confirm_readiness',
  'record_test_passed',
  'mark_live',
  'reset_onboarding',
]);

type PostBody = {
  mosqueId?: string;
  action?: string;
  notes?: string | null;
};

async function requireMainAdmin(request: Request) {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) return auth;
  if (!auth.context.isMainAdmin) {
    return { response: json({ error: 'Only main admin users can manage broadcast onboarding.' }, 403) };
  }
  return auth;
}

function normalizeMosqueId(value: unknown) {
  const mosqueId = typeof value === 'string' ? value.trim() : '';
  return UUID_PATTERN.test(mosqueId) ? mosqueId : null;
}

function rpcErrorStatus(code?: string | null) {
  if (code === '42501') return 403;
  if (code === '22023') return 400;
  return 409;
}

export const GET: RequestHandler = async (request) => {
  const auth = await requireMainAdmin(request);
  if ('response' in auth) return auth.response;

  const url = new URL(request.url);
  const mosqueId = normalizeMosqueId(url.searchParams.get('mosqueId'));
  if (!mosqueId) return json({ error: 'A valid mosqueId query parameter is required.' }, 400);

  try {
    const readiness = await loadBroadcastReadiness(auth.context.supabaseAdmin, mosqueId);
    if (!readiness) return json({ error: 'Mosque not found.' }, 404);
    return json(readiness);
  } catch (error) {
    console.error('[broadcast-readiness] GET failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to load broadcast readiness.' }, 500);
  }
};

export const POST: RequestHandler = async (request) => {
  const auth = await requireMainAdmin(request);
  if ('response' in auth) return auth.response;

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return json({ error: 'The JSON body must be an object.' }, 400);
  }
  const body = parsedBody as PostBody;

  const mosqueId = normalizeMosqueId(body.mosqueId);
  const action = (typeof body.action === 'string' ? body.action.trim() : '') as BroadcastReadinessPostAction;
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;
  if (!mosqueId) return json({ error: 'A valid mosqueId is required.' }, 400);
  if (!POST_ACTIONS.has(action)) return json({ error: 'A valid broadcast onboarding action is required.' }, 400);

  try {
    const before = await loadBroadcastReadiness(auth.context.supabaseAdmin, mosqueId);
    if (!before) return json({ error: 'Mosque not found.' }, 404);

    if (action === 'provision_stream' && before.stream.count === 0 && !before.actions.canProvision) {
      return json({ error: 'Resolve the required setup checks before provisioning the dormant stream.' }, 409);
    }
    if (action === 'confirm_readiness' && !before.actions.canConfirmReadiness) {
      return json({ error: 'Resolve every required readiness check before confirming this mosque.' }, 409);
    }
    if (action === 'record_test_passed' && !before.actions.canRecordTestPassed) {
      return json({ error: 'The mosque must be ready for test and transactional START and END must both be enabled.' }, 409);
    }
    if (action === 'mark_live' && !before.actions.canMarkLive) {
      return json({ error: 'Approve the mosque and record a successful physical test before launch.' }, 409);
    }
    if (action === 'reset_onboarding' && !before.actions.canReset) {
      return json({ error: 'Broadcast onboarding is already at setup pending.' }, 409);
    }

    if (action === 'provision_stream') {
      const { error } = await auth.context.supabaseAdmin.rpc('provision_mosque_live_stream_v1', {
        p_actor_user_id: auth.context.userId,
        p_mosque_id: mosqueId,
      });
      if (error) return json({ error: error.message || 'Unable to provision the stream.' }, rpcErrorStatus(error.code));
    } else {
      const targetStage =
        action === 'confirm_readiness'
          ? 'ready_for_test'
          : action === 'record_test_passed'
            ? 'test_passed'
            : action === 'mark_live'
              ? 'live'
              : 'setup_pending';
      const { error } = await auth.context.supabaseAdmin.rpc('set_mosque_broadcast_onboarding_stage_v1', {
        p_actor_user_id: auth.context.userId,
        p_mosque_id: mosqueId,
        p_stage: targetStage,
        p_notes: notes,
        p_start_transactional: before.rollout.startTransactional,
        p_end_transactional: before.rollout.endTransactional,
      });
      if (error) return json({ error: error.message || 'Unable to update broadcast onboarding.' }, rpcErrorStatus(error.code));
    }

    const readiness = await loadBroadcastReadiness(auth.context.supabaseAdmin, mosqueId);
    if (!readiness) return json({ error: 'Mosque not found after the update.' }, 404);
    return json(readiness);
  } catch (error) {
    console.error('[broadcast-readiness] POST failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to update broadcast onboarding.' }, 500);
  }
};
