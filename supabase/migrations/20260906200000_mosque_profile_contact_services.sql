-- Mosque public profile: contact details, about text, key staff info, and services offered.
-- address_line1, address_line2, postcode already exist from the genesis schema.

alter table public.mosques
  add column if not exists phone     text,
  add column if not exists email     text,
  add column if not exists website   text,
  add column if not exists imam_info text,
  add column if not exists services  text[];

-- Grant public read access consistent with the existing column-level grants on mosques.
grant select(phone)     on table public.mosques to anon;
grant select(phone)     on table public.mosques to authenticated;
grant select(email)     on table public.mosques to anon;
grant select(email)     on table public.mosques to authenticated;
grant select(website)   on table public.mosques to anon;
grant select(website)   on table public.mosques to authenticated;
grant select(imam_info) on table public.mosques to anon;
grant select(imam_info) on table public.mosques to authenticated;
grant select(services)  on table public.mosques to anon;
grant select(services)  on table public.mosques to authenticated;
