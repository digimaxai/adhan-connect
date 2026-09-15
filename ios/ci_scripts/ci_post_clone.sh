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

# Xcode Cloud runners are Apple Silicon (arm64). Make sure the native arm64
# Homebrew prefix (/opt/homebrew) is searched before any Intel prefix
# (/usr/local) that may also exist on the image, otherwise later tools
# (Node, CocoaPods/Ruby) can end up resolving to x86_64 binaries and running
# under Rosetta translation, which CocoaPods explicitly warns against and
# which has been observed to cause flaky network behavior during pod install.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

# Defensively clear any inherited proxy environment variables. A stray
# HTTP(S)_PROXY pointing at a local/dev-only proxy (e.g. left over from a
# debugging tool's workflow environment variable in App Store Connect) causes
# git clones of pod dependencies (e.g. SocketRocket) to fail with
# "Failed to connect to localhost port ...". Xcode Cloud's build VMs do not
# need a proxy to reach github.com or the CocoaPods CDN.
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY

# Xcode Cloud's macOS images don't reliably have Node.js on PATH for this
# script's shell, despite having Homebrew preinstalled. Install it explicitly.
echo "Installing Node.js via Homebrew..."
brew install node@20
brew link --overwrite --force node@20

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Installing JS dependencies..."
npm ci

# Xcode's "Bundle React Native code and images" phase does not reliably see
# workflow environment variables, so it only picks up EXPO_PUBLIC_* values from
# a real .env file (same as the Android CI fix). .env.local is git-ignored.
echo "Writing .env.local from EXPO_PUBLIC_* workflow variables..."
env | /usr/bin/grep -E '^EXPO_PUBLIC_[A-Z0-9_]+=' > .env.local || true
echo "  $(wc -l < .env.local | tr -d ' ') EXPO_PUBLIC_* values written"

echo "Regenerating native iOS project (APP_VARIANT=${APP_VARIANT:-unset})..."
npx expo prebuild --platform ios

cd ios
echo "Installing CocoaPods dependencies..."
arch -arm64 pod install
