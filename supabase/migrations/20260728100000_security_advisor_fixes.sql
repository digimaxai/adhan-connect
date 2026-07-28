-- Fixes the security_definer_view advisor finding (2026-07-28) on
-- public.jumuah_slot_attendance_summary. The view intentionally bypasses RLS
-- on jumuah_attendance_intents to expose an already-anonymized aggregate
-- (slot/mosque/date + summed party size + row count, no user identity) to
-- guests and other users, so it is not switched to security_invoker. Grants
-- are tightened from ALL to SELECT only, since the view is read-only in
-- practice.
--
-- NOTE: the companion rls_disabled_in_public finding on public.spatial_ref_sys
-- is NOT fixed here. That table is owned by `supabase_admin` (created by the
-- PostGIS extension), and the project's postgres role cannot ALTER an object
-- it doesn't own ("must be owner of table spatial_ref_sys", confirmed via a
-- direct attempt). Fixing it for real requires moving the postgis extension
-- to a dedicated non-public schema, which touches every existing
-- geography/geometry column and needs its own tested migration.
-- Written to be safely re-runnable (idempotent).

REVOKE ALL ON public.jumuah_slot_attendance_summary FROM anon, authenticated;
GRANT SELECT ON public.jumuah_slot_attendance_summary TO anon, authenticated;
