# Oto render-component frontend handoff — Sprint 4

**Date:** 2026-05-17
**For:** Mobile team
**Backend state:** Sprint 4 Day 2 EOD. Composite prompt `v0.23-stable+v0.17-volatile`. 34 live tools (8 render, 15 data, 6 state, +5 cached supporting). All 21 CI invariants clean.

This document inventories every render tool Oto can fire, the envelope field it produces, the mobile component that consumes it, and the known fixup items to address before Sprint 4 ships.

---

## 1. `render_book_service` — Booking flow (CONSOLIDATING)

**Oto fires when:**
- Symptom narrowing converges on diagnostic scan
- Vehicle health flags a service AND symptom matches it
- User explicitly asks ("I want an oil change", "book brake service")
- User bundles services ("oil change AND tire rotation")
- User confirms "yes/sure/go ahead" after Oto offered to book
- 6 unconverged narrowing turns → polite-exit with `diagnostic_system: "not_sure"`

**Envelope field:** `message.bookService`

**Payload shape:**
```ts
{
  service_slugs: string[];           // required, ≥1 — canonical snake_case slugs from OTOPAIR_SERVICE_SLUGS
  diagnostic_system?:                // only when "diagnostic_scan" ∈ service_slugs
    | "brakes" | "tires_wheels" | "engine" | "battery_electrical" | "not_sure";
  customer_notes?: string;           // 2-3 sentence service-advisor summary
  recommended_priority?:             // optional default mechanic-sort order
    | "closest" | "best_rated" | "best_price";
  recommended_mechanic_id?: string;  // optional pre-selected mechanic
  vehicle_id: string;                // always present (chat's anchored car)
}
```

**Mobile component:** `components/ai-chat/BookServiceComponent.tsx` → `BookServiceComponent`

**Sub-stages (mobile-owned, NO further Oto turns):**
1. Service selection (multi-select chips, prefilled from `service_slugs`)
2. Per-service options (oil grade, tire size, etc.)
3. Service notes (only if `diagnostic_scan` is one of the slugs — `customer_notes` + `diagnostic_system` editable)
4. Mechanic selection (sorted by `recommended_priority`, default `best_rated`; pre-highlight `recommended_mechanic_id`)
5. Date/time picker (queries mechanic+service slots from Convex)
6. Booking confirmation summary
7. "Book & Pay" → booking-creation mutation → redirect to `/home/mechanic/{mechanic_id}/payment`

**Known fixup items:**
- **Multi-service shop matching:** when `service_slugs.length > 1`, mechanic query must intersect shops offering ALL slugs (`mechanics WHERE shop_id IN (shops offering ALL service_slugs)`). Backend helper may not exist yet — verify.
- **Slot bundling:** does the slot picker show shortest combined-duration slot, or user's preferred time and shop fits it in? Mobile-team call.
- **`api.bookings.create` multi-service:** confirm the mutation handles `service_ids: [id1, id2]` array. Schema supports it; verify the handler.
- **Dismiss vs Abandon telemetry:** signal when user dismisses mid-flow (which sub-stage). Out of MVP.
- **Back-navigation invalidation:** if user changes mechanic on sub-stage 4, the previously-selected time slot may be invalid → clear it and re-run sub-stage 5.

---

## 2. `render_record_confirmation` — Trust-protocol gate

**Oto fires when:**
- User-described symptom contradicts a `self_reported` maintenance record from `get_vehicle_health`. Example: user reports brake squeal but brakes show `on_time` from 3 months ago.
- NEVER fires for `verified` (booking-backed) or `inferred` (no record) items.

**Envelope field:** `message.showRecordConfirmation`

**Payload shape:**
```ts
{
  vehicle_id: string;            // Convex vehicles._id
  maintenance_type: "oil" | "brakes" | "tires" | "battery" | "inspection";
}
```

**Mobile component:** `components/ai-chat/AIRecordConfirmation.tsx` → `AIRecordConfirmation`

