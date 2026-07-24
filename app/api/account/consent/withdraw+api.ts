import type { RequestHandler } from 'expo-router/server';
import {
  privateJson,
  requireAuthenticatedAccount,
} from '@/lib/server/accountAccess';
import { consumeAccountRateLimit } from '@/lib/server/accountRateLimit';

export const POST: RequestHandler = async (request) => {
  const access = await requireAuthenticatedAccount(request);
  if ('response' in access) return access.response;

  const { context } = access;
  const rateLimit = await consumeAccountRateLimit({
    action: 'consent',
    limit: 5,
    request,
    requireDurable: true,
    supabaseAdmin: context.supabaseAdmin,
    userId: context.userId,
    windowSeconds: 24 * 60 * 60,
  });
  if (!rateLimit.allowed) {
    return privateJson(
      {
        error: rateLimit.unavailable
          ? 'Consent controls are unavailable until their durable safety migration is deployed.'
          : 'Too many consent changes were requested. Please wait and try again.',
        code: rateLimit.unavailable ? 'CONSENT_CONTROL_NOT_READY' : 'RATE_LIMITED',
      },
      rateLimit.unavailable ? 503 : 429,
      {
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        requestId: context.requestId,
      }
    );
  }

  const { data, error } = await context.supabaseAdmin.rpc(
    'withdraw_account_special_category_consent_v1',
    { p_user_id: context.userId }
  );
  if (error || typeof data !== 'string') {
    return privateJson(
      {
        error: 'Consent could not be withdrawn safely. No success was recorded.',
        code: 'CONSENT_WITHDRAWAL_FAILED',
      },
      503,
      { requestId: context.requestId }
    );
  }

  let refreshSessionsRevoked = false;
  try {
    const { error: sessionRevocationError } =
      await context.supabaseAdmin.auth.admin.signOut(
        context.accessToken,
        'global'
      );
    refreshSessionsRevoked = !sessionRevocationError;
  } catch {
    // Withdrawal is already durable. Server-gated account features are blocked
    // even if refresh-session revocation must be retried operationally. Direct
    // Supabase access still depends on the separately audited RLS rollout.
  }

  return privateJson(
    {
      withdrawn: true,
      withdrawnAt: data,
      accountFeaturesRestricted: true,
      localSignOutRequired: true,
      refreshSessionsRevoked,
    },
    200,
    { requestId: context.requestId }
  );
};
