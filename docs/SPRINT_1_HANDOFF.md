# Sprint 1 — Handoff
**Date:** 2026-05-16
**Author:** Cowork PM (handing off to Waleed)
**Status:** Sprint 1 work is on disk, compiles, CI invariants hold. Not yet committed. Owning this handoff myself; you take it from here.

---

## Read this first

The Edit/Write file tools in the cowork sandbox had recurring truncation bugs throughout Sprint 1 — large writes succeeded at the tool layer but lost their tails at the Windows-Linux mount bridge. The Read tool sees an in-memory view that doesn't always match disk. Workaround: `mcp__workspace__bash` writes (`sed -i`, `cat >`, `python3`) persist correctly. Any "this should be on disk but isn't" issue you find is almost certainly this bug, not a logic error in the code.

I also hallucinated more than I'd like about file state — when I claimed "the lock file is still there" earlier, my sandbox `ls` was showing stale metadata that didn't match your Windows reality. Trust your Windows-side view over my reports when they conflict.

Below is the truth about what's on disk right now, what's pending, and exactly how to continue.

---

## 1. What's on disk (Sprint 1 deliverables)

### 1.1 Schema (`convex/schema.ts`)

The `vehicle_facts` table is extended v3-style:

- **Added fields:** `canonical_question_key`, `verification_status` (unverified/verified/retracted), `verified_at`, `retracted_at`, `report_count`, `last_reported_at`, `written_by`, `asked_by_user_id`, `asked_at`
- **Added indexes:** `by_canonical_question`, `by_verification_status`, `by_report_count`, plus `searchIndex("by_text")`
- **Removed:** `embedding` field and `vectorIndex("by_embedding")`

Three new tables added at the bottom:
- `vehicle_facts_audit` — append-only edit history
- `fact_reports` — user-submitted reports
- `oto_migrations`, `reconciliation_runs`, `prompt_changelog` — system tables

File is 2400 lines, tsc clean.

### 1.2 Mutation helpers

| File | Purpose |
|---|---|
| `convex/oto/vehicleFactsEditing.ts` | `recordVehicleFact` (create), `editVehicleFact` (atomic patch + audit), `reportVehicleFact` (user report + counter bump), `resolveFactReport` (admin disposition close) |
| `convex/oto/canonicalize.ts` | Pure `normalize()`, `sha256Hex()`, `canonicalQuestionKey()` |
| `convex/oto/factReports.ts` | Single-line re-export of `reportVehicleFact as report` for harness path stability |
| `convex/oto/promptChangelog.ts` | Wave 1.5 mutations: `recordPromptChange`, `markRolloutStarted`, `markRolloutOutcome`, `setActivePromptVersion`, `listRecentChanges` |
| `convex/oto/searchedFacts.ts` | Deprecation stub — re-exports from `vehicleFactsEditing.ts` |

### 1.3 Reads

| File | Purpose |
|---|---|
| `convex/oto/vehicleFactsKB.ts` | `cascadeTier2` (T2 cascade: hash → structural → BM25), `lookupFactsByCanonicalHash`, `lookupFactsByText`, `lookupFactsStructural` (extended return shape), `getFactById`, `insertFact`, `recordFact` (legacy, kept for compat). Embedding consumers deleted. Locked disclaim-tag predicate: `computeRenderDisclaimTag()` at top of file. |
| `convex/oto/evalHarness.ts` | `runFullCascade` action: T1 (enrichment tables) → T2 → T3 (stub). 20-topic mapping for T1. |
| `convex/oto/evalTestFilter.ts` | `isEvalTestMake`, `excludeEvalTestVehicleConfig`, `isEvalTestConfigId` — sentinel-namespace filter |

### 1.4 Migrations + cron

| File | Purpose |
|---|---|
| `convex/oto/migrations/backfillV3Lifecycle.ts` | Combined lifecycle defaults + embedding-strip in one pass per row. Idempotent. 309 lines, brace-balanced, tsc clean. |
| `convex/oto/migrations/vehicleFactsReconciliation.ts` | 4 checks (replay-equivalence, counter parity, orphan audit rows, telemetry parity) + driver action. ~32 KB. |
| `convex/oto/migrations/evalTenantsSeed.ts` | `seedEvalTenants` + `teardownEvalTenants` — multi-tenant fixture seed under `make = "EvalTest"` sentinel. Idempotent. |
| `convex/crons.ts` | Registers reconciliation cron every 15 minutes. |

