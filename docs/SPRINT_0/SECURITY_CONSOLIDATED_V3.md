# Security Analyst — Consolidated KB Sign-off (v3)
**Date:** 2026-05-16
**Author:** AI Security Analyst (Doc 3 §9 owner)
**Authority:** PM Ruling v3 (`docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md`), Architecture v3 Amendments (`docs/ARCHITECTURE_v3_AMENDMENTS.md`), Waleed's 2026-05-16 consolidation directive.
**Scope:** Confirm that the audit + security disciplines previously specified against the `vehicle_facts` / `vehicle_searched_facts` split survive consolidation onto a single `vehicle_facts` table, and spec the disclaim-tag predicate precisely.

**Hills I hold:** untrusted-input wrapping for the current user message (Wave 7.1) and KB exfiltration rate-limit covering ALL moat tables (Wave 7.3).

---

## 0. The consolidation in one sentence

Waleed has ruled that the prior split (`vehicle_facts` for AI-written facts; `vehicle_searched_facts` for web_search-derived facts; `vehicle_searched_facts_audit` for one audit table) was an artificial line. **They are the same thing — one KB.** The v3 lifecycle fields (`verification_status`, `report_count`, `last_reported_at`, `canonical_question_key`, `verified_at`, `retracted_at`, `asked_by_user_id`, `asked_at`, `written_by`) extend `vehicle_facts` directly. The `embedding` column and `vectorIndex` come out entirely. Two auxiliary tables remain: `vehicle_facts_audit` (append-only edit history) and `fact_reports` (user reports).

This document is the security analyst's confirmation that the audit + security disciplines hold under consolidation, plus the disclaim-tag predicate spec.

---

## 1. Audit-table consolidation review

### 1.1 The three safety properties the prior split was protecting

The previously-spec'd `vehicle_searched_facts_audit` table existed to protect three properties. Confirming each one under consolidation:

#### Property A — Historical reconstruction (replay-equivalence)

**Before:** `vehicle_searched_facts_audit` captured `previous_values` on every edit to `vehicle_searched_facts`. Reverse-applying entries in chronological order reconstructs the row's full history.

**After:** `vehicle_facts_audit` now indexes `fact_id: v.id("vehicle_facts")`. The same `previous_values` snapshot discipline applies. **The property is preserved** — it does not depend on which table the audited rows live in, only on the audit-table's append-only invariant + the atomicity of the mutation that pairs the data-row mutation with the audit-row insert.

**Verdict:** UNCHANGED. Replay-equivalence holds.

#### Property B — Compromised-account defense (append-only audit)

**Before:** The audit table itself was append-only — no `ctx.db.patch`, no `ctx.db.replace`. A compromised admin account could (at most) flip a `verification_status` or rewrite `fact_text`, but the prior-value snapshot would land in the audit log, visible to a reconciliation cron and to forensic replay.

**After:** Same discipline applies to `vehicle_facts_audit`. The append-only invariant migrates with the table. The two enforcement layers remain:

1. **CI grep**: any direct write (`ctx.db.patch` / `ctx.db.replace` / `ctx.db.delete`) on the `vehicle_facts_audit` table from anywhere other than the audit insert path causes a build failure. CI rule: `git grep -nE 'db\.(patch|replace|delete)\(.*vehicle_facts_audit'` MUST be empty.
2. **Mutation-layer enforcement**: the single helper that edits `vehicle_facts` writes the audit row inside the same Convex mutation. Convex serializes mutations, so the pair is atomic.

**Verdict:** UNCHANGED. Append-only discipline holds.

#### Property C — Helper-only mutation enforcement

**Before:** A single helper (`editSearchedFact` in `convex/oto/searchedFacts.ts` per Sprint 1 Day 1) was the only code path that could mutate `vehicle_searched_facts`. CI grep forbade direct `ctx.db.patch("vehicle_searched_facts", …)` anywhere else in the codebase.

