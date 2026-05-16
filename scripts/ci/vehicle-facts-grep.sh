#!/usr/bin/env bash
# =============================================================================
# CI grep rules — vehicle_facts invariant enforcement (consolidated v3)
# =============================================================================
#
# Sprint 1 Day 1 correction (2026-05-16). Authority: MEMORY_SCHEMA_V3_CONSOLIDATED §7.
# Sprint 1 Day 2 update (2026-05-16): Rule 4 exception path renamed from
# stripEmbeddings.ts to backfillV3Lifecycle.ts (the two backfills were
# folded into one combined pass per §5 fold-recommendation).
# Sprint 1 Day 5 update (2026-05-16): Rule 6 added — chat-tool moat reads
# must filter the EvalTest sentinel namespace.
# Sprint 2 Day 1 update (2026-05-16): Rules 7 + 8 + 9 added — moat reads
# must route through queryMoat helper; prompt-split shim discipline; and
# MOAT_TABLES list integrity (28 entries pinned).
# Sprint 2 Day 3 update (2026-05-16): Rules 10 + 11 added — bumpMoat literal
# integrity (Day 2's action-context wire-through pattern) and direct-delete
# protection on vehicle_facts / vehicle_facts_audit / fact_reports outside
# the migrations/ teardown path.
# Subagent consensus: Memory Engineer + Security Analyst + RAG Specialist.
#
# Eleven rules. Together they pin the v3 invariants at code-review time:
#   1. No direct ctx.db.patch against vehicle_facts outside the helper.
#      Exception: convex/oto/vehicleFactsEditing.ts.
#   2. No direct ctx.db.replace against vehicle_facts anywhere.
#   3. No direct ctx.db.insert into vehicle_facts_audit outside the helper.
#   4. No new embedding writes anywhere in convex/.
#      (Pre-existing rows on disk still have embedding until the combined
#      v3 lifecycle backfill clears them; that one path is the only
#      legitimate place an "embedding:" token may appear in code.
#      File: convex/oto/migrations/backfillV3Lifecycle.ts.)
#   5. The retired parallel-table name vehicle_searched_facts must never
#      reappear in the codebase outside the deprecation stub + docs.
#   6. Chat-tool moat-table reads in convex/oto/ must go through the
#      EvalTest filter helper. Bypass paths: evalHarness.ts (Wave 1.4 v3
#      case (d) + Wave 5.1 Cat G require it), migrations/, evalTestFilter.ts
#      itself, convex/admin/, convex/vehicleEnrichment/. Heuristic check
#      (perfect enforcement needs AST); see Rule 6 body for details.
#   7. Wave 7.3 moat rate-limit: direct ctx.db.query("<moat_table>") inside
#      convex/oto/ must route through the queryMoat helper. Bypass paths:
#      queryMoat.ts (the helper itself), migrations/ (backfill bypass),
#      evalHarness.ts (internal eval bypass), evalTestFilter.ts (sentinel
#      filtering bypass). Per-call EXEMPT: annotations grandfather the
#      4-site services-moat hole accepted in D-Q1 per
#      docs/SPRINT_1/WAVE_7_3_QUERY_CONTEXT_DECISION.md §6.1.
#
# Exit codes:
#   0 — clean
#   1 — at least one rule fired; PR is blocked
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$REPO_ROOT"

VIOLATIONS=0
HELPER_FILE="convex/oto/vehicleFactsEditing.ts"
DEPRECATION_STUB="convex/oto/searchedFacts.ts"
V3_BACKFILL_FILE="convex/oto/migrations/backfillV3Lifecycle.ts"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

echo "Running vehicle-facts invariant CI checks (consolidated v3)..."
echo ""

