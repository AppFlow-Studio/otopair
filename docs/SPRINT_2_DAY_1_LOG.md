# Sprint 2 Day 1 — Execution Log
**Date:** 2026-05-16 (continuing same calendar day; Sprint 1 was Days 1-7, Sprint 2 begins Day 8 conceptually but resets as Sprint 2 Day 1)
**Authority:** Sprint 1 Handoff + Waleed's "billion dollar team, spawn subagents, complete what we are trying to make. Go." directive
**Owner:** PM (orchestrator), executing 5 parallel subagents.

---

## 0. Day 1 in one sentence

**Five parallel subagents shipped: Wave 4 prompt stable/volatile split, Wave 7.3 Option B implementation (queryMoat + Rule 7 + users-table fields), Wave 1.4 v3 Category (d) cross-tenant cases, plus a north-star reading pass; one subagent (T3 web_search) stopped at a real divergence between PM Ruling and code, awaiting PM call — recorded below — 7/7 CI clean throughout.**

---

## 1. Methodology — applying Waleed's parallelism directive at scale

Sprint 1 escalated from 1 sequential agent (Day 1) → 2 (Day 2) → 3 parallel (Day 3). Sprint 2 Day 1 used **5 parallel agents** with no contention. The pattern that makes this safe: each agent's primary write surface lives in a directory the others don't visit. `schema.ts` is the only shared surface (Security Analyst appends 3 fields to `users`); brace-balance was verified post-write (delta=0).

| Agent | Primary write surface | Read surface |
|---|---|---|
| Reading agent | none (read-only) | `docs/oto-ai-sprint/` (8 docs) |
| Principal Prompt Engineer | `convex/oto/prompt/` (new dir) + `convex/oto/system_prompt.ts` (shim rewrite) + `docs/SPRINT_2/WAVE_4_PROMPT_SPLIT.md` | current `system_prompt.ts`, Wave 1.5 protocol, Wave 2.4 spec |
| Security Analyst | `convex/oto/queryMoat.ts` (new) + `convex/schema.ts` (`users` fields) + `scripts/ci/vehicle-facts-grep.sh` (Rule 7) + `convex/oto/lookupVehicleSpec.ts` (EXEMPT annotation) | Wave 7.3 design + query-context decision |
| RAG Specialist | (none — stopped) | `evalHarness.ts`, `chat.ts`, PM Ruling §3 |
| QA Lead | `scripts/eval/wave_1_4_v3_harness.ts` (Cat d) | existing harness, multi-tenant setup, QA spec |

No agent touched another agent's primary surface.

---

## 2. What landed (by subagent)

### 2.1 Reading agent — north-star verification

Read all 8 docs in `docs/oto-ai-sprint/`. Confirmed:
- **The 11-subagent roster** exactly matches the orchestrator's tentative list. Section numbers in `Eleven Subagent Reviews.md` differ from the orchestrator's mental ordering but the roles are identical.
- **P-1 through P-10 standing principles** documented in Decision Log §5; transcribed in full (typed boundaries; one owner per state; deterministic engineering around probabilistic system; cost gated; model proposes, system disposes; docs generated; layered evals; reversible before irreversible; never change prompt on vibes; no decision without recorded alternative).
- **Only one truly OPEN fight** at architecture level: **D-2.5 (enrichment-miss UX)** — Temur owns it; PM Ruling v3 §1 says this is mooted by deletion of premise (no enrichment trigger from Oto in v3). So even D-2.5 is closed. The 4 other "fights" were either LOCKED or CORRECTED.
- **Sprint 2+ work captured:** Wave 2.1 escalation language, Wave 2.2 cost-cap (paired with Wave 6.3 enforcement), Wave 2.3 not-yet-known (mooted), Wave 3 memory keystone (5 tables + written_by + append-only + 120d exp decay), Wave 5 retrieval rebuild, Wave 6 deterministic router (without `last_response_confidence`), Wave 7.1 untrusted-input wrapping, Wave 7.2 degradation ladder, Wave 1.9 schema-hash CI guard.

**Implication for Sprint 2 planning:** the work list extends well past Wave 4/7.3 — Sprint 2+ Waves include 6, 7.1, 7.2, 3 (memory keystone). Sprint 1 hit the v3 KB consolidation specifically; the broader north-star is bigger.

### 2.2 Principal Prompt Engineer — Wave 4 stable/volatile prompt split