**After:** The helper is renamed/refactored to `editVehicleFact` (or kept under the original name with a renamed target). CI grep set extends:

```
# These greps MUST be empty across convex/**:
git grep -nE 'db\.(patch|replace|delete)\(.*vehicle_facts[^_]' \
    -- 'convex/**' ':!convex/oto/factsHelper.ts'

git grep -nE 'db\.(patch|replace|delete)\(.*vehicle_facts_audit' \
    -- 'convex/**' ':!convex/oto/factsHelper.ts'
```

(Path of the helper module is illustrative — locked in MEMORY_SCHEMA_V3 follow-up.)

**Verdict:** UNCHANGED. Helper-only mutation discipline holds and arguably tightens — see §1.2.

### 1.2 What consolidation actually changes — STRONGER, not weaker

Under the prior split, two distinct data tables existed and ONE had an audit table. The implicit assumption was that `vehicle_facts` rows (AI-written / enrichment-sourced) were not mutated by Waleed/Temur in the same way — they were "owned" by the writing pipeline. Under v3 consolidation, that distinction collapses: **all edits to `vehicle_facts`, including edits to enrichment-sourced rows, go through the same admin queue and write to the same audit table.**

Concrete example: a user reports a `source: "manufacturer"` fact as wrong (e.g., the manufacturer-listed brake fluid capacity is incorrect for the specific model year). Waleed corrects it via the admin UI. The mutation:

1. Patches the `vehicle_facts` row (`fact_text` updated, `updated_at` bumped).
2. Inserts a `vehicle_facts_audit` row with `previous_values.fact_text` = the old text, `edited_by` = Waleed's user_id, `action` = `"edit_text"`, `reason` = his review note.

**Before consolidation:** this correction flow either (a) wasn't covered by an audit log at all (because the manufacturer fact lived in `vehicle_facts` which had no audit table), or (b) required dual logic — one path for `vehicle_searched_facts`, one path for corrections to `vehicle_facts`.

**After consolidation:** one path, one audit table, one helper, one CI grep set. Forensic replay against `vehicle_facts_audit` reconstructs the full history of EVERY row in the KB regardless of its original `source`. The compromised-account defense extends to enrichment-sourced rows.

**This is strictly stronger** than the prior design. The audit log is now a complete record of human edits across the whole moat, not just web_search-derived rows.

### 1.3 New invariant under consolidation

```
INVARIANT (mutation-layer + reconciliation cron):

  ∀ row R ∈ vehicle_facts where R.updated_at != R.created_at,
  ∃ row A ∈ vehicle_facts_audit where A.fact_id = R._id.

  Negation = P1 alert: a vehicle_facts row was mutated without
  a corresponding audit entry. This means either:
    (a) The mutation helper was bypassed (CI grep failed), OR
    (b) Audit insert failed silently inside the mutation (Convex
        atomicity violated — should be impossible), OR
    (c) A compromised account directly patched the DB.

  Any of these is a deployment-blocking incident.
```

This invariant did exist under the split, but only for `vehicle_searched_facts`. Under consolidation it expands to cover the entire KB.

---

## 2. The disclaim-tag predicate — fully specified

A chat message renders the "Oto may be incorrect" disclaim tag if AND ONLY IF the backing `vehicle_facts` row satisfies the predicate below. This is the single load-bearing render-time decision.

### 2.1 The predicate (one expression)

```typescript
// Render-time. f is the vehicle_facts row that backed the answer.
const shouldShowDisclaimTag = (f: VehicleFactsRow): boolean =>
  f.source === "web_search" && f.verification_status === "unverified";
```

That is it. Single line. No edge cases at the render layer — the edge cases are handled upstream by the retrieval cascade (a `retracted` row is never served, so the predicate never sees it on the render path).

### 2.2 Truth table — all 5 × 3 = 15 combinations