# Rule 1
echo "Rule 1: forbidden direct patches on vehicle_facts..."
RULE_1_HITS=$(
  rg -n 'ctx\.db\.patch\(' convex/ --type ts -B 2 -A 4 \
  | rg -B 2 -A 4 '"vehicle_facts"|<"vehicle_facts">' \
  | rg -v "^$HELPER_FILE" \
  | rg -v "^convex/oto/migrations/" \
  || true
)
if [ -n "$RULE_1_HITS" ]; then
  red "  FAIL — direct ctx.db.patch against vehicle_facts outside $HELPER_FILE:"
  echo "$RULE_1_HITS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 2
echo "Rule 2: forbidden direct replace on vehicle_facts..."
RULE_2_HITS=$(
  rg -n 'ctx\.db\.replace\(' convex/ --type ts -B 2 -A 4 \
  | rg '"vehicle_facts"|<"vehicle_facts">' \
  || true
)
if [ -n "$RULE_2_HITS" ]; then
  red "  FAIL — ctx.db.replace against vehicle_facts is never legal:"
  echo "$RULE_2_HITS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 3
echo "Rule 3: forbidden direct insert into vehicle_facts_audit..."
RULE_3_HITS=$(
  rg -n 'ctx\.db\.insert\("vehicle_facts_audit"' convex/ --type ts \
  | rg -v "^$HELPER_FILE" \
  || true
)
if [ -n "$RULE_3_HITS" ]; then
  red "  FAIL — direct insert into vehicle_facts_audit outside $HELPER_FILE:"
  echo "$RULE_3_HITS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 4
echo "Rule 4: no new embedding writes..."
RULE_4_HITS=$(
  rg -n 'embedding\s*:\s*' convex/ --type ts \
  | rg -v "^convex/_generated/" \
  | rg -v "^$V3_BACKFILL_FILE" \
  | rg -v "^convex/schema\.ts" \
  || true
)
if [ -n "$RULE_4_HITS" ]; then
  red "  FAIL — embedding writes detected (D-3.12 violation):"
  echo "$RULE_4_HITS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 5
echo "Rule 5: retired vehicle_searched_facts name must not reappear..."
RULE_5_HITS=$(
  rg -n 'vehicle_searched_facts' convex/ app/ components/ hooks/ stores/ services/ lib/ 2>/dev/null \
    --type ts --type tsx --type md \
  | rg -v "^$DEPRECATION_STUB" \
  | rg -v "^convex/schema\.ts" \
  | rg -v "_CONSOLIDATED\.md$" \
  | rg -v "_CORRECTION_LOG\.md$" \
  || true
)
if [ -n "$RULE_5_HITS" ]; then
  red "  FAIL — retired parallel-table name reappeared in non-deprecation paths:"
  echo "$RULE_5_HITS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 6 — chat-tool moat-table reads must filter EvalTest.
