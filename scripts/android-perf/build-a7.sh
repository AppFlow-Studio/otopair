#!/usr/bin/env bash
# A7: turn on R8 code shrinking + resource shrinking for android release builds.
#
# The baseline APK ships 8 dex files, ~71 MB of uncompressed code, because minification is off.
# expo-build-properties is the committed way to switch it on, and it only takes effect through a
# prebuild, which regenerates the (gitignored) android/ directory - including the Maps API key,
# which app.config.js injects from .env.local.
#
# Run this only when nothing is being measured: prebuild plus a full R8 build saturates the host.
set -euo pipefail
cd "$(dirname "$0")/../.."
P="C:/Users/manso/AppData/Local/Temp/claude/C--Users-manso-Desktop-otopair-1/bf5ede41-0f1d-4a35-8845-ea2736304494/scratchpad/patches"

echo "== applying the app.json change"
git apply "$P/A7-minify.patch"

echo "== prebuild (regenerates android/)"
npx expo prebuild --platform android --no-install 2>&1 | tail -5

echo "== checking the generated gradle actually has minification on"
grep -n "enableMinifyInReleaseBuilds\|minifyEnabled\|shrinkResources" android/app/build.gradle android/gradle.properties | head

echo "== checking the Maps API key survived the prebuild"
grep -c "com.google.android.geo.API_KEY" android/app/src/main/AndroidManifest.xml

echo "== build"
NOINSTALL=1 scripts/android-perf/build-install.sh 08-A7-minify 2>&1 | grep -E "build took|BUILD FAILED|error:" | head -5

echo "== what R8 did to the APK"
py -3 - <<'PY'
import zipfile
for label in ("07-A6-assets", "08-A7-minify"):
    try:
        z = zipfile.ZipFile(f"scripts/android-perf/apks/{label}.apk")
    except FileNotFoundError:
        print(label, "missing"); continue
    dex = [(i.filename, i.file_size) for i in z.infolist() if i.filename.endswith(".dex")]
    total = sum(i.file_size for i in z.infolist())
    import os
    print(f"{label}: apk on disk {os.path.getsize(f'scripts/android-perf/apks/{label}.apk')/1e6:.1f} MB, "
          f"uncompressed {total/1e6:.1f} MB, {len(dex)} dex files totalling {sum(s for _, s in dex)/1e6:.1f} MB")
PY
