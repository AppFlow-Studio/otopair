# Quote Earliest-Slot Booking Design

## Goal

Complete tire-replacement and brake-rotor-replacement quote acceptance so a customer can either book the shop's quoted earliest appointment or choose another appointment. A quoted slot remains unavailable to every other customer while its owner can still select and book it.

## Scope

The mobile UI and navigation changes live in `G:\GitHub\otopair`. All Convex and shared backend-library changes live in `G:\GitHub\otopair-web`, as requested. The implementation must support tire and rotor quotes equally.

The mounted-tire work is outside this change. Tire Replacement may be used for verification now that its unrelated publication failure is fixed.

## Existing Behavior to Reuse

`pick-datetime` already calls `slotHolds.holdSlot` before navigating to Review & Pay. The acquired hold is stored in `useBookingStore`, and Review & Pay observes it and displays the existing countdown. The default server configuration holds the selected mechanic and window for 15 minutes.

Quote responses already identify their owner indirectly and authoritatively:

1. A tire or rotor quote response references `booking_id`.
2. That booking contains `user_id`.
3. The authenticated Clerk identity resolves to the current Convex user.

No duplicate owner field is required on quote responses or `time_slots`.

## Quote-Sheet Availability Check

Opening the quote sheet triggers its existing quote-response query. The query will also calculate whether each response's quoted mechanic/date/time is still bookable.

The check must:

- validate that the authenticated customer owns the response's booking;
- inspect shop hours, mechanic activity, confirmed bookings, manual blocks, other live quote holds, and active checkout holds;
- ignore only the quote response currently being evaluated, because that response is the customer's own persistent quote hold;
- use the response's estimated duration, with the existing fallback when absent;
- apply identically to tire and rotor responses.

The current full-sheet loading state remains visible until the response data and availability result arrive. Quote cards therefore never render “Book earliest time” and then remove it after the first check.

Each quote card renders one of two states:

- Earliest slot available: “Book earliest time” and “Choose a different time.”
- Earliest slot unavailable: one “Choose time” button.

Because Convex queries are reactive, an open quote sheet can update if availability changes. The button state reflects the latest server result.

## Book Earliest Time Flow

Tapping “Book earliest time” sets the existing `quoteAcceptContext` and enters `pick-datetime` with an auto-confirm route parameter. The picker temporarily shows a loading state instead of date, time, and mechanic controls.

The picker re-runs availability for the exact quoted slot and then calls its existing confirmation path. That path atomically attempts `slotHolds.holdSlot`, stores the resolved mechanic and schedule, and navigates to Review & Pay. This reuses the same holding and payment handoff as manual slot selection.

The hold request must carry the quote type and response identifier. Convex may ignore the response's persistent quote hold only after verifying that the authenticated customer owns its booking. A different user or an unowned response receives no exclusion and continues to see the slot as blocked.

The final quote-acceptance mutation receives the existing checkout hold ID and session ID. It validates and consumes that hold transactionally while confirming the booking, so the customer does not conflict with their own checkout hold and the hold cannot linger after success.

## Second-Check Failure

Availability can change between rendering the quote card and tapping its button. If the auto-confirm check or atomic hold attempt fails:

1. The app remains on `pick-datetime` and exposes the normal date, time, and mechanic controls.
2. A `FloatingSheet` opens automatically using the same shared sheet foundation, backdrop, and interaction style as `BookingDetailsSheet`.
3. The message explains that the quoted time is no longer available and asks the customer to choose another date, time, or mechanic.
4. Dismissing the sheet leaves the customer in the picker with no stale auto-confirm retry.

Suggested copy:

> That time is no longer available
>
> The shop's earliest appointment was just taken. Choose another date, time, or mechanic to continue.

The normal manual picker error behavior remains unchanged outside the auto-confirm path.

## Choose a Different Time Flow

“Choose a different time” uses the current quote picker flow. Availability hooks receive the selected quote response context so the owner's quoted slot appears among the choices while remaining hidden from other customers.

If the customer chooses the originally quoted slot manually, the same authenticated exclusion and atomic checkout hold apply. If the customer chooses another slot, the new slot receives the short-lived checkout hold while the original quote response continues protecting the quoted slot until acceptance, cancellation, supersession, or expiration.

## Backend Availability Model

The existing tire-only quote-hold projection in `convex/lib/timeSlotAvailability.ts` becomes a shared tire-and-rotor quote-hold projection. Both response tables contribute active holds when:

- the response is not superseded;
- the response is not expired;
- it names a mechanic;
- its booking is still `pending_quote` or `quotes_ready`.

Availability functions accept an optional, server-authorized quote-response exclusion. The exclusion is never trusted solely because a client supplied an ID.

Tire and rotor response creation both validate the proposed mechanic window before inserting the response. This prevents a shop from creating a new persistent quote hold on a window that is already unavailable.

Quote acceptance also verifies that the authenticated customer owns the booking before changing its status, pricing, mechanic, or schedule.

## Error Handling

- A stale earliest slot produces the picker plus explanatory sheet, not a payment screen.
- A race during atomic hold acquisition follows the same picker-plus-sheet recovery.
- An invalid or unowned quote context never unlocks a held slot.
- If the normal manually chosen slot becomes unavailable, the existing inline/toast behavior remains in place.
- Payment preauthorization failure continues using the existing Review & Pay error path.

## Expected Code Areas

Mobile repository (`G:\GitHub\otopair`):

- tire and rotor quote cards;
- tire and rotor quote-list sheets;
- `pick-datetime`;
- availability hooks used by the picker;
- quote-confirmation argument wiring;
- focused mobile regression tests.

Web/backend repository (`G:\GitHub\otopair-web`):

- tire and rotor quote-response queries and creation validation;
- `convex/time_slots.ts`;
- `convex/slotHolds.ts`;
- `convex/bookings.ts`;
- `convex/lib/timeSlotAvailability.ts`;
- focused Convex availability and quote-acceptance tests.

No generated Convex files will be edited manually.

## Verification

Automated coverage must demonstrate:

- tire and rotor quote holds block other customers;
- the authenticated booking owner can see only the selected response's held slot as available;
- another authenticated customer cannot use a supplied response ID to unlock it;
- the first quote-sheet check controls whether one or two buttons render;
- “Book earliest time” rechecks and reaches Review & Pay with the correct date, time, and mechanic;
- a second-check conflict opens the picker and explanatory `FloatingSheet`;
- “Choose a different time” still follows the manual flow;
- quote acceptance consumes the caller's valid checkout hold;
- tire and rotor price fields continue coming exclusively from the server response;
- TypeScript, lint, relevant unit tests, and Convex validation pass in the appropriate repositories.

Manual verification should exercise both Tire Replacement and Brake Rotor Replacement with two customer accounts or devices: the quote owner can select the held slot, while the other customer cannot see or acquire it.
