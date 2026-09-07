-- Event attendance plans and private reactions. Writes are serialized per event.
create table public.event_engagement (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  party_size integer not null default 0 check (party_size between 0 and 8),
  liked boolean not null default false,
  favourited boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_engagement enable row level security;
grant select on public.event_engagement to authenticated;
grant all on public.event_engagement to service_role;
create policy event_engagement_own_read on public.event_engagement
  for select to authenticated using (user_id = auth.uid());

create function public.get_event_engagement(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; mine public.event_engagement; attendees integer;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.status::text <> 'published' or e.is_public is not true then
    raise exception 'Event unavailable';
  end if;
  select * into mine from public.event_engagement where event_id = e.id and user_id = auth.uid();
  select coalesce(sum(party_size), 0)::integer into attendees from public.event_engagement where event_id = e.id;
  return jsonb_build_object('attendees', attendees, 'capacity', e.capacity,
    'party_size', coalesce(mine.party_size, 0), 'liked', coalesce(mine.liked, false),
    'favourited', coalesce(mine.favourited, false));
end $$;

create function public.set_event_engagement(p_event_id uuid, p_action text, p_value integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; attendees integer; previous integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_action is null or p_action not in ('attendance', 'like', 'favourite')
    or p_value is null or p_value < 0 or p_value > (case when p_action = 'attendance' then 8 else 1 end) then
    raise exception 'Invalid event response';
  end if;
  select * into e from public.events where id = p_event_id for update;
  if not found or e.status::text <> 'published' or e.is_public is not true then raise exception 'Event unavailable'; end if;
  if p_action = 'attendance' and p_value > 0 then
    if e.start_at <= now() then raise exception 'This event has already started'; end if;
    select coalesce(sum(party_size), 0)::integer into attendees from public.event_engagement where event_id = e.id;
    select party_size into previous from public.event_engagement where event_id = e.id and user_id = auth.uid();
    if e.capacity is not null and attendees - coalesce(previous, 0) + p_value > e.capacity then
      raise exception 'Not enough spaces left. Choose a smaller party size.';
    end if;
  end if;
  insert into public.event_engagement(event_id, user_id) values (e.id, auth.uid()) on conflict do nothing;
  update public.event_engagement set
    party_size = case when p_action = 'attendance' then p_value else party_size end,
    liked = case when p_action = 'like' then p_value = 1 else liked end,
    favourited = case when p_action = 'favourite' then p_value = 1 else favourited end,
    updated_at = now()
  where event_id = e.id and user_id = auth.uid();
  return public.get_event_engagement(e.id);
end $$;

create function public.get_mosque_engagement(p_mosque_id uuid, p_friday_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare event_rows jsonb; friday_rows jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id), false) then
    raise exception 'Mosque admin access required';
  end if;
  if p_friday_date is null or extract(isodow from p_friday_date) <> 5 then raise exception 'Friday date required'; end if;
  select coalesce(jsonb_agg(row_data order by start_at), '[]'::jsonb) into event_rows from (
    select e.start_at, jsonb_build_object('id', e.id, 'title', e.title, 'start_at', e.start_at,
      'capacity', e.capacity, 'attendees', coalesce(sum(g.party_size), 0),
      'parties', count(*) filter (where g.party_size > 0),
      'likes', count(*) filter (where g.liked), 'favourites', count(*) filter (where g.favourited)) row_data
    from public.events e left join public.event_engagement g on g.event_id = e.id
    where e.mosque_id = p_mosque_id and e.status::text = 'published' and e.is_public is true
      and e.start_at >= date_trunc('day', now())
    group by e.id
  ) q;
  select coalesce(jsonb_agg(row_data order by sort_order, salah_at), '[]'::jsonb) into friday_rows from (
    select s.sort_order, s.salah_at, jsonb_build_object('id', s.id, 'label', s.label, 'salah_at', s.salah_at,
      'venue', s.venue, 'capacity', s.capacity, 'attendees', coalesce(sum(i.party_size), 0),
      'parties', count(i.id)) row_data
    from public.mosque_jumuah_slots s left join public.jumuah_attendance_intents i
      on i.slot_id = s.id and i.mosque_id = s.mosque_id and i.friday_date = p_friday_date
    where s.mosque_id = p_mosque_id and s.is_active
    group by s.id
  ) q;
  return jsonb_build_object('events', event_rows, 'friday', friday_rows, 'friday_date', p_friday_date);
end $$;

revoke all on function public.get_event_engagement(uuid) from public;
revoke all on function public.set_event_engagement(uuid, text, integer) from public;
revoke all on function public.get_mosque_engagement(uuid, date) from public;
grant execute on function public.get_event_engagement(uuid) to anon, authenticated;
grant execute on function public.set_event_engagement(uuid, text, integer) to authenticated;
grant execute on function public.get_mosque_engagement(uuid, date) to authenticated;
comment on table public.event_engagement is 'Attendance plans, likes and private favourites. Attendance is planning information, not a ticket.';
