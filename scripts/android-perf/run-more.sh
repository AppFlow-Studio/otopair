#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
BUILDS=(
  "00-baseline:apks/00-baseline.apk" "01-A1:apks/01-A1-tabbar-blur.apk"
  "02-A2:apks/02-A2-freeze-tabs.apk" "03-A3:apks/03-A3-strip-logs.apk"
  "04-A4:apks/04-A4-pill-pulse.apk" "05-A5:apks/05-A5-clip-subviews.apk"
  "06-C3:apks/06-C3-offscreen-anims.apk" "07-A6:apks/07-A6-assets.apk"
)
echo "===== pixel, 2 rounds"
./rotate.sh 2 emulator-5556 "${BUILDS[@]}"
echo "===== budget, rounds 3 and 4"
./rotate.sh 4 emulator-5554 "${BUILDS[@]}"
echo "run-more finished"