#
# Heuristic: enumerate every ctx.db.query("<moat_table>") inside convex/oto/,
# strip the sanctioned bypass paths, then for each remaining file confirm
# that it imports from "./evalTestFilter" (or that the call site is
# annotated with a 1-line `EXEMPT:` comment justifying the bypass on the
# same or immediately preceding line). Perfect enforcement requires AST
# analysis (e.g., confirming the filter actually wraps the result); this
# rule catches the obvious "added a new chat-tool read path without ever
# touching the filter helper" miss. Code review backstops the rest.
#
# Bypass paths (legitimate EvalTest readers):
#   * convex/oto/evalHarness.ts          - Wave 1.4 v3 case (d), Wave 5.1 Cat G
#   * convex/oto/migrations/             - seed + backfills cross the boundary
#   * convex/oto/evalTestFilter.ts       - the helper itself
#   * convex/admin/                      - admin tooling sees everything
#   * convex/vehicleEnrichment/          - pipeline owns the tables
echo "Rule 6: chat-tool moat reads must filter EvalTest..."
MOAT_TABLES='vehicle_configs|makes|models|trims|engines|transmissions|chassis_specs|chassis_variants|trim_specs|drivetrain_configs|oem_parts|part_fitments|part_prices|tire_brands|tire_models|tire_pricing|services|service_categories|service_options|service_vehicle_specs|service_intervals|labor_times|mechanic_verifications|model_year_cache|trim_year_cache|scrape_cache'
RULE_6_HITS=$(
  rg -n "ctx\.db\.query\(\"($MOAT_TABLES)\"" convex/oto/ --type ts \
  | rg -v "^convex/oto/evalHarness\.ts" \
  | rg -v "^convex/oto/migrations/" \
  | rg -v "^convex/oto/evalTestFilter\.ts" \
  || true
)
RULE_6_VIOLATIONS=""
if [ -n "$RULE_6_HITS" ]; then
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file="${hit%%:*}"
    rest="${hit#*:}"
    lineno="${rest%%:*}"
    # Check 1: file imports the filter helper somewhere.
    if rg -q 'from\s+"\./evalTestFilter"|from\s+"\.\./oto/evalTestFilter"' "$file" 2>/dev/null; then
      continue
    fi
    # Check 2: hit line or one of the 2 lines above is annotated EXEMPT.
    start=$(( lineno > 2 ? lineno - 2 : 1 ))
    if sed -n "${start},${lineno}p" "$file" 2>/dev/null | rg -q 'EXEMPT:'; then
      continue
    fi
    RULE_6_VIOLATIONS="${RULE_6_VIOLATIONS}${hit}"$'\n'
  done <<< "$RULE_6_HITS"
fi
if [ -n "$RULE_6_VIOLATIONS" ]; then
  red "  FAIL — chat-tool moat-table reads without EvalTest filter import or EXEMPT annotation:"
  printf "%s" "$RULE_6_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 7 -- Wave 7.3 moat rate-limit: direct moat-table reads inside
# convex/oto/ must route through the queryMoat wrapper. Mirrors Rule 6's
# bypass-path + EXEMPT-annotation pattern.
#
# Bypass paths (legitimate non-rate-limited readers):
#   * convex/oto/queryMoat.ts            - the helper itself
#   * convex/oto/migrations/             - backfill bypass (no user ctx)
#   * convex/oto/evalHarness.ts          - internal eval bypass
#   * convex/oto/evalTestFilter.ts       - sentinel filtering bypass
#
# Grandfather mechanism: per-call `EXEMPT: <reason>` annotation on the hit
# line or one of the 2 lines above grandfathers existing reads. The 4-site
# services-moat hole (services, service_categories, service_options,
# service_vehicle_specs) accepted in D-Q1 is grandfathered this way at
# each site once Option B migration begins. See
# docs/SPRINT_1/WAVE_7_3_QUERY_CONTEXT_DECISION.md §6.1.
echo "Rule 7: moat-table reads must route through queryMoat helper..."
MOAT_TABLES_W7_3='makes|models|generations|trims|engines|transmissions|chassis_variants|chassis_specs|vehicle_configs|drivetrain_configs|trim_specs|oem_parts|part_fitments|part_prices|services|service_categories|service_options|service_vehicle_specs|service_intervals|labor_times|mechanic_verifications|tire_brands|tire_size_cache|tire_models|tire_pricing|model_year_cache|trim_year_cache|vehicle_facts'
RULE_7_HITS=$(
  rg -n "ctx\.db\.query\(\"($MOAT_TABLES_W7_3)\"" convex/oto/ --type ts \
  | rg -v "^convex/oto/queryMoat\.ts" \
  | rg -v "^convex/oto/migrations/" \
  | rg -v "^convex/oto/evalHarness\.ts" \
  | rg -v "^convex/oto/evalTestFilter\.ts" \
  || true
)
RULE_7_VIOLATIONS=""
if [ -n "$RULE_7_HITS" ]; then
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file="${hit%%:*}"
    rest="${hit#*:}"
    lineno="${rest%%:*}"
    # Per-call EXEMPT annotation grandfathers the read.
    start=$(( lineno > 2 ? lineno - 2 : 1 ))
    if sed -n "${start},${lineno}p" "$file" 2>/dev/null | rg -q 'EXEMPT:'; then
      continue
    fi
    RULE_7_VIOLATIONS="${RULE_7_VIOLATIONS}${hit}"$'\n'
  done <<< "$RULE_7_HITS"
