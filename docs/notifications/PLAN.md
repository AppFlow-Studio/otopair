# OtoPair — In-App Notification Architecture (Phase 1)

> **Status:** Draft for human review. Read-only Phase 1 deliverable. Signed by responsible specialist per section. Companion to `AUDIT.md` in the same directory. Phase 2 implements against this spec.

**Resolved conflicts (user-confirmed during Phase 1):**
- Toast font: **Urbanist** (matches app brand), not SF Pro. Overrides the brand-token doc because the app-wide brand is Urbanist.
- Token home: extend `constants/theme.ts` with a new `SemanticColors` export — reusable beyond toasts.

---

## B.1 — Library decision `[Lead Mobile Engineer]`

**Decision: Custom Reanimated + BlurView system.**

| Option | Native rebuild? | Liquid Glass ceiling | Convex ergonomics | Bundle | Last release | Verdict |
|---|---|---|---|---|---|---|
| Custom on Reanimated + BlurView | None | Full control | Native (we author the hook API) | 0 (already shipped) | n/a | **Chosen** |
| `sonner-native` | None | Limited — fights our brand | Manual wiring | ~30KB | 2024 | Reject |
| `react-native-toast-message` | None | Theme overrides feasible but visual is third-party | Manual wiring | ~25KB | 2024 | Reject |
| `react-native-flash-message` | None | Strong customization but JSX-heavy API | Manual wiring | ~40KB | 2023 | Reject — staleness signal |

Rationale: Reanimated, BlurView, and the icon libs are already in the bundle. A third-party toast adds binary weight, a visual language we'd have to fight to match Otopair's brand, and a Convex integration layer we'd still have to write ourselves. Building custom is the same effort with full Liquid Glass control and zero new dependencies.

---

## B.2 — Toast taxonomy (5 types, no sixth) `[Senior UI/UX Designer]` + `[Trust-Engineering Reviewer]`

| # | Type | Fires when | Approved strings (signed) | Bg | Border | Icon (lucide / hex) | Duration | Position | Haptic |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Success** | Confirmed mutation: booking confirmed, payment captured, vehicle added, address saved | "Booking confirmed for Thursday, 9:00 AM" • "Charged $186.00 to •••• 4242" • "Vehicle added to your garage" | `#ECFDF5` | `#05966933` | `CheckCircle2` / `#059669` | 3500 ms | Top | `Success` |
| 2 | **Info** | Passive server-driven status: mechanic en route, vehicle at shop, ETA updated | "Vehicle checked in. Your mechanic will review shortly." • "Mike updated their ETA to 10:15 AM." • "Rescheduled to Friday, 2:00 PM." | `#EFF6FF` | `#2563EB33` | `Info` / `#2563EB` | 3000 ms | Top | NONE |
| 3 | **Warning** | Action-required or unexpected cost: quote revised, parts over high estimate, mechanic cancelled | "Quote revised — review the change before approving." • "Parts ran $34 over the high estimate. Tap to review." • "Mike's Auto cancelled this booking. Tap to rebook." | `#FFFBEB` | `#F59E0B40` | `AlertTriangle` / `#D97706` | 4500 ms | Top | `Warning` |
| 4 | **Error** | Network failure, payment declined, mutation rejected | "Couldn't save. Check your connection and try again." • "Payment didn't go through. Tap to update your card." • "Couldn't load this booking. Pull to refresh." | `#FEF2F2` | `#DC262640` | `XCircle` / `#DC2626` | 5000 ms | Top | `Error` |
| 5 | **Trust-Moment** (Primary Blue, distinct from Success) | Otopair-unique positive event: parts under estimate, diagnostic clean, job finished early, refund issued | "Parts came in $42 under the estimate." • "Diagnostic complete — no additional work needed." • "Finished 25 minutes ahead of estimate." | `#EFF6FF` → `#DBEAFE` (linear gradient) | `#2563EB59` | `ShieldCheck` / `#2563EB` | 4500 ms | Top | `Success` |

