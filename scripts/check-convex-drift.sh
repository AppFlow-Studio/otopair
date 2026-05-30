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
WEB_REPO="${OTOPAIR_WEB_REPO:-$HOME/Documents/AppFlowStudios/otopair-web}"

if [[ "${OTOPAIR_ALLOW_CONVEX_DRIFT:-0}" == "1" ]]; then
  exit 0
fi

if [[ ! -d "$WEB_REPO/convex" ]]; then
  # No sibling repo to compare against — skip silently.
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
