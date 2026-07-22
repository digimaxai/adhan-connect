-- Main-admin live-broadcast readiness, audit, and safe stream provisioning.
--
-- This migration is additive. It does not enable a mosque, start a broadcast,
-- create a LiveKit room, or change the hosted START/END rollout allowlists.

-- Production inherited an older staff_rota table. CREATE TABLE IF NOT EXISTS
-- in the canonical migration therefore did not add these later columns, even
-- though current rota writers and start_live_broadcast_v1 use them.
alter table public.staff_rota
  add column if not exists adhan_time timestamptz,
  add column if not exists iqama_time timestamptz,
  add column if not exists assigned_by uuid
    references public.profiles(id) on delete set null;

comment on column public.staff_rota.adhan_time is
  'Canonical scheduled adhan timestamp for this rota assignment.';
comment on column public.staff_rota.iqama_time is
  'Canonical scheduled iqama timestamp for this rota assignment.';
comment on column public.staff_rota.assigned_by is
  'Admin profile that last assigned this rota row.';

-- The live architecture has one mutable stream state row per mosque. Enforce
-- that invariant so legacy start and admin provisioning cannot race into a
-- duplicate. If unexpected legacy duplicates exist, migration stops for
-- explicit review instead of deleting or merging them automatically.
create unique index if not exists idx_streams_one_row_per_mosque
  on public.streams(mosque_id);

