# PM Ruling — Oto-Enrichment Seam & KB Persistence (v3, consolidated)
**Date:** 2026-05-16
**Author:** Product Team Lead, on behalf of Waleed (Owner) + Temur
**Version:** v3, consolidated 2026-05-16. Supersedes v1 (initial seam-removal + non-vector KB), v2 (cross-tenant read + report loop), and the original v3 (parallel `vehicle_searched_facts` table). The consolidation ruling on the same day collapsed the parallel table — `vehicle_facts` is the single KB. **Wherever this document references `vehicle_searched_facts`, read it as `vehicle_facts`. Authoritative companion: `docs/ARCHITECTURE_v3_AMENDMENTS.md` §F (consolidation amendment).** v3 incorporates corrections from Waleed delivered in the same working session:
  1. Wave 5.9 is fully deleted — no new contract module on either side of the enrichment seam.
  2. Cross-vehicle reads are the rule; any already-enriched vehicle is fair-game. Out-of-domain reads fall through to `web_search` with a disclaim tag.
  3. There is no unified `vehicle_reference_facts` table; Oto reads the existing enrichment-owned structured tables (`vehicle_config`, tire/chassis/engine tables, etc.) directly. Web-derived facts persist into a **separate** `vehicle_searched_facts` table whose entire purpose is the report/edit lifecycle.
  4. `vehicle_searched_facts` is **mutable in place** (status flip / edit / retract) with mandatory audit-log writes capturing previous values. The Memory Engineer's append-only hill (D-3.2) is preserved for `conversation_facts` and `user_semantic_facts` but does not transfer to `vehicle_searched_facts` (different threat model: no concurrent writers, edits are deliberate human review).

**Status:** LOCKED. Sprint 0 entry depends on the four pre-flight items in §8. All other items proceed within Sprint per the amended Migration Plan (see `docs/ARCHITECTURE_v3_AMENDMENTS.md`).

---

## 0. Why this memo exists

Two of the document set's load-bearing assumptions were wrong in ways that compound. The Sprint cannot proceed past Wave 5 (Retrieval) without retiring them, and after working through them with Waleed two further structural simplifications surfaced that retire whole sections of the original north-star.

1. **The "Oto↔enrichment seam"** — the idea that an Oto reference-fact miss should trigger the full $0.30–$0.60 enrichment pipeline — is a cost-multiplier and a pipeline-complicator. Killed. (Issue 1.)
2. **Vector embeddings on the KB** — synchronous OpenAI embedding calls on every KB write, vector index on every read — out of the KB persistence path. (Issue 2.)
3. **The `vehicle_reference_facts` unification** — a single canonical table Oto reads and enrichment writes — was an abstraction layer over data the enrichment pipeline already organizes into structured tables. Killed in v3. (Issue 3.)
4. **Append-only on `vehicle_searched_facts`** — would have made the human-review correction loop operationally unmanageable. v3 keeps append-only on the two original fact tables but lifts it on `vehicle_searched_facts`, with mandatory audit-log writes preserving the safety property. (Issue 4.)

The rationale is recorded below so future engineers can argue against the *reasoning*, not just the conclusion (per Standing Principle P-10).

---

## 1. The exact quotes being overturned

The phrase Waleed referenced ("Making an Oto-Enrichment seam") appears across the document set in five concrete forms. v3 disposition:

