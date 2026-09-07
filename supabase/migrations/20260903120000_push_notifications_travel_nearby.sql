-- Push-notification foundation and travel-aware nearby mosque query.
--
-- Safety boundary:
--   * This migration does not replace or modify start_live_broadcast_v1,
--     end_live_broadcast_v1, streams, staff_rota, or assignment APIs.
--   * LIVE/assignment triggers only enqueue a small local event. They swallow
--     enqueue failures so notifications can never block their source workflow.
--   * Network delivery is performed asynchronously by an Edge Function after
--     the source transaction commits.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  app_variant text not null check (app_variant in ('staging', 'production')),
  permission_status text not null default 'granted'
    check (permission_status in ('granted', 'provisional', 'denied')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id, app_variant),
  unique (expo_push_token, app_variant)
);

create index if not exists idx_push_devices_active_variant
  on public.push_devices(app_variant, user_id)
  where is_active;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  listener_upcoming_enabled boolean not null default false,
  listener_live_enabled boolean not null default false,
  listener_mosque_scope text not null default 'primary'
    check (listener_mosque_scope in ('primary', 'all_followed')),
  listener_primary_mosque_id uuid references public.mosques(id) on delete set null,
  listener_lead_minutes integer not null default 15
    check (listener_lead_minutes in (0, 5, 10, 15, 30, 60)),
  listener_prayers text[] not null default array['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']::text[],
  muezzin_assignment_updates_enabled boolean not null default false,
  muezzin_duty_reminders_enabled boolean not null default false,
  muezzin_live_enabled boolean not null default false,
  muezzin_lead_minutes integer[] not null default array[30, 10]::integer[],
  travel_live_enabled boolean not null default false,
  travel_radius_km integer not null default 15 check (travel_radius_km between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_listener_prayers_check check (
    listener_prayers <@ array['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']::text[]
  ),
  constraint notification_preferences_muezzin_leads_check check (
    muezzin_lead_minutes <@ array[0, 5, 10, 15, 30, 60]::integer[]
  )
);

create table if not exists public.travel_notification_regions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  center public.geography(Point, 4326) not null,
  radius_km integer not null default 15 check (radius_km between 1 and 50),
  label text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_travel_notification_regions_center
  on public.travel_notification_regions using gist(center);
create index if not exists idx_travel_notification_regions_expiry
  on public.travel_notification_regions(expires_at);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null check (
    kind in ('live_adhan', 'listener_upcoming', 'muezzin_duty', 'assignment_update')
  ),
  user_id uuid references auth.users(id) on delete cascade,
  mosque_id uuid references public.mosques(id) on delete cascade,
  adhan_id uuid references public.adhans(id) on delete cascade,
  prayer text,
  scheduled_for timestamptz not null default now(),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_events_due
  on public.notification_events(scheduled_for, created_at);
create index if not exists idx_notification_events_user
  on public.notification_events(user_id, created_at desc)
  where user_id is not null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'delivered', 'retry', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  expo_ticket_id text,
  expo_receipt jsonb,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, device_id)
);

create index if not exists idx_notification_deliveries_dispatch
  on public.notification_deliveries(status, next_attempt_at, created_at);
create index if not exists idx_notification_deliveries_receipts
  on public.notification_deliveries(sent_at)
  where status = 'sent' and expo_ticket_id is not null;

alter table public.push_devices enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.travel_notification_regions enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "push_devices_select_own" on public.push_devices;
create policy "push_devices_select_own"
on public.push_devices for select to authenticated
using (user_id = auth.uid());

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences for select to authenticated
using (user_id = auth.uid());

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
on public.notification_preferences for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
on public.notification_preferences for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "travel_notification_regions_select_own" on public.travel_notification_regions;
create policy "travel_notification_regions_select_own"
on public.travel_notification_regions for select to authenticated
using (user_id = auth.uid());

-- Travel regions are written through a validating RPC so only coarse,
-- short-lived coordinates are retained.

