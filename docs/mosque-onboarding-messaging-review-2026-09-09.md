# Mosque onboarding and messaging review — 2026-09-09

Reviewed the three forms and their hub/entry points, main-admin request surfaces, messaging routes/screens/client helpers, notification handlers, database migrations and account export integration. Applied the fixes below in the workspace and all three migrations to staging (`zhrucqghrqkjyzmupdyy`). The reviewed application code was subsequently deployed to EAS preview; see the release follow-up below. Changes remain uncommitted.

## Findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Message UPDATE policies permitted changes to body, sender, mosque and participant fields; RLS scoped rows but did not restrict changed columns. | Revoked client writes and replaced them with authenticated, narrowly scoped read/delete/archive RPC operations. Direct sends are service-role-only. |
| High | Listener queries and mutations filtered only by mosque. A user who also administers that mosque could see or modify other listeners' threads through combined RLS policies. | Listener SELECT explicitly filters by listener ID; listener action RPCs derive the ID from `auth.uid()`, ignoring supplied participant IDs. |
| High | Count-then-insert rate limiting was non-atomic and ignored count query errors. | One database function serializes each pair with a transaction advisory lock, checks the rolling window and inserts atomically. Soft deletion does not reset the limit. |
| High | Notification endpoint accepted arbitrary content rather than proving a request existed; interpolated fields allowed HTML injection. | Client sends saved request ID; server verifies ownership and a recent timestamp, reads content from the database, escapes HTML, and supplies a per-request Resend idempotency key. Stable email timestamp supports retries. |
| Medium | Admin API could initiate unsolicited threads with arbitrary users; malformed/null payloads could cause server errors. | UUID/object validation; admin membership enforced in both API and database; replies require an existing listener-initiated thread. Database lookup failures fail closed. |
| Medium | Background notification fetch could be discarded when serverless execution ended. | Message handler awaits bounded email delivery, catches failures, and preserves successful message sends. Removed the misleading link to the unrelated mosque-request queue. |
| Medium | Supabase row limits could omit old conversations, history and unread counts. | Database aggregates inbox rows before pagination; client paginates inbox and thread queries with stable ordering. |
| Medium | Read operations could mark messages that arrived after the screen fetched its content. | Only message IDs actually fetched are marked read. |
| Medium | Loading without a selected mosque never settled; failures appeared as empty inboxes or successful deletes/archives. Web `Alert.alert` confirmations did not work. | Loading settles, errors are visible, failed mutations preserve the screen, web uses confirmation, and thread refresh is available without leaving the screen. |
| Medium | Old asynchronous results could populate another route/account's state. | Focus fetches are versioned/cancelled; send results are scoped to the current account/thread. |
| Medium | Hub content overflowed small screens, self-registration dropped the search name, role chips had poor interaction semantics, and hidden headers left no explicit back control. | Scrollable hub, explicit back actions, name prefill and accessible Pressable role controls. Mosque messaging entry waits for a resolved mosque UUID. |
| Medium | Main-admin self-registration display omitted phone details by slicing contact fields. | Shows all supplied contact details. |
| Medium | Account export omitted new mosque requests and message records. | Added paginated export sections, including retained soft-deleted records and redaction of other users' identifiers. Existing foreign-key cascades cover account deletion. |

## Staging migration status

Applied together in one transaction, recorded with SQL in migration history:

1. `20260909000000_mosque_add_requests_admin_self`
2. `20260909001000_mosque_messages`
3. `20260909002000_harden_mosque_messaging`

The third migration preserves the original migrations and overrides their unsafe write policies. Client SELECT remains RLS-controlled; mutation functions have fixed search paths and explicit EXECUTE grants. A new listener message reopens an archived conversation through its unarchived row; earlier archive/delete flags retain their original semantics.

Application deployment must include the updated API/client code together: sending now calls `send_mosque_message`, actions call `update_mosque_message_thread`, and inbox aggregation uses `mosque_message_conversations`.

## Verification

- `npx tsc --noEmit` and `npm run lint` pass.
- `node scripts/mosque-messaging/test-api.cjs`: malformed requests, authentication, identity spoofing, database failures, RPC error mapping, fail-open email failure, request ownership, HTML escaping and notification idempotency.
- `node scripts/mosque-messaging/test-client.cjs`: pagination, explicit listener scope for dual-role users, read-ID selection and delete/archive error propagation.
- `python3 scripts/mosque-messaging/staging-review.py verify`: actual staging roles, denied writes and function grants, self-registration, listener isolation, authorized/unauthorized replies, rate limits, delete/read/archive/reopen behavior, and dual-role mutation isolation. All fixture changes roll back.
- `python3 scripts/mosque-messaging/test-concurrency.py`: eight simultaneous staging database sends produced exactly five successes and three rate-limit rejections. Uniquely tagged fixture messages were removed afterward. This test bypasses the email API.
- Migration rehearsal passed before application; post-commit verification passed independently.

