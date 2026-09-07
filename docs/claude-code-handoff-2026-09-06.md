# Claude Code Handoff — 2026-09-06

## Background — What Was Asked and Why

### The ask

The user wanted a way to enter and display rich "About" information for a mosque from the main admin role. Specifically:

1. A description of the mosque.
2. Contact and address details.
3. Optional staff/management details.
4. A services display (Airbnb-style) showing what the mosque offers.
5. Make that information visible on the listener-facing mosque detail page (mobile).

They also asked how to handle two real-world cases for **Islamic community centres** (which are not always purpose-built mosques):

- **Case 1 — Jumu'ah at a different location:** Some centres hold Friday prayers elsewhere. This was already supported by the `venue` field on `mosque_jumuah_slots`, which the listener Jumu'ah card already displays. No schema change was needed.
- **Case 2 — Not all five daily prayers are offered:** Some community centres cannot hold a Fajr congregation (for example) due to building access or volunteer availability. There was no way to capture or display this — listeners would see a blank time or `--:--` with no explanation.

### Why `prayers_not_offered text[]`

The design choice was an opt-in exclusion list rather than a boolean per prayer or a nullable time:

- A blank/null adhan time already means "timetable not uploaded yet" — it would be ambiguous.
- Storing five separate boolean columns (`fajr_offered`, etc.) is verbose and harder to query.
- An array of prayer name strings (`['fajr']`) is additive, easy to extend, and maps directly to the existing prayer key names used throughout the app.
- Admins only mark prayers that are *not* held — the default (empty array or null) means all five are offered, so existing mosques are unaffected.

The listener prayer times table now shows "Not offered here" in place of the time columns for any excluded prayer, making it clear to the user rather than leaving them with a blank entry.

---

## Summary

This session added mosque About & Contact information to the main admin editor and the listener mosque detail page, including a mechanism for community centres to mark which of the five daily prayers are not held at their location.

No live broadcast, LiveKit, streaming, rota, or notification code was touched.

---

## What Was Done

### 1. New DB migration — `prayers_not_offered` column

**File:** `supabase/migrations/20260906210000_mosque_prayers_not_offered.sql`

Adds `prayers_not_offered text[]` to `public.mosques` and grants `select` on it to `anon` and `authenticated`.

**Status: already applied to staging** via `npx supabase db push`. Production is untouched — this migration must go through the normal staging-first review before any production push.

---

### 2. Main admin mosque editor — About & Contact tab

**File:** `app/admin/mosques/[id].tsx`

- Added a third edit mode: `'about'` alongside the existing `'profile'` and `'live-stream'` modes.
- New "Edit About & Contact" modal sections:
  - **Description** — free text textarea.
  - **Address** — line 1, line 2, postcode, city (city already existed on the mosque record).
  - **Contact** — phone, email, website.
  - **Key staff** — free text textarea (stored in `management_info`).
  - **Prayer availability** — five checkboxes (Fajr, Dhuhr, Asr, Maghrib, Isha). Checking a prayer marks it as *not offered* at this location. Checked rows render with a red border so the intent is unambiguous.
  - **Services** — 16 preset checkboxes (Friday Jumu'ah, Daily congregation, Eid, Ramadan/Tarawih, Madrasah, Quran classes, Youth programs, Women's prayer area, Convert support, Funeral/Janazah, Nikah, Food bank, Parking, Wheelchair accessible, Wudu facilities, Online/live stream).
- Overview panel in the read view shows contact details when set.
- Command palette entry `'mosque-edit-about'` added.
- All state reads/writes use the correct column names: `contact_phone`, `contact_email`, `management_info`, `prayers_not_offered`, `services`, `description`, `address_line1`, `address_line2`, `postcode`, `website`.

---

### 3. Mosque workspace API — column additions

**File:** `app/api/admin/mosque-workspace+api.ts`

- `MosqueRow` type extended with `prayers_not_offered?: string[] | null`.
- Primary `SELECT` query now includes: `description, address_line1, address_line2, postcode, contact_phone, contact_email, website, management_info, services, prayers_not_offered`.

