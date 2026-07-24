# Adhan Connect personal-data map

Status: engineering inventory for implementation and legal review.  
Last reviewed: 2026-07-24.

This document is not a statement that every listed processing activity is
lawful or approved for production. It records data that the current code can
collect, derive, transmit, or store so the privacy notice, retention schedule,
store declarations, deletion, and data export can be checked against reality.

## Controller and scope decisions still required

- Maksums Limited operates authentication, the consumer app, and the shared
  platform.
- Each participating mosque can determine the purposes of staff, rota,
  attendance-capacity, content, and broadcast records. Obtain legal advice on
  whether the mosque is an independent controller, joint controller, or a
  customer for whom Maksums acts as processor for each activity.
- Following a mosque, recording Jumu'ah attendance intentions, or assigning a
  mosque role can reveal or strongly imply religious belief. Confirm an Article
  6 basis and an Article 9 condition. The implemented account-creation design
  asks for explicit, unbundled special-category consent and records a version;
  legal review must confirm whether that is the correct basis for each feature.
- Accounts are gated to age 16+. The limited guest experience remains the
  intended path for younger users. Complete a Children’s Code/DPIA screening
  before changing that decision.

## Data inventory

| Category | Examples | Source | Used for | Current/possible recipients | Deletion/export treatment |
| --- | --- | --- | --- | --- | --- |
| Authentication | Auth UUID, email, provider identity, verification state, account timestamps, AMR | User; Supabase Auth; Apple/Google if selected | Sign-in, recovery, security, role attachment | Supabase; authentication provider; email provider | Export safe identity metadata, never hashes/tokens. Revoke identities/sessions and delete Auth user only after impact/storage checks. |
| Public profile | Display/full name, email, phone, country, home city, global role | User; invite; administrator | Display, support, global access | Supabase; authorised app/admin surfaces | Export own row. Delete or de-identify. Global role must never be trusted from user-editable metadata. |
| Policy receipts | Terms/privacy versions, explicit-consent version/time/source, age confirmation | User at account creation | Contract/privacy evidence and consent lifecycle | Supabase Auth metadata; durable receipt table when migration is applied | Export receipt. Retain only as required to evidence the relationship or lawful action; document final period. |
| Mosque follows/subscriptions | User ID, mosque ID, subscription/provider references, dates/status | User; billing/provider where enabled | Followed mosques and subscription features | Supabase; payment provider if enabled | Export user-facing fields. Do not expose secret/provider identifiers unnecessarily. Delete personal association. |
| Location | Latitude/longitude, permission state, request time, inferred proximity | Device foreground permission | Nearby mosques, prayer calculation, live access | EAS-hosted API; Supabase-backed access logic; Aladhan; routine infrastructure logs | Do not persist unless a feature requires it. New live-access clients send it in POST bodies. Avoid coordinates in URLs/logs. Explain provider/log expiry. |
| Prayer/mosque preference | Default mosque, cached schedules, calculation settings, local preferences | User/device; mosque; external timetable services | Prayer display and app personalisation | Device storage; Supabase; Aladhan/London Prayer Times as applicable | Include server records where personal. Clear user-keyed device state on sign-out/deletion. |
| Attendance intention | User, mosque, Friday/slot, party size, timestamps | User | Capacity indication | Supabase; authorised mosque administrators | Treat as potentially special-category data. Export own row; delete personal association. |
| Mosque roles | Global main admin; local-admin/muezzin memberships; active/default status; inviter | Admin/invite; platform | Authorisation and workspace routing | Supabase; authorised staff | Export memberships. Preflight sole/default roles. Remove membership without erasing institutional history. |
| Rota and cover | Dates, prayer, assignments, staff/muezzin IDs, notes, reasons, volunteer/resolver, timestamps | Mosque admin; muezzin | Staff scheduling and cover | Supabase; relevant mosque staff | Export records describing the user, redacting other people/reasons as needed. Reassign/null/de-identify future and historic attribution according to approved matrix. |
| Notifications | Recipient, actor, mosque, title/body/type, metadata, read time | App/admin actions | In-app coordination | Supabase; recipient | Export recipient records after metadata redaction. Delete personal inbox; de-identify retained audit attribution. |
| Mosque content and audit | Events, campaigns, announcements, reflections, schedule imports, onboarding events, creator/updater IDs | Authorised staff | Public content and operational audit | Supabase; app users; authorised staff | Mosque-owned content need not be copied wholesale, but export personal attribution/actions. Null or pseudonymise attribution where history is retained. |
| Broadcast control/audio | User/mosque IDs, room name, start/end, provider state; microphone audio; connection diagnostics | Muezzin/device; provider | Live Adhan delivery | LiveKit; Supabase/EAS; mosque-configured Icecast/AzuraCast/RTMP/external provider | End/revoke active access before deletion. Export personal control history, not secrets/stream keys. Confirm whether any provider records audio and its retention. |
| Storage | Owner ID, bucket/object path, file metadata and content | User/admin | Uploaded schedules/media/content | Supabase Storage; authorised app surfaces | Enumerate ownership before Auth deletion; export owned personal files where applicable; delete through Storage API, not direct SQL. |
| Security/diagnostics | IP, device/app, request time, route/status, auth/security/audit events | Device and infrastructure | Abuse prevention, troubleshooting, compliance evidence | Supabase, EAS, LiveKit, Vercel and other infrastructure | Never include tokens or precise coordinates in application logs. Define provider-specific periods and access restrictions. Formal DSAR may require manual provider-log search. |
| Support/web forms | Name, email, message/request, IP/form metadata | User | Support, privacy/deletion request, project enquiry | Web3Forms; Vercel; Maksums staff | Respond, verify identity proportionately, and retain by documented request/business-record criteria. |
| On-device state | Protected Supabase session; role-entry and mosque preferences; cached schedules; export temp files | App/user | Persistence and UX | Device; OS protected storage/share target | Clear user-keyed state on sign-out/deletion. Store native session in protected chunked storage. Write exports to cache and remove them after sharing. |

