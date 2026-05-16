# Sprint 1 Day 2 — Execution Log
**Date:** 2026-05-16 (same day as Day 1; Day 1 + Correction + Day 2 all shipped same calendar day)
**Authority:** PM Ruling v3 (consolidated) + Architecture v3 Amendments §F + Sprint 1 Day 1 Correction Log
**Owner:** PM, executing via subagent convening per Waleed's methodology directive.

---

## 0. Day 2 in one sentence

**Canonicalize is live, the combined v3 lifecycle + embedding-strip backfill is written, and the Wave 5.4 Tier 2 cascade is wired into the chat path — all five CI grep rules clean throughout.**

---

## 1. What landed

### 1.1 Canonical-hash module (Memory Engineer)

[`convex/oto/canonicalize.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\canonicalize.ts) — pure-function module.

| Export | Purpose |
|---|---|
| `normalize(text: string): string` | lowercase → NFKC → strip terminal punctuation `[.!?;:,\s]+$` → collapse internal `\s+` → trim. Deterministic, idempotent, no I/O. |
| `sha256Hex(text: string): Promise<string>` | 64-char lowercase hex via WebCrypto `crypto.subtle.digest`. Works in both action and mutation contexts. |
| `canonicalQuestionKey(text: string): Promise<string>` | Composes `sha256Hex(normalize(text))`. The value stored in `vehicle_facts.canonical_question_key`. |

Tests: [`convex/oto/canonicalize.test.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\canonicalize.test.ts) — covers canonicalization variants, idempotency, NFKC fullwidth-digit folding, edge cases, well-known SHA-256 constants (`""` → `e3b0c4…b855`, `"abc"` → `ba7816…15ad`), hash-shape (64 lowercase hex), same-hash-on-variants, different-hash-on-distinct-questions. Vitest syntax; runnable once vitest is installed (`package.json` currently has no test framework).

### 1.2 Combined v3 backfill (Memory Engineer)

[`convex/oto/migrations/backfillV3Lifecycle.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\migrations\backfillV3Lifecycle.ts) — internalMutation + driver action. Folds the §4 lifecycle backfill and the §5 Step 2 embedding-strip into one pass per the Memory Engineer's §5 fold-recommendation. **One disk write per row.** Atomic per Convex transaction.

Per-row patch (when guard fires):
- Lifecycle defaults: `verification_status` (by-source narrow reading of D-3.13), `verified_at` (if newly verified), `report_count: 0`, `written_by: "chat_agent"`, `canonical_question_key` (await canonicalQuestionKey), `asked_at: created_at`.
- Embedding strip: `embedding: undefined` (removes the field from the document, per Convex semantics).
- Idempotent: skips rows where `verification_status !== undefined && embedding === undefined`.

Driver: `runBackfillV3Lifecycle` internalAction — loops batched mutations until `processed === 0`. Configurable `batchSize` (default 256). Logs progress.

Progress + idempotency tracked via single row in new `oto_migrations` table (see §1.3).

### 1.3 `oto_migrations` system table (Memory Engineer; preemptive rename)

Schema appended at the bottom of `convex/schema.ts`:

```ts
oto_migrations: defineTable({
  migration_name: v.string(),
  last_cursor_ms: v.optional(v.number()),
  started_at: v.number(),
  completed_at: v.optional(v.number()),
  total_processed: v.number(),
  total_patched: v.number(),
}).index("by_name", ["migration_name"])
```

**Note on the rename.** The Memory Engineer originally named the table `_migrations` per the original v3 spec. Convex reserves underscore-prefixed table names for system tables (`_storage`, `_scheduled_functions`); a `defineTable("_migrations")` would be rejected at schema-push time. The engineer flagged this as an open question for Waleed in their report (`MEMORY_SCHEMA_V3_CONSOLIDATED §B`-ish), with the mechanical fix recommended. PM applied the rename preemptively to keep Day 2 deploys clean. Six call sites in `backfillV3Lifecycle.ts` + two in `schema.ts` updated; CI grep re-verified clean.

### 1.4 Wave 5.4 Tier 2 cascade (RAG Specialist)

The biggest leverage item. Three sub-strategies inside `vehicle_facts`, returning the first non-empty hit with the tier label and a pre-computed disclaim-tag boolean per row.

[`convex/oto/vehicleFactsKB.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\vehicleFactsKB.ts) gains three new exports:

| Export | Strategy | Index used |
|---|---|---|
| `lookupFactsByCanonicalHash` (query) | T2_HASH — sha256 exact-match | `by_canonical_question` |
| `lookupFactsByText` (query) | T2_TEXT — Convex searchIndex BM25 | `by_text` |
| `cascadeTier2` (action) | Orchestrates HASH → STRUCT → TEXT in order | — |

`cascadeTier2` is an action because it awaits the async `canonicalQuestionKey` before the HASH query. Existing `lookupFactsStructural` is extended (additively) to include `verification_status`, `canonical_question_key`, `render_disclaim_tag` on each row.

**Locked disclaim-tag predicate at one location.** `computeRenderDisclaimTag(source, verification_status)` lives at the top of `vehicleFactsKB.ts` and is called from all three sub-strategy mappers. Per `ARCHITECTURE_v3_AMENDMENTS §F.5`: `source === "web_search" && verification_status === "unverified"`. Consumers (chat.ts, eval harness, mobile UI) consume the boolean; the predicate cannot drift across consumers because it doesn't live in consumers.

