# Claude Code Handoff — 2026-09-11 to 2026-09-15

Written for Codex (or any second coding agent) picking up after five days of
Claude Code sessions. Read this before touching prayer times, iqamah
schedules, CI/CD, environment variables, or anything Supabase-key related.
Nothing here changes production. Everything below is on the `staging`
branch and the `adhan-connect-staging` Supabase project
(`zhrucqghrqkjyzmupdyy`).

Companion docs: `docs/claude-code-handoff-2026-09-11.md` (ELM cache + My
Rota, more detail than repeated here), `CLAUDE.md` (updated with the
short-form notes), `docs/codex-worklog.md` (do-not-regress rules).

---

## 0. Read this first: git history was rewritten on 2026-09-15

Every commit SHA on every branch changed. If your checkout predates
2026-09-15 evening, **do not `git pull`** — that would merge the old,
secret-bearing history back in and re-push it. Instead:

```
git fetch origin
git status                       # stash or commit anything you care about
git reset --hard origin/staging  # or origin/<your branch>
```

Or simply re-clone. Details in §1.

Latest staging commit at the time of writing: `86ce97d`.

---

## 1. Security incident: leaked Supabase service-role JWT (2026-09-15)

### What happened
GitGuardian emailed two alerts on 2026-09-15 for `digimaxai/adhan-connect`:
a *Supabase Service Role JWT* and a *Generic High Entropy Secret*.

Investigation found three sources, all in git history:

| Source | Contents | Exposed since |
|---|---|---|
| `.env.local.staging` (tracked) | Staging `SUPABASE_SERVICE_ROLE`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LPT_API_KEY`, plus public URLs/anon key | Committed 2026-08-29 (`90e55d3` old SHA), first pushed 2026-08-30; rewritten 2026-09-11 (`d90bb2f` old SHA) which triggered the alert |
| `.env` (tracked May–June 2026) | LiveKit API key/secret, production anon key/URL | `0450f43`→`05897d1` (old SHAs), 2026-05-13 to 2026-06-28 |
| Runtime logs `expo-*.log`, `.codex/live-watch/*.log` | LiveKit websocket URLs with short-lived room tokens | Various |

Root cause of the first one: `.gitignore` had `.env.*.local` (dot *before*
`local`) but the file was named `.env.local.staging` (dot *after* `local`),
so it never matched. `CLAUDE.md` had even noted the file was tracked.

### What was done

1. **History purge** — `git filter-repo --invert-paths` removed all eight
   files from every commit on every branch and tag. All branches, tags and
   `main` were force-pushed (`main` branch protection was toggled off via a
   full `PUT` of the rule, then restored byte-identical: force-push disabled,
   status check `checks`, 0 required reviews). Five previously local-only
   branches that `git push --all` accidentally published were deleted from
   origin again. Verified afterwards via the GitHub contents API that the
   files 404 on all nine remote branches.
2. **`.gitignore` hardened** — added `.env.local.*`, `expo-*.log`,
   `expo-*.err.log`, `.codex/live-watch/*.log`. The local
   `.env.local.staging` file still exists on the dev machine (needed by
   scripts and `eas env:exec`), it is just no longer tracked.
3. **Key rotation** — see §1.1 for the important wrinkle.
4. **Docs/memory** — `CLAUDE.md` "Current Known Risks" has a paragraph; this
   doc is the long form.

### 1.1 Supabase key rotation: the legacy JWT could NOT be rotated

The staging project had already been migrated to Supabase's asymmetric
**JWT Signing Keys** (ECC P-256, Settings → JWT Keys). Once that migration
has happened the dashboard no longer offers "Generate new JWT secret"; the
legacy HS256 secret (which signs the legacy `anon` and `service_role` API
keys) can only be *disabled*, not rotated.

So the app was moved to the new-style keys instead:

| Purpose | Old value | New value |
|---|---|---|
| `SUPABASE_SERVICE_ROLE` (server routes, scripts) | legacy `eyJ…` service_role JWT | `sb_secret_…` ("default" secret key from Settings → API Keys) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clients) | legacy `eyJ…` anon JWT | `sb_publishable_…` ("default" publishable key) |

Then **"Disable JWT-based API keys"** was pressed on the *Legacy anon,
service_role* tab. Verified: the old anon key now returns 401 from
`/auth/v1/settings`; the new publishable key returns 200 and completes a
password grant.

`@supabase/supabase-js` is 2.76.1 and accepts `sb_…` keys transparently;
nothing in the codebase inspects the key format (the one JWT decoder,
`lib/server/accountAccess.ts`, decodes *user session* tokens, not API keys).

Edge Functions: Supabase auto-injects `SUPABASE_SERVICE_ROLE_KEY` and it
already carried the `sb_secret` digest, but as belt-and-braces both
`push-dispatch` and `fetch-elm-timetable` now read `SB_SECRET_KEY` first
(set via `supabase secrets set`) and fall back to the injected name. Both
were redeployed.

Other rotations:
- **LiveKit** — new key/secret created in LiveKit Cloud project
  `adhanconnect-6117gia9`, old keys deleted. Note this project is shared
  with production, so production LiveKit config also changed.
- **`LPT_API_KEY`** (London Prayer Times) — **still pending**. The site
  re-issues the same key on "generate"; a new one has been requested by
  email. Low risk (read-only public data, quota only). When it arrives:
  `supabase secrets set LPT_API_KEY=… --project-ref zhrucqghrqkjyzmupdyy`
  and update `.env.local.staging`.
- Resend key was **not** in the leaked files; not rotated.

### 1.2 Where the new values were propagated

| System | Variables | Notes |
|---|---|---|
| EAS env `preview` **and** `development` | `SUPABASE_SERVICE_ROLE`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | `eas env:update` needs `--variable-name … --variable-environment … --scope project`. **Gotcha:** updating a record shared by two environments detaches it from the other one; `development` had to be recreated with `eas env:create` for both Supabase vars. **Correction (2026-09-16):** the same thing happened to the two LiveKit vars in the other direction — updating `preview` then `development` left `preview` with no LiveKit vars at all, which Claude Code did not re-verify. LIVE token endpoints returned 503 until Codex restored both as sensitive variables on 2026-09-16 and redeployed the hosted API as `6o7jr2scu2`. All four vars now exist in both envs (verified 2026-09-16). Always re-list both envs after any update. |
| Supabase Edge Function secrets (staging) | `SB_SECRET_KEY` | `LPT_API_KEY` unchanged until the new key arrives |
| GitHub Actions repo secrets | `STAGING_EXPO_PUBLIC_SUPABASE_ANON_KEY`, `STAGING_EXPO_PUBLIC_SUPABASE_URL`, `STAGING_EXPO_PUBLIC_API_BASE_URL` | These did not exist before (the workflow referenced them but nobody had created them). `STAGING_EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB/NATIVE` are still unset; not needed for password sign-in. |
| Xcode Cloud workflow "Default" env vars | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Set by hand in App Store Connect. See §1.3 for the trap. |
| Hosted API (EAS Hosting) | — | Re-exported and redeployed: deployment `zkij5trusg` → alias `preview`. **`eas deploy` now needs `--environment preview`**, otherwise server routes fail at deploy time with "supabaseUrl is required". |
| Local `.env.local.staging` | all of the above | edited by hand |

Verification done against the live hosted API: publishable key reads
`mosques` via REST (200); `/api/prayer-times-daily` returns a real row
(service role path works); `/api/session-access` accepts a session minted
with the new key.

### 1.3 The sign-in scare after rotation, and its real cause

After all of the above, iOS builds 24 and 25 showed *"We could not sign you
in with those details"* for every account, while a `curl` password grant
against staging succeeded. Two pipeline fixes were shipped before the real
cause surfaced:

- `1e3a7a0` — `ios/ci_scripts/ci_post_clone.sh` now writes a git-ignored
  `.env.local` from all `EXPO_PUBLIC_*` workflow variables before `expo
  prebuild` (mirrors the Android fix from 2026-09-13). Harmless, kept.
- `86ce97d` — `lib/supabase.ts` now `.trim()`s `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. **This was the actual fix.**

Real cause: the value pasted into the Xcode Cloud variable had **two
trailing newlines**. It is visible in the build log's "Set environment
variables" section as two blank lines after the key. `process.env` wins
over `.env.local` in `@expo/env`, so the bundler inlined `key\n\n` into the
app and Supabase rejected the `apikey` header. Confirmed fixed on the
build after `86ce97d`; both real accounts sign in.

Lesson for the future: when a workflow variable is set by hand, check the
build log's env dump for blank lines; and keep the `.trim()`.

### 1.4 Still open from the incident (owner: Hajira)
- GitHub Support "remove sensitive data" request so the orphaned old commits
  (e.g. old `d90bb2f`, `07de360`, `86987fa`, `3f72a79`) stop being
  fetchable by SHA. Rotation makes this hygiene rather than urgent.
- Mark both GitGuardian incidents resolved.
- `LPT_API_KEY` rotation (above).
- Optional: migrate production Supabase to `sb_…` keys too, deliberately
  and with a native rebuild — not urgent, nothing leaked for production
  Supabase.

---

## 2. Feature and fix work, 2026-09-11 → 2026-09-14

All on `staging`; all migrations below are applied to the staging project
(`supabase migration list --linked` shows local == remote through
`20260913000100`). Production database is untouched.

### 2.1 Mosque enquiries, prayer-time adjustments, local-admin UX (09-11)
Commit `446f070` and follow-ups `318d13e`, `a5b1561`, `5f6b01d`.
- New `mosque_enquiries` (migration `20260910000000`) and
  `mosque_prayer_time_adjustments` (`20260911000000`, fix `…001000`)
  with `update_mosque_prayer_settings` RPC.
- Local Admin prayer-times screen: per-prayer minute adjustments, Asr
  school (Shafi/Hanafi) selection, "Correct this day" form pre-filled with
  auto-calculated times; saving settings no longer reloads the whole
  workspace.

### 2.2 ELM timetable DB cache (09-11) — see the 09-11 handoff for depth
Commits `a1249fd`, `e04c834`, `6cf90a1`; migrations `20260911003000`,
`20260911004000`.
- Why: `LPT_API_KEY` is not available at runtime to EAS-hosted server
  routes (EAS Hosting only sees env that existed at export time via dotenv).
- What: `elm_timetable` table (public read, service-role write), Edge
  Function `fetch-elm-timetable` (fetches 7 days back + 60 ahead), `pg_cron`
  refresh at 01:00 UTC daily. Server routes and the client fallback read
  the table first, API second.

### 2.3 Muezzin My Rota UX + rota-workspace fallback (09-12)
`cc97792`, `a504d95`, `142a79d`: My Rota screen redesign (clear
Cancel/Volunteer actions, week navigation polish), hooks-order fix, and the
`/api/muezzin/rota-workspace` route now falls back to `elm_timetable`.

### 2.4 London-timezone bug in prayer-time ISO construction (09-12/13)
`5372d04` (server route), `6ed8b70` (client fallback). Bare `HH:MM` strings
from ELM/legacy data are London local; `new Date(\`${date}T${time}\`)` on a
UTC runtime shifted everything +1h during BST. Fixed in all three
resolution paths. Two already-saved `prayer_times` rows for Masjid Al Falah
(2026-09-13/14) were corrected directly in the staging DB.

### 2.5 Listener homepage revamp + mosque onboarding transparency (09-12)
`99a6e18`, migration `20260912000000` (`mosque_onboarding_status`).
Homepage card cleanup; mosque claim/onboarding status surfaced to listeners.
`aaa795c` and `09596b6` (09-13) continued this: removed "Directory
listing"/"Live capable" badges, added positive-only "Verified" and "Live
Adhan" chips on discovery, contextual "Verified — managed by mosque staff"
line on the detail page, main-admin **Claim status** dropdown in the Edit
Mosque modal, confirmation dialog before saving prayer times, and a
contextual note that Hanafi Asr being ~1h later is correct.

### 2.6 Date-range iqamah scheduling (09-13) — biggest functional change
`25c8caf`, `7991752`; migrations `20260913000000`, `20260913000100`.
- New `mosque_iqamah_schedules` table + SECURITY DEFINER RPCs
  (upsert/delete/list) with server-side overlap rejection.
- Iqama resolution precedence everywhere (adhan precedence unchanged):
  1. `prayer_times.{prayer}_iqama_time` when it is a genuine explicit
     day-specific exception;
  2. matching `mosque_iqamah_schedules` row;
  3. ELM `*_jamat`;
  4. `null`.
- Wired into `lib/api/prayerTimesUnified.ts`,
  `app/api/prayer-times-daily+api.ts`,
  `app/api/admin/prayer-times-workspace+api.ts`.
- "Correct this day" iqama fields are read-only by default with an explicit
  per-prayer "Override this date" toggle; un-overridden fields save as
  `null` so the schedule keeps resolving live. This closes the footgun where
  any manual save froze whatever iqama was on screen forever.
- New screen `app/(admin)/iqamah-schedules/index.tsx` (CRUD, expiry banner
  when a schedule ends within 7 days with nothing after it).
- Staff-rota seeding (`loadPrayerTimesSlotMap`) now goes through
  `getDailyPrayerTimes` so rota rows seed with the resolved iqama.

### 2.7 Local Admin Prayer Times redesign + bug fixes (09-13/14)
`62bbbe3`, `f71f7e4`, `210cf0b`, `bc17d66`, `f41746e`.
- Screen is now menu-driven (card + chevron pattern matching the dashboard):
  "View & correct a date", "Calculation method", "Iqamah schedules",
  "Import timetable". Staff Rota tab removed from this screen.
- "What followers see" is a proper 3-column table.
- `useFocusEffect` reload so schedule edits reflect immediately.
- iOS bug: the date `DateTimePicker` was rendered *outside* the `Modal` and
  was invisible behind it; now inline inside the modal with a Done button.
- **Critical backend fix (`bc17d66`)**: the client-side fallback chain in
  `getDailyPrayerTimes` never resolved iqama through schedules/ELM (always
  `null`); all three fallback branches now run
  `fillPartialPrayerTimesFromSource`.
- **Saved-row precedence is by design (`f41746e`)**: a saved `prayer_times`
  row (manual correction or import) is canonical for that date, so
  schedules and adjustments never show there until the row is removed. The
  "View & correct a date" screen explains this and offers *"Remove saved
  times — use automatic"* (client delete under existing local-admin RLS).
  Also, the client now always null-fills server rows so an older deployed
  API cannot leave `iqama: null`.
- After saving automatic settings the admin gets a contextual notice when
  the selected date has a manual override.

### 2.8 Pre-existing tsc errors fixed (09-14)
`56159bc`: 8 repo-wide type errors that were failing the CI type-check job.
`npx tsc --noEmit` is clean.

---

## 3. CI/CD: off paid EAS Build, onto Xcode Cloud (iOS) + GitHub Actions (Android)

Commit `8ce9df3` (09-12) and hardening commits `16c24fb`, `d81e6ce`,
`b218b1d`, `83d8223`, `767751c`, `1e3a7a0`.

### iOS — Xcode Cloud
- `ios/` is committed as a baseline (Xcode Cloud needs a real
  `.xcodeproj`/scheme at setup time) and regenerated every run by
  `ios/ci_scripts/ci_post_clone.sh`: prepend `/opt/homebrew/bin`, unset
  proxy env, `brew install node@20`, `npm ci`, write `.env.local` from
  `EXPO_PUBLIC_*` workflow vars, `expo prebuild --platform ios`,
  `arch -arm64 pod install`.
- Workflow "Default" on branch `staging`, start condition *Branch Changes*
  (every push builds — including docs-only pushes; consider a path filter),
  post-action TestFlight Internal Testing.
- Env vars live in App Store Connect: `APP_VARIANT=staging`,
  `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_SUPABASE_URL`.
- There is **no App Store Connect API key on this machine**, so builds
  cannot be started or inspected from the CLI. Status is visible via
  `gh api repos/digimaxai/adhan-connect/commits/<sha>/check-runs`
  (check name `AdhanConnectStaging | Default | Archive - iOS`).
- Current good build: the one after `86ce97d` (build 26+). Builds 24/25
  had the newline bug from §1.3.
- Local, uncommitted: Hajira has edits to
  `ios/AdhanConnectStaging.xcodeproj/project.pbxproj`, `Info.plist`, a new
  `PrivacyInfo.xcprivacy` and `ios/Podfile.lock`. Not reviewed; leave them.

### Android — GitHub Actions `.github/workflows/android-staging-build.yml`
- `workflow_dispatch` only (manual). Produces an unsigned debug APK for
  sideloading and — because keystore secrets exist — a signed release AAB
  (`adhan-connect-staging-android-release-aab` artifact) for Play Console
  internal testing. `scripts/patch-android-release-signing.py` patches the
  freshly generated `build.gradle` each run.
- Keystore + passwords are GitHub secrets `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`;
  a local backup lives in git-ignored `android-signing-local/`. **Do not
  lose it** until Play App Signing is enrolled.
- The workflow writes `.env.local` before Gradle because release JS
  bundling does not see job-level env (`767751c`).
- Env secrets `STAGING_EXPO_PUBLIC_*` were created on 2026-09-15 (see
  §1.2). First green run of this workflow: 2026-09-15, run
  `35010272933`, built with the new publishable key. Push notifications do
  not work on the debug APK (no `google-services.json`).

### Hosted API (unchanged mechanism, new caveat)
Native builds do not contain server routes; they call the EAS Hosting
`preview` alias. Any `app/api/**` change needs:
```
EXPO_NO_DOTENV=1 eas env:exec preview "npx expo export --platform web --clear"
EXPO_NO_DOTENV=1 eas deploy --alias preview --environment preview
```
Current alias target: `zkij5trusg` (2026-09-15). Previous: `89bc41p84p`.

---

## 4. Things that will bite you (collected gotchas)

- `grep` on this Mac is aliased to `ugrep` and rejects moderately complex
  regexes with "exceeds complexity limits"; use `/usr/bin/grep`.
- The Supabase log-analytics API (`/v1/projects/<ref>/analytics/endpoints/
  logs.all`, BigQuery SQL dialect) returns partial, lagging slices — it
  dropped rows we had seen a minute earlier. "No rows" is not evidence a
  request never arrived.
- Guest (unauthenticated) browsing has been removed from the app. Do not
  propose it as a diagnostic.
- `eas env:update` is deprecated in favour of `eas env:set` and, in
  non-interactive mode, needs `--variable-name` and `--variable-environment`.
  Visibility values are `plaintext | sensitive | secret` (not `public`).
- Saved `prayer_times` rows override everything for that date — by design.
  If an admin says "my schedule/adjustment isn't applying", check for a row
  first.
- `.env.local.staging` is required locally (scripts, `eas env:exec`) but
  must never be tracked. `.gitignore` now covers it; keep it that way.

---

## 5. Suggested next steps

1. ~~Physical two-device LIVE canary on the new LiveKit key.~~ Done by
   Codex/Hajira 2026-09-16 at Al Falah Islamic Education Centre on staging
   ("it's all working now"); listener-audio/end/restart were not separately
   reported. Production LiveKit config was not changed — check
   `eas env:list --environment production` before any production LIVE use.
2. Xcode Cloud: add a path filter or switch the start condition so
   docs-only pushes do not consume build minutes.
3. Set `STAGING_EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB/NATIVE` GitHub
   secrets if Android password-reset/OAuth flows are to be tested.
4. Plan the production Supabase move to `sb_…` keys (needs a coordinated
   native rebuild and hosted API redeploy — do it deliberately, not as a
   side effect of something else).
5. Continue the outstanding items from the 09-11 handoff §4 that are not
   superseded above.