**Position justification (top):** Bottom is reserved for the 90px tab bar plus any contextual FAB. Top below safe-area is the iOS 26 native pattern (Dynamic Island spillover style) and clears the thumb zone.

**Stacking justification (single-toast-with-queue, max 3 queued; Error preempts non-Error):** Single-at-a-time replaces the user-mental-model overload of stacked toasts, prevents notch crowding, and matches iOS native notification behavior. A new `Error` interrupts a current `Success`/`Info` immediately; queued items wait their turn. Queue overflow drops the *oldest pending* item, never the currently-visible toast.

---

## B.3 — Visual specs per type `[Senior UI/UX Designer]`

All five types share these container defaults; type-specific overrides below.

### Shared container
| Property | Value |
|---|---|
| Width | `screen width - 32px` (16px horizontal inset) |
| Max width (tablet / iPad) | `480 px`, `alignSelf: 'center'` — toast never spans a full landscape tablet |
| Min height | 56 px |
| Max height | 40% of screen height — content scrolls within if reached, though approved strings should never hit this |
| Corner radius | 16 px |
| Padding | 14 px top/bottom, 16 px left/right |
| Internal layout | row: icon (32px container) → 12px gap → text column → 12px gap → optional dismiss tap area |
| Shadow | `offsetX 0, offsetY 8, blur 24, spread 0, color rgba(15,23,42,0.10)` (light) / `rgba(0,0,0,0.40)` (dark) |
| Touch target | full container, tap dismisses |
| Swipe to dismiss | swipe **up** dismisses; downward gestures ignored (avoids tab-bar confusion) |
| Close button | none — tap-anywhere-to-dismiss + swipe-up + auto-dismiss are sufficient |
| Title length | wraps to **2 lines max**, ellipsizes beyond (`numberOfLines={2}`) |
| Body length | wraps to **3 lines max**, ellipsizes beyond (`numberOfLines={3}`) |

### Shared text styles
| Slot | Font | Size | Line-height | Color (light) | Color (dark) |
|---|---|---|---|---|---|
| Title | `Urbanist-SemiBold` | 15 px | 20 px | `#1A1A1A` | `#F8FAFC` |
| Body | `Urbanist-Regular` | 13 px | 18 px | `#374151` | `#CBD5E1` |

### Dynamic Type scaling
| Slot | Behavior |
|---|---|
| Title + Body | Multiply base size by `min(PixelRatio.getFontScale(), 1.6)`. The clamp prevents Dynamic Type XXL/XXXL from breaking layout while still honoring the user's accessibility preference within a safe range. |

### Shared motion
| Phase | Spec |
|---|---|
| Enter | `withSpring({ damping: 18, stiffness: 220, mass: 0.6 })` on `translateY` from `-100%` to `0`, opacity 0→1 |
| Exit (auto) | `withTiming(opacity 0, { duration: 220, easing: Easing.in(Easing.cubic) })` + `translateY -8px` |
| Exit (swipe) | velocity-driven `withSpring` to `-120%` |
| Reduce Motion | suppress translate; opacity-only crossfade, 200ms linear, both directions |

### Type spec sheets

**1. Success (light → dark)**
| Property | Light | Dark |
|---|---|---|
| Background | `#ECFDF5` solid | `#022C22` solid |
| Border | 1 px `#05966933` (Success Green at 20% α) | 1 px `#05966966` |
| Icon container | 32×32, radius 12, bg `#FFFFFF`, no border | 32×32, radius 12, bg `#022C22`, 1px `#05966966` |
| Icon | `CheckCircle2` lucide, 20 px, stroke 2, `#059669` | same icon, `#10B981` |
| Title | `#1A1A1A` | `#F8FAFC` |
| Body | `#374151` | `#CBD5E1` |