The staging scripts are pinned to the staging project and use the existing local Supabase token without printing it. They do not send emails. The apply command runs the fixture tests under a savepoint and rolls the fixtures back before committing the schema and migration history.

## Outstanding release checks

- Notification recipient, verified sender and staging admin URL have not been supplied (`MOSQUE_REQUEST_NOTIFY_EMAIL`, `MOSQUE_REQUEST_NOTIFY_FROM`, `MOSQUE_REQUEST_ADMIN_URL`). A clarification is pending. Server environment configuration and real email delivery remain unverified. Configure these on the Expo API server deployment; setting Supabase function secrets alone does not configure Expo routes.
- The browser runtime reported no available browser connection, so visual and interactive browser/device flows remain unverified. Source changes and type checks do not substitute for this check.
- No application deployment, production database changes, commits, or external email sends were performed. Test the updated listener/admin clients against the updated API before release.
- Notifications remain best-effort, without a durable retry worker; account export uses its existing 10,000-row section limit and reports truncation. Focus refresh plus manual thread refresh is asynchronous, not Realtime.

Database design references: PostgreSQL explains the scope of [row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) and [transaction advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS). Authorization and concurrency behavior above were also tested on staging.

## Release follow-up — staging build 27

- User supplied test recipient `digimaxartstudio@gmail.com` and sender `Adhan Connect <hello@maksums.com>`.
- Configured the preview-only EAS variables for recipient, sender, review URL (`https://adhan-connect--preview.expo.app/admin/mosque-requests`) and, after explicit user approval, the existing Resend key with sensitive visibility. Production settings were not modified.
- Exported with `EXPO_NO_DOTENV=1` and EAS preview variables. Client-export secret scan and operator-token exclusion passed.
- Deployed staging web/API `cebz37pz49`; preview alias points to `https://adhan-connect--preview.expo.app`. Alias propagation initially returned old routes, then resolved correctly.
- Hosted staging smoke passed: self-registration database insert, missing-auth guards, malformed message rejection, listener send, RLS read and soft delete. Temporary test account and associated records were removed. Database rollback-only verification passed again.
- Existing live/staff/rota authentication regression checks passed on the preview alias without starting broadcasts or mutating production.
- Email configuration is **blocked**: Resend returned HTTP 403, “This API key is not authorized to send emails from maksums.com.” The hosted notification handler returned 502 accordingly. The key is send-only, so domain listing is unavailable. An authorized replacement key or alternative sender is pending from the user. Message saving still succeeded when email delivery failed. No successful test email delivery has been established.
- Requested iOS preview build 27: `66efbebb-d774-47e8-b503-004de6533607`, staging identifier `com.maksumsdigitalagency.adhanconnect.staging`. Status: **FINISHED**, completed 2026-09-09 at 21:04 UTC. Downloaded IPA verified as build 27 with the staging bundle identifier, onboarding/messaging code markers, and no configured server credentials embedded. Install: https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/66efbebb-d774-47e8-b503-004de6533607.
- The browser runtime again listed no available browser connections; visual and physical-device acceptance remain unverified.

Staging Auth currently uses `noreply@mail.adhanconnect.com` as its SMTP sender. This was inspected read-only as a possible notification-sender alternative; no sender change was made. The user-selected `hello@maksums.com` remains configured pending an authorized key or permission to use another sender.

## Notification sender resolved — 2026-09-09

The user approved the temporary sender `Adhan Connect <noreply@mail.adhanconnect.com>`. Updated `.env.local`, `.env.local.staging`, and the preview-only EAS sender variable. Exported and deployed staging `sxskvbxtlr` to the existing preview alias; no native rebuild or production change was needed.

The hosted preview self-registration notification returned HTTP 200 with `sent: true`: Resend accepted the message to `digimaxartstudio@gmail.com`, resolving the previous sender-authorization rejection. The messaging send/read/delete and authentication checks also passed. The temporary test account and its request/message records were removed. Gmail inbox placement is not directly observable with the send-only Resend key; the message API's fail-open response does not independently prove delivery of its own alert.

Build 27 remains the current verified iOS staging artifact. The earlier email blocker is resolved with this approved temporary sender; visual and physical-device acceptance are still outstanding.
