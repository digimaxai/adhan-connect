// Disposable local database only. Never runs against Supabase/staging/production.
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = process.env.EVENT_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw Error('A disposable local EVENT_TEST_DATABASE_URL is required');
const run = (sql) => execFileSync('psql', [url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = n => `set role authenticated; set request.jwt.claim.sub='${uid(n)}';`;
const rpc = (action, value, event = 10) => `public.set_event_engagement('${uid(event)}','${action}',${value})`;
const get = `public.get_event_engagement('${uid(10)}')`;
const admin = `public.get_mosque_engagement('${uid(1)}','2030-01-04')`;

run(`
create schema auth;
do $$ begin
  if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table auth.users(id uuid primary key);
create table public.mosques(id uuid primary key);
create table public.events(id uuid primary key, mosque_id uuid references mosques, title text, start_at timestamptz, capacity integer, status text, is_public boolean);
create table public.mosque_jumuah_slots(id uuid primary key, mosque_id uuid, label text, salah_at time, venue text, capacity integer, sort_order integer, is_active boolean);
create table public.jumuah_attendance_intents(id uuid primary key, mosque_id uuid, slot_id uuid, friday_date date, party_size integer);
create function public.is_main_admin() returns boolean language sql as $$ select false $$;
create function public.is_local_admin_for_mosque(m uuid) returns boolean language sql as $$ select auth.uid()='${uid(4)}'::uuid and m='${uid(1)}'::uuid $$;
insert into auth.users values ('${uid(1)}'),('${uid(2)}'),('${uid(3)}'),('${uid(4)}');
insert into mosques values ('${uid(1)}'),('${uid(2)}');
insert into events values ('${uid(10)}','${uid(1)}','Test event',now()+interval '1 day',3,'published',true),
('${uid(11)}','${uid(1)}','Draft',now()+interval '1 day',3,'draft',true),
('${uid(12)}','${uid(1)}','Past',now()-interval '1 day',3,'published',true);
insert into mosque_jumuah_slots values ('${uid(20)}','${uid(1)}','Friday','13:30','Hall',10,0,true);
insert into jumuah_attendance_intents values ('${uid(30)}','${uid(1)}','${uid(20)}','2030-01-04',3),
('${uid(31)}','${uid(1)}','${uid(20)}','2030-01-11',5);
`);
run(readFileSync(new URL('../supabase/migrations/20260907120000_event_engagement.sql', import.meta.url), 'utf8'));
run(readFileSync(new URL('../supabase/migrations/20260907123000_event_engagement_write_permissions.sql', import.meta.url), 'utf8'));
const fail = (sql, message) => assert.throws(() => run(sql), e => e.stderr?.includes(message));
const json = sql => JSON.parse(run(sql));
assert.equal(json(`set role anon; select ${get};`).attendees, 0);
fail(`set role anon; select ${rpc('attendance', 1)};`, 'permission denied');
fail(`${actor(1)} select ${admin};`, 'Mosque admin access required');
fail(`${actor(4)} select public.get_mosque_engagement('${uid(2)}','2030-01-04');`, 'Mosque admin access required');
fail(`${actor(1)} insert into event_engagement(event_id,user_id) values ('${uid(10)}','${uid(1)}');`, 'permission denied');
assert.equal(json(`${actor(1)} select ${rpc('attendance', 2)};`).attendees, 2);
assert.equal(json(`${actor(1)} select ${rpc('attendance', 2)};`).attendees, 2); // idempotent
assert.equal(json(`${actor(1)} select ${rpc('like', 1)};`).liked, true);
assert.equal(json(`${actor(1)} select ${rpc('favourite', 1)};`).favourited, true);
assert.equal(json(`${actor(2)} select ${get};`).liked, false);
assert.equal(run(`${actor(2)} select count(*) from event_engagement;`), '0'); // private rows
fail(`${actor(2)} select ${rpc('attendance', 2)};`, 'Not enough spaces');
fail(`${actor(2)} select ${rpc('attendance', 9)};`, 'Invalid event response');
fail(`${actor(2)} select ${rpc('like', 2)};`, 'Invalid event response');
fail(`${actor(2)} select ${rpc('attendance', 1, 11)};`, 'Event unavailable');
fail(`${actor(2)} select ${rpc('attendance', 1, 12)};`, 'already started');
assert.equal(json(`${actor(2)} select ${rpc('attendance', 1)};`).attendees, 3);
const report = json(`${actor(4)} select ${admin};`);
assert.equal(report.events[0].attendees, 3);
assert.equal(report.events[0].parties, 2);
assert.equal(report.events[0].likes, 1);
assert.equal(report.events[0].favourites, 1);
assert.equal(report.friday[0].attendees, 3); // only requested Friday
assert.equal(json(`${actor(1)} select ${rpc('attendance', 0)};`).attendees, 1);
assert.equal(json(`${actor(1)} select ${rpc('like', 0)};`).liked, false);
assert.equal(json(`${actor(1)} select ${rpc('favourite', 0)};`).favourited, false);
// Two independent clients race for the final space. Only one may succeed.
run(`update events set capacity=2 where id='${uid(10)}';`);
const asyncExec = promisify(execFile);
const concurrent = await Promise.allSettled([1, 3].map(n => asyncExec('psql', [url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `begin; ${actor(n)} select ${rpc('attendance', 1)}; select pg_sleep(0.3); commit;`])));
assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
assert.equal(json(`set role anon; select ${get};`).attendees, 2);
console.log('PASS: attendance, cancellation, reactions, idempotency, privacy, admin scoping, Friday counts, capacity and concurrent confirmations.');