| # | File | Line | Quote (verbatim) | Disposition |
|---|------|------|------------------|-------------|
| Q1 | `Decision Log` | 194 | "**D-3.9 — The Oto↔enrichment seam gets a versioned schema contract**" | **KILLED.** No contract module. Asymmetry (enrichment writes; Oto reads) is the boundary's enforcement. |
| Q2 | `Decision Log` | 196 | "The interface between Oto (reads `vehicle_reference_facts`) and the enrichment pipeline (writes it) becomes a versioned schema contract" | **DELETED.** Premise wrong: `vehicle_reference_facts` does not exist as a unified table in v3. Oto reads existing enrichment-owned structured tables (`vehicle_config`, `engine_specs`, `tire_specs`, `chassis_specs`, …). |
| Q3 | `Eleven Subagent Reviews` | 202 | "**Hill I die on:** The Oto↔enrichment seam needs a versioned schema contract …" — Automation Workflow Architect | **OVERRULED with recorded rationale.** Boundary stays on convention; asymmetry makes typed contract redundant. |
| Q4 | `Migration Plan` | 213 | "5.7 \| The reference-fact miss-path: structural miss → vector miss → **enrichment-queue feed + the Wave-2 'not-yet-known' language**" | **KILLED.** Replaced with: structured-table read → `vehicle_searched_facts` read → `web_search` → write to `vehicle_searched_facts`. See §3. |
| Q5 | `Migration Plan` | 214 | "5.8 \| Temur's a/b/c decision on the enrichment-miss UX is wired here" | **MOOTED.** Enrichment is never triggered by Oto. D-2.5 closes by deletion of premise. |
| Q6 | `Migration Plan` | 215 | "5.9 \| Versioned schema contract for the Oto↔enrichment seam" | **DELETED.** No new contract module on either side. |

Locator note: "Making an Oto-Enrichment seam" is a paraphrase of D-3.9 + Migration 5.9 + the Automation Workflow Architect's hill taken together. All three are addressed.

---

## 2. Waleed's rationale, recorded so it survives the next person who tries to re-introduce the seam

A future engineer (or subagent) will look at a reference-fact miss and instinctively want to feed enrichment. This section is the rebuttal, short enough to read in 60 seconds.

**Cost reality.** One enrichment is $0.30–$0.60. The original Wave 5.7 would have made every reference-fact miss a candidate trigger. At the bet-on scale that is an unbounded variable cost layered on top of every chat. Web search, by contrast, is bounded and per-question.

**What we already have.** The enrichment pipeline runs once when a user adds a car. The base-facts set populates the existing structured tables (`vehicle_config`, `engine_specs`, etc.). If a user asks something not in those base tables, the question is one of two classes:

1. A question about a car the user **doesn't own** — but if *another* user's enrichment already populated that car's data, Oto reads it cross-tenant. The KB is multi-tenant by vehicle config, not by asking user.
2. An **extra-curricular** question (canonical example: "what's the 0-60 of my vehicle?") — not in the base enrichment because we don't proactively store trivia. `web_search` handles these, with the disclaim tag.

In neither case is re-running enrichment the right move. Enrichment was designed as a per-vehicle batch, not a per-question synchronous service.

**Quality is consciously traded.** Web_search answers are lower-confidence. We accept the trade because (a) the user gets an answer instead of an unkeepable promise; (b) wrong answers are reportable — Waleed and Temur review and edit/retract; (c) the answer caches in `vehicle_searched_facts` so the same answer serves the next N users.

**KB-persistence flywheel preserved.** What changes is the persistence target (a separate `vehicle_searched_facts` table, not the enrichment-owned tables) and the persistence mechanics (canonical-hash + structural + searchIndex, no embedding model).

---

## 3. The corrected miss-path — what Oto does on a reference-fact ask

```
User asks factual question
    │
    ▼
Stage-1 classifier → reference path
    │
    ▼
Tier 1 — Existing enrichment-owned structured tables
   (vehicle_config, engine_specs, tire_specs, chassis_specs, …)
   Direct topic-routed lookup; no embedding; existing schemas, existing indexes.
   The KB is multi-tenant by vehicle config — any already-enriched vehicle is fair-game.
    │
    ├── HIT ──► answer from enrichment tables (no disclaim tag; enrichment-verified)
    │
    └── MISS
            │
            ▼
        Tier 2 — vehicle_searched_facts (NEW table; see §4)
          a) canonical_question_key exact-match  (O(1) on repeat asks)
          b) (scope, scope_key) structural match
          c) searchIndex by_text (Convex BM25-like)
            │
            ├── HIT (verification_status != retracted)
            │       ├── verification_status = "verified" ──► answer, no disclaim tag
            │       └── verification_status = "unverified" ──► answer + "Oto may be
            │                                                  incorrect" disclaim tag
            │
            └── MISS
                    │
                    ▼
                Tier 3 — web_search (existing tool)
                    │
                    ├── Returns an answer ──► answer with disclaim tag
                    │                          + write new row to
                    │                            vehicle_searched_facts
                    │                            (verification_status: unverified,
                    │                             source: web_search, confidence ≤ 0.7)
                    │
                    └── No usable answer ──► Wave-2.3 language
                                              ("I checked and couldn't get
                                               verified specs for that")
```