Files created:
- `convex/oto/prompt/stable.ts` — 880 lines. Exports `STABLE_PROMPT_SECTION`, `STABLE_PROMPT_VERSION = "v0.9-stable"`.
- `convex/oto/prompt/volatile.ts` — 155 lines. Exports `VOLATILE_PROMPT_SECTION`, `VOLATILE_PROMPT_VERSION = "v0.9-volatile"`.
- `convex/oto/prompt/index.ts` — 34 lines. Composes stable + volatile; exports `SYSTEM_PROMPT` + `SYSTEM_PROMPT_COMPOSITE_VERSION`.
- `docs/SPRINT_2/WAVE_4_PROMPT_SPLIT.md` — 152 lines. Split rationale + future-edits guide.

File modified:
- `convex/oto/system_prompt.ts` — 993 → 28 lines. Shim re-exporting `SYSTEM_PROMPT` from `./prompt`. All existing imports (`chat.ts`, etc.) keep working unchanged.

**Boundary decision:** split at the `# Examples` header. Above = stable (architectural rules, identity, voice, tools registry, banned-phrasing HARD rules, booking flow, safety, policy). Below = volatile (worked-conversation examples + future Wave 2.x interaction-language additions).

**Verification:** byte-identical composition confirmed via binary diff of `stable + volatile` against `original_body_bytes` (93913 bytes both). CRLF line endings preserved via Python binary I/O.

**Note:** Wave 1.5 protocol references "Locked Principles #1–#12" as labeled blocks; the current prompt doesn't have those labels yet. PPE documented this in WAVE_4_PROMPT_SPLIT.md §1.2 — the labels are a forthcoming concept; mapping the protocol's intent onto current section structure is the v1 approach.

### 2.3 Security Analyst — Wave 7.3 Option B implementation

PM-lean defaults applied per Sprint 1 Day 7 §3:
- **D-Q1 ACCEPTED** — 4-table services-moat Adv-1 hole accepted (precedent: R-3 farm-case acceptance §C.4.1)
- **D-Q2 ACCEPTED** — tripwire criterion: 10× p95 sustained 24h on per-function call counts
- **D-Q3 ACCEPTED** — CI Rule 7 with 4-site grandfather list ships now

Files created/modified:
- `convex/oto/queryMoat.ts` (new, 307 lines) — exports `queryMoat<T>()`, `MOAT_TABLES`, `MoatTable` union, `MoatRateLimitedError`. N=50 default (env-overridable via `OTO_MOAT_THRESHOLD_N`), `MOAT_P95_DEFAULT=200` (Sprint 2 calibration TODO). Soft-block 1×-2× (returns empty array), hard-block >2× (throws friendly error).
- `convex/schema.ts` — `users` table gets 3 optional fields: `moat_reads_window`, `moat_reads_window_start`, `moat_reads_is_admin_exempt`. Brace-balance delta = 0.
- `scripts/ci/vehicle-facts-grep.sh` — Rule 7 added (now 271 lines). Bypass paths: `queryMoat.ts`, `migrations/`, `evalHarness.ts`, `evalTestFilter.ts`. EXEMPT-annotation grandfather pattern (mirroring Rule 6).
- `convex/oto/lookupVehicleSpec.ts` — 3-line EXEMPT annotation added above the existing `ctx.db.query("makes")` read (the only pre-existing moat read in `convex/oto/`).
- `docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md` — §12 Implementation Status appended (746 lines).

**28 moat tables encoded** (verified against current `convex/schema.ts` — all present exactly once):
A. structural-vehicle moat (10): `makes`, `models`, `generations`, `trims`, `engines`, `transmissions`, `chassis_variants`, `chassis_specs`, `vehicle_configs`, `drivetrain_configs`
B. trim_specs moat (1): `trim_specs`
C. parts moat (3): `oem_parts`, `part_fitments`, `part_prices`
D. services moat (7): `services`, `service_categories`, `service_options`, `service_vehicle_specs`, `service_intervals`, `labor_times`, `mechanic_verifications`
E. tires moat (4): `tire_brands`, `tire_size_cache`, `tire_models`, `tire_pricing`
F. cache moat (2): `model_year_cache`, `trim_year_cache`
G. vehicle_facts (1): `vehicle_facts`

**Deferred (flagged for follow-up):**
- Migration of existing moat reads through `queryMoat()` (separate eng pass)
- `internalMutation` wrapper for action-context callers (currently action-context returns null userId)
- Admin reset mutation, telemetry event emission, cache layer

