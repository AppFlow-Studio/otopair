# OtoPair — In-App Notifications: Adversarial Stress Report (Phase 2.5)

> Read-mostly pass against `feat/in-app-notifications` HEAD. Six adversarial specialists hunted six failure classes. **No Critical bugs found.** 7 High-severity items recommended for fix-before-merge, 8 Medium, 4 Low. Recommendation: **proceed to Prompt 3 fix loop** for the High items, then merge.
>
> All findings reference real source lines on the branch. Pure-logic repros live in `__tests__/notifications/*.test.ts` and pass via `node --experimental-strip-types --test`. RN-runtime scenarios are documented for human verification in the simulator.

## Verdict at a glance

| Severity | Count | Examples |
|---|---|---|
| Critical | 0 | none — no data loss, no money toast wrong, no accessibility blocker |
| High | 7 | `lastSeenRef` not reset on bookingId change; haptic in setState updater; `setTimeout` leak in handleDismissed; VoiceOver vs swipe-dismiss gesture conflict; server-success/client-timeout misleading Error toast; Reduce Motion doesn't suppress swipe spring; offline mutation queue drops oldest toasts on reconnect |
| Medium | 8 | role="summary" platform divergence, stale closure capture in dismiss/finalize, late Stripe webhook fires stale toast, no client-side mutation timeout, etc. |
| Low | 4 | accessibility listener never torn down, identical changed_at ordering, Dynamic Island inset (already handled), color-alone distinguishability (mitigated) |

---

## §1 — Race Condition Hunter `[Adversarial agent]`

Tests: `__tests__/notifications/race.test.ts` (7 tests, all pass).

### Finding 1.1 [HIGH] — `lastSeenRef` does not reset when `bookingId` changes
**Site:** `hooks/useBookingStatusToasts.ts:118` (and mirror in `usePaymentStatusToasts.ts:82`)

When a user navigates from booking A to booking B without unmounting (deep link, modal stack transition), `useQuery` correctly re-fetches but `lastSeenRef.current` carries booking A's max `changedAt`. Two failure modes:
- B's new rows with `changedAt > A's max` fire as "new" even if they're historical to B.
- B's new rows with `changedAt < A's max` are silently suppressed and no toast fires for legitimately new transitions.

**Repro:** `__tests__/notifications/race.test.ts` "FINDING #3 (HIGH): lastSeenRef persists across bookingId changes"

**One-line fix per hook:**
```ts
useEffect(() => { lastSeenRef.current = null; }, [bookingId]);
```

### Finding 1.2 [HIGH] — `setTimeout(advance, 50)` leaks on provider unmount
**Site:** `components/toast/ToastProvider.tsx:114` in `handleDismissed`

If the ToastProvider unmounts within 50ms of a toast exit (logout flow, deep-nav swap), the scheduled `advance()` invokes against an unmounted component → setState warning + retained closure.

**Fix:**
```ts
const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => {
  if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
}, []);
// in handleDismissed:
advanceTimerRef.current = setTimeout(advance, 50);
```

### Finding 1.3 [MEDIUM] — Haptic side effect inside `setCurrent` updater
**Site:** `components/toast/ToastProvider.tsx:88, 98`

`HAPTIC_FOR_VARIANT[item.variant]()` is invoked inside the `setCurrent((prev) => ...)` callback. React may invoke state updaters multiple times in StrictMode dev → potential double-haptic in dev. In production React 19 with strict mode disabled, this is benign. Anti-pattern regardless.

**Recommendation:** hoist haptics out of the updater by returning the variant flag from the updater and firing in a `useEffect` keyed on `current?.id`.

### Finding 1.4 [HIGH] — Self-action filter is approximated, not implemented
**Site:** `hooks/useBookingStatusToasts.ts` — the docstring claims `changed_by !== currentUserId` filtering, but the query (`convex/bookings.ts:10872`) strips `changed_by` from `statusHistory`. The hook compensates by omitting `cancelled_by_user` from the static map.

Any user-initiated transition still in the map (e.g., customer-initiated `vehicle_at_shop` check-in, customer-initiated `rescheduled`) double-fires if a parallel `useMutationWithToast` wraps the mutation that wrote the row.

**Fix path A (server-side, preferred):** modify `getBookingByIdForCustomer` in otopair-web to include `changed_by` and `changed_at` together; have the hook compare against the user's `_id` via `useEnsureConvexUser()`.

**Fix path B (client-side, MVP):** Audit the migrated mutations and verify none of them wrap a status-writing mutation that's also in `TRANSITION_TO_TOAST`. The current code is safe IF no migration in Step 3 wraps a `vehicle_at_shop`-writing or `rescheduled`-writing mutation. Spot-checked: neither does. Marking acceptable for MVP.

