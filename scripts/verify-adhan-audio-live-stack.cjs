/**
 * Real Supabase stack verification (not a repo test — throwaway local check).
 * Runs the actual admin handler against a genuinely local Supabase Storage +
 * Postgres + Auth stack (started via `supabase start`), exercising real
 * signed upload URLs, a real PUT, real download/verification, and a real
 * signed preview URL — the gap the mocked unit tests can't cover.
 * Requires: `supabase start` already running in this checkout.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const API_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

function load(relative, cache = new Map()) {
  const filename = path.resolve(relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Request, Response, URL, TextDecoder, Uint8Array, Blob,
    process, console,
    require(name) {
      if (name === 'music-metadata') return require('music-metadata');
      if (name === './adminAccess') return { requireAdminAccess: () => { throw new Error('Unexpected default auth call'); } };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`), cache);
      return require(name);
    },
  }, { filename });
  cache.set(filename, module.exports);
  return module.exports;
}

function wav(seconds = 2) {
  const sampleRate = 8000;
  const dataSize = Math.floor(seconds * sampleRate * 2);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function main() {
  const { handleAdhanAudioAdmin } = load('lib/server/adhanAudioAdmin.ts');
  const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const mosqueId = crypto.randomUUID();
  const otherMosqueId = crypto.randomUUID();
  const { error: mosqueError } = await admin.from('mosques').insert([
    { id: mosqueId, status: 'active', time_zone: 'Europe/London' },
    { id: otherMosqueId, status: 'active', time_zone: 'Europe/London' },
  ]);
  assert.equal(mosqueError, null, `mosque insert failed: ${mosqueError?.message}`);

  const { data: adminUser, error: adminUserError } = await admin.auth.admin.createUser({
    email: `local-admin-${Date.now()}@example.invalid`, email_confirm: true,
  });
  assert.equal(adminUserError, null, `admin user create failed: ${adminUserError?.message}`);
  const adminUserId = adminUser.user.id;
  const { error: membershipError } = await admin.from('mosque_admins').insert({ user_id: adminUserId, mosque_id: mosqueId });
  assert.equal(membershipError, null, `membership insert failed: ${membershipError?.message}`);

  const { data: strangerUser } = await admin.auth.admin.createUser({
    email: `stranger-${Date.now()}@example.invalid`, email_confirm: true,
  });
  const strangerId = strangerUser.user.id;

  const env = { RECORDED_ADHAN_SETUP_ENABLED: 'true', RECORDED_ADHAN_SETUP_MOSQUE_IDS: `${mosqueId},${otherMosqueId}` };
  function contextFor(userId, opts = {}) {
    return async () => ({ context: {
      isMainAdmin: !!opts.isMainAdmin, adminMosqueIds: opts.adminMosqueIds ?? [mosqueId],
      userId, muezzinMosqueIds: [], supabaseAdmin: admin,
    } });
  }
  function request(body, mosque = mosqueId) {
    return new Request(`${API_URL}/api/admin/adhan-audio?mosqueId=${mosque}`, { method: 'POST', body: JSON.stringify(body) });
  }

  // 1. Cross-mosque rejection against a REAL RLS-backed policy function (no mosque_admins row for otherMosqueId).
  const denied = await handleAdhanAudioAdmin(request({ action: 'begin_upload' }, otherMosqueId), env, contextFor(adminUserId));
  assert.equal(denied.status, 403, `expected 403 for cross-mosque, got ${denied.status}: ${await denied.clone().text()}`);
  console.log('[pass] cross-mosque admin access rejected by real authorization + RLS');

  // 2. Real begin_upload: real signed upload URL from real Storage.
  const beginResponse = await handleAdhanAudioAdmin(request({
    action: 'begin_upload', title: 'Fajr recording', reciter: 'Test reciter',
    rightsNote: 'Staff recording, mosque owns rights', rightsConfirmed: true,
    scope: 'mosque', sizeBytes: wav(3).length, fileName: 'fajr.wav',
  }), env, contextFor(adminUserId));
  assert.equal(beginResponse.status, 200, `begin_upload failed: ${await beginResponse.clone().text()}`);
  const { assetId, uploadUrl } = await beginResponse.json();
  assert.ok(assetId && uploadUrl, 'expected assetId and a real signed uploadUrl');
  console.log('[pass] begin_upload issued a real signed Storage upload URL');

  // 3. Real PUT of actual audio bytes to the real signed URL (genuine HTTP round trip).
  const bytes = wav(3);
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT', body: bytes, headers: { 'Content-Type': 'audio/wav', 'x-upsert': 'false' },
  });
  assert.ok(putResponse.ok, `real signed PUT failed: ${putResponse.status} ${await putResponse.text()}`);
  console.log('[pass] real bytes uploaded via the real signed URL');

  // 4. complete_upload: real download from Storage + real music-metadata parse + real RPC.
  const completeResponse = await handleAdhanAudioAdmin(request({ action: 'complete_upload', assetId }), env, contextFor(adminUserId));
  assert.equal(completeResponse.status, 200, `complete_upload failed: ${await completeResponse.clone().text()}`);
  console.log('[pass] complete_upload verified real downloaded bytes and confirmed via RPC');

  // 5. preview: real signed URL that actually serves back the same bytes.
  const previewResponse = await handleAdhanAudioAdmin(request({ action: 'preview', assetId }), env, contextFor(adminUserId));
  assert.equal(previewResponse.status, 200, `preview failed: ${await previewResponse.clone().text()}`);
  const { url: previewUrl } = await previewResponse.json();
  const fetched = Buffer.from(await (await fetch(previewUrl)).arrayBuffer());
  assert.ok(fetched.equals(bytes), 'preview URL must serve back the exact uploaded bytes');
  console.log('[pass] real signed preview URL served back identical bytes');

  // 6. Stranger (no mosque_admins row, not main admin) is rejected end-to-end.
  const strangerAttempt = await handleAdhanAudioAdmin(request({ action: 'preview', assetId }), env, contextFor(strangerId, { adminMosqueIds: [] }));
  assert.equal(strangerAttempt.status, 403, `expected 403 for unaffiliated user, got ${strangerAttempt.status}`);
  console.log('[pass] unaffiliated user rejected end-to-end');

  // 7. archive works against the real RPC and real DB state.
  const archiveResponse = await handleAdhanAudioAdmin(request({ action: 'archive', assetId }), env, contextFor(adminUserId));
  assert.equal(archiveResponse.status, 200, `archive failed: ${await archiveResponse.clone().text()}`);
  const previewAfterArchive = await handleAdhanAudioAdmin(request({ action: 'preview', assetId }), env, contextFor(adminUserId));
  assert.equal(previewAfterArchive.status, 404, 'archived asset must not be previewable');
  console.log('[pass] archive works against real RPC/state and blocks further preview');

  // 8. Local admin (not main admin) cannot use the shared catalogue scope.
  const catalogueAttempt = await handleAdhanAudioAdmin(request({
    action: 'begin_upload', title: 'Catalogue attempt', reciter: 'Test', rightsNote: 'n/a',
    rightsConfirmed: true, scope: 'catalogue', sizeBytes: 1000, fileName: 'x.wav',
  }), env, contextFor(adminUserId));
  assert.equal(catalogueAttempt.status, 403, `expected 403 for local admin catalogue upload, got ${catalogueAttempt.status}`);
  console.log('[pass] local (non-main) admin blocked from shared catalogue scope, end-to-end');

  console.log('\nAll real-stack checks passed: signed upload, real PUT, real download+parse+RPC, real signed preview, cross-mosque/unaffiliated rejection, archive.');
}
main().catch((error) => { console.error('FAILED:', error); process.exitCode = 1; });
