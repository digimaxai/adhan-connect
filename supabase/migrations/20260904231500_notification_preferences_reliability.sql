-- Notification preference and delivery reliability hardening.
--
-- Scope boundary:
--   * Changes only notification preferences, travel regions, events and
--     deliveries.
--   * Does not modify LIVE Adhan state, streams, rota, assignments, prayer
--     times, muezzins, mosques or subscriptions.
--   * Network delivery remains outside every LIVE/rota transaction.

-- Align stored values with the choices presented by the mobile UI before
-- tightening the constraints. Keep at least one useful reminder/prayer.
update public.notification_preferences preference
set muezzin_lead_minutes = coalesce(
      (
        select array_agg(value order by value desc)
        from (
          select distinct lead.value
          from unnest(preference.muezzin_lead_minutes) as lead(value)
          where lead.value in (5, 10, 30)
        ) allowed
      ),
      array[30, 10]::integer[]
    ),
    updated_at = now();

update public.notification_preferences
set listener_prayers = array['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']::text[],
    updated_at = now()
where cardinality(listener_prayers) = 0;

update public.notification_preferences
set travel_radius_km = 15,
    updated_at = now()
where travel_radius_km not in (5, 15, 30);

alter table public.notification_preferences
  drop constraint if exists notification_preferences_muezzin_leads_check,
  drop constraint if exists notification_preferences_listener_prayers_check,
  drop constraint if exists notification_preferences_travel_radius_km_check;

alter table public.notification_preferences
  add constraint notification_preferences_muezzin_leads_check check (
    cardinality(muezzin_lead_minutes) > 0
    and muezzin_lead_minutes <@ array[5, 10, 30]::integer[]
  ),
  add constraint notification_preferences_listener_prayers_check check (
    cardinality(listener_prayers) > 0
    and listener_prayers <@ array['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']::text[]
  ),
  add constraint notification_preferences_travel_radius_km_check check (
    travel_radius_km in (5, 15, 30)
  );

