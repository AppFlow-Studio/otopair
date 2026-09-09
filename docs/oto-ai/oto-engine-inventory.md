# Oto Engine Inventory + System 1 / System 2 Mapping

| | |
|---|---|
| **Owner** | Waleed Mansour (engineering) |
| **Status** | Discovery + spec from v0.5.1 era. Body is historical; **the v0.9 State Update below this header is authoritative for current runtime.** |
| **Audience** | AB (voice/policy review of Part 5 routing rules), Waleed + Claude (sessions building on top) |
| **Original date** | 2026-05-13 |
| **Last v0.9 sync** | 2026-05-14 |

---

## v0.9 State Update (authoritative — supersedes Parts 1–4 where they conflict)

The five-part inventory below was written during Phase 1 discovery. The architecture has evolved through v0.7–v0.9. **For current state, read `Oto_AI_v0.9_Handoff.md` and the v0.9 Current Tools section in `tool-inventory.md`.** The Four Locked Decisions (A/B/C/D) and System 1 / System 2 framing from Part 5 remain canonical and unchanged.

What's NEW since this doc was written:

- **6-stage booking-flow chain wired** — service_selection → diagnostic_form → priority_selection → shop_selection → time_selection → confirmation. Each stage = one render tool per turn. Oto's involvement ENDS at confirmation; mobile component handles redirect to payment.
- **Trigger-only render schemas** — `render_shop_carousel`, `render_time_selector`, `render_booking_confirmation` pass IDs only. Mobile components query Convex for real mechanic data + pricing.
- **Pricing rule** — Oto NEVER composes, quotes, or estimates prices. Frontend owns all pricing display.
- **Conversation state plumbing** — `ai_conversations.mood / arc_summary / established_facts / last_user_intent` columns + `<conversation_state>` envelope block. Persisted via `update_conversation_state` (Haiku writes) + `appendEstablishedFact` (mobile frontend writes when user taps card).
- **Knowledge base (vehicle_facts)** — semantic + structural retrieval with chassis/engine propagation. `lookup_vehicle_spec` for comparison cars. `web_search` (Anthropic server-managed, policy-gated) for KB misses. Every factual answer records to KB via `record_vehicle_fact` (state-category side effect).
- **Sonnet cascade scaffolding** — `request_sonnet_handoff` / `request_haiku_handback` + `ai_conversations.current_model` field + per-turn model selection. Calibration target 15–25% of diagnostic turns. Awaiting TestFlight data.
- **Voice rewrite** — friendliness as default, the `calm > restrained > confident > direct` hierarchy reframed as override stack for hard turns. Mood-adaptive shaping rules. "No system narration", "user-is-booker-not-doer", "confirm = execute" rules.
- **Telemetry** — `oto_telemetry` table writes per turn (tokens, latency, tool calls, branch, cache hits). Locked Principle #12 satisfied.
- **Prompt caching** — `cache_control: ephemeral` markers on system prompt + tools. Cache-read tokens visible in trace.
- **Polite-exit counter** — `ai_conversations.diagnostic_turn_count` increments on narrowing turns, resets on form render. At ≥6 the envelope emits `<polite_exit_required>` block.
- **Markdown bold post-process strip** — server-side belt-and-suspenders for the voice-rail rule.

The Discovery + Spec sections below remain valuable for understanding the two-system framing, the locked decisions, and the configuration-drift footgun. Read them for architectural context; defer to v0.9 docs for current behavior.

---

## Premise

There are two independent systems Oto AI needs to consult, with different jobs, different rule surfaces, and different shapes. They overlap on some surface terms (brakes, tires) but they are **not** the same axis. Conflating them — using System 1's status to derive System 2's subsystem, or using System 2's enum to summarize System 1 — produces worse output than treating them separately.

- **System 1 — Vehicle Health & Service-Due** (Ahmad, shipped): tracks the status of five routine maintenance types (`oil`, `brakes`, `tires`, `inspection`, `battery`) per vehicle, plus a 0–100 health score. Answers *"how is the car doing right now, and what's coming up?"*.
- **System 2 — Diagnostic Booking Flow** (schema shipped, UI not yet built): when a user books a diagnostic, they pick a subsystem (5 enum values) and optionally write a customer-notes free-text field. Answers *"what does the mechanic look at first?"*.

