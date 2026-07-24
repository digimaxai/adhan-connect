import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  buildAuthCallbackRouteUrl,
  completeAuthCallbackUrl,
  type AuthCallbackRouteParams,
} from '../../lib/authCallback';
import { requireRoleEntrySelection } from '../../lib/roleEntrySession';
import {
  validatePendingSocialLink,
} from '../../lib/socialAuth';

type Status = 'waiting' | 'working' | 'error';

function browserUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.location.href;
}

export default function AuthCallback() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<AuthCallbackRouteParams>();
  const retainedLinkingUrl = Linking.useLinkingURL();
  const currentRouteUrl = buildAuthCallbackRouteUrl('/callback', routeParams);
  const [status, setStatus] = useState<Status>('waiting');
  const [error, setError] = useState<string | null>(null);
  const attemptedUrls = useRef(new Set<string>());
  const completed = useRef(false);

  const complete = useCallback(
    async (url: string) => {
      if (completed.current) return;
      if (attemptedUrls.current.has(url)) return;
      attemptedUrls.current.add(url);
      setStatus('working');
      setError(null);

      try {
        const result = await completeAuthCallbackUrl(url);

        if (!result.handled) {
          throw new Error('No valid sign-in response was found. Please start again.');
        }

        if (result.destination === 'password') {
          completed.current = true;
          router.replace('/new-password' as any);
          return;
        }
        if (result.destination === 'sign-in' || !result.userId) {
          completed.current = true;
          router.replace('/sign-in' as any);
          return;
        }

        await validatePendingSocialLink(result.userId);
        await requireRoleEntrySelection(result.userId);
        completed.current = true;
        router.replace('/auth-complete' as any);
      } catch (caught) {
        setStatus('error');
        setError(
          caught instanceof Error
            ? caught.message
            : 'We could not complete sign-in. Please try again.'
        );
      }
    },
    [router]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const candidates = Array.from(
        new Set(
          [currentRouteUrl, browserUrl(), retainedLinkingUrl].filter(
            (value): value is string => Boolean(value)
          )
        )
      );
      if (!active) return;
      if (candidates.length === 0) {
        setStatus('error');
        setError('No valid sign-in response was found. Please start again.');
        return;
      }
      for (const candidate of candidates) {
        if (!active || completed.current) return;
        await complete(candidate);
      }
    })();

    return () => {
      active = false;
    };
  }, [complete, currentRouteUrl, retainedLinkingUrl]);

  return (
    <View style={styles.screen}>
      {status !== 'error' ? (
        <>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.title}>Completing sign-in…</Text>
          <Text style={styles.helper}>Keep Adhan Connect open for a moment.</Text>
        </>
      ) : (
        <>
          <Text style={styles.errorTitle}>Sign-in could not be completed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => router.replace('/sign-in' as any)}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.82 },
            ]}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: { color: '#0F172A', fontWeight: '800', fontSize: 20, marginTop: 16 },
  helper: { color: '#64748B', marginTop: 6 },
  errorTitle: {
    color: '#991B1B',
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
  },
  errorText: {
    color: '#7F1D1D',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 380,
  },
  button: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
});
