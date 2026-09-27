#!/usr/bin/env bash
# Usage: startup.sh <serial> <label:apk> [<label:apk> ...]
# Cold-start time and settled memory per build - the metrics that A6 (image sizes) and A7 (R8
# code shrinking) actually move, which the tab and scroll flows cannot show.
#
# Cold start: force-stop, then `am start -W`, five times, reporting each TotalTime.
# Memory: after the app has settled on Home, total PSS from dumpsys meminfo.
# Writes evidence/startup/<label>-<A|B>.txt and a one-line summary per build.
set -uo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
SERIAL="$1"; shift
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
PKG=com.otopair.app
case "$SERIAL" in *5554) DEV=A ;; *) DEV=B ;; esac
OUT=evidence/startup; mkdir -p "$OUT"

for spec in "$@"; do
  LABEL="${spec%%:*}"; APK="${spec#*:}"
  F="$OUT/$LABEL-$DEV.txt"; : > "$F"
  "$ADB" -s "$SERIAL" install -r "$(cygpath -w "$APK")" > /dev/null 2>&1
  times=()
  for i in 1 2 3 4 5; do
    "$ADB" -s "$SERIAL" shell am force-stop $PKG
    sleep 3
    t=$("$ADB" -s "$SERIAL" shell am start -W -n $PKG/.MainActivity 2>/dev/null | tr -d '\r' | awk -F: '/^TotalTime/ {print $2}')
    times+=("${t:-0}")
    echo "cold start $i: ${t:-?} ms" >> "$F"
    sleep 2
  done
  # let it settle on Home, then read memory
  sleep 25
  pss=$("$ADB" -s "$SERIAL" shell dumpsys meminfo $PKG 2>/dev/null | tr -d '\r' | awk '/TOTAL PSS:/ {print $3; exit}')
  [ -z "$pss" ] && pss=$("$ADB" -s "$SERIAL" shell dumpsys meminfo $PKG 2>/dev/null | tr -d '\r' | awk '/^ *TOTAL/ {print $2; exit}')
  gfx=$("$ADB" -s "$SERIAL" shell dumpsys meminfo $PKG 2>/dev/null | tr -d '\r' | awk '/Graphics/ {print $2; exit}')
  echo "total PSS kB: ${pss:-?}   graphics kB: ${gfx:-?}" >> "$F"
  "$ADB" -s "$SERIAL" shell am force-stop $PKG
  med=$(printf '%s\n' "${times[@]}" | sort -n | awk '{a[NR]=$1} END {print a[int((NR+1)/2)]}')
  echo "$LABEL $DEV: cold start median ${med} ms (${times[*]}), PSS ${pss:-?} kB, graphics ${gfx:-?} kB"
  echo "$LABEL $DEV median=${med} runs=${times[*]} pss=${pss:-?} gfx=${gfx:-?}" >> "$OUT/summary.txt"
done
