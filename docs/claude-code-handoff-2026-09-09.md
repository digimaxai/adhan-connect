# Claude Code Handoff — 2026-09-09

> Superseded implementation and staging status: see [Codex review](mosque-onboarding-messaging-review-2026-09-09.md). All three feature migrations, including security hardening, are now applied to staging. The notes below describe the original handoff.

Two features completed in this session on the `staging` branch:

1. **Mosque Onboarding Forms** — hub-and-spoke redesign with three distinct forms plus full admin portal wiring
2. **Listener ↔ Mosque Messaging** — async contact feature for listeners to message their mosque and admins to reply

Both pass `npx tsc --noEmit` and `npm run lint` with zero findings. Neither migration has been applied to staging yet.

---

## 1. Mosque Onboarding Forms

### Problem
The two original "Help Your Mosque Join" forms (`invite-mosque`, `request-mosque`) were buried in listener Settings and had no clear role distinction. There was no path for mosque staff to self-register. The admin portal had no route to the `mosque_add_requests` table.

### Solution

#### Three distinct forms, one hub

| Route | Screen | Who it's for | DB `request_type` |
|---|---|---|---|
| `/(user)/mosque-admin-request` | `screens/user/mosque-admin-request.tsx` | Mosque staff self-registering | `mosque_admin_self` |
| `/(user)/invite-mosque` | `screens/user/invite-mosque.tsx` | Listener with imam/committee contact details | `invite_known_mosque` |
| `/(user)/request-mosque` | `screens/user/request-mosque.tsx` | Listener who only knows the mosque name | `request_new_mosque` |

A hub screen (`/(user)/mosque-onboarding-hub`, `screens/user/mosque-onboarding-hub.tsx`) presents these as three role-selecting tiles and routes into whichever form fits. The hub accepts an optional `name` param pre-filled from the search query on Discover.

#### Three entry points

1. **Settings** (`screens/user/settings/index.tsx`) — collapsed from two rows to one: "Get your mosque listed" → `/(user)/mosque-onboarding-hub`
2. **Discover zero-results** (`screens/user/discover.tsx`) — when search returns nothing, a `missingCard` renders with a "Get it added" CTA that passes the search query as `name` to the hub
3. **Discover persistent strip** (`screens/user/discover.tsx`) — a "Don't see your mosque? Get it added →" strip pinned above the results list (hidden in muezzin context)

