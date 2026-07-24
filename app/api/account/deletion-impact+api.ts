import type { RequestHandler } from 'expo-router/server';
import { requireAuthenticatedAccount, privateJson } from '@/lib/server/accountAccess';
import { buildDeletionImpact } from '@/lib/server/accountDeletion';
import { consumeAccountRateLimit } from '@/lib/server/accountRateLimit';

export const GET: RequestHandler = async (request) => {
  const access = await requireAuthenticatedAccount(request);
  if ('response' in access) return access.response;

  const { context } = access;
  const rateLimit = await consumeAccountRateLimit({
    action: 'impact',
    limit: 10,
    request,
    supabaseAdmin: context.supabaseAdmin,
    userId: context.userId,
    windowSeconds: 15 * 60,
  });
  if (!rateLimit.allowed) {
    return privateJson(
      {
        error: 'Too many account-impact requests. Please wait and try again.',
        code: 'RATE_LIMITED',
      },
      429,
      {
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        requestId: context.requestId,
      }
    );
  }

  try {
    const impact = await buildDeletionImpact(context, {
      durableRateLimitReady: rateLimit.durable,
    });
    const { storageFiles: _storageFiles, ...publicImpact } = impact;
    return privateJson(publicImpact, 200, { requestId: context.requestId });
  } catch {
    return privateJson(
      {
        error: 'Account impact could not be checked safely. Deletion remains unavailable.',
        code: 'IMPACT_FAILED',
      },
      503,
      { requestId: context.requestId }
    );
  }
};
