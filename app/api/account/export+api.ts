import type { RequestHandler } from 'expo-router/server';
import {
  getRecentAuthentication,
  requireAuthenticatedAccount,
  privateJson,
} from '@/lib/server/accountAccess';
import { buildAccountExport } from '@/lib/server/accountExport';
import { consumeAccountRateLimit } from '@/lib/server/accountRateLimit';

export const GET: RequestHandler = async (request) => {
  const access = await requireAuthenticatedAccount(request);
  if ('response' in access) return access.response;

  const { context } = access;
  const recentAuthentication = getRecentAuthentication(context);
  if (!recentAuthentication.isRecent) {
    return privateJson(
      {
        error: 'Sign in again before downloading your account data.',
        code: 'RECENT_AUTH_REQUIRED',
      },
      403,
      { requestId: context.requestId }
    );
  }

  const rateLimit = await consumeAccountRateLimit({
    action: 'export',
    limit: 3,
    request,
    supabaseAdmin: context.supabaseAdmin,
    userId: context.userId,
    windowSeconds: 15 * 60,
  });
  if (!rateLimit.allowed) {
    return privateJson(
      {
        error: 'Too many export requests. Please wait and try again.',
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
    const accountExport = await buildAccountExport(
      context.supabaseAdmin,
      context.authUser
    );
    const date = new Date().toISOString().slice(0, 10);
    return privateJson(accountExport, 200, {
      headers: {
        'Content-Disposition': `attachment; filename="adhan-connect-account-${date}.json"`,
      },
      requestId: context.requestId,
    });
  } catch {
    return privateJson(
      {
        error: 'Your account export could not be prepared. Please try again.',
        code: 'EXPORT_FAILED',
      },
      503,
      { requestId: context.requestId }
    );
  }
};
