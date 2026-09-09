# Oto AI — App-side UI Modes Handoff

**Audience:** the React Native team wiring the Oto chat screen to the managed agent's response stream.
**Goal:** define the contract that lets Oto return *structured UI directives* — vehicle pickers, shop cards, booking confirmations, etc. — instead of plain prose, so the app renders premade components instead of re-parsing free text every turn.

Pair this with `OTO_AI_BACKEND_HANDOFF.md`. That one tells Claude how to read data; this one tells the app how to display Claude's responses.

---

## 1. The mechanism — client-side tools

We don't parse JSON out of prose. Instead, every "premade UI" is a **client-side tool** the agent calls. The Anthropic Agent API supports tools whose execution happens on the client; the app intercepts those `tool_use` blocks, renders the matching UI, waits for the user, and posts a `tool_result` back into the conversation.

```
   ┌──────────┐   text + tool_use   ┌──────────────────┐
   │  Agent   │  ────────────────▶  │  OtoPair app     │
   │ (Claude) │                     │  - text → bubble │
   │          │                     │  - tool_use →    │
   │          │  ◀────────────────  │     render UI    │
   └──────────┘   tool_result        └──────────────────┘
```

**Why tools and not embedded JSON?**
- Claude is trained to use tools well. Tagged JSON in prose is brittle.
- Tool schemas give Claude type-checked inputs — fewer malformed payloads.
- Tool results are first-class transcript items, so Claude sees what the user picked next turn without re-parsing.

**How to register them.** Add a third toolset alongside `agent_toolset_20260401` and the Convex `mcp_toolset`. The schemas live in your agent config; the *handlers* live in the app. The agent will pick them based on the descriptions, so descriptions matter — write them like the model is the audience.

---

## 2. When Oto picks a UI mode vs. plain text

A short rule the system prompt should carry:

```
UI MODE RULES
- If the user needs to choose between options that exist in our data
  (vehicles, shops, mechanics, services, time slots): use a UI mode.
- If you're presenting structured records the app already has a card for
  (booking, health score, cost estimate, maintenance list): use a UI mode.
- If the user is just chatting, asking definitions, or you're explaining
  something: reply in plain text.
- Never describe a list in prose AND show the same list as a UI mode —
  pick one. UI modes win when the user's next action is a tap.
- Always include a short text message alongside a UI mode. The UI mode is
  the action; the text is the framing ("Which car are we talking about?").
- After cost estimates, diagnostic summaries, or maintenance schedules
  where action makes sense, follow with a booking-flow tool
  (`prompt_select_shop` in the same turn, or a `prompt_quick_replies`
  "Find a shop" chip). Cost and diagnosis answers are funnels, never
  dead ends.
```

---

## 3. The mode catalog (v1)

Each entry has: tool name, when Oto calls it, input schema, what the app renders, what the `tool_result` payload looks like when the user is done.

### 3.1 `prompt_select_vehicle`
**When:** user has >1 vehicle and the question is vehicle-specific without disambiguation.
**Renders:** horizontal card carousel — each card shows year/make/model/trim, primary image, mileage, health badge.
**Input:**
```json
{
  "title": "Which car?",
  "subtitle": "I'll pull the right specs.",
  "vehicle_ids": ["vh_123", "vh_456"]   // pre-filtered subset, or omit for all
}
```
**Tool result:** `{ "vehicle_id": "vh_123" }` — or `{ "cancelled": true }` if user dismisses.

### 3.2 `prompt_select_shop`
**When:** user wants to book a service and hasn't picked a shop, or asked "where should I take it."
**Renders:** vertical list of shop cards — name, distance, rating, labor rate, top services. "View on map" button.
**Input:**
```json
{
  "service_id": "svc_oil_change",       // optional, narrows results
  "vehicle_id": "vh_123",
  "max_distance_miles": 15,
  "shop_ids": ["sh_1", "sh_2", "sh_3"]  // pre-filtered; app may show more if user expands
}
```
**Tool result:** `{ "shop_id": "sh_2" }`.

