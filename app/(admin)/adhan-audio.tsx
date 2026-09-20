import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { AppText } from '../../components/ui/app-text';
import { ScreenContainer } from '../../components/ui/screen-container';
import { useAuth } from '../../lib/auth';
import { useRoleFlags } from '../../lib/roles';
import {
  ADHAN_PRAYERS, AdhanAudioDraft, AdhanAudioMode, AdhanAudioWorkspace, validateAudioDraft,
} from '../../lib/adhanAudio';
import { adhanAudioRequest, uploadAdhanAudio } from '../../lib/api/admin/adhanAudio';

const MODES: { value: AdhanAudioMode; title: string; description: string }[] = [
  { value: 'live_only', title: 'Live only', description: 'Staff lead the adhan live, as today.' },
  { value: 'recorded_only', title: 'Recorded only', description: 'Planned: play the chosen recording at the mosque’s adhan time, with no intentional delay.' },
  { value: 'live_with_fallback', title: 'Live with a recording fallback', description: 'Planned: allow 10 seconds for live audio to start, then use the recording.' },
];

function Choice({ title, onPress, selected = false, disabled = false }: {
  title: string; onPress: () => void; selected?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
    <AppText style={selected ? styles.selectedText : undefined}>{title}</AppText>
  </Pressable>;
}

export default function AdhanAudioScreen() {
  if (process.env.EXPO_PUBLIC_RECORDED_ADHAN_SETUP_ENABLED !== 'true') {
    return <Redirect href={'/admin-settings' as any} />;
  }
  return <AdhanAudioWorkspaceScreen />;
}

function AdhanAudioWorkspaceScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags({ reuseResolvedSessionAccess: true });
  const ready = roles.ready && roles.resolvedUserId === (session?.user.id ?? null) && roles.isAdmin;
  const [mosques, setMosques] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const token = session?.access_token;
  const selectedMosque = mosques.find(m => m.id === selectedId) ?? mosques[0];
  useEffect(() => {
    let cancelled = false;
    if (!ready || !token) { setMosques([]); return; }
    setLoading(true); setError('');
    void adhanAudioRequest<{ mosques: { id: string; name: string }[] }>(token, '').then(result => {
      if (!cancelled) setMosques(result.mosques);
    }).catch(e => { if (!cancelled) { setMosques([]); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, token, refresh]);
  return <ScreenContainer contentStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Choice title="Back to settings" onPress={() => router.replace('/admin-settings' as any)} />
    <AppText style={styles.heading}>Adhan recordings</AppText>
    <View style={styles.notice}>
      <AppText style={styles.title}>Preparation only</AppText>
      <AppText>Upload audio and save your preferences here. Automatic playback is not active. Your mosque’s current live broadcasts and staff duties continue as usual.</AppText>
    </View>
    {roles.loading || loading ? <ActivityIndicator /> : null}
    {error ? <><AppText style={styles.error}>{error}</AppText><Choice title="Try again" onPress={() => setRefresh(value => value + 1)} /></> : null}
    {!loading && !error && !mosques.length ? <AppText>Recording setup is not available for your mosques yet.</AppText> : null}
    {mosques.length > 1 ? <View style={styles.row}>{mosques.map(mosque =>
      <Choice key={mosque.id} title={mosque.name} selected={mosque.id === selectedMosque?.id}
        onPress={() => setSelectedId(mosque.id)} />)}</View> : null}
    {ready && selectedMosque && session ? <AudioEditor key={`${session.user.id}:${selectedMosque.id}`}
      mosqueId={selectedMosque.id} mosqueName={selectedMosque.name} token={session.access_token} /> : null}
  </ScreenContainer>;
}

function AudioEditor({ mosqueId, mosqueName, token }: { mosqueId: string; mosqueName: string; token: string }) {
  const [workspace, setWorkspace] = useState<AdhanAudioWorkspace | null>(null);
  const [draft, setDraft] = useState<AdhanAudioDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [reciter, setReciter] = useState('');
  const [rightsNote, setRightsNote] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [scope, setScope] = useState<'mosque' | 'catalogue'>('mosque');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const alive = useRef(true);
  const operation = useRef(false);
  const sound = useRef<Audio.Sound | null>(null);
  const previewGeneration = useRef(0);
  const focused = useRef(false);
  const stopPreview = useCallback(() => {
    previewGeneration.current += 1;
    const previous = sound.current;
    sound.current = null;
    if (alive.current) setPlayingId(null);
    if (previous) void previous.unloadAsync().catch(() => undefined);
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; stopPreview(); };
  }, [stopPreview]));
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') stopPreview();
    });
    return () => { alive.current = false; subscription.remove(); stopPreview(); };
  }, [stopPreview]);

  const reload = useCallback(async (replaceDraft = true) => {
    const data = await adhanAudioRequest<AdhanAudioWorkspace>(token, mosqueId);
    if (alive.current) {
      setWorkspace(data);
      if (replaceDraft) setDraft(data.settings);
    }
  }, [mosqueId, token]);
  useEffect(() => {
    let cancelled = false;
    void adhanAudioRequest<AdhanAudioWorkspace>(token, mosqueId).then(data => {
      if (!cancelled) { setWorkspace(data); setDraft(current => current ?? data.settings); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [mosqueId, token]);

  const run = async (work: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { operation.current = false; if (alive.current) setBusy(false); }
  };
  const preview = async (assetId: string) => {
    if (playingId === assetId) { stopPreview(); return; }
    stopPreview();
    const generation = previewGeneration.current;
    const { url } = await adhanAudioRequest<{ url: string }>(token, mosqueId, { action: 'preview', assetId });
    if (!alive.current || !focused.current || generation !== previewGeneration.current) return;
    // Explicit admin preview only; no global audio-mode changes or background playback.
    const next = new Audio.Sound();
    sound.current = next;
    try {
      await next.loadAsync({ uri: url }, { shouldPlay: false });
      if (!alive.current || !focused.current || generation !== previewGeneration.current) {
        await next.unloadAsync(); return;
      }
      next.setOnPlaybackStatusUpdate(status => {
        if (generation !== previewGeneration.current) return;
        if (!status.isLoaded && status.error) { setError('Preview could not be played.'); stopPreview(); }
        if (status.isLoaded && status.didJustFinish) stopPreview();
      });
      setPlayingId(assetId);
      await next.playAsync();
    } catch (e) { stopPreview(); throw e; }
  };

  const upload = async () => {
    stopPreview();
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !alive.current) return;
    const file = result.assets[0];
    await uploadAdhanAudio({ token, mosqueId, uri: file.uri, fileName: file.name, sizeBytes: file.size ?? 0,
      title, reciter, rightsNote, rightsConfirmed, scope });
    await reload(false);
    if (alive.current) { setMessage('Recording uploaded and verified. Preview it before selecting it.'); setTitle(''); }
  };

  return <>
    <AppText style={styles.title}>{mosqueName}</AppText>
    {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
    {message ? <AppText accessibilityLiveRegion="polite" style={styles.success}>{message}</AppText> : null}
    <Choice title={busy ? 'Working…' : 'Reload saved settings'} disabled={busy}
      onPress={() => void run(async () => { stopPreview(); await reload(); })} />
    {!workspace && !error ? <ActivityIndicator /> : null}
    {workspace && draft ? <>
      <View style={styles.card}>
        <AppText style={styles.title}>Planned broadcast mode</AppText>
        {MODES.map(mode => <View key={mode.value} style={styles.group}>
          <Choice title={mode.title} selected={draft.draft_mode === mode.value} disabled={busy}
            onPress={() => setDraft({ ...draft, draft_mode: mode.value })} />
          <AppText style={styles.muted}>{mode.description}</AppText>
        </View>)}
        <AppText style={styles.title}>Prayers using this mode</AppText>
        <View style={styles.row}>{ADHAN_PRAYERS.map(prayer => <Choice key={prayer} title={prayer[0].toUpperCase() + prayer.slice(1)}
          selected={draft.enabled_prayers.includes(prayer)} disabled={busy} onPress={() => setDraft({ ...draft,
            enabled_prayers: draft.enabled_prayers.includes(prayer) ? draft.enabled_prayers.filter(p => p !== prayer) : [...draft.enabled_prayers, prayer],
          })} />)}</View>
        <AppText style={styles.muted}>Other prayers keep live-only broadcasts. Times will follow the mosque’s adhan timetable, including its local timezone and adjustments.</AppText>
        <AppText>Default: {workspace.assets.find(a => a.id === draft.default_asset_id)?.title ?? 'Not selected'}</AppText>
        <AppText>Fajr: {workspace.assets.find(a => a.id === draft.fajr_asset_id)?.title ?? 'Use default recording'}</AppText>
        <View style={styles.row}>
          <Choice title="Clear default" disabled={busy || !draft.default_asset_id} onPress={() => setDraft({ ...draft, default_asset_id: null })} />
          <Choice title="Use default for Fajr" selected={!draft.fajr_asset_id} disabled={busy} onPress={() => setDraft({ ...draft, fajr_asset_id: null })} />
        </View>
        <Choice title="Save draft settings" disabled={busy} onPress={() => void run(async () => {
          const settings = validateAudioDraft(draft);
          const saved = await adhanAudioRequest<{ settings: AdhanAudioDraft }>(token, mosqueId, { action: 'save_settings', settings });
          if (alive.current) { setDraft(saved.settings); setMessage('Draft saved. Automatic playback is not active.'); }
        })} />
      </View>
      <View style={styles.card}>
        <AppText style={styles.title}>Recording library</AppText>
        {!workspace.assets.some(a => a.mosque_id === null && a.state === 'ready') ?
          <AppText style={styles.muted}>The five worldwide recordings will appear here once the central team has added audio with permission to broadcast it.</AppText> : null}
        {!workspace.assets.length ? <AppText>No recordings yet. Upload your mosque’s recording below.</AppText> : null}
        {workspace.assets.map(asset => <View key={asset.id} style={styles.asset}>
          <AppText style={styles.title}>{asset.title}</AppText>
          <AppText style={styles.muted}>{asset.reciter} · {asset.mosque_id ? 'Mosque recording' : 'Worldwide catalogue'} · {asset.state === 'ready' ? `${asset.duration_sec}s` : 'Upload unfinished'}</AppText>
          <View style={styles.row}>
            {asset.state === 'ready' ? <>
              <Choice title={playingId === asset.id ? 'Stop preview' : 'Preview'} disabled={busy} onPress={() => void run(() => preview(asset.id))} />
              <Choice title="Use as default" selected={draft.default_asset_id === asset.id} disabled={busy} onPress={() => setDraft({ ...draft, default_asset_id: asset.id })} />
              <Choice title="Use for Fajr" selected={draft.fajr_asset_id === asset.id} disabled={busy} onPress={() => setDraft({ ...draft, fajr_asset_id: asset.id })} />
            </> : <Choice title="Verify uploaded file" disabled={busy} onPress={() => void run(async () => {
              await adhanAudioRequest(token, mosqueId, { action: 'complete_upload', assetId: asset.id }); await reload(false);
            })} />}
            {asset.mosque_id !== null || workspace.canManageCatalogue ?
              <Choice title="Archive" disabled={busy} onPress={() => { stopPreview(); setArchiveId(asset.id); }} /> : null}
          </View>
          {archiveId === asset.id ? <View style={styles.group}>
            <AppText>Archive this recording? Recordings selected in saved settings must be replaced first.</AppText>
            <View style={styles.row}><Choice title="Confirm archive" disabled={busy} onPress={() => void run(async () => {
              await adhanAudioRequest(token, mosqueId, { action: 'archive', assetId: asset.id });
              if (alive.current) {
                setArchiveId(null);
                setDraft(current => current ? { ...current,
                  default_asset_id: current.default_asset_id === asset.id ? null : current.default_asset_id,
                  fajr_asset_id: current.fajr_asset_id === asset.id ? null : current.fajr_asset_id } : current);
              }
              await reload(false);
            })} /><Choice title="Cancel" disabled={busy} onPress={() => setArchiveId(null)} /></View>
          </View> : null}
        </View>)}
      </View>
      <View style={styles.card}>
        <AppText style={styles.title}>Upload a recording</AppText>
        <AppText style={styles.muted}>MP3, AAC M4A or PCM WAV. Up to 20 MB and 10 minutes. Files are stored privately in the cloud.</AppText>
        {workspace.canManageCatalogue ? <View style={styles.row}>
          <Choice title="This mosque" selected={scope === 'mosque'} disabled={busy} onPress={() => setScope('mosque')} />
          <Choice title="Worldwide catalogue (up to 5)" selected={scope === 'catalogue'} disabled={busy} onPress={() => setScope('catalogue')} />
        </View> : null}
        <TextInput accessibilityLabel="Recording title" placeholder="Recording title" value={title} onChangeText={setTitle} maxLength={120} editable={!busy} style={styles.input} />
        <TextInput accessibilityLabel="Reciter name" placeholder="Reciter name" value={reciter} onChangeText={setReciter} maxLength={120} editable={!busy} style={styles.input} />
        <TextInput accessibilityLabel="Broadcast permission details" placeholder="Who gave permission to broadcast this recording?" value={rightsNote} onChangeText={setRightsNote} maxLength={500} editable={!busy} multiline style={styles.input} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rightsConfirmed, disabled: busy }} disabled={busy}
          onPress={() => setRightsConfirmed(!rightsConfirmed)} style={[styles.choice, rightsConfirmed && styles.selected]}>
          <AppText>{rightsConfirmed ? '✓ ' : '□ '}I confirm we have permission to broadcast this recording to listeners.</AppText>
        </Pressable>
        <Choice title="Choose audio file and upload" disabled={busy || !rightsConfirmed || !title.trim() || !reciter.trim() || !rightsNote.trim()}
          onPress={() => void run(upload)} />
      </View>
    </> : null}
  </>;
}

const styles = StyleSheet.create({
  page: { maxWidth: 840, width: '100%', alignSelf: 'center', gap: 16, paddingBottom: 48 },
  heading: { fontSize: 24, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DDE5E1', padding: 16, gap: 14 },
  notice: { backgroundColor: '#FFF7DD', borderRadius: 12, padding: 16, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 8 },
  choice: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5D1', justifyContent: 'center' },
  selected: { backgroundColor: '#E7F3EE', borderColor: '#155F4E' },
  selectedText: { color: '#155F4E', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  muted: { color: '#52635D', fontSize: 14 },
  error: { color: '#A32121' },
  success: { color: '#155F4E' },
  input: { borderWidth: 1, borderColor: '#CBD5D1', borderRadius: 10, padding: 12, minHeight: 48, color: '#172C24', fontSize: 16 },
  asset: { borderTopWidth: 1, borderTopColor: '#DDE5E1', paddingTop: 14, gap: 10 },
});