-- Travel region and preference state must change atomically. The original
-- UPDATE-only implementation did nothing for a user's first preference row.
create or replace function public.set_travel_notification_region_v1(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km integer default 15,
  p_label text default null,
  p_duration_hours integer default 24
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expires_at timestamptz;
  v_latitude double precision;
  v_longitude double precision;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
     or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates.';
  end if;
  if p_radius_km not in (5, 15, 30) then
    raise exception 'Travel radius must be 5, 15 or 30 km.';
  end if;

  -- Roughly 1 km precision: enough for regional matching without retaining a
  -- route or a precise device position.
  v_latitude := round(p_latitude::numeric, 2)::double precision;
  v_longitude := round(p_longitude::numeric, 2)::double precision;
  v_expires_at := now() + make_interval(hours => least(greatest(p_duration_hours, 1), 24));

  insert into public.travel_notification_regions (
    user_id, center, radius_km, label, expires_at
  ) values (
    v_user_id,
    st_setsrid(st_makepoint(v_longitude, v_latitude), 4326)::public.geography,
    p_radius_km,
    nullif(left(trim(coalesce(p_label, '')), 80), ''),
    v_expires_at
  )
  on conflict (user_id)
  do update set
    center = excluded.center,
    radius_km = excluded.radius_km,
    label = excluded.label,
    expires_at = excluded.expires_at,
    updated_at = now();

  insert into public.notification_preferences (
    user_id, travel_live_enabled, travel_radius_km
  ) values (
    v_user_id, true, p_radius_km
  )
  on conflict (user_id)
  do update set
    travel_live_enabled = true,
    travel_radius_km = excluded.travel_radius_km,
    updated_at = now();

  return v_expires_at;
end;
$$;

create or replace function public.clear_travel_notification_region_v1()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  delete from public.travel_notification_regions where user_id = v_user_id;

  insert into public.notification_preferences (user_id, travel_live_enabled)
  values (v_user_id, false)
  on conflict (user_id)
  do update set
    travel_live_enabled = false,
    updated_at = now();
end;
$$;

revoke all on function public.set_travel_notification_region_v1(double precision, double precision, integer, text, integer) from public, anon;
revoke all on function public.clear_travel_notification_region_v1() from public, anon;
grant execute on function public.set_travel_notification_region_v1(double precision, double precision, integer, text, integer) to authenticated;
grant execute on function public.clear_travel_notification_region_v1() to authenticated;

-- Do not create a fresh delivery for an event whose real-world moment has
-- already passed. Also retire stale pending work left by a dispatcher outage.
create or replace function public.materialize_notification_deliveries_v1(
  p_app_variant text,
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if p_app_variant not in ('staging', 'production') then
    raise exception 'Invalid app variant.';
  end if;

  update public.notification_deliveries delivery
  set status = 'failed',
      last_error = 'Notification expired before dispatch.',
      updated_at = now()
  from public.notification_events event,
       public.push_devices device
  where delivery.event_id = event.id
    and device.id = delivery.device_id
    and device.app_variant = p_app_variant
    and delivery.status in ('pending', 'retry', 'processing')
    and (
      (event.kind = 'live_adhan' and event.scheduled_for < now() - interval '20 minutes')
      or (event.kind in ('listener_upcoming', 'muezzin_duty') and event.scheduled_for < now() - interval '5 minutes')
      or (event.kind = 'assignment_update' and event.scheduled_for < now() - interval '6 hours')
    );

  with recent_events as (
    select event.*
    from public.notification_events event
    where event.created_at >= now() - interval '2 days'
      and event.scheduled_for <= now() + interval '2 minutes'
      and (
        (event.kind = 'live_adhan' and event.scheduled_for >= now() - interval '20 minutes')
        or (event.kind in ('listener_upcoming', 'muezzin_duty') and event.scheduled_for >= now() - interval '5 minutes')
        or (event.kind = 'assignment_update' and event.scheduled_for >= now() - interval '6 hours')
      )
    order by event.scheduled_for, event.created_at
    limit least(greatest(p_limit, 1), 2000)
  ), eligible_users as (
    select event.id as event_id, event.user_id
    from recent_events event
    join public.notification_preferences pref on pref.user_id = event.user_id
    where event.user_id is not null
      and (
        (event.kind = 'listener_upcoming' and pref.listener_upcoming_enabled)
        or (event.kind = 'muezzin_duty' and pref.muezzin_duty_reminders_enabled)
        or (event.kind = 'assignment_update' and pref.muezzin_assignment_updates_enabled)
      )

    union

    select event.id, pref.user_id
    from recent_events event
    join public.notification_preferences pref on pref.listener_live_enabled
    join public.subscriptions subscription
      on subscription.user_id = pref.user_id
     and subscription.mosque_id = event.mosque_id
     and subscription.status::text = 'active'
    where event.kind = 'live_adhan'
      and (
        pref.listener_mosque_scope = 'all_followed'
        or pref.listener_primary_mosque_id = event.mosque_id
      )

    union

    select event.id, pref.user_id
    from recent_events event
    join public.notification_preferences pref on pref.muezzin_live_enabled
    join public.muezzins muezzin
      on muezzin.user_id = pref.user_id
     and muezzin.mosque_id = event.mosque_id
     and coalesce(muezzin.is_active, true)
    where event.kind = 'live_adhan'

    union

    select event.id, pref.user_id
    from recent_events event
    join public.notification_preferences pref on pref.travel_live_enabled
    join public.travel_notification_regions region
      on region.user_id = pref.user_id
     and region.expires_at > now()
    join public.mosques mosque on mosque.id = event.mosque_id
    where event.kind = 'live_adhan'
      and coalesce(
        mosque.location_geog,
        case
          when mosque.lat is not null and mosque.lng is not null
          then st_setsrid(st_makepoint(mosque.lng, mosque.lat), 4326)::public.geography
          else null
        end
      ) is not null
      and st_dwithin(
        coalesce(
          mosque.location_geog,
          st_setsrid(st_makepoint(mosque.lng, mosque.lat), 4326)::public.geography
        ),
        region.center,
        least(region.radius_km, pref.travel_radius_km) * 1000.0
      )
  )
  insert into public.notification_deliveries (event_id, device_id, user_id)
  select eligible.event_id, device.id, eligible.user_id
  from eligible_users eligible
  join public.push_devices device
    on device.user_id = eligible.user_id
   and device.app_variant = p_app_variant
   and device.is_active
   and device.permission_status in ('granted', 'provisional')
  on conflict (event_id, device_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.materialize_notification_deliveries_v1(text, integer) from public, anon, authenticated;
grant execute on function public.materialize_notification_deliveries_v1(text, integer) to service_role;

comment on function public.materialize_notification_deliveries_v1(text, integer) is
  'Builds de-duplicated, role-aware push deliveries and retires notifications after their useful real-world window.';
