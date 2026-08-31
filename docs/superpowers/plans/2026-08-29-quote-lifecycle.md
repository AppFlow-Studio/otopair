# Quote Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible, cancellable, requotable shop quotes with mobile stale-quote protection and an immutable Review & Pay window.

**Architecture:** Quote responses retain history and an internal revision. An existing checkout slot hold becomes the server-authoritative lock for the exact response revision, avoiding a second timer or lock table.

**Tech Stack:** Convex, TypeScript, Next.js, React Native, Expo Router, Vitest

**Spec:** `docs/superpowers/specs/2026-08-29-quote-lifecycle-design.md`

## Global Constraints

- Never display the internal revision to customers.
- Quote lifetime is ten minutes from create or successful requote.
- Review & Pay uses the existing slot-hold timer.
- All `convex/`, schema, and `lib/` edits occur in `G:/GitHub/otopair-web`.
- Preserve unrelated dirty-worktree files.

---

### Task 1: Server-authoritative lifecycle

**Files:**
- Modify: `../otopair-web/convex/schema.ts`
- Modify: `../otopair-web/convex/lib/quoteHoldOwnership.ts`
- Modify: `../otopair-web/convex/slotHolds.ts`
- Modify: `../otopair-web/convex/tire_quote_responses.ts`
- Modify: `../otopair-web/convex/rotor_quote_responses.ts`
- Modify: `../otopair-web/convex/bookings.ts`
- Test: `../otopair-web/tests/quoteLifecycle.test.ts`
- Test: `../otopair-web/tests/acceptQuoteScheduling.test.ts`

**Interfaces:**
- Produces structured availability results with `available`, `reason`, and `revision`.
- Persists a quote response id/type/revision on `slot_holds`.
- Provides shop cancel, requote, detail, and active-checkout-lock operations.

- [ ] Write lifecycle tests that fail when cancellation remains available, a stale revision enters checkout, a held revision is modified, or an expired held revision cannot be accepted.
- [ ] Run focused tests and confirm failures are caused by missing lifecycle behavior.
- [ ] Add backward-compatible optional schema fields and indexed hold references.
- [ ] Implement shared lifecycle assertions and structured reason results.
- [ ] Implement tire and rotor cancel/requote/detail operations through shared rules.
- [ ] Bind hold acquisition and acceptance to an exact response revision.
- [ ] Run focused tests until green.

### Task 2: Shop Quotes and Schedule surfaces

**Files:**
- Modify: `../otopair-web/app/(portal)/bookings/tire-quote-requests/page.tsx`
- Modify: `../otopair-web/app/(portal)/bookings/rotor-quote-requests/page.tsx`
- Modify: `../otopair-web/app/(portal)/bookings/quote-requests/page.tsx`
- Modify: `../otopair-web/app/(portal)/schedule/page.tsx`
- Create or modify: focused quote-detail panel component under `../otopair-web/app/(portal)/schedule/`
- Test: focused web lifecycle/source tests under `../otopair-web/tests/`

**Interfaces:**
- Consumes lifecycle status and checkout-lock state from Task 1.
- Reuses the existing quote form in create or requote mode.

- [ ] Write failing UI/source tests for persistent statuses, detail-panel opening, disabled locked actions, and reactive requote-form closure.
- [ ] Run them and verify the intended failures.
- [ ] Render Pending Quote, Expired, and Cancelled rows with appropriate actions.
- [ ] Add the Schedule quote detail/cancellation/requote panel using existing panel and dialog patterns.
- [ ] Prefill Requote and subscribe to the checkout lock so the form closes without saving when locked.
- [ ] Run focused tests and lint.

### Task 3: Mobile progression guards

**Files:**
- Modify: `stores/useBookingStore.ts`
- Modify: `components/bookings/QuoteListSheet.tsx`
- Modify: `components/bookings/RotorQuoteListSheet.tsx`
- Modify: `app/(booking-flow)/pick-datetime.tsx`
- Create or modify: shared quote-unavailable bottom-sheet component under `components/bookings/`
- Test: `tests/quoteEarliestSlotUi.test.ts`
- Test: focused quote lifecycle UI tests under `tests/`

**Interfaces:**
- Carries revision only as internal state.
- Maps `expired`, `cancelled`, and `modified` to distinct copy/navigation.
- Relies on `holdSlot` as the final gate before Review & Pay.

- [ ] Write failing tests for hidden revision, reason-specific copy, modified rerouting, and hold-bound context.
- [ ] Run tests and confirm the missing behavior.
- [ ] Validate before leaving quote lists and show the shared sheet on failure.
- [ ] Pass the internal revision into hold acquisition.
- [ ] Distinguish quote failures from slot conflicts in the date/time screen and route modified responses to the Quotes tab.
- [ ] Run focused mobile tests and lint.

### Task 4: Verification and audit

- [x] Run the focused backend and mobile suites fresh.
- [x] Run TypeScript and ESLint checks scoped to changed files; report repository baseline failures separately.
- [x] Audit schema compatibility, index coverage, authentication, and generated-type impact.
- [x] Audit touched UI for types, accessibility, existing design-system patterns, and no customer-facing revision.
- [x] Inspect both repository diffs and confirm unrelated files remain untouched.
