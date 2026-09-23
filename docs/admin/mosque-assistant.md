# Mosque Data & Timetable Assistant

Owner portal: `/admin/mosque-assistant`, linked from the dashboard and sidebar.

## Activation

Activation remains paused pending a controlled staging rollout. See the [compatibility review](mosque-assistant-compatibility-review.md) for completed checks and remaining validation.

1. Apply `supabase/migrations/20260905170000_mosque_data_assistant.sql` followed by `supabase/migrations/20260906100000_mosque_assistant_automation.sql` through the normal migration process. It adds the scan queue and public mosque contact/service fields. It does not scan or publish any mosque data.
2. Deploy the Expo server routes with the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` configuration. A static-only web export cannot serve this add-on's API.
3. Run the worker on a persistent Node 22.18+ host with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, and `OPENAI_API_KEY`. These are server-only secrets, never `EXPO_PUBLIC_` values. `MOSQUE_ASSISTANT_MODEL` defaults to `gpt-4.1`; use a model supporting web search, structured outputs, PDF and image input. `MOSQUE_ASSISTANT_WORKER_ID` can identify each worker instance.

```sh
# Provide secrets through the host's environment or a protected local env file.
node --env-file=.env.local scripts/mosque-assistant-worker.mjs
# Process at most one job, useful for a controlled first scan:
node --env-file=.env.local scripts/mosque-assistant-worker.mjs --once
```

The worker uses OpenAI for web search and extraction; mosque identity details and fetched public documents are sent to that provider. No user accounts, database keys or mosque streaming credentials enter extraction prompts. Calls use `store: false`. Provider usage incurs charges; scan one representative mosque before selecting the entire directory. Keep a provider project budget appropriate to the directory size.

## Owner workflow

Automatic discovery is enabled by default. Once the configured worker starts, it inspects the database every five minutes and automatically queues up to 100 due mosque/month combinations per check. New mosques need no manual selection or website entry. Completed/dismissed/cancelled scans are revisited after seven days; failed scans retry after one day. Pending reviews are preserved. A review for an older month does not block a newer month. From the 20th (UTC), the worker searches both current and next month. Multiple workers coordinate scheduling with a database lock.

Every completed extraction is automatically mapped, validated and converted in the worker. Each timetable variant has its own stored conversion/CSV or explicit conversion errors. Extracted profile fields and a single unambiguous timetable are preselected in a prepared review. Multiple variants remain separate for owner selection. No admin-page visit is needed to trigger conversion. Owner identity confirmation and publication approval remain explicit.

The owner can pause new automatic scheduling in the workspace; already queued jobs continue. Automatic jobs are marked separately and attributed to a deterministic existing main-admin account. If none exists, the scheduler reports an error. Scheduling state persists across worker restarts.

For an optional immediate rescan, choose a month and one, several or all mosques. For one mosque, an explicit HTTPS website can override automatic discovery. Repeated scan requests skip mosques already queued, processing or awaiting review. Workers process jobs independently of the browser; the workspace refreshes every 15 seconds and reports worker availability.

Review the candidate website against the mosque name/address. Select individual profile fields, edit proposed values, and inspect source URLs and evidence. Website, address, phone, email, management and services publish to `mosques`. Management and services are readable text in this first release; published details appear in the listener's mosque page under the mosque table's existing read policies.

Select a timetable variant. Map source columns to `date` and the five prayer beginning/iqama pairs. Source cells remain editable; rows can be removed or added. The canonical CSV preview uses the existing app import column names. Unsupported columns remain in the extraction record and are omitted from CSV/publication. The original remote source is linked; source excerpts, retrieval dates and SHA-256 hashes are retained. Full remote documents are not archived in this release.

Missing beginning times block publication. Empty iqama values do not erase existing iqama values. Dates outside the selected month's edited rows stay unchanged. Publication uses the mosque's configured IANA timezone, shown read-only, independently of the owner's computer timezone. It never changes `mosques.time_zone`; correct that through the existing mosque workspace and rescan if needed. Ambiguous/nonexistent times at daylight-saving transitions block publication for manual resolution. Confirm warnings and source identity before publishing. Draft edits can be saved without publishing.

Publication rejects active broadcasts, changed beginning times within the reminder/broadcast window (20 minutes before to 62 minutes after now), changes with existing reminder events, and conflicting cached rota times. It also rejects beginning times whose UTC date differs from the timetable date, because the existing broadcast path uses UTC dates. Resolve these through the existing scheduling workflow. No assignees, rota rows, stream settings or live functions are modified. Approval briefly takes the existing per-mosque row lock and a shared rota-table lock; it fails immediately if those locks are unavailable, but writes arriving after acquisition can wait for the transaction to finish.

Profile fields, canonical `prayer_times`, import headers and before/after prayer snapshots are written in one database transaction. A changed mosque profile or a changed target prayer date since enqueue blocks approval: dismiss and rescan to establish a fresh baseline. The scan record stores both extracted and owner-approved information. Prayer publication appears in the existing import history, whose prayer rollback action remains available. Profile changes have retained before/after evidence but no dedicated rollback button in this release.

## Execution and access

- Owner authorization is required at the API and again inside queue/publish database functions. Consent/session checks reuse the app's existing admin access helper.
- Queue and worker tables are inaccessible to `anon` and `authenticated`; only the server service role accesses them. RPC execute permissions are explicitly revoked from public clients.
- Jobs are claimed with `FOR UPDATE SKIP LOCKED`, a lease token, and a 15-minute lease renewed each minute. Dead workers can be reclaimed up to three attempts. Completion is conditional on the same token and running status, so a cancelled/reclaimed job cannot commit old results.
- Failed scans can be retried by queuing the mosque again. Review drafts must be dismissed before rescanning. Cancelling a running scan discards its result; an already-running provider call may finish and incur usage.
- HTTPS fetching uses checked IPv4 DNS answers pinned to each connection, rejects nonpublic ranges, validates redirects, checks robots rules, uses per-host pacing and a 20-second timeout, and limits each document to 4 MB. IPv6-only websites are currently unsupported.
- Up to six usable source documents and four timetable variants are extracted per job. Search/discovery/extraction output sizes are bounded. Search or retrieval failure produces a visible error or review warning.
- Web content never executes in the app and is treated as untrusted model input. Extraction tools have no database-write access. Fields/tables citing URLs outside fetched sources are discarded.

## Verification and remaining rollout checks

```sh
node --test scripts/test-mosque-assistant.mjs
npx tsc --noEmit
npx eslint lib/mosqueAssistant/core.ts lib/api/admin/mosqueAssistant.ts app/api/admin/mosque-assistant+api.ts app/admin/mosque-assistant/index.tsx
```

Database tests must run only in an **empty disposable PostgreSQL database**. Use `scripts/mosque-assistant/tests/schema.sql`, then both migrations in order, then `scripts/mosque-assistant/tests/publish.sql` and `scripts/mosque-assistant/tests/automation.sql`, with `psql -v ON_ERROR_STOP=1`. This minimal fixture is complemented by the schema-derived operational suite described in the compatibility review. A controlled staging rollout is still required before production.

Verified locally: automatic discovery/cadence, next-month scheduling with pending reviews, retry backoff, pause/resume, bounded batches, conversion without an admin visit, conversion/source validation, simulated HTML/PDF/image extraction, owner RPC authorization, private drafts, queue deduplication/claims, atomic publishing, retained iqama, BST/winter timestamps, repeated-clock rejection, stale edits, audit snapshots and lease recovery. The migration is not applied to a remote environment by this change. Live provider extraction needs a configured API key; no live scan has been performed during implementation. The in-app browser was unavailable, so visual and signed-in workflow QA remain rollout checks.

Search cannot guarantee every mosque has an accessible official site or current timetable. JavaScript-only sites, blocked crawling, oversized documents and unclear scans may require a website override or manual import. Automatic discovery and conversion run while the worker is online. Automatic publication is not enabled.

Integration references: [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [file inputs](https://developers.openai.com/api/docs/guides/file-inputs), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
