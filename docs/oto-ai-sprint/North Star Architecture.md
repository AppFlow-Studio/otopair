# Oto AI — Doc 2 of 6: The North-Star Architecture

**Author:** Principal AI Engineering, acting on AB / Temur's behalf  
**Date:** May 15, 2026  
**Scope:** Oto-only. Greenfield-ideal: what Oto would be if built today, no prior commitments.  
**Constraint preserved:** Convex + Anthropic substrate. (This is a deliberate choice, defended in §1.2 — a true greenfield might pick differently, and that alternative is examined honestly.)  
**Reading order:** Doc 1 first (the critique). This is the design. Doc 4 maps the gap.

---

## 0. What "north-star" means here

This document does not describe what to build next week. It describes the target. Every design decision is made as if Oto were the primary product of a company with a principal engineer who has to live with this system at 100x scale for three years.

Where the greenfield-ideal would diverge from "Convex + Anthropic," I say so explicitly and explain why I'm holding the substrate constant anyway. A consulting engagement that pretends the ideal and the constrained are the same thing is dishonest. They aren't. The gap is the value.

The architecture is twelve subsystems. They're presented in dependency order — later subsystems assume earlier ones. The **Memory Architecture (§3)** is the keystone and gets the most space, because Doc 1 established it as the single most consequential redesign and everything else (retrieval, context, routing) depends on getting it right.

---

## 1. Architectural principles

Before subsystems, the principles that govern every decision below. When two designs conflict, these break the tie.

### 1.1 The seven principles

1. **Typed boundaries, always.** Every cross-table, cross-system, or cross-process identifier is a typed enum or typed reference. Never a bare string. This is the direct response to Doc 1's Systemic Concern #1.

2. **State has exactly one owner and one lifecycle.** No table holds two kinds of state. No field is written by two systems. Ownership is declared in the schema, not in convention. Direct response to Systemic Concern #2.

3. **The system is probabilistic; the engineering around it is deterministic.** The model is the only nondeterministic component. Routing, budgeting, retrieval ranking, eval scoring, and observability alerting are all deterministic and testable. Direct response to Systemic Concern #3.

4. **Cost is a first-class architectural constraint, not an afterthought.** Every Anthropic call passes through a budget gate. Cost is attributed to a user, a conversation, and an outcome. Direct response to Systemic Concern #4.

5. **The model proposes; the system disposes.** The model can request a tool, an escalation, a model switch. The system decides whether to honor it. The model never has unilateral authority over cost, data mutation, or model selection. Generalizes the render-trigger architecture (Doc 1 §3.13) into a universal law.

6. **Documentation is generated, not maintained.** Canonical inventories are built from code annotations. When code changes, docs regenerate. Drift is structurally impossible. Direct response to Systemic Concern #5.

7. **Every layer is independently evaluable.** Retrieval has precision/recall metrics. Routing has a confusion matrix. The prompt has an eval suite. Cost has a budget-adherence metric. No layer is "tested by hoping the whole thing works."

### 1.2 Why Convex + Anthropic stays (and where greenfield would diverge)

**The honest greenfield answer:** if I started today with a blank repo and Oto's requirements, I would likely pick a different shape for two of the twelve subsystems:

- **Retrieval:** A true greenfield would use a dedicated vector database (Turbopuffer, or pgvector on a managed Postgres) rather than Convex's vector index, because retrieval quality tooling (hybrid search, reranking, metadata filtering at scale) is more mature there.
- **Observability + Eval:** A true greenfield would use a purpose-built LLM-observability platform (Braintrust or Langfuse) rather than building dashboards and eval persistence in-house, because these are solved problems and rebuilding them is undifferentiated work.

**Why I'm holding the substrate constant anyway:**

1. **Convex's transactional model is a genuine asset for the memory architecture.** The biggest redesign in this document (the six-table memory model) benefits enormously from Convex's serializable consistency. Race conditions that would require careful locking in Postgres are eliminated by Convex's mutation serialization. Throwing this away to gain better vector tooling is a bad trade for Oto's specific workload (read-heavy, low-cardinality-per-user, transactionally-sensitive).

2. **The retrieval workload is small.** Oto's KB is vehicle reference facts + per-user conversational facts. This is thousands-to-low-millions of vectors, not billions. Convex's vector index is adequate at this scale. The dedicated-vector-DB advantage only materializes at scale Oto won't hit for years.

3. **Anthropic-only is correct for Oto specifically.** Multi-model gateways (LiteLLM, Portkey) earn their complexity when you're arbitraging across providers for cost or capability. Oto's task — automotive diagnostic reasoning with strong instruction-following — is squarely in Claude's strength zone. The cost optimization that matters for Oto is *caching and routing within the Claude family*, not cross-provider arbitrage. A gateway adds an operational layer for a benefit Oto doesn't need.

**Where greenfield-ideal genuinely wins, and we accept the loss:** purpose-built eval/observability platforms (Braintrust, Langfuse) would save weeks of in-house build. This document specifies the in-house version because the migration cost of adopting an external platform mid-flight, plus the data-residency considerations of piping conversation traces to a third party, plus the team's existing Convex fluency, net out in favor of building. **This is a real trade-off, not a free lunch. We are choosing build-cost now to avoid integration-cost and a vendor dependency later.** Doc 5 (Decision Log) records this explicitly so it can be revisited if the team's scale or composition changes.

---

## 2. System topology

