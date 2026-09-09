# Oto AI Handoff — Section 4.5 Addendum

> Slot into Part 1 of the handoff between Section 4 ("The two-surface architecture") and Section 5 ("What Phase 1 tools look like").
> Once this is in the canonical handoff, future Claude Code sessions read it instead of rediscovering the scaffold.

---

## v0.9 Status note (read first)

The "render, don't navigate" decision below is **still load-bearing** and now extends further. v0.9 codifies:

- The 6-stage booking-flow chain (service_selection → confirmation) — each stage = ONE render tool per turn, user advances via component interaction
- Trigger-only render schemas — Oto passes IDs only for `render_shop_carousel` / `render_time_selector` / `render_booking_confirmation`; the mobile components query Convex for real mechanic data and pricing
- The `navigate_to_payment` tool is removed from `TOOL_NAMES_V1` in v0.9. **The "Confirm Booking" button on the booking_confirmation card is what triggers the mobile redirect to `/home/mechanic/{id}/payment`.** Oto's involvement ends at stage 6. There is no Oto turn for the payment hand-off.

The scaffold map below (Section 4.5.1) is still accurate as a snapshot. The `services/ai/scenarios.ts` 7-stage rule engine has been retired; the v0.9 system prompt + render-tool chain replace it. The `ChatMessage` envelope fields documented below are still the wire-level shape — but for shop / time / booking confirmation, Haiku now passes IDs only and the mobile component fills in the data via Convex queries.

For current state, see `Oto_AI_v0.9_Handoff.md`. The historical Section 4.5 body remains valuable for architectural rationale.

---

## 4.5 The existing scaffold

Phase 1 is **not greenfield**. There is a working chat in the app today, backed by a rule-based scenario engine, that already owns the full UI for the conversational booking flow. Phase 1's job is to **replace the rule engine with Claude while preserving the UI**. Map the scaffold before you draft tools.

### 4.5.1 Where the existing code lives

| Path | Purpose |
|---|---|
| `app/(main-tabs)/ai-chat/_layout.tsx` | Layout wrapper (10 lines) |
| `app/(main-tabs)/ai-chat/index.tsx` | Main chat screen (~1,510 lines) — owns conversation state, dispatches to scenario engine, renders `AIMessageBubble`s, owns the only `router.push` in the chat |
| `components/ai-chat/*.tsx` | 17 components: `AIMessageBubble`, `AIBookingCarousel`, `AIServicePicker`, `AIQuickReplies`, `AIReasoning`, `AISources`, `PromptSuggestions`, `AITypingIndicator`, etc. |
| `services/ai/types.ts` | The canonical envelope types: `ChatMessage`, `ScenarioResponse`, `ConversationStage`, `ScenarioType`, `AIMechanic`, `TimeSlot`. **Tool result shapes must mirror these.** |
| `services/ai/scenarios.ts` | The 7 scenario flows the rule engine handles today. These are the empirical coverage matrix — the new tool layer must cover them all. |
| `services/ai/scenarioEngine.ts` | The trigger-matching dispatcher being replaced |
| `convex/ai_conversations.ts`, `convex/ai_messages.ts` | Persistence layer (`ai_messages.metadata.intent_detected`, `service_suggestions`, `shop_suggestions`). Don't redesign. |

### 4.5.2 Locked architectural constraint: render, don't navigate

**The existing chat renders the full booking flow inline within the chat itself.** It does not navigate away to a separate booking screen.

`app/(main-tabs)/ai-chat/index.tsx` calls `router.push` exactly once in the entire 1,510-line file: at line 619, to `/home/mechanic/${id}/payment`. Every other booking stage — service picker, shop carousel, time selection, confirmation card — renders as components *inside `AIMessageBubble`* via fields on the `ChatMessage` envelope (`shops`, `showServicePicker`, `timeSlots`, `quickReplies`, `reasoning`, `sources`, `sections`).

