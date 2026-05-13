-- Restrict live_stream credential columns from public/authenticated reads.
-- Before this migration, the "public_read_active_mosques" policy granted all
-- columns (including secrets) to anon and authenticated. We revoke the
-- table-level privilege and re-grant only columns that listener/admin UIs
-- need client-side. Server APIs use service_role and are unaffected.

revoke select on public.mosques from anon, authenticated;

grant select (
  id,
  name,
  slug,
  status,
  city,
  country,
  timezone,
  address,
  website,
  phone,
  jumuah1_time,
  jumuah2_time,
  allow_multi_mosque_local_admins,
  live_stream_enabled,
  created_at
) on public.mosques to anon, authenticated;
