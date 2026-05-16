# Wave 5.2 — Baseline-Execution Runbook

**Author:** AI QA & Evaluation Lead (Doc 3 §6)
**Status:** v1 — Sprint 1 Day 7 deliverable. The single doc Waleed reads before
the first uncomfortable-baseline measurement run.
**Authority:** Doc 3 §4 (the baseline is the signal); `RAG_WAVE_5_1_V3_CONSOLIDATED.md`
§6 (sequencing); `WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md` §2 (Step 2 baseline
semantics).
**Time to run end-to-end:** ~10 minutes once pre-flight is green.

---

## 0. One-screen summary (read this first)

Wave 5.2 is the **uncomfortable-baseline measurement**. It runs the 36-entry
labeled set (`scripts/eval/fixtures/wave_5_1_labeled_set.jsonl`) plus the
Wave 1.4 v3 programmatic cases against the current 3-tier cascade
(`convex/oto/evalHarness.ts::runFullCascade`), at **N=10 repeats per case**, and
writes two timestamped reports to `scripts/eval/runs/`.

**Why it matters.** Per Doc 3 §4 and `RAG_WAVE_5_1_V3_CONSOLIDATED.md` §6, this
is the first time anyone will have a real number for retrieval quality. Every
prompt PR, every cascade tweak, every Wave 5.3 graduation check is anchored
against the number this run produces. If we don't measure it now — cleanly,
against State 0 (vectorIndex still present) — the comparison Wave 5.3 needs to
publish has nothing to compare against, and the team has to take "the rebuild
helps" on faith. P-9 forbids that.

**What "healthy" looks like** (Wave 5.3 graduation bar, `wave_5_1_harness.ts`
lines 268-275):

```
precision@3 >= 0.70   recall@5 >= 0.80   MRR >= 0.65
tier_misclass <= 0.10   disclaim_correct >= 0.95
under_disclaim <= 0.02   refusal_violation <= 0.05
```

**What "uncomfortable" looks like** (Wave 5.2 expected ranges from
`RAG_WAVE_5_1_V3_CONSOLIDATED.md` §6.4):

| Metric | Expected baseline | What the number is telling us |
|---|---|---|
| precision@3 | **0.25 – 0.45** | Topic router isn't consulted; top-3 picks are off-topic. |
| recall@5 | **0.30 – 0.50** | Single-path retrieval misses cross-tenant structured answers. |
| MRR | **0.20 – 0.40** | When we hit, we hit at rank 2-3 instead of rank 1. |
| disclaim_tag_correctness | **0.10 – 0.30** | The big one. Renderer rarely tags disclaim — web_search answers slip through unbadged. |
| refusal_violation_rate | **0.40 – 0.70** | Trust-protocol register doesn't hold on out-of-scope questions. |

**The number is supposed to be uncomfortable.** That discomfort is what funds
Wave 5.3. Don't sugarcoat the report when you post it.

---

## 1. Pre-flight checklist (~2 minutes)

Run each check before kicking off the harness. Every item has a one-line
verification command.

| # | Check | Verify with |
|---|---|---|
| 1 | Convex deployment has v3 schema + cascade pushed | `npx convex run oto/evalHarness:lookupT1 --arg topic '"engine_oil_capacity_qts"'` returns `[]` (table exists, just empty) instead of `404` |
| 2 | Eval env vars are set in this shell | `echo "$env:OTO_EVAL_CONVEX_URL $env:OTO_EVAL_CONVEX_KEY".Length` is well over `60` |
| 3 | `tsx` available locally | `npx tsx --version` prints a version (install via `npm i -D tsx vitest` per `scripts/eval/README.md` if it errors) |
| 4 | No in-flight schema PR pending merge | `git status` clean on `convex/schema.ts`; `git log --oneline convex/schema.ts -1` lands on a merged commit |
| 5 | `runBackfillV3Lifecycle` has been run at least once on the target deployment | `npx convex run oto/migrations/backfillV3Lifecycle:runBackfillV3Lifecycle` returns `{processed: 0, ...}` on second invocation (idempotent — first run does the work, second confirms completion) |

If item 1 fails: deploy first (`npx convex deploy --prod` or the dev-deployment
equivalent). The full-cascade entry point was added Day 4 and lives at
`convex/oto/evalHarness.ts:580`; if it's not there, the deployment is stale.

