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

# Mirror the repo-root lib/ modules that web's TOP-LEVEL convex imports. Files in
# convex/*.ts use `../lib/X` to reach the repo-root lib/ (subdir files like
# convex/vehicleEnrichment/*.ts resolve `../lib` to convex/lib, already synced
# above). Copy per-file (no --delete) so mobile-only lib/ files — e.g.
# shopPriceLabel.ts used by the app — survive; this also picks up new deps like
# shopTimezone.ts automatically. Without this, codegen below fails to resolve
# convex imports such as convex/shops.ts → ../lib/shopTimezone.
echo "→ mirroring repo-root lib/ modules that top-level convex imports"
mods="$(grep -rhoE 'from "\.\./lib/[A-Za-z0-9_.-]+"' "$WEB_REPO"/convex/*.ts 2>/dev/null \
  | grep -oE '\.\./lib/[A-Za-z0-9_.-]+' | sed 's#\.\./lib/##' | sort -u)"
for m in $mods; do
  for ext in ts tsx; do
    if [[ -f "$WEB_REPO/lib/$m.$ext" ]]; then
      cp "$WEB_REPO/lib/$m.$ext" "$MOBILE_REPO/lib/$m.$ext"
    fi
  done
done

echo "→ regenerating $MOBILE_REPO/convex/_generated/"
cd "$MOBILE_REPO"
npx convex codegen --typecheck disable

echo "done. run 'git status' to review staged changes."
