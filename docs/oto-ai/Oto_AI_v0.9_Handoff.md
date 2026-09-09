# Oto AI v0.9 — Session Handoff

| | |
|---|---|
| **For** | Next Claude session continuing Oto AI work |
| **From** | Claude (Cowork mode, this session) |
| **State** | Full 6-stage booking flow chain wired and verified live. Pricing architecture corrected (Oto never composes price data — frontend queries Convex). Sonnet cascade scaffolding in place (calibration target 15-25% diagnostic turns). |
| **Founder** | Waleed Mansour |
| **Canonical reference** | `docs/oto-ai/` |

---

## Read this first

Runtime is source of truth: `convex/oto/system_prompt.ts`. The markdown in `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` carries a v0.9 changelog table in the header; the body below the header is a v0.6 snapshot kept for historical reference, NOT runtime.

Open the harness with `npx serve scripts` → `http://localhost:3000/oto-harness.html`.

**Waleed's operating preferences** (locked across sessions):
1. One task per prompt
2. Direct answers, no padding
3. Push back when you disagree
4. Don't over-engineer — most bugs are one line
5. Investigation before implementation
6. Use existing Convex patterns

---

## v0.9 — what shipped this session

### Booking flow (the lead feature)

The 6-stage chain from `services/ai/scenarios.ts`, now wired into Oto's render-tool surface and validated end-to-end:

| Stage | Render tool | What Oto passes | What the mobile component does |
|---|---|---|---|
| 1. service_selection | `render_service_picker` | `pre_selected_id`, optional `services[]` (no price field — removed) | Renders catalog with Oto's recommendation highlighted |
| 2. diagnostic_form | `render_diagnostic_form` | `diagnostic_system`, `customer_notes` (Decision B mapping + Decision C free-form) | Pre-filled form; user edits + submits |
| 3. priority_selection | `render_quick_replies` | `[Closest, Best rated, Best price]` buttons | User taps one |
| 4. shop_selection | `render_shop_carousel` | `service_slug` + `priority` ONLY | **Component queries Convex for mechanics + renders them with real prices/ratings/availability — Oto never composes mechanic data** |
| 5. time_selection | `render_time_selector` | `mechanic_id` + `service_slug` ONLY | Component queries Convex for slots |
| 6. confirmation | `render_booking_confirmation` | `service_slug` + `mechanic_id` + `slot_id` + `vehicle_id` ONLY | Component renders summary with real Convex pricing; **the "Confirm Booking" button on the card triggers the mobile frontend's redirect to /home/mechanic/{id}/payment — Oto is NOT involved past stage 6** |

The booking flow is intentionally trigger-only. Oto's job is intent + IDs; the mobile components own data and pricing entirely.

**Live verification:** 6/6 stages fire correctly via the harness with conversation state advancing through `last_intent` values (`booking_service_selection` → `booking_diagnostic_form` → `booking_priority` → `booking_shop_selection` → `booking_time_selection` → `booking_confirmation`).

### Pricing rule (the founder-stated principle)

> *"We never quote a full service price, only part prices if the user explicitly asks, because every mechanic in different areas has different rate of labor."*

Codified in:
- `render_service_picker` schema — `price` field REMOVED from service entries
- `render_shop_carousel` schema — trigger-only (no shop array, no price data)
- `render_time_selector` schema — trigger-only (no slot data)
- `render_booking_confirmation` schema — trigger-only (no servicePrice/platformFee/total)
- Prompt rule (`# Pricing` section) — banned phrasings, exceptions for parts-only spec questions, "route through booking flow" pattern when user asks "how much"

### Other prompt rules added in v0.9

- **Confirm = execute** with explicit confirmation tokens list (`yeah`, `yes`, `yep`, `pull it up`, `do it`, etc.). After user confirmation, Haiku MUST call the relevant render tool, not re-ask.
- **Tool-finding narrowing flow** — when `get_vehicle_health` flags a warning light, ask about user's experience BEFORE offering Diagnostic Scan. Same Decision A protocol, applied to tool findings.
- **IDs come from `<conversation_state>`, NEVER from user text** — users tap cards, frontend pushes selections into `established_facts` via `ai_conversations:appendEstablishedFact`. Haiku reads IDs from there.
- **User is booker, not doer** — banned phrasings list (no `"when you change the oil"`, no `"after you bleed the brakes"`). Correct: `"when it gets serviced"`, `"the shop will use X"`.
- **No system narration** — banned phrasings list (no `"the lookup"`, no `"the catalog"`, no `"let me search"`).
- **Sonnet escalation rules** — when to escalate (deep narrowing, cross-tool, legal-adjacent, polite-exit, multi-vehicle KB-miss); when NOT to (single-fact, routine booking, refusals); calibration target.

