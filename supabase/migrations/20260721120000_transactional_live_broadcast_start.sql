-- Start a live adhan as one idempotent database transition.
--
-- The Expo API route authenticates the bearer token and validates the mosque's
-- media-provider configuration before calling this service-role-only RPC. All
-- database authorization, schedule checks, and stream/adhan writes happen in
-- this transaction so a Worker failure cannot leave a partially started session.

create or replace function public.start_live_broadcast_v1(
  p_actor_user_id uuid,
  p_mosque_id uuid,
  p_prayer text,
  p_requested_scheduled_at timestamptz,
  p_adhan_id uuid,
  p_is_test boolean,
  p_provider text,
  p_readiness_error text,
  p_playback_url text,
  p_livekit_room_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() at time zone 'UTC')::date;
  v_requested_date date;
  v_slot_date date;
  v_scheduled_at timestamptz;
  v_candidate_at timestamptz;
  v_started_at timestamptz;
  v_prayer_text text := lower(trim(coalesce(p_prayer, '')));

  v_default_user_id uuid;
  v_streaming_enabled boolean;
  v_db_provider text;
  v_provider text;
  v_expected_room text;

  v_has_admin boolean := false;
  v_active_at_target boolean := false;
  v_any_active_membership boolean := false;
  v_targeted_future_rota boolean := false;
  v_any_future_rota boolean := false;
  v_rota_fallback_access boolean := false;
  v_has_access boolean := false;

  v_slot_count integer := 0;
  v_is_assigned boolean := false;
  v_is_default_active boolean := false;
  v_has_cover boolean := false;

  v_stream public.streams%rowtype;
  v_target_adhan_id uuid;
  v_live_adhan_source text;
  v_has_live_adhan_marker boolean := false;
  v_idempotent boolean := false;
