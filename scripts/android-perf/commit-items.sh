#!/usr/bin/env bash
# Usage: commit-items.sh <id> [<id> ...]
# Commits one staged item at a time, in the order given, from the working tree that already
# contains all of them. Each item's files are staged on their own so the history has one commit
# per change with its own before/after numbers in the body (see commit-msg/<id>.txt).
#
# Nothing is pushed. The convex-drift pre-push hook needs OTOPAIR_ALLOW_CONVEX_DRIFT=1 on this
# branch when the time comes.
set -euo pipefail
cd "$(dirname "$0")/../.."
HERE="scripts/android-perf"

files_for() {
  case "$1" in
    A1) echo "components/navigation/TabBar.tsx" ;;
    A2) echo "app/(main-tabs)/_layout.tsx app/(main-tabs)/home/_layout.tsx components/home/HydrateConvexData.tsx" ;;
    A3) echo "babel.config.js package.json package-lock.json" ;;
    A4) echo "components/booking-flow/EnrichmentStatusPill.tsx" ;;
    A5) echo "app/(main-tabs)/home/index.tsx app/(main-tabs)/bookings/index.tsx app/(main-tabs)/cars/index.tsx" ;;
    C3) echo "hooks/useTypewriterText.ts components/home/MechanicSearchBar.tsx components/home/ProfileInitialsButton.tsx" ;;
    A6) echo "assets/images/car-silhouette-sedan.android.png assets/images/car-silhouette-suv.android.png assets/images/car-silhouette-truck.android.png assets/images/lexus.android.png $HERE/make_android_assets.py" ;;
    A7) echo "app.json package.json package-lock.json" ;;
    harness) echo "$HERE docs/ANDROID_PERF_PLAN.md" ;;
    *) echo "unknown item: $1" >&2; return 1 ;;
  esac
}

for id in "$@"; do
  msg="$HERE/report/commit-msg/$id.txt"
  if [ ! -f "$msg" ]; then echo "no commit message for $id at $msg" >&2; exit 1; fi
  # shellcheck disable=SC2046
  git add -- $(files_for "$id")
  git commit -q -F "$msg"
  echo "committed $id: $(git log -1 --format=%s)"
done
