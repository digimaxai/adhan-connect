'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabaseClient';
import { RequireMainAdmin } from '../../../components/admin/web/RequireMainAdmin';
import { AdminContextProvider, useAdminContext } from '../../../lib/admin-web/adminContext';
import { AdminFeedbackProvider, useAdminFeedback } from '../../../lib/admin-web/adminFeedback';
import { useAdminViewport } from '../../../lib/admin-web/useAdminViewport';
import { resolveApiUrl, supportsServerApi } from '../../../lib/api/apiBaseUrl';
import { removeLocalAdminMembership } from '../../../lib/api/admin/localAdminAssignments';
import { removeMuezzinMembership } from '../../../lib/api/admin/muezzinAssignments';
import {
  getLiveStreamProviderProfile,
  normalizeIcecastMountPath,
  normalizeIngestUrl,
  normalizeLiveStreamProvider,
  normalizePlaybackUrl,
  resolveLiveStreamListenerSecret,
  resolveLiveStreamMountPath,
} from '../../../lib/liveStreamProviders';
import type { MosqueOption } from '../../../components/admin/web/AdminTopBar';
import AdminShell from '../../../components/admin/web/AdminShell';
import { AdminMetricCard, AdminPanel } from '../../../components/admin/web/AdminPrimitives';
import ConfirmDialog from '../../../components/admin/web/ConfirmDialog';
import { Button, Modal, Pill, Select, TextInput } from '../../../components/admin/web/ui';
import { ALADHAN_METHODS, DEFAULT_ALADHAN_METHOD } from '../../../lib/api/aladhan';
import type {
  BroadcastReadinessPayload,
  BroadcastReadinessPostAction,
} from '../../../lib/types/broadcastReadiness';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  default_muezzin_user_id?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
  live_stream_enabled?: boolean | null;
  live_stream_provider?: string | null;
  live_stream_playback_url?: string | null;
  live_stream_ingest_url?: string | null;
  live_stream_mount_path?: string | null;
  live_stream_username?: string | null;
  live_stream_stream_key?: string | null;
  live_stream_status_secret?: string | null;
  live_stream_listener_secret?: string | null;
  prayer_calculation_method?: number | null;
  prayer_school?: number | null;
  prayer_source?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at?: string | null;
};

type AssignmentUser = {
  id: string;
  email: string | null;
  role: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

type MosqueAdmin = { user_id: string; mosque_id: string };
type MuezzinRow = { user_id: string; mosque_id: string; is_active?: boolean | null };
type UpstreamStateRow = {
  mosque_id: string;
  provider_status?: string | null;
  encoder_connected?: boolean | null;
  playback_active?: boolean | null;
  provider_stream_id?: string | null;
  provider_message?: string | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
};
type MosqueWorkspaceTab = 'overview' | 'admins' | 'muezzins';
type EditMosqueMode = 'profile' | 'live-stream';
type AdminApiOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  searchParams?: Record<string, string>;
  signal?: AbortSignal;
};
type MosqueWorkspacePayload = {
  mosque: MosqueRow;
  mosques: MosqueRow[];
  admins: MosqueAdmin[];
  muezzins: MuezzinRow[];
  people: AssignmentUser[];
  upstreamState: UpstreamStateRow | null;
};

async function requestAdminApi<T>(path: string, options: AdminApiOptions = {}): Promise<T> {
  if (!supportsServerApi()) throw new Error('The admin API is unavailable in this runtime.');
  const endpoint = resolveApiUrl(path);
  if (!endpoint) throw new Error('Could not resolve the admin endpoint.');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh the page and sign in again.');
  }

  const url = new URL(endpoint);
  Object.entries(options.searchParams ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'The admin request could not be completed.');
  return payload as T;
}

function parseWorkspaceTab(value: string | string[] | undefined): MosqueWorkspaceTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'admins' || raw === 'muezzins') return raw;
  return 'overview';
}