The two systems serve different decisions in conversation. See **Part 5** for how Oto consults each.

---

## Authoritative source notes

These are details I verified directly from the codebase and that differ from the discovery directive's stated assumptions. Resolve before implementation.

| Spec stated | Codebase truth | File |
|---|---|---|
| Subsystem enum: `Brake`, `Tires`, `Engine`, `Battery & Electrical`, `Not Sure` (Title Case display strings) | Subsystem enum: `brakes`, `tires_wheels`, `engine`, `battery_electrical`, `not_sure` (snake_case literals, plural "brakes", combined "tires_wheels") | `lib/diagnostic-checklist-templates.ts:1-6` and mirrored in `convex/schema.ts:1232-1238` |
| Customer-states free-text field | Field name on bookings is `customer_notes` (schema), passed as `customerNotes` in the mutation arg | `convex/schema.ts:1230`, `convex/bookings.ts:6117` |
| Diagnostic booking form (subsystem selector + customer states) is built | **No customer-facing diagnostic-form component exists.** No TSX file references the `tires_wheels` or `battery_electrical` enum literals. Schema + mutation accept `diagnostic_system` and `customer_notes`, mechanic-side checklist seeds from `templateForSystem`, but the customer-side subsystem picker UI is unbuilt. | (negative result: ripgrep on `tires_wheels\|battery_electrical` across `**/*.tsx` returns zero matches) |
| Vehicle Health PDF at `/mnt/user-data/uploads/1778709119319_Vehicle_Health_Handoff.pdf` | Path doesn't resolve on the dev machine (Linux/sandbox path). System 1 surface documented from code only. | — |

The "diagnostic form UI doesn't exist yet" finding is the most consequential — see Gap Analysis (Part 4) and Decision B (Part 5). The render-tool will need to land at the same time as the picker component itself.

---

## Part 1 — Component / Scenario Inventory

### 1A. `components/ai-chat/` — 17 components

None of these components call `useMutation`, `useAction`, or `useQuery` directly. All are pure presentational; writes and navigation happen in `app/(main-tabs)/ai-chat/index.tsx` via `handleBookNow`, `handleServiceSelect`, and `router.push`. **This means the "components calling useMutation without confirm" risk flagged in the discovery directive does not currently exist** — the codebase already respects the user-confirm-before-write boundary by accident of structure.

| # | Component | What it shows | Required pre-fill props | User action | Write/nav target |
|---|---|---|---|---|---|
| 1 | `AIWelcomeScreen` | Pre-conversation welcome with a "Continue" CTA | `onContinue: () => void` | Tap Continue | Closes welcome; no write |
| 2 | `AIGreeting` | Personalized greeting card at the top of the chat (vehicle context, prompt suggestions) | Vehicle context + suggestion list (props in `AIGreetingProps`) | Tap suggestion → seeds a user message | No write directly; triggers a chat send |
| 3 | `AIContextBar` | Compact vehicle pill at top of chat ("2020 BMW M550i ▾") | `vehicle`, `onChangeVehicle` | Tap to change vehicle | No write; opens vehicle picker |
| 4 | `AIMessageBubble` | Renders one message envelope (text + reasoning + sources + quick replies + sections + images) | The full `ChatMessage` envelope from `services/ai/types.ts` | Reads only | None |
| 5 | `AIReasoning` | Expandable trace of `ReasoningStep[]` above message text | `steps: ReasoningStep[]` | Tap to expand | None |
| 6 | `AISources` | List of citation chips below message text | `sources: Source[]` | Tap a source | None directly |
| 7 | `AIQuickReplies` | 2–4 tappable reply buttons under a message | `replies: QuickReply[]`, `onSelect`, `disabled` | Tap reply → sent as next user message | Triggers a chat send |
| 8 | `PromptSuggestions` | Stage-specific suggestion tiles below the input | `stage`, `suggestions: Suggestion[]`, `onSelect` | Tap tile | Triggers a chat send |
| 9 | `AISuggestionTile` | Single suggestion tile (used by PromptSuggestions and AIGreeting) | `text`, `onPress` | Tap | Parent handler |
| 10 | `AIServicePicker` | Inline service catalog with 4-tab nav (Maintenance / Tires & Wheels / Brakes / Diagnostics) + multi-select | `services?: ServiceOption[]` (optional — falls back to `DEFAULT_SERVICES`), `onConfirm: (selected: ServiceOption[]) => void` | Pick services, tap Confirm | `onConfirm` → `handleServiceSelect` in screen; advances scenario stage |
| 11 | `AIBookingCarousel` | Horizontal mechanic-card carousel with availability slots | `shops: AIMechanic[]`, `onBookNow: (mechanic, timeSlot) => void` | Tap a time slot on a mechanic card → tap Book Now | `onBookNow` → `handleBookNow` which calls `setBookingStage("payment")` + `router.push('/home/mechanic/{id}/payment')`. **The write happens on the payment screen, not here.** |
| 12 | `AIInputBox` | Text input with attachment/send buttons | `value`, `onChangeText`, `onSend`, attachment state | Type + Send | Triggers chat send |
| 13 | `AIAttachmentPanel` | Photo gallery sheet for attaching images to a message | `visible`, `onClose`, image selection callbacks | Pick photos | Stages images in selected list; no remote write |
| 14 | `AISelectedImages` | Thumbnails strip of staged images above input | `images: string[]`, `onRemove` | Tap × to remove | Local state only |
| 15 | `AIChatHistory` | List of prior conversations | `conversations`, selection callbacks | Tap a conversation | Loads conversation; no write |
| 16 | `AIToast` | Transient inline notice | `message`, `visible`, `onDismiss` | Auto-dismiss | None |
| 17 | `AITypingIndicator` | Three-dot animation while AI is responding | (none) | None | None |