### 1.5 Eval harness (`scripts/eval/`)

| File | Purpose |
|---|---|
| `wave_5_1_harness.ts` | Retrieval-quality harness. CLI: `npx tsx ... --live --repeats 10 --out ./scripts/eval/runs/` |
| `wave_1_4_v3_harness.ts` | 6 case categories (a-f). Category (f) loads from JSONL fixture. |
| `wave_1_5_compare.ts` | Two-prompt-version comparator with Wilcoxon signed-rank + Wilson 95% CI. Exit 0/1 = PASS/FAIL. |
| `rollback_prompt.sh` | One-command emergency rollback for prompt PRs. |
| `lib/cascadeClient.ts`, `lib/metrics.ts`, `lib/metrics.test.ts`, `lib/wave_2_4_loader.ts`, `lib/wave_2_4_loader.test.ts`, `lib/multiTenantSetup.ts` | Supporting modules |
| `fixtures/wave_5_1_labeled_set.jsonl` | 36 labeled retrieval entries across 9 categories |
| `fixtures/wave_2_4_cases.jsonl` | 8 contrastive Wave 2.4 cases (3 right + 3 wrong answer-body + 2 post-report) |

### 1.6 CI

`scripts/ci/vehicle-facts-grep.sh` — 6 rules pinning the v3 invariants. All 6 currently clean (verified via bash):

1. No direct `ctx.db.patch` on `vehicle_facts` outside the helper
2. No `ctx.db.replace` on `vehicle_facts` anywhere
3. No direct insert into `vehicle_facts_audit` outside the helper
4. No new embedding writes anywhere in `convex/`
5. Retired `vehicle_searched_facts` name must not reappear (deprecation stub + docs exempt)
6. Chat-tool moat-table reads must filter EvalTest (heuristic — import OR `EXEMPT:` annotation)

Plus `scripts/ci/searched-facts-grep.sh` — deprecation stub that `exec`s the new script.

### 1.7 Docs

- `PM_RULING_2026-05-16_seam_and_kb_persistence.md` — v3 architectural ruling
- `ARCHITECTURE_v3_AMENDMENTS.md` — Decision Log + Migration Plan + Risk Register amendments, including R-3 farm-case acceptance you signed off (§C.4.1)
- `SUBSTRATE_NOTES.md` — Infrastructure Architect substrate sign-off
- `SPRINT_0_PLAN.md` + `SPRINT_0/` — pre-flight subagent deliverables
- `SPRINT_1/` — daily-work subagent outputs:
  - `RECONCILIATION_RUNBOOK.md`
  - `WAVE_7_3_RATE_LIMIT_DESIGN.md`
  - `WAVE_7_3_QUERY_CONTEXT_DECISION.md`
  - `WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md`
  - `WAVE_5_2_BASELINE_RUNBOOK.md`
  - `WAVE_2_4_PR_DRAFT.md`
- `SPRINT_1_DAY_*_LOG.md` — 7 daily execution logs + 1 correction log

---

## 2. The commit (your action)

Sandbox can't touch `.git/index.lock`. From Windows PowerShell:

