'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
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
type MosqueWorkspacePayload = {
  mosque: MosqueRow;
  mosques: MosqueRow[];
  admins: MosqueAdmin[];
  muezzins: MuezzinRow[];
  people: AssignmentUser[];
  upstreamState: UpstreamStateRow | null;
};

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
  const [tab, setTab] = useState<MosqueWorkspaceTab>(routeTab);

  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [mosquesForSelector, setMosquesForSelector] = useState<MosqueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [admins, setAdmins] = useState<MosqueAdmin[]>([]);
  const [muezzins, setMuezzins] = useState<MuezzinRow[]>([]);
  const [peopleById, setPeopleById] = useState<Record<string, AssignmentUser>>({});
  const [upstreamState, setUpstreamState] = useState<UpstreamStateRow | null>(null);

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

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<EditMosqueMode>('profile');
  const [editForm, setEditForm] = useState({
    name: '', city: '', country: '', status: 'pending',
    lat: '', lng: '',
    allowMultiMosqueLocalAdmins: false,
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
    if (!mosque) return;
    setEditForm({
      name: mosque.name ?? '',
      city: mosque.city ?? '',
      country: mosque.country ?? '',
      status: mosque.status ?? 'pending',
      lat: mosque.lat != null ? String(mosque.lat) : '',
      lng: mosque.lng != null ? String(mosque.lng) : '',
      allowMultiMosqueLocalAdmins: !!mosque.allow_multi_mosque_local_admins,
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
  const editProviderProfile = useMemo(() => getLiveStreamProviderProfile(editForm.liveStreamProvider), [editForm.liveStreamProvider]);
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
    const user = peopleById[userId];
    confirm({
      title: 'Remove muezzin',
      description: `Remove muezzin access for ${user?.email ?? userId} from ${mosqueName}?`,
      consequence: 'They will lose muezzin access and cannot start broadcasts for this mosque.',
      variant: 'danger',
      onConfirm: async () => {
        if (!mosqueId) return;
        setConfirmLoading(true);
        try {
          await removeMuezzinMembership({ mosqueId, userId });
          setMuezzins((prev) => prev.filter((m) => m.user_id !== userId));
          closeConfirm();
          notifySuccess('Muezzin removed.');
        } catch (error) {
          notifyError('Removing muezzin access failed.', error instanceof Error ? error.message : undefined);
          closeConfirm();
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!mosqueId) return;
    const nextName = editForm.name.trim();
    if (!nextName) { setEditError('Name is required.'); return; }
    const lsp = normalizeLiveStreamProvider(editForm.liveStreamProvider);
    const lspProfile = getLiveStreamProviderProfile(lsp);
    const liveStreamUsername = editForm.liveStreamUsername.trim();
    const liveStreamStreamKey = editForm.liveStreamStreamKey.trim();
    const liveStreamStatusSecret = editForm.liveStreamStatusSecret.trim() || (editForm.liveStreamEnabled ? generateLiveStreamSecret('ls') : '');
    const liveStreamListenerSecret = editForm.liveStreamListenerSecret.trim() || (editForm.liveStreamEnabled ? generateLiveStreamSecret('ll') : '');

    let liveStreamPlaybackUrl: string | null;
    let liveStreamIngestUrl: string | null;
    let liveStreamMountPath: string | null = null;
    try {
      liveStreamPlaybackUrl = normalizePlaybackUrl(editForm.liveStreamPlaybackUrl);
      liveStreamIngestUrl = normalizeIngestUrl(lsp, editForm.liveStreamIngestUrl);
      liveStreamMountPath = lsp === 'icecast'
        ? normalizeIcecastMountPath(editForm.liveStreamMountPath) || (liveStreamPlaybackUrl ? resolveLiveStreamMountPath({ id: mosqueId, live_stream_provider: lsp, live_stream_playback_url: liveStreamPlaybackUrl }) : null)
        : null;
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Live stream settings are invalid.');
      return;
    }

    if (editForm.liveStreamEnabled && !liveStreamPlaybackUrl) { setEditError('A playback URL is required when live streaming is active.'); return; }
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
      prayer_calculation_method: editForm.prayerCalculationMethod,
      prayer_school: editForm.prayerSchool,
      live_stream_enabled: editForm.liveStreamEnabled,
      live_stream_provider: lsp,
      live_stream_playback_url: liveStreamPlaybackUrl,
      live_stream_ingest_url: liveStreamIngestUrl,
      live_stream_mount_path: liveStreamMountPath,
      live_stream_username: liveStreamUsername || null,
      live_stream_stream_key: liveStreamStreamKey || null,
      live_stream_status_secret: liveStreamStatusSecret || null,
      live_stream_listener_secret: liveStreamListenerSecret || null,
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
    } catch {
      setAddMuezzinError('Unable to add or invite this muezzin right now.');
    } finally {
      setAddingMuezzin(false);
    }
  };

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
              <Button variant="secondary" onClick={() => { setAddMuezzinError(null); setAddMuezzinEmail(''); setAddMuezzinDisplayName(''); setAddMuezzinOpen(true); }}>Add or invite</Button>
            </>
          }
        >
          <div style={styles.chipRow}>
            {muezzins.map((m) => {
              const user = peopleById[m.user_id];
              return (
                <span key={m.user_id} style={styles.chipGreen}>
                  {user?.email ?? m.user_id}
                  <span style={styles.chipStatus}>{m.is_active ? 'active' : 'inactive'}</span>
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
              <div>
                <label style={styles.label}>Asr calculation school</label>
                <div style={styles.toggleRow}>
                  <Button variant={editForm.prayerSchool === 0 ? 'primary' : 'ghost'} type="button" aria-pressed={editForm.prayerSchool === 0} onClick={() => setEditForm((p) => ({ ...p, prayerSchool: 0 }))}>Shafi (standard)</Button>
                  <Button variant={editForm.prayerSchool === 1 ? 'primary' : 'ghost'} type="button" aria-pressed={editForm.prayerSchool === 1} onClick={() => setEditForm((p) => ({ ...p, prayerSchool: 1 }))}>Hanafi</Button>
                </div>
                <div style={styles.helperText}>Shafi: shadow length = 1× object (default). Hanafi: shadow length = 2× object — common in South Asian / UK mosques. Affects Asr time only.</div>
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
                  <option value="icecast">Icecast</option>
                  <option value="test">Test</option>
                </Select>
                <div style={styles.helperText}>{editProviderProfile.summary}</div>
              </div>
              {/* Playback URL */}
              <div>
                <label style={styles.label} htmlFor="ls-playback">Playback URL</label>
                <TextInput id="ls-playback" value={editForm.liveStreamPlaybackUrl} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamPlaybackUrl: e.target.value }))} placeholder="https://…" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </div>
              {/* Mount path — Icecast only */}
              {editForm.liveStreamProvider === 'icecast' ? (
                <div>
                  <label style={styles.label} htmlFor="ls-mount">Mount path</label>
                  <TextInput id="ls-mount" value={editForm.liveStreamMountPath} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamMountPath: e.target.value }))} placeholder="/live/mosque.aac" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  <div style={styles.helperText}>Leave blank to derive from playback URL.</div>
                </div>
              ) : null}
              {/* Ingest URL */}
              <div>
                <label style={styles.label} htmlFor="ls-ingest">Ingest URL</label>
                <TextInput id="ls-ingest" value={editForm.liveStreamIngestUrl} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamIngestUrl: e.target.value }))} placeholder={editProviderProfile.ingestProtocolHint === 'rtmp(s)' ? 'rtmp://…' : 'https://…'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <div style={styles.helperText}>{editProviderProfile.requiresIngestUrl ? `Required for ${editProviderProfile.label}.` : 'Optional unless your provider gave you a dedicated encoder endpoint.'}</div>
              </div>
              {/* Username — provider-specific */}
              {editProviderProfile.usernameLabel ? (
                <div>
                  <label style={styles.label} htmlFor="ls-username">{editProviderProfile.usernameLabel}</label>
                  <TextInput id="ls-username" value={editForm.liveStreamUsername} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamUsername: e.target.value }))} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                </div>
              ) : null}
              {/* Stream key / password */}
              <div>
                <label style={styles.label} htmlFor="ls-key">{editProviderProfile.credentialLabel}</label>
                <TextInput id="ls-key" type="password" value={editForm.liveStreamStreamKey} onChange={(e) => setEditForm((p) => ({ ...p, liveStreamStreamKey: e.target.value }))} placeholder={editProviderProfile.requiresStreamKey ? 'Required' : 'Optional'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <div style={styles.helperText}>{editProviderProfile.encoderInstructions}</div>
              </div>
              {/* Secrets */}
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
  chipRemove: { border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: 12, padding: '1px 3px', lineHeight: 1, color: 'inherit' },
  muted: { color: '#94a3b8', fontSize: 13, fontWeight: 600 },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  helperText: { fontSize: 13, lineHeight: 1.55, color: '#475569', marginTop: 6 },
  modalStack: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#0f172a' },
};