### 1B. `services/ai/scenarios.ts` — 7 scenarios

These are rule-engine scenarios from the pre-AI implementation. Each scenario has 4–7 stages (`diagnosis → question → priority_selection → shop_selection → time_selection → confirmation → success`) and emits hardcoded prose, hardcoded reasoning steps, and mock shop data. Stage flow is the same shape across all of them; they differ in copy and reasoning text.

| Scenario | Trigger keywords | What it does | AI-era status |
|---|---|---|---|
| `brake_noise` | `brake`, `squeak`, `squeal`, `grinding`, `noise` | Diagnosis → "Want me to book a brake inspection?" → priority → shop → time → confirm. Hardcoded reasoning ("brake pads showing wear"). Emits the **fictional "Brake Inspection & Pad Replacement" service name** in the time-selection summary (line 262 of scenarios.ts). | RETIRE — AI now handles routing via render tools. Copy contradicts v0.5 Service-Name Discipline. |
| `check_engine` | `check engine`, `engine light`, `cel`, `warning light` | Same flow. Hardcoded P0171 code in reasoning. | RETIRE — Oto AI doesn't have OBD-II read access; the hardcoded code is misleading. |
| `oil_change` | `oil change`, `schedule`, `maintenance`, `service` | Opens with `showServicePicker: true` instead of diagnosis. Otherwise same flow. | RETIRE — but salvage the `showServicePicker` pattern; that's the right entry point for general booking intent. |
| `tire_pressure` | `tire`, `pressure`, `tpms`, `flat` | Hardcoded "front left at 24 PSI" reasoning. Same flow. | RETIRE — Oto AI doesn't have live TPMS access; hardcoded PSI is misleading. |
| `vague_issue` | `something wrong`, `feels off`, `weird` | Routes to "Multi-Point Vehicle Inspection." Hardcoded "no error codes" reasoning. | RETIRE — "Multi-Point Vehicle Inspection" is not in the canonical 23-slug catalog (`OTOPAIR_SERVICE_SLUGS`). |
| `new_vehicle` | `new vehicle`, `register vehicle`, `add car` | Onboarding-adjacent flow. | RETIRE — vehicle onboarding has its own dedicated flow at `app/(tell-us-about)/`. |
| `direct_booking` | `book`, `schedule`, `appointment` | Skips diagnosis, goes straight to priority → shop → time. | RETIRE — covered by AI calling `render_shop_carousel` after the user expresses booking intent. |

All seven scenarios were built when Oto was a rule engine. The AI version replaces the **branching logic** (which scenario fires) with the model's reading of the user's message, while keeping the **components** (service picker, booking carousel, time selector). Once render tools are wired, all seven `Scenario` definitions can be deleted alongside `scenarioEngine.ts`. Triggers and reasoning steps don't need to be preserved.

