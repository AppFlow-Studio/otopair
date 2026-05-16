# Sprint 1 Day 1 — Correction Log (consolidated v3)
**Date:** 2026-05-16 (same day as the original Sprint 1 Day 1)
**Authority:** Waleed's two corrections + the three-subagent consensus they triggered
**Status:** Sprint 1 Day 1 is now in the **consolidated v3** state. The original Day 1 log is preserved with a "CORRECTED" header at the top pointing here.

---

## 0. What this document is

A short, honest record of what was wrong, who said so, what the subagents produced in response, and what the codebase looks like now. The technical specs live in the three subagent deliverables; this log is the *correction trail*.

---

## 1. The two errors

Waleed surfaced both within an hour of the original Sprint 1 Day 1 ship.

### 1.1 The parallel table was wrong

The original Day 1 schema edit added a NEW table — `vehicle_searched_facts` — alongside the existing `vehicle_facts`. The reasoning at the time was "different trust class, different lifecycle, separate table." That reasoning was wrong: the existing `vehicle_facts.source` is already a union that explicitly includes `web_search` alongside `manufacturer | oto_inferred | user_confirmed | propagated`. **The trust class IS the source field.** Splitting the table off forked the read path, the helper, the indexes, and the migration story for no benefit. Waleed:

> "Vehicle Searched_facts/vehicle facts is the same thing you shouldve just edited it"

He was right. The right move was to extend `vehicle_facts` in place with the v3 lifecycle fields.

### 1.2 The embedding stayed

The original Day 1 schema kept `vehicle_facts.embedding: v.optional(v.array(v.float64()))` and the `.vectorIndex("by_embedding", ...)` block, deferred to "Wave 7 deletion" under a strangler-discipline justification. That justification was a hedge. v3 ruled (D-3.12) that the KB has no embedding model — full stop. Strangler-fig discipline applies to *paths*, not to the architectural commitment that v3 was the version after the embedding. Waleed:

> "We said we dont want embedding, yet you kept the embedding."

He was right. The embedding goes now, in three deploys, with a proper backfill.

### 1.3 The methodological error

Both technical errors had the same root cause: I did the schema edit unilaterally instead of convening the subagents who own these calls. The whole point of the Doc 3 eleven-subagent panel is that consolidations like this don't get made by one PM voice. Waleed:

> "your not spawning subagents to help you do the work so you dont hallucinate. again your a billion dollar team. work as one."

Correct. I convened three subagents — Memory Engineer, RAG Specialist, Security Analyst — in parallel for the consolidation. Their three deliverables are the source of truth for the correction.

---

## 2. The three subagent deliverables

Each subagent produced one paste-ready spec file. The files supersede prior versions for their topic.

| Subagent | Deliverable | Supersedes |
|---|---|---|
| **Memory Systems Engineer** | `docs/SPRINT_0/MEMORY_SCHEMA_V3_CONSOLIDATED.md` (~620 lines) | `docs/SPRINT_0/MEMORY_SCHEMA_V3.md` |
| **RAG Optimization Specialist** | `docs/SPRINT_0/RAG_WAVE_5_1_V3_CONSOLIDATED.md` (~680 lines) | `docs/SPRINT_0/RAG_WAVE_5_1_V3.md` |
| **AI Security Analyst** | `docs/SPRINT_0/SECURITY_CONSOLIDATED_V3.md` (~430 lines) | (new — no prior file for this analysis) |

Each prior-version file has a `> ⚠ SUPERSEDED` header at the top pointing to its replacement. The prior content is preserved as the historical record of the v3-original pass.

**The three consensus points** (each independently agreed by all three subagents):

1. **One KB table.** `vehicle_facts` is the consolidated KB; `vehicle_searched_facts` is deleted; the trust class is `source`; the lifecycle is `verification_status`; the disclaim tag is a render-time predicate over the two.
2. **Two new tables only.** `vehicle_facts_audit` (append-only edit history, pointing at `vehicle_facts`) and `fact_reports` (user reports, pointing at `vehicle_facts`). The original Day 1 had three new tables; the correction has two.
3. **The embedding comes out now in three deploys.** Deploy A: remove the `vectorIndex`, stop new writes, keep the `v.optional` column. Deploy B: `stripEmbeddings` backfill mutation walks the table in batches setting `embedding: undefined`. Deploy C: remove the field from the schema entirely. Each step is reversible until the next ships.

**One ruling Waleed locked during the consolidation discussion** (recorded as the narrow reading of D-3.13):

