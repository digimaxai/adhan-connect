-- Local-admin muezzin operations, in-app notifications, and cover-request workflow.
-- Additive and idempotent: extends mosque-scoped operations without broadening system-wide account control.

create or replace function public.is_local_admin_for_mosque(target_mosque_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mosque_admins ma
    where ma.user_id = auth.uid()
      and ma.mosque_id = target_mosque_id
  );
$$;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mosque_id uuid references public.mosques(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_user_created
  on public.app_notifications(user_id, created_at desc);

create index if not exists idx_app_notifications_user_read
  on public.app_notifications(user_id, read_at);

create table if not exists public.muezzin_cover_requests (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  date date not null,
  prayer_name text not null check (prayer_name in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  original_muezzin_user_id uuid not null references auth.users(id) on delete cascade,
  volunteer_user_id uuid references auth.users(id) on delete set null,
  request_kind text not null default 'release' check (request_kind in ('release', 'cover')),
  urgency text not null default 'standard' check (urgency in ('standard', 'urgent')),
  status text not null default 'open' check (status in ('open', 'volunteered', 'provisional_cover', 'approved', 'dismissed', 'cancelled')),
  reason text,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_muezzin_cover_requests_mosque_date
  on public.muezzin_cover_requests(mosque_id, date, prayer_name);

create index if not exists idx_muezzin_cover_requests_requester
  on public.muezzin_cover_requests(requester_user_id, created_at desc);

create index if not exists idx_muezzin_cover_requests_status
  on public.muezzin_cover_requests(status, urgency, created_at desc);

create unique index if not exists uq_muezzin_cover_requests_active_slot_requester
  on public.muezzin_cover_requests(mosque_id, date, prayer_name, requester_user_id)
  where status in ('open', 'volunteered', 'provisional_cover');

alter table public.muezzins enable row level security;
alter table public.mosque_admins enable row level security;
alter table public.app_notifications enable row level security;
alter table public.muezzin_cover_requests enable row level security;

drop policy if exists "local_admin_select_muezzins" on public.muezzins;
create policy "local_admin_select_muezzins"
on public.muezzins
for select
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_insert_muezzins" on public.muezzins;
create policy "local_admin_insert_muezzins"
on public.muezzins
for insert
to authenticated
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_update_muezzins" on public.muezzins;
create policy "local_admin_update_muezzins"
on public.muezzins
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_delete_muezzins" on public.muezzins;
create policy "local_admin_delete_muezzins"
on public.muezzins
for delete
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "recipient_select_app_notifications" on public.app_notifications;
create policy "recipient_select_app_notifications"
on public.app_notifications
for select
to authenticated
using (
  public.is_main_admin()
  or user_id = auth.uid()
  or (mosque_id is not null and public.is_local_admin_for_mosque(mosque_id))
);

drop policy if exists "recipient_update_app_notifications" on public.app_notifications;
create policy "recipient_update_app_notifications"
on public.app_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "local_admin_insert_app_notifications" on public.app_notifications;
create policy "local_admin_insert_app_notifications"
on public.app_notifications
for insert
to authenticated
with check (
  public.is_main_admin()
  or (mosque_id is not null and public.is_local_admin_for_mosque(mosque_id))
);

drop policy if exists "muezzin_insert_app_notifications" on public.app_notifications;
create policy "muezzin_insert_app_notifications"
on public.app_notifications
for insert
to authenticated
with check (
  user_id <> auth.uid()
  and mosque_id is not null
  and exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = app_notifications.mosque_id
      and coalesce(m.is_active, true)
  )
);

drop policy if exists "main_admin_delete_app_notifications" on public.app_notifications;
create policy "main_admin_delete_app_notifications"
on public.app_notifications
for delete
to authenticated
using (public.is_main_admin());

drop policy if exists "muezzin_select_same_mosque_admins" on public.mosque_admins;
create policy "muezzin_select_same_mosque_admins"
on public.mosque_admins
for select
to authenticated
using (
  public.is_main_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = mosque_admins.mosque_id
      and coalesce(m.is_active, true)
  )
);

drop policy if exists "local_admin_select_cover_requests" on public.muezzin_cover_requests;
create policy "local_admin_select_cover_requests"
on public.muezzin_cover_requests
for select
to authenticated
using (
  public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
  or requester_user_id = auth.uid()
  or volunteer_user_id = auth.uid()
  or exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = muezzin_cover_requests.mosque_id
      and coalesce(m.is_active, true)
  )
);

drop policy if exists "muezzin_insert_cover_requests" on public.muezzin_cover_requests;
create policy "muezzin_insert_cover_requests"
on public.muezzin_cover_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and original_muezzin_user_id = auth.uid()
  and exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = muezzin_cover_requests.mosque_id
      and coalesce(m.is_active, true)
  )
);

drop policy if exists "local_admin_update_cover_requests" on public.muezzin_cover_requests;
create policy "local_admin_update_cover_requests"
on public.muezzin_cover_requests
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "requester_cancel_cover_requests" on public.muezzin_cover_requests;
create policy "requester_cancel_cover_requests"
on public.muezzin_cover_requests
for update
to authenticated
using (
  requester_user_id = auth.uid()
  and status in ('open', 'volunteered', 'provisional_cover')
)
with check (
  requester_user_id = auth.uid()
  and status = 'cancelled'
);

drop policy if exists "peer_volunteer_cover_requests" on public.muezzin_cover_requests;
create policy "peer_volunteer_cover_requests"
on public.muezzin_cover_requests
for update
to authenticated
using (
  status = 'open'
  and requester_user_id <> auth.uid()
  and exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = muezzin_cover_requests.mosque_id
      and coalesce(m.is_active, true)
  )
)
with check (
  volunteer_user_id = auth.uid()
  and status in ('volunteered', 'provisional_cover')
);
