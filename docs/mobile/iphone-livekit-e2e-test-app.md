# iPhone LiveKit E2E Test App

This is the recommended path for testing Adhan Connect live broadcasts on real iPhones.

The app uses native LiveKit/WebRTC modules, so Expo Go is not enough for the real broadcast path. Use a custom Expo development build first, then move to EAS internal distribution or TestFlight when you need easier sharing.

## Recommended Sequence

1. Prepare the repo on Windows.
2. Use the MacBook Air for the first physical iPhone install with Xcode.
3. Run the API routes from the MacBook over LAN for the first end-to-end test.
4. Move to EAS internal distribution once you want a shareable install link.
5. Move to TestFlight once the flow is stable enough for broader testers.

## What Windows Can Do Now

Windows is fine for most source work and Android testing. It can also trigger EAS cloud iOS builds if you have an Apple Developer Program membership.

Windows cannot do the easiest local iPhone install path because iOS device builds require Xcode/macOS when building locally. Do not generate or commit the `ios/` folder from Windows for this test path.

Prep from Windows:

```powershell
npm ci
npm run lint
git status --short
```

If you use EAS cloud builds from Windows:

```powershell
npm install --global eas-cli
eas login
eas device:create
$env:IOS_BUNDLE_IDENTIFIER='com.yourdomain.adhanconnect.test'
eas build --platform ios --profile development
```

For EAS iOS builds on real devices, use a paid Apple Developer account and register each iPhone UDID.

## First iPhone Test On The MacBook

Install on the MacBook:

1. Xcode from the Mac App Store.
2. Node.js LTS.
3. Git.
4. Optional but helpful: Expo Orbit.

Open Xcode once and accept the license/components. Then clone the repo and install dependencies:

```bash
git clone <repo-url>
cd adhan-connect
npm ci
```

`npm ci` runs `patch-package`, which applies the LiveKit WebRTC patch in `patches/`.

Find the MacBook LAN IP:

```bash
ipconfig getifaddr en0
```

If the Mac is on Ethernet or a different adapter, use:

```bash
ifconfig
```

Set local environment values in `.env.local`. Do not commit secrets.

```bash
EXPO_FORCE_WEBCONTAINER_ENV=0
EXPO_PUBLIC_API_BASE_URL=http://<MAC_LAN_IP>:8081
```

Keep the server-side values needed by the Expo Router API routes in `.env.local` too:

```bash
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE=<service-role-key>
LIVEKIT_API_KEY=<livekit-api-key>
LIVEKIT_API_SECRET=<livekit-api-secret>
LIVEKIT_URL=<livekit-wss-url>
```

If auth redirects are part of the iPhone test, use a mobile-safe redirect URL such as the app scheme instead of `localhost`.

Install the app onto a plugged-in, unlocked iPhone:

```bash
IOS_BUNDLE_IDENTIFIER=com.yourdomain.adhanconnect.test npm run ios:device
```

If signing fails, open the generated Xcode workspace under `ios/`, select your Apple team, and make sure the bundle identifier is unique for your Apple account. The generated `ios/` folder is local build output and should stay uncommitted.

Start the dev server after the app is installed:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<MAC_LAN_IP>:8081 npm run start:dev-client
```

Both iPhones must be on the same Wi-Fi network as the MacBook. If either phone cannot load `http://<MAC_LAN_IP>:8081` in Safari, fix Wi-Fi, firewall, VPN, or hotspot isolation before debugging app code.

## Live Broadcast Test

Use two real iPhones if possible:

1. iPhone A signs in as a muezzin.
2. iPhone B signs in as a listener.
3. Confirm the mosque stream provider is LiveKit.
4. Start the broadcast from the muezzin phone.
5. Accept microphone permission on iPhone A.
6. Confirm LiveKit Cloud shows the room and the publisher participant.
7. Open the listener live page on iPhone B.
8. Confirm LiveKit Cloud shows a second participant.
9. Speak into iPhone A and confirm iPhone B hears audio.
10. End the broadcast and confirm listener playback stops.

## Troubleshooting

`WebRTC native module not found`: the phone is running Expo Go or an old build. Install the custom development build again.

`Token request timed out`: the iPhone cannot reach the Expo server API routes. Check `EXPO_PUBLIC_API_BASE_URL`, LAN IP, firewall, VPN, and that both phones are on the same network as the MacBook.

Microphone permission does not appear: uninstall the app from the phone and reinstall, or reset the app's microphone permission in iOS Settings.

LiveKit room has only one participant: the listener did not join. Check listener auth, mosque playback access, and `/api/listener/livekit-token`.

Audio is silent but both participants are present: check the muezzin audio meter, microphone permission, mute switch/audio route, and LiveKit publisher diagnostics.

## Shareable Builds After The First Test

Use EAS internal distribution when you want a link testers can install from:

```bash
eas device:create
IOS_BUNDLE_IDENTIFIER=com.yourdomain.adhanconnect.test eas build --platform ios --profile development
```

EAS internal distribution uses ad hoc provisioning, so new iPhones must be registered before the build or you must refresh/resign the build.

For a non-dev preview build, deploy the API routes to a stable URL first, then build with that URL:

```bash
npx expo export --platform web
eas deploy --environment preview
EXPO_PUBLIC_API_BASE_URL=https://<preview-host>.expo.app eas build --platform ios --profile preview
```

Use EAS environment variables for server-side values such as Supabase service role and LiveKit secrets. Do not put server secrets in `EXPO_PUBLIC_` variables.

Use TestFlight after the LiveKit iPhone flow works locally and the backend/API routes are deployed to a stable environment. TestFlight is easier for remote testers, but slower to set up than the first local development build.

## Security Note

Server credentials should live in `.env.local` locally and in EAS environment variables for hosted builds. If server secrets have ever been committed or shared, rotate them before a wider test.
