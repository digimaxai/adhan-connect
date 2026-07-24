import { Alert } from 'react-native';
import { persistentStorage } from './persistentStorage';

const GUEST_BROWSING_KEY = 'guest_browsing_enabled:v1';

type GuestAccessListener = (enabled: boolean) => void;

const listeners = new Set<GuestAccessListener>();

function notify(enabled: boolean) {
  for (const listener of listeners) listener(enabled);
}

export async function isGuestBrowsingEnabled() {
  return (await persistentStorage.getItem(GUEST_BROWSING_KEY)) === '1';
}

export async function setGuestBrowsingEnabled(enabled: boolean) {
  if (enabled) {
    await persistentStorage.setItem(GUEST_BROWSING_KEY, '1');
  } else {
    await persistentStorage.removeItem(GUEST_BROWSING_KEY);
  }
  notify(enabled);
}

export function subscribeGuestBrowsing(listener: GuestAccessListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type SignInRouter = {
  push: (href: any) => void;
};

export function promptForSignIn(
  router: SignInRouter,
  feature = 'save this to your account'
) {
  Alert.alert(
    'Sign in required',
    `You can browse as a guest, but you need to sign in to ${feature}.`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Sign in',
        onPress: () =>
          router.push({
            pathname: '/sign-in',
            params: { reason: 'required' },
          } as any),
      },
    ]
  );
}

/**
 * Guest mode is deliberately read-only. These screens only read public mosque
 * information; account, preferences, follows, staff tools and live access stay
 * behind authentication.
 */
export function isGuestPublicRoute(pathname: string) {
  if (pathname === '/listener-home' || pathname === '/discover') return true;
  return /^\/(?:mosque|event|campaign|jumuah)\/[^/]+\/?$/.test(pathname);
}
