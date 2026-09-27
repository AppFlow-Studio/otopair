#!/usr/bin/env bash
# Usage: logcheck.sh <label> <apk>
# Counts what the app writes to logcat in a release build during a plain launch + tab walk.
# This is how A3 (dropping console.log/info/debug from android release bundles) is verified on
# the device rather than only in the bundle: every one of those calls was also being sent to
# Convex client_logs by lib/consoleToConvex.ts.
set -uo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
LABEL="$1"; APK="$(cygpath -w "$2")"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
S=emulator-5554
PKG=com.otopair.app
OUT="evidence/logcheck"; mkdir -p "$OUT"

"$ADB" -s $S install -r "$APK" > /dev/null 2>&1
"$ADB" -s $S shell am force-stop $PKG
"$ADB" -s $S logcat -c
"$ADB" -s $S shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 35
# walk the tabs so screen code runs, not just startup
for label in Bookings Cars Oto Home; do
  xy=$(py -3 -c "
from perf_compare import Android
d = Android('$S'); p = d.find('$label', True)
print(f'{int(p[0])} {int(p[1])}' if p else '')
" 2>/dev/null)
  [ -n "$xy" ] && "$ADB" -s $S shell input tap $xy && sleep 6
done
"$ADB" -s $S logcat -d > "$OUT/$LABEL.txt" 2>/dev/null
total=$(grep -c "ReactNativeJS" "$OUT/$LABEL.txt" || true)
info=$(grep -c "I ReactNativeJS" "$OUT/$LABEL.txt" || true)
warn=$(grep -c "W ReactNativeJS" "$OUT/$LABEL.txt" || true)
err=$(grep -c "E ReactNativeJS" "$OUT/$LABEL.txt" || true)
onboarding=$(grep -c "onboarding-resume" "$OUT/$LABEL.txt" || true)
echo "$LABEL: ReactNativeJS lines total=$total info=$info warn=$warn error=$err  '[onboarding-resume' lines=$onboarding"
echo "$LABEL total=$total info=$info warn=$warn error=$err onboarding=$onboarding" >> "$OUT/summary.txt"
"$ADB" -s $S shell am force-stop $PKG
