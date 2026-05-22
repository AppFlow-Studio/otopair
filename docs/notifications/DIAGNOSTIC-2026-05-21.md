# OtoPair — Toast Diagnostic: Booking-Confirm Silent Failure (2026-05-21)

## Root cause (one sentence)

The booking-create mutation (`api.bookings.createBatch` via `hooks/useCreateBookingConvex.ts:26`) uses raw `useMutation` and was never wrapped in `useMutationWithToast` during Phase 2 Step 3 migrations, so the user's own submit action fires zero client-side feedback; the only path that would surface a Success/Trust toast is the subscription-driven `confirmed` event in `useBookingStatusToasts`, which is mounted on `booking-details.tsx` — a screen the user never visits during the standard confirm → confirmation celebration flow.

## Check-by-check evidence

### Check 1 — Provider mount: ✅ correctly mounted
`app/_layout.tsx:22, 256, 339` — `<ToastProvider>` wraps the entire navigation tree. It sits inside `<AuthGate>` and `<ConvexClerkProvider>`, but the user is already signed in by the time they reach the booking flow, so the gate is open. **Not the root cause.**

### Check 2 — Booking confirm site migrated: ❌ NOT MIGRATED (root cause)
- `hooks/useCreateBookingConvex.ts:26` — `const createBatch = useMutation(api.bookings.createBatch);` is raw `useMutation`; no toast wrapper.
- Phase 2 Step 3's migration audit walked `Alert.alert` and `console.error` sites. The booking-create path uses neither — it `throws` on error and the caller (`confirming.tsx:135-142`) navigates back to the payment screen with the error message as a URL param. **The audit's heuristic missed this site entirely** because it has no `Alert.alert` and no `console.error` literal in the success path.
- `app/booking/mechanic/[id]/confirming.tsx:127-134` is the call site:
  ```ts
  const bookingIds = await createBookingConvex(...);
  if (navigatedRef.current) return;
  navigatedRef.current = true;
  router.replace({ pathname: `/booking/mechanic/${id}/confirmation`, ... });
  ```
  Success path: mutation resolves → silent navigation to confirmation screen. No toast call anywhere.

### Check 3 — Mutation runs: ✅ yes
Inferred from "user booked end-to-end" wording in the prompt — the booking row would not have been created if the mutation hadn't fired. Convex dashboard verification recommended but not necessary for diagnosis: the confirmation screen would not have rendered without `createBookingConvex` returning a non-empty `bookingIds[]`.

### Check 4 — Toast rendered off-screen: N/A
No toast was fired. Queue state is empty.

### Check 5 — Haptic check: N/A
No `haptics.success()` would have run because the haptic ladder is wired into `ToastProvider`'s queue advancement (`ToastProvider.tsx:70, 88, 98`). If no toast enters the queue, no haptic fires. Adding a `console.log` to `lib/haptics.ts:success()` would print nothing — confirming the no-toast-fired diagnosis.

### Check 6 — `useMutationWithToast` awaits: N/A
The hook itself is correct (`hooks/useMutationWithToast.ts:60` — `const result = (await run(args)) as ...`), but it's not being invoked from this code path because the booking-create site uses raw `useMutation`. The wrapper's `await` semantics are not the bug.

### Check 7 — Navigation kills toast: ✅ would NOT kill it if one were fired
`<ToastProvider>` is mounted in `app/_layout.tsx` at the root, OUTSIDE the Stack navigator. `router.replace(/confirmation)` unmounts `confirming.tsx` and mounts `confirmation.tsx` but does NOT unmount the Provider. Any toast queued before the replace would persist across the navigation cleanly.

This means: **if Check 2 were fixed (wrapper added or imperative toast call before `router.replace`), the toast would render correctly on the confirmation screen.** No additional plumbing required.

### Adjacent observation — subscription-driven Trust-Moment not reachable in this flow
`useBookingStatusToasts` is mounted on `app/booking/mechanic/[id]/booking-details.tsx:55-65`. The confirmation-celebration screen (`confirmation.tsx`) does NOT mount it. So even when the shop later accepts the booking and a `confirmed` row lands in `booking_status_history`, the subscription is never listening unless the user has manually navigated to booking-details.

This is a **product-design question**, not a bug: the user might leave the confirmation screen for the home tab before the shop accepts. The PLAN §B.7 design assumes the user is engaged with the specific booking — which is true on booking-details but not on the home tab.

## Severity

**HIGH.** This is the central user-facing happy-path of the entire booking funnel. The first thing every new user expects to see after submitting a booking is "Booking submitted" or "Booking confirmed." Today they see only the silent Lottie + the celebration screen header text.

Not Critical (no data loss, no money toast wrong, no accessibility blocker — the booking IS created), but the missing feedback erodes trust at the worst possible moment: the user's first real commit on the platform.

## Fix recommendation (one paragraph — do not implement until greenlit)

Two-part fix in `hooks/useCreateBookingConvex.ts`. **Part A (small, ship-now):** convert the inner `useMutation(api.bookings.createBatch)` call to `useMutationWithToast` with `success: "Booking submitted. We'll let you know as soon as your shop confirms."` (Info variant, NOT Success — because the booking is `pending_shop_acceptance` at this point, not yet confirmed; the user has acted but the system hasn't fully transacted). The error path stays as-is (already routes back to payment with `confirmError` URL param, which surfaces inline) but additionally fires `toast.error("Couldn't submit booking. Try again.")` so the user gets a sound + visual before being routed back. **Part B (mounts the subscription where it matters):** mount `useBookingStatusToasts(bookingDbId)` on `confirmation.tsx` using the `bookingDbId` URL param the screen already receives. This means when the shop later accepts, the user — if still on the confirmation screen — sees the Trust-Moment "Booking confirmed" toast in real time. If they've navigated away, the existing booking-details mount covers the case when they return. ETA: 15 minutes for Part A, 10 minutes for Part B, plus a manual sim verification of both paths. Trust-Engineering Reviewer must sign the two new strings before commit.

## Out of scope for the fix (track as follow-ups)

- `useCreateTireQuoteRequest` likely has the same shape (raw `useMutation`, no toast). Audit it too. Found at `hooks/useCreateTireQuoteRequest.ts`.
- `demo.tsx:77` also uses raw `api.bookings.create` — dev-only, leave as-is.
- The 12 follow-up silent-mutation migrations from QA-REPORT.md are still pending; this diagnostic does not change their priority.
