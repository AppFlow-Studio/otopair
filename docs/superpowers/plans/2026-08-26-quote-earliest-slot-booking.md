# Quote Earliest-Slot Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tire- and rotor-quote customers book the shop's still-available earliest slot or choose another slot, while preserving owner-only access to the quoted hold.

**Architecture:** The web Convex backend remains the source of truth for quote holds, ownership, availability, and checkout-hold consumption. Mobile quote queries receive a server-computed earliest-slot flag; the existing picker performs the second check and existing `slotHolds.holdSlot` acquisition before Review & Pay. Quote-aware API references are locally typed in the mobile hooks/screens because Convex source changes intentionally live only in `otopair-web` until the repositories are synchronized.

**Tech Stack:** TypeScript, Convex, React Native, Expo Router, Zustand, Vitest, `FloatingSheet`.

**Spec:** `docs/superpowers/specs/2026-08-26-quote-earliest-slot-booking-design.md`

## Global Constraints

- Mobile UI, hooks, stores, and tests change only in `G:\GitHub\otopair`.
- Convex and backend `lib` changes change only in `G:\GitHub\otopair-web`.
- Tire Replacement and Brake Rotor Replacement must have identical scheduling guarantees.
- Do not edit either repository's `convex/_generated` files manually.
- Preserve unrelated working-tree changes, including `G:\GitHub\otopair-web\Reference_Files\otopair-inspection-modal.html`.
- Use the existing 15-minute checkout hold and existing Review & Pay countdown.
- Do not add a duplicate quote-owner schema field; authorize through `quote response -> booking.user_id -> Clerk identity`.
- Keep server response rows authoritative for all accepted quote prices.

---

## File Structure

### `G:\GitHub\otopair-web`

- Create `convex/lib/quoteHoldOwnership.ts`: shared quote-context validator and authenticated booking-owner resolution.
- Modify `convex/lib/timeSlotAvailability.ts`: project both tire and rotor responses as blocking quote holds and support an authorized per-response exclusion.
- Modify `convex/time_slots.ts`: authorize optional quote context before calendar/day availability calculations.
- Modify `convex/slotHolds.ts`: authorize quote context before acquiring a checkout hold.
- Modify `convex/tire_quote_responses.ts`: owner-gate mobile list query and return `earliest_slot_available`.
- Modify `convex/rotor_quote_responses.ts`: mirror tire creation validation, owner gate, and availability result.
- Modify `convex/bookings.ts`: owner-gate quote acceptance, consume the existing checkout hold, and exclude the selected response's persistent hold.
- Modify `tests/timeSlotAvailability.test.ts`: tire/rotor blocking and per-response exclusion regressions.
- Create `tests/quoteHoldOwnership.test.ts`: authenticated owner versus non-owner exclusion tests.
- Create `tests/acceptQuoteScheduling.test.ts`: tire/rotor acceptance and hold-consumption regressions.

### `G:\GitHub\otopair`

- Modify `components/tire-booking/TireQuoteCard.tsx`: conditional one- or two-button footer.
- Modify `components/rotor-booking/RotorQuoteCard.tsx`: same conditional footer.
- Modify `components/bookings/QuoteListSheet.tsx`: use server availability flag and add earliest/manual handlers.
- Modify `components/bookings/RotorQuoteListSheet.tsx`: same rotor behavior.
- Modify `hooks/useTimeSlotsForShop.ts`: pass the authorized quote context to the quote-aware backend query.
- Modify `hooks/useCalendarAvailabilityForShop.ts`: pass quote context to month availability.
- Modify `app/(booking-flow)/pick-datetime.tsx`: auto-confirm recheck, existing hold acquisition, and stale-slot `FloatingSheet` recovery.
- Modify `app/booking/mechanic/[id]/confirming.tsx`: pass hold/session identifiers into quote acceptance.
- Create `tests/quoteEarliestSlotUi.test.ts`: focused source-contract regression checks for both services and the failure sheet.

---

### Task 1: Shared Backend Quote-Hold Projection