### Backend additions

- **`ai_conversations.current_model`** column — per-conversation model routing for Sonnet cascade.
- **`ai_conversations:setCurrentModel`** mutation — Haiku/Sonnet routing tool calls hit this.
- **`ai_conversations:appendEstablishedFact`** mutation — mobile frontend calls when user taps a card; pushes selected IDs into `established_facts` so the next turn sees them in `<conversation_state>`.
- **`request_sonnet_handoff`** / **`request_haiku_handback`** tools — model_routing category, side-effect dispatch (don't gate loop).
- **Per-turn model selection in chat.ts** — reads `current_model`, switches between `HAIKU_MODEL` (claude-haiku-4-5-20251001) and `SONNET_MODEL` (claude-sonnet-4-6).

### Bug fixes in this push

1. **`render_diagnostic_form` rendered too early** — Oto used to skip from "user wants Diagnostic Scan" straight to the form. Fix: prompt teaches the 6-stage chain; `render_service_picker` fires first.
2. **`String(undefined)` validation crash on `record_vehicle_fact`** — fixed; callable now defaults source/topic_axis to safe values when Haiku omits them, skips write entirely if essential fields missing.
3. **Loop swallowed text when `record_vehicle_fact` was a "data" tool** — moved to "state" category (already in v0.8 handoff, re-verified live).
4. **`navigate_to_payment` over-extended Oto's role** — removed from `TOOL_NAMES_V1`. Stage 6 is Oto's last turn for any booking flow; mobile component handles payment redirect.
5. **Empty-text fallback fired on render-only turns** — fixed by extending the no-text-no-render guard to consider ALL render directives (not just quickReplies + showDiagnosticForm).

### Harness updates

- Render-tool preview cards updated for all the new trigger-only shapes (`shopCarousel`, `timeSelector`, `bookingConfirmation`)
- `pickerPreSelectedId` displayed in service picker preview
- Service picker preview no longer shows price (since the field is removed)

---

## Open issues / pending work

### Cap counter (Locked Principle #7 — explicitly deferred to "finalization" per founder)

Schema field + monthly reset + envelope budget + prompt template. Not built this session per founder direction. Build when launch prep starts.

### Eval baseline

Last measured: 7/8 passing in v0.8. Eval cases not re-run against v0.9 (the booking flow changes don't intersect the eval cases). Future session should refresh.

### Persistent Haiku ceiling issues (Sonnet calibration targets)

Two loopholes have resisted prompt-only fixes across v0.7 / v0.8 / v0.9:

1. **Cause-speculation enumeration** ("low coolant, a thermostat issue, or something else in the cooling system") on warning-light findings.
2. **Decision A direct-service slip** — Haiku sometimes recommends Brake Pad Replacement direct on `on_time` brakes.

Both are documented Sonnet cascade calibration targets. Sonnet escalation rule in the prompt should pick these up via the "deep diagnostic narrowing" trigger.

### Catalog data thin

Only the user's M550i + a small set of BMW configs in `vehicle_configs`. Comparison-car lookups for popular cars (M5, M3, Tesla Model 3, Mercedes C63) return empty and fall back to web_search. Phase 2 RAG-seed should populate the top 5 makes.

### Real mobile-frontend integration

`appendEstablishedFact` mutation exists. Mobile components need to call it when the user taps a card. Without that integration, the harness simulation works (typing the ID) but real mobile usage would lose IDs across turns.

Implementation TODO for mobile:
- AIShopCarousel tap handler → `appendEstablishedFact({ id: convoId, fact: "selected mechanic_id: " + id })`
- AITimeSelector tap handler → same for slot_id
- AIServicePicker confirm → `appendEstablishedFact({ id: convoId, fact: "selected service_slug: " + slug })` if user changed the pre-selected

### Phase 2 still pending

- Streaming responses (first-token <600ms)
- RAG seed for top 5 makes
- TestFlight calibration data → tune Sonnet escalation thresholds

---

## File map — v0.9 changes

```
convex/schema.ts                                  [MOD]  +current_model on ai_conversations
convex/ai_conversations.ts                        [MOD]  +setCurrentModel, +appendEstablishedFact mutations
convex/oto/system_prompt.ts                       [MOD]  v0.9 — booking flow chain, pricing rule, Sonnet cascade, ID/state rules
convex/oto/tools.ts                               [MOD]  trigger-only schemas for shop_carousel/time_selector/booking_confirmation; pre_selected_id on service_picker; +MODEL_ROUTING_TOOLS (request_sonnet_handoff, request_haiku_handback); price field removed from service picker
convex/oto/chat.ts                                [MOD]  +HAIKU_MODEL/SONNET_MODEL constants, per-turn model selection from current_model field; +Sonnet cascade callables; +state category covers model_routing; +pickerPreSelectedId in return; +render trigger fields surface in return
convex/oto/dispatcher.ts                          [MOD]  shop_carousel/time_selector/booking_confirmation reshaped to trigger-only; pickerPreSelectedId added
scripts/oto-harness.html                          [MOD]  trigger preview cards; pickerPreSelectedId display
docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md     [MOD]  v0.9 changelog row, header version bump
docs/oto-ai/Oto_AI_v0.9_Handoff.md                [NEW]  this document
```

---

## Footguns

1. **`record_vehicle_fact` and Sonnet routing tools are STATE-CATEGORY.** If you re-categorize as data, text-emitted-alongside gets swallowed. Keep in `STATE_TOOL_CALLABLE_NAMES`.

2. **`web_search` is server-managed.** Don't add it to `OTO_TOOL_CATEGORY`. It's in `SERVER_MANAGED_TOOLS` only. The invariant check exempts it.

3. **Render schemas are trigger-only past stage 1.** Oto NEVER composes mechanic / slot / pricing data for shop_carousel / time_selector / booking_confirmation. The mobile component owns data. If a future Claude wants to "be helpful" by pre-fetching shops via `get_my_mechanics` and passing them in, that's backwards — mobile components own this.

4. **`current_model` switch happens AT TURN START.** When Haiku calls `request_sonnet_handoff` mid-turn, the field updates but the CURRENT turn finishes on Haiku. Sonnet picks up the NEXT user turn. Don't expect mid-turn model switches.

5. **`SONNET_MODEL = "claude-sonnet-4-6"`.** The string is set per the application_details system block in this session. If a different Sonnet variant is needed, update the constant.

6. **Cap counter is deferred to finalization** per founder direction. Don't build it speculatively before then.

---

## What the next session should do

1. **Re-run the eval suite** to capture v0.9 baseline.
2. **Calibrate Sonnet cascade** — once TestFlight data lands, look at which turn types get escalated and tune the prompt rule's triggers.
3. **Mobile frontend integration** for `appendEstablishedFact` — wire AIShopCarousel/AITimeSelector tap handlers to push selected IDs into conversation state.
4. **Catalog seeding** — pull the top 5 makes' popular trims into `vehicle_configs` so `lookup_vehicle_spec` doesn't fall back to web_search as often.
5. **Streaming responses** (Phase 2).
6. **Cap counter** — only when launch prep begins.

---

## Sources — canonical first

- `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` (header is current; body is historical v0.6 snapshot — runtime is `convex/oto/system_prompt.ts`)
- `docs/oto-ai/oto-engine-inventory.md`
- `docs/oto-ai/handoff-addendum.md`
- `docs/oto-ai/tool-inventory.md`
- `docs/oto-ai/slug-drift-remediation.md`
- `convex/oto/system_prompt.ts` — v0.9 runtime prompt body
- `services/ai/scenarios.ts` — canonical 6-stage booking flow definitions
- `scripts/oto-harness.html` + `scripts/oto-eval-cases.json`

---

*End of handoff. v0.9 closes the booking flow architecture properly per founder direction — Oto triggers, components render, frontend redirects. Pricing entirely component-owned. Sonnet cascade ready for TestFlight calibration. Cap counter deferred to launch prep.*