[`convex/oto/chat.ts`](computer://C:\Users\manso\Desktop\otopair-1\convex\oto\chat.ts) — the `TODO(Wave 5.4)` marker inside the `retrieve_vehicle_facts` callable was replaced with `ctx.runAction(api.oto.vehicleFactsKB.cascadeTier2, {...})`. Return shape to the model is now `{ mode: "kb_v3_cascade", tier, facts }`. All other chat logic untouched.

### 1.5 CI grep update + verification

`scripts/ci/vehicle-facts-grep.sh` Rule 4 exception variable renamed `STRIP_EMBEDDINGS_FILE` → `V3_BACKFILL_FILE`, repointed at `convex/oto/migrations/backfillV3Lifecycle.ts`. **All 5 rules clean** after every step of Day 2 (canonicalize land, backfill land, rename, cascade land).

---

## 2. Subagent ownership recap

Per Waleed's methodology — schema/architecture work goes through subagents, not the PM directly.

| Deliverable | Subagent | Lines authored |
|---|---|---|
| `canonicalize.ts` + tests | Memory Engineer | ~140 |
| `backfillV3Lifecycle.ts` + driver | Memory Engineer | ~310 |
| `oto_migrations` schema (originally `_migrations`) | Memory Engineer | ~30 |
| CI Rule 4 exception path update | Memory Engineer | ~5 |
| Three Tier 2 sub-strategies + cascade action | RAG Specialist | ~260 |
| `lookupFactsStructural` shape extension | RAG Specialist | ~25 |
| `chat.ts` cascade wiring | RAG Specialist | ~30 |
| `computeRenderDisclaimTag` helper | RAG Specialist | ~10 |
| `_migrations` → `oto_migrations` rename | PM (mechanical, post-Memory-Engineer flag) | 8 sites |
| Day 2 log | PM | this document |

Two subagents convened, sequential (canonicalize had to exist before cascade could await it). Neither freelanced beyond their mandate.

---

## 3. CI grep status

End-of-day:

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
All vehicle-facts invariant checks passed (5/5 rules clean).
```

---

## 4. What is NOT yet done (queued for Day 3+)

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Wave 5.2 "uncomfortable baseline" measurement** — eval harness materializes the labeled set from `RAG_WAVE_5_1_V3_CONSOLIDATED §3` as a Convex seed or JSON fixture, drives `cascadeTier2` and `chat.sendMessage`, computes the four metrics (`precision@3`, `recall@5`, `tier_misclassification`, `disclaim_tag_correctness`). | **QA Lead** | RAG Specialist flagged in Day 2 report (§(vi)) that the harness doesn't yet exist. This is the biggest Day 3 leverage item. |
| 2 | Run `runBackfillV3Lifecycle` in dev to validate idempotency on real data | Waleed (manual op) | Read-then-no-op for already-migrated rows; full pass on pre-v3 rows. Verifies the Memory Engineer's idempotent-guard works in production-shape data. |
| 3 | Reconciliation cron (`vehicleFactsReconciliation.ts`) | Memory Engineer | Per `MEMORY_SCHEMA_V3_CONSOLIDATED §4`. Necessary before `vehicle_facts_audit` go-live but not gating until Wave 5.10/5.11. |
| 4 | Wave 1.4 v3 eval cases ported to runnable code | QA Lead | Per `QA_WAVE_1_4_V3.md`. Includes the disclaim-tag-correctness cases. Naturally pairs with item #1. |
| 5 | Wave 2.4 prompt change (the "I checked the web" interaction moment) | Interaction Strategist | Gated on Wave 1.5 prompt-change protocol existing first. |
| 6 | Migrate `chat.ts` `record_vehicle_fact` callable to use `recordVehicleFact` from `vehicleFactsEditing.ts` instead of legacy `recordFact` in `vehicleFactsKB.ts` | RAG Specialist or PM | Cosmetic-ish — both work today; the new helper is the long-term sanctioned path. Low priority. |

**Recommended Day 3 pick: #1 + #4 together (QA Lead).** They share the same harness scaffolding. Once the harness exists, both the cascade baseline AND the Wave 1.4 v3 eval cases run from the same infrastructure.

---

## 5. Open questions for Waleed (carryover + new)

1. **Wave 5.2 baseline timing.** Per `RAG_WAVE_5_1_V3_CONSOLIDATED §6`, the "uncomfortable baseline" measurement should ideally have happened on **State 0** (with embedding column + vectorIndex still present) so it reflects real prior retrieval quality, not a half-migrated artifact. State 0 is gone — the Day 1 correction removed the vectorIndex. The baseline can still be measured against today's structural-only `vehicle_facts` (current de-facto retrieval), and the spec's expected ranges (`precision@3 0.25–0.45`, `recall@5 0.30–0.50`, `MRR 0.20–0.40`, `refusal_violation 0.40–0.70`) still apply since structural-only was always the dominant strategy. **Decision needed:** is the State-0 measurement still desired (would require schema rollback for an hour), or do we accept that the comparison baseline shifts to "today's structural retrieval" and the cascade's lift gets measured against that? **PM lean:** accept the shifted baseline. Rolling back schema for a measurement is fragile.

2. **`recordFact` deprecation.** `convex/oto/vehicleFactsKB.ts` still exports `insertFact` and `recordFact` (legacy creation paths from before consolidation). The new sanctioned creation path is `recordVehicleFact` in `vehicleFactsEditing.ts`. They coexist; chat.ts still calls the old `recordFact`. Migration is straightforward but touches the chat tool envelope, so it wants its own subagent pass. **Decision needed:** Day 3 priority or Day 4+?

---

## 6. The one-line summary

**Day 2 shipped four artifacts via two subagents — canonicalize, the combined backfill, the Tier 2 cascade, and a locked disclaim-tag predicate — with all CI invariants holding the whole way.**

— End of Day 2.