The whole system, one diagram.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MOBILE (React Native)                            │
│  Chat screen · render components · shared envelope types (compile-guarded)│
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ api.oto.turn.run(args)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       ORCHESTRATION LAYER (Convex action)                 │
│                                                                          │
│   ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │ 1. Identity│→ │ 2. Budget    │→ │ 3. Working   │→ │ 4. Route     │  │
│   │  + State   │  │    Gate      │  │  Memory Build│  │  (model)     │  │
│   │  Contract  │  │  (cost)      │  │  (budgeted)  │  │ deterministic│  │
│   └────────────┘  └──────────────┘  └──────────────┘  └──────┬───────┘  │
│                                                              │          │
│   ┌──────────────────────────────────────────────────────────▼───────┐  │
│   │  5. REASONING LOOP                                                │  │
│   │  Anthropic call · tool dispatch · render merge · recovery paths   │  │
│   │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐ │  │
│   │  │ Tool Registry │  │ Retrieval (RAG)│  │ Trust Protocol Gate  │ │  │
│   │  │ (versioned,   │  │ hybrid+rerank  │  │ (provenance-aware)   │ │  │
│   │  │  lifecycle)   │  │                │  │                      │ │  │
│   │  └───────────────┘  └────────────────┘  └──────────────────────┘ │  │
│   └──────────────────────────────────┬───────────────────────────────┘  │
│                                      ▼                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │ 6. Persist   │→ │ 7. Telemetry │→ │ 8. Quality   │                  │
│   │  (memory     │  │  (per-turn   │  │  Signal      │                  │
│   │   writeback) │  │   trace)     │  │  (post-hoc)  │                  │
│   └──────────────┘  └──────┬───────┘  └──────────────┘                  │
└──────────────────────────────┼──────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         MEMORY ARCHITECTURE (6 tables)                    │
│                                                                          │
│  working_memory   episodic_memory   user_semantic   global_semantic      │
│  (ephemeral,      (per-conversation (per-user,      (cross-user KB,       │
│   not stored)      typed)            permanent)      reference-only)      │
│                                                                          │
│  conversation_control            conversation_audit                      │
│  (model, budget, escalation)     (immutable message log)                 │
└──────────────────────────────────────────────────────────────────────────┘
                              ▲
┌──────────────────────────────┼──────────────────────────────────────────┐
│  OFFLINE / ASYNC SUBSYSTEMS  │                                           │
│  ┌──────────────┐  ┌─────────▼────────┐  ┌──────────────┐               │
│  │ Eval Platform│  │ Aggregation Cron │  │ KB Enrichment│               │
│  │ (CI, stats,  │  │ (rollups, alerts)│  │ (reference   │               │
│  │  LLM-judge)  │  │                  │  │  data only)  │               │
│  └──────────────┘  └──────────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────────────────────────────┘
```

Eight orchestration steps. Six memory tables. Three async subsystems. Twelve subsystems total, specified below.

---

## 3. Subsystem 1 — Memory Architecture (the keystone)

Doc 1 established that the current system collapses six conceptually distinct kinds of state into three tables, producing race conditions, scoping bugs, and unclear ownership. This is the redesign.

### 3.1 The six memory layers

| Layer | Table | Lifetime | Written by | Read by | Race-safe? |
|-------|-------|----------|------------|---------|------------|
| **Working memory** | *(none — ephemeral)* | One turn | Built fresh each turn | The model, this turn | N/A — never stored |
| **Episodic memory** | `conversation_episodic` | One conversation | Reasoning loop (validated) | Working-memory builder, next turn | Yes — single writer |
| **User semantic memory** | `user_semantic_facts` | Permanent, user-scoped | Reasoning loop (gated) | Retrieval, cross-conversation | Yes — append-only + retract |
| **Global semantic memory** | `vehicle_reference_facts` | Permanent, cross-user | Enrichment pipeline ONLY | Retrieval | Yes — AI never writes |
| **Control state** | `conversation_control` | One conversation | System mutations only | Router, budget gate | Yes — system-only writer |
| **Audit log** | `conversation_audit` | Permanent, immutable | System mutation, append-only | Eval, telemetry, support | Yes — append-only |

The single most important property: **each table has exactly one writer.** This is what eliminates the `established_facts` race condition. Today, Haiku and the mobile app both write `established_facts`. In the north-star, episodic memory has one writer (the validated reasoning loop) and mobile-driven selections go through a different path entirely (§3.5).

### 3.2 Working memory — the ephemeral context builder

Working memory is never stored. It is built fresh every turn by a deterministic function with a token budget. This is the direct fix for Doc 1's finding that the envelope has no token budgeting.

```typescript
type WorkingMemoryBudget = {
  total_tokens: number;          // hard cap, e.g. 3000
  allocations: {
    user_context: number;       // 100 — first name, vehicle display
    episodic: number;           // 600 — mood, arc, current flow
    semantic_facts: number;     // 800 — retrieved user + reference facts
    history: number;            // 1200 — compressed recent turns
    control_hints: number;      // 100 — polite-exit, escalation flags
    slack: number;              // 200 — headroom
  };
};

