#!/usr/bin/env bash
# Build A2 while nothing is measuring, then measure A1, baseline and A2 back to back on both phones.
set -uo pipefail
cd "$(dirname "$0")"
NOINSTALL=1 ./build-install.sh 02-A2-freeze-tabs 2>&1 | tail -4
echo "== A1 perf"; ./measure.sh 01-A1 apks/01-A1-tabbar-blur.apk 3 3
echo "== baseline perf"; ./measure.sh 00-baseline apks/00-baseline.apk 3 3
echo "== A2 measure"; ./measure.sh 02-A2 apks/02-A2-freeze-tabs.apk 3 3
echo "queue A2 finished"
