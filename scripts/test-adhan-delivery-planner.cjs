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
    require(name) {
      const clean = name.replace(/\.ts$/, '');
      return load(path.resolve(path.dirname(absolute), `${clean}.ts`));
    },
  });
  cache.set(absolute, module.exports);
  return module.exports;
}
const { planActiveMosqueDeliveries } = load('lib/server/adhanDeliveryPlanner.ts');

const mosqueA = '11111111-1111-4111-8111-111111111111';
const mosqueB = '22222222-2222-4222-8222-222222222222';
const assetA = '33333333-3333-4333-8333-333333333333';

function makeDb({ activeMosques, mosques, settings, plans = {}, rpcErrorFor = null }) {
  const rpcCalls = [];
  return {
    rpcCalls,
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; }, or() { return query; },
        then: undefined,
        async maybeSingle() {
          if (table === 'mosque_adhan_audio_activation') return { data: null, error: null };
          if (table === 'mosques') return { data: mosques[this._id] ?? null, error: null };
          if (table === 'mosque_adhan_audio_settings') return { data: settings[this._mosqueId] ?? null, error: null };
          if (table === 'adhan_delivery_occurrences') return { data: plans[this._key] ?? null, error: null };
          return { data: null, error: null };
        },
      };
      // Track filter args minimally so maybeSingle can look up the right row.
      const originalEq = query.eq;
      query.eq = function (field, value) {
        if (field === 'id') this._id = value;
        if (field === 'mosque_id') this._mosqueId = value;
        if (field === 'local_date') this._date = value;
        if (field === 'prayer') { this._key = `${this._mosqueId}:${this._date}:${value}`; }
        return originalEq.call(this);
      };
      if (table === 'mosque_adhan_audio_activation') {
        query.then = (resolve) => resolve({ data: activeMosques.map(id => ({ mosque_id: id })), error: null });
      }
      if (table === 'adhan_audio_assets') {
        query.then = (resolve) => resolve({ data: [{ id: assetA, mosque_id: null, title: 'Catalogue', reciter: 'R', state: 'ready', duration_sec: 60 }], error: null });
      }
      return query;
    },
    async rpc(name, params) {
      rpcCalls.push({ name, params });
      if (name === 'plan_adhan_delivery_v1') {
        if (rpcErrorFor && rpcErrorFor(params)) return { data: null, error: { message: 'simulated failure' } };
        return { data: { plan_revision: params.p_expected_plan_revision + 1 }, error: null };
      }
      return { data: null, error: null };
    },
  };
}

async function readDaily(request) {
  const date = new URL(request.url).searchParams.get('date');
  return Response.json({ row: {
    fajr_adhan_time: `${date}T05:00:00Z`, dhuhr_adhan_time: `${date}T12:00:00Z`, asr_adhan_time: `${date}T15:00:00Z`,
    maghrib_adhan_time: `${date}T18:00:00Z`, isha_adhan_time: `${date}T20:00:00Z`,
  } });
}

const settingsFor = (mosqueId) => ({
  draft_mode: 'recorded_only', default_asset_id: assetA, fajr_asset_id: null, revision: 3,
  enabled_prayers: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
});

(async () => {
  // Only mosques the activation table names are ever touched — an inactive
  // mosque contributes zero database calls beyond the initial activation read.
  const inactiveOnly = makeDb({ activeMosques: [], mosques: {}, settings: {} });
  const inactiveResult = await planActiveMosqueDeliveries(inactiveOnly, readDaily, '2026-09-20T00:00:00Z');
  assert.equal(inactiveResult.length, 0);
  assert.equal(inactiveOnly.rpcCalls.length, 0, 'An inactive platform must never call plan_adhan_delivery_v1');

  // Active mosque with valid draft settings: plans 5 prayers x 2 days = 10 calls.
  const activeDb = makeDb({
    activeMosques: [mosqueA],
    mosques: { [mosqueA]: { id: mosqueA, status: 'active', time_zone: 'Europe/London', prayers_not_offered: [] } },
    settings: { [mosqueA]: settingsFor(mosqueA) },
  });
  const [outcomeA] = await planActiveMosqueDeliveries(activeDb, readDaily, '2026-09-20T00:00:00Z');
  assert.equal(outcomeA.mosqueId, mosqueA);
  assert.equal(outcomeA.planned, 10);
  assert.equal(outcomeA.errors.length, 0);
  assert.equal(activeDb.rpcCalls.filter(c => c.name === 'plan_adhan_delivery_v1').length, 10);

  // Activation naming a mosque whose draft has since been edited back to
  // live_only must skip it entirely rather than trusting the stale activation
  // row — re-activation is required to resume automation.
  const revertedDb = makeDb({
    activeMosques: [mosqueA],
    mosques: { [mosqueA]: { id: mosqueA, status: 'active', time_zone: 'Europe/London', prayers_not_offered: [] } },
    settings: { [mosqueA]: { ...settingsFor(mosqueA), draft_mode: 'live_only' } },
  });
  const [outcomeReverted] = await planActiveMosqueDeliveries(revertedDb, readDaily, '2026-09-20T00:00:00Z');
  assert.equal(outcomeReverted.skipped, 1);
  assert.equal(outcomeReverted.planned, 0);
  assert.equal(revertedDb.rpcCalls.length, 0, 'Reverted-to-live_only mosque must never reach plan_adhan_delivery_v1');

  // Multiple active mosques are each planned independently; one mosque's RPC
  // failure must not affect the other or abort the whole run.
  const multiDb = makeDb({
    activeMosques: [mosqueA, mosqueB],
    mosques: {
      [mosqueA]: { id: mosqueA, status: 'active', time_zone: 'Europe/London', prayers_not_offered: [] },
      [mosqueB]: { id: mosqueB, status: 'active', time_zone: 'Europe/London', prayers_not_offered: [] },
    },
    settings: { [mosqueA]: settingsFor(mosqueA), [mosqueB]: settingsFor(mosqueB) },
    rpcErrorFor: (params) => params.p_mosque === mosqueB,
  });
  const [outA, outB] = await planActiveMosqueDeliveries(multiDb, readDaily, '2026-09-20T00:00:00Z');
  assert.equal(outA.mosqueId, mosqueA); assert.equal(outA.planned, 10); assert.equal(outA.errors.length, 0);
  assert.equal(outB.mosqueId, mosqueB); assert.equal(outB.planned, 0); assert.equal(outB.errors.length, 10, 'Every failed slot for mosque B is recorded, not silently dropped');

  // A mosque missing entirely (deleted between activation read and lookup) is
  // reported as an error for that mosque only.
  const missingDb = makeDb({ activeMosques: [mosqueA], mosques: {}, settings: {} });
  const [outMissing] = await planActiveMosqueDeliveries(missingDb, readDaily, '2026-09-20T00:00:00Z');
  assert.equal(outMissing.errors.length, 1);
  assert.match(outMissing.errors[0], /not found/i);

  console.log('Adhan delivery planner: activation gating, reverted-draft skip, per-mosque isolation, batching and error handling passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