Properties recorded so they survive review:

- **No enrichment triggered by Oto.** Ever.
- **Cross-tenant by design.** Tier 1 reads any vehicle-config row enrichment has populated. Restricting to the asking user's car would forfeit the moat's leverage.
- **Three trust tiers, ordered by confidence.** Enrichment > verified-searched > unverified-searched > web_search-now. The disclaim tag fires exactly when the source is unverified-searched or fresh-web.
- **The flywheel compounds across users.** `record_vehicle_fact` writes the web_search answer to `vehicle_searched_facts` scoped along the right axis. The next user asking the same question hits Tier 2.

### 3.1 The Report-Message-Conversation loop

Backstops the trust trade. Launch-scope.

```
User taps "Report Message/Conversation" on a tagged message
    │
    ▼
A report row lands in fact_reports:
    { conversation_id, message_id, fact_id (vehicle_searched_facts row),
      user_id, reported_at, optional user_note, disposition: "open" }
    │
    ▼
report_count on the underlying vehicle_searched_facts row is incremented;
last_reported_at is updated.
    │
    ▼
The report appears in an admin review queue visible to Waleed + Temur only.
    │
    ▼
Reviewer opens the conversation, sees the message in context, decides:
    │
    ├── Fact wrong ──► EDIT in place (fact_text + confidence updated)
    │                  OR set verification_status = "retracted"
    │                  → audit log entry written (previous_values snapshot)
    │                  → fact_reports row closed (disposition: "edited"
    │                                              or "retracted")
    │
    ├── Fact right; answer misused it ──► flag conversation for prompt/eval review
    │                                      → fact_reports row closed
    │                                        (disposition: "answer_quality")
    │
    └── Spurious report ──► close with disposition: "no_action"
```

Properties:

- **Two reviewers only.** Waleed + Temur. No broader internal access.
- **The conversation is visible to the reviewer**, not just the fact. The two failure modes (fact-wrong vs answer-misuses-fact) route differently.
- **No auto-promotion to verified.** Per Waleed's ruling — accidental poisoning vector closed. A row stays `unverified` forever unless a human reviewer explicitly flips it.
- **Edits are in-place; the audit log preserves history.** See §4 below.

### 3.2 Why cross-tenant read is the right rule

The data isn't the asking-user's; it's the vehicle's. Once enrichment paid $0.30–$0.60 for a vehicle config, the marginal cost of serving that fact to a different user is the cost of the read — which is what KB-as-moat means. Per-user-scope checks on the data itself would forfeit the moat. Exfiltration risk (R-3) is handled by Wave 7.3's per-user *read-rate* limit, which now covers the full set of moat tables (see §5).

---

## 4. KB persistence: the new table + schema (no embedding model)

### 4.1 `vehicle_searched_facts` — the web-search persistence table

```typescript
vehicle_searched_facts: defineTable({
  // Scope — same axes the enrichment tables use, composes cleanly
  scope: v.union(
    v.literal("vehicle_config"),
    v.literal("trim"),
    v.literal("chassis"),
    v.literal("engine"),
    v.literal("model_year"),
  ),
  scope_key: v.string(),

  // The fact itself
  topic: v.string(),
  canonical_question_key: v.string(),      // sha256(normalized question)
  fact_text: v.string(),

  // Provenance
  source: v.literal("web_search"),
  source_url: v.optional(v.string()),
  written_by: v.union(                      // Doc 3 §3 — Multi-Agent insurance
    v.literal("chat_agent"),
    v.literal("health_monitor"),
    v.literal("admin_edit"),
    v.literal("system"),
  ),
  asked_by_user_id: v.id("users"),
  asked_at: v.number(),
  confidence: v.number(),                   // ≤ 0.7 on initial write

  // Lifecycle — per Waleed's ruling: no auto-promotion
  verification_status: v.union(
    v.literal("unverified"),                // default on write
    v.literal("verified"),                  // Waleed/Temur manual review only
    v.literal("retracted"),                 // Waleed/Temur manual review only
  ),
  verified_at: v.optional(v.number()),
  retracted_at: v.optional(v.number()),

  // Reporting signal (denormalized for review-queue ordering)
  report_count: v.number(),                 // default 0
  last_reported_at: v.optional(v.number()),

  // Timestamps
  created_at: v.number(),
  updated_at: v.number(),                   // bumped on every mutation
})
.index("by_canonical_question", ["canonical_question_key"])
.index("by_scope", ["scope", "scope_key"])
.searchIndex("by_text", { searchField: "fact_text", filterFields: ["scope", "scope_key"] })
.index("by_verification_status", ["verification_status", "created_at"])
.index("by_report_count", ["report_count"]);    // review queue ordering
```

