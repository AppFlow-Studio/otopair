# OtoPair — In-App Notification Audit (Phase 1)

> **Status:** Draft for human review. Read-only Phase 1 deliverable. Signed by responsible specialist per section. Companion to `PLAN.md` in the same directory.

**Context:** OtoPair ships June 1, 2026 (11 days). MVP is in-app toast notifications only — push is App-Store-gated, SMS is 10DLC-pending. Today the consumer app has 22 blocking `Alert.alert` calls and ~25 silent `console.error` swallows on user-facing flows. This audit inventories the current notification surface and maps the gaps the new system must close.

---

## A.0 — Library presence (verified) `[Lead Mobile Engineer]`

| Library | Installed version | Status |
|---|---|---|
| `react-native-reanimated` | `~4.1.1` | ✅ |
| `expo-haptics` | `~15.0.7` | ✅ |
| `expo-blur` | `~15.0.8` | ✅ |
| `@gorhom/bottom-sheet` | `^5` | ✅ |
| `lucide-react-native` | `^0.555.0` | ✅ |
| `phosphor-react-native` | `^3.0.2` | ✅ |
| `sonner-native` | — | ❌ not installed |
| `react-native-toast-message` | — | ❌ not installed |
| `react-native-flash-message` | — | ❌ not installed |

**Verdict:** Custom Reanimated + BlurView build path is unblocked. No native rebuild needed — fits inside the JS-only EAS Update window.

---

## A.1 — Current notification surface `[Lead Mobile Engineer]`

### A.1.1 `Alert.alert(` inventory — 22 calls

| File:line | Trigger | Category |
|---|---|---|
| `app/demo.tsx:140` | Demo user/vehicle not seeded | Dev/demo |
| `app/demo.tsx:171` | Demo booking creation failed | Dev/demo |
| `app/demo-learning.tsx:117` | Seed pipeline failed | Dev/demo |
| `app/demo-learning.tsx:132` | Start job failed | Dev/demo |
| `app/demo-learning.tsx:159` | Complete job failed | Dev/demo |
| `app/demo-learning.tsx:183` | Submit job actuals failed | Dev/demo |
| `app/coming-soon.tsx:63` | Notification permission denied | Onboarding |
| `app/coming-soon.tsx:76` | Notification permission granted | Onboarding |
| `app/coming-soon.tsx:83` | Permission request errored | Onboarding |
| `app/booking/mechanic/[id]/confirmation.tsx:334` | No appointment date provided | Booking |
| `app/booking/mechanic/[id]/confirmation.tsx:367` | Calendar permission required | Booking |
| `app/booking/mechanic/[id]/confirmation.tsx:374` | No calendar available | Booking |
| `app/booking/mechanic/[id]/confirmation.tsx:378` | Calendar add success | Booking |
| `app/booking/mechanic/[id]/confirmation.tsx:381` | Calendar add unsupported on web | Booking |
| `app/booking/mechanic/[id]/confirmation.tsx:384` | Calendar add failed | Booking |
| `app/membership.tsx:245` | Referral document picked | Rewards |
| `app/membership.tsx:883` | Gift card redemption queued (1–3 days) | Rewards |
| `app/membership.tsx:890` | Redemption errored | Rewards |
| `app/(main-tabs)/bookings/index.tsx:260` | Reschedule confirmation | Booking |
| `app/(main-tabs)/home/index.tsx:481` | Reschedule confirmation | Booking |
| `app/(main-tabs)/cars/index.tsx:1241` | Vehicle deletion confirmation | Vehicles |
| `app/settings/saved-addresses.tsx:162` | Confirm address deletion | Settings |

Migrate: every row except the **destructive confirmations** (delete vehicle, delete address) becomes a toast. Destructive confirmations stay as `Alert.alert` with two buttons — toasts are non-interactive.

### A.1.2 `console.error` / `console.warn` on user-facing flows — 25 occurrences worth surfacing

Highest priority (silent mutation failures the user cannot see):

| File:line | What silently fails |
|---|---|
| `app/car-pre-onboarding.tsx:327` | Save pre-onboarding |
| `app/membership.tsx:255` | Document picker error |
| `app/add-car-info.tsx:374` | Convex add vehicle |
| `app/(main-tabs)/cars/index.tsx:907` | Vehicle autocomplete |
| `app/(main-tabs)/cars/index.tsx:1231` | Set primary vehicle |
| `app/(main-tabs)/cars/index.tsx:1253` | Remove vehicle |
| `app/settings/saved-addresses.tsx:156` | Save address |
| `app/settings/saved-addresses.tsx:175` | Delete address |
| `app/settings/edit-profile.tsx:386` | Update profile photo |
| `app/settings/edit-profile.tsx:400` | Update profile name |
| `app/settings/edit-profile.tsx:423` | Update profile contact |
| `app/settings/notification-preferences.tsx:171` | Save notification prefs |
| `app/settings/delete-account.tsx:245` | Send verification code |
| `app/settings/delete-account.tsx:303` | Final delete |
| `app/settings/preferences.tsx:158` | Save preferences |
| `app/(main-tabs)/ai-chat/index.tsx:728` | Copy to clipboard error |
| `components/bookings/QuoteListSheet.tsx:156` | `acceptTireQuote` failed |
| `components/ai-chat/AIRecordConfirmation.tsx:162` | Confirm AI record |
| `components/ai-chat/AIRecordConfirmation.tsx:217` | Update AI record |
| `components/ai-chat/AIAttachmentPanel.tsx:303` | Load photos |
| `components/ai-chat/AIFeedbackModal.tsx:125` | Submit feedback |
| `components/cars/MaintenanceInputModal.tsx:247` | Save maintenance |
| `components/cars/CarInfoStepper.tsx:704` | Save car info |

