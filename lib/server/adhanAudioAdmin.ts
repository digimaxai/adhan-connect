import {
  ADHAN_AUDIO_BUCKET, ADHAN_AUDIO_MAX_BYTES, AdhanAudioError, EMPTY_ADHAN_AUDIO_DRAFT,
  audioFileType, audioText, audioUuid, validateAdhanSetupDraft,
} from '../adhanAudio';
import { requireAdminAccess } from './adminAccess';
import { audioSetupEnabled, audioSetupMosqueIds, authorizeAudioAsset, authorizeAudioMosque } from './adhanAudioPolicy';
import { validateAdhanAudio } from './validateAdhanAudio';

const ASSET_COLUMNS = 'id,mosque_id,title,reciter,state,duration_sec,created_at';
const SETTINGS_COLUMNS = 'draft_mode,default_asset_id,fajr_asset_id,enabled_prayers,revision';
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
function databaseError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '40001') throw new AdhanAudioError('Another admin changed these settings. Reload before saving.', 409);
  if (error.code === '42501') throw new AdhanAudioError('Mosque admin access is required.', 403);
  if (['P0001', '22023'].includes(error.code ?? '')) throw new AdhanAudioError(error.message, 409);
  throw new AdhanAudioError('Recording setup is temporarily unavailable. Please try again.', 503);
}