- Enrichment-sourced rows (`source ∈ {manufacturer, oto_inferred, user_confirmed, propagated}`) default to `verification_status: "verified"` on insert. Only `source == "web_search"` rows default to `"unverified"`. D-3.13's "no auto-promotion" rule applies to the `unverified → verified` transition only.

---

## 3. What changed on disk

### 3.1 `convex/schema.ts`

| Object | State (Day 1 first pass) | State (Day 1 corrected) |
|---|---|---|
| `vehicle_facts` table | Embedding column present; vectorIndex present; pre-v3 fields only | **9 new v3 fields** (canonical_question_key, verification_status, verified_at, retracted_at, report_count, last_reported_at, written_by, asked_by_user_id, asked_at); **4 new indexes** (by_canonical_question, by_verification_status, by_report_count, searchIndex by_text); embedding field **REMOVED** from schema; vectorIndex **REMOVED**; comment block updated |
| `vehicle_searched_facts` table | Added | **Deleted** (replaced with placeholder comment noting the consolidation) |
| `vehicle_searched_facts_audit` table | Added | **Deleted** |
| First `fact_reports` table (pointing at `vehicle_searched_facts`) | Added | **Deleted** |
| `vehicle_facts_audit` table | Did not exist | **Added** (append-only; `fact_id: v.id("vehicle_facts")`; three indexes) |
| `fact_reports` table (pointing at `vehicle_facts`) | Did not exist | **Added** (correct fact_id target; three indexes) |

Net: **one table edited in place, two new tables, three tables retired.** Final count of new tables added in Wave 3.1a = 2, not 3. Embedding artifacts: gone from the new schema; backfill clears pre-existing rows in Deploy B.

### 3.2 `convex/oto/`

