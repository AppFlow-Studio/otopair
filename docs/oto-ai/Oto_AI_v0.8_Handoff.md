> **HISTORICAL DOCUMENT — v0.8.** Current runtime is v0.9. Read `Oto_AI_v0.9_Handoff.md` first. This document is kept for journey context (when the vehicle_facts KB, lookup_vehicle_spec, web_search, educational AI repositioning, multi-tool batching, and no-system-narration rule all shipped).

# Oto AI v0.8 — Session Handoff

| | |
|---|---|
| **For** | Next Claude session continuing Oto AI work |
| **From** | Claude (Cowork mode, this session) |
| **State** | v0.8 prompt + KB infrastructure + multi-tool batching + render-tool harness display all shipped. Eval baseline: 7/8 (same two persistent Decision-A loopholes from prior sessions). KB flywheel verified — facts persist and propagate by chassis/engine. |
| **Founder** | Waleed Mansour (mrdogsog@gmail.com) |
| **Canonical reference** | `docs/oto-ai/` in the workspace |

---

## Read this first

Canonical docs in `docs/oto-ai/`:
- `Oto_AI_Cached_System_Prompt_v0.md` — header changelog tracks versions; runtime body in `convex/oto/system_prompt.ts` is source-of-truth
- `oto-engine-inventory.md` — five-part inventory + four locked decisions + twelve principles
- `handoff-addendum.md` — locked Section 4.5
- `tool-inventory.md` — tool rationale + rejected + gaps
- `slug-drift-remediation.md` — kebab-case dead-taxonomy audit
- `Oto_AI_v0.6.2_Harness_Handoff.md` / `Oto_AI_v0.7_Handoff.md` — prior session handoffs

**Waleed's operating preferences** (locked across sessions):
1. One task per prompt
2. Direct answers, no padding
3. Push back when you disagree
4. Don't over-engineer — most bugs are one line
5. Investigation before implementation
6. Use existing Convex patterns

---

## v0.8 — what shipped this session

### Knowledge base (Locked Principle #5)