### 3.3 `prompt_select_mechanic`
**When:** chosen shop has multiple mechanics and user wants to pick one.
**Renders:** mechanic cards — name, photo, specialties, rating.
**Input:**
```json
{
  "shop_id": "sh_2",
  "mechanic_ids": ["mc_1", "mc_2"]
}
```
**Tool result:** `{ "mechanic_id": "mc_1" }`.

### 3.4 `prompt_select_service`
**When:** ambiguous service intent ("I need a tune-up", "something with the brakes").
**Renders:** chip grid of services Oto narrowed to. "Other" expands to a search.
**Input:**
```json
{
  "title": "Which service?",
  "service_ids": ["svc_brake_pads", "svc_brake_fluid", "svc_brake_inspection"]
}
```
**Tool result:** `{ "service_id": "svc_brake_pads" }`.

### 3.5 `prompt_select_timeslot`
**When:** user is booking and shop has surfaced available windows.
**Renders:** day picker + time chips for the selected day.
**Input:**
```json
{
  "shop_id": "sh_2",
  "available_slots": [
    { "start": "2026-05-02T14:00:00Z", "end": "2026-05-02T15:00:00Z" },
    { "start": "2026-05-02T16:00:00Z", "end": "2026-05-02T17:00:00Z" }
  ]
}
```
**Tool result:** `{ "slot_start": "2026-05-02T14:00:00Z" }`.

### 3.6 `confirm_booking`
**When:** all booking fields are gathered. **Mandatory before any `bookings` insert.**
**Renders:** full-bleed sheet — vehicle row, shop row, mechanic row, service row, time row, cost range row. "Confirm" + "Edit" buttons.
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "shop_id": "sh_2",
  "mechanic_id": "mc_1",
  "service_id": "svc_oil_change",
  "slot_start": "2026-05-02T14:00:00Z",
  "estimated_cost_low": 65,
  "estimated_cost_high": 95,
  "currency": "USD",
  "notes": "Synthetic oil only"
}
```
**Tool result:** `{ "confirmed": true }` → Oto runs `insert_doc` and reads back. Or `{ "confirmed": false, "edit": "shop" }` to bounce back to a picker. Or `{ "cancelled": true }`.

### 3.7 `show_booking_summary`
**When:** after a successful booking write, or when user asks "what did I book."
**Renders:** read-only confirmation card — booking ID, all fields, "Add to calendar" + "Cancel" buttons.
**Input:**
```json
{ "booking_id": "bk_789" }
```
**Tool result:** none required (informational); optionally `{ "action": "cancel" | "calendar" }`.

### 3.8 `show_maintenance_schedule`
**When:** "what's due", "what should I service next."
**Renders:** stacked list — overdue (red), due_soon (amber), upcoming (gray). Each row tappable to start a booking flow.
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "items": [
    { "service_id": "svc_oil_change", "label": "Oil change", "status": "overdue", "miles_since_due": 320 },
    { "service_id": "svc_tire_rotation", "label": "Tire rotation", "status": "due_soon", "miles_until_due": 200 }
  ]
}
```
**Tool result:** `{ "tapped_service_id": "svc_oil_change" }` — kicks off a booking flow.

### 3.9 `show_health_score`
**When:** "how's my car doing", or auto-shown when score changed materially since last session.
**Renders:** big circular score, top-3 contributing factors, "see breakdown" link.
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "score": 82,
  "delta_30d": -4,
  "factors": [
    { "label": "Brake pads", "impact": -6 },
    { "label": "Oil overdue", "impact": -8 },
    { "label": "Tires", "impact": +2 }
  ]
}
```
**Tool result:** none.

### 3.10 `show_cost_estimate`
**When:** user asked "how much would X cost" without booking yet.
**Renders:** range bar (low/high), breakdown rows (parts, labor, shop's rate), an "OEM parts" tag on the breakdown, and a **mandatory** "Book this" CTA. Cost answers are funnels — pair this card with a booking offer in the same or next turn.
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "service_id": "svc_brake_pads",
  "shop_id": "sh_2",             // optional — if absent, app shows "median in your area"
  "parts_kind": "OEM",           // we only quote OEM; aftermarket isn't supported
  "labor_hours": 1.5,
  "labor_rate_low": 110,
  "labor_rate_high": 145,
  "parts_low": 80,
  "parts_high": 220,
  "total_low": 245,
  "total_high": 437.5,
  "currency": "USD"
}
```
**Tool result:** `{ "action": "book" | "compare_shops" | "dismiss" }`. On `book`, Oto's next turn must kick off the booking flow with `service_id` pre-selected. On `dismiss`, drop the topic — but Oto may surface a single soft re-offer later if context calls for it.

