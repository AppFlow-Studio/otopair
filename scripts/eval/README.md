# Oto AI — Eval Harness (Sprint 1 Day 3)

Owner: AI QA & Evaluation Lead (Doc 3 §6)
Scope: Wave 5.1 (labeled retrieval set) + Wave 1.4 v3 (programmatic boundary cases)

This directory ships the "uncomfortable baseline" measurement infrastructure for
the three-tier retrieval cascade. The cascade exists (`convex/oto/vehicleFactsKB.ts`)
and the labeled-set spec exists on paper (`docs/SPRINT_0/RAG_WAVE_5_1_V3_CONSOLIDATED.md`).
This harness makes both measurable.

## Layout

```
scripts/eval/
├── README.md                                   ← you are here
├── wave_5_1_harness.ts                         ← labeled-set runner + report
├── wave_1_4_v3_harness.ts                      ← programmatic boundary cases
│                                                  + Wave 2.4 judge cases (Day 7)
├── wave_1_5_compare.ts                         ← prompt-change delta gate
├── fixtures/
│   ├── wave_5_1_labeled_set.jsonl              ← 36 entries, categories A–I
│   └── wave_2_4_cases.jsonl                    ← 8 Wave 2.4 contrastive cases
├── lib/
│   ├── cascadeClient.ts                        ← Convex action wrapper (mock/live)
│   ├── metrics.ts                              ← pure metric fns (no I/O)
│   ├── metrics.test.ts                         ← vitest unit tests
│   ├── wave_2_4_loader.ts                      ← Wave 2.4 JSONL loader + judge
│   ├── wave_2_4_loader.test.ts                 ← vitest unit tests for the loader
│   └── multiTenantSetup.ts                     ← Day 4 multi-tenant data helper
└── runs/                                       ← timestamped reports land here
```

## Prerequisites

The harness is written in TypeScript and uses Node's native `fetch`. The repo
doesn't ship `tsx` or `vitest` by default — install the runtime + test framework
once:

```
npm i -D tsx vitest
```

If `tsx` is unavailable, transpile manually:

```
npx tsc --target es2022 --module nodenext --moduleResolution nodenext --outDir scripts/eval/dist scripts/eval/wave_5_1_harness.ts
node scripts/eval/dist/wave_5_1_harness.mjs --mock
```

## Run — Wave 5.1 (retrieval metrics)

### Mock mode (no deployment needed)

```
npx tsx scripts/eval/wave_5_1_harness.ts --mock
```

Mock mode returns the labeled-set entry's expected outcome verbatim, so every
metric scores 1.0. Use this to validate the harness is wired correctly. A
non-100% score in mock mode means the metric code is broken, not the cascade.

### Live mode (real Convex deployment)

```
$env:OTO_EVAL_CONVEX_URL = "https://<deployment>.convex.cloud"
$env:OTO_EVAL_CONVEX_KEY = "<bearer-token>"
npx tsx scripts/eval/wave_5_1_harness.ts --live --repeats 10
```

The live mode currently calls `cascadeTier2` only — it covers T2_HASH /
T2_STRUCT / T2_TEXT. **T1 lookups and T3 web_search are NOT YET wired**
because that's the full outer driver in `convex/oto/tools.ts::retrieve_vehicle_facts`,
which isn't exposed as a standalone action. See "Day 4 prerequisites" below.

### CLI args

| arg | default | description |
|---|---|---|
| `--mock` / `--live` | `--mock` | cascade backend |
| `--repeats N` | `10` | repeats per query (Doc 4 Wave 1.1 floor) |
| `--fixture path` | `fixtures/wave_5_1_labeled_set.jsonl` | override labeled set |
| `--out dir` | `runs/` | output directory |

### Output

- `runs/<ISO>.json` — full machine-readable report (per-query, per-category, per-metric)
- `runs/<ISO>.txt` — human summary, also printed to stdout

The summary surfaces the Wave 5.3 graduation bar (PASS/FAIL per criterion):

```
PASS  precision@3 ≥ 0.70
PASS  recall@5 ≥ 0.80
PASS  MRR ≥ 0.65
PASS  tier_misclass ≤ 0.10
PASS  disclaim_correct ≥ 0.95
PASS  under_disclaim ≤ 0.02         ← the directional one
PASS  refusal_violation ≤ 0.05
```

## Run — Wave 1.4 v3 (programmatic boundary cases)

```
npx tsx scripts/eval/wave_1_4_v3_harness.ts --mock
npx tsx scripts/eval/wave_1_4_v3_harness.ts --live --category a
npx tsx scripts/eval/wave_1_4_v3_harness.ts --live --category e --repeats 10
```

