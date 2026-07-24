import * as Linking from 'expo-linking';
import {
  buildAuthCallbackRouteUrl,
  completeAuthCallbackUrl,
  consumePasswordRecoveryAuthorization,
  type AuthCallbackRouteParams,
} from '@/lib/authCallback';
import { requireRoleEntrySelection } from '@/lib/roleEntrySession';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Appbar, Button, HelperText, Text, TextInput } from 'react-native-paper';

type LinkStatus = 'checking' | 'ready' | 'error';

function getBrowserUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.location.href;
}

export default function NewPassword() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<AuthCallbackRouteParams>();
  const retainedLinkingUrl = Linking.useLinkingURL();
  const currentRouteUrl = buildAuthCallbackRouteUrl(
    '/new-password',
    routeParams
  );
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking');
  const attemptedUrls = useRef(new Set<string>());
  const recoveryReady = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function activateRecoverySession() {
      if (recoveryReady.current) return;
      try {
        // A dedicated callback screen may already have consumed the credential.
        // Check its short-lived, one-use handoff before retrying a cold-start URL
        // that can now contain an already-consumed code.
        const { data: existingSessionData } = await supabase.auth.getSession();
        if (!mounted) return;
        if (
          consumePasswordRecoveryAuthorization(
            existingSessionData.session?.user.id ?? null
          )
        ) {
          recoveryReady.current = true;
          setLinkStatus('ready');
          return;
        }

        const candidates = Array.from(
          new Set(
            [currentRouteUrl, getBrowserUrl(), retainedLinkingUrl].filter(
              (value): value is string => Boolean(value)
            )
          )
        );

        let lastError: unknown = null;
        for (const candidate of candidates) {
          if (attemptedUrls.current.has(candidate)) continue;
          attemptedUrls.current.add(candidate);
          try {
            const result = await completeAuthCallbackUrl(candidate);
            if (
              !result.handled ||
              !result.credentialConsumed ||
              !result.recoveryAuthorized ||
              result.destination !== 'password'
            ) {
              continue;
            }
            if (!mounted) return;
            if (!consumePasswordRecoveryAuthorization(result.userId)) continue;
            recoveryReady.current = true;
            setLinkStatus('ready');
            return;
          } catch (candidateError) {
            lastError = candidateError;
            continue;
          }
        }

        if (!mounted) return;
        setErr(
          lastError instanceof Error
            ? lastError.message
            : 'This password reset link is invalid or expired. Request a new one.'
        );
        setLinkStatus('error');
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? 'Failed to validate reset link.');
        setLinkStatus('error');
      }
    }

    activateRecoverySession();
    return () => {
      mounted = false;
    };
  }, [currentRouteUrl, retainedLinkingUrl]);

  const onSubmit = async () => {
    setErr(null);
    if (linkStatus !== 'ready') return;
    if (!pw || pw.length < 8) return setErr('Password must be at least 8 characters.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      const { data: sessionData } = await supabase.auth.getSession();
      await requireRoleEntrySelection(
        data.user?.id ?? sessionData.session?.user.id ?? null
      );
      setOk(true);
      setTimeout(() => router.replace('/auth-complete' as any), 800);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Set new password" />
      </Appbar.Header>

      <View style={{ padding: 16, gap: 12 }}>
        {linkStatus === 'checking' ? (
          <View style={{ paddingVertical: 12, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator />
            <Text>Validating reset link...</Text>
          </View>
        ) : null}
        <TextInput
          label="New password"
          secureTextEntry
          value={pw}
          onChangeText={setPw}
          autoCapitalize="none"
        />
        <TextInput
          label="Confirm password"
          secureTextEntry
          value={pw2}
          onChangeText={setPw2}
          autoCapitalize="none"
        />
        {!!err && <HelperText type="error" visible>{err}</HelperText>}
        {ok && <Text>Password updated. Redirecting...</Text>}
        <Button
          mode="contained"
          onPress={onSubmit}
          loading={loading}
          disabled={loading || linkStatus !== 'ready'}
        >
          Update password
        </Button>
      </View>
    </View>
  );
}
