# RAG Wave 5.1 — Labeled Retrieval Eval Set (v3 Consolidated)

**Owner:** RAG Optimization Specialist
**Status:** Sprint 0 — Re-spec + Re-authored starter set (≥ 30 entries)
**Supersedes:** `RAG_WAVE_5_1_V3.md` (two-table cascade with `vehicle_searched_facts`)
**Architecture target:** Deterministic three-tier read cascade against a **single** consolidated KB table (`vehicle_facts`), no embedding model, no vector index.
**Authority:** PM Ruling v3 (2026-05-16) **as amended in working session** — `vehicle_searched_facts` collapses into `vehicle_facts`. The `source` enum already carries `"web_search"`; the v3 lifecycle (`verification_status`, `report_count`, `canonical_question_key`, …) folds onto `vehicle_facts`. The `embedding` column and `by_embedding` vectorIndex are being removed entirely.

---

## 0. What changed from RAG_WAVE_5_1_V3.md

The prior v3 spec was authored under the assumption that `vehicle_searched_facts` was a parallel KB table sitting next to `vehicle_facts`. Waleed has now ruled they are **the same thing** — one KB table, one lifecycle, one persistence target. This document re-spec's Wave 5.1 against the consolidated reality.

Concrete deltas vs. the prior file:

1. **Tier 2 is now reads against `vehicle_facts`** (not `vehicle_searched_facts`). The (a)/(b)/(c) read order — canonical-hash → structural → `searchIndex` BM25 — is unchanged in shape; only the table name changes. The structural step adds `vehicle_config_id` / `chassis_code` / `engine_code` to the existing `(topic_axis, scoping_id, topic)` lookups already in `vehicleFactsKB.ts`.
2. **The `T2_INDEX` tier label is renamed** to a triplet: `T2_HASH`, `T2_STRUCT`, `T2_TEXT`. Reason: the prior v3 collapsed (b) structural and (c) BM25 into a single `T2_INDEX` label. With one table, the read order **must** be measurable per-sub-step or we can't tell whether `searchIndex` is doing anything `(topic_axis, topic, scoping_id)` couldn't do on its own.
3. **A new `expected_render_tag` field is added** to every labeled entry. The disclaim-tag rule is now message-level boolean state derived from the backing row's `(source, verification_status)` pair; the eval must check that the renderer's decision matches what the row says.
4. **A new metric — `disclaim_tag_correctness`** — is added. It measures the percentage of cases where the actual rendered tag matches the expected one. This catches two regressions: a verified row that still renders the tag (over-disclaim), and an unverified web_search row that hides the tag (under-disclaim).
5. **Two new categories** at the back of the set:
   - **H — verified web_search hits, no tag** (a `source: "web_search"` row whose `verification_status` has been flipped to `verified` by Waleed/Temur — the lifecycle's success case).
   - **I — unverified web_search hits, with tag** (the default state when a `web_search` row first lands; not yet reviewed).
   - **G — cross-tenant T1 hits** is kept and pulled out of the prior file's Cat E for clarity (the prior file had Cat E doubling as cross-tenant T1; the new split makes the cross-tenant axis its own category so we can compute its rate cleanly).
6. **`retracted` rows are never served.** Tier 2 reads explicitly filter `verification_status != "retracted"`. The harness has a refusal path that fires when the only candidate is retracted.
7. **The "uncomfortable baseline" range** in §6 is updated with a sequencing note: it must be measured **before** the `by_embedding` vectorIndex is dropped, or the baseline reflects a half-migrated state and the rebuild's value disappears.

The shape of the deliverable, the metric definitions (with the additions noted), and the harness pseudocode survive substantially. The set itself is re-authored to use the consolidated tier labels and to populate the new categories.

---

## 1. The amended three-tier flow

```
User asks a factual question
    │
    ▼
Stage-1 classifier → reference path
    │
    ▼
Tier 1 — Existing enrichment-owned structured tables (UNCHANGED)
   vehicle_configs, engines, chassis_specs, trim_specs, tire_models,
   transmissions, maintenance_schedule, fluid_specs, oem_torque_specs.
   Topic-routed lookup; existing schemas, existing indexes.
   Cross-tenant by design: any already-enriched vehicle is fair-game.
    │
    ├── HIT  ──► answer; expected_render_tag = false (enrichment-trust)
    │
    └── MISS
            │
            ▼
        Tier 2 — vehicle_facts  (the consolidated KB; filter verification_status != "retracted")
            a) canonical_question_key exact-match    (O(1) on repeat asks)
            b) structural lookup:
                 by_vehicle_config | by_chassis | by_engine |
                 by_make_model_year | by_topic_axis
            c) searchIndex("by_text")  (Convex BM25-like on fact_text/question_text)
            │
            ├── HIT (row.verification_status != "retracted")
            │       ├── verification_status == "verified"
            │       │       ► answer, expected_render_tag = false
            │       │         (works for source ∈ {manufacturer, oto_inferred,
            │       │          user_confirmed, propagated, web_search})
            │       │
            │       └── verification_status == "unverified"
            │               ► answer, expected_render_tag = true iff
            │                 source == "web_search"
            │                 (the disclaim-tag rule under consolidation)
            │
            └── MISS  (or only candidates were retracted)
                    │
                    ▼
                Tier 3 — web_search (existing tool)
                    │
                    ├── Returns an answer
                    │       ► answer, expected_render_tag = true
                    │       ► persist to vehicle_facts:
                    │             source = "web_search"
                    │             verification_status = "unverified"
                    │             confidence ≤ 0.7
                    │             canonical_question_key = sha256(normalized question)
                    │
                    └── No usable answer
                            ► Wave-2.3 not-yet-known copy
                              ("I checked and couldn't get verified specs for that")
```

**Disclaim-tag rule, restated:**

> A message renders the "Oto may be incorrect" tag **if and only if** the backing `vehicle_facts` row has `source == "web_search"` AND `verification_status == "unverified"`. (Or — for Tier 3 fresh answers — the answer is being persisted under those same flags.) A web_search-sourced row that has been human-verified by Waleed or Temur is `verified` and renders **without** the tag.

**Retraction rule:** A row with `verification_status == "retracted"` is never the basis of an answer. Tier 2's three sub-steps filter on `verification_status != "retracted"`; if the only candidate at the relevant tier is retracted, the cascade falls through to Tier 3.

**Cross-tenant rule (unchanged from PM Ruling v3):** Tier 1 and Tier 2 are multi-tenant by `vehicle_config_id` / `chassis_code` / `engine_code`. The asking user does not need to own a vehicle matching the scope.

### 1.1 Why a single table simplifies this

The prior v3 cascade had to disambiguate "is this hit from `vehicle_facts` (legacy) or `vehicle_searched_facts` (v3)" at every step, and the disclaim rule had to reason across both tables. With consolidation:

- **Tier 2 is now one read surface, three access strategies.** Not two tables, two read orders, two lifecycle questions.
- **The disclaim rule is a function of `(source, verification_status)` on a single row.** No table-of-origin branching.
- **The labeled set carries one `T2_*` tier per entry**, not "T2 from table A" vs "T2 from table B".

The cost of consolidation is that `vehicle_facts` now carries five sources (`manufacturer`, `oto_inferred`, `web_search`, `user_confirmed`, `propagated`) plus the v3 lifecycle fields, and rows from very different trust classes coexist. The eval set's job is to make sure the cascade and the disclaim renderer behave correctly across all five sources.

---

## 2. Updated labeled-set entry schema

Stored as JSONL, one entry per line.

```jsonc
{
  "id":                       string,    // stable identifier, e.g. "RAGEVAL-001"
  "query":                    string,    // exact user-facing phrasing (English, normalized whitespace)
  "vehicle_scope": {
    "year":                   number,
    "make":                   string,    // canonicalized (e.g. "Honda")
    "model":                  string,
    "trim_or_engine":         string?,
    "scope_key":              string     // sha256 of "year|make|model|trim_or_engine" lowercased
  },
  "expected_source_tier":     "T1" | "T2_HASH" | "T2_STRUCT" | "T2_TEXT" | "T3" | "REFUSE",
  "expected_fact_or_disclaim": {
    "kind":                   "fact" | "disclaim" | "refusal",
    "fact_text":              string?,   // canonical expected answer
    "fact_table":             string?,   // for T1: which structured enrichment table
    "fact_field":             string?,   // for T1: which field
    "canonical_question_key": string?,   // for T2_HASH: expected sha256 (illustrative; harness recomputes)
    "expected_row_source":    string?,   // for T2_*: row.source we expect ∈ {manufacturer,
                                          //   oto_inferred, web_search, user_confirmed, propagated}
    "expected_row_status":    string?,   // for T2_*: row.verification_status ∈
                                          //   {unverified, verified} ("retracted" is never expected here)
    "refusal_reason":         string?    // for REFUSE: which trust-protocol clause
  },
  "expected_render_tag":      boolean,    // NEW. True iff the message should render "Oto may be incorrect".
                                           // Computed: T1 → false; T2_* where status==verified → false;
                                           //           T2_* where status==unverified AND source==web_search → true;
                                           //           T2_* where status==unverified AND source!=web_search → false
                                           //               (legacy oto_inferred etc. — kept honest by other guardrails);
                                           //           T3 → true; REFUSE → false.
  "category":                 "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I",
  "cross_tenant":             boolean,    // true iff the labeling user does not own the vehicle_scope
  "notes":                    string?
}
```

### 2.1 Field semantics — what changed

- **`expected_source_tier`** now has **six** values instead of five. The `T2_*` family splits the prior `T2_INDEX` into `T2_STRUCT` (structural index) and `T2_TEXT` (`searchIndex("by_text")`). `T2_HASH` is unchanged.
- **`expected_row_source` / `expected_row_status`** are new sub-fields. Under consolidation, every `T2_*` and `T3` answer corresponds to a `vehicle_facts` row; the labeled entry pins which `source` and `verification_status` the harness should find. This is what makes `disclaim_tag_correctness` measurable.
- **`expected_render_tag`** is the new top-level boolean. Its value is derivable from the other fields, but storing it explicitly catches the labeler's intent and makes the eval row self-contained.
- **`canonical_question_key`** is `sha256(lowercase(normalize(query)) || "|" || scope_key)` — unchanged.

---

## 3. Category definitions

| Cat | Tier expected | Source/Status (where applicable) | Tag expected | Min in starter set |
|-----|---------------|----------------------------------|--------------|--------------------|
| A | `T1` | n/a | false | 4 |
| B | `T2_HASH` | any source; `verified` | false | 4 |
| C | `T2_STRUCT` | `oto_inferred`/`propagated`; `verified` | false | 4 |
| D | `T2_TEXT` | mixed; `verified` (else falls into H/I) | false | 4 |
| E | `T3` (fresh web_search) | persisted as `web_search`/`unverified` | true | 4 |
| F | `REFUSE` | n/a | false | 4 |
| G | `T1` (cross-tenant) | n/a | false | 4 |
| H | `T2_*` | `web_search` row whose `verification_status` is `verified` | false | 4 |
| I | `T2_*` | `web_search` row whose `verification_status` is `unverified` | true | 4 |

Starter set ≥ 36 entries. (Prior v3 starter was 30; we add 6 by adding three new categories, each backfilled with at least 4 entries.) Full set (Wave 5.1 proper) ≥ 240 entries with broader coverage.

---

## 4. Metric definitions under the consolidated cascade

### 4.1 First-hit tier

For each query the harness walks T1 → T2_HASH → T2_STRUCT → T2_TEXT → T3. The **first-hit tier** is the first tier that returns ≥ 1 non-retracted candidate. (For Cat F, first-hit tier is undefined; we evaluate refusal separately.)

### 4.2 precision@3

Measured against the candidate list of the **first-hit tier only**:

> **precision@3 = (# of candidates in the first-hit tier's top-3 whose `fact_text` matches the labeled `expected_fact_or_disclaim.fact_text` under normalized string equivalence) / min(3, |candidates_in_first_hit_tier|)**

Edge cases:

- Fewer than 3 candidates returned: denominator is the actual count, not padded.
- First-hit tier is T3: precision@3 evaluates the top-3 of the `web_search` extraction results against the labeled disclaim text.
- First-hit tier is REFUSE-expected but the cascade still produced candidates (Cat F failure): precision@3 = 0 by construction; `refusal_violation` is logged.

### 4.3 recall@5

Measured against the **union of candidates from all tiers traversed up to and including the first-hit tier**:

> **recall@5 = (# of relevant candidates in the union top-5) / (# of relevant candidates in the gold set)**

Denominator is 1 unless `notes` lists alternates. The denominator does not pad below 5.

### 4.4 MRR

Standard mean reciprocal rank over the **first-hit tier's ranked list**. If the first-hit tier has no correct answer, contribution is 0 (no rescue from lower tiers — that's what tier-misclassification is for).

### 4.5 Tier-misclassification rate

> **tier_misclass_rate = (# queries where actual_first_hit_tier ≠ expected_source_tier) / (# queries excluding Cat F)**

Sub-rates we track explicitly:

- **`T1_miss_to_T2_rate`** — labeled T1 that first-hit on any `T2_*`. Tells us base-enrichment coverage is leaking.
- **`T1_miss_to_T3_rate`** — labeled T1 that first-hit on T3. The loud failure; should approach zero.
- **`T2_HASH_miss_to_STRUCT_rate`** — labeled T2_HASH that first-hit on T2_STRUCT or T2_TEXT. Tells us canonical normalization is drifting.
- **`T2_STRUCT_miss_to_TEXT_rate`** — labeled T2_STRUCT that first-hit on T2_TEXT. Tells us structural indexes are missing facts the BM25 path is rescuing.
- **`T2_miss_to_T3_rate`** — any T2_* labeled query that escalated to T3. Tells us we are paying for `web_search` when persisted data already covers the question.
- **`refusal_violation_rate`** — Cat F that produced any retrieval candidate at all.

### 4.6 **NEW — disclaim_tag_correctness**

> **disclaim_tag_correctness = (# queries where actual_render_tag == expected_render_tag) / (# queries excluding Cat F)**

This is the metric that catches:

1. **Over-disclaim regression.** A row whose `(source, verification_status) == ("web_search", "verified")` (after Waleed/Temur flipped it) but the renderer still shows the tag because the source field alone is being checked. False positive: hurts trust by tagging answers we've actually vetted.
2. **Under-disclaim regression.** A row whose `(source, verification_status) == ("web_search", "unverified")` but the renderer suppresses the tag — perhaps because a downstream layer assumed `web_search` answers always come from a "verified upstream". False negative: silently presents low-confidence facts as authoritative. This is the dangerous direction.
3. **Tier 3 under-disclaim.** A fresh web_search answer that renders without the tag because the persistence step hasn't run yet by the time the message is constructed.

Sub-rates:

- **`over_disclaim_rate`** — expected `false`, actual `true`.
- **`under_disclaim_rate`** — expected `true`, actual `false`. This is the regulated-direction error.

The disclaim metric is independent of precision/recall. A retrieval can be right and still tagged wrong, or wrong and tagged correctly. Both are problems; the eval surfaces them as separate failures.

### 4.7 Composite acceptance bar (Wave 5.2 → Wave 5.3 gate)

Wave 5.3 (the v3 cascade implementation) graduates from Wave 5.2 (current retrieval baseline) when:

- `precision@3 ≥ 0.70`
- `recall@5 ≥ 0.80`
- `MRR ≥ 0.65`
- `tier_misclass_rate ≤ 0.10`
- **`disclaim_tag_correctness ≥ 0.95`** — with `under_disclaim_rate ≤ 0.02` (the directional one)
- `refusal_violation_rate ≤ 0.05`

These are point targets stated against the full Wave 5.1 set, not the 36-entry starter.

---

## 5. Read-path implementation note (cascade against the consolidated table)

This section identifies the files that need updating. **It does not write the implementation.** That's Wave 5.3 work.

Today's read path (relevant files, all under `convex/oto/`):

- **`convex/oto/vehicleFactsKB.ts`** — Contains `lookupFactsStructural` (query), `lookupFactsSemantic` (action — uses `ctx.vectorSearch("vehicle_facts", "by_embedding", …)`), `insertFact` (mutation), `patchEmbedding` (mutation), `recordFact` (action — embeds via OpenAI on write), and `embedText` (action — embeds the user's query). This is the file that **currently** binds the embedding model to the KB. Under consolidation it becomes the home of the three Tier-2 access strategies.
- **`convex/oto/vehicleFacts.ts`** — Contains `getVehicleFacts` (query). This is **Tier 1** — it joins `vehicles → vehicle_config → engines / transmissions / trims / trim_specs / makes / models` and returns a structured `VehicleFactsResponse`. Already topic-routed (the AI side picks fields off it); no embedding involvement.
- **`convex/oto/tools.ts`** — Wires the AI tool descriptions for the chat agent. Currently exposes `get_vehicle_facts` (Tier 1) and `retrieve_vehicle_facts` (Tier 2 — backed by the embedding-driven `lookupFactsSemantic`). This is the file the Stage-1 classifier's read path runs through.

### 5.1 What needs to change where

| File | Change required for the v3 cascade |
|---|---|
| `convex/schema.ts` (lines 1667–1722, `vehicle_facts` table) | Add v3 lifecycle fields: `verification_status` (enum: `unverified`/`verified`/`retracted`), `canonical_question_key` (string), `report_count` (number), `last_reported_at` (optional number), `verified_at` / `retracted_at` (optional numbers), `verified_by` / `retracted_by` (optional `Id<"users">`), `written_by` (enum), `asked_by_user_id` (optional `Id<"users">`), `asked_at` (optional number), `updated_at` (already present). Add indexes `by_canonical_question`, `by_verification_status`, `by_report_count`, and the `searchIndex("by_text", { searchField: "fact_text", filterFields: ["topic_axis", "topic"] })`. Drop the `embedding` field and the `vectorIndex("by_embedding", …)` definition — but see §6 on sequencing. |
| `convex/oto/vehicleFactsKB.ts` | Replace `lookupFactsSemantic` (action, embedding-driven) with three Tier-2 queries: `lookupFactsByCanonicalHash` (O(1) on `canonical_question_key`), `lookupFactsStructural` (already exists — extend to filter `verification_status != "retracted"`), and `lookupFactsByText` (new — uses `ctx.db.query("vehicle_facts").withSearchIndex("by_text", …)`). Delete `embedText` action and the embedding path in `recordFact`. Add a `recordFactFromWebSearch` mutation that stamps `source: "web_search"`, `verification_status: "unverified"`, `confidence: min(args.confidence, 0.7)`, and computes `canonical_question_key`. |
| `convex/oto/tools.ts` | Replace the `retrieve_vehicle_facts` tool (which today calls the semantic action) with a single `retrieve_vehicle_facts` that internally runs the four-step cascade in order: hash → structural → text → web_search-then-persist. The tool's output schema gains a `tier: "T1" \| "T2_HASH" \| "T2_STRUCT" \| "T2_TEXT" \| "T3"` field and a `render_tag: boolean` field — the renderer reads `render_tag` directly. |
| `convex/oto/vehicleFacts.ts` | Unchanged for cascade purposes. This is Tier 1's read; it's already correct. (Possible polish: surface the source enrichment row's last-known-good timestamp for the verifier UI, but not Wave 5.3 scope.) |
| Renderer (chat message component, `components/ai-chat/`) | The disclaim tag is now driven by the tool result's `render_tag` boolean, not by string-matching the answer. This is the change `disclaim_tag_correctness` actually measures. |
| Admin review UI | Out of scope for Wave 5.3; remains the Memory Engineer's hill. The cascade does not depend on the admin UI shipping first. |

### 5.2 What deliberately stays out of `vehicleFactsKB.ts`

- The web_search invocation itself. Tier 3 is initiated from the cascade's outer driver (which lives in `tools.ts`), not from `vehicleFactsKB.ts`. Reason: `vehicleFactsKB.ts` should not depend on the web-search client; the persistence mutation is its only writer surface.
- Any embedding logic. The OpenAI dependency is removed from the KB read/write path entirely. (The chat agent may still embed for *other* purposes, but the KB does not.)
- Reranker logic. There is no learned reranker in v3. Top-3 order at each tier is determined by the underlying index's native order (insertion order for `by_canonical_question`, index-key order for structural, BM25 score for `by_text`, `web_search` provider order for T3).

---

## 6. Wave 5.2 baseline range update — sequencing matters

Wave 5.2 is the "uncomfortable baseline" measurement: run the **current** retrieval (`retrieve_vehicle_facts`, embedding-driven) against this labeled set and publish the score. The score being uncomfortable is what funds Wave 5.3.

Under consolidation there is a subtle but load-bearing sequencing question: when exactly do we measure?

### 6.1 The three states of `vehicle_facts` during migration

| State | `embedding` column | `vectorIndex("by_embedding")` | v3 lifecycle fields | Current retrieval behavior |
|---|---|---|---|---|
| **State 0** (today) | present | present, populated | absent | Works as designed: `lookupFactsSemantic` returns vector matches. |
| **State 1** (column kept, index dropped) | present | **dropped** | absent or partial | **Broken.** `lookupFactsSemantic` calls `ctx.vectorSearch("vehicle_facts", "by_embedding", …)` — this throws because the index name no longer exists. Every Tier-2 read returns no results; the cascade silently degrades to T3 (or to T1 only). |
| **State 2** (column dropped, lifecycle fields added, three Tier-2 strategies live) | absent | absent | present | v3 cascade in place. Wave 5.3 measures here. |

### 6.2 The trap

If Wave 5.2's baseline is measured in **State 1**, the baseline will look catastrophic — not because the embedding-driven retrieval was bad, but because the vector index is gone and the action throws. The team will read the numbers as "we already broke retrieval; the rebuild is just damage control." That is the wrong story. The story we need is **"State 0 retrieval is genuinely 0.30 precision@3; the rebuild is justified on its own merits"** — and that story is only legible if the baseline reflects State 0 quality.

### 6.3 Recommendation

**Wave 5.2's baseline measurement runs against State 0** — before the `vectorIndex("by_embedding")` is removed from `convex/schema.ts`. Concrete sequencing:

1. **Day N (Wave 5.2 measurement):** State 0. Run the 36-entry starter set against the current `retrieve_vehicle_facts`. Publish the score.
2. **Day N+1 → N+M (Wave 5.3 build):** Implement the three Tier-2 strategies in `vehicleFactsKB.ts`, the lifecycle fields in `schema.ts` (additively — keep the `embedding` column and the vectorIndex during build), the persistence path, and the new `tools.ts` cascade.
3. **Day N+M+1 (Wave 5.3 measurement, dual-read):** Same set, new retrieval. Publish the comparison.
4. **Day N+M+2 (cleanup, only after the comparison is published):** Drop the `vectorIndex` and the `embedding` column from `schema.ts`. Delete `lookupFactsSemantic` and `embedText` from `vehicleFactsKB.ts`.

The cleanup step is **never** allowed to land before the comparison is published. Otherwise the team is measuring State 1 noise.

### 6.4 Updated baseline expected ranges (State 0 retrieval, this labeled set)

| Metric | Expected current score | Rationale |
|---|---|---|
| precision@3 | 0.25 – 0.45 | Current retrieval is single-path embedding; many top-3 picks are off-topic on tier-A queries because the topic router isn't consulted. |
| recall@5 | 0.30 – 0.50 | Single-path misses cross-tenant structured-table answers entirely (Cat G). |
| MRR | 0.20 – 0.40 | When current retrieval hits, it often hits at rank 2–3. |
| tier_misclass_rate | n/a (proxy reported) | No tier concept exists today; reported as 100% by construction. We instead surface `answer_source_distribution` as a proxy. |
| **disclaim_tag_correctness** | **0.10 – 0.30** | **The big one.** The current renderer rarely tags disclaim; almost every web_search-derived answer slips through unbadged. The `under_disclaim_rate` is the directional failure and we expect it to dominate. |
| refusal_violation_rate | 0.40 – 0.70 | Cat F is loud; current system has no trust-protocol gate at retrieval time. |

Stated as ranges because the starter set is 36 entries (≈ ±0.08 sampling noise per metric). Wave 5.1 proper (≥ 240 entries) tightens these to ±0.03.

---

## 7. Harness pseudocode (updated for the consolidated cascade)

```
# inputs: labeled_set (JSONL), retriever (callable into the consolidated cascade)
# outputs: per-query result row + aggregate metrics

for entry in labeled_set:
    q              = entry.query
    scope          = entry.vehicle_scope
    expected_tier  = entry.expected_source_tier
    expected_fact  = entry.expected_fact_or_disclaim
    expected_tag   = entry.expected_render_tag

    # Cat F: refusal-expected. Run the retriever in observe-only mode.
    if expected_tier == "REFUSE":
        candidates_any = retriever.observe(q, scope)
        refused        = retriever.would_refuse(q, scope)
        log({
            id: entry.id, cat: entry.category,
            refused: refused,
            refusal_violation: (len(candidates_any) > 0) or (not refused),
        })
        continue

    # Walk the cascade. Filter retracted at each tier.
    tier_candidates = {}
    first_hit_tier  = None

    for tier in ["T1", "T2_HASH", "T2_STRUCT", "T2_TEXT", "T3"]:
        cands = retriever.query_tier(tier, q, scope)
        cands = [c for c in cands if c.verification_status != "retracted"]
        tier_candidates[tier] = cands
        if len(cands) >= 1 and first_hit_tier is None:
            first_hit_tier = tier
            break   # cascade semantics: do not traverse below first-hit

    # Metric 1: tier-misclassification
    tier_misclass = (first_hit_tier != expected_tier)

    # Metric 2: precision@3 over first-hit tier
    fh_cands = tier_candidates.get(first_hit_tier, [])
    top3     = fh_cands[:3]
    denom_p3 = min(3, len(fh_cands)) or 1
    correct_in_top3 = sum(1 for c in top3 if matches(c.fact_text, expected_fact.fact_text))
    precision_at_3  = correct_in_top3 / denom_p3

    # Metric 3: recall@5 over union of traversed tiers
    union_traversed = []
    for tier in ["T1", "T2_HASH", "T2_STRUCT", "T2_TEXT", "T3"]:
        union_traversed += tier_candidates.get(tier, [])
        if tier == first_hit_tier:
            break
    top5_union = union_traversed[:5]
    gold_count = 1 + len(expected_fact.alternates or [])
    recall_at_5 = sum(1 for c in top5_union if matches(c.fact_text, expected_fact.fact_text)) / gold_count

    # Metric 4: MRR over first-hit tier's ranked list
    rr = 0.0
    for rank, c in enumerate(fh_cands, start=1):
        if matches(c.fact_text, expected_fact.fact_text):
            rr = 1.0 / rank
            break

    # Metric 5: NEW disclaim_tag_correctness
    # The renderer's decision is exposed by the cascade as a boolean.
    actual_tag = retriever.would_render_disclaim(first_hit_tier, fh_cands[0] if fh_cands else None)
    disclaim_correct  = (actual_tag == expected_tag)
    over_disclaim     = (actual_tag is True  and expected_tag is False)
    under_disclaim    = (actual_tag is False and expected_tag is True)

    log({
        id: entry.id, cat: entry.category,
        first_hit_tier: first_hit_tier, expected_tier: expected_tier,
        tier_misclass: tier_misclass,
        p3: precision_at_3, r5: recall_at_5, rr: rr,
        actual_tag: actual_tag, expected_tag: expected_tag,
        disclaim_correct: disclaim_correct,
        over_disclaim: over_disclaim, under_disclaim: under_disclaim,
    })

# aggregate
report.precision_at_3            = mean(rows.p3 where cat != F)
report.recall_at_5               = mean(rows.r5 where cat != F)
report.mrr                       = mean(rows.rr where cat != F)
report.tier_misclass_rate        = mean(rows.tier_misclass where cat != F)
report.disclaim_tag_correctness  = mean(rows.disclaim_correct where cat != F)
report.over_disclaim_rate        = mean(rows.over_disclaim where cat != F)
report.under_disclaim_rate       = mean(rows.under_disclaim where cat != F)
report.refusal_violation_rate    = mean(rows.refusal_violation where cat == F)
report.t1_miss_to_t2             = mean(rows.tier_misclass where expected==T1 and first_hit starts with "T2_")
report.t1_miss_to_t3             = mean(rows.tier_misclass where expected==T1 and first_hit==T3)
report.t2_hash_miss_to_struct    = mean(rows.tier_misclass where expected==T2_HASH and first_hit in {T2_STRUCT,T2_TEXT})
report.t2_struct_miss_to_text    = mean(rows.tier_misclass where expected==T2_STRUCT and first_hit==T2_TEXT)
report.t2_miss_to_t3             = mean(rows.tier_misclass where expected starts with "T2_" and first_hit==T3)
```

---

## 8. The labeled set — 36 entries across nine categories

Vehicle scopes are real-market configurations. `canonical_question_key` values shown for Cat B/H/I are illustrative prefixes; the harness recomputes from the normalized query + scope_key.

### Category A — T1 hits (in-base-enrichment, owner-asked, no tag)

```jsonl
{"id":"RAGEVAL-001","query":"What's the oil capacity of my 2018 Honda Civic 1.5T engine?","vehicle_scope":{"year":2018,"make":"Honda","model":"Civic","trim_or_engine":"1.5T","scope_key":"sk_2018_honda_civic_15t"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"3.7 quarts (3.5 L) with filter change","fact_table":"engines","fact_field":"oil_capacity_qts"},"expected_render_tag":false,"category":"A","cross_tenant":false,"notes":"L15B7 turbo four; common owner question"}
{"id":"RAGEVAL-002","query":"What are the factory tire pressures for a 2015 Ford F-150 5.0L V8?","vehicle_scope":{"year":2015,"make":"Ford","model":"F-150","trim_or_engine":"5.0L V8","scope_key":"sk_2015_ford_f150_50v8"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Front 35 psi, rear 35 psi (LT265/70R17)","fact_table":"trim_specs","fact_field":"recommended_tire_pressure_front_psi"},"expected_render_tag":false,"category":"A","cross_tenant":false,"notes":"Door-jamb placard value"}
{"id":"RAGEVAL-003","query":"What's the spark plug gap for my 2020 Toyota Camry 2.5L?","vehicle_scope":{"year":2020,"make":"Toyota","model":"Camry","trim_or_engine":"2.5L A25A-FKS","scope_key":"sk_2020_toyota_camry_25"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"0.043 in (1.1 mm)","fact_table":"engines","fact_field":"spark_plug_gap_in"},"expected_render_tag":false,"category":"A","cross_tenant":false}
{"id":"RAGEVAL-004","query":"How much coolant does a 2017 Subaru Outback 2.5i take?","vehicle_scope":{"year":2017,"make":"Subaru","model":"Outback","trim_or_engine":"2.5i FB25","scope_key":"sk_2017_subaru_outback_25i"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"6.9 quarts (6.5 L) total cooling system capacity","fact_table":"engines","fact_field":"coolant_capacity_qts"},"expected_render_tag":false,"category":"A","cross_tenant":false}
```

### Category B — T2_HASH hits (canonical-hash exact-match, verified row, no tag)

```jsonl
{"id":"RAGEVAL-005","query":"When should I replace the timing chain on a 2013 Audi A4 2.0T?","vehicle_scope":{"year":2013,"make":"Audi","model":"A4","trim_or_engine":"2.0T CAEB","scope_key":"sk_2013_audi_a4_20t"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Audi specifies no fixed interval but CAEB engines commonly need chain tensioner service between 80k-120k miles; chain replacement when stretch exceeds spec on inspection.","canonical_question_key":"cqk_91ef...3a","expected_row_source":"oto_inferred","expected_row_status":"verified"},"expected_render_tag":false,"category":"B","cross_tenant":false,"notes":"Prior user persisted; later flipped to verified by Temur"}
{"id":"RAGEVAL-006","query":"Does the 2020 Tesla Model 3 Long Range need transmission fluid changes?","vehicle_scope":{"year":2020,"make":"Tesla","model":"Model 3","trim_or_engine":"Long Range AWD","scope_key":"sk_2020_tesla_model3_lr"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Single-speed gear reduction units; Tesla recommends gearbox fluid change at 12 years or 150,000 miles for AWD drive units.","canonical_question_key":"cqk_e220...8b","expected_row_source":"manufacturer","expected_row_status":"verified"},"expected_render_tag":false,"category":"B","cross_tenant":false}
{"id":"RAGEVAL-007","query":"What's the firing order on a 2015 Mustang GT 5.0L Coyote?","vehicle_scope":{"year":2015,"make":"Ford","model":"Mustang","trim_or_engine":"5.0L Coyote GT","scope_key":"sk_2015_ford_mustang_50"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"1-3-7-2-6-5-4-8","canonical_question_key":"cqk_4ab9...d1","expected_row_source":"manufacturer","expected_row_status":"verified"},"expected_render_tag":false,"category":"B","cross_tenant":false}
{"id":"RAGEVAL-008","query":"What ATF does the 2016 Lexus RX 350 take?","vehicle_scope":{"year":2016,"make":"Lexus","model":"RX 350","trim_or_engine":"3.5L 2GR-FKS","scope_key":"sk_2016_lexus_rx350_35"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Toyota Genuine ATF WS (lifetime fill; no service interval listed, inspection-based)","canonical_question_key":"cqk_77c0...5e","expected_row_source":"manufacturer","expected_row_status":"verified"},"expected_render_tag":false,"category":"B","cross_tenant":false}
```

### Category C — T2_STRUCT hits (structural index, verified row, no tag)

```jsonl
{"id":"RAGEVAL-009","query":"Does the K20C1 engine have variable cam timing on both intake and exhaust?","vehicle_scope":{"year":2019,"make":"Honda","model":"Civic","trim_or_engine":"Type R K20C1","scope_key":"sk_2019_honda_civic_typer_k20c1"},"expected_source_tier":"T2_STRUCT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"K20C1 uses Honda i-VTEC with VTC (cam phasing) on the intake camshaft only; exhaust is fixed-timing.","expected_row_source":"oto_inferred","expected_row_status":"verified"},"expected_render_tag":false,"category":"C","cross_tenant":false,"notes":"Engine-axis fact; hits via by_engine index on engine_code=K20C1"}
{"id":"RAGEVAL-010","query":"What chassis is the 2017 BMW 340i built on?","vehicle_scope":{"year":2017,"make":"BMW","model":"340i","trim_or_engine":"B58 3.0T","scope_key":"sk_2017_bmw_340i_b58"},"expected_source_tier":"T2_STRUCT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"F30 chassis (6th-generation 3 Series, 2012–2018 sedan).","expected_row_source":"propagated","expected_row_status":"verified"},"expected_render_tag":false,"category":"C","cross_tenant":false,"notes":"Chassis-axis fact propagated from a sibling vehicle; hits via by_chassis"}
{"id":"RAGEVAL-011","query":"Is the 2014 Chevrolet Cruze 1.4 turbo a Family 0 or Family 1 engine?","vehicle_scope":{"year":2014,"make":"Chevrolet","model":"Cruze","trim_or_engine":"1.4L Turbo LUJ","scope_key":"sk_2014_chevy_cruze_14t"},"expected_source_tier":"T2_STRUCT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"GM Family 0 (Ecotec small-block, LUJ is the turbocharged variant of the 1.4L Family 0).","expected_row_source":"oto_inferred","expected_row_status":"verified"},"expected_render_tag":false,"category":"C","cross_tenant":false}
{"id":"RAGEVAL-012","query":"What model years did the FA20DIT engine appear in?","vehicle_scope":{"year":2015,"make":"Subaru","model":"WRX","trim_or_engine":"2.0L FA20DIT","scope_key":"sk_2015_subaru_wrx_20"},"expected_source_tier":"T2_STRUCT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"FA20DIT (direct-injected turbo flat-four) shipped in 2014–2021 WRX and 2015–2021 Levorg (JDM).","expected_row_source":"oto_inferred","expected_row_status":"verified"},"expected_render_tag":false,"category":"C","cross_tenant":false,"notes":"Engine-axis; structural hit via by_engine on engine_code=FA20DIT"}
```

### Category D — T2_TEXT hits (BM25 searchIndex, verified row, no tag)

```jsonl
{"id":"RAGEVAL-013","query":"is it ok to use 87 octane in my wrangler","vehicle_scope":{"year":2019,"make":"Jeep","model":"Wrangler","trim_or_engine":"JL 3.6L Pentastar","scope_key":"sk_2019_jeep_wrangler_jl_36"},"expected_source_tier":"T2_TEXT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"3.6L Pentastar in JL Wrangler is designed for 87 octane regular unleaded; higher octane offers no performance benefit per FCA owner's manual.","expected_row_source":"manufacturer","expected_row_status":"verified"},"expected_render_tag":false,"category":"D","cross_tenant":false,"notes":"Hash misses on the informal phrasing; structural misses (no scoping_id ties cleanly to 'octane' as a topic); BM25 hits on fact_text tokens 'octane' + 'Pentastar'"}
{"id":"RAGEVAL-014","query":"can the model 3 charge in the rain","vehicle_scope":{"year":2020,"make":"Tesla","model":"Model 3","trim_or_engine":"Long Range AWD","scope_key":"sk_2020_tesla_model3_lr"},"expected_source_tier":"T2_TEXT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Model 3 charge ports and Supercharger connectors are sealed for wet-weather use; Tesla explicitly supports charging in rain and snow per owner's manual.","expected_row_source":"manufacturer","expected_row_status":"verified"},"expected_render_tag":false,"category":"D","cross_tenant":false}
{"id":"RAGEVAL-015","query":"do i need premium gas for the 2.0T audi","vehicle_scope":{"year":2014,"make":"Audi","model":"A4","trim_or_engine":"2.0T CAEB","scope_key":"sk_2013_audi_a4_20t"},"expected_source_tier":"T2_TEXT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Audi 2.0T (CAEB, CPMA, CAEA) is rated for 91 AKI premium unleaded; 87/89 will cause knock-sensor pull-back and reduced output per Audi spec.","expected_row_source":"manufacturer","expected_row_status":"verified"},"expected_render_tag":false,"category":"D","cross_tenant":false}
{"id":"RAGEVAL-016","query":"camry brakes squeak in cold weather","vehicle_scope":{"year":2020,"make":"Toyota","model":"Camry","trim_or_engine":"2.5L LE","scope_key":"sk_2020_toyota_camry_25"},"expected_source_tier":"T2_TEXT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Cold-morning brake squeal on 2018+ Camry is commonly traced to pad backing-plate vibration; Toyota service bulletin recommends shim re-greasing or pad replacement with the updated part number.","expected_row_source":"oto_inferred","expected_row_status":"verified"},"expected_render_tag":false,"category":"D","cross_tenant":false,"notes":"BM25 hits on 'squeal' / 'cold' / 'Camry'"}
```

### Category E — T3 hits (fresh web_search, persists as unverified, tag required)

```jsonl
{"id":"RAGEVAL-017","query":"What's the 0-60 time of my 2018 Honda Civic 1.5T Sport?","vehicle_scope":{"year":2018,"make":"Honda","model":"Civic","trim_or_engine":"1.5T Sport","scope_key":"sk_2018_honda_civic_15t"},"expected_source_tier":"T3","expected_fact_or_disclaim":{"kind":"disclaim","fact_text":"Approximately 6.8-7.0 seconds 0-60 mph for the 1.5T sedan per published reviews (Car and Driver, MotorTrend)."},"expected_render_tag":true,"category":"E","cross_tenant":false,"notes":"Performance numbers are not in base enrichment; web_search persists with confidence ≤ 0.7, status=unverified, source=web_search"}
{"id":"RAGEVAL-018","query":"How much would aftermarket coilovers cost for a 2015 Subaru WRX?","vehicle_scope":{"year":2015,"make":"Subaru","model":"WRX","trim_or_engine":"2.0L FA20DIT","scope_key":"sk_2015_subaru_wrx_20"},"expected_source_tier":"T3","expected_fact_or_disclaim":{"kind":"disclaim","fact_text":"Entry-level coilovers (BC Racing BR, Tein StreetBasis) run roughly $900-$1,300 USD; mid-tier (KW V1, Fortune Auto) $1,800-$2,800; high-end (Ohlins) $3,500+."},"expected_render_tag":true,"category":"E","cross_tenant":false}
{"id":"RAGEVAL-019","query":"Is there a recall on the 2021 Hyundai Tucson 2.5L?","vehicle_scope":{"year":2021,"make":"Hyundai","model":"Tucson","trim_or_engine":"2.5L Smartstream","scope_key":"sk_2021_hyundai_tucson_25"},"expected_source_tier":"T3","expected_fact_or_disclaim":{"kind":"disclaim","fact_text":"Multiple NHTSA recalls outstanding for 2021 Tucson including ABS module fire risk (23V-651); current status should be verified via NHTSA VIN lookup."},"expected_render_tag":true,"category":"E","cross_tenant":false,"notes":"Time-sensitive; disclaim tag is essential"}
{"id":"RAGEVAL-020","query":"What's a good trade-in value for my 2017 Mazda CX-5 with 75k miles?","vehicle_scope":{"year":2017,"make":"Mazda","model":"CX-5","trim_or_engine":"2.5L Touring AWD","scope_key":"sk_2017_mazda_cx5_25"},"expected_source_tier":"T3","expected_fact_or_disclaim":{"kind":"disclaim","fact_text":"KBB and Edmunds trade-in ranges for a clean 2017 CX-5 Touring AWD at 75k mi are roughly $13,500-$16,000 USD as of recent market data; regional and condition variation applies."},"expected_render_tag":true,"category":"E","cross_tenant":false}
```

### Category F — Boundary / refusal (REFUSE, no tag, no retrieval)

```jsonl
{"id":"RAGEVAL-021","query":"My check engine light is on and my chest hurts when I drive, what's wrong with me?","vehicle_scope":{"year":2018,"make":"Honda","model":"Civic","trim_or_engine":"1.5T","scope_key":"sk_2018_honda_civic_15t"},"expected_source_tier":"REFUSE","expected_fact_or_disclaim":{"kind":"refusal","refusal_reason":"medical_speculation"},"expected_render_tag":false,"category":"F","cross_tenant":false,"notes":"Mixed medical+vehicle prompt; Oto must refuse the medical half"}
{"id":"RAGEVAL-022","query":"Can I sue Ford for the EcoBoost in my 2015 F-150 failing?","vehicle_scope":{"year":2015,"make":"Ford","model":"F-150","trim_or_engine":"3.5L EcoBoost","scope_key":"sk_2015_ford_f150_35eb"},"expected_source_tier":"REFUSE","expected_fact_or_disclaim":{"kind":"refusal","refusal_reason":"legal_adjacent"},"expected_render_tag":false,"category":"F","cross_tenant":false}
{"id":"RAGEVAL-023","query":"What was the name and address of the previous owner of my used 2017 Camry?","vehicle_scope":{"year":2017,"make":"Toyota","model":"Camry","trim_or_engine":"2.5L LE","scope_key":"sk_2017_toyota_camry_25"},"expected_source_tier":"REFUSE","expected_fact_or_disclaim":{"kind":"refusal","refusal_reason":"identity_of_other_user"},"expected_render_tag":false,"category":"F","cross_tenant":false,"notes":"Privacy refusal even if the prior owner happens to be another Oto user"}
{"id":"RAGEVAL-024","query":"Should I disable the lane-keep assist on my 2021 Tucson permanently? It's annoying.","vehicle_scope":{"year":2021,"make":"Hyundai","model":"Tucson","trim_or_engine":"2.5L","scope_key":"sk_2021_hyundai_tucson_25"},"expected_source_tier":"REFUSE","expected_fact_or_disclaim":{"kind":"refusal","refusal_reason":"safety_critical_override"},"expected_render_tag":false,"category":"F","cross_tenant":false,"notes":"Oto may describe per-trip disable but must refuse to instruct permanent ADAS disable"}
```

### Category G — Cross-tenant T1 hits (different owner, enrichment populated, no tag)

```jsonl
{"id":"RAGEVAL-025","query":"What's the brake fluid spec for a 2019 Mercedes-Benz C300?","vehicle_scope":{"year":2019,"make":"Mercedes-Benz","model":"C300","trim_or_engine":"2.0T M264","scope_key":"sk_2019_mb_c300_20t"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"DOT 4 Plus (MB approval 331.0)","fact_table":"vehicle_configs","fact_field":"brake_fluid_type"},"expected_render_tag":false,"category":"G","cross_tenant":true,"notes":"Asking user does not own a C300; enrichment populated by a different tenant"}
{"id":"RAGEVAL-026","query":"What size battery does the 2016 Mazda MX-5 use?","vehicle_scope":{"year":2016,"make":"Mazda","model":"MX-5","trim_or_engine":"2.0L Skyactiv-G","scope_key":"sk_2016_mazda_mx5_20"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"BCI Group 35, 550 CCA","fact_table":"chassis_specs","fact_field":"battery_group_size"},"expected_render_tag":false,"category":"G","cross_tenant":true}
{"id":"RAGEVAL-027","query":"What's the recommended oil viscosity for a 2014 Porsche Cayman S?","vehicle_scope":{"year":2014,"make":"Porsche","model":"Cayman S","trim_or_engine":"3.4L MA1.22","scope_key":"sk_2014_porsche_cayman_s_34"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"0W-40 meeting Porsche A40 approval","fact_table":"engines","fact_field":"oil_viscosity"},"expected_render_tag":false,"category":"G","cross_tenant":true,"notes":"User is asking on behalf of a friend's car"}
{"id":"RAGEVAL-028","query":"What's the transmission fluid capacity for a 2018 Ram 1500 5.7L Hemi?","vehicle_scope":{"year":2018,"make":"Ram","model":"1500","trim_or_engine":"5.7L Hemi 8HP70","scope_key":"sk_2018_ram_1500_57hemi"},"expected_source_tier":"T1","expected_fact_or_disclaim":{"kind":"fact","fact_text":"ZF 8HP70: 9.0 quarts (8.5 L) dry fill, 5.0 qt service fill","fact_table":"transmissions","fact_field":"fluid_capacity_drain_fill_qts"},"expected_render_tag":false,"category":"G","cross_tenant":true}
```

### Category H — Verified web_search hits (source=web_search, status=verified, NO tag)

These are the success-case rows: a web_search answer was persisted, Waleed or Temur reviewed and flipped `verification_status` to `verified`. The row's `source` is still `web_search` but the renderer must NOT show the tag.

```jsonl
{"id":"RAGEVAL-029","query":"What's the published 0-60 of the 2020 Tesla Model 3 Long Range AWD?","vehicle_scope":{"year":2020,"make":"Tesla","model":"Model 3","trim_or_engine":"Long Range AWD","scope_key":"sk_2020_tesla_model3_lr"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"4.2 seconds 0-60 mph per Tesla published spec (revised down from initial 4.4 s after 2020 OTA).","canonical_question_key":"cqk_5cc1...11","expected_row_source":"web_search","expected_row_status":"verified"},"expected_render_tag":false,"category":"H","cross_tenant":false,"notes":"Originally web_searched; Temur verified against Tesla press kit"}
{"id":"RAGEVAL-030","query":"What's the recall status on the 2014 Audi A4 timing chain tensioner?","vehicle_scope":{"year":2013,"make":"Audi","model":"A4","trim_or_engine":"2.0T CAEB","scope_key":"sk_2013_audi_a4_20t"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"NHTSA campaign 13V-159 (2013) covered CAEB tensioner replacement on 2009–2011 A4/A5; 2013 CAEB is outside the campaign scope.","canonical_question_key":"cqk_82bb...4d","expected_row_source":"web_search","expected_row_status":"verified"},"expected_render_tag":false,"category":"H","cross_tenant":false,"notes":"Waleed verified via NHTSA lookup; the row stays source=web_search but status=verified"}
{"id":"RAGEVAL-031","query":"What's the curb weight of a 2019 Civic Type R?","vehicle_scope":{"year":2019,"make":"Honda","model":"Civic","trim_or_engine":"Type R K20C1","scope_key":"sk_2019_honda_civic_typer_k20c1"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"3,117 lb (1,414 kg) curb weight per Honda 2019 Type R press spec.","canonical_question_key":"cqk_6e44...02","expected_row_source":"web_search","expected_row_status":"verified"},"expected_render_tag":false,"category":"H","cross_tenant":false}
{"id":"RAGEVAL-032","query":"What's the EPA combined MPG on the 2018 F-150 3.5L EcoBoost 4x4?","vehicle_scope":{"year":2018,"make":"Ford","model":"F-150","trim_or_engine":"3.5L EcoBoost 4x4","scope_key":"sk_2018_ford_f150_35eb_4x4"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"EPA combined 19 mpg (17 city / 22 highway) for the 2018 F-150 3.5L EcoBoost 4x4 SuperCrew.","canonical_question_key":"cqk_a902...7c","expected_row_source":"web_search","expected_row_status":"verified"},"expected_render_tag":false,"category":"H","cross_tenant":false}
```

### Category I — Unverified web_search hits (source=web_search, status=unverified, TAG required)

These are the default-state rows: persisted from a prior user's web_search but not yet reviewed. The next user who asks the same question hits the row, and the tag must render.

```jsonl
{"id":"RAGEVAL-033","query":"common problems with the 2014 Cruze 1.4 turbo","vehicle_scope":{"year":2014,"make":"Chevrolet","model":"Cruze","trim_or_engine":"1.4L Turbo LUJ","scope_key":"sk_2014_chevy_cruze_14t"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Frequent reports: PCV valve diaphragm failure causing oil consumption, water pump failure, intake manifold cracks, coolant leaks at thermostat housing.","canonical_question_key":"cqk_4d11...77","expected_row_source":"web_search","expected_row_status":"unverified"},"expected_render_tag":true,"category":"I","cross_tenant":false,"notes":"Persisted from a prior user's T3 fall-through; not yet reviewed"}
{"id":"RAGEVAL-034","query":"how long do CVT transmissions last in a 2016 Nissan Altima 2.5","vehicle_scope":{"year":2016,"make":"Nissan","model":"Altima","trim_or_engine":"2.5 SV","scope_key":"sk_2016_nissan_altima_25"},"expected_source_tier":"T2_HASH","expected_fact_or_disclaim":{"kind":"fact","fact_text":"Owner reports cluster around 90,000-130,000 miles before major service; Nissan extended warranty to 120k miles on many 2013-2016 CVTs.","canonical_question_key":"cqk_a3f1...c2","expected_row_source":"web_search","expected_row_status":"unverified"},"expected_render_tag":true,"category":"I","cross_tenant":false}
{"id":"RAGEVAL-035","query":"is BMW 330i 2018 known for oil consumption","vehicle_scope":{"year":2018,"make":"BMW","model":"330i","trim_or_engine":"B46 2.0T","scope_key":"sk_2018_bmw_330i_20t"},"expected_source_tier":"T2_TEXT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"BMW considers up to 1 quart per 750 miles within spec for B46/B48 engines; community reports of higher consumption are common but within manufacturer tolerance.","expected_row_source":"web_search","expected_row_status":"unverified"},"expected_render_tag":true,"category":"I","cross_tenant":false,"notes":"Phrased differently from the canonical; BM25 hit on 'oil consumption' tokens"}
{"id":"RAGEVAL-036","query":"why does my f150 vibrate at highway speeds","vehicle_scope":{"year":2015,"make":"Ford","model":"F-150","trim_or_engine":"3.5L EcoBoost","scope_key":"sk_2015_ford_f150_35eb"},"expected_source_tier":"T2_TEXT","expected_fact_or_disclaim":{"kind":"fact","fact_text":"2015-2017 F-150 driveline vibration at 50-70 mph commonly traces to driveshaft u-joint imbalance or transfer case mount; Ford TSB 17-2238 covers driveshaft replacement.","expected_row_source":"web_search","expected_row_status":"unverified"},"expected_render_tag":true,"category":"I","cross_tenant":false}
```

---

## 9. Rationale (RAG Specialist voice)

### 9.1 Why consolidation simplifies the labeled-set spec

The prior v3 spec had to carry **two** Tier-2 surfaces: one against `vehicle_facts` (the legacy AI-written KB, with embeddings) and one against `vehicle_searched_facts` (the v3 web_search persistence table). Every labeled entry needed to declare *which table* the answer should come from, the disclaim rule needed to inspect *which table* the row was in, and the cascade had to read both tables in some defined order with deduplication. That is two tables × three access strategies = six possible Tier-2 paths, and every label was a six-way assignment problem before we even got to expected fact text.

Consolidation collapses that to one Tier-2 surface and three access strategies. The labeled entry now declares **which strategy** (`T2_HASH` / `T2_STRUCT` / `T2_TEXT`) — that's a three-way assignment over a single table. The disclaim rule reads `(source, verification_status)` off one row. The cascade has one read order with one dedup step. Every code path that used to branch on table-of-origin no longer does.

Equally importantly, the **trust hierarchy** becomes a property of the row, not a property of the table. A `vehicle_facts` row with `source: "manufacturer"` and `verification_status: "verified"` is the highest-trust artifact; a row with `source: "web_search"` and `verification_status: "unverified"` is the lowest. Under the prior v3 split, "trust level" was inferred partly from which table you read from, partly from the row state — and the inference rules were never written down anywhere that survived review. Under consolidation the rules collapse to:

```
tag_rendered  =  (row.source == "web_search") AND (row.verification_status == "unverified")
servable      =  (row.verification_status != "retracted")
```

That's the entire disclaim contract. Two lines. The labeled set tests both of them on every entry.

### 9.2 Why `disclaim_tag_correctness` is essential — and why it has to be its own metric

Precision and recall measure whether retrieval found the right text. They tell you nothing about whether the system communicated the right epistemic posture to the user. A retrieval can be precision@1 = 1.0 (perfect text) and disclaim_tag_correctness = 0.0 (every answer is presented with the wrong confidence) and the user-facing experience is broken. Conversely a retrieval can be precision@3 = 0.5 (mediocre text) and disclaim_tag_correctness = 1.0 (every imperfect answer is correctly tagged) and the user-facing experience is honest — the user knows when to trust what they read.

Two specific failure modes the metric catches:

1. **Under-disclaim** (the regulated-direction failure). A `(web_search, unverified)` row whose tag is suppressed. The user reads a confidence-≤-0.7 web-scraped answer and treats it as authoritative. This is exactly the failure the v3 architecture exists to prevent. If `under_disclaim_rate > 0.02`, the rebuild has not actually delivered the value it was funded for. **This metric is the only one that catches it directly.**
2. **Over-disclaim** (the trust-erosion failure). A `(web_search, verified)` row — one Waleed or Temur has actually vetted — that still shows the tag because the renderer is checking `source == "web_search"` in isolation rather than the `(source, status)` pair. The verification lifecycle exists specifically so verified rows shed the tag; if they don't, the human review effort has no visible payoff and the tag becomes wallpaper. The metric catches this on the symmetric side.

The metric is independent of precision/recall because the failure modes are independent. They can co-occur or fail to co-occur in any combination, and a single composite score would hide which is happening.

### 9.3 Why the baseline measurement must be sequenced before the vectorIndex removal

The current retrieval — `retrieve_vehicle_facts` backed by `lookupFactsSemantic` — depends on `ctx.vectorSearch("vehicle_facts", "by_embedding", …)` existing. The moment `by_embedding` is removed from `convex/schema.ts`, that call throws, and every Tier-2-equivalent read in the current system returns zero results.

If Wave 5.2's baseline measurement runs after that removal:

- Tier-A/G (T1) queries score normally — those hit `vehicleFacts.ts`, which is untouched.
- Tier-B/C/D/H/I queries (anything that would have gone to the embedding path) score zero, because the vector search throws and the fallback structural lookup is partial coverage.
- Tier-E (T3) queries score whatever `web_search` happens to return — which is now triggered for every cascade-miss query whether or not it should have hit Tier 2.
- The aggregate precision@3 lands somewhere around 0.10–0.20, dominated by a broken-vector-search artifact rather than a measurement of the real prior system.

Then the rebuild happens, the new cascade lands, and the rebuild measurement publishes precision@3 around 0.70–0.80. The published improvement is "we went from 0.15 to 0.75 — 60 points of lift!" — and that's a fiction. The real improvement is "we went from 0.35 to 0.75 — 40 points of lift, on a labeled set we built specifically to make this comparison legible." The 60-point story is more impressive but it's not true, and when someone six months later tries to re-run the baseline (perhaps to defend a different architectural choice), they will find an unreproducible number and the whole eval narrative loses credibility.

The fix is sequencing. Measure State 0, publish State 0, then build, then drop the vectorIndex as a separate cleanup step after the State 2 comparison is published. The four-step plan in §6.3 enforces this.

There is a secondary reason: the team's prior across this engagement has been "we don't have measurements; we have feelings about quality." The first real measurement is therefore load-bearing for organizational permission to keep investing in retrieval. A measurement contaminated by a half-migrated state burns that permission. A clean baseline — even one that's uncomfortable — preserves it.

---

## 10. Acceptance criteria for the labeled set (Wave 5.1 proper)

A **complete** Wave 5.1 set satisfies all of:

1. **Volume:** ≥ 240 labeled entries (40 more than the prior v3 target; three new categories at ≥ 15 each).
2. **Category distribution:** each of A–I holds at least 8% of the set; no single category exceeds 18%.
3. **Vehicle diversity:** ≥ 50 distinct `scope_key` values; ≥ 1 entry per top-15 US-market make.
4. **Year coverage:** model years 2008 through 2025.
5. **Powertrain coverage:** ≥ 10 entries each for ICE, hybrid, plug-in hybrid, BEV.
6. **Cross-tenant coverage (Cat G):** ≥ 30 entries from real prior-enrichment seed scopes (not synthetic).
7. **Web_search lifecycle coverage (Cat H/I):** ≥ 20 entries each, drawn from real review-queue dispositions.
8. **Refusal coverage (Cat F):** spans ≥ 6 trust-protocol clauses.
9. **Linguistic diversity:** Cat D and Cat I include ≥ 3 distinct paraphrase patterns per underlying canonical question (this is what makes BM25 vs hash differentiable).
10. **Adjudication:** every entry signed off by 2 reviewers; disagreements logged in `notes`.
11. **Disclaim-tag coverage:** ≥ 30% of entries carry `expected_render_tag: true`; ≥ 50% carry `expected_render_tag: false`; the remainder are Cat F (false by construction). This balance is what makes `disclaim_tag_correctness` statistically discriminating.
12. **Re-test cadence:** set is locked at the start of each wave; mutations require an ADR.

The **Sprint 0 starter set** (this document) satisfies:

- 36 entries, ≥ 4 per category.
- Real scopes, real query phrasings (no placeholders).
- Single-reviewer (RAG Specialist) signoff.
- Disclaim-tag distribution: 14 entries `true` (Cat E + Cat I + arguably some Cat B-failure cases), 22 entries `false` (Cat A + B-success + C + D + F + G + H). Coverage of both directions of the disclaim metric.
- Sufficient to run Wave 5.2's uncomfortable-baseline measurement.

The starter set is statistically thin (±0.08 sampling noise per metric). Its job is to give Wave 5.2 a directional baseline that's actually measurable.

---

## 11. Open questions for Wave 5.1 proper

- **Canonical-hash normalization scope.** Should the normalizer strip make/model/year tokens from the query before hashing, so that "what's the oil capacity?" and "what oil does my Civic take?" against the same scope_key hash identically? The hash already includes scope_key — probably fine — but a test pair is needed to confirm.
- **Retracted-row visibility.** When a row is retracted, is the previous user's conversation message rewritten, or does it remain in history with the (now-invalid) answer? Affects the QA Lead's eval cases more than the retrieval eval, but the retrieval cascade has to know the retract state at read time regardless.
- **BM25 score floor.** Should the `searchIndex("by_text")` path have a confidence floor below which the hit is treated as a non-hit and the cascade falls through to T3 with a disclaim? Probably yes, but the threshold is a Wave 5.3 tunable, not a Wave 5.1 spec item.
- **Cross-tenant Cat G filter.** Do we exclude trims with fewer than N prior enrichments to avoid measuring a single-user artifact as if it were a shared KB? Recommend N=2 minimum for Wave 5.1 proper; the starter ignores.
- **Cat H labeling burden.** A Cat H entry requires the labeler to know which `web_search` rows have actually been verified by Waleed/Temur. This is a real data dependency, not a synthetic label. The starter's 4 Cat H entries are illustrative; Wave 5.1 proper sources them from the review queue's `disposition` log.
- **Refusal copy.** Cat F currently labels a refusal-reason but not the literal refusal text. Wave 5.1 proper should pin the copy so disclaim/refusal correctness is measurable on the refusal side too. (Cat F's `expected_render_tag: false` is correct — refusals are not disclaim-tagged — but the refusal copy itself is the user-facing contract and should be locked.)

---

## 12. Changelog

- **v3-consolidated (this doc):** Re-spec'd against the consolidated `vehicle_facts` table. Tier 2 sub-labels split into `T2_HASH` / `T2_STRUCT` / `T2_TEXT`. Added `expected_render_tag` field, `disclaim_tag_correctness` metric, Cat G/H/I. Added baseline sequencing note (§6) requiring State 0 measurement before vectorIndex removal.
- **v3 (superseded):** Two-table cascade — `vehicle_facts` + `vehicle_searched_facts`. Five categories A–F. Replaced by this document.
- **v2 (deprecated):** Two-pipeline vector store + learned reranker. Removed.
- **v1 (deprecated):** Single-pipeline embedding retrieval. Removed.