**2. Info (light → dark)**
| Property | Light | Dark |
|---|---|---|
| Background | `#EFF6FF` solid | `#0B1B33` solid |
| Border | 1 px `#2563EB33` | 1 px `#2563EB66` |
| Icon container | 32×32, radius 12, bg `#FFFFFF` | 32×32, radius 12, bg `#0B1B33`, 1px `#2563EB66` |
| Icon | `Info` lucide, 20 px, stroke 2, `#2563EB` | same, `#60A5FA` |

**3. Warning (light → dark)**
| Property | Light | Dark |
|---|---|---|
| Background | `#FFFBEB` solid | `#2C1F08` solid |
| Border | 1 px `#F59E0B40` (amber-500 at 25% α) | 1 px `#F59E0B66` |
| Icon container | 32×32, radius 12, bg `#FFFFFF` | 32×32, radius 12, bg `#2C1F08`, 1px `#F59E0B66` |
| Icon | `AlertTriangle` lucide, 20 px, stroke 2, `#D97706` | same, `#FBBF24` |

**4. Error (light → dark)**
| Property | Light | Dark |
|---|---|---|
| Background | `#FEF2F2` solid | `#2C0B0B` solid |
| Border | 1 px `#DC262640` | 1 px `#DC262666` |
| Icon container | 32×32, radius 12, bg `#FFFFFF` | 32×32, radius 12, bg `#2C0B0B`, 1px `#DC262666` |
| Icon | `XCircle` lucide, 20 px, stroke 2, `#DC2626` | same, `#F87171` |

**5. Trust-Moment (light → dark) — Liquid Glass treatment**
| Property | Light | Dark |
|---|---|---|
| Background | `LinearGradient` top→bottom: `#EFF6FF` → `#DBEAFE`, atop a `BlurView intensity={20} tint="light"` underlay so iOS surfaces beneath subtly bleed through (justification: the trust event deserves a "premium" visual that reads as protective, not transactional) | `LinearGradient` top→bottom: `#0B1B33` → `#0F2A52`, atop `BlurView intensity={20} tint="dark"` |
| Border | 1 px `#2563EB59` (35% α) | 1 px `#2563EB99` |
| Icon container | 32×32, radius 12, bg `#FFFFFF`, 1px `#2563EB33` | 32×32, radius 12, bg `#0B1B33`, 1px `#2563EB66` |
| Icon | `ShieldCheck` lucide, 20 px, stroke 2, `#2563EB` | same, `#60A5FA` |
| Shadow override | `offsetX 0, offsetY 12, blur 32, spread 0, color rgba(37,99,235,0.18)` (blue tint, justification: tints the trust toast with brand-signal warmth) | `rgba(37,99,235,0.32)` |

---

## B.4 — Haptic ladder `[Senior UX Engineer]`

Philosophy: **haptics confirm, they do not announce.**

When `AccessibilityInfo.isReduceMotionEnabled()` is `true`, toast motion crossfades instead of sliding. **Haptics are NOT suppressed by Reduce Motion** — these are independent iOS accessibility preferences (Reduce Motion targets vestibular comfort; haptics are governed by the system Vibration setting). iOS suppresses haptics natively when the system Vibration setting is off; we do not override or duplicate that check.

Out of scope for MVP: an in-app "Reduce in-app haptics" toggle in `settings/notification-preferences.tsx`. Added post-launch if users request it.

| Event | Haptic API |
|---|---|
| Primary CTA tap that fires a server mutation | `Haptics.selectionAsync()` (chosen consistently project-wide; `selectionAsync` over Light impact for crispness) |
| Toast Success appear | `Haptics.notificationAsync(NotificationFeedbackType.Success)` |
| Toast Error appear | `Haptics.notificationAsync(NotificationFeedbackType.Error)` |
| Toast Warning appear | `Haptics.notificationAsync(NotificationFeedbackType.Warning)` |
| Toast Info appear | **NONE** (info is passive) |
| Toast Trust-Moment appear | `Haptics.notificationAsync(NotificationFeedbackType.Success)` |
| Destructive confirmation tap (cancel booking, delete vehicle, delete address) | `Haptics.impactAsync(ImpactFeedbackStyle.Heavy)` on the destructive button only |
| Pull-to-refresh release | `Haptics.selectionAsync()` |
| Switch / toggle change | `Haptics.selectionAsync()` |
| Picker / wheel detent | `Haptics.selectionAsync()` |