---

### 4. Listener mosque detail page — About section and prayer display

**File:** `screens/user/mosque/[id].tsx`

#### About section (new)
- Removed the now-superseded `<MosquePublicDetails mosqueId={resolvedId} />` render and its import — the new About card supersedes it entirely.
- `Mosque` type extended with all new columns.
- `SELECT` query updated to fetch: `description, address_line1, address_line2, postcode, contact_phone, contact_email, website, management_info, services, prayers_not_offered`.
- About card renders: description, tappable full address, tappable phone (`tel:` link), tappable email (`mailto:` link), tappable website (strips `https://` for display), key staff text, services chips grid.
- Card only renders when at least one field is non-empty.

#### Prayer times — "Not offered here"
- Each prayer row in the times table checks `mosque.prayers_not_offered` for the prayer key (lowercased).
- If the prayer is in the list, the adhan/iqamah columns are replaced with a single italic grey label: **"Not offered here"**.
- Style: `notOfferedLabel` — `flex:1, textAlign:'right', fontSize:12, fontStyle:'italic', color:'#94A3B8'`.

#### Column name fixes
- Fixed three stale JSX references: `mosque?.phone` → `mosque?.contact_phone`, `mosque?.email` → `mosque?.contact_email`, `mosque?.imam_info` → `mosque?.management_info`.

---

### 5. Guidance Centre (Ruislip) — seeded

**Script:** `scripts/seed-guidance-centre.js`

Re-ran the seed after the column name fix. The following is now in the DB for mosque `2b434f46-fc2d-42aa-815b-bffa0a0aad26`:

| Field | Value |
|---|---|
| `description` | Full description extracted from theguidancecentre.org |
| `address_line1` | 102 Victoria Road |
| `city` | Ruislip |
| `postcode` | HA4 0AL |
| `contact_email` | info@theguidancecentre.org |
| `website` | https://theguidancecentre.org |
| `management_info` | Trustee & Counsellor: Asjad Rahman (20+ years…) |
| `services` | 9 entries: Jumu'ah, Daily congregation, Eid, Madrasah, Quran, Women's area, Youth, Convert support, Nikah |

---

## What Codex Needs To Do

### A. Deploy to EAS Hosting (staging preview)

Codex deployed a fresh server-output web export with the explicit EAS `preview` environment on 2026-09-06.

```bash
eas deploy --alias preview
```

The `preview` alias now points to deployment `jz92ipqnks`: https://adhan-connect--preview.expo.app. The listener mosque page change is bundled here for web. TypeScript, lint, fresh web export, and an export scan for local secret values passed.

### B. Native delivery — corrected after Codex verification

The suggested `eas update --branch staging` cannot deliver to the existing
staging iOS build 17. Codex inspected its actual IPA: `Expo.plist` has
`EXUpdatesEnabled: false`. The project also has no `expo-updates` dependency,
update URL, runtime version, or preview update channel. No OTA update was published.

The user authorized a replacement staging iOS build. Build **18**
(`849ce6d8-5162-4166-9944-03a700429bbc`) was submitted using the existing
`preview` profile and staging bundle identifier. Status: **FINISHED**. Install: https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/849ce6d8-5162-4166-9944-03a700429bbc.

No new native modules are needed for the About feature itself, but the existing
binary cannot receive JS updates. Enabling OTA for future releases requires
configuration and a new compatible native build.

### C. Production migration — when ready

`20260906210000_mosque_prayers_not_offered.sql` is a safe, additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with no data loss risk. It should be applied to production as part of the normal staging-to-production promotion process alongside the rest of the pending staging delta.

Do **not** push the full `staging` branch to production yet — per `CLAUDE.md`, it is still ahead of `main` and requires the physical canary and notification acceptance gate first.

---

## Columns Added This Session (across two migrations)

Both migrations are in `supabase/migrations/` and applied to staging:

| Migration | Columns |
|---|---|
| `20260906200000_mosque_profile_contact_services.sql` | `phone`, `email`, `imam_info` (unused — see note below), `services text[]` |
| `20260906210000_mosque_prayers_not_offered.sql` | `prayers_not_offered text[]` |

> **Note on `20260906200000`:** That migration added `phone`, `email`, `imam_info` — but the mosque assistant feature (Codex, earlier session) had already added `contact_phone`, `contact_email`, `management_info`. All code was updated to use the correct `contact_*` names. The `phone`, `email`, `imam_info` columns exist in the DB but are unused and harmless. They can be dropped in a follow-up cleanup migration if desired.

---

## Do Not Regress

- Live broadcast, LiveKit, rota, notification, and muezzin assignment code was not touched.
- `lib/liveStreamFreshness.ts`, `useLiveStreamForMosque`, and the broadcast control plane are unchanged.
- `prayers_not_offered` is a display-only field — it has no effect on scheduling, rota, or broadcast logic.
- `MosquePublicDetails` component still exists in `components/` for other potential uses but is no longer rendered on the listener mosque detail page.

## Codex deployment verification — 2026-09-06

- TypeScript, lint, fresh server-output web export, and export secret scan passed.
- Preview LIVE contract smoke passed, including unauthenticated API rejection.
- Preview Quran and devotional API integration smokes passed.
- Staging anonymous reads verified the new mosque profile columns and the Guidance Centre seed (9 services).
- Listener/admin mosque routes returned 200; unauthenticated mosque workspace API returned 401.
- Notification safety contracts passed (18 protected LIVE files).
- Browser visual verification was unavailable in this session. Physical device acceptance remains outstanding.
- Production aliases, production database, and cleanup migrations were not changed.

## Follow-up — service labels (released to staging in build 19)

Added a selectable “Friday Jumu'ah Prayer (at another location)” service.
Daily congregation labels now derive from `prayers_not_offered` in the admin
editor, admin overview, and listener About chips. For example, excluding Fajr
shows “Daily congregation prayers (except Fajr)”. No exclusions retains
“(5 daily)”; excluding all five shows “(not offered here)”. The stored service
value stays unchanged, preserving existing selections without a migration.

TypeScript, lint, and focused label checks passed. This follow-up is included in preview deployment `0qmhx0zeeo` and iOS build 19.

## Follow-up — homepage Jumu’ah strip (released to staging in build 19)

Added `components/HomeJumuahStrip.tsx` between the listener homepage Next Prayer
hero and Today card. The primary mosque’s active Jumu’ah slots show khutbah and
prayer times plus each venue; tapping opens its existing Friday prayer page.
The emerald strip is static for readability, wraps long venues and larger text,
and is visible throughout the week when slots exist. Missing times/venues are
explicitly labelled to be confirmed. The former What's On Jumu’ah row was moved
here, avoiding duplicate content. Removed the old five-slot fetch limit and tied
loaded slots to their mosque ID to avoid showing stale slots after a mosque switch.

TypeScript, lint, fresh web export, and notification safety checks passed.
Visual/device acceptance remains pending. The user subsequently authorized deployment;
this is included with the services changes in preview `0qmhx0zeeo` and iOS build 19.

## Latest staging release — services and homepage Jumu’ah strip

- EAS Hosting preview deployment: `0qmhx0zeeo`.
- Preview URL: https://adhan-connect--preview.expo.app
- Staging iOS build **19**: **FINISHED** (`c7fec1e9-be0f-46ab-b617-efb16c6d0148`).
- Install: https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/c7fec1e9-be0f-46ab-b617-efb16c6d0148
- Includes the additional off-site Jumu’ah service, availability-aware daily congregation labels, and the homepage Friday strip.
- TypeScript, lint, notification safety, fresh web export, and export secret scan passed.
- Deployed LIVE, Quran, and devotional checks passed; homepage, mosque and Friday routes returned 200. Fetched web bundle contains both features.
- Physical-device visual/tap acceptance remains pending. Production is unchanged.
