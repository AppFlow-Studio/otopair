# Sprint 4 frontend ticket — `BookServiceComponent` (consolidates 6-stage booking flow into one mobile component)

**Date:** 2026-05-17 (Sprint 4 Day 1 Pass A — frontend scope documented; mobile-team ticket)
**Owner:** Mobile team
**Backend coordination:** Sprint 4 Pass B (Claude Code, separate dispatch). Sprint 4 Pass B lands `render_book_service` AI tool + new envelope-field `ChatMessage.bookService` + deprecates 6 old render tools. Frontend can pick up this ticket after Pass B's commit lands.

---

## §0. What this consolidates

Today's booking flow drives 7 separate UI components through 7 Oto chat turns:

1. `AIServicePicker` (rendered by `render_service_picker`)
2. `AIDiagnosticForm` (rendered by `render_diagnostic_form`)
3. Priority quick-replies (rendered by `render_quick_replies` with 3 chips)
4. Shop carousel (rendered by `render_shop_carousel`)
5. Time-slot picker (rendered by `render_time_selector`)
6. Booking confirmation card (rendered by `render_booking_confirmation`)
7. Pay-screen redirect (triggered by `navigate_to_payment`)

Sprint 4 collapses 1–6 into ONE component (`BookServiceComponent`) with sub-pages inside. Pay-screen (#7) stays as-is; the new component handles its own redirect to the existing pay-screen on final confirm.

---

## §1. The new component shape

`BookServiceComponent` accepts the `ChatMessage.bookService` envelope field (populated by Oto's `render_book_service` tool call). The payload is the entire prefill:

```ts
interface BookServicePayload {
  service_slugs: string[];           // required, ≥1. Supports multi-service bundling.
                                     // e.g. ["diagnostic_scan"] OR ["oil_change", "tire_rotation"]
  diagnostic_system?: 
    | "brakes"
    | "tires_wheels"
    | "engine"
    | "battery_electrical"
    | "not_sure";                    // present iff one of the slugs is "diagnostic_scan"
  customer_notes?: string;           // 2-3 sentence service-advisor summary
                                     // present iff diagnostic OR Oto has narrowing context to anchor
  recommended_priority?:
    | "closest"
    | "best_rated"
    | "best_price";                  // optional default mechanic-sort order
  recommended_mechanic_id?: string;  // optional pre-selected mechanic (e.g. user's preferred)
  vehicle_id: string;                // always present — the chat's anchored vehicle
}
```

The component takes over from there. **Oto never sends another booking-related render after this** — the component drives the rest internally.

---

## §2. Sub-stages inside the component (mimic existing flow)

The component has internal navigation through these sub-stages. Each sub-stage shows prefilled values (from the payload) AND lets the user override / cycle back to previous stages. The user must Confirm each sub-stage to advance.

### Sub-stage 1: Service selection (multi-select)

- Show the prefilled `service_slugs` as pre-checked
- Allow user to add additional services (multi-select chips or list)
- Allow user to remove pre-checked services
- Display: service name + canonical-catalog description + typical duration (NO PRICE — same as existing `AIServicePicker`)
- Bundling rules (let the user know): adding compatible services to one booking saves a trip; e.g. oil change + tire rotation can be done together
- "Confirm" advances to sub-stage 2

### Sub-stage 2: Service options (per-service customization)

- For each selected service, show the options (oil grade, tire size, etc.) — same as existing per-service option screens
- Pre-fill defaults where available (e.g. last-time-used oil grade for this vehicle if known)
- "Confirm" advances to sub-stage 3

### Sub-stage 3: Service notes (only if Diagnostic Scan is one of the slugs)

- Show the prefilled `customer_notes` in an editable text field
- Show the prefilled `diagnostic_system` in a dropdown (5 options) — user can change
- Pattern matches existing `AIDiagnosticForm` behavior
- "Confirm" advances to sub-stage 4
- **If no diagnostic_scan slug:** skip this sub-stage entirely; auto-advance to sub-stage 4

### Sub-stage 4: Mechanic selection

- Show mechanics sorted by `recommended_priority` (defaults to `best_rated` if Oto didn't specify)
- Pre-highlight `recommended_mechanic_id` if Oto specified one (e.g. user's preferred mechanic)
- User can change sort order via existing priority chips (Closest / Best rated / Best price)
- Tap a mechanic card to select
- Component pulls mechanic data + pricing in real-time from Convex (same query pattern as existing `AIShopCarousel`)
- "Confirm" advances to sub-stage 5

### Sub-stage 5: Date/time selection

- Show available slots for the selected mechanic + service combo
- Use existing time-slot query (same as `AITimeSelector`)
- "Confirm" advances to sub-stage 6

### Sub-stage 6: Booking confirmation (review summary)

- Show full summary: each service + chosen options + customer notes (if any) + selected mechanic + chosen slot + total price (composed from real-time Convex queries — same as existing `AIBookingConfirmation`)
- Two buttons: `Edit` (returns to whichever sub-stage user taps) + `Book & Pay`
- `Book & Pay` → invokes the existing booking creation mutation AND immediately redirects to the existing pay-screen route (same redirect path that `navigate_to_payment` previously triggered: `/home/mechanic/{mechanic_id}/payment`)

---

## §3. Back-navigation rules

- Sub-stage 1 → 6: forward-only via "Confirm" but each sub-stage has a back arrow / "Edit" button
- User can ALWAYS jump back to any prior sub-stage and re-edit
- Re-confirming a prior sub-stage walks forward through the subsequent sub-stages (re-using their prior selections unless those selections become invalid — e.g. if user changes mechanic, the previously-selected time slot may be invalid → component clears it + re-runs sub-stage 5)
- "Dismiss" button at top: closes the component entirely; the chat conversation resumes (Oto's next turn would see `<conversation_state>` reflect the abandoned booking)

---

## §4. Multi-service rules

When `service_slugs` has more than one entry (e.g. `["oil_change", "tire_rotation"]`):

- Sub-stage 1: show both services as pre-checked
- Sub-stage 2: collect options for each service (one option screen per service, tabbed or stacked)
- Sub-stage 3: notes step applies only if `diagnostic_scan` is one of the slugs; multi-service bookings WITHOUT diagnostic skip this sub-stage
- Sub-stage 4–5: mechanic + time-slot apply to the bundle as a whole (one mechanic, one time slot for all services)
- Sub-stage 6: confirmation card shows the bundled summary with individual service line items + bundled total

If the user removes a service in sub-stage 1, subsequent sub-stages adapt (e.g. removing diagnostic_scan skips the notes sub-stage).

---

## §5. Coordination with backend

- The `render_book_service` AI tool is registered in Sprint 4 Pass B (Claude Code dispatch). After Pass B's commit lands on `waleed-dev-oto`, the dispatcher routes the tool call into `ChatMessage.bookService` — a new field on the assistant message envelope.
- The mobile chat-message rendering layer needs to detect `bookService` field presence and route to `BookServiceComponent` (just like it currently detects `showServicePicker`, `showDiagnosticForm`, etc.).
- All 6 deprecated envelope fields (`showServicePicker`, `pickerServices`, `pickerPreSelectedId`, `showDiagnosticForm`, `shopCarousel`, `timeSelector`, `bookingConfirmation`, and the navigation intent for payment) become deprecated/unused. Mobile team can remove the corresponding render branches in the chat-message detection logic.
- Backend creation mutation for bookings is unchanged (the `bookings` table schema supports `service_ids: Id<"services">[]` arrays — multi-service is schema-native).

---

## §6. Migration / fallback

Sprint 4 Pass B will SUPPRESS the 6 deprecated render tools from `chat.ts:TOOL_NAMES_V1`, so Haiku will NOT fire them post-deploy. If for some reason Haiku does fire a deprecated tool name (e.g. an old conversation context), the dispatcher will return `unknown_tool` and Haiku will fall back to text-only response. No crash; just a degraded experience for that turn.

---

## §7. Definition of done

- `BookServiceComponent` renders when `ChatMessage.bookService` is present
- All 6 sub-stages work with prefill + user override
- Multi-service bundling works (e.g. `["oil_change", "tire_rotation"]` shows both pre-checked)
- Diagnostic-scan scenario: sub-stage 3 (notes) shows the prefilled `diagnostic_system` + `customer_notes`; user can edit
- Final `Book & Pay` button invokes booking-creation mutation + redirects to pay-screen
- Back-navigation works at every sub-stage
- Dismiss closes the component and resumes the chat conversation
- Old render-branch detection code for the 6 deprecated tools can be safely removed (or left as dead code if mobile team prefers a slower deprecation)

---

## §8. Open coordination questions for mobile team

1. **Multi-service shop matching:** when `service_slugs` has 2+ services, the available-mechanic query needs to intersect mechanics that offer ALL the selected services. The existing `shop_services` table indexes shop→service; the component's sub-stage 4 query needs `mechanics WHERE shop_id IN (shops offering ALL service_slugs)`. Existing convex query helpers may already do this; if not, a small backend query addition is needed.
2. **Slot availability with bundling:** does the slot picker show the SHORTEST combined-duration slot, or the user's preferred time and the shop fits it in? Mobile team's call.
3. **Booking-row creation:** confirm that calling `api.bookings.create` (or whichever the team's mutation is named) with `service_ids: [id1, id2]` works as a multi-service booking. Schema supports it; verify the mutation handler.
4. **Dismiss vs Abandon telemetry:** the analytics team may want a signal when user dismisses mid-flow (sub-stage 3 abandoned vs sub-stage 5 abandoned, etc.). Outside MVP scope.

---

## §9. Synthetic-first-message removal (still pending mobile-team work)

Separately and independently: per Sprint 3 Day 4 §15.12, the synthetic "I'd like to confirm my X car" first message injection should be removed from the chat-open flow. Backend is ready; this is mobile-team work only. The car-picker UI selects a vehicle (purely frontend state), then the user types and sends their first REAL message. The existing `vehicleVin` arg on `sendMessage` already carries the vehicle context.

— End of ticket.

**Backend Pass B status (updated 2026-05-17):** LANDED at commit `709a445` ("Sprint 4 Day 1 Pass B: booking-flow consolidation (render_book_service)"). Composite prompt advanced to v0.19-stable+v0.15-volatile. Eval case count 97 → 103. `ChatMessage.bookService` envelope field live; 6 deprecated render envelope fields removed. Mobile team is unblocked.

**Pass C (verification) pending:** convex codegen + smoke eval with fresh JWT (Claude Code, separate dispatch). Does not block mobile-team work on this ticket.