---

## Part 2 — Render-Tool Mapping

Tools that already exist in `convex/oto/tools.ts` are marked **(exists)**. New tools needed for the AI-prefill flow are marked **(add)**. Terminal = the tool ends the AI's turn and hands control to the user.

| Render tool | Backing component | Input schema (state AI passes in) | Existing? | Terminal? |
|---|---|---|---|---|
| `render_shop_carousel` | `AIBookingCarousel` | `shops: AIMechanic[]` (max 5; AI must pre-fill from `get_shop`/`get_my_mechanics` results — id, name, shopName, address, rating, distanceMi, etc.) | exists | terminal — user picks a slot |
| `render_service_picker` | `AIServicePicker` | `services?: ServiceOption[]` filtered via `list_services_for_vehicle`. Category mapping required: production has 7 categories (`Diagnostics`, `Compliance`, `Routine Maintenance`, `Tires`, `Brakes`, `Battery`, `Fluids`); picker has 4 (`maintenance`, `tires`, `brakes`, `diagnostics`). See `tools.ts:332-340` for the mapping comment. | exists | terminal |
| `render_time_selector` | (envelope-extension `timeSlots`, currently rendered as a suggestions list inside AIMessageBubble) | `shop_id`, `slots: TimeSlot[]` | exists in tools.ts but the envelope field `message.timeSlots` is flagged "Gap 6" in tools.ts:258. UI surface needs verifying. | terminal |
| `render_booking_confirmation` | (envelope-extension `bookingSummary`, flagged "Gap 7" in tools.ts:259) | `summary: BookingSummary` (matches `services/ai/types.ts:197-204`) | exists in tools.ts; envelope field needs wiring | terminal — user taps Confirm or Edit |
| `render_quick_replies` | `AIQuickReplies` | `replies: QuickReply[]` (2–4 items, ≤24 char each) | exists | terminal — calling this ends the AI's turn |
| `render_reasoning` | `AIReasoning` | `steps: ReasoningStep[]` (1–5 steps) | exists | non-terminal — attached to the same message |
| `render_sources` | `AISources` | `sources: Source[]` (max 5) | exists | non-terminal |
| `render_diagnostic_form` | **DOES NOT EXIST** — needs to be built alongside the tool. See Part 4 gap analysis. | `diagnostic_system: "brakes" \| "tires_wheels" \| "engine" \| "battery_electrical" \| "not_sure"`, `customer_notes: string` | **add** | terminal — user reviews/edits/submits |

### Subsystem enum — verbatim from source

From `lib/diagnostic-checklist-templates.ts:1-6`:

```ts
export type DiagnosticSystem =
  | "brakes"
  | "tires_wheels"
  | "engine"
  | "battery_electrical"
  | "not_sure";
```

These are the only acceptable values. The `render_diagnostic_form` tool schema MUST validate against this exact set (case-sensitive snake_case). The user-facing labels (e.g. "Tires & Wheels", "Battery & Electrical") belong in the picker component, not in the AI tool schema.

### Components that need no render tool

- `AIWelcomeScreen` — pre-conversation; not part of the AI loop
- `AIGreeting`, `AIContextBar` — chrome, always on
- `AIMessageBubble`, `AIReasoning`, `AISources` — already covered by their respective render tools, but they don't need their own "render" tools (they are the rendering surface)
- `AIInputBox`, `AIAttachmentPanel`, `AISelectedImages`, `AIChatHistory` — input chrome, not AI-driven
- `AIToast`, `AITypingIndicator` — utility / state UI
- `AISuggestionTile`, `PromptSuggestions` — these surface scenario-engine "suggestions". In the AI era they can either (a) be retired in favor of `render_quick_replies`, or (b) be repurposed to show non-conversational entrypoints (rewards tile, vehicle health tile). Recommend retiring path (a).

---

## Part 3 — System 1 Data Tools (Vehicle Health & Service-Due)

### What System 1 currently exposes

