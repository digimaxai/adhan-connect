-- Listeners must not see the aggregate Jumu'ah attendee count or crowd level;
-- only their own attendance plan. Aggregate totals remain available to
-- admins only, via get_mosque_engagement (which reads the base table
-- directly and is unaffected by this migration).
--
-- This also moves capacity enforcement server-side: the previous client-side
-- check compared against a locally cached count and could be bypassed by any
-- direct table write.

create function public.get_jumuah_attendance(p_mosque_id uuid, p_friday_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare mine public.jumuah_attendance_intents;
begin
  if auth.uid() is null then
    return jsonb_build_object('slot_id', null, 'party_size', 0);
  end if;
  select * into mine from public.jumuah_attendance_intents
    where mosque_id = p_mosque_id and user_id = auth.uid() and friday_date = p_friday_date;
  return jsonb_build_object('slot_id', mine.slot_id, 'party_size', coalesce(mine.party_size, 0));
end $$;

create function public.set_jumuah_attendance(p_mosque_id uuid, p_slot_id uuid, p_friday_date date, p_party_size integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare slot public.mosque_jumuah_slots; attendees integer; previous integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_party_size is null or p_party_size < 0 or p_party_size > 8 then raise exception 'Invalid party size'; end if;

  if p_party_size = 0 then
    delete from public.jumuah_attendance_intents
      where mosque_id = p_mosque_id and user_id = auth.uid() and friday_date = p_friday_date;
    return jsonb_build_object('slot_id', null, 'party_size', 0);
  end if;

  select * into slot from public.mosque_jumuah_slots
    where id = p_slot_id and mosque_id = p_mosque_id and is_active for update;
  if not found then raise exception 'This Jumuah slot is not available'; end if;

  select coalesce(sum(party_size), 0)::integer into attendees
    from public.jumuah_attendance_intents where slot_id = slot.id and friday_date = p_friday_date;
  select party_size into previous from public.jumuah_attendance_intents
    where mosque_id = p_mosque_id and user_id = auth.uid() and friday_date = p_friday_date;
  if slot.capacity is not null and attendees - coalesce(previous, 0) + p_party_size > slot.capacity then
    raise exception 'This time is full. Please choose another Jumuah time.';
  end if;

  insert into public.jumuah_attendance_intents(mosque_id, slot_id, user_id, friday_date, party_size)
    values (p_mosque_id, slot.id, auth.uid(), p_friday_date, p_party_size)
    on conflict (mosque_id, user_id, friday_date)
    do update set slot_id = excluded.slot_id, party_size = excluded.party_size, updated_at = now();
  return jsonb_build_object('slot_id', slot.id, 'party_size', p_party_size);
end $$;

revoke all on function public.get_jumuah_attendance(uuid, date) from public;
revoke all on function public.set_jumuah_attendance(uuid, uuid, date, integer) from public;
grant execute on function public.get_jumuah_attendance(uuid, date) to anon, authenticated;
grant execute on function public.set_jumuah_attendance(uuid, uuid, date, integer) to authenticated;

-- Lock down the previously public aggregate view and direct table writes.
revoke select on public.jumuah_slot_attendance_summary from anon, authenticated;
revoke all on public.jumuah_attendance_intents from public, anon, authenticated;
grant select on public.jumuah_attendance_intents to authenticated;
