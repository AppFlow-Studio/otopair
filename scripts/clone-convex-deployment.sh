#!/usr/bin/env bash
#
# clone-convex-deployment.sh
#
# Produce a 1:1 clone (schema + functions + data + file storage) of a Convex
# deployment into another Convex deployment.
#
# Source defaults to whatever CONVEX_DEPLOYMENT is set to in the current shell
# (which `npx convex` itself picks up from .env.local). Target must be passed.
#
# The target deployment MUST already exist. Create one with `npx convex dev
# --configure new` on the destination branch, then pass its name as --target.
#
# Because the mobile repo's convex/ folder drifts from the source-of-truth
# otopair-web/convex/, this script first rsyncs otopair-web/convex/ over
# otopair/convex/ (excluding _generated/) so the deploy step pushes the
# correct, current code.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_DEPLOYMENT="dev:ardent-crab-641"
TARGET_DEPLOYMENT="dev:third-bird-914"
WEB_REPO="${OTOPAIR_WEB_REPO:-$HOME/Documents/AppFlowStudios/otopair-web}"
AUTO_YES=0
KEEP_DUMP=0
SKIP_SYNC=0

usage() {
  cat <<EOF
Usage: $(basename "$0") --target <deployment> [options]

Required:
  --target <name>      Target Convex deployment (e.g. dev:fluffy-otter-456)

Options:
  --source <name>      Source deployment (default: \$CONVEX_DEPLOYMENT from env/.env.local)
  --web-repo <path>    Path to otopair-web checkout (default: ~/Documents/AppFlowStudios/otopair-web)
  --skip-sync          Skip the otopair-web -> otopair convex/ rsync step
  -y, --yes            Skip the destructive-action confirmation prompt
  --keep-dump          Keep the exported snapshot zip after import
  -h, --help           Show this help

The script must be run from inside the otopair mobile repo (or any directory;
it cd's to the repo root automatically).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)     TARGET_DEPLOYMENT="$2"; shift 2 ;;
    --source)     SOURCE_DEPLOYMENT="$2"; shift 2 ;;
    --web-repo)   WEB_REPO="$2"; shift 2 ;;
    --skip-sync)  SKIP_SYNC=1; shift ;;
    -y|--yes)     AUTO_YES=1; shift ;;
    --keep-dump)  KEEP_DUMP=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$TARGET_DEPLOYMENT" ]]; then
  echo "ERROR: --target is required" >&2
  usage
  exit 1
fi

if [[ -z "$SOURCE_DEPLOYMENT" ]]; then
  if [[ -f "$MOBILE_REPO/.env.local" ]]; then
    SOURCE_DEPLOYMENT="$(grep -E '^CONVEX_DEPLOYMENT=' "$MOBILE_REPO/.env.local" | head -1 | cut -d= -f2 | awk '{print $1}')"
  fi
fi

if [[ -z "$SOURCE_DEPLOYMENT" ]]; then
  echo "ERROR: could not determine source deployment. Pass --source or set CONVEX_DEPLOYMENT." >&2
  exit 1
fi

if [[ "$SOURCE_DEPLOYMENT" == "$TARGET_DEPLOYMENT" ]]; then
  echo "ERROR: source and target are the same ($SOURCE_DEPLOYMENT). Refusing to run." >&2
  exit 1
fi

cd "$MOBILE_REPO"

cat <<EOF

=== Convex Deployment Clone ===
  Source: $SOURCE_DEPLOYMENT
  Target: $TARGET_DEPLOYMENT  (will be REPLACED — all rows wiped)
  Mobile repo: $MOBILE_REPO
  otopair-web: $WEB_REPO  $([[ $SKIP_SYNC -eq 1 ]] && echo "(sync SKIPPED)")
EOF

if [[ $AUTO_YES -ne 1 ]]; then
  echo ""
  read -r -p "Type the target deployment name to confirm DESTRUCTIVE replace: " CONFIRM
  if [[ "$CONFIRM" != "$TARGET_DEPLOYMENT" ]]; then
    echo "Confirmation mismatch. Aborting." >&2
    exit 1
  fi
fi

# --- Step 1: sync otopair-web/convex -> otopair/convex ---------------------
# Delegated to scripts/sync-convex-from-web.sh so this script and
# `npm run sync:convex` share one rsync implementation.
if [[ $SKIP_SYNC -ne 1 ]]; then
  echo ""
  echo "[1/5] Syncing $WEB_REPO/convex/ -> $MOBILE_REPO/convex/ via sync-convex-from-web.sh..."
  OTOPAIR_WEB_REPO="$WEB_REPO" bash "$SCRIPT_DIR/sync-convex-from-web.sh"
  echo "      Sync complete. Review with: git -C \"$MOBILE_REPO\" status convex/"
else
  echo ""
  echo "[1/5] Skipping convex/ sync (--skip-sync set). Mobile convex/ used as-is."
fi

# --- Step 2: export source -------------------------------------------------
DUMP_DIR="$MOBILE_REPO/tmp"
mkdir -p "$DUMP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_PATH="$DUMP_DIR/convex-clone-${TIMESTAMP}.zip"

echo ""
echo "[2/5] Exporting $SOURCE_DEPLOYMENT (with file storage) -> $DUMP_PATH ..."
CONVEX_DEPLOYMENT="$SOURCE_DEPLOYMENT" \
  npx convex export --path "$DUMP_PATH" --include-file-storage

if [[ ! -s "$DUMP_PATH" ]]; then
  echo "ERROR: export produced an empty file at $DUMP_PATH" >&2
  exit 1
fi
echo "      Export size: $(du -h "$DUMP_PATH" | awk '{print $1}')"

# --- Step 3: deploy code to target -----------------------------------------
echo ""
echo "[3/5] Deploying schema + functions to $TARGET_DEPLOYMENT ..."
CONVEX_DEPLOYMENT="$TARGET_DEPLOYMENT" \
  npx convex deploy --yes

# --- Step 4: import data into target ---------------------------------------
echo ""
echo "[4/5] Importing snapshot into $TARGET_DEPLOYMENT (--replace-all) ..."
CONVEX_DEPLOYMENT="$TARGET_DEPLOYMENT" \
  npx convex import --replace-all --yes "$DUMP_PATH"

# --- Step 5: cleanup -------------------------------------------------------
echo ""
if [[ $KEEP_DUMP -eq 1 ]]; then
  echo "[5/5] Keeping snapshot at $DUMP_PATH (--keep-dump set)."
else
  rm -f "$DUMP_PATH"
  echo "[5/5] Removed snapshot $DUMP_PATH."
fi

cat <<EOF

=== Done ===
Cloned $SOURCE_DEPLOYMENT -> $TARGET_DEPLOYMENT.

Reminders:
  - Convex env vars / secrets were NOT copied. Set them on $TARGET_DEPLOYMENT
    via dashboard or:  CONVEX_DEPLOYMENT=$TARGET_DEPLOYMENT npx convex env set KEY value
  - Clerk JWT issuer config carries over (it's in convex/auth.config.ts), but
    if Clerk allowlists origins, add the new deployment's URL.
  - Cron jobs are recreated by deploy, but in-flight scheduled jobs from
    source are NOT migrated.
  - The mobile convex/ folder may now have uncommitted changes from the
    otopair-web sync. Review and commit on your new dev branch:
      git -C "$MOBILE_REPO" status convex/
EOF
