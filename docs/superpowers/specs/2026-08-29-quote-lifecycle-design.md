# Quote Lifecycle and Checkout Protection Design

## Goal

Keep submitted tire and rotor quotes visible to shops, allow cancellation and
requote, and prevent expiry, cancellation, or modification from producing a
stale mobile checkout. Once Review & Pay starts, the selected quote revision
and slot remain immutable until the existing checkout timer expires or the
customer exits.

## Lifecycle

Each quote response has an internal revision (legacy rows default to revision
1), `expires_at`, optional `modified_at`, and optional `cancelled_at`. Revision
is never customer-facing. Requote updates the existing response atomically,
increments its revision, and grants a fresh ten-minute lifetime. Cancellation
marks the response unavailable without deleting its history.

An active `slot_holds` row records the exact tire or rotor response and its
revision when the customer enters Review & Pay. Cancel and requote queries and
mutations treat that active, unexpired hold as a lock. The mutation recheck is
authoritative, so a stale web form cannot overwrite a newly protected quote.
Acceptance may use an otherwise expired response only when the supplied slot
hold is active, customer-owned, and matches that exact response revision.

## Web behavior

The Quotes page keeps the shop's response visible while the request remains a
quote-stage booking and labels it Pending Quote, Expired, or Cancelled. Pending
rows offer Cancel Quote and Requote. Expired and cancelled rows remain visible
as history.

Clicking a tentative quote event in Schedule Day view opens a Booking
Detail-style panel containing the original request, vehicle, entered parts and
prices, mechanic, offered date/time, duration, total, expiry, and status. The
panel owns Cancel Quote and Requote. Requote reuses the existing form with
saved values prefilled. If the customer obtains a Review & Pay hold while that
form is open, the form closes without saving and an existing web dialog pattern
explains that changes are unavailable. Cancel and Requote are disabled while
held, with a hover explanation, and the server rejects race-condition writes.

## Mobile behavior

Mobile carries the internal response revision in booking state but never
renders it. It validates the response before leaving the quote list and again
when acquiring the Review & Pay hold. Structured reasons drive these messages:

- Expired: the quote is unavailable; create a new quote request.
- Cancelled: select another quote or create a new quote request.
- Modified: route to the Bookings Quotes tab and select the updated quote.

Modified validation routes back to the Quotes tab while displaying the shared
bottom-sheet treatment. Cancelled and expired validation use the same sheet
without exposing internal lifecycle fields. After Review & Pay begins, the
active checkout hold protects price, revision, and slot until the timer ends or
the screen is exited.

## Repository boundary

All schema, `convex/`, and `lib/` changes live only in
`G:/GitHub/otopair-web`. Mobile changes in `G:/GitHub/otopair` are limited to
screens, components, stores, and tests.
