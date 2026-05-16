> **⚠ CORRECTED 2026-05-16 (same day). See `SPRINT_1_DAY_1_CORRECTION_LOG.md`.**
>
> Two errors in this log were corrected the same day:
> 1. The schema added a parallel `vehicle_searched_facts` table. Waleed ruled it was the same thing as the existing `vehicle_facts`. The parallel table was removed; v3 lifecycle fields were folded into `vehicle_facts` instead.
> 2. The schema kept the `embedding` column and `vectorIndex` "for Wave 7 deletion." Waleed ruled the embedding goes now (D-3.12). The `vectorIndex` was removed and a three-deploy backfill was specified for the column.
>
> The content below is preserved as the historical record of the prior pass.

---

# Sprint 1 Day 1 — Execution Log
**Date:** 2026-05-16
**Authority:** PM Ruling v3 + Architecture v3 Amendments (Temur-greenlit)
**Strangler discipline:** Wave 3 sub-sequence; everything additive; nothing destructive; old paths untouched.

---

## What landed today

### 1. Sprint 0 confirm-and-pass items closed

| Item | File | Status |
|------|------|--------|
| Substrate confirmation (AI Infrastructure Architect) | `docs/SUBSTRATE_NOTES.md` | Created. v3 reduces per-turn op count vs v2; D-2.2 trigger retired in favor of R-8'-NEW. Convex searchIndex capacity confirmed for projected 100x scale. |
| R-3 annotation (AI Security Analyst) | `docs/ARCHITECTURE_v3_AMENDMENTS.md` §C.4 | Appended. `canonical_question_key` is a cache key, not a credential, no new exfiltration surface. Wave 7.3 re-scope feasible. Cross-account scraper farm remains honestly unsolved (unchanged from Doc 3 §9). |

### 2. Wave 3.1a — three new tables in `convex/schema.ts`

Added between the existing `vehicle_facts` and `oto_telemetry` tables. Additive only; no destructive ops; no existing tables touched.

| Table | Purpose | Indexes |
|-------|---------|---------|
| `vehicle_searched_facts` | Mutable web_search persistence | `by_canonical_question`, `by_vehicle_config`, `by_chassis`, `by_engine`, `by_make_model_year`, `by_topic_axis`, `by_verification_status`, `by_report_count`, `searchIndex("by_text")` |
| `vehicle_searched_facts_audit` | Append-only edit history | `by_fact`, `by_editor`, `by_time` |
| `fact_reports` | User-submitted reports | `by_disposition`, `by_fact`, `by_reporter` |

**Critical adaptation from MEMORY_SCHEMA_V3:** The deliverable spec used a scope shape (`global` / `make` / `make_model` / `make_model_year` / `vin`) that did not match the existing codebase convention. The existing `vehicle_facts` table uses `topic_axis` ∈ {`vehicle`, `trim`, `chassis`, `engine`, `model_year`} plus per-axis scoping ids (`vehicle_config_id`, `chassis_code`, `engine_code`, `make`/`model`/`trim_name`/`year_min`/`year_max`). This is the convention the enrichment-owned tables (`vehicle_configs`, `engines`, `chassis_specs`, etc.) compose with. **The new tables honor the existing convention** so Tier 1→Tier 2 reads use one scope vocabulary. The v3 intent (separate trust class, mutable, audit log, no embedding, no auto-promotion, canonical-hash cache, report telemetry) is fully preserved.

Other adaptations:
- `conversations` → `ai_conversations` (matches actual table name at schema.ts L1587).
- `messages` → `ai_messages` (matches actual table name at schema.ts L1631).
- No `embedding` column or `vectorIndex` on any of the three new tables. D-3.12.

**Reversibility:** All three are inert at Wave 3.1a — no consumer reads or writes them yet. Schema-only addition. Convex `defineTable` is non-destructive; the migration is a `npx convex dev` away. Drop-table rollback is symmetric.

### 3. Wave 3.1b — `written_by` field

Included on `vehicle_searched_facts` per D-3.6 expansion (Multi-Agent Systems Engineer insurance). Default in helper: `chat_agent`. Union: `chat_agent` | `health_monitor` | `admin_edit` | `system`.

### 4. `convex/oto/searchedFacts.ts` — the only sanctioned mutation path

Four mutations exported:

| Mutation | Purpose | Audit row? |
|----------|---------|-----------|
| `createSearchedFact` | Chat-agent persists a Tier-3 web_search answer | No (creation is its own record) |
| `editSearchedFact` | Admin (Waleed/Temur) mutates an existing row | **Yes** — atomic with the patch |
| `reportFact` | User taps "Report Message/Conversation" | No (fact_reports IS the audit trail for reports) |
| `resolveFactReport` | Admin closes an open report | No |

Atomicity guarantees in `editSearchedFact`:
- Read current row → compute `previous_values` over fields actually changing → patch row → insert audit row. All inside one Convex mutation → one transaction → atomic. Either both land or neither does.
- Action-specific pre-conditions: `verify` requires current status `unverified`; `retract` rejects idempotent re-retract; `edit_text` cannot accompany a status change; `edit_meta` cannot change `fact_text` or status.
- Confidence range guard: `[0, 1]`. Web_search-source floor (`<= 0.7`) enforced on `createSearchedFact` insert.
- Reason required and non-empty on every edit.
- No-op edits (no field actually changes) do NOT write an audit row — that would forge history.

