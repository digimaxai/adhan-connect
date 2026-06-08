-- Content management support for the local-admin content hub.
-- Adds lifecycle/visibility columns, creates announcements when missing,
-- and grants local-admin write access for client-side admin forms.

-- Events --------------------------------------------------------------------

alter table public.events
  add column if not exists status text not null default 'published',
  add column if not exists is_public boolean not null default true,
  add column if not exists location text;

alter table public.events
  drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
    check (status in ('draft', 'published', 'cancelled'));

comment on column public.events.status is
  'Lifecycle state: draft (hidden), published (visible to followers), cancelled.';
comment on column public.events.is_public is
  'When false the event is hidden from the mosque follower page even if published.';
comment on column public.events.location is
  'Optional venue or room label for public event details.';

-- Campaigns -----------------------------------------------------------------

do $$
begin
  alter type public.campaign_status add value if not exists 'paused' after 'active';
exception
  when undefined_object then
    null;
end $$;

alter table public.campaigns
  add column if not exists status text not null default 'active';

alter table public.campaigns
  alter column status set default 'active';

alter table public.campaigns
  drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
    check (status::text in ('active', 'paused', 'ended'));

comment on column public.campaigns.status is
  'Lifecycle state: active (accepting donations), paused, ended (closed).';

-- Announcements -------------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  title text not null,
  summary text,
  created_by uuid references public.users(id) on delete set null,
  status text not null default 'published',
  is_urgent boolean not null default false,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_status_check check (status in ('draft', 'published'))
);

create index if not exists idx_announcements_mosque_created
  on public.announcements(mosque_id, created_at desc);
create index if not exists idx_announcements_mosque_pinned
  on public.announcements(mosque_id, is_pinned desc, created_at desc);

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

comment on column public.announcements.status is
  'Visibility state: draft (hidden from followers), published (visible).';
comment on column public.announcements.is_urgent is
  'When true the notice is highlighted in red on the mosque page.';
comment on column public.announcements.is_pinned is
  'When true the notice is always shown at the top of the announcements list.';

-- Grants and RLS ------------------------------------------------------------

alter table public.announcements enable row level security;

grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant select (status, is_public) on public.events to authenticated, anon;
grant select (status) on public.campaigns to authenticated, anon;
grant select (status, is_urgent, is_pinned) on public.announcements to authenticated, anon;

drop policy if exists "local_admin_insert_events" on public.events;
create policy "local_admin_insert_events"
on public.events
for insert
to authenticated
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_update_events" on public.events;
create policy "local_admin_update_events"
on public.events
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_delete_events" on public.events;
create policy "local_admin_delete_events"
on public.events
for delete
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_insert_campaigns" on public.campaigns;
create policy "local_admin_insert_campaigns"
on public.campaigns
for insert
to authenticated
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_update_campaigns" on public.campaigns;
create policy "local_admin_update_campaigns"
on public.campaigns
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_delete_campaigns" on public.campaigns;
create policy "local_admin_delete_campaigns"
on public.campaigns
for delete
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "announcements_select_all" on public.announcements;
create policy "announcements_select_all"
on public.announcements
for select
to public
using (true);

drop policy if exists "local_admin_insert_announcements" on public.announcements;
create policy "local_admin_insert_announcements"
on public.announcements
for insert
to authenticated
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_update_announcements" on public.announcements;
create policy "local_admin_update_announcements"
on public.announcements
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_delete_announcements" on public.announcements;
create policy "local_admin_delete_announcements"
on public.announcements
for delete
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