function buildWorkingMemory(
  state: ConversationState,
  retrieved: RetrievedFacts,
  budget: WorkingMemoryBudget
): WorkingMemoryEnvelope {
  return {
    user: buildUserBlock(state.user),                           // typed, State-Contract-enforced
    episodic: buildEpisodicBlock(state.episodic, budget.allocations.episodic),
    facts: rankAndTruncate(retrieved, budget.allocations.semantic_facts),
    history: compressHistory(state.recent_turns, budget.allocations.history),
    control: buildControlHints(state.control),
  };
}
```

**`compressHistory` is the critical function.** Today, history is "last 10 turns, verbatim." The north-star compresses adaptively:

- Turns older than N are summarized (one Haiku call per conversation, cached in episodic memory as `compressed_history_summary`, recomputed only when it goes stale).
- Recent turns stay verbatim.
- The boundary between summarized and verbatim is set by token budget, not turn count.

This means a long diagnostic conversation doesn't blow the envelope, and a conversation with lots of short "thanks" turns doesn't waste budget on noise.

### 3.3 Episodic memory — typed, single-writer

The current `ai_conversations` state fields (`mood`, `arc_summary`, `established_facts`, `last_user_intent`, `diagnostic_turn_count`) become a typed table:

```typescript
conversation_episodic: defineTable({
  conversation_id: v.id("conversations"),
  
  // Mood — closed enum, not free string
  mood: v.union(
    v.literal("neutral"), v.literal("curious"),
    v.literal("concerned"), v.literal("frustrated"),
    v.literal("satisfied")
  ),
  
  // Current flow — closed enum (was last_user_intent free string)
  current_flow: v.union(
    v.literal("diagnostic"), v.literal("booking"),
    v.literal("maintenance"), v.literal("education"),
    v.literal("status_check"), v.literal("off_topic"),
    v.literal("none")
  ),
  flow_turn_count: v.number(),
  
  // Arc summary — model-written prose, allowed to be a string (it IS prose)
  arc_summary: v.string(),
  
  // Compressed history — system-written, cached
  compressed_history_summary: v.optional(v.string()),
  compressed_through_turn: v.optional(v.number()),
  
  updated_at: v.number(),
  updated_by_turn: v.number(),  // which turn last wrote this — race detection
}).index("by_conversation", ["conversation_id"]),
```

`established_facts` is removed from here entirely. It becomes its own table (§3.4) because it has different semantics (append + retract, not overwrite).

**Single-writer enforcement.** Episodic memory is written by exactly one path: the reasoning loop's `commitEpisodic(conversation_id, delta, turn_number)` mutation. The mutation checks `updated_by_turn` — if it's not `turn_number - 1`, a concurrent write happened and the mutation reconciles deterministically (last-writer-wins on prose fields, but turn count is monotonic). Mobile never writes here.

### 3.4 The facts model — append + retract, typed payloads

The current `established_facts: v.array(v.string())` is the worst single schema decision in the system (Doc 1 §3.3). Replacement:

```typescript
conversation_facts: defineTable({
  conversation_id: v.id("conversations"),
  
  fact_type: v.union(
    v.literal("id_reference"),   // "selected mechanic k57abc" — structured
    v.literal("preference"),     // "prefers closest over cheapest"
    v.literal("observation"),    // "brake squeal at low speed only"
    v.literal("hypothesis"),     // Oto's working theory (NOT user-stated)
    v.literal("user_quote")      // exact user phrasing, verbatim
  ),
  
  // Typed payload — discriminated on fact_type
  payload: v.union(
    v.object({ kind: v.literal("id_reference"),
               entity_type: v.string(), entity_id: v.string() }),
    v.object({ kind: v.literal("preference"),
               dimension: v.string(), value: v.string() }),
    v.object({ kind: v.literal("observation"),
               text: v.string() }),
    v.object({ kind: v.literal("hypothesis"),
               text: v.string(), confidence: v.number() }),
    v.object({ kind: v.literal("user_quote"),
               text: v.string() })
  ),
  
  source_turn: v.number(),
  created_at: v.number(),
  retracted_at: v.optional(v.number()),    // soft-retract, never hard-delete
  retracted_reason: v.optional(v.string()),
}).index("by_conversation_active", ["conversation_id", "retracted_at"]),
```

Three properties this buys:

1. **No parse-twice tax.** `id_reference` facts are structured. The next turn's working-memory builder reads `entity_id` directly. No string parsing in either direction.
2. **Retraction works.** "Actually that was my other car" → the wrong fact gets `retracted_at` set. It stops steering the model. The audit trail is preserved (soft-delete).
3. **Mobile-driven selections have a clean path.** When the user taps a shop card, mobile doesn't write a string into a shared array. It calls `recordSelectionFact(conversation_id, {kind:"id_reference", entity_type:"mechanic", entity_id})`. Append-only. No race with the reasoning loop.

### 3.5 The mobile-driven fact path (eliminating the race)

This deserves its own subsection because it's the concrete fix for the "benign race" Doc 1 flagged as not-benign.

**Today:** Haiku writes `established_facts` (full array overwrite). Mobile writes `established_facts` (append via `appendEstablishedFact`). Both target the same field. A double-tap during a Haiku turn drops a fact.

**North-star:** Two different write paths, two different mutations, append-only table, no shared mutable field:

```
Haiku reasoning →  commitFacts(conversation_id, new_facts[], turn_n)
                   (append-only, each fact tagged source_turn)

Mobile tap     →  recordSelectionFact(conversation_id, selection_fact)
                   (append-only, tagged source: "user_selection")
```

Both append to `conversation_facts`. Neither overwrites. The working-memory builder reads all non-retracted facts ordered by `created_at`. There is no race because there is no shared mutable state — append-only tables are commutative under concurrent writes (Convex serializes the inserts; order is by `created_at`, which is monotonic).

This is the single highest-leverage correctness fix in the entire architecture. It's also small — one table, two mutations, one read function.

### 3.6 User semantic memory — cross-conversation, scoped

The current system has no per-user persistent memory. Doc 1 and the Apr 13 meeting both identified self-learning ("Oto remembers your mechanics, your preferences across conversations") as core, not post-MVP. This is the table for it:

```typescript
user_semantic_facts: defineTable({
  user_id: v.id("users"),
  vehicle_id: v.optional(v.id("vehicles")),   // null = user-level, set = vehicle-specific
  
  fact_type: v.union(
    v.literal("mechanic_preference"),   // "books with Carlos repeatedly"
    v.literal("service_preference"),    // "always declines synthetic blend"
    v.literal("communication_style"),   // "wants terse answers"
    v.literal("vehicle_quirk"),         // "this specific car pulls left when cold"
    v.literal("history_anchor")         // "last brake service confirmed 2026-03-14"
  ),
  
  payload: v.string(),                 // prose; consumed as context, not parsed
  confidence: v.number(),              // decays over time; refreshed on reinforcement
  source: v.union(
    v.literal("user_stated"),          // user said it explicitly
    v.literal("inferred_behavior"),    // derived from booking/chat patterns
    v.literal("mechanic_confirmed")    // came from a verified service record
  ),
  
  first_observed: v.number(),
  last_reinforced: v.number(),
  observation_count: v.number(),       // how many times reinforced
  retracted_at: v.optional(v.number()),
}).index("by_user_active", ["user_id", "retracted_at"])
  .index("by_user_vehicle", ["user_id", "vehicle_id"]),
