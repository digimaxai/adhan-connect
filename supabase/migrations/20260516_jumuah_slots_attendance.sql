-- Structured Jumu'ah slots and soft attendance intent.
-- This keeps Friday capacity planning separate from daily prayer times.

create table if not exists public.mosque_jumuah_slots (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  label text not null default 'Jumu''ah',
  khutbah_at time,
  salah_at time not null,
  venue text,
  language text,
  imam text,
  capacity integer check (capacity is null or capacity > 0),
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mosque_jumuah_slots_mosque_order
  on public.mosque_jumuah_slots(mosque_id, is_active desc, sort_order, salah_at);

drop trigger if exists set_mosque_jumuah_slots_updated_at on public.mosque_jumuah_slots;
create trigger set_mosque_jumuah_slots_updated_at
before update on public.mosque_jumuah_slots
for each row execute function public.set_updated_at();

create table if not exists public.jumuah_attendance_intents (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  slot_id uuid not null references public.mosque_jumuah_slots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  friday_date date not null,
  party_size integer not null default 1 check (party_size between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jumuah_attendance_intents_mosque_user_friday_unique
    unique (mosque_id, user_id, friday_date)
);

create index if not exists idx_jumuah_attendance_slot_date
  on public.jumuah_attendance_intents(slot_id, friday_date);
create index if not exists idx_jumuah_attendance_user_date
  on public.jumuah_attendance_intents(user_id, friday_date);

drop trigger if exists set_jumuah_attendance_intents_updated_at on public.jumuah_attendance_intents;
create trigger set_jumuah_attendance_intents_updated_at
before update on public.jumuah_attendance_intents
for each row execute function public.set_updated_at();

create or replace view public.jumuah_slot_attendance_summary as
select
  slot_id,
  mosque_id,
  friday_date,
  coalesce(sum(party_size), 0)::integer as attendee_count,
  count(*)::integer as household_count
from public.jumuah_attendance_intents
group by slot_id, mosque_id, friday_date;

alter table public.mosque_jumuah_slots enable row level security;
alter table public.jumuah_attendance_intents enable row level security;

grant select on public.mosque_jumuah_slots to anon, authenticated;
grant insert, update, delete on public.mosque_jumuah_slots to authenticated;
grant select on public.jumuah_slot_attendance_summary to anon, authenticated;
grant select, insert, update, delete on public.jumuah_attendance_intents to authenticated;

drop policy if exists "jumuah_slots_select_all" on public.mosque_jumuah_slots;
create policy "jumuah_slots_select_all"
on public.mosque_jumuah_slots
for select
to public
using (true);

drop policy if exists "local_admin_insert_jumuah_slots" on public.mosque_jumuah_slots;
create policy "local_admin_insert_jumuah_slots"
on public.mosque_jumuah_slots
for insert
to authenticated
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_update_jumuah_slots" on public.mosque_jumuah_slots;
create policy "local_admin_update_jumuah_slots"
on public.mosque_jumuah_slots
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_delete_jumuah_slots" on public.mosque_jumuah_slots;
create policy "local_admin_delete_jumuah_slots"
on public.mosque_jumuah_slots
for delete
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "users_select_own_jumuah_intents" on public.jumuah_attendance_intents;
create policy "users_select_own_jumuah_intents"
on public.jumuah_attendance_intents
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
);

drop policy if exists "users_insert_own_jumuah_intents" on public.jumuah_attendance_intents;
create policy "users_insert_own_jumuah_intents"
on public.jumuah_attendance_intents
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users_update_own_jumuah_intents" on public.jumuah_attendance_intents;
create policy "users_update_own_jumuah_intents"
on public.jumuah_attendance_intents
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users_delete_own_jumuah_intents" on public.jumuah_attendance_intents;
create policy "users_delete_own_jumuah_intents"
on public.jumuah_attendance_intents
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
);

comment on table public.mosque_jumuah_slots is
  'Recurring Friday Jumu''ah prayer slots for a mosque, with optional capacity guidance.';
comment on table public.jumuah_attendance_intents is
  'Soft attendance intent for a specific Friday. This is planning guidance, not a reserved seat.';