fi
if [ -n "$RULE_7_VIOLATIONS" ]; then
  red "  FAIL -- moat-table reads outside queryMoat helper / bypass paths / EXEMPT annotation:"
  printf "%s" "$RULE_7_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 8 -- Wave 4 prompt-split discipline: convex/oto/system_prompt.ts must
# remain a thin shim re-exporting from convex/oto/prompt/. STABLE_PROMPT_SECTION
# and VOLATILE_PROMPT_SECTION may only be imported from within convex/oto/prompt/.
# Catches: silent re-merging of the split, boundary leak to chat.ts or other
# consumers.
echo "Rule 8: prompt-split discipline (shim integrity + section import boundary)..."
RULE_8_VIOLATIONS=""

# 8a: system_prompt.ts must be a shim (<=30 lines).
SHIM="convex/oto/system_prompt.ts"
if [ -f "$SHIM" ]; then
  SHIM_LINES=$(wc -l < "$SHIM" | tr -d ' ')
  if [ "$SHIM_LINES" -gt 30 ]; then
    RULE_8_VIOLATIONS="$RULE_8_VIOLATIONS  $SHIM has $SHIM_LINES lines (max 30 for shim integrity)
"
  fi
else
  RULE_8_VIOLATIONS="$RULE_8_VIOLATIONS  $SHIM is missing -- expected re-export shim
"
fi

# 8b: STABLE_PROMPT_SECTION / VOLATILE_PROMPT_SECTION imports outside convex/oto/prompt/.
SECTION_LEAKS=$(grep -rnE "(STABLE_PROMPT_SECTION|VOLATILE_PROMPT_SECTION)" convex/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "^convex/oto/prompt/" || true)
if [ -n "$SECTION_LEAKS" ]; then
  RULE_8_VIOLATIONS="$RULE_8_VIOLATIONS  STABLE/VOLATILE_PROMPT_SECTION imported outside convex/oto/prompt/:
$SECTION_LEAKS
"
fi

if [ -n "$RULE_8_VIOLATIONS" ]; then
  red "  FAIL -- prompt-split discipline violations:"
  printf "%b" "$RULE_8_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 9 -- Wave 7.3 MOAT_TABLES list integrity: the MOAT_TABLES const in
# queryMoat.ts must contain exactly 28 v.literal entries (the documented moat
# count). Changes require a corresponding amendment in ARCHITECTURE_v3_AMENDMENTS.md.
# Catches: silent addition or removal of moat tables (which changes the surface
# area Wave 7.3 defends).
echo "Rule 9: MOAT_TABLES list integrity (28 entries; matches architecture amendment)..."
RULE_9_VIOLATIONS=""

QM="convex/oto/queryMoat.ts"
EXPECTED_MOAT_COUNT=28
if [ -f "$QM" ]; then
  # Count entries that look like table-name string literals inside a MOAT_TABLES
  # array. Tolerant of formatting variation: count quoted strings on lines between
  # 'MOAT_TABLES' opening and the closing bracket.
  ACTUAL_COUNT=$(awk '
    /MOAT_TABLES[^A-Za-z0-9_]/ {in_block=1}
    in_block && /\]/ {in_block=0}
    in_block && /"[a-z_]+"/ {
      n=gsub(/"[a-z_]+"/, "&")
      total += n
    }
    END {print total+0}
  ' "$QM")
  if [ "$ACTUAL_COUNT" != "$EXPECTED_MOAT_COUNT" ]; then
    RULE_9_VIOLATIONS="$RULE_9_VIOLATIONS  MOAT_TABLES count in $QM is $ACTUAL_COUNT, expected $EXPECTED_MOAT_COUNT.
