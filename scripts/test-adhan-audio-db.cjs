/** Disposable local PostgreSQL only. Never accepts a database URL. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const bin = process.env.PG_BIN || execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adhan-audio-pg-'));
const data = path.join(root, 'data');
// Unix socket only; no TCP/network or remote credentials.
const args = ['-h', root, '-p', '55439', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
function sql(text) { return execFileSync(path.join(bin, 'psql'), args, { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
function rejects(text, message) {
  try { sql(text); assert.fail('Expected database rejection'); }
  catch (e) { assert.match(String(e.stderr), message); }
}
function concurrent(text) {
  return new Promise(resolve => {
    const child = spawn(path.join(bin, 'psql'), args);
    let output = ''; let error = '';
    child.stdout.on('data', b => output += b);
    child.stderr.on('data', b => error += b);
    child.on('close', code => resolve({ code, output, error }));
    child.stdin.end(text);
  });
}
const mosque = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const main = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const service = 'set role service_role;';
const reserve = (scope, actor = admin) => `select id from public.reserve_adhan_audio_upload('${actor}', ${scope ? `'${scope}'` : 'null'}, 'Adhan', 'Reciter', 'audio/wav', 32044, 'Staff recording with permission');`;
const complete = (id, actor = admin) => `select public.complete_adhan_audio_upload('${actor}', '${id}', 2);`;
const save = (revision, id, m = mosque, actor = admin) => `select revision from public.save_adhan_audio_draft('${actor}', '${m}', ${revision}, 'recorded_only', '${id}', null, array['fajr','dhuhr','asr','maghrib','isha']);`;
const archive = (id, actor = admin) => `select public.archive_adhan_audio_asset('${actor}', '${id}');`;
let started = false;
(async () => {
  execFileSync(path.join(bin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8'], { stdio: 'pipe' });
  execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-k ${root} -p 55439 -c listen_addresses=''`, '-w', 'start'], { stdio: 'pipe' });
  started = true;
  sql(`
    create role anon; create role authenticated; create role service_role bypassrls;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create table public.users (id uuid primary key, role text);
    create table public.mosques (id uuid primary key, status text default 'active', time_zone text default 'Europe/London', prayers_not_offered text[]);
    create table public.streams (id uuid primary key, mosque_id uuid references public.mosques on delete cascade, current_prayer text, is_live boolean, started_at timestamptz);
    create table public.mosque_admins (user_id uuid references public.users on delete cascade, mosque_id uuid references public.mosques on delete cascade);
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    create policy legacy_broad_policy on storage.objects for all to anon, authenticated using (true) with check (true);
    insert into public.users values ('${admin}','local_admin'), ('${main}','main_admin'), ('${stranger}','user');
    insert into public.mosques(id) values ('${mosque}'), ('${other}');
    insert into public.mosque_admins values ('${admin}','${mosque}');
  `);
  sql(fs.readFileSync('supabase/migrations/20260920001000_adhan_audio_setup.sql', 'utf8'));
  sql(fs.readFileSync('supabase/migrations/20260920002000_adhan_delivery_core.sql', 'utf8'));
  // Activation only: 20260921000000 (dispatch) and 20260922001000 (plan
  // schedule) both `create extension pg_cron`, unavailable on this plain
  // Postgres install (only Supabase's hosted/Docker Postgres bundles it) —
  // both were verified for real against that stack instead; see
  // docs/claude-handoff-cloud-recorded-adhan-2026-09-20.md.
  sql(fs.readFileSync('supabase/migrations/20260922000000_adhan_audio_activation.sql', 'utf8'));
  assert.equal(sql("select public from storage.buckets where id = 'adhan-audio'"), 'f');
  for (const role of ['anon', 'authenticated']) {
    rejects(`set role ${role}; select * from public.adhan_audio_assets;`, /permission denied/);
    rejects(`set role ${role}; ${reserve(mosque)}`, /permission denied/);
    rejects(`set role ${role}; insert into storage.objects(bucket_id) values ('adhan-audio');`, /row-level security/);
    sql(`set role ${role}; insert into storage.objects(bucket_id) values ('existing-bucket');`);
    assert.equal(sql(`set role ${role}; select count(*) from storage.objects where bucket_id = 'adhan-audio';`), '0');
  }
  rejects(service + reserve(other), /admin access required/i);
  rejects(service + reserve(null), /admin access required/i);
  rejects(service + reserve(mosque, stranger), /admin access required/i);
  rejects(service + "update public.adhan_audio_assets set state='archived';", /permission denied/);
  rejects(service + "delete from public.adhan_delivery_occurrences;", /permission denied/);
  const asset = sql(service + reserve(mosque));
  rejects(service + save(0, asset), /ready recording/i);
  sql(service + complete(asset)); sql(service + complete(asset));
  const foreign = sql(service + reserve(other, main));
  sql(service + complete(foreign, main));
  rejects(service + save(0, foreign), /ready recording/i);
  rejects(service + archive(foreign), /admin access required/i);
  const shared = sql(service + reserve(null, main)); sql(service + complete(shared, main));
  const saves = await Promise.all([concurrent(service + save(0, asset)), concurrent(service + save(0, shared))]);
  assert.equal(saves.filter(r => r.code === 0).length, 1, JSON.stringify(saves));
  assert.equal(saves.filter(r => /Settings changed/.test(r.error)).length, 1);
  assert.equal(sql(`select revision from public.mosque_adhan_audio_settings where mosque_id='${mosque}'`), '1');
  const selected = sql(`select default_asset_id from public.mosque_adhan_audio_settings where mosque_id='${mosque}'`);
  rejects(service + archive(selected, main), /selected in saved settings/i);
  rejects(service + save(0, asset), /Settings changed/);
  assert.equal(sql(service + save(1, asset)), '2');
  const racing = sql(service + reserve(mosque)); sql(service + complete(racing));
  const race = await Promise.all([concurrent(service + save(2, racing)), concurrent(service + archive(racing))]);
  assert.equal(race.filter(r => r.code === 0).length, 1, JSON.stringify(race));
  assert.equal(sql(`select count(*) from public.mosque_adhan_audio_settings s join public.adhan_audio_assets a on a.id = s.default_asset_id where a.state <> 'ready';`), '0');
  rejects(service + `select public.save_adhan_audio_draft('${admin}','${mosque}', (select revision from public.mosque_adhan_audio_settings where mosque_id='${mosque}'), 'recorded_only','${asset}',null,array['fajr','fajr']);`, /Duplicate prayer/);
  rejects(service + `select public.save_adhan_audio_draft('${admin}','${mosque}', (select revision from public.mosque_adhan_audio_settings where mosque_id='${mosque}'), 'recorded_only','${asset}',null,array['sunrise']);`, /check constraint/);
  for (let i = 0; i < 4; i++) sql(service + reserve(null, main));
  rejects(service + reserve(null, main), /Recording limit/);
  const pending = sql(`select id from public.adhan_audio_assets where mosque_id is null and state='uploading' limit 1;`);
  sql(service + archive(pending, main));
  rejects(service + complete(pending, main), /archived/i);
  sql(service + reserve(null, main));
  assert.ok(Number(sql('select count(*) from public.adhan_audio_audit;')) > 10);
  // Durable delivery core: no real schedules, media service or notifications.
  const coreAsset = sql(service + reserve(mosque));
  sql(service + `select public.complete_adhan_audio_upload('${admin}','${coreAsset}',120);`);
  const instant = offset => sql(`select (clock_timestamp() + interval '${offset}')::text;`);
  const plan = (prayer, time, mode = 'recorded_only', expected = 0, revision = 1) =>
    `select row_to_json(r) from public.plan_adhan_delivery_v1('${mosque}',('${time}'::timestamptz at time zone 'Europe/London')::date,'${prayer}','${time}','${mode}',${revision},'${coreAsset}',${expected}) r;`;
  const claim = (id, revision = 1) => `select row_to_json(r) from public.claim_adhan_delivery_v1('${id}',${revision}) r;`;
  const confirm = (id, stream, revision = 1) => `select public.confirm_adhan_delivery_live_v1('${id}','${stream}',${revision});`;
  const cancel = (id, actor = admin) => `select state from public.cancel_adhan_delivery_v1('${actor}','${id}');`;
  const immediate = JSON.parse(sql(service + plan('fajr', instant('-1 second'))));
  assert.equal(immediate.recording_due_at, immediate.scheduled_at);
  const claims = await Promise.all([concurrent(service + claim(immediate.id)), concurrent(service + claim(immediate.id))]);
  claims.forEach(r => assert.equal(r.code, 0, r.error));
  const winners = claims.map(r => JSON.parse(r.output));
  assert.equal(winners[0].state, 'recording_selected');
  assert.equal(winners[0].started_at, winners[1].started_at, 'Concurrent workers share one start');
  assert.equal(winners[0].ends_at, winners[1].ends_at);
  rejects('set role authenticated;' + claim(immediate.id), /permission denied/);
  rejects(service + claim(immediate.id, 'null'), /Expected plan revision/);
  rejects('set role anon; select * from public.adhan_delivery_occurrences;', /permission denied/);
  rejects(service + archive(coreAsset), /reserved for a pending or active/);

  const liveSlot = JSON.parse(sql(service + plan('dhuhr', instant('1 minute'), 'live_with_fallback')));
  assert.equal(Date.parse(liveSlot.recording_due_at) - Date.parse(liveSlot.scheduled_at), 10000);
  const stream = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  sql(`insert into public.streams values ('${stream}','${other}','dhuhr',true,clock_timestamp());`);
  assert.equal(sql(service + confirm(liveSlot.id, stream)), 'f', 'Wrong mosque stream rejected');
  sql(`update public.streams set mosque_id='${mosque}',current_prayer='asr' where id='${stream}';`);
  assert.equal(sql(service + confirm(liveSlot.id, stream)), 'f', 'Wrong prayer stream rejected');
  sql(`update public.streams set current_prayer='dhuhr' where id='${stream}';`);
  assert.equal(sql(service + confirm(liveSlot.id, stream, 99)), 'f', 'Stale readiness rejected');
  assert.equal(sql(service + confirm(liveSlot.id, stream)), 't');
  assert.equal(sql(service + confirm(liveSlot.id, stream)), 't', 'Same confirmed live is idempotent');
  assert.equal(JSON.parse(sql(service + plan('dhuhr', instant('2 minutes'), 'live_with_fallback', 1, 2))).scheduled_at,
    liveSlot.scheduled_at, 'Timetable edits cannot erase an early live delivery');
  assert.equal(JSON.parse(sql(service + claim(liveSlot.id))).state, 'live_selected');
  sql(`update public.streams set is_live=false where id='${stream}';`);
  assert.equal(JSON.parse(sql(service + claim(liveSlot.id))).state, 'live_selected', 'No rescue after live has won');

  const fallback = JSON.parse(sql(service + plan('asr', instant('-11 seconds'), 'live_with_fallback')));
  sql(`update public.streams set is_live=true,current_prayer='asr',started_at=clock_timestamp()-interval '12 seconds' where id='${stream}';`);
  const raced = await Promise.all([concurrent(service + confirm(fallback.id, stream)), concurrent(service + claim(fallback.id))]);
  raced.forEach(r => assert.equal(r.code, 0, r.error));
  assert.equal(raced[0].output.trim(), 'f', 'Live confirmation at/after deadline cannot win');
  assert.equal(JSON.parse(raced[1].output).state, 'recording_selected', 'is_live marker alone cannot suppress fallback');
  assert.equal(sql(service + confirm(fallback.id, stream)), 'f');
  const missed = JSON.parse(sql(service + plan('maghrib', instant('-5 minutes'))));
  assert.equal(missed.state, 'expired');
  assert.equal(JSON.parse(sql(service + plan('maghrib', instant('5 minutes')))).id, missed.id);
  assert.equal(JSON.parse(sql(service + claim(missed.id))).state, 'expired');

  const future = instant('10 minutes');
  const edited = JSON.parse(sql(service + plan('isha', future, 'recorded_only')));
  const shifted = instant('11 minutes');
  const revised = JSON.parse(sql(service + plan('isha', shifted, 'live_with_fallback', 1, 2)));
  assert.equal(revised.id, edited.id);
  assert.equal(revised.plan_revision, 2);
  assert.equal(JSON.parse(sql(service + plan('isha', shifted, 'live_with_fallback', 1, 2))).plan_revision, 2, 'Exact retry is idempotent');
  assert.equal(JSON.parse(sql(service + plan('isha', future, 'recorded_only', 2, 1))).plan_revision, 2, 'Old settings cannot overwrite new settings');
  assert.equal(JSON.parse(sql(service + plan('isha', future, 'recorded_only', 1, 2))).plan_revision, 2, 'Out-of-order planner cannot overwrite a newer plan');
  assert.equal(JSON.parse(sql(service + claim(revised.id, 1))).state, 'planned');
  rejects(service + cancel(revised.id, stranger), /admin access required/i);
  sql(`update public.mosques set prayers_not_offered=array['isha'] where id='${mosque}';`);
  assert.equal(JSON.parse(sql(service + claim(revised.id, 2))).state, 'cancelled');
  rejects(service + plan('isha', shifted, 'recorded_only', 2), /not offered/);
  sql(`update public.mosques set prayers_not_offered=null where id='${mosque}';`);
  assert.equal(JSON.parse(sql(service + plan('isha', future, 'recorded_only', 2))).state, 'cancelled', 'Cancellation cannot replay under a new time');
  assert.equal(sql(service + cancel(immediate.id)), 'cancelled');
  assert.equal(JSON.parse(sql(service + claim(immediate.id))).state, 'cancelled');
  console.log('Adhan delivery DB: one winner, grace deadline, scoped readiness, stale jobs/plans, no replay/handover, archive protection and cancellation passed.');

  // Activation gate: the only thing a planner/scheduler may read as "is this
  // mosque on". Draft settings alone must never be sufficient.
  const activate = (rev, actor = admin) => `select row_to_json(r) from public.activate_adhan_audio_v1('${actor}','${mosque}',${rev}) r;`;
  const deactivate = (actor = admin) => `select row_to_json(r) from public.deactivate_adhan_audio_v1('${actor}','${mosque}') r;`;
  const currentRevision = () => Number(sql(`select revision from public.mosque_adhan_audio_settings where mosque_id='${mosque}';`));
  rejects('set role anon; select * from public.mosque_adhan_audio_activation;', /permission denied/);
  rejects('set role authenticated;' + activate(currentRevision()), /permission denied/);
  rejects(service + activate(currentRevision(), stranger), /admin access required/i);
  rejects(service + activate(currentRevision() - 1), /Settings changed/);
  const liveOnlyMosque = other;
  rejects(service + `select public.activate_adhan_audio_v1('${main}','${liveOnlyMosque}',0);`, /Choose recorded or hybrid mode/);
  const activated = JSON.parse(sql(service + activate(currentRevision())));
  assert.equal(activated.active, true);
  assert.equal(sql(`select active from public.mosque_adhan_audio_activation where mosque_id='${mosque}';`), 't');
  assert.ok(Number(sql(`select count(*) from public.adhan_audio_audit where mosque_id='${mosque}' and action='activated';`)) >= 1);
  // Belt-and-braces asset check: save_adhan_audio_draft only accepts a ready
  // asset at save time, and archive_adhan_audio_asset already refuses to
  // archive a currently-selected one — so this branch is largely unreachable
  // through the RPCs alone. Prove activate_adhan_audio_v1 still refuses a
  // settings row an admin-bypass query points at a non-ready asset, rather
  // than trusting those other layers alone.
  const notReadyAsset = sql(service + reserve(mosque));
  sql(`update public.mosque_adhan_audio_settings set default_asset_id='${notReadyAsset}' where mosque_id='${mosque}';`);
  rejects(service + activate(currentRevision()), /no longer ready/);
  sql(service + save(currentRevision(), coreAsset));
  sql(service + activate(currentRevision()));

  // A fresh calendar date (tomorrow): every prayer "today" already has an
  // occurrence from earlier in this script, and plan_adhan_delivery_v1 is a
  // no-op against an existing row that has left the "planned" state.
  const pendingForDeactivation = JSON.parse(sql(service + plan('fajr', instant('1 day 10 minutes'), 'recorded_only', 0, 5)));
  assert.equal(pendingForDeactivation.state, 'planned');
  const deactivated = JSON.parse(sql(service + deactivate()));
  assert.equal(deactivated.active, false);
  assert.equal(JSON.parse(sql(`select row_to_json(o) from public.adhan_delivery_occurrences o where id='${pendingForDeactivation.id}';`)).state,
    'cancelled', 'Deactivation must cancel a still-pending occurrence');
  assert.equal(JSON.parse(sql(`select row_to_json(o) from public.adhan_delivery_occurrences o where id='${missed.id}';`)).state,
    'expired', 'Deactivation must never touch an occurrence that already left planned for another reason');
  rejects(service + deactivate(stranger), /admin access required/i);
  console.log('Adhan audio activation: fail-closed gates, settings/asset validation, audit trail, and deactivation-cancels-pending passed.');
  sql(`delete from public.users where id='${admin}';`);
  assert.equal(sql(`select count(*) from public.adhan_audio_assets where mosque_id='${mosque}' and created_by is not null`), '0');
  sql(`delete from public.mosques where id='${mosque}';`);
  assert.equal(sql(`select count(*) from public.mosque_adhan_audio_settings where mosque_id='${mosque}'`), '0');
  assert.equal(sql(`select count(*) from public.adhan_delivery_occurrences where mosque_id='${mosque}'`), '0');
  assert.equal(sql(`select count(*) from public.adhan_audio_assets where mosque_id='${mosque}'`), '0');
  assert.equal(sql('select count(*) from public.adhan_audio_assets where mosque_id is null'), '6');
  console.log('Adhan audio DB: grants/RLS, role/scope isolation, private bucket, quotas, concurrent saves, archive race, audit and deletion passed.');
})().catch(error => { console.error(error.message); if (error.stderr) console.error(String(error.stderr)); process.exitCode = 1; }).finally(() => {
  if (started) execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
  fs.rmSync(root, { recursive: true, force: true });
});