**No embedding column. No vector index.** Read path is canonical-hash → structural → searchIndex.

**Mutable in place.** Per Waleed's v3 ruling. Edits, status flips, and retractions update the row directly. D-3.2 (append-only) is preserved for `conversation_facts` and `user_semantic_facts` only.

### 4.2 `vehicle_searched_facts_audit` — the safety property D-3.2 was actually protecting

```typescript
vehicle_searched_facts_audit: defineTable({
  fact_id: v.id("vehicle_searched_facts"),
  edited_by: v.id("users"),                 // Waleed or Temur
  edited_at: v.number(),
  action: v.union(
    v.literal("verify"),                    // unverified → verified
    v.literal("retract"),                   // any → retracted
    v.literal("edit_text"),                 // fact_text changed
    v.literal("edit_meta"),                 // confidence / source_url / scope etc.
  ),
  previous_values: v.any(),                 // snapshot of fields that changed
  reason: v.optional(v.string()),           // free-text reviewer note
})
.index("by_fact", ["fact_id", "edited_at"])
.index("by_editor", ["edited_by", "edited_at"]);
```

Three properties recorded so they don't decay:

1. **This table IS append-only.** No mutation. No retraction. The audit log is the load-bearing artifact; if it becomes mutable, the whole defense collapses. D-3.2's discipline relocates here.
2. **`previous_values` mandatory on every edit.** Enforced in the mutation layer — the only code path that edits a `vehicle_searched_facts` row writes the audit row in the same Convex mutation (Convex serializes; atomicity guaranteed).
3. **Initial row creation skips the audit table.** Per Waleed's optimization. The creating row IS the creation record. Audit table size is `O(edits)`, not `O(facts)`.

### 4.3 `fact_reports` — the user-submitted reports table

```typescript
fact_reports: defineTable({
  fact_id: v.id("vehicle_searched_facts"),
  conversation_id: v.id("ai_conversations"),
  message_id: v.id("ai_messages"),
  reported_by: v.id("users"),
  reported_at: v.number(),
  user_note: v.optional(v.string()),
  disposition: v.union(
    v.literal("open"),                      // default
    v.literal("edited"),                    // reviewer edited the fact
    v.literal("retracted"),                 // reviewer retracted the fact
    v.literal("answer_quality"),            // fact ok, answer used it badly
    v.literal("no_action"),                 // spurious
  ),
  resolved_by: v.optional(v.id("users")),
  resolved_at: v.optional(v.number()),
  resolution_note: v.optional(v.string()),
})
.index("by_fact", ["fact_id", "reported_at"])
.index("by_disposition", ["disposition", "reported_at"])
.index("by_reporter", ["reported_by", "reported_at"]);
```

### 4.4 What is NOT created in v3

- **`vehicle_reference_facts`** — DELETED from the architecture. Oto reads existing structured tables directly.
- **`convex/enrichment/contract.ts`** — NOT CREATED. No new module between Oto and enrichment.
- **`embedding` / `embedding_model_version`** columns — NOT ADDED to any table.
- **Vector indexes** — NOT CREATED.
- **Auto-verify cron** — NOT CREATED. Verification is human-only.

---

## 5. Risks updated

