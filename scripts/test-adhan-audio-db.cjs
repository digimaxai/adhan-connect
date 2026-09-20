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
    create table public.users (id uuid primary key, role text);
    create table public.mosques (id uuid primary key);
    create table public.mosque_admins (user_id uuid references public.users on delete cascade, mosque_id uuid references public.mosques on delete cascade);
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    create policy legacy_broad_policy on storage.objects for all to anon, authenticated using (true) with check (true);
    insert into public.users values ('${admin}','local_admin'), ('${main}','main_admin'), ('${stranger}','user');
    insert into public.mosques values ('${mosque}'), ('${other}');
    insert into public.mosque_admins values ('${admin}','${mosque}');
  `);
  sql(fs.readFileSync('supabase/migrations/20260920001000_adhan_audio_setup.sql', 'utf8'));
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
  sql(`delete from public.users where id='${admin}';`);
  assert.equal(sql(`select count(*) from public.adhan_audio_assets where mosque_id='${mosque}' and created_by is not null`), '0');
  sql(`delete from public.mosques where id='${mosque}';`);
  assert.equal(sql(`select count(*) from public.mosque_adhan_audio_settings where mosque_id='${mosque}'`), '0');
  assert.equal(sql(`select count(*) from public.adhan_audio_assets where mosque_id='${mosque}'`), '0');
  assert.equal(sql('select count(*) from public.adhan_audio_assets where mosque_id is null'), '6');
  console.log('Adhan audio DB: grants/RLS, role/scope isolation, private bucket, quotas, concurrent saves, archive race, audit and deletion passed.');
})().catch(error => { console.error(error.message); if (error.stderr) console.error(String(error.stderr)); process.exitCode = 1; }).finally(() => {
  if (started) execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
  fs.rmSync(root, { recursive: true, force: true });
});
