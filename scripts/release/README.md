# Production-promotion backup tools

The active plan is now [in-place promotion](../../docs/backend/in-place-production-promotion-review-2026-09-22.md).
The backup scripts below still use the historical environment map. Reconcile
their project guards when roles change. The migration-copy reset/verification
SQL is historical rehearsal tooling and MUST NOT run against the retained
`zhrucqghrqkjyzmupdyy` production candidate.

These scripts create read-only Supabase database and Storage exports before the
staging-to-production beta promotion. They do not restore, reset, deploy, link,
or mutate either cloud project.

Run them only from a checkout whose dependencies are installed, because
`eas env:exec` resolves the Expo project before injecting environment values.
Always write to a new private directory outside the Git repository. A completed
export manifest deliberately prevents reuse of the same directory.

```bash
python3 scripts/release/backup-database.py staging \
  --destination /private/backup/root/staging/database
python3 scripts/release/backup-database.py production \
  --destination /private/backup/root/production/database

python3 scripts/release/run-storage-backup.py preview \
  --destination /private/backup/root/staging/storage
python3 scripts/release/run-storage-backup.py production \
  --destination /private/backup/root/production/storage
```

The database export includes Auth records and password hashes and must be
treated as sensitive. The Storage manifest contains private object paths and
metadata. Do not commit, upload, print, or send these files. Keep directory
permissions at `0700` and file permissions at `0600`.

Database and Storage checksums prove file integrity. They do not prove
recoverability. Rehearse both the staging-source restore and the existing
production rollback restore in an isolated target before approving cutover.
The final cutover also requires a fresh quiesced snapshot because each CLI
export is taken in its own database transaction.

The recovery backup intentionally retains all source records. The eventual
promotion manifest must separately decide which transient rows to reset, such
as active Auth sessions, refresh tokens, pending notification deliveries,
device registrations, active stream markers, and scheduled jobs. Do not modify
the recovery copy to create the migration copy.

After restoring into a separate disposable migration database, prepare and
verify the production copy with explicit target guards:

```bash
psql "$MIGRATION_DATABASE_URL" \
  --set=release_reset_token=PREPARE_ADHAN_CONNECT_PRODUCTION_COPY \
  --set=target_project_ref=yecbsezhwvpdkuzmmziv \
  --file scripts/release/prepare-production-migration-copy.sql
psql "$MIGRATION_DATABASE_URL" \
  --file scripts/release/verify-production-migration-copy.sql
```

The preparation is intentionally fail closed: it invalidates imported Auth
sessions/tokens, clears staging push/runtime state, ends snapshot-time live
markers, disables mosque-assistant automation, rotates and quarantines the push
dispatcher, and unschedules known outbound jobs. It preserves Auth users,
password hashes, identities, roles, mosque/prayer/rota data, notification
preferences, content, and offline stream configuration. Do not import
`cron-data.sql` into production; configure production jobs separately after
the app and hosted services pass acceptance checks.