| Risk | v3 Status |
|------|-----------|
| **R-3** (KB exfiltration) | Unchanged severity. Wave 7.3 rate-limit re-scoped to cover all moat tables (enrichment-owned structured tables + `vehicle_searched_facts`). |
| **R-7** (retrieval confidently wrong) | Mitigation strengthened. Three trust tiers visible at the message level via disclaim tag. |
| **R-8** (vector-DB tripwire) | **RETIRED.** No vector index. |
| **R-8'-NEW** (lexical/structural retrieval precision degrades) | Sev: Medium. Detection: precision@3 on the labeled retrieval eval set (Wave 5.1) drops > 5% sustained 7 days. Owner: Waleed. |
| **R-12** (D-2.5 defaulted by deadline) | **CLOSED by deletion of premise.** No enrichment-miss path exists. |
| **R-NEW** (compromised internal reviewer rewrites history) | Sev: Medium. Detection: audit log diverges from row state, or a `verification_status: verified` row has no audit-log entry referencing it. Mitigation: audit log is append-only; admin queue gated to Waleed + Temur only; production telemetry alerts on audit-log gaps. |

See `docs/ARCHITECTURE_v3_AMENDMENTS.md` for the full Risk Register update.

---

## 6. Subagent directives (v3)

The eleven Doc 3 subagents are the discipline-owners. Below: each owner with v3 work. Owners not listed continue per the original migration plan unchanged.

### 6.1 Automation Workflow Architect

**Original hill (Doc 3 §8):** typed Oto↔enrichment seam.
**Disposition:** Overruled by Waleed's v3 correction. Boundary stays on convention.
**Directive:**
1. Do NOT build `convex/enrichment/contract.ts`.
2. Add a one-paragraph comment to whatever Oto-side module reads the enrichment tables: *"These tables are owned by `convex/vehicleEnrichment/`. Oto is a reader. Do not write. New web-derived facts go to `vehicle_searched_facts`."*
3. Grep `convex/oto/**` for `enrichmentQueue|requestEnrichment|enrichmentMissPath` → expect zero hits.

### 6.2 RAG Optimization Specialist — Sprint 0 pre-flight #3

**Original hill (Doc 3 §4):** labeled retrieval eval set before tuning anything.
**Directive:**
1. Re-scope Wave 5.1 against the v3 retrieval flow (Tier 1 → Tier 2 → Tier 3 per §3).
2. Author the labeled set: each entry is `(query, expected_source_tier, expected_fact_or_disclaim)`.
3. Precision@3 measured against the *first tier that returns a hit*; recall@5 measured against the union.
4. Deliverable: `docs/SPRINT_0/RAG_WAVE_5_1_V3.md` — labeled-set spec, harness pseudocode, success criteria.

### 6.3 Memory Systems Engineer — Sprint 0 pre-flight #1 + #2

