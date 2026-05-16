# Sprint 1 Day 7 — Execution Log
**Date:** 2026-05-16 (same calendar day; Days 1–7 all shipped today)
**Authority:** PM Ruling v3 + Day 6 candidate stack + Waleed's "continue" directive
**Owner:** PM, executing via 3 parallel subagents on work that doesn't block on Waleed's three open decisions.

---

## 0. Day 7 in one sentence

**Three subagents in parallel — RAG Specialist wired the Wave 2.4 fixture into the harness (Category f), Security Analyst resolved the query-context-uncounted gap with Option B (action-side aggregation, with one explicit hole flagged for Waleed), QA Lead delivered the Wave 5.2 baseline-execution runbook tight enough for a 10-minute manual op — 6/6 CI clean throughout.**

---

## 1. What landed (3 parallel agents)

### 1.1 RAG Specialist — Wave 2.4 JSONL-judge loader

[`scripts/eval/lib/wave_2_4_loader.ts`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\lib\wave_2_4_loader.ts) (new) — pure-function loader + judge invocation helper:

- Parses the 8-line JSONL fixture line-by-line via `parseWave24JsonlBuffer` (sync) and `loadWave24Fixture` (async wrapper).
- Schema validator requires `case_id`, `expected_behavior` (4 allowed values), `expected_judge_verdict` (PASS/FAIL), `judge_prompt`, `pass_threshold`, `repeats`, `category` (`wave_2_4_boundary` or `wave_2_4_post_report`), plus nested `input` shape. Fail-fast errors carry line numbers.
- `classifyJudgeSubtype()` labels each case `answer_body` (3-criterion) or `post_report` (5-criterion). Verbatim judge_prompt drives the LLM; `renderJudgePrompt()` glues it together with the user query + candidate response under a sub-type-aware label. **Single code path, template selected per-case** — no hard-coded judge functions.
- Mock mode: `mockVerdictForCase()` is pure (right-example → PASS, wrong-example → FAIL, keyed on `expected_behavior`). Every fixture row "passes" in mock — the mock validates loader wiring, not the prompt.
- Live mode: separate eval Anthropic account via `OTO_JUDGE_ANTHROPIC_KEY` (loudly errors if it's the production key). Optional `OTO_JUDGE_MODEL` defaults to `claude-haiku-4-5`. Both halves of live I/O sit behind a typed `JudgeRuntime` interface — tests inject fakes without touching the network.

[`scripts/eval/lib/wave_2_4_loader.test.ts`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\lib\wave_2_4_loader.test.ts) (new, 340 lines, 30+ cases): parser happy path; fail-fast on every malformed field; sub-type classification; mock determinism; render output stability; reply parser; live-mode behavior via injected fake.

[`scripts/eval/wave_1_4_v3_harness.ts`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\wave_1_4_v3_harness.ts) (edit): added Category `(f)`. Fixture loads at startup (malformed JSONL fails the run immediately). New `--wave24-fixture` flag for alternate fixtures. The report block adds `(f) Wave 2.4 answer-body-language judge` alongside (a)–(e). **`wave_1_5_compare.ts` consumes the same CaseAssertion shape so the Day-5 comparator inherits category (f) for free.**

[`scripts/eval/README.md`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\README.md) (edit): documents the new category, judge sub-types, fixture path, env vars, how to add cases.

### 1.2 Security Analyst — query-context decision (Option B picked)

[`docs/SPRINT_1/WAVE_7_3_QUERY_CONTEXT_DECISION.md`](computer://C:\Users\manso\Desktop\otopair-1\docs\SPRINT_1\WAVE_7_3_QUERY_CONTEXT_DECISION.md) — the design + decision doc.

**Pick: Option B — action-side aggregation.** Chat action wraps every moat-table query it performs and bumps the user's counter regardless of who issued the underlying query. The mobile app's direct `useQuery` calls remain uncounted, but the chat-agent-mediated path IS counted.

**Honest residual flagged:** four moat tables — `services`, `service_categories`, `service_vehicle_specs`, `service_options` (the Service Definitions Moat sub-set, ~6.5K-row slice) — remain exfiltrable at full speed by a single legitimate account hitting the public Convex query API directly via reverse-engineered mobile-app surface. The structural-vehicle moat, parts moat, tire moat, and `vehicle_facts` are NOT in this hole.

**Cost analysis:**
- Option B (chosen): ~0.5 day eng, zero mobile call-site changes, zero extra action invocations.
- Option C (rejected): 5 mobile call-site changes, ~40K extra action invocations/day, 130–230ms p50 latency hit per moat read.

**R-3 status table** in §10 updated: 10.3 marked RESOLVED via Option B (pending Waleed's explicit Adv-1 acceptance ask).

**Three decisions flagged for Waleed:**
- **D-Q1**: explicit acceptance of the 4-table Adv-1 hole (or override to Option C). Precedent: your Day 4 §C.4.1 R-3 farm-case acceptance.
- **D-Q2**: tripwire criterion. Proposed: 10× p95 sustained 24h on per-function call counts for the four services-moat queries.
- **D-Q3**: CI Rule 7 with four-site grandfather list confirmation.

### 1.3 QA Lead — Wave 5.2 baseline runbook

[`docs/SPRINT_1/WAVE_5_2_BASELINE_RUNBOOK.md`](computer://C:\Users\manso\Desktop\otopair-1\docs\SPRINT_1\WAVE_5_2_BASELINE_RUNBOOK.md) (~340 lines, 8 sections).

**One-screen summary** answers "what am I measuring and why" — Waleed reads first to confirm he wants to do this. **Pre-flight checklist** (5 items, each with a check command) verifies the deploy is ready. **The execution sequence** is 7 exact copy-pasteable commands (set env, seed multi-tenant, run wave_5_1_harness `--live --repeats 10`, run wave_1_4_v3_harness `--live --category all`, print the two summary tables, teardown, capture run-ids).

**Two annotated example outputs:**
- **Healthy:** p@3 0.667, r@5 0.784, MRR 0.642, disclaim_correct 0.944, under_disclaim 0.028, refusal_violation 0.042. ("Three of seven graduation criteria sit just below their bars; finishing work is calibration, not rewrite.")
- **Uncomfortable:** p@3 0.310, r@5 0.384, MRR 0.273, disclaim_correct 0.180, under_disclaim 0.736, refusal_violation 0.555 — all inside the spec's predicted ranges. ("`disclaim_tag_correctness` at 0.18 is the biggest trust-protocol gap; `refusal_violation` at 0.55 means the trust register isn't holding on out-of-scope questions.")

**Where Waleed posts the baseline:** §4 sketches the `npx convex run oto/promptChangelog:recordPromptChange` invocation with `prompt_version: "v0.9-pre-wave-2-4-baseline"` — that row IS the comparison anchor `wave_1_5_compare.ts` Step 2 reads.

**Troubleshooting matrix** covers 6 common failures (Convex connection, seedTenants duplicate, auth error, tier=NONE, empty Wilson CI, interrupted run completion).

**Bottom-line one-liner:** *"Run the harness today, publish the uncomfortable number, file it in `prompt_changelog` as `v0.9-pre-wave-2-4-baseline`, and stop. Every other piece of Sprint 1 depends on this measurement existing as a clean, labeled, comparable artifact. Discomfort is the deliverable."*

---

## 2. CI grep status

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
Rule 6: chat-tool moat reads must filter EvalTest...               OK
All vehicle-facts invariant checks passed (6/6 rules clean).
```

Clean throughout Day 7.

---

## 3. Decisions on Waleed's plate (in priority order)

### Urgent — blocking the first Wave 1.5 protocol end-to-end

1. **Wave 5.2 baseline run** — Now mechanical with the runbook. ~10 min manual op. The single highest-leverage action on Waleed's plate.
2. **Wave 2.4 token budget** — 200 / 290 / 540 / 865 tokens. PM lean: 865 (full version, compress later).
3. **A/B start percentage** — 100% direct vs 25% canary for the first protocol run.

### New from Day 7

4. **D-Q1: 4-table services-moat Adv-1 hole acceptance** — accept (per Day 4 farm-case precedent) or override to Option C (5 mobile call sites + extra invocations + latency hit).
5. **D-Q2: tripwire criterion** for monitoring the Adv-1 hole. Proposed 10× p95 sustained 24h on per-function call counts.
6. **D-Q3: CI Rule 7** — 4-site grandfather list for moat-query bypass.

### Carryover from Day 6

7. Post-report timeline messaging tone ("their next pass" vs softer)
8. Named-reviewers durability (hardcoded "Temur and Waleed")
9. Loader-then-prompt ordering — **now resolved**: loader landed today (Day 7), prompt PR rides next.
10. Wave 4 stable/volatile split timing — defer to after Wave 2.4 lands

### Carryover from Day 5 (Wave 1.5 calibration)

11. 5% uniform per-case drop threshold
12. 48h A/B window compress-to-24h after 3 clean rollouts
13. Stable-prompt co-signer = Temur?
14. GitHub team handle formalization

---

## 4. The state of Sprint 1 — what's actually ready to deploy

Sprint 1 has shipped, across 7 days, the following code/doc artifacts:

**Code (Convex + scripts):**
- Schema (consolidated v3): `vehicle_facts` extended; `vehicle_facts_audit` + `fact_reports` added; embedding column removed (3-deploy plan); `oto_migrations`, `reconciliation_runs`, `prompt_changelog` system tables added.
- Mutation helpers: `vehicleFactsEditing.ts` (recordVehicleFact / editVehicleFact / reportVehicleFact / resolveFactReport), `factReports.ts` (re-export alias), `promptChangelog.ts` (changelog mutations).
- Reads: `cascadeTier2` (canonical-hash → structural → BM25), `runFullCascade` (T1 → T2 → T3 stub), `evalTestFilter.ts`, four chat-tool sites patched with EvalTest filtering.
- Migrations: `backfillV3Lifecycle.ts` (combined lifecycle + embedding-strip backfill), `vehicleFactsReconciliation.ts` (4 checks + 15-min cron), `evalTenantsSeed.ts`.
- Eval harness: `scripts/eval/` tree with 5 metrics (incl. Wilson CI), 8 Wave 2.4 cases, multi-tenant setup, `wave_1_5_compare.ts` comparator, `rollback_prompt.sh`.
- CI: 6-rule `vehicle-facts-grep.sh` enforcing invariants.

**Docs:**
- PM Ruling v3 (consolidated)
- Architecture v3 Amendments (Decision Log, Migration Plan, Risk Register changes + R-3 acceptance)
- MEMORY_SCHEMA_V3_CONSOLIDATED, RAG_WAVE_5_1_V3_CONSOLIDATED, SECURITY_CONSOLIDATED_V3
- Wave 1.5 prompt-change protocol, Wave 2.4 PR draft, Wave 5.2 baseline runbook, Wave 7.3 rate-limit design + query-context decision
- Reconciliation runbook, substrate notes
- 7 daily execution logs + 1 correction log

**What's NOT yet deployed:**
- The Convex schema changes (need `npx convex dev` push)
- The combined backfill (one Convex action call after deploy)
- The reconciliation cron (auto-registers on deploy)
- Wave 2.4 prompt language (waiting on Waleed's token-budget + A/B-percent decisions, then rides Wave 1.5 protocol)
- The Wave 5.2 baseline number (Waleed's manual op)

---

## 5. Day 8 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Waleed runs the Wave 5.2 baseline per the runbook** | Waleed (manual op) | The blocking item; everything else proceeds after this lands |
| 2 | Open the Wave 2.4 PR through Wave 1.5 protocol (post-baseline) | Waleed + Interaction Strategist | First real user of the protocol |
| 3 | Implement Option B action-side aggregation per query-context decision | Security Analyst → eng | ~0.5 day; pending Waleed's D-Q1/2/3 ratification |
| 4 | Wave 4 stable/volatile prompt split | Principal Prompt Engineer | Defer until Wave 2.4 lands cleanly |
| 5 | T3 web_search live wiring in `evalHarness.runFullCascade` | RAG Specialist | Defer; baseline runs fine with --no-web-search |

**Recommended Day 8:** Item 1 first (Waleed manual). Once the baseline is filed, items 2 + 3 fan out in parallel.

---

## 6. The one-line summary

**Day 7 prepared every infrastructure piece the first real end-to-end Wave 1.5 protocol run needs — the Wave 2.4 cases are loadable, the security gap is decided, the runbook is tight — and now everything waits on Waleed running one 10-minute baseline command.**

— End of Day 7.