The v3 case categories from `docs/SPRINT_0/QA_WAVE_1_4_V3.md` plus the Day 7
Wave 2.4 addition:

| category | what | shipped |
|---|---|---|
| (a) Tier routing | 6 cases — T1/T2/T3 hits + cross-tenant + unverified-T2 | Day 3 |
| (b) Disclaim-tag render | 5 cases — verified/unverified/T3-fresh/T1/report_count-noise | Day 3 |
| (c) Report flow | 5 cases — basic, dedup, idempotency, Tier-1 rejection, fresh-T3 race | Day 3 (mockable; live needs report mutation name confirmed) |
| (d) Cross-tenant read | 3 cases | Day 4 (multi-tenant data helper) |
| (e) Audit-log invariant | 5 cases — verify, verify_and_edit, reject, idempotent, non-admin | Day 3 (mockable) |
| (f) Wave 2.4 answer-body-language judge | 8 cases — 3 right + 3 wrong (answer-body) + 1 right + 1 wrong (post-report) | Day 7 (LLM-judge; mock + live) |

### Category (f) details — Wave 2.4 LLM-judge cases

Cases load from `scripts/eval/fixtures/wave_2_4_cases.jsonl`. Two judge
sub-types share the same code path; the verbatim `judge_prompt` field per
case selects which template runs:

- **`answer_body` (3-criterion)** — applies to `wave_2_4_boundary` category cases. PASSes iff (a) source named in first 25 words, (b) correction invited without apology, (c) no scarcity / no penalty framing.
- **`post_report` (5-criterion)** — applies to `wave_2_4_post_report` category cases. PASSes iff (a) acknowledges receipt, (b) names Temur + Waleed, (c) no timeline promise, (d) no apology spiral, (e) invites next turn.

In `--mock` mode the loader's mock verdict generator returns deterministic
verdicts per case_id (right examples → PASS, wrong examples → FAIL). This
matches the case's `expected_judge_verdict` so every case "passes" — the mock
exists for loader-level unit-test-style validation, not for measuring the
prompt.

In `--live` mode the harness:
1. Calls Oto's chat action with the case's `input` (skipped if the case ships
   a verbatim `candidate_response`, which the wrong-example cases do — that's
   what lets them assert the judge correctly FAILs a known-bad body).
2. Renders the embedded judge_prompt + the response into a final prompt.
3. POSTs to Claude Haiku on a SEPARATE Anthropic account (Doc 4 Wave 1.2 —
   eval billing, rate-limit, and prompt-cache must be isolated from production
   Oto). See "Env vars" below.
4. Parses the reply (first line = verdict, rest = rationale) and scores
   `passed = actual_verdict === expected_verdict`.

The `wave_1_5_compare.ts` comparator picks (f) up automatically — it
consumes the same `CaseResult` shape the other categories emit.

### Adding more Wave 2.4 cases

Drop a new row into `scripts/eval/fixtures/wave_2_4_cases.jsonl`. The loader
in `scripts/eval/lib/wave_2_4_loader.ts` reads the file line-by-line and
validates each entry; malformed rows fail the harness fast with line numbers
in the error. Required fields:

```json
{
  "case_id": "wave-2-4-...",
  "input": {
    "user_query": "...",
    "vehicle_scope": { "make": "...", "model": "...", "year_min": 0, "year_max": 0 },
    "source_tier": "T1|T2_HASH|T2_STRUCT|T2_TEXT|T3",
    "verification_status": "verified|unverified|n/a",
    "web_context": "... (optional)",
    "candidate_response": "... (optional — wrong-example cases ship one)"
  },
  "expected_behavior": "right-example|wrong-example|right-example-post-report|wrong-example-post-report",
  "expected_judge_verdict": "PASS|FAIL",
  "judge_prompt": "verbatim 3-criterion or 5-criterion template",
  "pass_threshold": 0.9,
  "repeats": 10,
  "category": "wave_2_4_boundary|wave_2_4_post_report",
  "notes": "..."
}
```

Override the fixture path with `--wave24-fixture path/to/file.jsonl` if you
need to point the harness at an alternate set (e.g., a per-PR subset).

## Env vars — live mode

