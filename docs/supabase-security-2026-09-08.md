# Supabase security remediation — 2026-09-08

## Verified live results

Projects: production `yecbsezhwvpdkuzmmziv`, staging `zhrucqghrqkjyzmupdyy`.

Applied migration `20260908190000_secure_jumuah_attendance_summary` to both
projects in transactions and recorded it in their migration histories.
The view now uses `security_invoker=true`, with all privileges revoked from
PUBLIC, anon and authenticated. Existing service_role access remains.

Verified actual SELECT attempts under anon and authenticated fail with
insufficient_privilege on both projects. Service-role summary queries succeed.
A PostGIS transformation from SRID 4326 to 3857 also succeeds on both.
Supabase security advisor reruns no longer report security_definer_view.

Staging already had the September 7 attendance privacy migration. Production
did not, and does not yet have get_jumuah_attendance, set_jumuah_attendance or
get_mosque_engagement. This targeted security fix does not deploy those unrelated
feature migrations. Older clients requesting the aggregate view will now receive
a permission error rather than public attendance totals. Full client flows were
not tested as part of this database permission change.

## Outstanding: spatial_ref_sys

Both projects run PostgreSQL 17.6 with PostGIS 3.3.7 in public.
public.spatial_ref_sys is owned by supabase_admin. anon and authenticated have
SELECT, INSERT, UPDATE, DELETE and TRUNCATE privileges; RLS is disabled.
These permissions are still present. No spatial reference data was modified.

A transactionally rolled-back REVOKE attempt as postgres left anon UPDATE
permission intact. postgres has no UPDATE grant option. A rollback-only attempt
to enable RLS returned SQLSTATE 42501, "must be owner of table spatial_ref_sys".
The advisor still reports rls_disabled_in_public on this table in both projects.
No privileged-role bypass or extension relocation was attempted.

## Support request ready to submit

Subject: Public PostGIS table writable by API roles; owner-only fix needed on two projects

Please urgently harden public.spatial_ref_sys on these projects:

- Production: yecbsezhwvpdkuzmmziv
- Staging: zhrucqghrqkjyzmupdyy

The Security Advisor reports rls_disabled_in_public. Live catalog checks confirm
anon and authenticated have INSERT, UPDATE, DELETE and TRUNCATE privileges,
as well as SELECT. The table is owned by supabase_admin (PostGIS 3.3.7,
PostgreSQL 17.6). Our postgres role cannot enable RLS (42501: must be owner)
and cannot effectively revoke the owner-issued grants.

Please use the owning role to remove public/client write privileges and enable
RLS with a read-only policy, retaining reference reads and service-role access.
Please verify effective privileges for anon and authenticated afterward and
rerun the security advisor. Please avoid removing PostGIS or its data.

Proposed SQL for Supabase to review and execute as the table owner:

```sql
begin;
revoke all privileges on public.spatial_ref_sys from public, anon, authenticated;
grant select on public.spatial_ref_sys to anon, authenticated;
alter table public.spatial_ref_sys enable row level security;
drop policy if exists spatial_ref_sys_public_read_only on public.spatial_ref_sys;
create policy spatial_ref_sys_public_read_only
  on public.spatial_ref_sys for select to public using (true);
commit;
```

Please also inspect existing policies for unintended write access. No evidence
of past misuse was established by this audit; it assessed current permissions.

This request has been prepared locally and has not been sent.
