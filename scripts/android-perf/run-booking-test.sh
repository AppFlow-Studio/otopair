#!/usr/bin/env bash
# Usage: run-booking-test.sh <serial> <apk> <label>
# Installs the APK over the signed-in app, gives it a location, then enters the
# booking flow twice (home "Map" button, home "Book Service" button) and records
# whether the app process survives, plus screenshots and filtered logcat.
set -u
export MSYS_NO_PATHCONV=1  # stop Git Bash rewriting /sdcard/... device paths
S="$1"; APK="$2"; LABEL="$3"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
PKG=com.otopair.app
Q="$(dirname "$0")"; OUT="$Q/results/$LABEL/$S"; mkdir -p "$OUT"
LAUNCH_WAIT=${LAUNCH_WAIT:-20}; ENTRY_WAIT=${ENTRY_WAIT:-12}

sh_() { "$ADB" -s "$S" shell "$@" | tr -d '\r'; }
shot() { sh_ input keyevent KEYCODE_WAKEUP >/dev/null; "$ADB" -s "$S" exec-out screencap -p > "$OUT/$1.png"; }
pid() { sh_ pidof $PKG; }

# Center of the first node whose text or content-desc equals $1 (exact), via uiautomator.
find_center() {
  local want="$1" i
  for i in 1 2 3; do
    sh_ uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    local b
    b=$("$ADB" -s "$S" exec-out cat /sdcard/ui.xml 2>/dev/null | tr '>' '\n' \
      | grep -E "(text|content-desc)=\"$want\"" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' \
      | sed -E 's/bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]"/\1 \2 \3 \4/' \
      | awk '$3>$1+10 && $4>$2+10 {print; exit}')   # skip zero-size / off-screen nodes
    if [ -n "$b" ]; then
      echo "$b" | awk '{printf "%d %d", ($1+$3)/2, ($2+$4)/2}'
      return 0
    fi
    # not on screen yet: scroll the home feed down a bit and retry
    local w h; read -r w h < <(sh_ wm size | tail -1 | grep -oE '[0-9]+x[0-9]+' | tr 'x' ' ')
    sh_ input swipe $((w/2)) $((h*7/10)) $((w/2)) $((h*4/10)) 400 >/dev/null
    sleep 2
  done
  return 1
}

fresh_launch() {
  sh_ am force-stop $PKG
  "$ADB" -s "$S" logcat -b all -c
  sh_ monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep "$LAUNCH_WAIT"
  # New build shows an intro carousel on launch; tap "Skip" if it's there (no scrolling).
  sh_ uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$("$ADB" -s "$S" exec-out cat /sdcard/ui.xml 2>/dev/null | tr '>' '\n' | grep -E 'text="Skip"' \
    | grep -oE '\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]' | head -1)
  if [ -n "$b" ]; then
    sh_ input tap $(echo "$b" | sed -E 's/\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]/\1 \2 \3 \4/' | awk '{printf "%d %d",($1+$3)/2,($2+$4)/2}')
    echo "    (skipped intro carousel)"
    sleep 6
  fi
}

echo "=== [$LABEL] $S — Android $(sh_ getprop ro.build.version.release) / API $(sh_ getprop ro.build.version.sdk) / $(sh_ wm size | tail -1) ==="
"$ADB" -s "$S" install -r "$APK" 2>&1 | tail -1
sh_ pm grant $PKG android.permission.ACCESS_FINE_LOCATION
sh_ pm grant $PKG android.permission.ACCESS_COARSE_LOCATION
sh_ settings put secure location_mode 3 >/dev/null 2>&1          # location on (API <= 34)
sh_ cmd location set-location-enabled true >/dev/null 2>&1      # location on (newer APIs)
"$ADB" -s "$S" emu geo fix -74.0060 40.7128 >/dev/null   # lon lat (New York City)
sleep 2; "$ADB" -s "$S" emu geo fix -74.0060 40.7128 >/dev/null
echo "location_mode=$(sh_ settings get secure location_mode)"

for entry in "Map" "Book Service"; do
  tag=$(echo "$entry" | tr ' ' '_' | tr 'A-Z' 'a-z')
  fresh_launch
  shot "${tag}-0-home"
  before=$(pid)
  if ! xy=$(find_center "$entry"); then
    echo "[$entry] could not find button on screen (pid=$before) — see ${tag}-0-home.png"
    continue
  fi
  sh_ input tap $xy
  # Keep feeding GPS fixes (the map only mounts once a location resolves) and watch for
  # either the process dying or the Google Maps SDK initializing, for up to MAX_WAIT seconds.
  maps_seen=""; waited=0; MAX_WAIT=${MAX_WAIT:-60}
  while [ $waited -lt $MAX_WAIT ]; do
    "$ADB" -s "$S" emu geo fix -74.0060 40.7128 >/dev/null 2>&1
    sleep 3; waited=$((waited+3))
    [ -z "$(pid)" ] && break
    if [ -z "$maps_seen" ] && "$ADB" -s "$S" logcat -d -b all 2>/dev/null \
        | grep -qE "Google Android Maps SDK|API key not found|Authorization failure|com.google.maps.api.android"; then
      maps_seen="after ${waited}s"; sleep "$ENTRY_WAIT"; break
    fi
  done
  echo "    maps SDK activity: ${maps_seen:-none seen in ${waited}s}"
  after=$(pid)
  shot "${tag}-1-after-tap"
  "$ADB" -s "$S" logcat -d -b all > "$OUT/${tag}-logcat-full.txt"
  grep -E "FATAL EXCEPTION|E AndroidRuntime|Fatal signal|API key|API_KEY|Authorization failure|Google Android Maps SDK|ReactNativeJS.*(Error|error|Exception)|com.facebook.react.common.JavascriptException|Process: com.otopair" \
    "$OUT/${tag}-logcat-full.txt" | head -40 > "$OUT/${tag}-logcat-key.txt"
  grep -A25 "FATAL EXCEPTION" "$OUT/${tag}-logcat-full.txt" | head -30 >> "$OUT/${tag}-logcat-key.txt"
  if [ -z "$after" ]; then verdict="CRASHED (process gone)"
  elif [ "$after" != "$before" ]; then verdict="RESTARTED (pid $before -> $after)"
  else verdict="SURVIVED (pid $after)"; fi
  echo "[$entry] tapped at $xy -> $verdict"
  sed 's/^/    /' "$OUT/${tag}-logcat-key.txt" | head -14
done
