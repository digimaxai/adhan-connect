\set ON_ERROR_STOP on
create temporary table compatibility_schema_after as
 select 'function:'||p.oid::regprocedure::text as key,md5(pg_get_functiondef(p.oid)) as digest from pg_proc p
 where p.pronamespace='public'::regnamespace and p.proname in ('start_live_broadcast_v1','end_live_broadcast_v1','enqueue_due_adhan_reminders_v1','enqueue_live_adhan_notification_v1')
 union all select 'policy:'||schemaname||'.'||tablename||'.'||policyname,md5(to_jsonb(p)::text) from pg_policies p where schemaname='public'
 union all select 'trigger:'||tgrelid::regclass::text||'.'||tgname,md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal;
do $$ declare b record; snapshot jsonb; begin
 if exists(select 1 from compatibility_schema_baseline base left join compatibility_schema_after a using(key) where a.digest is distinct from base.digest) then raise exception 'Existing function, policy or trigger was changed by the migration'; end if;
 for b in select * from compatibility_data_baseline loop
  if b.relation='mosques' then
   select coalesce(jsonb_agg(to_jsonb(m)-array['website','contact_phone','contact_email','management_info','services_info'] order by id),'[]') into snapshot from mosques m;
  else execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]'') from public.%I t',b.relation) into snapshot; end if;
  if snapshot is distinct from b.rows then raise exception 'Migration changed existing rows in %',b.relation; end if;
 end loop;
 if (select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename in ('prayer_times','mosques','streams','adhans'))<>4 then raise exception 'Realtime publication membership changed'; end if;
 raise notice 'PASS: existing operational data, functions, RLS policies, triggers and Realtime membership unchanged by both migrations';
end $$;
select public.test_operational_flows();

-- Test actual publication beside existing operational data.
do $$
declare
 owner_id uuid:='30000000-0000-0000-0000-000000000001'; assigned uuid:='30000000-0000-0000-0000-000000000002';
 m uuid:='40000000-0000-0000-0000-000000000001'; d date:=((clock_timestamp() at time zone 'UTC')::date+2);
 j uuid; imp uuid; r jsonb; review jsonb; before_rota jsonb; before_stream jsonb; before_assignment jsonb; before_mosque jsonb; before_count bigint; caught boolean;
