#!/usr/bin/env python3
"""Patches a freshly-prebuilt android/app/build.gradle to sign release
builds with the upload keystore (via ANDROID_KEYSTORE_PASSWORD /
ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD env vars) instead of the debug
keystore. Run after `expo prebuild` and before `./gradlew bundleRelease`,
only when android/app/upload-keystore.jks has been placed by CI.
"""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle"
text = open(path).read()

release_signing_config = """        release {
            storeFile file('upload-keystore.jks')
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }"""

anchor = "    }\n    buildTypes {"
if anchor not in text:
    raise SystemExit(f"Could not find signingConfigs anchor in {path}; template may have changed.")
text = text.replace(anchor, release_signing_config + "\n    buildTypes {", 1)

debug_release_block = (
    "        release {\n"
    "            // Caution! In production, you need to generate your own keystore file.\n"
    "            // see https://reactnative.dev/docs/signed-apk-android.\n"
    "            signingConfig signingConfigs.debug"
)
if debug_release_block not in text:
    raise SystemExit(f"Could not find release buildType block in {path}; template may have changed.")
text = text.replace(
    debug_release_block,
    "        release {\n            signingConfig signingConfigs.release",
    1,
)

open(path, "w").write(text)
print(f"Patched {path} to sign release builds with upload-keystore.jks")
