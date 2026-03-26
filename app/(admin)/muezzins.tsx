import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import {
  MosqueMuezzinMember,
  removeMosqueMuezzin,
  setMosqueMuezzinActive,
} from '@/lib/api/admin/muezzins';
import { loadMosqueMuezzinWorkspace } from '@/lib/api/admin/muezzinWorkspace';
import { resolveCoverRequest } from '@/lib/api/coverRequests';
import { resolveApiUrl, supportsServerApi } from '@/lib/api/apiBaseUrl';
import { supabase } from '@/lib/supabase';
import type { MuezzinCoverRequest } from '@/lib/types/muezzin';
import { tokens } from '@/theme/tokens';

const ACTIVE_REQUEST_STATUSES = new Set(['open', 'volunteered', 'provisional_cover']);

export default function LocalAdminMuezzinsScreen() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque();

  const [muezzins, setMuezzins] = useState<MosqueMuezzinMember[]>([]);
  const [requests, setRequests] = useState<MuezzinCoverRequest[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const activeRequests = useMemo(
    () => requests.filter((request) => ACTIVE_REQUEST_STATUSES.has(request.status)),
    [requests]
  );
  const recentResolvedRequests = useMemo(
    () => requests.filter((request) => !ACTIVE_REQUEST_STATUSES.has(request.status)).slice(0, 4),
    [requests]
  );
  const activeCount = useMemo(() => muezzins.filter((member) => member.isActive).length, [muezzins]);
  const inactiveCount = muezzins.length - activeCount;
  const urgentRequestCount = useMemo(
    () => activeRequests.filter((request) => request.urgency === 'urgent').length,
    [activeRequests]
  );

  const loadWorkspace = useCallback(async () => {
    if (!selectedMosque) {
      setMuezzins([]);
      setRequests([]);
      return;
    }

    setLoadingData(true);
    setError(null);
    try {
      const workspace = await loadMosqueMuezzinWorkspace(selectedMosque.mosqueId);
      setMuezzins(workspace.members);
      setRequests(workspace.coverRequests);
    } catch (err: any) {
      console.warn('[LocalAdminMuezzinsScreen.loadWorkspace]', err?.message ?? err);
      setError(err?.message ?? 'Unable to load the mosque muezzin workspace.');
    } finally {
      setLoadingData(false);
    }
  }, [selectedMosque]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWorkspace();
    } finally {
      setRefreshing(false);
    }
  }, [loadWorkspace]);

  const handleToggleActive = async (member: MosqueMuezzinMember) => {
    if (!selectedMosque) return;
    setBusyKey(`toggle:${member.userId}`);
    setError(null);
    setNotice(null);
    try {
      await setMosqueMuezzinActive(selectedMosque.mosqueId, member.userId, !member.isActive);
      setNotice(
        `${member.displayName} is now ${member.isActive ? 'inactive' : 'active'} for ${selectedMosque.name}.`
      );
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.message ?? 'Unable to update this muezzin assignment.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (member: MosqueMuezzinMember) => {
    if (!selectedMosque) return;
    Alert.alert(
      'Remove muezzin',
      `Remove ${member.displayName} from ${selectedMosque.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyKey(`remove:${member.userId}`);
            setError(null);
            setNotice(null);
            try {
              await removeMosqueMuezzin(selectedMosque.mosqueId, member.userId);
              setNotice(`${member.displayName} was removed from ${selectedMosque.name}.`);
              await loadWorkspace();
            } catch (err: any) {
              setError(err?.message ?? 'Unable to remove this muezzin.');
            } finally {
              setBusyKey(null);
            }
          },
        },
      ]
    );
  };

  const handleInvite = async () => {
    if (!selectedMosque) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError('Email is required.');
      return;
    }

    const endpoint = resolveApiUrl('/api/admin/muezzin-invite');
    if (!endpoint) {
      setInviteError(
        'This device cannot reach the invite service yet. Set EXPO_PUBLIC_API_BASE_URL for native builds or use the web admin.'
      );
      return;
    }

    setInviteBusy(true);
    setInviteError(null);
    setError(null);
    setNotice(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        setInviteError('Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          email,
          displayName: inviteName.trim(),
          mosqueId: selectedMosque.mosqueId,
        }),
      });

      const raw = await response.text();
      let payload: any = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }
      if (!response.ok) {
        setInviteError(payload?.error ?? 'Unable to invite or assign this muezzin.');
        return;
      }

      setInviteEmail('');
      setInviteName('');
      setNotice(
        payload?.invited
          ? `${email} was invited and assigned to ${selectedMosque.name}.`
          : payload?.alreadyAssigned
          ? `${email} already has access to ${selectedMosque.name}.`
          : `${email} was assigned to ${selectedMosque.name}.`
      );
      await loadWorkspace();
    } catch (err: any) {
      setInviteError(err?.message ?? 'Unable to complete the invite flow.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleResolveRequest = async (request: MuezzinCoverRequest, action: 'approve' | 'dismiss') => {
    if (!selectedMosque) return;
    setBusyKey(`${action}:${request.id}`);
    setError(null);
    setNotice(null);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user?.id) {
        setError('Please sign in again before resolving cover requests.');
        return;
      }

      await resolveCoverRequest({
        requestId: request.id,
        action,
        assignedByUserId: user.id,
      });

      setNotice(
        action === 'approve'
          ? `${formatPrayerLabel(request.prayer_name)} on ${formatDateLabel(request.date)} now has confirmed cover.`
          : `${formatPrayerLabel(request.prayer_name)} on ${formatDateLabel(request.date)} still needs follow-up in the rota.`
      );
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.message ?? 'Unable to update this cover request.');
    } finally {
      setBusyKey(null);
    }
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <AppText variant="body" style={styles.feedbackText}>
          Loading...
        </AppText>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body">You do not have admin access.</AppText>
      </View>
    );
  }

  const noMosqueAccess = !selectedMosque && !mosques.length;

  return (
    <AdminScreenShell
      title="Muezzins"
      subtitle="Invite mosque muezzins, control active assignments, and resolve cover requests without leaving the mosque workspace."
      backHref="/(admin)"
      backLabel="Back to Console"
      mosqueName={selectedMosque?.name ?? null}
      mosqueMeta={
        selectedMosque
          ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || 'Mosque staff workspace'
          : null
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />}
    >
      {noMosqueAccess ? (
        <AdminBanner
          tone="warning"
          title="No mosque access"
          message="You can only manage muezzins for mosques where your account has local admin access."
        />
      ) : null}

      {!supportsServerApi() ? (
        <AdminBanner
          tone="warning"
          title="Invite service not configured on this device"
          message="Existing muezzins can still be managed here. For invites on native builds, set EXPO_PUBLIC_API_BASE_URL."
        />
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard label="Active muezzins" value={`${activeCount}`} detail="Ready for rota assignment" />
        <MetricCard label="Inactive" value={`${inactiveCount}`} detail="Temporarily removed from duty" />
        <MetricCard label="Open requests" value={`${activeRequests.length}`} detail="Need local-admin review" />
        <MetricCard label="Urgent" value={`${urgentRequestCount}`} detail="Time-critical coverage gaps" />
      </View>

      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText variant="title">Invite or reactivate</AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            Invite by email, or reactivate the same person if they already belong to this mosque.
          </AppText>
        </View>
        <TextInput
          value={inviteName}
          onChangeText={setInviteName}
          placeholder="Display name (optional)"
          placeholderTextColor={tokens.color.text.muted}
          style={styles.input}
        />
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={tokens.color.text.muted}
          style={styles.input}
        />
        {inviteError ? <AdminBanner tone="danger" title="Invite blocked" message={inviteError} /> : null}
        <AppButton title={inviteBusy ? 'Sending...' : 'Invite Muezzin'} onPress={handleInvite} disabled={inviteBusy || !selectedMosque} />
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="title">Mosque team</AppText>
            <AppText variant="body" color={tokens.color.text.secondary}>
              Keep assignments lean. Inactive muezzins stay on record but disappear from the rota picker.
            </AppText>
          </View>
          <AppButton title="Open Staff Rota" variant="ghost" onPress={() => router.push('/(admin)/staff-rota')} />
        </View>
        {loadingData ? (
          <View style={styles.loader}>
            <ActivityIndicator />
            <AppText variant="body" style={styles.feedbackText}>
              Loading muezzins...
            </AppText>
          </View>
        ) : muezzins.length ? (
          muezzins.map((member) => {
            const isBusy = busyKey === `toggle:${member.userId}` || busyKey === `remove:${member.userId}`;
            return (
              <View key={member.userId} style={styles.memberRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="body" style={styles.memberName}>
                    {member.displayName}
                  </AppText>
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    {member.email ?? 'No email available'}
                  </AppText>
                </View>
                <StatusPill active={member.isActive} />
                <View style={styles.memberActions}>
                  <AppButton
                    title={member.isActive ? 'Deactivate' : 'Activate'}
                    variant="ghost"
                    onPress={() => handleToggleActive(member)}
                    disabled={isBusy}
                  />
                  <AppButton
                    title="Remove"
                    variant="ghost"
                    onPress={() => handleRemove(member)}
                    disabled={isBusy}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <AdminBanner
            tone="info"
            title="No muezzins assigned yet"
            message="Invite the first muezzin here, then publish rota changes from Staff Rota."
          />
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText variant="title">Cover requests</AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            Handle planned release requests and urgent peer cover from one queue.
          </AppText>
        </View>

        {!activeRequests.length ? (
          <AdminBanner
            tone="info"
            title="No active cover requests"
            message="New requests from muezzins will appear here as soon as they need help."
          />
        ) : (
          activeRequests.map((request) => {
            const approving = busyKey === `approve:${request.id}`;
            const dismissing = busyKey === `dismiss:${request.id}`;
            const hasVolunteer = !!request.volunteer_user_id;
            return (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body" style={styles.requestTitle}>
                      {formatPrayerLabel(request.prayer_name)} • {formatDateLabel(request.date)}
                    </AppText>
                    <AppText variant="caption" color={tokens.color.text.secondary}>
                      Requested by {request.requester_name ?? 'a muezzin'}
                    </AppText>
                  </View>
                  <UrgencyPill urgency={request.urgency} />
                </View>
                {request.reason ? (
                  <AppText variant="body" color={tokens.color.text.secondary}>
                    {request.reason}
                  </AppText>
                ) : null}
                <AppText variant="caption" color={tokens.color.text.secondary}>
                  {hasVolunteer
                    ? `Volunteer: ${request.volunteer_name ?? 'A mosque peer'}`
                    : 'Waiting for volunteer or manual reassignment.'}
                </AppText>
                <View style={styles.requestActions}>
                  <AppButton
                    title={hasVolunteer ? 'Approve Cover' : 'Needs Rota Update'}
                    onPress={
                      hasVolunteer
                        ? () => handleResolveRequest(request, 'approve')
                        : () => router.push('/(admin)/staff-rota')
                    }
                    disabled={approving}
                  />
                  <AppButton
                    title="Dismiss"
                    variant="ghost"
                    onPress={() => handleResolveRequest(request, 'dismiss')}
                    disabled={dismissing}
                  />
                </View>
              </View>
            );
          })
        )}

        {recentResolvedRequests.length ? (
          <View style={styles.historySection}>
            <AppText variant="caption" color={tokens.color.text.secondary}>
              Recent closed requests
            </AppText>
            {recentResolvedRequests.map((request) => (
              <View key={request.id} style={styles.historyRow}>
                <AppText variant="body" style={styles.historyTitle}>
                  {formatPrayerLabel(request.prayer_name)} • {formatDateLabel(request.date)}
                </AppText>
                <AppText variant="caption" color={tokens.color.text.secondary}>
                  {request.status.replace(/_/g, ' ')}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </AppCard>

      {notice ? <AdminBanner tone="info" title="Muezzin workspace" message={notice} /> : null}
      {error ? <AdminBanner tone="danger" title="Unable to continue" message={error} /> : null}
    </AdminScreenShell>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <AppCard style={styles.metricCard}>
      <AppText variant="caption" color={tokens.color.text.secondary}>
        {label}
      </AppText>
      <AppText variant="title" style={styles.metricValue}>
        {value}
      </AppText>
      <AppText variant="caption" color={tokens.color.text.secondary}>
        {detail}
      </AppText>
    </AppCard>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillMuted]}>
      <AppText variant="caption" style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextMuted]}>
        {active ? 'Active' : 'Inactive'}
      </AppText>
    </View>
  );
}

function UrgencyPill({ urgency }: { urgency: 'standard' | 'urgent' }) {
  const urgent = urgency === 'urgent';
  return (
    <View style={[styles.pill, urgent ? styles.pillUrgent : styles.pillMuted]}>
      <AppText variant="caption" style={[styles.pillText, urgent ? styles.pillTextUrgent : styles.pillTextMuted]}>
        {urgent ? 'Urgent' : 'Standard'}
      </AppText>
    </View>
  );
}

function formatPrayerLabel(prayerName: string) {
  return prayerName.charAt(0).toUpperCase() + prayerName.slice(1);
}

function formatDateLabel(dateIso: string) {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  feedbackText: { marginTop: 8 },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  metricCard: {
    minWidth: 150,
    flexGrow: 1,
    gap: 4,
    padding: tokens.spacing.sm,
    borderRadius: 16,
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
  },
  card: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: 18,
  },
  cardHeader: {
    gap: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: tokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  loader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRow: {
    gap: tokens.spacing.xs,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  memberName: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  memberActions: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    flexWrap: 'wrap',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
  },
  pillActive: {
    backgroundColor: '#DCFCE7',
  },
  pillMuted: {
    backgroundColor: '#EEF2F6',
  },
  pillUrgent: {
    backgroundColor: '#FEE2E2',
  },
  pillText: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  pillTextActive: {
    color: '#166534',
  },
  pillTextMuted: {
    color: '#475569',
  },
  pillTextUrgent: {
    color: '#B91C1C',
  },
  requestCard: {
    gap: tokens.spacing.xs,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#E5EEF7',
  },
  requestHeader: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    alignItems: 'flex-start',
  },
  requestTitle: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  requestActions: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  historySection: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF5',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  historyTitle: {
    fontWeight: tokens.typography.weight.bold,
  },
});
