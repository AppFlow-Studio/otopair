# Architecture v3 — Amendments to Decision Log, Migration Plan, Risk Register
**Date:** 2026-05-16
**Authority:** PM Ruling v3 (`docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md`)
**Scope:** Surgical amendments to the three operational documents (Doc 4 Migration Plan, Doc 5 Decision Log, Doc 6 Risk Register). The originals remain as the historical record in the uploads directory; this document is the authoritative current version for the listed entries.

For anything not listed below, the original document stands unchanged.

---

## A. Decision Log amendments

### A.1 Entries with status change

| Entry | Original status | New status | Reason |
|-------|-----------------|------------|--------|
| **D-2.2** (vector-DB tripwire) | LOCKED | **RETIRED** | v3 removes the vector index entirely. There is no vector workload to tripwire. R-8 is retired in lockstep (see §C). |
| **D-2.5** (enrichment-miss UX a/b/c) | OPEN | **MOOTED** | Premise deleted: Oto never triggers enrichment in v3. The a/b/c options no longer apply. The Wave-2.3 in-moment language stays under its new scope (web_search also failed). |
| **D-3.3** (two retrieval pipelines) | LOCKED | **AMENDED** | The "two pipelines, vector + structural" framing is replaced by the three-tier read order in PM Ruling §3. Reference pipeline reads enrichment-owned structured tables directly. User-semantic pipeline drops its embedding dependency (canonical-hash + searchIndex). |
| **D-3.9** (Oto↔enrichment versioned schema contract) | LOCKED | **KILLED** | No contract module on either side. Asymmetry (enrichment writes; Oto reads) is the structural boundary; nothing to type. |

### A.2 New entries (locked by Waleed in the 2026-05-16 session)

#### D-3.10 — `vehicle_reference_facts` as a unified table is rejected; Oto reads enrichment-owned structured tables directly

- **Decision:** Oto's reference-fact reads target the existing enrichment-owned structured tables (`vehicle_config`, `engine_specs`, `tire_specs`, `chassis_specs`, etc.) directly. No unified `vehicle_reference_facts` abstraction is introduced.
- **Alternatives:** (a) Doc 2 §3.7's unified table approach (rejected — would either require editing the enrichment pipeline to dual-write, or porting data from structured tables, both unnecessary). (b) The v1/v2 of this engagement's design (rejected — see PM Ruling v3 history).
- **Why this and not those:** The enrichment pipeline already organizes its output into typed, indexed, structured tables with rich domain schemas. A unification table over them is an abstraction layer with no consumer (Oto can route by topic to the right table at the query layer; no aggregation needed at the storage layer). The unification table would also force a trust-class merge — enrichment-quality and web_search-quality data sharing schema — which v3 explicitly prevents via the separate `vehicle_searched_facts` table.
- **Owner:** Waleed.
- **Status:** LOCKED.
- **Revisit trigger:** A consumer appears that genuinely needs aggregate cross-table reads (e.g., a global vehicle search across all topics). Not expected.

#### D-3.11 — `vehicle_searched_facts` is the persistence target for web-derived facts; in-place mutable with mandatory audit log

