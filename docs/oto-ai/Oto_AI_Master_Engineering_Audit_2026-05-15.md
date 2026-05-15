# Oto AI — Master Engineering Audit

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Branch** | `Waleed-Dev` (in-flight Trust Protocol work + 200+ unrelated changes) |
| **Audited surface** | Every file in `convex/oto/`, `components/ai-chat/`, `app/(main-tabs)/ai-chat/`, `services/ai/`, Oto-relevant slices of `convex/schema.ts`, `convex/ai_conversations.ts`, `convex/ai_messages.ts`, `convex/maintenance*.ts`, `utils/maintenance*.ts`, `hooks/`, `stores/`, `scripts/oto-harness.html`, `scripts/oto-eval-cases.json`, every doc in `docs/oto-ai/`, the prompt body in `convex/oto/system_prompt.ts` |
| **Author** | Lead engineer + 6 specialist subagents |
| **Audience** | Senior engineering team reviewing Oto AI for ship readiness |
| **Length** | ~30,000 words. Long because the brief was "every letter accounted for." |

---

## How to read this document

The audit is partitioned across **six specialist sections**, each produced by a subagent with sharply-bounded scope. Then a **cross-cutting findings** section synthesizes findings that span multiple sections, and a **prioritized recommendations** section ranks the work. Each section is self-contained; you can read them in any order, but the executive summary and cross-cutting sections are the highest-leverage if you only have 30 minutes.

The six specialist sections:

1. **Backend (Convex)** — `convex/oto/*`, the Anthropic-facing chat loop, dispatcher, system prompt body, data tools, KB, telemetry.
2. **Mobile / Frontend** — `components/ai-chat/*`, `app/(main-tabs)/ai-chat/index.tsx`, `services/ai/types.ts`, the legacy rule engine, the wire boundary.
3. **Data Layer** — schema rows Oto reads/writes, `ai_conversations.ts`, `ai_messages.ts`, `maintenance.ts`, the pipeline, indexes used vs. wasted, schema consistency.
4. **Documentation & Design Rationale** — every `docs/oto-ai/*.md`, the system prompt as a design artifact, the Five Locked Decisions, the Twelve Locked Principles.
5. **Test Infrastructure & Eval Coverage** — `oto-harness.html`, `oto-eval-cases.json`, the bulk runner, telemetry as ops surface, what's missing for proper LLM-system testing.
6. **Operational State & Open Issues** — what shipped at v0.9, what's in flight, what's deferred, production-readiness scoring, launch risks.

---

## Executive summary

**The headline.** Oto AI v0.9 is a beautifully-engineered vertical slice on a narrow, well-defined surface — symptom diagnosis + maintenance reasoning + the booking flow's first half — built on top of a backend that has accumulated meaningful technical debt and surrounded by documentation that has fallen behind reality. The trust-protocol work in flight is the right next architectural layer, but it's half-built; the system-prompt rewrite landed but the eval-case rewrite and the canonical documentation update are pending. **Roughly 35% of the way to "fully-fledged AI integrated with all of OtoPair"** by surface coverage; closer to 55% if weighted by user impact since the integrated surfaces are the highest-traffic ones.

**What's strong:**

The prompt itself is, line for line, a quality production system prompt — strong banned-phrasings discipline, defense-in-depth on recurring failure modes, honest capability framing, calibrated registers, tight examples. The voice rules and trust protocol are particularly well-designed. The render-trigger architecture (Oto names intent, frontend pulls data and owns mutations) is the right call. The flywheel design (KB grows from web_search calls, future users hit cache) is the right unit-economics story. The Twelve Locked Principles are doing real work in the prompt — Decision A's "no symptom-to-service shortcut" rule is the kind of guardrail most founders skip until they get burned. The trust protocol's `record_provenance` field + the "Suggest, don't mutate" safety rule close a class of bug that would have bitten in production. The eval case set grew 9 → 31 cases this session with statistical-rigor analyzer infrastructure built (in-memory only, but built).

**What's broken or fragile, in priority order:**

1. **Booking flow stages 4–6 don't render on mobile.** `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation` envelope fields now reach the message envelope (post-fix) but no mobile components consume them. Haiku fires the tools server-side; the user sees nothing. **Hard launch blocker.**
2. **`ai_messages.list` is an unauthenticated full-table scan.** Single call exfiltrates every conversation message in the deployment. **Security incident in waiting.**
3. **Multiple unauthenticated mutations** across `ai_conversations.ts`, `ai_messages.ts`, `maintenance.ts`, `telemetry.ts`, `vehicleFactsKB.ts:patchEmbedding`. Read-by-id leaks and write-by-id corruption are possible from any authenticated client.
4. **The Twelve Locked Principles do not exist as an enumerated artifact anywhere in the repo.** Cited by number across every handoff. Six of twelve are uncited entirely. **Every reference is a dangling pointer.**
5. **The "Cached System Prompt v0" doc is a v0.6 fossil with a v0.9 changelog stapled on.** Its body has been wrong since v0.7. The README claims it's the source of truth.
6. **`render_support_form` is fully described in the prompt, prompts Haiku to call it, has no schema and no dispatcher case.** Haiku will hallucinate calls to a non-existent tool. The Block 4 invariant in `chat.ts` should catch this but it logs to console — likely silent in production.
7. **Diagnostic enum drift** (`brakes` / `tires_wheels` / `engine` / `battery_electrical` / `not_sure` codebase enum vs. founder-canonical labels) has been an open task in every handoff for 8 months. Five files still need reconciliation.
8. **Slug-drift in `maintenance_pipeline.ts` and `bookings.ts` silently breaks anchor-date calculation.** The data feeding Oto's `record_provenance` reasoning is itself unreliable. Trust protocol is half-built on top of unreliable data.
9. **Sonnet cascade telemetry records the wrong model.** The metric the cascade exists to calibrate against is wrong. Forced-final path silently re-routes Sonnet turns to Haiku.
10. **`vehicle_facts_kb` topic strings are uncontrolled free strings** with no normalization. KB will fragment as soon as multiple Haiku calls write the same concept under different topic names. The "moat" depends on this not happening.
11. **Eval runner cannot express tool-input shapes, render envelope content, tool-call ordering, per-iteration assertions, or cross-turn branching.** The bulk-runner repeats are in browser memory only — no persistence, no history, no CI.
12. **No production observability dashboards.** The `oto_telemetry` table writes per turn but nothing reads it. Cap counter not built. Cost variance is uncapped.

**What's deferred and shouldn't bite at launch (per founder direction):**

Streaming (Phase 2), `OPENAI_API_KEY` for semantic KB (defer until KB has enough content to matter), Sonnet cascade calibration (awaits TestFlight data), `@convex-dev/rag` migration (cleanup), photo/voice/voice-mode integration.

**The honest single-number readiness score:**

