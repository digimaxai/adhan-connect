// app/(auth)/reset.tsx
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';

export default function ResetScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email) {
      Alert.alert('Missing email', 'Please enter your account email.');
      return;
    }
    setBusy(true);
    const { error } = await resetPassword(email.trim());
    setBusy(false);

    if (error) {
      Alert.alert('Failed', error);
      return;
    }
    Alert.alert('Email sent', 'Check your inbox for a password reset link.');
    router.replace('/sign-in'); // no group in path
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.title}>Reset password</Text>
        <Text style={s.subtle}>Enter your email and we&apos;ll send a reset link.</Text>

        <Text style={s.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          style={s.input}
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={[s.button, busy && s.buttonDisabled]} onPress={onSubmit} disabled={busy}>
          <Text style={s.buttonText}>{busy ? 'Sending...' : 'Send reset link'}</Text>
        </TouchableOpacity>

        <View style={s.row}>
          <Link href="/sign-in" style={s.link}>Back to sign in</Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: '#F8FAFC', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 22, fontWeight: '800' },
  subtle: { color: '#64748B', marginTop: 4, marginBottom: 16 },
  label: { fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, backgroundColor: '#F9FAFB' },
  button: { backgroundColor: '#0EA5E9', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' },
  link: { color: '#0EA5E9', fontWeight: '700' },
});