```

**Confidence decay** is the interesting mechanic. A preference observed once 6 months ago is weaker than one reinforced five times this month. The retrieval layer (§4) weights facts by `confidence × recency × observation_count`. A preference the user stated once and contradicted later naturally decays out of relevance without explicit retraction.

**Scoping enforcement** is the critical safety property. A `vehicle_quirk` fact ("this car pulls left when cold") is scoped to one `vehicle_id` and one `user_id`. It NEVER propagates to global semantic memory. Only `vehicle_reference_facts` (the enrichment-pipeline-owned table) is cross-user, and the AI cannot write to it. This is the structural fix for Doc 1's finding that one user's mechanic saying "6 quarts not 7" could poison every user's data.

### 3.7 Global semantic memory — reference-only, AI-read-only

This is the moat, isolated and protected.

```typescript
vehicle_reference_facts: defineTable({
  // Scoping axis — exactly one of these is the lookup key
  scope: v.union(
    v.literal("engine"), v.literal("chassis"),
    v.literal("trim"), v.literal("generation")
  ),
  scope_key: v.string(),               // engine_code | chassis_code | trim_id | gen_id
  
  topic_id: v.id("kb_topics"),         // FK — controlled vocabulary, NOT free string
  
  fact_value: v.string(),
  unit: v.optional(v.string()),
  
  source: v.union(
    v.literal("vehicle_databases_api"),
    v.literal("nhtsa"),
    v.literal("oem_manual"),
    v.literal("enrichment_pipeline_verified")
  ),
  confidence: v.number(),
  evidence_count: v.number(),          // multi-source consensus count
  
  embedding: v.optional(v.array(v.number())),
  embedding_model_version: v.optional(v.string()),  // versioned — Doc 1 §3.4
  
  created_at: v.number(),
  verified_at: v.optional(v.number()),
}).index("by_scope_topic", ["scope", "scope_key", "topic_id"])
  .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536,
                                 filterFields: ["scope", "topic_id"] }),
```

Two properties that fix Doc 1's retrieval findings:

1. **`topic_id` is a foreign key to `kb_topics`, not a free string.** This eliminates KB fragmentation. A topic is registered once (`oil_capacity_quarts`) and referenced by ID. No "oil_capacity" vs "oil_capacity_qts" drift possible.
2. **`embedding_model_version` is stored.** When the embedding model upgrades, you know which rows need reindexing. The current system has no version, so a model upgrade silently makes new embeddings incomparable to old ones.

**The AI never writes to this table.** The enrichment pipeline (existing, Waleed's, $0.30/VIN, adversarial-verified) owns all writes. The flywheel narrative is preserved: the KB grows, future users hit cached reference data — but the data is enrichment-pipeline-quality, not Haiku-web-search-quality. This is the structural separation Doc 1 §3.4 called for.

### 3.8 `kb_topics` — the controlled vocabulary

The small table that prevents KB fragmentation:

```typescript
kb_topics: defineTable({
  topic_key: v.string(),               // "oil_capacity_quarts" — unique
  display_name: v.string(),            // "Oil Capacity (quarts)"
  category: v.union(
    v.literal("fluids"), v.literal("brakes"), v.literal("battery"),
    v.literal("tires"), v.literal("filters"), v.literal("intervals"),
    v.literal("torque_specs"), v.literal("general")
  ),
  expected_unit: v.optional(v.string()),
  retrieval_priority: v.number(),      // boosts ranking for common topics
}).index("by_topic_key", ["topic_key"]),
```

New topics require an explicit insert into `kb_topics`. The reasoning loop cannot invent a topic — it can only reference an existing `topic_id`. If a genuinely new topic is needed, that's a registration event (a one-line PR or an admin action), not an uncontrolled string write. This is the "controlled vocabulary with registration" pattern from Doc 1 §3.8.

### 3.9 Control state and audit log

The two remaining tables, briefly (they're simple):

```typescript
conversation_control: defineTable({
  conversation_id: v.id("conversations"),
  current_model: v.union(v.literal("haiku"), v.literal("sonnet")),  // typed
  budget_spent_usd: v.number(),
  budget_cap_usd: v.number(),
  escalation_count: v.number(),
  escalation_state: v.union(
    v.literal("none"), v.literal("requested"), v.literal("active"), v.literal("human")
  ),
  sonnet_turns_used: v.number(),
  sonnet_turn_budget: v.number(),
  updated_at: v.number(),
}).index("by_conversation", ["conversation_id"]),

conversation_audit: defineTable({
  conversation_id: v.id("conversations"),
  turn_number: v.number(),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
  content: v.string(),
  tool_calls: v.optional(v.array(v.object({ name: v.string(), input: v.any() }))),
  model_used: v.union(v.literal("haiku"), v.literal("sonnet")),
  prompt_version: v.string(),          // pinned — Doc 1 §3.1
  timestamp: v.number(),
}).index("by_conversation_turn", ["conversation_id", "turn_number"]),
```

`conversation_control` is written ONLY by system mutations (budget gate, router). The model never touches it. `conversation_audit` is append-only and immutable — it's the forensic record. `prompt_version` is stamped on every assistant turn, closing Doc 1's prompt-versioning gap.

### 3.10 Memory architecture summary

The redesign in one sentence: **six tables, six lifetimes, six single-writers, zero shared mutable state.** Every race condition, scoping bug, and parse-twice tax in the current system traces to a violation of one-writer-per-table. The north-star enforces it structurally. Everything downstream (retrieval, context, routing) is cleaner because memory is clean.

---

## 4. Subsystem 2 — Retrieval (real RAG)

Doc 1 established the current KB is "KV store with embeddings glued on," missing five RAG components. The north-star retrieval pipeline:

### 4.1 The retrieval flow

```
Query (from reasoning loop: "what does this need")
   │
   ├─ Stage 1: Query classification (deterministic)
   │    reference fact? → vehicle_reference_facts path
   │    user history?   → user_semantic_facts path
   │    both?           → parallel, merged
   │
   ├─ Stage 2: Hybrid retrieval (per path)
   │    ┌─ Structural: indexed lookup by scope_key + topic_id  (exact)
   │    └─ Semantic:   vector search, scope+topic filtered      (fuzzy)
   │    Run BOTH. Always. Merge candidates.
   │
   ├─ Stage 3: Rerank (deterministic scoring)
   │    score = w1·exact_match + w2·vector_sim + w3·confidence
   │          + w4·recency + w5·evidence_count + w6·topic_priority
   │
   ├─ Stage 4: Threshold + budget
   │    drop candidates below score threshold
   │    truncate to working-memory fact budget (§3.2)
   │
   └─ Stage 5: Provenance tagging
        each retrieved fact carries source + confidence into the prompt
        (the trust protocol reads these — §8)