**Behavior:**
- Queries `api.oto.recordConfirmation.getRecordForConfirmation` with `(vehicle_id, maintenance_type)`
- Renders: "Last <type> service: <date>, <mileage> mi"
- Two buttons: **[Yes, that's right]** and **[No, update it]**
- **Confirm path:** stamps `confirmedHealthyAt: Date.now()` via upsertRecord (locks status to `on_time` for 90 days per `CONFIRMED_HEALTHY_TTL_MS`)
- **Update path:** inline date+mileage form → submit → upsertRecord with `serviceSource: "ai_chat_correction"`, `confidence: "self_reported"`
- Either way: decision pushed back into `conversation_state` via `appendEstablishedFact` so Oto sees it on next turn

**Callback:** `onDecision: (decision: RecordConfirmationDecision) => void`

**Known fixup items:**
- **`onDecision` payload shape** — verify the union type covers `{ kind: "confirmed" }` AND `{ kind: "updated", date, mileage }`. Both need to flow through to the next user-turn synthetic message so Oto reacts.
- **Loading state** — the Convex query is async; the component must handle "record not found" gracefully (Oto shouldn't have fired the gate if there's no record, but be defensive).
- **Failure handling** — `console.warn("[AIRecordConfirmation] confirm failed", err)` is present but no user-visible recovery. Add a retry or toast.

---

## 3. `render_link_button` — App-navigation redirect

**Oto fires when:** user asks to go to one of 9 in-app screens.

**Envelope field:** `message.linkButton`

**Payload shape:**
```ts
{
  destination:
    | "terms_of_service" | "privacy_policy"      // in-app browser
    | "settings" | "profile"                      // account screens
    | "transaction_history"                       // payments ledger
    | "customer_support" | "feedback" | "bug_report"  // support
    | "vehicle_onboarding";                       // explicit-only add-car flow
  label?: string;                                 // optional override (default = "Open Settings", etc.)
}
```

**Mobile component:** `components/ai-chat/OtoRenderTools.tsx` → `LinkButton`

**Behavior:**
- Tap-to-open button with `label` (or destination default)
- On tap:
  - `terms_of_service` / `privacy_policy` → in-app browser
  - All others → deep-link navigation to the corresponding screen

**Known fixup items:**
- **`vehicle_onboarding` route:** confirm the deep-link target is the actual onboarding entry (VIN entry → decode → Smartcar OAuth → ownership confirmation), not a settings sub-page.
- **`transaction_history` route:** confirm this points to the billing-history screen, not a generic "payments" page. (Discrimination clause vs service-history `get_bookings(completed)` lives in the prompt.)
- **Default labels:** confirm the 9 destination → default-label mapping is in the component (`"Open Settings"`, `"Open Privacy Policy"`, etc.) and matches Oto's prompt expectations.

---

## 4. `render_booking_card` — Single-booking detail

**Oto fires when:** user asks about ONE specific upcoming/recent appointment ("what's my next appointment?", "when's my booking with Carlos?").

**Workflow:** Oto first calls `get_bookings(status_filter: "active", limit: 1)` or `get_pending_bookings` to obtain the id, THEN fires `render_booking_card(booking_id)`.

**Envelope field:** `message.bookingCard`

**Payload shape:**
```ts
{
  booking_id: string;   // Convex bookings._id
}
```

**Mobile component:** `components/ai-chat/OtoRenderTools.tsx` → `BookingCard`

**Behavior:**
- Component queries Convex for the booking row using `booking_id`
- Renders: shop name, mechanic, scheduled date/time, service names, status

**Known fixup items:**
- **Convex query helper:** confirm there's a `useQuery(api.bookings.getById, { id })` or equivalent that returns the populated row (shop name, mechanic name, services). If only id-keyed `get` exists, may need a `getBookingForCard` query that joins shops + mechanics + service slugs.
- **Status presentation:** Oto's prose may say "confirmed" / "pending" — verify the card displays the same wording, not internal enum codes.
- **Tap-to-deep-link:** does tapping the card open the booking detail screen? If yes, define the route.

---

## 5. `render_bookings_list` — Multi-booking list

**Oto fires when:** user asks about MULTIPLE bookings ("show me all my upcoming bookings", "what's coming up?").

**Workflow:** Oto first calls `get_bookings(status_filter: "active")` (or `get_pending_bookings`) → fires `render_bookings_list(booking_ids)`.

**Envelope field:** `message.bookingsList`

**Payload shape:**
```ts
{
  booking_ids: string[];   // min 1, max 10 enforced by schema
}
```

**Mobile component:** `components/ai-chat/OtoRenderTools.tsx` → `BookingsList`

**Behavior:**
- Component queries Convex for each `booking_id`
- Renders a vertical stack of compact booking cards

**Known fixup items:**
- **Batched query:** N=10 sequential `useQuery` calls is inefficient. Add `api.bookings.getMany({ ids: Id<"bookings">[] })` if not present.
- **Mutual exclusion with `bookingCard`:** Oto must never render both in the same turn (singular focus vs plural list). The prompt enforces it; verify the mobile detection logic doesn't double-render if both envelope fields are set (defensively log + render only one).
- **Per-card tap:** does tapping a list item open the detail card or the full booking screen?

---

## 6. `render_quick_replies` — Tap-to-send buttons

**Oto fires when:** offering 2–4 obvious next options ("Closest" / "Best rated"; "Yes" / "No"; "Reschedule" / "Cancel" / "Got it").

**Envelope field:** `message.quickReplies`

**Payload shape:**
```ts
QuickReply[] = Array<{
  id: string;
  text: string;                        // max 24 chars (schema enforced)
  value?: string;                      // optional payload sent on tap; defaults to text
  variant?: "default" | "primary" | "outline";
}>;
// minItems: 2, maxItems: 4
```

**Mobile component:** `components/ai-chat/AIQuickReplies.tsx` → rendered INSIDE `AIMessageBubble` (not a top-level branch)

**Behavior:**
- Buttons appear under the assistant prose
- Tap fires the parent's `onQuickReplySelect(reply)` callback
- Callback typically sends `reply.value ?? reply.text` as a new user turn

**Known fixup items:**
- **Disabled state after tap:** once tapped, all buttons should disable to prevent double-tap. Verify the bubble doesn't re-render them tappable on the next message.
- **Variant styling:** the schema allows `default | primary | outline` — confirm all 3 are styled and not silently fallthrough to default.
- **`value` vs `text`:** Oto may set `value: "yes_book_diagnostic"` and `text: "Yes, book it"`. The user turn that fires must use `value` (the semantic payload), not `text` (the display string).

---

## 7. `render_reasoning` — Reasoning trace

**Oto fires when:** explaining a non-trivial decision (diagnosing a symptom, choosing one service over another, scoring shops).

**Envelope field:** `message.reasoning`

**Payload shape:**
```ts
ReasoningStep[] = Array<{
  title: string;
  detail?: string;
}>;
// minItems: 1, maxItems: 5
```

**Mobile component:** `components/ai-chat/AIReasoning.tsx` → rendered ABOVE prose inside `AIMessageBubble`

**Behavior:**
- Collapsible "Why I'm saying this" panel
- Each step shows title + optional detail body
- Decorative — does not change the message's primary content

**Known fixup items:**
- **Default collapsed/expanded state:** what's the UX preference? Probably collapsed on initial render; tap to expand.
- **Empty-detail rendering:** if `detail` is omitted, render just the title bullet without a gap.
- **Streaming behavior:** if Oto's text is streaming, does the reasoning panel appear before or after the prose? Currently the typing indicator suppresses if reasoning is present (`isStreaming && reasoning.length > 0` per `app/(main-tabs)/ai-chat/index.tsx:1279`). Confirm intended.

---

## 8. `render_sources` — Source citations

**Oto fires when:** grounding a claim in retrieved data (KB chunk, NHTSA recall, manufacturer service interval).

**Envelope field:** `message.sources`

**Payload shape:**
```ts
Source[] = Array<{
  title: string;
  details?: string;
  url?: string;                        // optional source URL
}>;
// maxItems: 5
```

**Mobile component:** `components/ai-chat/AISources.tsx` → rendered BELOW prose inside `AIMessageBubble`

**Behavior:**
- Compact source list below assistant text
- `url` → tappable, opens in in-app browser
- Decorative — does not change the message's primary content

**Known fixup items:**
- **URL safety:** before opening, validate `url` is `https://` and not a deep-link or `javascript:` payload. The helper layer sanitizes Oto's payloads but defensive validation on the mobile side is cheap insurance.
- **Empty `details`:** render title only.
- **Web-search sources:** when `web_search` tool sources are surfaced, the title may be a domain-stripped string ("example.com — Article title"). Confirm the renderer wraps long titles.

---

## Cross-cutting frontend rules

### Terminal-render mutual exclusion
Only ONE of the following can be on a given assistant message — Oto's prompt enforces this AND the dispatcher rejects multiple terminals:
- `bookService` / `showRecordConfirmation` / `linkButton` / `bookingCard` / `bookingsList`

`quickReplies`, `reasoning`, `sources` are NOT terminals — they can co-exist with each other and with text-only messages, but NOT with a terminal render. Defensive frontend: if a message has both a terminal envelope field AND `quickReplies`, render only the terminal.

### Synthetic-follow-up message injection (REMOVED)
The old "I'd like to confirm my X car" auto-send on car-picker selection was REMOVED in Sprint 4 Day 1. Frontend must NOT inject any synthetic first message. The car-picker UI selects a vehicle (purely frontend state), then the user types a real first message. `sendMessage` already carries `vehicleVin` arg for context.

### Old envelope fields (CLEAN-UP CHECK)
These should NO LONGER be on `ChatMessage` after Sprint 4 cleanup. Frontend should grep and confirm zero references:
- `showServicePicker`, `pickerServices`, `pickerPreSelectedId`
- `showDiagnosticForm`
- `shopCarousel`
- `timeSelector`
- `bookingConfirmation`
- `supportForm`, `SupportFormPayload`, `SupportFormCategory`

### Dispatch order on render
The detection cascade in `app/(main-tabs)/ai-chat/index.tsx:1229+` must check terminal renders BEFORE inline renders. Recommended order:
1. `bookService` → `BookServiceComponent` (full-screen takeover)
2. `showRecordConfirmation` → `AIRecordConfirmation` (inline gate)
3. `bookingCard` / `bookingsList` → `BookingCard` / `BookingsList` (inline)
4. `linkButton` → `LinkButton` (inline)
5. Else → `AIMessageBubble` (which handles reasoning + sources + quickReplies inline with prose)

---

## Summary table

| # | Tool | Envelope field | Mobile component | Type | Status |
|---|---|---|---|---|---|
| 1 | `render_book_service` | `bookService` | `BookServiceComponent` | Terminal — full flow | LIVE (Sprint 4 Day 1) |
| 2 | `render_record_confirmation` | `showRecordConfirmation` | `AIRecordConfirmation` | Terminal — gate | LIVE |
| 3 | `render_link_button` | `linkButton` | `LinkButton` | Terminal — redirect | LIVE (9 destinations) |
| 4 | `render_booking_card` | `bookingCard` | `BookingCard` | Terminal — single card | LIVE |
| 5 | `render_bookings_list` | `bookingsList` | `BookingsList` | Terminal — list | LIVE |
| 6 | `render_quick_replies` | `quickReplies` | `AIQuickReplies` (in bubble) | Inline — non-terminal | LIVE |
| 7 | `render_reasoning` | `reasoning` | `AIReasoning` (in bubble) | Inline — non-terminal | LIVE |
| 8 | `render_sources` | `sources` | `AISources` (in bubble) | Inline — non-terminal | LIVE |
