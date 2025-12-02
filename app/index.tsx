// app/index.tsx
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useRoleFlags } from '../lib/roles';

export default function Index() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const roles = useRoleFlags();

  const targetStack = roles.isMuezzin ? '/(muezzin)' : roles.isAdmin || roles.isLocalAdmin ? '/(admin)' : '/(user)';

  useEffect(() => {
    if (loading || roles.loading) return;
    if (!session) {
      router.replace('/sign-in');
      return;
    }
    router.replace(targetStack);
  }, [loading, roles.loading, session, targetStack, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#0EA5E9" />
    </View>
  );
}
