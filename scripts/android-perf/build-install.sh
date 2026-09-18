#!/usr/bin/env bash
# Usage: build-install.sh <label>
# Builds the x86_64 release APK the emulators run, keeps a copy as apks/<label>.apk,
# and installs it over the signed-in app on both AVDs (data is kept).
# Never run this while perf_compare.py is measuring: gradle saturates the host CPU.
set -euo pipefail
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
LABEL="$1"
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
export ANDROID_HOME="$LOCALAPPDATA\Android\Sdk"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
cd "$ROOT/android"
start=$(date +%s)
./gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 \
  -Pkotlin.jvm.target.validation.mode=warning \
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease -q
echo "build took $(( $(date +%s) - start ))s"
APK="$(cygpath -w "$ROOT/android/app/build/outputs/apk/release/app-release.apk")"
cp "$ROOT/android/app/build/outputs/apk/release/app-release.apk" "$HERE/apks/$LABEL.apk"
ls -l "$HERE/apks/$LABEL.apk"
[ "${NOINSTALL:-0}" = 1 ] && exit 0
for s in emulator-5554 emulator-5556; do
  "$ADB" -s "$s" install -r "$APK" 2>&1 | tail -1
done