**Files:**
- Create: `G:\GitHub\otopair-web\convex\lib\quoteHoldOwnership.ts`
- Modify: `G:\GitHub\otopair-web\convex\lib\timeSlotAvailability.ts`
- Modify: `G:\GitHub\otopair-web\tests\timeSlotAvailability.test.ts`
- Create: `G:\GitHub\otopair-web\tests\quoteHoldOwnership.test.ts`

**Interfaces:**
- Produces: `quoteHoldContextValidator`, `QuoteHoldContext`, and `resolveOwnedQuoteHoldExclusion(ctx, context)`.
- Produces: availability arguments `excludeTireQuoteResponseId?: string` and `excludeRotorQuoteResponseId?: string` across assert/list/resolve functions.
- Consumes: Clerk identity, `users.by_clerkUserId`, quote response `booking_id`, and `bookings.user_id`.

- [ ] **Step 1: Add failing rotor-hold and selected-response exclusion tests**

Extend `baseSeed` with `rotor_quote_responses: []`. Add tests equivalent to:

```ts
test("rotor quote holds block availability", async () => {
  const ctx = makeCtx(baseSeed({
    bookings: [{ _id: "booking-1", status: "quotes_ready" }],
    rotor_quote_responses: [{
      _id: "rotor-response-1",
      booking_id: "booking-1",
      shop_id: "shop-1",
      mechanic_id: "mech-1",
      availability: { date: "2026-06-01", time: "10:30" },
      estimated_duration_minutes: 30,
    }],
  }));
  expect(await isMechanicAvailableForWindow(ctx, {
    shopId: "shop-1",
    mechanicId: "mech-1",
    date: "2026-06-01",
    startTime: "10:30",
    durationMinutes: 30,
  })).toBe(false);
});

test("only the selected rotor response can be excluded", async () => {
  const ctx = makeCtx(/* one live rotor response */);
  expect(await isMechanicAvailableForWindow(ctx, {
    shopId: "shop-1",
    mechanicId: "mech-1",
    date: "2026-06-01",
    startTime: "10:30",
    durationMinutes: 30,
    excludeRotorQuoteResponseId: "rotor-response-1",
  })).toBe(true);
});
```

