# Android Phone Launch

Use this path when you want to run Adhan Connect on a real Android phone from this Windows repo.

This app uses native LiveKit/WebRTC modules, so Expo Go is not enough for the real app. Use a custom Expo development build.

## Easiest Option

1. Install Android Studio or Android SDK Platform Tools on the PC.
2. On the Android phone, enable Developer options.
3. Enable USB debugging.
4. Plug the phone into the PC with a data cable.
5. Unlock the phone and accept the "Allow USB debugging?" prompt.
6. Run the doctor:

```powershell
npm run android:doctor
```

7. Fix any `FAIL` lines, then run:

```powershell
npm run android:phone
```

The script will:

- find the connected Android phone
- install the custom development build if it is missing
- set up `adb reverse` for port `8081`
- start Expo in dev-client mode
- open the app on the phone

Leave that terminal open while you use the app.

## What Doctor Checks

`npm run android:doctor` checks:

- the PC can resolve and reach Supabase Auth with the anon key
- Metro is running on `localhost:8081`, if already started
- ADB can see the Android phone
- the development build is installed
- `adb reverse` is active for port `8081`
- Android's active network is validated
- whether the phone is on a Guest Wi-Fi network

The doctor does not print secret values.

## When To Reinstall

Run this if the app is already installed but native config or native dependencies changed:

```powershell
npm run android:phone:reinstall
```

That is also the fix for errors like:

```text
WebRTC native module not found
```

## Useful Variants

Clear Metro cache:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/android-phone.ps1 -Clear
```

Pick a specific phone when more than one Android device is connected:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/android-phone.ps1 -DeviceSerial <device-serial>
```

Use LAN instead of USB localhost routing:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/android-phone.ps1 -HostMode lan
```

Use this only when the phone and PC are on the same Wi-Fi and the phone can reach the PC.

## No USB Cable

If the development build is already installed on the phone, you can try LAN:

```powershell
npm run start:dev-client:lan
```

Open Adhan Connect on the phone and choose the dev server, or scan the dev-client QR from Expo. Do not scan it with Expo Go.

If LAN is blocked by Wi-Fi, firewall, VPN, or hotspot isolation, try tunnel mode:

```powershell
npm run start:dev-client:tunnel
```

Tunnel mode may require network access and an Expo/ngrok login.

## Beta Builds

The USB/Metro steps are only for local development builds. A beta build should be simpler:

- install the app from an internal distribution link
- use a hosted API URL, not `localhost` or a LAN IP
- use the normal Supabase project URL
- require only normal phone internet access

If a beta build cannot sign in while normal websites work on the phone, investigate Supabase config, auth settings, or app credentials. If normal websites do not work, it is still a phone/network problem.

## Troubleshooting

`No Android phone is ready over USB`: enable USB debugging, use a data cable, unlock the phone, and accept the debugging prompt.

`unauthorized`: accept the "Allow USB debugging?" prompt on the phone. If it does not appear, toggle USB debugging off/on and reconnect the cable.

The app opens but says it cannot find the dev server: keep the terminal open, make sure port `8081` is free, then rerun `npm run android:phone`.

API or token requests time out on a physical phone: prefer `npm run android:phone`, because it sets `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8081` and routes that back to the PC with `adb reverse`.

`TypeError: Network request failed` on sign-in: the app opened, but the phone could not reach Supabase. Check that the phone can open a normal website, switch from Guest Wi-Fi to the main Wi-Fi or mobile data, and disable VPN or Private DNS while testing.

Expo Go opens instead of Adhan Connect: uninstall Expo Go from the test path or open the Adhan Connect development build directly.