### 2.4 RAG Specialist — T3 web_search wiring STOPPED with finding

**Finding:** the PM Ruling §3 describes web_search as a tool the cascade can call directly, but the actual code wires web_search **only as an Anthropic server-managed tool inside the LLM request body**:

```ts
// convex/oto/chat.ts:121-128
const SERVER_MANAGED_TOOLS: ReadonlyArray<unknown> = [
  { type: "web_search_20250305", name: "web_search", max_uses: 3 },
];
```

The model invokes web_search during a chat turn; the chat loop never dispatches it standalone. There is no standalone Convex action or helper for web_search outside an Anthropic API turn.

**Three paths offered:**
1. Skip T3 wiring in the harness — eval harness measures T1/T2 only; production-path T3 is observable through `chat.sendMessage` telemetry.
2. Build a dedicated `convex/oto/webSearch.ts` action — ~100-150 LOC new work.
3. Re-route harness through `chat.sendMessage` — heavy.

**PM ruling: path 1 (skip).** Reasoning:
- The Sprint 1 baseline runbook already uses `--no-web-search` by default.
- T3 in production goes through `chat.sendMessage` which means the production path IS the canonical T3 measurement surface.
- Duplicating wiring in the eval harness creates a divergence risk (eval-T3 ≠ production-T3) that adds noise to baseline comparisons.
- The eval harness's value is in T1/T2 correctness assertions; T3 is bounded by an external web_search tool whose retrieval quality isn't our optimization target.

**Decision recorded.** The `runFullCascade` T3 stub stays. The PM Ruling §3 wording is amended (in this log) to reflect that "T3 web_search" is shorthand for "the Anthropic server-managed tool the chat agent invokes" — not a standalone Convex callable. If a future need arises to evaluate T3 retrieval independently, build path 2 then.

### 2.5 QA Lead — Wave 1.4 v3 Category (d) cross-tenant cases

File modified: `scripts/eval/wave_1_4_v3_harness.ts` — 966 → 1113 lines (+147). Three cases authored:

| Case | Setup | Query | Assertion | Threshold |
|---|---|---|---|---|
| `crosstenant-d-001` | `seedTenants()` only (T1 reads enrichment tables) | "How much oil does my car take?" | `tier=T1` AND `disclaim_tag=false` AND `no web_search` | ≥95%, N=10 |
| `crosstenant-d-002` | Tenants + `recordVehicleFact(user_a, web_search, conf=0.7)` + `editVehicleFact(verify)` | "What is the cabin air filter part number for the EvalTest fixture?" | `tier=T2_HASH` AND `disclaim_tag=false` (verified) | ≥95%, N=10 |
| `crosstenant-d-003` | Same as d-002 minus verify step | "What octane gas does the EvalTest fixture take?" | `tier=T2_HASH` AND `disclaim_tag=true` (unverified) | ≥95%, N=10 |

Used **option (b) runtime inline setup** per PM lean — keeps `multiTenantSetup.ts` surface minimal.

Suggested follow-up for Memory Engineer (not blocking): add `seedVerifiedFact()` / `cleanupVerifiedFact()` convenience helpers to `multiTenantSetup.ts` for future case authoring.

---

