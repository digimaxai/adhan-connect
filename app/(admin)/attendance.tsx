import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { EngagementOverview } from '@/components/admin/EngagementOverview';

export default function AttendanceScreen() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );

  const noMosqueAccess = !selectedMosque && mosques.length === 0;
  const workspaceLoading = roleLoading || (isAdmin && mosqueLoading);

  if (workspaceLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.color.status.info} />
        <AppText variant="body" style={styles.loadingText}>
          Loading…
        </AppText>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" color={tokens.color.text.secondary}>
          You do not have access to the admin console.
        </AppText>
      </View>
    );
  }

  return (
    <AdminScreenShell
      title="Attendance & Engagement"
      subtitle="Friday Jumu'ah and event planning"
      backHref="/(admin)"
      backLabel="Back"
      mosqueName={selectedMosque?.name}
      mosqueMeta={
        selectedMosque
          ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ')
          : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={tokens.color.status.info}
        />
      }
    >
      {noMosqueAccess ? (
        <AdminBanner
          tone="warning"
          title="No mosque assigned"
          message="Select a mosque on the main admin dashboard to view attendance and engagement analytics."
        />
      ) : !selectedMosque ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="information-circle-outline"
            size={32}
            color={tokens.color.text.muted}
            style={styles.emptyIcon}
          />
          <AppText variant="body" color={tokens.color.text.secondary}>
            Choose a mosque to see attendance analytics.
          </AppText>
          <AppButton
            variant="primary"
            onPress={() => router.replace('/(admin)' as any)}
            title="Back to Dashboard"
          />
        </View>
      ) : (
        <View style={styles.content}>
          <EngagementOverview
            key={`${selectedMosque.mosqueId}-${refreshKey}`}
            mosqueId={selectedMosque.mosqueId}
            refreshKey={refreshKey}
          />
        </View>
      )}
    </AdminScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    marginTop: 12,
  },
  emptyState: {
    marginTop: 40,
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 16,
    backgroundColor: tokens.color.bg.subtle,
    alignItems: 'center',
    gap: 16,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  content: {
    paddingVertical: 12,
  },
});