| Surface | Where | Returns |
|---|---|---|
| `computeVehicleHealthScore(input)` | `utils/healthScore.ts:171` | 0–100 score blending maintenance status, mileage curve, warning-light penalties, and (when present) Smartcar live signals |
| `computeProjectedHealthScore(input, fixedItemId)` | `utils/healthScore.ts:224` | "What-if" score if a specific maintenance item flipped to `on_time` |
| `computeMaintenanceStatus(record, …)` | `utils/maintenanceStatus.ts:298` | `StatusResult` per record: `status` (5-value enum), `percentUsed`, `description`, `detail`, `estimatedDueDate`, `milesRemaining`, `monthsRemaining` |
| `MaintenanceItem[]` (the merged shape) | `components/cars/MaintenanceTracker.tsx:62-73` | `id`, `serviceName`, `description`, `detail`, `status`, `lastService?`, `urgency?`, `impacts?`, `recommendation?` |
| `useMaintenanceRecords(vehicleOwnerId, …)` | `hooks/useMaintenanceData.ts:55` | Live-reactive merged item list (Smartcar + user records → MaintenanceItem map) |
| `api.maintenance.getRecordsByVehicle` | `convex/maintenance.ts:23` | Raw records; the hook does the status computation client-side |
| `vehicle_owners.health_score`, `vehicle_owners.health_score_is_estimated` | `convex/schema.ts:722-723` | Pipeline-computed cached score |
| `vehicle_service_states` table | `convex/schema.ts:932-958` | Per-service `urgency`, `due_at_mileage`, `due_at_date`, last service info |

### `get_due_services` already exists

The existing data tool at `convex/oto/tools.ts:78-92` already exposes service-level urgency (`overdue` / `due_soon` / `ok`) keyed by canonical service slugs. **This is closer to System 2 than System 1 in shape** — it's per-service-slug, not per-maintenance-type. Useful for: "what should I book?". Insufficient for: "how is my car doing?" or for the diagnostic-vs-direct routing decision in Decision A, which needs the 5-type System 1 view with status names matching `MaintenanceStatus`.

### Proposed new tools

**`get_vehicle_health`** *(data tool, new)*

```
input:  { vehicle_id: string }   // VIN
output: {
  score: number,                  // 0–100
  score_is_estimated: boolean,    // mirrors vehicle_owners.health_score_is_estimated
  items: Array<{
    id: string,                   // e.g. "user-brakes", "smartcar-oil"
    type: "oil" | "brakes" | "tires" | "inspection" | "battery",
    label: string,                // e.g. "Brakes", "State Inspection"
    status: "on_time" | "due_soon" | "needs_attention" | "overdue" | "unknown",
    description: string,          // e.g. "10,400 mi remaining · ~6 months remaining"
    detail: string,               // e.g. "~10 months ago"
    last_service?: string,        // free-text from URGENT_DETAILS or pipeline
    urgency_label?: string,       // e.g. "Service within 2 weeks"
    recommendation?: string,      // from URGENT_DETAILS (urgency-enriched description)
  }>,
}
```

Backing impl: a thin Convex query that wraps `useMaintenanceRecords`' logic server-side, OR the AI dispatcher computes it by calling `getRecordsByVehicle` + applying `computeMaintenanceStatus`/`computeVehicleHealthScore`. Recommend the server-side wrapper — keeps the AI dispatcher dumb and lets the same computation power both the AI and the mobile UI.

**`get_projected_health_score`** *(data tool, new)*

```
input:  { vehicle_id: string, item_id: string }   // item_id from get_vehicle_health
output: { current_score: number, projected_score: number, lift: number }
```

For conversion moments: "your score goes from 67 to 81 if you take care of the brakes."

### Pre-fetch vs on-demand — recommend on-demand

The discovery directive asked whether System 1 should live in the **uncached zone** every turn (~500–1000 tokens injected per request) or be fetched **on demand** via tool call.

**Recommendation: on-demand via `get_vehicle_health` tool call.** Reasoning:

1. **Cache economics.** Adding 500–1000 tokens to the uncached zone is a per-turn cost on every conversation, the vast majority of which (e.g. "what's a P0171 code?", "how often should I rotate tires?", "what services do you offer?") don't need vehicle health data. The cost-per-conversation of `get_vehicle_health` is paid only when the AI decides it's relevant.
2. **Decision boundaries are clean.** The two decisions that need vehicle health — Decision A (diagnostic vs direct) and Decision D ("how is my car doing?") — are clearly identifiable from the user's first turn. The system prompt can name them: "Before recommending a service in response to a symptom, call `get_vehicle_health` to check whether a routine-maintenance item is due. Skip this call for educational, refusal, or general-catalog questions."
3. **Latency is acceptable.** Adding one tool round-trip before responding to a symptom is ~300–500ms of added latency. That's a fair trade for not paying the prefetch cost on every turn — and the user already expects a typing indicator while Oto thinks.