begin
 r:=jsonb_build_array(jsonb_build_object('date',d,'fajr','05:00','fajr_iqama','05:30','dhuhr','12:00','asr','15:00','maghrib','18:00','isha','20:00'));
 review:='{"websiteConfirmed":true,"timeZone":"UTC","profile":{},"table":{"source_url":"https://example.org/timetable"}}';
 insert into staff_rota(mosque_id,staff_user_id,muezzin_user_id,duty_date,date,prayer,prayer_name,notes)
 values(m,assigned,assigned,d,d,'fajr','fajr','Preserve assignment; use canonical times');
 select jsonb_agg(to_jsonb(sr) order by id) into before_rota from staff_rota sr;
 select jsonb_agg(to_jsonb(s) order by id) into before_stream from streams s;
 select jsonb_agg(to_jsonb(mu) order by id) into before_assignment from muezzins mu;
 select to_jsonb(mq) into before_mosque from mosques mq where id=m;
 select count(*) into before_count from prayer_times;
 perform enqueue_mosque_assistant(owner_id,to_char(d,'YYYY-MM'),array[m]);
 select id into j from mosque_assistant_jobs where mosque_id=m and month=to_char(d,'YYYY-MM') and status='queued';
 perform claim_mosque_assistant();
 if (select count(*) from prayer_times)<>before_count then raise exception 'Discovery modified live timetable'; end if;
 update mosque_assistant_jobs set status='review' where id=j;
 imp:=publish_mosque_assistant(owner_id,j,review,r);
 if (select jsonb_agg(to_jsonb(sr) order by id) from staff_rota sr) is distinct from before_rota then raise exception 'Publication modified rota assignments'; end if;
 if (select jsonb_agg(to_jsonb(s) order by id) from streams s) is distinct from before_stream then raise exception 'Publication modified broadcast streams'; end if;
 if (select jsonb_agg(to_jsonb(mu) order by id) from muezzins mu) is distinct from before_assignment then raise exception 'Publication modified muezzin membership'; end if;
 if (select to_jsonb(mq) from mosques mq where id=m) is distinct from before_mosque then raise exception 'Timetable publication modified mosque configuration'; end if;
 perform enqueue_due_adhan_reminders_v1(((d+time '05:00') at time zone 'UTC')-interval '10 minutes');
 if not exists(select 1 from notification_events where kind='muezzin_duty' and user_id=assigned and (data->>'scheduledAt')::timestamptz=(d+time '05:00') at time zone 'UTC') then raise exception 'Assigned reminder did not use the published canonical time'; end if;
 -- Preserve a saved rota time, and reject a conflicting canonical replacement.
 update staff_rota set adhan_time=(d+time '05:00') at time zone 'UTC' where mosque_id=m and date=d;
 perform enqueue_mosque_assistant(owner_id,to_char(d,'YYYY-MM'),array[m]);
 select id into j from mosque_assistant_jobs where mosque_id=m and month=to_char(d,'YYYY-MM') and status='queued';
 update mosque_assistant_jobs set status='review' where id=j;
 caught:=false;
 begin perform publish_mosque_assistant(owner_id,j,review,jsonb_set(r,'{0,fajr}','"05:15"')); exception when others then caught:=sqlerrm like '%existing rota time%'; end;
 if not caught then raise exception 'Conflicting rota time was accepted'; end if;
 if (select fajr_adhan_time from prayer_times where mosque_id=m and date=d)<>(d+time '05:00') at time zone 'UTC' then raise exception 'Failed publish partially changed times'; end if;
 -- Existing reminders must not be silently left with a replaced time either.
 update staff_rota set adhan_time=null where mosque_id=m and date=d;
 caught:=false;
 begin perform publish_mosque_assistant(owner_id,j,review,jsonb_set(r,'{0,fajr}','"05:15"')); exception when others then caught:=sqlerrm like '%Reminders already exist%'; end;
 if not caught then raise exception 'Prequeued reminder conflict was accepted'; end if;
 caught:=false;
 begin perform publish_mosque_assistant(owner_id,j,jsonb_set(review,'{timeZone}','"Europe/London"'),r); exception when others then caught:=sqlerrm like '%timezone differs%'; end;
 if not caught then raise exception 'Mosque timezone change was accepted'; end if;
 update streams set is_live=true where mosque_id=m;
 caught:=false;
 begin perform publish_mosque_assistant(owner_id,j,review,r); exception when others then caught:=sqlerrm like '%live broadcast is active%'; end;
 if not caught then raise exception 'Timetable was published during a live broadcast'; end if;
 update streams set is_live=false where mosque_id=m;
 update mosque_assistant_jobs set status='rejected' where id=j;
 -- Keep an imminent prayer unchanged during notification/broadcast lead time.
 perform enqueue_mosque_assistant(owner_id,to_char(now(),'YYYY-MM'),array[m]);
 select id into j from mosque_assistant_jobs where mosque_id=m and status='queued';
 update mosque_assistant_jobs set status='review' where id=j;
 caught:=false;
 begin perform publish_mosque_assistant(owner_id,j,review,jsonb_set(jsonb_set(r,'{0,date}',to_jsonb(to_char(now() at time zone 'UTC','YYYY-MM-DD'))),'{0,fajr}',to_jsonb(to_char(now() at time zone 'UTC','HH24:MI')))); exception when others then caught:=sqlerrm like '%reminder/broadcast window%'; end;
 if not caught then raise exception 'Imminent prayer change was accepted'; end if;
 update mosque_assistant_jobs set status='rejected' where id=j;
 -- Current live RPC keys dates in UTC; do not introduce incompatible local dates.
 update mosques set time_zone='Asia/Dhaka' where id=m;
 perform enqueue_mosque_assistant(owner_id,to_char(d,'YYYY-MM'),array[m]);
 select id into j from mosque_assistant_jobs where mosque_id=m and status='queued';
 update mosque_assistant_jobs set status='review' where id=j;
 caught:=false;
 begin perform publish_mosque_assistant(owner_id,j,jsonb_set(review,'{timeZone}','"Asia/Dhaka"'),r); exception when others then caught:=sqlerrm like '%crosses the UTC date%'; end;
 if not caught then raise exception 'UTC/local date mismatch was accepted'; end if;
 update mosques set time_zone='UTC' where id=m;
 update mosque_assistant_jobs set status='rejected' where id=j;
 -- Existing manual write path remains valid after an assistant import.
 update prayer_times set fajr_iqama_time=(d+time '05:40') at time zone 'UTC',source_type='manual',import_id=null where mosque_id=m and date=d;
 if (select source_type from prayer_times where mosque_id=m and date=d)<>'manual' then raise exception 'Manual override no longer works'; end if;
 if (select count(*) from prayer_schedule_import_rows where import_id=imp and published_row is not null)<>1 then raise exception 'Rollback snapshot is missing'; end if;
 raise notice 'PASS: scans do not publish, canonical timetable/reminder integration, assignment preservation, manual overrides, audit snapshots, rota/reminder/live/timezone/UTC-date protection';
end $$;
set role anon;
select date,fajr_adhan_time from public.prayer_times order by date;
reset role;
