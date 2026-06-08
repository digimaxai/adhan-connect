-- Public listener discovery needs mosque coordinates to sort nearby results.
-- These are mosque/location fields, not stream credential columns.
grant select (lat, lng) on public.mosques to anon, authenticated;
