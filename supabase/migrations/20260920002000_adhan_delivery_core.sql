-- Durable decision core only. No cron, listener policies, activation API or live
-- trigger is installed here. Service-only functions are exercised locally until
-- activation, publisher verification and listener integration are complete.
begin;

create table public.adhan_delivery_occurrences (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  local_date date not null,
  prayer text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha')),
  time_zone text not null,
  mode text not null check (mode in ('recorded_only','live_with_fallback')),
  settings_revision bigint not null check (settings_revision > 0),
  plan_revision bigint not null default 1 check (plan_revision > 0),
  scheduled_at timestamptz not null,
  recording_due_at timestamptz not null,
  recording_id uuid not null references public.adhan_audio_assets(id),
  recording_path text not null,
  duration_sec integer not null check (duration_sec between 1 and 600),
  state text not null default 'planned' check (state in ('planned','live_selected','recording_selected','expired','cancelled')),
  confirmed_stream_id uuid,
  live_confirmed_at timestamptz,
  started_at timestamptz,
  ends_at timestamptz,
  reason text,
  updated_at timestamptz not null default now(),
  unique (mosque_id, local_date, prayer),
  check (recording_due_at = scheduled_at + case when mode='live_with_fallback' then interval '10 seconds' else interval '0 seconds' end),
  check ((live_confirmed_at is null) = (confirmed_stream_id is null)),
  check (state <> 'recording_selected' or (started_at is not null and ends_at = started_at + duration_sec * interval '1 second')),
  check (state <> 'live_selected' or (confirmed_stream_id is not null and started_at is not null))
);
create index on public.adhan_delivery_occurrences (recording_due_at) where state = 'planned';
alter table public.adhan_delivery_occurrences enable row level security;
revoke all on public.adhan_delivery_occurrences from public, anon, authenticated, service_role;
grant select on public.adhan_delivery_occurrences to service_role;
-- Supabase default privileges may grant service_role table writes at creation.
-- All mutations for this feature should go through its checked RPCs.
revoke all on public.adhan_audio_assets, public.mosque_adhan_audio_settings, public.adhan_audio_audit from service_role;
grant select on public.adhan_audio_assets, public.mosque_adhan_audio_settings, public.adhan_audio_audit to service_role;

create function public.plan_adhan_delivery_v1(
  p_mosque uuid, p_date date, p_prayer text, p_scheduled_at timestamptz,
  p_mode text, p_settings_revision bigint, p_recording uuid, p_expected_plan_revision bigint
) returns public.adhan_delivery_occurrences language plpgsql security definer set search_path = '' as $$
declare
  v_asset public.adhan_audio_assets;
  v_occurrence public.adhan_delivery_occurrences;
  v_zone text;
  v_status text;
  v_not_offered text[];
  v_now timestamptz;
