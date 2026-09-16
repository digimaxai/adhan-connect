-- Services persist across intakes. Enrolment and payment remain with the mosque.
alter table public.campaigns add column if not exists donation_url text;
alter table public.campaigns add constraint campaigns_donation_url_https
  check (donation_url is null or (length(donation_url) <= 2048 and donation_url ~ '^https://[^[:space:]]+$'));
grant select (donation_url) on public.campaigns to anon, authenticated;

create table public.mosque_service_listings (
 id uuid primary key default gen_random_uuid(),
 mosque_id uuid not null references public.mosques(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 160),
 category text not null default 'Education',
 kind text not null check (kind in ('course','drop_in','appointment')),
 description text not null default '',
 audience text not null default '',
 location text not null default '',
 schedule text not null default '',
 fee_text text not null default '',
 action_type text not null default 'phone' check (action_type in ('website','phone','email','whatsapp','drop_in')),
 action_value text not null default '',
 status text not null default 'draft' check (status in ('draft','published','archived')),
 review_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id, mosque_id),
 constraint service_action_valid check (
   (action_type = 'website' and action_value ~ '^https://[^[:space:]]+$') or
   (action_type in ('phone','whatsapp') and action_value ~ '^\+?[0-9 ()-]{7,25}$') or
   (action_type = 'email' and action_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
   (action_type = 'drop_in' and action_value = '') or
   (status <> 'published' and action_value = '')
 )
);
create table public.mosque_service_intakes (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null,
 mosque_id uuid not null,
 title text not null check (length(trim(title)) between 1 and 160),
 audience text not null default '',
 prerequisites text not null default '',
 start_date date,
 end_date date,
 schedule text not null default '',
 duration_text text not null default '',
 fee_text text not null default '',
 enrolment text not null default 'contact' check (enrolment in ('open','waitlist','closed','contact')),
 enrolment_closes_on date,
 state text not null default 'upcoming' check (state in ('upcoming','running','completed','cancelled')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 foreign key(service_id, mosque_id) references public.mosque_service_listings(id, mosque_id) on delete cascade,
 check (end_date is null or start_date is null or end_date >= start_date)
);
create index on public.mosque_service_listings(mosque_id, status);
create index on public.mosque_service_intakes(service_id, start_date);
alter table public.mosque_service_listings enable row level security;
alter table public.mosque_service_intakes enable row level security;
grant select on public.mosque_service_listings, public.mosque_service_intakes to anon, authenticated;
grant insert, update, delete on public.mosque_service_listings, public.mosque_service_intakes to authenticated;
create policy services_read on public.mosque_service_listings for select to anon, authenticated
 using (status = 'published' or public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
create policy services_admin on public.mosque_service_listings for all to authenticated
 using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
 with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
create policy intakes_read on public.mosque_service_intakes for select to anon, authenticated
 using (exists (select 1 from public.mosque_service_listings s where s.id = service_id and s.status = 'published')
 or public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
create policy intakes_admin on public.mosque_service_intakes for all to authenticated
 using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
 with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));

alter table public.content_attachments drop constraint content_attachments_content_type_check;
alter table public.content_attachments add constraint content_attachments_content_type_check
 check (content_type in ('event','campaign','announcement','service'));
-- Validate new service attachment ownership; the existing bucket remains for public flyers only.
create function public.check_service_attachment_parent() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.content_type = 'service' and not exists (
   select 1 from public.mosque_service_listings where id = new.content_id and mosque_id = new.mosque_id
 ) then raise exception 'Service attachment must belong to the selected mosque'; end if;
 return new;
end $$;
create trigger service_attachment_parent before insert or update on public.content_attachments
 for each row execute function public.check_service_attachment_parent();

-- Notices can point to the enduring service instead of duplicating its details.
alter table public.announcements add column related_service_id uuid references public.mosque_service_listings(id) on delete set null;
grant select (related_service_id) on public.announcements to anon, authenticated;
create function public.check_notice_service_parent() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.related_service_id is not null and not exists (
   select 1 from public.mosque_service_listings where id = new.related_service_id and mosque_id = new.mosque_id
 ) then raise exception 'Linked service must belong to this mosque'; end if;
 return new;
end $$;
create trigger notice_service_parent before insert or update on public.announcements
 for each row execute function public.check_notice_service_parent();