**No-haptic zones (do not add haptics here):**
- Tab bar taps (existing `components/navigation/TabBar.tsx:42,142` and `components/ui/haptic-tab.tsx:12` are **out of policy** — remove in Phase 2)
- Scroll
- Text input keystrokes
- Modal open / close
- Toast Info appear
- Any tap that does not commit to a server change

### CTA-toast double-haptic suppression

When a primary CTA fires a mutation that will produce a toast (via `useMutationWithToast`), the CTA haptic is suppressed and only the toast haptic fires. Rule of thumb for devs: **if your `onPress` calls a mutation wrapped in `useMutationWithToast`, do NOT also call `haptics.cta()`** — the toast haptic is the confirmation. Two haptics 200ms apart feel buggy, not crisp.

`lib/haptics.ts` exposes a `haptics.ctaSilent()` no-op for buttons where consistency in the call-site shape matters (so the dev still writes `onPress={() => { haptics.ctaSilent(); doThing(); }}` and the next reader can tell the absence of haptic is intentional, not a bug).

---

## B.5 — Convex integration pattern `[Lead Mobile Engineer]`

Three exposed modes; TypeScript signatures below are the contract Phase 2 implements against.

### 1. Imperative — `useToast()`

```ts
type ToastVariant = "success" | "info" | "warning" | "error" | "trust";

interface ToastOptions {
  title: string;
  body?: string;
  duration?: number;          // override default
  onPress?: () => void;       // makes whole toast a tappable affordance
}

interface ToastHandle {
  success: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  info:    (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  warning: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  error:   (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  trust:   (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  dismissAll: () => void;
}

declare function useToast(): ToastHandle;
```

### 2. Mutation wrapper — `useMutationWithToast()`

```ts
import {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { useMutation } from "convex/react";

interface MutationToastConfig<TArgs, TResult> {
  success?: string | ((result: TResult, args: TArgs) => { title: string; body?: string });
  error?:   string | ((err: Error, args: TArgs) => { title: string; body?: string });
  haptic?:  boolean;          // default: true on success/error, false on neither
  suppressError?: boolean;    // for fire-and-forget calls where we still want success
}

declare function useMutationWithToast<
  Mutation extends FunctionReference<"mutation">
>(
  mutation: Mutation,
  config: MutationToastConfig<FunctionArgs<Mutation>, FunctionReturnType<Mutation>>,
): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>>;
```

Wraps `useMutation`, returns the same callable but fires the right toast + haptic on `.then`/`.catch`. Mirrors the `LeaveReviewSheet` try/catch pattern so call sites lose ~10 lines of boilerplate per mutation.

### 3. Subscription-driven — `useBookingStatusToasts()` and `usePaymentStatusToasts()`

```ts
declare function useBookingStatusToasts(bookingId: Id<"bookings"> | undefined): void;
declare function usePaymentStatusToasts(bookingId: Id<"bookings"> | undefined): void;
```

Internally each:
1. `useQuery` against `booking_status_history` / `payment_status_history` filtered by `bookingId`, ordered by `created_at_ms desc`.
2. Tracks `lastSeenAt` in a `useRef`. **Initialization:** stays `null` until the first successful Convex query response, then sets to `max(existingRows.changedAt)`. This closes the gap where a status change that landed 2 seconds before mount would otherwise be missed (a naive `Date.now()`-on-mount would skip it). Before the first response, no toasts fire.
3. On a new row whose `created_at_ms > lastSeenAt` **AND** `changed_by !== currentUserId`, looks up the transition in the `TRANSITION_TO_TOAST` map (see §B.7) and fires the configured toast.

This is the **critical** mode for mechanic-side actions (accept, in-progress, complete) that flow through the server, not the client. The consumer hears about them by subscribing.

