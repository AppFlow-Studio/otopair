#!/usr/bin/env bash
# Apply each staged change in order and build one APK per item, so every item can be measured
# against the build before it. Nothing is installed here; rotate.sh does that.
set -uo pipefail
cd "$(dirname "$0")/../.."
P="C:/Users/manso/AppData/Local/Temp/claude/C--Users-manso-Desktop-otopair-1/bf5ede41-0f1d-4a35-8845-ea2736304494/scratchpad/patches"
B=scripts/android-perf/build-install.sh

step() { echo; echo "######## $1"; }

step "A3 — strip console.log/info/debug from android release bundles"
cp "$P/A3-babel.config.js" babel.config.js
# a new babel config has to beat Metro's transform cache
rm -rf "$TEMP/metro-cache" node_modules/.cache 2>/dev/null || true
NOINSTALL=1 $B 03-A3-strip-logs 2>&1 | tail -3

step "A4 — enrichment pill: pulse only while the pill is on screen"
git apply "$P/A4-pill.patch"
NOINSTALL=1 $B 04-A4-pill-pulse 2>&1 | tail -3

step "A5 — detach off-screen sections on the three long scrolls"
git apply "$P/A5-clip.patch"
NOINSTALL=1 $B 05-A5-clip-subviews 2>&1 | tail -3

step "C3 — stop the typewriter and avatar slider while their screen is not focused"
git apply "$P/C3-offscreen.patch"
NOINSTALL=1 $B 06-C3-offscreen-anims 2>&1 | tail -3

step "A6 — android-only right-sized copies of the oversized shipped PNGs"
py -3 scripts/android-perf/make_android_assets.py
NOINSTALL=1 $B 07-A6-assets 2>&1 | tail -3

echo; echo "build batch finished"; ls -l scripts/android-perf/apks/
