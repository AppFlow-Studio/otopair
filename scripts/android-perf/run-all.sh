#!/usr/bin/env bash
# The whole measurement pass, in the only order the two devices allow: captures first (both
# phones at once, timing does not matter), then the on-device log check, then the rotation
# (one phone at a time, nothing else running).
set -uo pipefail
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8
cd "$(dirname "$0")"

BUILDS=(
  "00-baseline:apks/00-baseline.apk"
  "01-A1:apks/01-A1-tabbar-blur.apk"
  "02-A2:apks/02-A2-freeze-tabs.apk"
  "03-A3:apks/03-A3-strip-logs.apk"
  "04-A4:apks/04-A4-pill-pulse.apk"
  "05-A5:apks/05-A5-clip-subviews.apk"
  "06-C3:apks/06-C3-offscreen-anims.apk"
  "07-A6:apks/07-A6-assets.apk"
)

echo "=========== captures"
./capture-batch.sh "${BUILDS[@]}"

echo "=========== release logcat check (baseline vs A3)"
./logcheck.sh 00-baseline apks/00-baseline.apk
./logcheck.sh 03-A3 apks/03-A3-strip-logs.apk

echo "=========== rotation, budget phone (3 rounds)"
./rotate.sh 3 emulator-5554 "${BUILDS[@]}"

echo "=========== rotation, pixel (2 rounds)"
./rotate.sh 2 emulator-5556 "${BUILDS[@]}"

echo "run-all finished"
