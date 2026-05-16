# Sprint 1 Day 5 — Execution Log
**Date:** 2026-05-16 (same day; Days 1 → 5 all shipped today)
**Authority:** PM Ruling v3 (consolidated) + Day 4 candidate stack + Waleed's parallelism directive
**Owner:** PM, executing via 2 parallel subagents + 1 PM audit pass.

---

## 0. Day 5 in one sentence

**Audit pass corrected yesterday's NUL-byte panic (false alarm — bash pattern bug), two parallel subagents shipped the EvalTest filter (Rule 6 added, 6/6 CI clean) and the Wave 1.5 prompt-change protocol with comparator + rollback tooling — one genuine file-truncation issue surfaced for Waleed's ruling, no auto-fix applied.**

---

## 1. Audit pass — Day 4 overstatement corrected

The Day 4 log claimed silent NUL-byte corruption across the repo. **That claim was wrong.** The grep command I used (`$'\x00'`) expands to an empty string in bash, which matches every file. A proper check (`grep -P '\x00'`) returns ZERO matches across `convex/`, `app/`, `components/`, `hooks/`, `stores/`, `services/`, `lib/`, `scripts/`, `docs/`. Nothing to clean up.

What the Day 4 RAG Specialist actually reported on Day 4 — that they had to strip NULs from three files — is preserved as the historical account. Whether those NULs actually existed at the time vs. were a similar bash-pattern false positive is unclear and not worth excavating. **Current state:** repo is clean of NUL bytes.

**One real issue surfaced.** `convex/oto/migrations/backfillV3Lifecycle.ts` is genuinely truncated:
- 298 lines on disk
- Ends mid-word: `// Optional patch field: only includ`
- Brace-count delta: +2 (two open braces with no matching close)
- TypeScript will not compile

A system reminder noted the file was modified intentionally — but a file ending mid-comment isn't an intentional final state. **Flagged for Waleed's ruling**: (A) restore the closing braces + the rest of `_finalizeMigrationRow`'s body (the Memory Engineer's Day 4 report describes the intended content; reconstruction is ~10 lines), or (B) leave it broken and Waleed completes it manually.

Day 5 work explicitly did NOT touch this file. Both Day 5 agents were instructed to leave it alone.

---

## 2. What landed today (2 parallel subagents)

### 2.1 RAG Specialist — EvalTest filter + Rule 6

[`convex/oto/evalTestFilter.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\evalTestFilter.ts) (new) — helper module:

| Export | Purpose |
|---|---|
| `EVAL_TEST_MAKE_NAME = "EvalTest"` | The sentinel constant |
| `isEvalTestMake(make): boolean` | Pure check on a make Doc |
| `isEvalTestMakeName(name): boolean` | Pure check on a name string |
| `excludeEvalTestVehicleConfig(ctx, configId, cache?)` | Async FK walk vehicle_config→trim→model→make; optional request-scoped Map cache |
| `excludeEvalTestFromConfigDoc(ctx, config, cache?)` | Same when the config doc is already loaded |
| `isEvalTestConfigId` | internalQuery wrapper for action callers |

File header documents the sentinel namespace, the trust-protocol motivation (synthetic data must not serve real users), and the four exempt path classes (`evalHarness.ts`, `migrations/`, `admin/`, `vehicleEnrichment/`).

**Files patched** with the filter:

| File | Pattern |
|---|---|
| `lookupVehicleSpec.ts` | Strips EvalTest makes from the candidate set before token matching |
| `vehicleFacts.ts` | Rejects with `"vehicle not found"` if the joined `makeRow` is EvalTest (defense in depth past the ownership check) |
| `vehicleHealth.ts` | Same rejection after FK walk through `config.make_id` |
| `chat.ts` | `retrieve_vehicle_facts` callable short-circuits with `{ tier: null, facts: [] }` if the passed `vehicle_config_id` traces to EvalTest |

**Exemption pattern**: call sites import the filter helper; for paths that intentionally bypass (e.g., admin), callers add an `EXEMPT: <reason>` comment within 2 lines above the moat read.

**New CI Rule 6** added to `scripts/ci/vehicle-facts-grep.sh`. Enumerates `ctx.db.query("<moat_table>")` in `convex/oto/`, strips bypass paths (`evalHarness.ts`, `migrations/`, `evalTestFilter.ts`), then for each remaining hit verifies the file imports `./evalTestFilter` OR has an `EXEMPT:` annotation. **Heuristic** — confirms the filter is plausibly available; cannot prove it actually wraps the read. Code review is the backstop.

**One edge case flagged for follow-up:** `cascadeTier2` in `vehicleFactsKB.ts` reads `vehicle_facts` (not moat tables). The current seed does not write to `vehicle_facts`, so no EvalTest fact exists today — but if the seed scope ever extends, the `T2_STRUCT` sub-tier keys off `vehicle_config_id` and could surface synthetic data. **Mitigation in place**: the chat-side `retrieve_vehicle_facts` dispatcher guards the entire cascade call against an EvalTest `vehicle_config_id`. **Deferred**: a second guard inside `vehicleFactsKB.ts` itself (would need per-row FK walk + balloon the cascade query budget; not added today).

### 2.2 Principal Prompt Engineer — Wave 1.5 protocol

[`docs/SPRINT_1/WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md`](computer://C:\Users\manso\Desktop\otopair-1\docs\SPRINT_1\WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md) (~570 lines, 8 sections). The protocol Doc 3 §1 said was Oto's single most important sentence to make real. P-9 ("never change the prompt on vibes, only against the eval") is now actually enforceable.

**The 5-step protocol:**
1. PR shape — required commit format, reviewer count, what triggers senior sign-off
2. CI eval invocation — exact command, N≥10 repeats, Wilson 95% CI
3. Merge gate — statistical test with multiple floors
4. A/B rollout — 5% (volatile) or 25%+/100% (stable) over 48h with auto-rollback criteria
5. Changelog — `prompt_changelog` row written at merge

**Tightest gate (Step 3c):** seven Wave 5.3 graduation-bar floors are absolute on the candidate regardless of per-case math — precision@3 ≥ 0.70, recall@5 ≥ 0.80, MRR ≥ 0.65, tier_misclass ≤ 0.10, disclaim_correct ≥ 0.95, under_disclaim ≤ 0.02, refusal_violation ≤ 0.05.

**`stable`/`volatile` posture:** `system_prompt.ts` is NOT yet split (Doc 4 Wave 4 work). Protocol treats the whole file as stable until split lands. Post-split routing is documented and ready to flip on.

[`convex/schema.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\schema.ts) — appended `prompt_changelog` table (13 fields, 2 indexes, append-only by convention).

