# Muezzin Duties & Assignment Logic (MVP with Rota Highlighting)

## Overview
- Muezzin Home now surfaces rota assignments from `staff_rota` for the current day (per mosque).
- Assigned prayers are highlighted in Today’s Adhans list with a soft accent and “Assigned to You” badge.
- Next Adhan selection prefers today’s assigned prayer time; if none/upcoming has passed, it falls back to the standard next adhan logic.
- Live Broadcast screen shows a gentle note if you are assigned to the active prayer.

## Data Sources
- `staff_rota`: assignments filtered by `mosque_id`, `date = today`, `muezzin_user_id = auth.uid()`.
- `adhans`: daily rows for schedule/history and next/live detection.
- `mosque_prayer_times`: still used as fallback for general timing display.

## Hook Behavior (useMuezzinSchedule)
1) Resolve active mosque via `muezzins` (primary assignment).
2) Load today’s `adhans` for that mosque.
3) Load today’s `staff_rota` for the signed-in muezzin:
   - `assignedPrayers`: boolean map per prayer (default false if no rota).
   - `assignedAdhanTimes`: adhan_time per prayer (nullable).
4) Next Adhan logic:
   - Prefer earliest upcoming assigned adhan_time (> now); if an `adhans` row exists for that prayer, use it; otherwise synthesize a scheduled entry.
   - If no upcoming assigned, fall back to earliest upcoming `adhans` row.
5) Hook returns loading/error/mosque info + todayAdhans + nextAdhan + assigned maps.

## UI Highlighting
- Today’s Adhans list (Muezzin Home):
  - Each prayer row keeps existing layout.
  - If assigned: subtle border + soft background + “Assigned to You” badge on the right.
  - No reordering; if no assignments, list renders as before.
- Next Adhan card: countdown uses `nextAdhan` from the hook (assignment-aware).
- Live Broadcast: shows “You are assigned to this adhan today.” under the prayer name when applicable.

## Fallback Rules
- No rota rows → assignedPrayers all false; UI renders without badges; nextAdhan falls back to standard logic.
- Missing adhan_time in rota → treated as un-timed for nextAdhan preference; normal schedule remains.
- Broadcast is never blocked by rota; assignments are informational only.

## Future Considerations
- Enforce permissions (only assigned muezzin can start/end a given prayer).
- Notifications to assigned muezzins before their slot.
- Multi-day assignment views and overrides.
- Surface iqama offsets or validation against prayer_times for consistency.