"
    RULE_9_VIOLATIONS="$RULE_9_VIOLATIONS  If you intentionally changed the list, also update docs/ARCHITECTURE_v3_AMENDMENTS.md
"
    RULE_9_VIOLATIONS="$RULE_9_VIOLATIONS  AND update EXPECTED_MOAT_COUNT in this script.
"
  fi
else
  RULE_9_VIOLATIONS="$RULE_9_VIOLATIONS  $QM is missing -- expected queryMoat wrapper helper
"
fi

if [ -n "$RULE_9_VIOLATIONS" ]; then
  red "  FAIL -- MOAT_TABLES integrity violations:"
  printf "%b" "$RULE_9_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 10 -- Wave 7.3 bumpMoat literal integrity (Sprint 2 Day 3): every
# bumpMoat("X", ...) call in convex/oto/ must pass a table-name literal that is
# either (a) a member of the MOAT_TABLES set, OR (b) a "+"-joined composite of
# MOAT_TABLES members (the conservative-attribution pattern used by
# lookup_vehicle_spec's multi-table read), OR (c) preceded by an EXEMPT:
# annotation. Defends against typos and against drift when Rule 9's MOAT_TABLES
# list changes (a bumpMoat with a name removed from MOAT_TABLES would silently
# misattribute the rate-limit counter). Multi-line aware: looks at the bumpMoat
# anchor line plus the two following lines for the first quoted argument.
echo "Rule 10: bumpMoat literal integrity (every call passes a moat-table name)..."
RULE_10_VIOLATIONS=""
RULE_10_ANCHORS=$(rg -n 'bumpMoat\(' convex/oto/ --type ts 2>/dev/null || true)
if [ -n "$RULE_10_ANCHORS" ]; then
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file="${hit%%:*}"
    rest="${hit#*:}"
    lineno="${rest%%:*}"
    arg=$(sed -n "${lineno},$((lineno+2))p" "$file" 2>/dev/null | tr '\n' ' ' \
          | sed -nE 's/.*bumpMoat\([[:space:]]*"([^"]+)".*/\1/p' | head -1)
    if [ -z "$arg" ]; then
      start=$(( lineno > 2 ? lineno - 2 : 1 ))
      if sed -n "${start},${lineno}p" "$file" 2>/dev/null | rg -q 'EXEMPT:'; then
        continue
      fi
      RULE_10_VIOLATIONS="${RULE_10_VIOLATIONS}  $file:$lineno  bumpMoat( called with non-literal argument (only literal table names allowed; use EXEMPT: to grandfather)
"
      continue
    fi
    valid=0
    case "|$MOAT_TABLES_W7_3|" in
      *"|$arg|"*) valid=1 ;;
    esac
    if [ $valid -eq 0 ] && [ "$arg" != "${arg/+/}" ]; then
      composite_ok=1
      OLD_IFS="$IFS"
      IFS='+'
      for piece in $arg; do
        case "|$MOAT_TABLES_W7_3|" in
          *"|$piece|"*) ;;
          *) composite_ok=0; break ;;
        esac
      done
      IFS="$OLD_IFS"
      if [ $composite_ok -eq 1 ]; then valid=1; fi
    fi
    if [ $valid -eq 0 ]; then
      start=$(( lineno > 2 ? lineno - 2 : 1 ))
      if sed -n "${start},${lineno}p" "$file" 2>/dev/null | rg -q 'EXEMPT:'; then
        valid=1
      fi
    fi
    if [ $valid -eq 0 ]; then
      RULE_10_VIOLATIONS="${RULE_10_VIOLATIONS}  $file:$lineno  bumpMoat(\"$arg\") -- \"$arg\" not in MOAT_TABLES, not a valid composite, no EXEMPT annotation
