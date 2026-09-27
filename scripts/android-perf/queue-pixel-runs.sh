#!/usr/bin/env bash
# One-off: after the A1 budget-phone passes, add Pixel passes for A1 and top up the Pixel baseline to 3.
set -uo pipefail
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8
cd "$(dirname "$0")"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
T="C:/Users/manso/AppData/Local/Temp/claude/C--Users-manso-Desktop-otopair-1/bf5ede41-0f1d-4a35-8845-ea2736304494/tasks/b1dzpcxst.output"
until grep -q "measure 01-A1 finished" "$T"; do sleep 10; done
for i in 1 2 3; do
  py -3 perf_compare.py android emulator-5556 evidence/01-A1/B/perf_run$i.json > evidence/01-A1/B/perf_run$i.log 2>&1
  echo "A1 pixel run $i done"
done
echo "install baseline on pixel: $("$ADB" -s emulator-5556 install -r "$(cygpath -w apks/00-baseline.apk)" 2>&1 | tail -1)"
for i in 2 3; do
  py -3 perf_compare.py android emulator-5556 evidence/00-baseline/B/perf_run$i.json > evidence/00-baseline/B/perf_run$i.log 2>&1
  echo "baseline pixel run $i done"
done
echo "queue finished"
