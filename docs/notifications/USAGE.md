# OtoPair — In-App Notifications: Dev Usage

One-pager for app devs. Full spec lives in `PLAN.md`; this file is the day-to-day reference.

## The 4 lines

```tsx
import { useToast } from '@/hooks/useToast';

const toast = useToast();
toast.success('Booking confirmed', 'Thursday, 9:00 AM');
```

That's it. Available from any component inside `<ToastProvider>` (mounted at app root).

## Firing a toast — imperative API

```tsx
const toast = useToast();

toast.success(title, body?);  // confirmed mutation (booking confirmed, charged, vehicle added)
toast.info(title, body?);     // passive server status (vehicle checked in, ETA updated)
toast.warning(title, body?);  // action-required (quote revised, parts over high, shop cancelled)
toast.error(title, body?);    // mutation failure / network down
toast.trust(title, body?);    // Otopair-unique positive trust event (parts under, diag clean, finished early)
toast.dismissAll();           // wipe queue + current

// Optional 3rd arg
toast.success('Vehicle added', 'Honda Civic added to your garage.', {
  duration: 6000,        // override default
  onPress: () => router.push(`/booking/mechanic/${id}/booking-details`),
});
```

## Wrapping a Convex mutation

`useMutationWithToast` replaces ~10 lines of try/catch boilerplate per call site. Use it whenever a mutation should fire a toast on settle.

```tsx
import { useMutationWithToast } from '@/hooks/useMutationWithToast';
import { api } from '@/convex/_generated/api';

const cancelBooking = useMutationWithToast(api.bookings.cancel, {
  success: 'Booking cancelled. Any payment hold will release within 7 days.',
  // Function form for dynamic strings:
  error: ({ error }) => ({
    title: "Couldn't cancel this booking.",
    body: error.message.includes('network') ? 'Check your connection.' : undefined,
  }),
});

// Usage — same signature as useMutation, fully typed.
await cancelBooking({ bookingId });
```

## CTA haptic policy

```tsx
// CTA fires a mutation that produces NO toast — use haptics.cta()
<Button onPress={() => { haptics.cta(); navigation.navigate('Foo'); }} />

// CTA fires a mutation wrapped in useMutationWithToast — use haptics.ctaSilent()
// (the toast haptic is the confirmation; double-haptic feels buggy)
const save = useMutationWithToast(api.profile.update, { success: 'Saved' });
<Button onPress={() => { haptics.ctaSilent(); save(args); }} />
```

## No-haptic zones — do not add haptics here

| Zone | Why |
|---|---|
| Tab bar taps | Navigation isn't a confirmation |
| Scroll | Continuous gesture |
| Text input keystrokes | Continuous gesture |
| Modal open/close | Visual is enough |
| Toast `info` appear | Info is passive |
| Any tap that doesn't commit to a server change | Haptics confirm commits |

## When to use each toast type

| Type | Use when | Don't use for |
|---|---|---|
| `success` | Mutation just succeeded that the user explicitly initiated | Server-pushed status updates → use `info` |
| `info` | Server-pushed status the user did not initiate (mechanic ETA, vehicle at shop) | Confirming a user action → use `success` |
| `warning` | Action required or unexpected cost (quote revised, parts over high, mechanic cancelled) | Generic "heads up" → consider `info` |
| `error` | Mutation failed, network down, payment declined | Validation that should block submit → use inline form error |
| `trust` | Otopair-unique positive event the user didn't initiate (parts under, diag clean, finished early, hold released) | Generic success — that's `success` |

## Toast vs. Banner

| Toast | Banner |
|---|---|
| Ephemeral, event-driven, auto-dismiss | Persistent, content-driven, dismissible only on resolve |
| `useToast()` API | Direct JSX component, e.g. `<CustomerLateBanner />` |
| Use for: confirmations, transitions, errors | Use for: ongoing state (customer late, EAS update available, quarterly check-in due) |

If the user needs to act on it *eventually* — banner. If you're confirming a thing that *just happened* — toast.

## Subscription-driven toasts

`useBookingStatusToasts(bookingId)` and `usePaymentStatusToasts(bookingId)` are already mounted on `app/booking/mechanic/[id]/booking-details.tsx`. They auto-fire toasts when the booking's `status_history` or attached `payment.status` changes server-side (mechanic accepts, Stripe webhook fires, ETA updates, etc.).

You should NOT mount them globally. If you build a new screen that should hear server-side updates for a specific booking, add the hook there too.

## Approved-strings governance

Every user-facing toast string must be dashboard-tone. Reject anything that:
- Sells, hypes, anxiety-baits, gamifies ("Don't miss out!", "🎉", "You earned this!")
- Interpolates raw OS error messages ("Error: NSURLErrorDomain...", "EINTR")

If your toast string isn't already in `PLAN.md` §B.7 or `useBookingStatusToasts.ts`/`usePaymentStatusToasts.ts`, write one and run it past the Trust-Engineering Reviewer before merge.

## Common pitfalls

- **Don't import `expo-haptics` directly.** ESLint will fail your build. Add a helper in `lib/haptics.ts` instead.
- **Don't fire two haptics for one user action.** Use `haptics.ctaSilent()` when the CTA produces a toast.
- **Don't write `customColor`/`customIcon` props.** The 5 variants are the API. If you think you need a 6th, raise it with the team — taxonomy is locked at MVP.
- **Don't migrate destructive `Alert.alert` confirmations** (cancel booking, delete vehicle, delete address) to toasts. Toasts are non-interactive; destructive actions need 2-button native dialogs.