The remaining 43 `console.error`/`warn` calls are internal/dev (pipeline, sync, hydration) and stay silent.

### A.1.3 Existing notification-like components

| Path | What it is | Disposition |
|---|---|---|
| `components/ai-chat/AIToast.tsx` | ChatGPT-style spring top toast, auto-dismiss 3s, scoped to AI chat | **Deprecate** — Phase 2 migrates call sites to new `useToast()` |
| `components/bookings/CustomerLateBanner.tsx` | Persistent two-state banner (late / overrun) | **Keep** — it's a banner not a toast (sticks until resolved) |
| `components/system/UpdateAvailableBanner.tsx` | EAS Update banner using SlideInUp/SlideOutUp | **Keep** — patterns referenced in new toast motion |
| `components/cars/CheckinBanner.tsx` | Quarterly check-in reminder | **Keep** — content-driven banner |
| `components/shared-ui/ErrorOccurredModal.tsx` | Generic error modal | **Keep for fatal errors only**; mutation failures → toast |
| `components/shared-ui/FeedbackModal.tsx`, `AIFeedbackModal.tsx` | User-initiated feedback flows | **Keep** |

### A.1.4 `Haptics.` call inventory — 25 calls

Light impact (14): tab bar, AI chat actions, slider drag, step advance, prompt tap.
Medium impact (3): health-estimate submit, set primary vehicle, add/remove vehicle.
Selection (2): tire option selection.
Success notification (4): vehicle added, quarterly check-in complete, primary vehicle set, vehicle action success.

All current haptic intents map cleanly to the new ladder in `PLAN.md` §B.4. The TabBar's `Haptics.impactAsync(Light)` on tab change is **out of policy** per the new haptic ladder (tab taps = no haptic) — flagged for Phase 2 removal at `components/navigation/TabBar.tsx:42,142` and `components/ui/haptic-tab.tsx:12`.

### A.1.5 Primary CTA pattern

- Canonical button: `components/shared-ui/Button.tsx` (variants `primary` / `secondary` / `ghost`) with `loading` and `disabled` props. `onPress` is **not** promise-aware — every call site manages its own `submitting` state.
- Footer wrapper: `components/shared-ui/FooterButton.tsx` (full-width, large padding).
- Gold-standard mutation pattern: `components/bookings/LeaveReviewSheet.tsx:102–239` (try/catch + `setSubmitting` + `setError`). The new `useMutationWithToast` hook in `PLAN.md` §B.5 absorbs this boilerplate.

### A.1.6 `useMutation` audit (representative sample of ~107 calls)

- ~60% wrap in try/catch but only ~30% surface user feedback
- ~40% fire-and-forget with `.catch(() => {})` (legitimate for background ops)
- ~10% have explicit error state + visible error display
- **~42 mutations** have error handling but zero user feedback — primary migration targets

### A.1.7 Existing `use[Feature]FromConvex` hooks (for reference)

`useBookingsFromConvex`, `useConsoleToConvex`, `useCreateBookingConvex`, `useDriverRecommendationsFromConvex`, `useEnsureConvexUser`, `useMechanicsFromConvex`, `useNotificationsFromConvex`, `useRecHistoryFromConvex`, `useRecentlyBookedMechanicIdsFromConvex`, `useRecentlyBookedShopIdsFromConvex`, `useServiceCategoriesFromConvex`, `useServicesFromConvex`, `useShopPortfolioFromConvex`, `useShopsFromConvex`, `useTransactionsFromConvex`, `useUserFromConvex`, `useVehicleOwnershipFromConvex`.

The new subscription-driven toasts (`useBookingStatusToasts`, `usePaymentStatusToasts`) follow the same naming + reactive pattern.

---

## A.2 — Booking lifecycle gap map `[Lead Mobile Engineer]`

Schema source: `convex/schema.ts` (`bookings`, `booking_status_history`). Status-write site: `convex/bookings.ts`.

