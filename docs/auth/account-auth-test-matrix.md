# Authentication and account-control test matrix

Last updated: 2026-07-24.

Use disposable accounts and a non-production environment first. Record the
build, platform, Supabase project, tester, time, result, request ID, and
supporting screenshot/log reference for every run. Never paste tokens,
passwords, recovery codes, precise location, or exported personal data into
the evidence.

## Email and recovery

| ID | Scenario | Expected result |
| --- | --- | --- |
| E1 | Create a new email/password account | One account is created; no authenticated features open before required verification; the pending screen offers guest mode, resend cooldown, email correction, and sign-in. |
| E2 | Attempt sign-up with an existing email | The response does not confirm whether the address exists. The user can return to sign-in or recovery. |
| E3 | Sign in with wrong password, unconfirmed email, and unknown email | Each failure uses neutral wording and does not disclose account state. Rate-limit and network messages remain actionable but neutral. |
| E4 | Confirm email on the same device | The PKCE callback is consumed once, the same Auth UUID is retained, and routing continues through consent/workspace selection. |
| E5 | Open expired/reused confirmation and recovery links | No existing session is accepted as proof; a neutral expired/invalid result is shown. |
| E6 | Request recovery, then open it cold and warm on iOS, Android, and web | Only a verified recovery callback enables the password form. The one-use proof cannot be replayed. |
| E7 | Open a recovery link on a different device | The documented same-device PKCE limitation is shown/handled; no ordinary session becomes recovery authorisation. |
| E8 | Open an invite/password-setup link | The verified invite credential can set a password once and retains the invited Auth UUID and all assigned roles. |
| E9 | Sign out while online and while the auth service is unreachable | The current device loses its stored session in both cases. Other-device refresh-token revocation is not falsely claimed for local sign-out. |

## Consent lifecycle

| ID | Scenario | Expected result |
| --- | --- | --- |
| C1 | Sign in with a legacy/invited/social account missing a current receipt | No personalised route, role lookup, or account-feature API opens before the one-time account step. Guest mode remains available. |
| C1a | Decline/refrain from the personalised-feature consent | The authenticated user can still open the consent-exempt Account & data route to export data, review deletion, manage sign-in, or sign out; no re-consent is required to exercise account rights. |
| C2 | Complete the account step | Exact current policy versions are stored in metadata and an active server-timestamped receipt; the user then reaches workspace selection. |
| C3 | Directly visit the completion route with current consent | The user is routed to their selected workspace without rewriting acceptance timestamps. |
| C4 | Withdraw special-category consent | The active receipt is withdrawn, current consent metadata is cleared, refresh sessions are revoked where possible, the current device signs out, and guest mode opens. |
| C5 | Use another device/old client after withdrawal | Server-gated personalised endpoints deny access. New playback/LiveKit grants are denied, and previously issued signed playback URLs and unused LiveKit connection tokens expire within ten minutes. Production RLS evidence must show the same result for direct Supabase access before release. |
| C6 | Sign in and consent again after withdrawal | A new active receipt is recorded for the same policy version; the withdrawn receipt remains as lifecycle evidence according to the approved retention rule. |

## Social identity and workspaces

| ID | Scenario | Expected result |
| --- | --- | --- |
| S1 | Apple/Google first sign-in, return sign-in, cancellation, and provider revocation | Cancellation leaves no session; successful sign-in retains one UUID; missing consent is completed once, not on every return. |
| S2 | Connect Apple/Google from Account settings | Manual linking retains the original UUID. A mismatch signs out locally and never merges roles by matching email. |
| S3 | iOS configuration | Google is not offered unless Apple is configured and offered with appropriate prominence; current provider branding passes review. |
| W1 | Listener-only account | Listener workspace opens; protected actions ask for sign-in in guest mode. |
| W2 | Local-admin-only, muezzin-only, and main-admin-only accounts | Workspace selection includes Listener plus only the staff workspace(s) actually assigned. |
| W3 | Local-admin + muezzin and main-admin + muezzin accounts | Listener, Admin, and Muezzin are selectable; each switch retains the same UUID and correct mosque access. |
| W4 | Reload/cold-open `/discover`, `/mosque/:id`, `/event/:id`, `/campaign/:id`, `/settings/account`, and `/manage-mosques` | The route resolves to the selected/authorised workspace. A guest never mounts an admin editor for a public URL. |

## Account data and deletion

| ID | Scenario | Expected result |
| --- | --- | --- |
| A1 | Download data after an old session and after reauthentication | An old session is denied until recent interactive authentication. The JSON is versioned, paginated, redacted, and makes every omission/truncation conspicuous. |
| A2 | Export a multi-role account with more than 1,000 rows | All relevant sections paginate deterministically; private mosque text, third-party identifiers, secrets, and unrestricted Auth metadata are absent. |
| A3 | Review deletion while release gates are false | Impact can be inspected, but permanent deletion is unavailable and no data is removed. |
| A4 | Change a role/file/approval or wait more than five minutes after impact review | The old fingerprint is rejected and a fresh review is required. |
| A5 | Disposable deletion test after every production gate is approved | Test sole admins, default/last muezzin, upcoming rota, open cover, active broadcast, owned Storage, Apple revocation, lost responses, retries, old JWTs, and every postcondition in the durable orchestration runbook. |

## Guest and privacy checks

| ID | Scenario | Expected result |
| --- | --- | --- |
| G1 | Browse Home, Discover, mosque, public event/campaign, and Jumu'ah details as guest | Only public reads occur. Follow, attendance, preferences, live audio, Account, and every staff action require sign-in. |
| G2 | Inspect network and hosted logs | New precise-location requests use POST bodies; auth URLs/tokens and exports are not logged; legacy coordinate URL traffic has a retirement plan. |
| G3 | Open Privacy, Terms, and deletion-request links from every account route | Published HTTPS pages match the app policy versions and store declarations. The external form discloses Web3Forms at collection. |
| G4 | Change `delivery`, `subject`, expiry, mosque, or stream in a signed playback URL | Playback is denied. Only proxy delivery is issued or accepted, the upstream provider URL remains server-side, the grant's opaque subject changes per account/grant, and the raw Auth UUID is absent from the URL. |
| G5 | Exercise the external playback upstream policy | A missing/malformed allowlist, unlisted host, URL credentials, private/loopback/link-local literal (including IPv4-mapped IPv6), single-label/local hostname, excessive redirect, or redirect to a denied destination fails closed. Exact entries match only that host; `*.provider.example` matches subdomains but not the apex. |
| G6 | Test external stream formats and deployed proxy limits | Allowlisted continuous Icecast AAC/MP3/OGG starts and remains live for the required duration. HLS is rejected by `.m3u8` path, HLS media type, and `#EXTM3U` body even when RTMP ingest works. Client Range/Accept cannot negotiate around inspection. Record GET and signed HEAD behaviour, including a provider that rejects HEAD; readiness and playback use the verified GET path. Concurrent streams, cancellation, timeout, bandwidth and host request-duration limits are recorded. |

Hard deletion, social provider flags, and production consent/RLS enforcement
remain off until the corresponding evidence in
[`account-auth-release-gates.md`](./account-auth-release-gates.md) is complete.
