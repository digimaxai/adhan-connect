-- Local-admin content attachments (cover image + documents) for events,
-- campaigns, and announcements.
--
-- Safety boundary:
--   * This migration does not touch LIVE/stream/rota/assignment tables or
--     functions in any way.
--   * `mosque_id` is denormalized onto the attachment row so RLS can reuse
--     the existing public.is_main_admin()/public.is_local_admin_for_mosque()
--     helpers exactly as the events/campaigns/announcements policies already
--     do (see 20260516090000_content_management_columns.sql).

create table if not exists public.content_attachments (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  content_type text not null check (content_type in ('event', 'campaign', 'announcement')),
  content_id uuid not null,
  kind text not null check (kind in ('image', 'document')),
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  sort_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_attachments_parent
  on public.content_attachments(content_type, content_id, sort_order);
create index if not exists idx_content_attachments_mosque
  on public.content_attachments(mosque_id);

comment on table public.content_attachments is
  'Cover images and document attachments for the local-admin content hub (events, campaigns, announcements). Public flyer-style media only; not a substitute for user-owned Storage.';

alter table public.content_attachments enable row level security;

grant select on public.content_attachments to anon, authenticated;
grant insert, update, delete on public.content_attachments to authenticated;

drop policy if exists "content_attachments_select_all" on public.content_attachments;
create policy "content_attachments_select_all"
on public.content_attachments
for select
to public
using (true);

drop policy if exists "local_admin_insert_content_attachments" on public.content_attachments;
create policy "local_admin_insert_content_attachments"
on public.content_attachments
for insert
to authenticated
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_update_content_attachments" on public.content_attachments;
create policy "local_admin_update_content_attachments"
on public.content_attachments
for update
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

drop policy if exists "local_admin_delete_content_attachments" on public.content_attachments;
create policy "local_admin_delete_content_attachments"
on public.content_attachments
for delete
to authenticated
using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

-- Storage --------------------------------------------------------------------
-- Public bucket: these are meant-to-be-public event/campaign/notice flyers,
-- the same visibility level as the announcement/event text they belong to.

insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

drop policy if exists "content_media_select_all" on storage.objects;
create policy "content_media_select_all"
on storage.objects
for select
to public
using (bucket_id = 'content-media');

-- Object path convention: {mosque_id}/{content_type}/{content_id}/{filename}
-- so ownership can be checked directly from the path without a join.

drop policy if exists "content_media_admin_insert" on storage.objects;
create policy "content_media_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'content-media'
  and (
    public.is_main_admin()
    or public.is_local_admin_for_mosque(((storage.foldername(name))[1])::uuid)
  )
);

drop policy if exists "content_media_admin_update" on storage.objects;
create policy "content_media_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'content-media'
  and (
    public.is_main_admin()
    or public.is_local_admin_for_mosque(((storage.foldername(name))[1])::uuid)
  )
)
with check (
  bucket_id = 'content-media'
  and (
    public.is_main_admin()
    or public.is_local_admin_for_mosque(((storage.foldername(name))[1])::uuid)
  )
);

drop policy if exists "content_media_admin_delete" on storage.objects;
create policy "content_media_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'content-media'
  and (
    public.is_main_admin()
    or public.is_local_admin_for_mosque(((storage.foldername(name))[1])::uuid)
  )
);
