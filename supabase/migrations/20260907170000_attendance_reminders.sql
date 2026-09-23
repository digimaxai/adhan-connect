-- Admin-triggered attendance reminders for events and Jumu'ah slots. Local
-- admins decide when (and if) to nudge attendees to confirm or cancel their
-- plan, rather than an automatic time-based blast. Reuses the existing
-- notification_events outbox and push-dispatch pipeline.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notification_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table public.notification_events drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.notification_events add constraint notification_events_kind_check
  check (kind in ('live_adhan', 'listener_upcoming', 'muezzin_duty', 'assignment_update', 'attendance_reminder'));

create function public.send_event_attendance_reminder(p_event_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare e public.events; v_count integer := 0; r record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into e from public.events where id = p_event_id;
  if not found then raise exception 'Event not found'; end if;
  if not coalesce(public.is_main_admin() or public.is_local_admin_for_mosque(e.mosque_id), false) then
    raise exception 'Mosque admin access required';
  end if;
  if e.start_at <= now() then raise exception 'This event has already started'; end if;

  for r in
    select user_id from public.event_engagement where event_id = e.id and party_size > 0
  loop
    insert into public.notification_events (
      event_key, kind, user_id, mosque_id, scheduled_for, title, body, data
    ) values (
      'attendance_reminder:event:' || e.id::text || ':' || r.user_id::text || ':' || current_date::text,
      'attendance_reminder',
      r.user_id,
      e.mosque_id,
      now(),
      'Still coming to ' || e.title || '?',
      'Please confirm you are still attending, or cancel your plan to free up space for others.',
      jsonb_build_object('screen', 'event', 'eventId', e.id)
    )
    on conflict (event_key) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

create function public.send_jumuah_attendance_reminder(p_mosque_id uuid, p_slot_id uuid, p_friday_date date)
returns integer language plpgsql security definer set search_path = public as $$
declare slot public.mosque_jumuah_slots; v_count integer := 0; r record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_friday_date is null or extract(isodow from p_friday_date) <> 5 then raise exception 'Friday date required'; end if;
  select * into slot from public.mosque_jumuah_slots where id = p_slot_id and mosque_id = p_mosque_id;
  if not found then raise exception 'Jumuah slot not found'; end if;
  if not coalesce(public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id), false) then
    raise exception 'Mosque admin access required';
  end if;

  for r in
    select user_id from public.jumuah_attendance_intents
    where slot_id = slot.id and friday_date = p_friday_date and party_size > 0
  loop
    insert into public.notification_events (
      event_key, kind, user_id, mosque_id, scheduled_for, title, body, data
    ) values (
      'attendance_reminder:jumuah:' || slot.id::text || ':' || p_friday_date::text || ':' || r.user_id::text || ':' || current_date::text,
      'attendance_reminder',
      r.user_id,
      p_mosque_id,
      now(),
      'Still coming to Jumu''ah?',
      coalesce(slot.label, 'Jumu''ah') || ' at ' || to_char(slot.salah_at, 'HH24:MI') || ' — please confirm or cancel your attendance plan.',
      jsonb_build_object('screen', 'jumuah', 'mosqueId', p_mosque_id, 'slotId', slot.id)
    )
    on conflict (event_key) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function public.send_event_attendance_reminder(uuid) from public;
revoke all on function public.send_jumuah_attendance_reminder(uuid, uuid, date) from public;
grant execute on function public.send_event_attendance_reminder(uuid) to authenticated;
grant execute on function public.send_jumuah_attendance_reminder(uuid, uuid, date) to authenticated;