Confidence-on-create guard in `createSearchedFact`:
- `confidence > 0.7` rejected explicitly. If a chat-agent path is producing higher-confidence data, the path is misclassified (or this isn't a web_search answer).
- Dedupe on `canonical_question_key`: if a row already exists for the same canonical hash, the existing id is returned and only `asked_at`/`updated_at` are touched. No double-insert; no fact_text overwrite.

### 5. CI grep rules — `scripts/ci/searched-facts-grep.sh`

Three rules, exit non-zero on any violation:

1. **Direct `ctx.db.patch` on `vehicle_searched_facts` outside the helper file.** Catches anyone trying to mutate the table without going through `editSearchedFact`.
2. **Any `ctx.db.replace` on `vehicle_searched_facts`.** Replace is a stronger semantic mutation than patch and is never legal on this table.
3. **Direct `ctx.db.insert("vehicle_searched_facts_audit")` outside the helper file.** Inserts into the audit table without a paired patch are a forgery vector.

Wire into CI: `bash scripts/ci/searched-facts-grep.sh` as a step on every PR touching `convex/`.

---

## Strangler discipline check

| Property | Status |
|----------|--------|
| Existing `vehicle_facts` table touched? | No — untouched. Dual-read during Wave 5 shadow only. |
| Embedding column removed from existing data? | No — `vehicle_facts.embedding` is still present and still populated by the legacy path. v3 deprecates it; deletion is Wave 7. |
| Vector index removed from existing data? | No — `vehicle_facts` still has `vectorIndex("by_embedding")`. Same deletion timeline. |
| Old retrieval path still serves? | Yes, until Wave 5.6 flip. |
| Any consumer reading the new tables today? | No — Wave 5.10 / 5.11 wire the read and write paths. Sprint 1 Day 1 is schema only. |
| Rollback path? | Drop the three new tables. Symmetric. No data motion to reverse. |

The strangler discipline holds. The new tables are alive in the schema but inert at the application layer. The old path is still authoritative until Wave 5.5 shadow-validates and Wave 5.6 flips.

---

## What did NOT land today (and where it goes)

| Item | When | Where |
|------|------|-------|
| Tier 1/2/3 retrieval cascade implementation | Wave 5.4 | `convex/oto/searchedFactsKB.ts` (new file) + edits to `convex/oto/vehicleFactsKB.ts` |
| Labeled retrieval eval set (≥30 entries → grow) | Wave 5.1 | per RAG Specialist deliverable `docs/SPRINT_0/RAG_WAVE_5_1_V3.md` |
| Wave 1.4 boundary + v3 eval cases authored as runnable cases | Wave 1 | per QA Lead deliverable `docs/SPRINT_0/QA_WAVE_1_4_V3.md` |
| Wave 2.4 prompt language merged into `system_prompt.ts` | Wave 2 | per Interaction Strategist deliverable `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md`; goes through Wave 1.5 prompt-change protocol |
| Mobile UI: "Oto may be incorrect" tag render | Wave 2 / Wave 5.10 | mobile repo (out of this workspace) |
| Mobile UI: "Report Message/Conversation" affordance | Wave 5.11 | mobile repo |
| Admin review queue surface | Wave 5.11 | likely a desktop-only `app/(admin)/` route or a separate internal tool |
| Reconciliation cron | Wave 5.11 | `convex/oto/searchedFactsReconciliation.ts` (new file) per MEMORY_SCHEMA_V3 §4 |
| Wave 7.3 rate-limit | Wave 7 | per Security Analyst follow-up; design pending |
| Delete legacy `vehicle_facts` table | Wave 7 (or selectively migrate) | per MEMORY_SCHEMA_V3 §2 step 5 |

---

## What's next (Sprint 1 Day 2)

Five candidates, in priority order. Pick one — the rest queue:

1. **Wave 5.4 cascade implementation** — write `searchedFactsKB.ts` with the three-tier read order. The labeled set from RAG_WAVE_5_1_V3 becomes runnable as soon as this lands.
2. **Wave 1.4 eval cases as code** — port the QA_WAVE_1_4_V3 case list into the actual eval harness. Boundary cases first; v3 categories follow.
3. **Reconciliation cron** — author the `searchedFactsReconciliation.ts` cron per MEMORY_SCHEMA_V3 §4. Necessary before the read/write paths go live in Wave 5.10/5.11 so the audit invariant is monitored from day one.
4. **Canonical-hash normalizer** — the `normalize(question)` function that produces `canonical_question_key`. Tested in isolation so its determinism is independently verifiable (same question across users → same hash).
5. **Wave 2.4 prompt change** — open a PR against `system_prompt.ts` with the INTERACTION_WAVE_2_4_V3 designed language. Wave 1 prompt-change protocol must be live first (Wave 1.5).

Owner: Waleed picks. Recommendation: **#4 (canonical-hash normalizer)** — it's a pure function, fastest to write, fastest to test, and unblocks #1 (the cascade needs it to compute `canonical_question_key` for every incoming question). About an hour of work with a unit-test file.

---

## File summary (Sprint 1 Day 1 deliverables)

| File | Status | Purpose |
|------|--------|---------|
| `convex/schema.ts` | EDITED | Added 3 tables + 12 indexes + searchIndex |
| `convex/oto/searchedFacts.ts` | NEW | 4 mutations: create/edit/report/resolve |
| `scripts/ci/searched-facts-grep.sh` | NEW | 3 invariant rules wired to CI |
| `docs/SUBSTRATE_NOTES.md` | NEW | AI Infrastructure Architect confirm-and-pass |
| `docs/ARCHITECTURE_v3_AMENDMENTS.md` | EDITED | §C.4 — Security Analyst R-3 annotation |
| `docs/SPRINT_1_DAY_1_LOG.md` | NEW | This document |

Six files. Three are code (`convex/`, `scripts/`); three are docs.

---

## Sprint 1 Day 1 — the single most important sentence

**Three tables, four mutations, three CI rules, and zero changes to anything that currently serves a user. The new architecture is alive at the schema layer; the old architecture is authoritative until the Wave 5 flip. That is the strangler discipline working exactly as designed.**

— End of Day 1.