If item 5 fails: the v3 lifecycle fields on `vehicle_facts`
(`canonical_question_key`, `verification_status`, `topic`, `topic_axis`, etc.)
will be `undefined` for pre-existing rows, T2_HASH / T2_STRUCT / T2_TEXT will
all return zero, and the baseline you measure will be State-1-shaped — exactly
the trap `RAG_WAVE_5_1_V3_CONSOLIDATED.md` §6.2 warns about.

---

## 2. Execution sequence (~7 commands, ~7 minutes)

Run from the repo root in PowerShell. Each command is copy-pasteable.

### Step 2a — Set env vars for this shell

```powershell
$env:OTO_EVAL_CONVEX_URL = "https://acoustic-otter-123.convex.cloud"   # your deployment URL
$env:OTO_EVAL_CONVEX_KEY = "prod-deploy-key:eyJ2..."                    # admin-role deploy key
```

These are the same vars `scripts/eval/lib/cascadeClient.ts` and
`scripts/eval/lib/multiTenantSetup.ts:configFromEnv()` (lines 95-105) read.
The key MUST have admin role — internal mutations like `seedEvalTenants` are
rejected with `AUTH_ERROR` on non-admin keys.

### Step 2b — Seed multi-tenant fixtures

```powershell
npx tsx -e "import('./scripts/eval/lib/multiTenantSetup.ts').then(async m => { const t = await m.seedTenants(m.configFromEnv()); console.log(JSON.stringify(t, null, 2)); })"
```

Provisions two synthetic users (`eval-user-a@oto-eval.local`,
`eval-user-b@oto-eval.local`) and one fully-enriched
`EvalTest / CrossTenantFixture / 9999` vehicle_config. Required for Wave 5.1
Cat G (cross-tenant) and Wave 1.4 v3 cat (d) cases. Idempotent — safe to
re-run.

### Step 2c — Run Wave 5.1 labeled-set harness (live, N=10)

```powershell
npx tsx scripts/eval/wave_5_1_harness.ts --live --repeats 10 --out ./scripts/eval/runs/
```

Walks the 36 labeled-set entries through `runFullCascade` 10 times each (Doc 4
Wave 1.1 N>=10 floor; cascade is deterministic so the repeats establish the
structural invariant for the LLM-judge waves that share this harness).

Outputs land at:
- `scripts/eval/runs/<ISO-timestamp>.json` — full machine-readable report
- `scripts/eval/runs/<ISO-timestamp>.txt` — human summary (also printed to
  stdout)

**Note the timestamp.** It is the run-id; you need it for Step 2g.

### Step 2d — Run Wave 1.4 v3 programmatic-case harness (live, all categories)

```powershell
npx tsx scripts/eval/wave_1_4_v3_harness.ts --live --category all --repeats 10 --out ./scripts/eval/runs/
```

Runs all five v3 case categories (a tier-routing, b disclaim-render, c
report-flow, d cross-tenant, e audit-invariant). Category (d) live cases
depend on the seed from Step 2b.

Outputs land alongside the Wave 5.1 reports with prefix `w14v3-`.

### Step 2e — Print both summary tables

```powershell
Get-Content (Get-ChildItem ./scripts/eval/runs/*.txt | Sort-Object LastWriteTime -Descending | Select-Object -First 2).FullName
```

This dumps both runs' summary tables to your terminal in reverse-chronological
order: Wave 1.4 v3 first, then Wave 5.1. Skim the top-line metrics block on
each — that's where the uncomfortable numbers will be.

### Step 2f — (Optional) Teardown multi-tenant fixtures

```powershell
npx tsx -e "import('./scripts/eval/lib/multiTenantSetup.ts').then(async m => { await m.teardownTenants(m.configFromEnv()); console.log('teardown ok'); })"
```

Skip this if you plan to re-run the baseline within the next few hours.
Idempotent. Leaving the sentinel rows in place is safe because production chat
already filters them out (Day 5 `convex/oto/evalTestFilter.ts`).

### Step 2g — Capture the run-id pair

Write the two timestamps somewhere durable. Suggested format:

```
Wave 5.2 baseline — 2026-05-16
  wave_5_1 run-id:    2026-05-16T19-23-44-812Z
  wave_1_4_v3 run-id: w14v3-2026-05-16T19-25-11-094Z
  precision@3:        0.31
  recall@5:           0.38
  MRR:                0.27
  disclaim_correct:   0.18  (under_disclaim 0.74 -- directional)
  refusal_violation:  0.55
```

Paste it into the Day-7 sprint log AND into the `prompt_changelog` mutation
call (see §4 below). The Wave 2.4 prompt PR will need the run-id pair to anchor
its Step-2 comparator.

---

## 3. Expected outputs — two annotated examples

