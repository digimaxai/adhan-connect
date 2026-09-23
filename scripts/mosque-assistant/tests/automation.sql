\set ON_ERROR_STOP on
begin;
do $$
declare m uuid := '20000000-0000-0000-0000-000000000001'; j uuid; result jsonb; before_count integer;
begin
  insert into mosques(id,name) values(m,'Automatically Discovered Mosque');
  if has_function_privilege('authenticated','public.schedule_mosque_assistant(timestamptz)','execute') then raise exception 'Public client can run scheduler'; end if;
  result:=schedule_mosque_assistant('2026-09-06T12:00:00Z');
  select id into j from mosque_assistant_jobs where mosque_id=m and month='2026-09' and status='queued' and origin='automatic';
  if j is null then raise exception 'New mosque was not discovered automatically'; end if;
  if (schedule_mosque_assistant('2026-09-06T12:01:00Z')->>'queued')::integer<>0 then raise exception 'Scheduler did not respect cadence'; end if;
  update mosque_assistant_jobs set status='review' where id=j;
  perform schedule_mosque_assistant('2026-09-20T12:00:00Z');
  if not exists(select 1 from mosque_assistant_jobs where mosque_id=m and month='2026-10' and status='queued') then raise exception 'Pending September review blocked October discovery'; end if;
  if (select status from mosque_assistant_jobs where id=j)<>'review' then raise exception 'Scheduler overwrote owner review'; end if;
  update mosque_assistant_jobs set status='failed',updated_at='2026-09-20T12:00:00Z' where mosque_id=m and month='2026-10';
  perform schedule_mosque_assistant('2026-09-20T12:06:00Z');
  if exists(select 1 from mosque_assistant_jobs where mosque_id=m and month='2026-10' and status='queued') then raise exception 'Failed scan retried without backoff'; end if;
  perform schedule_mosque_assistant('2026-09-21T12:00:00Z');
  if not exists(select 1 from mosque_assistant_jobs where mosque_id=m and month='2026-10' and status='queued') then raise exception 'Failed scan did not retry after one day'; end if;
  update mosque_assistant_automation set enabled=false;
  insert into mosques(id,name) values('20000000-0000-0000-0000-000000000002','Added while paused');
  select count(*) into before_count from mosque_assistant_jobs;
  perform schedule_mosque_assistant('2026-09-22T12:00:00Z');
  if (select count(*) from mosque_assistant_jobs)<>before_count then raise exception 'Pause did not stop scheduling'; end if;
  update mosque_assistant_automation set enabled=true;
  perform schedule_mosque_assistant('2026-09-22T12:06:00Z');
  if not exists(select 1 from mosque_assistant_jobs where mosque_id='20000000-0000-0000-0000-000000000002') then raise exception 'Resume did not pick up new mosque'; end if;
  insert into mosques(name) select 'Batch Mosque '||n from generate_series(1,120) n;
  result:=schedule_mosque_assistant('2026-09-22T12:12:00Z');
  if (result->>'queued')::integer<>100 then raise exception 'Automatic batch bound failed'; end if;
  raise notice 'PASS: automatic discovery, cadence, private scheduling, next-month scanning, preserved reviews, retry backoff, pause/resume and batch bounds';
end $$;
rollback;