The argument for pre-fetch is that the AI might fail to recognize when health data is relevant. That's a real prompt-engineering challenge. Solve it in the prompt (with a few-shot showing the pattern), not by always paying the tokens.

### Server cache vs client recompute

`vehicle_owners.health_score` is server-cached; the mobile UI client-recomputes on each render so it reacts immediately to stepper answers without waiting for the pipeline. For the AI, **use the server-cached score** — it's the same one the user sees on the cars tab when they open the app cold. If the pipeline is overdue, `health_score_is_estimated: true` signals the AI to soften phrasing ("based on what we know"). No need for the AI to do client-side recomputation; the AI doesn't have the live stepper state that motivates the client-side path.

---

## Part 4 — Gap Analysis

### Existing chat components that need no AI render tool

Listed in Part 2 above (utility/error/input chrome).

### Render tools to ADD

- **`render_diagnostic_form`** — does not exist. This is the highest-priority gap because the diagnostic-booking flow is the canonical Decision A → diagnostic routing target and it's the example used in the v0.5.1 prompt's Example 8.

### Components to ADD

- **The diagnostic form component itself.** Schema accepts `diagnostic_system` + `customer_notes`. Mechanic-side checklist seeds from `templateForSystem`. But the customer-side picker (5-option subsystem selector + free-text notes box + Confirm button) does not exist as a React component. Verified by: ripgrep on the enum literals (`tires_wheels`, `battery_electrical`) across `**/*.tsx` returns zero matches.

  **Recommend** building this as `components/ai-chat/AIDiagnosticForm.tsx` to match the naming pattern of other chat components. Props shape:

  ```tsx
  interface AIDiagnosticFormProps {
    initialSystem?: DiagnosticSystem;      // AI pre-fills
    initialNotes?: string;                  // AI pre-fills
    vehicleId: string;
    onConfirm: (system: DiagnosticSystem, notes: string) => void;
    disabled?: boolean;
  }
  ```

  Mirror the `AIServicePicker.onConfirm` pattern — chat-screen handles the actual booking write after `onConfirm`. The form does no Convex calls itself.

### Existing scenarios to retire

All seven (listed in Part 1B). When retired, also delete `services/ai/scenarioEngine.ts`, and either retire `services/ai/types.ts:ConversationStage` / `ScenarioType` entirely or keep only the type definitions the new AI envelope still uses (`ChatMessage`, `BookingSummary`, `AIMechanic`, `TimeSlot`).

### Components writing without confirmation

**None.** All 17 `components/ai-chat/` components are presentational. Writes/navigation happen in `app/(main-tabs)/ai-chat/index.tsx` (verified by grep; only `index.tsx` imports `useMutation` from `convex/react`, and the booking-write path is the payment screen at `/home/mechanic/{id}/payment`). The user-confirm-before-write boundary holds by structure.

### Components that need modification to accept AI-pre-filled state

- `AIServicePicker` — already accepts an optional `services?: ServiceOption[]` prop and falls back to `DEFAULT_SERVICES`. Wiring it to AI-passed services requires the 4-tab → 7-category mapping noted in `convex/oto/tools.ts:332-340`. No component code change needed.
- `AIBookingCarousel` — accepts `shops: AIMechanic[]` directly. Compatible with `render_shop_carousel`'s schema. No change needed.
- (new) `AIDiagnosticForm` — built fresh, accepts AI-pre-filled state by design.
- `AIQuickReplies` — accepts `replies: QuickReply[]` directly. Compatible. No change.

### Envelope field gaps (already flagged in `tools.ts`)

- `message.timeSlots` — "Gap 6" in `tools.ts:258`. The envelope extension exists in `services/ai/types.ts:174` (`timeSlots?: TimeSlot[]` on `ScenarioResponse`) but verify it's plumbed through `ChatMessage` for the AI-era envelope.
- `message.bookingSummary` — "Gap 7" in `tools.ts:259`. Not present on `ChatMessage` today (`services/ai/types.ts:117-137`). Needs to be added before `render_booking_confirmation` is wireable.