"
    fi
  done <<< "$RULE_10_ANCHORS"
fi
if [ -n "$RULE_10_VIOLATIONS" ]; then
  red "  FAIL -- bumpMoat called with non-MOAT_TABLES argument:"
  printf "%b" "$RULE_10_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Rule 11 -- delete protection on protected tables (Sprint 2 Day 3): direct
# ctx.db.delete(...) inside convex/oto/ is restricted to the migrations/
# teardown path (legitimate cleanup, e.g. cleanupEvalVerifiedFact in
# verifiedFactsSeed.ts). vehicle_facts_audit MUST remain append-only outside
# that path -- deleting audit rows for an unrelated fact breaks the safety
# property D-3.2 relocated to the audit log per PM Ruling v3 sec.4.2.
# vehicle_facts retraction is a status flip via editVehicleFact, never a
# delete. fact_reports deletes only happen during fact teardown (when the
# parent row is also being removed). Future admin tooling can be grandfathered
# with an EXEMPT: <reason> annotation above the call.
echo "Rule 11: delete protection on protected tables..."
RULE_11_HITS=$(
  rg -n 'ctx\.db\.delete\(' convex/oto/ --type ts \
  | rg -v "^convex/oto/migrations/" \
  || true
)
RULE_11_VIOLATIONS=""
if [ -n "$RULE_11_HITS" ]; then
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file="${hit%%:*}"
    rest="${hit#*:}"
    lineno="${rest%%:*}"
    start=$(( lineno > 2 ? lineno - 2 : 1 ))
    if sed -n "${start},${lineno}p" "$file" 2>/dev/null | rg -q 'EXEMPT:'; then
      continue
    fi
    RULE_11_VIOLATIONS="${RULE_11_VIOLATIONS}${hit}
"
  done <<< "$RULE_11_HITS"
fi
if [ -n "$RULE_11_VIOLATIONS" ]; then
  red "  FAIL -- ctx.db.delete outside migrations/ (teardown path) without EXEMPT annotation:"
  printf "%s" "$RULE_11_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""

# Summary
if [ $VIOLATIONS -eq 0 ]; then
  green "All vehicle-facts invariant checks passed (11/11 rules clean)."
  exit 0
else
  red "$VIOLATIONS rule violation(s)."
  yellow "Use recordVehicleFact / editVehicleFact / reportVehicleFact / resolveFactReport"
  yellow "  from $HELPER_FILE."
  yellow "For Rule 6: import from convex/oto/evalTestFilter and apply isEvalTestMake /"
  yellow "  excludeEvalTestVehicleConfig / isEvalTestConfigId at the call site, OR add a"
  yellow "  one-line 'EXEMPT: <reason>' comment immediately above the moat-table read."
  yellow "For Rule 7: route the moat-table read through queryMoat from"
  yellow "  convex/oto/queryMoat.ts, OR add a one-line 'EXEMPT: <reason>' comment"
  yellow "  immediately above the read for grandfathered sites (e.g. the 4-table"
  yellow "  services-moat hole accepted in D-Q1)."
  yellow "For Rule 10: pass a literal table name from MOAT_TABLES in queryMoat.ts,"
  yellow "  OR a '+'-joined composite of MOAT_TABLES members (e.g. for multi-table"
  yellow "  reads), OR annotate the call with an 'EXEMPT: <reason>' comment."
  yellow "For Rule 11: deletes on vehicle_facts / vehicle_facts_audit / fact_reports"
  yellow "  belong in convex/oto/migrations/ teardown helpers (e.g."
  yellow "  cleanupEvalVerifiedFact). For new admin tooling, annotate EXEMPT."
  yellow "If you genuinely need a new mutation pattern, update the helper, the schema,"
  yellow "  MEMORY_SCHEMA_V3_CONSOLIDATED, and this script."
  exit 1
fi
