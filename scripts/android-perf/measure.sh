#!/usr/bin/env bash
# Usage: measure.sh <label> <apk> [perf_runs_on_A=3] [perf_runs_on_B=0]
# Installs <apk> on both AVDs, captures every fixed screen (with animated-region masks) on both
# at once, then runs perf_compare.py sequentially so nothing else competes with the timings.
# Output: evidence/<label>/{A,B}/shots/*.png and evidence/<label>/{A,B}/perf_runN.json
set -uo pipefail
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
LABEL="$1"; APK="$(cygpath -w "$2")"; NA="${3:-3}"; NB="${4:-3}"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
OUT="evidence/$LABEL"; mkdir -p "$OUT/A" "$OUT/B"
for s in emulator-5554 emulator-5556; do
  echo "install $s: $("$ADB" -s $s install -r "$APK" 2>&1 | tail -1)"
done
[ -d "$OUT/A/shots" ] && [ "${RECAPTURE:-0}" = 0 ] && echo "shots exist, skipping capture" || { py -3 capture_states.py emulator-5554 "$OUT/A/shots" > "$OUT/A/capture.log" 2>&1 &
py -3 capture_states.py emulator-5556 "$OUT/B/shots" > "$OUT/B/capture.log" 2>&1
wait; }
echo "captures done"; grep -h "!!" "$OUT"/*/capture.log
# number new runs after any that already exist, so re-measuring adds samples instead of overwriting
SA=$(ls "$OUT/A"/perf_run*.json 2>/dev/null | wc -l)
for i in $(seq $((SA + 1)) $((SA + NA))); do
  py -3 perf_compare.py android emulator-5554 "$OUT/A/perf_run$i.json" > "$OUT/A/perf_run$i.log" 2>&1
  echo "perf A run $i done"
done
SB=$(ls "$OUT/B"/perf_run*.json 2>/dev/null | wc -l)
for i in $(seq $((SB + 1)) $((SB + NB))); do
  py -3 perf_compare.py android emulator-5556 "$OUT/B/perf_run$i.json" > "$OUT/B/perf_run$i.log" 2>&1
  echo "perf B run $i done"
done
echo "measure $LABEL finished"
