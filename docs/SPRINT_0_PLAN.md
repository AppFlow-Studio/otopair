# Sprint 0 Plan — Entry Criteria & Pre-Flight Items
**Date:** 2026-05-16
**Authority:** PM Ruling v3 (§7 checklist) + Architecture v3 Amendments
**Purpose:** The five concrete deliverables that must exist before Sprint 0 Day 1. Each has an owner (one of the eleven subagents), a deliverable file path, and an acceptance bar. The Sprint cannot start without all five.

---

## 0. Why pre-flight gates Sprint start

The v3 ruling answered the architectural questions. It did not produce the artifacts the team needs to *execute*. Five artifacts are needed before any commit lands against the new schema or read path:

1. The Convex schema definitions for the three new tables — Memory Engineer.
2. A re-scoped Wave 5.1 labeled retrieval eval set — RAG Specialist.
3. v3 eval cases for Wave 1.4 — QA Lead.
4. Designed language for the new 4th interaction moment — Interaction Strategist.
5. A confirmation paragraph on substrate (no per-turn-op regression) + R-3 annotation — Infrastructure Architect + Security Analyst.

Items 1–4 are dispatched to subagents in parallel via the convening call following this plan. Item 5 is a confirm-and-pass for two subagents.

---

## 1. Pre-flight #1 — Memory Schema (Memory Systems Engineer)

**Mandate (Doc 3 §5):** The memory architecture. The keystone of Doc 2.

**Deliverable file:** `docs/SPRINT_0/MEMORY_SCHEMA_V3.md`

**Scope:**
- Convex schema definitions for `vehicle_searched_facts`, `vehicle_searched_facts_audit`, `fact_reports` (production-grade, indexes included, defaults stamped). Schemas should be ready to paste into `convex/schema.ts`.
- Migration outline (idempotent, dual-read-safe, no destructive ops).
- Add `written_by` field to `vehicle_searched_facts` per D-3.6 expansion.
- Mutation-layer enforcement note: every edit to `vehicle_searched_facts` writes a `vehicle_searched_facts_audit` row in the same Convex mutation. Atomic per Convex serialization.

**Acceptance:**
- Schemas compile under Convex 1.x conventions (uses `v.union`, `v.literal`, `defineTable`, `.index`, `.searchIndex`).
- Migration script handles: empty table (greenfield), existing `vehicle_facts` table from current system (data migration path noted, not necessarily executed in Sprint 0).
- The audit-log enforcement is documented as a code-level invariant, with a CI lint or runtime assertion specified.

---

## 2. Pre-flight #2 — RAG Wave 5.1 Re-Scope (RAG Optimization Specialist)

**Mandate (Doc 3 §4):** Retrieval. Chunking, embedding, hybrid search, reranking, retrieval evaluation.

**Deliverable file:** `docs/SPRINT_0/RAG_WAVE_5_1_V3.md`

