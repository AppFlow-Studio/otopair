#!/usr/bin/env bash
#
# sync-convex-from-web.sh
#
# Mirror otopair-web/convex/ → otopair/convex/ (everything except _generated/),
# then regenerate mobile's _generated/ types so api.d.ts matches the merged
# function set. otopair-web is the canonical source — all convex/ edits and
# `npx convex` commands run there; this script keeps the mobile vendored
# copy in lockstep so EAS builds (which bundle ./convex/ directly, with no
# sibling repo available) ship the same code.
#
# Usage:
#   bash scripts/sync-convex-from-web.sh
#   OTOPAIR_WEB_REPO=/path/to/otopair-web bash scripts/sync-convex-from-web.sh
#
# Exits non-zero if the sibling repo is missing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_REPO="${OTOPAIR_WEB_REPO:-$HOME/Documents/AppFlowStudios/otopair-web}"

if [[ ! -d "$WEB_REPO/convex" ]]; then
  echo "error: otopair-web convex directory not found at $WEB_REPO/convex" >&2
  echo "       set OTOPAIR_WEB_REPO to the otopair-web checkout path." >&2
  exit 1
fi

echo "→ syncing $WEB_REPO/convex/ → $MOBILE_REPO/convex/ (excluding _generated/)"
rsync -av --delete --exclude='_generated/' "$WEB_REPO/convex/" "$MOBILE_REPO/convex/"

echo "→ regenerating $MOBILE_REPO/convex/_generated/"
cd "$MOBILE_REPO"
npx convex codegen --typecheck disable

echo "done. run 'git status' to review staged changes."
