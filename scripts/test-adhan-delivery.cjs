const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams, Request, Response,
    require(name) { return load(path.resolve(path.dirname(absolute), name.endsWith('.ts') ? name : `${name}.ts`)); },
  });
  cache.set(absolute, module.exports);
  return module.exports;
}
const rules = load('lib/adhanDelivery.ts');
const { ADHAN_PRAYERS } = load('lib/adhanAudio.ts');
const { loadAdhanSchedulePreview } = load('lib/server/adhanSchedulePreview.ts');
const mosque = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';
const fajrId = '33333333-3333-4333-8333-333333333333';
const streamId = '44444444-4444-4444-8444-444444444444';
const assets = [assetId, fajrId].map(id => ({ id, mosque_id: mosque, title: id === fajrId ? 'Fajr recording' : 'Default recording', state: 'ready', duration_sec: 120 }));
const settings = { draft_mode: 'recorded_only', default_asset_id: assetId, fajr_asset_id: fajrId, revision: 1, enabled_prayers: [...ADHAN_PRAYERS] };
const input = { mosqueId: mosque, localDate: '2026-09-20', timeZone: 'Europe/London', mosqueActive: true,
  notOffered: [], settings, assets, trustedTimes: [...ADHAN_PRAYERS],
  adhanTimes: Object.fromEntries(ADHAN_PRAYERS.map(p => [p, '2026-09-20T05:00:00Z'])) };
const at = seconds => new Date(Date.parse('2026-09-20T05:00:00Z') + seconds * 1000).toISOString();
const day = rules.planAdhanDay(input);
const slot = day[0];
assert.equal(slot.recordingId, fajrId);
assert.equal(day[1].recordingId, assetId);
assert.equal(slot.scheduledAt, slot.recordingDueAt, 'Recorded-only has zero intentional delay');
assert.equal(rules.decideAdhanDelivery({ slot, now: at(-0.001) }).source, 'wait');
assert.equal(rules.decideAdhanDelivery({ slot, now: at(0) }).source, 'recording');
assert.equal(rules.decideAdhanDelivery({ slot, now: at(29.999) }).source, 'recording');
assert.equal(rules.decideAdhanDelivery({ slot, now: at(30) }).source, 'none');
const hybrid = rules.planAdhanDay({ ...input, settings: { ...settings, draft_mode: 'live_with_fallback' } })[0];
assert.equal(hybrid.recordingDueAt, at(10));
const decision = args => rules.decideAdhanDelivery({ slot: hybrid, now: at(10), ...args });
const proof = seconds => ({ occurrenceKey: hybrid.key, streamId, readyAt: at(seconds) });
assert.equal(decision({ now: at(9.999) }).source, 'wait');
assert.equal(decision({}).source, 'recording');
assert.equal(decision({ confirmedLive: proof(9.999) }).source, 'live');
assert.equal(decision({ confirmedLive: proof(10) }).source, 'recording');
assert.equal(decision({ confirmedLive: { ...proof(5), occurrenceKey: 'other-prayer' } }).source, 'recording');
assert.equal(decision({ confirmedLive: proof(-181) }).source, 'recording');
assert.equal(decision({ confirmedLive: proof(11) }).source, 'recording');
assert.equal(decision({ now: at(100), confirmedLive: proof(-120) }).source, 'live', 'Earlier completed live must suppress a second adhan');
const recordingWinner = decision({});
assert.equal(decision({ now: at(12), previousWinner: recordingWinner, confirmedLive: proof(8) }), recordingWinner, 'Late proof cannot replace a recording');
const liveWinner = decision({ confirmedLive: proof(8) });
assert.equal(decision({ now: at(100), previousWinner: liveWinner }), liveWinner, 'Disconnect cannot start fallback after live won');
assert.equal(decision({ previousWinner: { ...liveWinner, occurrenceKey: 'another-occurrence' } }).source, 'recording');
assert.equal(rules.planAdhanDay({ ...input, adhanTimes: { ...input.adhanTimes, fajr: at(60) } })[0].key, slot.key, 'Timetable edits cannot change occurrence identity');
assert.equal(rules.planAdhanDay({ ...input, notOffered: ['fajr'] })[0].status, 'not_offered');
assert.equal(rules.planAdhanDay({ ...input, assets: [] })[0].status, 'blocked');
assert.equal(rules.planAdhanDay({ ...input, assets: assets.map(a => ({ ...a, mosque_id: streamId })) })[0].status, 'blocked');
assert.equal(rules.planAdhanDay({ ...input, mosqueActive: false })[0].status, 'blocked');
assert.equal(rules.planAdhanDay({ ...input, trustedTimes: [] })[0].status, 'blocked');
assert.equal(rules.planAdhanDay({ ...input, adhanTimes: { fajr: '05:00' } })[0].status, 'blocked');
assert.equal(rules.planAdhanDay({ ...input, adhanTimes: { fajr: '2026-09-19T05:00:00Z' } })[0].status, 'blocked');
assert.equal(rules.planAdhanDay({ ...input, settings: { ...settings, enabled_prayers: ['dhuhr'] } })[0].status, 'live_only');
assert.equal(rules.planAdhanDay({ ...input, settings: { ...settings, fajr_asset_id: null } })[0].recordingId, assetId);
assert.equal(rules.mosqueLocalDate('2026-09-19T23:30:00Z', 'Asia/Dhaka'), '2026-09-20');
assert.equal(rules.mosqueLocalDate('2026-09-20T01:00:00Z', 'America/New_York'), '2026-09-19');
assert.equal(rules.nextCalendarDate('2028-02-28'), '2028-02-29');
assert.equal(rules.nextCalendarDate('2026-12-31'), '2027-01-01');
assert.throws(() => rules.nextCalendarDate('2026-02-30'));
assert.throws(() => rules.mosqueLocalDate(at(0), 'Invalid/Timezone'));
for (const value of ['2026-02-30T05:00:00Z', '2026-09-20T05:00:00', '05:00', null]) assert.equal(rules.explicitInstant(value), null);
const dst = rules.planAdhanDay({ ...input, localDate: '2026-10-25', adhanTimes: { fajr: '2026-10-25T01:30:00+01:00', dhuhr: '2026-10-25T01:30:00+00:00' } });
assert.equal(Date.parse(dst[1].scheduledAt) - Date.parse(dst[0].scheduledAt), 3600000, 'DST repeated hours retain explicit offsets');
const dhaka = rules.planAdhanDay({ ...input, timeZone: 'Asia/Dhaka', adhanTimes: { fajr: '2026-09-19T23:00:00Z' } });
assert.equal(dhaka[0].status, 'ready', 'UTC previous date can be the correct mosque-local prayer date');