### 3.11 `show_vehicle_specs`
**When:** "what engine does my car have", "what's my towing capacity."
**Renders:** spec card with sections (Engine, Transmission, Trim).
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "sections": [
    { "title": "Engine", "rows": [["Displacement", "2.0L"], ["Horsepower", "158 hp"]] },
    { "title": "Transmission", "rows": [["Type", "CVT"]] }
  ]
}
```
**Tool result:** none.

### 3.12 `show_service_history`
**When:** "what have I had done", "when was my last oil change."
**Renders:** vertical timeline.
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "items": [
    { "date": "2026-02-14", "label": "Oil change", "shop_name": "Joe's Auto", "cost": 72 }
  ]
}
```
**Tool result:** none.

### 3.13 `show_diagnostic_summary`
**When:** user described a symptom and Oto has reasoned through it. (Oto LLM-diagnoses — there is no rule-based engine to hand off to.)
**Renders:** a card with the symptom restated, 1–3 ranked likely causes (each with a confidence pill and severity badge), DIY-feasibility tag, optional notes line, and — when DIY isn't trivial — a "Book inspection" CTA wired to `recommended_service_id`.
**Input:**
```json
{
  "vehicle_id": "vh_123",
  "symptom_summary": "clicking when turning the key",
  "likely_causes": [
    { "label": "Starter solenoid",  "confidence": "high",   "severity": "soon" },
    { "label": "Weak battery",      "confidence": "medium", "severity": "soon" },
    { "label": "Bad starter motor", "confidence": "low",    "severity": "soon" }
  ],
  "diy_feasibility": "shop_recommended",
  "recommended_service_id": "svc_starter_diagnosis",
  "notes": "If it gets worse or the car won't start, don't put it off."
}
```
**Tool result:** `{ "action": "book" | "more_info" | "dismiss" }`. On `book`, Oto resumes the booking flow with `recommended_service_id` pre-selected. On `more_info`, Oto follows up in prose with the next-best diagnostic question. Severity must be honest — never inflate to push a booking.

### 3.14 `prompt_quick_replies`
**When:** Oto wants to suggest 2–4 follow-up taps without making the user type.
**Renders:** chip row below the last bubble.
**Input:**
```json
{
  "chips": [
    { "id": "yes", "label": "Yes, book it" },
    { "id": "later", "label": "Maybe later" },
    { "id": "other_shop", "label": "Try a different shop" }
  ]
}
```
**Tool result:** `{ "id": "yes" }` (or free-form text if user typed instead — in which case the tool call is implicitly cancelled).

### 3.15 `prompt_add_vehicle`
**When:** user has zero vehicles, or said "I just got a new car."
**Renders:** kicks off the existing `(tell-us-about)` flow (VIN scan, plate lookup, manual).
**Input:**
```json
{ "method_hint": "vin" | "plate" | "manual" | null }
```
**Tool result:** `{ "vehicle_id": "vh_999" }` once added, or `{ "cancelled": true }`.

### 3.16 `navigate_to`
**When:** Oto needs to drop the user into another tab/screen ("show me my bookings tab").
**Renders:** issues an Expo Router push.
**Input:**
```json
{
  "route": "/(main-tabs)/bookings",
  "params": { "highlight_id": "bk_789" }
}
```
**Tool result:** none. The chat screen stays mounted; user can swipe back.

### 3.17 `confirm_action`
**When:** generic yes/no for any destructive or notable action not covered above (e.g. "cancel this booking", "remove this car").
**Renders:** modal with title, body, Confirm/Cancel.
**Input:**
```json
{
  "action_id": "cancel_booking",
  "title": "Cancel Friday's appointment?",
  "body": "Joe's Auto will be notified. You can rebook anytime.",
  "destructive": true,
  "context": { "booking_id": "bk_789" }
}
```
**Tool result:** `{ "confirmed": true }` or `{ "confirmed": false }`.

