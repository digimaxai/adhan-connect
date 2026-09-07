-- attendance_reminder was added to notification_events' allowed kinds
-- (20260907170000) but materialize_notification_deliveries_v1 was never
-- updated to recognize it, so those events could insert successfully but
-- would never be picked up into a delivery. This adds the missing branch,
-- mirroring the existing kind-specific staleness/eligibility pattern.
-- attendance_reminder events already carry their target user_id directly
-- (set by send_event_attendance_reminder / send_jumuah_attendance_reminder),
-- so no additional preference join is needed — the user already opted in
-- by creating an attendance plan.
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
      or (event.kind = 'attendance_reminder' and event.scheduled_for < now() - interval '30 minutes')
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
        or (event.kind = 'attendance_reminder' and event.scheduled_for >= now() - interval '30 minutes')
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

    select event.id, event.user_id
    from recent_events event
    where event.kind = 'attendance_reminder' and event.user_id is not null

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