```

The key change from today: **Stage 2 runs both structural and semantic, always.** The current system picks one based on whether `OPENAI_API_KEY` is set. That's an infrastructure accident driving retrieval strategy. Hybrid-always is the production-correct pattern; the merge + rerank in Stages 3 makes it work.

### 4.2 Reranking without a cross-encoder

A full cross-encoder reranker is overkill at Oto's scale. The deterministic weighted score in Stage 3 is the right complexity level:

```typescript
function rerank(candidates: FactCandidate[]): RankedFact[] {
  return candidates.map(c => ({
    ...c,
    score:
      0.30 * c.exact_match_score +
      0.25 * c.vector_similarity +
      0.20 * c.confidence +
      0.10 * recencyDecay(c.last_reinforced) +
      0.10 * Math.log1p(c.evidence_count) +
      0.05 * c.topic_retrieval_priority,
  })).sort((a, b) => b.score - a.score);
}
```

Weights are tunable and become eval targets (§6). The point is that ranking is deterministic and testable — you can build a labeled retrieval set and measure precision@k. The current system can't, because there's no ranking to measure.

### 4.3 Retrieval evaluation

A labeled set of (query, expected_facts) pairs. Metrics: precision@3, recall@5, MRR. Run in CI against the eval platform (§6). This is the layer Doc 1 §3.4 said was entirely missing. Without it, "is retrieval good?" is unanswerable. With it, every weight change in §4.2 is measurable.

---

## 5. Subsystem 3 — Tool Registry

Single source of truth, versioned, lifecycle-aware. Direct fix for Doc 1 §3.2's six-sources-of-truth problem.

```typescript
// convex/oto/registry/tools.ts — THE source of truth
export const TOOL_REGISTRY = {
  get_vehicle_health: {
    version: "v2",
    state: "active",                   // proposed | active | deprecated | removed
    cache_zone: "stable",              // stable | volatile
    category: "data",
    schema: { /* Anthropic input_schema */ },
    handler: getVehicleHealthHandler,
    description_ref: "descriptions/get_vehicle_health.md",  // not inline — DRY
    deprecated_by: null,
  },
  // ... every tool
} satisfies Record<string, ToolDef>;

