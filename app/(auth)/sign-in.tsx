// app/(auth)/sign-in.tsx
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth';

export default function SignInScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);

    if (error) {
      Alert.alert('Sign in failed', error);
      return;
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtle}>Sign in to continue</Text>

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

        <Text style={s.label}>Password</Text>
        <TextInput
          placeholder="*****"
          secureTextEntry
          style={s.input}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={[s.button, busy && s.buttonDisabled]} onPress={onSubmit} disabled={busy}>
          <Text style={s.buttonText}>{busy ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <View style={s.row}>
          {/* Group names are stripped from paths */}
          <Link href="/reset" style={s.link}>Forgot password?</Link>
          <Text style={s.sep}>·</Text>
          <Link href="/sign-up" style={s.link}>Create account</Link>
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
  sep: { color: '#94A3B8' },
});
