# Claude Code Handoff — 2026-09-05

**From:** Claude Code

**For:** Codex Max / next engineering session

**Branch:** `staging`

**Base commit shown by Git:** `ac5bd44`

**Status:** New Local Admin content feature (cover images + document attachments
for events/campaigns/notices) implemented, staged, and physically verified
across three build/feedback rounds. Production was not changed. This document
covers Claude Code's work only; it sits alongside Codex's own 2026-09-05 work
on the same day (notification reliability, Guidance hub navigation, nearby
redesign) — read `docs/codex-worklog.md`'s 2026-09-05 entries for that half.

This document supersedes nothing; it is additive to
`docs/claude-code-handoff-2026-09-04.md`. Read `CLAUDE.md` and
`docs/codex-worklog.md` as well. Never print or copy values from local
environment files, EAS secrets, Supabase secrets, or LiveKit credentials.

## Non-negotiable production safeguard (unchanged)

Same rules as every prior handoff: the production LIVE Adhan system (role
assignment, rota/cover, publisher start, LiveKit mic broadcast, listener
homepage/LIVE state, playback, cleanup, restart/idempotency) is a protected
release surface. None of today's work touches it. All 18 files in
`scripts/test-notification-safety-contracts.js`'s protected-file hash list
were confirmed byte-for-byte unchanged before every build cut today. The new
migration was applied to the **staging** Supabase project only
(`zhrucqghrqkjyzmupdyy`); production was never linked or targeted.

## Executive summary

The user shared real WhatsApp announcement examples from a nearby mosque
(flyer images, formatted schedules, guest-speaker bios) and asked whether
Local Admins should be able to attach similar images/documents to Events and
Campaigns, with an appealing listener-facing detail page. Claude Code
researched the existing implementation (confirmed `events`/`announcements`
had zero media columns, `campaigns.cover_image_url` existed but was dead code,
and no Supabase Storage bucket existed anywhere in the app), planned the
feature via plan mode, then implemented, verified, migrated to staging, and
shipped it end to end across four EAS builds (14 → 17), incorporating two
rounds of real physical-device feedback in between.

## Work completed

### 1. Event/Campaign/Notice cover images and document attachments (new feature)

Local Admins can now attach one cover image and any number of documents (PDF
or image) to an Event, Campaign, or Notice from the existing Content hub
editors. Listeners see a rich, image-led detail page with tappable document
links and a native share action, instead of the previous plain-text-only
pages.

New backend:

- `supabase/migrations/20260905150000_content_attachments.sql` — new
  `public.content_attachments` table (mosque_id, content_type, content_id,
  kind, storage_path, file_name, mime_type, size_bytes, sort_order) and a new
  public `content-media` Storage bucket. RLS mirrors the exact existing house
  style from `20260516090000_content_management_columns.sql`
  (`is_main_admin()` / `is_local_admin_for_mosque(mosque_id)`); storage
  object policies extract the owning mosque from the object path
  (`{mosque_id}/{content_type}/{content_id}/{file}`) via
  `storage.foldername(name)`. Applied to staging only; verified live via the
  Storage REST API (bucket exists, `public: true`, anon object-level reads
  return 200).

New client code:

- `lib/api/admin/contentAttachments.ts` — upload/list/delete/public-URL/
  bulk-cover-lookup module, following the existing error-returning-object
  convention used by `lib/api/admin/adminMosques.ts`.
- `components/admin/ContentAttachmentsEditor.tsx` — shared cover-image +
  document upload widget used identically by all three admin editors. Every
  Supabase/Expo call is wrapped in a 20s bounded timeout with a visible error
  state, not an indefinite spinner — a deliberate application of the lesson
  from the notification-reliability saga (see `docs/codex-worklog.md`,
  2026-09-04/05 entries) to this unrelated subsystem.
- `components/ContentDetailHero.tsx` — listener-facing hero image component.
  Measures the image's real aspect ratio on load (`expo-image`'s `onLoad`)
  and sizes its container to match exactly (clamped 200px–55% of screen
  height), so portrait flyer posters are never cropped. Shows a sage-gradient
  placeholder with the item's own title rendered on it when no image exists,
  rather than a blank/generic box. Back/share buttons sit inside a
  `useSafeAreaInsets()`-aware overlay with a permanent dark scrim gradient
  behind them so they stay legible and correctly positioned regardless of
  image content or device notch size.
- `components/ContentDocumentsList.tsx` — tappable document rows, opens via
  `expo-web-browser`.