---

## 4. Stream handling

Managed agents stream both text and tool-use blocks. Suggested behavior:

1. **Text deltas** → append to the active assistant bubble in real time.
2. **`content_block_start` for `tool_use`** → if it's a known UI tool, switch the bubble into a "loading…" placeholder while the input JSON streams in.
3. **`content_block_stop`** → input JSON is now complete. Replace placeholder with the rendered component for that mode.
4. **User completes the UI** → the chat input is locked while a UI mode is active, except for `prompt_quick_replies` (typing dismisses the chips) and `navigate_to` (no input expected).
5. **Submit `tool_result`** → as a `user` turn with the structured payload. Stream resumes.
6. **Cancellation** → if the user dismisses or closes the app: send `{ "cancelled": true }`. Oto's prompt should know how to handle this.

Don't render UI modes inline if the agent is also producing prose. Show prose first (the framing line), then the UI component below the bubble.

---

## 5. Error handling

| Situation | App behavior |
|---|---|
| Tool input fails JSON-schema validation | Drop the tool_use, show a toast "Oto sent something I couldn't render", let Oto retry. |
| User has no network during a tool_result post | Queue the result; show offline indicator; resume when back. |
| Oto calls an unknown tool name | Reply with tool_result `{ "error": "unknown_tool" }`. Oto's prompt should fall back to prose. |
| Backend MCP write fails inside the tool flow (e.g. `confirm_booking` → insert fails) | App shows error state in the confirmation card; Oto's next turn must say so plainly. |

---

## 6. Versioning

Add a `mode_version` field to each tool's input schema (default `"1"`). When you ship breaking changes to a mode's component, bump the version in both the schema (in the agent config) and the renderer. Old conversations replay against the version they were authored with.

---

## 7. What lives where

| Concern | Owner |
|---|---|
| Tool schemas (names, inputs, descriptions) | Agent config — same place as MCP server config. |
| Tool handlers (rendering, user input) | App — `components/oto-chat/modes/<mode_name>.tsx`. |
| Mode catalog summary in system prompt | One paragraph appended to the system prompt: list of tool names and one-line descriptions, so Oto picks the right one without seeing full schemas. |
| Validation (Zod schemas) | `services/oto/modeSchemas.ts` (proposed) — shared between handler and runtime check. |
| Analytics on which modes fire how often | Mixpanel/Amplitude in the handler entry point. |

---

## 8. Build order (suggested)

1. `prompt_select_vehicle` + `prompt_quick_replies` — covers most ambiguous turns.
2. `show_maintenance_schedule` + `show_health_score` — the two most common reads.
3. `prompt_select_shop` + `show_cost_estimate` — pre-booking reads.
4. `prompt_select_timeslot` + `confirm_booking` + `show_booking_summary` — the booking spine.
5. `show_diagnostic_summary` — Oto's LLM-reasoned diagnosis card with the booking CTA.
6. `show_vehicle_specs` + `show_service_history` — read-only flourishes.
7. `prompt_add_vehicle` + `navigate_to` + `confirm_action` — edges.

You can ship 1–2 and have a working assistant; the rest are upgrades.

---

## 9. Open questions

- **Multi-turn UI state.** If the user starts `confirm_booking`, taps "Edit shop", we send back `{ "confirmed": false, "edit": "shop" }`. Does Oto re-call `prompt_select_shop` with the same prior context? Add an explicit recipe for this in the system prompt.
- **Persistent UI cards.** When the user scrolls back, do completed mode cards stay interactive (e.g. "Cancel" on a past booking summary)? Recommended: yes for reads, no for prompts.
- **Cross-device handoff.** If a user starts a booking on phone and continues on web, can the open `tool_use` resume? v1: no — modes are session-local. Persist only the eventual write.
- **Voice input.** If the user voices a reply that maps to a chip, the app should auto-resolve the chip rather than treating it as free text.

That's the contract. Backend doc tells Oto what to *say*; this doc tells the app what to *render* when Oto says it.