**Original hill (Doc 3 §5):** five tables; D-3.2 append-only.
**Disposition:** D-3.2 stands for the two original tables. v3 lifts append-only on `vehicle_searched_facts` with the audit-log structural counter (§4.2).
**Directive:**
1. Author the Convex schema definitions in §4.1, §4.2, §4.3 — production-grade, indexes included, default values stamped.
2. Include `written_by` on `vehicle_searched_facts` (pre-flight #2).
3. Author the migration script: idempotent, dual-read-safe per Wave 3 strangler pattern, no destructive ops.
4. Deliverable: `docs/SPRINT_0/MEMORY_SCHEMA_V3.md` — schema files + migration outline + audit-log enforcement rationale.

### 6.4 AI Infrastructure Architect

**Original hill (Doc 3 §2):** batched read path for working memory.
**Disposition:** v3 reduces per-turn op count vs. v2. Clean.
**Directive:**
1. Confirm in a 1-paragraph note that v3's three-tier read order does not regress per-turn op count. Attach to `docs/SUBSTRATE_NOTES.md`.
2. Retire the D-2.2 numeric trigger (250K/400ms). Replace with R-8'-NEW signal.

### 6.5 AI QA & Evaluation Lead — Sprint 0 pre-flight #4

**Original hill (Doc 3 §6):** boundary-adherence eval category.
**Directive:**
1. Wave 1.4 boundary cases unchanged.
2. Add v3 eval categories: (a) three-tier read order (each tier hits as expected), (b) disclaim-tag-render correctness, (c) report-flow end-to-end (user reports → row arrives in queue), (d) cross-tenant read (user A asks about user B's already-enriched car → answer served from Tier 1).
3. Deliverable: `docs/SPRINT_0/QA_WAVE_1_4_V3.md` — case list, expected behavior, judge assertions, pass thresholds.

### 6.6 Human-AI Interaction Strategist — Sprint 0 pre-flight #5

**Original hill (Doc 3 §11):** prompt-caliber language on three interaction moments.
**Directive:**
1. Wave 2 promotion criterion extended to four moments — escalation handoff (2.1), cost-cap (2.2), not-yet-known (2.3), **and** the new web_search disclaim moment (2.4).
2. 2.4 has two surfaces: the answer-body language ("I checked the web and found this — flag it if it's wrong") AND the affordance copy ("Report Message/Conversation"). Both need contrastive examples.
3. Deliverable: `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md` — designed-language spec with right/wrong examples for both surfaces.

### 6.7 AI Security Analyst

**Directive:**
1. Re-scope Wave 7.3 to cover all moat tables (enrichment-owned structured tables + `vehicle_searched_facts`). Single per-user counter summing reads across the set.
2. Confirm `canonical_question_key` index does not create a new exfiltration surface (hash collisions reveal only what the user already asked). Annotate R-3.

### 6.8 Multi-Agent Systems Engineer, Principal Prompt Engineer, Context Engineering Specialist, LLM Reliability Engineer

**No v3 changes from original migration directives.** Confirm-and-pass.

---

## 7. Sprint-blocker checklist

The Sprint proceeds when every item below is checked.

- [ ] **§6.1** — `convex/enrichment/contract.ts` does NOT exist. Grep for `enrichmentQueue|requestEnrichment|enrichmentMissPath` in `convex/oto/**` returns empty. Ownership comment added.
- [ ] **§6.2** — `docs/SPRINT_0/RAG_WAVE_5_1_V3.md` written and reviewed.
- [ ] **§6.3** — `docs/SPRINT_0/MEMORY_SCHEMA_V3.md` written; schema compiles in `convex/schema.ts` (or is staged for the next Convex deploy); migration script outlined.
- [ ] **§6.4** — Substrate confirmation paragraph added; D-2.2 retired in the Decision Log amendments doc.
- [ ] **§6.5** — `docs/SPRINT_0/QA_WAVE_1_4_V3.md` written.
- [ ] **§6.6** — `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md` written; Wave 2 criterion explicitly four moments.
- [ ] **§6.7** — R-3 annotation written; Wave 7.3 re-scoping noted in `docs/ARCHITECTURE_v3_AMENDMENTS.md`.
- [ ] **§6.8** — Four subagents pass (silent OK is sufficient).

---

## 8. Pre-flight items that gate Sprint 0 Day 1

Five items, none requiring more than a day of work:

1. **Memory Engineer** authors the three Convex tables (§4.1–§4.3) + migration outline.
2. **Memory Engineer** adds `written_by` on `vehicle_searched_facts`.
3. **RAG Specialist** re-scopes Wave 5.1 labeled set against v3 flow.
4. **QA Lead** authors v3 eval cases for Wave 1.4.
5. **Interaction Strategist** designs the 4th interaction moment.

All five are dispatched to subagents in parallel via the convening call following this memo.

---

## 9. The single most important sentence in this memo

**Oto reads enrichment-owned structured tables directly. On a miss it reads `vehicle_searched_facts`. On a miss there it web_searches, answers with an "Oto may be incorrect" disclaim tag, persists the result to `vehicle_searched_facts` (mutable, no embedding). Users report wrong answers; Waleed or Temur reviews the conversation and edits, retracts, or verifies the row in place; every edit writes an append-only audit row capturing previous values. KB persistence stays. The embedding model goes. The unified KB table goes. The enrichment contract module never existed.**

— PM Ruling, locked (v3).