**Mount point:** the booking detail screen for that booking's lifetime. A global mount in `_layout.tsx` would over-toast across screen switches.

#### Self-action filtering

Both `useBookingStatusToasts` and `usePaymentStatusToasts` must ignore status-history rows where `changed_by === currentUserId`. Rationale: the mutation wrapper (`useMutationWithToast`) already fires a toast for the user's own action; the subscription hook only surfaces server-side or counterparty-side changes (mechanic acceptance, Stripe webhook fires, ETA updates pushed by the shop). Without this filter, the consumer sees two toasts for every action they themselves initiate.

Implementation: pull `currentUserId` via `useEnsureConvexUser()` (returns the Convex `users` row id, which is what `booking_status_history.changed_by` stores) and skip matching rows in the reactive map. For payment_status_history, the same rule applies — although in practice Stripe webhook writes never carry the user's id, the filter is defensive against future server changes.

---

## B.6 — File tree

```
docs/notifications/
  AUDIT.md                              # CREATE (Phase 1) ✅
  PLAN.md                               # CREATE (Phase 1) ✅

components/toast/                       # CREATE (Phase 2)
  ToastProvider.tsx                     # Context + queue + Reanimated host view
  Toast.tsx                             # Single toast (container + motion + BlurView for Trust)
  ToastIcon.tsx                         # Type→icon mapping
  TrustToast.tsx                        # Liquid-Glass variant (gradient + BlurView)
  tokens.ts                             # Per-type constants (bg, border, icon hex, durations)
  types.ts                              # ToastVariant, ToastOptions, ToastQueueItem, MutationToastConfig
  index.ts                              # Barrel

hooks/                                  # CREATE (Phase 2)
  useToast.ts
  useMutationWithToast.ts
  useBookingStatusToasts.ts
  usePaymentStatusToasts.ts
  useReducedMotion.ts                   # Thin re-export of lib/accessibility for symmetry

lib/                                    # CREATE (Phase 2) — boundary enforced by ESLint rule
  haptics.ts                            # ONLY file that imports expo-haptics; exposes named helpers
  accessibility.ts                      # Reactive Reduce Motion flag + listener (used by haptics + toast motion)

constants/
  theme.ts                              # MODIFY (Phase 2) — add SemanticColors export

components/shared-ui/
  index.ts                              # MODIFY (Phase 2) — re-export Toast surface

app/
  _layout.tsx                           # MODIFY (Phase 2) — wrap with <ToastProvider>
  dev/toast-playground.tsx              # CREATE (Phase 2) — dev-only visual checkpoint

eslint.config.js                        # MODIFY (Phase 2) — no-restricted-imports rule for expo-haptics

components/ai-chat/
  AIToast.tsx                           # DEPRECATE (Phase 2) — see PRE-DELETE step below
  (call sites)                          # MIGRATE per §B.7

components/navigation/
  TabBar.tsx                            # MODIFY (Phase 2) — remove L42, L142 light-impact haptics
components/ui/
  haptic-tab.tsx                        # DELETE (Phase 2) — out of policy
```

**PRE-DELETE step (AIToast.tsx):** before removing `components/ai-chat/AIToast.tsx`, run `grep -rn "AIToast" app/ components/ hooks/` to list every importer. Today the audit shows exactly one importer (`app/(main-tabs)/ai-chat/index.tsx`) and one local `showToast` helper that wraps it. Migrate each importer to `useToast()` (calling `toast.info("Message copied")` / `toast.error("Couldn't load that conversation.")` / etc. per the strings already approved in §B.7), then delete the file. Do not delete before grep returns 0 importers — silent runtime failures are not acceptable on the June 1 ship.

---

## B.7 — Migration checklist `[Lead Mobile Engineer]` + `[Trust-Engineering Reviewer]`

Cross-references `AUDIT.md` §A.1.1 + §A.1.2. Every row gets a target type + signed string before merge.

### `Alert.alert` → Toast migrations (keep destructive confirmations as native dialogs)