The harness's `renderSummary()` function (`wave_5_1_harness.ts:240-310`)
produces a fixed-shape report. Below are two example outputs, both invented,
illustrating what each end of the spectrum looks like.

### 3.1 Healthy baseline (the post-Wave-5.3 target)

```
========================================================================
Wave 5.1 eval -- run 2026-05-16T19-23-44-812Z
mode=live  repeats=10  queries=36  passed=29/36
========================================================================

Top-line metrics (excluding Cat F)
------------------------------------------------------------------------
  precision@3             66.7%      <- target: >=70%, just under bar
  recall@5                78.4%
  MRR                     64.2%
  tier_misclass_rate       8.3%
    T1 -> T2_*             0.0%
    T1 -> T3 (LOUD)        0.0%      <- this MUST be zero (P-9 directional)
    T2_HASH -> STRUCT/TX   2.8%
    T2_STRUCT -> TEXT      2.8%
    T2_* -> T3 (LOUD)      2.8%
  disclaim_tag_correct    94.4%
    over_disclaim_rate     2.8%      <- safe direction
    under_disclaim_rate    2.8%  <- DIRECTIONAL FAILURE
  refusal_violation_rate   4.2%

Wave 5.3 graduation bar (composite acceptance)
------------------------------------------------------------------------
  FAIL  precision@3 >= 0.70           <- needs work (close)
  PASS  recall@5 >= 0.80
  FAIL  MRR >= 0.65                    <- needs work (close)
  PASS  tier_misclass <= 0.10
  FAIL  disclaim_correct >= 0.95       <- needs work (close)
  PASS  under_disclaim <= 0.02
  PASS  refusal_violation <= 0.05
```

**What this means.** The cascade is doing roughly the right thing. T1 hits
when it should, T2 doesn't degrade to T3 except on legitimate misses, the
disclaim tag renders most of the time, refusal cases are mostly held.
`under_disclaim` is the directional metric that matters for trust — at 2.8%
we're just above the 0.02 floor, meaning the renderer occasionally fails to
tag a web_search-derived answer. Three of the seven graduation criteria sit
just below their bars; that's the kind of report where the team finishes the
work in Wave 5.3 by tightening calibration, not by rewriting the cascade.

### 3.2 Uncomfortable baseline (what we actually expect on first run)

```
========================================================================
Wave 5.1 eval -- run 2026-05-16T19-23-44-812Z
mode=live  repeats=10  queries=36  passed=8/36
========================================================================

Top-line metrics (excluding Cat F)
------------------------------------------------------------------------
  precision@3             31.0%      <- in the 0.25-0.45 expected range
  recall@5                38.4%      <- in the 0.30-0.50 expected range
  MRR                     27.3%      <- in the 0.20-0.40 expected range
  tier_misclass_rate     100.0%      <- expected (no tier concept exists yet)
    T1 -> T2_*             0.0%
    T1 -> T3 (LOUD)       12.5%      <- LOUD: T1 answers leaking to web
    T2_HASH -> STRUCT/TX  16.6%
    T2_STRUCT -> TEXT     11.1%
    T2_* -> T3 (LOUD)     41.6%      <- LOUD: cascade falling all the way through
  disclaim_tag_correct    18.0%      <- 0.10-0.30 expected. The big one.
    over_disclaim_rate     8.3%
    under_disclaim_rate   73.6%  <- DIRECTIONAL FAILURE
  refusal_violation_rate  55.5%      <- 0.40-0.70 expected
```

**What this means, line by line.**

- `precision@3` at 0.31 — the embedding-only retriever returns plausibly
  topical text but rarely the specific answer the labeled set asks for. The
  topic router (the routing-by-topic_axis logic that Wave 5.3 introduces)
  isn't consulted, so top-3 picks for an oil-capacity query include
  oil-change-interval entries.

- `recall@5` at 0.38 — half the gold answers aren't reachable in the top 5
  because single-path retrieval doesn't know to consult the structured
  enrichment tables (Cat G cases, cross-tenant, can't be reached without
  routing).

- `MRR` at 0.27 — when we hit, we hit at rank 3-4. The rebuild's HASH-first
  tier should land most retrievals at rank 1.

- `tier_misclass_rate` at 100% — this is by construction, per
  `RAG_WAVE_5_1_V3_CONSOLIDATED.md` §6.4. The current system has no tier
  concept. Read this as "every retrieval is technically misclassified because
  the source-tier label doesn't exist yet." The sub-rates are the load-bearing
  signal: `T1 -> T3 (LOUD)` at 12.5% means in 1-in-8 cases where the labeled
  set says "this is a T1 manufacturer-spec answer," the system jumped all the
  way to web_search. That's a directional violation of Locked Principle #4
  (trust hierarchy).