begin
  if p_expected_plan_revision is null or p_expected_plan_revision < 0 then
    raise exception 'Expected plan revision is required' using errcode = '22023';
  end if;
  -- Same lock as upload/archive/draft mutations; assets cannot be archived while
  -- being snapshotted into a pending occurrence. No lock is held across network I/O.
  perform pg_advisory_xact_lock(923202601::bigint);
  select time_zone, status::text, prayers_not_offered into v_zone, v_status, v_not_offered
    from public.mosques where id = p_mosque;
  if not found or v_status <> 'active' then raise exception 'Mosque must be active' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_zone) then
    raise exception 'Invalid mosque timezone' using errcode = '22023';
  end if;
  if p_prayer = any(coalesce(v_not_offered, array[]::text[])) then
    raise exception 'Prayer is not offered by this mosque' using errcode = '22023';
  end if;
  if p_scheduled_at is null or (p_scheduled_at at time zone v_zone)::date <> p_date then
    raise exception 'Scheduled instant must match the mosque local date' using errcode = '22023';
  end if;
  select * into v_asset from public.adhan_audio_assets
    where id = p_recording and state = 'ready' and rights_confirmed and (mosque_id = p_mosque or mosque_id is null);
  if not found then raise exception 'Choose a verified mosque or catalogue recording' using errcode = '22023'; end if;

  select * into v_occurrence from public.adhan_delivery_occurrences
    where mosque_id = p_mosque and local_date = p_date and prayer = p_prayer for update;
  v_now := clock_timestamp();
  if found then
    -- A changed timetable can never create a second adhan under a new timestamp.
    -- Once its original prayer time arrives, the occurrence snapshot is frozen.
    if v_occurrence.state <> 'planned' or v_occurrence.live_confirmed_at is not null or
       v_now >= v_occurrence.scheduled_at or p_settings_revision < v_occurrence.settings_revision then return v_occurrence; end if;
    if v_occurrence.scheduled_at = p_scheduled_at and v_occurrence.mode = p_mode and
       v_occurrence.recording_id = p_recording and v_occurrence.settings_revision = p_settings_revision and
       v_occurrence.time_zone = v_zone then return v_occurrence; end if;
    if v_occurrence.plan_revision <> p_expected_plan_revision then return v_occurrence; end if;
    if p_scheduled_at <= v_now then
      update public.adhan_delivery_occurrences set state='cancelled', reason='Timetable moved this prayer into the past',
        plan_revision=plan_revision+1, updated_at=v_now where id=v_occurrence.id returning * into v_occurrence;
    else
      update public.adhan_delivery_occurrences set scheduled_at=p_scheduled_at, mode=p_mode, time_zone=v_zone,
        recording_due_at=p_scheduled_at + case when p_mode='live_with_fallback' then interval '10 seconds' else interval '0 seconds' end,
        recording_id=p_recording, recording_path=v_asset.storage_path, duration_sec=v_asset.duration_sec,
        settings_revision=p_settings_revision, plan_revision=plan_revision+1,
        confirmed_stream_id=null, live_confirmed_at=null, updated_at=v_now
        where id=v_occurrence.id returning * into v_occurrence;
    end if;
    return v_occurrence;
  end if;
  if p_expected_plan_revision <> 0 then raise exception 'Plan changed; reload it first' using errcode = '40001'; end if;
  -- Old jobs may be retried; store an expired tombstone rather than replay later.
  insert into public.adhan_delivery_occurrences
    (mosque_id,local_date,prayer,time_zone,mode,settings_revision,scheduled_at,recording_due_at,
     recording_id,recording_path,duration_sec,state,reason)
  values (p_mosque,p_date,p_prayer,v_zone,p_mode,p_settings_revision,p_scheduled_at,
    p_scheduled_at + case when p_mode='live_with_fallback' then interval '10 seconds' else interval '0 seconds' end,
    p_recording,v_asset.storage_path,v_asset.duration_sec,
    case when v_now >= p_scheduled_at + case when p_mode='live_with_fallback' then interval '40 seconds' else interval '30 seconds' end
      then 'expired' else 'planned' end,
    case when v_now >= p_scheduled_at + case when p_mode='live_with_fallback' then interval '40 seconds' else interval '30 seconds' end
      then 'Automatic start window expired before planning' else null end)
  returning * into v_occurrence;
  return v_occurrence;
end;
$$;