`source` axis: `manufacturer | oto_inferred | user_confirmed | propagated | web_search` (5 values).
`verification_status` axis: `unverified | verified | retracted` (3 values).

| # | source            | verification_status | Behavior                                                              |
|---|-------------------|---------------------|-----------------------------------------------------------------------|
| 1 | manufacturer      | unverified          | **Unusual state.** Serve, no tag, **log warning** (likely backfill miss). |
| 2 | manufacturer      | verified            | Serve, **no tag**.                                                     |
| 3 | manufacturer      | retracted           | **NOT served.** Row excluded from retrieval; no message renders this fact. |
| 4 | oto_inferred      | unverified          | **Unusual state.** Serve, no tag, **log warning** (likely backfill miss). |
| 5 | oto_inferred      | verified            | Serve, **no tag**.                                                     |
| 6 | oto_inferred      | retracted           | **NOT served.** Row excluded.                                          |
| 7 | user_confirmed    | unverified          | **Unusual state.** Serve, no tag, **log warning** (likely backfill miss). |
| 8 | user_confirmed    | verified            | Serve, **no tag**.                                                     |
| 9 | user_confirmed    | retracted           | **NOT served.** Row excluded.                                          |
| 10 | propagated       | unverified          | **Unusual state.** Serve, no tag, **log warning** (likely backfill miss). |
| 11 | propagated       | verified            | Serve, **no tag**.                                                     |
| 12 | propagated       | retracted           | **NOT served.** Row excluded.                                          |
| 13 | web_search       | unverified          | Serve, **TAG RENDERED** ("Oto may be incorrect").                      |
| 14 | web_search       | verified            | Serve, **no tag** (Waleed/Temur reviewed and confirmed; the row earned trust). |
| 15 | web_search       | retracted           | **NOT served.** Row excluded.                                          |

### 2.3 The 4 "unusual state" rows (#1, #4, #7, #10)

Under the backfill plan for consolidation, every existing non-`web_search` row defaults to `verification_status: "verified"` — enrichment-sourced data has already gone through the enrichment pipeline's quality discipline (evidence URLs, confidence scores), and we are treating that as equivalent to the human-review step for trust-tier purposes. Therefore: **encountering an `unverified` row whose `source != "web_search"` means the backfill missed this row.**

This is not a security exposure (no tag is wrongly shown; no tag is wrongly hidden — we still serve the answer without a tag, treating it as the verified default for its tier). It is a **data-quality** signal: log it, alert the reconciliation cron, but do not block the user's answer.

```typescript
if (f.source !== "web_search" && f.verification_status === "unverified") {
  console.warn("backfill_miss", { fact_id: f._id, source: f.source });
  // emit telemetry; serve answer without tag
}
```

### 2.4 The retracted rows (#3, #6, #9, #12, #15)

A `retracted` row is excluded by the retrieval cascade before it reaches the render layer. The retrieval helper filters `verification_status !== "retracted"` on every Tier-2 read. The render-time predicate **never sees a retracted row**; if it does, that is itself a P1 invariant violation (retrieval leak).

### 2.5 Composability with the cited_url

The cited_url field is independent. Tag presence is purely about `(source, verification_status)`. A `web_search` × `verified` row may still display its cited_url as a "Source" link — that is a UI decision separate from the disclaim tag and out of scope for this predicate.

### 2.6 The 4 disclaim-tag-render-correctness eval cases (Wave 1.4)

For QA Lead's Wave 1.4 eval set:

1. **Case A:** Synthetic `vehicle_facts` row with `source: "web_search", verification_status: "unverified"`. Backing answer must render the tag.
2. **Case B:** Same row flipped to `verification_status: "verified"`. Backing answer must NOT render the tag.
3. **Case C:** Synthetic `vehicle_facts` row with `source: "manufacturer", verification_status: "verified"`. Backing answer must NOT render the tag.
4. **Case D:** Synthetic `vehicle_facts` row with `source: "manufacturer", verification_status: "unverified"` (the backfill-miss state). Backing answer must NOT render the tag AND a `backfill_miss` warning must be emitted to telemetry.

