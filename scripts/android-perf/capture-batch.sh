#!/usr/bin/env bash
# Usage: capture-batch.sh <label:apk> [<label:apk> ...]
# For each build: install it on both AVDs and capture every fixed screen on both at once.
# Screenshots are for pixel comparison, not timing, so running both devices together is fine.
set -uo pipefail
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8
cd "$(dirname "$0")"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"

for spec in "$@"; do
  LABEL="${spec%%:*}"; APK="${spec#*:}"
  if [ -d "evidence/$LABEL/A/shots" ] && [ -d "evidence/$LABEL/B/shots" ]; then
    echo "$LABEL: shots already captured"; continue
  fi
  for s in emulator-5554 emulator-5556; do
    echo "$LABEL: install on $s -> $("$ADB" -s "$s" install -r "$(cygpath -w "$APK")" 2>&1 | tail -1)"
  done
  mkdir -p "evidence/$LABEL/A" "evidence/$LABEL/B"
  py -3 capture_states.py emulator-5554 "evidence/$LABEL/A/shots" > "evidence/$LABEL/A/capture.log" 2>&1 &
  pidA=$!
  py -3 capture_states.py emulator-5556 "evidence/$LABEL/B/shots" > "evidence/$LABEL/B/capture.log" 2>&1
  wait $pidA
  echo "$LABEL: captured  $(grep -c 'animated px' "evidence/$LABEL/A/capture.log") screens on A, $(grep -c 'animated px' "evidence/$LABEL/B/capture.log") on B"
  grep -h '!!' "evidence/$LABEL"/*/capture.log || true
done
echo "capture batch finished"