-- Caller must verify actual publisher/track presence through the provider first.
-- The browser/app cannot invoke this RPC or supply a readiness timestamp. Merely
-- changing streams.is_live never creates confirmed delivery evidence.
create function public.confirm_adhan_delivery_live_v1(p_occurrence uuid, p_stream uuid, p_plan_revision bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.adhan_delivery_occurrences; v_now timestamptz;
begin
  if p_plan_revision is null or p_plan_revision < 1 then return false; end if;
  select * into v_row from public.adhan_delivery_occurrences where id=p_occurrence for update;
  v_now := clock_timestamp();
  if found and v_row.state='live_selected' and v_row.confirmed_stream_id=p_stream and
     v_row.plan_revision=p_plan_revision then return true; end if;
  if not found or v_row.state <> 'planned' or v_row.mode <> 'live_with_fallback' or
     v_row.plan_revision <> p_plan_revision or v_now < v_row.scheduled_at - interval '3 minutes' or
     v_now >= v_row.recording_due_at then return false; end if;
  if not exists (select 1 from public.streams s where s.id=p_stream and s.mosque_id=v_row.mosque_id
    and lower(s.current_prayer)=v_row.prayer and s.is_live and
    s.started_at >= v_row.scheduled_at - interval '3 minutes' and s.started_at <= v_now) then return false; end if;
  update public.adhan_delivery_occurrences set confirmed_stream_id=coalesce(confirmed_stream_id,p_stream),
    live_confirmed_at=coalesce(live_confirmed_at,v_now), state='live_selected',
    started_at=coalesce(live_confirmed_at,v_now), reason='Publisher readiness confirmed before fallback deadline',
    updated_at=v_now where id=p_occurrence;
  return true;
end;
$$;

create function public.claim_adhan_delivery_v1(p_occurrence uuid, p_plan_revision bigint)
returns public.adhan_delivery_occurrences language plpgsql security definer set search_path = '' as $$
declare v_row public.adhan_delivery_occurrences; v_now timestamptz;
begin
  if p_plan_revision is null or p_plan_revision < 1 then
    raise exception 'Expected plan revision is required' using errcode = '22023';
  end if;
  select * into v_row from public.adhan_delivery_occurrences where id=p_occurrence for update;
  if not found then raise exception 'Occurrence not found' using errcode = 'P0002'; end if;
  v_now := clock_timestamp();
  if v_row.state <> 'planned' or v_row.plan_revision <> p_plan_revision then return v_row; end if;
  if not exists (select 1 from public.mosques m where m.id=v_row.mosque_id and m.status::text='active'
    and m.time_zone=v_row.time_zone and not v_row.prayer=any(coalesce(m.prayers_not_offered,array[]::text[]))) then
    update public.adhan_delivery_occurrences set state='cancelled',reason='Mosque availability or timezone changed',updated_at=v_now
      where id=p_occurrence returning * into v_row;
    return v_row;
  end if;
  if v_row.mode='live_with_fallback' and v_row.live_confirmed_at is not null then
    update public.adhan_delivery_occurrences set state='live_selected',started_at=live_confirmed_at,
      reason='Publisher readiness confirmed before fallback deadline',updated_at=v_now where id=p_occurrence returning * into v_row;
  elsif v_now < v_row.recording_due_at then return v_row;
  elsif v_now >= v_row.recording_due_at + interval '30 seconds' then
    update public.adhan_delivery_occurrences set state='expired',reason='Automatic start window expired',updated_at=v_now
      where id=p_occurrence returning * into v_row;
  else
    update public.adhan_delivery_occurrences set state='recording_selected',started_at=v_now,
      ends_at=v_now + duration_sec * interval '1 second',
      reason=case when mode='recorded_only' then 'Scheduled recording' else 'Live audio not confirmed before fallback deadline' end,
      updated_at=v_now where id=p_occurrence returning * into v_row;
  end if;
  return v_row;
end;
$$;

create function public.cancel_adhan_delivery_v1(p_actor uuid, p_occurrence uuid)
returns public.adhan_delivery_occurrences language plpgsql security definer set search_path = '' as $$
declare v_row public.adhan_delivery_occurrences;
begin
  select * into v_row from public.adhan_delivery_occurrences where id=p_occurrence for update;
  if not found then raise exception 'Occurrence not found' using errcode = 'P0002'; end if;
  perform public.assert_adhan_audio_admin(p_actor,v_row.mosque_id);
  if v_row.state in ('planned','recording_selected') then
    update public.adhan_delivery_occurrences set state='cancelled',reason='Cancelled by mosque admin',updated_at=clock_timestamp()
      where id=p_occurrence returning * into v_row;
    insert into public.adhan_audio_audit(actor_id,mosque_id,action,details)
      values(p_actor,v_row.mosque_id,'delivery_cancelled',jsonb_build_object('occurrence_id',p_occurrence));
  end if;
  return v_row;
end;
$$;

-- Extend only this feature's new archive RPC. Active occurrence snapshots retain
-- their object, even if an admin selects a different recording for future prayers.
create or replace function public.archive_adhan_audio_asset(p_actor uuid,p_asset uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_asset public.adhan_audio_assets;
begin
  perform pg_advisory_xact_lock(923202601::bigint);
  select * into v_asset from public.adhan_audio_assets where id=p_asset;
  if not found then raise exception 'Recording not found' using errcode = 'P0002'; end if;
  perform public.assert_adhan_audio_admin(p_actor,v_asset.mosque_id);
  if exists (select 1 from public.mosque_adhan_audio_settings where default_asset_id=p_asset or fajr_asset_id=p_asset) then
    raise exception 'Recording is selected in saved settings; replace it before archiving' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.adhan_delivery_occurrences where recording_id=p_asset and
    (state='planned' or (state='recording_selected' and ends_at > clock_timestamp()))) then
    raise exception 'Recording is reserved for a pending or active adhan' using errcode = 'P0001';
  end if;
  update public.adhan_audio_assets set state='archived' where id=p_asset;
  insert into public.adhan_audio_audit(actor_id,mosque_id,action,details)
    values(p_actor,v_asset.mosque_id,'archived',jsonb_build_object('asset_id',p_asset));
end;
$$;

revoke all on function public.plan_adhan_delivery_v1(uuid,date,text,timestamptz,text,bigint,uuid,bigint) from public,anon,authenticated;
revoke all on function public.confirm_adhan_delivery_live_v1(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.claim_adhan_delivery_v1(uuid,bigint) from public,anon,authenticated;
revoke all on function public.cancel_adhan_delivery_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.plan_adhan_delivery_v1(uuid,date,text,timestamptz,text,bigint,uuid,bigint) to service_role;
grant execute on function public.confirm_adhan_delivery_live_v1(uuid,uuid,bigint) to service_role;
grant execute on function public.claim_adhan_delivery_v1(uuid,bigint) to service_role;
grant execute on function public.cancel_adhan_delivery_v1(uuid,uuid) to service_role;
commit;
