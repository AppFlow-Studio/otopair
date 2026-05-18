#!/usr/bin/env bash
# =============================================================================
# Emergency prompt rollback — Wave 1.5
# =============================================================================
#
# Sprint 1 Day 5 (2026-05-16). Authority:
#   docs/SPRINT_1/WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md §5.
# Owner: Principal Prompt Engineer.
#
# What it does:
#   1. Reads the SECOND-newest prompt_changelog row's prompt_version (i.e.,
#      the version we want to roll BACK to).
#   2. Reads the newest row to know what we're rolling OFF.
#   3. Calls oto/promptChangelog:setActivePromptVersion to:
#        - Mark the rolled-off version's row outcome=rolled_back with reason.
#        - Insert a fresh row noting the manual revert action.
#   4. Sets the OTO_ACTIVE_PROMPT_VERSION convex env var to the prior version
#      so the rollout layer immediately serves it.
#   5. Prints a one-line confirmation.
#
# Usage:
#   bash scripts/eval/rollback_prompt.sh "production error rate spiked"
#
# Anyone authorized to rollback: Waleed, Temur, Principal Prompt Engineer,
# A/B watcher of record, on-call. No meeting required. The reason string is
# logged to prompt_changelog.rollback_reason — be specific; the post-mortem
# happens async.
#
# Environment:
#   OTO_CONVEX_DEPLOYMENT   (required) — e.g. "prod" or full deployment name
#   OTO_ACTOR               (optional) — actor name written to changelog
#                                         (defaults to $USER or "rollback-script")
# =============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"<rollback reason>\"" >&2
  echo "" >&2
  echo "The reason string is REQUIRED. It's written to prompt_changelog and is" >&2
  echo "the only post-incident breadcrumb explaining why production was reverted." >&2
  exit 2
fi

REASON="$1"
ACTOR="${OTO_ACTOR:-${USER:-rollback-script}}"
DEPLOYMENT="${OTO_CONVEX_DEPLOYMENT:-}"

if [ -z "$REASON" ] || [ "$(echo -n "$REASON" | tr -d '[:space:]')" = "" ]; then
  echo "ERROR: rollback reason cannot be empty" >&2
  exit 2
fi

CONVEX_FLAGS=""
if [ -n "$DEPLOYMENT" ]; then
  CONVEX_FLAGS="--deployment $DEPLOYMENT"
fi

echo "[rollback] Reading prompt_changelog tail..."

# listRecentChanges is a public query; --limit 2 gives newest + second-newest.
# convex run output is JSON; we use node to parse it so we don't depend on jq.
RECENT_JSON=$(npx convex run oto/promptChangelog:listRecentChanges '{"limit": 2}' $CONVEX_FLAGS 2>/dev/null || echo "[]")

# Parse with node (always available since we're a Node/Convex project).
ROLLOFF_VERSION=$(node -e "
  const r = $RECENT_JSON;
  if (!Array.isArray(r) || r.length < 1) { console.error('no changelog rows'); process.exit(1); }
  console.log(r[0].prompt_version);
")

ROLLBACK_TO=$(node -e "
  const r = $RECENT_JSON;
  if (!Array.isArray(r) || r.length < 2) { console.error('need at least 2 changelog rows to rollback'); process.exit(1); }
  console.log(r[1].prompt_version);
")

if [ -z "$ROLLOFF_VERSION" ] || [ -z "$ROLLBACK_TO" ]; then
  echo "ERROR: could not determine versions from prompt_changelog" >&2
  exit 1
fi

if [ "$ROLLOFF_VERSION" = "$ROLLBACK_TO" ]; then
  echo "ERROR: newest and second-newest versions match ($ROLLOFF_VERSION). Nothing to rollback." >&2
  exit 1
fi

echo "[rollback] Rolling OFF: $ROLLOFF_VERSION"
echo "[rollback] Rolling TO:  $ROLLBACK_TO"
echo "[rollback] Reason:      $REASON"
echo "[rollback] Actor:       $ACTOR"

# Step 1: flip the active version env var. The rollout layer reads
# OTO_ACTIVE_PROMPT_VERSION at request time, so this takes effect on the next
# turn for every user.
echo "[rollback] Setting OTO_ACTIVE_PROMPT_VERSION=$ROLLBACK_TO ..."
npx convex env set OTO_ACTIVE_PROMPT_VERSION "$ROLLBACK_TO" $CONVEX_FLAGS

# Step 2: write the audit rows. setActivePromptVersion handles both:
#   - patches the rolled-off row with outcome=rolled_back + reason
#   - inserts a fresh row noting the revert
ARGS_JSON=$(node -e "
  console.log(JSON.stringify({
    version: '$ROLLBACK_TO',
    rolled_back_from: '$ROLLOFF_VERSION',
    rollback_reason: process.argv[1],
    actor: '$ACTOR',
  }));
" "$REASON")

echo "[rollback] Writing changelog rows..."
npx convex run oto/promptChangelog:setActivePromptVersion "$ARGS_JSON" $CONVEX_FLAGS

echo ""
echo "Rolled back from $ROLLOFF_VERSION to $ROLLBACK_TO. Reason: $REASON. Changelog row written."