begin
  if p_actor_user_id is null
     or p_mosque_id is null
     or v_prayer_text = ''
     or p_requested_scheduled_at is null
     or p_is_test is null then
    raise exception 'Missing required live broadcast arguments.'
      using errcode = '22023';
  end if;

  if v_prayer_text not in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha') then
    raise exception 'The prayer must be fajr, dhuhr, asr, maghrib, or isha.'
      using errcode = '22023';
  end if;

  -- Locking the mosque row serializes concurrent starts for that mosque and
  -- protects the provider/default-muezzin snapshot used below.
  select
    m.default_muezzin_user_id,
    m.live_stream_enabled,
    case lower(trim(coalesce(m.live_stream_provider, '')))
      when 'rtmp' then 'rtmp'
      when 'hls' then 'rtmp'
      when 'icecast' then 'icecast'
      when 'livekit' then 'livekit'
      when 'test' then 'test'
      else 'external'
    end
  into
    v_default_user_id,
    v_streaming_enabled,
    v_db_provider
  from public.mosques as m
  where m.id = p_mosque_id
  for update;

  if not found then
    raise exception 'The selected mosque could not be found.'
      using errcode = '22023';
  end if;

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
    or coalesce(v_default_user_id = p_actor_user_id, false)
    or v_targeted_future_rota
    or v_rota_fallback_access;

  if not v_has_access then
    raise exception 'You do not have muezzin access to this mosque.'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_readiness_error, '')), '') is not null then
    raise exception '%', trim(p_readiness_error)
      using errcode = '55000';
  end if;

  if not coalesce(v_streaming_enabled, false) then
    raise exception 'Live streaming is inactive for this mosque.'
      using errcode = '55000';
  end if;

  v_provider := lower(trim(coalesce(p_provider, '')));
  if v_provider <> v_db_provider then
    raise exception 'The live-stream configuration changed. Refresh and try again.'
      using errcode = '55000';
  end if;

  -- Never allow an arbitrary supplied adhan ID to be moved across mosques.
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

  v_requested_date :=
    (p_requested_scheduled_at at time zone 'UTC')::date;
  v_scheduled_at := p_requested_scheduled_at;

  -- Preserve the existing schedule priority: canonical prayer_times, the
  -- actor's rota time, a same-mosque adhan row, then the client value.
  if not p_is_test then
    if v_prayer_text in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha') then
      select case v_prayer_text
        when 'fajr' then pt.fajr_adhan_time
        when 'dhuhr' then pt.dhuhr_adhan_time
        when 'asr' then pt.asr_adhan_time
        when 'maghrib' then pt.maghrib_adhan_time
        when 'isha' then pt.isha_adhan_time
      end
      into v_candidate_at
      from public.prayer_times as pt
      where pt.mosque_id = p_mosque_id
        and pt.date = v_requested_date;

      if v_candidate_at is not null then
        v_scheduled_at := v_candidate_at;
      end if;
    end if;

    if v_candidate_at is null then
      select sr.adhan_time
      into v_candidate_at
      from public.staff_rota as sr
      where sr.mosque_id = p_mosque_id
        and coalesce(sr.muezzin_user_id, sr.staff_user_id) = p_actor_user_id
        and coalesce(sr.date, sr.duty_date) = v_requested_date
        and (
          case
            when lower(trim(coalesce(sr.prayer_name, ''))) not in ('', 'unspecified')
              then lower(trim(sr.prayer_name))
            else lower(sr.prayer::text)
          end
        ) = v_prayer_text
      order by sr.updated_at desc nulls last, sr.id desc
      limit 1;

      if v_candidate_at is not null then
        v_scheduled_at := v_candidate_at;
      end if;
    end if;

    if v_candidate_at is null and p_adhan_id is not null then
      select a.scheduled_at
      into v_candidate_at
      from public.adhans as a
      where a.id = p_adhan_id
        and a.mosque_id = p_mosque_id;

      if v_candidate_at is not null then
        v_scheduled_at := v_candidate_at;
      end if;
    end if;
  end if;

  if v_provider = 'livekit' then
    v_expected_room :=
      'adhan-' || p_mosque_id::text || '-' || v_prayer_text || '-' ||
      to_char(v_scheduled_at at time zone 'UTC', 'YYYY-MM-DD');

    if nullif(trim(p_livekit_room_name), '') is distinct from v_expected_room then
      raise exception
        'The LiveKit room does not match the authoritative prayer schedule. Refresh and try again.'
        using errcode = '55000';
    end if;
  else
    if nullif(trim(p_livekit_room_name), '') is not null then
      raise exception 'A LiveKit room was supplied for a non-LiveKit provider.'
        using errcode = '22023';
    end if;

    if nullif(trim(p_playback_url), '') is null then
      raise exception 'Follower playback URL is missing or invalid.'
        using errcode = '55000';
    end if;
  end if;

  -- streams.url is NOT NULL in production. Never invent a LiveKit stream row;
  -- lock and update the mosque's preconfigured row or fail clearly. Prefer an
  -- existing live row when legacy data contains more than one configured row.
  select s.*
  into v_stream
  from public.streams as s
  where s.mosque_id = p_mosque_id
  order by coalesce(s.is_live, false) desc,
           s.started_at desc nulls last,
           s.id desc
  limit 1
  for update;

  if not found then
    raise exception
      'This mosque has no configured stream record. Configure the stream before broadcasting.'
      using errcode = '55000';
  end if;

  if coalesce(v_stream.is_live, false)
     and (
       v_stream.started_at is null
       or v_stream.started_at >= v_now - interval '20 minutes'
     ) then
    if lower(trim(coalesce(v_stream.current_prayer, ''))) <> v_prayer_text
       or v_stream.livekit_room_name
          is distinct from nullif(trim(p_livekit_room_name), '') then
      raise exception
        'Another live broadcast is still active for this mosque. Please refresh the broadcast screen and start the current adhan again.'
        using errcode = '55000';
    end if;

    select lower(trim(coalesce(a.source, '')))
    into v_live_adhan_source
    from public.adhans as a
    where a.mosque_id = p_mosque_id
      and a.stream_id = v_stream.id
      and a.status = 'live'
    order by a.scheduled_at desc nulls last, a.id desc
    limit 1
    for update;

    v_has_live_adhan_marker := found;

    -- Test and real sessions intentionally share the public stream/room naming
    -- contract. Their adhan source marker prevents a test request from being
    -- mistaken for a retry of a real broadcast (or vice versa).
    if (p_is_test and (
          not v_has_live_adhan_marker
          or v_live_adhan_source <> 'test'
        ))
       or (
         not p_is_test
         and v_has_live_adhan_marker
         and v_live_adhan_source = 'test'
       ) then
      raise exception
        'Another live broadcast is still active for this mosque. Please refresh the broadcast screen and start the current adhan again.'
        using errcode = '55000';
    end if;

    v_idempotent := true;
  end if;

  -- A retry can arrive after the narrow +2-minute window because the mobile
  -- request timed out after the first transaction committed. Return that same
  -- fresh matching session instead of rejecting or resetting its timestamp.
  if not v_idempotent then
    if v_now < v_scheduled_at - interval '3 minutes' then
      raise exception 'Too early — the broadcast window opens in % minute%.',
        ceil(
          extract(epoch from (
            (v_scheduled_at - interval '3 minutes') - v_now
          )) / 60.0
        )::integer,
        case
          when ceil(
            extract(epoch from (
              (v_scheduled_at - interval '3 minutes') - v_now
            )) / 60.0
          )::integer = 1 then ''
          else 's'
        end
        using errcode = '42501';
    end if;

    if v_now > v_scheduled_at + interval '2 minutes' then
      raise exception 'The broadcast window for this adhan has closed.'
        using errcode = '42501';
    end if;
  end if;

  v_slot_date := (v_scheduled_at at time zone 'UTC')::date;

  if not p_is_test and not v_has_admin then
    select
      count(*),
      coalesce(
        bool_or(
          coalesce(sr.muezzin_user_id, sr.staff_user_id)
            = p_actor_user_id
        ),
        false
      )
    into v_slot_count, v_is_assigned
    from public.staff_rota as sr
    where sr.mosque_id = p_mosque_id
      and coalesce(sr.date, sr.duty_date) = v_slot_date
      and (
        case
          when lower(trim(coalesce(sr.prayer_name, ''))) not in ('', 'unspecified')
            then lower(trim(sr.prayer_name))
          else lower(sr.prayer::text)
        end
      ) = v_prayer_text;

    select coalesce(
      v_default_user_id = p_actor_user_id
      and exists (
        select 1
        from public.muezzins as m
        where m.user_id = p_actor_user_id
          and m.mosque_id = p_mosque_id
          and coalesce(m.is_active, true)
      ),
      false
    )
    into v_is_default_active;

    select exists (
      select 1
      from public.muezzin_cover_requests as cr
      where cr.mosque_id = p_mosque_id
        and cr.date = v_slot_date
        and lower(cr.prayer_name) = v_prayer_text
        and cr.volunteer_user_id = p_actor_user_id
        and cr.status in ('provisional_cover', 'approved')
    ) into v_has_cover;

    if not (
      v_is_assigned
      or (v_slot_count = 0 and v_is_default_active)
      or v_has_cover
    ) then
      raise exception
        'Only the assigned muezzin, approved cover, provisional urgent cover, or a mosque admin can start this live adhan.'
        using errcode = '42501';
    end if;
  end if;

  if v_idempotent then

    -- Listener freshness treats a missing timestamp as live indefinitely. Repair
    -- legacy matching rows while keeping normal retries on the original value.
    if v_stream.started_at is null then
      update public.streams
      set started_at = v_now
      where id = v_stream.id
      returning * into v_stream;
    end if;

    v_started_at := coalesce(v_stream.started_at, v_now);
  else
    update public.streams
    set
      is_live = true,
      current_prayer = v_prayer_text,
      started_at = v_now,
      ended_at = null,
      status = 'active',
      livekit_room_name = nullif(trim(p_livekit_room_name), ''),
      stream_url = case
        when nullif(trim(p_playback_url), '') is not null
          then trim(p_playback_url)
        else stream_url
      end,
      url = case
        when nullif(trim(p_playback_url), '') is not null
          then trim(p_playback_url)
        else url
      end
    where id = v_stream.id
    returning * into v_stream;

    v_started_at := v_stream.started_at;
  end if;

  if p_adhan_id is not null then
    select a.id
    into v_target_adhan_id
    from public.adhans as a
    where a.id = p_adhan_id
      and a.mosque_id = p_mosque_id
    for update;
  end if;

  if v_target_adhan_id is null then
    select a.id
    into v_target_adhan_id
    from public.adhans as a
    where a.mosque_id = p_mosque_id
      and a.status = 'live'
    order by a.scheduled_at desc, a.id desc
    limit 1
    for update;
  end if;

  -- Repair any legacy second live adhan before promoting the target. The mosque
  -- row lock prevents concurrent RPC starts from recreating this state.
  update public.adhans
  set
    status = 'completed',
    ended_at = v_started_at,
    broadcast_ended_at = v_started_at
  where mosque_id = p_mosque_id
    and status = 'live'
    and (
      v_target_adhan_id is null
      or id <> v_target_adhan_id
    );

  if v_target_adhan_id is not null then
    update public.adhans
    set
      prayer = v_prayer_text::public.prayer_t,
      scheduled_at = v_scheduled_at,
      status = 'live',
      source = case when p_is_test then 'test' else 'live' end,
      started_at = v_started_at,
      ended_at = null,
      broadcast_started_at = v_started_at,
      broadcast_ended_at = null,
      stream_id = v_stream.id
    where id = v_target_adhan_id
      and mosque_id = p_mosque_id;
  else
    insert into public.adhans (
      mosque_id,
      prayer,
      scheduled_at,
      status,
      source,
      started_at,
      ended_at,
      broadcast_started_at,
      broadcast_ended_at,
      stream_id
    )
    values (
      p_mosque_id,
      v_prayer_text::public.prayer_t,
      v_scheduled_at,
      'live',
      case when p_is_test then 'test' else 'live' end,
      v_started_at,
      null,
      v_started_at,
      null,
      v_stream.id
    )
    returning id into v_target_adhan_id;
  end if;

  return jsonb_build_object(
    'stream', jsonb_build_object(
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
    ),
    'adhanId', v_target_adhan_id,
    'scheduledAt', v_scheduled_at,
    'idempotent', v_idempotent
  );
end;
$function$;

comment on function public.start_live_broadcast_v1(
  uuid, uuid, text, timestamptz, uuid,
  boolean, text, text, text, text
) is 'Service-only atomic and idempotent transition for starting a mosque live broadcast.';

revoke all on function public.start_live_broadcast_v1(
  uuid, uuid, text, timestamptz, uuid,
  boolean, text, text, text, text
) from public;

revoke all on function public.start_live_broadcast_v1(
  uuid, uuid, text, timestamptz, uuid,
  boolean, text, text, text, text
) from anon;

revoke all on function public.start_live_broadcast_v1(
  uuid, uuid, text, timestamptz, uuid,
  boolean, text, text, text, text
) from authenticated;

grant execute on function public.start_live_broadcast_v1(
  uuid, uuid, text, timestamptz, uuid,
  boolean, text, text, text, text
) to service_role;
