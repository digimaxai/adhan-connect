# Staging Push, Nearby, and LIVE Acceptance

Use this gate on physical iPhones before considering the notification work
accepted or promoting it. It complements—not replaces—the existing live audio
canary in `iphone-livekit-e2e-test-app.md`.

## Preconditions

1. Create a fresh internal staging build after `expo-notifications` and
   `expo-device` were added. An older development binary can still open the app
   but cannot register for push.
2. Confirm the installed name is **Adhan Connect Staging** and its bundle ID is
   `com.maksumsdigitalagency.adhanconnect.staging`.
3. Use three staging accounts/devices where possible:
   - local admin for assignment and rota
   - assigned muezzin/publisher
   - listener/subscriber
4. Keep production dashboards and credentials closed throughout this test.

## Device permission and preference checks

1. Sign in on the listener device. Open **Settings → Notifications**.
2. Enable an Adhan alert. Confirm iOS asks for permission only at that moment,
   not during sign-in.
3. Verify the listener can independently choose upcoming reminders, lead time,
   prayers, primary/all-followed scope, and LIVE alerts.
4. On the muezzin device, verify assignment updates, duty reminders/lead times,
   and LIVE status are independent controls.
5. Disable one control and confirm the other controls retain their values.
6. Sign out, sign into a different account on the same phone, and confirm the
   previous account receives no further private notifications on that device.

## Nearby and travel checks

1. Allow foreground location. Confirm **Near you now** shows distance, next
   prayer/time, timetable vs calculated-estimate label, and any active LIVE
   mosque.
2. Tap **Directions**, **View mosque**, and—only on a LIVE row—**Listen live**.
3. Background the app, move far enough to change the nearby ordering, reopen
   it, and confirm the location/context refreshes without changing the primary
   or followed mosques.
4. Enable **Current-area LIVE alerts** for 5, 15, then 30 km. Confirm the UI
   explains the approximately 1 km precision and 24-hour expiry.
5. Turn travel alerts off and confirm the primary/followed mosque list remains
   unchanged.

## Protected end-to-end LIVE test

1. First test the active mosque default muezzin without an explicit rota row:
   select the 5-, 10-, and 30-minute duty leads, leave and reopen the screen to
   confirm all three persist, set a staging prayer at least 32 minutes ahead,
   background/lock the phone, and confirm all three physical pushes arrive.
2. Next, as local admin, save a real upcoming explicit rota slot and confirm
   its assignee takes precedence over the default muezzin.
3. Add an approved/provisional cover and confirm its volunteer takes precedence
   over the explicit rota assignee. Remove the cover after the test.
4. Confirm the muezzin's existing Activity inbox still records the change;
   when opted in, confirm its push also arrives and opens the rota workspace.
5. Follow the test mosque on the listener phone and enable its LIVE alert.
6. Start the Adhan from the assigned muezzin phone using the established LIVE
   broadcast screen.
7. Confirm all of the following independently:
   - publisher remains connected and broadcasting continuously
   - listener homepage changes to LIVE
   - listener LIVE page agrees with the homepage
   - opted-in listener push arrives and opens the correct LIVE mosque
   - a nearby travel-alert device receives a push only when inside its radius
   - an opted-out device receives no push
   - listener hears uninterrupted real audio on a second device
8. End the broadcast. Confirm audio stops, homepage/LIVE state clears, the
   stream and Adhan records are ended, and the LiveKit room is absent.
9. Repeat start/end once to confirm idempotency and no duplicate push for the
   same Adhan event.

## Failure inspection

In staging only, inspect `push_devices`, `notification_events`, and
`notification_deliveries`. A delivery progresses through pending/processing to
sent/delivered; retries record a bounded error and a removed APNs device must
be deactivated. Push failure must never alter `adhans`, `streams`,
`staff_rota`, `muezzins`, or `subscriptions`.

Do not treat a successful Expo ticket alone as delivery proof: the physical
notification and the later APNs receipt are the acceptance evidence.
