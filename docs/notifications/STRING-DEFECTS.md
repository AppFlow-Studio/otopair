# OtoPair — Notification String Defects (Phase 2.5)

> Adversarial string audit of every user-facing toast string that landed on `feat/in-app-notifications`. Trust-Engineering rubric applied to literals AND to interpolation edge cases. Each row: severity, site, observed-or-projected rendered output, recommended fix.

## Dashboard-tone audit summary

✅ **All 18 inferred strings from Step 0 / Step 3 migration sign off as dashboard-tone.** None hype, sell, anxiety-bait, gamify, or interpolate raw OS error messages. See STRESS-REPORT.md §6.1 for the full sign-off list.

✅ **No raw OS-error interpolation in code.** PLAN §B.7 rule honored:
- `confirmation.tsx:384` catch block — sanitized to "Couldn't add to your calendar."
- `membership.tsx:890` catch block — sanitized to "Couldn't redeem. Try again."

## Interpolation defects (project from string templates in subscription hooks)

These strings live in `hooks/useBookingStatusToasts.ts` and `hooks/usePaymentStatusToasts.ts` (or in PLAN.md §B.7 awaiting eventual server-side formatting). All `{placeholder}` substitutions are projected; the actual interpolation isn't wired up yet, so these are defects-in-waiting that Phase 3 needs to handle when the strings get formatted.

### Finding 1 [HIGH] — Negative-diff "Finished" string

| Template | Edge case | Rendered |
|---|---|---|
| `"Finished {n} minutes ahead of estimate."` | `actual_duration_minutes` > `estimated_labor_minutes` (job ran LONG, derived event still fires by bug) | `"Finished -23 minutes ahead of estimate."` |

**Fix:** server-side guard. Only enqueue the `completed_early` derived event when `actual_duration_minutes < estimated_labor_minutes * 0.9`. Today the spec says this (PLAN §B.7) but if any consumer fires the trust toast directly, the negative case shows. Add a defensive `Math.max(0, diff)` in the formatter and bail if 0.

### Finding 2 [HIGH] — Zero / negative-diff "Parts came in under" string

| Template | Edge case | Rendered |
|---|---|---|
| `"Parts came in ${diff} under the estimate."` | diff = 0 | `"Parts came in $0 under the estimate."` |
| same | diff < 0 (over-estimate) | `"Parts came in $-42 under the estimate."` |

**Fix:** the `parts_under_low` derived event should only fire when `actual_parts_cost < parts_cost_low`. Defense in depth: in the formatter, `if (diff <= 0) return null` (skip the toast). Currency formatter should also handle integer-cents rounding to avoid `$41.999999`.

### Finding 3 [HIGH] — Overflow / commas in large amounts

| Template | Edge case | Rendered |
|---|---|---|
| `"${amount} refunded to •••• {last4}."` | amount = `1847392.50` | `"$1847392.5 refunded to •••• 4242."` (no commas, single decimal) |
| `"Charged ${amount} to •••• {last4}."` | amount = `0` | `"Charged $0 to •••• 4242."` |

**Fix:** standardize a `formatMoney(amount)` helper. Recommended: `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Always two decimals; never display $0 amounts (skip toast).

### Finding 4 [HIGH] — Currency formatting drift between call sites

PLAN.md §B.7 mixes `$186.00`, `$186`, and `${amount}` literally. No central formatter is shipped. Today there are no real interpolations in the migrated code (subscription strings are pre-formatted with `${diff}` placeholders waiting for the server-side derived event payload), but the moment Phase 3 wires real values, drift becomes visible.

**Fix:** create `lib/format-money.ts` with a single `formatMoneyForToast(cents)` function. Document it in USAGE.md.

### Finding 5 [HIGH] — Time formatting drift

| Template | Variant A | Variant B | Variant C |
|---|---|---|---|
| `"Booking confirmed for {weekday}, {time}."` | "Thursday, 9:00 AM" | "Thu 9am" | "May 21, 9:00" |

The booking detail screen already has a `getFormattedAppointmentTime()` store helper. Reuse it.

**Fix:** create `lib/format-time.ts` with `formatBookingTimeForToast(date, time)` returning "{Weekday}, {h}:{mm} {AM/PM}". Match the booking-details screen pattern for consistency.

### Finding 6 [MEDIUM] — Singular/plural unguarded

| Template | Edge case | Rendered |
|---|---|---|
| `"Finished {n} minutes ahead of estimate."` | n = 1 | "Finished 1 minutes ahead of estimate." |

**Fix:** `n === 1 ? "minute" : "minutes"`. Trivial.

### Finding 7 [MEDIUM] — Undefined mechanic / shop interpolation

| Template | Edge case | Rendered |
|---|---|---|
| `"{Mechanic} updated their ETA to {time}."` | mechanic.first_name = undefined | `"undefined updated their ETA to 10:15 AM."` |
| `"{Shop} can't take this booking."` | shop.name = undefined / empty | `"undefined can't take this booking."` or `" can't take this booking."` |
| `"{Shop} cancelled this booking."` | same | same |

**Fix:** fallback chain: `mechanic.first_name || mechanic.name || "Your mechanic"`. For shops: `shop.name || "The shop"`. Define once in the formatter; do NOT inline at call sites.

### Finding 8 [MEDIUM] — Long shop / mechanic names

| Template | Edge case | Rendered |
|---|---|---|
| `"{Shop} cancelled this booking. Tap to rebook."` | shop.name = "World-Class Automotive Repair & Diagnostic Center Inc." | Title wraps to 2 lines (ellipsizes at "World-Class Automotive Repair…") |

Toast title `numberOfLines={2}` + `ellipsizeMode="tail"` already in `Toast.tsx:172` — handled. Verified. Acceptable.

### Finding 9 [LOW] — `${diff}` vs `${amount}` placeholder consistency

PLAN.md alternates between `${diff}` (parts-cost delta), `${amount}` (refund/charge), `${total}` (partial-refund context). The hook implementations currently hardcode the templates without these substitutions. When server-derived events arrive with a payload, the formatter needs to know which key. Document the contract.

**Fix:** standardize the derived-event payload shape: `{ kind: "parts_under_low"; diff_cents: number; ... }` and pin formatter dispatch on `kind`.

## What's currently shipped (literally)

These strings have no interpolation today and pass audit unchanged:

- `useBookingStatusToasts.ts` has `"Booking confirmed"` / `"Your shop accepted this appointment."` as constants — the `{weekday}` / `{time}` interpolation is NOT yet wired. Phase 3 must add it (with the formatter recommendations above).
- `usePaymentStatusToasts.ts` has `"Payment captured"` / `"Charged to your saved card."` — same; no `${amount}` or `last4` interpolation yet. Phase 3.

These are intentional staging strings. The hooks fire toasts that match the spec's intent without exposing un-formatted interpolation today. The actual `${amount}` rendering is a Phase 3 task — and the defects above are the punch list for that work.

## Recommendation

- Build `lib/format-money.ts` + `lib/format-time.ts` before Phase 3 wires server payloads
- Add the negative/zero/null guards as the FORMATTER's job, not the call site's
- Update USAGE.md with the formatter contract once shipped