- New dependency: `expo-image-picker` (`~17.0.11`, installed via
  `npx expo install`). `app.json` updated with
  `NSPhotoLibraryUsageDescription` and the `expo-image-picker` plugin entry.

Wired into existing screens:

- `screens/admin/event/[id].tsx`, `screens/admin/campaign/[id].tsx`,
  `screens/admin/announcement/[id].tsx` — each gained a Cover
  Image/Attachments section (gated to render only once the item has a real
  id, not on create), positioned at the **bottom** of the form, just before
  Save/Delete, so the primary text/date/status fields stay immediately
  reachable without scrolling past media management first. Description
  `maxLength` raised from 1000 to 4000 on Event and Campaign (matches
  real-world flyer-length text), with a visible character counter matching
  the pattern already used on the Notice editor.
- `screens/user/event/[id].tsx`, `screens/user/campaign/[id].tsx` —
  redesigned around `ContentDetailHero` + `ContentDocumentsList`; existing
  register/donate logic untouched, just restyled around the new hero.
- `screens/user/mosque/[id].tsx` — event/campaign list rows show a small
  thumbnail when a cover image exists (bulk-fetched via
  `listCoverImageUrls`, one query per content type rather than one per row).
  Title text on these rows and on the Home "What's On" widget
  (`screens/user/index.tsx`) now wraps to 2 lines with
  `adjustsFontSizeToFit`/`minimumFontScale={0.75}` instead of truncating at 1
  line with an ellipsis.

Explicitly deferred (user-approved scope decisions):

- No notification-on-publish trigger for new events/campaigns — deliberately
  not wired into the `notification_events` outbox this pass, to avoid
  touching the just-stabilized notification system in the same pass as
  unrelated UI work.
- Single cover image only (no multi-image gallery) — matches every real-world
  example shown.
- No structured schedule/agenda fields — free-text description remains the
  mechanism.

### 2. Physical-feedback rounds and fixes

**Round 1 (after build 14)** — user created a real event with the actual
Al-Falah flyer image. Found and fixed six issues:

1. Home widget event/campaign/notice titles clipped at 1 line → 2 lines.
2. Fixed 230px hero height with `cover` fit badly cropped the portrait flyer
   → adaptive aspect-ratio sizing (see component description above).
3. Description 1000-char limit too short for real flyer text → raised to
   4000 with counter.
4. Admin editor felt hard to scroll to reach core fields after the new
   section was inserted mid-form → moved to the bottom of all three editors.
5. Back button hard to see/tap against busy flyer images → scrim gradient +
   stronger button contrast added.
6. Blank gradient placeholder when no image felt unfinished → now renders
   the item's own title on the gradient.

**Round 2 (after build 15)** — two more issues:

1. A very long, emoji-decorated real title still clipped at 2 lines →
   added `adjustsFontSizeToFit`/`minimumFontScale` shrink-to-fit behavior.
2. Back/share buttons "not aligned/positioned correctly, not accessible" →
   root-caused precisely: `screens/user/event/[id].tsx` and `campaign/[id].tsx`
   intentionally dropped the top `SafeAreaView` edge for a full-bleed hero
   image, but the button overlay was never given a matching safe-area inset,
   so it rendered under the notch/status bar instead of below it. Fixed via
   `useSafeAreaInsets()` in `ContentDetailHero`. One of the two reported
   screenshots was also the no-image placeholder case, where the button's
   dark-on-dark contrast against the sage gradient was weak — strengthened
   independently of the position fix.

All fixes in both rounds were verified (`npx tsc --noEmit`, `npm run lint`,
`node ./scripts/test-notification-safety-contracts.js`) before each
subsequent build.

### 3. EAS build/billing operational note

- Builds 14 and 15 succeeded normally.
- **Build 16 failed**: the `maksums-digital-agency` EAS account had exhausted
  its Free-plan monthly iOS build allowance (reset date was 25 days out).
  Upload/fingerprinting succeeded; only the actual compile queue step was
  rejected.
- The user asked about creating a second Expo account to keep using a free
  tier. Advised against it: this would likely violate Expo's terms of
  service (multi-accounting to bypass plan limits), and would not actually
  solve anything structurally since Apple Distribution Certificate/
  Provisioning Profile credentials and the three registered test-iPhone UDIDs
  are tied to the existing Apple Developer Team (`8T6CZ5MKU7`, MAKSUMS
  LIMITED), not the Expo account — a second Expo account still needs the same
  Apple credentials. Verified `eas build --local` is not currently available
  on this Mac either (only Xcode Command Line Tools installed, not the full
  Xcode.app, and no CocoaPods/fastlane) — would need real one-time setup to
  use as a free alternative going forward.