(QA Lead owns case-list authorship — this is the security-side spec they assert against.)

---

## 3. R-3 (KB exfiltration) — re-spec under the consolidated model

### 3.1 The risk in one paragraph

Per Doc 3 §9 / Risk Register R-3: an attacker creates one (or several) accounts, asks the agent to answer thousands of factual questions, and harvests the KB's accumulated data. Single-account abuse is rate-limitable; cross-account scraper-farm behavior is not solved by single-account rate limits. The Wave 7.3 control is the single-account rate limit; cross-account remains the known-open R-3 residual.

### 3.2 The single per-user counter — what it sums

Under v2 (the split), the Wave 7.3 counter summed reads across `vehicle_facts` + `vehicle_searched_facts` + the enrichment-owned structured tables. Under v3 consolidation, **the counter sums reads across the same set of tables, just with `vehicle_searched_facts` collapsed into `vehicle_facts`**. The table set itself is the same — one row collapsed into the other.

### 3.3 The exact moat-table list (counter scope)

Per Convex schema (`convex/schema.ts`), the per-user counter sums reads (queries that touch any of) the following moat tables. Reads from the user's own data (vehicles, bookings, user_settings_preferences, etc.) are NOT counted — those are not the moat.

**Vehicle reference tables (enrichment-owned, public knowledge by vehicle config):**

1. `makes`
2. `models`
3. `generations` (deprecated; retained for read-compat — counter still covers it until removal)
4. `trims`
5. `engines`
6. `transmissions`
7. `chassis_variants`
8. `chassis_specs`
9. `vehicle_configs`
10. `drivetrain_configs`
11. `trim_specs`
12. `oem_parts`
13. `part_fitments`
14. `part_prices`

**Service-knowledge tables (enrichment-owned):**

15. `services`
16. `service_categories`
17. `service_options`
18. `service_vehicle_specs`
19. `service_intervals`
20. `labor_times`

**Tire-knowledge tables (enrichment-owned):**

21. `tire_brands`
22. `tire_size_cache`
23. `tire_models`
24. `tire_pricing`

**Vehicle-derivative caches (year/trim enrichment outputs):**

25. `model_year_cache`
26. `trim_year_cache`

**The consolidated KB:**

27. `vehicle_facts` — the consolidated KB (absorbs the prior `vehicle_searched_facts`).

**Tables explicitly NOT counted** (and the reason each is excluded):

- `vehicle_facts_audit` — admin-only read; not user-facing.
- `fact_reports` — admin-only read (user can only insert their own); not exfiltration vector.
- `vehicles` — owned by the asking user; not the moat.
- `bookings`, `mechanics`, `shops`, `users`, etc. — relational/transactional, not the moat.
- `enrichment_evidence`, `enrichment_runs`, `scrape_cache`, `scrape_jobs`, `vin_queue`, `source_registry`, `blocked_domains` — pipeline internals; not exposed to user queries.
- `oto_telemetry`, `analytics_events`, `client_logs` — telemetry, admin-only.

### 3.4 Counter mechanics

```
PER-USER COUNTER:

  Field: users.moat_reads_24h: v.number()           (denormalized rolling)
  Field: users.moat_reads_window_start: v.number()  (epoch ms)

  Every Convex query that fans out to one of the 27 moat tables
  increments users.moat_reads_24h by the number of rows returned.
  If now() - moat_reads_window_start > 24h, the window resets.

  Decision: if moat_reads_24h > N × baseline_p95, deny further moat
  reads for the remainder of the window. Return a "rate-limited"
  error to the caller. Existing-conversation reads of already-served
  facts are permitted (cached on the message itself); only fresh
  moat-table queries are denied.
```

The counter is a **single number per user** — not 27 numbers. Per-table breakdowns are computed by an aggregation cron from the query-level telemetry, NOT on the hot path. Per-action operation budget impact: one read + one patch on `users` per moat query. Negligible.