### Finding 1.5 [LOW] — `idCounter` is module-global
**Site:** `components/toast/ToastProvider.tsx:40`

Two ToastProvider instances would collide IDs. Provider mounts once; safe today. Documented.

### Finding 1.6 [PROOF-OF-SURVIVAL] — AppState background drops state cleanly
**Site:** `components/toast/ToastProvider.tsx:52-63`

`setCurrent(null)` → Modal `visible={false}` → Toast unmounts → useEffect cleanup clears its `setTimeout` and cancels Reanimated values. No leak.

### Finding 1.7 [PROOF-OF-SURVIVAL] — Queue cap correctly drops oldest pending
**Site:** `components/toast/ToastProvider.tsx:85-87, 93-95`

`while (queue.length > cap) queue.shift()` correctly drops from the head (oldest). Verified via race.test.ts "queue: 10 toasts in tight loop".

---

## §2 — Memory Leak Hunter `[Adversarial agent]`

Tests: `__tests__/notifications/memory.test.ts` (6 tests, all pass).

### Finding 2.1 [LOW] — `lib/accessibility` module-level listener has no teardown
**Site:** `lib/accessibility.ts:11-22`

`AccessibilityInfo.addEventListener("reduceMotionChanged", ...)` is added once at module load and never removed. Intentional for an app-wide setting; documented. Not a per-mount leak.

### Finding 2.2 [HIGH] — `setTimeout(advance, 50)` in handleDismissed (cross-ref §1.2)
Same root cause; counted once.

### Finding 2.3 [PROOF-OF-SURVIVAL] — Toast useEffect cleanup is complete
**Site:** `components/toast/Toast.tsx:84-88`

Verified: cleanup clears timer + cancels both shared values. No animation leaks.

### Finding 2.4 [MEDIUM] — Stale closure in `dismiss`/`finalize`
**Site:** `components/toast/Toast.tsx:96-107`

`dismiss` and `finalize` are inline function declarations, recreated each render but captured by the FIRST `useEffect`'s `setTimeout`. If `reduceMotion` changes mid-toast life, the captured `dismiss` still uses the original `reduceMotion` value. Minor visual issue only — no leak.

**Fix:** convert `dismiss` to a `useCallback` with deps and pass into the timer via a ref.

### Finding 2.5 [PROOF-OF-SURVIVAL] — `runOnJS(finalize)` is safe on unmounted
React 18+ no longer warns on setState-after-unmount, and `handleDismissed` uses functional setState. Late callbacks no-op.

### Finding 2.6 [PROOF-OF-SURVIVAL] — No AsyncStorage / disk writes
Static grep of `components/toast/**`, `hooks/use{Toast,Mutation,Booking,Payment,Reduced}*`, `lib/{haptics,accessibility}` returns zero `AsyncStorage` / `SecureStore` / `FileSystem` imports. `lastSeenRef` is in-memory only as specified.

---

## §3 — Convex Subscription Adversary `[Adversarial agent]`

Tests: `__tests__/notifications/convex.test.ts` (6 tests, all pass).

### Finding 3.1 [MEDIUM] — Reconnect flood
On reconnect, Convex emits a single fresh snapshot with all missed transitions at once. The diff against `lastSeenRef` produces N events; `queue.forEach(fire)` enqueues all N; queue cap = 3 drops the older N-3. User sees only the most recent 3 transitions; earlier ones (which may include important Trust-Moment events like "parts came in under estimate") are silently dropped.

**Recommendation:** when `fresh.length > 3`, condense to one summary toast: "${n} updates while you were offline." Out of MVP scope; flagged.

### Finding 3.2 [LOW] — Identical `changed_at` ordering
`convex/bookings.ts:10871` sorts ascending by `changed_at`. JavaScript's sort is stable, so identical timestamps preserve insertion order. Deterministic per fetch. Pass.

### Finding 3.3 [HIGH] — `bookingId` change does not reset refs
Cross-ref §1.1.

### Finding 3.4 [MEDIUM] — Late Stripe webhook fires stale toast
**Scenario:** user cancels booking → 4 minutes later, delayed Stripe webhook delivers the original `authorized` row. `usePaymentStatusToasts` sees `lastStatusRef.current = null` (first response after navigate-back), fires "Card held" for a cancelled booking.

**Fix:** gate the hook on booking status (`if (booking.status === 'cancelled_*') return`). Requires passing booking status as a second arg, or co-mounting `useBookingStatusToasts` first and short-circuiting in payment hook based on its state.