| Site | Type | Approved string |
|---|---|---|
| `app/booking/mechanic/[id]/confirmation.tsx:378` (calendar add success) | Success | "Added to your calendar." |
| `app/booking/mechanic/[id]/confirmation.tsx:367` (calendar permission) | Error | "Couldn't add to your calendar. Open Settings to grant access." |
| `app/booking/mechanic/[id]/confirmation.tsx:374,381,384` (calendar errors) | Error | "Couldn't add to your calendar." |

> **Rule (Trust-Engineering Reviewer):** NEVER interpolate raw OS error strings into user-facing toasts. OS errors are unbounded in length, often contain implementation jargon ("EINTR", "NSURLErrorDomain"), and can leak internal state. Always pick a sanitized, dashboard-tone fallback. Internal logging captures the raw error for debugging.
| `app/booking/mechanic/[id]/confirmation.tsx:334` (no date) | Warning | "Pick a date first." |
| `app/coming-soon.tsx:63,76,83` (notification permission) | Info/Success/Error | "Notifications enabled." / "Notifications stay off — change anytime in Settings." / "Couldn't update notification settings." |
| `app/membership.tsx:245` (referral picked) | Success | "Referral added." |
| `app/membership.tsx:883` (gift card redeem) | Success | "Gift card on its way — arrives within 3 business days." |
| `app/membership.tsx:890` (redeem error) | Error | "Couldn't redeem. {reason}." |
| `app/(main-tabs)/bookings/index.tsx:260`, `app/(main-tabs)/home/index.tsx:481` (reschedule confirm) | Info | "Rescheduled to {weekday}, {time}." |
| `app/demo*.tsx` (6 calls) | dev-only — leave as Alert.alert, **not** migrated |
| `app/(main-tabs)/cars/index.tsx:1241` (delete confirm) | **keep as Alert.alert** (destructive confirmation) |
| `app/settings/saved-addresses.tsx:162` (delete confirm) | **keep as Alert.alert** (destructive confirmation) |

### Silent `console.error` → Toast migrations (Error type, derive title from context)

| Site | Approved string |
|---|---|
| `app/car-pre-onboarding.tsx:327` | "Couldn't save your progress. Pull to refresh." |
| `app/add-car-info.tsx:374` | "Couldn't add this vehicle. Try again." |
| `app/(main-tabs)/cars/index.tsx:907` | "Couldn't auto-fill vehicle details. Enter them manually below." |
| `app/(main-tabs)/cars/index.tsx:1231` | "Couldn't set as primary. Try again." |
| `app/(main-tabs)/cars/index.tsx:1253` | "Couldn't remove this vehicle. Try again." |
| `app/settings/saved-addresses.tsx:156` | "Couldn't save this address." |
| `app/settings/saved-addresses.tsx:175` | "Couldn't delete this address." |
| `app/settings/edit-profile.tsx:386,400,423` | "Couldn't update your profile." |
| `app/settings/notification-preferences.tsx:171` | "Couldn't save your notification settings." |
| `app/settings/delete-account.tsx:245` | "Couldn't send the verification code. Try again." |
| `app/settings/delete-account.tsx:303` | "Couldn't delete your account. Reach out to support if this keeps happening." |
| `app/settings/preferences.tsx:158` | "Couldn't save your preferences." |
| `app/(main-tabs)/ai-chat/index.tsx:728` | "Couldn't copy to clipboard." |
| `components/bookings/QuoteListSheet.tsx:156` | "Couldn't accept this quote. Try again." |
| `components/ai-chat/AIRecordConfirmation.tsx:162,217` | "Couldn't save. Try again." |
| `components/ai-chat/AIAttachmentPanel.tsx:303` | "Couldn't load your photos." |
| `components/ai-chat/AIFeedbackModal.tsx:125` | "Couldn't submit feedback. Try again." |
| `components/cars/MaintenanceInputModal.tsx:247` | "Couldn't save this maintenance entry." |
| `components/cars/CarInfoStepper.tsx:704` | "Couldn't save your car info." |