- The user upgraded the EAS plan directly via the dashboard. Build 17 (retry)
  then succeeded, incorporating Round 2's fixes. Build 16's failed attempt
  still incremented the remote build-number counter, so the numbering has a
  gap (15 → 17, no 16 was ever produced).

## Staging deployments and identifiers

- Supabase project ref: `zhrucqghrqkjyzmupdyy` (staging only, same as all
  prior work)
- New migration applied: `20260905150000_content_attachments.sql`
- New Storage bucket: `content-media` (public, staging only)
- EAS builds cut today (all staging bundle
  `com.maksumsdigitalagency.adhanconnect.staging`, all three registered
  iPhones provisioned):
  - Build 14: `c1334348-e3fc-4ada-ae0b-f452d99b123f` — initial attachments
    feature.
  - Build 15: `18617a44-dc1c-42a3-8ce1-a24eeead5571` — Round 1 fixes.
  - Build 16: failed (EAS quota; no artifact).
  - Build 17: `24db4f89-e966-4bd3-af37-11ecd77ec905` — Round 2 fixes.
    **Current build.**
  - Install page pattern:
    `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/<id>`

## Verification evidence

Run and passing before every build cut today:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:notifications:safety` (`node ./scripts/test-notification-safety-contracts.js`)
  — all 18 protected LIVE/broadcast/rota/listener files confirmed unchanged
  every time
- Clean `npx expo export --platform web` (full route list, no errors) after
  the initial implementation
- Staging migration verified live post-deploy: `content_attachments` table
  readable via PostgREST (200, RLS/grants correct), `content-media` bucket
  confirmed via Storage API with service role (`public: true`), anon
  object-level list on the bucket returns 200 (empty, as expected pre-upload)

These are contract/build checks plus the user's own physical-device testing
across two feedback rounds — not a substitute for further real-world use.

## Known risks and unfinished work

- Notification-on-publish for new events/campaigns is intentionally not
  implemented — a real gap if the product intent is for followers to be
  alerted automatically about new content, not just able to discover it.
- Only a single cover image per item; no gallery. Fine for every example
  seen so far, worth revisiting if a mosque wants a multi-photo post.
- The EAS account's plan was just upgraded from Free; no visibility here into
  the new plan's own limits/cost — worth the user confirming that side
  separately.
- Build 17 (Round 2 fixes) has not yet been re-confirmed by the user on a
  physical device as of this document — do not assume the safe-area/title-fit
  fixes are fully closed until they say so.
- This document was written alongside a large pre-existing uncommitted
  working tree containing Codex's own same-day changes (notification
  reliability, Guidance hub, nearby redesign, sign-in flow). `git status`
  cannot cleanly separate the two agents' changes from each other — treat the
  whole tree with the same care as every prior handoff has: review
  `git status`/full diff before any reset, discard, or selective commit.

## Key files

Attachments feature (new):

- `supabase/migrations/20260905150000_content_attachments.sql`
- `lib/api/admin/contentAttachments.ts`
- `components/admin/ContentAttachmentsEditor.tsx`
- `components/ContentDetailHero.tsx`
- `components/ContentDocumentsList.tsx`

Attachments feature (modified):

- `screens/admin/event/[id].tsx`, `screens/admin/campaign/[id].tsx`,
  `screens/admin/announcement/[id].tsx`
- `screens/user/event/[id].tsx`, `screens/user/campaign/[id].tsx`
- `screens/user/mosque/[id].tsx`, `screens/user/index.tsx`
- `app.json`, `package.json` (new dependency `expo-image-picker`)

## Working rules for the next agent

- Read this file, `CLAUDE.md`, and the latest `docs/codex-worklog.md` entries
  (both Codex's and this one) before changing auth, prayer times, rota,
  assignments, LIVE, or notifications.
- If extending the attachments feature: keep using
  `lib/api/admin/contentAttachments.ts`'s existing functions rather than
  writing new Storage calls; the RLS/path convention
  (`{mosque_id}/{content_type}/{content_id}/{file}`) is load-bearing for the
  storage policies.
- Do not wire a notification-on-publish trigger without re-reading the
  notification-reliability work first (staging migration
  `20260904231500_notification_preferences_reliability.sql` and later) — that
  system was just stabilized after a multi-day effort and deserves care
  before anything new touches it.
- Never put Expo/APNs network delivery inside the LIVE database transaction.
- Never expose or commit credentials.
- Do not claim a fix is complete based on lint/TypeScript/build success alone
  where physical-device behavior is in question — this document explicitly
  flags Build 17 as not yet user-confirmed.
