-- Align muezzin duty reminders with the assignment resolution already used by
-- the muezzin schedule and LIVE authorization paths:
--   1. active approved/provisional cover
--   2. explicit rota assignee (including the legacy staff_user_id column)
--   3. active mosque default muezzin when no explicit rota row exists
--
-- This function only inserts into the notification outbox. It does not touch
-- LIVE Adhan, stream, rota, assignment, subscription, or timetable state.

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
  -- Listener reminder behaviour is intentionally unchanged.
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

  with prayer_occurrences as (
    select
      pt.mosque_id,
      pt.date as duty_date,
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
  ),
  rota_slots as (
    select distinct on (
      rota.mosque_id,
      coalesce(rota.date, rota.duty_date),
      lower(coalesce(nullif(trim(rota.prayer_name::text), ''), nullif(trim(rota.prayer::text), '')))
    )
      rota.id,
      rota.mosque_id,
      coalesce(rota.date, rota.duty_date) as duty_date,
      lower(coalesce(nullif(trim(rota.prayer_name::text), ''), nullif(trim(rota.prayer::text), ''))) as prayer,
      coalesce(rota.muezzin_user_id, rota.staff_user_id) as explicit_user_id,
      rota.adhan_time
    from public.staff_rota rota
    where coalesce(rota.date, rota.duty_date)
            between (p_now - interval '1 day')::date and (p_now + interval '2 days')::date
      and lower(coalesce(nullif(trim(rota.prayer_name::text), ''), nullif(trim(rota.prayer::text), '')))
            in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')
    order by
      rota.mosque_id,
      coalesce(rota.date, rota.duty_date),
      lower(coalesce(nullif(trim(rota.prayer_name::text), ''), nullif(trim(rota.prayer::text), ''))),
      rota.id desc
  ),
  duty_slots as (
    select
      coalesce(occurrence.mosque_id, rota.mosque_id) as mosque_id,
      coalesce(occurrence.duty_date, rota.duty_date) as duty_date,
      coalesce(occurrence.prayer, rota.prayer) as prayer,
      coalesce(rota.adhan_time, occurrence.scheduled_at) as scheduled_at,
      rota.id as rota_id,
      rota.explicit_user_id
    from prayer_occurrences occurrence
    full outer join rota_slots rota
      on rota.mosque_id = occurrence.mosque_id
     and rota.duty_date = occurrence.duty_date
     and rota.prayer = occurrence.prayer
    where coalesce(rota.adhan_time, occurrence.scheduled_at) is not null
  ),
  assignment_candidates as (
    select
      slot.*,
      mosque.name as mosque_name,
      mosque.time_zone,
      cover.id as cover_id,
      case
        when cover.volunteer_user_id is not null then cover.volunteer_user_id
        when slot.rota_id is not null then slot.explicit_user_id
        when default_assignment.user_id is not null then default_assignment.user_id
        else null
      end as assigned_user_id,
      case
        when cover.volunteer_user_id is not null then 'cover'
        when slot.rota_id is not null then 'rota'
        when default_assignment.user_id is not null then 'default'
        else null
      end as assignment_source
    from duty_slots slot
    join public.mosques mosque on mosque.id = slot.mosque_id
    left join lateral (
      select request.id, request.volunteer_user_id
      from public.muezzin_cover_requests request
      where request.mosque_id = slot.mosque_id
        and request.date = slot.duty_date
        and lower(request.prayer_name) = slot.prayer
        and request.volunteer_user_id is not null
        and request.status in ('provisional_cover', 'approved')
      order by
        case when request.status = 'approved' then 0 else 1 end,
        request.updated_at desc,
        request.id desc
      limit 1
    ) cover on true
    left join public.muezzins default_assignment
      on slot.rota_id is null
     and default_assignment.mosque_id = slot.mosque_id
     and default_assignment.user_id = mosque.default_muezzin_user_id
     and default_assignment.is_active = true
  ),
  active_duties as (
    select candidate.*
    from assignment_candidates candidate
    join public.muezzins active_assignment
      on active_assignment.mosque_id = candidate.mosque_id
     and active_assignment.user_id = candidate.assigned_user_id
     and active_assignment.is_active = true
    where candidate.assigned_user_id is not null
      and candidate.assignment_source is not null
  )
  insert into public.notification_events (
    event_key, kind, user_id, mosque_id, prayer, scheduled_for, title, body, data
  )
  select
    'muezzin_duty:' ||
      case
        when duty.cover_id is not null then 'cover:' || duty.cover_id::text
        when duty.rota_id is not null then duty.rota_id::text
        else 'default:' || duty.mosque_id::text || ':' || duty.duty_date::text || ':' || duty.prayer || ':' || duty.assigned_user_id::text
      end || ':' || lead.minutes::text,
    'muezzin_duty',
    duty.assigned_user_id,
    duty.mosque_id,
    duty.prayer,
    duty.scheduled_at - make_interval(mins => lead.minutes),
    'Your ' || initcap(duty.prayer) || ' duty starts' ||
      case when lead.minutes > 0 then ' in ' || lead.minutes::text || ' min' else ' now' end,
    duty.mosque_name || ' · Open your broadcast check.',
    jsonb_strip_nulls(jsonb_build_object(
      'screen', 'muezzin_broadcast',
      'mosqueId', duty.mosque_id,
      'rotaId', duty.rota_id,
      'coverId', duty.cover_id,
      'assignmentSource', duty.assignment_source,
      'prayer', duty.prayer,
      'scheduledAt', duty.scheduled_at
    ))
  from active_duties duty
  join public.notification_preferences pref
    on pref.user_id = duty.assigned_user_id
   and pref.muezzin_duty_reminders_enabled
  cross join lateral unnest(pref.muezzin_lead_minutes) as lead(minutes)
  where duty.scheduled_at - make_interval(mins => lead.minutes)
          between p_now - interval '30 seconds' and p_now + interval '90 seconds'
  on conflict (event_key) do nothing;

  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;
  return v_inserted;
end;
$$;

revoke all on function public.enqueue_due_adhan_reminders_v1(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_due_adhan_reminders_v1(timestamptz) to service_role;

comment on function public.enqueue_due_adhan_reminders_v1(timestamptz) is
  'Queues listener and muezzin reminders; muezzin assignment precedence is cover, explicit rota, then active default.';