## Current provider review

The names below come from current code/configuration. Contractual role, hosting
region, subprocessor list, transfer safeguard, logging, and deletion/backup
behaviour must be confirmed in the provider account or agreement before the
privacy notice is approved.

- Supabase: Auth, Postgres, Realtime, Storage and email integration.
- Expo/EAS: native builds and production server routes.
- LiveKit Cloud and mosque-configured external/Icecast/AzuraCast/RTMP services.
- Aladhan prayer-time API and London Prayer Times source.
- Apple and Google authentication (code present; providers not enabled as of
  2026-07-24).
- Vercel: `maksums.com`.
- Web3Forms: website contact and external deletion-request forms.
- Google Fonts: public website font delivery.

## Retention work

The privacy notice currently gives retention criteria rather than invented
periods. Before release, approve a schedule covering at least:

- active account/profile and policy receipts;
- follows, attendance intentions, notifications and device state;
- rota, cover, mosque content and operational attribution;
- broadcast control and any recorded/diagnostic audio data;
- security/access/audit logs in Supabase, EAS, LiveKit and Vercel;
- support, invite, privacy, export and deletion correspondence;
- Storage objects, logical/physical backups, disaster recovery and legal holds.

## Consent enforcement state

- The client blocks role/profile loading and personalised route mounting until
  the current Auth metadata is present.
- Hosted authenticated feature APIs require both the exact current metadata and
  an active exact-version `account_consents` receipt.
- Consent withdrawal durably marks the active receipt withdrawn, clears the
  current special-category metadata, and attempts global refresh-session
  revocation before the client clears its local session.
- Signed playback URLs already issued before withdrawal can start a new proxy
  request only until their short expiry. Expiry does not necessarily interrupt
  a stream that was already open, so immediate termination remains a
  provider/hosting control to approve before claiming it.
- Direct Supabase/PostgREST access is not considered release-ready until every
  relevant production RLS `USING` and `WITH CHECK` path invokes
  `has_current_account_consent_v1(auth.uid())` or an equivalently reviewed
  predicate. The read-only audit reports this evidence per table.

## Export boundaries

The in-app export is a portable app-data package, not a replacement for every
Article 15 response. It must:

- derive the user solely from a validated bearer token;
- use explicit columns and filters despite service-role RLS bypass;
- paginate deterministically;
- cover every role a user has and every attribution field listed above;
- redact other users, stream secrets, credentials, provider tokens, private
  mosque content and security-only fields;
- include schema version, generation time, record counts and known omissions;
- identify Supabase Storage as a deliberate automated-export omission until
  per-bucket ownership and third-party content rules are audited, and direct
  users to the privacy request channel for owned personal files;
- direct users to the manual privacy channel for provider logs, backups, legal
  correspondence and other data that cannot safely be self-served.

## Deletion boundaries

Account deletion must remain fail-closed until `scripts/account-data-audit.sql`
has been run against production and its results translated into a versioned
migration/delete-retain matrix. A deletion operation must:

1. verify the bearer token and recent interactive authentication;
2. create a fresh impact report and require acknowledgement of that report;
3. block or resolve sole global/local admin, default muezzin, future rota, open
   cover, active broadcast and other business-continuity cases;
4. delete owned Storage objects through the Storage API;
5. delete, null, reassign or de-identify each relation according to its approved
   classification;
6. revoke sessions/provider grants as supported and delete the Auth user;
7. verify postconditions and clear all user-keyed local state;
8. remain retryable and auditable without logging tokens or exported data.