- **`vehicle_facts` table** with `vectorIndex("by_embedding", { vectorField, dimensions: 1536, filterFields: ["topic_axis", "topic"] })` + structural indexes on `vehicle_config_id`, `chassis_code`, `engine_code`, `(make, model, year_min)`, `(topic_axis, topic)`.
- **`convex/oto/vehicleFactsKB.ts`** — `lookupFactsStructural` (query, walks config → chassis → engine fallback), `lookupFactsSemantic` (action, uses vectorSearch), `insertFact` (mutation), `patchEmbedding`, `recordFact` (action; embeds via OpenAI if `OPENAI_API_KEY` is set, else falls back to text-only persistence), `embedText` (action).
- **`convex/oto/lookupVehicleSpec.ts`** — fuzzy-match comparison-car lookup against the catalog. Word-boundary matching (M5 doesn't substring-collide with M550i). Scores configs by model-name hit (weight 2) + trim-name hit (weight 1) across query tokens after stripping make tokens. Returns either a single matched config or candidates for disambiguation.
- **Three new data-category tools**: `lookup_vehicle_spec`, `retrieve_vehicle_facts`, **`record_vehicle_fact` is in state category** (not data — it's a side-effect write, see "Critical bug fix" below).
- **`web_search`** wired as Anthropic server-managed tool (header `anthropic-beta: web-search-2025-03-05`). Excluded from `OTO_TOOL_CATEGORY` (server-managed). Invariant check skips `SERVER_MANAGED_TOOL_NAMES`.

### Prompt v0.8

Major additions:
- **Tool batching section** with worked example (`get_vehicle_health` + `get_due_services` in parallel for "how is my car doing?"). Dispatcher already parallelizes via `Promise.all` — this teaches Haiku to emit batched tool calls.
- **KB workflow section** — lookup order: `retrieve_vehicle_facts` → catalog tools → `web_search` → training knowledge. Always `record_vehicle_fact` after producing any factual statement.
- **"No system narration" rule** — banned phrasings: *"the lookup"*, *"the catalog"*, *"came up empty"*, *"let me search"*, *"hit a quirk"*, *"out of scope for us"*. User has NO concept of internal tool state.
- **"User is booker not doer" rule** — banned: *"when you change the oil"*, *"after you bleed the brakes"*. Correct: *"the shop will use X"*, *"when it gets serviced"*.
- **Educational AI repositioning** — drop "refuse what you don't know"; the user can ask anything about cars; you have tools (KB, lookup, web_search) so refuse-silently is the wrong instinct.
- **Web search policy gates** — only when KB AND catalog both empty AND topic isn't pricing/inventory/recall/financing/legal. Always `record_vehicle_fact` after web_search with `cited_url` and `source: "web_search"`.

### Critical bug fix — record_vehicle_fact category

When Haiku emitted `text + record_vehicle_fact` in one response, the loop initially categorized record_vehicle_fact as a `data` tool → `data_continue` branch → swallowed the text → continued to iter N → iter N had nothing left to say → empty text → throw.

Fix: moved `record_vehicle_fact` from `data` to `state` category. State tools fire in parallel as side effects, don't gate loop continuation. The text alongside the call now becomes finalText cleanly on the same iteration.

### Loop hardening

- **Forced-final now bypasses ALL tools** (server-managed included). Previously the forced-final still passed `SERVER_MANAGED_TOOLS`, which could leave Haiku stuck calling web_search instead of emitting text. Now we hit Anthropic directly with `tools: []` and no `cache_control`.
- **No-text-no-render error → graceful fallback.** Instead of throwing "Anthropic returned no text and no render directives", returns *"I'm having trouble pulling that one together — can you rephrase…"* so the user gets a response and we can iterate the underlying issue separately.

### Harness — render tool ingestion

The harness now displays ALL render directives the dispatcher merges:
- `quickReplies` — clickable buttons (already existed)
- `showDiagnosticForm` — preview card (already existed)
- **NEW**: `showServicePicker` + `pickerServices` — service-list preview card
- **NEW**: `shops` — shop carousel preview rows
- **NEW**: `timeSlots` + `timeSlotsShopId` — time-slot chips
- **NEW**: `bookingSummary` — booking confirmation card
- **NEW**: `reasoning` — numbered reasoning steps
- **NEW**: `sources` — source citations

`chat.ts` now surfaces all render fields in the action return (was only `quickReplies` + `showDiagnosticForm` before). Mobile frontend gets the same payloads — Waleed can validate render-tool shape against the harness before mobile UI builds them.

### Diversity probing surfaced + fixed

Iterating on Waleed's oil-spec follow-up battery surfaced:
1. **"User is booker not doer" voice bug** — fixed via prompt rule (banned phrasings list).
2. **System narration leaks** — Oto saying *"the lookup hit a quirk in our catalog data"*. Fixed via prompt rule.
3. **Fuzzy-match substring collision** — `"M5"` was matching M550i model name. Fixed via word-boundary regex in `lookupVehicleSpec.ts`.
4. **record_vehicle_fact / text loop bug** — Fixed via state-category move (see above).

After fixes, the same 6-turn oil-spec battery runs cleanly: zero banned-phrase hits, multi-tool batching natural, KB grows organically (4 facts recorded across 6 probes — including a `web_search`-sourced fact for the M5 comparison).

---

## Open items

### Eval baseline — 7/8 passing

| Case | Status |
|---|---|
| `health_check_with_warning_light` | sometimes PASS / sometimes FAIL (the "thermostat" enumeration sneaks back under longer-response pressure) |
| `brake_narrowing_on_time_to_diagnostic` | **persistent FAIL** — Decision A loophole: Haiku still recommends direct Brake Pad Replacement on on_time brakes in some variants |
| All others | PASS |

Both remaining loopholes have been re-attempted multiple times with progressively stricter prompt rules and resist prompt-only fixes. **Documented as Sonnet-cascade calibration targets** (Phase 2, deferred per the vision-doc reasoning that the cascade needs TestFlight data to calibrate the complexity threshold).

### Drift still pending

- **Diagnostic enum drift** (5 sites): `lib/diagnostic-checklist-templates.ts` enum, `components/ai-chat/AIDiagnosticForm.tsx` labels, `convex/oto/tools.ts` schema, `convex/schema.ts` bookings column, `convex/oto/system_prompt.ts` Decision B mapping. Founder-stated canonical: `brake`, `tires`, `engine`, `Battery & electrical`, `not sure`. Open question: should enum values also rename, or only labels?
- **Catalog data thin** — only the user's M550i and a small set of BMW configs are seeded in `vehicle_configs`. Comparison-car lookups for popular cars (M5, M3, Tesla Model 3, Mercedes C63) return empty. Need enrichment pipeline run or seed expansion.
- **Embedding API key not set** — semantic KB search is wired but inactive until `OPENAI_API_KEY` is configured on the Convex deployment. Falls back to structural lookup until then.
- **Cap counter not implemented** — the 5/25/150 monthly question budget is defined in the vision doc but not enforced in code. Schema field, increment logic, envelope budget block, prompt cap-template — all next-session.
- **Source-of-truth markdown** — full byte-identical sync to v0.8 deferred (header now flags the discrepancy and points to `convex/oto/system_prompt.ts` as runtime source).

### Phase 2 (deferred per vision-doc reasoning)

- **Sonnet cascade** (the calibration target for the persistent eval loopholes)
- **Streaming responses** (first-token <600ms)
- **Polite-exit counter** wired (server-managed `diagnostic_turn_count` field exists; UI/UX integration pending)
- **RAG knowledge-base expansion** — Phase 2's first task is seeding popular makes/models

---

## File map — v0.8 changes

```
convex/schema.ts                                  [MOD]  +vehicle_facts table with vectorIndex, +diagnostic_turn_count col
convex/oto/system_prompt.ts                       [MOD]  v0.8 — educational, multi-tool batching, KB workflow, no-narration, booker-not-doer
convex/oto/tools.ts                               [MOD]  +lookup_vehicle_spec, +retrieve_vehicle_facts, +record_vehicle_fact (state), web_search excluded from category map
convex/oto/chat.ts                                [MOD]  +new callables, +SERVER_MANAGED_TOOLS for web_search, +loop hardening (state-only continuation, forced-final no-tools, graceful fallback), +all render fields in return
convex/oto/vehicleFactsKB.ts                      [NEW]  lookupFactsStructural, lookupFactsSemantic, insertFact, patchEmbedding, recordFact, embedText
convex/oto/lookupVehicleSpec.ts                   [NEW]  fuzzy-match comparison-car lookup with word-boundary matching
convex/ai_conversations.ts                        [MOD]  +setDiagnosticTurnCount (polite-exit counter)
scripts/oto-harness.html                          [MOD]  +runEval helper, +render-tool display for picker/shops/timeSlots/bookingSummary/reasoning/sources, +conversation history loading
scripts/oto-eval-cases.json                       [NEW]  8 golden cases
docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md     [MOD]  header updated with changelog (body still v0.6 snapshot — runtime is source)
docs/oto-ai/Oto_AI_v0.8_Handoff.md                [NEW]  this document
```

---

## Footguns to avoid

1. **`record_vehicle_fact` is a STATE tool, not data.** If you re-categorize it as data, Haiku's text-emitted-alongside gets swallowed by the loop. Keep it in `OTO_TOOL_CATEGORY` as `"state"` and in `STATE_TOOL_CALLABLE_NAMES`.

2. **Word-boundary regex needs proper escape.** The matcher in `lookupVehicleSpec.ts` uses `\b` for word-boundary matching. Special chars in tokens must be escaped or the regex will throw. The `escapeRegex` helper handles this; don't strip it.

3. **`web_search` is server-managed.** Don't try to dispatch it. Don't add it to `OTO_TOOL_CATEGORY`. Don't add it to `DATA_TOOL_CALLABLE_NAMES`. It's in `SERVER_MANAGED_TOOLS` (chat.ts) and that's the only place. The invariant check exempts it via `SERVER_MANAGED_TOOL_NAMES`.

4. **System narration is a recurring leak.** Haiku slips into *"the lookup"* / *"the catalog"* under pressure. The prompt rule helps but the eval check should catch any new variants — add to the `narration_keywords` array in test scripts when found.

5. **Loop iteration cap.** Currently 5. With KB workflow (retrieve → catalog → web_search → record), 5 iterations is tight. If you see "hit_cap" frequently in telemetry, consider raising to 7.

6. **Embedding-key fallback path.** If `OPENAI_API_KEY` is unset, `embedText` returns null and `recordFact` skips the embedding write. This is intentional — system runs structural-only. Make sure semantic-search tests don't false-positive when running without the key.

---

## What the next session should do

1. **Implement the cap counter** (the (c) from Waleed's directive — still pending). Schema field + period reset + envelope budget + prompt template.
2. **Refine the diagnostic enum drift** — sync labels + enum to founder-stated canonical (`brake`, `tires`, `Battery & electrical`, `not sure`).
3. **Seed comparison-car catalog data** — populate vehicle_configs for top 5 makes / popular trims so `lookup_vehicle_spec` doesn't constantly fall back to web_search.
4. **Phase 2 — Sonnet cascade scaffolding** — the persistent eval loopholes have proven prompt-resistant. Sonnet cascade is the calibration target. Build the routing mechanism even before TestFlight data lands.
5. **Run extended diversity probes** in the harness — explore symptom-narrowing variations, multi-vehicle users, mood transitions across long conversations.

---

## Sources — canonical first

- `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` (header is current; body is v0.6 snapshot — runtime is `convex/oto/system_prompt.ts`)
- `docs/oto-ai/oto-engine-inventory.md`
- `docs/oto-ai/handoff-addendum.md`
- `docs/oto-ai/tool-inventory.md`
- `docs/oto-ai/slug-drift-remediation.md`
- `convex/oto/system_prompt.ts` — v0.8 runtime prompt body
- `scripts/oto-harness.html` — read top-to-bottom; `window.__oto.runEval()`, `runVariation()`, `runSuite()` are the iteration loop
- `scripts/oto-eval-cases.json` — current eval set

---

*End of handoff. v0.8 closes the major architectural gaps in Oto's KB + lookup story. The system answers educational questions, records facts for future cache hits, batches tool calls naturally, and renders all six render-tool surfaces back through the chat action so mobile UI work is unblocked. Two persistent prompt-following loopholes resist further iteration — those go to Sonnet cascade.*
