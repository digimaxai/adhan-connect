import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export type AuthCallbackDestination = 'app' | 'password' | 'sign-in';

export type AuthCallbackResult = {
  credentialConsumed: boolean;
  handled: boolean;
  destination: AuthCallbackDestination;
  recoveryAuthorized: boolean;
  userId: string | null;
};

type AuthCallbackParams = Record<string, string | undefined>;

const RECOVERY_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;
const recoveryAuthorizations = new Map<string, number>();
const CALLBACK_PARAM_KEYS = [
  'code',
  'token_hash',
  'token',
  'type',
  'error',
  'error_code',
  'error_description',
] as const;
const EMAIL_OTP_TYPES = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function rememberRecoveryAuthorization(userId: string) {
  recoveryAuthorizations.set(userId, Date.now() + RECOVERY_AUTHORIZATION_TTL_MS);
}

/**
 * Transfers a recovery proof between the callback route and the password form
 * without treating an ordinary persisted session as recovery authorization.
 * The proof is deliberately memory-only, short-lived and one-use.
 */
export function consumePasswordRecoveryAuthorization(userId: string | null) {
  if (!userId) return false;
  const expiresAt = recoveryAuthorizations.get(userId) ?? 0;
  recoveryAuthorizations.delete(userId);
  return expiresAt >= Date.now();
}

function parseFragment(fragment: string | null | undefined) {
  const result: AuthCallbackParams = {};
  if (!fragment) return result;

  for (const part of fragment.split('&')) {
    const separator = part.indexOf('=');
    const rawKey = separator >= 0 ? part.slice(0, separator) : part;
    const rawValue = separator >= 0 ? part.slice(separator + 1) : '';
    if (!rawKey) continue;
    result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
  }
  return result;
}

export function getAuthCallbackParams(url: string): AuthCallbackParams {
  const parsed = Linking.parse(url);
  const params = { ...((parsed.queryParams ?? {}) as AuthCallbackParams) };
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    Object.assign(params, parseFragment(url.slice(hashIndex + 1)));
  }
  return params;
}

export type AuthCallbackRouteParams = Partial<
  Record<(typeof CALLBACK_PARAM_KEYS)[number], string | string[]>
>;

function firstRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reconstructs only the allowlisted auth parameters exposed by Expo Router.
 * This covers warm native links without persisting or logging their secrets.
 */
export function buildAuthCallbackRouteUrl(
  path: '/callback' | '/new-password',
  routeParams: AuthCallbackRouteParams
) {
  const queryParams: Record<string, string> = {};
  for (const key of CALLBACK_PARAM_KEYS) {
    const value = firstRouteParam(routeParams[key]);
    if (value) queryParams[key] = value;
  }
  if (Object.keys(queryParams).length === 0) return null;
  return Linking.createURL(path, {
    scheme: 'adhanconnect',
    queryParams,
  });
}

function normalizeCallbackError(params: AuthCallbackParams) {
  if (!params.error && !params.error_description && !params.error_code) {
    return null;
  }
  const raw =
    params.error_description ?? params.error ?? params.error_code ?? '';
  if (/expired/i.test(raw)) {
    return 'This sign-in link has expired. Please request a new one.';
  }
  if (/access_denied|cancel/i.test(raw)) {
    return 'Sign-in was cancelled.';
  }
  return 'We could not complete sign-in. Please try again.';
}

export async function completeAuthCallbackUrl(url: string): Promise<AuthCallbackResult> {
  const params = getAuthCallbackParams(url);
  const callbackError = normalizeCallbackError(params);
  if (callbackError) throw new Error(callbackError);

  const rawType = (params.type ?? '').toLowerCase();
  let destination: AuthCallbackDestination = 'app';
  let credentialConsumed = false;
  let recoveryAuthorized = false;
  let handled = false;
  let verifiedType = '';

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error('This sign-in link is invalid or has expired.');

    // auth-js includes this runtime field for PKCE recovery exchanges even
    // though the public AuthTokenResponse type does not expose it.
    const redirectType =
      typeof (data as any)?.redirectType === 'string'
        ? String((data as any).redirectType).toLowerCase()
        : '';
    if (redirectType === 'password_recovery' || redirectType === 'recovery') {
      destination = 'password';
      recoveryAuthorized = true;
      verifiedType = 'recovery';
    }
    credentialConsumed = true;
    handled = true;
  } else {
    const tokenHash = params.token_hash ?? params.token;
    if (tokenHash && EMAIL_OTP_TYPES.has(rawType)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: rawType as any,
      });
      if (error) throw new Error('This sign-in link is invalid or has expired.');
      verifiedType = rawType;
      if (verifiedType === 'recovery' || verifiedType === 'invite') {
        destination = 'password';
        recoveryAuthorized = true;
      }
      credentialConsumed = true;
      handled = true;
    }
  }

  if (!credentialConsumed) {
    return {
      credentialConsumed: false,
      handled: false,
      destination,
      recoveryAuthorized: false,
      userId: null,
    };
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('We could not verify the completed sign-in.');

  if (!data.session) {
    if (verifiedType === 'signup') {
      return {
        credentialConsumed,
        handled,
        destination: 'sign-in',
        recoveryAuthorized: false,
        userId: null,
      };
    }
    return {
      credentialConsumed,
      handled: false,
      destination,
      recoveryAuthorized,
      userId: null,
    };
  }

  const result = {
    credentialConsumed,
    handled: handled || Boolean(data.session),
    destination,
    recoveryAuthorized,
    userId: data.session.user.id,
  };
  if (result.recoveryAuthorized && result.destination === 'password') {
    rememberRecoveryAuthorization(result.userId);
  }
  return result;
}
