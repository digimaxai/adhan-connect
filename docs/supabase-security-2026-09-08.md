# Supabase security remediation — 2026-09-08

## Completed on production and staging

Both original findings are resolved. Fresh Supabase security-advisor checks
returned no `security_definer_view` or `rls_disabled_in_public` findings on either
project. No support ticket is needed for these findings.

| Project | Reference | Geographic columns preserved | Full rows compared |
| --- | --- | --- | --- |
| Production | `yecbsezhwvpdkuzmmziv` | 2 | 1,114 |
| Staging | `zhrucqghrqkjyzmupdyy` | 3 | 1,117 |

These results concern the two reported finding types, not a complete security audit.

## Attendance summary

Applied and recorded `20260908190000_secure_jumuah_attendance_summary` on both
projects. The view uses `security_invoker=true`, and PUBLIC, anon and authenticated
have no access. Existing service-role reporting access remains.

Actual SELECT attempts under both client roles fail with insufficient_privilege.
Older clients requesting this private aggregate receive a permission error.

## PostGIS relocation

Applied and recorded `20260908200000_move_postgis_to_private_gis` on both projects.
PostGIS 3.3.7 now lives in the `gis` schema, which is not exposed by the Data API.
Client roles have neither USAGE nor CREATE on that schema; server-side geographic
queries retain access. `public.spatial_ref_sys` no longer exists.

The migration was rehearsed in rollback-only transactions on both projects,
then committed on staging, verified, and committed on production. Each commit
included its own data and behavior assertions. It:

- Locks affected tables before taking full-row comparison snapshots.
- Temporarily converts geography columns to their lossless hexadecimal text form.
- Uses `DROP EXTENSION ... RESTRICT`, never CASCADE, so unknown dependencies abort.
- Reinstalls the same PostGIS version and restores geography types and indexes.
- Qualifies the audited search and notification functions with `gis` while
  preserving function identities, owners and grants.
- Requires exact full-row and all 8,500 reference-definition comparisons to pass.
- Verifies table RLS/grants and column nullability/grants/comments are preserved.
- Records the migration history in the same transaction.

Rollback-only rehearsals also exposed permission differences between production
and staging. The tests respect those existing differences; the migration does
not grant production guests additional access.

## Verification

- London, Glasgow and searches without coordinates returned identical results
  before and after relocation within each transaction.
- Staging's nearby search, travel-region setter and notification materialization
  executed successfully. Test writes were rolled back in a subtransaction;
  notification delivery was not invoked.
- Fresh-connection checks passed for authenticated mosque search, coordinate
  transformation from SRID 4326 to 3857, and denied direct access to GIS and
  attendance aggregates for both client roles.
- Both REST APIs return 404 for the old public spatial table and 406 when the
  private `gis` schema is explicitly requested. Public mosque ID reads return 200.
- Staging's anonymous search returns 200. Production's anonymous search remains
  denied as before; authenticated search passed in the database.
- Production API verification used its current publishable key. The legacy anon
  key was disabled on June 28, before this migration.
- Supabase advisors confirm both original finding types are clear on both projects.

Reusable SQL checks are in `scripts/security/`. The baseline and behavior scripts
are intended to surround the migration inside the same transaction; the
`verify-postgis-private-schema.sql` script is a standalone read-only postcheck.
Full mobile UI flows and push delivery were not exercised.

Protected local snapshots of geographic values, staging travel-region data,
reference definitions and the original function definitions were saved under
`/tmp/adhan-security-audit/` (directory mode 0700). These are temporary local
recovery artifacts, not permanent off-machine backups. No application rows were
removed. A failed rehearsal or precommit assertion rolls back the entire change.

## Future database changes

Use `gis.geography`, `gis.geometry` and qualified `gis.st_*` calls for new live
migrations. Keep `gis` out of exposed API schemas and do not grant client roles
schema access. Do not move the reference table back into public.

Production still has an older feature-migration history than staging. Some
unapplied historical notification migrations explicitly reference
`public.geography` and unqualified `st_*` calls. Before deploying that backlog,
prepare a schema-aware version of those migrations; do not blindly run them
against the relocated production database. Historical migrations remain unchanged
so a fresh database can still apply them before the relocation migration.

The September 7 attendance privacy RPCs were present on staging but absent on
production during this audit. This security work did not deploy those unrelated
feature migrations.