```powershell
# 1. Remove any stale lock
Remove-Item C:\Users\manso\Desktop\otopair-1\.git\index.lock -Force -ErrorAction SilentlyContinue

# 2. Stage Sprint 1 files only (skips your other in-progress changes)
cd C:\Users\manso\Desktop\otopair-1
git add convex/schema.ts `
        convex/oto/chat.ts `
        convex/oto/vehicleFacts.ts `
        convex/oto/vehicleFactsKB.ts `
        convex/oto/vehicleHealth.ts `
        convex/oto/lookupVehicleSpec.ts `
        convex/oto/searchedFacts.ts `
        convex/oto/vehicleFactsEditing.ts `
        convex/oto/canonicalize.ts `
        convex/oto/canonicalize.test.ts `
        convex/oto/factReports.ts `
        convex/oto/evalHarness.ts `
        convex/oto/evalTestFilter.ts `
        convex/oto/promptChangelog.ts `
        convex/oto/migrations/ `
        convex/crons.ts `
        scripts/ci/vehicle-facts-grep.sh `
        scripts/ci/searched-facts-grep.sh `
        scripts/eval/ `
        docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md `
        docs/ARCHITECTURE_v3_AMENDMENTS.md `
        docs/SUBSTRATE_NOTES.md `
        docs/SPRINT_0_PLAN.md `
        docs/SPRINT_0/ `
        docs/SPRINT_1/ `
        docs/SPRINT_1_DAY_1_LOG.md `
        docs/SPRINT_1_DAY_1_CORRECTION_LOG.md `
        docs/SPRINT_1_DAY_2_LOG.md `
        docs/SPRINT_1_DAY_3_LOG.md `
        docs/SPRINT_1_DAY_4_LOG.md `
        docs/SPRINT_1_DAY_5_LOG.md `
        docs/SPRINT_1_DAY_6_LOG.md `
        docs/SPRINT_1_DAY_7_LOG.md `
        docs/SPRINT_1_HANDOFF.md

# 3. Verify staged count is ~40-50 files; check git diff --cached --stat
git diff --cached --stat | tail -5

# 4. Commit
git commit -m "Sprint 1: v3 KB consolidation + eval infrastructure (Days 1-8)"
```

If git complains about a hook failing or the staged set looks wrong, run `git status --short` and decide.

---

## 3. Verify after commit

```bash
# All 6 CI grep rules should pass
bash scripts/ci/vehicle-facts-grep.sh

