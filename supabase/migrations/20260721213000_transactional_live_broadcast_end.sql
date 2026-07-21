-- End a live adhan as one idempotent database transition.
--
-- The Expo API route authenticates the bearer token before calling this
-- service-role-only RPC. Authorization and every stream/adhan write happen in
-- this transaction so followers cannot observe a half-ended broadcast.

create or replace function public.end_live_broadcast_v1(
  p_actor_user_id uuid,
  p_mosque_id uuid,
  p_adhan_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() at time zone 'UTC')::date;

  v_mosque public.mosques%rowtype;
  v_stream public.streams%rowtype;
  v_primary_stream_id uuid;
  v_has_stream boolean := false;
  v_effective_ended_at timestamptz;
  v_has_live_adhan boolean := false;
  v_latest_live_adhan_start timestamptz;

  v_has_admin boolean := false;
  v_active_at_target boolean := false;
  v_any_active_membership boolean := false;
  v_targeted_future_rota boolean := false;
  v_any_future_rota boolean := false;
  v_rota_fallback_access boolean := false;
  v_has_access boolean := false;

  v_ended_stream_count integer := 0;
  v_completed_adhan_count integer := 0;
  v_livekit_room_names jsonb := '[]'::jsonb;
  v_ended_adhan_ids jsonb := '[]'::jsonb;
  v_config jsonb;
  v_upstream_state jsonb;
