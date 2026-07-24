import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getAuthRedirectUrl } from './auth';
import { completeAuthCallbackUrl } from './authCallback';
import {
  beginSocialAuthCompletion,
  endSocialAuthCompletion,
} from './authFlowState';
import {
  clearPendingPkceVerifier,
  signOutCurrentDeviceFailClosed,
} from './authSessionCleanup';
import { requireRoleEntrySelection } from './roleEntrySession';
import { supabase } from './supabase';
import { supabaseAuthStorage } from './supabaseAuthStorage';

WebBrowser.maybeCompleteAuthSession();

const PENDING_SOCIAL_LINK_KEY = 'adhan-connect.pending-social-link.v1';
const PENDING_FLOW_TTL_MS = 15 * 60 * 1000;

export type SocialProvider = 'apple' | 'google';

export type SocialAuthResult =
  | { status: 'complete' }
  | { status: 'redirecting' }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

type PendingSocialLink = {
  provider: SocialProvider;
  originalUserId: string;
};

type PendingValue<T> = {
  expiresAt: number;
  value: T;
};

async function savePendingLink(link: PendingSocialLink) {
  const pending: PendingValue<PendingSocialLink> = {
    expiresAt: Date.now() + PENDING_FLOW_TTL_MS,
    value: link,
  };
  await supabaseAuthStorage.setItem(PENDING_SOCIAL_LINK_KEY, JSON.stringify(pending));
}

async function clearPendingLink() {
  await supabaseAuthStorage.removeItem(PENDING_SOCIAL_LINK_KEY);
}

async function readPendingLink(): Promise<PendingSocialLink | null> {
  const raw = await supabaseAuthStorage.getItem(PENDING_SOCIAL_LINK_KEY);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as Partial<PendingValue<PendingSocialLink>>;
    const parsed = pending.value;
    if (
      typeof pending.expiresAt !== 'number' ||
      pending.expiresAt < Date.now() ||
      !parsed ||
      (parsed.provider !== 'apple' && parsed.provider !== 'google') ||
      !parsed.originalUserId
    ) {
      await clearPendingLink();
      return null;
    }
    return parsed;
  } catch {
    await clearPendingLink();
    return null;
  }
}

/**
 * Confirms that an explicit identity-link callback retained the original Auth
 * UUID. This must run before normal role routing on a browser callback.
 */
export async function validatePendingSocialLink(returnedUserId: string | null) {
  const pending = await readPendingLink();
  if (!pending) return;
  await clearPendingLink();
  if (!returnedUserId || returnedUserId !== pending.originalUserId) {
    try {
      await signOutCurrentDeviceFailClosed();
    } catch {
      throw new Error(
        'Account linking did not preserve your original account, and this device could not safely close the returned session. Close the app and contact support.'
      );
    }
    throw new Error(
      'Account linking did not preserve your original account. No roles were merged; please sign in again and contact support.'
    );
  }
}

function describeProviderError(provider: SocialProvider, error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/provider.*not.*enabled|unsupported provider|validation_failed/i.test(message)) {
    return `${provider === 'apple' ? 'Apple' : 'Google'} sign-in is not available yet. Please use email instead.`;
  }
  if (/network|fetch/i.test(message)) {
    return 'We could not reach the sign-in service. Check your connection and try again.';
  }
  return `We could not complete ${provider === 'apple' ? 'Apple' : 'Google'} sign-in. Please try again or use email.`;
}

async function finishSocialSession(userId: string | null) {
  if (!userId) throw new Error('No signed-in account was returned.');
  await requireRoleEntrySelection(userId);
}

async function abortIncompleteSocialSession() {
  await signOutCurrentDeviceFailClosed();
}

