# Oto AI — Tool Inventory

> **Status:** Living document. Current runtime: prompt v0.9. The historical v3 sections below this header are Phase 1 reference material; the **v0.9 Current Tools** section immediately below is the authoritative inventory.
> **Companion artifacts:** `convex/oto/tools.ts` (schemas, source-of-truth), `convex/oto/chat.ts` (TOOL_NAMES_V1 — wired set), `convex/oto/dispatcher.ts` (category dispatch), `docs/oto-ai/Oto_AI_v0.9_Handoff.md` (latest session handoff).

---

## v0.9 Current Tools (authoritative — supersedes v3 section below)

Five categories. Source-of-truth: `convex/oto/tools.ts` schemas + `convex/oto/chat.ts` TOOL_NAMES_V1.

### Data tools (read-only, dispatched by `executeDataTool`)

| Tool | Purpose | Backed by |
|---|---|---|
| `list_services_for_vehicle` | Service catalog applicable to user's vehicle (compatibility filtering deferred) | `convex/services.ts:list` |
| `get_service_details` | One service by snake_case slug | `convex/services.ts:list` + slug validation |
| `get_vehicle_health` | Score + per-item maintenance breakdown + warning lights for the user's car | `convex/oto/vehicleHealth.ts:getVehicleHealth` |
| `get_projected_health_score` | Counterfactual score if one item flipped to on-time (conversion lever) | `convex/oto/vehicleHealth.ts:getProjectedHealthScore` |
| `get_bookings` | User's bookings, filter by status (active/completed/all), limit | `convex/oto/bookings.ts:getBookings` |
| `get_due_services` | Overdue + due-soon services for the user's car | `convex/oto/dueServices.ts:getDueServices` |
| `get_vehicle_facts` | Engine / transmission / drivetrain / tire / fluid specs for the user's car | `convex/oto/vehicleFacts.ts:getVehicleFacts` |
| `lookup_vehicle_spec` | Comparison-car factual lookup against the catalog (any car, not just user's). Word-boundary fuzzy match. | `convex/oto/lookupVehicleSpec.ts:lookupVehicleSpec` |
| `retrieve_vehicle_facts` | KB search (semantic if embedding API key set, else structural fallback by config / chassis / engine) | `convex/oto/vehicleFactsKB.ts:lookupFactsStructural` + `lookupFactsSemantic` |

### State tools (side-effect writes; don't gate loop continuation)

| Tool | Purpose | Backed by |
|---|---|---|
| `update_conversation_state` | Haiku writes mood / arc / established_facts / last_intent on every turn — read back in next turn's envelope | `convex/ai_conversations.ts:updateState` |
| `record_vehicle_fact` | Persist a factual statement to the KB (mandatory after every factual answer) | `convex/oto/vehicleFactsKB.ts:recordFact` |

### Model-routing tools (Sonnet cascade, Phase 2 scaffolding)

| Tool | Purpose | Backed by |
|---|---|---|
| `request_sonnet_handoff` | Haiku escalates the NEXT turn to Sonnet — sets `ai_conversations.current_model = "sonnet"` | `convex/ai_conversations.ts:setCurrentModel` |
| `request_haiku_handback` | Sonnet returns routing to Haiku at default cost | same |

### Render tools (terminal — calling one ends Oto's turn)

| Tool | What it triggers | Input shape | Notes |
|---|---|---|---|
| `render_quick_replies` | Tap-to-send buttons | `replies: [{id, text, value?, variant?}]` | 2–4 replies; tap sends as user message |
| `render_diagnostic_form` | Diagnostic booking subsystem + customer notes | `diagnostic_system` (enum) + `customer_notes` (free-form) | Decision B mapping; Decision C free-form |
| `render_service_picker` | Service catalog with one service highlighted | `pre_selected_id` + optional `services[]` (no price field) | First stage of booking flow |
| `render_shop_carousel` | **Trigger-only** — Oto passes intent IDs, frontend renders mechanics | `service_slug` + `priority` ONLY | Mobile component queries Convex for mechanics + their prices |
| `render_time_selector` | **Trigger-only** — slot picker for the selected mechanic | `mechanic_id` + `service_slug` ONLY | Mobile component queries Convex for slots |
| `render_booking_confirmation` | **Trigger-only** — final summary | `service_slug` + `mechanic_id` + `slot_id` + `vehicle_id` ONLY | Mobile component queries Convex for real pricing. **End of Oto's involvement in the booking flow** — "Confirm Booking" button on the card triggers mobile redirect to `/home/mechanic/{id}/payment` |

### Server-managed tools (Anthropic-provided, not in OTO_TOOL_CATEGORY)

| Tool | Purpose | Notes |
|---|---|---|
| `web_search` | Last-resort factual lookup when KB + catalog both miss | Anthropic `web_search_20250305` tool, `anthropic-beta` header required. Policy gates: no pricing, recalls (use NHTSA), financing, legal. After answering, MUST call `record_vehicle_fact` with `source: "web_search"` and `cited_url`. |

### Tools defined in schema but NOT in `TOOL_NAMES_V1` (advertised-but-unwired — invariant check tolerates)

- `get_my_vehicles`, `list_service_categories`, `get_shop`, `get_shop_services`, `get_shop_hours`, `get_mechanic`, `get_my_mechanics`, `get_reviews`, `find_available_slots`, `get_rewards_summary` — defined in `tools.ts` for future wiring. Most have backing queries in `convex/shops.ts` / `convex/mechanics.ts` / `convex/bookings.ts` but aren't surfaced to Haiku because the trigger-only render-tool architecture doesn't need Oto to compose this data.
- `navigate_to_payment` — explicitly removed from `TOOL_NAMES_V1` in v0.9. Oto's involvement ends at `render_booking_confirmation`; the mobile component handles the payment redirect.
- `render_shop_carousel` legacy schema with full shop arrays — **deprecated.** v0.9 schema is trigger-only.
- `render_support_form`, `render_reasoning`, `render_sources` — schemas defined but not in TOOL_NAMES_V1. Not currently used.

### Booking flow chain (6 stages — see `services/ai/scenarios.ts` + `Oto_AI_v0.9_Handoff.md`)

```
1. service_selection      → render_service_picker (pre_selected_id)
2. diagnostic_form        → render_diagnostic_form (skip for non-diagnostic services)
3. priority_selection     → render_quick_replies (Closest / Best rated / Best price)
4. shop_selection         → render_shop_carousel (TRIGGER)
5. time_selection         → render_time_selector (TRIGGER)
6. confirmation           → render_booking_confirmation (TRIGGER, then frontend redirects to payment)
```

Each stage = one render per turn. User advances via component interaction; mobile frontend pushes selected IDs into `ai_conversations.established_facts` via `appendEstablishedFact` mutation BEFORE the user's natural-language confirmation message reaches Haiku. The next turn's envelope replays those IDs in `<conversation_state>`.

### Pricing rule (v0.9 — load-bearing)

Oto **never** composes, quotes, or estimates prices. Anywhere. The mobile components query Convex for real mechanic quotes when rendering. The `render_service_picker` schema has no `price` field. The trigger-only carousel/selector/confirmation pass IDs only — components own pricing display.

### Cap counter (deferred to finalization per founder direction)

Vision-doc 5/25/150 monthly question budget. Schema field + envelope budget + prompt cap-template all unbuilt. Picked up at launch prep.

---

## Historical reference — v3 Phase 1 spec (pre-runtime)

> **Status:** Phase 1 scaffold — read-only data tools + inline render directives + one navigation case.
> **Companion artifacts:** `convex/oto/tools.ts` (schemas), `convex/oto/dispatcher.ts` (dispatcher skeleton), `docs/oto-ai/handoff-addendum.md` (locked Section 4.5), `docs/oto-ai/slug-drift-remediation.md` (parking-lot for kebab→snake cleanup).
> **v3 supersedes v2** — reconciled against the production `services` table CSV on 2026-05-11; v2's slug list was kebab-case from a stale seed.

---

## The architectural reframe (read this first)

**The existing scaffold renders the full booking flow inline within the chat. The tool layer therefore emits render directives matching the existing `ChatMessage` / `ScenarioResponse` envelope, not navigation intents to external screens. The only genuine navigation is the handoff to `/home/mechanic/${id}/payment`.**

That single sentence is the load-bearing decision behind every other choice in this document. If a future engineer is tempted to add `navigate_to_booking` or `navigate_to_shop_detail`, this is why we won't: the chat already *is* those screens.

---

## The services-taxonomy reframe (also read first)

**Production Convex is the single source of truth for the `services` table.** The live seed is `convex/seeds/seedServices.ts`. Slugs are **snake_case**. There are **23 services** in **7 categories** (`Diagnostics`, `Compliance`, `Routine Maintenance`, `Tires`, `Brakes`, `Battery`, `Fluids`).

Two older seed files (`convex/seed_services_catalog.ts`, `convex/seed_services.ts`) declare conflicting kebab-case slug sets and **must not be referenced.** Their continued existence is a hazard — both are flagged in `slug-drift-remediation.md` for deletion when the next cleanup pass happens. Several live runtime files also reference the stale kebab slugs and currently fail silently; those are documented in the same remediation doc but are **explicitly out of scope for this session.**

### Canonical slug list (production, 2026-05-11)

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

Mirrored in `convex/oto/tools.ts` as `OTOPAIR_SERVICE_SLUGS` (an `as const` literal) for compile-time validation.

### Notable per-service constraints (drive `list_services_for_vehicle` filtering)

| Slug | `requires_*` flags that exclude vehicles | `min_model_year` |
|---|---|---|
| `diagnostic_scan` | — | 1996 (OBD-II) |
| `check_engine_light` | — | 1996 (OBD-II) |
| `oil_change` | `requires_ice_engine` (excludes EVs) | — |
| `emissions_test` | `requires_ice_engine`, `requires_emissions_test` (state-dependent) | — |
| `state_inspection` | `requires_state_inspection` (state-dependent) | — |
| `spark_plugs` | `requires_ice_engine` (excludes EVs) | — |
| `timing_belt` | `requires_timing_belt` (excludes chain-driven engines) | — |
| `power_steering_flush` | `requires_hydraulic_ps` (excludes electric PS) | — |
| `differential_service` | `requires_differential` (excludes FWD without diff) | — |
| `tire_rotation` | `requires_rotatable_tires` (excludes staggered / directional) | — |
| `filter_replacement` | — | — |
| All others | — (parts/fluids requirements are not exclusion filters) | — |

Two more flags exist on the schema that are not exclusion filters: `requires_parts: boolean` (does the service need OEM parts looked up?) and `requires_fluids: boolean` (does it consume fluid?). These drive parts-suggestion logic, not vehicle compatibility — Oto AI uses them informationally if at all.

---

## 1. Scaffold audit — what's already wired

Phase 1 is not greenfield. The codebase already has:

| Surface | Where | What it does today |
|---|---|---|
| Chat screen | `app/(main-tabs)/ai-chat/index.tsx` (1,510 lines) | Owns conversation state, dispatches to rule-based `scenarioEngine`, renders message bubbles, holds the only `router.push` |
| Message renderer | `components/ai-chat/AIMessageBubble.tsx` | Renders `content`, `reasoning`, `sources`, `quickReplies`, `sections`, plus image attachments. Drives inline UIs from envelope fields. |
| Inline UIs | `components/ai-chat/AIBookingCarousel.tsx`, `AIServicePicker.tsx`, `AIQuickReplies.tsx`, `AIReasoning.tsx`, `AISources.tsx`, `PromptSuggestions.tsx`, `AIContextBar.tsx`, `AIGreeting.tsx`, `AIWelcomeScreen.tsx`, … (17 total) | The chat UIs already exist for shop carousels, service pickers, time selection, reasoning/sources display, quick-reply buttons, and greeting/prompt scaffolding. |
| Conversation envelope | `services/ai/types.ts` — `ChatMessage`, `ScenarioResponse`, `AIMechanic`, `TimeSlot`, `MessageSection` | The exact field names tool results must mirror. |
| Rule engine | `services/ai/scenarios.ts` (756 lines), `scenarioEngine.ts` (540 lines) | 7 hard-coded scenarios — the empirical spec the LLM must reproduce |
| Persistence | `convex/ai_conversations.ts`, `convex/ai_messages.ts` | Existing tables with `metadata.intent_detected`, `service_suggestions`, `shop_suggestions` columns — already wired |
| Services taxonomy | `convex/seeds/seedServices.ts` + `services` table (production) | 23 snake_case services in 7 categories; 9 `requires_*` filters + `min_model_year` for vehicle compatibility. **Live seed only — see `slug-drift-remediation.md` for the two stale seeds.** |
| Only true navigation | `app/(main-tabs)/ai-chat/index.tsx:619` | `router.push('/home/mechanic/${id}/payment')` — the single place the chat leaves itself |

### Mapping from `ChatMessage` envelope to render tools

| `ChatMessage` field | Render tool | Notes |
|---|---|---|
| `shops?: AIShop[]` | `render_shop_carousel` | Drives `AIBookingCarousel` |
| `showServicePicker?: boolean` | `render_service_picker` | Drives `AIServicePicker` (default-services or filtered) |
| `quickReplies?: QuickReply[]` | `render_quick_replies` | Drives `AIQuickReplies` |
| `reasoning?: ReasoningStep[]` | `render_reasoning` | Drives `AIReasoning` |
| `sources?: Source[]` | `render_sources` | Drives `AISources` |
| `sections?: MessageSection[]` | (deferred — see §3) | `AIMessageBubble` renders these but the rule engine rarely emits them |
| `images?: string[]` | (not a render tool — user-input only) | Image attachments come from the user, not the AI |
| `content: string` | (prose — the AI's `text` content block) | Not a tool |

Two render needs the envelope doesn't carry today:

| Conceptual need | Where today | Proposal |
|---|---|---|
| Time-slot list per shop | `ScenarioResponse.timeSlots?` (in types but rarely set as a field; usually folded into prose) | Add `render_time_selector` tool — emits a list the chat handler renders below the shop card or in a step card |
| Booking summary card | `BookingSummary` (a separate type, not a `ChatMessage` field) | Add `render_booking_confirmation` tool — emits the summary the chat renders before payment |

---

## 2. The seven scenarios — coverage matrix

Each scenario in `services/ai/scenarios.ts` must be reproducible end-to-end with the tools in §3. Slug references below are production snake_case.

| Scenario | Read tools needed | Render tools needed | Navigation |
|---|---|---|---|
| `oil_change` (slugs: `oil_change`, `filter_replacement`) | `list_services_for_vehicle`, `get_service_details`, `get_shop`, `find_available_slots` | `render_service_picker`, `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation`, `render_quick_replies` | `navigate_to_payment` |
| `brake_noise` (slugs: `brake_pad_replacement`, `rotor_replacement`, `brake_fluid_flush`) | `list_services_for_vehicle`, `get_service_details`, `get_shop`, `find_available_slots` | `render_reasoning`, `render_sources`, `render_service_picker`, `render_shop_carousel`, `render_quick_replies` | `navigate_to_payment` |
| `check_engine` (slugs: `check_engine_light`, `diagnostic_scan`) | `get_service_details`, `get_shop`, `find_available_slots` | `render_reasoning`, `render_sources`, `render_quick_replies`, `render_shop_carousel` | `navigate_to_payment` (often via polite-exit to `diagnostic_scan`) |
| `tire_pressure` (slugs: `tire_rotation`, `tire_balance`, `tire_replacement`, `wheel_alignment`) | `list_services_for_vehicle`, `get_service_details`, `get_shop` | `render_sources`, `render_service_picker`, `render_shop_carousel`, `render_quick_replies` | `navigate_to_payment` (if escalation to replacement) |
| `vague_issue` (slug: `diagnostic_scan` for the polite-exit) | `get_due_services`, `get_service_details` | `render_quick_replies`, `render_sources` | `navigate_to_payment` only if user accepts the diagnostic-scan polite-exit |
| `direct_booking` (any slug) | `get_my_vehicles`, `list_services_for_vehicle`, `find_available_slots` | `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation`, `render_quick_replies` | `navigate_to_payment` |
| `new_vehicle` (slug: `pre_purchase_inspection`) | `get_my_vehicles`, `get_shop`, `find_available_slots` | `render_reasoning`, `render_sources`, `render_shop_carousel`, `render_quick_replies`, `render_booking_confirmation` | `navigate_to_payment` |

**Observation:** the `new_vehicle` scenario in the rule engine doesn't open the add-vehicle screen — it routes the user to a mechanic for inspection. Production now has a dedicated `pre_purchase_inspection` slug (1.75 default labor hours, no `min_model_year`, no `requires_*` filters) which is the natural match for that flow. The v2 inventory recommended a kebab `general-diagnostic`; production replaces that with `diagnostic_scan` (more specific) + `pre_purchase_inspection` (covers the new-vehicle case). Coverage matrix updated accordingly.

---

## 3. Recommended tools

Ordered by category. Each row is one tool.

### 3.1 Data tools (read-only Convex queries)

| # | Name | Purpose | Mapped Convex | Args | Returns | Priority |
|---|---|---|---|---|---|---|
| 1 | `get_my_vehicles` | List user's vehicles; pick the `is_primary` one as active | `vehicles.getMyVehicles` (auth-native) | none | `[{ vin, year, make, model, trim, mileage, is_primary }]` | must |
| 2 | `get_bookings` | Filter by status — active/completed/all | `bookings.getByUserIdWithDetails` | `status_filter`, `limit?` | `[{ id, status, service_names, shop_name, mechanic_name, scheduled_at, vehicle_display, total_cost? }]` | must |
| 3 | `get_due_services` | Computed urgency per service for a vehicle (overdue/due_soon/ok) | **NEW QUERY** on `vehicle_service_states` (Gap 1) | `vehicle_id` | `[{ service_slug, service_name, urgency, due_at_mileage?, due_at_date?, quick_read_flag? }]` | must |
| 4 | `list_service_categories` | The 7 Otopair categories with display order/icon | `service_categories.list` | none | `[{ id, name, icon_name, display_order }]` | nice |
| 5 | **`list_services_for_vehicle`** | **Headline tool.** Services the catalog supports *for this vehicle*, after applying `requires_*` and `min_model_year` filters. Returns each with description, default labor hours, parts band. | **NEW QUERY** joining `services` × `engines` × `vehicle_configs` × `chassis_specs` for the vehicle's VIN (Gap 4) | `vehicle_id`, `category?` | `[{ slug, name, description, category, default_labor_hours, parts_low?, parts_high?, has_options }]` | must |
| 6 | `get_service_details` | Full record for one service by snake_case slug | `services.list` filtered by slug, or new `services.getBySlug` | `service_slug` | `{ slug, name, description, category, default_labor_hours, has_options, parts_low?, parts_high?, options[] }` | must |
| 7 | `get_shop` | Shop name, address, neighborhood, rating | `shops.getById` | `shop_id` | `{ id, name, address, neighborhood, lat, lng, avg_rating, review_count }` (strips stripe/labor_rate/email/owner) | must |
| 8 | `get_shop_services` | Which services a shop offers | `shop_services.getByShopId` | `shop_id` | `[{ service_slug, service_name, is_offered }]` | must |
| 9 | `get_shop_hours` | 7-day operating hours | **NEW QUERY** `shops_hours.getByShopId` (Gap 2) | `shop_id` | `[{ day_of_week, opens_at, closes_at, is_closed }]` | must |
| 10 | `get_mechanic` | Mechanic profile | `mechanics.getById` | `mechanic_id` | `{ id, name, photo_url, shop_id, shop_name, avg_rating, review_count }` (strips email) | must |
| 11 | `get_my_mechanics` | Favorites + recently booked | `mechanics.getMyMechanicsForUser` | none | `{ favorites[], recently_booked[], hidden[] }` | nice |
| 12 | `get_reviews` | Reviews for a shop or mechanic, reviewer PII stripped | `reviews.getByShopId` / `getByMechanicId` | `target_type`, `target_id`, `limit?` | `[{ rating, comment, created_at, reviewer_initials }]` | must |
| 13 | `find_available_slots` | Next bookable slots at a shop | `time_slots.getNextAvailableByShop` | `shop_id`, `mechanic_id?`, `limit?` | `[{ slot_id, date, start_time, mechanic_id?, mechanic_name? }]` | must |
| 14 | `get_rewards_summary` | Wallet + membership stats + tier in one call | merges `rewards.getWallet` + `getMembershipStats` + `getPrimaryVehicleTier` | none | `{ credit_balance, miles_safe, services_completed, shops_visited, vehicle_tier }` | nice |

### 3.2 Render tools (no DB call — dispatcher packages into `ChatMessage` field)

| # | Name | `ChatMessage` field set | Args | Used by scenarios | Priority |
|---|---|---|---|---|---|
| 15 | `render_shop_carousel` | `shops` | `shops: AIShop[]` (≤ 5) | oil_change, brake_noise, tire_pressure, direct_booking, new_vehicle, check_engine | must |
| 16 | `render_service_picker` | `showServicePicker: true` (+ optional filter list) | `services?: { slug, name, description, price, duration, category }[]` | oil_change, brake_noise, tire_pressure | must |
| 17 | `render_time_selector` | `timeSlots` (extends envelope — see Gap 6) | `shop_id`, `slots: TimeSlot[]` | oil_change, direct_booking, new_vehicle | must |
| 18 | `render_booking_confirmation` | New `bookingSummary` field on envelope (Gap 7) | `summary: BookingSummary` | oil_change, direct_booking, new_vehicle | must |
| 19 | `render_quick_replies` | `quickReplies` | `replies: { id, text, value?, variant? }[]` | all 7 scenarios | must |
| 20 | `render_reasoning` | `reasoning` | `steps: ReasoningStep[]` | brake_noise, check_engine, new_vehicle | nice |
| 21 | `render_sources` | `sources` | `sources: Source[]` | brake_noise, check_engine, tire_pressure, vague_issue | nice |

### 3.3 Navigation tools

| # | Name | Target | Args | Priority |
|---|---|---|---|---|
| 22 | `navigate_to_payment` | `/home/mechanic/{mechanic_id}/payment` | `mechanic_id`, `service_slug` (snake_case), `slot_id`, `vehicle_id` | must |

**Total: 14 data + 7 render + 1 navigation = 22 tools.** Trimming the four "nice" data tools + the two "nice" render tools brings the must-have set to 16. Decide per Open Question 8.

### 3.4 Picker-category mapping note

The client-side `AIServicePicker` (`components/ai-chat/AIServicePicker.tsx:66-71`) has only 4 tabs: `maintenance`, `tires`, `brakes`, `diagnostics`. Production has 7 categories. The dispatcher maps production categories to picker keys when packaging `render_service_picker.services`:

| Production category | Picker key |
|---|---|
| Routine Maintenance | `maintenance` |
| Fluids | `maintenance` |
| Battery | `maintenance` |
| Tires | `tires` |
| Brakes | `brakes` |
| Diagnostics | `diagnostics` |
| Compliance | `diagnostics` |

Decide per Open Question Q12 whether to expand the picker to 7 tabs, leave the mapping in the dispatcher, or split into a different UI affordance for compliance-style services.

---

## 4. Considered and rejected

| Considered | Why rejected |
|---|---|
| `navigate_to_booking` (v1's recommendation) | Wrong mental model. The chat *is* the booking screen — there's nowhere to navigate to until payment. Replaced by inline `render_*` tools. |
| `navigate_to_appointment_detail` | The chat doesn't surface a separate appointment-detail screen. If the user wants to check an active booking, the answer is in `get_bookings` data plus `render_quick_replies` for follow-ups. |
| `navigate_to_vehicle_onboarding` | The `new_vehicle` scenario in `scenarios.ts` routes the user to a mechanic for `pre_purchase_inspection` — not to an add-vehicle screen. |
| `book_appointment` (mutation) | Phase 1 is read-only. Booking happens at the `/home/mechanic/{id}/payment` screen. |
| `update_vehicle_mileage` / `add_vehicle` | Mutation, out of scope. Vehicle add is a Smartcar/VIN-entry flow that lives outside the chat. |
| `respond_with_message` (mega-tool taking the full `ChatMessage`) | Tempting because field parity is exact — but defeats the "description tells the AI when to call" principle. Granular wins even at the cost of more cached-zone tokens. |
| `render_sections` | `MessageSection` is in the envelope and `AIMessageBubble` renders them, but `scenarios.ts` rarely emits sections. Deferred. |
| `get_user_profile` (name, email, prefs) | First name lives in the uncached `<user>` block. Email/phone is PII the AI shouldn't see. |
| `get_maintenance_records` (raw user-entered service dates) | Inputs to the maintenance pipeline. `get_due_services` is the output the AI actually wants. |
| `get_vehicle_specs` | Useful but blocked on Gap 4 (`getVehicleSpecsForVin` consolidator). Defer. |
| `search_tires_for_vehicle` | `tires.searchBySize` is an external-scraping action — slow, expensive, niche. |
| `lookup_kb` / `search_knowledge_base` | No KB layer exists. Open Question 1. |
| `get_payment_history` / `get_shop_labor_rate` / `get_smartcar_status` | Sensitive or non-conversational. |
| Any `director_*` query | Admin-only, out of scope. |
| **Kebab-case slugs in any tool result, schema, or description** | Production is snake_case. Kebab-case is dead taxonomy — see `slug-drift-remediation.md`. |

---

## 5. Schema gaps

### Gap 1: No public query for `vehicle_service_states`

`vehicle_service_states` is only read via `internalQuery`. Needs a public `getByVehicleOwner` (or `getByVin`-with-auth-scoping) so `get_due_services` has a backend. Output rows must carry snake_case `service_slug`.

### Gap 2: No `shops_hours.getByShopId`

`shops_hours.list` returns every day for every shop. Add a `shop_id`-scoped query.

### Gap 3: No regional / area pricing

Pricing is computed at booking time. **Lean: defer for v1** — the booking flow's estimate UI is more trustworthy than a chat number.

### Gap 4: No `getVehicleSpecsForVin` consolidator AND no `list_services_for_vehicle` backend

These are two halves of the same gap. The headline tool `list_services_for_vehicle` needs to:

1. Resolve `vin → vehicle_owners → vehicles → vehicle_configs → { engine_id, drivetrain, has_brake_pad_sensor, chassis_specs.steering_type, trim_specs.is_staggered, ... }`
2. Read `vehicle_owner_specs.confirmed_packages` (impacts brake/tire variants)
3. Walk the 23 `services` rows and apply each `requires_*` filter against the resolved spec set:
   - `requires_ice_engine` → exclude if `engines.fuel_type === "electric"` (kills `oil_change`, `emissions_test`, `spark_plugs` for EVs)
   - `requires_timing_belt` → exclude if `engines.timing_type === "chain"` (kills `timing_belt` for chain-driven)
   - `requires_hydraulic_ps` → exclude if `chassis_specs.steering_type === "electric"` (kills `power_steering_flush` for EPS)
   - `requires_differential` → exclude FWD without diff per `drivetrain_configs.has_differential` (kills `differential_service`)
   - `requires_rotatable_tires` → exclude staggered (`trim_specs.is_staggered === true`) or directional asymmetric tires (kills `tire_rotation`)
   - `requires_state_inspection` → state-aware (kills `state_inspection` outside applicable states — Open Q6)
   - `requires_emissions_test` → state-aware (kills `emissions_test` outside applicable states)
   - `min_model_year` → exclude if `vehicles.year < min_model_year` (kills `diagnostic_scan` and `check_engine_light` for pre-1996)
4. Return filtered list with snake_case slug, name, description (from production `services.description`), default_labor_hours, parts_cost_low/high (from `service_options` or `service_vehicle_specs` where available)

**This is the single biggest implementation cost in Phase 1.**

### Gap 5: Reviews query doesn't sanitize reviewer PII

Same as v1/v2. The dispatcher's `get_reviews` handler does the projection in this scaffold, but ideally the Convex query strips PII before returning.

### Gap 6: `ChatMessage` envelope doesn't carry `timeSlots`

`ScenarioResponse.timeSlots?` exists as a type, but the chat handler doesn't currently map it into the persisted `ChatMessage`. Options: add `timeSlots?: TimeSlot[]` to `ChatMessage`, or fold time slots into `quickReplies`. Dispatcher scaffold picks the former.

### Gap 7: No `bookingSummary` field on `ChatMessage`

The existing `BookingSummary` type lives separately. Confirmation today is rendered as prose. The new tool layer wants a structured render directive instead, which requires adding `bookingSummary?: BookingSummary` to `ChatMessage`.

### Gap 8: No `is_active` / `is_archived` column on `services`

Either every row is always active, or one needs adding. **Don't add unilaterally** — Open Question Q9.

### Gap 9: Production category count vs picker tab count

Production has 7 service categories; `AIServicePicker` has 4 tabs. Currently bridged by a static mapping in the dispatcher (see §3.4). Open Question Q12.

### Gap S1-S8: Slug drift in non-Oto-AI code

Documented separately in `docs/oto-ai/slug-drift-remediation.md`. Summary:

| File | Severity | What's broken |
|---|---|---|
| `convex/bookings.ts:2109-2116` | High | `SLUG_TO_TYPE` map uses kebab — pre-onboarding maintenance hookup is silently a no-op |
| `convex/maintenance_pipeline.ts:519-524` | High | `TYPE_TO_SLUGS` reverse map uses kebab — anchor-date interval calculation misses every modern slug |
| `convex/job_actuals.ts:134` | Medium | `if (slug === "oil-change")` never fires — Oil Filter parts suggestion dead |
| `convex/lib/packageRules.ts` | High | `KNOWN_SERVICE_SLUGS` + every `services_affected` array kebab — package-detection rules all filtered out |
| `convex/seed.ts` | Critical if run | 18 kebab refs, would corrupt prod catalog or fail demo seed |
| `convex/seed_services.ts` | Latent | Stale duplicate seed at root, 22 kebab slugs, 7 categories with different names |
| `convex/seed_services_catalog.ts` | Latent | Stale duplicate seed at root, 23 kebab slugs, 5 categories |
| `components/home/MoreServicesSection.tsx` | Low | UI labels use kebab `id`; cosmetic only |

**Out of scope for the current Oto AI session.** Park for a focused cleanup pass — see `slug-drift-remediation.md` for fix recipes, blast radius, and recommended order of operations.

---

## 6. Open questions for Waleed

In rough priority order — the first three block the dispatcher from going production.

### Q1. RAG mode — no KB layer

The brief defaults to pre-fetch RAG. No `knowledge_base` / vector index exists. Three options:

- **(a)** Build a KB table + embedding pipeline before launch (non-trivial)
- **(b)** Defer RAG; rely on training knowledge with the cached system prompt instructing the model to defer to `list_services_for_vehicle` / `get_service_details` for anything Otopair-specific
- **(c)** Hardcode 50–200 KB snippets into the cached system prompt; no retrieval

**Lean: (c) for v1.**

### Q2. `list_services_for_vehicle` ownership

This is a substantial query — join chain + 9 filter conditions + state-based exclusions. Pipeline team vs Oto AI workstream vs hybrid? **Lean: hybrid** — pipeline builds the spec-resolution helper, AI workstream builds the filter pass on top.

### Q3. Envelope extensions — `timeSlots` and `bookingSummary`

Gaps 6 and 7 want fields added to `ChatMessage`. Confirm I should add them; or fold time slots through `quickReplies` and booking-summary through `sections`.

### Q4. `get_bookings` returns `total_cost`?

Including `total_cost` lets the AI phrase "your last oil change at Bay Ridge Auto was $84." Useful but tiptoes toward payment narration. **Lean: include.**

### Q5. Pricing tool — defer or hack?

No regional pricing. **Lean: defer for v1.**

### Q6. State-based service filtering

To filter `state_inspection` / `emissions_test` correctly, the dispatcher needs the user's state. Today there's no obvious field on `users`. Confirm where the user's state lives, or accept that those slugs always appear during NYC launch.

### Q7. Rule engine coexistence vs hard cutover

Feature-flagged side-by-side or hard cutover? **Lean: feature-flagged for 1–2 weeks, then cutover.**

### Q8. Tool count — trim or accept 22?

22 above the soft ~15 cap. Trimming the 6 "nice" tools brings it to 16. **Lean: keep all 22; bump the cached-zone budget.**

### Q9. Missing `is_active` flag on `services`

(Gap 8.) Add it now (with a backfill defaulting all 23 to active) or commit to the rule that every row in `services` is always active. **Lean: add it now.**

### Q10. Slug drift parking lot — when does the cleanup pass happen?

`slug-drift-remediation.md` describes 8 files needing kebab→snake reconciliation. Three are silently failing in production runtime today. **None are in scope for Oto AI**, but the package-rules and maintenance-pipeline failures (Gaps S2 and S4) directly degrade the data Oto AI's tools depend on — `get_due_services` will return nothing useful until S2 is fixed. Recommend slotting the cleanup pass before Oto AI ships, or accepting degraded `get_due_services` results at launch.

### Q11. Tool-call telemetry on `ai_messages.metadata`

`metadata` is `v.any()` so cache-hit / tools-fired / iteration_count can flow without schema change. Add explicit columns or keep in the blob? **Lean: keep in blob for v1.**

### Q12. Picker tab count — 4 vs 7

The client picker has 4 tabs; production has 7 categories. Currently bridged by a dispatcher-side mapping. Options:

- **(a)** Leave the mapping; users never see Battery / Fluids / Compliance as their own tabs
- **(b)** Expand the picker to 7 tabs (UI change in `AIServicePicker.tsx`)
- **(c)** Drop the picker for compliance-style services and surface them only through reasoning + quick_replies

**Lean: (a) for v1** — works today, no UI changes. Revisit if user research surfaces confusion.

### Q13. Naming convention conflict (carried)

Tool names `snake_case`. Convex function exports `camelCase`. Slugs `snake_case` (was kebab-case in v2). No actual collision — separate scopes. Confirming OK.

---

*End of inventory v3. Read alongside `convex/oto/tools.ts`, `convex/oto/dispatcher.ts`, `docs/oto-ai/handoff-addendum.md`, and `docs/oto-ai/slug-drift-remediation.md`.*