- **`disclaim_tag_correctness` at 0.18** — the most uncomfortable number.
  82% of cases where the labeled set says "the answer must be tagged
  unverified/web-sourced," the renderer doesn't tag it. `under_disclaim_rate`
  at 73.6% is the directional failure: we're shipping web-sourced answers to
  users as if they were manufacturer-spec. **This is the single biggest
  trust-protocol gap Wave 5.3 has to close.**

- `refusal_violation_rate` at 0.55 — on more than half of Cat F (out-of-scope)
  queries, the system still produces a retrieval candidate instead of
  refusing. The trust-protocol register isn't holding on out-of-scope
  questions. This is the second-biggest trust gap.

**Read the numbers as the signal Doc 3 §4 asked for.** Uncomfortable is the
shape we expected; the rebuild is justified on its own merits.

---

## 4. What to do with the numbers

The Wave 1.5 protocol's Step 2 (`WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md` §2) wants
the candidate-vs-baseline comparison to anchor against a labeled `prompt_version`
row in `prompt_changelog`. Wave 2.4 (the first PR to ride the Wave 1.5 rails) is
queued; it will look up the most recent `prompt_changelog` row with version
`v0.9-pre-wave-2-4-baseline` and run its candidate against this measurement.

**File the baseline row immediately after Step 2g.** From the repo root:

```powershell
npx convex run oto/promptChangelog:recordPromptChange `
  --arg prompt_version '"v0.9-pre-wave-2-4-baseline"' `
  --arg prev_version '"v0.9"' `
  --arg diff_summary '"Wave 5.2 baseline measurement — no prompt change. Anchors Wave 2.4 candidate comparison."' `
  --arg rationale '"First clean baseline measurement against State 0 (vectorIndex still present). RAG_WAVE_5_1_V3_CONSOLIDATED.md §6.3 sequencing. Numbers in actual_eval_delta."' `
  --arg expected_eval_delta '"Per RAG_WAVE_5_1_V3_CONSOLIDATED.md §6.4: p@3 0.25-0.45, r@5 0.30-0.50, MRR 0.20-0.40, disclaim_correct 0.10-0.30, refusal_violation 0.40-0.70."' `
  --arg actual_eval_delta '"wave_5_1 run-id <ISO timestamp>; wave_1_4_v3 run-id w14v3-<ISO>; p@3=0.31 r@5=0.38 MRR=0.27 disclaim_correct=0.18 under_disclaim=0.74 refusal_violation=0.55"' `
  --arg author '"waleed"'
```

(Replace `<ISO timestamp>` with the run-ids from Step 2g and the metric numbers
with your actual run output.)

This is the same `internalMutation` the post-merge CI step calls for normal
prompt PRs (`convex/oto/promptChangelog.ts:42`). For the baseline run there is
no actual prompt change, so `diff_summary` and `rationale` document the
measurement instead. `actual_eval_delta` is the load-bearing field — Wave 2.4's
comparator parses it.

After this lands, `wave_1_5_compare.ts --baseline <merge-base-on-main>` will
resolve the `v0.9-pre-wave-2-4-baseline` row and run the candidate against
these exact numbers.

---

## 5. Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot connect to Convex` / `ECONNREFUSED` | `OTO_EVAL_CONVEX_URL` unset or pointing at wrong deployment | Re-export the var (Step 2a). Verify with `curl "$env:OTO_EVAL_CONVEX_URL/version"` — should return JSON. |
| `seedTenants` throws "duplicate insert" / "already exists" | Fixtures already seeded on this deployment | Safe to ignore — `seedTenants` is documented as idempotent (`multiTenantSetup.ts:27-32`). Proceed to Step 2c. |
| All cases failing with `AUTH_ERROR` | `OTO_EVAL_CONVEX_KEY` is set but lacks admin role | The eval principal MUST be a Convex deploy key with admin privileges; user-level Clerk tokens are rejected. Re-mint from the Convex dashboard's deploy-keys section. |
| `wave_5_1_harness.ts` reports `tier=NONE` on every live case | `runFullCascade` action not deployed on the target deployment | Run `npx convex deploy` (or the dev equivalent). Verify with the pre-flight item 1 command. The action's first deployment was Sprint 1 Day 4. |
| Per-case `pass_ci_low` / `pass_ci_high` columns are blank / equal to pass_rate | `--repeats` was set to 1 (or omitted on an older version) | The harness warns under N<10 but doesn't refuse. Re-run with `--repeats 10`. Wilson CI needs ≥10 samples to be informative — `WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md` §3(a) hinges on this. |
| Per-category breakdown printed but no top-line aggregate block | The harness was killed mid-run (Ctrl+C, network blip) before `main()` reached `renderSummary()` | Re-run the full command. Partial JSON files in `runs/` are safe to delete. |
| `recordPromptChange` returns `MUTATION_NOT_FOUND` | The deployment is missing `convex/oto/promptChangelog.ts` (Day 5 deliverable) | Confirm with `npx convex run oto/promptChangelog:listRecentChanges`. If that also 404s, re-deploy. |
| Live-cat-G cases pass but cat-D cross-tenant cases all FAIL | (HISTORICAL — Sprint 1 Day 7 state) The `multiTenantSetup` seed succeeded but the assertion logic was placeholder-deferred. **Sprint 2 Day 3 wired d-002 / d-003 to seed + assert + tear down via `seedVerifiedFact` / `seedUnverifiedFact` / `cleanupVerifiedFact`.** Cat-D should now PASS in live mode at ≥95% / N=10. d-001 remains deferred until `runFullCascade` is wired into `cascadeClient.ts` (separate harness-owner ticket; see cascadeClient.ts:104). If d-002/d-003 still FAIL in live mode after Day 3, check that the deployment ships `internal.oto.migrations.verifiedFactsSeed.{seedEvalVerifiedFact,cleanupEvalVerifiedFact}` (Sprint 2 Day 2). |