// Derived — nothing else is hand-maintained:
export const ACTIVE_TOOLS   = derive(TOOL_REGISTRY, t => t.state === "active");
export const STABLE_ZONE    = derive(ACTIVE_TOOLS, t => t.cache_zone === "stable");
export const VOLATILE_ZONE  = derive(ACTIVE_TOOLS, t => t.cache_zone === "volatile");
export const DISPATCH_MAP   = buildDispatch(TOOL_REGISTRY);
export const ANTHROPIC_TOOLS = toAnthropicSchemas(ACTIVE_TOOLS);
```

Properties:

1. **One file.** `TOOL_NAMES_V1`, `OTO_TOOL_CATEGORY`, the dispatcher switch, the field-parity contract — all derived, none hand-maintained. The "28 defined, 12 wired, 16 ghost" problem becomes structurally impossible: a tool that isn't in `DISPATCH_MAP` can't be `state: "active"`.

2. **Versioned.** Schema change → version bump → migration path. In-flight conversations with the old schema are detectable (audit log stamps tool versions) and handled.

3. **Lifecycle-aware.** `state: "deprecated"` tools still dispatch (for in-flight conversations) but aren't advertised to new turns. `state: "removed"` tools 400 with a clear error. No silent ghost calls.

4. **Cache zones.** `stable` tools (rarely change) get one cache breakpoint. `volatile` tools (iterating) get another. Editing a volatile tool doesn't invalidate the stable cache for every user. Direct fix for Doc 1 §3.1's monolith-cache problem.

---

## 6. Subsystem 4 — Evaluation Platform

Doc 1 §3.10: case definition, execution, inspection, and analysis are conflated into one browser tool. The north-star separates them.

```
oto-evals/
├── cases/                    # JSON, in repo, version-controlled
│   ├── diagnostic/
│   ├── booking/
│   ├── trust-protocol/
│   ├── retrieval/            # (query, expected_facts) — §4.3
│   └── jailbreak/            # adversarial corpus
├── runner/                   # Node CLI — runnable in CI
│   ├── run.ts                # executes cases, N repeats per case
│   ├── judge.ts              # LLM-judge assertions
│   └── persist.ts            # writes results JSON, commits baseline
├── analysis/
│   ├── stats.ts              # pass-rate CI, regression detection
│   └── ab.ts                 # two prompt versions, statistical compare
└── baselines/                # committed run history — trend lines
```

Four capabilities the current harness lacks, all production-standard:

1. **Per-case repeats with confidence intervals.** N≥5. A case that passes 70% and one that passes 99% are distinguishable. Regression detection is statistical: "is this run's distribution different from baseline beyond noise?"

2. **LLM-judge assertions.** For ambiguous cases (`"did the response naturally route to a booking without being pushy?"`), a judge prompt returns a structured verdict. Far more robust than substring matching. ~$0.50/run added cost. Worth it.

3. **CI-runnable.** Node CLI. Runs on every prompt-version PR. Baseline committed to git; the PR diff shows pass-rate deltas per case.

4. **A/B framework.** `system_prompt@v0.9` vs `@v0.10` against the same case set, statistical comparison. Every prompt change is measured, not vibed. This operationalizes the "Locked Principle #8" the prompt already references but can't currently enforce.

---

## 7. Subsystem 5 — Model Routing (deterministic)

Doc 1 §3.6 scored the current model-self-routing cascade 3.0/10. Replacement: deterministic server-side routing with model signals as input.

```typescript
function selectModel(turn: TurnContext): ModelDecision {
  const c = turn.control;

  // Hard stops (deterministic, non-negotiable)
  if (c.budget_spent_usd >= c.budget_cap_usd)
    return { model: "haiku", reason: "budget_exhausted", forced: true };
  if (c.escalation_count >= MAX_ESCALATIONS)
    return { model: "human_handoff", reason: "escalation_cap" };
  if (c.sonnet_turns_used >= c.sonnet_turn_budget)
    return { model: "haiku", reason: "sonnet_budget", forced: true };

  // Complexity heuristics (deterministic, tunable, eval-backed)
  if (turn.flow === "diagnostic" && turn.flow_turn_count >= SONNET_DIAG_THRESHOLD)
    return { model: "sonnet", reason: "diagnostic_depth" };
  if (turn.last_response_confidence < SONNET_CONFIDENCE_FLOOR)
    return { model: "sonnet", reason: "low_confidence" };

  // Model signal (input, NOT authority)
  if (turn.model_requested_sonnet && c.sonnet_turns_used < c.sonnet_turn_budget)
    return { model: "sonnet", reason: "model_requested" };

  return { model: "haiku", reason: "default" };
}
```

The model can emit `request_sonnet_handoff` — but it's a *signal* the router weighs, not a *command* it obeys. The router has final say, enforces budgets, and is fully testable (a confusion matrix over labeled turns). The thresholds (`SONNET_DIAG_THRESHOLD`, `SONNET_CONFIDENCE_FLOOR`) are calibrated against production telemetry post-launch, not guessed in a prompt.

This generalizes Architectural Principle #5: the model proposes, the system disposes — applied to model selection, not just data mutation.

---

## 8. Subsystem 6 — Trust Protocol (with reliable data)

Doc 1 §3.14: the protocol is architecturally correct but built on half-broken data. The north-star keeps the protocol design, fixes the foundation:

1. **`maintenance_records.confidence` becomes a typed enum** (`verified | self_reported | unverified | mechanic_confirmed`). The reader no longer collapses everything-not-verified to self_reported.

2. **Anchor-date calculation is correct** (the slug-drift fix from the v3 plan). The `due_soon`/`overdue` flags the protocol reasons against are reliable.

3. **Confirmation updates confidence + recency.** When a user confirms "yes my last brake service was March 14," the record's `confidence` becomes `mechanic_confirmed`-equivalent and `last_confirmed_at` is set. The next conversation knows it was confirmed recently and does NOT re-ask. This is the structural fix for the "re-asking frustrates users, kills trust" brand risk.

4. **Confirm/update rate is telemetered.** Every `render_record_confirmation` outcome (confirmed / updated / dismissed) writes to `conversation_audit` + a quality-signal aggregate. The protocol's whole point — calibrating data-form-hallucination rate — becomes measurable.

The protocol itself ("suggest, don't mutate," provenance-aware reasoning, render-confirm gate) is unchanged. It was right. The data underneath it gets made trustworthy.

---

## 9. Subsystem 7 — Cost Governance

Doc 1 §3.11 scored this 2.5/10 — the most exposed dimension. The north-star puts a budget gate between every Anthropic call and the model.

```
Turn starts
   │
   ▼
Budget Gate (deterministic, runs BEFORE Anthropic call)
   ├─ today_spend(user)      ≥ DAILY_USER_CAP?      → graceful cap message
   ├─ conversation_spend     ≥ CONVERSATION_CAP?    → graceful cap message
   ├─ platform_spend(24h)    ≥ PLATFORM_CAP?        → engineering alert + degrade
   └─ anomaly: this user's spend velocity > N·baseline → flag + throttle
   │
   ▼ (pass)
Anthropic call → cost computed from telemetry → written to conversation_control
   │
   ▼
Cost attribution: every dollar tagged (user, conversation, outcome)
   → "cost per booking" becomes a computed metric, not an aspiration
```

Launch defaults (from Doc 1 §3.11, restated as architecture):
- Daily per-user: $0.50 (~100 turns at $0.005)
- Per-conversation: $0.20 (forces convergence)
- Platform 24h: $50 launch, scales with MAU
- Anomaly: spend velocity > 5× user's trailing-7-day baseline → throttle + flag

The cap message is itself a designed surface: "I've hit my limit for today — but I saved everything we talked about. Pick this up tomorrow, or here's how to reach a human now." Calm, not punitive. Consistent with the brand.

---

## 10. Subsystem 8 — Observability

Doc 1 §3.9: telemetry written, never read. The north-star is a four-layer stack.

| Layer | Mechanism | Cadence |
|-------|-----------|---------|
| **Per-turn trace** | `conversation_audit` + `oto_telemetry` (kept) | Every turn |
| **Aggregation** | Scheduled Convex cron → `oto_metrics_hourly` rollup table | Hourly |
| **Dashboard** | Admin tab, time-series over rollups | On view |
| **Alerting** | Cron evaluates baseline-deviation rules → Slack `#oto-alerts` | Hourly |

The aggregation cron is the highest-leverage piece. It computes, hourly:
- Turn count, unique users, conversations
- Model split (Haiku / Sonnet / human)
- Cache-hit rate
- p50/p95/p99 latency
- Cost per turn, cost per booking, cost per active user
- Branch distribution (text / data-continue / terminal / forced-final)
- Error rate, JSON-parse-fail rate, escalation rate
- Trust-protocol confirm/update/dismiss rates