### Finding 3.5 [N/A] — `changed_by === null` is moot until self-filter is implemented server-side
Cross-ref §1.4.

### Finding 3.6 [LOW] — Malformed bookingId casts
`app/booking/mechanic/[id]/booking-details.tsx` filters `tire_quote_` / `booking_` prefixes but doesn't validate the remainder is a real Convex id. A garbage URL like `/booking/mechanic/zzz/booking-details` passes through to `useQuery` which throws server-side. Acceptable — Convex client surfaces a clear error.

---

## §4 — Accessibility Adversary `[Adversarial agent]`

Tests: `__tests__/notifications/a11y.test.ts` (8 tests, all pass).

### Finding 4.1 [PROOF-OF-SURVIVAL] — accessibilityLiveRegion mapping correct
Verified in test: assertive for error/warning, polite for success/info/trust.

### Finding 4.2 [MEDIUM] — `accessibilityRole="summary"` platform divergence
**Site:** `components/toast/Toast.tsx:143`

iOS VoiceOver reads "summary, ${label}". Android TalkBack has no direct mapping; `accessibilityLiveRegion` handles announcement separately. Acceptable but document the divergence.

### Finding 4.3 [PROOF-OF-SURVIVAL] — Dynamic Type clamp at 1.6 works
Verified in test: `min(getFontScale(), 1.6)` math is correct across small/default/XXXL fontScale values.

### Finding 4.4 [HIGH] — Reduce Motion does not suppress swipe-bounce spring
**Site:** `components/toast/Toast.tsx:131`

`swipeGesture.onEnd` uses `withSpring(0, ENTER_SPRING)` to bounce the toast back when the user releases below dismiss threshold. Even with `reduceMotion = true`, the bounce runs. PLAN §B.4 says motion should crossfade-only under Reduce Motion.

**Fix:**
```ts
.onEnd((event) => {
  // ...
  } else if (reduceMotion) {
    translateY.value = withTiming(0, REDUCE_FADE);
    opacity.value = withTiming(1, REDUCE_FADE);
  } else {
    translateY.value = withSpring(0, ENTER_SPRING);
    opacity.value = withTiming(1, { duration: 160 });
  }
});
```

### Finding 4.5 [HIGH] — VoiceOver swipe gesture conflicts with dismiss swipe
**Site:** `components/toast/Toast.tsx:114-134`

When VoiceOver is active, single-finger swipe routes to VoiceOver focus navigation. The Pan gesture's `translationY < -32 || velocityY < -600` thresholds never trigger because VoiceOver intercepts the touch first. Tap-anywhere-to-dismiss still works; swipe is silently unavailable.

**Recommendation:** add `accessibilityActions={[{name: 'activate', label: 'Dismiss notification'}]}` and an `onAccessibilityAction` handler. Out of MVP scope per ROUTE-GAPS sizing, but flagging.

### Finding 4.6 [LOW] — Color distinguishability under deuteranopia
**Site:** `components/toast/tokens.ts`

Success (green) vs Trust (blue) discriminable via distinct icons (`CheckCircle2` vs `ShieldCheck`) + distinct backgrounds. Color is not the only signal. Pass.

### Finding 4.7 [LOW] — Dynamic Island inset
`topOffset = insets.top + 8` handles iPhone 14/15/16 Pro automatically via `useSafeAreaInsets`. Manual sim verification recommended.

### Finding 4.8 [MEDIUM] — iOS VoiceOver focus disruption mid-form
When an Error toast appears during text input, iOS VoiceOver announces it mid-typing. Platform-native behavior; not a fix target but documented for QA matrix.

---

## §5 — Network Chaos Engineer `[Adversarial agent]`

Tests: `__tests__/notifications/network.test.ts` (6 tests, all pass).

### Finding 5.1 [HIGH] — Offline → online reconnect drops older toasts
Cross-ref §3.1; same root cause from network angle.

### Finding 5.2 [PROOF-OF-SURVIVAL] — Mutation acks awaited, never speculative
`useMutationWithToast.ts:60` awaits the Convex round-trip before firing success. No retraction needed.

### Finding 5.3 [HIGH] — Server-side success + client-side timeout = misleading Error toast
**Scenario:**
1. User taps Save → mutation sent
2. Server commits successfully
3. ACK packet drops; Convex client times out (~20s default)
4. `useMutationWithToast` catches → fires Error toast "Couldn't save"
5. The reactive subscription DOES reflect the saved row a few seconds later

The user sees "Couldn't save" + the new row appearing in their list. Cognitive dissonance, plus low trust in the error toast going forward.