create table if not exists public.mosque_broadcast_onboarding (
  mosque_id uuid primary key references public.mosques(id) on delete cascade,
  stage text not null default 'setup_pending'
    check (stage in ('setup_pending', 'ready_for_test', 'test_passed', 'live')),
  ready_for_test_at timestamptz,
  test_passed_at timestamptz,
  launched_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mosque_broadcast_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_stage text
    check (from_stage is null or from_stage in ('setup_pending', 'ready_for_test', 'test_passed', 'live')),
  to_stage text
    check (to_stage is null or to_stage in ('setup_pending', 'ready_for_test', 'test_passed', 'live')),
  notes text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mosque_broadcast_onboarding_events_mosque_created
  on public.mosque_broadcast_onboarding_events(mosque_id, created_at desc);

alter table public.mosque_broadcast_onboarding enable row level security;
alter table public.mosque_broadcast_onboarding_events enable row level security;

revoke all on table public.mosque_broadcast_onboarding from public, anon, authenticated;
revoke all on table public.mosque_broadcast_onboarding_events from public, anon, authenticated;
grant select, insert, update on table public.mosque_broadcast_onboarding to service_role;
grant select, insert on table public.mosque_broadcast_onboarding_events to service_role;

create or replace function public.provision_mosque_live_stream_v1(
  p_actor_user_id uuid,
  p_mosque_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_mosque public.mosques%rowtype;
  v_stream public.streams%rowtype;
  v_provider text;
  v_url text;
  v_stream_type public.stream_type;
  v_stream_count integer := 0;
  v_has_active_stream boolean := false;
  v_has_live_adhan boolean := false;
  v_has_local_admin boolean := false;
  v_has_active_muezzin boolean := false;
  v_has_staff_coverage boolean := false;
  v_has_schedule_source boolean := false;
  v_idempotent boolean := false;
begin
  if p_actor_user_id is null or p_mosque_id is null then
    raise exception 'Missing required broadcast provisioning arguments.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users as u
    where u.id = p_actor_user_id
      and u.role::text = 'main_admin'
  ) then
    raise exception 'Only a main admin can provision live broadcasting.'
      using errcode = '42501';
  end if;

  -- The same mosque lock is used by transactional start and end. It prevents
  -- two concurrent provisioning requests from creating duplicate stream rows.
  select m.*
  into v_mosque
  from public.mosques as m
  where m.id = p_mosque_id
  for update;

  if not found then
    raise exception 'The selected mosque could not be found.'
      using errcode = '22023';
  end if;

  v_provider := case lower(trim(coalesce(v_mosque.live_stream_provider, '')))
    when 'livekit' then 'livekit'
    when 'rtmp' then 'rtmp'
    when 'hls' then 'rtmp'
    when 'icecast' then 'icecast'
    when 'test' then 'test'
    else 'external'
  end;

  if not coalesce(v_mosque.live_stream_enabled, false) then
    raise exception 'Live streaming is inactive for this mosque.'
      using errcode = '55000';
  end if;

  if nullif(trim(v_mosque.time_zone), '') is null
     or not exists (
       select 1
       from pg_catalog.pg_timezone_names as tz
       where tz.name = trim(v_mosque.time_zone)
     ) then
    raise exception 'Set the mosque timezone before provisioning live broadcasting.'
      using errcode = '55000';
  end if;

  if v_provider = 'livekit' then
    v_stream_type := 'webrtc'::public.stream_type;
    v_url := 'livekit://mosque/' || p_mosque_id::text;
  else
    v_stream_type := 'hls'::public.stream_type;
    v_url := nullif(trim(v_mosque.live_stream_playback_url), '');
    if v_url is null or v_url !~* '^https?://' then
      raise exception 'A valid HTTP(S) follower playback URL is required before provisioning.'
        using errcode = '55000';
    end if;
  end if;

  select exists (
    select 1 from public.mosque_admins as ma where ma.mosque_id = p_mosque_id
  ) into v_has_local_admin;

  select exists (
    select 1
    from public.muezzins as mz
    where mz.mosque_id = p_mosque_id
      and coalesce(mz.is_active, true)
  ) into v_has_active_muezzin;

  select
    exists (
      select 1
      from public.muezzins as mz
      where mz.mosque_id = p_mosque_id
        and mz.user_id = v_mosque.default_muezzin_user_id
        and coalesce(mz.is_active, true)
    )
    or exists (
      select 1
      from public.staff_rota as sr
      join public.muezzins as mz
        on mz.mosque_id = sr.mosque_id
       and coalesce(mz.is_active, true)
       and (
         mz.user_id = sr.muezzin_user_id
         or mz.user_id = sr.staff_user_id
       )
      where sr.mosque_id = p_mosque_id
        and coalesce(sr.date, sr.duty_date) >= current_date
    )
  into v_has_staff_coverage;

  select
    lower(trim(coalesce(v_mosque.prayer_source, 'aladhan'))) = 'elm'
    or (
      lower(trim(coalesce(v_mosque.prayer_source, 'aladhan'))) = 'aladhan'
      and v_mosque.lat is not null
      and v_mosque.lng is not null
    )
    or exists (
      select 1
      from public.prayer_times as pt
      where pt.mosque_id = p_mosque_id
        and pt.date >= current_date
    )
  into v_has_schedule_source;

  if not v_has_local_admin then
    raise exception 'Assign a local admin before provisioning live broadcasting.'
      using errcode = '55000';
  end if;
  if not v_has_active_muezzin then
    raise exception 'Assign at least one active muezzin before provisioning live broadcasting.'
      using errcode = '55000';
  end if;
  if not v_has_staff_coverage then
    raise exception 'Select an active default muezzin or publish a future rota before provisioning.'
      using errcode = '55000';
  end if;
  if not v_has_schedule_source then
    raise exception 'Configure a prayer-time source or publish future prayer times before provisioning.'
      using errcode = '55000';
  end if;

  select
    count(*)::integer,
    coalesce(bool_or(coalesce(s.is_live, false)), false)
  into v_stream_count, v_has_active_stream
  from public.streams as s
  where s.mosque_id = p_mosque_id;

  select exists (
    select 1
    from public.adhans as a
    where a.mosque_id = p_mosque_id
      and a.status = 'live'
  ) into v_has_live_adhan;

  if v_has_active_stream or v_has_live_adhan then
    raise exception 'Live state exists for this mosque. End and verify it before provisioning.'
      using errcode = '55000';
  end if;

  if v_stream_count > 1 then
    raise exception 'Duplicate stream rows require manual review before provisioning.'
      using errcode = '55000';
  end if;

  if v_stream_count = 1 then
    select s.*
    into v_stream
    from public.streams as s
    where s.mosque_id = p_mosque_id
    order by s.id
    limit 1
    for update;
    if v_stream.status <> 'active'::public.stream_status then
      raise exception 'The existing dormant stream is disabled and requires manual review.'
        using errcode = '55000';
    end if;
    -- Stream provider configuration lives on mosques. Preserve legacy URL,
    -- type, end timestamp, and room metadata here: Harrow's proven LiveKit
    -- path intentionally reuses its older dormant row, and end retries rely on
    -- the preserved metadata. Transactional start updates provider-specific
    -- live fields when the next broadcast begins.
    v_idempotent := true;
  else
    insert into public.streams (
      mosque_id,
      type,
      url,
      stream_url,
      is_live,
      status,
      current_prayer,
      started_at,
      ended_at,
      livekit_room_name
    ) values (
      p_mosque_id,
      v_stream_type,
      v_url,
      case when v_provider = 'livekit' then null else v_url end,
      false,
      'active'::public.stream_status,
      null,
      null,
      null,
      null
    )
    returning * into v_stream;
  end if;

  insert into public.mosque_broadcast_onboarding (
    mosque_id,
    stage,
    updated_by,
    created_at,
    updated_at
  ) values (
    p_mosque_id,
    'setup_pending',
    p_actor_user_id,
    v_now,
    v_now
  )
  on conflict (mosque_id) do update
    set updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  insert into public.mosque_broadcast_onboarding_events (
    mosque_id,
    actor_user_id,
    event_type,
    details,
    created_at
  ) values (
    p_mosque_id,
    p_actor_user_id,
    case when v_idempotent then 'stream_existing_preserved' else 'stream_provisioned' end,
    jsonb_build_object(
      'streamId', v_stream.id,
      'provider', v_provider,
      'idempotent', v_idempotent
    ),
    v_now
  );

  return jsonb_build_object(
    'streamId', v_stream.id,
    'created', not v_idempotent,
    'idempotent', v_idempotent
  );
end;
$function$;

create or replace function public.set_mosque_broadcast_onboarding_stage_v1(
  p_actor_user_id uuid,
  p_mosque_id uuid,
  p_stage text,
  p_notes text default null,
  p_start_transactional boolean default false,
  p_end_transactional boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_target_stage text := lower(trim(coalesce(p_stage, '')));
  v_current_stage text;
  v_event_type text;
  v_mosque public.mosques%rowtype;
  v_provider text;
  v_stream_count integer := 0;
  v_has_active_stream boolean := false;
  v_all_streams_active boolean := false;
  v_has_live_adhan boolean := false;
  v_has_local_admin boolean := false;
  v_has_active_muezzin boolean := false;
  v_has_staff_coverage boolean := false;
  v_has_schedule_source boolean := false;
begin
  if p_actor_user_id is null or p_mosque_id is null then
    raise exception 'Missing required broadcast onboarding arguments.'
      using errcode = '22023';
  end if;

  if v_target_stage not in ('setup_pending', 'ready_for_test', 'test_passed', 'live') then
    raise exception 'The requested broadcast onboarding stage is invalid.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users as u
    where u.id = p_actor_user_id
      and u.role::text = 'main_admin'
  ) then
    raise exception 'Only a main admin can update broadcast onboarding.'
      using errcode = '42501';
  end if;

  select m.*
  into v_mosque
  from public.mosques as m
  where m.id = p_mosque_id
  for update;

  if not found then
    raise exception 'The selected mosque could not be found.'
      using errcode = '22023';
  end if;

  insert into public.mosque_broadcast_onboarding (
    mosque_id,
    stage,
    updated_by,
    created_at,
    updated_at
  ) values (
    p_mosque_id,
    'setup_pending',
    p_actor_user_id,
    v_now,
    v_now
  )
  on conflict (mosque_id) do nothing;

  select mbo.stage
  into v_current_stage
  from public.mosque_broadcast_onboarding as mbo
  where mbo.mosque_id = p_mosque_id
  for update;

  if v_current_stage = v_target_stage then
    raise exception 'Broadcast onboarding is already at the requested stage.'
      using errcode = '55000';
  end if;

  if v_target_stage = 'ready_for_test'
     and v_current_stage <> 'setup_pending' then
    raise exception 'Reset onboarding before moving this mosque back to ready for test.'
      using errcode = '55000';
  end if;

  if v_target_stage = 'test_passed'
     and v_current_stage <> 'ready_for_test' then
    raise exception 'Confirm readiness before recording a successful test.'
      using errcode = '55000';
  end if;

  if v_target_stage = 'live'
     and v_current_stage <> 'test_passed' then
    raise exception 'Record a successful physical test before launching broadcasting.'
      using errcode = '55000';
  end if;

  -- Recheck every database-backed invariant while holding the mosque lock.
  -- The route performs the same checks for useful UI detail; these checks keep
  -- the state transition safe if configuration changes after that read.
  if v_target_stage <> 'setup_pending' then
    v_provider := case lower(trim(coalesce(v_mosque.live_stream_provider, '')))
      when 'livekit' then 'livekit'
      when 'rtmp' then 'rtmp'
      when 'hls' then 'rtmp'
      when 'icecast' then 'icecast'
      when 'test' then 'test'
      else 'external'
    end;

    if not coalesce(v_mosque.live_stream_enabled, false) then
      raise exception 'Live streaming is inactive for this mosque.'
        using errcode = '55000';
    end if;

    if nullif(trim(v_mosque.time_zone), '') is null
       or not exists (
         select 1
         from pg_catalog.pg_timezone_names as tz
         where tz.name = trim(v_mosque.time_zone)
       ) then
      raise exception 'Set a valid mosque timezone before confirming readiness.'
        using errcode = '55000';
    end if;

    if v_provider <> 'livekit'
       and (
         nullif(trim(v_mosque.live_stream_playback_url), '') is null
         or trim(v_mosque.live_stream_playback_url) !~* '^https?://'
       ) then
      raise exception 'A valid HTTP(S) follower playback URL is required before confirming readiness.'
        using errcode = '55000';
    end if;

    select exists (
      select 1 from public.mosque_admins as ma where ma.mosque_id = p_mosque_id
    ) into v_has_local_admin;

    select exists (
      select 1
      from public.muezzins as mz
      where mz.mosque_id = p_mosque_id
        and coalesce(mz.is_active, true)
    ) into v_has_active_muezzin;

    select
      exists (
        select 1
        from public.muezzins as mz
        where mz.mosque_id = p_mosque_id
          and mz.user_id = v_mosque.default_muezzin_user_id
          and coalesce(mz.is_active, true)
      )
      or exists (
        select 1
        from public.staff_rota as sr
        join public.muezzins as mz
          on mz.mosque_id = sr.mosque_id
         and coalesce(mz.is_active, true)
         and (
           mz.user_id = sr.muezzin_user_id
           or mz.user_id = sr.staff_user_id
         )
        where sr.mosque_id = p_mosque_id
          and coalesce(sr.date, sr.duty_date) >= current_date
      )
    into v_has_staff_coverage;

    select
      lower(trim(coalesce(v_mosque.prayer_source, 'aladhan'))) = 'elm'
      or (
        lower(trim(coalesce(v_mosque.prayer_source, 'aladhan'))) = 'aladhan'
        and v_mosque.lat is not null
        and v_mosque.lng is not null
      )
      or exists (
        select 1
        from public.prayer_times as pt
        where pt.mosque_id = p_mosque_id
          and pt.date >= current_date
      )
    into v_has_schedule_source;

    select
      count(*)::integer,
      coalesce(bool_or(coalesce(s.is_live, false)), false),
      coalesce(bool_and(s.status = 'active'), false)
    into v_stream_count, v_has_active_stream, v_all_streams_active
    from public.streams as s
    where s.mosque_id = p_mosque_id;

    select exists (
      select 1
      from public.adhans as a
      where a.mosque_id = p_mosque_id
        and a.status = 'live'
    ) into v_has_live_adhan;

    if not v_has_local_admin then
      raise exception 'Assign a local admin before confirming readiness.' using errcode = '55000';
    end if;
    if not v_has_active_muezzin then
      raise exception 'Assign at least one active muezzin before confirming readiness.' using errcode = '55000';
    end if;
    if not v_has_staff_coverage then
      raise exception 'Select an active default muezzin or publish a future rota before confirming readiness.' using errcode = '55000';
    end if;
    if not v_has_schedule_source then
      raise exception 'Configure a prayer source or publish future prayer times before confirming readiness.' using errcode = '55000';
    end if;
    if v_stream_count <> 1 or not v_all_streams_active then
      raise exception 'Exactly one active, dormant stream record is required before confirming readiness.' using errcode = '55000';
    end if;
    if v_has_active_stream or v_has_live_adhan then
      raise exception 'End and verify all live state before changing the onboarding stage.' using errcode = '55000';
    end if;
  end if;

  if v_target_stage in ('test_passed', 'live')
     and (not coalesce(p_start_transactional, false) or not coalesce(p_end_transactional, false)) then
    raise exception 'Transactional START and END must both be enabled before recording test or launch approval.'
      using errcode = '55000';
  end if;

  if v_target_stage = 'live' and coalesce(v_mosque.status::text, '') <> 'active' then
    raise exception 'Approve the mosque before marking broadcast onboarding live.'
      using errcode = '55000';
  end if;

  v_event_type := case v_target_stage
    when 'setup_pending' then 'onboarding_reset'
    when 'ready_for_test' then 'readiness_confirmed'
    when 'test_passed' then 'physical_test_passed'
    when 'live' then 'broadcasting_launched'
  end;

  update public.mosque_broadcast_onboarding
  set
    stage = v_target_stage,
    ready_for_test_at = case
      when v_target_stage = 'setup_pending' then null
      when v_target_stage = 'ready_for_test' then coalesce(ready_for_test_at, v_now)
      else ready_for_test_at
    end,
    test_passed_at = case
      when v_target_stage in ('setup_pending', 'ready_for_test') then null
      when v_target_stage = 'test_passed' then coalesce(test_passed_at, v_now)
      else test_passed_at
    end,
    launched_at = case
      when v_target_stage <> 'live' then null
      else coalesce(launched_at, v_now)
    end,
    updated_by = p_actor_user_id,
    updated_at = v_now
  where mosque_id = p_mosque_id;

  insert into public.mosque_broadcast_onboarding_events (
    mosque_id,
    actor_user_id,
    event_type,
    from_stage,
    to_stage,
    notes,
    details,
    created_at
  ) values (
    p_mosque_id,
    p_actor_user_id,
    v_event_type,
    v_current_stage,
    v_target_stage,
    nullif(left(trim(coalesce(p_notes, '')), 500), ''),
    jsonb_build_object(
      'startTransactional', coalesce(p_start_transactional, false),
      'endTransactional', coalesce(p_end_transactional, false)
    ),
    v_now
  );

  return jsonb_build_object(
    'mosqueId', p_mosque_id,
    'fromStage', v_current_stage,
    'stage', v_target_stage,
    'updatedAt', v_now
  );
end;
$function$;

revoke all on function public.provision_mosque_live_stream_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.provision_mosque_live_stream_v1(uuid, uuid)
  to service_role;

revoke all on function public.set_mosque_broadcast_onboarding_stage_v1(uuid, uuid, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.set_mosque_broadcast_onboarding_stage_v1(uuid, uuid, text, text, boolean, boolean)
  to service_role;