Alerting is rate-based, not event-based (Architectural Principle #3): "alert if escalation rate moves >2σ from trailing-7-day baseline," not "alert if an escalation happens." This is the correct observability model for a probabilistic system.

### 10.1 Quality signal (the hard one)

"Did the user get a good answer?" has no direct measurement. The north-star uses a composite:

```typescript
function sessionQualityScore(session): number {
  return weighted([
    [0.35, session.led_to_booking ? 1 : 0],
    [0.20, session.user_thumbs_down ? 0 : 1],
    [0.15, session.repeated_same_question_within_3_turns ? 0 : 1],
    [0.15, session.ended_with_resolution ? 1 : 0],
    [0.10, session.escalated_to_human ? 0.5 : 1],   // escalation isn't all-bad
    [0.05, normalizeTurnCount(session.turn_count)],  // too few or too many = worse
  ]);
}
```

No single proxy is trusted. The composite is tracked over time; a sustained drop is the signal that something regressed even when no eval case caught it. This is the bridge between synthetic eval and production reality.

---

## 11. Subsystem 9 — Context Engineering

What enters the prompt, what stays out, how it gets there. Mostly specified in §3.2 (working memory). The additional discipline:

1. **The State Contract is a type, not a convention.** `PromptSafeUserContext` (Doc 1 §3.7) is the only type that can enter a prompt-building function. VIN, email, phone are structurally excluded — a compile error, not a code-review catch.

2. **Untrusted input is wrapped and labeled.** When mechanic notes or user-generated content eventually flow into context (trust-protocol Phase 2), they're wrapped in `<untrusted_input source="...">` and the system prompt instructs the model to treat wrapped content as data, never instructions. (This is the v2 §8 defense, carried forward.) Sanitizer strips control characters and instruction-like patterns before wrapping.

3. **Context is budgeted, never unbounded.** §3.2's token budget. No code path adds to the prompt without going through `buildWorkingMemory`, which enforces the cap.

---

## 12. Subsystem 10 — The Prompt Architecture

Doc 1 §3.1: the prompt is excellent but a monolithic-cache monolith with no versioning and undocumented principles. The north-star:

1. **Layered cache.** Stable layer (identity, the 12 enumerated principles, tool schemas, banned phrasings) — one breakpoint. Volatile layer (flow-specific examples, tuning) — second breakpoint. Editing volatile doesn't invalidate stable.

2. **Version-pinned.** `SYSTEM_PROMPT_VERSION` constant, stamped into every `conversation_audit` row. "Which prompt produced this behavior" is a query, not git archaeology.

3. **The Twelve Principles are an enumerated artifact**, generated from annotations in `system_prompt.ts` into the canonical inventory (Architectural Principle #6). Cited by number, resolvable by anyone, never drifting.

4. **Tool descriptions are external files** referenced by the registry (§5), not inlined in the prompt. One source of truth for each tool's behavior. The prompt teaches policy; tools carry their own usage docs; no duplication.

---

## 13. Subsystem 11 — The Mobile Contract

Doc 1 §3.12: field-name strings duplicated three times, no compile guard. The north-star: one shared type module, imported by both sides.

```typescript
// convex/oto/contract.shared.ts — single source
export const ENVELOPE_FIELDS = [ /* ... */ ] as const;
export type EnvelopeField = typeof ENVELOPE_FIELDS[number];
export type ChatEnvelope = { text: string } & Partial<Record<EnvelopeField, unknown>>;
```

Mobile imports it. Backend imports it. The dispatcher's render-merge is typed against it. A typo (`quickReplys`) is a compile error. New render tools require adding to one list; forgetting any of the three sites becomes impossible because there's only one site.

---

## 14. Subsystem 12 — The Agent Boundary

The strategic question Temur asked me to challenge: **when does Oto stop being one agent and become a fleet?**

**The honest answer: not yet, and not for a while — but the seam should be designed in now.**

Oto today is one agent with many tools. The temptation as it grows is to split into specialized agents (a "diagnostic agent," a "booking agent," a "maintenance agent") coordinated by an orchestrator. **This is almost always premature and usually wrong for a product at Oto's stage.** Multi-agent systems add: inter-agent communication overhead, context-handoff loss, debugging complexity (which agent failed?), and cost (each agent is a model call). They earn their keep only when a single agent's context genuinely cannot hold the task — which is not Oto's situation. Oto's flows are sequential and share context; one agent with good memory beats five agents passing notes.

**However**, the architecture should be *factored* so the seam exists if it's ever needed:

- The reasoning loop is the agent. The tool registry, retrieval, and memory are services it consumes.
- If a future flow genuinely needs a separate agent (e.g., a long-running async "vehicle health monitor" that runs offline and pushes proactive notifications — a different lifecycle entirely), it consumes the *same* memory and retrieval services but runs its own loop.
- Inter-agent communication, if it ever happens, goes through the memory layer (shared `user_semantic_facts`), not through direct message-passing. Memory is the integration bus. This is the cleanest multi-agent pattern and it falls out for free from the §3 memory design.

**The strategic recommendation: stay single-agent through v1 and v2.** Revisit only when a flow appears whose *lifecycle* (not just whose *task*) differs from the synchronous chat loop — proactive monitoring is the likely first candidate, and it's post-launch. Designing the memory layer as the integration bus now means that future split is additive, not a rebuild.

---

## 15. The folder structure

What the codebase looks like under the north-star:

```
convex/oto/
├── orchestration/
│   ├── turn.ts                 # the action — 8-step pipeline
│   ├── identity.ts             # step 1: auth + State Contract
│   ├── budget_gate.ts          # step 2: cost governance
│   ├── working_memory.ts       # step 3: context build (budgeted)
│   ├── router.ts               # step 4: deterministic model routing
│   ├── reasoning_loop.ts       # step 5: Anthropic loop + dispatch
│   ├── persist.ts              # step 6: memory writeback
│   ├── telemetry.ts            # step 7: per-turn trace
│   └── quality_signal.ts       # step 8: post-hoc quality
├── memory/
│   ├── episodic.ts             # conversation_episodic
│   ├── facts.ts                # conversation_facts (append+retract)
│   ├── user_semantic.ts        # user_semantic_facts
│   ├── reference.ts            # vehicle_reference_facts (read-only for AI)
│   ├── control.ts              # conversation_control
│   └── audit.ts                # conversation_audit (append-only)
├── retrieval/
│   ├── classify.ts             # query classification
│   ├── hybrid.ts               # structural + semantic, always both
│   ├── rerank.ts               # deterministic weighted scoring
│   └── eval.ts                 # precision/recall harness hooks
├── registry/
│   ├── tools.ts                # THE tool registry
│   └── descriptions/           # one .md per tool — DRY
├── prompt/
│   ├── stable.ts               # cached layer 1 (identity, principles, schemas)
│   ├── volatile.ts             # cached layer 2 (examples, tuning)
│   └── version.ts              # SYSTEM_PROMPT_VERSION
├── trust/
│   └── protocol.ts             # provenance-aware gating
├── contract.shared.ts          # mobile ↔ backend types
└── lib/
    ├── auth.ts                 # authedQuery / authedMutation builders
    └── schema-types.ts         # the typed enums (no more free strings)

oto-evals/                      # separate from convex/ — CI-runnable
├── cases/  runner/  analysis/  baselines/

convex/crons/
└── oto_aggregation.ts          # hourly rollups + alerting
```

Each file has one owner concept. Each subsystem maps to one folder. "Where do I add a new tool?" → `registry/tools.ts` + one description file. "Where does memory race?" → it can't; check `memory/` for the single writer. The structure makes the architecture legible.

---

## 16. Recommended models, frameworks, services

| Concern | Recommendation | Rationale |
|---------|----------------|-----------|
| Primary model | Claude Haiku 4.5 | Right cost/capability for diagnostic reasoning |
| Escalation model | Claude Sonnet 4.x (current valid ID — verify) | Reasoning depth on hard diagnostic turns |
| Embeddings | `text-embedding-3-small`, version-pinned | Adequate at Oto's vector scale; cheap |
| Backend | Convex (held constant) | Transactional consistency is a memory-architecture asset |
| Vector index | Convex native | Adequate at scale; revisit only at 10M+ vectors |
| Eval execution | In-house Node CLI | Trace inspector is tighter than off-the-shelf for Oto's branching |
| Observability | In-house Convex cron + admin dash | Build-cost accepted to avoid vendor + data-residency (Doc 5 records this) |
| LLM-judge | Claude Haiku 4.5 (separate eval account) | Cheap, sufficient for binary verdicts |
| Prompt cache | Anthropic multi-breakpoint | Two zones: stable + volatile |

The honest note: **Observability is the one place I'd most seriously consider an external platform (Langfuse / Braintrust)** if the team grows past ~3 engineers or if conversation volume exceeds what an hourly cron comfortably aggregates. The in-house recommendation is right for *now*; it's recorded in Doc 5 as a revisit-trigger, not a permanent truth.

---

## 17. What this architecture buys, dimension by dimension

Mapping back to Doc 1's 14 scores — the target each subsystem reaches:

| Dimension | Doc 1 | North-star target | Driven by |
|-----------|-------|-------------------|-----------|
| System prompt | 8.5 | 9.5 | §12 (layered, versioned, principles enumerated) |
| Tool catalog | 6.0 | 9.0 | §5 (registry) |
| Conversation state | 4.5 | 9.0 | §3 (six-table memory) |
| Retrieval | 5.0 | 8.5 | §4 (real RAG) |
| Tool-use loop | 6.5 | 8.5 | §5 + typed accumulators |
| Model routing | 3.0 | 9.0 | §7 (deterministic) |
| Auth & boundaries | 3.5 | 9.0 | §15 lib/auth + §11 State Contract type |
| Schema discipline | 4.0 | 9.5 | §3 + lib/schema-types (typed enums) |
| Observability | 3.5 | 8.5 | §10 (four-layer stack) |
| Eval infrastructure | 4.5 | 9.0 | §6 (platform) |
| Cost governance | 2.5 | 9.0 | §9 (budget gate) |
| Mobile contract | 4.5 | 9.0 | §13 (shared types) |
| Render-trigger | 8.0 | 9.5 | §13 + preserved design |
| Trust protocol | 6.5 | 9.0 | §8 (reliable data underneath) |

Aggregate moves from **5.4 → ~9.0.** That's the gap Doc 4 (Migration Plan) sequences.

---

## 18. The honest caveat

This is the north-star. It is not a sprint plan. Three honest statements:

1. **Some of this is over-engineered for Oto's current scale and right for Oto's three-year scale.** The six-table memory model is more than a 5K-MAU product strictly needs. It is exactly what a 500K-MAU product needs, and migrating memory architecture at 500K MAU is brutal. Doing it now, at low scale, is the cheap moment. This is a deliberate "build for the scale you're migrating *to*, not the scale you're at" call.

2. **The greenfield-ideal genuinely diverges from this in two places** (vector DB, observability platform). I've held the substrate constant for defensible reasons (§1.2) but recorded the divergence honestly in Doc 5 so it's a conscious, revisitable choice — not an unexamined default.

3. **None of this is the launch.** The v3 plan ships Oto. This is what Oto becomes after it ships. Doc 4 sequences the migration so feature work never halts and no single step is a big-bang rewrite.

---

## 19. The bridge to Doc 3

Doc 3 — **Eleven Subagent Reviews** — pressure-tests this architecture from eleven independent specialist lenses. Each subagent reviews *both* the current state (Doc 1) and this north-star (Doc 2) from their discipline, scores both, and surfaces disagreements. Where two subagents disagree about a design call here, that disagreement is preserved as an explicit decision for the leadership team — not papered over.

The subagents most likely to challenge this document: the **Memory Systems Engineer** (is six tables right, or is it three with better typing?), the **AI Infrastructure Architect** (is holding Convex constant defensible, or is the vector-DB divergence underweighted?), and the **LLM Reliability Engineer** (does deterministic routing actually beat model-self-routing in practice, or does it just move the calibration problem?).

Those are the right fights to have. Doc 3 has them.

— End of Doc 2.