---

## Part 5 — How the AI uses both systems

### Decision A — "Direct service vs diagnostic?"

**Inputs:** user's symptom description (conversation) + `get_vehicle_health` result (System 1 only).

**Routing table.** "Match" means the symptom maps to one of System 1's 5 maintenance types (`oil`, `brakes`, `tires`, `inspection`, `battery`) — see Decision B's mapping table for the symptom-to-type heuristic.

| Symptom pattern | Vehicle health status of matched type | Recommendation |
|---|---|---|
| Maps to one System 1 type, single-symptom | `overdue` | **Direct service** (canonical service slug for that maintenance type — e.g. `brake_pad_replacement`, `oil_change`, `tire_replacement` or `tire_rotation`, `battery_replacement`) |
| Maps to one System 1 type, single-symptom | `due_soon` | **Direct service** — same as above |
| Maps to one System 1 type, single-symptom | `needs_attention` | **Diagnostic** — System 1 flagged a problem but interval data isn't conclusive (e.g. symptom reported, no service history). Mechanic eyes-on. |
| Maps to one System 1 type, single-symptom | `on_time` | **Diagnostic** — the routine maintenance is fine, so the symptom isn't predictable wear. Something unexpected. |
| Maps to one System 1 type, single-symptom | `unknown` | **Diagnostic** — no service history to anchor a direct recommendation. |
| No System 1 type maps (e.g. engine ticking, weird smell, transmission slip) | (any) | **Diagnostic** |
| Multiple symptoms or vague | (any) | **Diagnostic** |

**Important constraint for v0.6:** this routing logic depends on `get_vehicle_health` being callable, which means the data tool needs to land before the prompt rule that uses it. Per the v0.5.1 changelog, this is the **paired slice** — data wiring + prompt rule + new Example 11 anchoring the pattern. Until then, the v0.5.1 prompt's Example 8 (always-diagnostic for brake symptoms) is the correct fallback.

**Example 11 sketch** (for v0.6, after data wiring lands):

> User: *"My brakes have been squealing for a few weeks. I'm at about 38,000 miles."*
>
> [AI calls `get_vehicle_health(vehicle_id)` → returns `{ score: 71, items: [{ type: "brakes", status: "due_soon", description: "Last serviced ~10 months ago", recommendation: "Brake pads wear down with use…" }, …] }`]
>
> You: *"Your brakes are flagged due-soon — last service was about 10 months back, and squealing at this interval usually means the wear indicators are doing their job. Brake Pad Replacement is the straightforward fix here, no diagnostic detour needed. Want me to pull up details on what that service covers?"*

Note this version skips the diagnostic and goes straight to the canonical service slug (`brake_pad_replacement`). The three-beat structure holds.

### Decision B — "Which subsystem to pre-fill in `render_diagnostic_form`?"

**Inputs:** user's symptom description (primary signal) + the verbatim 5-value enum.

**This decision is driven by the user's words, not by System 1's status.** A user can say "battery light came on" with no battery service history in System 1; the right subsystem is `battery_electrical` regardless.

| Symptom-language pattern | Pre-fill `diagnostic_system` |
|---|---|
| brake squeal/grind/noise; soft pedal; pulling left/right on braking; ABS light | `brakes` |
| tire pressure light (TPMS); vibration at speed; pulling; uneven tread wear; wheel wobble | `tires_wheels` |
| ticking/knocking when cold; idle rough; loss of power; check-engine light; overheating; smoke; smell of burning oil | `engine` |
| battery light; slow crank; clicking on start; lights dim at idle; charging warning; alternator-adjacent symptoms | `battery_electrical` |
| "car just feels off"; multiple unrelated symptoms; symptom doesn't fit one bucket; user uncertain | `not_sure` |

When in doubt, prefer `not_sure` — the mechanic-side checklist for `not_sure` (`Customer ride-along / symptom replication`, exterior walk-around, OBD-II scan, test drive) is designed exactly for the case where the customer can't self-classify.

### Decision C — "What goes in the customer notes field?"

The free-text field on the booking is `customer_notes` (not "customer states"; see Authoritative source notes above).

**Recommended format:** a short, structured summary in the user's own language, ~1–3 lines, in this shape:

```
Symptom: <quote or paraphrase of the chief complaint, ≤80 chars>
When: <duration / conditions when it happens, ≤60 chars>
Other: <any secondary symptoms or context the user mentioned, ≤80 chars; omit line if none>
```

Example for the v0.6 Example 11 conversation above:

```
Symptom: brakes squealing
When: started ~2 weeks ago, present at most stops
Other: ~38,000 mi, no recent brake work mentioned
```

**Why this format over alternatives:**

- A direct quote of the last user message is too narrow — it misses duration/conditions the user gave in earlier turns.
- A loose free-form summary is too noisy — the mechanic skim-reads this before walking out to the car. A 3-line structured note respects their time.
- "Symptom / When / Other" maps to how mechanics already triage — read the chief complaint, then when it happens, then anything else.

The AI should always **show** the customer-notes value in the rendered `AIDiagnosticForm` before the user confirms — let the user edit if the summary missed something or got it wrong.

### Decision D — "How is my car doing?"

Pure System 1 query. No System 2 involvement.

Flow:
1. AI calls `get_vehicle_health(vehicle_id)`.
2. AI summarizes the score in one sentence, then names any non-`on_time` items in order of urgency (`overdue` > `due_soon` > `needs_attention` > `unknown` last).
3. AI ends with an offer to address the worst item — and where useful, calls `get_projected_health_score(vehicle_id, worst_item_id)` and quotes the lift ("if you take care of the brakes, your score goes from 71 to 84").
4. Offer maps to a real action: `get_service_details` on the canonical service slug for that item, or `render_service_picker` filtered to relevant services.

**Example response shape** (informal sketch, not committed prompt copy):

> *"You're at 71. Brakes are flagged due-soon — last service about ten months ago — and your battery's getting close to the 3-year mark where I'd want it tested. Everything else looks fine. If you take care of the brakes, your score goes from 71 to 84. Want me to pull up what a Brake Pad Replacement covers?"*

Hard rules for this pattern:
- Never invent items not present in the `get_vehicle_health` result.
- Never invent the score or the projected score — only quote what the tool returned.
- If `score_is_estimated: true`, soften the wording: "based on what we know, you're around 71…"
- Use canonical service slugs from `OTOPAIR_SERVICE_SLUGS` for any offered action. Never paraphrase.

---

## Implementation slicing (for May 14 vs Phase 2 planning)

**Pre-May-14 candidates (smallest viable to unblock the AI flow):**

1. Build `AIDiagnosticForm` component (subsystem picker + customer-notes input + Confirm). Mirror `AIServicePicker` structure.
2. Add `render_diagnostic_form` tool to `convex/oto/tools.ts`. Wire it through `dispatcher.ts` and the chat envelope (add `diagnosticForm` field to `ChatMessage` or reuse `showServicePicker` pattern).
3. Wire `handleDiagnosticFormConfirm` on the chat screen — call the existing booking-create mutation with `customerNotes` + `diagnosticSystem` args.

**Phase 2 (paired slice for v0.6):**

4. Build `get_vehicle_health` Convex query (wraps `useMaintenanceRecords` logic server-side).
5. Build `get_projected_health_score` Convex query.
6. Add both as data tools in `convex/oto/tools.ts`.
7. Update the prompt: add the Decision A routing rule, add Example 11.
8. Retire `services/ai/scenarioEngine.ts` and the 7 `Scenario` definitions.

**Pure cleanup (can slot anywhere):**

9. Verify `message.timeSlots` and `message.bookingSummary` are plumbed through the envelope (Gaps 6/7 in tools.ts).
10. Delete `STALE_KEBAB_SLUGS_DO_NOT_USE` reference array in tools.ts once the slug-drift remediation lands.

---

## Open questions for AB

1. **Decision A routing.** Is "match symptom to System 1 type + status drives direct vs diagnostic" the right policy, or should *any* symptom always route to diagnostic regardless of due-soon status? Voice-policy question, not engineering.
2. **Customer-notes format.** Is the structured "Symptom / When / Other" format the right register for a mechanic-facing field, or would AB prefer a more conversational paragraph? Field will be read by mechanics, not customers.
3. **`get_vehicle_health` in the prompt.** Should the prompt mention "your score" in user-facing copy by default, or only when the user explicitly asks "how am I doing?" — there's a tonal risk of feeling like a quantified-self app rather than a co-pilot.