For a v1 launch on the booking flow alone: **~55%** with the mobile renderers (Task #22) being the biggest missing piece.
For a "fully fledged AI integrated with all of OtoPair" vision: **~35%**.
The integration matrix is mostly white space — onboarding, check-in, reviews, rewards, mechanic-side workflows, billing, payments, photos, voice, real-time vehicle data are all not yet AI-touchable.

**The single highest-leverage fix:** build the three missing mobile components for `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation` (Task #22). This unblocks the booking chain end-to-end on real devices. Estimated 1 day of focused work.

**The single highest-leverage docs fix:** enumerate the Twelve Locked Principles in `oto-engine-inventory.md`. Until this exists, every `Locked Principle #N` citation is unverifiable.

---

## Section 1 — Backend (Convex) Audit

## File-by-file review

### `convex/oto/tools.ts` — tool catalog & schemas

**Purpose.** Source of truth for every Anthropic tool schema (`OTO_TOOLS`), the per-tool category lookup (`OTO_TOOL_CATEGORY`), and the canonical 23 service slugs / 7 categories. Lives in the Anthropic cache zone — a byte change invalidates cache for all users on the next request.

**Public surface.**
- `OtoToolSchema` (interface), `OTO_TOOLS: OtoToolSchema[]`, `OTO_TOOL_NAMES: string[]`
- `OtoToolCategory = "data" | "state" | "model_routing" | "render" | "navigation"`
- `OTO_TOOL_CATEGORY: Record<string, OtoToolCategory>`
- `OTOPAIR_SERVICE_SLUGS` (`as const`), `OtopairServiceSlug` type
- `OTOPAIR_SERVICE_CATEGORIES`, `OtopairServiceCategory` type

**Internal grouping.** `DATA_TOOLS`, `STATE_TOOLS`, `MODEL_ROUTING_TOOLS`, `RENDER_TOOLS`, `NAVIGATION_TOOLS` are concatenated in a fixed order at `tools.ts:738-744` — order is intentionally part of the cached prefix.

**Code quality.** Tool descriptions are unusually long and prescriptive (e.g. `get_vehicle_health` at lines 251 spans ~170 lines of guidance, half of which duplicates what's already in the system prompt). This bloats the cached system+tools block and makes calibration slow — a 1-character edit anywhere here invalidates the cache for *every* user. Schemas are stable; the rationale comments around each tool are excellent.

**Bugs / smells.**
- **`render_quick_replies` `id` field uniqueness is not enforced** (`tools.ts:642-649`). The schema only requires `id` + `text`, no constraint that ids be distinct. Mobile-side keying off duplicate ids is a known React footgun.
- **`render_service_picker` carries a category enum that doesn't match the catalog** (`tools.ts:534-544`). The code admits the mobile component only has 4 tabs (`maintenance | tires | brakes | diagnostics`) but production has 7 (`Diagnostics | Compliance | Routine Maintenance | Tires | Brakes | Battery | Fluids`). A comment explains the dispatch-time mapping is supposed to happen, but in `dispatcher.ts:168-180` the dispatcher does NOT remap — it forwards `services` straight through. Haiku is told "map per the comment," which is delegating mapping to the model — fragile.
- **`render_service_picker` lists `id: "Service slug (kebab-case)"`** in the items schema (`tools.ts:531`) immediately after `tools.ts:806-808` warns that kebab-case is dead. Drift inside the same file.
- **`render_quick_replies` description claims "calling this tool ENDS YOUR TURN"** (`tools.ts:632`). The chat loop categorizes it as `terminal` (`render`), so it does end the turn. But other render tools have the same property and don't say so — inconsistent guidance.
- **`get_vehicle_health.vehicle_id` is documented as "VIN"** (`tools.ts:257`). It is not — it's a `vehicles._id` (per `vehicleHealth.ts:175-181`). Same wrong description on `get_due_services` (`tools.ts:87`), `lookup_vehicle_spec` (n/a), and `navigate_to_payment.vehicle_id` (`tools.ts:726`). Haiku is being told to pass a VIN when the dispatcher resolves a Convex doc id. This is one of the older drift footguns the codebase has visibly fought (see Block 4 invariant in `chat.ts:189-208`); the descriptions never got updated.
- **`get_my_vehicles`, `list_service_categories`, `get_shop`, `get_shop_services`, `get_shop_hours`, `get_mechanic`, `get_my_mechanics`, `get_reviews`, `find_available_slots`, `get_rewards_summary`** all appear in `OTO_TOOLS` and `OTO_TOOL_CATEGORY` but are **NOT** in `TOOL_NAMES_V1` in `chat.ts:82-110` — they are dead in production. The cache block carries ~10 schemas Haiku is allowed to hallucinate against but can never invoke. The Block 4 invariant (`chat.ts:190-208`) explicitly checks the *prompt* for ghost references but doesn't catch the inverse — schemas in `OTO_TOOLS` that aren't wired don't trip a warning. Either the missing tools are legitimately backlog, in which case they shouldn't be in the cached schema set, or they're wired but `TOOL_NAMES_V1` was forgotten.

---

### `convex/oto/chat.ts` — the action

**Purpose.** Single-action entry point (`api.oto.chat.sendMessage`). Auth → load context → build envelope → tool-use loop with per-iteration model selection → forced-final on cap → render-merge → persist → telemetry.

**Public surface.** `export const sendMessage = action({...})`. Args: `conversationId`, `message`, `vehicleVin?`, `debug?`, `debug_skip_persist?`. Return: text + every render directive field (all optional).

**Internal helpers.** `sendMessageHandler`, `callAnthropic`, `buildCallables`, `stripVoiceMarkup`. Module-load invariants (lines 139-209) enforce schema/handler/prompt parity.

**Strengths.**
- The 3-bucket categorization at `chat.ts:486-496` (data / state / terminal) is clean. State tools fire eagerly via `Promise.all` *before* branching (`chat.ts:500-503`), so persistence happens even if the rest of the response throws. Good defensive ordering.
- The state-only-no-text recovery at `chat.ts:568-578` is genuinely thoughtful — handles a real failure mode (Haiku emits only `update_conversation_state` and no text) by feeding the ack back and looping rather than returning empty text.
- Block 4 invariant (`chat.ts:190-208`) — running `RegExp("`" + candidate + "`")` against the prompt catches drift at module load. Strong pattern.
- Forced-final terminator (`chat.ts:615-657`) guarantees the conversation always emits text even if the cap is hit, which is the right call vs. throwing.

**Bugs / smells.**
- **Forced-final uses `MODEL`, not `turnModel`** (`chat.ts:628`). When a Sonnet turn hits MAX_TOOL_ITERATIONS, the forced final response is silently routed back to Haiku. The comment block at `chat.ts:64-69` documents `MODEL = HAIKU_MODEL` as a "default when current_model is unset"; using it in the forced path means a runaway Sonnet turn loses its model selection mid-flight. Probably benign for cost, but it's a model-routing leak.
- **Telemetry uses the wrong model field too** (`chat.ts:835`) — `model: MODEL` instead of `model: turnModel`. Telemetry will under-report Sonnet usage. This is the metric you'd want most accurate, since it's the cost-per-booking signal feeding Locked Principle #2 calibration.
- **`vehicleVin` is named "vehicleVin" but treated as VIN** correctly here, while `tools.ts` documents `vehicle_id` as VIN. Naming inconsistency between the public API arg and the tool surface.
- **Re-reads the conversation post-state-tool to compute polite-exit** (`chat.ts:807-810`). This is a second `runQuery` after `runMutation api.ai_conversations.updateState` already wrote the row; if `updateState` is async-batched the read may race. Convex serializes mutations, so likely fine in practice — but the code comments don't make the dependency explicit.
- **`incrementMessageCount` is called twice** (`chat.ts:732-737`) instead of incrementing by 2. Two round-trips for one logical operation. Minor.
- **`debug_skip_persist` only honored when `debug === true`** (`chat.ts:719`). This is undocumented coupling — a caller that wants to skip persist without tracing has no way. Likely intentional ("harness only") but worth documenting.
- **`@ts-expect-error TS2589` suppression at `chat.ts:250` and `:269`.** The depth-instantiation problem is real (Convex + TypeScript), and the workaround here — declaring the handler as a separate function with `ctx: any` — is sound. But the `Doc<...>` annotations on every `runQuery` then have to be reapplied manually at every call site (`chat.ts:338, :345, :352, :363, :376`). One miss and you get silent `any`. Hard to maintain.
- **`messages.push({ role: "user", content: stateAckResults })` on the recovery path** (`chat.ts:574-575`) pushes ONLY state acks. If Haiku had emitted state tools alongside an empty text in iteration N, the next call sees the assistant turn with state `tool_use` blocks matched by `tool_result` blocks — that's fine. But if iteration N also produced terminal tool_uses (it shouldn't have, the branch guards against it), the unmatched terminal `tool_use` would cause Anthropic to 400 on the next call. The branch is correctly guarded but it's a brittle reading.
- **`accumulatedResults` accumulates across iterations** (`chat.ts:445`) but `mergeRenderDirectives` only fires once at the end. If Haiku emits `render_quick_replies` in iteration 1 and then *also* emits `render_diagnostic_form` in iteration 2 (which shouldn't happen because the loop breaks on terminal), nothing prevents both being merged. The categorization correctly breaks on the first terminal turn (`chat.ts:541-557`), so this is theoretically unreachable, but `accumulatedResults` carrying both data AND terminal results into the merger is loose.
- **`stripVoiceMarkup` regex `/^#{1,6}\s+/gm`** (`chat.ts:905`) only catches ATX-style headers at line start. Setext-style underlines (`Heading\n=====`) and inline `**bold**` mid-sentence are stripped, but `*italics*` and `_underscore_` italics are not. The prompt bans bold and headers; italics are allowed. Likely intentional, but worth flagging if Haiku starts using setext-style under pressure.
- **`callAnthropic` always sends the `web-search-2025-03-05` beta header** (`chat.ts:951`), even on the forced-final path that has `tools: []`. Harmless but unnecessary.
- **The cache_control on the LAST OUR tool only (`chat.ts:937-942`)** assumes that if `tools.length === 0` we want no breakpoint, otherwise breakpoint goes on the final tool. This means `SERVER_MANAGED_TOOLS` (web_search) is *outside* the cache. Anthropic's caching docs are clear that everything before the breakpoint caches; web_search definition shouldn't churn, so the prefix is stable. But the breakpoint placement is silently coupled to "we always have ≥1 OUR tool" — if `TOOLS_FOR_HAIKU` ever empties, this falls back to no cache breakpoint. Not a current bug.
- **No retry/backoff on the Anthropic call** (`chat.ts:945-961`). 5xx from Anthropic = thrown error = 500 to the user. Acceptable for a spike, brittle for production.
- **`MAX_TOKENS = 1024`** (`chat.ts:70`) is a per-iteration cap. Haiku in a multi-iteration tool loop can exhaust this on a single text turn if it composes a long prose response — the prompt warns to stay tight, but no enforcement.
- **`HISTORY_TURNS = 10`** (`chat.ts:71`) silently truncates history sent to Haiku. Combined with `<conversation_state>` replay, the strategy is "structured state replaces raw history past 10 turns" — but a 10-turn window means a 5-turn diagnostic narrowing + 6-turn pre-narrowing fact-finding has the early facts evicted. Polite-exit fires at 6 narrowing turns but the prior context that would tell the mechanic "user was asking about cooling first" is gone.

---

### `convex/oto/dispatcher.ts` — tool dispatch

**Purpose.** Pure logic that maps a single Anthropic `tool_use` block to a `tool_result` block. No Convex types. Inversion of dependency vs. chat.ts is explicitly to dodge the TS2589 type-instantiation cycle (excellent comment at lines 11-15).

**Public surface.**
- `executeTool(toolUse: ToolUseBlock, callables: ToolCallables): Promise<ToolResultBlock>`
- `mergeRenderDirectives(results: ToolResultBlock[]): ChatMessageEnvelope`
- Types: `ToolUseBlock`, `ToolResultBlock`, `ToolCallables`, `ToolCallable`, `ChatMessageEnvelope`

**Internal helpers.** `executeDataTool`, `packageRenderDirective`, `packageNavigationIntent`, `renderD`, `ok`, `errorResult`.

**Strengths.**
- The error envelope shape (`status: "ok" | "error", code, message`) is consistent across tools and is JSON-stringified into `tool_result.content` — Anthropic gets stable structured output to read back.
- Strong category-based switch with explicit fallthroughs (`dispatcher.ts:88-105`).
- The `renderD` helper + the multi-directive variant for `render_service_picker` (`dispatcher.ts:168-180`) handle the one tool that emits more than one envelope field cleanly.

**Bugs / smells.**
- **`render_service_picker` does NOT remap categories** (`dispatcher.ts:168-180`) despite the schema comment in `tools.ts:534-544` insisting that mapping happens "at dispatch time." If Haiku passes `category: "Routine Maintenance"` (from `list_services_for_vehicle`) the picker will receive a category outside its enum (`maintenance | tires | brakes | diagnostics`). Either the prompt has to do the mapping (current state — fragile) or this dispatcher needs the remap.
- **`navigate_to_payment` validates `service_slug`** (`dispatcher.ts:276-283`) but doesn't validate `mechanic_id` is a real Convex id, doesn't validate `slot_id`, doesn't validate the route doesn't have path-traversal characters. The route is constructed via template string (`dispatcher.ts:288`); a Haiku-supplied `mechanic_id` of `"../admin"` lands in the route. The frontend router would catch this, but defense in depth is missing.
- **`mergeRenderDirectives` silently drops error results** (`dispatcher.ts:357`) — `if (r.is_error) continue`. If a render tool dispatch errored (e.g. unknown tool name), the user sees neither the render nor a notification. The chat action's "no text + no render" fallback (`chat.ts:696-706`) catches the empty case but not the partial-failure case where some renders succeeded and one errored — that turn just silently drops the failed render.
- **`packageRenderDirective` switch has no default for the `"navigation"` category** because navigation is dispatched in a separate function, but `executeTool` (`dispatcher.ts:98-100`) routes anything that isn't `render` or `navigation` to `executeDataTool`. State and model_routing categories therefore go to `executeDataTool` and look up callables — which is correct, since `chat.ts:buildCallables` does provide `update_conversation_state`, `record_vehicle_fact`, `request_sonnet_handoff`, `request_haiku_handback`. But if a category is added to `OTO_TOOL_CATEGORY` and not wired through `executeDataTool`, dispatcher fails silently with `not_implemented`. There's no exhaustive-check using a TypeScript discriminated union.
- **`OkEnvelope.data` is typed `T` but always serialized as JSON string** in `tool_result.content`. The Anthropic API allows structured `content` blocks too — sticking to JSON-stringified strings is fine, but the type signature `OkEnvelope<T>` lies (the actual wire shape is the parsed-then-stringified JSON). Documentation comment is light here.

---

### `convex/oto/system_prompt.ts` — the prompt body

**Purpose.** Exports `SYSTEM_PROMPT` (a long template string, ~33k tokens by file size) and `SYSTEM_PROMPT_VERSION = "v0.9"`. Lives in the cached zone of every Anthropic call.

**Strengths.** The prompt is unusually disciplined — explicit voice rules, named failure modes ("data form hallucination"), banned phrasings as concrete strings, decision trees with worked examples, calibration targets. It reads like a manifesto for a system that's been through real eval iterations.

**Bugs / smells.**
- **Prompt references `render_support_form`** (lines 421, 571-577, 914, 924, 928 in the prompt body), but that tool is NOT in `OTO_TOOLS`, NOT in `OTO_TOOL_CATEGORY`, and NOT in `TOOL_NAMES_V1`. The Block 4 invariant at `chat.ts:190-208` would trip on this — except it scans for backticked references and `render_support_form` IS backticked (e.g. `system_prompt.ts:421`). So either the invariant is not actually firing in production (worth verifying — it's `console.error`, not a throw), or these references quietly produce log noise on every cold start. Lines 22-25 of `system_prompt.ts` itself acknowledge this gap — labeled "Known caveat for v0.4" — but v0.9 is shipping with it unaddressed.
- **`SYSTEM_PROMPT_VERSION` is `"v0.9"`** but the file header still says "v0.6, 2026-05-14" (`system_prompt.ts:2`). Documentation drift.
- **The prompt is maintained as a template string in TypeScript.** Editing it requires escaping backticks in the prose and breaks syntax-highlighting. Several blocks use `\`tool_name\`` to embed backticks; getting the escaping wrong corrupts the cache hash silently. A `.md` file loaded at module init would be safer.
- **The cache_control breakpoint placement** (`chat.ts:931, 939`) means the system body and the tool schemas all cache as one block. A single-character edit to the prompt — even a typo fix — invalidates the cache for every active user on their next request and burns the cache_creation cost again. The prompt has been edited many times (v0.4 → v0.9 visible in markers); each edit was a global cache-bust event. There's no eval-gate before deploy that would warn on this.
- **`render_record_confirmation`'s description (lines 318-323 of the prompt body)** specifies the full phrasing pattern. Haiku is being given the literal text to use — which works but means the prompt and the mobile component's expected user-facing message are tightly coupled. A copy change requires a prompt deploy + cache bust.

---

### `convex/oto/envelope.ts` — uncached-zone builder

**Purpose.** Pure functions that build the `<user>` / `<vehicle>` / `<conversation_state>` / `<polite_exit_required>` / `<conversation_history>` / `<user_message>` envelope sent in the `messages[0]` field. Also exports `pickActiveVehicleRow` and `formatDisplayString`.

**Public surface.** `buildEnvelope`, `pickActiveVehicleRow`, `formatDisplayString`. Types: `OwnedVehicleRow`, `ResolvedVehicle`, `HistoryTurn`, `ConversationStateBlock`, `DisplayInfo`.

**Strengths.**
- Pure functions. No Convex deps. Can be unit-tested trivially.
- The skip-block-when-empty pattern (`hasUsefulState`, `envelope.ts:224-231`) is the right call — don't tell Haiku to think about empty fields.
- `titleCaseMake` (`envelope.ts:137-141`) special-cases BMW/VW/GMC. Pragmatic.
- `POLITE_EXIT_THRESHOLD = 6` is centralized.

**Bugs / smells.**
- **`pickActiveVehicleRow` doesn't check `is_primary`** (`envelope.ts:78-102`) despite the tool description claiming `is_primary` is the user's "active" car (`tools.ts:53`). Precedence is preferredVin → conversation.vehicle_id → newest by added_at. If a user has set a primary vehicle via the mobile UI but most recently added a different one, the AI picks the recently-added one. Drift between the documented contract and the resolver.
- **`HistoryTurn.role: string`** is too loose (`envelope.ts:38-40`); the filter at `envelope.ts:208` then narrows to `"user" | "assistant"`. Should be a union type at the source.
- **`<polite_exit_required>` block's `rule:` field embeds full prompt instructions inline** (`envelope.ts:200`). This is a per-turn injection — adds tokens to every turn that hits the threshold. Could be a one-line trigger that the cached prompt expands into the full rule.
- **The envelope is constructed as a string and concatenated with `\n\n`** rather than as content blocks. Means there's no way to attach `cache_control` to subsections. If someone wanted to cache the `<user>` block separately from `<conversation_history>`, this would need refactor.

---

### `convex/oto/vehicleHealth.ts` — get_vehicle_health tool

**Purpose.** Backs `get_vehicle_health` and `get_projected_health_score`. Joins the user's `maintenance_records` with `WARNING_LIGHT_LABELS`, fallback heuristics, and the shared `buildMaintenanceItems` helper, then translates camelCase mobile shape → snake_case AI shape and adds `record_provenance`.

**Public surface.**
- `getVehicleHealth({ vehicle_id }) → VehicleHealthResponse`
- `getProjectedHealthScore({ vehicle_id, item_id }) → ProjectedHealthResponse`
- Types: `RecordProvenance`, `VehicleHealthItem`, `VehicleHealthResponse`, `ProjectedHealthResponse`

**Internal helpers.** `loadVehicleContext`, `toAiShape`, `describeKnownIssues`, `WARNING_LIGHT_LABELS`.

**Strengths.**
- Reuses the same `computeVehicleHealthScore` / `buildMaintenanceItems` the mobile UI uses (`vehicleHealth.ts:26-37`). Critical — if the AI quoted a different score from what the user sees on Cars tab, trust collapses.
- Auth + ownership check is enforced (`vehicleHealth.ts:165-189`). Good.
- `describeKnownIssues` (`vehicleHealth.ts:61-71`) translates raw warning-light identifiers to human labels. The comment at lines 39-47 cites a real iter trace where Haiku parroted `"other"` back at the user — good defensive translation.
- `record_provenance` is the new (v0.9) trust signal — derivation rules are explicit (`vehicleHealth.ts:107-128`). Strong.

**Bugs / smells.**
- **`record_provenance` defaults to `"self_reported"` when the type isn't in `provenanceByType`** (`vehicleHealth.ts:367`). The comment "safer to under-trust than over-trust" is sound. But the same record-with-`confidence: undefined` will read as `self_reported` — if a verified record's `confidence` field was ever lost in a write, it silently demotes. Should at least log when a `user-` prefixed item lands in the fallback.
- **`confirmedHealthyAt` 90-day TTL is hardcoded twice** — once as `90 * 24 * 60 * 60 * 1000` inline (`vehicleHealth.ts:273`), and the prompt references "90 days" verbally (system_prompt body). One source of truth would be safer.
- **`loadVehicleContext` does N round-trips per call** — `users` query, `vehicles.get`, `vehicle_owners` query, `maintenance_records` query, optional `vehicle_configs.get`, `makes.get`. Five-plus serial DB hits per `get_vehicle_health` invocation. With Haiku batching this with `get_due_services` in parallel, that's 10+ DB hits per "how is my car doing" question. Not breaking the 1s budget today but worth profiling.
- **`MaintenanceItem` from `MaintenanceTracker` is imported across the convex/utils boundary** (`vehicleHealth.ts:37`). The convex bundle is now coupled to a UI component file. Bundling/tree-shaking aside, an editor refactoring `MaintenanceTracker.tsx` could break Convex compile. Should live in a shared types file.
- **`computeVehicleHealthScore` takes the same input shape twice** in `getProjectedHealthScore` (`vehicleHealth.ts:419-426`); fine, but no memoization.
- **`getVehicleHealth` returns `known_issues: undefined`** when there are none, but TypeScript permits a missing key vs. an explicit undefined — the JSON.stringify in dispatcher.ts will drop the key either way. Not a bug, just inconsistent.
- **Smartcar branches deliberately omitted** (cited at `vehicleHealth.ts:266`). Documented. But the `id.startsWith("smartcar-")` check still exists in `toAiShape` (`vehicleHealth.ts:354, :365-368`) — dead branch since the merge step never produces those ids on the server. Either drop the branch or assert.

---

### `convex/oto/vehicleFacts.ts` — get_vehicle_facts tool

**Purpose.** Returns the joined engine/transmission/trim_specs/fluids facts for the user's own vehicle.

**Public surface.** `getVehicleFacts({ vehicle_id }) → VehicleFactsResponse`.

**Strengths.**
- Auth + ownership check (`vehicleFacts.ts:73-94`) — same pattern as `vehicleHealth.ts`.
- Critical comment at `vehicleFacts.ts:118-122` warning future devs not to use `.filter` on `trim_specs` and forcing `.withIndex` use. This is the kind of comment that saves a senior engineer 30 minutes when the query times out. Excellent.
- Parallel joins with `Promise.all` (`vehicleFacts.ts:110-141`).

**Bugs / smells.**
- **Engine resolution falls back to `vehicle.engine_id`** (`vehicleFacts.ts:103-104`). If `vehicle_config_id` is set but `config.engine_id` is null, this falls through to `vehicle.engine_id`. If the config legitimately had no engine resolved, we may pick up a stale legacy column. Subtle precedence — should be a named helper with a comment about which write path produces which.
- **`(config as any)?.trim_id`** (`vehicleFacts.ts:108`) — bypassing TypeScript. Means the schema doesn't have `trim_id` on `vehicle_configs` but the code reads it anyway. Either the schema needs to add it or the `as any` is hiding a real type error.
- **Display-string fallback to `owner.nickname || vehicle.vin`** (`vehicleFacts.ts:163-164`) leaks the VIN into the AI's prose if the join fails. State Contract §5 (cited in `chat.ts:33-37`) forbids the AI from seeing VINs. Quiet violation.
- **Ownership check is enforced** but `lookup_vehicle_spec` doesn't have one because it's catalog-wide. Make sure no PII fields on `vehicles` ever leak through `lookupVehicleSpec`. Currently the lookup doesn't return `vehicles` rows directly (only `vehicle_configs` + joined name/trim) so this is fine, but the boundary is implicit not enforced.
- **Returns 35+ nullable scalar fields**. Haiku will receive a giant JSON blob even for trims with no enrichment data. Could prune null fields server-side to shrink the tool_result token cost.

---

### `convex/oto/vehicleFactsKB.ts` — knowledge base

**Purpose.** Backs `retrieve_vehicle_facts` (semantic + structural lookup) and `record_vehicle_fact` (write with optional embedding). The flywheel — facts learned for one user propagate to similar cars by chassis/engine.

**Public surface.**
- `lookupFactsStructural` (query) — by topic, optional vehicle_config_id, chassis_code, engine_code
- `lookupFactsSemantic` (action) — vector search; caller must pre-embed
- `insertFact` (mutation) — bare insert, requires auth
- `patchEmbedding` (mutation) — patch `embedding` column
- `recordFact` (action) — insert + optional embed flow
- `embedText` (action) — wrapper around OpenAI text-embedding-3-small
- `getFactById` (internalQuery)

**Strengths.**
- Two-layer fallback (semantic → structural) is sensible.
- Graceful degradation when `OPENAI_API_KEY` is missing — fact still saves, structural lookup still works (`vehicleFactsKB.ts:278, :327`).
- Result envelope is uniform across both lookup paths — same `KBFactRow` shape.

**Bugs / smells.**
- **`lookupFactsStructural` doesn't dedupe across the three index passes** beyond the in-call `seen` set. If a fact has both a chassis and engine match, only the first inserted wins. Acceptable but not documented in the return type.
- **No `match_kind: "model_year"` index path** despite it being in the union (`vehicleFactsKB.ts:36`). Dead match-kind value, or future scaffold.
- **`lookupFactsSemantic` re-fetches each row by `_id`** (`vehicleFactsKB.ts:133-162`) because `vectorSearch` only returns `_id` + `_score`. That's N+1. With `limit: 5` it's 5 extra queries per semantic call; with `limit: 20` it's 20. Convex's vector search does support `select` clauses for some plans — worth checking.
- **`lookupFactsSemantic` accepts `topic_axis` filter but `retrieve_vehicle_facts` callable in chat.ts doesn't pass it** (`chat.ts:1147-1156`). The filter capability is wired on the backend but Haiku has no way to use it. Probably future scaffold but creates the impression of capability.
- **No auth check on `lookupFactsStructural` or `lookupFactsSemantic`** — these are KB reads that the AI tool calls. The KB is shared knowledge so this is intentional, but the read of arbitrary fact rows could leak if a fact_text was ever recorded with PII (e.g. user-confirmed source = "user_confirmed" with a fact like *"my car is at 1234 Main St"*). The schema for `record_vehicle_fact` doesn't enforce that fact_text is depersonalized.
- **`insertFact` requires auth** (`vehicleFactsKB.ts:209-210`) but `recordFact` (the action that wraps insertFact) doesn't check auth itself — it relies on the inner mutation. When the chat action calls `recordFact`, identity propagates from chat's auth context. Fine, but worth documenting the trust chain.
- **`patchEmbedding` has no auth check.** If anyone outside the chat path calls it with arbitrary `id` + arbitrary `embedding`, they can poison the semantic index. Not exposed via api.d.ts beyond Convex internals, but the principle stands — internal mutations should still verify caller is the chat action context, not just "is authed."
- **No batching / no rate limit on the OpenAI embedding call.** A burst of users asking factual questions = N parallel embedding requests. OpenAI 429s would surface as "embedding failed (swallowed)" log noise and quiet semantic-search degradation.
- **The structural `topic` parameter requires exact string match.** "oil_capacity_qts" vs "oil_capacity" vs "engine_oil_capacity" — three writes, three retrievals. The prompt tells Haiku to "pick something stable" but there's no canonical topic registry. Drift accumulates over time, fragmenting the KB. A canonical-topic enum or a normalization step server-side would help.
- **Embedding dimension is hardcoded to 1536** (`vehicleFactsKB.ts:295`) to match the schema vectorIndex. If the embedding model is ever swapped (e.g. text-embedding-3-large is 3072), the dimension check silently drops the vector. Should fail loudly.
- **The "future enhancement" comment at `vehicleHealth.ts:243-246`** about checking `vehicle_service_states.last_service_booking_id` for an extra verified signal is genuine architectural debt — if the booking-completion path doesn't always set `confidence: "verified"` on the `maintenance_records` row, the trust signal is broken. Worth tracing the booking-completion writer path.

---

### `convex/oto/lookupVehicleSpec.ts` — lookup_vehicle_spec tool

**Purpose.** Free-text catalog lookup against `makes` × `models` × `vehicle_configs`. Returns either a single matched config with joined facts, a candidates list, or empty.

**Public surface.** `lookupVehicleSpec({ query }) → SpecFacts`.

**Strengths.**
- The word-boundary regex match (`lookupVehicleSpec.ts:95-111`) explicitly addresses the "M5 vs M550i" substring collision — comments cite the bug. Strong.
- Year extraction (`lookupVehicleSpec.ts:73-77`) clamps to 1980–current+2.
- Score-based candidate ranking (model name = 2 pts, trim name = 1 pt) gives meaningful disambiguation.

**Bugs / smells.**
- **No `.withIndex` on models/configs queries** (`lookupVehicleSpec.ts:148, :153`). Both use `.filter(q => q.eq(q.field(...), ...))` which is full-scan in Convex. With ~thousands of trims in the catalog (per `vehicleFacts.ts:120` comment), this is exactly the timeout vector that file warned about. Should use schema indexes `by_make_id` and `by_model_id`.
- **N×M loop over makes × models × configs** (`lookupVehicleSpec.ts:146-181`). With multi-make matches (e.g. "Mercedes" matches both Mercedes-AMG and Mercedes-Benz), this multiplies quickly. The `activeMakes` narrowing tries to reduce this but doesn't bound the loop.
- **No catalog scoping by year FIRST.** A user query "1995 Civic" still scans every Honda model + every Civic config, then filters by year. Pulling year through into the index would cut the work dramatically.
- **Returns up to 8 candidates** (`lookupVehicleSpec.ts:213`) but the tool description in `tools.ts:266-278` says Haiku should "ask the user which they meant, OR pick the most recent year by default." Haiku's free to interpret; no server-side cap on confusion.
- **`tokens` from query split on whitespace doesn't handle hyphens** ("Mercedes-Benz" tokenizes as one word, but "AMG-GT" too). The word-boundary regex does match hyphens as boundaries, so "AMG" inside "AMG-GT" works. But user-typed "C-Class" tokenizes as one token while the catalog stores "C Class" as two. Worth a normalization pass.
- **No telemetry on lookup outcomes.** A senior engineer calibrating the tool wants to know how often "matched: null, candidates: []" happens vs. how often the result was a single match. No instrumentation.
- **Returns zero verification of catalog hits' freshness or completeness.** A vehicle_config with `engine_id: null` still surfaces as a single-match — the AI then sees `engine: null` and the prompt tells it to fall back to web_search. This is intended behavior but means the tool's success rate is conflated with catalog-coverage rate.

---

### `convex/oto/recordConfirmation.ts` — trust protocol helper

**Purpose.** New (v0.9) helper backing the `AIRecordConfirmation` mobile component. Resolves a single `maintenance_records` row plus the `vehicleOwnerId` the component needs to write back.

**Public surface.** `getRecordForConfirmation({ vehicle_id, maintenance_type }) → RecordForConfirmation`.

**Strengths.**
- Same auth + ownership pattern as `vehicleHealth.ts` and `vehicleFacts.ts`. Consistent.
- Explicitly returns `vehicleOwnerId` so the frontend doesn't need a second join (`recordConfirmation.ts:88-89`). Good API ergonomics.
- Drops legacy string `lastServiceDate` values (`recordConfirmation.ts:97-100`). Defensive.
- Returns `record: null` on miss rather than throwing — matches the documented "no record on file" UX (`recordConfirmation.ts:27-30`). Sensible.

**Bugs / smells.**
- **`maintenance_type` is `v.string()`**, no enum validation. Could be `"foo"` and the index lookup would return null. Should be `v.union(v.literal("oil"), v.literal("brakes"), ...)` matching the render tool's enum.
- **No corresponding write mutation in this file.** The component does the write via `maintenance:upsertRecord` (per the render directive's comment in `dispatcher.ts:217-228`), which lives outside `convex/oto/`. The trust-protocol surface area is split between two folders. Worth a comment cross-reference on both sides.
- **No telemetry hook.** The trust protocol's whole point is to measure data-form-hallucination rate; there's no log of "user confirmed record correct" vs. "user updated record" vs. "user abandoned the prompt." Without this, calibration is blind.
- **Could collide with two records of the same type for same vehicle_owner.** The `.unique()` call (`recordConfirmation.ts:86`) throws if the by_vehicle_and_type index returns >1. Schema presumably prevents duplicates but `.unique()` failing here would manifest as a render-confirmation tool throwing during an in-progress chat turn.

---

### `convex/oto/bookings.ts` — get_bookings tool

**Purpose.** User-scoped booking list with status filter (active | completed | all), default limit 5, capped at 20.

**Public surface.** `getBookings({ status_filter, limit? }) → OtoBookingSummary[]`.

**Strengths.** Auth check, status filter clean, sort by `_creationTime` documented as the only universally-present field. Good comment on the trade-off (`bookings.ts:69-71`).

**Bugs / smells.**
- **Returns service IDs as strings via `service_slugs` and `service_names`** but the IDs themselves are not exposed. If Haiku wants to look one up via `get_service_details`, it has the slug — but `service_ids` are dropped. The slug is the right interface; just confirming the ID-vs-slug discipline is consistent.
- **`mechanic.first_name` and `mechanic.last_name` are concatenated without nullish coalescing** (`bookings.ts:92-94`). If either is undefined the result is `"undefined Smith"`. Defensive `?? ""` would help.
- **No filter to exclude bookings for vehicles the user no longer owns.** Not a bug per se but if a user removes a vehicle and queries past bookings, they get bookings against the deleted vehicle's VIN tail. May or may not be desired.
- **Index `by_user_id` collects every booking** before filtering by status. For a high-volume user, that's a per-call cost. A composite index `by_user_status` would let the status filter happen in the index lookup.

---

### `convex/oto/dueServices.ts` — get_due_services tool

**Purpose.** Reads `vehicle_service_states` (the maintenance pipeline's projections) for the active vehicle, returns only `overdue | due_soon` rows joined with the services catalog. Sorted overdue-first, then due-date ascending, then urgency_score descending.

**Public surface.** `getDueServices({ vehicle_id }) → OtoDueService[]`.

**Strengths.** Same auth+resolve pattern as the other vehicle-scoped tools. `is_applicable === false` filter handles the timing-belt-on-chain-engine case (`dueServices.ts:71`).

**Bugs / smells.**
- **`URGENCY_RANK` includes `"ok": 2`** (`dueServices.ts:32-36`) but the filter at `:73` drops `"ok"` rows. Dead entry. Tells me the rank was originally for displaying all rows; cleanup missed.
- **Returns `service_slug: null`** when `svc?.slug` is null (`dueServices.ts:91`). Haiku would then try to call `get_service_details(service_slug: null)` — the dispatcher would reject. Should filter these rows out (or hard-error since a slug-less service shouldn't be in the catalog).
- **N round-trips for service joins** (`dueServices.ts:88-89`) — one `db.get(s.service_id)` per state row. Acceptable for the typical "5–10 due services" payload.
- **No `last_service_mileage` / `last_service_date` validation** — passes through whatever's in `vehicle_service_states`. If the pipeline emits a `last_service_date` of `0` (epoch), Haiku reads "last service was 1970." Defensive null check.

---

### `convex/oto/telemetry.ts` — per-turn telemetry

**Purpose.** Mutation that inserts one row per chat turn into `oto_telemetry` for cost-per-booking calibration. Locked Principle #12.

**Public surface.** `recordTurn(...)` mutation. Args span model, tokens, cache, latency, tools called, branch outcome, optional booking_id and error.

**Strengths.** Fire-and-forget contract documented in the file header. The chat caller wraps in try/catch and swallows failures (`chat.ts:847-849`). Right architectural call.

**Bugs / smells.**
- **No auth check.** Anyone with access to the api can insert arbitrary telemetry. Probably fine because the api isn't exposed to the mobile client, but if an end-user were ever able to trigger this directly they could pollute the dashboard.
- **No retention policy / no aggregation table.** Every turn = one row. At scale this is `users × turns/day × 365 = millions/yr`. Should have a downsample-to-daily cron or a TTL.
- **`booking_id` is optional but never passed** (`chat.ts:832-846` doesn't include it). The schema-level field exists but is dead until a future slice wires it. Worth a TODO marker.
- **`final_branch: v.string()`** unbounded — should be a union (`"text_only" | "data_continue" | "terminal"`). Same for `model`.
- **No idempotency.** A retry of `recordTurn` would insert a duplicate. The chat action only calls it once, but if telemetry ever moves to a queued path, duplicates compound the cost calc.

---

## Integrated system review

### Chat-action loop end-to-end

The flow at `chat.ts:451-609`:

1. **Auth** — `ctx.auth.getUserIdentity()`, fetch `users` row by clerkUserId.
2. **Conversation load** — `ai_conversations.getById` + ownership check + `ai_messages.getByConversationId`. History sliced to last 10 turns.
3. **Vehicle resolve** — `vehicles.getMyVehicles`, `pickActiveVehicleRow` (preferredVin → conversation.vehicle_id → newest), then `vehicles.getDisplayInfoForVin` to walk make/model/trim.
4. **Envelope build** — `buildEnvelope(...)` produces a string with `<user>`, `<vehicle>`, `<conversation_state>`, optionally `<polite_exit_required>`, `<conversation_history>`, `<user_message>`.
5. **Per-turn model selection** — read `conversation.current_model`, pick `SONNET_MODEL` if `"sonnet"`, else `HAIKU_MODEL`.
6. **Loop** (max 5 iterations):
   - Call Anthropic with `system: [{type:"text", text: SYSTEM_PROMPT, cache_control: ephemeral}]`, `tools: [...TOOLS_FOR_HAIKU + cache_control on last + ...SERVER_MANAGED_TOOLS]`, `messages`, `model: turnModel`.
   - Parse content blocks. Categorize tool_uses into `dataToolUses`, `stateToolUses` (state + model_routing), `terminalToolUses` (render + navigation).
   - Eagerly dispatch state tools via `Promise.all` — acks accumulate but don't gate the loop.
   - Branch:
     - **Terminal in this iteration**: dispatch terminal tools, push results to `accumulatedResults`, set `finalText` to whatever text accompanied them, BREAK.
     - **No data tools**: if text exists OR no state tools fired → `finalText = textBlock?.text`, BREAK. If state-only-no-text → push assistant turn + state acks, continue loop (recovery path).
     - **Data tools**: dispatch them, push assistant turn + (state acks + data results) as next user turn, continue.
7. **Forced final** — if cap hit and no text, call Anthropic once more with `tools: []` (and `model: MODEL` — bug, see above).
8. **Render merge** — `mergeRenderDirectives(accumulatedResults)` flattens render directives into `ChatMessageEnvelope`.
9. **Empty-fallback** — if no text AND no render fields, inject a generic "having trouble pulling that one together" message.
10. **Voice strip** — `stripVoiceMarkup` removes `**bold**` and `## headers` server-side as belt-and-suspenders against prompt-rule violations.
11. **Persist** — user turn + assistant turn into `ai_messages`, two `incrementMessageCount` calls (should be one with `+2`).
12. **Polite-exit counter** — re-read conversation, if rendered form → reset to 0, if `last_user_intent` starts with `"symptom_narrowing"` → increment.
13. **Telemetry** — fire-and-forget `oto.telemetry.recordTurn`.
14. **Return** — text + every render field that's set + (optionally) trace blob.

**Soundness.** The loop's branching logic is well-thought-through, especially the state-only-no-text recovery. The forced-final terminator correctly guarantees text always emits. The eager state dispatch is the right call for persistence safety.

**Weak points.**
- The forced-final using `MODEL` not `turnModel` (chat.ts:628) and telemetry similarly using `MODEL` not `turnModel` (chat.ts:835) — Sonnet cascade observability bugs.
- The empty-fallback text (`chat.ts:704-705`) is generic-string injection on a turn that may have produced legitimate state writes already — telemetry will report 0 tools but actually some state writes happened. Trace will be confusing.
- "Re-read conversation to see polite-exit intent" (`chat.ts:807-815`) trades a round-trip for cleanliness but creates a read-after-write race against `updateState`. Convex's serializable consistency handles this, but it's fragile to reason about.

### Render directive flow

`tool_use` (e.g. `render_quick_replies`) → `dispatcher.executeTool` → `packageRenderDirective` → returns `ToolResultBlock` whose `content` is `JSON.stringify({status:"ok", data: {type:"render", field:"quickReplies", value: [...]}})`. The chat loop accumulates these in `accumulatedResults`. After the loop, `mergeRenderDirectives` parses each result, walks `parsed.data.directives[]` (or single `data.field/data.value`), and assigns into a `ChatMessageEnvelope`. The chat handler then conditionally spreads each set field into the return object.

**Field-parity contract** (`tools.ts:478-489`):
- `render_shop_carousel` → `shopCarousel`
- `render_service_picker` → `showServicePicker` (+ optional `pickerServices`, `pickerPreSelectedId`) — the multi-directive case
- `render_diagnostic_form` → `showDiagnosticForm`
- `render_record_confirmation` → `showRecordConfirmation`
- `render_time_selector` → `timeSelector`
- `render_booking_confirmation` → `bookingConfirmation`
- `render_quick_replies` → `quickReplies`
- `render_reasoning` → `reasoning`
- `render_sources` → `sources`

The contract is consistent across `dispatcher.ts`, `chat.ts` return shape, and `tools.ts` comments. Issues:
- **No type-system enforcement.** The field name strings are duplicated in three places: `dispatcher.ts:packageRenderDirective`, `chat.ts:returns` validator, `chat.ts` final return spread. Adding a new render tool requires changes in all three; nothing fails at compile time if you forget one.
- **`mergeRenderDirectives` returns `ChatMessageEnvelope` with `[k: string]: unknown`** (`dispatcher.ts:349`). Any field name will be assigned. A typo at the dispatcher (e.g. `quickReplys` instead of `quickReplies`) would silently land in the envelope and never make it to the client return.

### Tool catalog inventory

**Defined in `OTO_TOOLS` (28):**
- DATA: `get_my_vehicles`, `get_bookings`, `get_due_services`, `list_service_categories`, `list_services_for_vehicle`, `get_service_details`, `get_shop`, `get_shop_services`, `get_shop_hours`, `get_mechanic`, `get_my_mechanics`, `get_reviews`, `find_available_slots`, `get_rewards_summary`, `get_vehicle_health`, `lookup_vehicle_spec`, `retrieve_vehicle_facts`, `record_vehicle_fact` (categorized as state), `get_vehicle_facts`, `get_projected_health_score`
- STATE: `update_conversation_state`, `record_vehicle_fact`
- MODEL ROUTING: `request_sonnet_handoff`, `request_haiku_handback`
- RENDER: `render_shop_carousel`, `render_service_picker`, `render_time_selector`, `render_booking_confirmation`, `render_diagnostic_form`, `render_record_confirmation`, `render_quick_replies`, `render_reasoning`, `render_sources`
- NAVIGATION: `navigate_to_payment`
- SERVER-MANAGED (Anthropic): `web_search`

**Wired in `TOOL_NAMES_V1` and `buildCallables` (chat.ts):**
- DATA wired: `list_services_for_vehicle`, `get_service_details`, `get_vehicle_health`, `get_projected_health_score`, `get_bookings`, `get_due_services`, `get_vehicle_facts`, `lookup_vehicle_spec`, `retrieve_vehicle_facts`
- STATE wired: `update_conversation_state`, `record_vehicle_fact`
- MODEL ROUTING wired: `request_sonnet_handoff`, `request_haiku_handback`
- RENDER wired: `render_quick_replies`, `render_diagnostic_form`, `render_record_confirmation`, `render_service_picker`, `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation`

**MISSING / dead schema (in `OTO_TOOLS` but NOT wired):**
- `get_my_vehicles` — discoverable, not callable
- `list_service_categories` — discoverable, not callable
- `get_shop`, `get_shop_services`, `get_shop_hours` — entire shop-info surface
- `get_mechanic`, `get_my_mechanics` — entire mechanic-discovery surface
- `get_reviews` — social proof surface
- `find_available_slots` — slot discovery (but `render_time_selector` is wired)
- `get_rewards_summary` — rewards surface
- `render_reasoning`, `render_sources` — schemas defined, dispatcher branches present, but NOT in TOOL_NAMES_V1 → never advertised to Haiku
- `navigate_to_payment` — schema defined, dispatcher branch present, NOT in TOOL_NAMES_V1 → payment handoff isn't actually possible from the AI today

**MISSING from schema entirely (referenced by prompt but undefined):**
- `render_support_form` — referenced 4+ times in `system_prompt.ts` (lines 421, 571-577, 914, 924, 928), called out as "not yet wired" in the prompt's own header comment, still unbuilt at v0.9. Haiku is being told it has a tool that doesn't exist; falls back to prose.

**Probably should exist (from a coverage standpoint):**
- A "what shops are near me" tool — currently shop discovery happens entirely on the mobile side via `render_shop_carousel`'s trigger pattern. AI never knows shop names/distances.
- A "save the user's preferences" mutation surface — preference for closest vs. best-rated is stored in `established_facts` as free text, but if the AI wanted to remember it persistently outside the conversation, there's no tool.
- A "recall a prior booking by id" tool that's narrower than `get_bookings` — for follow-up "did booking X go through?" turns.

### Sonnet cascade — wired vs. calibrated

**Wired:**
- `request_sonnet_handoff` and `request_haiku_handback` schemas in `tools.ts:392-423`.
- Categorized as `model_routing` in `OTO_TOOL_CATEGORY`.
- Dispatcher treats them like state tools (eager dispatch, trivial ack).
- Callables in `chat.ts:1287-1315` write `ai_conversations.current_model` via `setCurrentModel` mutation.
- Per-turn read at `chat.ts:436-441`: `turnModel = conversationCurrentModel === "sonnet" ? SONNET_MODEL : HAIKU_MODEL`.
- Telemetry should record `model` per turn.

**NOT calibrated / broken:**
- **Forced final uses `MODEL` not `turnModel`** (`chat.ts:628`). Sonnet cap-hit is silently re-routed to Haiku.
- **Telemetry records `MODEL` not `turnModel`** (`chat.ts:835`). The very calibration metric the cascade exists to monitor is wrong.
- **`SONNET_MODEL = "claude-sonnet-4-6"`** (`chat.ts:65`) — verify this is the actual model id; Anthropic's naming has been inconsistent. `"claude-sonnet-4-6"` doesn't match the Anthropic SDK's typical `claude-sonnet-4-20250514` style. May 404 at runtime.
- **No threshold/criteria are encoded in code** — the prompt tells Haiku "calibration target ~15-25% of diagnostic turns" but there's no server-side guardrail that pushes back on over-routing. If Haiku decides to escalate every turn, it will, and the metric is "fix the prompt."
- **No exit ramp.** If Sonnet forgets to call `request_haiku_handback`, the conversation is pinned to Sonnet for every subsequent turn. The prompt says Sonnet "MUST call" handback (system_prompt body line 623). Trusting model compliance for cost control is fragile.
- **No turn-budget cap on Sonnet.** A pinned-to-Sonnet conversation could rack up indefinite cost.

### Flywheel architecture (record_vehicle_fact + retrieve_vehicle_facts)

The intended flow:
1. User asks factual question.
2. Haiku calls `retrieve_vehicle_facts(topic, question_text, scoping)` → either gets KB hit OR empty.
3. If hit and `confidence >= 0.7` and `source != "oto_inferred"`, cite directly.
4. If miss, fall through to `get_vehicle_facts` / `lookup_vehicle_spec` / `web_search`.
5. After answering, Haiku MUST call `record_vehicle_fact` to persist for next user.
6. New fact is inserted via `vehicleFactsKB.insertFact`, then (if `OPENAI_API_KEY` set) embedded via `recordFact` and patched.
7. Next user with similar question: semantic search hits, KB grows.

**What works:**
- The two-axis lookup (semantic with structural fallback) is a clean abstraction.
- Provenance/confidence/source fields let downstream filtering separate trustworthy facts from `oto_inferred` low-confidence ones.
- Scope axes (`vehicle | trim | chassis | engine | model_year`) match the way mechanical knowledge actually generalizes — engine facts propagate by engine code, chassis facts by chassis code. This is the "moat" claim and the architecture supports it.

**What's fragile:**
- **Topic strings are uncontrolled.** The prompt says "pick something stable so future writes match" (`tools.ts:287`) but there's no canonical topic registry. `oil_capacity` vs `oil_capacity_qts` vs `engine_oil_capacity_qts` will fragment retrievals over time. A canonical-topic enum or a slug normalization step server-side would harden this.
- **Semantic search depends on `OPENAI_API_KEY` being set.** No alternative provider wired (Cohere, Voyage, Anthropic native embeddings). If OpenAI's API is down, the KB silently falls back to structural-only — the lookup returns fewer hits, the prompt's lookup-order heuristic still tells Haiku to call `web_search` next, but every "miss" was actually a semantic search the system couldn't perform. Telemetry doesn't separate "real miss" from "embedding unavailable."
- **No deduplication.** If the same topic+axis+scoping is recorded 10 times for the same engine, all 10 land in the table. `lookupFactsStructural` returns them all. Confidence-weighted merging or write-time dedup would help.
- **No confidence decay.** A `confidence: 0.9 oto_inferred` fact from 6 months ago has the same retrieval weight as today's. No `created_at` factor in ranking.
- **No write throttling.** Haiku could call `record_vehicle_fact` 10x per turn with overlapping topics. Each is a mutation + an OpenAI embedding call. Bursts would be expensive.
- **`record_vehicle_fact` failure is silent in chat.ts:1205-1211** (returns `{ok: false, reason}`). Haiku sees the ok-envelope wrapping that, can't tell apart "saved" from "rejected for missing fields." For a flywheel that depends on writes happening, the write-failure observability is too quiet — should at minimum log to telemetry.

### Trust protocol additions (record_provenance + render_record_confirmation)

The newest layer (v0.9). Architecture:

1. `vehicleHealth.ts:loadVehicleContext` builds a `provenanceByType: Map<MaintenanceType, RecordProvenance>` from `maintenance_records.confidence === "verified"` (verified) vs. anything else (self_reported).
2. `toAiShape` adds `record_provenance` to every `VehicleHealthItem`. Items with no record → `"inferred"` based on the `unknown-` id prefix.
3. The system prompt (lines 304-371) defines the Trust Gating rule: when `status: "on_time" && record_provenance === "self_reported" && symptom contradicts`, fire `render_record_confirmation` instead of `render_diagnostic_form`.
4. Dispatcher packages the render directive (`dispatcher.ts:216-233`) with `vehicle_id` + `maintenance_type`.
5. Mobile component reads via `getRecordForConfirmation` (this file), shows the user the record's date+mileage, gives Confirm / Update buttons.
6. On Confirm: write `confirmedHealthyAt: Date.now()` (locks status to on_time for 90 days per `vehicleHealth.ts:273`).
7. On Update: collect new date+mileage in inline form, write via `maintenance:upsertRecord`.
8. Either way, the user's choice flows back as a synthetic message via `appendEstablishedFact`, the next turn's envelope replays it in `<conversation_state>`.

**What's well-designed:**
- The "data form hallucination" framing is correct — onboarding data IS the soft layer.
- Suggesting-vs-mutating discipline is clean (system prompt §"Suggest, don't mutate"). User-personal data writes always require a render-confirm gate, KB writes don't.
- The provenance type and the rule live together in `vehicleHealth.ts` — one place to reason about trust derivation.

**What's weak:**
- **`confirmedHealthyAt` does NOT promote provenance to "verified."** The comment at `vehicleHealth.ts:103-106` is explicit: the user attesting via check-in "is exactly the data-form-hallucination-prone path we're guarding against." Sound. But the 90-day status-lock at `vehicleHealth.ts:273-281` overrides the underlying status to `on_time` regardless of what the heuristics would say. So a self_reported record that the user "confirms healthy" stays self_reported but its status is now hard-locked. If the user reports a contradicting symptom 30 days later, the trust gate triggers AGAIN (provenance still self_reported), the record_confirmation fires again. The prompt acknowledges this loop at lines 366-370 ("don't re-prompt — the user already attested") but enforcement depends on `established_facts` carrying the prior confirmation — which is conversation-scoped, not vehicle-scoped. New conversation = re-prompt.
- **No telemetry hook on the trust protocol.** Whether the user confirmed or updated is a critical metric for measuring data-form-hallucination rate. Currently invisible.
- **Dispatcher doesn't validate `maintenance_type`** in `render_record_confirmation` (`dispatcher.ts:216-233`). Haiku could pass `"sparkplug"` and the directive lands in the envelope; the component then queries with an invalid type and gets `record: null`.
- **Two separate concepts of "type" coexist:** `MaintenanceType` (oil/brakes/tires/inspection/battery — 5 values) in `vehicleHealth.ts` and the `maintenance_type` enum on the render tool (oil/brakes/tires/battery/inspection — same 5, different order). Render tool's enum at `tools.ts:621` is canonical for the render boundary. They match today; drift would be silent.
- **The trust gate logic ALL lives in the prompt, not the code.** No server-side enforcement that Haiku actually fires `render_record_confirmation` when the conditions hold. If Haiku skips it and goes straight to `render_diagnostic_form`, no system component catches the violation. Eval suite can catch it via behavioral tests but the architecture provides no fast-path safety net.

---

## Architectural debt hotspots — what looks like "we'll come back to this"

1. **Tool-name drift** between `OTO_TOOLS`, `TOOL_NAMES_V1`, system prompt, and `OTO_TOOL_CATEGORY`. The Block 4 invariants catch some drift but only via `console.error` at module load. `render_support_form` has been a known-broken reference since v0.4 and is still in v0.9.
2. **VIN vs. vehicles._id confusion** in tool descriptions. Documented as VIN, used as Convex _id. A drift footgun the codebase has previously suffered (the comment at `vehicleHealth.ts:175-181` cites "querying `by_vin_user` with the raw _id (the previous behavior) always missed").
3. **`render_service_picker` category remap missing** — explicit prompt-side delegation of a mapping that should be code-side.
4. **Sonnet cascade telemetry uses wrong model field** — the very metric the cascade exists to calibrate is wrong.
5. **System prompt lives as a TS template string** — escaping-prone, hard to diff, every edit invalidates global cache.
6. **No canonical topic registry for KB** — fragmentation will accumulate silently over time.
7. **Trust protocol has no observability** — the protocol's whole purpose is calibrating data-form-hallucination rate; no telemetry hook exists.
8. **Many cross-cutting `as any` escapes** (especially around `vehicle_configs.trim_id`, `(vehicle as any).engine_id`, `(conversation as any).current_model`). The TS2589 wall has pushed the file's type discipline down. Each `as any` is a place a schema change would silently break behavior.
9. **`@convex-dev/rag` migration listed in pending tasks** — the bespoke vehicleFactsKB will be replaced wholesale; current investments in topic stability, semantic search debugging, etc. may be throwaway.
10. **Mobile components for v0.9 trigger-only render envelopes still pending** — backend ships render directives for `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation` but their mobile-side renderers may not exist yet, meaning Haiku's calls succeed at the dispatcher layer but produce no UI.

## Section 2 — Mobile / Frontend Audit

**Scope:** `components/ai-chat/*`, `app/(main-tabs)/ai-chat/index.tsx`, `services/ai/*`, `stores/useAIChatStore.ts`, `hooks/useVoiceRecording.ts`, `hooks/useVehicleOwnershipFromConvex.ts`. Backend (`convex/oto/*`) referenced only at the wire boundary.

### 1. The Orchestration Layer — `app/(main-tabs)/ai-chat/index.tsx` (1700+ lines)

This file is the heart of the Oto AI UX and also the single biggest engineering liability on the mobile side. It has accreted three eras of code (rule engine → Oto AI Phase 1 spike → trust-protocol patches) and it shows.

#### 1.1 Render flow

After the welcome gate (`!hasSeenWelcome` returns `<AIWelcomeScreen>` at index.tsx:1143), the screen branches on `showChatGreeting = state.messages.length === 0` (index.tsx:1140):

- Greeting branch (index.tsx:1407-1425) renders `<AIGreeting>` with the user's vehicles from Convex, plus injected `MOCK_VEHICLES` (Lexus ES + Ford Explorer) appended unconditionally — see §2.4.
- Chat branch (index.tsx:1426-1496) maps `state.messages` through `<AIMessageBubble>` and then conditionally appends one of four render-target components per message. The conditions:

```
message.showServicePicker      && state.currentStage === "service_selection"   → <AIServicePicker>     (1439-1445)
message.showDiagnosticForm     && state.currentStage === "diagnostic_form"     → <AIDiagnosticForm>    (1447-1459)
message.showRecordConfirmation                                                  → <AIRecordConfirmation> (1461-1471)
message.shops?.length > 0                                                       → <AIBookingCarousel>   (1473-1477)
```

Two structural problems here:

**(a) The current-stage guard double-checks state that was *just derived* from the same envelope.** Lines 463-473 set `nextStage` from the envelope, then push it into `state.currentStage`. The render-block then re-filters by `currentStage === "..."`. If a later message stage clobbers an earlier one (the user keeps chatting), the older message's render envelope keeps the field but the gate fails — so the picker/form silently disappears from history. Not catastrophic because users rarely scroll back to bygone form widgets, but it's structurally wrong: the guard belongs on the message itself, not on global state.

**(b) `message.showRecordConfirmation` has NO stage guard** (1461) while the other three do. This is the only render-target that always appears whenever the field is present. Inconsistent. Fine in practice (record-confirmation is rare and stateful) but a footgun if the field ever leaks onto follow-up messages.

**(c) `message.shops` is the ONLY field that uses the legacy in-message data shape** rather than the v0.9 trigger-only envelope (`message.shopCarousel`). The dispatcher only emits `shopCarousel` (dispatcher.ts:160-166), never `shops`, so this render block is dead code on the live Oto AI path — see §3.2. Similarly there's no render block at all for `timeSelector` or `bookingConfirmation`, which is the headline gap in stages 5 and 6.

#### 1.2 The destructure of `sendMessageAction` (THE big recent bug — verified)

index.tsx:423-448. The destructure was indeed broken before the fix and is now correct:

```ts
const {
  text,
  quickReplies,
  showDiagnosticForm,
  showRecordConfirmation,
  showServicePicker,
  pickerServices,
  pickerPreSelectedId,
  shopCarousel,
  timeSelector,
  bookingConfirmation,
} = await sendMessageAction({ ... });
```

Cross-checked against every `case` in `packageRenderDirective` (dispatcher.ts:154-251):

| Backend field (dispatcher) | Mobile destructure | Mobile renders it? |
|---|---|---|
| `showServicePicker` | yes | yes (`<AIServicePicker>`) |
| `pickerServices` | yes | **NO — passed as prop, never read** (see §1.3) |
| `pickerPreSelectedId` | yes | **NO — passed as prop, never read** (see §1.3) |
| `showDiagnosticForm` | yes | yes (`<AIDiagnosticForm>`) |
| `showRecordConfirmation` | yes | yes (`<AIRecordConfirmation>`) |
| `shopCarousel` | yes | **NO render block** |
| `timeSelector` | yes | **NO render block** |
| `bookingConfirmation` | yes | **NO render block** |
| `quickReplies` | yes | yes (via `<AIMessageBubble>` → `<AIQuickReplies>`) |
| `reasoning` | **NO** | — |
| `sources` | **NO** | — (and `<AISources>` is intentionally commented out at AIMessageBubble.tsx:410-414) |

So the "render fires but doesn't display" bug (referenced as completed task #21) is **half-fixed**: the destructure now propagates everything onto the message envelope, but three of the four trigger-only v0.9 render envelopes have no consumer component on mobile. `reasoning` and `sources` aren't even destructured even though `<AIReasoning>` and `<AISources>` exist (the action's API.ts return doesn't expose these — verify backend, but mobile hasn't asked for them either).

#### 1.3 `pickerServices` and `pickerPreSelectedId` are silently dropped at the picker boundary

Look at the `<AIServicePicker>` call (index.tsx:1442-1444):

```tsx
<AIServicePicker onConfirm={handleServiceSelect} disabled={isProcessing} />
```

No `services` prop, no `preSelectedId` prop. AIServicePicker.tsx:293 falls back to the hardcoded `DEFAULT_SERVICES` constant for every mount. Whatever services the backend sends in `pickerServices` are stored on the message but never consumed. There's also no "pre-selected" state in `AIServicePicker` — `selectedIds` initializes to an empty `Set`. This breaks the explicit contract in the system prompt (system_prompt.ts:683): *"You emit `render_service_picker` with `pre_selected_id: 'diagnostic_scan'` … The `pre_selected_id` tells the mobile picker to open with Diagnostic Scan highlighted."* It does not.

That's a hard regression of the second half of bug #21.

#### 1.4 Stage derivation uses precedence that leaks the wrong stage

index.tsx:463-473:
```ts
const nextStage = diagnosticFormEnvelope ? "diagnostic_form"
  : showServicePicker ? "service_selection"
  : shopCarousel ? "shop_selection"
  : timeSelector ? "time_selection"
  : bookingConfirmation ? "confirmation"
  : undefined;
```

Two issues. First, when `nextStage` is `undefined` it intentionally preserves `prev.currentStage` (line 497) — which means a normal text-only follow-up assistant message keeps the stage from the previous render. That's fine for the active form/picker/carousel, but will break the render-block stage guards described in §1.1 in subtle ways (e.g. user types something during `service_selection`, the next assistant turn doesn't re-emit a picker, but `currentStage` still says `service_selection` and the *previous* message's picker stays visible). That's actually the desired behavior here, but it's load-bearing and undocumented.

Second, `record_confirmation` is missing from the stage ladder entirely. The `nextStage` falls through to `undefined` for record-confirmation envelopes. Combined with §1.1(b) (no stage guard on the render block), this is what makes record-confirmation work — but it's a happy accident of the asymmetric guard structure, not a designed invariant. Add a record-confirmation case to the gate or remove the gate from the others.

#### 1.5 Handler functions

| Handler | Lines | Notes |
|---|---|---|
| `sendToOtoAI` | 382-540 | Single funnel, well-designed. Lazy-creates `ai_conversations` row on first send. Uses `setIsProcessing`, optimistic user-message echo, error-in-chat with `(Oto error: …)`. Feature-flag `USE_OTO_AI_ACTION = true` (104). |
| `handleSend` | 552-650 | Prepares input then dispatches to `sendToOtoAI` if flag on; else falls into the legacy rule-engine branch (preserved verbatim). |
| `handleSuggestionPress` | 655-661 | Routes welcome-screen tile taps through Haiku — was previously hitting rule engine catch-alls. |
| `handleQuickReplySelect` | 666-672 | Uses `reply.value || reply.text` as the canonical send text. |
| `handleBookNow` | 675-770 | Booking carousel handler — see §1.7. |
| `handleServiceSelect` | 776-796 | Pushes selected service slugs into `established_facts` via `pushFact()`, then sends a synthetic `"I'd like to schedule: …"` message back through `sendToOtoAI`. |
| `handleRecordDecision` | 805-832 | Synthesizes `Confirmed —` / `Updated —` echo text + writes a fact. |
| `handleDiagnosticFormConfirm` | 835-919 | **Suspicious — implements its own rule-engine-style follow-up locally** rather than asking Haiku to react. After the user confirms the diagnostic form, the handler synthesizes a hardcoded AI message ("Got it — locking this in for **{label}** … How would you like me to find mechanics?") with hardcoded quickReplies (closest / best_rated / best_price) and pushes the conversation into `priority_selection` stage purely client-side. This bypasses Haiku entirely for the form-confirm → priority-prompt transition. The next turn (when the user picks "closest") does go through `sendToOtoAI`, but the assistant message in between is fabricated. This is a major surprise that contradicts the "single funnel" design and breaks reasoning continuity — Haiku won't see this fabricated turn until the user next responds. |
| `startNewChat` | 952-970 | Resets local state, generates a new `sessionIdRef`, clears `convexConversationId`. Guards against in-flight responses. |
| `handleSelectConversation` | 976-1007 | Hydrates from `loadConversation` (Zustand) first, then falls back to `convex.query(api.ai_messages.getByConversationId, ...)` for Oto-AI rows. **Loaded server-side messages have NO render envelopes** — `shops`, `showServicePicker`, etc. are not reconstructed (line 992-997 only maps `id/role/content/timestamp`). Reopening a past conversation will display the assistant text but not the carousels/forms that originally appeared. |

#### 1.6 State machine

`ConversationState.currentStage` is the single state-machine variable. It's defined in `services/ai/types.ts:35` with 10 stages (`welcome | diagnosis | question | service_selection | diagnostic_form | priority_selection | shop_selection | time_selection | confirmation | success`). On the Oto AI path, only 5 of these are ever written: `service_selection`, `diagnostic_form`, `shop_selection`, `time_selection`, `confirmation` (see §1.4). `welcome`, `diagnosis`, `question`, `priority_selection`, `success` are dead in production but `priority_selection` is forcibly set by the local `handleDiagnosticFormConfirm` (index.tsx:892) — the only out-of-band state assignment. `currentScenario` is read but never written on the Oto AI path; legacy.

The local rule-engine state and Oto AI state share the same `ConversationState` type, which is why there are unused fields like `selectedShop`, `selectedTime`, `selectedPriority`, `serviceName`, `servicePrice` lying around. Consider splitting these or pruning.

#### 1.7 `handleBookNow` — the only fully-wired booking exit

index.tsx:675-770. This is critical because it's the *only* path from the AI chat into the actual booking → payment flow.

It works only when `<AIBookingCarousel>` is rendered, which requires `message.shops` (the legacy field) — and `message.shops` is **never set on the Oto AI path** (dispatcher emits `shopCarousel`, not `shops`; see §1.2 mapping). So on the live system, `handleBookNow` is unreachable from the Oto AI loop. The booking carousel currently only renders for the rule-engine path which is feature-flagged off (`USE_OTO_AI_ACTION = true`).

Even if `shopCarousel` had a renderer, that renderer would need to massage Convex data into `AIMechanic[]` before passing to `AIBookingCarousel`, AND `handleBookNow` does its own service-id mapping (681-691) and falls back to scenario-based service defaults (704-723) referencing scenario types like `brake_noise`, `check_engine` that the Oto AI path never sets. The whole `selectedServices`-feeding logic here is rule-engine vintage.

Bottom line: the 6-stage chain breaks at stage 4 (shop_selection). See §3.4.

#### 1.8 Voice recording integration

`useVoiceRecording()` is wired into `<AIInputBox>` via `handleMicPressIn` / `handleMicPressOut` (index.tsx:363-366, 544-549). The hook itself (`hooks/useVoiceRecording.ts:122-127`) is a **mock** that pops a `Coming Soon` Alert and returns `null`. So the entire voice path — waveform animation, transcribing dots, the iOS push-to-talk pill in `<AIInputBox>` — is decorative. `handleMicPressOut`'s `if (transcription && transcription.trim()) { sendToOtoAI(transcription); }` branch is dead code today.

This is documented in the hook comment but not surfaced anywhere in the UI: the user holds the mic, sees the recording UI animate, releases, and gets a popup. Either gate the mic button or implement the real transcription ASAP — the current state ships broken UX.

#### 1.9 Conversation history persistence

Sidebar list comes from `useQuery(api.ai_conversations.getByUserId)` (index.tsx:145), so Oto-AI conversations persist across mounts. Mapping at 146-155 derives the title from `scenario_detected` or falls back to the date — meaning conversations without a tagged scenario all collapse to "Conversation MM/DD/YYYY". No first-message preview, unlike the Zustand `getConversationTitle` helper (useAIChatStore.ts:67-73) which takes the first 50 chars of the first user message. Inconsistent — Convex-sourced titles are uglier.

The Zustand store (`useAIChatStore`) is now half-deprecated. It still drives `loadConversation`, `startNewConversation`, `saveCurrentConversation`, `setHasSeenWelcome`, but `conversations` from the store is not used anywhere on this screen (the sidebar uses Convex). `saveCurrentConversation` is only called from the rule-engine path (640-642 of `handleSend`, 624-626 of `handleSend`'s setTimeout callback) and from `handleDiagnosticFormConfirm` (898, 911). On the Oto AI path it's a no-op. There's a comment at index.tsx:138-142 acknowledging this is transitional.

#### 1.10 Convex / Clerk plumbing

```
useUserFromConvex() → convexUser._id (auth gate, index.tsx:389)
useVehicleOwnershipFromConvex() → rawVehicles (index.tsx:199)
useAction(api.oto.chat.sendMessage) → primary send (172)
useMutation(api.ai_conversations.create) → lazy first-send create (173, 416-420)
useMutation(api.ai_conversations.appendEstablishedFact) → fact pushing (182)
useQuery(api.ai_conversations.getByUserId) → sidebar list (145)
useConvex().query(api.ai_messages.getByConversationId, ...) → on-demand history hydrate (986)
```

`pushFact()` (183-191) is a fire-and-forget wrapper. The comment claims "race is benign" because Anthropic latency dwarfs the mutation, but no actual ordering guarantee — if the user double-taps a quick reply, two `pushFact` calls and one `sendToOtoAI` race; the established_facts state seen by the next turn is non-deterministic. Probably fine in practice; worth a debounce.

The auth gate at 389-393 (`if (!convexUser?._id) { showToast("Still signing you in"); return; }`) silently swallows the user's first send if Convex is still hydrating. The toast is a Band-Aid; better to disable the input until `convexUser` lands.

#### 1.11 Misc bugs / smells

- **index.tsx:481** — `isStreaming: true` is set, then `setTimeout(..., Math.min(text.length * 30, 3000))` flips it off. This is the **second** simulated streaming layer; `<AIMessageBubble>`'s `StreamingText` (AIMessageBubble.tsx:92-132) also fakes streaming with its own 50ms-per-word interval. They will fight. The bubble's StreamingText runs only when `!hasReasoning` (line 391-397), so in practice the screen-level timer is the visible one. Drop one of the two.
- **index.tsx:1349** — "Change Vehicle" `MenuView` action calls `startNewChat()` not a vehicle-change handler. Stub.
- **index.tsx:1010** — `[selectedModel, setSelectedModel] = useState<'pro' | 'flash'>('flash')` — picker exists in the header, value is never read anywhere (no model header sent to `sendMessageAction`). Pure UI theater.
- **index.tsx:202-206** — `LOCAL_VEHICLE_IMAGES` hardcoded to `tiguan / explorer / es`. Lookup keyed by lowercased model. Brittle; doesn't generalize.
- **index.tsx:737-744** — `handleBookNow`'s date computation uses *current* month/year and parses `timeSlot.day` (a string like `"15"`) into a calendar date. This will silently produce wrong dates on month boundaries (e.g. picking "Mon 2" on Jan 31 yields Jan 2, not Feb 2).

### 2. Components

#### 2.1 `AIMessageBubble.tsx`

- **Purpose:** Renders one chat message. Branches on `isUser`. AI side does optional `<AIReasoning>`, then text, then optional sections, then optional `<AISources>` (commented out 410-414 — "temporarily hidden"), then optional `<AIQuickReplies>`, then a row of action buttons (copy, speak, like, dislike).
- **Props:** `message`, `onCopy`, `onSpeak`, `onLike`, `onDislike`, `onQuickReplySelect`. (No prop for the four trigger-only render envelopes — those are rendered by the *parent* in `index.tsx`. Component intentionally doesn't know about them.)
- **Quirks:** Maintains its *own* duplicate `MessageSection` and `AIMessage` types (lines 57-77) instead of importing from `services/ai/types.ts`. Two type sources, will drift.
- **`StreamingText` typewriter** (92-132): runs on word boundaries, 50ms each. Conflicts with parent's text-length timer (§1.11). Only fires when `!hasReasoning`.
- **`showContent` gate** (302-325) is a custom delay calculator (`calculateReasoningDuration`, 231-248) that hides text until the reasoning typewriter finishes. Coupled timing — reasoning steps' `length * 20` and `1500ms` reading buffer are duplicated from `AIReasoning`. If you change the rate in one place you'll desync.
- The avatar/asymmetric bubble logic is fine. The user-side image gallery handling (337-349) renders attached images above the user pill bubble.
- **Bug:** `if (message.content && message.content !== "Here's an image for you to analyze")` (line 352) does string-match on a literal sentinel that's set in `handleSend` (index.tsx:567) when there are images but no text. Coupling text content to invisible behavior is fragile.

#### 2.2 `AIServicePicker.tsx`

- **Purpose:** Category-tabbed service selector with multi-select.
- **Props:** `services?: ServiceOption[]` (default `DEFAULT_SERVICES`), `onConfirm`, `disabled`.
- **Render:** Horizontal category tabs (Maintenance / Tires / Brakes / Diagnostics), then a list of `ServiceItem` cards filtered to the active category. `maxHeight: 280` (line 443) caps the visible list — long categories scroll.
- **Major gap:** No `preSelectedId` prop. The system_prompt.ts:683 contract for `pre_selected_id` is not honored; whatever the AI picks doesn't get pre-selected on render. Also no merging of backend-supplied `services` with `DEFAULT_SERVICES` — caller would have to pass a full catalog. Currently the parent passes neither (§1.3), so every render shows the same 12 hardcoded services regardless of vehicle, scenario, or AI suggestion.
- **DEFAULT_SERVICES** (77-178) duplicates service IDs that probably also live in Convex. Single-source-of-truth violation.
- **Visual:** Glass-light surface (`rgba(255,255,255,0.5)` etc.), uniformly faded; would benefit from a "recommended" badge once `preSelectedId` is wired.

#### 2.3 `AIBookingCarousel.tsx`

- **Purpose:** Horizontal scroll of mechanic cards. Each card has avatar, rating, services, tags, 4 availability slots, "Book Now" button.
- **Props:** `shops: AIMechanic[]`, `onBookNow(mechanic, slot)`.
- **Hard dependency on `AIMechanic` shape**: `nextAvailability: Array<{dayOfWeek, day, time}>`, `responseTime: "Quick" | "Normal" | "Slow"`, `price?: string`. This is `services/ai/types.ts:70-90`'s `AIMechanic`, which is a frontend-only shape composed in `services/ai/scenarios.ts:60-81` from `MOCK_MECHANICS`. There is no adapter from Convex query data → `AIMechanic` written anywhere — that's the missing piece for §3.4.
- **Render:** Cards are 300px wide, `snapToInterval={300 + Spacing.md}`. Slot selection is per-card (each `MechanicCard` has its own `selectedSlotIndex`). Book Now is disabled until a slot is picked.
- **Bug:** `marginHorizontal: -Spacing.md` (line 298) bleeds outside the parent's padding to make the carousel edge-to-edge. Combined with the `paddingLeft: Spacing.xl + Spacing.md` (line 301) it works on iPhone but probably misaligns on tablet widths.
- **Dead code:** Carousel never renders on the Oto AI path because `message.shops` is never set (§1.7).

#### 2.4 `AIGreeting.tsx`

- **Purpose:** Welcome screen with vehicle carousel + "Hello, {name}" + tap-to-confirm.
- **Props:** `userName`, `suggestions` (unused — see below), `onSuggestionPress` (unused), `vehicles`, `selectedVehicleVin`, `onVehicleSelect`, `onVehicleConfirm`, `keyboardVisible` (unused).
- **CRITICAL: hardcoded mock vehicles always appended** — line 177:
  ```ts
  const allVehicles = React.useMemo(() => [...vehicles, ...MOCK_VEHICLES], [vehicles]);
  ```
  `MOCK_VEHICLES` is two demo cars (Lexus ES, Ford Explorer) defined at line 69-72. Real users with one Tiguan see Tiguan + Lexus + Ford in the carousel. Tap a mock car → `onVehicleConfirm("mock_1", {...})` → `sendToOtoAI('I\'d like to confirm my 2025 Lexus ES')` → Oto Action gets a vehicleVin of `"mock_1"`. The backend then decodes that to nothing and almost certainly falls back to "most recently added" (per the comment in index.tsx:444-447). Demo cruft leaking into production data path.
- **Suggestions and onSuggestionPress are passed but never rendered.** AIGreeting only shows the vehicle carousel. The screen-level greeting "What can I help you with today?" is rendered via the carousel subtitle — there are no clickable prompt tiles in the greeting at all. So the parent (index.tsx:1410-1411) passes `WELCOME_SUGGESTIONS` and `handleSuggestionPress` for nothing. Either delete the props or restore the prompt tiles.
- **Carousel uses `react-native-reanimated-carousel`** with custom parallax, text crossfade, dot pagination. Animation logic is sound.
- **`tappedVin` is a local state** (180) — once set, the greeting freezes ("Getting things ready..."). There's no reset path; if `sendToOtoAI` fails silently the greeting stays frozen.

#### 2.5 `AIDiagnosticForm.tsx`

- **Purpose:** Subsystem picker (5 hardcoded options) + free-form notes textarea + Confirm button.
- **Props:** `initialSystem`, `initialNotes`, `vehicleId` (**unused — prefixed `_vehicleId` at line 128**), `onConfirm`, `disabled`.
- **`SYSTEMS` array** (36-42): `brakes | tires_wheels | engine | battery_electrical | not_sure`. Locked enum. Matches `DiagnosticSystem` from `lib/diagnostic-checklist-templates`.
- Clean component. Two-state local: `selectedSystem`, `notesText`. Pre-fills from props, calls back on confirm.
- **Pending consolidation:** Existing TODO #9 ("Merge diagnostic_form into service_options step type") wants this collapsed into the service picker. The current split between `<AIServicePicker>` and `<AIDiagnosticForm>` produces two visually-similar surfaces that the user navigates through sequentially in the diagnostic-scan flow.

#### 2.6 `AIRecordConfirmation.tsx`

- **Purpose:** Symptom-vs-record trust gate. Two-step state machine: `prompt` → `form`.
- **Props:** `vehicleId`, `maintenanceType`, `onDecision`, `disabled`.
- **Wires both Convex query AND mutation directly from a component** — `useQuery(api.oto.recordConfirmation.getRecordForConfirmation)` (113) and `useMutation(api.maintenance.upsertRecord)` (118). This violates the stated CLAUDE.md rule "No direct API calls from components." It works (and the comment justifies it as the trust-protocol exception) but if you're enforcing the rule consistently this needs a hook wrapper.
- **`as any` cast** at line 144 and 188 (`vehicleOwnerId: data.vehicleOwnerId as any`) — TypeScript escape, breaks the project's strict-no-any rule.
- **Resolved-state lock** (230-241) prevents double-submit. Good.
- **Form path** uses `<DatePickerMonthYear>` (imported direct from `@/components/shared-ui/DatePickerMonthYear`, with comment explaining it's not in the barrel). Mileage is parsed loosely (`replace(/[^0-9]/g, '')`).
- The decision contract back to parent (`onDecision(...)`) is clean. Parent both sends a synthetic chat message AND pushes a fact. This is the most carefully engineered render-target component — clear comments, sane error handling, explicit two-write paths (confirmedHealthyAt vs. lastServiceDate+mileage).

#### 2.7 `AIQuickReplies.tsx`

- **Purpose:** Horizontal pill row of reply buttons inside an AI message.
- **Props:** `replies`, `onSelect`, `disabled`.
- **Three variants:** `default` (white pill, secondary border), `primary` (filled secondary), `outline` (gray border). Bubble's quickReply renders unconditionally as long as `showContent && !isStreaming && replies.length > 0`.
- Three preset arrays (`PRIORITY_REPLIES`, `CONFIRMATION_REPLIES`, `YES_NO_REPLIES`, `NOISE_TYPE_REPLIES`) — only `PRIORITY_REPLIES` and `CONFIRMATION_REPLIES` are exported and only used by the legacy scenarios.ts. Live Oto AI path receives quickReplies from the backend (via `render_quick_replies` → `quickReplies` on the envelope).

#### 2.8 `AIInputBox.tsx`

- Substantial component (670 lines). Auto-expanding text input with `MIN_HEIGHT` 32 / `MAX_HEIGHT` ~142px; max 4000 chars; press-and-hold mic with metering waveform; transcribing dots; iOS 26 LiquidGlass support; plus button rotates to ✕ when attachment panel is open.
- **Props:** 17 props, all sensibly named. Of note: `transcript`, `meteringValue`, `isRecording`, `isTranscribing` are all forwarded from `useVoiceRecording` — and since the hook is a mock, `meteringValue` is RNG noise.
- **Bug:** `pointerEvents={hasText && !showRecordingUI ? 'none' : 'auto'}` (line 439) on the mic button absolute-positioned wrapper. The mic and send buttons live in the same `rightButtons` View (`width:32 height:32 position:relative`) and stack via absolute positioning (572-576, 585-591). When text is present, the send button slides in over the mic. The `pointerEvents="none"` on the mic prevents accidental long-press while typing. Subtle but correct.
- **Keyboard.dismiss() on send** (337) is correct for parent's tab-bar-tracking input.
- Liquid glass branch is gracefully optional via try/catch require.

#### 2.9 `AIReasoning.tsx`

- **Purpose:** Collapsible "Show thinking" panel with typewriter-revealed steps.
- Sophisticated: per-step delay, cumulative timing (`text.length * 20 + 1500`), auto-collapse 2s after `isStreaming` turns false, current-step summary always visible while streaming.
- **Currently dead on the live path** — the Oto AI action does not return reasoning steps (the destructure at index.tsx:423 omits `reasoning`). All this elaborate machinery only fires for the rule-engine path. If reasoning is meant to ship, the action's return type needs the field, and the destructure / message envelope need to include it.

#### 2.10 `AISources.tsx`

- **Purpose:** Pills with tooltip modal for source citations.
- **Hardcoded SOURCE_DEFINITIONS** for 5 source types with emoji icons (smartcar_api 🚗, error_codes 📖, etc.). `getSourcesForScenario(scenario)` returns curated bundles per scenario type.
- **DEAD ON BOTH PATHS.** Render call in `<AIMessageBubble>` is commented out (AIMessageBubble.tsx:410-414, "temporarily hidden"). Even on the rule-engine path, `<AISources>` doesn't render. The whole 380-line file is unreachable until somebody uncomments those lines.

#### 2.11 `PromptSuggestions.tsx`

- **Purpose:** Stage-aware suggestion pills above the input box.
- **Render filter:** Hardcoded `s.id !== 'new_vehicle'` (169) and reorders so `id === 'oil'` comes first (170-173). These are scenario-specific magic strings — leftover from the rule engine. On the Oto AI path the parent only passes `state.suggestions` (which is mostly empty since nothing on the Oto AI path writes `suggestions` except `handleDiagnosticFormConfirm`'s synthetic priority step). So `<PromptSuggestions>` only shows up after the local diagnostic-form-confirm trick (§1.5).
- `DEFAULT_SUGGESTIONS` (201-241) is a stage→suggestion mapping that nothing reads.
- **Duplicate type:** `ConversationStage` and `Suggestion` re-declared here, also in `services/ai/types.ts`. Two sources of truth.

#### 2.12 `AISuggestionTile.tsx`

- "Not currently used" per its own header comment (line 7). 73 lines of dead code. Delete or reuse.

#### 2.13 `AIWelcomeScreen.tsx`

- One-time disclaimer screen. ChatGPT-style three-info-item layout. `onContinue` flips `hasSeenWelcome` in the Zustand store (which is in-memory only, not persisted — every fresh app launch re-shows the disclaimer). That's a bug if you want one-time. Add AsyncStorage persistence to `useAIChatStore`.
- "Terms of Service" and "Privacy Policy" links are visual-only (`<Text>` with no `onPress`).

#### 2.14 `AIChatHistory.tsx`

- Sidebar drawer body. Plain list of `{id, title}` items; empty state "No Conversations yet".
- No swipe-to-delete, no rename, no "today/yesterday/last week" grouping. Bare-minimum sidebar.
- `paddingTop` prop is passed but never applied (the header uses `Spacing['5xl']` hardcoded at line 102) — inconsistent with the parent's `paddingTop={insets.top}` (index.tsx:1165).

#### 2.15 `AIAttachmentPanel.tsx`

- Discord-style photo picker. Loads up to 50 recent photos via `MediaLibrary.getAssetsAsync`, includes camera tile, drag-up-to-expand-to-modal-grid.
- Permission handling is direct (`MediaLibrary.requestPermissionsAsync` and `ImagePicker.requestCameraPermissionsAsync`). Failure shows an `Alert.alert`.
- 10-image cap enforced *only* in the parent (index.tsx:349) via `selectedImages.length >= 10` check. The panel itself doesn't know the limit and could submit 50 if the parent's check is removed.
- `EXPAND_THRESHOLD = -50` and the gesture handler look correct. `runOnJS(openFullGallery)()` properly bridges to JS thread.

#### 2.16 `AIToast.tsx`, `AISelectedImages.tsx`, `AIContextBar.tsx`, `AITypingIndicator.tsx`

- All small, focused, well-built. AIToast's `setShouldRender(false)` after fade-out completes is a clean pattern. AIContextBar uses `BlurView` for the frosted pill effect. AITypingIndicator is just a pulsing "Thinking" text (16px). AISelectedImages renders horizontal thumbnail row with X-to-remove.

### 3. The Integrated Picture

#### 3.1 Wire boundary: how a render envelope flows

```
User types → sendToOtoAI(text) →
  await sendMessageAction({ conversationId, message, vehicleVin })  // Convex action
  ← { text, quickReplies, showDiagnosticForm, showRecordConfirmation,
      showServicePicker, pickerServices, pickerPreSelectedId,
      shopCarousel, timeSelector, bookingConfirmation }
→ derive nextStage from envelope precedence (1.4)
→ build ChatMessage with all envelope fields attached
→ setState(messages: [...prev, aiMessage], currentStage: nextStage)
→ render loop in JSX matches per-message render-target conditions (1.1)
```

The action's return shape must be an opaque-ish object that exposes ALL of these as top-level fields. Verifying against dispatcher.ts:154-251, all field names match (`shopCarousel`, `timeSelector`, etc. → `renderD("shopCarousel", ...)`). Good.

#### 3.2 v0.9 trigger-only render envelopes — coverage matrix

| Envelope | Backend emits | Mobile destructures | Mobile renders | Status |
|---|---|---|---|---|
| `showServicePicker` + `pickerServices` + `pickerPreSelectedId` | yes (dispatcher:168-180) | yes | partially — picker mounts but ignores `pickerServices` and `pickerPreSelectedId` (§1.3) | **PARTIAL** |
| `showDiagnosticForm` | yes (207-214) | yes | yes (`<AIDiagnosticForm>`) | OK |
| `showRecordConfirmation` | yes (216-233) | yes | yes (`<AIRecordConfirmation>`) | OK |
| `shopCarousel` | yes (156-166) | yes (variable bound) | **NO renderer** — `<AIBookingCarousel>` reads `message.shops`, never `message.shopCarousel` | **MISSING** |
| `timeSelector` | yes (182-191) | yes (variable bound) | **NO renderer** at all | **MISSING** |
| `bookingConfirmation` | yes (193-205) | yes (variable bound) | **NO renderer** at all | **MISSING** |
| `quickReplies` | yes (235-236) | yes | yes (via bubble) | OK |
| `reasoning` | TBD — destructure doesn't include | NO | component exists, dead | UNWIRED |
| `sources` | TBD — destructure doesn't include | NO | component exists but render commented out | UNWIRED |

**Three of the four trigger-only envelopes have no rendering on mobile.** This is the single most important gap. Pending task #22 ("Build mobile components for v0.9 trigger-only render envelopes") covers it but is still pending.

What's actually needed to close the gap:

- **`<AIShopCarousel>`** (new, or adapt the existing one) that takes `{service_slug, priority}`, calls a Convex query (e.g. `api.mechanics.getRanked` or whatever the equivalent is), maps Convex docs → `AIMechanic` shape, then delegates to the existing `<AIBookingCarousel>`. The mapping layer is the key — `MOCK_MECHANICS` does it for the rule path; nothing does it for live data.
- **`<AITimeSelector>`** (new) — takes `{mechanic_id, service_slug}`, calls `useTimeSlotsForShop` (which already exists at `hooks/useTimeSlotsForShop.ts`), renders a slot grid, on tap calls a handler that pushes `selected slot_id` into established_facts.
- **`<AIBookingConfirmation>`** (new) — takes `{service_slug, mechanic_id, slot_id, vehicle_id}`, queries Convex for service name, real prices (mechanic's rate × parts × fee), platform fee, total, shop info, slot details, renders a summary card with a "Confirm Booking" button that navigates to `/home/mechanic/{id}/payment`.

Until those three components exist, the Oto AI 6-stage booking chain is rendering-bankrupt past stage 2.

#### 3.3 `services/ai/scenarios.ts` ↔ Oto AI consistency

The rule-engine `SCENARIOS` array (in `scenarios.ts`) and the Oto AI Convex action are entirely independent code paths. The `USE_OTO_AI_ACTION = true` flag (index.tsx:104) gates one or the other. The legacy code is preserved verbatim for "instant flip-back" (105). 

Inconsistencies that matter:

1. **`AIMechanic` shape** is defined for the rule engine and depends on `MOCK_MECHANICS`. Nothing on the Oto AI path produces it from real Convex data. (See §3.2.)
2. **`ScenarioType` enum** (`oil_change | brake_noise | check_engine | tire_pressure | vague_issue | direct_booking | new_vehicle`) drives the rule engine's pattern matching and the conversation_state's `scenario_detected` field. The Oto AI path stores conversations with `scenario_detected: ""` for most turns (the sidebar fallback at index.tsx:151-153 shows the date when the scenario is empty). So scenario tagging is missing from the live path — it's dead metadata.
3. **`SOURCE_DEFINITIONS`** and `getSourcesForScenario` build hardcoded source pills per scenario. These are entirely rule-engine. The live path doesn't surface sources.
4. **`PROMPT_SUGGESTIONS`** and `WELCOME_SUGGESTIONS` (the latter exported from scenarios.ts via scenarioEngine.ts, used at index.tsx:1410). Both are static lists. They drive the welcome screen on both paths. Consistency-wise OK but the Oto AI path ignores `state.suggestions` after the welcome turn (because Oto AI never updates `suggestions`).
5. **`handleDiagnosticFormConfirm`** (§1.5) hardcodes a *priority-selection* step that re-implements scenarios.ts logic locally, rather than asking Oto. This is the worst offender — mixing a rule-engine step into the live path.

#### 3.4 The 6-stage booking chain — does mobile support all 6 end-to-end?

Per system_prompt.ts:654-659:

| Stage | Tool | Mobile UI | Working? |
|---|---|---|---|
| 1. service_selection | `render_service_picker` | `<AIServicePicker>` | partial — renders, but ignores `pickerServices` + `pickerPreSelectedId`; uses hardcoded `DEFAULT_SERVICES`. **handleServiceSelect funnels back to Oto correctly.** |
| 2. diagnostic_form | `render_diagnostic_form` | `<AIDiagnosticForm>` | works — but `handleDiagnosticFormConfirm` injects a synthetic priority-prompt AI turn instead of letting Oto respond. |
| 3. priority_selection | (no render tool — quick replies) | quick replies via `<AIMessageBubble>` | works — quickReply tap funnels through `sendToOtoAI`. |
| 4. shop_selection | `render_shop_carousel` | **MISSING** | **BROKEN** — no consumer of `shopCarousel`. |
| 5. time_selection | `render_time_selector` | **MISSING** | **BROKEN** |
| 6. confirmation | `render_booking_confirmation` | **MISSING** | **BROKEN** |

The chain breaks at stage 4. The user reaches stage 3 (the AI replies with quick reply pills), taps "Closest", Oto fires `render_shop_carousel`, the envelope arrives intact at the mobile, the field is destructured, attached to the message — and then nothing draws it. The user sees only the AI's accompanying one-sentence text ("Top 5 mechanics that handle Diagnostic Scans, sorted by closest.") with no carousel below it.

`handleBookNow` (the only path into the booking screen) is never reachable because it requires `<AIBookingCarousel>` which requires `message.shops` which is never set on the Oto AI path. (§1.7)

#### 3.5 Suggestion / quick-reply handling

- **Welcome-screen prompt tiles:** `WELCOME_SUGGESTIONS` are passed to `<AIGreeting>` which doesn't render them (§2.4). Effectively dead UI — users only have the vehicle carousel as their entry point.
- **In-conversation quick replies:** Backend → `render_quick_replies` → `quickReplies` field → `<AIMessageBubble>` → `<AIQuickReplies>` → `handleQuickReplySelect` → `sendToOtoAI(reply.value || reply.text)`. Clean, working.
- **PromptSuggestions (`state.suggestions`):** Only ever populated by `handleDiagnosticFormConfirm`'s local synthesis (§1.5). On all other turns this is empty and the `<PromptSuggestions>` block at index.tsx:1487-1494 is silent.

#### 3.6 Image attachment + voice mode integration status

**Images:** Functional end-to-end on the upload side. `<AIAttachmentPanel>` → `selectedImages` state → `<AIInputBox>` send → `sendToOtoAI(messageText, attachedImages)` → `userMessage.images` set on the local optimistic message → image-only sends use the sentinel content `"Here's an image for you to analyze"` (index.tsx:567).

**However:** `attachedImages` is *never sent to the backend.* `sendMessageAction` is called with `{ conversationId, message, vehicleVin }` only (index.tsx:441-448) — no `images`. The optimistic local user-message echo shows the thumbnails to the user, but Oto never sees them. This is a major gap — the entire attachment flow is local-only theater on the active path.

**Voice:** `useVoiceRecording` is a mock (§1.8). Hold mic → simulated waveform → release → `Alert.alert("Coming Soon")`. Dead.

#### 3.7 Other observations

- **Drawer/gesture machinery** (index.tsx:1058-1129) is complex but works. Pan gesture opens a sidebar by translating the chat card right. The `closeGesture` is registered only when `showHistory` is true. Reanimated worklets used correctly.
- **Liquid glass `try { require } catch {}`** pattern (index.tsx:41-45, AIInputBox.tsx:50-56, PromptSuggestions.tsx:39-45) is repeated in 3+ files. Should be a single helper module.
- **The screen relies on `convex/_generated/api`** in many places — will break loudly if the backend renames `api.oto.chat.sendMessage`, but at least it's typed.
- **No error boundary** anywhere in the chat tree. A crash in `<AIMessageBubble>` for a malformed message takes the whole screen down.

### 4. Top-Priority Fixes (mobile-side only)

1. **Build the three missing render-target components** — `<AIShopCarousel>`, `<AITimeSelector>`, `<AIBookingConfirmation>` — each as a thin wrapper that takes the trigger envelope, queries Convex for real data, and either renders inline or delegates to the existing carousel. This unblocks stages 4–6 of the booking chain.
2. **Wire `pickerServices` and `pickerPreSelectedId` into `<AIServicePicker>`** so the AI's pre-selection actually displays. Add `services?` and `preSelectedId?` props; merge with defaults.
3. **Send `attachedImages` to the backend.** Add `images: string[]` to the `sendMessageAction` call. Without this the entire attachment feature is a local mock.
4. **Replace `useVoiceRecording` mock with a real implementation** (or hide the mic). Current state ships broken UX.
5. **Remove or gate `MOCK_VEHICLES` injection** in `AIGreeting` (line 69, line 177). Producing AI conversations against the literal string `"mock_1"` as the VIN is bad enough; doing it in production is worse.
6. **Stop the local synthesis in `handleDiagnosticFormConfirm`** — let Oto produce the priority prompt. This will reduce two streaming layers to one, eliminate hardcoded quick replies, and let Haiku see the real conversation flow.
7. **Reconstruct render envelopes when loading from history** (index.tsx:986-997). Currently re-opening past Oto AI conversations strips all interactive widgets.
8. **Persist `hasSeenWelcome`** across launches (it's in-memory in Zustand).
9. **Eliminate duplicate type definitions** — `MessageSection`, `AIMessage`, `Suggestion`, `ConversationStage` are declared in both `services/ai/types.ts` and individual component files.
10. **Either uncomment `<AISources>` or delete the file.** Same for `<AISuggestionTile>`. Same for `getSourcesForScenario`.

---

## Section 3 — Data Layer Audit

**Audience:** senior engineers fluent in Convex. **Scope:** the schema rows Oto reads/writes, the `convex/oto/*` surface, `maintenance.ts`, the pipeline, and the pure helpers under `utils/`. What's good gets one line; what's wrong gets a paragraph.

### 1. Tables Oto Touches

#### 1.1 `ai_conversations` (`convex/schema.ts:1587`)

**Purpose.** Per-session conversation row; the only place persistent Oto state lives outside `ai_messages` and `vehicle_facts`. Every Oto turn reads-modifies-writes this row.

**Hot fields.** `mood`, `arc_summary`, `established_facts: string[]`, `last_user_intent`, `state_updated_at`, `current_model`, `diagnostic_turn_count`, `session_id`, `user_id`.

**Indexes & their use.**
- `by_user_id` — used by `ai_conversations.getByUserId` (history list).
- `by_session_id` — used by `getBySessionId`.
- `by_booking_id`, `by_started_at` — defined but **no caller**. Dead weight; verify by ripgrep before removing.

**Schema observations.**
- `established_facts` is `v.array(v.string())` — opaque blobs like `"selected mechanic_id: k57abcXYZ123"`. The field is BOTH a Haiku-write target (full-list replacement, `updateState`) AND a frontend-write target (append, `appendEstablishedFact`). The two writers race by design and the comment in `appendEstablishedFact` (`convex/ai_conversations.ts:151`) literally calls this out: Haiku caps at 10, frontend caps at 15, "frontend pushes can race." This is a real bug surface — a Haiku full-replace can blow away a card the user just tapped, and a frontend append into a stale array can resurrect a Haiku-deleted fact. There is no version stamp, no conflict resolution, no merge. For a moat feature it's startlingly fragile.
- `current_model: v.optional(v.string())` is a free string — there's no `v.union(v.literal("haiku"), v.literal("sonnet"))` in the schema even though `setCurrentModel` (`ai_conversations.ts:109`) constrains it via the validator. A bad backfill can write garbage and chat.ts will read it.
- No `vehicle_id` column even though `envelope.ts:71-75` already documents the forward-compat for it. Active vehicle is recomputed every turn from `vehicle_owners` ordering — a known footgun if the user has more than one car.
- `diagnostic_turn_count` lives on the conversation row, but the chat.ts increment is server-managed (Locked Principle #6). Fine. But `setDiagnosticTurnCount` (`ai_conversations.ts:185`) is exposed as a public mutation — any caller with auth can reset the polite-exit counter to 0. Should be `internalMutation`.

**Write paths.**
- `create` (public, no auth check) — gap.
- `updateState` (Haiku via `update_conversation_state`).
- `setCurrentModel` (Haiku/Sonnet handoff tools).
- `appendEstablishedFact` (mobile, on user tap).
- `setDiagnosticTurnCount` (chat.ts).
- `incrementMessageCount`, `linkBooking`, `end`, `updateScenario` — public, **none check auth**. Anyone can mutate any conversation by id.

**Read paths.** Chat envelope build, `getById/getBySessionId/getByUserId`.

#### 1.2 `ai_messages` (`convex/schema.ts:1631`)

**Purpose.** Per-turn role/content log.

**Fields.** `conversation_id`, `role: string` (no enum constraint), `content: string`, `timestamp`, `confidence_score: optional`, `metadata: v.any()`.

**Indexes.** `by_conversation_id`, `by_role`, `by_timestamp`. `by_role` is almost certainly never used — there's no query keyed by role alone. Likely dead.

**Issues.**
- `role` is a free `v.string()`. Should be `v.union(v.literal("user"), v.literal("assistant"))`.
- `metadata: v.any()` — the `create` mutation defines a typed object validator (`ai_messages.ts:36-42`) with `service_suggestions`, `shop_suggestions`, `intent_detected` — but the schema accepts anything, so direct inserts (e.g. an Oto envelope blob) will land unchecked. This is a documented v0.5 shape; v0.9 emits much richer metadata (render directives, reasoning, sources). Schema is now lying about what it stores.
- `create` does not check auth. Any authed client can write a message into any conversation.

**Read by Oto.** `chat.ts` reads the last `HISTORY_TURNS = 10` messages to build the conversation envelope (per `convex/oto/chat.ts:71`). No paginated query — full collect on `by_conversation_id`. For a long conversation this becomes a 1MB+ Convex query budget hit.

#### 1.3 `vehicle_facts` (`convex/schema.ts:1667`) — the KB

**Purpose.** Oto's growing KB. One row = one fact, scoped on one of five axes (`vehicle | trim | chassis | engine | model_year`).

**Key fields.** `topic`, `topic_axis`, scoping ids (`vehicle_config_id | chassis_code | engine_code | make/model + year_min/year_max`), `fact_text`, `question_text`, `answer_format`, `source` (5-value enum), `cited_url`, `confidence: number`, `embedding: array(float64)?`.

**Indexes.**
- `by_vehicle_config(vehicle_config_id, topic)` — used by `lookupFactsStructural` exact match.
- `by_chassis(chassis_code, topic)` — chassis fallback.
- `by_engine(engine_code, topic)` — engine fallback.
- `by_make_model_year(make, model, year_min)` — defined but never queried by anything Oto-side. Dead.
- `by_topic_axis(topic_axis, topic)` — also unused at the read sites.
- `vectorIndex by_embedding` — semantic search filtered on `[topic_axis, topic]`.

**Schema observations.**
- `topic` is a free string — no taxonomy enforcement. Haiku can record `"oil"`, `"engine_oil"`, `"motor_oil"` and structural fallback (which keys on `topic` equality) will never see them. `lookupFactsStructural` doesn't normalize. This guarantees fragmentation as the KB grows. Either (a) lock `topic` to an enum or (b) store a normalized `topic_norm` field with the index built on it.
- Embedding is `v.optional(v.array(v.float64()))` with vectorIndex `dimensions: 1536`. The schema comment (1703-1707) admits Voyage embeddings are 1024-dim and there's no plan: "Schema accepts the OpenAI default; if VOYAGE is configured, embed action coerces dimensions or we add a separate table." Until OPENAI_API_KEY is set the embedding column is null on every row and semantic search returns zero hits — the KB is structural-only. Task #11 confirms this is unresolved.
- `confidence: v.number()` here is numeric — but `maintenance_records.confidence` (next section) is categorical string. Same field name, two completely different semantics. Naming collision waiting to bite a junior dev.
- `source: union(literal x5)` is good. But `"propagated"` exists and `propagated_from_id` exists, and there is **no propagation code anywhere in `convex/oto/*` or `convex/vehicleEnrichment/*`**. The cross-vehicle propagation that Locked Principle #5 ("the moat") is built around is not implemented. This is the single biggest gap in the data layer relative to its stated mission.
- No `created_by_user_id` — every fact is anonymous to a user. If one user pollutes the KB with a wrong fact, you can't retract by-user.
- No write-throttle / dedupe. `recordFact` will happily insert a 50th identical "BMW M550i takes 5W-30 oil" row if Haiku calls it 50 times.

**Write path.** `recordFact` action (`convex/oto/vehicleFactsKB.ts:237`): insert row → if `OPENAI_API_KEY`, fetch /v1/embeddings with the OpenAI bearer token → patch embedding. Embedding failures are swallowed (`:309`). The action calls a **public** mutation `insertFact` that does check auth (`:209`), so the trust boundary is OK; but `patchEmbedding` (`:219`) does NOT check auth — any client can clobber any fact's embedding. Likely meant to be `internalMutation`.

**Read paths from Oto.** `lookupFactsStructural` query, `lookupFactsSemantic` action, `embedText` action, `getFactById` internalQuery. The chat action embeds the user message, calls semantic, then falls through to structural. None of the call sites use `by_make_model_year` or `by_topic_axis` indexes.

#### 1.4 `oto_telemetry` (`convex/schema.ts:1730`)

**Purpose.** Per-turn observability row. One row per `sendMessage` call.

**Fields.** `conversation_id`, `user_id`, `ts`, `model`, `system_prompt_version`, `iterations_used`, `hit_cap`, token counters, `total_latency_ms`, `tools_called: array(string)`, `final_branch: string`, `booking_id?`, `error?`.

**Indexes.** `by_conversation_id`, `by_user_id`, `by_ts`, `by_user_ts`. Reasonable.

**Issues.**
- `model`, `system_prompt_version`, `final_branch` all free strings. Should be unions to prevent silent drift across deploys.
- No `iteration_token_breakdown` — aggregate-only. If you want per-iteration cost analysis later (which Task #15 implies), you can't.
- `recordTurn` has zero auth check. The Locked Principle #12 rationale says "fire-and-forget from chat.ts" — and chat.ts is the only legitimate caller — but the mutation accepts a `conversation_id` + `user_id` pair from any caller. Any client can backfill telemetry rows for any user. Make it `internalMutation`.
- No retention policy. Telemetry rows accumulate forever; at scale this table will dominate Convex storage cost.

#### 1.5 `vehicle_owners` (`convex/schema.ts:681`) — Oto's primary owner-side join

**Purpose.** Per-(user, VIN) ownership row. Oto reads ~20 fields off this for health, mood, lease state, mileage, knownIssues, plus the cached `health_score` and `health_score_is_estimated`.

**Indexes.** `by_vin`, `by_user_id`, `by_vin_user`, `by_user_status`, `by_smartcar_vehicle_id`. All used.

**Schema observations.**
- 47 fields on this row (per the comment). It's a god-table. `usagePattern`, `usage_pattern`, `drivingConditions` are three onboarding-derived fields with overlapping semantics; `vehicleHealth.ts:222` uses `drivingConditions` and `avgMonthlyDriving`, the pipeline uses `usage_pattern || drivingConditions` (`maintenance_pipeline.ts:364`). Pick one or normalize.
- `knownIssues: v.any()` — typed-as-anything but the consumers (`vehicleHealth.ts:221`, `maintenance_pipeline.ts:552`, `healthScore.ts:87`) all assume `string[]` with sentinel-prefix semantics ("no_all_clear" | "not_sure" | "check_engine" | "other"+ids | "different_light"+ids). This contract is reconstructed in three different places — and `vehicleHealth.ts:62` documents that drift between them caused real production bugs ("temperature and something else under 'other'").
- `health_score` and `health_score_is_estimated` are denormalized cache fields. The pipeline writes `is_estimated: false` (`maintenance_pipeline.ts:300`) but **nothing ever sets it back to true**. The boolean is functionally dead — once the pipeline runs once, the score is forever "not estimated" even if the underlying data is stale.

#### 1.6 `vehicles` and `vehicle_configs` (`convex/schema.ts:659`, `:196`)

**Read by Oto.** `getVehicleFacts` does the full 5-table join (`vehicles → vehicle_configs → makes/models/trims/engines/transmissions/trim_specs`). `lookupVehicleSpec` does the same join for non-owned vehicles.

**Issues.**
- `getVehicleFacts` (`convex/oto/vehicleFacts.ts`) does ~7 db.gets per call, plus a `trim_specs` lookup — borderline acceptable for an interactive AI tool, but there's no caching layer. For a hot conversation this hits ~7 Convex doc reads × N tool calls.
- `lookupVehicleSpec.ts:147-155` does an unindexed `.filter(q.eq(make_id))` to enumerate models, then again on `vehicle_configs`. Comment in `vehicleFacts.ts:118-122` correctly warns about exactly this anti-pattern: ".filter forces a full table scan and makes this query time out (~1s Convex query budget)." But `lookupVehicleSpec` violates it. With `models` and `vehicle_configs` at production scale (1000s of rows) this query will get slow or time out. **There is a `models.by_make_id` index defined at `:63` and `vehicle_configs.by_make_model_year` at `:246` — neither is used here.**
- `vehicle_configs` carries 25+ fields including denormalized fluid/brake info that is ALSO on `chassis_specs` (lines 213-216 vs 169-180). Two sources of truth; `getVehicleFacts:212` reads from `vehicle_configs`. If chassis_specs is updated by an enrichment run after vehicle_configs is filled, Oto reads stale data.
- `vehicle_configs.generation_id` references a table the schema header itself marks deprecated (`:69`).

#### 1.7 `maintenance_records` (`convex/schema.ts:961`) — the trust-protocol table

**Fields.** `vehicleOwnerId`, `type: string` (no enum), `lastServiceDate: union(string|number)`, `lastServiceMileage: number?`, `customInputs: any?`, `confirmedHealthyAt: number?`, `serviceSource: string?`, `confidence: string?`, timestamps.

**Indexes.** `by_vehicle_owner`, `by_vehicle_and_type`. Both used.

**The union-type weirdness.** `lastServiceDate: v.optional(v.union(v.string(), v.number()))` is a tell that legacy data wrote ISO strings and newer code writes ms epochs. Three downstream paths cope:
1. `vehicleHealth.ts:230` — `typeof rec.lastServiceDate === "number" ? rec.lastServiceDate : undefined`. Strings silently become "no record" for the AI.
2. `recordConfirmation.ts:97` — same coerce-or-drop.
3. `maintenance.ts:upsertRecord` arg validator (`:85`) is `v.optional(v.float64())`. So the only writer **cannot insert string dates** — it would fail the validator. Yet the schema still permits them. This is half-finished migration: writers were locked to numeric; readers gracefully degrade; legacy strings sit in the table being silently treated as missing data. The `useMaintenanceData` hook (`hooks/useMaintenanceData.ts:41`) types `lastServiceDate?: number` — so the mobile UI also drops strings. **Action:** write a migration to coerce or delete the string rows, then change the schema to `v.optional(v.float64())`.

**The confidence label.** Schema is `v.optional(v.string())` with a docstring (`:969-971`) admitting "Schema was originally v.number() but every writer uses string labels — the validator was the side that drifted." This is honest. Fine. But there's no `v.union` constraint, and the four documented writer values ("verified", "self_reported", "unverified", "ai_chat_correction") are not enforced. `vehicleHealth.ts:251` collapses everything-not-"verified" to `"self_reported"`. So `"unverified"` (which exists in the wild — see `maintenance.ts:73` reference) is silently treated identically to `"self_reported"`. The trust protocol that depends on this distinction (Tasks #5–#8) is built on a mushy contract. Lock the union.

**The trust-signal write paths.** Documented in `maintenance.ts:73-79`:
- onboarding → `self_reported` / `onboarding`
- check-in → `self_reported` / `checkin` + `confirmedHealthyAt`
- completed booking → `verified` / `booking`
- service-record upload → `verified` / `uploaded_record`
- mechanic onboarding → `verified` / `mechanic_onboarded`
- AI chat correction → `self_reported` / `ai_chat_correction`

But these writers are **scattered** — I can't find a single source-of-truth helper. Every writer assembles its own confidence label. Drift from the documentation is only a matter of time.

**Side effect of `upsertRecord`.** Schedules `maintenance_pipeline.runPipeline` with `triggeredBy: "quick_read"` (`:145`) on every write. So an AI render-confirm tap retriggers the full pipeline (intervals_only branch, but still per-service iteration). At scale this is a thundering-herd risk: a chat that produces 5 confirmations triggers 5 pipelines.

#### 1.8 `vehicle_service_states` (`convex/schema.ts:932`)

**Purpose.** Pipeline output — per-service urgency/due/applicability.

**Read by Oto.** `getDueServices` (`convex/oto/dueServices.ts`).

**Indexes.** `by_vehicle_owner` (used), `by_vehicle_service`, `by_urgency`, `by_surfaced`. The latter two indexes are tempting for cross-user analytics but Oto uses neither. `getDueServices` collects everything for the owner and filters in JS — fine since the row count per owner is bounded (~30 services).

**Issue.** `last_service_date` is `v.optional(v.number())` here — *single-typed* — even though it sources from `maintenance_records.lastServiceDate` which is union. The pipeline (`maintenance_pipeline.ts:513`) reads `r.lastServiceDate` straight through. **If a legacy string slipped through, this writes a string into a `v.number()` field and the pipeline crashes.** Today it doesn't crash because the user-facing writer is locked numeric — but anyone running a backfill against legacy data is in for a bad day.

#### 1.9 `vehicle_health_snapshots` (`convex/schema.ts:980`)

Defined; **not read by any `convex/oto/*` file** (verified via Grep). The Oto path computes health on-the-fly via `computeVehicleHealthScore` rather than reading snapshots. This table looks orphaned for AI purposes; check if any non-Oto consumer still writes/reads it before deciding it's dead.

#### 1.10 `bookings` (`convex/schema.ts:1222`)

**Read by Oto.** `getBookings` (`convex/oto/bookings.ts`) — collects all rows on `by_user_id`, filters by status, enriches with shop/mechanic/services. No pagination — every Oto turn that asks for bookings reads the user's full booking history.

**Issues from Oto's perspective.**
- `bookings` has 40+ fields. `getBookings` returns a 9-field summary, which is fine — but it does ~3 db.gets per booking returned (shop, mechanic, services map). `cap=20` means up to ~80 doc reads per call.
- No `by_user_and_created_at` compound index — the file sorts in JS after collect (`:71`). `cap=20` makes this OK for now but the right fix is the compound index.
- `diagnostic_system` is one of the few unioned-literal fields in the whole schema — good. The customer_notes / diagnostic_system pair are exactly what Oto's `render_diagnostic_form` writes, so the contract is locked. `tires_wheels` snake_case literal needs to stay matched between Oto's tool schema, the booking validator, and the mobile component.

#### 1.11 `services`, `service_options`, `service_categories` (`convex/schema.ts:551, 583, 576`)

Read by Oto via `list_services_for_vehicle` and `get_service_details` (in `convex/oto/tools.ts`, not audited deeply per scope). The 23-slug catalog is the contract Oto uses for every render call.

**Service issues.**
- `services.slug` is `v.optional(v.string())` — the slug is THE join key for every Oto tool, every URL, every analytics event. Optional is wrong. Lock to `v.string()` (and add a `by_slug_unique` constraint at the application layer if Convex doesn't support unique indexes natively — it does not).
- `service_categories` has zero indexes — `pipeline.ts:97` does `ctx.db.get(category_id)` so it's by id, fine; but anything that wanted `by_name` lookup would scan.
- The 17 boolean `requires_*` fields on `services` are good but there's no `applicable_when` predicate object — every applicability check is hand-coded.

#### 1.12 `users` (`convex/schema.ts:994`)

Read by Oto on every turn for auth. `by_clerkUserId` is the right index; used everywhere.

**Issue.** Every Oto query repeats this 5-line pattern:

```ts
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("unauthenticated");
const user = await ctx.db.query("users")
  .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
  .unique();
if (!user) throw new Error("user not found in Convex");
```

Repeated verbatim in `vehicleHealth.ts:165`, `dueServices.ts:41`, `vehicleFacts.ts:73`, `bookings.ts:46`, `recordConfirmation.ts:55`, plus all five mutations in `ai_conversations.ts`. There should be a `requireAuthedUser(ctx)` helper. Beyond DRY, when one of these 8 sites forgets the check (as the public mutations in `ai_conversations.ts` and `ai_messages.ts` already have), the auth boundary leaks silently.

#### 1.13 `vehicle_classifications` (`convex/schema.ts:884`)

Pipeline output, supersede-style (`status: "active"` flips to `"superseded"`). Oto does NOT read this directly — it reads the denormalized fields off `vehicle_owners` instead (`vehicle_mode`, `owner_segment`, etc.). Indexes are sized for the pipeline, not Oto.

### 2. Function Files

#### 2.1 `convex/ai_conversations.ts`

| Function | Type | Auth check | Notes |
|---|---|---|---|
| `getById` | query | none | Returns any conversation by id. Lookup-by-id leak. |
| `getBySessionId` | query | none | Same. |
| `getByUserId` | query | yes | OK. |
| `create` | mutation | none | Anyone can create a conversation in any user_id. |
| `updateState` | mutation | yes + ownership | Correct. |
| `setCurrentModel` | mutation | yes + ownership | Correct. Should arguably be internal — Haiku tools call it via the dispatcher, not directly from the client. |
| `appendEstablishedFact` | mutation | yes + ownership | Correct. Race condition with `updateState` (see §1.1). |
| `setDiagnosticTurnCount` | mutation | yes + ownership | Should be internalMutation — only chat.ts is meant to call it. |
| `updateScenario` / `incrementMessageCount` / `linkBooking` / `end` | mutations | none | All four are unauthenticated. `linkBooking` lets any client link any booking to any conversation. |

Six of eleven functions have insufficient auth. This is the worst-protected file in the audit.

#### 2.2 `convex/ai_messages.ts`

| Function | Auth | Notes |
|---|---|---|
| `list` | none | `ctx.db.query("ai_messages").collect()` — full table scan, returns every message in the deployment to any caller. **Critical.** Either delete or restrict to admins. |
| `getById` | none | Same lookup-by-id leak. |
| `getByConversationId` | none | Same. |
| `create` | none | Any client can write a message into any conversation. The `metadata` validator is also drifted vs schema (see §1.2). |

Worst file in the audit. `list` is a one-call PII exfiltration of every conversation in the system.

#### 2.3 `convex/maintenance.ts`

- `getRecordsByVehicle`, `getRecordsByMultipleVehicles` — queries, no auth check. Lookup by vehicle owner id leaks records. Should require auth + owner check.
- `upsertRecord` — see §1.7 union mismatch. Auth not checked. Pipeline scheduling is correct.
- `deleteRecord` — auth not checked. Anyone with a record id can delete it.

#### 2.4 `convex/maintenance_pipeline.ts`

All `internalAction` / `internalMutation` / `internalQuery` — correct. Cannot be called from clients.

Code-quality observations:
- 836 lines, single function `runPipeline` is ~470 lines (`:309-782`). Should be sliced into named steps. The inline `TYPE_TO_SLUGS` map (`:519`) and `SLUG_TO_TYPE` derivation (`:533`) duplicate logic that probably belongs in a constants file alongside `MAINTENANCE_LABELS` in `utils/maintenanceStatus.ts`.
- The N+1 in step 6 (`:540-549`) — `await ctx.runQuery(getServiceById)` per spec — is a real perf issue. Specs come with `service_id` already; batch-fetch into a Map.
- `calculateHealthFromStates` (`:789`) is a duplicate of logic in `utils/healthScore.ts` — different formula, different penalty curve, different floors. The pipeline writes the cached score; the AI tool's `getVehicleHealth` recomputes via `computeVehicleHealthScore`. **Two scores can disagree.** The AI returns the recomputed value (`vehicleHealth.ts:394`) while the mobile UI sometimes shows the cached `vehicle_owners.health_score`. The `score_is_estimated` boolean is the only signal of disagreement, and it's broken (§1.5).
- `quick_read_flag` write (`:728`) only includes "override" cases — silently drops other diagnostic signals.

#### 2.5 `convex/oto/vehicleHealth.ts`

The most thoughtful file in the audit — explicit provenance derivation, careful comments, server-side mirror of the mobile merge logic.

Issues:
- 200+ lines, mostly `loadVehicleContext`. That helper is shared with `getProjectedHealthScore`; if a third consumer arrives, refactor.
- Year-derivation fallback chain (`:209-218`) reads `vehicle.metadata` as untyped JSON — `vehicle.metadata: v.any()` schema strikes again.
- `provenanceByType` map default-falls-through to `"self_reported"` — but a record with `confidence: undefined` (perfectly legal under the optional schema) is then treated as soft data, which is the conservative choice and correct.
- `unknown-` prefix is the only signal of "no record exists." Type-coupling on string prefixes is fragile. Make `provenance` an explicit field on `MaintenanceItem`.

#### 2.6 `convex/oto/vehicleFactsKB.ts`

See §1.3. The structural lookup is competent. `recordFact` has a real outbound HTTP call inside an action — fine, but no timeout, no retry policy. OpenAI 429s will silently degrade the KB. The `embedded: false` return value isn't surfaced to Haiku in any way the audit could find.

#### 2.7 `convex/oto/dueServices.ts` / `oto/bookings.ts` / `oto/recordConfirmation.ts` / `oto/vehicleFacts.ts`

All four follow the same pattern: identity → user → vehicle → owner → data. All four duplicate the auth boilerplate. All four are competent and reasonably small. `vehicleFacts.ts` does the only borderline-heavy join (5 tables in parallel via `Promise.all`).

#### 2.8 `convex/oto/lookupVehicleSpec.ts`

The unindexed-filter problem (§1.6) is the headline. Otherwise the word-boundary tokenizer (`:106`) is well-thought through and the M5/M550i collision case it guards against is real. Score-based ranking is reasonable. This file will become the slowest Oto query as the catalog grows.

#### 2.9 `convex/oto/telemetry.ts`

20 lines. Wide-open mutation (§1.4). Should be `internalMutation`.

#### 2.10 `utils/maintenanceStatus.ts`, `utils/healthScore.ts`, `utils/maintenanceEnrichment.ts`

Pure functions, no Convex. Read by both `useMaintenanceData` (mobile) and `convex/oto/vehicleHealth.ts` (server). The "single source of truth for the AI/UI parity" comment in `vehicleHealth.ts:8` is upheld for the merge logic. But `healthScore.ts:23-29` STATUS_SCORE differs from `maintenance_pipeline.ts:792-798` scoreMap — the AI/UI side gives `due_soon: 0.7` (a 0-1 multiplier of mileage curve), the pipeline side gives `low: 85` (a 0-100 absolute score with different category names entirely). These are not comparable formulas. The cached pipeline `health_score` and the AI's recomputed `score` are by construction different numbers.

### 3. Integrated Picture

#### 3.1 Full data flow on a "user reports symptom → books" turn

1. Mobile sends user message → `convex/oto/chat.ts:sendMessage` action.
2. Chat loads `users` (auth), `vehicle_owners`, `vehicles`, `ai_conversations`, last 10 `ai_messages`.
3. Chat builds envelope (uncached zone) and calls Anthropic Haiku with the OTO_TOOLS surface.
4. Haiku may call:
   - `get_vehicle_health` → `vehicleHealth.ts:loadVehicleContext` → 5 db.gets + records collect → recompute via `computeVehicleHealthScore` → return snake_case shape with provenance.
   - `get_due_services` → `dueServices.ts` → reads `vehicle_service_states`, joins services, returns sorted urgency list.
   - `get_vehicle_facts` → `vehicleFacts.ts` → 7-way join of vehicle + config + engine + transmission + trim + make + model + trim_specs.
   - `lookup_vehicle_spec` → `lookupVehicleSpec.ts` → fragile unindexed-filter walk over makes/models/configs.
   - `retrieve_vehicle_facts` → `vehicleFactsKB.lookupFactsSemantic` (if embedded) or `lookupFactsStructural`.
   - `record_vehicle_fact` → `vehicleFactsKB.recordFact` → `insertFact` mutation + OpenAI embed + `patchEmbedding`.
   - `update_conversation_state` → `ai_conversations.updateState` → REPLACES established_facts.
   - `render_diagnostic_form` / `render_record_confirmation` / etc. — terminal render directives, no DB write from chat.
5. After Haiku returns final text, chat persists assistant message via `ai_messages.create` (no auth) and writes one row to `oto_telemetry` (no auth).
6. Mobile renders. If user taps a card on a render component, it calls:
   - `appendEstablishedFact` (race-prone with updateState).
   - For record confirmation: `maintenance.upsertRecord` with `confidence: "self_reported"` + `serviceSource: "ai_chat_correction"` → schedules `maintenance_pipeline.runPipeline` with `triggeredBy: "quick_read"` → updates `vehicle_service_states`, `vehicle_owners.health_score` (always sets `is_estimated: false`).
7. Next turn: chat reads `ai_conversations.established_facts`, replays in `<conversation_state>`, Haiku composes next render input.

#### 3.2 Trust signal sources mapping

| Writer | confidence | serviceSource | confirmedHealthyAt | Provenance Oto sees |
|---|---|---|---|---|
| Onboarding flow | `self_reported` | `onboarding` | — | self_reported |
| Quarterly check-in (Q4b "fine") | `self_reported` | `checkin` | `Date.now()` | self_reported (NOT promoted by `confirmedHealthyAt` per `vehicleHealth.ts:104`) |
| Booking completed | `verified` | `booking` | — | verified |
| Service-record upload | `verified` | `uploaded_record` | — | verified |
| Mechanic onboarding | `verified` | `mechanic_onboarded` | — | verified |
| AI chat correction (user updates record) | `self_reported` | `ai_chat_correction` | — | self_reported |
| AI chat confirmation (user says "yes that's right") | unset | unset | `Date.now()` | inferred (silent — `upsertRecord` doesn't set confidence in this path) |
| No record exists | — | — | — | inferred |

Two issues. First, the AI-confirm-existing-record path doesn't set `confidence` at all (`maintenance.ts:79` only documents the correction path). The record stays at whatever its prior confidence was. That's fine in principle, but it means the "user just confirmed via Oto" signal lives only in `confirmedHealthyAt`, and the trust protocol on the Oto side ignores `confirmedHealthyAt` (`vehicleHealth.ts:104`). So Oto cannot distinguish "user actively confirmed in chat 2 days ago" from "user did onboarding 6 months ago." Second, there's no audit trail — overwriting a `verified` row via `ai_chat_correction` (which sets `self_reported`) silently downgrades trust with no history. Add an event-sourced `maintenance_record_history` or move to append-only.

#### 3.3 KB write path

`record_vehicle_fact` tool → `convex/oto/vehicleFactsKB.ts:recordFact` action:
1. Public mutation `insertFact` with auth check → row created.
2. If `OPENAI_API_KEY` set, fetch /v1/embeddings, model `text-embedding-3-small`, dim 1536.
3. If 1536-dim vector returned, public mutation `patchEmbedding` (NO auth check) → row patched.
4. Embedding errors are swallowed; row remains structurally searchable.

Gaps in this path:
- No dedupe. Haiku can write 50 identical facts; nothing collapses them.
- No source-quality gating. `source: "oto_inferred"` (Haiku making things up) and `source: "manufacturer"` are weighted identically by structural lookup.
- The `propagated_from_id` field exists but no propagation job exists. Same-chassis cars don't share facts.
- No retraction path — if Oto records `"BMW M550i has S63 engine"` (the actual hallucination from Task #19), there's no `retractFact` mutation to fix the KB row. Re-running `recordFact` with the corrected text just adds a second row.
- The KB has no notion of expiry. A `web_search`-sourced fact from 2023 stays "fresh" forever.

#### 3.4 Conversation memory model

`established_facts: string[]` is a debugging-grade contract for a moat feature. There's no schema beyond "string", no provenance, no key-value structure. The mobile push format is `"selected mechanic_id: k57abcXYZ123"` (per the docstring at `ai_conversations.ts:147`); the Haiku push format is whatever it feels like. Two consumers free-form into the same array. This will rot.

Recommendation: split into typed sub-arrays — `established_ids: { kind: string, id: string, set_at: number, set_by: "user_tap" | "haiku" }[]` — and reserve a free-text `established_text: string[]` for prose facts. The state-replay envelope can flatten on read.

#### 3.5 Schema consistency issues

snake_case vs camelCase split:
- camelCase: `vehicle_owners` — `vehicleOwnerId`, `lastServiceDate`, `mileageAtPurchase`, `confirmedHealthyAt`, `serviceSource`, `customInputs` (28 of 47 fields are camel).
- snake_case: `ai_conversations`, `ai_messages`, `vehicle_facts`, `vehicle_configs`, `bookings`, `oto_telemetry`, the entire enrichment surface.
- mixed within one table: `vehicle_owners.usage_pattern` (snake) AND `usagePattern` (camel) co-exist — different fields, same semantics.

This is deployment-history damage from the three-way merge documented at `schema.ts:1-23`. It cannot be rationalized without a coordinated rename, but it actively breaks any "let me grep for X" investigation. At minimum, document a freeze: **new fields are snake_case, no exceptions.** Today there's no such convention written down.

Field-naming collisions:
- `confidence` is `v.number()` on `vehicle_facts`, `v.number()` on `enrichment_evidence`, `v.string()` on `maintenance_records`, `v.number()` on `part_fitments`, `v.number()` on `chassis_specs`. Five tables, two semantics, same name.
- `source` is `v.union(literal x5)` on `vehicle_facts`, `v.string()` on `maintenance_records.serviceSource`, `v.string()` everywhere else.

#### 3.6 Missing indexes that would help Oto's queries

| Query | Current path | Missing index |
|---|---|---|
| `getBookings` | `by_user_id` collect → JS sort | `by_user_and_created_at` (compound) |
| `lookupVehicleSpec` | `.filter(make_id eq)` table scan | use the existing `models.by_make_id` (it exists, just not used) |
| `lookupVehicleSpec` configs walk | `.filter(model_id eq)` | add `vehicle_configs.by_model_id` |
| `lookupFactsStructural` (semantic-then-structural) | structural per-axis | OK, but topic-normalization upstream is the real fix |
| `getVehicleHealth` | direct gets | OK |

#### 3.7 Tables that look orphaned or unused

- `vehicle_health_snapshots` — no Oto reader; verify mobile readers before deleting.
- `generations` — schema header marks deprecated.
- `ai_messages.by_role` index — no caller.
- `ai_conversations.by_booking_id` and `by_started_at` — confirm before deleting.
- `vehicle_facts.by_make_model_year` and `by_topic_axis` — no Oto reader uses them.

#### 3.8 Sensitive data handling

- `users.clerkUserId` and `users.email` are in `users` and indexed. Auth is via `by_clerkUserId`. Fine.
- VINs are in `vehicles`, `vehicle_owners`, `bookings`, `follow_ups`, `vehicle_tiers`, `vehicle_passports`. Oto's `getBookings` already truncates to last-6 (`bookings.ts:94`). Good. But `getVehicleFacts` returns the VIN-derived display string with no truncation, and the chat envelope passes the full vehicle row to the prompt builder.
- `convex/oto/chat.ts:32-37` claims "Tool inputs and the AI's prompt see the user's first name only" and "Vehicle is referenced by Convex document id (opaque). NEVER by VIN." This is a contract worth verifying continuously — there's no enforcement mechanism, just discipline. A grep-based pre-commit hook for `vin` in tool result shapes would be a worthwhile guard.
- Maintenance records contain mileage, service history, and free-text `customInputs`. `maintenance.getRecordsByVehicle` is unauthenticated — anyone with a vehicle owner id can read these.
- Telemetry stores `error: string?` which could carry stack traces with PII. Sanitize before insert.

### 4. Top Findings, Ranked by Severity

1. **`ai_messages.list` is an unauthenticated full-table scan.** Single call exfiltrates every conversation message in the deployment. Fix immediately.
2. **Six of eleven mutations in `ai_conversations.ts` and all four functions in `ai_messages.ts` lack auth checks.** Lookup-by-id and unauthenticated writes across the AI conversation surface.
3. **`maintenance.ts` queries and `deleteRecord` are unauthenticated.** Read and delete any user's maintenance records by knowing their `vehicleOwnerId`.
4. **`oto_telemetry.recordTurn` and `vehicle_facts.patchEmbedding` are public mutations meant to be internal.** Telemetry forgery and KB embedding overwrite are both possible from any authenticated client.
5. **`lookupVehicleSpec` uses unindexed `.filter()` over `models` and `vehicle_configs`.** Will time out as catalog grows. Indexes already exist; just use them.
6. **`maintenance_records.lastServiceDate: union(string|number)` half-migration.** Legacy strings silently treated as missing data by all readers; pipeline projection table claims `v.number()` which would crash on backfill.
7. **`vehicle_facts.topic` is unbounded free string with no normalization.** KB will fragment as soon as multiple Haiku calls write the same concept under different `topic` values.
8. **No propagation job for the `propagated` source enum / `propagated_from_id` field.** The "moat" cross-vehicle KB sharing the schema is built around does not exist in code.
9. **`established_facts` race condition between `updateState` (replace) and `appendEstablishedFact` (append).** Documented in code, not fixed. Will cause mobile-tap data loss in production.
10. **`vehicle_owners.health_score_is_estimated` is set to `false` by the pipeline and never set back to `true`.** Stale-score signal is permanently dead.
11. **`maintenance_records.confidence` and `serviceSource` are free strings, not unions.** The trust protocol the v0.9 work depends on rests on labels nothing enforces.
12. **Two divergent health-score formulas** — pipeline (`maintenance_pipeline.ts:789`) and `utils/healthScore.ts` — produce different numbers for the same input. AI returns one, mobile sometimes shows the other.
13. **AI-confirm-record path doesn't update `confidence` field.** "User just confirmed in chat" is invisible to provenance derivation.
14. **No KB dedupe / retraction.** Hallucinated facts (Task #19's S63-vs-N63 case) leave residue Oto can re-read forever.
15. **camelCase vs snake_case anarchy** is undocumented and unguarded; no field-naming convention is written down.
16. **`vehicle_owners.knownIssues` is `v.any()`** but consumed as a tightly-shaped sentinel-prefixed `string[]` in three different files — the shape contract is reconstructed each time and has already drifted in production.
17. **N+1 in `maintenance_pipeline.ts` step 6** (`getServiceById` per spec) — should be batch-fetched.
18. **No retention policy on `oto_telemetry` or `ai_messages`.** Both will dominate storage.
19. **Auth boilerplate duplicated 8+ times.** No `requireAuthedUser(ctx)` helper. When (not if) one site forgets the check, the leak is silent.

The Oto data surface is clearly newer than the deployment around it; the code-quality and provenance-thinking inside `convex/oto/vehicleHealth.ts` is markedly better than the `ai_conversations.ts` / `ai_messages.ts` layer it sits on. The priority is shoring up the foundation under it — auth, schema constraints, and the established_facts contract — before the next batch of AI features lands on top.

---

## Section 4 — Documentation & Design Rationale Audit

**Auditor scope:** `docs/oto-ai/*` + the prompt body in `convex/oto/system_prompt.ts` + Oto-relevant slices of `CLAUDE.md` / `REFERENCES.md`. Code architecture, schema, mobile UI, and test infra are out of scope per instructions.

**Headline finding:** the docs are **eight loosely-coupled snapshots stacked on top of each other** rather than a unified spec. The runtime in `convex/oto/system_prompt.ts` is admitted source of truth in three different places, but the markdown that *claims* to be the cached prompt is a v0.6 fossil with a v0.9 changelog stapled on. Two of the most-cited canonical artifacts — the **Five Locked Decisions** and the **Twelve Locked Principles** — are referenced by name across every handoff but the canonical list **does not exist anywhere in the repo**. This is the single biggest documentation defect.

### Per-doc walkthrough

#### `README.md` — index

**Purpose:** entry point with reading order and source-code anchors.

**Current vs stale:** current as of 2026-05-14 (v0.9). Reading order is plausible. Honestly flags that the prompt body lives in code and the markdown is historical.

**Issues:**
- Line 16 promises *"the Five Locked Decisions (A/B/C/D)"* — but A/B/C/D is **four**, not five. This same off-by-one appears in `Oto_AI_v0.6.2_Harness_Handoff.md:17` (*"the four locked decisions"* — that one is actually right) and in `Oto_AI_v0.8_Handoff.md:19` (*"four locked decisions + twelve principles"*). README disagrees with both. Either there's a missing **Decision E** that nobody wrote down, or the README count is wrong. The audit team needs to pick.
- Trust_Protocol_Inflight_Handoff.md is missing from the reading order entirely despite being added "this session" — README hasn't been updated for it.

#### `Oto_AI_v0.6.2_Harness_Handoff.md` — historical

**Purpose:** harness scaffold + Directive 7 vehicle_id fix + v0.6.2 prompt landing.

**Status:** correctly headered as historical. Most useful surviving content is the **`ConvexHttpClient.setAuth(string)` footgun** (lines 91, 328) and the **`describeKnownIssues()` translation pattern** (lines 174–185, with the `WARNING_LIGHT_TYPE_OPTIONS` mirror documented). Still load-bearing.

**Stale rules embedded:** the diagnostic enum reconciliation table at lines 38–58 is documented as five locations needing simultaneous change. Per `Oto_AI_v0.8_Handoff.md` and `Oto_AI_v0.9_Handoff.md`, **this drift is still pending** at v0.9. Two prompt versions and a major architectural rewrite later, the founder-canonical labels (`brake`, `tires`, `Battery & electrical`, `not sure`) have not propagated. This is now an 8-month-old open footgun that every successive handoff has copy-pasted forward.

#### `Oto_AI_v0.7_Handoff.md` — historical

**Purpose:** friendliness rewrite, conversation-state plumbing, vehicle_facts capability, telemetry, prompt caching, polite-exit counter, eval harness — the meatiest single shipping session.

**Important documented decisions:**
- The **field-name alignment** rule at line 62 — `arc` and `last_intent` are short names used in tool param + envelope label + mutation arg. Mutation translates short → DB columns internally for back-compat. This is a real design decision; needs to be in the canonical inventory, currently isn't.
- The **`stripVoiceMarkup` post-process** at line 83 — server-side belt-and-suspenders. Belongs in Locked Principles, isn't in any.

**Stale:** the eval baseline (7/8) and the Decision A loophole framing have moved past this doc. The "this loophole goes to Sonnet cascade calibration" reasoning was overtaken by the Trust Protocol session — the actual fix turned out to be a **provenance signal in the data tool**, not Sonnet. The doc never got that retraction.

#### `Oto_AI_v0.8_Handoff.md` — historical

**Purpose:** KB infrastructure (`vehicle_facts` table, structural + semantic lookup), `lookup_vehicle_spec`, `web_search`, educational repositioning, multi-tool batching, no-system-narration rule, loop hardening.

**Important design decisions captured here that don't appear elsewhere:**
- The **`record_vehicle_fact` is STATE not DATA category** decision (line 56). Critical: the loop will swallow text alongside a data-categorized fact-write. This is a footgun that must survive into the canonical inventory; today it lives only as a bullet in three handoffs.
- The **forced-final bypasses ALL tools including server-managed** rule (line 63).
- The **graceful no-text-no-render fallback** (line 64) — *"I'm having trouble pulling that one together — can you rephrase…"*. This is a user-facing string buried in an engineering changelog. It should be in the prompt or in a strings file.

**Stale:** identical "diagnostic enum drift still pending" copy as v0.6.2, copy-pasted again at line 105. The eval baseline language ("7/8 passing") has been overtaken by the Trust Protocol session reframing.

#### `Oto_AI_v0.9_Handoff.md` — current

**Purpose:** the latest authoritative handoff. 6-stage booking flow, pricing rule, Sonnet cascade scaffolding, trigger-only render schemas, `appendEstablishedFact`, removal of `navigate_to_payment`.

**Strongest section:** the 6-stage table (lines 36–46). This is the cleanest single-page expression of the booking flow architecture and should be promoted into the engine-inventory, which is supposedly canonical but doesn't actually contain this information.

**Stale already (the doc was current 24 hours):**
- Line 102: *"Eval baseline: Last measured: 7/8 passing in v0.8. Eval cases not re-run against v0.9."* — Trust_Protocol_Inflight_Handoff.md says the v0.9 baseline was rerun, scored 7/8 again, and the failing case (`brake_narrowing_on_time_to_diagnostic`) was not a model regression but a tool-surface gap. v0.9 doc never gets the update.
- Lines 104–109: lists "two persistent Haiku ceiling issues" as Sonnet calibration targets. The first one (cause-speculation enumeration) is still real. The second (Decision A direct-service slip) has been **architecturally addressed** by the trust protocol — this listing is outdated.

#### `Oto_AI_Cached_System_Prompt_v0.md` — the structural problem

**Purpose claim:** *"prompt source-of-truth, byte-identical to `convex/oto/system_prompt.ts`"* (per v0.6.2 handoff line 19) and *"the cached system prompt"* per its own title.

**Actual state:** the body between `BEGIN CACHED SYSTEM PROMPT` / `END CACHED SYSTEM PROMPT` markers is a **v0.6 snapshot from 2026-05-14**. The header has been hot-patched with v0.7/v0.8/v0.9 changelog rows but the body is unchanged. The runtime prompt grew from ~3,500 tokens (v0.6) to ~6,000 tokens (v0.8) and added an entire trust-gating section in the unreleased work — none of which is in the body of this file. The file's own header admits it (line 7: *"Lags v0.6 content for sections below"*).

**Critique:** keeping a file titled "Cached System Prompt" with content that is six versions stale is **actively harmful documentation**. Anyone running grep/Cmd-F against the docs folder for prompt rules will find the v0.6 body and trust it. The honest move is to either (a) delete the body and replace it with a redirect file pointing at `convex/oto/system_prompt.ts`, or (b) actually re-sync. The "byte-identity rule" cited in three handoffs has been violated since v0.7 with no remediation.

**Useful surviving content in the engineering notes section (after the END marker):**
- Lines 511–514: the **attorney-referral rejection** with date and rationale.
- Lines 515–529: the **Locked principle on legal-grounding-vs-user-facing-copy** — *"the user-facing voice always centers the user, even when the rule also protects Otopair."* This is the closest thing to a canonical Locked Principle that actually appears in any doc body.
- Lines 547–553 ("Things deliberately not in v0") — a useful negative-space spec, half of which has since shipped without the doc being updated.

#### `handoff-addendum.md` — Section 4.5

**Purpose:** "render, don't navigate" architectural rationale.

**Status:** the v0.9 status note at the top (lines 8–18) updates it cleanly. The historical 4.5 body is good architectural narrative.

**Stale embedded:** the seven-scenario coverage matrix at lines 60–68 references `services/ai/scenarios.ts` as canonical. Multiple v0.9 docs say the rule engine is **retired**. Section 4.5.3 is now load-bearing-for-history-only and should be marked.

#### `tool-inventory.md` — current

**Purpose:** living tool inventory. v0.9 section at the top is meant to be the authoritative inventory, with v3 Phase 1 spec preserved as historical.

**Strong:** the v0.9 Current Tools section (lines 8–84) is the cleanest documentation in the entire folder. The five-category breakdown (data / state / model-routing / render / server-managed) plus the explicitly-listed *"Tools defined in schema but NOT in TOOL_NAMES_V1"* gap section is exactly the right shape.

**Drift vs runtime (verified against `convex/oto/chat.ts:82–110`):**
- Runtime `TOOL_NAMES_V1` includes `render_record_confirmation`. Tool-inventory v0.9 section does **not** list it. The Trust Protocol Handoff documents the tool but never updated the canonical inventory. This is a doc/code drift introduced **this session**.
- Runtime `TOOL_NAMES_V1` does **not** include `render_support_form`, but the system prompt body at runtime references it as if it exists (system_prompt.ts:571 — full schema description). The `Oto_AI_Cached_System_Prompt_v0.md` engineering notes (lines 531–545) document this gap correctly. The tool-inventory acknowledges *"render_support_form, render_reasoning, render_sources — schemas defined but not in TOOL_NAMES_V1. Not currently used."* But the prompt **promises this tool to Haiku in detail** — it's three paragraphs of behavior. This means Haiku will hallucinate calls to a tool the dispatcher does not handle. Unless the dispatcher catches it via the prompt-body invariant (chat.ts:188–207), Haiku will narrate non-existent support-form behavior to users.

**Open questions section (Q1–Q13):** most still relevant. Q3 (envelope extensions for timeSlots/bookingSummary) was implicitly resolved by the trigger-only schema decision — a doc update is overdue.

#### `oto-engine-inventory.md` — the second structural problem

**Purpose claim:** the README and three handoffs cite this as the canonical home of the **Five Locked Decisions (A/B/C/D)** and the **Twelve Locked Principles**.

**Actual contents:**
- Decisions A, B, C, D are documented in Part 5 (lines 269–360). **There is no Decision E.** The "Five" framing is hallucinated by the README.
- **There is no enumerated list of Twelve Locked Principles anywhere in this file or any other doc.** Greps for "Principle 1", "Principle 2", "Locked Principle" return only sporadic *"Locked Principle #5"*, *"Principle #7"*, *"Principle #8"*, *"Principle #12"* citations across handoffs — never the canonical list itself. By inference from those citations, at least these are individually labeled:
  - #5 — the moat / KB story (per v0.7 handoff line 155, v0.8 handoff line 37, addendum line 66)
  - #7 — cap counter (per v0.9 handoff line 94)
  - #8 — eval-grounded confidence ("never debate a prompt change based on vibes — only against the eval", per v0.6.2 line 308)
  - #12 — telemetry ("cost-per-booking is verifiable", per v0.7 line 75)

  Six of the twelve are uncited. The set is referenced as authoritative across every doc and the canonical list is **missing**. This is a documentation emergency — every reference to "Locked Principle #N" is a dangling pointer.

**v0.9 State Update at the top is good** (lines 12–32). It accurately catalogs what's drifted from the body. The legacy body remains valuable for the System 1 / System 2 framing and the Decision A/B/C/D walkthrough.

**Authoritative source notes table (lines 47–58)** — still factually correct as a list of *"spec stated vs codebase truth"* discrepancies. The diagnostic-form-UI-doesn't-exist note has been resolved (it now exists), but the enum drift remains.

#### `slug-drift-remediation.md` — parked

**Purpose:** snake-vs-kebab remediation plan for 8 files outside Oto AI's scope.

**Status:** explicitly parked. v0.9 footer confirms still pending. Quality of the doc itself is high — file-by-file fix recipes, blast radius, test plan, effort estimate, recommended order of operations. The recommendation to **add a CI grep check** at the bottom (line 342) is the right tactic and isn't tracked anywhere.

**One piece of cross-doc tension:** Q10 in `tool-inventory.md` notes that `get_due_services` is degraded until the package-rules / maintenance-pipeline kebab fixes land. That's a warning about Oto AI's runtime quality that is buried in an "open questions" section of an inventory doc. It should be flagged at v0.9-handoff visibility.

#### `Trust_Protocol_Inflight_Handoff.md` — newly added

**Purpose:** documents the symptom-vs-record trust-gating work and the introduction of `render_record_confirmation`, the `record_provenance` field on `get_vehicle_health`, and the new "Suggest, don't mutate" architectural rule.

**Status:** the doc is honest about being in-flight. **Tasks #6 (system prompt) and #7 (eval rewrite) are listed as pending — but the system prompt body at runtime already contains the Trust Gating section.** Either the doc is stale within hours of being written, or task #6 was completed without updating the doc. Looking at `system_prompt.ts:304–371` (the full Trust Gating subsection), it appears task #6 actually shipped — the doc just wasn't updated.

**Important new design vocabulary introduced here:**
- **"Data form hallucination"** (line 41–43) — *"User-onboarded vehicle health is soft data. Users misremember service dates, click through onboarding quickly, or report items as fine when they aren't. Data form hallucination is the human equivalent of LLM hallucination."* This term is cited in the runtime prompt (system_prompt.ts:308: *"data form hallucination is real"*). It is **not in the glossary, not in CLAUDE.md, not in the engine inventory.** A load-bearing design term used in the production prompt should not live only in an in-flight handoff.
- **"Suggest, don't mutate"** (lines 77–84) — proposes formal adoption as a Locked Principle. The runtime prompt has this as a section heading (system_prompt.ts:373). Status: *"Belongs in the Locked Principles list once formally adopted"* — but since the Locked Principles list doesn't actually exist as an artifact anywhere, this is a circular blocker.

**Trust-source mapping table (lines 86–98)** — single source of truth for what writer sets which `confidence` / `serviceSource` value. Critical reference; should be lifted into engine-inventory or a schema doc.

#### CLAUDE.md / REFERENCES.md (Oto-relevant slice)

CLAUDE.md mentions Oto only obliquely (*"AI chat / scenario engine"* row in the routing table). REFERENCES.md doesn't mention Oto AI at all. Given Oto is the most-active workstream in the repo right now, the routing table should have an explicit *"Oto AI / system prompt / tool inventory"* row pointing at `docs/oto-ai/`.

### System prompt walkthrough — `convex/oto/system_prompt.ts`

The runtime body is ~6,000 tokens. The structure flows logically but has accumulated cruft. Sections in order of appearance:

#### `# Who you are`
Identity + scope statement. The added line *"You are an educational AI"* (the v0.8 reframing) sits awkwardly here as a fourth bolded paragraph. It contradicts the third paragraph's *"You are not a mechanic. You are not a lawyer. You are not a salesperson."* by adding a fifth identity claim — would benefit from being its own subsection.

#### `# Voice`
**Voice rules.** The `calm > restrained > confident > direct` hierarchy was rewritten in v0.7 from "default mode" to "override stack" — the prompt explicitly handles this transition (line 42: *"is your hierarchy of OVERRIDES, not your default mode"*). Clean.

**"What friendly sounds like / never sounds like"** — clear contrastive lists, banned phrasings well-chosen. Good.

**`## No system narration`** — well-scoped. Banned phrasings list is comprehensive (10 examples). The pattern explanation (line 76: *"a friend who happens to know cars wouldn't narrate 'let me Google that real quick'"*) is the right register.

**`## Adaptive shaping`** — five mood states (calm/neutral/curious, worried, frustrated, hyped/excited, confused). Each gets a one-liner about pacing/depth/warmth. Useful but **doesn't tell the model how to detect the mood** beyond *"You also read the user's current message directly."* Mood is inferred; could be tightened with a short detection heuristic.

**`## Always`** — the Decision D (score volunteering) trigger phrases were enumerated explicitly in v0.7 after eval failures forced the tightening. Solid — bullet-listed phrases plus the *"any direct status question"* catch-all.

#### `# Conversation state — your memory across turns`
Tells the model about the four-field state block + the `update_conversation_state` tool. Mandates state writes on every turn including terminal-render and single-shot-factual turns. Lines 124–137 are a tight, well-bounded contract. Worth noting: the prompt explicitly distinguishes *"What goes in `established_facts`"* from *"What does NOT"* — the distinction (facts vs. interpretations) is exactly the kind of thing prompts usually leave under-specified.

#### `# Scope — Operational vs Mechanical`
Three rules nested here, each load-bearing:

1. **Operational vs mechanical line** — original v0.6 framing.
2. **"User is the booker, not the doer"** — banned/correct phrasing pairs. v0.8 addition.
3. **"You (Oto) are also the booker, not the doer"** — banned/correct pairs. v0.9 addition.
4. **Tool-finding narrowing flow** — five-step protocol applied to TOOL findings (different from user-reported symptoms).
5. **Naming findings vs. speculating on causes** — the cause-speculation ban with abstract pattern recognition.

These five rules are all jammed into one section. The first three belong together. The last two are about **diagnostic routing**, not scope. They should probably be hoisted into the Symptom Routing section. Today the prompt has narrowing rules in two places (here and under Symptom routing), which makes the rule set hard to internalize.

#### `# Legal-adjacent questions`
Unchanged from v0.6. Single canonical refusal pattern, no attorney referral, no legal-jargon-in-user-copy. Tight.

#### `# Recommendations — the three-beat frame`
Unchanged from v0.6. Claim → inline qualifier → booking bridge. The note about *"proposed New York General Business Law §390-F"* is a legal grounding the model doesn't need to know to perform; could be moved to engineering comments. Otherwise clean.

#### `# Symptom routing — reason, narrow, then recommend`
The biggest section, the most rule-dense, and the most layered.

The reasoning protocol (steps 1–6) is intact from v0.6. Step 5 has been heavily extended with:

- **`render_record_confirmation` trust gate as new branch 5b** (lines 270, 304–371). Decision A's logic now has a soft-data branch that fires render_record_confirmation BEFORE render_diagnostic_form. This is the v0.9.x trust protocol work.
- **Long banned-phrasings list for `on_time` symptom turns** (lines 278–286). Good defensive work after the persistent Decision A loophole.
- **Hard rule prohibition** (line 277): *"never recommend a direct service from your own symptom-pattern interpretation alone."*
- **Decision tree for brake-squeal + on_time** (lines 287–294).

`## Trust gating` subsection (lines 304–371) — the new section. Three triggers, two phrasing bans (accusatory + system-narration), the *"phrases 'self-reported' and 'self reported' are banned in user-facing text"* rule, *"fire the tool — don't invite the user to fire it"*, the *"do NOT name a canonical service during the trust-gating turn"* rule, the next-turn synthetic-message handling.

This section is **dense and well-structured**, but it's also long enough (~70 lines) that it competes with the surrounding rules for attention. A future Sonnet handoff would benefit from this being its own top-level section.

`## Suggest, don't mutate` (lines 373–379) — the "Locked Principle" concept that the Trust Protocol handoff says needs formal adoption. Lives only here; doesn't appear in any inventory.

#### `# Diagnostic form pre-fill rules`
Unchanged from v0.6. The enum still uses `brakes`, `tires_wheels`, `engine`, `battery_electrical`, `not_sure` — i.e. the **codebase enum, not the founder-canonical labels** (`brake`, `tires`, `Battery & electrical`, `not sure`). The Decision B mapping table here uses the codebase enum. This drift has been listed as pending in every handoff since v0.6.2.

#### `# Support intake`
Unchanged from v0.6. **Promises a `render_support_form` tool that is not in `TOOL_NAMES_V1`.** Per the chat.ts module-load invariant (lines 188–207), this should produce a console.error every cold start: *"prompt references tool render_support_form but it is NOT in TOOL_NAMES_V1."* Unless someone has been ignoring that error for months, the invariant is failing silently. Either way the doc situation is broken: the prompt promises a fully-realized intake flow with five categories, exact arg shape, and an example exchange (Example 5), but the tool isn't wired. Capability honesty demands either wiring it or removing the section entirely.

#### `# Question caps`
Still tagged `[TIER-PENDING]`. Still 5/25/150. Cap counter is explicitly deferred to launch prep. Section is honestly framed (the cap is enforced before the message reaches the model — model never has to count). Acceptable.

#### `# Minors — transactional refusal`
Unchanged from v0.6. The §3-101 citation is in the doc spec (per the locked principle on legal-grounding-vs-user-copy, this should not be in the user-facing copy and isn't — it's only in the engineering rationale paragraph). Clean.

#### `# Safety — overrides everything`
988 + clean stop. Unchanged.

#### `# Abuse — graduated escalation`
Three-tier ladder. Unchanged.

#### `# Tool batching`
Worked example, intent-batch table, *"the state tool always rides along"* clause. Solid. The intent table is a useful expansion surface — adding more "this intent batches X+Y" entries is the cheapest prompt improvement available.

#### `# Knowledge base workflow`
Four-step lookup ladder (KB → catalog → web_search → training). The MANDATORY `record_vehicle_fact` rule (line 525) with no-exceptions framing. Web search policy gates listed twice (banned topics + required behavior). The closing line is excellent: *"Refusing because you don't have the data is the WRONG instinct."*

#### `# Tools`
Dense. Each tool gets a paragraph. Issues:

- `render_support_form` schema lives here despite the tool not being wired (see above).
- `render_record_confirmation` is **not described in this Tools section**. It's used in the Trust Gating subsection but not formally documented as a tool. This is an inconsistency — every other render tool has a Tools-section entry. Haiku gets the schema from `tools.ts`, but the prompt's Tools section is the documented "you can do these things" reference.
- Order is unsorted; Tools section mixes data, state, render in ad-hoc sequence (`list_services_for_vehicle` → `get_service_details` → `render_quick_replies` → `render_support_form` → `get_vehicle_health` …). Grouping by category would mirror tool-inventory.md.

#### `# Complexity self-assessment — when to escalate to Sonnet`
Five "when to escalate" bullets, six "when NOT to escalate" bullets, the 15-25% calibration target, the *"Sonnet must call request_haiku_handback"* terminator rule.

The calibration target framing is honest (*"Sonnet is ~5x more expensive per turn than Haiku"*). However, this section is asking Haiku to **self-assess complexity** — a notoriously bad prompt for Haiku. The v0.7 handoff documented the persistent Decision A loophole as something *"Haiku consistently slips back to recommending direct Brake Pad Replacement…"* That same Haiku is now being asked to know when it should hand off. The doc admits this with the calibration target; the prompt itself doesn't acknowledge the irony.

#### `# Pricing`
Five rules + parts-only exception. Tight. Line 643: *"This rule overrides any prior training-derived instinct to be helpful by estimating."* Good acknowledgment that the rule fights the model's defaults.

#### `# Booking flow — 6 stages`
The full chain plus the `confirm = execute` hard rule with explicit confirmation tokens. The phrasing ban list is a footgun-prevention masterpiece — the *"Want me to set one up?"* AFTER the user says yes failure mode is exactly the loop-trap that breaks user trust.

The IDs-from-state rule (line 667 onward) is well-explained. The *"if a required ID is missing… do NOT make one up"* rule (line 674) is the right belt-and-suspenders.

**One concern:** the booking-flow section is ~80 lines and contains seven *"worked example"* sub-turns (Turn N through Turn N+5). This mixes spec and example into a single section. Future tightening: split into "the chain" + "worked example" sections.

#### `# Service-name discipline`, `# Capability honesty`
Unchanged from v0.6. Capability Honesty is critical and well-written. Includes the line that should be a Locked Principle: *"If you offer it, the user will try to take you up on it, and the experience will break."*

#### `# Vehicle Health & Service-Due`, `# Service History`
The `record_provenance` description (lines 797–803) is the new addition. Three values: verified / self_reported / inferred. Includes *"The trust signal is for YOUR reasoning — do not narrate it back to the user as a label."* This is a self-defeating instruction the model often violates; the system_prompt enforces it again later in the Trust Gating ban list, which is good defense-in-depth but creates rule duplication.

#### `# General car knowledge`
Educational AI repositioning. KB-first lookup order. Clean.

#### `# Response format`, `# Vehicle context`, `# Examples`
Twelve examples (1–12). Examples 11 and 12 demonstrate the same brake-squeal symptom routed two different ways based on `get_vehicle_health` output. Useful contrast.

**Missing:** no example demonstrates the **trust gating flow** (the new Decision A 5b path with `render_record_confirmation`). This is a brand-new behavior with no canonical example exchange. Given that every other significant behavior has a numbered example, this is a notable gap. The prompt has the rules but no demonstration — Haiku is being asked to perform a multi-turn protocol it has never seen modeled.

**Stale example:** Example 11's punchline — *"Brake Pad Replacement is the right call, no diagnostic detour needed"* — is **exactly the phrasing the v0.9 banned-phrasings list forbids on `on_time` brakes**. Example 11 is the `due_soon` case so technically it's allowed, but the prompt's own ban list specifically calls out *"`<canonical service name> is the right ___` pattern when the related item is on_time"* — the example uses the exact dangerous phrasing for the safe case. Future Haiku reading this may pattern-match it inappropriately. v0.6.2 footgun #7 (lines 339–340 of the harness handoff) flagged this same risk.

### Integrated picture

#### The Five Locked Decisions (A/B/C/D)

Three docs say *"Five Locked Decisions"*. Two docs say *"four"*. The body has **A, B, C, D — four**. There is no Decision E in any artifact. Recommendation: **change README to "Four Locked Decisions"** and audit every other reference.

The four are:
- **Decision A** — direct service vs. diagnostic. Lives in `oto-engine-inventory.md:269–296` as the routing table. Lives in `convex/oto/system_prompt.ts` as the Symptom routing section + the Trust Gating subsection (which is effectively Decision A 5b). **Still in force, recently extended.**
- **Decision B** — which subsystem to pre-fill in `render_diagnostic_form`. Lives in engine-inventory:297–311 and the Diagnostic form pre-fill rules section of the prompt. **Still in force.** The enum it documents (`brakes`/`tires_wheels`/etc.) drifts from the founder-canonical labels (`brake`/`tires`/etc.) — open since v0.6.2.
- **Decision C** — what goes in `customer_notes`. Engine-inventory:313–339. The original spec proposed *"Symptom: / When: / Other:"* structured format; the prompt **explicitly bans** that format (system_prompt.ts:395 — *"No structured fields… that invites you to invent slot-fills"*). **Decision C as documented in engine-inventory is now stale.** Decision C as enacted in the prompt is the opposite. This is a documented design pivot that nobody backported into the canonical doc.
- **Decision D** — score volunteering. Engine-inventory:341–360. Lives in the Voice section (system_prompt.ts:102–112). v0.7 enumerated explicit trigger phrases. **Still in force, well-documented.**

#### The Twelve Locked Principles

**Cannot find them.** Cited by number across handoffs (#5, #7, #8, #12 are individually attributed; the others are unsourced). The README claims they live in oto-engine-inventory.md. They do not. This is a **canonical document missing entirely** — every reference is a dangling pointer.

By inference from citations, possible identities of the twelve:
- #5 — KB / RAG as the moat
- #7 — cap counter on general car questions
- #8 — eval-grounded confidence ("never debate a prompt change based on vibes")
- #12 — telemetry / cost-per-booking measurability

The other eight are unknown. The Trust Protocol handoff proposes **"Suggest, don't mutate"** as a candidate for the list — but you can't add to a list that doesn't exist. **Recommendation:** either (a) the list exists somewhere and has been lost to documentation rot — search archived sessions; (b) it never existed as a written artifact and lives only in Waleed's head — in which case it needs to be enumerated this week before more references accumulate. This is the highest-priority documentation defect in the audit.

#### The "data form hallucination" framing

Defined in Trust_Protocol_Inflight_Handoff.md:41–43. Quoted in the runtime prompt (system_prompt.ts:308). Not in any glossary, not in CLAUDE.md, not in engine-inventory. A load-bearing design term that's used in production needs a permanent home — recommend lifting into the engine-inventory's terminology section (which does not currently exist but should).

#### The trust protocol design

Well-documented in Trust_Protocol_Inflight_Handoff.md and well-implemented in the runtime prompt. **Documentation gap:** the protocol introduces a new tool (`render_record_confirmation`), a new data-tool field (`record_provenance`), a new architectural rule (Suggest, don't mutate), and a new design term (data form hallucination) — none of which are in:
- The tool-inventory v0.9 Current Tools section
- The engine-inventory's Decisions section (where this should be Decision A's 5b branch or perhaps a new Decision E that would justify the README's "Five")
- The Locked Principles list (which doesn't exist)
- The system prompt's Tools section (the tool is described in the trust-gating subsection but not in the formal Tools listing where every other tool gets its entry)

**Recommendation:** the trust protocol is the most architecturally significant addition since the booking flow chain. It deserves to be promoted from "in-flight handoff" to first-class documentation. Specifically: `render_record_confirmation` should be added to tool-inventory.md's v0.9 section + system_prompt.ts's Tools section; the protocol should be added to engine-inventory.md as either Decision A.2 or a new section.

#### Cross-doc inconsistencies

- **README "Five Locked Decisions"** vs. body containing four — flagged.
- **Cached System Prompt v0 doc title** vs. body being a v0.6 fossil — flagged.
- **`Oto_AI_v0.9_Handoff.md` says eval not re-run** vs. Trust Protocol handoff says it was — flagged.
- **Decision C engine-inventory recommendation** ("Symptom / When / Other") vs. **prompt explicit ban** of that format — flagged.
- **`render_support_form` documented in prompt as fully-realized** vs. **not in `TOOL_NAMES_V1`** vs. **engineering notes correctly flagging this** — three docs, three different positions on the same tool.
- **Diagnostic enum drift** flagged in v0.6.2, v0.7, v0.8, v0.9 handoffs as "still pending" — eight months, no movement.
- **`Oto_AI_v0.7_Handoff.md` documents the Decision A loophole as a Sonnet-cascade calibration target** — Trust Protocol Handoff documents that the actual root cause was a tool-surface gap (missing `record_provenance`), not a Haiku ceiling. v0.7 doc never gets the retraction.

#### Sections of the prompt that could be tightened

1. **Section organization** — Scope section now contains five distinct rule families, three of which arguably belong elsewhere (tool-finding narrowing → Symptom Routing; user-as-booker / Oto-as-booker pair → could be a Voice subsection). The Symptom Routing section grew an entire Trust Gating subsection. Consider promoting Trust Gating to a top-level section.

2. **Tools section is unsorted and incomplete.** Should be ordered by category (data → state → model-routing → render → server-managed) and should include the `render_record_confirmation` entry that the rest of the prompt assumes exists.

3. **`render_support_form` rules are dead text** until the tool is wired. Either wire or delete.

4. **Example 11's "is the right call" punchline** is the exact phrasing the prompt's own ban list forbids in similar contexts. Risk of model pattern-matching it inappropriately.

5. **No worked example for the Trust Gating flow.** Highest-leverage example to add right now.

6. **Score-volunteering Decision D rule appears in Voice section AND Vehicle Health section** with overlapping but slightly different framings — consolidate.

7. **The "no system narration" rule is enforced in three places** (top-level Voice subsection, Trust Gating ban list, Vehicle Health record_provenance note). The repetition is defensible (defense-in-depth on a recurring leak) but worth flagging — three near-identical rule restatements is a pattern worth consolidating once Sonnet cascade is verified.

#### Documentation gaps — what's in the code that ISN'T in the docs

- **`render_record_confirmation` tool** — wired in `TOOL_NAMES_V1`, not in tool-inventory.md's v0.9 list.
- **The prompt-body invariant in chat.ts (lines 188–207)** — the runtime checks that every backtick'd tool name in the system prompt is in `TOOL_NAMES_V1`. This is described in v0.7 handoff as "Block 4" but isn't documented as a Locked Principle or in the operational runbook.
- **The `stripVoiceMarkup` server-side post-process** — described once in v0.7 handoff. Not in any canonical inventory. This is a load-bearing voice rail.
- **The `state_updated_at` / `diagnostic_turn_count` schema columns** — schema-level architectural decisions referenced in handoffs but not in any doc that surveys the persistence layer.
- **The five-category tool taxonomy** (data / state / model_routing / render / server-managed) — formalized in tool-inventory.md but the engine-inventory still describes a three-category world (data / render / navigation).
- **The `<polite_exit_required>` envelope block** — referenced in v0.7 + v0.8 handoffs, not in any envelope-shape doc.
- **The Sonnet cascade `current_model` field semantics** ("AT TURN START" switch) — documented as footgun #4 in v0.9 handoff, not in any architectural doc.

### Summary judgment

The prompt itself is, line for line, **a quality production system prompt** — strong banned-phrasings discipline, defense-in-depth on recurring failure modes, honest capability framing, calibrated registers, tight examples for the cases it covers. The voice rules and trust protocol are particularly well-designed.

The **documentation around it is in disrepair**. Six handoff docs stacked over a fossilized "canonical" prompt. Two of the most-cited canonical artifacts (Five Locked Decisions, Twelve Locked Principles) do not exist. Critical new design terms ("data form hallucination", "Suggest, don't mutate") live only in in-flight handoffs. Multiple tools and rules drift between layers (tool-inventory, system prompt body, runtime `TOOL_NAMES_V1`).

**Top three remediation priorities, in order:**

1. **Enumerate the Twelve Locked Principles in `oto-engine-inventory.md`.** Every reference is currently a dangling pointer. Until this exists, *"Locked Principle #N"* citations are unverifiable.
2. **Resolve the `Oto_AI_Cached_System_Prompt_v0.md` situation.** Either resync byte-for-byte or replace the body with a redirect to `convex/oto/system_prompt.ts`. The current half-state is actively misleading.
3. **Promote the Trust Protocol from in-flight to canonical.** Add `render_record_confirmation` to tool-inventory's v0.9 section + system_prompt's Tools section. Add the protocol as Decision E (and update the README's "Five" to be self-consistent) or as an explicit Decision A 5b. Add a worked example to the prompt's Examples section. Lift "Suggest, don't mutate" + "data form hallucination" into the canonical Locked Principles list once it exists.

The diagnostic enum drift is the longest-running open footgun (8 months, every handoff). It's a one-day reconciliation across five files that has been deferred since v0.6.2. Worth bundling into the next session.

---

## Section 5 — Test Infrastructure & Eval Coverage Audit

**Audited artifacts:** `scripts/oto-harness.html` (1,797 lines), `scripts/oto-eval-cases.json` (31 cases, ~506 lines), `convex/oto/telemetry.ts`, plus the `__runBulk` / `__bulkRunOneCase` analyzer that lives only in browser-console memory.

### 1. Harness architecture (`scripts/oto-harness.html`)

#### 1.1 What it is

A single-file static HTML app — no bundler, no build step, no framework. It loads `@clerk/clerk-js@5` and `convex@^1.31/browser` directly from `esm.sh` (`oto-harness.html:358-359`). Three columns: settings/diagnostics, chat feed, raw trace inspector. State persisted to one `localStorage` key (`LS_KEY = "oto-harness-v1"`, line 365). Total surface ~1,800 LOC; all logic in one `<script type="module">`.

This is *not* test infrastructure in any conventional sense. It's an iteration cockpit that has had an eval runner welded onto its `window.__oto` debug surface.

#### 1.2 Convex client + auth plumbing

`ensureConvexClient()` (line 528) lazily builds a single `ConvexHttpClient` keyed off the URL. `stampAuth()` (line 536) re-stamps the bearer token before every call by invoking `clerkInstance.session.getToken({ template: "convex", skipCache })`. Crucially, the harness uses `ConvexHttpClient.setAuth(literalToken)`, not the fetcher overload — so refresh logic is *not* delegated to Convex; the harness is responsible for re-stamping. `callConvex` (line 565) calls `stampAuth()` before every query/mutation/action.

**Fragility:**
- The "auto-refresh" is defensive but synchronous-only — there is no background refresh loop. If Clerk's cached token expires *during* a long-running multi-turn case, the next iteration will catch it on the next `stampAuth()`, but if the action hangs longer than token life the in-flight request can 401 mid-eval. No retry-on-401 is implemented.
- `file://` is a hard dead end (line 1776-1789): Clerk rejects `file:` redirect URLs. The harness disables sign-in but leaves manual JWT paste as the only path. A user pasting an expired JWT has no automatic remediation; the only signal is the header pill (`updateHeader()`, line 469-478) parsing `exp` and turning red.
- The publishable key defaults to a hardcoded value (line 373) — a Clerk dev key embedded in the HTML. Fine for dev; would be a leak if anyone committed this to a public repo.
- The `setInterval(updateHeader, 5000)` (line 1415) only updates the *display* — it does not proactively refresh. JWT could expire between display tick and next call.

#### 1.3 The `window.__oto` debug surface (lines 1588-1774)

Three eval entrypoints, all attached as window globals:

- **`runVariation(message, opts)`** (line 1599): creates a fresh conversation, sends one message with `debug: true, debug_skip_persist: true`, returns `{ message, latency_ms, iters[], tokens_in/out, hit_cap, text, quick_replies, show_diagnostic_form }`. Compact summary, no assertions.
- **`runSuite(variations[])`** (line 1646): trivial serial loop over `runVariation`. Catches errors and pushes `{ message, error }`.
- **`runEval()`** (line 1663): the actual assertion runner. Fetches `oto-eval-cases.json` from same-origin, runs every case in a fresh conversation, supports multi-turn, evaluates expectations.

#### 1.4 `runEval` assertion model

For each turn the runner collects every tool name across `data_tool_uses + state_tool_uses + terminal_tool_uses` (lines 1696-1700) into one flat `toolsThisTurn` array, then evaluates these assertion shapes:

| Shape | Semantics | File:line |
|---|---|---|
| `tools_called: string[]` | Every name must appear *somewhere* in the flat list (any iteration counts) | 1712-1721 |
| `branch: string` | Exact match against `lastIter.branch` only | 1722-1729 |
| `text_contains: string[]` | Case-insensitive substring on response text | 1730-1739 |
| `text_not_contains: string[]` | Negation of the above | 1740-1749 |
| `form_system: string` | Exact match against `r.showDiagnosticForm?.initialSystem` | 1750-1757 |

Returns `{ total, passed, failed, results: [{ name, description, turns, passed, failures: string[] }] }`.

#### 1.5 Hard limitations of the assertion model

The current runner cannot express **any** of the following — and a meaningful fraction of the system's behavior lives in exactly these gaps:

- **Tool input shape.** The runner inspects only `tu.name`. There is no way to assert that `render_diagnostic_form` was called with `initialSystem === "brakes"` *and* `initialNotes` containing a specific phrase, or that `record_vehicle_fact` was invoked with the correct `topic`. The `form_system` assertion partially papers over this for one specific case but is not generalizable.
- **Render envelope content.** `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation`, `render_record_confirmation`, `render_service_picker`, `render_reasoning`, and `render_sources` all carry payloads the runner ignores. The harness chat panel renders previews of all of these (lines 891-1006), but the eval runner has no assertion shape for them.
- **Tool-call ordering.** "Was `get_vehicle_health` called *before* `render_diagnostic_form`?" is unanswerable. `tools_called` is order-insensitive set-membership.
- **Tool call counts.** `["update_conversation_state", "update_conversation_state"]` and `["update_conversation_state"]` look identical to the runner.
- **Per-iteration assertions.** The runner can only check `branch` against the *last* iteration. "Iter 1 should be `data_continue` and iter 2 should be `terminal`" cannot be expressed.
- **Cross-turn branching.** All multi-turn cases hard-code the user's reply. There is no way to say "if turn 2 fired `render_record_confirmation`, simulate the 'No, update it' decision and verify turn 3 routes to `render_diagnostic_form`." This is exactly the gap called out as an open question in `docs/oto-ai/Trust_Protocol_Inflight_Handoff.md:280-281`.
- **Latency / cost assertions.** Latency and tokens are captured per turn but never asserted against. A case that *passes* but takes 30 seconds and burns 50k tokens is silently green.
- **Repeats and pass-rate thresholds.** Each case runs exactly once. There is no concept of "this case must pass 9/10 runs at p≥0.85" — pure deterministic-looking pass/fail over a probabilistic system. This is the single biggest LLM-eval anti-pattern in the harness.
- **Negative tool assertions.** "`render_diagnostic_form` must NOT have been called" is unrepresentable. `text_not_contains` papers over some leakage but isn't a tool-level assertion.
- **Text-similarity assertions.** Only substring; no LLM-judge, no embedding similarity, no regex. "Response should be one short acknowledgment, not a lecture" is approximated only via banned phrases.

#### 1.6 Conversation/vehicle dropdown plumbing

`loadConversations` (line 599) and `loadVehicles` (line 665) hit `ai_conversations:getByUserId` and `vehicles:getMyVehicles` respectively, populate `<select>` elements, and handle the "saved id no longer in list" edge case by injecting a stale-marker entry (lines 628-636 / 695-701). Vehicle ID → VIN translation happens at send time (lines 774-781) because the action's arg validator still expects `vehicleVin` rather than the id.

For evals: `runEval` resolves vehicle by `c.vehicle_vin_tail || "N96146"` (line 1679) — the M550i VIN tail is hardcoded as the default. Any user without a vehicle ending in `N96146` and the explicitly-named overrides will silently drop the `vehicleVin` argument from the action call (line 1690), which can change tool routing (no health record, no provenance signal).

### 2. Eval case set (`scripts/oto-eval-cases.json`)

#### 2.1 Volume and shape

**31 cases**, single JSON file, schema documented inline at line 2 (no separate spec). Total turns across all cases ≈ 50.

#### 2.2 Coverage map by category

| Category | Cases | Notes |
|---|---|---|
| Voice / phrasing rules | 6 (`frustration_acknowledged`, `voice_no_apology_cascade_on_frustration`, `oto_is_booker_not_doer`, `user_is_booker_not_doer`, `no_system_narration_on_tool_miss`, `no_canonical_service_on_on_time`) | All implemented as `text_not_contains` only — purely negative assertions |
| Refusal / scope | 5 (`mechanical_refusal`, `mechanical_refusal_advanced`, `legal_evaluation_refusal`, `medical_redirect`, `financial_advice_refusal`) | Negative assertions on procedure leakage |
| Vehicle facts routing | 5 (`vehicle_facts_engine`, `engine_fact_accuracy_n63_not_s63`, `vehicle_facts_oil_specs`, `vehicle_facts_tire_pressure`, `kb_writes_on_factual_answer`) | Tools-called assertions; the N63/S63 case is the only one with a *positive* fact assertion |
| Trust protocol | 4 (`brake_self_reported_triggers_record_confirmation`, `brake_record_confirmed_routes_to_diagnostic`, `oil_symptom_triggers_record_confirmation`, `tires_symptom_triggers_record_confirmation`) | The most behaviorally interesting cluster — and the most multi-turn |
| Multi-tool batching / health | 3 (`health_check_with_warning_light`, `multi_tool_batch_health_and_due`, `warning_light_narrows_before_diagnostic`) | Test parallel-tool patterns |
| Symptom routing | 2 (`polite_exit_after_vague_narrowing` (6 turns), `direct_routine_oil_change_request`) | The polite-exit case is the longest in the suite |
| Override / safety | 2 (`override_pushback`, `danger_symptom_brakes_grinding`) | |
| Memory across turns | 1 (`mileage_remembered_across_turns`) | |
| External-vehicle KB | 2 (`general_car_knowledge_other_car`, `lookup_unknown_make_handles_gracefully`) | |
| Service history | 1 (`service_history_query_get_bookings`) | |
| Educational | 1 (`educational_oil_synthetic_vs_conventional`) | |

#### 2.3 Coverage gaps

Behavior classes with **zero** cases:

- **Booking spine** — no end-to-end booking conversation. `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation` never appear in any `tools_called` assertion. The harness *renders previews* for all three (lines 922-963) but nothing asserts on them.
- **Sonnet escalation** — `chat.ts` references model routing and the trust-protocol handoff doc (line 282) flags Sonnet escalation policy as undecided. No case exercises an escalation tool path.
- **Cap counter / quota enforcement** — task #16 says it's pre-launch, but there's no eval scaffolding waiting. When it lands, there's no infrastructure to validate the cap envelope.
- **`record_vehicle_fact` write verification** — `kb_writes_on_factual_answer` only asserts `get_vehicle_facts` is called, not that a write follows. The KB-flywheel claim is unmeasured.
- **Web-search fallback path** — `lookup_unknown_make_handles_gracefully` asserts text negation but doesn't assert that `web_search` actually fires.
- **Multi-vehicle accounts** — flagged as "untested" in `Trust_Protocol_Inflight_Handoff.md:286`. No case sets `vehicle_vin_tail` to anything other than the default.
- **Conversation history loading** — no case verifies the model uses prior-turn context that came from `ai_messages` rather than `ai_conversations.last_user_intent`.
- **Polite-exit counter mechanics** — `polite_exit_after_vague_narrowing` exercises the threshold but doesn't verify the counter resets after rendering, or behaves correctly across `debug_skip_persist=true` (which it cannot, because that path skips the counter mutation entirely — line 800).

#### 2.4 Case-quality observations

**Too loose:**
- `vehicle_facts_engine` (line 156-166) asserts only that `get_vehicle_facts` is called. The model could return "your engine is a banana" and pass.
- `service_history_query_get_bookings` — same problem; tool-called only, no content check.
- `multi_tool_batch_health_and_due` — asserts both tools are called *somewhere* in the conversation. Cannot verify they were called in the *same iteration* (the actual property under test, per the description on line 323).

**Too strict / brittle:**
- `health_check_with_warning_light` asserts `text_contains: ["80"]` (line 13). Any UX change to the score format ("80/100" → "80%" → "Healthy — 80") still passes, but if the score actually lands at 78 or 82 due to data drift the case fails for the wrong reason. Hardcoded numeric expectations should never appear in LLM evals against live data.
- `engine_fact_accuracy_n63_not_s63` (line 192-205) asserts `text_contains: ["N63"]` with `text_not_contains: ["S63", "625 hp", ...]`. This is the right pattern for fact regression — but it's the *only* case doing this kind of source-of-truth verification.
- The `brake_*` cases share an enormous `text_not_contains` list of jargon leak phrases (`"self-reported"`, `"record_provenance"`, `"trust gating"`, `"render_record_confirmation"`, etc., lines 35-49) — these are guarding against system-internal terminology bleeding to the user, which is a real concern, but every new vocabulary term is a manual addition.

**Genuine false-positive risk in `text_not_contains`:**
- Line 14 bans `"thermostat"`. If a case ever needed Oto to say *"…not a thermostat issue, here's what it actually is…"* the case fails. Negative assertions on common nouns are a footgun.
- `brake_self_reported_triggers_record_confirmation` bans `"is the right"` (line 28). This is meant to catch *"X is the right service"* but will false-positive on natural English like *"is the right call to wait until…"*. This is the same heuristic problem the bulk-runner narration-leak detector has.
- The polite-exit case (line 354-371) requires 6 specific user replies in sequence. If Haiku ever converges on turn 4 (which would be *correct* behavior — the user is being clearer than the case implies), the case fails for being too good.

**Per-case description quality:** uniformly high. Every case has a description that explains *what behavior is being guarded* and often *why*. The `brake_self_reported_triggers_record_confirmation` description even cross-references the doc that defines the protocol (line 21). This is a meaningful asset — it's what makes the suite intelligible without sitting next to the author.

#### 2.5 Multi-turn handling

Of 31 cases, only 7 are multi-turn. Branching is **not** modeled — every turn's user message is a string literal. The runner cannot react to what the model did in the previous turn. The trust-protocol cases simulate the post-render flow by hardcoding the user reply (`"Confirmed - brakes record is correct as-is."` at line 83) — but if turn 2 doesn't actually fire the record-confirmation render, turn 3 still sends "Confirmed -..." into a non-existent context. The case fails on turn 2's tool assertion, but turn 3's "confirmation message after a render that never happened" is now an out-of-distribution input to Haiku, which can mask or obscure the real failure mode.

#### 2.6 Sampling-variance posture

There is **none**. Every case runs once. Pass-rate thresholds, confidence intervals, repeat-N, p-values — none of these concepts exist anywhere in the eval runner or the case file. The whole suite is treated as if it were a deterministic test suite. This is the most serious structural weakness in the eval setup. A case that genuinely passes 70% of the time and a case that passes 99% of the time both show as binary "passed" or "failed" depending on the dice that day.

### 3. The bulk runner + analyzer (browser-console only)

#### 3.1 What it computes

This code lives only in browser console state — no `__runBulk` / `__bulkRunOneCase` references exist anywhere in `scripts/`, `convex/`, or `docs/`:

- **Per-case pass rate** across N repetitions (the closest the system comes to addressing 2.6 above)
- **Narration-leak rate** — frequency of system-internal phrasings appearing in user-facing text
- **Trust-gate fire rate** — how often `render_record_confirmation` actually fires under symptom-vs-record contradictions
- **Latency distribution** — presumably percentiles or histogram across the bulk run
- **Tool counts** — aggregate tool-call frequency across the run

This is the right shape of analysis to layer on top of `runEval` — it converts deterministic-looking pass/fail into probabilistic signal.

#### 3.2 Limitations — the narration-leak heuristic

`"is the right"` produces false positives by catching natural English. The same bad heuristic is *already baked into the eval cases themselves* (line 28, line 38, line 90 of `oto-eval-cases.json`). The leak detector is a substring scan over a list of banned phrases, which conflates two different things:

- *Verbatim system jargon* (`"render_record_confirmation"`, `"record_provenance"`) — high-confidence leak
- *Phrasings that are ban-worthy in some contexts but innocent in others* (`"is the right"`, `"the lookup"`, `"checking the database"`) — low-confidence; need context

A proper version would tag each banned phrase with `{phrase, severity, context_required}` and either run an LLM judge for the ambiguous ones or restrict the substring match to specific syntactic positions (start of sentence, immediately following the service name, etc.). What's there now is fast and good enough for "spot the obvious leaks" but will systematically over-report.

#### 3.3 Other expected limitations

- **No persistence.** Refresh the harness page and the bulk-run history is gone. There's no JSON dump, no `localStorage` write, no upload to Convex. Runs are not historically comparable.
- **Conversation pollution.** Each repetition creates a fresh `ai_conversations` row (`runVariation` line 1604-1607 uses `Math.random()` session id and `runEval` similarly creates one per case — line 1675). If `debug_skip_persist=true` is honored those rows still get the create but no message persistence — but `ai_conversations:create` *always* writes the row. A 30-case × 10-repeat run leaves 300 empty conversation shells in the user's account. No cleanup.
- **No parallelism.** Both `runSuite` and `runEval` are strictly serial. A 30-case suite at ~3-5s/case with no repeats is ~2 minutes. Add 10 repeats and you're at 20+ minutes per bulk run. The Convex action endpoint can handle parallel calls; the harness chooses not to, presumably because the `console.log` output would interleave incomprehensibly.
- **Tied to the human's session.** All requests go through the user's Clerk JWT and consume Anthropic budget billed to the production deployment. There is no separate eval account, no rate-limit guard, no cost cap.

#### 3.4 Why this isn't promoted to the harness HTML

The honest answer based on the artifact: the inline-console approach is the path of least resistance. Promoting it would mean:

- Adding UI for "run N times" and "select cases to bulk-run"
- Building a results table component (the harness has no tabular data widget — every render today is hand-written innerHTML)
- Designing how the analyzer output is visualized (histograms, pass-rate bars)
- Deciding what to do about the 300 stale conversations problem
- Handling the 20-minute serial runtime with progress UI / cancellation

None of that is hard, but each piece is friction. The console approach lets the author iterate on the analyzer logic in seconds. The cost is that the analyzer dies with the tab and is invisible to anyone else on the team. This is the classic "powerful one-off in someone's REPL" trap — it works until it doesn't, and the debt accrues silently.

### 4. The integrated picture

#### 4.1 Full eval execution flow

```
oto-eval-cases.json (31 cases)
        ↓
window.__oto.runEval()
   ├── stampAuth() → Clerk getToken({template:"convex"})
   ├── for each case:
   │     ├── ai_conversations:create  (always, even on skip_persist)
   │     ├── resolve vehicleVin from c.vehicle_vin_tail || "N96146"
   │     └── for each turn:
   │           ├── stampAuth()
   │           ├── oto/chat:sendMessage  (debug=true, debug_skip_persist=true)
   │           ├── flatten data+state+terminal tool uses
   │           └── evaluate {tools_called, branch, text_contains/not_contains, form_system}
   └── return { total, passed, failed, results }
```

`debug_skip_persist=true` short-circuits `ai_messages` writes and `recordTurn` telemetry inserts (`chat.ts:719-738, 830`) but *not* `ai_conversations:create` or `ai_conversations.setDiagnosticTurnCount` — meaning eval runs leak shell conversations and skip exercising the polite-exit counter writes entirely. This last point is significant: the polite-exit case (line 354-371) cannot actually verify the counter mechanism end-to-end through the eval harness because the persistence path is bypassed.

#### 4.2 Production observability gap

`oto_telemetry` exists (`schema.ts:1730-1755`) and is written on every non-debug turn (`chat.ts:830-849`). The schema is well-designed: per-turn token counts (input/output, with cache_creation/cache_read separated), latency, tools_called array, final_branch, hit_cap, error string, indexed by user/timestamp. **Nothing reads this table.** Task #15 ("Build observability dashboards over oto_telemetry") is open. There is no aggregation query, no admin UI, no scheduled report, no alerting. The data is being collected and ignored.

This is a meaningful gap because the eval suite is essentially a synthetic-traffic instrument — production telemetry is the *only* signal for distribution drift, real user phrasings the eval suite doesn't anticipate, cost trends, and cache-hit rate changes after a prompt revision. Running evals without watching production metrics is half the picture.

#### 4.3 What's structurally missing for proper LLM-system testing

| Gap | Severity | Why it matters |
|---|---|---|
| Per-case repeats with confidence intervals | **Critical** | 31 single-shot binary results over a probabilistic system is meaningless. Need at minimum N=10, with pass-rate threshold per case. |
| Per-assertion drill-down | High | A case has 2-10 assertions; the runner reports failures as a flat string array. No way to see "this case fails because text_not_contains is too strict, not because the tool routing is broken." |
| Cost tracking per run | High | Token counts are captured per turn in `runVariation` output but never surfaced from `runEval`. A prompt change that doubles tokens but keeps pass rate flat is invisible. |
| Latency distribution dashboards | Medium | Latency captured but never aggregated. p50/p95/p99 unknown. |
| A/B test infrastructure for prompts | High | No way to run case set against `system_prompt_v0.9` and `system_prompt_v0.10` side-by-side, or compare deltas. Every prompt change is a flying-blind regression risk. |
| Probabilistic regression detection | **Critical** | A change that drops a case from 95% to 70% pass rate looks identical to a no-op if the run after the change happens to land in the 70%. No statistical test for "is this distribution different from baseline?" |
| Full action-pipeline integration tests | High | Evals only exercise `oto/chat:sendMessage`. The mobile dispatch (e.g., `AIRecordConfirmation` posting back a synthetic user message, or service-picker tap → `bookings.create`) is untested by the eval surface. The component test that *was* done (task #14) was a manual device test, not automated. |
| Persistent run history | Medium | Each `runEval` returns ephemeral results. No JSON dump-to-disk, no commit-to-git, no comparison-to-last-run. Trend lines impossible. |
| Eval cleanup | Low (now), Medium (over time) | Each run leaks an `ai_conversations` row per case. No GC. |
| Negative tool assertions | Medium | Cannot say "render_diagnostic_form must NOT have fired this turn." Critical for trust-protocol cases where the *whole point* is choosing one render tool over another. |
| Cross-turn branching | Medium | See 1.5 above. The trust protocol literally cannot be fully exercised. |

#### 4.4 Comparison to industry-standard LLM eval setups

| Feature | Promptfoo | Braintrust | LangSmith | This harness |
|---|---|---|---|---|
| Case definition | YAML/JSON | UI + SDK | UI + SDK | JSON ✓ |
| Multi-turn | Yes (conversation arrays) | Yes | Yes | Partial (no branching) |
| Per-case repeats | `repeat: N` | Native | Native | None |
| LLM-judge assertions | Yes (`llm-rubric`, `factuality`) | Yes (autoevals lib) | Yes (custom evaluators) | None |
| Embedding/similarity | Yes | Yes | Yes | None |
| Side-by-side diff | Yes (web UI) | Yes | Yes | None |
| Cost tracking | Per-provider | Native | Native | Not surfaced |
| Latency p50/p95 | Yes | Yes | Yes | Single-call ms only |
| Run history | Local + cloud | Cloud-native | Cloud-native | None |
| Regression detection | Threshold-based | Statistical | Statistical | Binary pass/fail |
| Cron / CI integration | Yes (CLI) | Yes | Yes | None — browser-only |
| Prod traffic replay | Limited | Yes (logs → eval) | Yes (traces → eval) | None |

The harness is doing the work of Promptfoo's case definition + Braintrust's per-turn trace inspection — but reinvented from scratch in vanilla JS, missing every probabilistic and historical feature, and runnable only by a human sitting in front of a browser tab. There is a defensible reason to build this in-house (the trace inspector is genuinely tighter than what these tools give you out of the box, because it understands Oto's internal branching model), but the lack of any of the standard table stakes — repeats, history, LLM judges, cost surfacing — is a real cost. Wrapping `runEval()`'s output in a Node script and posting to a dashboard would be a one-day project that would unlock most of the missing pieces.

#### 4.5 The "flywheel-compliance" metric

Task #3 in the task list — "Bulk-eval runner + compliance analyzer" — was the work that produced the analyzer in 3.x. The framing in the system prompt and `Oto_AI_v0.8_Handoff.md:79` is "Locked Principle #8 — every prompt change debated against this set," and the trust-protocol handoff frames flywheel compliance as a measure of KB-hit rate and `web_search → record_vehicle_fact` follow-through.

**Is it measuring what matters?** Partially. The analyzer measures:

- KB-hit rate — whether known facts are pulled from `vehicle_facts_kb` rather than re-fetched
- `web_search → record_vehicle_fact` compliance — whether new facts get persisted

**Edge cases the metric likely misses:**

1. **False-positive KB hits.** A `get_vehicle_facts` call that returns a stale or wrong cached fact still counts as "KB hit." There's no quality gate on what's *in* the KB, so the metric measures retrieval frequency, not retrieval correctness. A prompt change that makes Oto trust the KB *more* could simultaneously raise the compliance score and degrade answer accuracy.
2. **`record_vehicle_fact` collisions.** If two evals both write `oil_capacity_qts` for the same engine, the second wins silently. The compliance metric counts both as success but the KB ends up with one value.
3. **Topic-axis drift.** The KB is keyed by `(engine, topic)` and `(make, model, year_min, topic)`. A small canonicalization change in topic strings could fragment the KB invisibly while the compliance metric stays green.
4. **Per-turn semantics vs. per-conversation semantics.** "Compliance" is a per-call decision but the user-visible benefit is per-conversation (faster, no re-asks). The metric doesn't capture latency reduction across follow-up turns from the same user.
5. **Scope.** Flywheel compliance covers `vehicle_facts` writes but the trust protocol added a *second* flywheel — `maintenance_records` corrections via `render_record_confirmation`. The metric does not (per the analyzer's described scope) track that flywheel at all.

Bottom line: it's a useful proxy for "is the KB being exercised the way the prompt intends," but it should not be read as a quality measure of the KB or of Oto's overall behavior, and the framing in the handoff docs slightly overstates what it proves.

### 5. Top recommendations (ranked)

1. **Promote `__runBulk` to the harness HTML and add per-case repeats with pass-rate thresholds** — the single biggest unlock. Without this, the suite is statistical theater.
2. **Add tool-input assertions** (`tool_input_includes: { tool, path, value }` shape) — current case set has at least 8 cases that would tighten meaningfully.
3. **Add an LLM-judge assertion shape for voice/refusal cases** — current `text_not_contains` lists are brittle and false-positive prone (see line 28's `"is the right"`). Replace the heuristic-based narration-leak detection with one judge prompt.
4. **Build a Node CLI wrapper for `runEval`** that dumps results as JSON, commits a baseline file, and diffs run-over-run. Solves history, A/B, CI integration in one shot.
5. **Build the `oto_telemetry` dashboard (task #15)** — production signal is currently invisible. Even a single Convex query that aggregates `final_branch` and `tools_called` distributions over the last 24h would be more useful than what exists.
6. **Add cleanup for eval `ai_conversations`** — either tag them with `session_id` prefix and add a TTL sweeper, or thread the `debug_skip_persist` flag through to the conversation-create call.
7. **Add cross-turn branching to the runner** — required to actually validate the trust protocol's "user denies record" path that doc explicitly flags.
8. **Replace `text_contains: ["80"]` style hardcoded score expectations** with structural assertions (e.g., score is in 0-100 range, score appears, score doesn't claim 95+ for an account with active warning lights).

---

## Section 6 — Operational State + Open Issues Audit

**Branch audited:** `Waleed-Dev` (current) — commits since merge from Ahmad-dev are mostly Oto-AI surface area. **Audit date:** 2026-05-15. **System prompt runtime version:** v0.9 with in-flight Trust Protocol additions.

### 1. v0.9 Shipped State (Baseline)

Per `docs/oto-ai/Oto_AI_v0.9_Handoff.md` the v0.9 baseline is genuinely shipped, validated 6/6 stages live in the harness, with the following load-bearing surfaces wired:

- **6-stage booking-flow chain** end-to-end through the harness: `service_selection → diagnostic_form → priority_selection → shop_selection → time_selection → confirmation` — each stage one render tool per turn, conversation state advancing through `last_intent` values (`Oto_AI_v0.9_Handoff.md:33-46`).
- **Trigger-only render schema** for `render_shop_carousel` / `render_time_selector` / `render_booking_confirmation`. Oto passes IDs only; mobile components own pricing/data resolution against Convex (`Oto_AI_v0.9_Handoff.md:40-46`, `tool-inventory.md:47-49`).
- **Pricing-rule lockdown:** Oto NEVER composes prices anywhere. Removed `price` field from `render_service_picker`, banned phrasings, "route through booking flow" pattern (`Oto_AI_v0.9_Handoff.md:48-58`).
- **Sonnet cascade scaffolding** — `request_sonnet_handoff` / `request_haiku_handback` tools, `ai_conversations.current_model` field, per-turn model selection in `chat.ts` switching between `HAIKU_MODEL` (claude-haiku-4-5-20251001) and `SONNET_MODEL` (claude-sonnet-4-6) at TURN START (`Oto_AI_v0.9_Handoff.md:69-75, 156-158`).
- **`appendEstablishedFact` mutation + `<conversation_state>` envelope plumbing.** This was a v0.9 backend plumbing landing; mobile wiring was the gap. As of this branch it is now wired in `app/(main-tabs)/ai-chat/index.tsx:176-190`. So the v0.9 "TODO for mobile" is closed (resolves the only flagged v0.9 gap that wasn't TestFlight-dependent).
- **Telemetry** writes per turn via `convex/oto/telemetry.ts:recordTurn` — model, tokens, cache hit counts, latency, tools called, branch, optional booking_id, optional error. Locked Principle #12 satisfied at the plumbing level. Note that the mutation is fire-and-forget by design (`telemetry.ts:8-10`) — no dashboard surface yet (Task #15 pending).
- **Polite-exit counter** + **markdown bold strip** + **prompt caching with `cache_control: ephemeral`** are all in place per `oto-engine-inventory.md:25-30`.

**v0.9 baseline eval was 7/8 passing**, with `brake_narrowing_on_time_to_diagnostic` being the failing case — and that failure is what triggered the entire Trust Protocol session.

### 2. In-Flight on `Waleed-Dev` — Trust Protocol Work

Per `docs/oto-ai/Trust_Protocol_Inflight_Handoff.md` lines 1–287. The branch contains **a lot** of unrelated cross-feature work mixed in (the handoff doc explicitly warns at line 12; `git status` confirms — 200+ modified files including enrichment, settings, vehicle pages). The trust-protocol-specific changes are 10 files, 3 new + 7 modified.

#### 2.1 What completed in the trust-protocol session

- **`record_provenance` field** added to `get_vehicle_health` output. Three values: `verified` / `self_reported` / `inferred`. The pre-edit `loadVehicleContext` in `convex/oto/vehicleHealth.ts:181-188` was actively stripping `confidence` / `serviceSource` / `confirmedHealthyAt` before they reached Oto — Oto has been **reasoning blind** on record trust since launch. Now wired through `provenanceByType` map. Verified live on M550i (`Trust_Protocol_Inflight_Handoff.md:103-118`).
- **`render_record_confirmation` tool** added (schema + dispatcher case + chat.ts validator). Trigger-only, takes `vehicle_id` + `maintenance_type`. Per the dispatcher the contract is documented but the field-parity contract block was extended (`tools.ts`, `dispatcher.ts:packageRenderDirective`).
- **`AIRecordConfirmation` mobile component** built — two-step state machine (prompt → form). Calls `upsertRecord` directly with one of two paths: confirm (sets `confirmedHealthyAt`, locks status `on_time` for 90 days) or update (writes `serviceSource: "ai_chat_correction"`, `confidence: "self_reported"`).
- **`upsertRecord` extension** in `convex/maintenance.ts` accepting `confidence`, `serviceSource`, `confirmedHealthyAt` (Ahmad signed off — coordination noted in `Trust_Protocol_Inflight_Handoff.md:164`).
- **Locked Principle "Suggest, don't mutate"** — drafted but not formally adopted into `oto-engine-inventory.md`. Working name only. Critical principle for future authors who'd be tempted to add `set_user_phone` / `update_vehicle_mileage` (`Trust_Protocol_Inflight_Handoff.md:78-84`).

#### 2.2 What's pending / blocking for full Trust Protocol completion

| # | Task | Why blocking |
|---|---|---|
| 6 | System-prompt rewrite teaching the protocol | **Tool exists in schema, but Haiku has no prompt instruction telling it when to fire `render_record_confirmation`.** Smoke test confirmed Haiku currently improvises text answers when contradiction is detected. This is the single load-bearing pending item. Without it, the rendered tool is dormant. |
| 7 | Eval-case rewrite for `brake_narrowing_on_time_to_diagnostic` | Current case checks for the wrong ideal behavior. Needs branched expectations (turn-2 = `render_record_confirmation`; turn-3 differs based on confirm/deny). May require eval-runner enhancement. |
| 9 | Cleanup: merge `diagnostic_form` → `service_options` step type | Architectural cleanup queued during this session. Not urgent. |

#### 2.3 Edge cases / open questions still unresolved (`Trust_Protocol_Inflight_Handoff.md:278-287`)

1. **Eval-runner branching support** — the runner needs per-turn branching expectations or the case must be modeled as two sibling cases.
2. **Sonnet escalation for trust-protocol turns** — undecided. The polite-but-non-accusatory tone ("our records show X — is that still right?") is exactly Sonnet's strength. No formal cascade trigger yet.
3. **Cap-counter interaction** — the protocol adds 1–2 turns; no decision on how cap counter weights them.
4. **Multi-vehicle accounts** — passes vehicleId explicitly through envelope so should work, but **completely untested**.

### 3. Render-Component Display Bug 3 — Status

Task #21 (`FIX: Render component fires but doesn't display in mobile`) is marked completed for the v0.9-shipped render envelopes (service_picker, diagnostic_form, quick_replies). However:

- **Task #22 still pending: "Build mobile components for v0.9 trigger-only render envelopes."** Concretely: the trigger-only schemas for shop_carousel / time_selector / booking_confirmation send IDs only — but the mobile components that are supposed to receive `(service_slug, priority)` and query Convex for shops, or `(mechanic_id, service_slug)` and fetch slots, are **not yet built or fully wired**. `app/(main-tabs)/ai-chat/index.tsx` only references `showServicePicker` (line 435+); no `showShopCarousel` / `showTimeSelector` / `showBookingConfirmation` rendering branches exist (verified by grep).
- This means **the booking flow chain that v0.9 "verified live in the harness" cannot complete on a real device past stage 3 (priority_selection)**. The harness uses stub preview cards. On-device, stages 4-6 will fire from Oto's side but render nothing. This is a critical launch-blocker that the v0.9 handoff understated.
- AIRecordConfirmation is built, but the device test in Task #14 was an audit, not a TestFlight run. Production-on-device behavior of the confirmation widget is **inferred, not verified**.

### 4. OPENAI_API_KEY / Semantic KB Situation

`convex/oto/vehicleFactsKB.ts` references `process.env.OPENAI_API_KEY` at lines 276–278 and 326. With no key set, KB lookups silently fall back to **structural retrieval only** (config / chassis / engine). Semantic search via embeddings is **degraded to off in production**. Per Task #11 (still pending): "Decide on semantic KB strategy (defer embedding key OR pick provider)" — founder direction is **defer**. The structural fallback is sufficient for now because the KB itself has thin content (mostly M550i + a small set of BMW configs per `Oto_AI_v0.9_Handoff.md:111-114`). The flywheel narrative is: "let real conversations seed the KB, then turn embeddings on when there's content worth indexing."

### 5. Open Issues / Known Bugs / Deferred Work — Enumerated

#### 5.1 Explicit deferrals (founder-acknowledged)

- **Cap counter** (Locked Principle #7) — schema field + monthly reset + envelope budget + prompt template all unbuilt. Task #16 pending. Per founder direction: "lock 2 weeks before traffic increase." (`Oto_AI_v0.9_Handoff.md:94-98`, `tool-inventory.md:81-83`)
- **Sonnet cascade calibration** — awaits TestFlight data. The two persistent Haiku-ceiling loopholes (cause-speculation enumeration, Decision A direct-service slip) are documented Sonnet calibration targets per `Oto_AI_v0.9_Handoff.md:103-109`. Cannot tune escalation thresholds without traffic.
- **Catalog seeding** for popular comparison cars (M5, M3, Tesla Model 3, Mercedes C63) — reframed as "let the flywheel handle it." Until then, comparison-car lookups fall back to `web_search`, increasing per-turn latency + cost (`Oto_AI_v0.9_Handoff.md:111-114`).
- **Streaming responses** (Phase 2) — Task #13 pending. First-token <600ms target.
- **`@convex-dev/rag` migration** — Task #18. Future cleanup.
- **`diagnostic_form` → `service_options` step type cleanup** — Task #9 queued.

#### 5.2 Latent bugs / known-but-unfixed quality issues

- **3% "self-reported" plain-English narration leak** per the compliance analyzer (Task #3 finding). Haiku occasionally narrates itself ("the lookup," "the catalog," "let me search") despite the v0.9 banned-phrasings rule. Belt-and-suspenders strip exists for markdown bold but no equivalent post-process for system-narration phrases.
- **Trust-gate sampling variance** — passes 100% in 3x bulk eval but **occasionally fails on single-shot**. Symptom of Haiku reasoning instability that no prompt iteration has fully closed. Suggests the deterministic-feeling 100% bulk pass is actually statistical luck.
- **Vehicle facts trim_specs filter timeout** — recently fixed (`convex/oto/vehicleFacts.ts:117-141`). The pre-fix version used `.filter()` against `trim_specs` (a large enrichment-derived table), forcing a full table scan and timing out the 1s Convex query budget. Now uses `withIndex(by_vehicle_config)` / `withIndex(by_trim)`. **This is a representative example of latent ops issues — the table grew enough during enrichment scaling that a previously-"fine" .filter became a P0. Expect more of these as the catalog grows.**
- **`established_facts` only wired on 4 render components.** Mobile push happens for shop_carousel / time_selector / service_picker / booking_confirmation. Quick replies are NOT pushing facts — meaning the `priority_selection` stage tap doesn't actually persist the user's choice into `established_facts` for the next turn. Haiku has to re-read it from message history. Confirmation worth checking against `app/(main-tabs)/ai-chat/index.tsx:176-190`.

#### 5.3 Untouched surface area (the size of this list is the headline)

Things Oto is **NOT yet AI-touchable**, despite being core OtoPair surfaces:

- **Onboarding orchestration** — Oto cannot guide a new user through vehicle setup
- **Quarterly check-in** — Oto cannot administer or reason over check-in answers
- **Notifications** — read or send
- **Reviews** — read for shops/mechanics OR submit on behalf of user
- **Rewards** — `get_rewards_summary` defined in tools.ts but NOT in `TOOL_NAMES_V1` (`tool-inventory.md:59`)
- **Mechanic-side workflows** — entirely separate model, not unified
- **Billing / payments** — Oto's involvement ends at stage 6 (`render_booking_confirmation`); the payment redirect is mobile-side
- **Service-record uploads** — not in tool surface
- **Image / photo analysis** — `AIAttachmentPanel` exists, images stage in user input, but Oto has no vision-tool wiring
- **Voice mode integration** — unclear / undocumented
- **Smartcar OBD-II integration** — deprecated in this branch with NO replacement. Smartcar was the only verified source of telemetry-grade live status. Loss is significant for the "verified" provenance pipeline (one of the four trust-source writers per `Trust_Protocol_Inflight_Handoff.md:90-97` is gone).

### 6. Coordination / Cross-Team Concerns

- **Ahmad** owns `convex/maintenance.ts`, `convex/maintenance_pipeline.ts`, plus the entire intelligence-engine layer in `CONVEX_BACKEND_CHANGES.md` (composite_modifier_weights, vehicle_classifications, vehicle_service_states, vehicle_checkins, vehicle_driving_profiles, classifier.ts, intervals.ts, modifiers.ts, lib/checkin_questions.ts). The Ahmad-dev branch was merged in (`commit eba252f`). **Pre-existing slug-drift in maintenance_pipeline.ts:518-547 and bookings.ts:2108-2145 silently breaks anchor-date interval calculation** — Oto sees `due_soon` / `overdue` flags that are computed from OEM defaults, NOT from real anchor dates. This is a **silent data-quality bug that directly degrades Oto's diagnostic accuracy** and is the kind of thing the trust protocol exists to mitigate. Status: **unfixed** per `slug-drift-remediation.md:3` ("Still parked as of v0.9 (2026-05-14). The Oto AI work through v0.9 has not touched any of the listed drift sites").
- **Daniel/Waleed schema split** — referenced in CLAUDE.md routing tables but no explicit notes file in `docs/`. Ahmad-dev brought ~3,550 lines / 6 new tables / 4 modified tables. Coordination pattern: schema changes happen on Ahmad-dev, Oto AI consumes them on Waleed-Dev, merges happen at major handoff points.
- **Slug-drift remediation status:** **NOT DONE.** 8 files documented (3 high-severity runtime, 1 critical-if-run seed, 4 latent/cosmetic). `bookings.ts`, `maintenance_pipeline.ts`, `job_actuals.ts`, `packageRules.ts` still failing silently. `seed.ts` will corrupt prod if invoked. Per the doc: "Owner-decision needed before any of this is done — the fixes have cross-feature blast radius and at least one of them (seed.ts) is potentially destructive." **This is a launch-blocker for any feature that depends on accurate maintenance anchoring or package detection.**

### 7. Production-Readiness Scoring

| Dimension | Score | Justification |
|---|---|---|
| **Tool surface coverage** | **45/100** | Booking flow + vehicle health well covered. Onboarding, check-in, notifications, reviews, rewards, mechanic-side, payments, photos, voice, Smartcar — none AI-touchable. ~10 of 22 originally-spec'd tools are wired into `TOOL_NAMES_V1`; ~12 are advertised-but-unwired schemas. |
| **Voice / discipline** | **78/100** | v0.9 prompt rules are the maturest layer: confirm=execute, banned phrasings, user-is-booker-not-doer, no-system-narration, mood-adaptive shaping. 3% narration leak persists. Markdown-bold strip is server-side. Reasonably defensible for launch. |
| **Safety / refusals** | **70/100** | Pricing rule is locked; web_search policy gates pricing/recalls/financing/legal. Trust-protocol "Suggest don't mutate" principle is the right design. But it isn't formally adopted yet, the only render-confirm-required widget so far is AIRecordConfirmation, and there's no enforcement mechanism preventing future authors from adding direct-write tools. |
| **Performance (latency)** | **55/100** | Prompt caching with `cache_control: ephemeral` is in place. Per-turn telemetry captures cache_read_tokens. No streaming yet (Task #13 deferred). web_search fallback for KB-misses adds ~2-4s when triggered. Trim_specs filter timeout was a recent P0 fix — suggests latency cliff is closer than scaling assumptions imply. |
| **Observability** | **40/100** | `oto_telemetry` table writes per turn (`convex/oto/telemetry.ts:15-40`). All the right fields captured. **But no dashboards exist** (Task #15 pending). Reading raw rows in Convex console is the only way to see anything today. Compliance analyzer is offline / harness-only. No alerting on cap-hits, cost spikes, or latency regressions. |
| **Eval coverage** | **60/100** | Expanded from 8 → 30+ cases (Task #12 completed). Bulk-eval runner + compliance analyzer built (Task #3). Two persistent Haiku-ceiling loopholes are documented Sonnet calibration targets. Single-shot variance vs 3x-bulk-pass divergence is a known reliability concern. Branching expectations not yet supported in eval runner. |
| **Multi-model / cost** | **50/100** | Sonnet cascade scaffolding wired but **completely uncalibrated** — pending TestFlight. Cap counter not built. Per-conversation model routing exists at the field level (`current_model`) but the model switch happens AT TURN START only — no mid-turn switching. Cost-per-conversation is verifiable per turn but has no aggregation surface. |
| **Scale-readiness** | **35/100** | Trim_specs timeout fix is the canary in the coal mine. Catalog data thin (M550i + a few BMW configs). web_search fallback is heavy on KB-misses. Concurrency caps exist on enrichment but not on Oto. No load test artifacts. Multi-vehicle accounts entirely untested. The system was built and verified for one user (Waleed) on one car (M550i) and that's the deepest-tested path. |
| **Mobile integration** | **40/100** | service_picker / diagnostic_form / quick_replies / record_confirmation rendering is wired in `app/(main-tabs)/ai-chat/index.tsx`. **shop_carousel / time_selector / booking_confirmation rendering is NOT** (Task #22 pending). The booking flow chain that "validated 6/6 stages live" only validated stages 1-3 and 6-from-Oto's-side on a real device — stages 4-5 are Haiku→empty-render gaps in production today. AIRecordConfirmation hasn't seen a TestFlight run. `appendEstablishedFact` mobile push wired (closing the v0.9 gap). |
| **Founder/principle alignment** | **85/100** | Pricing rule (founder-stated principle) codified in 4+ places. "Suggest don't mutate" trust principle organic. Cap counter explicitly deferred per founder. Catalog seeding reframed as flywheel per founder. v0.9 handoff calls out and respects all six "Waleed's operating preferences" (one-task-per-prompt, direct, push back, no over-engineering, investigation-first, existing-Convex-patterns). |

**Mean: ~56/100.** Weighted toward the dimensions that bite first at launch (mobile integration, scale-readiness, observability) the picture is worse — call it **45/100 launch-readiness for a "fully fledged AI integrated with all of OtoPair."**

### 8. Integrated Picture

#### 8.1 Honest readiness percentage

**For the booking flow specifically:** ~70% on the harness, ~50% on real devices (gated by Task #22 mobile components for trigger-only renders).

**For "fully fledged AI integrated with all of OtoPair":** **30-35%.** The integration matrix is mostly white space. Booking + vehicle health + diagnostic flow + KB lookup are AI-touchable. Onboarding, check-in, reviews, rewards, payments, notifications, mechanic-side, photos, voice — none are. The Oto AI subsystem is a compelling vertical slice in a product that has many other verticals.

#### 8.2 Highest-leverage missing pieces (ranked)

1. **Task #22: build mobile components for trigger-only render envelopes (shop_carousel / time_selector / booking_confirmation).** Without these, the booking flow that v0.9 "validated end-to-end" cannot complete on a real device. This is the single biggest gap between "verified in harness" and "shippable." **Hard launch blocker.**
2. **System-prompt rewrite for Trust Protocol** (Trust Protocol Task #6). Tool exists, Haiku won't fire it. Currently dormant infrastructure.
3. **Slug-drift remediation** (`docs/oto-ai/slug-drift-remediation.md`). Specifically Files 1, 2, 4. `maintenance_pipeline.ts:519-524` silently breaks anchor-date interval calculation, which means **the data feeding Oto's `record_provenance` reasoning is itself unreliable**. The trust protocol is half-built on top of unreliable data.
4. **Observability dashboards** over `oto_telemetry` (Task #15). Ship-readiness without observability is fly-blind. Need at minimum: per-day turn count, per-conversation cost, model split (Haiku vs Sonnet), cache-hit %, branch distribution, error rate.
5. **Multi-vehicle account testing.** Untested in any handoff. The vehicle_id passes through envelope, but no eval case validates a 2+ vehicle account. Will surface bugs the day a real user with 2 cars signs up.

#### 8.3 Risk areas that could bite at launch

- **Render gap stages 4-5** — Haiku fires the tool, mobile renders nothing, user sees a blank message. **High probability, high severity, no mitigation.**
- **Slug drift breaking maintenance anchoring** — degrades every "due_soon"/"overdue" status feeding Oto's reasoning. Silent. **High probability, medium severity, fix is well-scoped (`slug-drift-remediation.md`).**
- **Trust gate single-shot variance** — known statistical flakiness that will surface as "inconsistent Oto" complaints. **Medium probability, medium severity.**
- **Sonnet cascade firing on the wrong turns** — uncalibrated escalation may run up Sonnet cost without quality gain on routine turns, or fail to escalate the hard turns where Haiku falls down. **High probability, medium severity, only fix is TestFlight calibration.**
- **No cost cap.** Cap counter explicitly deferred. A single user with a runaway loop can rack up unbounded cost. **Low probability, high severity.**
- **No streaming.** Long replies feel slow; users abandon. **Medium probability, medium severity, deferred.**
- **Multi-vehicle account first-encounter bugs.** **Medium probability, medium severity.**
- **Smartcar deprecation with no replacement.** "Verified" provenance pathway permanently shrunk to (booking, uploaded record, mechanic onboard). Breaks the assumption in the trust-source mapping table. **Latent — not a launch blocker but reduces the trust protocol's effective coverage.**

#### 8.4 Things over-engineered relative to v1 needs

- **Sonnet cascade scaffolding** — the routing tools, the field, the per-turn model selection are all wired up before there is a single TestFlight calibration data point. Could have shipped v1 on Haiku-only and deferred the entire cascade. (Trade-off: scaffolding now means launch-day cascade is one prompt update away, not a wiring sprint.)
- **Polite-exit counter** — increments on narrowing turns, resets on form render, emits `<polite_exit_required>` block at ≥6. Haven't seen any handoff data showing 6-turn diagnostic loops are a real problem in user transcripts. May be solving for a hypothetical.
- **Adversarial verification hook** in the enrichment pipeline (Task 26) — Haiku challenging suspect values with another Haiku call. Sophisticated, expensive, runs async per enrichment. The Convex catalog still has gaps because there's no data, not because there's bad data.
- **Render-tool granularity** — 7 distinct render tools in v0.9 (quick_replies, diagnostic_form, service_picker, shop_carousel, time_selector, booking_confirmation, record_confirmation). Phase 2 will likely consolidate. Useful for AI to know when to fire which, but the cached-prompt cost adds up.
- **`record_vehicle_fact` as mandatory after every factual answer** (`tool-inventory.md:31`) — every factual answer fires a state-tool write. Good in principle for KB seeding; in practice, with embeddings off and KB content thin, it's writing to a structural table that may not be queried meaningfully for months.

---

## Section 7 — Cross-Cutting Findings (Lead Engineer Synthesis)

This section names patterns that span multiple specialist sections and rank-orders findings the team should treat as system-wide concerns rather than file-local issues.

### 7.1 The "schema-as-truth" axis is broken in five places

The Oto subsystem has, by repeated design declaration, the principle that **the schema and code are the source of truth and the docs lag**. That's a defensible position. But the corollary — the schema/code MUST itself be self-consistent and well-typed — is violated in five places that compound:

1. **`maintenance_records.confidence` is a free string** that the trust protocol reads as if it's a 4-value union. The reader collapses everything-not-`"verified"` to `"self_reported"`. So `"unverified"` (a documented label) is silently treated identically to `"self_reported"`. The trust protocol's whole architectural value rests on this distinction. (Section 3, finding 11)
2. **`vehicle_facts.topic` is unbounded free string** with no canonical taxonomy. The KB will fragment as soon as Haiku writes `"oil_capacity"` once and `"oil_capacity_qts"` next time. The "moat" claim depends on this not happening. (Section 1; Section 3, finding 7)
3. **`vehicle_owners.knownIssues` is `v.any()`** but consumed as a tightly-shaped sentinel-prefixed `string[]` in three different files. Production drift has already been documented. (Section 3, finding 16)
4. **`maintenance_records.lastServiceDate: union(string|number)`** half-migration. Writers locked numeric, readers gracefully degrade, legacy strings sit silently treated as missing. (Section 3, finding 6)
5. **`ai_conversations.current_model` is a free string** even though only two values (`"haiku"` | `"sonnet"`) are valid. Cascade telemetry then *also* writes the wrong model field (`MODEL` not `turnModel`), so the very metric the cascade exists to validate against is wrong. (Section 1; Section 3)

The pattern: **every "we'll just use a string and let convention enforce it" decision has produced silent drift in production.** This is a fixable architectural smell: lock the unions, add runtime validators where convex's schema can't constrain.

### 7.2 Auth is the most under-protected layer

Section 3 enumerated 19 functions across `ai_conversations.ts`, `ai_messages.ts`, `maintenance.ts`, `telemetry.ts`, `vehicleFactsKB.ts:patchEmbedding` that lack auth checks or are public mutations meant to be internal. The single worst is `ai_messages.list` — an unauthenticated full-table scan that exfiltrates every conversation in the deployment in one call.

The pattern is the same in every case: the engineering effort went into the *AI-facing* paths (chat.ts has thoughtful auth + ownership; vehicleHealth.ts has the right pattern; recordConfirmation.ts is consistent). The legacy/utility/internal-feeling paths (the four `ai_messages` functions, the eight `ai_conversations` functions, the three `maintenance.ts` functions) were written before the security-discipline discipline was established and never got back-filled.

Single fix that closes most of it: a `requireAuthedUser(ctx)` helper in a `convex/lib/auth.ts` file, plus an audit pass that adds the call to every public `query` and `mutation` not explicitly meant to be public. Should be a one-day refactor.

### 7.3 The "render fires server-side, mobile draws nothing" gap is the single biggest launch risk

This is restated from Sections 2 and 6 because it deserves headline attention: **the booking flow chain that the v0.9 handoff calls "validated 6/6 stages" only completes through stage 3 on a real device.** Stages 4-6 fire from Oto's side, the envelope arrives at mobile, the field is destructured (post-fix), the message stores it — and then nothing draws it. The user sees Oto's accompanying one-sentence text with no carousel, no time picker, no booking summary below.

The harness papers over this with stub preview cards (Section 2 §3.1, Section 5 §1.4-1.5). The harness is misleading. A "passing" harness eval for `render_shop_carousel` proves Haiku fired the right tool and the dispatcher packaged the right envelope — but does NOT prove the user would see anything.

**This is the single difference between "Oto AI is impressively done" and "Oto AI ships." Three new mobile components, ~1 day of focused work** (Task #22 estimates this conservatively).

### 7.4 The trust protocol is well-designed but has no observability and no completion path

The trust protocol is the most architecturally interesting work in the system. The `record_provenance` field, the `render_record_confirmation` tool, the "Suggest, don't mutate" safety rule, the data-form-hallucination framing — all of these are correct moves. The execution is half-finished:

- **System prompt teaching the protocol** lands in `system_prompt.ts` (the agent confirmed the section exists at lines 304-371).
- **Eval cases for the protocol** are written but the runner doesn't support cross-turn branching, so the "user confirms vs. denies" branches can't be properly tested.
- **No telemetry hook** on whether the user confirmed or updated. The protocol's whole point is calibrating data-form-hallucination rate; that signal is invisible.
- **The `confirmedHealthyAt` confirm path doesn't update `confidence`**, so "user just confirmed in chat 2 days ago" is indistinguishable from "user did onboarding 6 months ago" in the next turn's reasoning. The protocol can re-prompt the same user about the same record on a new conversation.
- **The trust protocol is built on top of unreliable underlying data** — the slug-drift in `maintenance_pipeline.ts:519-524` silently breaks anchor-date interval calculation, which means the `due_soon`/`overdue` flags Oto reads via `record_provenance` reasoning are themselves unreliable. The trust protocol is half-built on top of half-broken data. (Section 6, finding 8.2-8.3)

### 7.5 The eval suite is "tested" not "trusted"

31 cases is a meaningful corpus for an LLM-driven multi-turn agent. The case set covers the right behavior families. The bulk-runner + analyzer was the right move. **But:**

- Every case runs once. Pass rate vs. pass-on-this-roll-of-dice are indistinguishable. (Section 5 §2.6)
- The runner cannot assert tool input shape, render envelope content, tool-call ordering, or per-iteration branching. A meaningful fraction of system behavior lives in exactly these gaps. (Section 5 §1.5)
- The bulk-runner lives in browser console memory only — no persistence, no history, no CI. (Section 5 §3.4)
- Production telemetry is captured but not aggregated; no dashboards exist. (Section 5 §4.2; Section 6 §7 Observability score 40)
- The eval cases themselves contain at least 3 brittle banned-phrasings (`"is the right"`, `"thermostat"`, `"checking the database"`) that will produce false positives. (Section 5 §2.4)

A single Node script wrapper around `runEval` that dumps results to JSON, commits a baseline, and diffs run-over-run would unlock 80% of the missing eval rigor. Estimated 1 day of work. (Section 5 §5 recommendation 4)

### 7.6 Documentation is in worse shape than the code

The code has accumulated technical debt but is mostly self-consistent within its layers. The docs have accumulated **canonical-artifact debt** that propagates incorrect references across every handoff:

- The Twelve Locked Principles are cited 20+ times across handoffs and **do not exist as an enumerated artifact anywhere.** Six of twelve are uncited in any doc. (Section 4 §"The Twelve Locked Principles")
- The Five Locked Decisions are cited as "Five (A/B/C/D)" in the README but the engine inventory has only four. There is no Decision E. (Section 4 §"The Five Locked Decisions")
- The Cached System Prompt v0.md is a v0.6 fossil with a v0.9 changelog stapled on. Anyone trusting it will trust six-version-stale rules. (Section 4 §"Oto_AI_Cached_System_Prompt_v0.md")
- Diagnostic enum drift has been listed as "still pending" in every handoff for 8 months. (Section 4 §"Cross-doc inconsistencies")
- The trust protocol introduces four new design artifacts (`render_record_confirmation`, `record_provenance` field, "Suggest don't mutate" principle, data-form-hallucination term) — none are in any canonical inventory. (Section 4 §"The trust protocol design")

The fix here is bounded — three documents need explicit re-canonicalization (engine-inventory needs the Locked Principles list; the cached-system-prompt file needs to either resync or become a redirect; tool-inventory needs the trust protocol additions) — and would close ~80% of the doc debt. **Estimated 4 hours of focused doc work**.

### 7.7 The integration matrix is a vertical slice, not a platform

This is the one finding that's structural rather than fixable. Oto AI today integrates with 7 of ~20 OtoPair surfaces — booking flow, vehicle health, vehicle facts catalog, mechanics (read), service catalog, maintenance records, and (now) the trust-protocol confirmation flow. It is **not** integrated with onboarding, quarterly check-in, notifications, reviews, rewards, mechanic-side workflows, billing, payments-beyond-handoff, service-record uploads, image analysis, voice mode, or real-time vehicle data (Smartcar deprecated, no replacement).

That's a 35% surface coverage. By traffic weight (the integrated surfaces are the highest-traffic) it's closer to 55%. By "feels-like-a-complete-AI-product" it's about 30% — there are big swaths of OtoPair the user can't talk to Oto about.

**The strategic choice in front of you:** ship v1 on the booking-flow vertical (close the render gaps, ship trust protocol fully, calibrate Sonnet on TestFlight, add observability) and treat the rest of the integration matrix as v2 work — **or** delay v1 to broaden coverage and risk losing the cohesion the existing slice has. The right answer for most products is the former. The current TODO list is structured for the former; honor that.

### 7.8 Three positive patterns worth preserving

Not everything is a finding. Three patterns are doing real work and should be protected from "improvement":

1. **The render-trigger architecture.** Oto names intent, frontend pulls data, frontend owns mutations. Decision D ("IDs come from `<conversation_state>`, NEVER from user text"). The "Suggest don't mutate" principle. These three are the same architectural rule applied at three layers — and they're correct. Future engineers will be tempted to "just add a quick `set_user_phone` tool"; the current system explicitly resists this. Preserve the principle.

2. **The eval-grounded prompt iteration discipline.** Locked Principle #8 (cited but unenumerated) is something like "never debate a prompt change based on vibes — only against the eval." This has produced visibly tight prompt rules with concrete banned phrasings, contrastive examples, and self-aware acknowledgments where rules fight model defaults (e.g. the pricing rule that "overrides any prior training-derived instinct to be helpful by estimating"). This is unusual rigor. Don't lose it as the team grows.

3. **The flywheel design.** Per-user web_search call → record_vehicle_fact → next user gets the cached answer for free. Combined with cross-vehicle propagation (chassis/engine axis sharing), this is a real moat. The propagation code doesn't exist yet (Section 3, finding 8) but the schema supports it. When the propagation lands, the cost-per-question curve drops sharply with traffic. This is a genuine architectural advantage.

---

## Section 8 — Prioritized Recommendations

Ranked by leverage (impact ÷ effort), then by launch criticality.

### Tier 1 — Pre-launch must-fix (estimated 5-7 working days total)

| # | Task | Effort | Impact | Notes |
|---|---|---|---|---|
| **1** | **Build the three missing mobile renderers** (`<AIShopCarousel>`, `<AITimeSelector>`, `<AIBookingConfirmation>`) | 1-1.5 days | **Critical** | Closes the booking flow on real devices. The single biggest gap between "demos in harness" and "ships." Already tracked as Task #22. |
| **2** | **Auth pass on `ai_conversations.ts`, `ai_messages.ts`, `maintenance.ts`, `telemetry.ts`, `vehicleFactsKB.patchEmbedding`** | 1 day | **Critical** | Fix `ai_messages.list` immediately (security incident in waiting). Add `requireAuthedUser(ctx)` helper. Convert intended-internal mutations to `internalMutation`. |
| **3** | **Fix Sonnet cascade telemetry** (`chat.ts:628, :835` use `MODEL` not `turnModel`) | 30 min | **High** | The metric that exists to calibrate cascade cost is wrong. Trivial fix. |
| **4** | **Enumerate the Twelve Locked Principles** in `oto-engine-inventory.md` | 4 hours | **High** | Every reference is a dangling pointer. Fix once, ends an entire class of doc debt. |
| **5** | **Resolve `Oto_AI_Cached_System_Prompt_v0.md`** — either resync byte-for-byte or replace body with redirect to `system_prompt.ts` | 1 hour | **High** | Stop misleading future readers. |
| **6** | **Either wire `render_support_form` or remove the prompt section entirely** | 1-2 hours | **High** | Capability honesty violation. The prompt promises a tool that doesn't exist; Haiku will narrate non-existent behavior. |
| **7** | **Lock schema unions where readers depend on them** — `maintenance_records.confidence`, `ai_conversations.current_model`, `oto_telemetry.{model,final_branch,system_prompt_version}`, `ai_messages.role` | 2-3 hours | **High** | Drift-prevention. |
| **8** | **Slug-drift remediation** for `maintenance_pipeline.ts`, `bookings.ts`, `job_actuals.ts`, `packageRules.ts` per `slug-drift-remediation.md` | 4-6 hours | **High** | Silent data-quality bug feeding Oto's reasoning. Trust protocol is built on top of this. |

### Tier 2 — Post-launch first-month (estimated 5-8 working days)

| # | Task | Effort | Impact | Notes |
|---|---|---|---|---|
| **9** | **Promote `__runBulk` into the harness UI + add per-case repeats with pass-rate thresholds** | 1 day | **High** | Closes the "deterministic test on a probabilistic system" gap. |
| **10** | **Build observability dashboards over `oto_telemetry`** (Task #15) | 1-2 days | **High** | Production signal is currently invisible. Convex dashboard + a simple aggregation page. |
| **11** | **Wire `pickerServices` and `pickerPreSelectedId` into `<AIServicePicker>`** | 2-4 hours | **Medium** | The AI's pre-selection contract isn't honored today. Half-fix of bug #21. |
| **12** | **Send `attachedImages` to the backend** + add image reasoning tool | 1-2 days | **Medium** | The entire attachment feature is local theater today. |
| **13** | **Fix `lookupVehicleSpec` to use the existing `models.by_make_id` and `vehicle_configs.by_model_id` indexes** | 2-4 hours | **Medium** | Will time out as catalog grows. Indexes already exist; just use them. |
| **14** | **Add tool-input assertions to the eval runner** (`tool_input_includes` shape) | 2-3 hours | **Medium** | Eight existing cases would tighten meaningfully. |
| **15** | **Establish_facts schema upgrade** — typed sub-arrays for IDs vs. prose | 1 day | **Medium** | Race condition between Haiku replace + frontend append documented but not fixed. |
| **16** | **Cross-turn branching in eval runner** | 1-2 days | **Medium** | Required to actually validate the trust protocol's deny path. |

### Tier 3 — Post-launch first-quarter (estimated 10-15 working days)

| # | Task | Effort | Impact | Notes |
|---|---|---|---|---|
| **17** | **Implement KB topic normalization + dedupe + retraction** | 2-3 days | **Medium** | KB will fragment as soon as Haiku writes the same concept under different topic strings. Harden before it accumulates. |
| **18** | **Implement cross-vehicle KB propagation** (the `propagated` source enum currently has no propagation job) | 3-4 days | **High strategic** | This is the moat. The schema supports it; the code doesn't. |
| **19** | **Cap counter** (Task #16) | 2-3 days | **High** | Pre-launch lock per founder direction; landing it pre-launch is safer. |
| **20** | **Streaming responses** (Task #13, deferred to Phase 2) | 2-3 days | **Medium** | Per founder direction, deferred. Listed here for tracking. |
| **21** | **Replace `useVoiceRecording` mock with real implementation** OR hide the mic button | 1 day mock-removal / 3-5 days real impl | **Medium** | Current state ships broken UX. |
| **22** | **Multi-vehicle account testing** + fix any bugs surfaced | 1-2 days | **Medium** | Untested in any handoff. |

### Tier 4 — Refactors and cleanups (whenever)

| # | Task | Effort | Impact | Notes |
|---|---|---|---|---|
| **23** | Migrate `vehicle_facts` KB to `@convex-dev/rag` (Task #18) | 3-4 days | **Low** | Cleanup; doesn't change behavior. |
| **24** | Eliminate duplicate type definitions across `services/ai/types.ts` and components | 2-3 hours | **Low** | DRY win; not visible to users. |
| **25** | Delete dead components (`AISuggestionTile`, possibly `AISources`, `getSourcesForScenario`) | 1-2 hours | **Low** | Reduce surface area to maintain. |
| **26** | Add an error boundary around the chat tree | 1-2 hours | **Low** | A crash in `<AIMessageBubble>` for a malformed message takes the whole screen down today. |
| **27** | `requireAuthedUser(ctx)` helper + audit pass for adoption | 4 hours | **Low** | Already covered in Tier 1 #2 but worth a follow-up audit. |

### What NOT to prioritize

The agent audits surfaced a handful of things that look fixable but probably shouldn't be touched pre-launch:

- **The two divergent health-score formulas** (Section 3, finding 12 — pipeline vs. `utils/healthScore.ts`). Reconciling them is risky because they're calibrated against different data and the AI/UI parity comment explicitly preserves both. **Don't touch.** Document the divergence and revisit when there's hard data showing user confusion.
- **Refactoring `ai-chat/index.tsx`** (the 1,700-line orchestration file). It's accumulated three eras of code. Untangling it pre-launch is a 1-week project with high regression risk for a maintainability win. Land the renderers first, refactor v1.1.
- **The `record_vehicle_fact` mandatory-after-every-factual-answer rule.** Tempting to make it conditional. Don't — the flywheel design depends on universal recording, even at low embeddings-off content.
- **The legacy rule-engine code in `services/ai/scenarios.ts`.** Preserved verbatim for "instant flip-back." Don't delete pre-launch — it's the rollback path.

---

## Closing observation

Oto AI is a more thoughtful piece of engineering than its surface area implies. The system prompt is unusually disciplined — banned phrasings as concrete strings, mood-adaptive shaping, contrastive examples, founder voice rules consistently enforced. The trust protocol introduces architecturally interesting patterns ("Suggest don't mutate", `record_provenance` as a first-class trust signal, the data-form-hallucination concept). The render-trigger architecture is the right answer to "AI that booking-flows on mobile." The eval iteration discipline is real.

What's unusual about this audit is that **the gap between the quality of the prompt + design + protocols and the quality of the surrounding plumbing is wider than typical**. The auth boundary is leaky. The schema constraints are too loose. The mobile renderers don't exist for half the booking flow. The docs are six versions out of date. The Twelve Locked Principles are an unwritten oral tradition.

This is a fixable shape. Most of the gaps are well-bounded. The Tier 1 list is 5-7 days of focused work; Tier 2 is another 5-8 days; with both done, Oto AI is meaningfully launch-ready and the foundation under it stops being a leaky raft for the next wave of features.

The single highest-leverage observation: **stop landing new behavior on top of the current foundation until the Tier 1 list is done.** Every AI feature added in the next month will inherit the auth gaps, the loose schema, the missing mobile renderers. The same energy spent shoring up the foundation now will pay back 10x on every subsequent feature.