| State transition | Server trigger (file:line) | What user sees today | What user SHOULD see (toast type, approved string) |
|---|---|---|---|
| `pending` / `pending_shop_acceptance` → `confirmed` | `convex/bookings.ts:8750` (`accept`) | Booking row updates; no inline feedback | **Trust-Moment** — "Booking confirmed for {weekday}, {time}" |
| `pending` → `declined_by_shop` | `convex/bookings.ts` decline mutation | Silent | **Warning** — "{Shop} can't take this booking. Tap to see alternatives." |
| `confirmed` → `vehicle_at_shop` | `convex/bookings.ts:1100` (customer check-in) | Status card updates | **Info** — "Vehicle checked in. Your mechanic will review shortly." |
| `vehicle_at_shop` → `in_progress` | bookings.ts (start job) | Silent | **Info** — "{Mechanic} started work on your vehicle." |
| `in_progress` → `completed` | `convex/bookings.ts:8589` (`completed_at_ms` set) | Booking moves to history | **Success** — "Service complete. Tap to review the invoice." |
| diagnostic_followup_state → `resolved` (no extra work) | `convex/bookings.ts:7242` | Booking transitions silently | **Trust-Moment** — "Diagnostic complete — no additional work needed." |
| any → `cancelled_by_user` | bookings.ts cancel | Silent | **Success** — "Booking cancelled. Any payment hold will release within 7 days." |
| any → `cancelled_by_mechanic` | bookings.ts cancel-by-shop | Silent | **Warning** — "{Shop} cancelled this booking. Tap to rebook." |
| `confirmed` → `rescheduled` | bookings.ts reschedule | `Alert.alert` in two spots | **Info** — "Rescheduled to {weekday}, {time}." |
| no-show flagged | bookings.ts | Silent | **Warning** — "Marked as no-show. Tap to dispute or reschedule." |
| quote revised | bookings.ts quote-revise | Silent | **Warning** — "Quote revised — review the change before approving." |
| mechanic ETA updated | bookings.ts ETA mutation | Silent | **Info** — "{Mechanic} updated their ETA to {time}." |
| customer late banner fires | `components/bookings/CustomerLateBanner.tsx` | Banner | **Keep banner** (persistent), no toast |
| overrun resolution offered | CustomerLateBanner | Banner | **Keep banner**, no toast |

---

## A.3 — Payment + Stripe gap map `[Lead Mobile Engineer]`

Schema: `convex/schema.ts` (`payments`, `payment_status_history`). Webhooks: `convex/http.ts`.

| Payment state | Server transition (file:line) | What user sees today | What user SHOULD see |
|---|---|---|---|
| `authorized` (hold placed at booking) | payments mutation | Silent | **Info** — "Card held for ${amount}. You're only charged after service." |
| `captured` (final charge) | Stripe webhook → payments update | Silent | **Success** — "Charged ${amount} to •••• {last4}." |
| `refunded` (full) | refund mutation | Silent | **Success** — "${amount} refunded to •••• {last4}." |
| `partial_refund` | refund mutation | Silent | **Info** — "Refunded ${amount} of ${total} to •••• {last4}." |
| `failed` / `declined` | Stripe webhook | Silent | **Error** — "Payment didn't go through. Tap to update your card." |
| `dispute_opened` | Stripe webhook | Silent | **Warning** — "We received a dispute on this charge. Tap for details." |
| `actual_parts_cost < parts_cost_low` | `convex/bookings.ts:8399` | Silent | **Trust-Moment** — "Parts came in ${diff} under the estimate." |
| `actual_parts_cost > parts_cost_high` | `convex/bookings.ts:8399` | Silent | **Warning** — "Parts ran ${diff} over the high estimate. Tap to review." |

---

## A.4 — Trust-moment opportunities `[Trust-Engineering Reviewer]`

Each below is a server-driven positive event where Otopair can confirm to the user that their interests were protected. **All approved strings are dashboard-tone — none sell, hype, or use gamification.**

| Moment | Source (file:line) | Approved string |
|---|---|---|
| Parts under low estimate | `convex/bookings.ts:8399` | "Parts came in ${diff} under the estimate." |
| Booking accepted by shop | `convex/bookings.ts:8750` | "Booking confirmed for {weekday}, {time}." |
| Vehicle checked in at shop | `convex/bookings.ts:1100` | "Vehicle checked in. Your mechanic will review shortly." |
| Diagnostic complete, no extra work | `convex/bookings.ts:7242` (with empty followup recs) | "Diagnostic complete — no additional work needed." |
| Job completed ahead of estimate | derived: `actual_duration_minutes < estimated_labor_minutes * 0.9` | "Finished {n} minutes ahead of estimate." |
| Refund issued | payments refund mutation | "${amount} refunded to •••• {last4}." |
| Pre-auth hold released after cancel | payments release mutation | "Payment hold released. ${amount} back on •••• {last4} within 7 days." |

Rejected drafts (kept as guardrail examples):
- ❌ "🎉 Great news! Your parts came in WAY cheaper!" — gamified, hyped
- ❌ "Don't miss your refund!" — anxiety-bait
- ❌ "You saved money!" — frames mechanic discipline as user achievement
