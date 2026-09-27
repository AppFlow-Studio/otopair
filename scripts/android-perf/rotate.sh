#!/usr/bin/env bash
# Usage: rotate.sh <rounds> <serial> <label:apk> [<label:apk> ...]
#
# Round-robin measurement. Each round installs and measures every build once, in order, so all
# builds see the same host conditions - this machine also runs a desktop (games, browsers,
# Wallpaper Engine) and both emulators draw through its GPU, so absolute numbers drift by the
# hour. Comparing round i of one build against round i of another cancels most of that drift;
# summarize.py --paired does exactly that.
#
# Writes evidence/rot/<label>/<A|B>/run<i>.json
set -uo pipefail
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8
cd "$(dirname "$0")"
ROUNDS="$1"; SERIAL="$2"; shift 2
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
case "$SERIAL" in *5554) DEV=A ;; *) DEV=B ;; esac

for i in $(seq 1 "$ROUNDS"); do
  # Shuffle the order every round. With a fixed order, anything that drifts during a round -
  # the device warming up, caches filling, the desktop getting busier - lands on the same build
  # every time and reads as that build's effect.
  mapfile -t ORDER < <(printf '%s
' "$@" | shuf)
  for spec in "${ORDER[@]}"; do
    LABEL="${spec%%:*}"; APK="${spec#*:}"
    OUT="evidence/rot/$LABEL/$DEV"; mkdir -p "$OUT"
    if [ -f "$OUT/run$i.json" ]; then echo "round $i $LABEL $DEV: already done"; continue; fi
    # Abort the round if the install did not take. This used to only echo the adb output and
    # carry on, so when a foreign build blocked our APKs on 2026-09-17 the script measured
    # whatever happened to be installed and wrote it out as this build's numbers - a whole
    # round had to be quarantined. A round we cannot install is a round with no data, which is
    # strictly better than a round with wrong data.
    INSTALL_OUT="$("$ADB" -s "$SERIAL" install -r "$(cygpath -w "$APK")" 2>&1)"
    echo "round $i $LABEL $DEV: install $(printf '%s' "$INSTALL_OUT" | tail -1)"
    if ! printf '%s' "$INSTALL_OUT" | grep -q "Success"; then
      echo "round $i $LABEL $DEV: ABORTING ROUND - install failed, refusing to measure a build we did not install" >&2
      break
    fi
    py -3 perf_compare.py android "$SERIAL" "$OUT/run$i.json" > "$OUT/run$i.log" 2>&1
    echo "round $i $LABEL $DEV: $(grep -c settle_s "$OUT/run$i.log") steps measured"
  done
done
echo "rotation finished on $SERIAL"
