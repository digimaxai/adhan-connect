'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';
import { tokens } from '../../theme/tokens';

export default function AdminLayout() {
  const roles = useRoleFlags();

  // Track whether we have already confirmed main-admin access for the current
  // user. When the Supabase JWT refreshes on tab focus, useRoleFlags briefly
  // sets loading:true again. Without this memo the Stack unmounts, destroying
  // any in-progress form state on child screens. We only show the loading
  // spinner on the very first check (confirmedUserId === null); subsequent
  // re-checks for the same user let the Stack stay mounted.
  const [confirmedUserId, setConfirmedUserId] = useState<string | null>(null);
  const [confirmedIsMainAdmin, setConfirmedIsMainAdmin] = useState<boolean | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (roles.loading || !roles.ready) return;
    const uid = roles.resolvedUserId;
    // If the resolved user changed (sign-out / account switch), reset confirmation.
    if (uid !== prevUserIdRef.current) {
      prevUserIdRef.current = uid;
      setConfirmedUserId(uid);
      setConfirmedIsMainAdmin(roles.isMainAdmin);
    } else if (uid === confirmedUserId) {
      setConfirmedIsMainAdmin(roles.isMainAdmin);
    }
  }, [roles.loading, roles.ready, roles.resolvedUserId, roles.isMainAdmin, confirmedUserId]);

  // First-ever check: show spinner until we have a result.
  if (roles.loading && confirmedUserId === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.status.info} />
      </View>
    );
  }

  // Use the confirmed value while a re-check is in flight; fall back to live
  // value once settled.
  const effectiveIsMainAdmin = (roles.loading ? confirmedIsMainAdmin : roles.isMainAdmin) ?? false;

  if (!effectiveIsMainAdmin) {
    return <Redirect href={'/listener-home' as any} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="mosque-assistant/index" />
      <Stack.Screen name="prayer-times/index" />
      <Stack.Screen name="users/index" />
      <Stack.Screen name="mosques/index" />
      <Stack.Screen name="mosques/[id]" />
      <Stack.Screen name="mosques/[id]/prayer-times" />
    </Stack>
  );
}