# Sprint 1 files should compile clean (errors in _generated/ are auto-regen targets, ignore)
npx tsc --noEmit | findstr /V "_generated _expo node_modules"
```

Expected: zero output from the tsc command (or only `convex/_generated/api.d.ts` errors which regen on next `npx convex dev`).

---

## 4. What's NOT done — your decisions/actions queue

### Blocking the first end-to-end Wave 1.5 protocol run

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | **Wave 5.2 baseline measurement** (10-min manual op) | You | Runbook at `docs/SPRINT_1/WAVE_5_2_BASELINE_RUNBOOK.md` |
| 2 | **Wave 2.4 token budget call** (200 / 290 / 540 / 865 tokens) | You | PR draft is at `docs/SPRINT_1/WAVE_2_4_PR_DRAFT.md` — currently sized at 865 |
| 3 | **A/B start percentage for first Wave 1.5 protocol run** (100% direct vs 25% canary) | You | I lean 25% canary as a stress test on the protocol |
| 4 | **Run `runBackfillV3Lifecycle` against live Convex** | You | `npx convex run oto/migrations/backfillV3Lifecycle:runBackfillV3Lifecycle '{"batchSize":256}'` |

### Wave 7.3 design decisions (Security Analyst design doc complete)

| # | Item | Reference |
|---|---|---|
| 5 | D-Q1: services-moat 4-table Adv-1 hole acceptance | `WAVE_7_3_QUERY_CONTEXT_DECISION.md` §10 |
| 6 | D-Q2: tripwire criterion (proposed 10× p95 sustained 24h) | Same |
| 7 | D-Q3: CI Rule 7 with 4-site grandfather list | Same |

### Wave 1.5 calibration follow-ups

| # | Item | When |
|---|---|---|
| 8 | 5% per-case drop threshold — possible per-category tuning | After first 3 prompt PRs land |
| 9 | 48h A/B window — possible compress to 24h for volatile-only | After 3 clean rollouts |
| 10 | Stable-prompt co-signer = Temur? | Now or next sprint |
| 11 | GitHub team handle formalization | When team grows past 3 |
| 12 | Wave 4 split — `locked_principles.ts` as separate file? | When Wave 4 ships |

### Carryover

| # | Item | Notes |
|---|---|---|
| 13 | T3 web_search wiring in `evalHarness.runFullCascade` | Currently stubbed; harness runs fine with `--no-web-search` |
| 14 | `cascadeTier2` per-row FK walk for EvalTest filter | Defer; only needed if seed scope extends to `vehicle_facts` |
| 15 | Wave 4 stable/volatile prompt split | Defer until Wave 2.4 lands cleanly |

---

## 5. Known issues / sharp edges

### 5.1 The Edit/Write truncation pattern

Throughout Sprint 1, the cowork-sandbox Edit and Write tools succeeded at their own layer but truncated some writes at the Windows-Linux mount bridge. Symptoms: files end mid-line, mid-statement, or mid-word. The Read tool's view doesn't always match disk. Workaround: bash writes (`sed -i`, `cat >`, `python3` heredocs) persist correctly. If you ever see a Sprint 1 file with TS errors at its tail, suspect this pattern first.

I added one CI mitigation (`scripts/ci/vehicle-facts-grep.sh` runs grep over bash, which sees ground truth) but didn't build a general "no truncated TS file" pre-commit check. Recommendation: add a `tsc --noEmit | grep -c error` check to your pre-commit hook so silent truncations can't sneak past.

### 5.2 The Day 8 restoration rollback

When I had a subagent restore truncated files on Day 8, they used `git show HEAD:` for 4 files (`chat.ts`, `lookupVehicleSpec.ts`, `vehicleFacts.ts`, `vehicleHealth.ts`). That worked for compilation but rolled them back to pre-Sprint-1 HEAD, losing the Day 1 / Day 2 / Day 4 / Day 5 changes that had never been committed. I re-applied those changes via bash today:

- `chat.ts`: `retrieve_vehicle_facts` callable now uses `cascadeTier2` + EvalTest short-circuit; `record_vehicle_fact` callable now uses `recordVehicleFact` (the v3 helper) + inline `canonicalQuestionKey` + confidence clamp ≤ 0.7 + `written_by: "chat_agent"`; added imports for `canonicalQuestionKey` and `internal`
- `lookupVehicleSpec.ts`: `isEvalTestMake` import + filter on `allMakes`
- `vehicleFacts.ts`: `isEvalTestMake` import + throw `"vehicle not found"` if `makeRow` is EvalTest
- `vehicleHealth.ts`: `isEvalTestMake` import + throw after FK walk through `config.make_id`

All four compile clean. All six CI rules pass.

The lesson recorded: **commit at end of every Sprint day going forward.** I should have prompted you to commit earlier; not committing meant the Day 8 corruption-fix attempt had no safe rollback point.

### 5.3 Lock file ghosting

If you see the sandbox claim `.git/index.lock` exists when it doesn't on Windows, that's the mount bridge caching old directory metadata. Trust your Windows-side view. The sandbox can't always see the live lock state.

### 5.4 `convex/_generated/api.d.ts` may show truncation

The agent reported it ends mid-string at line 370. That file regenerates on every `npx convex dev` so the truncation is moot once you re-deploy — but if you see TS errors from it, that's why. Just rerun `npx convex dev` to regenerate.

---

## 6. The 8 days, in three sentences

Sprint 1 consolidated `vehicle_searched_facts` into `vehicle_facts` (one KB table, source-typed trust), removed the embedding column + vectorIndex (D-3.12), and shipped audit + report + migration + reconciliation infrastructure. The eval harness ships 6 case categories with Wilson 95% CIs and JSONL-judge support; the Wave 1.5 prompt-change protocol with comparator + rollback makes P-9 ("never change the prompt on vibes, only against the eval") actually enforceable. R-3 farm-case risk is explicitly accepted per your reasoning that any $500-$2500 attack is unstoppable at single-account-rate-limit scope.

---

## 7. If anything in this handoff is wrong

Trust your Windows-side observations. The sandbox view has been unreliable. When in doubt:
- `git status` on Windows tells you the real state of staged/unstaged files
- `npx tsc --noEmit` on Windows tells you the real compile state
- `bash scripts/ci/vehicle-facts-grep.sh` is the same on both sides

I should have committed at the end of each day. I didn't. That's the single biggest process mistake of this sprint. If you take one rule into Sprint 2: **end-of-day commits, no exceptions.**

— End of handoff.
