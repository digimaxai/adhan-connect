-- Owner-only discovery queue. Public data changes happen only through atomic approval.
alter table public.mosques
  add column if not exists website text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists management_info text,
  add column if not exists services_info text;
grant select (website, contact_phone, contact_email, management_info, services_info) on public.mosques to authenticated, anon;

create table public.mosque_assistant_jobs (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  website_hint text,
  status text not null default 'queued' check (status in ('queued','running','review','failed','published','rejected','cancelled')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  extraction jsonb,
  sources jsonb not null default '[]',
  profile_snapshot jsonb not null,
  prayer_snapshot jsonb not null,
  approved_review jsonb,
  import_id uuid references public.prayer_schedule_imports(id),
  reviewed_by uuid references public.users(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index mosque_assistant_one_open_job on public.mosque_assistant_jobs(mosque_id)
  where status in ('queued','running','review');
create index mosque_assistant_queue on public.mosque_assistant_jobs(status,created_at);
alter table public.mosque_assistant_jobs enable row level security;
revoke all on public.mosque_assistant_jobs from anon, authenticated;
grant all on public.mosque_assistant_jobs to service_role;

create table public.mosque_assistant_workers (
  id text primary key,
  last_seen_at timestamptz not null default now()
);
alter table public.mosque_assistant_workers enable row level security;
revoke all on public.mosque_assistant_workers from anon, authenticated;
grant all on public.mosque_assistant_workers to service_role;

create function public.mosque_assistant_profile_snapshot(p_mosque uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(key,value),'{}') from public.mosques m,
  lateral jsonb_each(to_jsonb(m)) where m.id=p_mosque and key = any(array['website','address_line1','address_line2','city','postcode','country','contact_phone','contact_email','management_info','services_info','time_zone']);
$$;

create function public.enqueue_mosque_assistant(p_actor uuid, p_month text, p_ids uuid[] default null, p_website text default null)
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
  on conflict (mosque_id) where status in ('queued','running','review') do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.claim_mosque_assistant() returns setof public.mosque_assistant_jobs
language plpgsql security definer set search_path = public as $$
begin
  update public.mosque_assistant_jobs set status='failed',error='Worker lease expired after three attempts.',updated_at=now()
    where status='running' and lease_until<now() and attempts>=3;
  return query with candidate as (
    select id from public.mosque_assistant_jobs where status='queued' or (status='running' and lease_until<now() and attempts<3)
    order by created_at for update skip locked limit 1
  ) update public.mosque_assistant_jobs j set status='running',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',updated_at=now(),error=null
    from candidate c where j.id=c.id returning j.*;
end $$;

create function public.publish_mosque_assistant(p_actor uuid,p_job uuid,p_review jsonb,p_rows jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare j public.mosque_assistant_jobs; r jsonb; old_row jsonb; new_row jsonb;
  field text; imp uuid; row_date date; old_profile jsonb; n integer; local_time timestamp; instant timestamptz; old_instant timestamptz; slot text; time_column text;
begin
  if not exists(select 1 from public.users where id=p_actor and role='main_admin') then raise exception 'Owner access required'; end if;
  select * into j from public.mosque_assistant_jobs where id=p_job for update;
  if not found then raise exception 'Scan not found'; end if;
  if j.status='published' then return j.import_id; end if;
  if j.status<>'review' then raise exception 'Scan is not ready for review'; end if;
  if coalesce((p_review->>'websiteConfirmed')::boolean,false) is not true then raise exception 'Confirm the mosque website first'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>31 then raise exception 'Invalid daily rows'; end if;
  -- Use the same per-mosque serialization as live start/end. A busy mosque
  -- makes approval fail immediately rather than holding up its broadcast.
  perform 1 from public.mosques where id=j.mosque_id for update nowait;
  if jsonb_array_length(p_rows)>0 then
    if (select time_zone from public.mosques where id=j.mosque_id) is distinct from p_review->>'timeZone' then
      raise exception 'Timetable timezone differs from the mosque configuration. Review its timezone in the existing mosque workspace and rescan.';
    end if;
    if exists(select 1 from public.streams where mosque_id=j.mosque_id and is_live)
       or exists(select 1 from public.adhans where mosque_id=j.mosque_id and status::text='live') then
      raise exception 'A live broadcast is active for this mosque. Publish the timetable after it ends.';
    end if;
    -- Rota timestamps can override canonical times in duty screens/reminders.
    -- Freeze writes only during the short approval transaction; never wait on
    -- an assignment edit and never change an assignee or an override here.
    lock table public.staff_rota in share mode nowait;
  end if;
  old_profile := public.mosque_assistant_profile_snapshot(j.mosque_id);
  if old_profile is distinct from j.profile_snapshot then raise exception 'Mosque details changed since this scan. Reject and scan again.'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    row_date := (r->>'date')::date;
    if to_char(row_date,'YYYY-MM')<>j.month then raise exception 'Date is outside the scan month'; end if;
    select to_jsonb(pt) into old_row from public.prayer_times pt where mosque_id=j.mosque_id and date=row_date;
    if old_row is distinct from j.prayer_snapshot->(row_date::text) then raise exception 'Prayer times changed since this scan. Reject and scan again.'; end if;
    foreach field in array array['fajr','dhuhr','asr','maghrib','isha'] loop
      if coalesce(r->>field,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid beginning time'; end if;
      if coalesce(r->>(field||'_iqama'),'')<>'' and r->>(field||'_iqama') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid iqama time'; end if;
    end loop;
  end loop;
  -- Reject nonexistent or repeated local clock times at a DST transition.
  for r in select value from jsonb_array_elements(p_rows) loop
    foreach field in array array['fajr','fajr_iqama','dhuhr','dhuhr_iqama','asr','asr_iqama','maghrib','maghrib_iqama','isha','isha_iqama'] loop
      if nullif(r->>field,'') is not null then
        local_time := (r->>'date')::date + (r->>field)::time;
        instant := local_time at time zone (p_review->>'timeZone');
        slot := replace(field,'_iqama','');
        time_column := slot || case when field like '%_iqama' then '_iqama_time' else '_adhan_time' end;
        old_instant := (j.prayer_snapshot->(r->>'date')->>time_column)::timestamptz;
        if field not like '%_iqama' and (instant at time zone 'UTC')::date <> (r->>'date')::date then
          raise exception 'This timetable crosses the UTC date used by the existing broadcast and rota paths. Resolve it in the existing timetable workspace before using assistant publication.';
        end if;
        if instant is distinct from old_instant then
          if exists(select 1 from public.staff_rota sr
            where sr.mosque_id=j.mosque_id and coalesce(sr.date,sr.duty_date)=(r->>'date')::date
              and lower(coalesce(nullif(nullif(trim(sr.prayer_name::text),''),'unspecified'),sr.prayer::text))=slot
              and case when field like '%_iqama' then sr.iqama_time else sr.adhan_time end is not null
              and case when field like '%_iqama' then sr.iqama_time else sr.adhan_time end is distinct from instant
          ) then raise exception 'Timetable conflicts with an existing rota time on % (%). Reconcile it in the existing timetable/rota workspace before publishing.', r->>'date',field; end if;
          if field not like '%_iqama' then
            if instant between now()-interval '20 minutes' and now()+interval '62 minutes'
               or old_instant between now()-interval '20 minutes' and now()+interval '62 minutes' then
              raise exception 'A changed prayer is within the reminder/broadcast window. Publish that date later or use the existing timetable workspace.';
            end if;
            if exists(select 1 from public.notification_events ne where ne.mosque_id=j.mosque_id
              and ne.prayer=slot and ne.kind in ('listener_upcoming','muezzin_duty')
              and nullif(ne.data->>'scheduledAt','') is not null
              and ((ne.data->>'scheduledAt')::timestamptz at time zone (p_review->>'timeZone'))::date=(r->>'date')::date
            ) then raise exception 'Reminders already exist for this changed prayer date. Reconcile them through the existing scheduling workflow before publishing.'; end if;
          end if;
        end if;
        if instant at time zone (p_review->>'timeZone') <> local_time
          or (instant + interval '1 hour') at time zone (p_review->>'timeZone') = local_time
          or (instant - interval '1 hour') at time zone (p_review->>'timeZone') = local_time
          or (instant + interval '30 minutes') at time zone (p_review->>'timeZone') = local_time
          or (instant - interval '30 minutes') at time zone (p_review->>'timeZone') = local_time
        then raise exception 'Timetable contains an ambiguous or nonexistent local time at a clock change. Resolve this date manually.'; end if;
      end if;
    end loop;
  end loop;
  n := jsonb_array_length(p_rows);
  if n>0 then
    if not exists(select 1 from pg_timezone_names where name=p_review->>'timeZone') then raise exception 'Invalid timezone'; end if;
    if (select count(distinct value->>'date') from jsonb_array_elements(p_rows))<>n then raise exception 'Duplicate dates'; end if;
    insert into public.prayer_schedule_imports(mosque_id,source_type,source_label,import_mode,status,coverage_start_date,coverage_end_date,
      total_rows,valid_rows,initiated_by,metadata,published_at)
    select j.mosque_id,'api',p_review->'table'->>'source_url','explicit_iqama','published',min((value->>'date')::date),max((value->>'date')::date),
      n,n,p_actor,jsonb_build_object('assistant_job_id',j.id,'time_zone',p_review->>'timeZone','review',p_review),now() from jsonb_array_elements(p_rows)
    returning id into imp;
    for r in select value from jsonb_array_elements(p_rows) loop
      row_date := (r->>'date')::date;
      select to_jsonb(pt) into old_row from public.prayer_times pt where mosque_id=j.mosque_id and date=row_date;
      insert into public.prayer_times(mosque_id,date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time,source_type,generated_method,overrides_exist,import_id,created_by,updated_by)
      values(j.mosque_id,row_date,case when nullif(r->>'fajr','') is null then null else ((r->>'date')::date + (r->>'fajr')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'fajr_iqama','') is null then null else ((r->>'date')::date + (r->>'fajr_iqama')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'dhuhr','') is null then null else ((r->>'date')::date + (r->>'dhuhr')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'dhuhr_iqama','') is null then null else ((r->>'date')::date + (r->>'dhuhr_iqama')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'asr','') is null then null else ((r->>'date')::date + (r->>'asr')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'asr_iqama','') is null then null else ((r->>'date')::date + (r->>'asr_iqama')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'maghrib','') is null then null else ((r->>'date')::date + (r->>'maghrib')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'maghrib_iqama','') is null then null else ((r->>'date')::date + (r->>'maghrib_iqama')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'isha','') is null then null else ((r->>'date')::date + (r->>'isha')::time) at time zone (p_review->>'timeZone') end,case when nullif(r->>'isha_iqama','') is null then null else ((r->>'date')::date + (r->>'isha_iqama')::time) at time zone (p_review->>'timeZone') end,'upload','mosque_website',true,imp,p_actor,p_actor)
      on conflict(mosque_id,date) do update set fajr_adhan_time=excluded.fajr_adhan_time,fajr_iqama_time=coalesce(excluded.fajr_iqama_time,prayer_times.fajr_iqama_time),dhuhr_adhan_time=excluded.dhuhr_adhan_time,dhuhr_iqama_time=coalesce(excluded.dhuhr_iqama_time,prayer_times.dhuhr_iqama_time),asr_adhan_time=excluded.asr_adhan_time,asr_iqama_time=coalesce(excluded.asr_iqama_time,prayer_times.asr_iqama_time),maghrib_adhan_time=excluded.maghrib_adhan_time,maghrib_iqama_time=coalesce(excluded.maghrib_iqama_time,prayer_times.maghrib_iqama_time),isha_adhan_time=excluded.isha_adhan_time,isha_iqama_time=coalesce(excluded.isha_iqama_time,prayer_times.isha_iqama_time),source_type='upload',generated_method='mosque_website',overrides_exist=true,import_id=imp,updated_by=p_actor,updated_at=now()
      where to_jsonb(prayer_times) is not distinct from j.prayer_snapshot->(row_date::text)
      returning to_jsonb(prayer_times) into new_row;
      if not found then raise exception 'Prayer times changed since this scan. Reject and scan again.'; end if;
      insert into public.prayer_schedule_import_rows(import_id,mosque_id,date,action,previous_row,published_row)
        values(imp,j.mosque_id,row_date,case when old_row is null then 'insert' else 'update' end,old_row,new_row);
    end loop;
    -- Publishing never alters the mosque timezone, calculation method or source.
  end if;
  for field in select jsonb_object_keys(p_review->'profile') loop
    if not field=any(array['website','address_line1','address_line2','city','postcode','country','contact_phone','contact_email','management_info','services_info']) then raise exception 'Unsupported profile field'; end if;
    if length(p_review->'profile'->field->>'value')>5000 or coalesce(p_review->'profile'->field->>'source_url','') !~ '^https://' then raise exception 'Invalid profile value or source'; end if;
    execute format('update public.mosques set %I=$1,updated_at=now() where id=$2',field)
      using p_review->'profile'->field->>'value',j.mosque_id;
  end loop;
  update public.mosque_assistant_jobs set status='published',approved_review=p_review,reviewed_by=p_actor,import_id=imp,updated_at=now() where id=j.id;
  return imp;
end $$;

revoke all on function public.mosque_assistant_profile_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.enqueue_mosque_assistant(uuid,text,uuid[],text) from public,anon,authenticated;
revoke all on function public.claim_mosque_assistant() from public,anon,authenticated;
revoke all on function public.publish_mosque_assistant(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.mosque_assistant_profile_snapshot(uuid) to service_role;
grant execute on function public.enqueue_mosque_assistant(uuid,text,uuid[],text) to service_role;
grant execute on function public.claim_mosque_assistant() to service_role;
grant execute on function public.publish_mosque_assistant(uuid,uuid,jsonb,jsonb) to service_role;