Create ownership tests with a mock `ctx.auth.getUserIdentity()` and table rows proving the owner resolves an exclusion while another Clerk user receives `undefined`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npx vitest run tests/timeSlotAvailability.test.ts tests/quoteHoldOwnership.test.ts
```

Expected: failures because rotor responses and ownership resolution do not exist.

- [ ] **Step 3: Implement ownership resolution and generic quote holds**

Create a discriminated validator and type:

```ts
export const quoteHoldContextValidator = v.union(
  v.object({ quote_type: v.literal("tire"), response_id: v.id("tire_quote_responses") }),
  v.object({ quote_type: v.literal("rotor"), response_id: v.id("rotor_quote_responses") }),
);
```

`resolveOwnedQuoteHoldExclusion` must return no exclusion unless the Clerk user, Convex user, response, and booking all exist and `booking.user_id === user._id`. Update availability context loading to read both response tables, retain only live quote-stage holds, and skip only the matching response ID from the matching table.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the Step 2 command. Expected: all focused tests pass.

- [ ] **Step 5: Commit Task 1 in `otopair-web`**

```powershell
git add -- convex/lib/quoteHoldOwnership.ts convex/lib/timeSlotAvailability.ts tests/timeSlotAvailability.test.ts tests/quoteHoldOwnership.test.ts
git commit -m "feat: authorize tire and rotor quote holds"
```

### Task 2: Quote-Sheet Availability Results

**Files:**
- Modify: `G:\GitHub\otopair-web\convex\tire_quote_responses.ts`
- Modify: `G:\GitHub\otopair-web\convex\rotor_quote_responses.ts`
- Create: `G:\GitHub\otopair-web\tests\quoteResponseAvailability.test.ts`

**Interfaces:**
- Consumes: `requireOwnedQuoteBooking(ctx, bookingId)` from `quoteHoldOwnership.ts`.
- Consumes: `isMechanicAvailableForWindow` with the matching response exclusion.
- Produces: `earliest_slot_available: boolean` on each `listForBookingWithShops` result.

- [ ] **Step 1: Write failing query-result tests**

Use `convex-test` to seed an authenticated customer, a quote-stage booking, shop hours, mechanic, and one tire or rotor response. Assert:

```ts
expect(result[0].earliest_slot_available).toBe(true);
```

Then insert a conflicting confirmed booking and assert the flag is false. Add a non-owner call that rejects.

- [ ] **Step 2: Run and confirm RED**

```powershell
npx vitest run tests/quoteResponseAvailability.test.ts
```

Expected: the field and ownership checks are missing.

- [ ] **Step 3: Implement both response queries and rotor creation validation**

In each `listForBookingWithShops`, require the current user to own `booking_id`. For each live response with a mechanic, calculate `earliest_slot_available` using its date, time, duration, and its own table-specific exclusion. Return false when no mechanic is assigned.

Import `assertMechanicAvailableForWindow` into `rotor_quote_responses.ts` and call it before insert using the response duration, mirroring tire creation.

- [ ] **Step 4: Run and confirm GREEN**

Run the Step 2 command. Expected: all query-result tests pass.

- [ ] **Step 5: Commit Task 2 in `otopair-web`**

```powershell
git add -- convex/tire_quote_responses.ts convex/rotor_quote_responses.ts tests/quoteResponseAvailability.test.ts
git commit -m "feat: report quoted slot availability"
```

### Task 3: Quote-Aware Availability, Checkout Hold, and Acceptance

**Files:**
- Modify: `G:\GitHub\otopair-web\convex\time_slots.ts`
- Modify: `G:\GitHub\otopair-web\convex\slotHolds.ts`
- Modify: `G:\GitHub\otopair-web\convex\bookings.ts`
- Create: `G:\GitHub\otopair-web\tests\acceptQuoteScheduling.test.ts`

**Interfaces:**
- Consumes: `quoteHoldContextValidator` and `resolveOwnedQuoteHoldExclusion`.
- Produces: optional `quote_context` on `getByShopAndDate`, `getAvailabilityByShopAndMonth`, and `holdSlot`.
- Produces: optional `hold_id` and `session_id` on `acceptTireQuote` and `acceptRotorQuote`.

- [ ] **Step 1: Write failing acceptance and hold-consumption tests**

Seed authenticated owner/customer identities. For each quote type, create an active `slot_holds` row matching the selected quote window and call acceptance with its `hold_id` and `session_id`. Assert the booking is confirmed, the server-response price is stored, and the hold row is deleted. Add a non-owner acceptance test that rejects before mutation.

- [ ] **Step 2: Run and confirm RED**

```powershell
npx vitest run tests/acceptQuoteScheduling.test.ts
```

Expected: acceptance has no hold args, no owner guard, and does not consume the hold.

- [ ] **Step 3: Authorize quote context in availability and hold acquisition**

Add `quote_context: v.optional(quoteHoldContextValidator)` to the two picker queries and `holdSlot`. Resolve it server-side, then pass only the authorized table-specific exclusion into availability calculations. An unowned context resolves to no exclusion and therefore cannot unlock the persistent hold.

- [ ] **Step 4: Consume holds during quote acceptance**

Add optional hold/session validators to both acceptance mutations. Resolve the current user and require `booking.user_id` to match. Call `resolveSlotHoldForConsume`, prefer its pinned mechanic, pass `excludeSessionId` plus the selected quote-response exclusion into `resolveMechanicForWindow`, patch the booking, and call `deleteConsumedSlotHold` in the same mutation.

- [ ] **Step 5: Run and confirm GREEN**

Run the Step 2 command, then:

```powershell
npx vitest run tests/timeSlotAvailability.test.ts tests/quoteHoldOwnership.test.ts tests/quoteResponseAvailability.test.ts tests/acceptQuoteScheduling.test.ts
```

Expected: all quote scheduling and availability tests pass.

- [ ] **Step 6: Commit Task 3 in `otopair-web`**

```powershell
git add -- convex/time_slots.ts convex/slotHolds.ts convex/bookings.ts tests/acceptQuoteScheduling.test.ts
git commit -m "feat: consume holds when accepting quotes"
```

### Task 4: Conditional Quote Buttons for Tire and Rotor

**Files:**
- Modify: `G:\GitHub\otopair\components\tire-booking\TireQuoteCard.tsx`
- Modify: `G:\GitHub\otopair\components\rotor-booking\RotorQuoteCard.tsx`
- Modify: `G:\GitHub\otopair\components\bookings\QuoteListSheet.tsx`
- Modify: `G:\GitHub\otopair\components\bookings\RotorQuoteListSheet.tsx`
- Create: `G:\GitHub\otopair\tests\quoteEarliestSlotUi.test.ts`

**Interfaces:**
- Consumes: `earliest_slot_available` from each response query.
- Produces: optional `onBookEarliest` card callback and existing `onBook` manual callback.
- Produces: route parameter `autoConfirmEarliest: "1"` for the fast path.

- [ ] **Step 1: Write failing source-contract tests**

Read the four component files and assert both card labels and both sheet handlers exist, including the conditional one-button fallback:

```ts
expect(tireCard).toContain("Book earliest time");
expect(tireCard).toContain("Choose a different time");
expect(rotorCard).toContain("Book earliest time");
expect(quoteSheet).toContain('autoConfirmEarliest: "1"');
expect(rotorQuoteSheet).toContain('autoConfirmEarliest: "1"');
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npx vitest run tests/quoteEarliestSlotUi.test.ts
```

Expected: the second callback, labels, and fast-path parameter are absent.

- [ ] **Step 3: Implement conditional cards and sheet handlers**

Extend each raw response interface with `earliest_slot_available: boolean`. Extract the existing quote-context construction into a local `buildQuoteAcceptContext` function. `handleChooseTime` routes normally. `handleBookEarliest` is passed only when the availability flag is true and routes through `pick-datetime` with `autoConfirmEarliest: "1"`.

Each card renders two buttons when `onBookEarliest` is supplied; otherwise it renders one button labeled “Choose time.” Keep 44px minimum touch targets and existing theme colors.

- [ ] **Step 4: Run and confirm GREEN**

Run the Step 2 command. Expected: all UI contract checks pass.

- [ ] **Step 5: Commit Task 4 in `otopair`**

```powershell
git add -- components/tire-booking/TireQuoteCard.tsx components/rotor-booking/RotorQuoteCard.tsx components/bookings/QuoteListSheet.tsx components/bookings/RotorQuoteListSheet.tsx tests/quoteEarliestSlotUi.test.ts
git commit -m "feat: add earliest quote booking option"
```

### Task 5: Auto-Confirm Recheck and Failure Sheet

**Files:**
- Modify: `G:\GitHub\otopair\hooks\useTimeSlotsForShop.ts`
- Modify: `G:\GitHub\otopair\hooks\useCalendarAvailabilityForShop.ts`
- Modify: `G:\GitHub\otopair\app\(booking-flow)\pick-datetime.tsx`
- Modify: `G:\GitHub\otopair\app\booking\mechanic\[id]\confirming.tsx`
- Modify: `G:\GitHub\otopair\tests\quoteEarliestSlotUi.test.ts`

**Interfaces:**
- Consumes: `QuoteAcceptContext` and converts it to the backend `quote_context` discriminated union.
- Consumes: `autoConfirmEarliest: "1"`.
- Produces: existing checkout hold state before Review & Pay.
- Produces: stale-slot `FloatingSheet` and normal picker fallback.

- [ ] **Step 1: Extend the failing UI contract tests**

Assert the picker contains the `FloatingSheet`, stale-slot copy, auto-confirm guard, quote-aware hold call, and that confirming passes `hold_id` and `session_id` to both quote mutations.

- [ ] **Step 2: Run and confirm RED**

```powershell
npx vitest run tests/quoteEarliestSlotUi.test.ts
```

Expected: quote context, sheet copy, and hold-consumption args are absent.

- [ ] **Step 3: Add typed quote-aware Convex references**

Because mobile Convex source intentionally remains unsynchronized, define local `FunctionReference` argument types for the modified queries/mutations instead of editing generated files or using `any`. Pass `quoteAcceptContext` into both availability hooks and construct the discriminated `quote_context` with the correct response ID type.

- [ ] **Step 4: Implement auto-confirm success and failure states**

Parse `autoConfirmEarliest` from route params. In auto-confirm mode, anchor the picker on the quoted floor date, wait for calendar and time-slot queries, and call the existing `onConfirm` only when the exact date/time is present. Hide picker controls during this check.

If the exact slot disappears or `holdSlot` rejects, disable further automatic attempts, render the normal picker, and open a one-snap `FloatingSheet` with:

```text
That time is no longer available
The shop's earliest appointment was just taken. Choose another date, time, or mechanic to continue.
```

Dismissal leaves the normal picker usable. Manual selection retains the existing toast behavior.

- [ ] **Step 5: Thread hold state into quote acceptance**

Read `holdId` and `holdSessionId` in `confirming.tsx`. Pass them as optional `hold_id` and `session_id` to both typed quote-accept mutation references.

- [ ] **Step 6: Run and confirm GREEN**

```powershell
npx vitest run tests/quoteEarliestSlotUi.test.ts tests/acceptQuoteScheduling.test.ts tests/vehicleSwitchClearsBookingServices.test.ts
```

Expected: all mobile quote-flow tests pass.

- [ ] **Step 7: Commit Task 5 in `otopair`**

```powershell
git add -- hooks/useTimeSlotsForShop.ts hooks/useCalendarAvailabilityForShop.ts 'app/(booking-flow)/pick-datetime.tsx' 'app/booking/mechanic/[id]/confirming.tsx' tests/quoteEarliestSlotUi.test.ts
git commit -m "feat: recheck quoted slots before payment"
```

### Task 6: Validation and Audits

**Files:**
- Review all files changed in Tasks 1-5.

**Interfaces:**
- Consumes: completed backend and mobile behavior.
- Produces: verification evidence and audit results.

- [ ] **Step 1: Validate the web/backend repository**

```powershell
npx vitest run tests/timeSlotAvailability.test.ts tests/quoteHoldOwnership.test.ts tests/quoteResponseAvailability.test.ts tests/acceptQuoteScheduling.test.ts
npx eslint convex/lib/quoteHoldOwnership.ts convex/lib/timeSlotAvailability.ts convex/time_slots.ts convex/slotHolds.ts convex/tire_quote_responses.ts convex/rotor_quote_responses.ts convex/bookings.ts tests/timeSlotAvailability.test.ts tests/quoteHoldOwnership.test.ts tests/quoteResponseAvailability.test.ts tests/acceptQuoteScheduling.test.ts
npx tsc --noEmit
npx convex dev --once
```

Expected: exit code 0 for every command. Do not modify generated files manually.

- [ ] **Step 2: Validate the mobile repository**

```powershell
npx vitest run tests/quoteEarliestSlotUi.test.ts tests/acceptQuoteScheduling.test.ts tests/vehicleSwitchClearsBookingServices.test.ts
npx eslint components/tire-booking/TireQuoteCard.tsx components/rotor-booking/RotorQuoteCard.tsx components/bookings/QuoteListSheet.tsx components/bookings/RotorQuoteListSheet.tsx hooks/useTimeSlotsForShop.ts hooks/useCalendarAvailabilityForShop.ts 'app/(booking-flow)/pick-datetime.tsx' 'app/booking/mechanic/[id]/confirming.tsx' tests/quoteEarliestSlotUi.test.ts
npx tsc --noEmit
```

Expected: exit code 0 for every command.

- [ ] **Step 3: Run UI audit**

Check the four modified quote components and picker for theme usage, shared UI imports, strict types, 44px touch targets, accessible labels, and no business logic added outside the existing flow boundary.

- [ ] **Step 4: Run schema/backend audit**

Confirm no schema change was needed, all public quote-owner paths authenticate, indexed lookups cover users/booking/response access, and both response-table paths remain backward-compatible.

- [ ] **Step 5: Review final diffs and repository status**

```powershell
git diff HEAD~2 --check
git status --short
```

Run in each repository. Confirm only task files and the pre-existing unrelated web file appear.