grant select on public.push_devices to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.travel_notification_regions to authenticated;
grant all on public.push_devices, public.notification_preferences,
  public.travel_notification_regions, public.notification_events,
  public.notification_deliveries to service_role;

create or replace function public.register_push_device_v1(
  p_expo_push_token text,
  p_installation_id text,
  p_platform text,
  p_app_variant text,
  p_permission_status text default 'granted'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if length(trim(coalesce(p_expo_push_token, ''))) < 20
     or length(trim(p_expo_push_token)) > 255 then
    raise exception 'Invalid Expo push token.';
  end if;
  if length(trim(coalesce(p_installation_id, ''))) < 8
     or length(trim(p_installation_id)) > 128 then
    raise exception 'Invalid installation identifier.';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Invalid platform.';
  end if;
  if p_app_variant not in ('staging', 'production') then
    raise exception 'Invalid app variant.';
  end if;
  if p_permission_status not in ('granted', 'provisional') then
    raise exception 'Push permission is not granted.';
  end if;

  -- A native token identifies an installation. If a different account signs
  -- in on that installation, ownership moves atomically so the old account can
  -- never keep receiving private notifications.
  update public.push_devices
  set user_id = v_user_id,
      installation_id = trim(p_installation_id),
      platform = p_platform,
      permission_status = p_permission_status,
      is_active = true,
      disabled_at = null,
      last_seen_at = now(),
      updated_at = now()
  where expo_push_token = trim(p_expo_push_token)
    and app_variant = p_app_variant
  returning id into v_device_id;

  if v_device_id is not null then
    return v_device_id;
  end if;

  insert into public.push_devices (
    user_id,
    installation_id,
    expo_push_token,
    platform,
    app_variant,
    permission_status,
    is_active,
    last_seen_at,
    disabled_at
  ) values (
    v_user_id,
    trim(p_installation_id),
    trim(p_expo_push_token),
    p_platform,
    p_app_variant,
    p_permission_status,
    true,
    now(),
    null
  )
  on conflict (user_id, installation_id, app_variant)
  do update set
    expo_push_token = excluded.expo_push_token,
    platform = excluded.platform,
    permission_status = excluded.permission_status,
    is_active = true,
    disabled_at = null,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;

create or replace function public.unregister_push_device_v1(
  p_installation_id text,
  p_app_variant text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_devices
  set is_active = false,
      permission_status = 'denied',
      disabled_at = now(),
      updated_at = now()
  where user_id = auth.uid()
    and installation_id = trim(p_installation_id)
    and app_variant = p_app_variant;
$$;

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
  if p_radius_km not between 1 and 50 then
    raise exception 'Travel radius must be between 1 and 50 km.';
  end if;

  -- Roughly 1 km precision: useful for regional matching without retaining a
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

  update public.notification_preferences
  set travel_live_enabled = true,
      travel_radius_km = p_radius_km,
      updated_at = now()
  where user_id = v_user_id;

  return v_expires_at;
end;
$$;

create or replace function public.clear_travel_notification_region_v1()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.travel_notification_regions where user_id = auth.uid();
$$;

revoke all on function public.register_push_device_v1(text, text, text, text, text) from public, anon;
revoke all on function public.unregister_push_device_v1(text, text) from public, anon;
revoke all on function public.set_travel_notification_region_v1(double precision, double precision, integer, text, integer) from public, anon;
revoke all on function public.clear_travel_notification_region_v1() from public, anon;
grant execute on function public.register_push_device_v1(text, text, text, text, text) to authenticated;
grant execute on function public.unregister_push_device_v1(text, text) to authenticated;
grant execute on function public.set_travel_notification_region_v1(double precision, double precision, integer, text, integer) to authenticated;
grant execute on function public.clear_travel_notification_region_v1() to authenticated;

create or replace function public.enqueue_live_adhan_notification_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mosque_name text;
  v_was_live boolean;
begin
  v_was_live := case when tg_op = 'UPDATE' then old.status::text = 'live' else false end;
  if new.status::text <> 'live' or v_was_live then
    return new;
  end if;

  begin
    select coalesce(nullif(trim(name), ''), 'Your mosque')
      into v_mosque_name
    from public.mosques
    where id = new.mosque_id;

    insert into public.notification_events (
      event_key, kind, mosque_id, adhan_id, prayer, scheduled_for,
      title, body, data
    ) values (
      'live_adhan:' || new.id::text,
      'live_adhan',
      new.mosque_id,
      new.id,
      new.prayer::text,
      now(),
      coalesce(v_mosque_name, 'A nearby mosque') || ' is live',
      initcap(new.prayer::text) || ' Adhan is broadcasting now.',
      jsonb_build_object(
        'screen', 'live',
        'mosqueId', new.mosque_id,
        'adhanId', new.id,
        'prayer', new.prayer::text
      )
    )
    on conflict (event_key) do nothing;
  exception when others then
    raise warning 'Push enqueue failed for live Adhan %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_live_adhan_notification_v1 on public.adhans;
create trigger trg_enqueue_live_adhan_notification_v1
after insert or update of status on public.adhans
for each row execute function public.enqueue_live_adhan_notification_v1();

create or replace function public.enqueue_app_notification_push_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.notification_events (
      event_key, kind, user_id, mosque_id, scheduled_for, title, body, data
    ) values (
      'app_notification:' || new.id::text,
      'assignment_update',
      new.user_id,
      new.mosque_id,
      now(),
      new.title,
      new.body,
      coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'screen', 'muezzin_rota',
        'appNotificationId', new.id
      )
    )
    on conflict (event_key) do nothing;
  exception when others then
    raise warning 'Push enqueue failed for app notification %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_app_notification_push_v1 on public.app_notifications;
create trigger trg_enqueue_app_notification_push_v1
after insert on public.app_notifications
for each row execute function public.enqueue_app_notification_push_v1();

create or replace function public.enqueue_due_adhan_reminders_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_row_count integer := 0;
begin
  -- Listener reminders: reads subscriptions and preferences only. It never
  -- writes either one, so the user's followed/default mosques remain intact.
  with prayer_occurrences as (
    select
      pt.mosque_id,
      prayer_row.prayer,
      prayer_row.scheduled_at
    from public.prayer_times pt
    cross join lateral (
      values
        ('fajr'::text, pt.fajr_adhan_time),
        ('dhuhr'::text, pt.dhuhr_adhan_time),
        ('asr'::text, pt.asr_adhan_time),
        ('maghrib'::text, pt.maghrib_adhan_time),
        ('isha'::text, pt.isha_adhan_time)
    ) as prayer_row(prayer, scheduled_at)
    where pt.date between (p_now - interval '1 day')::date and (p_now + interval '2 days')::date
      and prayer_row.scheduled_at is not null
  )
  insert into public.notification_events (
    event_key, kind, user_id, mosque_id, prayer, scheduled_for, title, body, data
  )
  select
    'listener_upcoming:' || pref.user_id::text || ':' || occurrence.mosque_id::text || ':' ||
      occurrence.prayer || ':' || extract(epoch from occurrence.scheduled_at)::bigint::text || ':' ||
      pref.listener_lead_minutes::text,
    'listener_upcoming',
    pref.user_id,
    occurrence.mosque_id,
    occurrence.prayer,
    occurrence.scheduled_at - make_interval(mins => pref.listener_lead_minutes),
    initcap(occurrence.prayer) || ' at ' || mosque.name ||
      case when pref.listener_lead_minutes > 0 then ' in ' || pref.listener_lead_minutes::text || ' min' else ' now' end,
    'Adhan at ' || to_char(occurrence.scheduled_at at time zone coalesce(nullif(mosque.time_zone, ''), 'UTC'), 'HH24:MI') || '.',
    jsonb_build_object(
      'screen', 'mosque',
      'mosqueId', occurrence.mosque_id,
      'prayer', occurrence.prayer,
      'scheduledAt', occurrence.scheduled_at
    )
  from prayer_occurrences occurrence
  join public.mosques mosque on mosque.id = occurrence.mosque_id
  join public.subscriptions subscription
    on subscription.mosque_id = occurrence.mosque_id
   and subscription.status::text = 'active'
  join public.notification_preferences pref
    on pref.user_id = subscription.user_id
   and pref.listener_upcoming_enabled
   and occurrence.prayer = any(pref.listener_prayers)
   and (
     pref.listener_mosque_scope = 'all_followed'
     or pref.listener_primary_mosque_id = occurrence.mosque_id
   )
  where occurrence.scheduled_at - make_interval(mins => pref.listener_lead_minutes)
          between p_now - interval '30 seconds' and p_now + interval '90 seconds'
  on conflict (event_key) do nothing;

  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  -- Muezzin operational reminders use the existing authoritative rota.
  insert into public.notification_events (
    event_key, kind, user_id, mosque_id, prayer, scheduled_for, title, body, data
  )
  select
    'muezzin_duty:' || rota.id::text || ':' || lead.minutes::text,
    'muezzin_duty',
    rota.muezzin_user_id,
    rota.mosque_id,
    lower(rota.prayer_name),
    rota.adhan_time - make_interval(mins => lead.minutes),
    'Your ' || initcap(lower(rota.prayer_name)) || ' duty starts' ||
      case when lead.minutes > 0 then ' in ' || lead.minutes::text || ' min' else ' now' end,
    mosque.name || ' · Open your broadcast check.',
    jsonb_build_object(
      'screen', 'muezzin_broadcast',
      'mosqueId', rota.mosque_id,
      'rotaId', rota.id,
      'prayer', lower(rota.prayer_name),
      'scheduledAt', rota.adhan_time
    )
  from public.staff_rota rota
  join public.mosques mosque on mosque.id = rota.mosque_id
  join public.notification_preferences pref
    on pref.user_id = rota.muezzin_user_id
   and pref.muezzin_duty_reminders_enabled
  cross join lateral unnest(pref.muezzin_lead_minutes) as lead(minutes)
  where rota.adhan_time is not null
    and rota.adhan_time - make_interval(mins => lead.minutes)
          between p_now - interval '30 seconds' and p_now + interval '90 seconds'
  on conflict (event_key) do nothing;

  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;
  return v_inserted;
end;
$$;

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

  with recent_events as (
    select event.*
    from public.notification_events event
    where event.created_at >= now() - interval '2 days'
      and event.scheduled_for <= now() + interval '2 minutes'
    order by event.scheduled_for, event.created_at
    limit least(greatest(p_limit, 1), 2000)
  ), eligible_users as (
    -- Targeted reminder/assignment events.
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

    -- LIVE alerts from the listener's primary or followed mosques.
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

    -- Muezzin LIVE interest is independent from listener preferences.
    select event.id, pref.user_id
    from recent_events event
    join public.notification_preferences pref on pref.muezzin_live_enabled
    join public.muezzins muezzin
      on muezzin.user_id = pref.user_id
     and muezzin.mosque_id = event.mosque_id
     and coalesce(muezzin.is_active, true)
    where event.kind = 'live_adhan'

    union

    -- Optional, short-lived coarse current-area LIVE alerts.
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

create or replace function public.claim_notification_deliveries_v1(
  p_app_variant text,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  device_id uuid,
  expo_push_token text,
  title text,
  body text,
  data jsonb,
  notification_kind text,
  attempt_count integer
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select delivery.id
    from public.notification_deliveries delivery
    join public.push_devices device on device.id = delivery.device_id
    where device.app_variant = p_app_variant
      and device.is_active
      and delivery.next_attempt_at <= now()
      and (
        delivery.status in ('pending', 'retry')
        or (delivery.status = 'processing' and delivery.updated_at < now() - interval '5 minutes')
      )
      and delivery.attempt_count < 5
    order by delivery.next_attempt_at, delivery.created_at
    for update of delivery skip locked
    limit least(greatest(p_limit, 1), 100)
  ), claimed as (
    update public.notification_deliveries delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.id, delivery.device_id, delivery.event_id
  )
  select
    claimed.id,
    claimed.device_id,
    device.expo_push_token,
    event.title,
    event.body,
    event.data,
    event.kind,
    delivery.attempt_count
  from claimed
  join public.notification_deliveries delivery on delivery.id = claimed.id
  join public.push_devices device on device.id = claimed.device_id
  join public.notification_events event on event.id = claimed.event_id;
$$;

create or replace function public.apply_notification_delivery_results_v1(
  p_results jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_delivery_id uuid;
  v_status text;
  v_updated integer := 0;
begin
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Delivery results must be an array.';
  end if;

  for v_result in select value from jsonb_array_elements(p_results)
  loop
    v_delivery_id := (v_result->>'deliveryId')::uuid;
    v_status := v_result->>'status';
    if v_status not in ('sent', 'delivered', 'retry', 'failed') then
      raise exception 'Invalid delivery result status.';
    end if;

    update public.notification_deliveries delivery
    set status = v_status,
        expo_ticket_id = case
          when v_status = 'sent' then nullif(v_result->>'ticketId', '')
          when v_status = 'retry' then null
          else delivery.expo_ticket_id
        end,
        expo_receipt = case
          when v_result ? 'receipt' then v_result->'receipt'
          else delivery.expo_receipt
        end,
        last_error = nullif(left(coalesce(v_result->>'error', ''), 1000), ''),
        sent_at = case when v_status = 'sent' then now() else delivery.sent_at end,
        delivered_at = case when v_status = 'delivered' then now() else delivery.delivered_at end,
        next_attempt_at = case
          when v_status = 'retry'
          then now() + make_interval(secs => least(greatest(coalesce((v_result->>'retryAfterSeconds')::integer, 60), 30), 3600))
          else delivery.next_attempt_at
        end,
        updated_at = now()
    where delivery.id = v_delivery_id;

    if found then
      v_updated := v_updated + 1;
      update public.push_devices device
      set is_active = case when coalesce((v_result->>'deactivateDevice')::boolean, false) then false else device.is_active end,
          disabled_at = case when coalesce((v_result->>'deactivateDevice')::boolean, false) then now() else device.disabled_at end,
          last_delivery_at = case when v_status in ('sent', 'delivered') then now() else device.last_delivery_at end,
          updated_at = now()
      from public.notification_deliveries delivery
      where delivery.id = v_delivery_id
        and device.id = delivery.device_id;
    end if;
  end loop;

  return v_updated;
end;
$$;

revoke all on function public.enqueue_due_adhan_reminders_v1(timestamptz) from public, anon, authenticated;
revoke all on function public.materialize_notification_deliveries_v1(text, integer) from public, anon, authenticated;
revoke all on function public.claim_notification_deliveries_v1(text, integer) from public, anon, authenticated;
revoke all on function public.apply_notification_delivery_results_v1(jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_due_adhan_reminders_v1(timestamptz) to service_role;
grant execute on function public.materialize_notification_deliveries_v1(text, integer) to service_role;
grant execute on function public.claim_notification_deliveries_v1(text, integer) to service_role;
grant execute on function public.apply_notification_delivery_results_v1(jsonb) to service_role;

-- Accurate, database-side distance filtering. This reads only public mosque,
-- timetable, and LIVE state and never touches subscriptions/default choices.
create or replace function public.nearby_mosque_context_v1(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 15,
  p_limit integer default 10
)
returns table (
  id uuid,
  name text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  time_zone text,
  prayer_calculation_method integer,
  prayer_school integer,
  distance_km double precision,
  prayer_source text,
  next_prayer text,
  next_adhan_at timestamptz,
  is_live boolean,
  live_prayer text,
  live_adhan_id uuid,
  live_started_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
     or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates.';
  end if;

  return query
  with params as (
    select
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::public.geography as point,
      least(greatest(coalesce(p_radius_km, 15), 1), 100) * 1000.0 as radius_m
  ), nearby as (
    select
      mosque.*,
      coalesce(
        mosque.location_geog,
        st_setsrid(st_makepoint(mosque.lng, mosque.lat), 4326)::public.geography
      ) as geog
    from public.mosques mosque, params
    where mosque.status::text = 'active'
      and coalesce(mosque.is_active, true)
      and mosque.lat is not null
      and mosque.lng is not null
      and st_dwithin(
        coalesce(
          mosque.location_geog,
          st_setsrid(st_makepoint(mosque.lng, mosque.lat), 4326)::public.geography
        ),
        params.point,
        params.radius_m
      )
  )
  select
    mosque.id,
    mosque.name,
    mosque.city,
    mosque.country,
    mosque.lat,
    mosque.lng,
    coalesce(nullif(mosque.time_zone, ''), nullif(mosque.timezone, ''), 'UTC'),
    coalesce(mosque.prayer_calculation_method, 3),
    coalesce(mosque.prayer_school, 0),
    round((st_distance(mosque.geog, params.point) / 1000.0)::numeric, 1)::double precision,
    coalesce(nullif(next_time.source_type, ''), nullif(mosque.prayer_source, ''), 'mosque'),
    next_time.prayer,
    next_time.scheduled_at,
    live_state.stream_id is not null,
    live_state.prayer,
    live_state.adhan_id,
    live_state.started_at
  from nearby mosque
  cross join params
  left join lateral (
    select occurrence.prayer, occurrence.scheduled_at, prayer_time.source_type
    from public.prayer_times prayer_time
    cross join lateral (
      values
        ('fajr'::text, prayer_time.fajr_adhan_time),
        ('dhuhr'::text, prayer_time.dhuhr_adhan_time),
        ('asr'::text, prayer_time.asr_adhan_time),
        ('maghrib'::text, prayer_time.maghrib_adhan_time),
        ('isha'::text, prayer_time.isha_adhan_time)
    ) as occurrence(prayer, scheduled_at)
    where prayer_time.mosque_id = mosque.id
      and prayer_time.date between (now() - interval '1 day')::date and (now() + interval '2 days')::date
      and occurrence.scheduled_at > now() - interval '90 seconds'
    order by occurrence.scheduled_at
    limit 1
  ) next_time on true
  left join lateral (
    select
      stream.id as stream_id,
      adhan.id as adhan_id,
      adhan.prayer::text as prayer,
      coalesce(adhan.started_at, adhan.broadcast_started_at, stream.started_at) as started_at
    from public.streams stream
    left join public.adhans adhan
      on adhan.mosque_id = stream.mosque_id
     and adhan.status::text = 'live'
     and adhan.ended_at is null
     and adhan.broadcast_ended_at is null
    where stream.mosque_id = mosque.id
      and stream.is_live
      and (stream.started_at is null or stream.started_at >= now() - interval '20 minutes')
      and (
        adhan.id is null
        or coalesce(adhan.started_at, adhan.broadcast_started_at, adhan.scheduled_at) >= now() - interval '20 minutes'
      )
    order by coalesce(adhan.started_at, adhan.broadcast_started_at, stream.started_at) desc nulls last
    limit 1
  ) live_state on true
  order by (live_state.stream_id is not null) desc, st_distance(mosque.geog, params.point)
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
end;
$$;

revoke all on function public.nearby_mosque_context_v1(double precision, double precision, double precision, integer) from public;
grant execute on function public.nearby_mosque_context_v1(double precision, double precision, double precision, integer) to anon, authenticated, service_role;

comment on table public.push_devices is
  'Per-installation Expo push tokens. Staging and production variants are strictly separated.';
comment on table public.notification_preferences is
  'Independent listener, muezzin-duty, and travel notification choices.';
comment on table public.notification_events is
  'Durable asynchronous notification event outbox; never performs network I/O in source transactions.';
comment on table public.travel_notification_regions is
  'Optional coarse current-area subscription with a maximum 24-hour lifetime; not a location history.';