**Implication for tool design:**

1. Phase 1 tools are predominantly **`render_*` tools**, not `navigate_to_*` tools. A `render_*` tool's "execution" is the dispatcher packaging the AI's args into the corresponding `ChatMessage` field — no DB call, no screen change.

2. There is **exactly one genuine navigation case** in Phase 1: the payment handoff, after the user has selected a mechanic and time slot. Model it as a single `navigate_to_payment` tool whose args match `/home/mechanic/{mechanic_id}/payment` plus the chosen service/slot for the booking action that follows.

3. **Render tool field names must mirror `ChatMessage` exactly.** If the envelope has `shops`, the render tool's output field is `shops`. Field-level parity means the dispatcher is a packager, not a translator.

4. **Granular `render_*` tools, not one mega-tool.** Separate `render_shop_carousel`, `render_service_picker`, `render_time_selector`, `render_booking_confirmation`, and `render_quick_replies` so each tool's description tells the AI *when* to use it. The AI can compose by emitting multiple `tool_use` blocks per turn — e.g. shop carousel + quick replies in the same response.

5. **Don't redesign persistence.** `ai_conversations` and `ai_messages` are wired. Read history from them, write turns to them. If you find you need a new column (e.g., for tool-call telemetry or cache-hit logging), **flag it as an open question** rather than amending the schema unilaterally.

### 4.5.3 The seven scenarios — empirical coverage matrix

The new tool layer must support all seven flows. From `services/ai/scenarios.ts`:

