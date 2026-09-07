# Mosque assistant compatibility review

Checked 6 September 2026. **Remote activation remains paused.** Neither assistant migration has been applied to staging or production, and no scanning worker or live extraction was started.

## Findings addressed before activation

- Assistant approval preserves the configured mosque timezone. A proposed mismatch requires correction through the existing workspace and a fresh scan.
- Approval shares the existing broadcast per-mosque serialization and rejects an active stream or live adhan.
- Conflicting cached rota timestamps block approval. Assignments, cover requests, memberships and default muezzins are preserved.
- Changed beginning times near now, or with existing reminder events for that prayer/date, block approval so generated reminders are not silently made inconsistent.
- An atomic snapshot comparison prevents a concurrent manual timetable edit from being overwritten. The earlier whole-table prayer write lock was removed.
- Beginning times crossing the UTC calendar date are rejected because the current broadcast lookup uses UTC dates. This constrains assistant publication in some timezones; it does not change the existing broadcast implementation.
- New user references use ON DELETE SET NULL to avoid adding account deletion blockers.

Approval briefly locks the mosque row and takes a shared lock on the rota table. It fails immediately if either is busy. Rota writes and broadcast operations arriving after acquisition can wait until approval finishes. This is a remaining performance consideration for staging; it is not a claim of zero locking impact. Normal migration DDL also needs table locks.

## Evidence

A schema-only export of the linked staging database supplied actual operational definitions. No staging application rows were copied. A disposable local PostgreSQL 17 database loaded 16 selected tables, the original broadcast/reminder functions, their dependencies, policies and triggers. Auth identity was stubbed, the unused geography field represented as text, and external network dispatch omitted.

The entire fixture and both migrations were rerun from scratch successfully:

- Before/after comparisons preserved 126 existing function, policy and trigger definitions, existing operational rows, and the four selected Realtime publication memberships.
- Assigned, default and approved-cover muezzins retained broadcast start/end behavior and retry idempotency. Unassigned users were rejected.
- Listener and duty reminder generation, assignment selection and live notification outbox generation passed.
- Scanning did not publish. Approved future schedules fed canonical reminder times without changing rota, memberships or stream settings.
- Rota conflicts, existing reminders, active broadcasts, imminent changes, timezone mismatches and UTC-date mismatches were rejected. Manual edits and import audit snapshots remained supported.
- A controlled concurrent manual update completed while assistant approval was paused after initial validation. Approval then aborted, preserving the newer manual time and review draft.
- Anonymous canonical timetable reads remained available under the fixture policies.
- The separate minimal SQL suite passed queue/lease, approval, timezone/DST, stale edit, audit and automatic scheduling checks.
- All 10 JavaScript assistant tests, TypeScript compilation and targeted ESLint passed.
- Existing notification safety contracts passed. Local HTTP checks passed five existing pages, nine unauthenticated API guards, and invalid playback/nearby-live request checks.

## Reproducing the database checks

Use only empty disposable databases. Never run fixture or test SQL against staging or production.

1. Run `build-compatibility-fixture.py <schema-only-dump> <output.sql>` from the repository root.
2. Load that output and `compatibility-before.sql` with `psql -v ON_ERROR_STOP=1`.
3. Load `20260905170000_mosque_data_assistant.sql`, then `20260906100000_mosque_assistant_automation.sql`.
4. Load `compatibility-after.sql`.
5. Run `concurrency.py <disposable-database-name>`. It requires a name beginning `assistant_compatibility` and local PostgreSQL on `/tmp`, port 55439. It deletes only its synthetic test mosque/month jobs and target date before exercising the race.

The scripts are in `scripts/mosque-assistant/tests/`. The separate minimal suite uses `schema.sql`, the two migrations, `publish.sql`, then `automation.sql`.

## Remaining rollout validation

These checks establish database and source compatibility within the tested scope, not end-to-end media reliability. Signed-in staging owner review/publication, timetable rollback UI, real muezzin/listener sessions, actual audio transport, push delivery and visual browser QA remain to be exercised. Realtime membership was checked; event delivery was not. Live website/PDF extraction also needs a configured provider key.

A pre-existing staging constraint allows adhan source values live/recording while the broadcast RPC can request test; test-mode broadcasting was not exercised or changed in this audit. The tested broadcast transitions used the normal live mode entirely inside the disposable database.

Proceed with a controlled staging migration and one representative mosque only after these results are reviewed, before enabling directory-wide scanning or production rollout.
