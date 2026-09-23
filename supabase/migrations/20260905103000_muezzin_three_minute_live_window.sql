-- Align Muezzin reminder actions with the established three-minute LIVE
-- broadcast window. Earlier reminders are preparation prompts and open My
-- Rota; the three-minute prompt opens the existing LIVE broadcast screen.
--
-- This migration is notification-only. It does not read or mutate LIVE Adhan,
-- stream, rota, assignment, mosque, timetable, or subscription state.

alter table public.notification_preferences
  drop constraint if exists notification_preferences_muezzin_leads_check;

alter table public.notification_preferences
  add constraint notification_preferences_muezzin_leads_check check (
    cardinality(muezzin_lead_minutes) > 0
    and muezzin_lead_minutes <@ array[3, 5, 10, 30]::integer[]
  );

create or replace function public.prepare_muezzin_duty_notification_v1()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_lead_text text;
  v_lead_minutes integer;
  v_mosque_label text;
begin
  if new.kind <> 'muezzin_duty' then
    return new;
  end if;

  v_lead_text := substring(new.event_key from ':([0-9]+)$');
  if v_lead_text is null then
    return new;
  end if;

  v_lead_minutes := v_lead_text::integer;
  v_mosque_label := nullif(split_part(coalesce(new.body, ''), ' · ', 1), '');
  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
    'leadMinutes', v_lead_minutes,
    'screen', case
      when v_lead_minutes <= 3 then 'muezzin_broadcast'
      else 'muezzin_rota'
    end
  );

  if v_lead_minutes <= 3 then
    new.title := initcap(coalesce(nullif(new.prayer, ''), 'Adhan')) || ' LIVE window is open';
    new.body := coalesce(v_mosque_label || ' · ', '') ||
      'Your broadcast window is open. Start when you are ready.';
  else
    new.body := coalesce(v_mosque_label || ' · ', '') ||
      'Review your assignment in My Rota.';
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_muezzin_duty_notification_v1
  on public.notification_events;

create trigger prepare_muezzin_duty_notification_v1
before insert or update of event_key, kind, prayer, body, data
on public.notification_events
for each row
execute function public.prepare_muezzin_duty_notification_v1();

-- Re-normalize any future event already queued before this migration. The
-- trigger changes only its notification copy and destination data.
update public.notification_events
set data = data
where kind = 'muezzin_duty'
  and scheduled_for >= now() - interval '5 minutes';

revoke all on function public.prepare_muezzin_duty_notification_v1() from public;

comment on function public.prepare_muezzin_duty_notification_v1() is
  'Routes early Muezzin reminders to My Rota and the 3-minute reminder to the existing LIVE broadcast screen.';
