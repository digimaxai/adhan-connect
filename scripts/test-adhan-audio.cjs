const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

async function main() {
  const metadata = await import('music-metadata');
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, Request, Response, URL, TextDecoder, Uint8Array,
      process: { env: {} },
      require(name) {
        if (name === 'music-metadata') return metadata;
        if (name === './adminAccess') return { requireAdminAccess: () => { throw new Error('Unexpected default auth call'); } };
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected import ${name}`);
      },
    }, { filename });
    cache.set(filename, module.exports);
    return module.exports;
  }
  const domain = load('lib/adhanAudio.ts');
  const policy = load('lib/server/adhanAudioPolicy.ts');
  const { validateAdhanAudio } = load('lib/server/validateAdhanAudio.ts');
  const { handleAdhanAudioAdmin } = load('lib/server/adhanAudioAdmin.ts');
  const mosque = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const assetId = '33333333-3333-4333-8333-333333333333';
  const env = { RECORDED_ADHAN_SETUP_ENABLED: 'true', RECORDED_ADHAN_SETUP_MOSQUE_IDS: mosque };
  const context = { isMainAdmin: false, adminMosqueIds: [mosque], userId: other, muezzinMosqueIds: [] };
  const draft = { ...domain.EMPTY_ADHAN_AUDIO_DRAFT };
  assert.equal(domain.validateAudioDraft(draft).draft_mode, 'live_only');
  for (const settings of [null, {}, { ...draft, revision: -1 }, { ...draft, enabled_prayers: ['sunrise'] },
    { ...draft, enabled_prayers: [] }, { ...draft, enabled_prayers: ['fajr', 'fajr'] },
    { ...draft, draft_mode: 'recorded_only' }, { ...draft, default_asset_id: 'bad' }]) {
    assert.throws(() => domain.validateAudioDraft(settings));
  }
  assert.equal(domain.validateAudioDraft({ ...draft, draft_mode: 'recorded_only', default_asset_id: assetId }).default_asset_id, assetId);
  assert.equal(domain.audioFileType('adhan.MP3').mime, 'audio/mpeg');
  assert.throws(() => domain.audioFileType('adhan.mp3.exe'));
  for (const disabled of [{}, { RECORDED_ADHAN_SETUP_ENABLED: 'false' }, { RECORDED_ADHAN_SETUP_ENABLED: 'TRUE' }]) {
    assert.equal(policy.audioSetupEnabled(disabled), false);
  }
  assert.throws(() => policy.authorizeAudioMosque({ ...env, RECORDED_ADHAN_SETUP_MOSQUE_IDS: '' }, context, mosque));
  assert.throws(() => policy.authorizeAudioMosque(env, context, other));
  assert.throws(() => policy.authorizeAudioMosque(env, { ...context, adminMosqueIds: [] }, mosque));
  assert.throws(() => policy.authorizeAudioMosque(env, { ...context, isMainAdmin: true }, other));
  policy.authorizeAudioMosque(env, context, mosque);
  policy.authorizeAudioAsset({ mosque_id: null }, mosque, false, false);
  assert.throws(() => policy.authorizeAudioAsset({ mosque_id: null }, mosque, false, true));
  assert.throws(() => policy.authorizeAudioAsset({ mosque_id: other }, mosque, true, true));

  function wav(seconds = 2, channels = 1) {
    const sampleRate = 8000;
    const dataSize = Math.floor(seconds * sampleRate * channels * 2);
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * channels * 2, 28);
    buffer.writeUInt16LE(channels * 2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
    return buffer;
  }
  const audio = wav();
  const m4a = fs.readFileSync('scripts/fixtures/adhan-audio/tone.m4a');
  assert.equal((await validateAdhanAudio(m4a, 'audio/mp4', m4a.length)).duration_sec, 3);
  const frame = Buffer.alloc(417); frame.set([0xff, 0xfb, 0x90, 0x64]);
  const mp3 = Buffer.concat(Array(100).fill(frame));
  assert.equal((await validateAdhanAudio(mp3, 'audio/mpeg', mp3.length)).duration_sec, 3);
  assert.equal((await validateAdhanAudio(audio, 'audio/wav', audio.length)).duration_sec, 2);
  for (const [bytes, mime, size] of [
    [Buffer.from('not audio'), 'audio/wav', 9], [audio, 'audio/mpeg', audio.length],
    [audio, 'audio/wav', 1], [wav(0.2), 'audio/wav', wav(0.2).length],
    [wav(601), 'audio/wav', wav(601).length], [wav(2, 3), 'audio/wav', wav(2, 3).length],
    [Buffer.alloc(domain.ADHAN_AUDIO_MAX_BYTES + 1), 'audio/wav', domain.ADHAN_AUDIO_MAX_BYTES + 1],
  ]) await assert.rejects(validateAdhanAudio(bytes, mime, size));

  let dbCalls = 0;
  let listedIds = [];
  let rpcError = null;
  let activationActive = false;
  let activationError = null;
  const rpcCalls = [];
  let storedAsset = { id: assetId, mosque_id: mosque, state: 'ready', storage_path: 'test.wav', mime_type: 'audio/wav', size_bytes: audio.length };
  const db = {
    storage: { from() { return {
      async createSignedUrl() { dbCalls++; return { data: { signedUrl: 'https://example.invalid/preview' } }; },
      async download() { dbCalls++; return { data: new Blob([audio]) }; },
    }; } },
    from(table) {
      dbCalls++;
      if (table === 'mosques') {
        const query = { select() { return query; }, in(column, ids) { listedIds = ids; return query; },
          async order() { return { data: listedIds.map(id => ({ id, name: 'Test mosque' })) }; } };
        return query;
      }
      if (table === 'mosque_adhan_audio_activation') {
        const query = { select() { return query; }, eq() { return query; },
          async maybeSingle() { return { data: { active: activationActive }, error: activationError }; } };
        return query;
      }
      const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: storedAsset }; } };
      return query;
    },
    async rpc(name, params) {
      dbCalls++;
      rpcCalls.push({ name, params });
      assert.equal(params.p_actor, context.userId, 'Must use verified identity');
      return { data: { ...draft, revision: 1 }, error: rpcError };
    },
  };
  const access = async () => ({ context: { ...context, supabaseAdmin: db } });
  function request(body, id = mosque) {
    return new Request(`https://example.invalid/api/admin/adhan-audio?mosqueId=${id}`, {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }
  async function expectStatus(body, expected, opts = {}) {
    const response = await handleAdhanAudioAdmin(request(body, opts.mosqueId), opts.env ?? env, opts.access ?? access);
    assert.equal(response.status, expected, await response.clone().text());
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response;
  }
  let authCalled = false;
  await expectStatus({}, 404, { env: {}, access: async () => { authCalled = true; throw new Error(); } });
  assert.equal(authCalled, false);
  await expectStatus({}, 401, { access: async () => ({ response: new Response('{}', { status: 401 }) }) });
  await expectStatus({}, 403, { mosqueId: other });
  await expectStatus({}, 404, { env: { ...env, RECORDED_ADHAN_SETUP_MOSQUE_IDS: '' } });
  assert.equal(dbCalls, 0);
  await expectStatus('{broken', 400);
  await expectStatus('x'.repeat(9000), 413);
  await expectStatus({ action: 'begin_upload', title: 'A', reciter: 'B', rightsNote: 'Written permission', rightsConfirmed: true,
    scope: 'catalogue', sizeBytes: 12, fileName: 'test.mp3' }, 403);
  assert.equal(dbCalls, 0);
  // Neither an old feature client nor a main admin can activate this unfinished
  // release. Reject before any RPC or database read, after normal authorization.
  await expectStatus({ action: 'activate', settingsRevision: 1 }, 409);
  await expectStatus({ action: 'activate', settingsRevision: 1 }, 409, {
    access: async () => ({ context: { ...context, isMainAdmin: true, supabaseAdmin: db } }),
  });
  const hybrid = { ...draft, draft_mode: 'live_with_fallback', default_asset_id: assetId };
  await expectStatus({ action: 'save_settings', settings: hybrid }, 409);
  await expectStatus({ action: 'preview_schedule', settings: hybrid }, 409);
  assert.equal(dbCalls, 0, 'Deferred modes and activation must not reach the database');
  await expectStatus({ action: 'save_settings', settings: draft, userId: 'spoofed' }, 200);
  const recorded = { ...draft, draft_mode: 'recorded_only', default_asset_id: assetId };
  await expectStatus({ action: 'save_settings', settings: recorded }, 200);
  assert.equal(rpcCalls.at(-1).params.p_mode, 'recorded_only');
  const savedCount = rpcCalls.length;
  activationActive = true;
  await expectStatus({ action: 'save_settings', settings: recorded }, 409);
  await expectStatus({ action: 'save_settings', settings: draft }, 409);
  assert.equal(rpcCalls.length, savedCount, 'Do not edit a draft consumed by earlier scheduling tests');
  activationActive = false;
  activationError = { code: 'XX000', message: 'unavailable' };
  await expectStatus({ action: 'save_settings', settings: draft }, 503);
  assert.equal(rpcCalls.length, savedCount, 'An unreadable activation state must prevent saves');
  activationError = null;
  await expectStatus({ action: 'deactivate' }, 200);
  assert.equal(rpcCalls.at(-1).name, 'deactivate_adhan_audio_v1', 'Keep recovery available for prior local tests');
  rpcError = { code: '40001', message: 'conflict' };
  await expectStatus({ action: 'save_settings', settings: draft }, 409);
  rpcError = { code: '42501', message: 'no access' };
  await expectStatus({ action: 'save_settings', settings: draft }, 403);
  rpcError = null;
  storedAsset = { ...storedAsset, mosque_id: other };
  await expectStatus({ action: 'preview', assetId }, 404);
  storedAsset = { ...storedAsset, mosque_id: mosque, state: 'uploading' };
  await expectStatus({ action: 'preview', assetId }, 409);
  await expectStatus({ action: 'complete_upload', assetId }, 200);
  storedAsset = { ...storedAsset, state: 'ready' };
  const before = dbCalls;
  await expectStatus({ action: 'complete_upload', assetId }, 200);
  assert.equal(dbCalls, before + 1, 'A retry of ready upload must not download or mutate');
  await expectStatus({ action: 'preview', assetId }, 200);
  storedAsset = { ...storedAsset, state: 'archived' };
  await expectStatus({ action: 'preview', assetId }, 404);
  const listing = new Request('https://example.invalid/api/admin/adhan-audio');
  const listed = await handleAdhanAudioAdmin(listing, { ...env, RECORDED_ADHAN_SETUP_MOSQUE_IDS: `${mosque},${other}` }, access);
  assert.equal(listed.status, 200);
  assert.equal(JSON.stringify(listedIds), JSON.stringify([mosque]));
  const mainAccess = async () => ({ context: { ...context, isMainAdmin: true, adminMosqueIds: [], supabaseAdmin: db } });
  const mainListed = await handleAdhanAudioAdmin(listing, env, mainAccess);
  assert.equal((await mainListed.json()).mosques.length, 1, 'Main admin needs no local membership to curate the catalogue');
  console.log('Adhan audio: domain, two-mode preparation, blocked activation, active-test edit guard, scope/identity, HTTP errors, upload verification and idempotency passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