export async function signInWithGoogle(): Promise<SocialAuthResult> {
  const redirectTo = getAuthRedirectUrl();
  let redirecting = false;
  beginSocialAuthCompletion();

  try {
    const isWeb = Platform.OS === 'web';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: !isWeb,
      },
    });
    if (error) throw error;

    if (isWeb) {
      redirecting = true;
      return { status: 'redirecting' };
    }
    if (!data.url) throw new Error('The provider did not return a sign-in URL.');

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
      try {
        await abortIncompleteSocialSession();
      } catch {
        return {
          status: 'error',
          error:
            'We could not safely close the cancelled sign-in. Close the app before trying again.',
        };
      }
      return { status: 'cancelled' };
    }
    if (browserResult.type !== 'success' || !browserResult.url) {
      throw new Error('Google sign-in did not complete.');
    }

    const callback = await completeAuthCallbackUrl(browserResult.url);
    if (!callback.handled || !callback.userId) {
      throw new Error('The returned sign-in link did not contain a valid session.');
    }
    await finishSocialSession(callback.userId);
    return { status: 'complete' };
  } catch (error) {
    try {
      await abortIncompleteSocialSession();
    } catch {
      return {
        status: 'error',
        error:
          'We could not safely close the incomplete sign-in session. Close the app before trying again.',
      };
    }
    return { status: 'error', error: describeProviderError('google', error) };
  } finally {
    if (!redirecting) endSocialAuthCompletion();
  }
}

export async function signInWithApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios') {
    return { status: 'error', error: 'Apple sign-in is only available on supported Apple devices.' };
  }

  beginSocialAuthCompletion();
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { status: 'error', error: 'Apple sign-in is not available on this device.' };
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;

    const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (displayName) {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (metadataError) {
        // Apple only returns the name once. Keep sign-in successful even if the
        // optional profile update fails; the identity itself is already valid.
      }
    }

    await finishSocialSession(data.user?.id ?? null);
    return { status: 'complete' };
  } catch (error: any) {
    try {
      await abortIncompleteSocialSession();
    } catch {
      return {
        status: 'error',
        error:
          'We could not safely close the incomplete sign-in session. Close the app before trying again.',
      };
    }
    if (error?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    return { status: 'error', error: describeProviderError('apple', error) };
  } finally {
    endSocialAuthCompletion();
  }
}

/**
 * Explicitly links a provider to the currently authenticated UUID. This is
 * intentionally separate from sign-in so a settings screen can offer
 * “Connect Google/Apple” without guessing identity from an email address.
 * Supabase manual identity linking must be enabled before exposing this action.
 */
export async function linkSocialIdentity(
  provider: SocialProvider
): Promise<SocialAuthResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const originalUserId = sessionData.session?.user.id ?? null;
  if (sessionError || !originalUserId) {
    return { status: 'error', error: 'Sign in again before connecting another provider.' };
  }

  await savePendingLink({ provider, originalUserId });
  try {
    if (provider === 'apple') {
      if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
        await clearPendingLink();
        return { status: 'error', error: 'Apple account linking is unavailable on this device.' };
      }
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;
      await validatePendingSocialLink(data.user?.id ?? null);
      return { status: 'complete' };
    }

    const redirectTo = getAuthRedirectUrl();
    const isWeb = Platform.OS === 'web';
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: !isWeb,
      },
    });
    if (error) throw error;
    if (isWeb) return { status: 'redirecting' };
    if (!data.url) throw new Error('The provider did not return a linking URL.');

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
      try {
        await Promise.all([clearPendingLink(), clearPendingPkceVerifier()]);
      } catch {
        return {
          status: 'error',
          error:
            'We could not safely close the cancelled linking attempt. Close the app before trying again.',
        };
      }
      return { status: 'cancelled' };
    }
    if (browserResult.type !== 'success' || !browserResult.url) {
      throw new Error('Google account linking did not complete.');
    }
    const callback = await completeAuthCallbackUrl(browserResult.url);
    await validatePendingSocialLink(callback.userId);
    return { status: 'complete' };
  } catch (error: any) {
    await Promise.allSettled([
      clearPendingLink(),
      clearPendingPkceVerifier(),
    ]);
    if (error?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    const raw = error instanceof Error ? error.message : String(error ?? '');
    if (/manual.*link|identity.*link.*disabled|not.*enabled/i.test(raw)) {
      return {
        status: 'error',
        error: 'Connecting sign-in providers is not enabled for this release.',
      };
    }
    return { status: 'error', error: describeProviderError(provider, error) };
  }
}
