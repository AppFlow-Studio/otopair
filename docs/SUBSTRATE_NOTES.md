# Substrate Notes
**Owner:** AI Infrastructure Architect (Doc 3 §2)
**Last updated:** 2026-05-16

---

## v3 confirmation — three-tier read order does not regress per-turn op count

The v2 design (single `vehicle_reference_facts` table with a Convex `vectorIndex` on `by_embedding` + structural fallback) charged each reference-fact retrieval the following per-turn ops: (1) one OpenAI embedding API call to vectorize the query (~150ms round-trip), (2) one Convex vector-index query (filtered on `scope`, `topic_id`), (3) on miss, one structural index query (`by_scope_topic`). Typical per-turn op count: 2 (hit) or 3 (miss), one of which is an out-of-region API call on a hot path.

The v3 design (three-tier cascade — enrichment-owned structured tables → `vehicle_searched_facts` → `web_search`) charges: (1) Tier 1: one structural index query on whichever enrichment table the topic routes to (`vehicle_config` / `engine_specs` / `tire_specs` / `chassis_specs` / etc.); (2) Tier 2 on miss: one canonical-hash exact-match (`by_canonical_question`), then on miss one structural index query (`by_scope`), then on miss one `searchIndex` query (`by_text`); (3) Tier 3 only on full miss: one `web_search` call (already wired). Typical per-turn op count: 1 (Tier 1 hit), 2-4 (Tier 2 hit, depending on which sub-layer fires), N/A (Tier 3 — by the time we're here, op count is dominated by the web call). **Zero embedding API calls on either read or write paths.** Convex `searchIndex` lookups are in-region and sub-millisecond.

Net per-turn op count change versus v2: **reduced on the hit path (1 op vs 2), comparable on the deep-miss path (4 ops vs 3, but no out-of-region API call).** The hot-path latency wins because the slowest operation in v2 — the embedding API call — is eliminated entirely.

The D-2.2 numeric trigger (250K rows OR p95 retrieval latency > 400ms over 7 days) is **retired**. Replaced with R-8'-NEW: precision@3 on the Wave 5.1 labeled set drops > 5% versus the post-Wave-5.6-flip baseline, sustained 7-day window. Same dashboard slot; new metric.

— Infrastructure Architect, confirm-and-pass.

---

## Convex `searchIndex` capacity note

Convex's `searchIndex` (BM25-like) is documented to scale into the low-hundreds-of-thousands of rows per index with sub-second latency. `vehicle_searched_facts` is expected to grow at the rate of unique web-searched questions per scope, which in practice is bounded by question diversity per vehicle config (high-frequency questions collapse onto the same `canonical_question_key` via the sha256 normalize step before the searchIndex is even consulted).

Projected ceiling at 100x today's user base: ~50K-150K rows. Comfortably under the documented searchIndex envelope. The same applies to `vehicle_searched_facts_audit` (size is `O(edits)`, not `O(facts)`, and edits are human-driven — a small constant per fact).

If row count crosses 200K, revisit. The revisit option (per D-3.12) is a local deterministic embedding (BGE-small on-device, no API), introduced as a Tier 2.5 layer between the searchIndex and Tier 3. That option is flagged, not built; introducing it requires R-8'-NEW evidence that lexical is the bottleneck.

— Infrastructure Architect.