export async function handleAdhanAudioAdmin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
  access = requireAdminAccess
): Promise<Response> {
  // Fail closed before auth, database or storage access (including direct links).
  if (!audioSetupEnabled(env)) return reply({ error: 'Recording setup is not available yet.' }, 404);
  try {
    const authorization = await access(request);
    if ('response' in authorization) {
      authorization.response.headers.set('Cache-Control', 'no-store');
      return authorization.response;
    }
    const { context } = authorization;
    const db = context.supabaseAdmin;
    const mosqueId = new URL(request.url).searchParams.get('mosqueId');
    if (request.method === 'GET' && !mosqueId) {
      const ids = audioSetupMosqueIds(env).filter(id => context.isMainAdmin || context.adminMosqueIds.includes(id));
      if (!ids.length) return reply({ mosques: [] });
      const mosques = await db.from('mosques').select('id,name').in('id', ids).order('name');
      databaseError(mosques.error);
      return reply({ mosques: mosques.data ?? [] });
    }
    authorizeAudioMosque(env, context, mosqueId);
    const bucket = db.storage.from(ADHAN_AUDIO_BUCKET);

    if (request.method === 'GET') {
      const [assets, settings, activation] = await Promise.all([
        db.from('adhan_audio_assets').select(ASSET_COLUMNS).or(`mosque_id.eq.${mosqueId},mosque_id.is.null`)
          .neq('state', 'archived').order('created_at', { ascending: false }),
        db.from('mosque_adhan_audio_settings').select(SETTINGS_COLUMNS).eq('mosque_id', mosqueId).maybeSingle(),
        db.from('mosque_adhan_audio_activation').select('active,activated_at').eq('mosque_id', mosqueId).maybeSingle(),
      ]);
      databaseError(assets.error); databaseError(settings.error); databaseError(activation.error);
      return reply({ assets: (assets.data ?? []).filter(a => a.mosque_id !== null || a.state === 'ready' || context.isMainAdmin),
        settings: settings.data ?? EMPTY_ADHAN_AUDIO_DRAFT,
        canManageCatalogue: context.isMainAdmin,
        active: activation.data?.active === true, activatedAt: activation.data?.activated_at ?? null,
        automaticPlaybackActive: false });
    }
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    // Consume a bounded JSON body even when Content-Length is absent or forged.
    const reader = request.body?.getReader();
    if (!reader) throw new AdhanAudioError('A request body is required.');
    let raw = ''; let size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); throw new AdhanAudioError('Request is too large.', 413); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    } catch { throw new AdhanAudioError('Invalid request.'); }

    if (body.action === 'preview_schedule') {
      const settings = validateAdhanSetupDraft(body.settings);
      const [{ loadAdhanSchedulePreview }, { GET: readDaily }] = await Promise.all([
        import('./adhanSchedulePreview'), import('../../app/api/prayer-times-daily+api'),
      ]);
      return reply(await loadAdhanSchedulePreview(context, mosqueId, settings, request => readDaily(request, {})));
    }

    if (body.action === 'save_settings') {
      const draft = validateAdhanSetupDraft(body.settings);
      // Preparation must not edit a configuration consumed by an earlier local
      // scheduling test. This is not a replacement for the pending SQL lifecycle fix.
      const activation = await db.from('mosque_adhan_audio_activation').select('active').eq('mosque_id', mosqueId).maybeSingle();
      databaseError(activation.error);
      if (activation.data?.active === true) {
        throw new AdhanAudioError('An earlier scheduling test is active. The central team must safely pause it before these settings can be changed.', 409);
      }
      const result = await db.rpc('save_adhan_audio_draft', {
        p_actor: context.userId, p_mosque: mosqueId, p_revision: draft.revision,
        p_mode: draft.draft_mode, p_default: draft.default_asset_id,
        p_fajr: draft.fajr_asset_id, p_prayers: draft.enabled_prayers,
      });
      databaseError(result.error);
      return reply({ settings: result.data, automaticPlaybackActive: false });
    }
    if (body.action === 'activate') {
      // No client (including an older feature build) may enable unfinished playback.
      throw new AdhanAudioError('Scheduled playback is not available yet. You can prepare recordings and settings.', 409);
    }
    if (body.action === 'deactivate') {
      // Retained for recovery of prior local tests; not exposed as a playback switch.
      const result = await db.rpc('deactivate_adhan_audio_v1', { p_actor: context.userId, p_mosque: mosqueId });
      databaseError(result.error);
      return reply({ active: false, automaticPlaybackActive: false });
    }
    if (body.action === 'begin_upload') {
      const title = audioText(body.title, 'Title', 120);
      const reciter = audioText(body.reciter, 'Reciter name', 120);
      const rightsNote = audioText(body.rightsNote, 'Permission details', 500);
      if (body.rightsConfirmed !== true) throw new AdhanAudioError('Confirm permission to broadcast this recording.');
      if (!['mosque', 'catalogue'].includes(String(body.scope))) throw new AdhanAudioError('Choose the recording library.');
      if (body.scope === 'catalogue' && !context.isMainAdmin) throw new AdhanAudioError('Only main admins can manage the catalogue.', 403);
      const size = body.sizeBytes;
      if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0 || size > ADHAN_AUDIO_MAX_BYTES) {
        throw new AdhanAudioError('Choose a recording up to 20 MB.');
      }
      const { mime } = audioFileType(body.fileName);
      const result = await db.rpc('reserve_adhan_audio_upload', {
        p_actor: context.userId, p_mosque: body.scope === 'catalogue' ? null : mosqueId,
        p_title: title, p_reciter: reciter, p_mime: mime, p_size: size, p_rights_note: rightsNote,
      });
      databaseError(result.error);
      const asset = result.data;
      const upload = await bucket.createSignedUploadUrl(asset.storage_path, { upsert: false });
      if (upload.error || !upload.data) {
        // Leave the reservation visible for recovery/archive, never make it ready.
        throw new AdhanAudioError('Could not prepare the upload. Reload and archive the unfinished recording before retrying.', 503);
      }
      return reply({ assetId: asset.id, uploadUrl: upload.data.signedUrl, mime });
    }
    if (!['complete_upload', 'preview', 'archive'].includes(String(body.action))) throw new AdhanAudioError('Unknown action.');
    if (!audioUuid(body.assetId)) throw new AdhanAudioError('A valid recording is required.');
    const assetResult = await db.from('adhan_audio_assets')
      .select(`${ASSET_COLUMNS},storage_path,mime_type,size_bytes`).eq('id', body.assetId).maybeSingle();
    databaseError(assetResult.error);
    const asset = assetResult.data;
    authorizeAudioAsset(asset, mosqueId, context.isMainAdmin, body.action !== 'preview');
    if (!asset || asset.state === 'archived') throw new AdhanAudioError('Recording not found.', 404);

    if (body.action === 'preview') {
      if (asset.state !== 'ready') throw new AdhanAudioError('Finish uploading this recording first.', 409);
      const result = await bucket.createSignedUrl(asset.storage_path, 300);
      if (result.error || !result.data) throw new AdhanAudioError('Could not open the preview.', 503);
      return reply({ url: result.data.signedUrl });
    }
    if (body.action === 'archive') {
      const result = await db.rpc('archive_adhan_audio_asset', { p_actor: context.userId, p_asset: asset.id });
      databaseError(result.error);
      // Retain immutable objects for now. Delayed garbage collection must wait for
      // outstanding upload tokens (2 hours) and preview URLs to expire.
      return reply({ archived: true });
    }
    if (asset.state === 'ready') return reply({ ready: true });
    const file = await bucket.download(asset.storage_path);
    if (file.error || !file.data) throw new AdhanAudioError('The upload has not finished. Retry verification or archive and upload again.', 409);
    if (file.data.size > ADHAN_AUDIO_MAX_BYTES) throw new AdhanAudioError('The recording exceeds 20 MB.');
    const verified = await validateAdhanAudio(new Uint8Array(await file.data.arrayBuffer()), asset.mime_type, asset.size_bytes);
    const result = await db.rpc('complete_adhan_audio_upload', {
      p_actor: context.userId, p_asset: asset.id, p_duration: verified.duration_sec,
    });
    databaseError(result.error);
    return reply({ ready: true });
  } catch (error) {
    if (error instanceof AdhanAudioError) return reply({ error: error.message }, error.status);
    return reply({ error: 'Recording setup is temporarily unavailable. Please try again.' }, 503);
  }
}