| var | required by | purpose |
|---|---|---|
| `OTO_EVAL_CONVEX_URL` | `wave_5_1_harness.ts --live`, `wave_1_4_v3_harness.ts --live` cat (a)/(b)/(c)/(d)/(f), `wave_1_5_compare.ts --live` | the deployment the cascade + chat actions are POSTed to |
| `OTO_EVAL_CONVEX_KEY` | same | bearer for the eval principal on that deployment |
| `OTO_PROMPT_VERSION_OVERRIDE` | `wave_1_5_compare.ts` | set per-run by the comparator; cascadeClient reads it |
| `OTO_JUDGE_ANTHROPIC_KEY` | `wave_1_4_v3_harness.ts --live --category f` | bearer for the **separate eval-only Anthropic account** that runs the LLM judge (Doc 4 Wave 1.2 — must NOT be the production Oto Anthropic key; eval billing, rate-limit, and prompt-cache are kept isolated so eval cost overruns can't impact production) |
| `OTO_JUDGE_MODEL` | optional, cat (f) live | judge model id; defaults to `claude-haiku-4-5` |

**Separate-account rule (cat (f), live mode).** `OTO_JUDGE_ANTHROPIC_KEY` is
a hard gate: the loader's default JudgeRuntime errors loudly if it isn't set
when `--live` is selected. Per Doc 4 Wave 1.2 the eval-only account exists so
a runaway judge loop can't burn production Anthropic quota and so judge
traces stay out of production logs. Don't paste a production key into this
env var "just to get the harness running" — that's the exact failure mode
the separation prevents.

## Run — metrics unit tests

Once `vitest` is installed:

```
npx vitest run scripts/eval/lib/metrics.test.ts
npx vitest run scripts/eval/lib/wave_2_4_loader.test.ts
```

The metric functions and the Wave 2.4 loader are pure (no Date, no I/O, no
randomness) so tests are fully deterministic. The test suites cover:

`metrics.test.ts`:

- substring matching edge cases
- precision@3 with various candidate counts (denominator = min(3, |cands|))
- recall@5 with 5+ candidate windows
- MRR rank-1 vs rank-N
- tier_misclassification breakouts (T1->T3, T2_*->T3, etc.)
- disclaim_tag_correctness over/under directional cases
- Wilson 95% CI for pass-rate (N=10, N=0 edges)
- Cat F exclusion from every aggregate denominator

`wave_2_4_loader.test.ts`:

- JSONL parser happy path + ignores blank lines
- fail-fast on invalid JSON / missing required fields / bad enum values /
  malformed nested vehicle_scope / wrong-typed candidate_response
- judge sub-type classification (answer_body vs post_report)
- mock verdict generator determinism (right → PASS, wrong → FAIL)
- judge prompt rendering (verbatim template + user_query + web_context
  inclusion / omission + correct OTO-RESPONSE vs POST-REPORT label)
- judge reply parser (PASS/FAIL case-insensitive, malformed → FAIL with
  parse-error marker)
- live-mode runJudgeForCase with injected fake `JudgeRuntime` (verbatim
  candidate_response skips chat call; absent candidate_response triggers
  chat call; passed=false when actual diverges from expected)

## Day 4 prerequisites (blockers carried forward)

1. **Expose the outer cascade driver as an action.** Currently
   `convex/oto/tools.ts::retrieve_vehicle_facts` is wired only as an
   Anthropic tool callable. To run a true end-to-end Wave 5.2 baseline that
   covers Tier 1 + Tier 2 + Tier 3, we need an action like
   `api.oto.evalHarness.runFullCascade(query, vehicle_scope)` that the eval
   client can POST to. Owner: RAG Specialist. ETA: Day 4 morning.

2. **Multi-tenant test-data setup helper** (`scripts/eval/lib/multiTenantSetup.ts`).
   Needs:
   - two Clerk-synthetic users with distinct user_ids + bearer tokens
   - one fully-enriched synthetic vehicle config owned by user A
   - a teardown step that doesn't leave orphan rows
   Cross-tenant cases (Wave 1.4 v3 cat (d), plus Wave 5.1 Cat G live
   measurement) cannot run until this lands. Owner: Memory Engineer.

3. **Confirm report mutation name.** The Wave 1.4 v3 cat (c) live cases
   POST to `api.oto.factReports.report` (assumed). Confirm with the Memory
   Engineer that this is the right export name before flipping to `--live`.

## Hard constraints (Doc 3 §6 charter — don't violate)

- **N≥10 repeats** structurally enforced; lower values warn loudly.
- **Pure metrics** — `lib/metrics.ts` has no I/O, no Date, no random.
- **First-class `--mock`** — harness is developable offline.
- **Real vehicle scopes** in the labeled set — no `GENERIC_CAR` placeholders.
- **`disclaim_tag_correctness` with sub-rates** — over and under are
  separately reported; under is the regulated direction.
- **Wave 5.2 baseline must run before vectorIndex removal** (RAG Wave 5.1 §6).
  This harness is part of that measurement. Do NOT drop the `by_embedding`
  vectorIndex until the baseline + State 2 comparison are both published.
