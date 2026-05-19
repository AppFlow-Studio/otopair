# Oto AI — Doc 1 of 6: Current-State Forensics

**Author:** Principal AI Engineering, acting on AB / Temur's behalf  
**Date:** May 15, 2026  
**Scope:** Oto-only. `convex/oto/*` and the surfaces it touches.  
**Purpose:** Principal-engineer-level forensic audit of the current architecture as a *system*, not as a collection of files. Waleed's audit covered file-level findings; this document covers the architectural decisions those files instantiate and the systems-level consequences.  
**Audience:** Temur, Waleed, future contributors. Read this before Doc 2.

---

## 0. How this differs from Waleed's audit

Waleed's master audit is excellent and exhaustive at the file level — it tells you what is broken, where, and how to fix it. This document is different in three ways:

1. **Architectural lens, not file lens.** I am scoring decisions, not lines of code. The question is not "is `ai_messages.list` missing auth?" but "what does it mean that the auth model is per-function rather than per-table?"
2. **Severity by systems impact, not by launch readiness.** A bug that ships is more urgent than a flaw that scales badly. But a flaw that compounds with traffic is more dangerous over 12 months.
3. **Brutal on strategy, not just execution.** Several locked decisions are wrong. They get named here. This is the consulting engagement Temur asked for — anything else is theater.

The scoring rubric throughout: each dimension rated 1-10 against the question *"would a principal engineer at a top-tier AI infrastructure company sign off on this if Oto were their primary product?"* — not against "is this good enough to ship next week."

---

## 1. Executive verdict

**Aggregate score: 5.4 / 10**

Oto today is a thoughtfully-designed prompt running on a fragile substrate. The prompt itself is unusually disciplined. Everything around the prompt — auth, memory model, observability, eval rigor, schema discipline, retrieval architecture, cost governance — operates at "MVP that shipped" quality, not "production AI platform" quality.

The gap between prompt quality and platform quality is the most distinctive structural feature of the current system. It is not unusual to see this gap in pre-launch AI products. **It is unusual to see it described in handoff documents as "production-ready."** The system is launch-ready (after the 14-day plan in v3 executes). It is not production-quality.

The remainder of this document defends that verdict across 14 dimensions, then synthesizes the patterns into 5 systemic concerns that Doc 2 will architect against.

---

## 2. Dimensional scoring

| # | Dimension | Score | Direction of failure |
|---|-----------|-------|---------------------|
| 1 | System prompt as an artifact | 8.5 / 10 | Maintenance cost grows nonlinearly |
| 2 | Tool catalog design | 6.0 / 10 | Dead schemas, drift, no versioning |
| 3 | Conversation state model | 4.5 / 10 | Confused memory layers, untyped, race-prone |
| 4 | Retrieval / KB pipeline | 5.0 / 10 | Not RAG. A KV store with embeddings glued on. |
| 5 | Tool-use loop control | 6.5 / 10 | Branching logic works; failure paths leak |
| 6 | Model routing (Sonnet cascade) | 3.0 / 10 | Scaffolded, uncalibrated, telemetry-broken |
| 7 | Auth & data boundaries | 3.5 / 10 | Per-function model; security incidents waiting |
| 8 | Schema discipline | 4.0 / 10 | Five string-as-enum drift sites |
| 9 | Observability | 3.5 / 10 | Telemetry written, never read |
| 10 | Eval infrastructure | 4.5 / 10 | Cases exist; rigor doesn't |
| 11 | Cost governance | 2.5 / 10 | Unbounded. No cap. Wrong model metric. |
| 12 | Mobile ↔ backend contract | 4.5 / 10 | Field-name strings duplicated 3x, no compile guard |
| 13 | Render-trigger architecture | 8.0 / 10 | The strongest design call in the system |
| 14 | Trust protocol | 6.5 / 10 | Architecturally correct; data layer beneath it is broken |

Weighted by impact at 100x scale:

| Bucket | Weight | Avg |
|--------|--------|-----|
| Correctness & safety (1, 3, 7, 8, 14) | 35% | 5.4 |
| Performance & cost (5, 6, 9, 11) | 25% | 3.9 |
| Maintenance & velocity (2, 12) | 15% | 5.3 |
| Capability (4, 10, 13) | 25% | 5.8 |

**5.4 weighted.** This is what "MVP that shipped" looks like under a principal-engineer lens.

---

## 3. Dimension-by-dimension findings

### 3.1 System prompt as an artifact — 8.5 / 10

The prompt body in `convex/oto/system_prompt.ts` is the strongest single artifact in the codebase. It does eight things most production prompts skip:

1. **Banned phrasings as concrete strings.** Not "be calm" — *"Want me to pull up a Diagnostic Scan?"* is banned in favor of *"Want me to book a Diagnostic Scan?"*. This is the single highest-leverage prompt-engineering pattern at small-model scale.
2. **Contrastive examples.** Right way / wrong way pairings throughout the diagnostic and recommendation sections.
3. **Capability-honest framing.** The prompt tells the model what it *can't* do, repeatedly. "You don't walk through repair procedures." "You are the booker, not the doer."
4. **Mood-adaptive register shifts.** Voice changes when `mood: concerned` vs. `mood: curious`. Most prompts don't bother.
5. **Cross-section enforcement.** "Locked Principle #8 — never debate a prompt change based on vibes — only against the eval" produces visible discipline downstream.
6. **Defense-in-depth on recurring failures.** Voice-markup stripping happens server-side *after* the prompt forbids markdown — belt-and-suspenders.
7. **Trust protocol introduces a novel pattern.** "Suggest, don't mutate" + `record_provenance` field + `render_record_confirmation` tool together form a design pattern I haven't seen in production AI products. It's correct.
8. **Polite-exit counter.** The `<polite_exit_required>` block at turn-6 forces convergence on long narrowing loops. Subtle. Right call.

