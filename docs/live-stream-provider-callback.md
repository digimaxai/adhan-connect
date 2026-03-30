# Live Stream Provider Callback

This project accepts upstream encoder or vendor status updates at:

`POST /api/integrations/live-stream-provider-status`

Use this callback to report encoder connection state for a specific mosque. The app uses it to move RTMP-style workflows from "manual check required" toward a confirmed ready or live state.

## Authentication

Send the mosque-specific callback secret using either:

- `x-live-stream-secret` header
- `x-mosque-stream-secret` header
- `secret` field in the JSON body

The secret is configured per mosque in the main-admin mosque workspace.

## JSON body

```json
{
  "mosqueId": "00000000-0000-0000-0000-000000000000",
  "providerStatus": "connected",
  "encoderConnected": true,
  "playbackActive": false,
  "providerStreamId": "vendor-stream-123",
  "message": "Encoder connected and waiting for media",
  "observedAt": "2026-03-26T21:30:00.000Z",
  "payload": {
    "raw": "provider-specific payload"
  }
}
```

## Supported `providerStatus` values

- `offline`
- `connecting`
- `connected`
- `live`
- `error`
- `unknown`

## Behavior

- `connected` or `live` marks the upstream encoder as connected.
- `live` also marks playback as active unless `playbackActive` is sent explicitly.
- `error` or `offline` downgrades upstream readiness.
- Raw provider payloads are stored for debugging and future vendor-specific adapters.

## Example

```bash
curl -X POST "$APP_BASE_URL/api/integrations/live-stream-provider-status" \
  -H "Content-Type: application/json" \
  -H "x-live-stream-secret: $MOSQUE_CALLBACK_SECRET" \
  -d '{
    "mosqueId": "00000000-0000-0000-0000-000000000000",
    "providerStatus": "live",
    "encoderConnected": true,
    "playbackActive": true,
    "providerStreamId": "vendor-stream-123",
    "message": "Stream is live"
  }'
```

## Recommended next step

Add a vendor-specific adapter that translates the provider webhook payload into this normalized callback format.