[`convex/oto/promptChangelog.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\promptChangelog.ts) (new) — 5 mutations/queries: `recordPromptChange`, `markRolloutStarted`, `markRolloutOutcome`, `setActivePromptVersion`, `listRecentChanges`.

[`scripts/eval/wave_1_5_compare.ts`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\wave_1_5_compare.ts) (new) — runs the Wave 5.1 cascade harness against two prompt versions, computes per-case delta + Wilson 95% CIs + a pure Wilcoxon signed-rank test (with continuity correction + Abramowitz-Stegun normal CDF). Emits `delta.json` + `delta.md`. Exit 0/1 = gate PASS/FAIL.

[`scripts/eval/rollback_prompt.sh`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\rollback_prompt.sh) (new) — one-command emergency rollback. Reads second-newest changelog row, flips active prompt version, marks the rolled-off row `outcome=rolled_back` with the reason.

Usage:
```bash
npx tsx scripts/eval/wave_1_5_compare.ts --baseline <ver> --candidate <ver> [--repeats 10] [--out path]
bash scripts/eval/rollback_prompt.sh "production error rate spiked"
```

---

## 3. CI grep — now 6/6 rules

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
Rule 6: chat-tool moat reads must filter EvalTest...               OK
All vehicle-facts invariant checks passed (6/6 rules clean).
```

Rule 6 finds one legitimate hit (`lookupVehicleSpec.ts` `makes` query) and validates the file imports `./evalTestFilter`. Clean.

---

## 4. Decisions flagged for Waleed (in priority order)

### Urgent

1. **`backfillV3Lifecycle.ts` truncation** — file ends mid-comment with unclosed braces. Won't compile. (A) Restore the missing ~10 lines from Memory Engineer's Day 4 description, or (B) leave for manual completion. **Waiting on your call.**

### Wave 1.5 protocol (5 decisions from Principal Prompt Engineer)

2. **5% uniform per-case drop threshold.** Cat F (refuse cases) is more sensitive than Cat A (T1 hits) — consider per-category tuning after the first 3 PRs.
3. **48h A/B window.** Proposed compress-to-24h after three clean rollouts but only for volatile-only edits; stable stays at 48h minimum.
4. **Stable-region override co-sign requirement.** Temur as second signer for stable-half prompt edits.
5. **GitHub team handle formalization.** Default in protocol is "Waleed/Temur as named individuals"; consider creating GitHub team handles when the team grows past 3.
6. **Wave 4 split factoring.** Whether `prompt/locked_principles.ts` should be its own file (the prompt's #1-#12 locked principles) when the stable/volatile split happens.

### Carryover from Day 2-4

7. **Wave 5.2 baseline measurement.** Mechanical now. Single command from Day 4 log §5. Capture the uncomfortable number.
8. **R-3 farm-case decision is already accepted** (Day 4 §1). Recorded.
9. **Sec Analyst's query-context moat-read uncounted gap.** Defer or address? (Day 3 Wave 7.3 design note.)

---

## 5. Day 6 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Resolve `backfillV3Lifecycle.ts` truncation** | Waleed or Memory Engineer per Waleed's ruling | Blocks any Convex deploy; nothing else can ship until this compiles |
| 2 | **Wave 5.2 baseline measurement** | Waleed (manual) | One command, ~10 minutes Convex action time |
| 3 | Wave 2.4 prompt-language PR (the first user of the Wave 1.5 protocol) | Interaction Strategist | Per `INTERACTION_WAVE_2_4_V3.md` |
| 4 | Wave 4 stable/volatile prompt split | Principal Prompt Engineer | Unblocks volatile-only edits riding the cheaper 5%/24h cadence (post-decision #3) |
| 5 | T3 web_search wiring in `evalHarness.runFullCascade` | RAG Specialist | Currently stubbed; only needed when a specific eval scenario requires it |
| 6 | Real per-category threshold tuning for Wave 1.5 Step 3 (decision #2 above) | Principal Prompt Engineer + QA Lead | Wait until first 3 prompt PRs land — gather data |
| 7 | Backfill the `make.name !== "EvalTest"` filter into the `cascadeTier2` per-row FK walk | RAG Specialist | Only if seed scope extends to write `vehicle_facts` — currently a defer |
| 8 | Address Sec Analyst query-context-uncounted gap | Security Analyst | Defer or design |

**Recommended Day 6:** items 1 + 2 first (sequential — must fix truncation before baseline can run live), then item 3 fans out as the first real test of the Wave 1.5 protocol.

---

## 6. The one-line summary

**Day 5 corrected yesterday's audit overstatement, shipped two parallel deliverables that closed the eval-fixture trust gap (Rule 6) and made P-9 enforceable (Wave 1.5 protocol + tooling), and surfaced one genuine truncation issue for Waleed's ruling before any more code lands.**

— End of Day 5.