---

## 6. What this run does NOT measure

Be explicit when posting the baseline. The following are intentionally out of
scope for Wave 5.2 — do not conflate "the baseline lands cleanly" with
"everything works":

1. **T3 web_search live.** `runFullCascade`'s `no_web_search: true` is the
   eval-baseline default (`evalHarness.ts:589-594`). Tier 3 fallbacks are
   reported as `tier=T3` with empty facts, not as a live FireCrawl /
   web_search round-trip. Wave 5.3 hooks the real T3 action.
2. **Prompt-language changes.** This run uses whatever `SYSTEM_PROMPT` is on
   main right now (v0.9). Prompt-level pass-rate gains/regressions are Wave
   1.5's job, not 5.2's.
3. **Boundary-eval cases outside the labeled set.** The 36-entry starter is
   "statistically thin (±0.08 sampling noise per metric)" per
   `RAG_WAVE_5_1_V3_CONSOLIDATED.md` §11. Wave 5.1 proper (≥240 entries)
   tightens those bars.
4. **Production latency.** No p95 latency, token cost, or completion-rate
   measurement here — those are `WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md` §4
   A/B-window metrics, not baseline-eval metrics.
5. **Auth / Clerk identity correctness.** The eval principal is a deploy key,
   not a real user. Per-user auth correctness is `oto/evalTestFilter.ts`'s job.
6. **LLM-judge boundary cases.** Wave 1.4 v3 categories (b/c/e) are
   programmatic — they assert structural invariants, not language quality. The
   LLM-judge waves ride this same harness later; they aren't running today.
7. **Cross-tenant assertion correctness.** (UPDATED — Sprint 2 Day 3) Cat-D
   cases d-002 / d-003 are now seed + assert + tear down end-to-end in live
   mode. d-001 remains placeholder-deferred until `cascadeClient.ts` switches
   to `runFullCascade` (the Day-4 follow-up; harness-owner ticket). Treat
   d-001 FAIL as "T1 cascade wiring deferred"; treat d-002/d-003 FAIL as a
   genuine cascade or seed regression worth investigating.

If anyone reads the baseline as "retrieval is broken / the rebuild can't
help," redirect them to this list. The number is a measurement of one
specific thing — embedding-driven single-path retrieval against an
appropriately-built labeled set — and the rebuild is justified by §6.4 of
`RAG_WAVE_5_1_V3_CONSOLIDATED.md`, not by extrapolating from these numbers to
unrelated parts of the system.

---

## 7. Bottom line

**Run the harness today, publish the uncomfortable number, file it in
`prompt_changelog` as `v0.9-pre-wave-2-4-baseline`, and stop.** Every other
piece of Sprint 1 — the prompt-change protocol, the Wave 2.4 PR, the Wave 5.3
rebuild graduation — depends on this measurement existing as a clean,
labeled, comparable artifact. Discomfort is the deliverable.

---

**End — Wave 5.2 Baseline-Execution Runbook v1.**
