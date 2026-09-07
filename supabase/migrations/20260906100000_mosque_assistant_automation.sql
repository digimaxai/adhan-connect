-- Continuous discovery is on by default once a configured worker is running.
alter table public.mosque_assistant_jobs
  add column origin text not null default 'manual' check(origin in ('manual','automatic')),
  add column prepared_review jsonb,
  add column conversion jsonb;
drop index public.mosque_assistant_one_open_job;
create unique index mosque_assistant_one_open_job on public.mosque_assistant_jobs(mosque_id,month)
  where status in ('queued','running','review');
create table public.mosque_assistant_automation (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_queued integer not null default 0,
  last_error text
);
insert into public.mosque_assistant_automation(singleton) values(true);
alter table public.mosque_assistant_automation enable row level security;
revoke all on public.mosque_assistant_automation from anon,authenticated;
grant all on public.mosque_assistant_automation to service_role;
create or replace function public.enqueue_mosque_assistant(p_actor uuid, p_month text, p_ids uuid[] default null, p_website text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists(select 1 from public.users where id=p_actor and role='main_admin') then raise exception 'Owner access required'; end if;
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
  if p_website is not null and (coalesce(cardinality(p_ids),0)<>1 or p_website !~ '^https://') then raise exception 'A website override requires exactly one mosque and HTTPS'; end if;
  insert into public.mosque_assistant_jobs(mosque_id,requested_by,month,website_hint,profile_snapshot,prayer_snapshot)
  select m.id,p_actor,p_month,coalesce(p_website,m.website), public.mosque_assistant_profile_snapshot(m.id),
    coalesce((select jsonb_object_agg(pt.date::text,to_jsonb(pt)) from public.prayer_times pt
      where pt.mosque_id=m.id and pt.date >= (p_month||'-01')::date and pt.date < ((p_month||'-01')::date + interval '1 month')),'{}')
  from public.mosques m where p_ids is null or m.id=any(p_ids)
  on conflict (mosque_id,month) where status in ('queued','running','review') do nothing;
  get diagnostics n = row_count;
  return n;
end $$;


create function public.schedule_mosque_assistant(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public as $$
declare owner_id uuid; candidate record; queued integer:=0; added integer; config public.mosque_assistant_automation;
begin
  if not pg_try_advisory_xact_lock(615091700) then return jsonb_build_object('queued',0); end if;
  select * into config from public.mosque_assistant_automation where singleton for update;
  if not config.enabled or config.last_checked_at > p_now - interval '5 minutes' then return jsonb_build_object('queued',0); end if;
  select id into owner_id from public.users where role='main_admin' order by id limit 1;
  if owner_id is null then
    update public.mosque_assistant_automation set last_checked_at=p_now,last_error='No main admin account exists.',last_queued=0 where singleton;
    return jsonb_build_object('queued',0,'error','No main admin account exists.');
  end if;
  -- New mosques are due immediately. Current and upcoming months are independent,
  -- so an older review cannot block discovery of a new timetable.
  for candidate in
    with months as (
      select to_char(p_now at time zone 'UTC','YYYY-MM') as month
      union all
      select to_char((p_now at time zone 'UTC') + interval '1 month','YYYY-MM')
      where extract(day from p_now at time zone 'UTC')>=20
    )
    select m.id,months.month from public.mosques m cross join months
    left join lateral (
      select status,updated_at from public.mosque_assistant_jobs j
      where j.mosque_id=m.id and j.month=months.month order by created_at desc,id desc limit 1
    ) latest on true
    where not exists(select 1 from public.mosque_assistant_jobs j where j.mosque_id=m.id and j.month=months.month and j.status in ('queued','running','review'))
      and (latest.status is null or latest.updated_at <= p_now - case when latest.status='failed' then interval '1 day' else interval '7 days' end)
    order by latest.updated_at nulls first,months.month,m.id limit 100
  loop
    added:=public.enqueue_mosque_assistant(owner_id,candidate.month,array[candidate.id]);
    if added>0 then
      update public.mosque_assistant_jobs set origin='automatic'
        where mosque_id=candidate.id and month=candidate.month and status='queued';
      queued:=queued+added;
    end if;
  end loop;
  update public.mosque_assistant_automation set last_checked_at=p_now,last_queued=queued,last_error=null where singleton;
  return jsonb_build_object('queued',queued);
end $$;
revoke all on function public.schedule_mosque_assistant(timestamptz) from public,anon,authenticated;
grant execute on function public.schedule_mosque_assistant(timestamptz) to service_role;
