import type { RequestHandler } from 'expo-router/server';
import {
  privateJson,
  requireAuthenticatedAccount,
} from '@/lib/server/accountAccess';
import {
  buildDeletionImpact,
  deleteOwnedStorageFiles,
  revokeAppleAuthorizationIfNeeded,
} from '@/lib/server/accountDeletion';
import { consumeAccountRateLimit } from '@/lib/server/accountRateLimit';

type DeletePayload = {
  confirmation?: unknown;
  impactFingerprint?: unknown;
};

const MAX_DELETE_BODY_BYTES = 8_192;

async function readDeletePayload(request: Request): Promise<DeletePayload> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (
      !Number.isFinite(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_DELETE_BODY_BYTES
    ) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
  }

  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let rawPayload = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_DELETE_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    rawPayload += decoder.decode(value, { stream: true });
  }
  rawPayload += decoder.decode();
  return JSON.parse(rawPayload) as DeletePayload;
}

export const POST: RequestHandler = async (request) => {
  const access = await requireAuthenticatedAccount(request);
  if ('response' in access) return access.response;

  const { context } = access;
  const rateLimit = await consumeAccountRateLimit({
    action: 'delete',
    limit: 5,
    request,
    requireDurable: true,
    supabaseAdmin: context.supabaseAdmin,
    userId: context.userId,
    windowSeconds: 24 * 60 * 60,
  });
  if (!rateLimit.allowed) {
    const status = rateLimit.unavailable ? 503 : 429;
    return privateJson(
      {
        error: rateLimit.unavailable
          ? 'Deletion is unavailable until the durable safety controls are deployed.'
          : 'Too many deletion attempts. Please wait before trying again.',
        code: rateLimit.unavailable ? 'DELETION_NOT_READY' : 'RATE_LIMITED',
      },
      status,
      {
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        requestId: context.requestId,
      }
    );
  }

  let payload: DeletePayload;
  try {
    payload = await readDeletePayload(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
      return privateJson(
        { error: 'The deletion request is too large.', code: 'PAYLOAD_TOO_LARGE' },
        413,
        { requestId: context.requestId }
      );
    }
    return privateJson(
      { error: 'Invalid deletion request.', code: 'INVALID_REQUEST' },
      400,
      { requestId: context.requestId }
    );
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.confirmation !== 'DELETE' ||
    typeof payload.impactFingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/.test(payload.impactFingerprint)
  ) {
    return privateJson(
      {
        error: 'Review the current impact and type DELETE exactly to continue.',
        code: 'CONFIRMATION_REQUIRED',
      },
      400,
      { requestId: context.requestId }
    );
  }

  let impact: Awaited<ReturnType<typeof buildDeletionImpact>>;
  try {
    impact = await buildDeletionImpact(context, {
      durableRateLimitReady: true,
    });
  } catch {
    return privateJson(
      {
        error: 'Account impact could not be checked safely. Nothing was deleted.',
        code: 'IMPACT_FAILED',
      },
      503,
      { requestId: context.requestId }
    );
  }

  const { storageFiles: _storageFiles, ...publicImpact } = impact;
  if (payload.impactFingerprint !== impact.impactFingerprint) {
    return privateJson(
      {
        error: 'Your account impact changed. Review it again before deletion.',
        code: 'IMPACT_CHANGED',
        impact: publicImpact,
      },
      409,
      { requestId: context.requestId }
    );
  }
  if (impact.releaseBlockers.length || impact.blockers.length) {
    return privateJson(
      {
        error: 'This account cannot be deleted safely yet.',
        code: 'DELETION_BLOCKED',
        impact: publicImpact,
      },
      409,
      { requestId: context.requestId }
    );
  }
  if (!impact.recentAuthentication.isRecent) {
    return privateJson(
      {
        error: 'Sign in again before deleting your account.',
        code: 'RECENT_AUTH_REQUIRED',
        impact: publicImpact,
      },
      403,
      { requestId: context.requestId }
    );
  }
  if (!impact.canDelete) {
    return privateJson(
      {
        error: 'This account cannot be deleted safely yet.',
        code: 'DELETION_BLOCKED',
        impact: publicImpact,
      },
      409,
      { requestId: context.requestId }
    );
  }

  const completedSteps: string[] = [];
  try {
    await deleteOwnedStorageFiles(context.supabaseAdmin, impact.storageFiles);
    completedSteps.push('owned_storage');
    await revokeAppleAuthorizationIfNeeded(context.authUser);
    completedSteps.push('provider_revocation');

    const { error: signOutError } = await context.supabaseAdmin.auth.admin.signOut(
      context.accessToken,
      'global'
    );
    if (signOutError) throw new Error('GLOBAL_SIGN_OUT_FAILED');
    completedSteps.push('refresh_sessions_revoked');

    const { error: deleteError } = await context.supabaseAdmin.auth.admin.deleteUser(
      context.userId,
      false
    );
    if (deleteError) throw new Error('AUTH_DELETE_FAILED');
    completedSteps.push('auth_user_deleted');

    const { data: postcondition, error: postconditionError } =
      await context.supabaseAdmin.auth.admin.getUserById(context.userId);
    if (
      postcondition.user ||
      (postconditionError && postconditionError.status !== 404)
    ) {
      throw new Error('AUTH_DELETE_POSTCONDITION_FAILED');
    }
    completedSteps.push('auth_user_absence_verified');

    return privateJson(
      {
        deleted: true,
        localSignOutRequired: true,
        warning:
          'Previously issued access tokens can remain valid until their short expiry, but refresh sessions have been revoked.',
        completedSteps,
      },
      200,
      { requestId: context.requestId }
    );
  } catch {
    const partial = completedSteps.length > 0;
    return privateJson(
      {
        error: partial
          ? 'Deletion did not fully complete. Some files or sign-in grants may already have been removed. Do not assume the account is unchanged; contact privacy support with the request ID.'
          : 'Deletion could not be started safely. Retry later or contact privacy support with the request ID.',
        code: partial ? 'DELETION_INCOMPLETE' : 'DELETION_FAILED',
        completedSteps,
        requestId: context.requestId,
      },
      503,
      { requestId: context.requestId }
    );
  }
};