### 3.5 Threshold

The numeric threshold (`N × baseline_p95`) is the Sprint 0 follow-up — to be tuned once Wave 5.6 lands and we have legitimate-user read-volume distributions to fit against. **The design is confirmed; the magic number is not.** Conservative starting point: `N = 50` (50× the 95th-percentile legitimate user). Tuning after 7 days of post-Wave-5.6 production data.

### 3.6 What R-3 was; what R-3 is now

| Aspect | Doc 3 §9 statement | v3 statement |
|---|---|---|
| Severity | Irreversible | **Unchanged: Irreversible.** |
| Single-account mitigation | Rate-limit one table (`vehicle_reference_facts`) | **Re-scoped:** single counter across 27 moat tables incl. consolidated `vehicle_facts`. |
| Cross-account mitigation | Honestly unsolved | **Unchanged: honestly unsolved** (see §4). |
| New surface from canonical_question_key | n/a (didn't exist) | **No new surface.** Hash collisions reveal only what the user already asked (R-3 annotation §C.4). |
| New surface from consolidation | n/a (didn't exist) | **No new surface.** Same data, one table, same counter logic. |

---

## 4. Cross-account scraper-farm case — still honestly unsolved

Restating from Doc 3 §9 and the R-3 annotation in Architecture Amendments §C.4:

> Single-account rate-limit ships in Wave 7 as designed. The cross-account scraper-farm case (which I flagged in Doc 3 §9 as honestly unsolved) remains honestly unsolved in v3 — it is not made worse by the v3 architecture, but it is not fixed either. This stays a known open problem on the Risk Register until cross-account behavioral correlation is built.

**What this means concretely.** An adversary who can spin up N fresh user accounts (cheap accounts; email + Clerk auth + a created vehicle to scope queries against) can have each account read up to the per-user threshold before being denied. At N accounts and threshold T, the adversary harvests N × T moat-row-reads per 24h window. There is no design-time mitigation in v3 that prevents this without behavioral-correlation features that **we have not designed and should not claim**:

- We do NOT cluster sessions by behavioral fingerprint.
- We do NOT do device-graph correlation across accounts.
- We do NOT do query-pattern similarity across users.
- We do NOT do IP-based throttling at the Convex layer.
- We do NOT do account-age-gated query budgets.

**Consolidation impact:** zero. Consolidation does not make cross-account harvesting easier (the same data is reachable; the data exists in fewer tables but the bytes are the same) and does not make it harder (no new behavioral signal). The case is exactly as unsolved as it was in Doc 3 §9.

**This is a deliberate scope choice.** Building cross-account correlation is a multi-quarter security program — it requires fingerprinting infrastructure, a similarity index, an alerting/throttling decision layer, and a false-positive-handling appeals process. None of that is in scope for Sprint 0 / Wave 7. The R-3 residual is acknowledged in the Risk Register and remains open.

---

## 5. Untrusted-input scope (Wave 7.1) under consolidation

### 5.1 The Wave 7.1 hill

Wave 7.1 wraps the **current user message** in untrusted-input markers before it reaches the model context. The wrapper renders the user's text inside `<untrusted_user_input>...</untrusted_user_input>` tags with explicit instructions that the model must not treat content inside those tags as instructions. This is the standard prompt-injection mitigation for the user message itself.

### 5.2 The question consolidation raises

Could `vehicle_facts.fact_text` — now persisted via `record_vehicle_fact` from chat_agent following a web_search — be a new prompt-injection surface? An attacker asks an evil question; web_search returns a poisoned snippet; the model's answer (containing or shaped by the poison) is written to `vehicle_facts.fact_text`; a future user's turn retrieves that fact; the poisoned text reaches the next conversation's context. **Is that a new injection surface introduced by KB persistence?**

### 5.3 The answer — NO

**`fact_text` is the model's rendered answer.** It is not the raw web_search payload, and it is not the user's question. The flow:

1. User asks a question. The user's question goes through Wave 7.1 untrusted-input wrapping at the chat_agent boundary.
2. Wave 7.1-wrapped input reaches the model. The model decides to use `web_search` (a tool).
3. `web_search` returns raw web content. This content is itself untrusted, but it does NOT bypass the model — the model reads it, decides what is relevant, and synthesizes the answer.
4. The model's rendered answer is what's written to `vehicle_facts.fact_text` via `record_vehicle_fact`.

The persisted text has already passed through one full model invocation that was instructed (via the system prompt) to treat web content as data, not instructions. The model is the filter.

**For the next user's turn:** the retrieved fact is rendered into context not as "fresh untrusted input" but as a retrieved knowledge-base fact (RAG-style). RAG context is conventionally trusted in this codebase because (a) it is owned by us (we wrote it), and (b) the user-message wrapping is what protects against the current turn's injection vector — RAG content is not a current-turn injection surface.

**Belt-and-suspenders:** if a reviewer wants additional defense in depth, the answer is to extend the tool-result wrapping to also wrap retrieved KB content in `<retrieved_kb_fact>...</retrieved_kb_fact>` markers. This is a Wave 7.1 follow-up, not a Wave 7.1 dependency, and it is conceptually orthogonal to consolidation. Consolidation does not change this story.

### 5.4 The explicit statement (for the future reviewer)

**Web_search persistence is NOT a new prompt-injection surface introduced by consolidation.** `fact_text` is model-rendered text, not user input, not raw web content. Wave 7.1's wrapping of the current user message remains the load-bearing injection mitigation. Consolidation moves no boundaries.

---

## 6. New audit-table-level threat: compromised reviewer editing enrichment-sourced rows

### 6.1 The expansion of the threat model

Under the prior split, enrichment-sourced rows lived in `vehicle_facts` (which had NO audit table; enrichment was the only writer and edits were not part of the design). The `vehicle_searched_facts_audit` table only covered web_search-derived rows.

Under v3 consolidation, the admin queue's "edit fact" affordance now reaches all rows in `vehicle_facts` regardless of `source`. The concrete scenario:

> A user reports a fact backed by a `source: "manufacturer"` row as wrong. Waleed reviews and decides the manufacturer fact IS wrong (e.g., the manufacturer spec was for a different market or year; the enrichment pipeline propagated incorrectly). He edits the row. The edit lands on `vehicle_facts`, the audit row lands on `vehicle_facts_audit`.

This is a workflow we WANT — it lets us correct enrichment errors that users surface. **The threat is that the same affordance, in the hands of a compromised admin account, lets an attacker silently corrupt manufacturer-tier data.**

### 6.2 Is this threat new?

**The mutation capability is new.** Under the prior split, the enrichment pipeline was the only writer to `vehicle_facts`-tier rows — no admin path existed.

**The defense is not new.** It is the same defense the prior split applied to `vehicle_searched_facts`:

1. **Append-only audit table.** Every edit writes a `previous_values` snapshot to `vehicle_facts_audit`. The audit table itself cannot be edited.
2. **Helper-only mutation.** A single helper (`editVehicleFact` or the renamed equivalent) is the only code path that mutates `vehicle_facts`. CI grep enforces this.
3. **`by_editor` index on the audit table.** Per-editor scan lets incident response answer "what did this account do in the last N hours" in O(log N) — critical for limiting blast radius when a compromise is detected.
4. **Admin queue gated to two named users** (Waleed + Temur). No broader internal access.
5. **Reconciliation cron.** Periodically replays `vehicle_facts_audit` against current `vehicle_facts` state; mismatches alert.

### 6.3 The honest statement

**The threat model EXPANDED under consolidation; the audit response EXPANDED in lockstep.** Both are STRONGER than the prior split:

| | Prior split | Consolidated v3 |
|---|---|---|
| Admin can edit web_search-sourced rows | Yes (via `vehicle_searched_facts`) | Yes (via `vehicle_facts` where `source = "web_search"`) |
| Admin can edit manufacturer-sourced rows | **No** (no path designed) | **Yes** (via `vehicle_facts` where `source = "manufacturer"`) |
| Edit is audited | Only for web_search-sourced | **For all sources** |
| Edits are reversible from audit | Only for web_search-sourced | **For all sources** |
| Forensic replay covers | One table (web_search) | **Entire KB** |

The net effect: the system has more places where a compromise can be initiated, AND more places where a compromise can be detected and reversed. The defense ratio is unchanged or improved.

### 6.4 The R-NEW risk in the Risk Register

R-NEW (compromised internal reviewer rewrites history) — already on the Risk Register at Sev=Medium / Lik=Low per Architecture Amendments §C.2 — **expands its scope under consolidation** but does not change its severity, likelihood, or mitigation. The mitigation set in §6.2 above is what was already designed for the audit table; it now covers the consolidated KB rather than a subset of it. **Update the Risk Register entry to reflect the expanded scope** but not the expanded sev/lik (the design defenses scale with the threat).

---

## 7. Rationale — why consolidation strengthens the security posture

This section is the security analyst's voice on why the consolidation directive is a security positive, not a security tradeoff. Three threads:

### 7.1 One audit table for the whole KB

Two audit tables for one logical KB is a footgun. When forensic replay is needed (a compromise is suspected; a row is mysteriously wrong; a user dispute requires reconstruction), the responder has to query two tables and reason about which rows lived where at what time. **Cognitive load on the incident path is itself a security risk** — under pressure, the responder may forget which table covers which rows, or write a join that misses the relevant history.

One audit table, one query, one mental model. The append-only invariant is one rule, enforced in one place. The CI grep is one line, not two. **This is the security-engineering equivalent of "fewer moving parts."**

### 7.2 One mutation helper

Same argument at the mutation layer. The prior design implied two helpers: one for `vehicle_facts` (since enrichment-sourced rows would eventually need admin edits as the system matured), and one for `vehicle_searched_facts`. Each helper would need its own atomic-audit-write logic. Each helper would need its own CI grep guard. Each helper would be a potential drift point where a developer adds a "convenience" patch path that bypasses the audit insert.

Consolidation collapses this to one helper. The audit-write discipline is one code path, exercised on every edit. Test coverage concentrates. Drift surface shrinks.

### 7.3 One CI grep set

Today's CI invariants enforce "no direct write to `vehicle_searched_facts` outside the helper." Adding admin edits to `vehicle_facts` under the prior split would have meant either (a) a second grep rule for `vehicle_facts`, or (b) silently bypassing the audit log for enrichment-row corrections. Both bad. Consolidation makes one grep cover everything.

### 7.4 The embedding removal is also a security positive

The PM ruling removed the embedding column and vector index from KB persistence on cost-and-complexity grounds. From a security posture, this also closes two surfaces:

1. **One less third-party API dependency on the hot path.** Embedding API calls (OpenAI or Voyage) were a runtime dependency on every KB write. A compromise of the embedding API (key leak, vendor breach, malicious-model substitution) would have reached our hot path. With the embedding gone, the third-party surface for KB writes is zero (the only third-party call on the write path is web_search itself, which was already there and is read-only — no key in the egress).

2. **No embedding API key exfiltration vector.** Any service that holds an embedding API key is a target. By eliminating the key from the KB write path, the key never appears in the Convex action's env. One fewer secret to manage, rotate, monitor for leak. The secret store is incrementally smaller.

This is not a primary security argument for the embedding removal — the primary argument is cost — but it is a real positive worth recording.

### 7.5 Why I am signing off

The consolidation:

- Preserves all three audit safety properties (A: historical reconstruction, B: compromised-account defense, C: helper-only mutation).
- Strengthens audit coverage from a subset (web_search rows) to the entire KB.
- Simplifies the CI/mutation-layer enforcement to one code path and one grep set.
- Introduces zero new prompt-injection surfaces (web_search persistence is model-rendered text, not user input).
- Re-scopes R-3's Wave 7.3 counter cleanly to the same 27-table set, just with one row collapsed into another (no logical change).
- Leaves R-3's cross-account residual exactly as unsolved as before (no regression, no improvement, honestly stated).
- Expands R-NEW's scope from one table to one KB, with mitigations that scale with the threat.

**Sign-off:** the audit + security disciplines survive consolidation. The disclaim-tag predicate is the single-line `(source == "web_search") AND (verification_status == "unverified")`. Wave 7.3's R-3 counter sums reads across the 27 moat tables enumerated in §3.3. Wave 7.1's untrusted-input wrapping continues to protect the current user message; KB-persistence is not a new injection surface.

— AI Security Analyst, sign-off (v3 consolidation).

---

## 8. Operational checklist (for the Memory Engineer / CI Owner)

The following items must be true at Wave 5.10 promotion (when `vehicle_facts` write path goes live under v3):

- [ ] `vehicle_facts` schema extended with v3 lifecycle fields (`verification_status`, `report_count`, `last_reported_at`, `canonical_question_key`, `verified_at`, `retracted_at`, `asked_by_user_id`, `asked_at`, `written_by`).
- [ ] `vehicle_facts.embedding` column REMOVED. `vectorIndex` REMOVED. Migration script handles existing rows (drop column).
- [ ] `vehicle_facts_audit` table exists. Append-only. `fact_id: v.id("vehicle_facts")`. Indexes `by_fact`, `by_editor`, `by_time` present.
- [ ] `fact_reports` table exists with `fact_id: v.id("vehicle_facts")`.
- [ ] Single mutation helper exists (path: e.g. `convex/oto/factsHelper.ts`). All paths that mutate `vehicle_facts` flow through it. Helper inserts the paired audit row in the same mutation.
- [ ] CI grep `git grep -nE 'db\.(patch|replace|delete)\(.*vehicle_facts[^_]' -- 'convex/**' ':!<helper-path>'` returns empty.
- [ ] CI grep `git grep -nE 'db\.(patch|replace|delete)\(.*vehicle_facts_audit' -- 'convex/**' ':!<helper-path>'` returns empty.
- [ ] Render-time disclaim predicate is implemented as the single expression in §2.1. Eval cases A–D pass.
- [ ] Reconciliation cron runs at least every 24h: replays `vehicle_facts_audit` against current `vehicle_facts` state; alerts on mismatch.
- [ ] Per-user moat-read counter increments on reads from each of the 27 tables in §3.3. Counter is a single denormalized field on `users`; threshold tuned in Sprint 0 follow-up.
- [ ] Backfill: every existing `vehicle_facts` row receives `verification_status = "verified"` on the migration step (since it predates v3 lifecycle). Rows with `source = "web_search"` may optionally backfill to `"unverified"` if their original write date is recent and trust is unestablished — owner: Memory Engineer judgment.

When all items are green, Wave 5.10 promotes.

---

## 9. Cross-reference index (delta from §E of Architecture Amendments)

| Concept | Architecture Amendments | This doc |
|---------|--------------------------|----------|
| Audit-table consolidation | §C.2 R-NEW | §1, §6 |
| Disclaim-tag predicate | (referenced, not specified) | §2 |
| R-3 27-table list | §C.4 (annotation) | §3.3 (enumerated) |
| Cross-account residual | §C.4 | §4 |
| Wave 7.1 boundary under consolidation | (implicit) | §5 |
| Reviewer-compromise threat under consolidation | §C.2 R-NEW | §6 |
| Security positive of consolidation | (not stated) | §7 |

— End of v3 security sign-off.