### Subscription-driven toast wiring

`useBookingStatusToasts(bookingId)` registers on the booking-detail screen and maps:

| `new_status` | Toast type | String | `onPress` route |
|---|---|---|---|
| `confirmed` | Trust-Moment | "Booking confirmed for {weekday}, {time}." | `/booking/mechanic/{id}/booking-details` |
| `declined_by_shop` | Warning | "{Shop} can't take this booking. Tap to see alternatives." | intended `/discover?service={serviceId}` → fallback `/(main-tabs)/home` (**TODO Phase 2:** build deep-linked discover route or keep fallback) |
| `vehicle_at_shop` | Info | "Vehicle checked in. Your mechanic will review shortly." | `/booking/mechanic/{id}/booking-details` |
| `in_progress` | Info | "{Mechanic} started work on your vehicle." | `/booking/mechanic/{id}/booking-details` |
| `completed` | Success | "Service complete. Tap to review the invoice." | intended `/booking/{id}/invoice` → fallback `/booking/mechanic/{id}/booking-details` (**TODO Phase 2:** build dedicated invoice screen pre-launch) |
| `cancelled_by_user` | Success | "Booking cancelled. Any payment hold will release within 7 days." | none (no tap action) |
| `cancelled_by_mechanic` | Warning | "{Shop} cancelled this booking. Tap to rebook." | intended `/discover?service={serviceId}&original_booking={id}` → fallback `/(main-tabs)/home` (**TODO Phase 2**) |
| `rescheduled` | Info | "Rescheduled to {weekday}, {time}." | `/booking/mechanic/{id}/booking-details` |
| `quote_revised` | Warning | "Quote revised — review the change before approving." | intended `/booking/{id}/quote-review` → fallback `/booking/mechanic/{id}/booking-details` (**TODO Phase 2:** build dedicated quote-review screen) |
| `eta_updated` | Info | "{Mechanic} updated their ETA to {time}." | `/booking/mechanic/{id}/booking-details` |
| `diagnostic_resolved` (no followup) | Trust-Moment | "Diagnostic complete — no additional work needed." | `/booking/mechanic/{id}/booking-details` |
| `parts_under_low` (derived) | Trust-Moment | "Parts came in ${diff} under the estimate." | intended `/booking/{id}/parts-detail` → fallback `/booking/mechanic/{id}/booking-details` (**TODO Phase 2**) |
| `parts_over_high` (derived) | Warning | "Parts ran ${diff} over the high estimate. Tap to review." | intended `/booking/{id}/parts-detail` → fallback `/booking/mechanic/{id}/booking-details` (**TODO Phase 2**) |
| `completed_early` (derived: actual < 0.9 × est) | Trust-Moment | "Finished {n} minutes ahead of estimate." | `/booking/mechanic/{id}/booking-details` |
| `no_show` | Warning | "Marked as no-show. Tap to dispute or reschedule." | intended `/booking/{id}/dispute` → fallback `/booking/mechanic/{id}/booking-details` (**TODO Phase 2:** build dispute screen or keep Alert.alert reschedule like today) |

`usePaymentStatusToasts(bookingId)` maps:

| Payment state | Toast type | String | `onPress` route |
|---|---|---|---|
| `authorized` | Info | "Card held for ${amount}. You're only charged after service." | `/booking/mechanic/{id}/booking-details` |
| `captured` | Success | "Charged ${amount} to •••• {last4}." | `/booking/mechanic/{id}/booking-details` |
| `refunded` (full) | Success | "${amount} refunded to •••• {last4}." | `/booking/mechanic/{id}/booking-details` |
| `partial_refund` | Info | "Refunded ${amount} of ${total} to •••• {last4}." | `/booking/mechanic/{id}/booking-details` |
| `failed` / `declined` | Error | "Payment didn't go through. Tap to update your card." | intended `/booking/{id}/payment-method` → fallback `/payments` (existing standalone payments screen) (**TODO Phase 2:** build per-booking payment-method swap screen) |
| `dispute_opened` | Warning | "We received a dispute on this charge. Tap for details." | intended `/booking/{id}/payment-detail` → fallback `/booking/mechanic/{id}/booking-details` (**TODO Phase 2**) |
| hold released after cancel | Trust-Moment | "Payment hold released. ${amount} back on •••• {last4} within 7 days." | none (no tap action) |

