# Claude Code Handoff — 2026-09-16 evening → 2026-09-18

Written for Codex (or any second agent) picking up after two days of Claude
Code sessions on `staging`. Read `docs/claude-code-handoff-2026-09-15.md`
first if you haven't already — it covers the secret-leak remediation and
11–15 Sept work. This doc picks up from its last commit (`bd01340`) through
`d30f936` (2026-09-18), covering: the Classes/Courses redesign, three rounds
of a completely new Local Admin bottom tab bar (including a real bug and a
process failure worth learning from), and three rounds of device-tested UI
fixes. Nothing here touches production; everything is on `staging` /
`adhan-connect-staging`.

Current staging HEAD: `d30f936`. Both iOS (Xcode Cloud → TestFlight) and
Android (GitHub Actions) builds are green for it; hosted web/API is
deployed as `ct1o9bkpvl` → alias `preview`.

---

## 0. Read this first: two things worth internalising

**A. Bare Expo Router group paths (`/(admin)`) do not reliably resolve.**
`router.replace('/(admin)')` — a group name with nothing after it — produced
"Unmatched Route: Page could not be found" on device with an *empty*
resolved path, even though it type-checks fine and looks correct. The
working pattern, proven by `(user)` and `(muezzin)` and now mirrored by
`(admin)`, is: the group's real content lives in a **uniquely-named file
inside the group** (`admin-home.tsx`, `listener-home.tsx`,
`muezzin-home.tsx`), and `index.tsx` in that group is *just* a `<Redirect
href="/(group)/unique-name" />` stub. External code (role routing, back-
button fallbacks) always targets the unique name (`/admin-home`), never the
bare group. If you ever add a new top-level workspace group, follow this
pattern from the start.

**B. `git add file1 file2 already-deleted-file` fails atomically and stages
nothing — not even file1 and file2.** This bit hard on 2026-09-17: a `git
rm` had already staged a deletion, a later combined `git add` re-listed
that same (now nonexistent) path alongside seven other files, the whole
command errored with "pathspec did not match any files", and it silently
staged *none* of the eight files. The commit that followed contained only
the file the `git rm` had staged separately — a bug fix that looked
complete in the diff I *intended* but was 90% missing in the diff that
actually shipped, and nobody caught it until device testing failed. Every
commit after that point in this session was staged file-by-file and its
`git diff --cached --name-status` (then, after commit, `git show --stat`)
was read back and compared against the intended list before moving on —
and after every push, `git fetch` + comparing local `HEAD` to `origin/<branch>`
by SHA, not by trusting exit codes. Keep doing this.

---

## 1. Classes & Courses — two redesigns (09-16)

Commit `5963430` (Codex, 09-16 while Claude was on a leak-remediation
session) added the first version: `mosque_service_listings` /
`mosque_service_intakes` tables, free-text category/schedule/duration
fields, a manual enrolment/activity state machine, and external donation
links on campaigns. Migration `20260916000100_services_and_external_appeals.sql`.

Device testing found it too complex for local admins and messy for
listeners. Commit `59b7b7b` (09-17) is a full redesign, superseding the
first:

- **Predefined categories** (11: Qur'an & Tajweed, Hifz, Arabic, Children's
  Islamic studies, Alim/Alimah, Adult & evening, New Muslims, Youth,
  Sisters' circle, Family & wellbeing, Community support) instead of free
  text.
- **Status is derived** from start/end dates (upcoming/running/finished);
  the admin only controls one `taking_enrolments` boolean, surfaced as an
  inline switch on the admin list.
- **3-step admin editor** (Basics → When & where → Fee & contact) with a
  live preview card, in `screens/admin/services/[id].tsx`.
- **Shared `ClassCard`** component (`components/ClassCard.tsx`) used by
  both the admin list and the listener mosque-page/homepage strips.
- Optional per-class **options** (Stage 1/2, girls/boys) inherit the
  parent class's days/time/fee unless overridden.
- Migration `20260917000000_mosque_classes_simplify.sql` adds the picked
  columns, backfills from the old free text, and drops the state-machine
  columns.
- `lib/serviceListings.ts` is the single source of truth for categories,
  audiences, day/time formatting, and the derived-status logic;
  `scripts/services/test-rules.js` covers it.

`docs/services-and-appeals-review-2026-09-16.md` has a superseded-note at
the top pointing to this shape; don't trust its body for current field
names.

---

## 2. Local Admin bottom tab bar — the full story, three fixes deep

### 2.1 Why
Listener and Muezzin already have bottom tab bars; Local Admin was a bare
`Stack`, so every one of its ~25 screens was a dead-end requiring a manual
back-out. User asked for parity. Commit `1553e2b` converted
`app/(admin)/_layout.tsx` from `Stack` to `Tabs`, mirroring the Listener/
Muezzin pattern exactly (pill-highlighted icon, `tabBarHideOnKeyboard`,
same height/shadow), with every non-tab screen registered as a hidden
`Tabs.Screen` (`href: null`) — the same technique already used for every
Listener/Muezzin detail screen.

### 2.2 The routing bug (see §0.A) — two commits to actually fix it
- `7dafd07`: diagnosed and (intended to) fix that local admins were
  landing on a **top-level** `app/admin-home.tsx` — a sibling of the
  `(admin)` group in the root Stack, not a screen inside it — so the new
  tab bar could never show on the landing page. **This commit's push only
  actually contained one line** (the file deletion) because of the §0.B
  git-add bug; the reference updates it was supposed to include never
  landed.
- `be5f14a`: the real fix, verified end-to-end this time. Moved the
  dashboard to `app/(admin)/admin-home.tsx` (unique filename *inside* the
  group, registered as the visible Home tab), made `app/(admin)/index.tsx`
  a `<Redirect href="/(admin)/admin-home" />` stub, restored
  `resolveRouteTargetHref`'s `'/(admin)' → '/admin-home'` remap in
  `lib/roleRouting.ts` (this time pointing at something that actually
  exists), and fixed every other bare-`/(admin)` reference that had crept
  in (`attendance.tsx`'s "Back to Dashboard" button,
  `prayer-times/index.tsx`'s `backRoute`, `AdminScreenShell`'s default
  fallback, `jumuah.tsx`/`events.tsx` BackButton fallbacks) to point at
  `/admin-home` instead.

### 2.3 Tab set — went through two rounds of rebalancing from device feedback
Final five visible tabs (`app/(admin)/_layout.tsx`): **Home · Prayers ·
Classes · Enquiries · Settings**. History:
- First cut (`1553e2b`): Home, Prayer Times, Rota, Content, Settings.
- User feedback: drop Rota (→ Home tile), add Classes and Enquiries as
  tabs instead; shorten labels (they were clipping at 5-wide); Prayer
  Times gained a "Prayer availability" sub-menu entry.
- `Content` (events/campaigns/notices) and `Attendance & Engagement`
  don't have tab slots — they're deliberately **Featured cards** on Home
  instead (bigger, higher-visual-weight than a list row), on the reasoning
  that they're glance-and-leave/occasional rather than repeated-action
  screens, so they don't need to cost a scarce tab slot. This was an
  explicit judgment call, stated to the user, not silently done.
- Tab-root screens (Home, Prayers, Classes, Enquiries, Settings) all had
  their Stack-era back button removed — `AdminScreenShell` gained a
  `showBack` prop (default `true`) for this; `EnquiryInbox`'s back button
  is conditional on its `admin` prop since it's shared with the Listener
  "My enquiries" screen, which is still a pushed route and still needs it.
- The old Staff-Rota/Prayer-Times segmented in-screen switcher
  (`AdminScreenShell`'s `activeTab`/`onGoPrayerTimes`/`onGoStaffRota`
  props) became fully redundant once both were tabs; removed along with
  its dead `AdminTab` component.

**If you add or remove an admin route file**, verify registration with:
```
find "app/(admin)" -name "*.tsx" ! -name "_layout.tsx" | sed -E "s#app/\(admin\)/##; s#\.tsx\$##" | sort > /tmp/f.txt
grep -oE 'name="[^"]+"' "app/(admin)/_layout.tsx" | sed -E 's/name="([^"]+)"/\1/' | sort > /tmp/r.txt
comm -23 /tmp/f.txt /tmp/r.txt   # unregistered files
comm -13 /tmp/f.txt /tmp/r.txt   # registrations with no file
```
This was run before every commit in this session; keep doing it.

### 2.4 Orphaned routes found, not touched
`admin-manage-mosques.tsx`, `admin-muezzin.tsx`, and
`broadcast-editor/[id].tsx` have **no inbound navigation from anywhere in
the app** (checked via grep across `app/`, `screens/`, `components/`).
This predates the tab work — they were equally unreachable under the old
Stack. Not deleted (could be dead code, could be reached by a mechanism
grep doesn't catch, e.g. a stored/legacy deep link); worth a deliberate
look before removing.

---

## 3. Home dashboard redesign (part of `7dafd07`, refined in `71a8a4f`)

`app/(admin)/admin-home.tsx` (formerly `index.tsx`) went from one flat list
of ~10 identical rows across two sections to:
- Header: mosque name (now wraps to 2 lines, `numberOfLines={2}`, was
  truncating — e.g. "Guidance Ce…" — fixed in round 2), "Ready" badge on
  its own line below it (was competing for the same row).
- **Featured** section (new): two large elevated cards — Attendance &
  Engagement, Content — each with a bigger icon, bolder title, own shadow.
- **Daily operations**: Jumu'ah, Staff Rota, Muezzins (trimmed list; the
  four tab-covered items — Prayer Times, Classes, Enquiries, Settings —
  and the now-Featured items were removed to avoid duplicating the tab
  bar).
- **System management** (main-admin only): Create Mosque.

---

## 4. Device feedback rounds 1–3 (commits `71a8a4f`, `d30f936`)

### Round 1 (`71a8a4f`)
- Prayer Times menu no longer shows the "Managing mosque" card or the
  "Prayer schedule / Auto-calculated…" notice banner while on the menu
  view (the banner now only appears once a date is actually open).
- Settings role badges/detail row now say "Local Admin" / "Main Admin"
  instead of the raw `local_admin` enum string — reuses the exact label
  mapping already in `app/role-entry.tsx` rather than inventing new
  wording.
- Removed the embedded `PrayerAvailabilityReasons` card from Settings —
  duplicated `mosque-services.tsx`, which is the real owner.
- **Enquiries full redesign** (`components/enquiries/EnquiryInbox.tsx`,
  shared by admin tab root and Listener's "My enquiries"): pull-to-refresh
  replaces an explicit Refresh button; "Manage contact options" becomes a
  header icon button with proper checkbox rows; "Show archived" becomes an
  Active/Archived segmented control; status filter becomes chips with live
  counts; each enquiry is a real row (category icon, name, one-line
  reason preview, coloured status pill, relative date). Admins with
  >1 mosque get the same mosque-switcher chip row Classes/Prayer Times use.
- **Prayer-time editor full redesign**: the "Adhan and iqama times for
  {date}" section — five separate cards, each with a title, two rows, a
  caption and a full-width ghost button — became one compact table
  (Prayer/Adhan/Iqama columns, matching the existing read-only "Published
  times" table) with a small pencil/refresh icon-button per row to toggle
  the iqama override, and one shared footnote instead of five repeated
  captions.

### Round 2/3 (`d30f936`) — smaller, found through continued device testing
- Iqamah Schedules and Prayer Availability also had "Managing mosque"
  cards — removed (same redundancy as Prayer Times).
- Prayer Availability (`app/(admin)/mosque-services.tsx`) was showing an
  unrelated "Services offered" card — general mosque amenities (parking,
  wudu facilities, classes, etc.), not "which of the 5 daily prayers are
  held here". **Split into a new screen**,
  `app/(admin)/mosque-facilities.tsx` ("Services & Facilities"), reachable
  from a new "Mosque profile" section in Settings. Both screens still
  load and resave the full `set_mosque_service_profile` row (services +
  prayers_not_offered + reasons together, since that's the RPC's shape)
  so saving one can never silently wipe the other's data, even though
  each screen only exposes its own fields in the UI.
- **Enquiries was rendering under the iOS status bar/notch** — the screen
  wrapper was a plain `View`, not `SafeAreaView`. Every other screen in
  the app uses `SafeAreaView`; this one didn't. Fixed
  (`edges={['top','left','right']}`).

---

## 5. Removed: Reflection Planner (`b4843ab`)

Deleted the "Reflection Planner" dashboard tile, its route registration,
and `app/(admin)/quotes.tsx`. Rationale given to the user: nothing on the
listener side reads `mosque_daily_quotes` / `mosque_reflection_items` /
`mosque_reflection_schedules` — the Guidance hub is served by the Quran
Foundation API and bundled duas/tips content. **Tables were left in
place** (staging had 17/0/0 rows respectively at time of removal); a
follow-up migration to drop them was not written — do that deliberately
if/when confirmed truly dead, not as a side effect of something else.

---

## 6. Claim-on-admin migration (`20260917001000`, part of `1553e2b`)

A mosque with an active local admin is now automatically marked
`onboarding_status = 'claimed'` (trigger on `mosque_admins` insert, plus a
one-time backfill). Previously only a main admin could flip this manually
from the web portal, so mosques with a real, active local admin still
showed "not yet claimed by staff" to listeners. Guidance Centre and Al
Falah were both backfilled to `claimed` on staging.

---

## 7. Current deployed state

| Surface | Value |
|---|---|
| Staging branch HEAD | `d30f936` |
| iOS | Xcode Cloud build for `d30f936` — success, on TestFlight |
| Android | GitHub Actions run for `d30f936` — success, APK + signed AAB artifacts |
| Hosted web/API | `ct1o9bkpvl` → alias `preview` (`https://adhan-connect--preview.expo.app`) |
| Latest migration applied | `20260917001000_claim_mosque_on_local_admin.sql` |
| Local Admin visible tabs | Home · Prayers · Classes · Enquiries · Settings |

Any `app/api/**` change still needs the separate hosted-API redeploy
(`EXPO_NO_DOTENV=1 eas env:exec preview "npx expo export --platform web
--clear"` then `eas deploy --alias preview --environment preview`) in
addition to a native build — unchanged from prior handoffs, just
re-stating since this session did it ~7 times.

---

## 8. Loose ends for whoever picks this up next

- **`LPT_API_KEY` rotation still pending** (from the 09-15 secret leak;
  low risk — read-only, quota-limited — but not closed). See
  `docs/claude-code-handoff-2026-09-15.md` §1.4 and the
  `2026-09-15-secret-leak-remediation` memory note.
- Orphaned routes `admin-manage-mosques.tsx`, `admin-muezzin.tsx`,
  `broadcast-editor/[id].tsx` (§2.4) — investigate before deleting.
- `mosque_daily_quotes` / `mosque_reflection_items` /
  `mosque_reflection_schedules` tables are now unused UI-side but not
  dropped (§5).
- User's own uncommitted local changes, untouched all session: `ios/
  AdhanConnectStaging.xcodeproj/project.pbxproj`, `ios/
  AdhanConnectStaging/Info.plist` (modified), plus untracked
  `ios/AdhanConnectStaging/PrivacyInfo.xcprivacy`, `ios/Podfile.lock`, and
  a new `ios/AdhanConnectStaging.xcodeproj/xcshareddata/xcodecloud/`
  directory (likely from the user enabling Xcode's local "External Agent
  Access" setting — unrelated to Xcode Cloud CI, a separate local-Mac
  permission). Leave these alone unless asked.
- No physical-device LIVE (LiveKit) canary has been re-run since the
  09-16 LiveKit key restoration was confirmed working — not touched this
  session, just flagging it's still the last verification on file.