- **Decision:** Web_search-derived facts persist to a dedicated `vehicle_searched_facts` table with `verification_status` ∈ {`unverified`, `verified`, `retracted`}. The table is **mutable in place** — edits, status flips, and retractions update the row directly. Every mutation writes an append-only `vehicle_searched_facts_audit` row capturing previous values.
- **Alternatives:** (a) Append-only with soft-retract per D-3.2 (rejected — operational management burden; threat model different from `conversation_facts`). (b) Mutate in place with no audit (rejected — loses the historical-reconstruction property; can't detect a compromised internal account). (c) Auto-promote `unverified → verified` after N days of no reports (rejected by Waleed — accidental poisoning vector).
- **Why this and not those:** `vehicle_searched_facts` has a fundamentally different threat model than `conversation_facts`/`user_semantic_facts`. The latter sit on the per-turn AI write path with potential races; the former is written once via `record_vehicle_fact` (canonical-hash dedupes) and mutated only by deliberate human review through the admin UI. The append-only safety property is preserved on the *audit* table, where it is structurally load-bearing. In-place mutation on the data table avoids `O(N edits)` row explosion per fact.
- **Owner:** Waleed (ruling); Memory Systems Engineer (schema authorship).
- **Status:** LOCKED.
- **Revisit trigger:** If the audit-log mutation-layer enforcement ever fails (i.e., an edit lands on `vehicle_searched_facts` without a corresponding audit row), the discipline is broken and the table must convert to append-only. CI invariant + production telemetry alert required.

#### D-3.12 — KB persistence uses canonical-hash + structural + Convex searchIndex; no embedding model

- **Decision:** Retrieval on `vehicle_searched_facts` uses a three-layer cascade: (1) `canonical_question_key = sha256(normalize(scope) + "::" + normalize(topic) + "::" + normalize(question_template))` exact-match; (2) `(scope, scope_key)` structural index; (3) Convex `searchIndex` (BM25-like) on `fact_text` filtered by scope. No embedding model is called on either the read or write path of any KB table.
- **Alternatives:** (a) OpenAI `text-embedding-3-small` + Convex vector index (the Doc 2 design — rejected for cost and dependency reasons). (b) Local deterministic embedding (BGE-small or sentence-transformer, on-device, no API) — flagged as a future revisit option only if the lexical layer is shown to be the precision bottleneck on Wave 5.1's labeled set.
- **Why this and not those:** Per-write embedding round-trips defeat the cost case for the KB flywheel; the API dependency is a runtime risk on a hot path. At our scale and question shape (high repeat-asks within `(scope, topic)`), canonical-hash exact-match is the dominant case — sub-millisecond, no model, no API. Convex searchIndex covers the fuzzy minority.
- **Owner:** Waleed.
- **Status:** LOCKED.
- **Revisit trigger:** Wave 5.1 labeled-set precision@3 < baseline by > 5% sustained 7 days (= R-8'-NEW firing).

#### D-3.13 — Verification of `vehicle_searched_facts` rows is human-only; no auto-promotion

- **Decision:** A `verification_status: unverified` row transitions to `verified` only by an explicit Waleed/Temur admin-queue action. There is no cron or time-based auto-promotion.
- **Alternatives:** Time-based auto-promotion (e.g., "verified after 30 days with 0 reports") — rejected.
- **Why this and not those:** Time-based promotion is an accidental-poisoning vector. A subtly-wrong fact that never gets reported (because no user notices it's wrong) would be promoted to `verified` and lose its disclaim tag, propagating false confidence. Human-only verification ensures the trust-tier promotion has an actual human agency behind it.
- **Owner:** Waleed.
- **Status:** LOCKED.
- **Revisit trigger:** If the admin-queue throughput is insufficient to handle the report volume, a queue-prioritization scheme may be introduced — but it ranks reports, never auto-resolves them.

### A.3 Corrections table additions

| ID | Document | What it got wrong | Correction | Where recorded |
|----|----------|-------------------|------------|----------------|
| C-11 | Doc 2 §3.7 + Doc 4 Wave 5 | Designed `vehicle_reference_facts` as a unified table fed by enrichment | Killed in v3: Oto reads enrichment-owned structured tables directly | D-3.10, PM Ruling v3 §3 |
| C-12 | Doc 2 §3.7 + Doc 4 Wave 5.4 | Vector index on the reference table | Killed in v3: canonical-hash + structural + searchIndex | D-3.12, PM Ruling v3 §4 |
| C-13 | Doc 4 Wave 5.7–5.9 | Enrichment-queue feed and versioned contract on the seam | Killed in v3: no enrichment trigger from Oto; no contract module | D-3.9 amendment, PM Ruling v3 §1 |

---

## B. Migration Plan amendments

### B.1 Dependency graph — Wave 5 caption updated

Original (`Migration Plan` L48–52):
```
WAVE 5
Retrieval (RAG)
(hybrid, two
 rerankers,
 miss-path,
 enrichment seam)
```

v3:
```
WAVE 5
Retrieval (v3)
(three-tier read:
 enrichment tables →
 vehicle_searched_facts →
 web_search,
 no embedding model)
```

### B.2 Wave 3 step additions

After Wave 3 step 3.1 (create the 5 new memory tables), add:

| Step | What | Reversible? | Note |
|------|------|-------------|------|
| 3.1a | Create `vehicle_searched_facts`, `vehicle_searched_facts_audit`, `fact_reports` tables. Nothing reads or writes them yet. | Fully — they're inert | Schema per PM Ruling v3 §4. Indexes included. |
| 3.1b | Add `written_by` field default to `vehicle_searched_facts`, `conversation_facts`, `user_semantic_facts` | N/A — new field, defaulted | D-3.6 expanded to cover the new table. |

Wave 3 promotion criterion is **unchanged**. The new tables are inert at Wave 3 promotion; their go-live is Wave 5.

### B.3 Wave 5 — full replacement

Delete original Wave 5 steps 5.4–5.9. Replace with v3:

| Step | What | Reversible? | Note |
|------|------|-------------|------|
| 5.1 | **Build the labeled retrieval eval set against the v3 read order.** Each entry: `(query, expected_source_tier, expected_fact_or_disclaim)`. precision@3 against first-tier hit; recall@5 against union. | Gate, not a change | Sprint 0 pre-flight #3. Deliverable: `docs/SPRINT_0/RAG_WAVE_5_1_V3.md`. |
| 5.2 | Measure *current* retrieval (today's `retrieve_vehicle_facts`) against the labeled set | Diagnostic | First quantified baseline of current retrieval performance. |
| 5.3 | `kb_topics` controlled vocabulary table populated; topic FKs added where applicable | Reversible — new path unused | Unchanged from original; structurally still right. |
| 5.4 | Build the v3 retrieval cascade (Tier 1: structured-table router; Tier 2: `vehicle_searched_facts` three-layer; Tier 3: `web_search`). The vector + reranker design from original 5.4 is deleted. | Reversible — built, not live | The cascade lives behind a flag until 5.6. |
| 5.5 | Shadow-run: new cascade runs alongside old retrieval; results diffed against labeled set; **old still serves** | Fully reversible | Prove v3 cascade beats old on precision@3. |
| 5.6 | Flip to v3 cascade; old path runs in shadow | Reversible — flag | |
| ~~5.7~~ | ~~enrichment-queue feed~~ | DELETED | Replaced by Tier 3 `web_search` → `record_vehicle_fact` in 5.4. |
| ~~5.8~~ | ~~Temur a/b/c on enrichment-miss UX~~ | DELETED | D-2.5 mooted. |
| ~~5.9~~ | ~~versioned schema contract on the seam~~ | DELETED | D-3.9 killed. |
| 5.10 | `vehicle_searched_facts` write path goes live: every Tier-3 web_search answer is persisted with `verification_status: unverified`, disclaim tag rendered on the message | Reversible — flag | |
| 5.11 | `fact_reports` write path + admin-queue read path goes live for Waleed + Temur. Audit log writes enforced via the mutation layer. | Reversible — flag | The report → review → edit/retract loop end-to-end. |

**v3 Wave 5 promotion criterion:** v3 cascade beats current retrieval on precision@3 (Tier 1+2) and recall@5 (union of three tiers), measured on the Wave 5.1 labeled set. The report → admin queue → edit/retract loop passes the Wave 1.4 v3 end-to-end eval case. The audit-log mutation-layer invariant (every `vehicle_searched_facts` edit has a corresponding audit row) holds in a 24-hour soak.

### B.4 Wave 7.3 — re-scoped

Original Wave 7.3 (KB exfiltration rate-limit) was scoped to one table (`vehicle_reference_facts`). v3:

| Step | What | Reversible? | Note |
|------|------|-------------|------|
| 7.3 | Per-user read-rate limit covering ALL moat tables: enrichment-owned structured tables (`vehicle_config`, `engine_specs`, `tire_specs`, `chassis_specs`, …) + `vehicle_searched_facts`. Single counter summing reads across the set. Threshold tuned to N× 95th-percentile legitimate use. | New, no prior art | Re-scope. Sec Analyst delivers the table-set list and the counter design. Owner: Waleed. |

### B.5 Wave 2 — promotion criterion extended to four moments

Original Wave 2 ended at three moments (2.1 escalation, 2.2 cost-cap, 2.3 not-yet-known). v3 adds:

| Step | What | Reversible? | Note |
|------|------|-------------|------|
| 2.4 | **The "I checked the web — flag it if it's wrong" moment.** Two paired surfaces: (a) the answer-body language; (b) the "Report Message/Conversation" affordance copy. Both with contrastive right/wrong examples, both eval-gated by Wave 1.4 boundary category at ≥90%. | Per Wave 2 protocol | Sprint 0 pre-flight #5. Deliverable: `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md`. |

**v3 Wave 2 promotion criterion:** all FOUR moments pass boundary-eval ≥90%; 2.1, 2.2, 2.4 fully shipped; 2.3 in-moment language ships. (2.3 no longer has a Wave-5-pending-decision suffix since D-2.5 is mooted.)

---

## C. Risk Register amendments

### C.1 Risks with status change

#### R-8 — RETIRED

Original: "The vector-DB substrate constraint arrives faster than 'years' (Fight 2, made concrete)" with 250K rows / 400ms p95 triggers.

**v3 disposition:** RETIRED. v3 removes the vector index from the architecture. There is no vector workload to constrain; there is nothing to tripwire. R-8 is replaced by **R-8'-NEW** (below).

#### R-12 — CLOSED

Original: "The enrichment-miss UX stays open and gets defaulted by deadline" — D-2.5 a/b/c.

**v3 disposition:** CLOSED by deletion of premise. D-2.5 is mooted (A.1). Oto never triggers enrichment in v3, so there is no enrichment-miss UX to decide. The Wave-2.3 in-moment language is retained for the (rare) case where `web_search` itself fails.

### C.2 New risks

#### R-8'-NEW — Lexical/structural retrieval precision degrades at scale

| | |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Irreversibility** | Reversible (revisit option: local deterministic embedding per D-3.12 revisit trigger) |
| **Owner** | Waleed |

**The risk.** The v3 retrieval cascade is lexical + structural — no semantic embedding. For high-repeat questions canonical-hash dominates and precision is near-perfect; for the long tail (fuzzy phrasings, synonym variants), Convex `searchIndex` (BM25-like) is the bottleneck. As `vehicle_searched_facts` grows and question phrasings diversify, BM25 may underperform what a semantic embedding would have caught, producing more Tier-3 web_search misses than necessary.

**Detection signal.** Wave 5.1 labeled-set precision@3 declines > 5% versus the post-Wave-5.6-flip baseline, sustained over a rolling 7-day window. Secondary: ratio of (Tier-3 web_search hits) / (Tier-2 hits + Tier-3 hits) climbs beyond a baseline threshold.

**Mitigation.** Designed: D-3.12's explicit revisit trigger — a local deterministic embedding (BGE-small or sentence-transformer, on-device, no API) can be introduced as a Tier-2.5 layer. This is flagged, not built; introducing it requires Wave 5.1 evidence that the lexical layer is actually the bottleneck.

#### R-NEW — Compromised internal reviewer rewrites history on `vehicle_searched_facts`

| | |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Irreversibility** | Costly (irreversible if undetected; reversible from audit log if detected) |
| **Owner** | Temur (security posture); Waleed (control) |

**The risk.** v3 lifts the append-only constraint on `vehicle_searched_facts`. Edits are gated to Waleed + Temur, but a compromised admin account could silently rewrite verified facts. The audit log is the defense.

**Detection signal.** Production invariant (enforced in the mutation layer, telemetered at the platform layer): every `vehicle_searched_facts` row whose `updated_at != created_at` has a corresponding `vehicle_searched_facts_audit` row referencing it. Any divergence (row mutated without audit entry) is a P1 alert.

**Mitigation.** Designed: (1) audit log is append-only — cannot be edited to cover a mutation; (2) the only code path that edits a `vehicle_searched_facts` row writes the audit row in the same Convex mutation (atomic per Convex serialization); (3) admin queue access gated to two named users; (4) periodic full-table reconciliation cron compares row-state to audit-log-replay and flags mismatches.

### C.3 Risk summary matrix — v3 deltas

|ID  |Risk                                    |Sev |Lik |Irrev     |The one signal that matters                       |Status |
|----|----------------------------------------|----|----|----------|--------------------------------------------------|-------|
|R-8 |Vector-DB constraint arrives early      |—   |—   |—         |—                                                  |**RETIRED**|
|R-12|Enrichment-miss UX defaulted by deadline|—   |—   |—         |—                                                  |**CLOSED**|
|R-8'|Lexical retrieval precision degrades    |Med |Med |Rev       |precision@3 drop > 5% sustained 7d                |NEW |
|R-N |Compromised reviewer rewrites history   |Med |Low |Costly    |row updated_at != created_at AND no audit row     |NEW |

R-1 through R-7, R-9, R-10, R-11 are **unchanged** from the original Risk Register.

### C.4 R-3 annotation (Security Analyst sign-off, 2026-05-16)

*AI Security Analyst, confirming v3 against R-3.*

R-3 (KB moat exfiltration) retains its `Irreversible` classification under v3. The `canonical_question_key` (sha256 hex index) does not create a new exfiltration surface — a hash collision on an incoming query reveals only what the user already asked, and an attacker probing for hash collisions on the index gains nothing they could not gain by asking the question normally. The hash is a cache key, not a credential.

The Wave 7.3 re-scope (per-user counter summing reads across enrichment-owned structured tables + `vehicle_searched_facts`) is feasible within Convex's per-action operation budget. The counter is a single denormalized field updated inside each read-path mutation; the rate-limit decision is a single index lookup. Per-table breakdowns are computed at the aggregation cron, not on the hot path.

Single-account rate-limit ships in Wave 7 as designed. The cross-account scraper-farm case (which I flagged in Doc 3 §9 as honestly unsolved) remains honestly unsolved in v3 — it is not made worse by the v3 architecture, but it is not fixed either. This stays a known open problem on the Risk Register until cross-account behavioral correlation is built.

— AI Security Analyst, sign-off.

### C.4.1 R-3 farm-case explicit risk acceptance (Waleed, 2026-05-16)

After reviewing the Wave 7.3 design doc (`docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md`) — which estimated that a $500–$2,500 budget on the gray-market account-creation economy defeats the single-account rate-limiter entirely (100 fake accounts ≈ 1.1 days to extract a 1.4M-row moat; 500 accounts ≈ 5 hours) — Waleed explicitly accepted the residual R-3 risk with the following framing:

> "If a user is willing to spend N × $500 on the cost of phones, that's something we can't defeat. This is a security problem for anything; spending millions of dollars to get access to data is possible for any infiltrator."

The acceptance is **conscious**, not implicit, and is the appropriate framing: rate-limiting is not a wall against a determined and resourced adversary; it is a cost-floor that raises the bar against casual scraping. The cross-account behavioral-correlation work remains future scope; the moat's strategic value is sized against that residual risk as deliberate, not an oversight.

— Acceptance recorded.

---

## D. Standing principles — unchanged

P-1 through P-10 stand exactly as recorded in Decision Log §5. v3 introduces no new standing principle and overturns none. The audit-log discipline (§4.2 of PM Ruling v3) is an instance of P-2 (one owner, one lifecycle per state table) and P-8 (reversible before irreversible), not a new principle.

---

## E. Cross-reference index

| Concept | PM Ruling v3 | Amendments doc (this) | Sprint 0 docs |
|---------|--------------|------------------------|----------------|
| Cross-tenant read | §3.2 | A.2 D-3.10 | RAG_WAVE_5_1_V3_CONSOLIDATED |
| Three-tier read order | §3 | B.3 (Wave 5) | RAG_WAVE_5_1_V3_CONSOLIDATED |
| Consolidated `vehicle_facts` schema | §4.1 | A.2 D-3.11, **F (below)** | MEMORY_SCHEMA_V3_CONSOLIDATED |
| Audit-log discipline | §4.2 | A.2 D-3.11, C.2 R-NEW | MEMORY_SCHEMA_V3_CONSOLIDATED |
| `fact_reports` schema | §4.3 | B.3 step 5.11 | MEMORY_SCHEMA_V3_CONSOLIDATED |
| No embedding model | §4 | A.2 D-3.12, **F (below)** | RAG_WAVE_5_1_V3_CONSOLIDATED |
| Human-only verification | §3.1 | A.2 D-3.13 | QA_WAVE_1_4_V3 |
| 4th interaction moment | §6.6 | B.5 (Wave 2.4) | INTERACTION_WAVE_2_4_V3 |
| Re-scoped rate limit | §6.7 | B.4 (Wave 7.3), **F (below)** | SECURITY_CONSOLIDATED_V3 |

---

## F. v3 Consolidation amendment (2026-05-16, same-day correction)

After the original v3 ruling, Waleed reviewed the Sprint 1 Day 1 schema edits and ruled that the `vehicle_searched_facts` table specified in the original v3 (D-3.11) and in MEMORY_SCHEMA_V3 was wrong — it was a parallel of the existing `vehicle_facts` table, whose `source` enum already includes `web_search`. The trust class is the source field; the verification lifecycle is a status field on the same row. Three subagents (Memory Engineer, RAG Specialist, Security Analyst) convened to produce the consolidated spec.

### F.1 Decision-Log effect

| Entry | Status (v3 original) | Status (v3 consolidated) | Effect |
|---|---|---|---|
| **D-3.11** (vehicle_searched_facts as a separate trust-tier table) | LOCKED | **AMENDED** | The intent is preserved (separate trust class for web_search-sourced data; mutable with audit; no auto-promotion). The mechanism changes: trust class is encoded in `vehicle_facts.source`, lifecycle in `vehicle_facts.verification_status`, audit history in `vehicle_facts_audit`. One KB table, not two. |
| **D-3.12** (no embedding model) | LOCKED | **STRENGTHENED** | The embedding column and `vectorIndex` are removed in three Convex deploys (Deploy A: vectorIndex + new writes gone; Deploy B: `stripEmbeddings` backfill; Deploy C: column dropped from schema). The Sprint 1 Day 1 strangler-deferral of the embedding to "Wave 7" was wrong — the removal is the architecture v3 was committed to. |

### F.2 Migration Plan effect

Wave 3.1a is amended: the three tables added are **`vehicle_facts_audit`, `fact_reports`, and the consolidated edits to `vehicle_facts` itself** (nine new fields, four new indexes, `embedding`/`vectorIndex` removed). The parallel `vehicle_searched_facts` is **not added**. The Sprint 1 Day 1 first-pass commit that added the parallel table was reverted same-day; the new schema is in place.

Wave 3.1b stands: `written_by` is now a field on the consolidated `vehicle_facts` (matching D-3.6 expansion).

Wave 7.3 is amended in B.4: the per-user read-rate counter sums reads across the enrichment-owned moat tables + **the single consolidated `vehicle_facts`** (rather than enrichment tables + `vehicle_searched_facts`).

### F.3 Risk Register effect

| Risk | v3 original | v3 consolidated |
|---|---|---|
| **R-NEW** (compromised internal reviewer) | Audit table covers `vehicle_searched_facts` only. | Audit table covers ALL of `vehicle_facts`, including enrichment-sourced rows. Threat surface expanded; detection is also stronger (one audit table, one helper, one CI grep set). See `docs/SPRINT_0/SECURITY_CONSOLIDATED_V3.md` §1 for the analyst's sign-off. |

### F.4 Standing principle effect

P-2 (one owner, one lifecycle per state table) is reinforced. The original v3 split was a minor P-2 violation — two tables with overlapping ownership semantics. Consolidation reunifies the lifecycle on a single owner table with the lifecycle field doing the discriminating work.

### F.5 Disclaim-tag predicate (locked here as architectural truth)

The "Oto may be incorrect" disclaim tag renders at message time **if and only if** the backing `vehicle_facts` row satisfies:

```ts
fact.source === "web_search" && fact.verification_status === "unverified"
```

Two render-time consumers must implement this predicate identically: the message-render component (mobile) and the eval harness (Wave 1.4 v3 categories). Any other rendering of the tag — including on `verified` web_search rows — is a bug. Any failure to render the tag on `unverified` web_search rows is also a bug. The QA Wave 1.4 cases (`disclaim_tag_correctness` metric in `RAG_WAVE_5_1_V3_CONSOLIDATED.md` and the disclaim-tag cases in `QA_WAVE_1_4_V3.md`) test both directions.

### F.6 Verification-status default rule (D-3.13 narrow reading, Waleed's ruling)

When a new `vehicle_facts` row is inserted, `verification_status` defaults by `source`:

| `source` | Default `verification_status` |
|---|---|
| `manufacturer` | `verified` |
| `oto_inferred` | `verified` |
| `user_confirmed` | `verified` |
| `propagated` | `verified` |
| `web_search` | `unverified` |

D-3.13's "no auto-promotion" rule applies to the `unverified → verified` transition only. Enrichment-sourced rows start `verified` because the enrichment pipeline already does adversarial verification per Doc 3 §8; forcing them to start `unverified` would require Waleed/Temur manually verifying every enrichment row, which neither scales nor matches the threat model. The broad reading of D-3.13 (every row starts `unverified`) was raised by the Memory Engineer in `MEMORY_SCHEMA_V3_CONSOLIDATED §B` as Appendix B and explicitly rejected by Waleed.

— End of v3 consolidation amendment.

— End of v3 amendments.
