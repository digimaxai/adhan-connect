/** Disposable local PostgreSQL only. Never accepts a database URL.
 * Tests dispatch_due_adhan_deliveries_v1's own logic (batching multiple due
 * rows, ignoring not-yet-due rows, idempotent re-invocation) in isolation
 * from pg_cron itself. pg_cron's own scheduling reliability is not this
 * repo's code to test; its extension isn't installed on this machine's or
 * CI's plain Postgres (only Supabase's hosted/Docker Postgres bundles it).
 * The real end-to-end tick — pg_cron actually invoking this function on a
 * timer and correctly resolving recorded-only / hybrid-with-live /
 * hybrid-without-live — was verified against a real local Supabase Docker
 * stack; see docs/claude-handoff-cloud-recorded-adhan-2026-09-20.md.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const bin = process.env.PG_BIN || execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adhan-dispatch-pg-'));
const data = path.join(root, 'data');
const args = ['-h', root, '-p', '55440', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
function sql(text) { return execFileSync(path.join(bin, 'psql'), args, { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }

const mosque = '11111111-1111-4111-8111-111111111111';
const asset = '22222222-2222-4222-8222-222222222222';
const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const service = 'set role service_role;';

// Extract only the function definition from the real migration (skip the
// pg_cron extension/schedule lines, which need Supabase's Postgres image).
const migration = fs.readFileSync('supabase/migrations/20260921000000_adhan_delivery_dispatch_schedule.sql', 'utf8');
const match = migration.match(/create function public\.dispatch_due_adhan_deliveries_v1[\s\S]*?\$\$;/);
const revokeMatch = migration.match(/revoke all on function public\.dispatch_due_adhan_deliveries_v1\(\)[^;]*;/);
assert.ok(match, 'dispatch_due_adhan_deliveries_v1 definition must be present in the migration');
assert.ok(revokeMatch, 'dispatch_due_adhan_deliveries_v1 revoke statement must be present in the migration');
const dispatchFunctionSql = `${match[0]}\n${revokeMatch[0]}`;

(async () => {
  execFileSync(path.join(bin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8'], { stdio: 'pipe' });
  execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-k ${root} -p 55440 -c listen_addresses=''`, '-w', 'start'], { stdio: 'pipe' });
  try {
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
      insert into public.users values ('${admin}','main_admin');
      insert into public.mosques(id) values ('${mosque}');
    `);
    sql(fs.readFileSync('supabase/migrations/20260920001000_adhan_audio_setup.sql', 'utf8'));
    sql(fs.readFileSync('supabase/migrations/20260920002000_adhan_delivery_core.sql', 'utf8'));
    sql(dispatchFunctionSql);

    sql(service + `select id from public.reserve_adhan_audio_upload('${admin}', '${mosque}', 'Test', 'Reciter', 'audio/wav', 1000, 'Staff recording with permission');`);
    const assetId = sql(service + `select id from public.adhan_audio_assets limit 1;`);
    sql(service + `select public.complete_adhan_audio_upload('${admin}', '${assetId}', 5);`);

    function occurrence(prayer, dueOffsetSeconds) {
      // Inserted as postgres (superuser, bypasses RLS/grants) — production rows
      // are created by plan_adhan_delivery_v1 (security definer), not by a
      // direct client insert; this harness only needs due rows to exist.
      return sql(`
        insert into public.adhan_delivery_occurrences
          (mosque_id, local_date, prayer, time_zone, mode, settings_revision, scheduled_at, recording_due_at,
           recording_id, recording_path, duration_sec, state)
        select '${mosque}', current_date, '${prayer}', 'Europe/London', 'recorded_only', 1, t, t,
          '${assetId}', 'path/test.wav', 5, 'planned'
        from (select clock_timestamp() + interval '${dueOffsetSeconds} seconds' as t) s
        returning id;
      `);
    }

    const due1 = occurrence('fajr', -5);
    const due2 = occurrence('dhuhr', -1);
    const notYetDue = occurrence('asr', 300);

    // Runs as postgres (superuser): in production this is invoked by pg_cron's
    // background worker under the migration-owning role, never by an app role.
    const claimedCount = sql('select public.dispatch_due_adhan_deliveries_v1();');
    assert.equal(claimedCount, '2', 'must claim exactly the two due rows in one call');

    const state = (id) => sql(`select state from public.adhan_delivery_occurrences where id = '${id}';`);
    assert.equal(state(due1), 'recording_selected');
    assert.equal(state(due2), 'recording_selected');
    assert.equal(state(notYetDue), 'planned', 'must not touch a row before its due time');

    // Idempotent: a second call finds nothing left in "planned" among the already-claimed rows.
    const secondCall = sql('select public.dispatch_due_adhan_deliveries_v1();');
    assert.equal(secondCall, '0', 'second call must be a no-op for already-claimed rows');
    assert.equal(state(due1), 'recording_selected', 'already-claimed row must be unchanged by a second call');

    // Direct execute is fail-closed to anon/authenticated/service_role: only the
    // migration-owning role (superuser in this harness) can invoke it directly.
    for (const role of ['anon', 'authenticated', 'service_role']) {
      let rejected = false;
      try { sql(`set role ${role}; select public.dispatch_due_adhan_deliveries_v1();`); }
      catch (e) { rejected = /permission denied/.test(String(e.stderr)); }
      assert.ok(rejected, `${role} must not be able to invoke the dispatcher directly`);
    }

    console.log('Adhan delivery dispatch: batches multiple due rows, ignores not-yet-due rows, idempotent re-invocation, fail-closed direct execute passed.');
  } finally {
    execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'pipe' });
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
