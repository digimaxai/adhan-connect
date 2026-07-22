# Live Broadcast Onboarding

## Ownership

The main-admin web portal owns mosque broadcast readiness. Local admins can
maintain the mosque timetable and rota, but only a main admin can provision the
dormant stream record or record readiness, test, and launch milestones.

Starting a conversation with a mosque must not enable broadcasting. Create the
mosque as `pending` and keep live streaming inactive until the mosque has agreed
to onboarding and its staff and schedule are being configured.

## Stages

1. `Setup pending`
   - Confirm the mosque profile and timezone.
   - Configure its prayer-time source or timetable.
   - Assign a local admin and at least one active muezzin.
   - Select an active default muezzin or publish usable rota assignments.
   - Select and enable the streaming provider.
2. `Ready for test`
   - Resolve every required readiness check.
   - Provision exactly one dormant stream row through the portal.
   - Confirm readiness in the portal.
3. `Test passed`
   - An operator adds the same mosque UUID to the transactional START and END
     rollout lists and deploys the hosted API.
   - Complete the publisher/listener start, audio, end, and restart test.
   - Verify hosted request telemetry, database cleanup, and LiveKit room cleanup.
   - Record the successful physical test in the portal.
4. `Live`
   - Approve the mosque for public use if it is still pending.
   - Record the launch milestone in the portal.

## Readiness And Provisioning Safety

The portal readiness action is preparation only. It must never:

- start or end a broadcast;
- create a LiveKit room;
- notify followers;
- approve or activate the mosque publicly;
- edit EAS Hosting environment variables; or
- add a mosque to the transactional rollout automatically.

Provisioning is server-side, main-admin-only, idempotent, and serialized on the
mosque database row. It preserves one existing inactive stream, refuses active
or duplicate stream state, and creates a dormant row only when none exists.

For LiveKit, the row uses `type='webrtc'` and an inert deterministic
`livekit://mosque/<mosque-id>` value to satisfy the legacy non-null `streams.url`
constraint. Followers cannot see it as live because `is_live` remains false;
actual LiveKit listening uses the room name created when a broadcast starts.

## Operator-Controlled Canary

The readiness panel reports whether transactional START and END are both active
for the selected mosque. These values are derived from the hosted deployment's
environment snapshot. The portal never returns the full allowlists.

For each new mosque:

1. Complete and confirm portal readiness.
2. Audit that it has one inactive stream and no live stream or adhan rows.
3. Add its UUID to both `LIVE_BROADCAST_START_RPC_MOSQUE_IDS` and
   `LIVE_BROADCAST_END_RPC_MOSQUE_IDS`.
4. Export and deploy the hosted API with the production EAS environment.
5. Confirm that both readiness rollout indicators are enabled.
6. Run the two-device test and the post-test database/telemetry/room audit.
7. Keep the UUID only after the test passes; otherwise remove it from both lists
   and redeploy.

Do not select global `rpc` mode until several representative mosques have passed
this process and the operator explicitly approves the broader rollout.