| Path | State |
|---|---|
| `convex/oto/vehicleFactsEditing.ts` | **New.** Four mutations: `recordVehicleFact`, `editVehicleFact`, `reportVehicleFact`, `resolveFactReport`. All target `vehicle_facts`. The single sanctioned mutation path. |
| `convex/oto/searchedFacts.ts` | **Deprecation stub.** Re-exports from `vehicleFactsEditing.ts` so no in-flight import breaks (there shouldn't be any — nothing was calling it yet). |

### 3.3 `scripts/ci/`

| Path | State |
|---|---|
| `scripts/ci/vehicle-facts-grep.sh` | **New.** Five rules: (1) no direct patch on `vehicle_facts` outside the helper; (2) no `ctx.db.replace` on `vehicle_facts`; (3) no direct insert into `vehicle_facts_audit` outside the helper; (4) no new `embedding` writes anywhere in `convex/`; (5) the retired `vehicle_searched_facts` table name must not reappear outside the deprecation stub + docs. |
| `scripts/ci/searched-facts-grep.sh` | **Stub.** Delegates to the new script via `exec`. |

### 3.4 Docs

| Path | State |
|---|---|
| `docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md` | Header updated to note consolidation; references to `vehicle_searched_facts` read as `vehicle_facts`. |
| `docs/ARCHITECTURE_v3_AMENDMENTS.md` | New §F (consolidation amendment) covering: D-3.11 amendment, D-3.12 strengthening, Wave 3.1a / 3.1b / 7.3 effects, Risk Register R-NEW expansion, P-2 reinforcement, the locked disclaim-tag predicate, the narrow D-3.13 default rule. |
| `docs/SPRINT_0/MEMORY_SCHEMA_V3.md` | Marked `SUPERSEDED`; content preserved. |
| `docs/SPRINT_0/RAG_WAVE_5_1_V3.md` | Marked `SUPERSEDED`; content preserved. |
| `docs/SPRINT_0/MEMORY_SCHEMA_V3_CONSOLIDATED.md` | **New.** Memory Engineer deliverable. |
| `docs/SPRINT_0/RAG_WAVE_5_1_V3_CONSOLIDATED.md` | **New.** RAG Specialist deliverable. |
| `docs/SPRINT_0/SECURITY_CONSOLIDATED_V3.md` | **New.** Security Analyst deliverable. |
| `docs/SPRINT_1_DAY_1_LOG.md` | Header updated with `CORRECTED` notice pointing here. |
| `docs/SPRINT_1_DAY_1_CORRECTION_LOG.md` | **This document.** |

---

## 4. Verification — what to check before declaring Day 1 closed

The five-rule CI grep (`scripts/ci/vehicle-facts-grep.sh`) catches the structural invariants. Run it manually as a smoke test:

```bash
bash scripts/ci/vehicle-facts-grep.sh
```

Expected: all five rules clean. Anything else is a regression that must close before Day 2 starts.

Schema-level smoke test (when `npx convex dev` next runs):
- The schema compiles. The 5 unions, 9 new fields, and the searchIndex are accepted.
- Existing `vehicle_facts` rows that still have `embedding` populated are tolerated (the field is no longer in the schema, but Convex allows extra fields on existing rows until Deploy B strips them).
- Pre-flight: any in-flight import of `convex/oto/searchedFacts` resolves via the deprecation stub.

---

## 5. What this correction did NOT change

Things that survived the consolidation unchanged:

- The **Tier 1 read path** still goes to existing enrichment-owned structured tables (`vehicle_configs`, `engines`, `tire_specs`, `chassis_specs`, etc.). Unaffected.
- The **cross-tenant read rule** (D-3.10). Unaffected — and now reinforced because there's exactly one KB to read across users.
- The **report-and-review loop** (D-3.1 of PM Ruling §3.1). Unaffected — `fact_reports` still exists and still routes to Waleed + Temur.
- The **four interaction moments** in Wave 2 (escalation, cost-cap, not-yet-known, web-source disclaim). Unaffected.
- The **Wave 7.3 rate-limit re-scope.** Unaffected in concept — the set of moat tables now includes the single consolidated `vehicle_facts` instead of the original `vehicle_facts + vehicle_searched_facts` pair.
- The **D-3.2 append-only discipline** for `conversation_facts` and `user_semantic_facts`. Unaffected.

---

## 6. What I'm honestly going to do differently next time

Three things, recorded so they bind future passes:

1. **Convene subagents for consolidation calls.** When a schema decision touches more than one subagent's mandate, the right move is to spawn them in parallel and let them reach consensus on the deliverable, not to draft it solo and then ask them to ratify. The first-pass schema edit should have been the Memory Engineer's spec, not mine.

2. **Refuse strangler-deferral on architectural commitments.** Strangler-fig discipline applies to the *transition path*, not to the *end state*. The embedding column was an architectural commitment v3 explicitly reversed. Deferring its removal to "Wave 7" was using strangler discipline as cover for leaving the prior architecture in place. The three-deploy backfill in Deploy A/B/C is the strangler discipline correctly applied.

3. **Treat "we already have a table called X" as a binding constraint, not a suggestion.** When the codebase already has `vehicle_facts` with a `source` enum that includes `web_search`, that is the table — not a near-neighbor to a new parallel. The grounding pass on the codebase (which I did do in the first Day 1) was correct; I just ignored what it told me when writing the schema edit.

---

## 7. Sprint 1 Day 2 — entry criteria (unchanged)

The Day 2 candidate list from `SPRINT_1_DAY_1_LOG.md` §"Sprint 1 Day 2 — your pick" stands, with one substitution:

| # | Item | Notes |
|---|---|---|
| 1 | Wave 5.4 cascade implementation (`searchedFactsKB.ts` → now `vehicleFactsKB.ts` extension) | Three-tier read order against the consolidated `vehicle_facts`. The existing `vehicleFactsKB.ts` gets the new query functions added. |
| 2 | Wave 1.4 v3 eval cases ported to runnable code | Per `QA_WAVE_1_4_V3.md`. The disclaim-tag-correctness assertions target the F.5 predicate. |
| 3 | Reconciliation cron (`vehicleFactsReconciliation.ts`) | Per `MEMORY_SCHEMA_V3_CONSOLIDATED §4`. Reads `vehicle_facts_audit` for replay-equivalence, parity checks, telemetry parity. |
| 4 | **Canonical-hash normalizer (`canonicalize.ts`)** — recommended | Pure function; unit-testable; unblocks #1. |
| 5 | Wave 2.4 prompt-change PR | Gated on Wave 1.5 protocol existing first. |
| 6 | **Embedding-strip backfill (`stripEmbeddings.ts`)** — new, see Deploy B in `MEMORY_SCHEMA_V3_CONSOLIDATED §5` | Idempotent, batched, checkpointed. The Memory Engineer recommends folding it into the same pass as the v3 lifecycle backfill. |

My recommendation for Day 2 is still **#4 (canonical-hash normalizer)** — pure function, ~1 hour with tests, unblocks #1. With #6 a close second because it lets us ship Deploy B sooner.

---

## 8. The single most important sentence in this correction log

**The mistake was real, the fix is on disk, the discipline going forward is to convene subagents before any consolidation call. `vehicle_facts` is the KB. There is no parallel. The embedding goes in three deploys, not in Wave 7.**

— Correction Log, locked.