---

## B.8 — Test matrix `[Senior Frontend QA / Accessibility Lead]`

5 toast types × 7 variants = 35 scenarios. Each scenario verifies (a) visual correctness, (b) string accuracy, (c) haptic correctness, (d) accessibility.

| Variant ↓ / Type → | Success | Info | Warning | Error | Trust-Moment |
|---|---|---|---|---|---|
| Light mode | ✅ baseline | ✅ baseline | ✅ baseline | ✅ baseline | ✅ baseline + gradient + BlurView underlay |
| Dark mode | full dark spec hex match | full dark spec | full dark spec | full dark spec | dark gradient + BlurView tint="dark" |
| VoiceOver on (iOS) | `accessibilityRole="alert"`, title + body announced once, "double tap to dismiss" hint | role="status" (polite, not interrupting) | role="alert" | role="alert" | role="status" |
| TalkBack / live region (Android) | `accessibilityLiveRegion="polite"` (matches iOS `role="status"` — passive confirmation) | `accessibilityLiveRegion="polite"` | `accessibilityLiveRegion="assertive"` | `accessibilityLiveRegion="assertive"` | `accessibilityLiveRegion="polite"` |
| Reduce Motion on | crossfade only, 200ms, no haptic | crossfade only | crossfade only, no haptic | crossfade only, no haptic | crossfade only, no haptic |
| Dynamic Type XXL | container grows; title/body wrap; min height grows; no truncation | same | same | same | same |
| App backgrounded mid-toast | toast suppressed on background, not redelivered on foreground | same | same | same | same |
| Network offline | imperative API still works (local state); subscription hooks queue toasts for next reconnect (Convex handles) | same | same | error toast fires for the failed mutation that hit timeout | trust toast only fires after server-acknowledged event, so naturally waits |

Additional regression cases:
- Two `Error` toasts back-to-back: second preempts first (per stacking rule).
- `Success` queued while `Error` showing: `Success` waits, fires after `Error` exits.
- Toast during a `BottomSheetModal`: z-index resolves above sheet (toast container is at `Modal` level via Provider portal).
- Toast during a full-screen modal route: same.
- Rapid toast spam (10 in 100ms): queue capped at 3, oldest pending dropped first, current toast not interrupted.

---

## B.9 — Out of scope at MVP (anti-creep)

- Push notifications (App Store gated — Phase 2 of June release at earliest)
- SMS / 10DLC marketing
- In-app notification inbox / history feed
- Notification preferences UI changes beyond the existing `app/settings/notification-preferences.tsx`
- Rich toasts with action buttons (MVP is icon + title + body + dismiss only)
- Sound — toasts are silent; haptics replace audio
- Per-toast theming overrides at call site (the 5 types are the API; no `customColor` prop)
- Web/RSC support — toasts are mobile-only

### Convex `notifications` table — selective write-through

**Trust-Moment toasts ALSO write a row to the `notifications` Convex table** so they surface in the booking detail timeline and seed the post-launch notification-inbox feature with the data users most want to revisit. Specifically: parts under estimate, diagnostic clean, finished ahead of estimate, and payment-hold released.

**Other toast variants (Success / Info / Warning / Error) do NOT write to `notifications`.** They are ephemeral feedback for the current session only — duplicating every save-succeeded confirmation into a persistent inbox is noise.

The write happens server-side at the same point the trust event is detected (e.g., the `completeJob` mutation that records `actual_parts_cost` also writes a `notifications` row if `actual_parts_cost < parts_cost_low`). The client just reads the row; it does not initiate the write. This keeps the inbox source-of-truth on the server and avoids client-side write paths that could be skipped if the app is backgrounded.