| Scenario | Trigger words (sample) | Stages used | Render needs |
|---|---|---|---|
| `oil_change` | "oil change", "oil", "schedule", "maintenance" | diagnosis → service_selection → shop_selection → time_selection → confirmation | service_picker, shop_carousel, time_selector, confirmation, quick_replies |
| `brake_noise` | "brake", "squeak", "grinding", "screech" | diagnosis → question → service_selection → shop_selection | reasoning, sources, service_picker, shop_carousel, quick_replies |
| `check_engine` | "check engine", "engine light", "cel" | diagnosis → question | reasoning, sources, quick_replies (often ends with diagnostic-scan suggestion) |
| `tire_pressure` | "tire", "pressure", "tpms", "flat" | diagnosis → question → service_selection → shop_selection | sources, service_picker, shop_carousel, quick_replies |
| `vague_issue` | "something wrong", "feels off", "weird", "not right" | diagnosis → question (clarifying loop) | quick_replies, sources (the polite-exit candidate per Locked Principle #5) |
| `direct_booking` | "book", "schedule", "appointment", "service" | priority_selection → shop_selection → time_selection → confirmation | shop_carousel, time_selector, confirmation, quick_replies |
| `new_vehicle` | "new vehicle", "add vehicle", "register car" | diagnosis → question → priority_selection → shop_selection → time_selection → confirmation | reasoning, sources, shop_carousel, quick_replies, confirmation |

**If a scenario needs a tool not in your inventory, that's a gap.** Flag it in Section 5 of the inventory doc — don't silently invent.

### 4.5.4 The `services` table is the source of truth

The Otopair services catalog is **already in Convex** with 23 locked entries. The **production source of truth is the live `services` table**, populated by `convex/seeds/seedServices.ts`. **Never propose new slugs.** Slugs are **snake_case**:

```
Diagnostics:         diagnostic_scan, pre_purchase_inspection, check_engine_light
Compliance:          state_inspection, emissions_test
Routine Maintenance: oil_change, filter_replacement, spark_plugs, timing_belt,
                     coolant_flush, transmission_service
Tires:               tire_rotation, tire_balance, wheel_alignment, tire_replacement
Brakes:              brake_pad_replacement, rotor_replacement, brake_fluid_flush
Battery:             battery_test, battery_replacement
Fluids:              power_steering_flush, differential_service, fuel_system_cleaning
```

**Seven categories:** Diagnostics, Compliance, Routine Maintenance, Tires, Brakes, Battery, Fluids.

> ⚠️ **Two older seed files (`convex/seed_services_catalog.ts`, `convex/seed_services.ts`) declare conflicting KEBAB-CASE slug sets. They are STALE and must not be referenced.** See `docs/oto-ai/slug-drift-remediation.md` for the audit and a list of runtime files currently broken by this drift (`bookings.ts`, `maintenance_pipeline.ts`, `job_actuals.ts`, `lib/packageRules.ts`).

#### Vehicle compatibility is a first-class capability

The services schema carries nine `requires_*` boolean filters plus `min_model_year`:

```
requires_parts, requires_fluids, requires_ice_engine, requires_timing_belt,
requires_hydraulic_ps, requires_differential, requires_rotatable_tires,
requires_state_inspection, requires_emissions_test, min_model_year
```

These mean a service can be checked for applicability to a specific vehicle (EVs get no oil change; chain-driven engines get no timing belt service; pre-OBD-II cars get no check-engine-light service; cars sold outside NY get no NY inspection).

**`list_services_for_vehicle(vehicle_id)` — returning the filtered subset, not all 23 — is the highest-value read tool in the inventory.** It eliminates an entire class of AI errors (recommending impossible services) and powers educational answers in the project voice ("your engine uses a timing chain, not a belt — that's a good thing, chains usually last the life of the engine").

#### Use the existing `description` field

Each service row has a `description` column with educational copy already authored. Pass it through in tool results so the AI can quote it; don't fold service descriptions into the cached system prompt.

#### Mild slug-form inconsistency — flag, don't fix

Production slugs mix action-form (`brake_pad_replacement`, `oil_change`, `tire_replacement`) with noun-form (`spark_plugs`, `timing_belt`, `battery_test`). Don't normalize — renaming requires migrating bookings, service intervals, and `shop_services` foreign keys. **Flag in Section 5 of the inventory doc.**

#### Missing `is_active` flag — flag, don't add

The `services` schema has no `is_active` / `is_archived` column. Either every row is always active, or one needs adding. **Surface this in open questions; do not add the column unilaterally.** It's a schema decision with backwards-compat implications.

### 4.5.5 Reasoning and sources are a free win

The existing `ChatMessage` envelope has optional `reasoning?: ReasoningStep[]` and `sources?: Source[]` fields, and `AIReasoning` / `AISources` components already render them in `AIMessageBubble`. These map cleanly onto Claude's actual capabilities — interleaved thinking blocks for `reasoning`, retrieved KB chunks (when KB exists, see Open Question 1) for `sources`. Surface them through the tool layer (as `render_reasoning` / `render_sources`, or as fields on a composition tool — your call, but flag the choice).

### 4.5.6 What to flag back rather than decide unilaterally

- Anywhere `AIMessageBubble`'s rendering logic does something the proposed tool design doesn't cleanly express (e.g., conditional rendering on multiple fields at once)
- Anywhere the rule engine produces output the tool layer can't reproduce — the rule engine is the empirical spec
- Anything in `scenarios.ts` suggesting a tool that isn't in your recommended list
- Whether the new tool layer **coexists** with the rule engine during transition (feature-flagged side-by-side) or is a **hard cutover**
- The missing `is_active` flag on `services`
- Any service whose `requires_*` filters look incomplete for the vehicles in scope (e.g., should `oil_change` carry `min_model_year`?)
- Whether `tool-call telemetry` needs a new column on `ai_messages.metadata`

### 4.5.7 Scope reframe

This section narrows Phase 1, it doesn't broaden it. Before this addendum, Claude Code was designing from first principles against a schema. Now it's designing against an existing UI contract *and* an existing services taxonomy. That's a tighter box — but also a clearer one. **There's less room for invention; the right answer is largely "match what exists."**

---

*End of Section 4.5. Resume Part 1, Section 5 with this context loaded.*