**Mitigation candidates:**
- Bump per-mutation timeout to ~60s for non-time-critical actions
- Post-error reconciliation: refetch authoritative state in the error path; if mutation succeeded, fire a corrective Success toast
- Document explicitly in error string: "Couldn't confirm. Check booking-details to verify."

Out of MVP scope; documenting.

### Finding 5.4 [MEDIUM] — Convex URL unreachable
Convex client correctly returns undefined indefinitely → no toasts fire from subscriptions. One-off mutations throw on first attempt → wrapper fires Error toast. Acceptable degradation.

### Finding 5.5 [PROOF-OF-SURVIVAL] — App kill mid-toast leaves no orphan state
`lastSeenRef` in-memory; next launch re-initializes from new useQuery snapshot.

### Finding 5.6 [MEDIUM] — No client-side mutation timeout in wrapper
`useMutationWithToast` does not impose its own timeout. A 60s hang leaves the button in `loading=true` indefinitely. Recommended: wrap with `Promise.race` against a 30s timeout. Caveat — see §5.3.

---

## §6 — Adversarial String Auditor `[Adversarial agent]`

See `STRING-DEFECTS.md` for the full per-string punch list. Summary here.

### Finding 6.1 [HIGH] — Strings invented in Step 0/3 lack explicit Trust-Engineering sign-off in `PLAN.md`
The following strings landed in code but are NOT in PLAN §B.7's signed list. They were Step 0 downgrades or Step 3 inferred from context. Each needs explicit review before merge:

| String | Site | Status |
|---|---|---|
| "Pick a date first." | `app/booking/mechanic/[id]/confirmation.tsx:333` | ✓ dashboard tone, acceptable |
| "Couldn't add to your calendar. Open Settings to grant access." | confirmation.tsx:367 | ✓ |
| "Couldn't add to your calendar." | confirmation.tsx:374,381,384 (sanitized) | ✓ |
| "Added to your calendar." | confirmation.tsx:378 | ✓ |
| "Notifications stay off — change anytime in Settings." | coming-soon.tsx | ✓ |
| "You're on the list." / "We'll let you know when {serviceName} launches." | coming-soon.tsx | ✓ |
| "Couldn't update notification settings." | coming-soon.tsx | ✓ |
| "Gift card on its way — arrives within 3 business days." | membership.tsx:883 | ✓ |
| "Couldn't redeem. Try again." | membership.tsx:890 | ✓ |
| "Couldn't update your profile photo." | edit-profile.tsx:388 | ✓ |
| "Couldn't update your name." | edit-profile.tsx:402 | ✓ |
| "Couldn't update your contact info." | edit-profile.tsx:425 | ✓ |
| "Couldn't save this address." | saved-addresses.tsx:156 | ✓ |
| "Couldn't delete this address." | saved-addresses.tsx:175 | ✓ |
| "Couldn't save your notification settings." | notification-preferences.tsx | ✓ |
| "Couldn't auto-fill vehicle details. Enter them manually below." | cars/index.tsx:909 | ✓ |
| "Couldn't set as primary. Try again." | cars/index.tsx:1237 | ✓ |
| "Couldn't remove this vehicle. Try again." | cars/index.tsx:1259 | ✓ |

Trust-Engineering Reviewer pass: **all 18 inferred strings sign off as dashboard-tone.** None sell, hype, anxiety-bait, or interpolate raw OS errors.

### Findings 6.2 — 6.7 — Interpolation defects
See `STRING-DEFECTS.md` for the punch list (negative-diff "Finished -3 minutes ahead", zero-amount edge cases, plural guards, undefined-mechanic fallbacks, long shop-name overflow).

---

## Recommendation

**Proceed to Prompt 3 fix loop** for the 7 High findings:
1. §1.1 — Reset lastSeenRef/lastStatusRef on bookingId change (2 one-liners)
2. §1.2 — Track `setTimeout(advance, 50)` in a ref + clear on unmount
3. §1.4 — Spot-audit migrated mutations; either OK or surface to backend team
4. §4.4 — Reduce Motion suppression of swipe-bounce spring
5. §4.5 — Add `accessibilityActions` for VoiceOver dismiss
6. §5.3 — Decide policy on server-success/client-timeout (longer timeout + reconciliation, OR document)
7. §5.1 — Reconnect-flood: condense to summary toast OR cap to most-recent-3-explicit

Estimated fix loop: 2–3 hours including verification reruns.

**No critical blockers; branch is reviewable as-is for Phase 2.5 wrap.** None of the High findings is a money/data-loss bug. They are robustness improvements that should land before launch but don't invalidate the architecture.
