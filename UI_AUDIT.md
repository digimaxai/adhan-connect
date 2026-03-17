# UI Audit - Day 1 Baseline

Date: 2026-03-01
Project: adhan-connect
Scope: Expo Router app routes and current mobile UI patterns

## Core Flows (Top 3)

1. User Home and Live Listening
- Entry: `/(user)/index`
- Route path files: `app/(user)/index.tsx`, `screens/user/index.tsx`
- Goal: show next prayer, live status, mosque context, quick access to live audio.
- Why Core: this is the primary daily value path for most users.

2. Muezzin Home and Live Broadcast Management
- Entry: `/(muezzin)/index`
- Route path files: `app/(muezzin)/index.tsx`, `screens/muezzin/user-home.tsx`
- Goal: show next assigned adhan and allow controlled transition to live broadcast.
- Why Core: operational flow for muezzin role; high trust and timing-sensitive.

3. Settings and Personalization
- Entry: `/(user)/settings` and `/(muezzin)/settings`
- Route path files: `app/(user)/settings/*`, `app/(muezzin)/settings/*`
- Goal: account, location, notifications, and profile setup that improves retention.
- Why Core: supports onboarding completion and long-term reliability.

## Screen Inventory (Prioritized)

### Core
- `/(user)/index`
- `/(user)/now`
- `/(user)/live-player`
- `/(user)/mosque/[id]`
- `/(user)/settings/index`
- `/(user)/settings/account`
- `/(user)/settings/profile`
- `/(user)/settings/location`
- `/(user)/settings/notifications`
- `/(muezzin)/index`
- `/(muezzin)/my-rota`
- `/(muezzin)/live-broadcast`
- `/(muezzin)/settings/index`
- `/(auth)/sign-in`
- `/(auth)/sign-up`

### Secondary
- `/(user)/discover`
- `/(user)/manage-mosques`
- `/(muezzin)/discover`
- `/(muezzin)/manage-mosques`
- `/(muezzin)/muezzin`
- `/(muezzin)/muezzin-live`
- `/(admin)/index`
- `/(admin)/manage-mosques`
- `/(admin)/events`
- `/(admin)/staff-rota/index`
- `/(admin)/prayer-times/index`

### Later / Legacy / Internal
- `/(tabs)/*` (legacy redirect stack)
- `app/admin/*` web-like admin area
- backup files: `app/(tabs)/index_backup.txt`, `app/(tabs)/index_backup2.txt`

## Current UI Findings

1. Colors and spacing are mostly hardcoded in screen-level `StyleSheet`s.
2. User and muezzin tab bars are visually similar but duplicated with direct hex values.
3. Existing `constants/theme.ts` is the Expo template theme and does not represent the app's current visual language.
4. Strong existing direction already present:
- Primary accent family around sky blue/cyan.
- Dark hero card surfaces for key prayer or live sections.
- Rounded cards and pill badges used consistently.

## Immediate UX Priorities

1. Tokenize the repeated values (color, spacing, radius, type scale, shadow).
2. Apply tokens first in navigation shells and high-traffic screens.
3. Standardize state styles for loading, empty, error in core flows.

## Figma Sync Notes (Lite Mode)

Use this audit as the initial Figma page content:
- Page 1: `Audit` (Core flows and inventory from this file)
- Page 2: `UI Kit` (from `theme/tokens.ts`)
- Page 3: `Core Screens` (`/(user)/index`, `/(muezzin)/index`, `/(user)/settings/index`)