begin
  if p_actor_user_id is null or p_mosque_id is null then
    raise exception 'Missing required live broadcast arguments.'
      using errcode = '22023';
  end if;

  -- Use the same lock as start_live_broadcast_v1 so starts and ends for a
  -- mosque cannot interleave their database transitions.
  select m.*
  into v_mosque
  from public.mosques as m
  where m.id = p_mosque_id
  for update;

  if not found then
    raise exception 'The selected mosque could not be found.'
      using errcode = '22023';
  end if;

  -- Keep the general mosque-access contract identical to the transactional
  -- start path. End deliberately has no prayer assignment or timing gate.
  select
    exists (
      select 1
      from public.users as u
      where u.id = p_actor_user_id
        and u.role::text = 'main_admin'
    )
    or exists (
      select 1
      from public.mosque_admins as ma
      where ma.user_id = p_actor_user_id
        and ma.mosque_id = p_mosque_id
    )
  into v_has_admin;

  select exists (
    select 1
    from public.muezzins as m
    where m.user_id = p_actor_user_id
      and m.mosque_id = p_mosque_id
      and m.is_active = true
  ) into v_active_at_target;

  select exists (
    select 1
    from public.muezzins as m
    where m.user_id = p_actor_user_id
      and m.is_active = true
  ) into v_any_active_membership;

  select exists (
    select 1
    from public.staff_rota as sr
    where sr.mosque_id = p_mosque_id
      and coalesce(sr.muezzin_user_id, sr.staff_user_id) = p_actor_user_id
      and coalesce(sr.date, sr.duty_date) >= v_today
  ) into v_targeted_future_rota;

  -- Match resolveMuezzinMosquesForUser: active memberships win. Without one,
  -- future rota rows win; past rota rows are the final compatibility fallback.
  if not v_any_active_membership then
    select exists (
      select 1
      from public.staff_rota as sr
      where coalesce(sr.muezzin_user_id, sr.staff_user_id) = p_actor_user_id
        and coalesce(sr.date, sr.duty_date) >= v_today
    ) into v_any_future_rota;

    if v_any_future_rota then
      v_rota_fallback_access := v_targeted_future_rota;
    else
      select exists (
        select 1
        from public.staff_rota as sr
        where sr.mosque_id = p_mosque_id
          and coalesce(sr.muezzin_user_id, sr.staff_user_id) = p_actor_user_id
      ) into v_rota_fallback_access;
    end if;
  end if;

  v_has_access :=
    v_has_admin
    or v_active_at_target
    or coalesce(v_mosque.default_muezzin_user_id = p_actor_user_id, false)
    or v_targeted_future_rota
    or v_rota_fallback_access;

  if not v_has_access then
    raise exception 'You do not have muezzin access to this mosque.'
      using errcode = '42501';
  end if;

  -- Never let a supplied ID from another mosque participate in this end. The
  -- actual update below intentionally targets every live row at this mosque,
  -- not the supplied row, so malformed/test IDs can safely arrive as NULL.
  if p_adhan_id is not null
     and exists (
       select 1
       from public.adhans as a
       where a.id = p_adhan_id
         and a.mosque_id <> p_mosque_id
     ) then
    raise exception 'The selected adhan does not belong to this mosque.'
      using errcode = '42501';
  end if;

  -- Prefer an active row. On an idempotent retry, prefer the most recently
  -- ended row so the original room name and end timestamp remain available.
  select s.*
  into v_stream
  from public.streams as s
  where s.mosque_id = p_mosque_id
  order by
    coalesce(s.is_live, false) desc,
    case when coalesce(s.is_live, false) then s.started_at end desc nulls last,
    s.ended_at desc nulls last,
    s.started_at desc nulls last,
    s.id desc
  limit 1
  for update;

  v_has_stream := found;
  if v_has_stream then
    v_primary_stream_id := v_stream.id;
    v_effective_ended_at := case
      when coalesce(v_stream.is_live, false) then v_now
      else v_stream.ended_at
    end;
  end if;

  select
    exists (
      select 1
      from public.adhans as a
      where a.mosque_id = p_mosque_id
        and a.status = 'live'
    ),
    max(greatest(a.started_at, a.broadcast_started_at))
  into v_has_live_adhan, v_latest_live_adhan_start
  from public.adhans as a
  where a.mosque_id = p_mosque_id
    and a.status = 'live';

  -- An already-inactive stream can be used to repair a stale live adhan only
  -- when its preserved end is not earlier than that adhan's actual start.
  if v_has_live_adhan
     and (
       v_effective_ended_at is null
       or (
         v_latest_live_adhan_start is not null
         and v_effective_ended_at < v_latest_live_adhan_start
       )
     ) then
    v_effective_ended_at := greatest(v_now, v_latest_live_adhan_start);
  end if;

  -- Capture every distinct active room before clearing legacy duplicate live
  -- streams. Normally this array contains exactly one deterministic room.
  select coalesce(jsonb_agg(rooms.room_name order by rooms.room_name), '[]'::jsonb)
  into v_livekit_room_names
  from (
    select distinct nullif(trim(s.livekit_room_name), '') as room_name
    from public.streams as s
    where s.mosque_id = p_mosque_id
      and s.is_live is true
  ) as rooms
  where rooms.room_name is not null;

  -- If this is a retry after the database commit, return every room from the
  -- primary end transition again. Duplicate live rows receive the exact same
  -- ended_at, so a Worker that died before cleanup cannot lose their rooms.
  if jsonb_array_length(v_livekit_room_names) = 0
     and v_has_stream then
    select coalesce(jsonb_agg(rooms.room_name order by rooms.room_name), '[]'::jsonb)
    into v_livekit_room_names
    from (
      select distinct nullif(trim(s.livekit_room_name), '') as room_name
      from public.streams as s
      where s.mosque_id = p_mosque_id
        and (
          s.id = v_primary_stream_id
          or (
            v_stream.ended_at is not null
            and s.ended_at = v_stream.ended_at
          )
        )
    ) as rooms
    where rooms.room_name is not null;
  end if;

  update public.streams
  set
    is_live = false,
    ended_at = v_now,
    status = 'active'
  where mosque_id = p_mosque_id
    and is_live is true;

  get diagnostics v_ended_stream_count = row_count;
  if v_ended_stream_count > 0 then
    v_effective_ended_at := v_now;
  end if;

  -- Followers observe both tables. Complete every same-mosque live adhan in
  -- the same commit, while leaving supplied scheduled/completed rows untouched.
  with completed as (
    update public.adhans
    set
      status = 'completed',
      ended_at = coalesce(v_effective_ended_at, v_now),
      broadcast_ended_at = coalesce(v_effective_ended_at, v_now)
    where mosque_id = p_mosque_id
      and status = 'live'
    returning id
  )
  select
    count(*)::integer,
    coalesce(jsonb_agg(completed.id order by completed.id), '[]'::jsonb)
  into v_completed_adhan_count, v_ended_adhan_ids
  from completed;

  if v_completed_adhan_count > 0 and v_effective_ended_at is null then
    v_effective_ended_at := v_now;
  end if;

  if v_has_stream then
    select s.*
    into v_stream
    from public.streams as s
    where s.id = v_primary_stream_id;
  end if;

  -- Return the same configuration inputs previously fetched by separate API
  -- queries so the Worker can assemble the existing client response in memory.
  v_config := jsonb_build_object(
    'id', v_mosque.id,
    'name', v_mosque.name,
    'live_stream_enabled', v_mosque.live_stream_enabled,
    'live_stream_provider', v_mosque.live_stream_provider,
    'live_stream_playback_url', v_mosque.live_stream_playback_url,
    'live_stream_ingest_url', v_mosque.live_stream_ingest_url,
    'live_stream_mount_path', v_mosque.live_stream_mount_path,
    'live_stream_username', v_mosque.live_stream_username,
    'live_stream_stream_key', v_mosque.live_stream_stream_key,
    'live_stream_status_secret', v_mosque.live_stream_status_secret,
    'live_stream_listener_secret', v_mosque.live_stream_listener_secret
  );

  select jsonb_build_object(
    'mosque_id', u.mosque_id,
    'provider_status', u.provider_status,
    'encoder_connected', u.encoder_connected,
    'playback_active', u.playback_active,
    'provider_stream_id', u.provider_stream_id,
    'provider_message', u.provider_message,
    'provider_payload', u.provider_payload,
    'last_seen_at', u.last_seen_at,
    'updated_at', u.updated_at
  )
  into v_upstream_state
  from public.mosque_live_stream_upstream_states as u
  where u.mosque_id = p_mosque_id;

  return jsonb_build_object(
    'stream', case
      when v_has_stream then jsonb_build_object(
        'id', v_stream.id,
        'mosque_id', v_stream.mosque_id,
        'is_live', v_stream.is_live,
        'current_prayer', v_stream.current_prayer,
        'started_at', v_stream.started_at,
        'ended_at', v_stream.ended_at,
        'stream_url', v_stream.stream_url,
        'url', v_stream.url,
        'status', v_stream.status,
        'livekit_room_name', v_stream.livekit_room_name
      )
      else 'null'::jsonb
    end,
    'config', v_config,
    'upstreamState', coalesce(v_upstream_state, 'null'::jsonb),
    'livekitRoomNames', v_livekit_room_names,
    'endedAdhanIds', v_ended_adhan_ids,
    'endedAt', v_effective_ended_at,
    'endedStreamCount', v_ended_stream_count,
    'completedAdhanCount', v_completed_adhan_count,
    'idempotent', v_ended_stream_count = 0 and v_completed_adhan_count = 0
  );
end;
$function$;

comment on function public.end_live_broadcast_v1(uuid, uuid, uuid) is
  'Service-only atomic and idempotent transition for ending a mosque live broadcast.';

revoke all on function public.end_live_broadcast_v1(uuid, uuid, uuid) from public;
revoke all on function public.end_live_broadcast_v1(uuid, uuid, uuid) from anon;
revoke all on function public.end_live_broadcast_v1(uuid, uuid, uuid) from authenticated;
grant execute on function public.end_live_broadcast_v1(uuid, uuid, uuid) to service_role;
