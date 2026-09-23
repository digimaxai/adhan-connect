-- Listeners must not see the aggregate attendee count for an event; only
-- their own party size, like and favourite state. Aggregate totals remain
-- available to admins only, via get_mosque_engagement.
create or replace function public.get_event_engagement(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; mine public.event_engagement;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.status::text <> 'published' or e.is_public is not true then
    raise exception 'Event unavailable';
  end if;
  select * into mine from public.event_engagement where event_id = e.id and user_id = auth.uid();
  return jsonb_build_object('party_size', coalesce(mine.party_size, 0),
    'liked', coalesce(mine.liked, false), 'favourited', coalesce(mine.favourited, false));
end $$;