**The 1.5 points off the top:**

**(a) The 6,000-token prompt is a monolith.** Every byte invalidates the cache for every user. A prompt that needs to be edited frequently (and any prompt that's improving will be) at this size is structurally fragile. The cache strategy assumes the prompt is stable. The prompt's quality requires it to evolve. These two truths are in tension.

**Best practice:** layered prompts. Stable core (tool definitions, identity, banned phrasings) gets one cache breakpoint. Volatile examples + flow-specific rules get a second breakpoint. Edits to the volatile layer don't invalidate the stable layer. Anthropic supports multiple cache breakpoints; we use one.

**(b) "Twelve Locked Principles" cited but unwritten.** The prompt references principles by number (#5, #8) that don't exist as an enumerated artifact anywhere. Six of twelve have never been written down. This means:

- A new contributor (human or AI) reading the prompt cannot resolve "Locked Principle #5."
- Sonnet, when it reads the cached prefix, may interpret the principle from context. Different interpretations across runs = inconsistent behavior.
- When a prompt change needs to land, "does this violate Principle #N" cannot be answered without first reconstructing what Principle #N was.

**This is a single 4-hour fix** (enumerate them once) **that prevents months of compounding drift.** Already in v3 plan §D1.

**(c) No prompt versioning.** The cached system prompt has no version tag. Git history is the only record. When a regression appears in production, "what version of the prompt produced this behavior" cannot be answered without `git log` archaeology. A simple `SYSTEM_PROMPT_VERSION = "v0.9.3"` constant pinned at the top of `system_prompt.ts` + persisted in `oto_telemetry.system_prompt_version` would close this. The telemetry table already has the field; it's just never populated.

**(d) Tool descriptions duplicate prompt content.** `tools.ts` has tool descriptions that are 170+ lines for `get_vehicle_health` alone, half of which restates rules from the system prompt. Two sources of truth means two places to update; two places to update means drift. Either the prompt teaches the rules and tools have terse descriptions, or tools carry the rules and the prompt is leaner. Both is wrong.

---

### 3.2 Tool catalog design — 6.0 / 10

A tool catalog is a contract between three parties: the LLM (what it can call), the dispatcher (what it knows how to execute), and the schema (what the database supports). Oto's catalog is internally inconsistent across all three.

**The smoking gun.** `OTO_TOOLS` defines 28 tools. `TOOL_NAMES_V1` wires 12. The 16 "discoverable but uncallable" tools include `get_my_vehicles`, `get_shop`, `get_mechanic`, `find_available_slots`, `navigate_to_payment`, and `render_sources`. Haiku sees them in its cached schema set. Haiku will, eventually, call one. The dispatcher will not know what to do. The Block 4 invariant catches *ghost references in the prompt body* but does not catch *schemas without dispatcher cases*. Silent failure mode waiting to surface.

**The deeper issue.** Tool catalogs at production scale need three properties Oto's catalog lacks:

1. **Single source of truth.** Today: `OTO_TOOLS` (schemas), `TOOL_NAMES_V1` (wiring), `OTO_TOOL_CATEGORY` (categorization), the prompt body (description duplication), the dispatcher switch statement (execution), and the field-parity contract in `tools.ts:478-489`. Six places.

2. **Versioning.** Today: zero. When a tool's input schema changes (and the `vehicle_id` "is it VIN or Convex _id?" confusion shows it will), there is no migration path. Production conversations mid-flight with the old schema break.

3. **Lifecycle states.** A tool is one of: `proposed | wired | active | deprecated | removed`. Today, every tool is implicitly "active." The 16 unwired tools are de-facto `proposed` but indistinguishable from `active` ones at the LLM's API call site.

**What a correct tool registry looks like:**

```typescript
// One file. Single source of truth.
export const TOOLS = {
  get_vehicle_health: defineTool({
    version: "v2",
    state: "active",
    schema: { /* Anthropic input_schema */ },
    handler: async (ctx, args) => { /* dispatch */ },
    cache_zone: "stable",   // bumps invalidate stable cache; "volatile" doesn't
    deprecated_in_favor_of: null,
  }),
  // ...
} satisfies Record<string, ToolDefinition>;

// Anthropic sees only state==="active"
export const ACTIVE_TOOLS = filterActive(TOOLS);
// Dispatcher dispatches only state==="active"
export const DISPATCH = buildDispatchMap(TOOLS);
```

This is one file. It would close items #1, #4, and most of the description-drift in §3.1.

**Secondary findings:**

- **`render_quick_replies.id` uniqueness unenforced.** React-key collision footgun. Schema-level validator with a `uniqueItems` rule + a dispatcher-side guarantee closes it.
- **`render_service_picker` category enum doesn't match the catalog.** Mobile has 4 tabs, production has 7. Delegating the mapping to the model is fragile. The dispatcher should remap deterministically.
- **`vehicle_id` documented as VIN, implemented as Convex `_id`.** Multiple tools. The Block 4 invariant catches this in the prompt body, but tool descriptions in `tools.ts` are stale. A run of `git grep "vehicle_id.*VIN"` across the tools file will find every instance.

---

### 3.3 Conversation state model — 4.5 / 10

This is the dimension I have the most to say about, because it's where the architecture is genuinely confused.

**What exists today, as I understand it from the schemas:**

| Layer | Storage | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `ai_conversations.mood` | DB field | Haiku writes via `update_conversation_state` | Per-turn |
| `ai_conversations.arc_summary` | DB field | Same | Per-turn |
| `ai_conversations.established_facts` | DB field, array of strings | Same | Per-turn, capped at ~10-15 |
| `ai_conversations.last_user_intent` | DB field | Same | Per-turn |
| `ai_conversations.diagnostic_turn_count` | DB field | Convex action (`setDiagnosticTurnCount`) | Per-turn |
| `ai_conversations.current_model` | DB field | `setCurrentModel` mutation | Per-turn |
| `vehicle_facts` rows | DB table | Haiku writes via `record_vehicle_fact` | Permanent until retracted |
| `ai_messages` rows | DB table | Convex action persists | Per-turn |
| `recent_history` (last 10 turns) | Derived from `ai_messages` | Read per-turn | Sliding window |

**Nine layers of state. No clear boundaries between them.** Some are "memory" (facts the model should remember). Some are "control plane" (which model to use). Some are "audit log" (what was said). They live in the same table because Convex makes that cheap, but they have completely different semantics.

**The textbook memory architecture for a conversational AI system:**

| Layer | Lifetime | Source | Purpose |
|-------|----------|--------|---------|
| **Working memory** | Current turn only | Built from inputs | What the model sees in `<context>` right now |
| **Episodic memory** | Current conversation | Written during turn, read next turn | "What did we discuss in this session?" — arc summary, mood, established facts |
| **Semantic memory** | Permanent, user-scoped | Written across conversations, read on retrieval | "What do we know about this user?" — preferences, history, vehicle quirks |
| **Semantic memory (shared)** | Permanent, cross-user | Written across conversations, read on retrieval | "What do we know about vehicles in general?" — the KB, the moat |
| **Control state** | Current conversation | System mutation | Which model to use, escalation flags, cap counters |
| **Audit log** | Permanent | System mutation | Immutable record of what happened |

Oto's current implementation collapses episodic memory and control state into one table (`ai_conversations`), collapses semantic memory and the audit log into another (`ai_messages`), and has a third layer (`vehicle_facts`) doing semantic-shared memory correctly. **Two of the three layers are wrong.**

**Why this matters at scale:**

1. **Race conditions are baked in.** `ai_conversations.established_facts` is overwritten with the full new array on every turn (`REPLACE semantics`). Mobile-side appends via `appendEstablishedFact` race against Haiku's overwrite. The audit calls the race "benign" because of Anthropic latency. It is not benign — it is *currently invisible*. The first time a user double-taps a quick reply while Haiku is mid-turn, an established fact is silently dropped.

2. **No fact retraction.** When a user says "actually I was wrong, that was my other car," the established fact for the wrong car is never removed. It sits in the array until cap eviction (~10 entries) silently steers Haiku for the rest of the conversation.

3. **`established_facts` is untyped.** The field is `v.array(v.string())`. "selected mechanic_id: k57abc..." is in the same array as "user prefers closest mechanic." One is a structured ID reference; the other is a preference statement. The model has to parse them as strings. The downstream consumers (the next Oto turn) parse them as strings. **A schema that demands string parsing in two directions every turn is wrong.**

4. **Semantic memory is unscoped.** The `vehicle_facts` KB has no notion of "this fact was learned from this user's conversation" — every fact is universalized. If a user's mechanic told them "your 2020 BMW takes 6 quarts not 7," and Haiku records that as a fact, every other 2020 BMW user inherits the incorrect override. The schema has `propagated_from_id` for this but no propagation/scoping logic exists yet.

5. **No working-memory budget.** The envelope is built without token budgeting. `recent_history` is sliced to 10 turns, period. If those 10 turns contain a long diagnostic transcript, the envelope can blow past 2KB while the model has a 200K context. If they contain quick "thanks" exchanges, the envelope is tiny but the model loses important earlier context. **Token-aware history compression** is standard at this scale; it's missing here.

**What I'd recommend (sketched here, fully designed in Doc 2):**

- Split `ai_conversations` into three tables: `conversations` (audit), `conversation_episodic_memory` (mood, arc, intent, turn_count — all typed), `conversation_control` (current_model, cap_remaining, escalation_state).
- `established_facts` becomes a typed table: `conversation_facts` with `(conversation_id, fact_type, fact_payload_json, source_turn, retracted_at?)`. Fact types are an enum: `id_reference | preference | observation | hypothesis | user_quote`.
- Semantic memory gets two-layer scoping: `user_semantic_facts` (this user's prefs and history) and `global_vehicle_facts` (the KB). Cross-promotion from user → global requires explicit propagation logic (with anomaly detection — one user's mechanic saying "6 not 7 quarts" doesn't override the global fact).
- Working memory becomes a build function with a token budget: `buildWorkingMemory(state, budget_tokens) → envelope`. Compression of `recent_history` happens here.

This is a significant architectural change. It's also the single highest-leverage architectural change in the system.

---

### 3.4 Retrieval / KB pipeline — 5.0 / 10

The vehicle facts KB is described as "the moat" in handoffs. It is currently not a moat; it is a key-value store with embedding-based fallback. Calling it RAG is generous.

**What exists:**

1. `retrieve_vehicle_facts(topic, question_text, scoping)` — Haiku calls this when it has a factual question.
2. Lookup is three-tiered:
   - **Structural lookup 1:** `by_vehicle_config(vehicle_config_id, topic)` — exact match.
   - **Structural lookup 2:** `by_chassis(chassis_code, topic)` — chassis-scoped match.
   - **Structural lookup 3:** `by_engine(engine_code, topic)` — engine-scoped match.
3. If all three miss AND `OPENAI_API_KEY` is set, vector index search via `by_embedding` (1536-dim) with `filterFields: [topic_axis, topic]`.
4. If everything misses, Haiku calls `web_search` (Anthropic server-managed), gets a result, calls `record_vehicle_fact` to save it.

**Why this isn't RAG, and why it matters:**

Production RAG systems have five components Oto lacks:

| RAG component | Oto today | Why it matters |
|---------------|-----------|---------------|
| **Chunking strategy** | None — facts are stored as single strings | A "brake pads" fact is one string. If the user asks about brake pads AND rotors AND fluid, three separate retrieval calls are needed. No co-retrieval. |
| **Embedding model versioning** | `text-embedding-3-small`, hardcoded | When you upgrade the embedding model (and you will), every prior embedding is incomparable to new ones. Need versioning + reindex policy. |
| **Hybrid search (BM25 + vector)** | Structural lookup (effectively keyword) OR vector (when key is set) — never both | Hybrid is the strongest production retrieval pattern. Oto picks one based on whether a key is set, not based on what's better for the query. |
| **Reranking** | None | Top-N from vector search is fed directly to the model. A cross-encoder reranker (or even a lightweight rule-based one) would materially improve precision. |
| **Retrieval quality evaluation** | None | No precision@k, recall@k, or MRR measured against a labeled set. We don't know if retrieval is good. |

**The deeper architectural concern:**

The KB's design conflates two distinct things:

1. **Vehicle reference data** — oil capacity, brake pad part numbers, torque specs. This is *factual* and should come from authoritative sources (Vehicle Databases API, NHTSA, OEM manuals).
2. **Conversational facts** — "user mentioned brake squeal at low speed." This is *contextual* and ephemeral.

Both go into `vehicle_facts` today. The schema can't distinguish them. The retrieval can't distinguish them. The trust signals (`confidence`, `source: web_search | oto_inferred | propagated`) are doing double duty trying to fence the two.

**The fix:**

- Vehicle reference data → `vehicle_reference_facts` table. Source-of-truth is the enrichment pipeline. AI does NOT write to this table; AI only reads from it. Writes happen via the existing enrichment + verification pipeline. This isolates the moat to a clean dataset.
- Conversational facts → `user_semantic_facts` table (per §3.3 above). Per-user-scoped. Cross-user propagation requires explicit consensus logic.
- The KB-as-a-moat narrative is preserved through `vehicle_reference_facts` growing via the enrichment pipeline, not Haiku's `web_search` calls.

The current "Haiku does web_search, records fact, future Haiku turns hit cache" flywheel is a perpetual data-quality risk. A user asking "what oil does my BMW take" should hit reference data, not a Haiku-cached web search result. The flywheel is solving for cost reduction; the architecture is right; the data layer is conflated.

---

### 3.5 Tool-use loop control — 6.5 / 10

The `chat.ts` action's tool-use loop is one of the more thoughtful pieces of code in the system. The 3-bucket categorization (data / state / terminal), eager state dispatch via `Promise.all` before branching, and the state-only-no-text recovery path are correct production-AI patterns.

Two structural concerns:

**(a) The forced-final path silently degrades model selection.** When Sonnet hits `MAX_TOOL_ITERATIONS` and the loop fires the forced-final terminator, the call uses `MODEL` (= `HAIKU_MODEL`) instead of `turnModel`. This is a bug Waleed flagged. The *architectural* concern: there is no design-level statement of "what model gets the forced-final?" It's accidental, not specified. A correct design says either "always Haiku for forced-final because terminator messages don't need reasoning" OR "always whatever model started the conversation, for behavioral consistency." Specify the rule, then enforce it.

**(b) `accumulatedResults` accumulates loosely.** Render directives from iteration N can theoretically merge with terminal results from iteration N+1. The loop guards against this in practice (terminal breaks the loop), but the data structure doesn't enforce it. A future change to the branching logic could silently corrupt the merged envelope. **Use a discriminated union or per-iteration accumulator, not a single mutable array.**

Beyond these: the loop is solid. The empty-fallback text generation, the polite-exit counter integration, and the voice-markup strip-server-side are good defensive patterns.

---

### 3.6 Model routing (Sonnet cascade) — 3.0 / 10

This is the weakest dimension after cost governance. The Sonnet cascade is scaffolded — model routing tools exist, `current_model` field exists, per-turn read happens — but no part of it is calibrated, telemetered correctly, or bounded.

| Issue | Severity |
|-------|----------|
| Telemetry records wrong model (`MODEL` not `turnModel`) | **Critical.** The metric the cascade exists to calibrate is wrong. |
| No turn-budget cap on Sonnet | **High.** A pinned-to-Sonnet conversation runs unbounded cost. |
| No exit ramp guarantee | **High.** Sonnet "MUST call `request_haiku_handback`." Trusting model compliance for cost control is wrong. |
| `SONNET_MODEL = "claude-sonnet-4-6"` may not be a valid model ID | **Medium.** Could 404 at runtime. |
| No criteria encoded in code for "when to escalate" | **Medium.** Prompt says "~15-25% of diagnostic turns" but server has no guardrail. |
| Forced-final routes Sonnet turns back to Haiku silently | **Medium.** Already flagged in §3.5. |

**The architectural concern:**

Sonnet routing today is *model-driven escalation* — Haiku calls a tool to switch to Sonnet, Sonnet calls a tool to switch back. This is a known-fragile pattern. The model is being asked to reason about its own cost, which is metacognitive and unreliable.

The correct pattern is **deterministic model routing**, evaluated server-side before each turn:

```typescript
function selectModel(turn: TurnContext): "haiku" | "sonnet" {
  // Deterministic rules first
  if (turn.conversation.turn_count > SONNET_BUDGET_CAP) return "haiku";
  if (turn.conversation.escalation_count > 2) return "human";
  if (turn.intent === "diagnostic" && turn.turn_count >= 3) return "sonnet";
  if (turn.last_haiku_response.confidence < 0.6) return "sonnet";
  // Model can request escalation via tool, but server has final say
  if (turn.model_requested_sonnet && SONNET_BUDGET_REMAINING > 0) return "sonnet";
  return "haiku";
}
```

The model can *signal* it wants escalation, but the server *decides*. This is how every production AI system at scale handles routing — Cursor, GitHub Copilot, Perplexity, all do server-side routing with model-level signals as input. None give the model unilateral cost authority.

**What Oto should do:** Disable the cascade for launch (Haiku-only). The scaffolding is fine. Re-enable post-launch with deterministic server-side routing and TestFlight-calibrated rules. The current half-built cascade adds risk without value.

---

### 3.7 Auth & data boundaries — 3.5 / 10

The auth model is per-function, not per-table. This is the architectural smell that produced the 19 unauth'd functions Waleed found. The pattern is: each Convex function checks auth at its own discretion. New functions don't inherit auth; they inherit the *style* of older functions, which means whatever the original author of that file did.

**At scale, three things break:**

1. **New developers write new functions in established patterns.** The pattern in `ai_conversations.ts` and `ai_messages.ts` is "no auth check." That pattern will be replicated.
2. **Refactors lose auth.** When a function is split into two, the auth check is either duplicated (drift risk) or moved (one of the new functions has none).
3. **The security review is per-function, forever.** Every new function needs its own audit. The cost compounds.

**The architectural fix:**

```typescript
// convex/lib/auth.ts
export const authedQuery = (handler) => query({
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    return handler(ctx, args, user);
  },
});

export const authedMutation = (handler) => mutation({ /* same */ });

// Usage everywhere:
export const getConversation = authedQuery(async (ctx, args, user) => {
  const conv = await ctx.db.get(args.id);
  if (conv.user_id !== user._id) throw new Error("Forbidden");
  return conv;
});
```

This is 1 day of work. It moves auth from *per-function discipline* to *per-function-builder default*. The default becomes safe; opting into public access requires using a different builder (`publicQuery`), which is auditable.

Beyond auth: **the State Contract** (only `first_name + vehicle_id + display_string` reach the prompt) is genuinely strong. PII leakage into the model is constrained at the architecture level, not at the prompt level. This is correct. The contract should be enshrined as a type:

```typescript
type PromptSafeUserContext = {
  first_name: string;        // OK in prompt
  vehicle_id: Id<"vehicles">; // OK (opaque ID)
  vehicle_display: string;    // OK ("2020 BMW M550i")
  // VIN, email, phone, last_name, clerk_id: NOT in this type
};

function buildPromptContext(user: User): PromptSafeUserContext {
  return {
    first_name: user.first_name,
    vehicle_id: user.primary_vehicle_id,
    vehicle_display: composeDisplay(user.primary_vehicle),
  };
}
```

Now the type system enforces the State Contract. Any future engineer who tries to pass `user.email` into a prompt gets a compile error.

---

### 3.8 Schema discipline — 4.0 / 10

Five string-as-enum drift sites from Waleed's audit:
- `maintenance_records.confidence` — free string, code expects `"verified" | "self_reported" | "unverified"`
- `vehicle_facts.topic` — unbounded free string, will fragment
- `vehicle_owners.knownIssues` — `v.any()`, consumed as sentinel-prefixed string array
- `maintenance_records.lastServiceDate` — `union(string|number)` mid-migration
- `ai_conversations.current_model` — free string, only `"haiku" | "sonnet"` valid

**The architectural pattern:** Convex's schema language doesn't enforce string unions cheaply. Every `v.string()` becomes a TypeScript `string`, which silently accepts any value. The discipline of "the writer always writes valid values, the reader handles invalid values gracefully" is what's failed in production.

**The fix is type-level, not Convex-level:**

```typescript
// convex/lib/schema-types.ts
export const MaintenanceConfidence = v.union(
  v.literal("verified"),
  v.literal("self_reported"),
  v.literal("unverified"),
);
export type MaintenanceConfidence = "verified" | "self_reported" | "unverified";

// Then in schema.ts:
maintenance_records: defineTable({
  // ...
  confidence: MaintenanceConfidence,  // enforced at write time
  // ...
});
```

Convex's `v.union(v.literal(...))` *does* enforce at insert time. The five drift sites all use `v.string()` where they should use `v.union(v.literal(...))`. **This is a 2-hour fix for all five.** Waleed flagged it in Block B5 of the v3 plan.

Secondary concern: `vehicle_facts.topic` is fundamentally different from the others. The valid values are not a closed enum — new topics will be added as the KB grows. The fix here is a **controlled vocabulary** with a registration pattern: topics are added to a `kb_topics` table, and the `vehicle_facts.topic` field is a foreign key reference. This prevents fragmentation while allowing growth. More on this in Doc 2.

---

### 3.9 Observability — 3.5 / 10

`oto_telemetry` is written on every non-debug turn. **Nothing reads it.** No dashboards, no alerts, no aggregation queries. The data accumulates and is invisible. This is one of the most expensive architectural decisions in the codebase — not because writing is expensive (it's cheap) but because *every operational signal you would want to act on is being silently dropped on the floor.*

The architectural question is not "should we build a dashboard?" but **"what is the observability model for an LLM-driven system?"** This is different from traditional observability in three ways:

1. **Behavior is probabilistic.** A 5% rate of a behavior is signal, not noise. Traditional alerting ("alert if X happens") is wrong; the right model is "alert if the rate of X changes by more than Y standard deviations from baseline."

2. **Cost is non-uniform.** A 1KB user message can produce a 50KB conversation if tool-use loops + cascade fire. Per-turn cost variance is high. Traditional p50/p95/p99 latency thinking applies, but the *cost* distribution needs the same treatment.

3. **Quality is hard to measure.** Did the user get a good answer? Production signal is indirect: did they book, did they thumbs-down, did they ask the same question again two turns later, did they leave the conversation early. Each of these is a noisy proxy. The right approach is composite: a "session-quality score" combining 4-6 proxies.

**The right observability stack for Oto:**

| Layer | Tool | Owns |
|-------|------|------|
| **Per-turn traces** | Convex `oto_telemetry` (existing) — KEEP | Token counts, latency, tools called, branch, error |
| **Aggregation** | New scheduled cron in Convex — BUILD | Hourly rollups: turn count, model split, cache-hit %, error rate, p50/p95 latency, cost per booking |
| **Dashboards** | Admin tab in the existing admin dashboard — BUILD | Time-series visualization of aggregates |
| **Alerting** | Slack webhook from scheduled cron — BUILD | Trigger on baseline-deviation rules |
| **Quality signal** | New `session_quality_scores` table — BUILD | Composite metric per session, updated post-hoc |
| **Eval correlation** | Tie production traces to eval cases — BUILD | When a production turn matches an eval pattern, log the comparison |

This is a multi-week build but most of the value comes from the first two rows. **Item 1 (aggregation cron) is the single highest-leverage observability investment** — it turns a write-only table into a queryable analytical surface.

---

### 3.10 Eval infrastructure — 4.5 / 10

Waleed's audit covered the eval surface in detail (§5). The architectural takeaway:

The eval harness conflates four distinct concerns into one tool: case definition, test execution, result inspection, and statistical analysis. At MVP scale this is fine. At production scale these need to be separate layers:

| Concern | Current state | Production target |
|---------|---------------|-------------------|
| Case definition | JSON file in repo | Same — keep |
| Test execution | Browser-only harness | Node CLI runnable in CI |
| Result inspection | Browser console | Persistent run history (JSON to disk, committed) |
| Statistical analysis | In-memory bulk runner | Node-based analyzer with persistence |
| LLM-judge assertions | None | Critical for ambiguous cases ("did the response naturally route to a booking?") |
| Production replay | None | Tie production traces to eval inputs; replay against new prompt versions |
| A/B framework | None | Two prompt versions side-by-side, statistical comparison |

The biggest architectural miss is the *absence of LLM-judge assertions*. String-matching assertions (`text_contains: ["80"]`) are brittle. A judge prompt ("did this response invent any data not present in the context?" → yes/no with rationale) is the right pattern for the trust-protocol assertions and the "no invented data" guarantees the prompt makes.

Adding LLM-judge assertions is one architectural change away — the existing `runEval` framework can dispatch a judge call after each turn and assert on the judge's output. Total cost per eval run: ~$0.50 instead of ~$0.10. Worth it.

---

### 3.11 Cost governance — 2.5 / 10

Lowest score of the 14 dimensions. This is the place where the architecture is most exposed.

**What exists:**
- Cache strategy on system prompt + tools (good)
- Sonnet cascade scaffolding (uncalibrated)
- Per-turn telemetry capturing tokens + cost (written, unread)

**What doesn't exist:**
- Per-user daily cap
- Per-conversation cap
- Per-tier (free vs. paid) policy
- Cost alerting
- Cost-per-booking attribution (the "north star" metric is uncomputable)
- Anomaly detection on cost outliers
- Budgeting framework (planned monthly spend → daily cap → per-conversation cap)

**The architectural risk:**

A single user with a malicious or accidental looping conversation can rack up unbounded Anthropic cost. There is no rate limit. There is no daily cap. There is no detection of "this user has burned $50 in Anthropic charges in the last hour." Convex's request quotas would eventually trigger, but that's at the substrate level, not the cost level.

**The correct architecture:**

```typescript
// Per-turn cost gate, evaluated before Anthropic call
async function checkCostBudget(ctx, user_id, conversation_id) {
  const today_spend = await ctx.db.query("oto_telemetry")
    .withIndex("by_user_ts", q => q.eq("user_id", user_id).gte("ts", startOfDay()))
    .collect()
    .then(rows => rows.reduce((sum, r) => sum + r.cost_usd, 0));
  
  if (today_spend > DAILY_CAP_PER_USER) {
    throw new BudgetExceededError("daily_cap");
  }
  
  const conversation_spend = /* similar query, scoped to conversation */;
  if (conversation_spend > CONVERSATION_CAP) {
    throw new BudgetExceededError("conversation_cap");
  }
}
```

This runs every turn. Cost is in the telemetry table already; aggregation is cheap; the cap-counter logic is straightforward.

Defaults I'd recommend for launch:
- **Daily cap per user: $0.50.** At $0.005/turn, that's 100 turns. Generous. Below the abuse threshold.
- **Per-conversation cap: $0.20.** Forces conversations to converge. 40 turns at $0.005 is unusual; 40 turns at $0.05 is a runaway.
- **Per-day-platform cap: $50 launch, scaling.** Hard stop if total Anthropic spend in 24h exceeds threshold. Forces escalation to engineering before user-impacting cost surprise.

---

### 3.12 Mobile ↔ backend contract — 4.5 / 10

The render-directive contract is the place where the type system has the least to say. Field names are duplicated across `dispatcher.ts`, `chat.ts` return validator, and `chat.ts` return spread. A typo at the dispatcher (`quickReplys` instead of `quickReplies`) silently lands in the envelope and disappears at the client. Waleed flagged this in §1.

The architectural fix is well-known: **a shared type definition between mobile and backend.** Today they live in two places: `services/ai/types.ts` (mobile) and `convex/oto/dispatcher.ts` (backend). They drift. The fix:

```typescript
// convex/oto/types.shared.ts — single source, re-exported from both sides
export const ChatMessageEnvelopeFields = [
  "shopCarousel",
  "showServicePicker",
  "pickerServices",
  "pickerPreSelectedId",
  "showDiagnosticForm",
  "showRecordConfirmation",
  "timeSelector",
  "bookingConfirmation",
  "quickReplies",
  "reasoning",
  "sources",
] as const;
export type ChatMessageEnvelopeField = typeof ChatMessageEnvelopeFields[number];

export type ChatMessageEnvelope = {
  text: string;
} & Partial<Record<ChatMessageEnvelopeField, unknown>>;
```

Now a typo at the dispatcher would not type-check. Mobile imports the same type. Drift becomes impossible.

This is a 2-hour refactor. It closes a class of bugs that will otherwise show up over the next 6 months as new render tools are added.

---

### 3.13 Render-trigger architecture — 8.0 / 10

The strongest single design decision in the system. Oto says "render the shop carousel" (intent), mobile says "OK, I'll fetch the data and draw it" (execution), and the user owns the mutation (selecting a slot, tapping book). Three properties:

1. **AI doesn't know what the data looks like at render time.** It can't hallucinate shop names, ratings, or availability — they're loaded by the client from real Convex queries.
2. **AI doesn't perform the mutation.** The booking is created by the client, by the user's tap.
3. **AI's only failure mode is "wrong tool" or "right tool, wrong moment."** It cannot corrupt data.

This is exactly right. It is the v2 "Suggest, don't mutate" principle, implemented well, before v2 named it.

The 2 points off the top: **field-parity is brittle** (covered in §3.12) and **the mobile components don't all exist yet** (the v3 launch blocker — `<AIShopCarousel>`, `<AITimeSelector>`, `<AIBookingConfirmation>` are missing). Once those land, this dimension scores 9.5.

---

### 3.14 Trust protocol — 6.5 / 10

Architecturally correct. Implementation half-built.

The protocol's premise is that maintenance records have varying provenance (`verified` = mechanic-confirmed, `self_reported` = user-stated, `unverified` = inferred). Oto must distinguish them in its reasoning: confirmed records can be acted on; self-reported records get a trust gate (`render_record_confirmation`) before Oto acts on them.

This is correct. It's also the only place in the system where AI is doing genuine epistemic reasoning about source quality. That's a meaningful architectural contribution.

**Why 6.5 not 9:**

1. **`maintenance_records.confidence` is a free string.** The protocol's whole architectural value depends on this being a closed enum. §3.8 above.
2. **Slug drift in `maintenance_pipeline.ts` breaks anchor-date calculation.** The data the trust protocol reasons against is itself unreliable. Trust protocol on top of half-broken data = users get re-asked the same confirmation questions across conversations because the system doesn't know they confirmed last time.
3. **No telemetry on confirm vs. update rates.** The protocol's whole point is calibrating data-form-hallucination rate. That metric is currently invisible.
4. **The `confirmedHealthyAt` confirm path doesn't update `confidence`.** "User confirmed in chat 2 days ago" is indistinguishable from "user did onboarding 6 months ago" in the next turn's reasoning.

All four are fixable. Fix them and the trust protocol becomes the strongest part of the system. Leave them and it becomes a brand-damage vector — users frustrated by being re-asked, telemetry blind, the system unable to learn from its own confirmations.

---

## 4. Five systemic concerns (synthesis)

Across the 14 dimensions, five patterns recur. These are the systemic concerns Doc 2 will architect against.

### Systemic concern #1 — Untyped boundaries

Every place where Oto fails at scale, an untyped boundary is the proximate cause:

- Field-name strings duplicated across mobile and backend → renders silently drop
- `string` instead of `union(literal(...))` → schema drift
- `established_facts: v.array(v.string())` → memory race conditions + parse-twice tax
- Tool-name strings in `OTO_TOOL_CATEGORY`, `TOOL_NAMES_V1`, and the prompt → drift between what's discoverable and what's wired
- `topic` strings in `vehicle_facts` → KB fragmentation

**The fix is a discipline, not a single change:** Every cross-system or cross-table identifier becomes a typed enum or a typed reference. No exceptions. Convex makes this affordable; the team hasn't been spending the affordance.

### Systemic concern #2 — Conflated state layers

The system has six conceptually distinct kinds of state (working memory, episodic memory, user semantic memory, global semantic memory, control state, audit log) collapsed into three tables (`ai_conversations`, `ai_messages`, `vehicle_facts`). The collapse creates race conditions, scoping bugs, and unclear ownership.

**The fix is a memory architecture redesign.** Doc 2 specifies six tables with explicit ownership and lifecycle.

### Systemic concern #3 — Probabilistic systems treated as deterministic

The eval suite runs each case once. Sonnet cascade is governed by model self-routing. Telemetry is captured per-turn but never aggregated. Banned-phrase assertions are substring matches. **The system is probabilistic in every layer but the engineering treats it as deterministic.**

**The fix is to introduce probabilistic discipline at every layer:**
- Eval: per-case repeats with pass-rate thresholds
- Routing: deterministic server-side rules with probabilistic model-driven signals as input
- Observability: rate-based alerting, not event-based
- Quality: composite proxies, not binary

### Systemic concern #4 — Cost as an afterthought

No cap, no budget, no per-user limit, no cost-per-booking metric, no anomaly detection. The cache strategy is sound; everything else is "we'll add it later." The Sonnet cascade is a particularly acute version of this — model self-routing means the model is the cost controller, and the model is not a reliable cost controller.

**The fix is a cost-governance layer that sits between every Anthropic call and Convex.** Doc 2 designs this.

### Systemic concern #5 — Documentation as oral tradition

The Twelve Locked Principles cited 20+ times, written down zero times. The Five Locked Decisions citing "A/B/C/D" with no Decision E mentioned anywhere. The Cached System Prompt v0 doc being a v0.6 fossil. The trust protocol's four new design artifacts cited in code but not catalogued.

**The fix is brutal: a single canonical inventory document that is built from the code, not maintained alongside the code.** Auto-generated from annotations in `system_prompt.ts`, `tools.ts`, and `schema.ts`. When the code changes, the doc regenerates. Documentation drift becomes structurally impossible.

---

## 5. What I will not be revisiting in Doc 2

To set the boundaries of the next document, two architectural decisions are confirmed correct and will not be re-architected:

1. **The render-trigger architecture.** "AI names intent, frontend pulls data, user owns mutation" is right. Doc 2 will extend it (typing the contract), not rebuild it.

2. **The State Contract (PII minimization in prompts).** "First name + opaque vehicle ID + display string" is right. Doc 2 will enforce it via the type system, not weaken it.

Everything else — memory model, retrieval pipeline, model routing, cost governance, schema discipline, observability, eval infrastructure, tool catalog, conversation state — is in scope for redesign.

---

## 6. The bridge to Doc 2

Doc 2 — **The North-Star Architecture** — answers the question: *if Oto were being built today, with no prior commitments, what would the architecture be?*

It will specify, in detail:

- The memory architecture (six tables, six lifecycles)
- The retrieval pipeline (real RAG, not KV-with-embeddings)
- The tool registry (single source of truth, versioned, lifecycle-aware)
- The model routing layer (deterministic server-side)
- The cost governance layer (caps, budgets, anomaly detection)
- The observability stack (aggregation, dashboards, alerting, quality scores)
- The eval platform (CI-runnable, statistical, LLM-judge-enabled, A/B-capable)
- The schema discipline (typed enums everywhere)
- The mobile contract (shared types, compile-time guarded)
- The prompt architecture (layered caching, version-pinned, auto-generated docs)
- The trust protocol (with reliable data underneath)
- The agent boundary (when does Oto stop being one agent and become a fleet)

Doc 2 is greenfield. Doc 4 (Migration Plan) maps from current state to Doc 2's target. The pragmatic path doesn't lose sight of the ideal, and the ideal doesn't ignore the constraints.

---

## 7. Closing read

The honest summary of Oto's current state is this:

**Waleed built more than the architecture could support.** The prompt quality, the trust protocol, the render-trigger design — these are at the level of someone who's thought deeply about the AI layer. The substrate beneath them — auth, schema, observability, cost, memory — is at the level of "MVP that shipped, we'll fix it later." The mismatch is what makes the system feel impressive and brittle at the same time.

This is a fixable shape. None of the 14 dimensions are structurally lost. Most can be brought to 7.5+ with focused effort. The dimensions where the current architecture is wrong (memory, routing, retrieval) are the dimensions where the fixes are most architecturally interesting — and most worth doing now, before the system has 10x or 100x the users to migrate.

Doc 2 starts on your next turn. Tell me to proceed, or push back on any of the 14 dimensional scores first.

— End of Doc 1.