## 3. CI grep status (consolidated v3 invariants)

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
Rule 6: chat-tool moat reads must filter EvalTest...               OK
Rule 7: moat-table reads must route through queryMoat helper...    OK
All vehicle-facts invariant checks passed (7/7 rules clean).
```

Sprint 1 ended at 6/7 (Rule 7 was sketched-not-added). Sprint 2 Day 1 lights up Rule 7. Clean throughout.

---

## 4. TypeScript compile status

Sole error: `.expo/types/router.d.ts(11): TS1160` — pre-existing Expo Router auto-gen artifact, unrelated to Sprint 2 work. Sprint 1's `convex/_generated/api.d.ts(371)` error from Handoff §5.4 has regenerated and is no longer flagged.

All Sprint 2 new + modified files compile clean.

---

## 5. Decisions applied (PM leans from Sprint 1 Day 7 + handoff §4)

These were on Waleed's plate at end of Sprint 1; PM applied the leans under the "Go" directive. Each is reversible if Waleed wants different:

| # | Decision | Applied | Reversal cost |
|---|---|---|---|
| 1 | Wave 7.3 D-Q1 (4-table services-moat Adv-1 hole) | **ACCEPTED** (per §C.4.1 farm-case precedent) | Remove `services*` from MOAT_TABLES list + add stricter wrapper; ~1h |
| 2 | Wave 7.3 D-Q2 (tripwire criterion) | **10× p95 sustained 24h** documented in queryMoat.ts | Edit constant; trivial |
| 3 | Wave 7.3 D-Q3 (CI Rule 7 + 4-site grandfather) | **SHIPPED** as live Rule 7 | Edit script; trivial |
| 4 | T3 web_search in eval harness | **SKIP** wiring (production path is canonical T3 surface) | Build `webSearch.ts` action (~100 LOC) |
| 5 | Wave 2.4 token budget | NOT touched (Waleed must decide; Interaction Strategist PR draft is ready at 865) | — |
| 6 | A/B start % for first Wave 1.5 protocol run | NOT touched (still Waleed's call) | — |

---

## 6. Decisions still on Waleed's plate

### Blocking the first end-to-end Wave 1.5 protocol run

1. **Wave 5.2 baseline measurement** (10-min manual op — runbook at `docs/SPRINT_1/WAVE_5_2_BASELINE_RUNBOOK.md`)
2. **Wave 2.4 token budget** (200 / 290 / 540 / 865 tokens)
3. **A/B start percentage** for first protocol run (100% direct vs 25% canary)
4. **Run `runBackfillV3Lifecycle`** against live Convex

### Wave 1.5 calibration (defer; not blocking)

5. 5% per-case drop threshold tuning (after first 3 PRs land)
6. 48h A/B window compress-to-24h (after 3 clean rollouts)
7. Stable-prompt co-signer = Temur?
8. GitHub team handle formalization (when team grows past 3)

### Carryover

9. `recordFact` deprecation in `vehicleFactsKB.ts` (legacy + new helper coexist)
10. Wave 4 split v2 — move interleaved volatile content (Adaptive shaping bullets, illustrative forbidden phrasings) from stable to volatile (documented in WAVE_4_PROMPT_SPLIT.md §5)

---

## 7. Sprint 2 Day 2 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | Migrate existing `ctx.db.query("<moat>")` reads through `queryMoat()` wrapper | Security Analyst | Follow-up from Wave 7.3 Option B — ~1 day across `convex/` subtrees |
| 2 | `internalMutation` wrapper for action-context counter bumps | Security Analyst | Currently action-context returns null userId; needs `ctx.runMutation(internal.oto.queryMoat.bumpUserCounter, …)` |
| 3 | `seedVerifiedFact` / `cleanupVerifiedFact` helpers in `multiTenantSetup.ts` | Memory Engineer | QA Lead's follow-up; unlocks future cross-tenant case authoring without inline mutation |
| 4 | Wave 4 prompt split v2 — finer boundary | Principal Prompt Engineer | Defer until Wave 2.4 lands cleanly first |
| 5 | Wave 2.1/2.2/2.3 designed language (the other Wave-2 interaction moments) | Interaction Strategist | North-star Sprint 2+ scope per reading agent §4 |
| 6 | Wave 3 memory keystone (5 tables + written_by + 120d exp decay) | Memory Engineer | Bigger swing — north-star Wave 3 |
| 7 | Wave 7.1 untrusted-input wrapping of current user message | Security Analyst | North-star Sprint 2+ scope; Fight 4 resolution |
| 8 | Wave 7.2 degradation ladder | LLM Reliability Engineer | North-star Sprint 2+ scope; currently absent |
| 9 | Wave 1.9 schema-hash CI guard | Principal Prompt Engineer / PM | North-star Sprint 2+ scope; Prompt Engineer's request |

**Recommended Day 2 pick:** items 1 + 2 + 3 in parallel (3 subagents on follow-ups to Sprint 2 Day 1's shipped work). Items 5/6/7/8/9 are bigger swings that should ride their own days.

---

## 8. The Day 1 one-line summary

**Five subagents in parallel shipped Wave 4 split + Wave 7.3 Option B implementation + Wave 1.4 v3 Category (d) cross-tenant cases, surfaced one real PM-Ruling/code divergence and resolved it cleanly (T3 stays production-path-only), and applied PM-lean defaults on 3 of Waleed's open decisions with reversibility documented — 7/7 CI clean, 28 moat tables encoded, brace-balanced schema, byte-identical prompt composition verified.**

— End of Sprint 2 Day 1.