#### Self-registration form (`mosque-admin-request.tsx`)
- Role chip selector (Imam/Khatib, Committee Secretary, Trustee, Administrator, Mosque Manager, Other) stored in `submitter_role_at_mosque`
- Required fields: name, role, mosque name, city/area, email; optional phone + message
- Displays "What your congregation gets" info card (prayer times, live adhan, events, staff rota tools)
- Uses `tokens.color.text.accent` (#0EA5E9) for active chip states — **not** `tokens.color.brand.primary` which does not exist

#### Database extension
**`supabase/migrations/20260909000000_mosque_add_requests_admin_self.sql`** — two changes:
- Extends `mosque_add_requests_request_type_check` CHECK constraint to add `'mosque_admin_self'`
- Adds `submitter_role_at_mosque text` column

**Status: NOT YET applied to staging.** Apply this before testing the self-registration form.

#### Email notifications
Every form submission fires a fire-and-forget POST to `app/api/notify-mosque-request+api.ts` via `lib/api/mosqueRequestNotify.ts`.

The server route:
- Validates Bearer token (user must be authenticated)
- Returns `{ skipped: true }` (200) if any of `RESEND_API_KEY`, `MOSQUE_REQUEST_NOTIFY_EMAIL`, `MOSQUE_REQUEST_NOTIFY_FROM` is missing — **fail-open, never blocks the user**
- Builds an HTML email with teal gradient header, type badge, priority notice for `mosque_admin_self`, detail table, CTA button
- Subject: `[Adhan Connect] New ${label}: ${mosque_name}`

Required env vars (all server-only, never `EXPO_PUBLIC_`):
```
MOSQUE_REQUEST_NOTIFY_EMAIL=   # recipient address
MOSQUE_REQUEST_NOTIFY_FROM=    # verified Resend sender, e.g. Adhan Connect <noreply@yourdomain.com>
MOSQUE_REQUEST_ADMIN_URL=https://adhanconnect.com/admin/mosque-requests
```

#### Admin portal wiring — four surfaces
Previously the `mosque-requests` page existed but had no navigation.

| Surface | File | Change |
|---|---|---|
| Sidebar nav | `components/admin/web/AdminSidebar.tsx` | "Mosque Requests" added as second `globalItems` entry with InboxIcon SVG |
| Command palette | `components/admin/web/AdminShell.tsx` | `route-mosque-requests` action with keywords: requests, onboarding, invite, new mosque, inbox |
| Dashboard attention banner | `app/admin/index.tsx` | Blue banner when `newRequestCount > 0`; amber "New requests" metric card |
| Dashboard quick action | `app/admin/index.tsx` | "Mosque Requests" first in the quick actions grid |

The `mosque-requests` admin page (`app/admin/mosque-requests/index.tsx`) now:
- Shows a `TypePill` badge (`mosque_admin_self` = green, `invite_known_mosque` = blue, `request_new_mosque` = slate)
- Displays `submitter_role_at_mosque` beneath the contact name for self-register rows
- Has a "Self-register" filter option in the type dropdown

#### Important: TypeScript apostrophe trap
Strings with `'` (U+2019 curly apostrophe) inside single-quoted TSX string literals break the TypeScript parser — the parser sees them as the closing quote and reports `TS1005: ',' expected` errors. All such strings in the new files use **double-quoted string literals**:
```typescript
body: "We'll guide you through it."   // ✓ double quotes, apostrophe safe
body: 'We\'ll guide you through it.'  // ✓ escaped — also works
body: 'We'll guide you through it.'   // ✗ U+2019 inside single quotes — breaks TSC
```

---

## 2. Listener ↔ Mosque Messaging

### Design decisions (confirmed with product owner)
- **One thread per listener-mosque pair** (not per-prayer or per-topic)
- **Rate limit: 5 messages per listener per mosque per 24 hours**, enforced server-side
- **Async, not real-time** — polling on screen focus (`useFocusEffect`), no Supabase Realtime
- **All local admins** of a mosque see and can reply to listener messages
- **Email alert** goes to the platform admin email on every new listener message (same Resend env vars as mosque requests)
- **Soft delete only** — listeners flag `deleted_by_listener = true`; admins flag `archived_by_admin = true`; no hard deletes

### Database

**`supabase/migrations/20260909001000_mosque_messages.sql`**

```sql
CREATE TABLE public.mosque_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id       uuid        NOT NULL REFERENCES public.mosques(id)    ON DELETE CASCADE,
  listener_id     uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  sender_type     text        NOT NULL CHECK (sender_type IN ('listener', 'admin')),
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_by_admin   boolean     NOT NULL DEFAULT false,
  read_by_listener boolean    NOT NULL DEFAULT false,
  deleted_by_listener boolean NOT NULL DEFAULT false,
  archived_by_admin   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

Two indexes: `(mosque_id, listener_id, created_at DESC)` and `(mosque_id, created_at DESC)`.

**RLS policies:**
- `listener_select_own_messages` — listeners SELECT their own rows where `deleted_by_listener = false`
- `listener_update_own_messages` — listeners UPDATE their own rows (mark read, soft delete)
- `admin_select_mosque_messages` — mosque admins SELECT all rows for their mosque (via `mosque_admins` EXISTS check)
- `admin_update_mosque_messages` — mosque admins UPDATE rows for their mosque (mark read, archive)

**No INSERT policy** — all inserts go through the service-role send API route, bypassing RLS.

**Status: NOT YET applied to staging.** Apply this migration before any messaging test.

### API Route

**`app/api/mosque-messages/send+api.ts`** — POST only

Auth: Bearer token → `supabaseAdmin.auth.getUser()` (same pattern as all other server routes).

Request body:
```typescript
{
  mosque_id: string;
  body: string;              // 1-2000 chars
  sender_type: 'listener' | 'admin';
  listener_id?: string;      // required when sender_type === 'admin'
}
```

Logic:
1. Validate token + body fields
2. If `sender_type === 'listener'`: rate-limit check (count rows in last 24h for this listener+mosque); return 429 if ≥ 5
3. If `sender_type === 'admin'`: verify caller is in `mosque_admins` for `mosque_id`; 403 otherwise
4. Verify mosque exists
5. Insert row via service role
6. If listener message: fire-and-forget `notifyAdmins()` (calls Resend, swallows all errors)
7. Return `{ message }` (the inserted row)

The notify function reuses `RESEND_API_KEY`, `MOSQUE_REQUEST_NOTIFY_EMAIL`, `MOSQUE_REQUEST_NOTIFY_FROM`, and `MOSQUE_REQUEST_ADMIN_URL` — no new env vars needed.

### Client Library

**`lib/api/mosqueMessages.ts`** — all client-side helpers

| Export | Purpose |
|---|---|
| `fetchListenerThread(mosqueId)` | Supabase SELECT for listener's own thread (RLS scoped) |
| `fetchAdminThread(mosqueId, listenerId)` | Supabase SELECT for one admin thread |
| `fetchAdminConversations(mosqueId)` | All non-archived messages for a mosque, newest first |
| `buildConversations(messages)` | Deduplicates by `listener_id`, returns `ConversationSummary[]` sorted newest-first with unread count |
| `sendMessage(params)` | POST to `/api/mosque-messages/send` with Bearer token |
| `markThreadReadByListener(mosqueId)` | Supabase UPDATE `read_by_listener = true` |
| `markThreadReadByAdmin(mosqueId, listenerId)` | Supabase UPDATE `read_by_admin = true` |
| `deleteListenerThread(mosqueId)` | Supabase UPDATE `deleted_by_listener = true` |
| `archiveAdminThread(mosqueId, listenerId)` | Supabase UPDATE `archived_by_admin = true` |

### Listener Screen

**`screens/user/mosque-messages.tsx`** (305 lines)  
Route: `app/(user)/mosque-messages/[mosqueId].tsx` → re-export  
Registered in `app/(user)/_layout.tsx` as `<Tabs.Screen name="mosque-messages/[mosqueId]" options={{ href: null, headerShown: false }} />`

Entry point: "Message this mosque" blue button on mosque detail page (`screens/user/mosque/[id].tsx`, added between the Follow pill and Live broadcast card). Only visible when `userId` is set (must be signed in). Routes to `/(user)/mosque-messages/[mosqueId]` with `mosqueId = resolvedId ?? id`.

Features:
- Chat bubbles: listener messages right/blue (`#0EA5E9`), mosque replies left/white
- `useFocusEffect` polls the thread on every focus
- Marks thread read immediately on load (`markThreadReadByListener`)
- Trash icon top-right → `Alert.alert` confirm → `deleteListenerThread` → `router.back()`
- Guest-gated: shows sign-in prompt if `userId` is null
- Unsent state: shows "Start a conversation" empty state with mosque name
- `KeyboardAvoidingView` with `behavior='padding'` on iOS
- Send button disabled when draft empty, not sending, or `!supportsServerApi()`

### Admin Inbox Screen

**`screens/admin/messages-inbox.tsx`** (202 lines)  
Route: `app/(admin)/messages.tsx` → re-export  
Registered in `app/(admin)/_layout.tsx` as `<Stack.Screen name="messages" />`  
Added to `app/(admin)/index.tsx` as first card in `contentTools` (icon: `chatbubbles-outline`, blue)

Features:
- Uses `useAdminMosque()` — note the field is `selectedMosque.mosqueId` (not `.id`)
- `useFocusEffect` polls `fetchAdminConversations(mosqueId)` on every focus
- `buildConversations()` deduplicates messages into one row per listener, with unread count badge
- Each row shows: person icon, "Listener" label (anonymous — listener identity not exposed), time-ago, message preview, unread count or chevron
- Empty state shown when no conversations
- No-mosque selected state shown when `useAdminMosque` returns null
- Pull-to-refresh

### Admin Thread Screen

**`screens/admin/messages-thread.tsx`** (273 lines)  
Route: `app/(admin)/messages-thread.tsx` → re-export  
Registered in `app/(admin)/_layout.tsx` as `<Stack.Screen name="messages-thread" />`

Params: `listenerId: string`, `mosqueId: string`

Features:
- Chat bubbles: admin messages right/dark (`#0F172A`), listener messages left/white
- `useFocusEffect` polls on every focus; marks thread read immediately on load
- Archive icon top-right → `Alert.alert` confirm → `archiveAdminThread` → `router.back()`
- Send uses `sender_type: 'admin'` + `listener_id` param
- `KeyboardAvoidingView` with `behavior='padding'` on iOS

---

## Files Created

| File | Type | Description |
|---|---|---|
| `supabase/migrations/20260909000000_mosque_add_requests_admin_self.sql` | Migration | Extends `mosque_add_requests` CHECK + adds `submitter_role_at_mosque` column |
| `supabase/migrations/20260909001000_mosque_messages.sql` | Migration | Creates `mosque_messages` table with RLS |
| `app/api/notify-mosque-request+api.ts` | Server route | Email alert for new mosque request submissions |
| `app/api/mosque-messages/send+api.ts` | Server route | Rate-limited message send + admin email alert |
| `lib/api/mosqueRequestNotify.ts` | Client lib | Fire-and-forget notify call for mosque request forms |
| `lib/api/mosqueMessages.ts` | Client lib | All messaging client helpers |
| `screens/user/mosque-onboarding-hub.tsx` | Screen | Hub with 3 role-selecting tiles |
| `screens/user/mosque-admin-request.tsx` | Screen | Mosque staff self-registration form |
| `screens/user/mosque-messages.tsx` | Screen | Listener chat thread |
| `screens/admin/messages-inbox.tsx` | Screen | Admin conversation inbox |
| `screens/admin/messages-thread.tsx` | Screen | Admin thread view with reply |
| `app/(user)/mosque-onboarding-hub.tsx` | Route wrapper | Re-export |
| `app/(user)/mosque-admin-request.tsx` | Route wrapper | Re-export |
| `app/(user)/mosque-messages/[mosqueId].tsx` | Route wrapper | Re-export |
| `app/(admin)/messages.tsx` | Route wrapper | Re-export |
| `app/(admin)/messages-thread.tsx` | Route wrapper | Re-export |

## Files Modified

| File | What changed |
|---|---|
| `app/(user)/_layout.tsx` | Registered `mosque-admin-request`, `mosque-onboarding-hub`, `mosque-messages/[mosqueId]` as hidden tab routes |
| `app/(admin)/_layout.tsx` | Added `messages` and `messages-thread` to admin Stack |
| `app/(admin)/index.tsx` | Added "Messages" card to `contentTools` |
| `app/admin/index.tsx` | New-request count, attention banner, metric card, quick action, command palette entry |
| `app/admin/mosque-requests/index.tsx` | TypePill component, `mosque_admin_self` filter, `submitter_role_at_mosque` display |
| `components/admin/web/AdminSidebar.tsx` | "Mosque Requests" in `globalItems`, InboxIcon SVG |
| `components/admin/web/AdminShell.tsx` | `route-mosque-requests` command palette action |
| `screens/user/settings/index.tsx` | Collapsed mosque section to one hub row |
| `screens/user/discover.tsx` | Zero-results `missingCard` + persistent `missingStrip` both routing to hub |
| `screens/user/invite-mosque.tsx` | Updated copy, "What they'll receive" info card, notify pattern |
| `screens/user/request-mosque.tsx` | Updated copy, "How it works" info card, notify pattern |
| `screens/user/mosque/[id].tsx` | "Message this mosque" button + `messageBtn`/`messageBtnText` styles |
| `.env.example` | Added `MOSQUE_REQUEST_NOTIFY_EMAIL`, `MOSQUE_REQUEST_NOTIFY_FROM`, `MOSQUE_REQUEST_ADMIN_URL` |

---

## Staging Checklist

1. **Apply both migrations in order:**
   ```
   20260909000000_mosque_add_requests_admin_self.sql
   20260909001000_mosque_messages.sql
   ```
2. **Set env vars** on staging EAS / Supabase project:
   - `MOSQUE_REQUEST_NOTIFY_EMAIL` — your notification recipient
   - `MOSQUE_REQUEST_NOTIFY_FROM` — verified Resend sender (already has a domain for SMTP)
   - `MOSQUE_REQUEST_ADMIN_URL` — staging admin URL (or leave as production default, it's just a link in the email)
3. **Test mosque onboarding hub** — Settings → "Get your mosque listed" → hub appears with 3 tiles
4. **Test Discover strip** — search returns results → "Don't see your mosque?" strip is visible
5. **Test Discover zero-results** — search for something nonexistent → `missingCard` with "Get it added"
6. **Test self-registration** — complete `mosque-admin-request` form as a logged-in listener; verify row appears in `mosque_add_requests` with `request_type = 'mosque_admin_self'`
7. **Test messaging** — as a listener, open a mosque detail page, tap "Message this mosque", send a message; verify: row in `mosque_messages`, unread count on admin inbox, admin can reply
8. **Test rate limit** — try sending a 6th message within 24h; should receive 429 response
9. **Test admin archive** — admin archives a thread; verify it disappears from inbox (archived_by_admin = true)
10. **Test listener delete** — listener deletes conversation; verify thread disappears from their view

---

## Known Limitations / Future Work

- **Listener anonymity in admin inbox**: Listener identity is not displayed (shows "Listener" only). If per-user identity is desired later, join `auth.users` with service role in a new admin API route.
- **Per-admin email routing**: Email alerts go to `MOSQUE_REQUEST_NOTIFY_EMAIL` (platform admin), not to each local mosque admin individually. To send per-admin emails, add a service-role lookup of `mosque_admins → auth.users.email` in the send route.
- **Admin reply notification**: Admins replying to listeners do not currently trigger an email to the listener. Can be added to the send route's `sender_type === 'admin'` branch when listener email lookup is in place.
- **Messaging on web** (`supportsServerApi()` is true on web so it works) — the `KeyboardAvoidingView` uses `undefined` behavior on Android and web, which is acceptable for MVP.
- **No unread badge on the admin dashboard** — just the card in `contentTools`. Could add an unread count badge to the card later.