**Scope:**
- Labeled retrieval eval set spec for the v3 three-tier read order (Tier 1: enrichment-owned structured tables; Tier 2: `vehicle_searched_facts`; Tier 3: `web_search`).
- Each entry: `(query, vehicle_scope, expected_source_tier, expected_fact_or_disclaim)`.
- 30+ labeled entries minimum, distributed across:
  - Tier 1 hits (in-base-enrichment questions)
  - Tier 2 hits (previously web-searched, now in `vehicle_searched_facts`)
  - Tier 3 hits (fresh web_search needed)
  - Cross-tenant cases (user A asking about user B's already-enriched vehicle)
  - Disclaim-tag-required cases (`unverified` status)
  - Boundary cases (out-of-scope refusals)
- Harness pseudocode: how each labeled query routes through the cascade and which metric it contributes to.
- precision@3 measured against the first tier that returns a hit. recall@5 measured against the union.
- The "uncomfortable baseline number" framing from Doc 3 §4 / Doc 4 Wave 5.2 stands — Wave 5.2 measures current retrieval against this set first.

**Acceptance:**
- Labeled set has the cross-tenant case explicitly covered (regression risk: dropping cross-tenant accidentally collapses the moat's leverage).
- Spec defines what "precision@3" means under the multi-tier cascade unambiguously.
- The Sprint 0 deliverable is the spec + ≥30 labels. Generating the full labeled set is Wave 5.1 itself.

---

## 3. Pre-flight #3 — QA Wave 1.4 v3 Eval Cases (AI QA & Evaluation Lead)

**Mandate (Doc 3 §6):** The eval platform as an engineering artifact.

**Deliverable file:** `docs/SPRINT_0/QA_WAVE_1_4_V3.md`

**Scope:**
- Boundary-adherence eval category cases (the original Wave 1.4 charter) — unchanged.
- v3 additions:
  - **Three-tier read order correctness.** A case set where each query is expected to land at a specific tier; assertion verifies the actual tier matches.
  - **Disclaim-tag render correctness.** A case where Tier 2 returns `verification_status: unverified` or Tier 3 returns fresh web_search; assertion: the message renders the "Oto may be incorrect" tag.
  - **Report-flow end-to-end.** A simulated user reports a message; assertion: a `fact_reports` row exists with the right `fact_id` and `disposition: open`; `report_count` on the underlying row is incremented.
  - **Cross-tenant read.** User A queries about a vehicle config they don't own but enrichment has populated; assertion: the answer comes from Tier 1 with no disclaim tag.
  - **Audit-log invariant.** A simulated admin edit writes an audit row; the row contains `previous_values` for the changed fields.
- Each case has a judge assertion (binary verdict + rationale, separate eval account per Doc 4 Wave 1.2).
- Each case has a pass threshold (≥90% for boundary, ≥95% for tier-routing — tier routing is deterministic and should be near-perfect).
- N≥10 repeats per case (per Wave 1.1 statistical regression detection).

**Acceptance:**
- All five v3 case categories have ≥3 concrete cases each.
- The audit-log invariant is also exposed as a continuous production check, not just an eval case.

---

## 4. Pre-flight #4 — Interaction Moment 2.4 (Human-AI Interaction Strategist)

**Mandate (Doc 3 §11):** When AI defers, when it acts, the trust protocol as an interaction pattern.

**Deliverable file:** `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md`

**Scope:**
- The fourth interaction moment: "I checked the web and found this — flag it if it's wrong."
- Two paired surfaces:
  - **Answer-body language.** What Oto actually says when delivering a web_search-sourced or `unverified`-tier answer. Designed language, not a generic string. Contrastive right/wrong examples (the same caliber as the prompt's existing banned-phrasings).
  - **Affordance copy.** The text on the report button ("Report Message/Conversation" per Waleed's spec), plus any confirmation modal copy, plus the post-report acknowledgment language.
- Trust-first framing throughout — never "the AI made up an answer," always "Oto checked the web and isn't fully confident; help us verify."
- The disclaim tag itself is a render flag on the message bubble (not a sentence in the answer body) — confirm in the spec that the language surface doesn't repeat what the tag conveys.

**Acceptance:**
- Right/wrong examples for both surfaces.
- A judge assertion for Wave 1.4 boundary eval: "did Oto frame the web-source language without scarcity/penalty/dishonesty?"
- Pass threshold ≥90% per Wave 1.4 convention.
- The post-report acknowledgment language explicitly does NOT promise a specific timeline (Waleed and Temur review at their pace; promising "within 24 hours" creates a keepable-promise problem we don't need).

---

## 5. Pre-flight #5 — Substrate Confirmation + Security Annotation

### 5a. AI Infrastructure Architect

**Deliverable file:** Append a paragraph to `docs/SUBSTRATE_NOTES.md` (create if missing).

**Scope:** Confirm that the v3 three-tier read order does not regress per-turn op count versus the v2 single-table-vector design. Note the retirement of D-2.2's numeric trigger; replace with R-8'-NEW signal.

**Acceptance:** One paragraph, signed off.

### 5b. AI Security Analyst

**Deliverable file:** Append an annotation to R-3 in `docs/ARCHITECTURE_v3_AMENDMENTS.md` §C (already drafted; needs the analyst's explicit sign-off).

**Scope:** Confirm `canonical_question_key` (sha256 hash index) does not create a new exfiltration surface. Confirm the Wave 7.3 re-scoping (per-user counter across enrichment-owned tables + `vehicle_searched_facts`) is feasible at Convex's per-action operation budget.

**Acceptance:** Annotation written; R-3 retains its `Irreversible` classification (this doesn't change with v3).

---

## 6. Items NOT in Sprint 0 (deferred to within-Sprint waves)

For clarity, the following are explicitly NOT pre-flight items — they ship inside the Sprint per the amended Migration Plan:

- Removal of any embedding-related code from current production. That happens in Wave 5 step 5.6 (the flip), not Sprint 0.
- Wave 7.3 actual implementation (rate-limit). Sec Analyst delivers the design; implementation is Wave 7.
- Audit-log reconciliation cron. Designed in Sprint 0 (`MEMORY_SCHEMA_V3`), implemented when `vehicle_searched_facts` goes live (Wave 5 step 5.11).
- Deletion of `vehicle_facts` (current AI-written KB table). It dual-reads with `vehicle_searched_facts` for one Wave cycle, then deletes in Wave 7.

---

## 7. Sprint 0 Day 1 entry criteria — single checklist

```
[ ] PM_RULING v3 reviewed by Temur, signed
[ ] ARCHITECTURE_v3_AMENDMENTS reviewed by Temur, signed
[ ] MEMORY_SCHEMA_V3 written, schemas reviewed, migration outlined
[ ] RAG_WAVE_5_1_V3 written, ≥30 labels drafted, harness defined
[ ] QA_WAVE_1_4_V3 written, ≥3 cases per category
[ ] INTERACTION_WAVE_2_4_V3 written, right/wrong examples for both surfaces
[ ] SUBSTRATE_NOTES paragraph written
[ ] R-3 annotated by Sec Analyst
```

Eight items. Items 1–2 are Waleed/Temur sign-off. Items 3–8 are subagent deliverables. The convening call following this plan dispatches 3–6 in parallel; 7–8 are confirm-and-pass.

---

## 8. The single most important sentence in this plan

**Sprint 0 is a doc sprint, not a code sprint. Day 1 of Sprint 1 is where code lands. Day 1 of Sprint 0 — today — is where the four real deliverables get authored and the team aligns on a single set of artifacts.**

— Sprint 0 Plan, locked alongside PM Ruling v3.
