#!/usr/bin/env bash
#
# check-convex-drift.sh
#
# Compares mobile's convex/ against otopair-web/convex/ (excluding _generated/)
# and returns non-zero if they differ. Used as a pre-push guard so divergent
# convex code doesn't reach a build branch.
#
# Skips the check (exits 0) when:
#   - the sibling otopair-web repo isn't present (CI, fresh clone)
#   - OTOPAIR_ALLOW_CONVEX_DRIFT=1 is set (intentional branch work)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
# Resolve the sibling repo. The single hardcoded default used to be
# ~/Documents/AppFlowStudios/otopair-web; when the checkout lives anywhere else
# that path simply doesn't exist, the "no sibling repo" branch below fires and
# the guard exits 0 — reporting CLEAN while the trees are badly drifted. That
# is how a stale mobile convex/ reached the shared deployment and deleted web's
# functions. Try the known locations rather than trusting one.
WEB_REPO=""
for candidate in \
  "${OTOPAIR_WEB_REPO:-}" \
  "$HOME/Downloads/otopair-web" \
  "$HOME/Documents/AppFlowStudios/otopair-web" \
  "$MOBILE_REPO/../otopair-web"; do
  if [[ -n "$candidate" && -d "$candidate/convex" ]]; then
    WEB_REPO="$candidate"
    break
  fi
done

if [[ "${OTOPAIR_ALLOW_CONVEX_DRIFT:-0}" == "1" ]]; then
  exit 0
fi

if [[ -z "$WEB_REPO" ]]; then
  # Nothing to compare against (CI, fresh clone). Still exit 0 so builds pass,
  # but say so — silence here is indistinguishable from "no drift", which is
  # exactly the failure this guard exists to prevent.
  echo "warning: check-convex-drift found no otopair-web checkout; drift NOT checked." >&2
  echo "         set OTOPAIR_WEB_REPO=/path/to/otopair-web to enable it." >&2
  exit 0
fi

DRIFT="$(diff -rq --exclude=_generated "$MOBILE_REPO/convex" "$WEB_REPO/convex" 2>&1 || true)"

if [[ -n "$DRIFT" ]]; then
  echo "error: convex/ has drifted from otopair-web/convex/:" >&2
  echo "$DRIFT" >&2
  echo "" >&2
  echo "fix: run 'npm run sync:convex' (pulls from web)" >&2
  echo "skip: set OTOPAIR_ALLOW_CONVEX_DRIFT=1 to push anyway (branch work)" >&2
  exit 1
fi