function generateLiveStreamSecret(prefix: string) {
  const randomId =
    typeof globalThis !== 'undefined' && 'crypto' in globalThis && typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${randomId}`;
}

async function loadMosqueWorkspaceViaServer(mosqueId: string): Promise<MosqueWorkspacePayload> {
  if (!supportsServerApi()) throw new Error('Mosque workspace API is unavailable in this runtime.');
  const endpoint = resolveApiUrl('/api/admin/mosque-workspace');
  if (!endpoint) throw new Error('Could not resolve the mosque workspace endpoint.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) throw new Error('Your session has expired. Refresh the page and sign in again.');
  const url = new URL(endpoint);
  url.searchParams.set('mosqueId', mosqueId);
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Unable to load this mosque workspace.');
  return {
    mosque: payload.mosque as MosqueRow,
    mosques: (payload.mosques ?? []) as MosqueRow[],
    admins: (payload.admins ?? []) as MosqueAdmin[],
    muezzins: (payload.muezzins ?? []) as MuezzinRow[],
    people: (payload.people ?? []) as AssignmentUser[],
    upstreamState: (payload.upstreamState ?? null) as UpstreamStateRow | null,
  };
}

export default function MosqueProfilePage() {
  return (
    <RequireMainAdmin>
      <AdminContextProvider>
        <AdminFeedbackProvider>
          <MosqueProfileShell />
        </AdminFeedbackProvider>
      </AdminContextProvider>
    </RequireMainAdmin>
  );
}

function MosqueProfileShell() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const routeIdRaw = params?.id;
  const routeId = Array.isArray(routeIdRaw) ? routeIdRaw[0] : routeIdRaw;
  const routeTab = parseWorkspaceTab(params?.tab);
  const router = useRouter();
  const { selectedMosqueId, setSelectedMosqueId } = useAdminContext();
  const { notifyError, notifySuccess } = useAdminFeedback();
  const { isCompact, isPhone } = useAdminViewport();

  const mosqueId = routeId || selectedMosqueId || '';
  const currentMosqueIdRef = useRef(mosqueId);
  currentMosqueIdRef.current = mosqueId;
  const [tab, setTab] = useState<MosqueWorkspaceTab>(routeTab);

  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [admins, setAdmins] = useState<MosqueAdmin[]>([]);
  const [muezzins, setMuezzins] = useState<MuezzinRow[]>([]);
  const [peopleById, setPeopleById] = useState<Record<string, AssignmentUser>>({});
  const [upstreamState, setUpstreamState] = useState<UpstreamStateRow | null>(null);
  const [broadcastReadiness, setBroadcastReadiness] = useState<BroadcastReadinessPayload | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [readinessMutation, setReadinessMutation] = useState<BroadcastReadinessPostAction | null>(null);
  const readinessRequestIdRef = useRef(0);
  const readinessAbortRef = useRef<AbortController | null>(null);

  // Invite modals
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [addAdminEmail, setAddAdminEmail] = useState('');
  const [addAdminDisplayName, setAddAdminDisplayName] = useState('');
  const [addAdminError, setAddAdminError] = useState<string | null>(null);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addMuezzinOpen, setAddMuezzinOpen] = useState(false);
  const [addMuezzinEmail, setAddMuezzinEmail] = useState('');
  const [addMuezzinDisplayName, setAddMuezzinDisplayName] = useState('');
  const [addMuezzinError, setAddMuezzinError] = useState<string | null>(null);
  const [addingMuezzin, setAddingMuezzin] = useState(false);
  const [savingDefaultMuezzin, setSavingDefaultMuezzin] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<EditMosqueMode>('profile');
  const [editForm, setEditForm] = useState({
    name: '', city: '', country: '', status: 'pending',
    lat: '', lng: '',
    allowMultiMosqueLocalAdmins: false,
    prayerSource: 'aladhan' as 'aladhan' | 'elm',
    prayerCalculationMethod: DEFAULT_ALADHAN_METHOD,
    prayerSchool: 0,
    liveStreamEnabled: false,
    liveStreamProvider: 'external',
    liveStreamPlaybackUrl: '',
    liveStreamIngestUrl: '',
    liveStreamMountPath: '',
    liveStreamUsername: '',
    liveStreamStreamKey: '',
    liveStreamStatusSecret: '',
    liveStreamListenerSecret: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; consequence: string;
    variant: 'danger' | 'warning' | 'neutral'; onConfirm: () => void;
  }>({ open: false, title: '', description: '', consequence: '', variant: 'neutral', onConfirm: () => {} });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const confirm = (opts: Omit<typeof confirmState, 'open'>) => setConfirmState({ open: true, ...opts });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  const refreshBroadcastReadiness = useCallback(async (targetMosqueId: string) => {
    if (!targetMosqueId) return;
    const requestId = readinessRequestIdRef.current + 1;
    readinessRequestIdRef.current = requestId;
    readinessAbortRef.current?.abort();
    const controller = new AbortController();
    readinessAbortRef.current = controller;
    setReadinessLoading(true);
    setReadinessError(null);

    try {
      const payload = await requestAdminApi<BroadcastReadinessPayload>('/api/admin/broadcast-readiness', {
        searchParams: { mosqueId: targetMosqueId },
        signal: controller.signal,
      });
      if (readinessRequestIdRef.current === requestId && !controller.signal.aborted) {
        setBroadcastReadiness(payload);
      }
    } catch (error) {
      if (controller.signal.aborted || readinessRequestIdRef.current !== requestId) return;
      setReadinessError(error instanceof Error ? error.message : 'Unable to load broadcast readiness.');
    } finally {
      if (readinessRequestIdRef.current === requestId && !controller.signal.aborted) {
        setReadinessLoading(false);
      }
    }
  }, []);

  const upsertPeople = (rows: AssignmentUser[]) => {
    if (!rows?.length) return;
    setPeopleById((prev) => {
      const next = { ...prev };
      rows.forEach((u) => { if (u?.id) next[u.id] = u; });
      return next;
    });
  };

  useEffect(() => {
    if (routeId && selectedMosqueId !== routeId) setSelectedMosqueId(routeId);
  }, [routeId, selectedMosqueId, setSelectedMosqueId]);

  useEffect(() => {
    setTab((prev) => (prev === routeTab ? prev : routeTab));
  }, [routeTab]);

  useEffect(() => {
    if (!mosqueId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorBanner(null);
      setMosque(null); setAdmins([]); setMuezzins([]); setPeopleById({}); setUpstreamState(null);
      try {
        const payload = await loadMosqueWorkspaceViaServer(mosqueId);
        if (!cancelled) {
          setMosque(payload.mosque ?? null);
          setMosquesForSelector(payload.mosques ?? []);
          setAdmins(payload.admins ?? []);
          setMuezzins(payload.muezzins ?? []);
          setUpstreamState(payload.upstreamState ?? null);
          setPeopleById(() => {
            const next: Record<string, AssignmentUser> = {};
            (payload.people ?? []).forEach((p) => { if (p?.id) next[p.id] = p; });
            return next;
          });
        }
      } catch (error) {
        if (!cancelled) setErrorBanner(error instanceof Error ? error.message : 'Unable to load data. Check console logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mosqueId]);

  useEffect(() => {
    setBroadcastReadiness(null);
    setReadinessError(null);
    if (!mosqueId) return;
    void refreshBroadcastReadiness(mosqueId);
    return () => {
      readinessRequestIdRef.current += 1;
      readinessAbortRef.current?.abort();
    };
  }, [mosqueId, refreshBroadcastReadiness]);

  useEffect(() => {
    if (!mosque) return;
    setEditForm({
      name: mosque.name ?? '',
      city: mosque.city ?? '',
      country: mosque.country ?? '',
      status: mosque.status ?? 'pending',
      lat: mosque.lat != null ? String(mosque.lat) : '',
      lng: mosque.lng != null ? String(mosque.lng) : '',
      allowMultiMosqueLocalAdmins: !!mosque.allow_multi_mosque_local_admins,
      prayerSource: (mosque.prayer_source === 'elm' ? 'elm' : 'aladhan') as 'aladhan' | 'elm',
      prayerCalculationMethod: mosque.prayer_calculation_method ?? DEFAULT_ALADHAN_METHOD,
      prayerSchool: mosque.prayer_school ?? 0,
      liveStreamEnabled: !!mosque.live_stream_enabled,
      liveStreamProvider: normalizeLiveStreamProvider(mosque.live_stream_provider),
      liveStreamPlaybackUrl: mosque.live_stream_playback_url ?? '',
      liveStreamIngestUrl: mosque.live_stream_ingest_url ?? '',
      liveStreamMountPath: mosque.live_stream_mount_path ?? '',
      liveStreamUsername: mosque.live_stream_username ?? '',
      liveStreamStreamKey: mosque.live_stream_stream_key ?? '',
      liveStreamStatusSecret: mosque.live_stream_status_secret ?? '',
      liveStreamListenerSecret: mosque.live_stream_listener_secret ?? '',
    });
  }, [mosque]);

  const mosqueOptions = useMemo<MosqueOption[]>(
    () => mosquesForSelector.map((m) => ({ id: m.id, name: m.name ?? 'Mosque', city: m.city ?? null, country: m.country ?? null, status: m.status ?? null })),
    [mosquesForSelector]
  );

  const locationLabel = [mosque?.city, mosque?.country].filter(Boolean).join(', ');
  const status = mosque?.status ?? null;
  const mosqueName = mosque?.name ?? 'Mosque';
  const allowMultiMosqueLocalAdmins = !!mosque?.allow_multi_mosque_local_admins;
  const liveStreamEnabled = !!mosque?.live_stream_enabled;
  const liveStreamProvider = normalizeLiveStreamProvider(mosque?.live_stream_provider);
  const liveStreamProviderProfile = getLiveStreamProviderProfile(liveStreamProvider);
  const liveStreamPlaybackUrl = mosque?.live_stream_playback_url?.trim() || '';
  const liveStreamIngestUrl = mosque?.live_stream_ingest_url?.trim() || '';
  const liveStreamMountPath = mosque ? resolveLiveStreamMountPath(mosque) || '' : '';
  const liveStreamUsername = mosque?.live_stream_username?.trim() || '';
  const liveStreamStreamKeyConfigured = !!mosque?.live_stream_stream_key?.trim();
  const liveStreamStatusSecret = mosque?.live_stream_status_secret?.trim() || '';
  const liveStreamListenerSecret = mosque ? resolveLiveStreamListenerSecret(mosque) || '' : '';
  const editCityIsLondon = editForm.city.trim().toLowerCase().includes('london');
  const effectivePrayerSource = editCityIsLondon ? editForm.prayerSource : 'aladhan';
  const editProviderProfile = useMemo(() => getLiveStreamProviderProfile(editForm.liveStreamProvider), [editForm.liveStreamProvider]);
  const editProviderUsesExternalEncoder = editProviderProfile.supportsExternalEncoder;
  const editProviderUsesStreamCredential = editProviderProfile.supportsExternalEncoder || editProviderProfile.requiresStreamKey;
  const editProviderUsesSecrets = editProviderProfile.supportsExternalEncoder || editProviderProfile.requiresListenerSecret;
  const liveStreamCallbackUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      const resolved = supportsServerApi() ? resolveApiUrl('/api/integrations/live-stream-provider-status') : null;
      return resolved || `${window.location.origin}/api/integrations/live-stream-provider-status`;
    }
    return '/api/integrations/live-stream-provider-status';
  }, []);
  const upstreamStatusLabel = upstreamState?.provider_status
    ? `${upstreamState.provider_status.charAt(0).toUpperCase()}${upstreamState.provider_status.slice(1)}`
    : 'No signal';
  const upstreamLastSeenLabel = upstreamState?.last_seen_at
    ? new Date(upstreamState.last_seen_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const metaRowStyle = { ...styles.metaRow, ...(isPhone ? styles.metaRowPhone : null) };
  const idTextStyle = { ...styles.idText, ...(isPhone ? styles.idTextPhone : null) };

  const updateSelector = (patch: Partial<MosqueRow>) =>
    setMosquesForSelector((prev) => prev.map((m) => (m.id === mosqueId ? { ...m, ...patch } : m)));

  const setActiveTab = (nextTab: MosqueWorkspaceTab) => {
    setTab(nextTab);
    router.replace((`/admin/mosques/${mosqueId}${nextTab !== 'overview' ? `?tab=${nextTab}` : ''}`) as any);
  };

  const performReadinessAction = async (action: BroadcastReadinessPostAction, targetMosqueId: string) => {
    if (!targetMosqueId) return;
    const requestId = readinessRequestIdRef.current + 1;
    readinessRequestIdRef.current = requestId;
    readinessAbortRef.current?.abort();
    setReadinessLoading(false);
    setReadinessMutation(action);
    setConfirmLoading(true);
    try {
      const payload = await requestAdminApi<BroadcastReadinessPayload>('/api/admin/broadcast-readiness', {
        method: 'POST',
        body: { mosqueId: targetMosqueId, action },
      });
      if (currentMosqueIdRef.current !== targetMosqueId || readinessRequestIdRef.current !== requestId) return;
      setBroadcastReadiness(payload);
      setReadinessError(null);
      const successMessages: Record<BroadcastReadinessPostAction, string> = {
        provision_stream: 'Dormant broadcast stream provisioned.',
        confirm_readiness: 'Broadcast readiness confirmed.',
        record_test_passed: 'Physical broadcast test recorded.',
        mark_live: 'Mosque marked live-ready.',
        reset_onboarding: 'Broadcast onboarding reset.',
      };
      notifySuccess(successMessages[action]);
    } catch (error) {
      if (currentMosqueIdRef.current === targetMosqueId && readinessRequestIdRef.current === requestId) {
        notifyError(
          'Broadcast readiness update failed.',
          error instanceof Error ? error.message : undefined
        );
      }
    } finally {
      setReadinessMutation(null);
      setConfirmLoading(false);
      closeConfirm();
    }
  };

  const handleReadinessAction = (action: BroadcastReadinessPostAction) => {
    const targetMosqueId = mosqueId;
    const actionCopy: Record<BroadcastReadinessPostAction, {
      title: string;
      description: string;
      consequence: string;
      variant: 'danger' | 'warning' | 'neutral';
    }> = {
      provision_stream: {
        title: 'Provision dormant stream record',
        description: `Create the preconfigured stream record required for ${mosqueName}?`,
        consequence: 'This does not start a broadcast and does not notify followers. Transactional rollout remains externally managed.',
        variant: 'neutral',
      },
      confirm_readiness: {
        title: 'Confirm ready for canary test',
        description: `Confirm that ${mosqueName}'s required setup has been reviewed?`,
        consequence: 'This records an admin readiness decision. It does not start a broadcast or change the external START/END rollout.',
        variant: 'neutral',
      },
      record_test_passed: {
        title: 'Record physical test passed',
        description: `Confirm that ${mosqueName} passed the publisher-and-follower broadcast test?`,
        consequence: 'Only continue after start, live audio, end, cleanup, and restart have all been verified on physical devices.',
        variant: 'warning',
      },
      mark_live: {
        title: 'Mark broadcast onboarding live',
        description: `Approve ${mosqueName} for normal live broadcasting?`,
        consequence: 'This records final launch approval. It does not edit the externally managed START or END rollout configuration.',
        variant: 'warning',
      },
      reset_onboarding: {
        title: 'Reset broadcast onboarding',
        description: `Return ${mosqueName} to broadcast setup pending?`,
        consequence: 'Readiness and test approvals will be reset. Stream configuration and external START/END rollout are not changed.',
        variant: 'danger',
      },
    };
    confirm({
      ...actionCopy[action],
      onConfirm: () => performReadinessAction(action, targetMosqueId),
    });
  };

  const doApprove = async () => {
    if (!mosqueId) return;
    setConfirmLoading(true);
    const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', mosqueId);
    setConfirmLoading(false);
    closeConfirm();
    if (error) { notifyError('Mosque approval failed.'); return; }
    const patch = { status: 'active' };
    setMosque((prev) => (prev ? { ...prev, ...patch } : prev));
    updateSelector(patch);
    notifySuccess('Mosque approved.');
    void refreshBroadcastReadiness(mosqueId);
  };

  const doSuspend = async () => {
    if (!mosqueId) return;
    setConfirmLoading(true);
    const { error } = await supabase.from('mosques').update({ status: 'inactive' }).eq('id', mosqueId);
    setConfirmLoading(false);
    closeConfirm();
    if (error) { notifyError('Mosque deactivation failed.'); return; }
    const patch = { status: 'inactive' };
    setMosque((prev) => (prev ? { ...prev, ...patch } : prev));
    updateSelector(patch);
    notifySuccess('Mosque deactivated.');
    void refreshBroadcastReadiness(mosqueId);
  };

  const doReactivate = async () => {
    if (!mosqueId) return;
    setConfirmLoading(true);
    const { error } = await supabase.from('mosques').update({ status: 'active' }).eq('id', mosqueId);
    setConfirmLoading(false);
    closeConfirm();
    if (error) { notifyError('Reactivation failed.'); return; }
    const patch = { status: 'active' };
    setMosque((prev) => (prev ? { ...prev, ...patch } : prev));
    updateSelector(patch);
    notifySuccess('Mosque reactivated.');
    void refreshBroadcastReadiness(mosqueId);
  };

  const handleStatusAction = () => {
    if (status === 'pending' || status === null) {
      confirm({
        title: `Approve "${mosqueName}"`,
        description: 'This mosque will become publicly active and visible to listeners and staff.',
        consequence: 'Local admins and muezzins assigned to this mosque will gain immediate access.',
        variant: 'warning',
        onConfirm: doApprove,
      });
    } else if (status === 'active') {
      confirm({
        title: `Deactivate "${mosqueName}"`,
        description: 'This mosque will be hidden from discovery and live services will stop.',
        consequence: 'Listeners will lose access and any active broadcast will be cut immediately.',
        variant: 'danger',
        onConfirm: doSuspend,
      });
    } else {
      confirm({
        title: `Reactivate "${mosqueName}"`,
        description: 'This mosque will be restored to active status.',
        consequence: 'All previously assigned staff will regain access immediately.',
        variant: 'warning',
        onConfirm: doReactivate,
      });
    }
  };

  const handleRemoveAdmin = (userId: string) => {
    const user = peopleById[userId];
    confirm({
      title: 'Remove local admin',
      description: `Remove local-admin access for ${user?.email ?? userId} from ${mosqueName}?`,
      consequence: 'They will immediately lose admin access to this mosque.',
      variant: 'danger',
      onConfirm: async () => {
        if (!mosqueId) return;
        setConfirmLoading(true);
        try {
          await removeLocalAdminMembership({ mosqueId, userId });
          setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
          closeConfirm();
          notifySuccess('Local admin removed.');
          void refreshBroadcastReadiness(mosqueId);
        } catch (error) {
          notifyError('Removing local-admin access failed.', error instanceof Error ? error.message : undefined);
          closeConfirm();
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleRemoveMuezzin = (userId: string) => {
    const targetMosqueId = mosqueId;
    const user = peopleById[userId];
    const isDefaultMuezzin = mosque?.default_muezzin_user_id === userId;
    confirm({
      title: 'Remove muezzin',
      description: `Remove muezzin access for ${user?.email ?? userId} from ${mosqueName}?`,
      consequence: isDefaultMuezzin
        ? 'Their default-muezzin fallback will be cleared first. They will then lose muezzin access and cannot start broadcasts for this mosque.'
        : 'They will lose muezzin access and cannot start broadcasts for this mosque.',
      variant: 'danger',
      onConfirm: async () => {
        if (!targetMosqueId) return;
        setConfirmLoading(true);
        try {
          if (isDefaultMuezzin) {
            await requestAdminApi('/api/admin/muezzin-default', {
              method: 'POST',
              body: { mosqueId: targetMosqueId, userId: null },
            });
            if (currentMosqueIdRef.current === targetMosqueId) {
              setMosque((prev) => (prev ? { ...prev, default_muezzin_user_id: null } : prev));
            }
          }
          await removeMuezzinMembership({ mosqueId: targetMosqueId, userId });
          if (currentMosqueIdRef.current !== targetMosqueId) return;
          setMuezzins((prev) => prev.filter((m) => m.user_id !== userId));
          closeConfirm();
          notifySuccess('Muezzin removed.');
          void refreshBroadcastReadiness(targetMosqueId);
        } catch (error) {
          if (currentMosqueIdRef.current === targetMosqueId) {
            notifyError('Removing muezzin access failed.', error instanceof Error ? error.message : undefined);
            closeConfirm();
            void refreshBroadcastReadiness(targetMosqueId);
          }
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const saveDefaultMuezzin = async (userId: string | null, targetMosqueId: string) => {
    if (!targetMosqueId) return;
    setConfirmLoading(true);
    setSavingDefaultMuezzin(userId ?? 'clear');
    try {
      await requestAdminApi<{ defaultMuezzinUserId?: string | null }>('/api/admin/muezzin-default', {
        method: 'POST',
        body: { mosqueId: targetMosqueId, userId },
      });
      if (currentMosqueIdRef.current !== targetMosqueId) return;
      setMosque((prev) => (prev ? { ...prev, default_muezzin_user_id: userId } : prev));
      notifySuccess(
        userId ? 'Default muezzin set.' : 'Default muezzin cleared.',
        userId
          ? `${peopleById[userId]?.email ?? 'This muezzin'} will cover unassigned prayer slots.`
          : 'Unassigned prayer slots now require a rota assignment or mosque-admin override.'
      );
      void refreshBroadcastReadiness(targetMosqueId);
    } catch (error) {
      if (currentMosqueIdRef.current === targetMosqueId) {
        notifyError(
          userId ? 'Unable to set the default muezzin.' : 'Unable to clear the default muezzin.',
          error instanceof Error ? error.message : undefined
        );
      }
    } finally {
      setSavingDefaultMuezzin(null);
      setConfirmLoading(false);
      closeConfirm();
    }
  };

  const handleSetDefaultMuezzin = (userId: string) => {
    const targetMosqueId = mosqueId;
    const userLabel = peopleById[userId]?.email ?? userId;
    confirm({
      title: 'Set default muezzin',
      description: `Set ${userLabel} as the default muezzin for ${mosqueName}?`,
      consequence: 'They may lead an unassigned prayer slot. Existing rota assignments still take priority.',
      variant: 'neutral',
      onConfirm: () => saveDefaultMuezzin(userId, targetMosqueId),
    });
  };

  const handleClearDefaultMuezzin = () => {
    const targetMosqueId = mosqueId;
    confirm({
      title: 'Clear default muezzin',
      description: `Remove the default muezzin fallback for ${mosqueName}?`,
      consequence: 'Unassigned prayer slots will require a rota assignment or mosque-admin override.',
      variant: 'warning',
      onConfirm: () => saveDefaultMuezzin(null, targetMosqueId),
    });
  };

  const handleSaveEdit = async () => {
    if (!mosqueId) return;
    const nextName = editForm.name.trim();
    if (!nextName) { setEditError('Name is required.'); return; }
    const lsp = normalizeLiveStreamProvider(editForm.liveStreamProvider);
    const lspProfile = getLiveStreamProviderProfile(lsp);
    const needsProviderCallbackSecret = lspProfile.supportsExternalEncoder;
    const needsListenerAccessSecret = lspProfile.requiresListenerSecret;
    const liveStreamUsername = editForm.liveStreamUsername.trim();
    const liveStreamStreamKey = editForm.liveStreamStreamKey.trim();
    const liveStreamStatusSecret =
      editForm.liveStreamStatusSecret.trim() ||
      (editForm.liveStreamEnabled && needsProviderCallbackSecret ? generateLiveStreamSecret('ls') : '');
    const liveStreamListenerSecret =
      editForm.liveStreamListenerSecret.trim() ||
      (editForm.liveStreamEnabled && needsListenerAccessSecret ? generateLiveStreamSecret('ll') : '');

    let liveStreamPlaybackUrl: string | null;
    let liveStreamIngestUrl: string | null;
    let liveStreamMountPath: string | null = null;
    try {
      liveStreamPlaybackUrl = lspProfile.requiresPlaybackUrl ? normalizePlaybackUrl(editForm.liveStreamPlaybackUrl) : null;
      liveStreamIngestUrl = lspProfile.supportsExternalEncoder ? normalizeIngestUrl(lsp, editForm.liveStreamIngestUrl) : null;
      liveStreamMountPath = lsp === 'icecast'
        ? normalizeIcecastMountPath(editForm.liveStreamMountPath) || (liveStreamPlaybackUrl ? resolveLiveStreamMountPath({ id: mosqueId, live_stream_provider: lsp, live_stream_playback_url: liveStreamPlaybackUrl }) : null)
        : null;
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Live stream settings are invalid.');
      return;
    }

    if (editForm.liveStreamEnabled && lspProfile.requiresPlaybackUrl && !liveStreamPlaybackUrl) { setEditError('A playback URL is required when live streaming is active.'); return; }
    if (lspProfile.requiresIngestUrl && !liveStreamIngestUrl) { setEditError(`${lspProfile.label} requires an ingest URL.`); return; }
    if (lspProfile.requiresUsername && !liveStreamUsername) { setEditError(`${lspProfile.usernameLabel ?? 'Username'} is required for ${lspProfile.label}.`); return; }
    if (lspProfile.requiresStreamKey && !liveStreamStreamKey) { setEditError(`${lspProfile.credentialLabel} is required for ${lspProfile.label}.`); return; }
    if (lsp === 'icecast' && !liveStreamMountPath) { setEditError('Icecast requires a mount path or a playback URL with a valid path.'); return; }

    const latVal = editForm.lat.trim() ? parseFloat(editForm.lat) : null;
    const lngVal = editForm.lng.trim() ? parseFloat(editForm.lng) : null;
    if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
      setEditError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
      setEditError('Longitude must be a number between -180 and 180.');
      return;
    }

    const payload: Record<string, any> = {
      name: nextName, status: editForm.status,
      city: editForm.city.trim() || null, country: editForm.country.trim() || null,
      lat: latVal, lng: lngVal,
      allow_multi_mosque_local_admins: editForm.allowMultiMosqueLocalAdmins,
      prayer_source: effectivePrayerSource,
      prayer_calculation_method: editForm.prayerCalculationMethod,
      prayer_school: editForm.prayerSchool,
      live_stream_enabled: editForm.liveStreamEnabled,
      live_stream_provider: lsp,
      live_stream_playback_url: lspProfile.requiresPlaybackUrl ? liveStreamPlaybackUrl : null,
      live_stream_ingest_url: lspProfile.supportsExternalEncoder ? liveStreamIngestUrl : null,
      live_stream_mount_path: liveStreamMountPath,
      live_stream_username: lspProfile.supportsExternalEncoder ? liveStreamUsername || null : null,
      live_stream_stream_key: lspProfile.supportsExternalEncoder ? liveStreamStreamKey || null : null,
      live_stream_status_secret: needsProviderCallbackSecret ? liveStreamStatusSecret || null : null,
      live_stream_listener_secret: needsListenerAccessSecret ? liveStreamListenerSecret || null : null,
    };

    setEditError(null);
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('mosques').update(payload).eq('id', mosqueId);
      if (error) { setEditError(error.message || 'Save failed.'); return; }
      setMosque((prev) => (prev ? { ...prev, ...payload } : prev));
      updateSelector(payload);
      setEditOpen(false);
      notifySuccess('Mosque details saved.');
      void refreshBroadcastReadiness(mosqueId);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSetLocalAdminSharingPolicy = async (nextValue: boolean) => {
    if (!mosqueId || nextValue === allowMultiMosqueLocalAdmins) return;
    const { error } = await supabase.from('mosques').update({ allow_multi_mosque_local_admins: nextValue }).eq('id', mosqueId);
    if (error) { notifyError('Policy update failed.', error.message); return; }
    const patch = { allow_multi_mosque_local_admins: nextValue };
    setMosque((prev) => (prev ? { ...prev, ...patch } : prev));
    setEditForm((prev) => ({ ...prev, allowMultiMosqueLocalAdmins: nextValue }));
    updateSelector(patch);
    notifySuccess(nextValue ? 'Cross-mosque local-admin access activated.' : 'Cross-mosque local-admin access set to exclusive.');
  };

  const handleCopyText = async (value: string, successMessage: string) => {
    if (!value) return;
    try { await navigator.clipboard?.writeText(value); notifySuccess(successMessage); }
    catch { notifyError('Unable to copy this value in this browser.'); }
  };

  const handleAddLocalAdmin = async () => {
    if (!mosqueId) return;
    const normalizedEmail = addAdminEmail.trim().toLowerCase();
    if (!normalizedEmail) { setAddAdminError('Email is required.'); return; }
    setAddAdminError(null);
    setAddingAdmin(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) { setAddAdminError('Your session has expired.'); return; }
      const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/admin/local-admin-invite` : '/api/admin/local-admin-invite';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ email: normalizedEmail, displayName: addAdminDisplayName.trim(), mosqueId }),
      });
      const rawResponse = await response.text();
      let payload: { error?: string; invited?: boolean; alreadyAssigned?: boolean; user?: AssignmentUser } = {};
      try { payload = rawResponse ? JSON.parse(rawResponse) : {}; } catch { payload = {}; }
      if (!response.ok || !payload.user) {
        if (payload.error) { setAddAdminError(payload.error); return; }
        if (response.status === 404) { setAddAdminError('Invite endpoint unavailable. Restart Expo in server mode.'); return; }
        setAddAdminError('Unable to add or invite this local admin right now.');
        return;
      }
      const preparedUser = payload.user;
      upsertPeople([preparedUser]);
      setAdmins((prev) => prev.some((a) => a.user_id === preparedUser.id) ? prev : [...prev, { mosque_id: mosqueId, user_id: preparedUser.id }]);
      setAddAdminOpen(false);
      setAddAdminEmail(''); setAddAdminDisplayName('');
      notifySuccess(payload.invited ? 'Local admin invited.' : (payload.alreadyAssigned ? 'Already assigned.' : 'Local admin added.'), `${preparedUser.email ?? preparedUser.id} now manages ${mosqueName}.`);
      void refreshBroadcastReadiness(mosqueId);
    } catch {
      setAddAdminError('Unable to add or invite this local admin right now.');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleAddMuezzin = async () => {
    if (!mosqueId) return;
    const normalizedEmail = addMuezzinEmail.trim().toLowerCase();
    if (!normalizedEmail) { setAddMuezzinError('Email is required.'); return; }
    setAddMuezzinError(null);
    setAddingMuezzin(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) { setAddMuezzinError('Your session has expired.'); return; }
      const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/admin/muezzin-invite` : '/api/admin/muezzin-invite';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ email: normalizedEmail, displayName: addMuezzinDisplayName.trim(), mosqueId }),
      });
      const rawResponse = await response.text();
      let payload: { error?: string; invited?: boolean; alreadyAssigned?: boolean; user?: AssignmentUser } = {};
      try { payload = rawResponse ? JSON.parse(rawResponse) : {}; } catch { payload = {}; }
      if (!response.ok || !payload.user) {
        if (payload.error) { setAddMuezzinError(payload.error); return; }
        if (response.status === 404) { setAddMuezzinError('Invite endpoint unavailable. Restart Expo in server mode.'); return; }
        setAddMuezzinError('Unable to add or invite this muezzin right now.');
        return;
      }
      const preparedUser = payload.user;
      upsertPeople([preparedUser]);
      setMuezzins((prev) => prev.some((m) => m.user_id === preparedUser.id)
        ? prev.map((m) => m.user_id === preparedUser.id ? { ...m, is_active: true } : m)
        : [...prev, { mosque_id: mosqueId, user_id: preparedUser.id, is_active: true }]);
      setAddMuezzinOpen(false);
      setAddMuezzinEmail(''); setAddMuezzinDisplayName('');
      notifySuccess(payload.invited ? 'Muezzin invited.' : (payload.alreadyAssigned ? 'Already assigned.' : 'Muezzin added.'), `${preparedUser.email ?? preparedUser.id} now serves ${mosqueName}.`);
      void refreshBroadcastReadiness(mosqueId);
    } catch {
      setAddMuezzinError('Unable to add or invite this muezzin right now.');
    } finally {
      setAddingMuezzin(false);
    }
  };

  const getReadinessCheckAction = (check: BroadcastReadinessPayload['checks'][number]) => {
    if (check.status === 'pass' || !check.action) return null;
    if (check.key === 'stream_record' && broadcastReadiness?.actions.canProvision) {
      return {
        label: 'Provision stream',
        onClick: () => handleReadinessAction('provision_stream'),
      };
    }
    switch (check.action) {
      case 'profile':
        return {
          label: 'Edit profile',
          onClick: () => { setEditMode('profile'); setEditError(null); setEditOpen(true); },
        };
      case 'live_stream':
        return {
          label: 'Edit live stream',
          onClick: () => { setEditMode('live-stream'); setEditError(null); setEditOpen(true); },
        };
      case 'admins':
        return { label: 'Manage admins', onClick: () => setActiveTab('admins') };
      case 'muezzins':
        return { label: 'Manage muezzins', onClick: () => setActiveTab('muezzins') };
      case 'prayer_times':
        return {
          label: 'Prayer times',
          onClick: () => router.push(`/admin/mosques/${mosqueId}/prayer-times` as any),
        };
      case 'operator':
        return {
          label: 'Copy mosque ID',
          onClick: () => handleCopyText(mosqueId, 'Mosque ID copied for the rollout operator.'),
        };
      default:
        return null;
    }
  };

  const readinessBusy = readinessLoading || readinessMutation !== null;
  const readinessActionDisabled = readinessBusy || readinessError !== null;
  const readinessNeedsAttention = !!broadcastReadiness && broadcastReadiness.stage !== 'setup_pending' && (
    !broadcastReadiness.testReady ||
    broadcastReadiness.rollout.state === 'partial' ||
    ((broadcastReadiness.stage === 'test_passed' || broadcastReadiness.stage === 'live') &&
      broadcastReadiness.rollout.state !== 'enabled') ||
    (broadcastReadiness.stage === 'live' && !broadcastReadiness.launchReady)
  );
  const readinessStageStyle = readinessNeedsAttention
    ? styles.readinessStageAttention
    : broadcastReadiness?.stage === 'live'
    ? styles.readinessStageSuccess
    : broadcastReadiness?.stage === 'test_passed'
    ? styles.readinessStageInfo
    : broadcastReadiness?.stage === 'ready_for_test'
    ? styles.readinessStageReady
    : styles.readinessStagePending;
  const rolloutLabel = broadcastReadiness?.rollout.state === 'enabled'
    ? 'Transactional START/END enabled'
    : broadcastReadiness?.rollout.state === 'partial'
    ? 'Partial rollout'
    : 'Not enabled';

  const commandActions = [
    { key: 'mosque-back', label: 'Back to mosque directory', description: 'Return to the main mosque list.', keywords: ['back', 'directory'], onSelect: () => router.push('/admin/mosques' as any) },
    { key: 'mosque-edit', label: 'Edit mosque', description: 'Open the profile and status editor.', keywords: ['edit', 'mosque', 'profile'], onSelect: () => setEditOpen(true) },
    { key: 'mosque-prayer-times', label: 'Open prayer times workspace', description: 'Manage timetable uploads for this mosque.', keywords: ['prayer', 'times', 'timetable'], onSelect: () => router.push(`/admin/mosques/${mosqueId}/prayer-times` as any) },
    { key: 'mosque-copy-id', label: 'Copy mosque ID', description: 'Copy to clipboard.', keywords: ['copy', 'id'], onSelect: () => handleCopyText(mosque?.id ?? '', 'Mosque ID copied.') },
  ];

  // Status action label
  const statusActionLabel = status === 'active' ? 'Deactivate' : status === 'inactive' ? 'Reactivate' : 'Approve';
  const statusActionVariant = status === 'active' ? 'danger' : 'secondary';

  if (!mosqueId) {
    return (
      <AdminShell title="Mosque workspace" eyebrow="Directory & Approval" mosques={[]} notices={<div role="alert" style={styles.errorBanner}>Missing mosque ID.</div>}>
        <div />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={mosqueName}
      breadcrumbs={[{ label: 'Dashboard', href: '/admin' }, { label: 'Mosques', href: '/admin/mosques' }, { label: mosqueName }]}
      description={locationLabel || 'Manage status, assignments, and configuration for this mosque.'}
      mosques={mosqueOptions}
      commandActions={commandActions}
      notices={errorBanner ? <div role="alert" style={styles.errorBanner}>{errorBanner}</div> : null}
      actions={
        <>
          <Button variant="ghost" onClick={() => router.push('/admin/mosques' as any)}>
            ← Mosques
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/admin/mosques/${mosqueId}/prayer-times` as any)}>
            Prayer times
          </Button>
          <Button variant="primary" onClick={() => setEditOpen(true)} disabled={!mosque}>
            Edit mosque
          </Button>
          <Button variant={statusActionVariant as any} onClick={handleStatusAction} disabled={!mosque || loading}>
            {statusActionLabel}
          </Button>
        </>
      }
    >
      <div style={styles.metricGrid}>
        <AdminMetricCard label="Status" value={status ?? 'unknown'} detail="Current approval and activity state" />
        <AdminMetricCard label="Local admins" value={admins.length} detail="Assigned mosque-scoped admins" />
        <AdminMetricCard label="Muezzins" value={muezzins.length} detail="Assigned muezzin accounts" />
        <AdminMetricCard label="Cross-mosque admins" value={allowMultiMosqueLocalAdmins ? 'shared' : 'exclusive'} detail="Local admin scope policy" />
        <AdminMetricCard label="Created" value={mosque?.created_at ? new Date(mosque.created_at).toLocaleDateString() : '—'} detail="Directory registration date" />
      </div>

      {/* Tabs */}
      <div style={styles.tabRow} role="tablist" aria-label="Mosque workspace sections">
        {(['overview', 'admins', 'muezzins'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`adm-tab${tab === key ? ' adm-tab-active' : ''}`}
            style={tab === key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(key)}
          >
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' ? (
        <div style={{ ...styles.overviewGrid, ...(isCompact ? styles.overviewGridCompact : null) }}>
          <AdminPanel
            title="Core profile"
            subtitle="Key directory data and identifiers for this mosque."
            action={<Button variant="ghost" onClick={() => { setEditMode('profile'); setEditError(null); setEditOpen(true); }}>Edit profile</Button>}
          >
            <div style={styles.metaList}>
              {[
                ['Name', mosqueName],
                ['Status', <Pill key="s" status={status} />],
                ['City', mosque?.city?.trim() || '—'],
                ['Country', mosque?.country?.trim() || '—'],
                ['Coordinates', mosque?.lat != null && mosque?.lng != null
                  ? `${mosque.lat.toFixed(5)}, ${mosque.lng.toFixed(5)}`
                  : <span key="coords" style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>Not set — prayer times will not auto-calculate</span>],
                ['Registered', mosque?.created_at ? new Date(mosque.created_at).toLocaleString() : '—'],
                ['Prayer method', ALADHAN_METHODS.find(m => m.id === (mosque?.prayer_calculation_method ?? DEFAULT_ALADHAN_METHOD))?.label ?? 'Muslim World League (MWL)'],
                ['Asr school', (mosque?.prayer_school ?? 0) === 1 ? 'Hanafi (shadow 2×)' : 'Shafi / standard (shadow 1×)'],
                ['Live stream provider', liveStreamProviderProfile.label],
                ['Mosque ID', <span key="id" style={idTextStyle}>{mosque?.id ?? '—'}</span>],
              ].map(([label, value]) => (
                <div key={String(label)} style={metaRowStyle}>
                  <span style={styles.metaLabel}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            <div style={styles.inlineActions}>
              <Button variant="ghost" onClick={() => handleCopyText(mosque?.id ?? '', 'Mosque ID copied.')}>Copy mosque ID</Button>
            </div>
          </AdminPanel>

          <AdminPanel title="Local admin scope policy" subtitle="Whether admins assigned here may also manage other mosques.">
            <div style={styles.metaList}>
              <div style={metaRowStyle}>
                <span style={styles.metaLabel}>Cross-mosque access</span>
                <Pill status={allowMultiMosqueLocalAdmins ? 'active' : 'inactive'} />
              </div>
              <div style={styles.helperText}>
                {allowMultiMosqueLocalAdmins
                  ? 'Active: local admins here may also manage other mosques that allow sharing.'
                  : 'Exclusive: local admins here are dedicated to this mosque only.'}
              </div>
            </div>
            <div style={styles.toggleRow}>
              <Button variant={allowMultiMosqueLocalAdmins ? 'primary' : 'ghost'} onClick={() => handleSetLocalAdminSharingPolicy(true)} disabled={allowMultiMosqueLocalAdmins} aria-pressed={allowMultiMosqueLocalAdmins}>Shared</Button>
              <Button variant={!allowMultiMosqueLocalAdmins ? 'primary' : 'ghost'} onClick={() => handleSetLocalAdminSharingPolicy(false)} disabled={!allowMultiMosqueLocalAdmins} aria-pressed={!allowMultiMosqueLocalAdmins}>Exclusive</Button>
            </div>
          </AdminPanel>

          <div style={styles.readinessPanelWrapper}>
            <AdminPanel
              title="Broadcast readiness"
              subtitle="Complete and verify each gate before enabling production live adhans for this mosque."
              action={(
                <Button
                  variant="ghost"
                  onClick={() => refreshBroadcastReadiness(mosqueId)}
                  disabled={readinessBusy}
                >
                  {readinessLoading ? 'Refreshing…' : 'Refresh'}
                </Button>
              )}
            >
              {readinessError ? (
                <div role="alert" style={styles.readinessError}>
                  <div>
                    <div style={styles.readinessErrorTitle}>Readiness could not be refreshed</div>
                    <div style={styles.readinessErrorText}>{readinessError}</div>
                  </div>
                  <Button variant="ghost" onClick={() => refreshBroadcastReadiness(mosqueId)} disabled={readinessBusy}>Try again</Button>
                </div>
              ) : null}

              {!broadcastReadiness && readinessLoading ? (
                <div role="status" aria-live="polite" style={styles.readinessLoading}>
                  Checking mosque configuration, staff, timetable, stream state, and rollout…
                </div>
              ) : null}

              {!broadcastReadiness && !readinessLoading && !readinessError ? (
                <div style={styles.muted}>Readiness information is not available yet.</div>
              ) : null}

              {broadcastReadiness ? (
                <>
                  <div style={{ ...styles.readinessSummary, ...(isCompact ? styles.readinessSummaryCompact : null), ...readinessStageStyle }}>
                    <div style={styles.readinessSummaryCopy}>
                      <div style={styles.readinessEyebrow}>Onboarding stage</div>
                      <div style={styles.readinessStageLabel}>
                        {readinessNeedsAttention ? 'Attention required' : broadcastReadiness.stageLabel}
                      </div>
                      <div style={styles.readinessSummaryDetail}>
                        {broadcastReadiness.requiredComplete} of {broadcastReadiness.requiredTotal} required checks complete
                        {readinessNeedsAttention ? ` · Saved stage: ${broadcastReadiness.stageLabel}` : ''}
                      </div>
                    </div>
                    <div style={{ ...styles.readinessSummaryFacts, ...(isCompact ? styles.readinessSummaryFactsCompact : null) }}>
                      <span style={styles.readinessFact}>Test {broadcastReadiness.testReady ? 'ready' : 'not ready'}</span>
                      <span style={styles.readinessFact}>Launch {broadcastReadiness.launchReady ? 'ready' : 'not ready'}</span>
                      <span style={styles.readinessFact}>
                        {broadcastReadiness.stream.count === 1
                          ? (broadcastReadiness.stream.isLive ? 'Stream currently live' : 'Dormant stream ready')
                          : `${broadcastReadiness.stream.count} stream records`}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Required broadcast readiness checks"
                      aria-valuemin={0}
                      aria-valuemax={broadcastReadiness.requiredTotal}
                      aria-valuenow={broadcastReadiness.requiredComplete}
                      style={styles.readinessProgressTrack}
                    >
                      <div
                        style={{
                          ...styles.readinessProgressValue,
                          width: `${broadcastReadiness.requiredTotal
                            ? Math.min(100, Math.round((broadcastReadiness.requiredComplete / broadcastReadiness.requiredTotal) * 100))
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div style={styles.readinessCheckList} aria-label="Broadcast readiness checklist">
                    {broadcastReadiness.checks.map((check) => {
                      const action = getReadinessCheckAction(check);
                      const checkTone = check.status === 'pass'
                        ? styles.readinessCheckPass
                        : check.status === 'warning'
                        ? styles.readinessCheckWarning
                        : styles.readinessCheckBlocker;
                      return (
                        <div key={check.key} style={{ ...styles.readinessCheck, ...checkTone }}>
                          <span
                            style={{
                              ...styles.readinessCheckIcon,
                              ...(check.status === 'pass'
                                ? styles.readinessCheckIconPass
                                : check.status === 'warning'
                                ? styles.readinessCheckIconWarning
                                : styles.readinessCheckIconBlocker),
                            }}
                            aria-hidden="true"
                          >
                            {check.status === 'pass' ? '✓' : check.status === 'warning' ? '!' : '×'}
                          </span>
                          <div style={styles.readinessCheckCopy}>
                            <div style={styles.readinessCheckTitleRow}>
                              <span style={styles.readinessCheckTitle}>{check.label}</span>
                              <span style={styles.readinessRequirement}>
                                {check.requiredFor === 'advisory' ? 'Advisory' : `Required for ${check.requiredFor}`}
                              </span>
                            </div>
                            <div style={styles.readinessCheckDetail}>{check.detail}</div>
                          </div>
                          {action ? (
                            <Button variant="ghost" onClick={action.onClick} disabled={readinessActionDisabled}>
                              {action.label}
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {(broadcastReadiness.actions.canConfirmReadiness ||
                    broadcastReadiness.actions.canRecordTestPassed ||
                    broadcastReadiness.actions.canMarkLive ||
                    broadcastReadiness.actions.canReset) ? (
                    <div style={styles.readinessActions} aria-label="Broadcast onboarding actions">
                      {broadcastReadiness.actions.canConfirmReadiness ? (
                        <Button onClick={() => handleReadinessAction('confirm_readiness')} disabled={readinessActionDisabled}>
                          {readinessMutation === 'confirm_readiness' ? 'Confirming…' : 'Confirm ready for test'}
                        </Button>
                      ) : null}
                      {broadcastReadiness.actions.canRecordTestPassed ? (
                        <Button variant="secondary" onClick={() => handleReadinessAction('record_test_passed')} disabled={readinessActionDisabled}>
                          {readinessMutation === 'record_test_passed' ? 'Recording…' : 'Record test passed'}
                        </Button>
                      ) : null}
                      {broadcastReadiness.actions.canMarkLive ? (
                        <Button onClick={() => handleReadinessAction('mark_live')} disabled={readinessActionDisabled}>
                          {readinessMutation === 'mark_live' ? 'Updating…' : 'Mark live'}
                        </Button>
                      ) : null}
                      {broadcastReadiness.actions.canReset ? (
                        <Button variant="danger" onClick={() => handleReadinessAction('reset_onboarding')} disabled={readinessActionDisabled}>
                          {readinessMutation === 'reset_onboarding' ? 'Resetting…' : 'Reset onboarding'}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    style={{
                      ...styles.readinessRollout,
                      ...(broadcastReadiness.rollout.state === 'partial'
                        ? styles.readinessRolloutWarning
                        : broadcastReadiness.rollout.state === 'enabled'
                        ? styles.readinessRolloutSuccess
                        : null),
                    }}
                  >
                    <div style={styles.readinessRolloutHeader}>
                      <div>
                        <div style={styles.readinessEyebrow}>Transactional rollout</div>
                        <div style={styles.readinessRolloutTitle}>{rolloutLabel}</div>
                      </div>
                      <div style={styles.readinessRolloutGates}>
                        <span style={broadcastReadiness.rollout.startTransactional ? styles.rolloutGateOn : styles.rolloutGateOff}>
                          START {broadcastReadiness.rollout.startTransactional ? 'transactional' : 'legacy'}
                        </span>
                        <span style={broadcastReadiness.rollout.endTransactional ? styles.rolloutGateOn : styles.rolloutGateOff}>
                          END {broadcastReadiness.rollout.endTransactional ? 'transactional' : 'legacy'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.readinessRolloutText}>
                      {broadcastReadiness.rollout.state === 'partial'
                        ? 'Do not run the physical canary until both START and END are transactional for this mosque.'
                        : broadcastReadiness.rollout.state === 'enabled'
                        ? 'Both transactional paths are enabled for this deployment. Complete the physical publisher-and-follower canary before launch approval.'
                        : 'A deployment operator must add this mosque to both transactional allowlists and deploy before the physical canary.'}
                      {broadcastReadiness.rollout.managedExternally
                        ? ' The portal deliberately does not edit deployment environment variables.'
                        : ''}
                    </div>
                  </div>

                  <div style={styles.readinessAudit}>
                    <div style={styles.readinessAuditTitle}>Recent admin activity</div>
                    {broadcastReadiness.auditEvents.length ? (
                      <div style={styles.readinessAuditList}>
                        {broadcastReadiness.auditEvents.slice(0, 5).map((event) => (
                          <div key={event.id} style={styles.readinessAuditEvent}>
                            <div style={styles.readinessAuditEventHeader}>
                              <span style={styles.readinessAuditEventName}>{event.eventType.replace(/_/g, ' ')}</span>
                              <time dateTime={event.createdAt} style={styles.readinessAuditTime}>
                                {new Date(event.createdAt).toLocaleString()}
                              </time>
                            </div>
                            {event.fromStage || event.toStage ? (
                              <div style={styles.readinessAuditTransition}>
                                {(event.fromStage ?? '—').replace(/_/g, ' ')} → {(event.toStage ?? '—').replace(/_/g, ' ')}
                              </div>
                            ) : null}
                            {event.notes ? <div style={styles.readinessAuditNotes}>{event.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.muted}>No broadcast-onboarding changes have been recorded yet.</div>
                    )}
                  </div>
                </>
              ) : null}
            </AdminPanel>
          </div>

          <AdminPanel
            title="Live stream config"
            subtitle="Playback URL and provider credentials for follower listening."
            action={<Button variant="ghost" onClick={() => { setEditMode('live-stream'); setEditError(null); setEditOpen(true); }}>Edit live stream</Button>}
          >
            <div style={styles.metaList}>
              {[
                ['Live streaming', <Pill key="ls" status={liveStreamEnabled ? 'active' : 'inactive'} />],
                ['Provider', liveStreamProviderProfile.label],
                ['Playback URL', <span key="pu" style={idTextStyle}>{liveStreamPlaybackUrl || '—'}</span>],
                ['Ingest URL', <span key="iu" style={idTextStyle}>{liveStreamIngestUrl || '—'}</span>],
                ['Mount path', <span key="mp" style={idTextStyle}>{liveStreamMountPath || '—'}</span>],
                ...(liveStreamProviderProfile.usernameLabel ? [[liveStreamProviderProfile.usernameLabel, liveStreamUsername || '—']] : []),
                [liveStreamProviderProfile.credentialLabel, liveStreamStreamKeyConfigured ? 'Configured' : 'Not set'],
                ['Listener access secret', liveStreamListenerSecret ? 'Configured' : 'Not set'],
              ].map(([label, value]) => (
                <div key={String(label)} style={metaRowStyle}>
                  <span style={styles.metaLabel}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            <div style={styles.inlineActions}>
              {liveStreamMountPath ? <Button variant="ghost" onClick={() => handleCopyText(liveStreamMountPath, 'Mount path copied.')}>Copy mount path</Button> : null}
              <Button variant="ghost" onClick={() => handleCopyText(liveStreamCallbackUrl, 'Callback URL copied.')}>Copy callback URL</Button>
              {liveStreamStatusSecret ? <Button variant="ghost" onClick={() => handleCopyText(liveStreamStatusSecret, 'Callback secret copied.')}>Copy callback secret</Button> : null}
              {liveStreamListenerSecret ? <Button variant="ghost" onClick={() => handleCopyText(liveStreamListenerSecret, 'Listener secret copied.')}>Copy listener secret</Button> : null}
            </div>
          </AdminPanel>

          <AdminPanel title="Provider callback state" subtitle="Latest upstream encoder signal received for this mosque.">
            <div style={styles.metaList}>
              {[
                ['Provider status', upstreamStatusLabel],
                ['Encoder connected', upstreamState?.encoder_connected ? 'Yes' : 'No'],
                ['Playback active', upstreamState?.playback_active ? 'Yes' : 'No'],
                ['Last signal', upstreamLastSeenLabel || '—'],
                ['Provider stream ID', <span key="ps" style={idTextStyle}>{upstreamState?.provider_stream_id?.trim() || '—'}</span>],
              ].map(([label, value]) => (
                <div key={String(label)} style={metaRowStyle}>
                  <span style={styles.metaLabel}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            {upstreamState?.provider_message?.trim() ? (
              <div style={styles.helperText}>{upstreamState.provider_message.trim()}</div>
            ) : (
              <div style={styles.helperText}>No provider callback received yet. Configure your encoder to POST to the callback URL above.</div>
            )}
          </AdminPanel>
        </div>
      ) : null}

      {/* Admins tab */}
      {tab === 'admins' ? (
        <AdminPanel
          title="Local admin assignments"
          subtitle={`Manage local admins for ${mosqueName}.`}
          action={
            <>
              <Button variant="ghost" onClick={() => router.push('/admin/users' as any)}>Global users</Button>
              <Button variant="secondary" onClick={() => { setAddAdminError(null); setAddAdminEmail(''); setAddAdminDisplayName(''); setAddAdminOpen(true); }}>Add or invite</Button>
            </>
          }
        >
          <div style={styles.chipRow}>
            {admins.map((a) => {
              const user = peopleById[a.user_id];
              return (
                <span key={a.user_id} style={styles.chip}>
                  {user?.email ?? a.user_id}
                  <button
                    type="button"
                    className="adm-chip-remove"
                    style={styles.chipRemove}
                    onClick={() => handleRemoveAdmin(a.user_id)}
                    aria-label={`Remove local admin ${user?.email ?? a.user_id}`}
                    disabled={loading}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            {!admins.length ? <span style={styles.muted}>No local admins assigned.</span> : null}
          </div>
        </AdminPanel>
      ) : null}

      {/* Muezzins tab */}
      {tab === 'muezzins' ? (
        <AdminPanel
          title="Muezzin assignments"
          subtitle={`Manage muezzins for ${mosqueName}.`}
          action={
            <>
              <Button variant="ghost" onClick={() => router.push('/admin/users' as any)}>Global users</Button>
              {mosque?.default_muezzin_user_id ? (
                <Button
                  variant="ghost"
                  onClick={handleClearDefaultMuezzin}
                  disabled={savingDefaultMuezzin !== null || loading}
                >
                  Clear default
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => { setAddMuezzinError(null); setAddMuezzinEmail(''); setAddMuezzinDisplayName(''); setAddMuezzinOpen(true); }}>Add or invite</Button>
            </>
          }
        >
          <div style={styles.chipRow}>
            {muezzins.map((m) => {
              const user = peopleById[m.user_id];
              const isDefault = mosque?.default_muezzin_user_id === m.user_id;
              return (
                <span key={m.user_id} style={styles.chipGreen}>
                  {user?.email ?? m.user_id}
                  <span style={styles.chipStatus}>{isDefault ? 'Default' : (m.is_active !== false ? 'active' : 'inactive')}</span>
                  {!isDefault ? (
                    <button
                      type="button"
                      className="adm-chip-action"
                      style={styles.chipAction}
                      onClick={() => handleSetDefaultMuezzin(m.user_id)}
                      disabled={savingDefaultMuezzin !== null || loading}
                      aria-label={`Set ${user?.email ?? m.user_id} as default muezzin`}
                    >
                      Set default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="adm-chip-remove"
                    style={styles.chipRemove}
                    onClick={() => handleRemoveMuezzin(m.user_id)}
                    aria-label={`Remove muezzin ${user?.email ?? m.user_id}`}
                    disabled={loading}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            {!muezzins.length ? <span style={styles.muted}>No muezzins assigned.</span> : null}
          </div>
        </AdminPanel>
      ) : null}

      {/* Edit mosque modal */}
      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditError(null); }} title={editMode === 'live-stream' ? 'Edit Live Stream Config' : 'Edit Mosque'}>
        <div style={styles.modalStack}>
          {editMode === 'profile' ? (
            <>
              <div>
                <label style={styles.label} htmlFor="edit-name">Name *</label>
                <TextInput id="edit-name" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={styles.label} htmlFor="edit-city">City</label>
                  <TextInput id="edit-city" value={editForm.city} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={styles.label} htmlFor="edit-country">Country</label>
                  <TextInput id="edit-country" value={editForm.country} onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={styles.label} htmlFor="edit-lat">Latitude</label>
                  <TextInput
                    id="edit-lat"
                    type="number"
                    step="any"
                    placeholder="e.g. 51.5825"
                    value={editForm.lat}
                    onChange={(e) => setEditForm((p) => ({ ...p, lat: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={styles.label} htmlFor="edit-lng">Longitude</label>
                  <TextInput
                    id="edit-lng"
                    type="number"
                    step="any"
                    placeholder="e.g. -0.3348"
                    value={editForm.lng}
                    onChange={(e) => setEditForm((p) => ({ ...p, lng: e.target.value }))}
                  />
                </div>
              </div>
              <div style={styles.helperText}>
                Coordinates are required for auto-calculated prayer times (Aladhan fallback). Find them via Google Maps — right-click the mosque location and copy the coordinates.
              </div>
              <div>
                <label style={styles.label} htmlFor="edit-status">Status</label>
                <Select id="edit-status" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
              {editCityIsLondon && (
                <div>
                  <label style={styles.label}>Prayer times source</label>
                  <div style={styles.toggleRow}>
                    <Button
                      variant={editForm.prayerSource === 'aladhan' ? 'primary' : 'ghost'}
                      type="button"
                      aria-pressed={editForm.prayerSource === 'aladhan'}
                      onClick={() => setEditForm((p) => ({ ...p, prayerSource: 'aladhan' }))}
                    >
                      Auto-calculate (Aladhan)
                    </Button>
                    <Button
                      variant={editForm.prayerSource === 'elm' ? 'primary' : 'ghost'}
                      type="button"
                      aria-pressed={editForm.prayerSource === 'elm'}
                      onClick={() => setEditForm((p) => ({ ...p, prayerSource: 'elm' }))}
                    >
                      East London Mosque timetable
                    </Button>
                  </div>
                  <div style={styles.helperText}>
                    {editForm.prayerSource === 'elm'
                      ? 'Uses the official East London Mosque published timetable. Includes both adhan and congregation (jamaat) times. Manual schedules still take precedence when uploaded.'
                      : 'Uses the Aladhan API to calculate prayer times from coordinates and the selected calculation method below.'}
                  </div>
                </div>
              )}
              {effectivePrayerSource === 'aladhan' && (
                <div>
                  <label style={styles.label} htmlFor="edit-prayer-method">Prayer time calculation method</label>
                  <Select
                    id="edit-prayer-method"
                    value={String(editForm.prayerCalculationMethod)}
                    onChange={(e) => setEditForm((p) => ({ ...p, prayerCalculationMethod: Number(e.target.value) }))}
                    aria-label="Aladhan calculation method for auto-generated prayer times"
                  >
                    <optgroup label="Sunni Jurisprudence">
                      {ALADHAN_METHODS.filter((m) => m.tradition !== 'shia').map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.label} — {m.region}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Shia Jurisprudence (Twelver/Jafari)">
                      {ALADHAN_METHODS.filter((m) => m.tradition === 'shia').map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.label} — {m.region}
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                  <div style={styles.helperText}>
                    Used to auto-generate prayer times when no schedule has been uploaded. Select the calculation method your mosque follows. Consult your mosque leadership if unsure.
                  </div>
                </div>
              )}
              <div>
                <label style={styles.label}>Asr calculation school</label>
                <div style={styles.toggleRow}>
                  <Button variant={editForm.prayerSchool === 0 ? 'primary' : 'ghost'} type="button" aria-pressed={editForm.prayerSchool === 0} onClick={() => setEditForm((p) => ({ ...p, prayerSchool: 0 }))}>Shafi (standard)</Button>
                  <Button variant={editForm.prayerSchool === 1 ? 'primary' : 'ghost'} type="button" aria-pressed={editForm.prayerSchool === 1} onClick={() => setEditForm((p) => ({ ...p, prayerSchool: 1 }))}>Hanafi</Button>
                </div>
                <div style={styles.helperText}>
                  {effectivePrayerSource === 'elm'
                    ? 'ELM provides both Asr times. Shafi: 1× shadow length (earlier). Hanafi: 2× shadow length (later, ~74 min difference in summer). Affects Asr only.'
                    : 'Shafi: shadow length = 1× object (default). Hanafi: shadow length = 2× object — common in South Asian / UK mosques. Affects Asr time only.'}
                </div>
              </div>
              <div>
                <label style={styles.label}>Cross-mosque admin access</label>
                <div style={styles.toggleRow}>
                  <Button variant={editForm.allowMultiMosqueLocalAdmins ? 'primary' : 'ghost'} type="button" aria-pressed={editForm.allowMultiMosqueLocalAdmins} onClick={() => setEditForm((p) => ({ ...p, allowMultiMosqueLocalAdmins: true }))}>Shared</Button>
                  <Button variant={!editForm.allowMultiMosqueLocalAdmins ? 'primary' : 'ghost'} type="button" aria-pressed={!editForm.allowMultiMosqueLocalAdmins} onClick={() => setEditForm((p) => ({ ...p, allowMultiMosqueLocalAdmins: false }))}>Exclusive</Button>
                </div>
              </div>
            </>
          ) : null}

          {editMode === 'live-stream' ? (
            <>
              {/* Enabled toggle */}
              <div>
                <label style={styles.label}>Live streaming</label>
                <div style={styles.toggleRow}>
                  <Button variant={editForm.liveStreamEnabled ? 'primary' : 'ghost'} type="button" aria-pressed={editForm.liveStreamEnabled} onClick={() => setEditForm((p) => ({ ...p, liveStreamEnabled: true }))}>Active</Button>
                  <Button variant={!editForm.liveStreamEnabled ? 'primary' : 'ghost'} type="button" aria-pressed={!editForm.liveStreamEnabled} onClick={() => setEditForm((p) => ({ ...p, liveStreamEnabled: false }))}>Inactive</Button>
                </div>
              </div>
              {/* Provider */}
              <div>
                <label style={styles.label} htmlFor="ls-provider">Provider</label>
                <Select id="ls-provider" value={editForm.liveStreamProvider} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamProvider: e.target.value }))}>
                  <option value="livekit">LiveKit (In-App Mic)</option>
                  <option value="external">External</option>
                  <option value="rtmp">RTMP / HLS</option>
                  {editForm.liveStreamProvider === 'icecast' ? <option value="icecast" disabled>Icecast (legacy)</option> : null}
                  <option value="test">Test</option>
                </Select>
                <div style={styles.helperText}>{editProviderProfile.summary}</div>
              </div>
              {/* Playback URL */}
              {editProviderProfile.requiresPlaybackUrl ? (
                <>
                <div>
                <label style={styles.label} htmlFor="ls-playback">Playback URL</label>
                <TextInput id="ls-playback" value={editForm.liveStreamPlaybackUrl} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamPlaybackUrl: e.target.value }))} placeholder="https://…" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </div>
              {/* Mount path — Icecast only */}
                </>
              ) : null}
              {editForm.liveStreamProvider === 'icecast' ? (
                <div>
                  <label style={styles.label} htmlFor="ls-mount">Mount path</label>
                  <TextInput id="ls-mount" value={editForm.liveStreamMountPath} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamMountPath: e.target.value }))} placeholder="/live/mosque.aac" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  <div style={styles.helperText}>Leave blank to derive from playback URL.</div>
                </div>
              ) : null}
              {/* Ingest URL */}
              {editProviderUsesExternalEncoder ? (
                <>
                <div>
                <label style={styles.label} htmlFor="ls-ingest">Ingest URL</label>
                <TextInput id="ls-ingest" value={editForm.liveStreamIngestUrl} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamIngestUrl: e.target.value }))} placeholder={editProviderProfile.ingestProtocolHint === 'rtmp(s)' ? 'rtmp://…' : 'https://…'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <div style={styles.helperText}>{editProviderProfile.requiresIngestUrl ? `Required for ${editProviderProfile.label}.` : 'Optional unless your provider gave you a dedicated encoder endpoint.'}</div>
              </div>
              {/* Username — provider-specific */}
                </>
              ) : null}
              {editProviderProfile.usernameLabel ? (
                <div>
                  <label style={styles.label} htmlFor="ls-username">{editProviderProfile.usernameLabel}</label>
                  <TextInput id="ls-username" value={editForm.liveStreamUsername} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamUsername: e.target.value }))} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                </div>
              ) : null}
              {/* Stream key / password */}
              {editProviderUsesStreamCredential ? (
                <div>
                <label style={styles.label} htmlFor="ls-key">{editProviderProfile.credentialLabel}</label>
                <TextInput id="ls-key" type="password" value={editForm.liveStreamStreamKey} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamStreamKey: e.target.value }))} placeholder={editProviderProfile.requiresStreamKey ? 'Required' : 'Optional'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <div style={styles.helperText}>{editProviderProfile.encoderInstructions}</div>
              </div>
              ) : null}
              {/* Secrets */}
              {editProviderUsesSecrets ? (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#64748b', marginBottom: 10 }}>Security</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                  <div>
                    <label style={styles.label} htmlFor="ls-callback-url">Provider callback URL</label>
                    <TextInput id="ls-callback-url" value={liveStreamCallbackUrl} readOnly style={{ color: '#64748b', backgroundColor: '#f8fafc' }} />
                  </div>
                  <div>
                    <label style={styles.label} htmlFor="ls-status-secret">Provider callback secret</label>
                    <TextInput id="ls-status-secret" type="password" value={editForm.liveStreamStatusSecret} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamStatusSecret: e.target.value }))} placeholder="Auto-generated on save" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                    <div style={styles.inlineActions}>
                      <Button variant="ghost" type="button" onClick={() => setEditForm((p) => ({ ...p, liveStreamStatusSecret: generateLiveStreamSecret('ls') }))}>Generate</Button>
                      {editForm.liveStreamStatusSecret ? <Button variant="ghost" type="button" onClick={() => handleCopyText(editForm.liveStreamStatusSecret, 'Callback secret copied.')}>Copy</Button> : null}
                    </div>
                  </div>
                  <div>
                    <label style={styles.label} htmlFor="ls-listener-secret">Listener access secret</label>
                    <TextInput id="ls-listener-secret" type="password" value={editForm.liveStreamListenerSecret} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamListenerSecret: e.target.value }))} placeholder="Auto-generated on save" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                    <div style={styles.inlineActions}>
                      <Button variant="ghost" type="button" onClick={() => setEditForm((p) => ({ ...p, liveStreamListenerSecret: generateLiveStreamSecret('ll') }))}>Generate</Button>
                      {editForm.liveStreamListenerSecret ? <Button variant="ghost" type="button" onClick={() => handleCopyText(editForm.liveStreamListenerSecret, 'Listener secret copied.')}>Copy</Button> : null}
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                <div style={styles.helperText}>{editProviderProfile.encoderInstructions}</div>
              )}
            </>
          ) : null}

          {editError ? <div role="alert" style={styles.errorBanner}>{editError}</div> : null}
          <div style={styles.inlineActions}>
            <Button variant="ghost" onClick={() => { setEditOpen(false); setEditError(null); }} disabled={savingEdit}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add local admin modal */}
      <Modal open={addAdminOpen} onClose={() => { setAddAdminOpen(false); setAddAdminError(null); }} title="Add or invite local admin">
        <div style={styles.modalStack}>
          <div>
            <label style={styles.label} htmlFor="add-admin-email">User email *</label>
            <TextInput id="add-admin-email" value={addAdminEmail} onChange={(e) => setAddAdminEmail(e.target.value)} placeholder="name@example.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
          <div>
            <label style={styles.label} htmlFor="add-admin-name">Display name</label>
            <TextInput id="add-admin-name" value={addAdminDisplayName} onChange={(e) => setAddAdminDisplayName(e.target.value)} placeholder="Optional" />
          </div>
          <div style={styles.helperText}>Assigns an existing account when found, or sends a fresh invite with local-admin access to {mosqueName}.</div>
          {addAdminError ? <div role="alert" style={styles.errorBanner}>{addAdminError}</div> : null}
          <div style={styles.inlineActions}>
            <Button variant="ghost" onClick={() => { setAddAdminOpen(false); setAddAdminError(null); }} disabled={addingAdmin}>Cancel</Button>
            <Button onClick={handleAddLocalAdmin} disabled={addingAdmin}>{addingAdmin ? 'Working…' : 'Add or invite'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add muezzin modal */}
      <Modal open={addMuezzinOpen} onClose={() => { setAddMuezzinOpen(false); setAddMuezzinError(null); }} title="Add or invite muezzin">
        <div style={styles.modalStack}>
          <div>
            <label style={styles.label} htmlFor="add-muezzin-email">User email *</label>
            <TextInput id="add-muezzin-email" value={addMuezzinEmail} onChange={(e) => setAddMuezzinEmail(e.target.value)} placeholder="name@example.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
          <div>
            <label style={styles.label} htmlFor="add-muezzin-name">Display name</label>
            <TextInput id="add-muezzin-name" value={addMuezzinDisplayName} onChange={(e) => setAddMuezzinDisplayName(e.target.value)} placeholder="Optional" />
          </div>
          <div style={styles.helperText}>Assigns an existing account when found, or sends a fresh invite with muezzin access to {mosqueName}.</div>
          {addMuezzinError ? <div role="alert" style={styles.errorBanner}>{addMuezzinError}</div> : null}
          <div style={styles.inlineActions}>
            <Button variant="ghost" onClick={() => { setAddMuezzinOpen(false); setAddMuezzinError(null); }} disabled={addingMuezzin}>Cancel</Button>
            <Button onClick={handleAddMuezzin} disabled={addingMuezzin}>{addingMuezzin ? 'Working…' : 'Add or invite'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmState.open}
        onClose={closeConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        description={confirmState.description}
        consequence={confirmState.consequence}
        variant={confirmState.variant}
        loading={confirmLoading}
      />
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorBanner: { padding: '12px 14px', borderRadius: 16, backgroundColor: '#fff7ed', color: '#b45309', border: '1px solid #fdba74', fontWeight: 700, fontSize: 14 },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  tabRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: { padding: '10px 16px', border: '1px solid #dbe4ec', borderRadius: 999, backgroundColor: '#fff', color: '#0f172a', fontWeight: 800, cursor: 'pointer', fontSize: 14 },
  tabActive: { padding: '10px 16px', border: '1px solid #0f172a', borderRadius: 999, backgroundColor: '#0f172a', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14 },
  overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 },
  overviewGridCompact: { gridTemplateColumns: '1fr' },
  readinessPanelWrapper: { gridColumn: '1 / -1', minWidth: 0 },
  readinessLoading: { padding: '18px', borderRadius: 14, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 14, fontWeight: 700 },
  readinessError: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, backgroundColor: '#fff7ed', border: '1px solid #fdba74' },
  readinessErrorTitle: { color: '#9a3412', fontSize: 14, fontWeight: 800 },
  readinessErrorText: { color: '#b45309', fontSize: 13, lineHeight: 1.45, marginTop: 2 },
  readinessSummary: { position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, auto)', gap: 18, padding: '18px 20px 22px', borderRadius: 16, border: '1px solid #fde68a', backgroundColor: '#fffbeb', color: '#78350f' },
  readinessSummaryCompact: { gridTemplateColumns: '1fr' },
  readinessStagePending: { borderColor: '#fde68a', backgroundColor: '#fffbeb', color: '#78350f' },
  readinessStageAttention: { borderColor: '#fecaca', backgroundColor: '#fff7f7', color: '#991b1b' },
  readinessStageReady: { borderColor: '#bae6fd', backgroundColor: '#f0f9ff', color: '#075985' },
  readinessStageInfo: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff', color: '#3730a3' },
  readinessStageSuccess: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', color: '#166534' },
  readinessSummaryCopy: { minWidth: 0 },
  readinessEyebrow: { fontSize: 11, fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.72 },
  readinessStageLabel: { fontSize: 24, lineHeight: 1.15, fontWeight: 900, letterSpacing: '-0.025em', marginTop: 5 },
  readinessSummaryDetail: { fontSize: 13, lineHeight: 1.5, fontWeight: 700, marginTop: 5, opacity: 0.78 },
  readinessSummaryFacts: { display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', justifyContent: 'flex-end', gap: 7 },
  readinessSummaryFactsCompact: { justifyContent: 'flex-start' },
  readinessFact: { padding: '6px 9px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.72)', border: '1px solid rgba(100,116,139,0.2)', fontSize: 12, lineHeight: 1.2, fontWeight: 800 },
  readinessProgressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(148,163,184,0.2)', overflow: 'hidden' },
  readinessProgressValue: { height: '100%', backgroundColor: 'currentColor', transition: 'width 180ms ease' },
  readinessCheckList: { display: 'flex', flexDirection: 'column', gap: 9 },
  readinessCheck: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
  readinessCheckPass: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', color: '#166534' },
  readinessCheckWarning: { borderColor: '#fde68a', backgroundColor: '#fffbeb', color: '#92400e' },
  readinessCheckBlocker: { borderColor: '#fecaca', backgroundColor: '#fff7f7', color: '#991b1b' },
  readinessCheckIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', color: '#fff', fontSize: 14, lineHeight: 1, fontWeight: 900, flexShrink: 0 },
  readinessCheckIconPass: { backgroundColor: '#16a34a' },
  readinessCheckIconWarning: { backgroundColor: '#d97706' },
  readinessCheckIconBlocker: { backgroundColor: '#dc2626' },
  readinessCheckCopy: { flex: '1 1 260px', minWidth: 0 },
  readinessCheckTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  readinessCheckTitle: { color: '#0f172a', fontSize: 14, fontWeight: 800 },
  readinessRequirement: { padding: '2px 6px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.78)', color: '#64748b', border: '1px solid rgba(148,163,184,0.24)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  readinessCheckDetail: { color: '#475569', fontSize: 13, lineHeight: 1.5, marginTop: 3 },
  readinessActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', paddingTop: 2 },
  readinessRollout: { padding: '15px 16px', borderRadius: 14, border: '1px solid #dbe4ec', backgroundColor: '#f8fafc' },
  readinessRolloutWarning: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  readinessRolloutSuccess: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  readinessRolloutHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  readinessRolloutTitle: { color: '#0f172a', fontSize: 16, fontWeight: 900, marginTop: 3 },
  readinessRolloutGates: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  rolloutGateOn: { padding: '5px 8px', borderRadius: 999, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: 11, fontWeight: 900 },
  rolloutGateOff: { padding: '5px 8px', borderRadius: 999, backgroundColor: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 900 },
  readinessRolloutText: { color: '#475569', fontSize: 13, lineHeight: 1.55, marginTop: 9 },
  readinessAudit: { borderTop: '1px solid #e2e8f0', paddingTop: 15 },
  readinessAuditTitle: { color: '#0f172a', fontSize: 13, fontWeight: 900, marginBottom: 9 },
  readinessAuditList: { display: 'flex', flexDirection: 'column', gap: 8 },
  readinessAuditEvent: { padding: '10px 12px', borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #eef2f7' },
  readinessAuditEventHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  readinessAuditEventName: { color: '#0f172a', fontSize: 12, fontWeight: 900, textTransform: 'capitalize' },
  readinessAuditTime: { color: '#64748b', fontSize: 11, fontWeight: 700 },
  readinessAuditTransition: { color: '#475569', fontSize: 12, fontWeight: 700, textTransform: 'capitalize', marginTop: 3 },
  readinessAuditNotes: { color: '#64748b', fontSize: 12, lineHeight: 1.45, marginTop: 3 },
  metaList: { display: 'flex', flexDirection: 'column', gap: 2 },
  metaRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #eef2f7', color: '#0f172a' },
  metaRowPhone: { alignItems: 'flex-start', flexDirection: 'column' },
  metaLabel: { fontSize: 13, color: '#64748b', fontWeight: 600, flexShrink: 0 },
  idText: { wordBreak: 'break-all', textAlign: 'right', maxWidth: 280, fontSize: 13, color: '#475569' },
  idTextPhone: { textAlign: 'left', maxWidth: '100%' },
  inlineActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: 700, fontSize: 13 },
  chipGreen: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 13 },
  chipStatus: { fontSize: 12, fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 999 },
  chipAction: { border: 'none', borderRadius: 999, backgroundColor: '#fff', color: '#0f172a', cursor: 'pointer', fontWeight: 800, fontSize: 12, padding: '3px 8px', lineHeight: 1.2 },
  chipRemove: { border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: 12, padding: '1px 3px', lineHeight: 1, color: 'inherit' },
  muted: { color: '#94a3b8', fontSize: 13, fontWeight: 600 },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  helperText: { fontSize: 13, lineHeight: 1.55, color: '#475569', marginTop: 6 },
  modalStack: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#0f172a' },
};