(async () => {
  let zone = 'Europe/London'; let canonical = null;
  const db = { from(table) {
    const query = {
      select() { return query; }, eq() { return query; }, or() { return query; },
      async maybeSingle() { return { data: table === 'mosques' ? { id: mosque, status: 'active', time_zone: zone, prayers_not_offered: ['isha'] } : table === 'prayer_times' ? canonical : settings }; },
      then(resolve, reject) { return Promise.resolve({ data: assets }).then(resolve, reject); },
    };
    return query;
  } };
  const dates = [];
  async function readDaily(request) {
    const date = new URL(request.url).searchParams.get('date'); dates.push(date);
    return Response.json({ row: Object.fromEntries(ADHAN_PRAYERS.map(p => [`${p}_adhan_time`, `${date}T05:00:00Z`])) });
  }
  const preview = await loadAdhanSchedulePreview({ supabaseAdmin: db }, mosque, settings, readDaily, at(0));
  assert.equal(preview.slots.length, 10);
  assert.equal(preview.automaticPlaybackActive, false);
  assert.equal(dates.join(','), '2026-09-20,2026-09-21');
  assert.equal(preview.slots[4].status, 'not_offered');
  await assert.rejects(loadAdhanSchedulePreview({ supabaseAdmin: db }, mosque, { ...settings, revision: 2 }, readDaily, at(0)), /Save your changes/);
  zone = 'Asia/Dhaka';
  const blocked = await loadAdhanSchedulePreview({ supabaseAdmin: db }, mosque, settings, readDaily, at(0));
  assert.equal(blocked.slots[0].status, 'blocked', 'Non-London fallback times need canonical verification');
  canonical = { fajr_adhan_time: '2026-09-20T05:00:00Z' };
  const partial = await loadAdhanSchedulePreview({ supabaseAdmin: db }, mosque, settings, readDaily, at(0));
  assert.equal(partial.slots[0].status, 'ready'); assert.equal(partial.slots[1].status, 'blocked');
  zone = 'Invalid/Zone';
  await assert.rejects(loadAdhanSchedulePreview({ supabaseAdmin: db }, mosque, settings, readDaily, at(0)), /valid mosque timezone/);
  console.log('Adhan delivery: timing boundaries, occurrence identity, Fajr selection, exclusions, stale/future live evidence, no handover, local dates/DST, and saved-schedule preview passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
