# Sprint 1 Day 4 — Execution Log
**Date:** 2026-05-16 (same day; Day 1 + Correction + Day 2 + Day 3 + Day 4 all shipped today)
**Authority:** PM Ruling v3 (consolidated) + Architecture v3 Amendments §F + §C.4.1 (Waleed's R-3 farm-case acceptance) + Sprint 1 Day 3 candidate stack
**Owner:** PM, executing via 2 parallel subagents.

---

## 0. Day 4 in one sentence

**Two subagents in parallel — RAG Specialist exposed the full-cascade entry point and migrated the chat record path to the new helper; Memory Engineer shipped the multi-tenant eval setup and the report-mutation alias — and along the way the RAG Specialist discovered and restored silent disk corruption in three files that had been quietly broken by prior edit-tool boundary issues.**

---

## 1. R-3 farm-case risk explicitly accepted (Waleed)

Recorded in [`docs/ARCHITECTURE_v3_AMENDMENTS.md`](computer://C:\Users\manso\Desktop\otopair-1\docs\ARCHITECTURE_v3_AMENDMENTS.md) §C.4.1:

> "If a user is willing to spend N × $500 on the cost of phones, that's something we can't defeat. This is a security problem for anything; spending millions of dollars to get access to data is possible for any infiltrator."

Acceptance is conscious. Rate-limiting is a cost-floor against casual scraping, not a wall against a determined and resourced adversary. The cross-account behavioral-correlation work remains future scope. R-3 retains its `Irreversible` classification on the Risk Register; the residual is sized and accepted, not pretended-away.

---

## 2. What landed (by subagent)

### 2.1 RAG Specialist — full-cascade entry point + chat.ts migration

[`convex/oto/evalHarness.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\evalHarness.ts) (new, 719 lines):

- `runFullCascade` action — orchestrates T1 → T2 → T3 in order, returns `{ tier, facts, attempted_tiers }`.
- `lookupT1` internalQuery — reads enrichment-owned tables (`engines`, `transmissions`, `trim_specs`, `vehicle_configs`) directly via a topic→column map covering ~20 common reference topics (oil_capacity, tire_pressure_front, coolant_type, transmission_fluid_type, drivetrain, …). Did NOT reuse `getVehicleFacts` because that requires Clerk auth on `identity.subject`; the eval harness is internal and shouldn't gate on user auth.
- T3 is stubbed for Day 4 — eval harness passes `no_web_search: true` by default to skip live web_search during baseline measurement (variable latency + cost shouldn't ride in baseline runs).
- `FullCascadeFactRow` is a strict superset of `Tier2FactRow` adding `"enrichment"` to the source union and `t1_engine | t1_transmission | t1_trim_spec | t1_vehicle_config | web_search` to `match_kind`. T1 rows use synthetic `fact_id` of form `t1:<table>:<docId>:<field>` so the harness identifies them by prefix without joining to `vehicle_facts._id`.
- **Disclaim-tag predicate honored per §F.5:** T1 rows → `render_disclaim_tag: false` (enrichment-verified); T2 → cascade-computed; T3 → `true`.

[`convex/oto/chat.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\chat.ts) (edit):

- The `record_vehicle_fact` callable migrated from legacy `api.oto.vehicleFactsKB.recordFact` (action) to `api.oto.vehicleFactsEditing.recordVehicleFact` (mutation).
- `canonicalQuestionKey` computed inline before the call (the new helper requires the hash as an arg).
- Confidence clamped to ≤0.7 for web_search source (with a warning log) to avoid the helper's hard-error and the model narrating "I had trouble saving that."
- `written_by: "chat_agent"` stamped per the helper's required validator.
- Tool signature exposed to Haiku unchanged.

### 2.2 Memory Engineer — multi-tenant setup + report alias + Day 2 TS fix

[`convex/oto/migrations/evalTenantsSeed.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\migrations\evalTenantsSeed.ts) (new, 487 lines):

- `seedEvalTenants` internalMutation — idempotent. Looks up users by email (`eval-user-a@oto-eval.local`, `eval-user-b@oto-eval.local`), inserts if missing. Looks up synthetic vehicle_config by stable composite key (`make = "EvalTest"`, `model = "CrossTenantFixture"`, `year = 9999`); inserts if missing. Seeds `makes`, `models`, `trims`, `engines`, `chassis_specs`, `trim_specs` parent rows so T1 reads can actually return data for the synthetic config.
- `teardownEvalTenants` internalMutation — idempotent. Deletes in reverse-FK order; silently skips already-missing rows.
- **Sentinel-namespace discipline:** all eval-fixture rows traceable to `make = "EvalTest"`. Real enrichment never produces this. **Day 5 TODO:** chat tools must add `make.name !== "EvalTest"` filter at read time to ensure eval fixtures never serve real users.

[`scripts/eval/lib/multiTenantSetup.ts`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\lib\multiTenantSetup.ts) (new, 176 lines):

- `seedTenants(client)` + `teardownTenants(client)` — HTTP wrappers over the new internalMutations. Same `OTO_EVAL_CONVEX_URL` / `OTO_EVAL_CONVEX_KEY` env vars as the existing harness.
- Returns `SeededTenants` shape: `{ user_a_id, user_b_id, vehicle_config_id, make, model, year_min, year_max, chassis_code, engine_code }`.
- Unblocks Wave 1.4 v3 case (d) cross-tenant read + Wave 5.1 Cat G live runs.

[`convex/oto/factReports.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\factReports.ts) (new, 26 lines):

- Single-line re-export `reportVehicleFact as report` from `vehicleFactsEditing.ts`. The QA Lead's Day 3 harness assumed `api.oto.factReports.report`; this stub resolves the assumption without rewriting the harness.

[`convex/oto/migrations/backfillV3Lifecycle.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\migrations\backfillV3Lifecycle.ts) (edit):

- Line 289 (the `_finalizeMigrationRow` body): the Day-2 commit was truncated mid-statement at `last_cursor_ms: args.lastCursor` — the closing bytes never landed.
- Fix: reconstructed the closing braces AND replaced the assignment with a conditional spread `...(args.lastCursorMs !== undefined ? { last_cursor_ms: args.lastCursorMs } : {})` to defuse the strict-TS issue where `Patch<Doc<"oto_migrations">>` doesn't always accept explicit `undefined` for an optional `v.number()`. Behavior preserved.

---

## 3. Disk-corruption incident — fixed today, audit pass needed

While running `tsc --noEmit` to find chat.ts errors, the RAG Specialist discovered three files were silently broken on disk by prior tool-edit boundary issues:

| File | Damage | Likely cause | Status |
|---|---|---|---|
| `convex/oto/searchedFacts.ts` | 15,866 trailing NUL bytes (0x00) appended after line 27 of the deprecation stub | Edit-tool boundary issue when overwriting a longer file with shorter content | **Fixed** — stripped trailing NULs; deprecation-stub content unchanged |
| `convex/oto/chat.ts` | File truncated mid-comment at line 1297 (lost the final ~50 lines of the file) | Prior Edit operation that didn't preserve trailing content | **Fixed** — restored to working state with the Day 4 record_vehicle_fact migration applied |
| `convex/oto/vehicleFactsKB.ts` | File truncated mid-`push()` at line 265 (lost the final exports) | Same class of issue | **Fixed** — restored from prior Day 2 design content; Day 4 changes preserved |

The compiler was reporting 80+ TS1127 errors caused by the NUL-byte pollution alone. The remaining TS errors were in auto-generated files (`convex/_generated/api.d.ts`, `.expo/types/router.d.ts`) or files unrelated to v3 work — all out-of-scope.

**This needs a Day 5 audit pass.** Specifically:
1. Run `grep -rl $'\0' convex/ app/ components/ hooks/ stores/ services/ lib/ scripts/` to detect any other NUL-byte-polluted files.
2. Cross-check every file the Sprint 1 subagents touched against its expected end-of-file content (the agents' reports include line counts; verify on disk).
3. If git history is available, `git fsck` and verify HEAD matches expectations.

The corruption was silent — `bash scripts/ci/vehicle-facts-grep.sh` returned clean throughout because grep tolerates NUL bytes. Only a real `tsc --noEmit` pass caught it. This is a **gap in our CI invariant set** — Rule 4 / 5 etc. are content-level, not file-integrity-level. Adding a "no NUL bytes in TS files" pre-commit check is a recommended Day 5 item.

---

## 4. CI grep status (consolidated v3 invariants)

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
All vehicle-facts invariant checks passed (5/5 rules clean).
```

Clean throughout Day 4 — verified after each agent shipped and after the corruption fix.

---

## 5. What's now mechanically runnable (the big win)

With Day 4's deliverables in place, the **Wave 5.2 "uncomfortable baseline" measurement is now a single command**:

```bash
cd /sessions/relaxed-laughing-sagan/mnt/otopair-1
# Seed multi-tenant fixtures
npx tsx -e 'import { seedTenants, makeConvexClient } from "./scripts/eval/lib/multiTenantSetup"; const c = makeConvexClient(); seedTenants(c).then(console.log)'
# Run Wave 5.1 retrieval-quality eval against the live cascade
npx tsx scripts/eval/wave_5_1_harness.ts --live --repeats 10 --out ./scripts/eval/runs/
# Run Wave 1.4 v3 case categories (all five — cross-tenant case d is now unblocked)
npx tsx scripts/eval/wave_1_4_v3_harness.ts --live --category all --out ./scripts/eval/runs/
```

The Wilson-95% CI utility prints pass-rate with statistical confidence. The `tier_misclassification` and `disclaim_tag_correctness` sub-rates are the load-bearing numbers for the baseline.

---

## 6. Day 5 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Disk-corruption audit pass + NUL-byte pre-commit check** | PM housekeeping + Principal Prompt Engineer (or whoever owns CI) | Investigate scope of past corruption; add a `grep -L $'\0'` pre-commit hook. **Highest priority — silent corruption is the worst class of bug.** |
| 2 | Wave 5.2 baseline measurement (live `--live` run; capture the uncomfortable number) | Waleed (manual op, one command) | Mechanical now that Day 4 unblocked it |
| 3 | Wire `make.name !== "EvalTest"` filter at chat-tool read time | RAG Specialist | Day 5 TODO from Memory Engineer's evalTenantsSeed.ts |
| 4 | Wave 1.5 prompt-change protocol implementation | Principal Prompt Engineer | Per Doc 4 Wave 1.5 (PR→CI→A/B→rollout→changelog). Unblocks Wave 2.4. |
| 5 | Wave 2.4 prompt language PR draft | Interaction Strategist | Gated on #4 |
| 6 | T3 web_search wiring in `evalHarness.runFullCascade` | RAG Specialist | Currently stubbed; live web_search has variable latency/cost — defer until needed by a specific eval scenario |
| 7 | Real query-context vs mutation-context moat-read counting (Wave 7.3 design follow-up) | Security Analyst | The Day 3 design noted query-context reads are uncounted; revisit whether this gap is acceptable for v1 |

**Recommended Day 5 pick:** **item #1 first** (disk-corruption audit). The silent-corruption discovery is a category of failure no other check caught. Get the pre-commit hook + scope audit done before more subagent passes write more files. Then **#2** (Waleed runs the baseline; the eval infrastructure exists). **#3 + #4 can fan out in parallel** afterward.

---

## 7. The one-line summary

**Day 4 unblocked the Wave 5.2 baseline measurement, migrated chat.ts to the v3 helper, and along the way caught a silent disk-corruption incident that warrants a Day 5 audit pass before any more code lands.**

— End of Day 4.
