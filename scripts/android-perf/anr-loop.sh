#!/usr/bin/env bash
# Repeats: cold launch -> skip intro -> tap "Book Service" -> watch 45s for ANR / process death.
# Saves logcat, ANR traces (device A is rootable), and a screenshot per attempt.
export MSYS_NO_PATHCONV=1
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"; S=${S:-emulator-5554}; N=${N:-6}
OUT="$(dirname "$0")/anr-loop"; mkdir -p "$OUT"
PKG=com.otopair.app

tapText() {
  "$ADB" -s $S shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$("$ADB" -s $S exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep -E "(text|content-desc)=\"$1\"" \
    | grep -oE '\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]' | sed -E 's/\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]/\1 \2 \3 \4/' \
    | awk '$3>$1+10 && $4>$2+10 {printf "%d %d",($1+$3)/2,($2+$4)/2; exit}')
  [ -n "$b" ] && "$ADB" -s $S shell input tap $b
}

for run in $(seq 1 $N); do
  D="$OUT/run$run"; mkdir -p "$D"
  "$ADB" -s $S shell am force-stop $PKG
  "$ADB" -s $S shell rm -f '/data/anr/*'
  "$ADB" -s $S logcat -b all -c
  "$ADB" -s $S shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  "$ADB" -s $S shell 'sleep 35'
  tapText "Skip" && "$ADB" -s $S shell 'sleep 6'
  entered=""
  for i in 1 2 3; do tapText "Book Service" && { entered=1; break; }; "$ADB" -s $S shell input swipe 360 900 360 500 400; "$ADB" -s $S shell 'sleep 2'; done
  if [ -z "$entered" ]; then echo "run $run: Book Service not found"; "$ADB" -s $S exec-out screencap -p > "$D/not-found.png"; continue; fi
  outcome="ok"; secs=0
  while [ $secs -lt 45 ]; do
    "$ADB" -s $S shell 'sleep 3'; secs=$((secs+3))
    if [ -z "$("$ADB" -s $S shell pidof $PKG | tr -d '\r')" ]; then outcome="DIED after ${secs}s"; break; fi
    if "$ADB" -s $S logcat -d -b events | grep -q "am_anr"; then outcome="ANR after ${secs}s"; "$ADB" -s $S shell 'sleep 12'; break; fi
  done
  "$ADB" -s $S exec-out screencap -p > "$D/end.png"
  "$ADB" -s $S logcat -d -b all > "$D/logcat.txt"
  "$ADB" -s $S shell 'ls /data/anr/' | tr -d '\r' | while read -r f; do [ -n "$f" ] && "$ADB" -s $S exec-out cat "/data/anr/$f" > "$D/$f"; done
  "$ADB" -s $S shell dumpsys gfxinfo $PKG > "$D/gfxinfo.txt" 2>/dev/null
  frames=$(grep -m1 "Janky frames" "$D/gfxinfo.txt" | tr -d '\r' | sed 's/^ *//')
  skipped=$(grep -oE "Skipped [0-9]+ frames" "$D/logcat.txt" | awk '{s+=$2} END{print s+0}')
  echo "run $run: $outcome | skipped frames (logcat sum)=$skipped | $frames | $(grep -m1 -E 'FATAL EXCEPTION|ANR in|Fatal signal' "$D/logcat.txt" | cut -c1-120)"
done
