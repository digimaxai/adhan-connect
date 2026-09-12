#!/bin/sh
# Xcode Cloud post-clone hook.
#
# This repo uses Expo's managed (CNG) workflow: the ios/ directory is
# generated from app.config.js rather than hand-edited. Xcode Cloud needs a
# real .xcodeproj already in the repo to detect a scheme when a workflow is
# first configured, so ios/ is committed as a baseline — but this script
# regenerates it fresh on every Xcode Cloud run so app.config.js / plugin
# changes always take effect, without anyone needing to manually re-run
# prebuild and re-commit ios/ for ordinary JS/config changes.
#
# Deliberately omits `--clean`: that flag deletes the whole ios/ directory
# first, which would delete this very script (ios/ci_scripts/ci_post_clone.sh)
# while it is still running. Plain `expo prebuild` updates/creates the files
# it manages in place instead, so ci_scripts/ survives.
#
# APP_VARIANT (staging/production) and the EXPO_PUBLIC_* values are supplied
# as Environment Variables on the Xcode Cloud workflow in App Store Connect,
# not from any .env file (Xcode Cloud does not check out anything outside git).

set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Installing JS dependencies..."
npm ci

echo "Regenerating native iOS project (APP_VARIANT=${APP_VARIANT:-unset})..."
npx expo prebuild --platform ios

cd ios
echo "Installing CocoaPods dependencies..."
pod install
