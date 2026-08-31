# Web port request — Quick Check v2 + Tiered Interval Fallback v2

For the `~/Downloads/otopair-web` terminal. Everything below landed in the
mobile repo on branch `merge/temur-2` across nine commits.

Read the two ⚠️ items first — they are already live on the shared Convex
deployment (`adamant-guineapig-82`), so web's copies are stale **right now**
and pushing web's `convex/` before porting them will silently revert both.

---

## ⚠️ 1. Convex — already deployed, will revert if you push first

Both files are shared and both were deployed from mobile. Web has no runtime
caller of either mutation, so nothing on your side breaks by taking them; the
danger is only in NOT taking them.

### `convex/vehicles.ts` (162 lines drifted)

Two fixes, both correctness rather than features.

**`autoCompleteNewVehicleOnboarding`** used to write
`knownIssues: ["no_all_clear"]` and set `onboardingComplete`. That answered the
warning-lights question on the driver's behalf — a fabricated "all clear" means
a genuinely lit dash scores as a clean one and nothing corrects it until a
mechanic sees the car. It also burned the `profile_complete` one-time key, so
the +5 HP never landed when the driver actually finished.

It now seeds records and nothing else, gated on `vehicle_age_years <= 1`,
because "under 1,000 miles" was catching eight-year-old low-mileage cars and
inventing ten factory-fresh service records for them. It is also no longer a
one-shot (it no longer sets `onboardingComplete`), so it no-ops when records
already exist rather than re-stamping every anchor to today.

**`saveOnboardingField`'s auto-complete branch** is now gated on the FIELD
being saved, not just the resulting state:

```ts
const answeredLightsNow = field === "warningLights" || field === "knownIssues";
const isComplete = answeredLightsNow && hasMileage && hasWarningLights;
```

`knownIssues != null` was never a reliable proxy for "the driver answered the
lights question" — `updateWarningLight` and the Oto chat both patch that array
directly, so a driver who reported a light mid-onboarding and then saved any
unrelated field completed their onboarding by accident, banking the HP and
clearing the mandatory booking check-in gate (`convex/checkin.ts:75`).

### `convex/service_intervals_queries.ts` (87 lines drifted)

Both queries now return `{ intervals, profile }` instead of a bare interval
map. `profile` is the `VehicleFallbackProfile` — vehicle class, pricing tier,
make, drivetrain, `hasDifferential`, turbo, fuel class — resolved from two
extra `db.get`s.

**The bug worth knowing:** `vehicle_configs` stores `make_id` (a reference),
not `make`. Resolving the class without joining `makes` returns Class A for
every car, silently. There is also no config in the DB carrying `pricing_tier`
yet, which is why `MAKE_TO_CLASS_FALLBACK` exists in `utils/vehicleClass.ts`.

Consumers unwrap `.intervals`; the hook signature did not change.

---

## 2. `lib/warningLightVocab.ts` (19 lines) — unblocks the red parity test

`tests/webHealthScoreParity.test.ts` has been red on this since May. The
`not_sure: "not_sure_which"` alias was removed: `not_sure` is the stepper's
answer to "is a light on?" meaning **I don't know whether one is on**, which is
a different thing from `not_sure_which` — "one IS on and I can't identify it",
a confirmed light that deducts. `not_sure` is a bare sentinel like
`no_all_clear`, not a light.

Two stale comments in your tree reference behaviour that no longer exists:
- `lib/warningLightVocab.ts:12` cites `autoCompleteNewVehicleOnboarding` as a
  writer of `no_all_clear` — it no longer writes it.
- `utils/maintenanceStatus.ts:47` cites `estimateServiceAnchorFromRecency`,
  which is deleted (see §4).

---

## 3. `utils/healthScore.ts` — 10 lines added, 0 changed

The calculator is frozen: `STATUS_SCORE`, `CATEGORY_WEIGHTS`, the 85/15 split,
the open-recs cap and `isScorableMaintenanceItem` are all untouched. The spec's
factor column (1.00 / 0.70 / 0.35 / 0.10) is already `STATUS_SCORE` verbatim,
which is why no formula changed.

The one addition is an explicit held branch:

```ts
const score = item.rawScore ?? STATUS_SCORE[item.status];
// Confidence hold (Fallback v2 §5)
if (item.factorApplied === 1 && item.status !== "on_time") continue;
```

This fixes an existing *accidental* skip. A held item has `status: "due_soon"`
and `rawScore: 1.0`, took the negative branch, computed `(1 - 1.0) × share = 0`,
and got swallowed by the `pts <= 0` guard. The headline was right but "what's
affecting your score" never mentioned it — by accident, which is how it would
have silently regressed.

**Do not reach for `excludeFromScore` here.** `weightTotal += w` only
accumulates for included items, so excluding a held item removes its weight
from the denominator and redistributes it across every other item, changing
their shares. A held item must stay in the denominator at factor 1.00.

---

## 4. `utils/maintenanceStatus.ts` (579 lines drifted) — port the changes, never the file

- **Interval tiers are now OEM → class default.** `DEFAULT_INTERVALS` and
  `MAKE_OVERRIDES` are gone as the base. All 23 make overrides carried an `oil`
  key, so leaving make above class would mean the new table never reaches
  Toyota, Honda, BMW or Ford — most of the fleet — and it directly contradicts
  the table (`toyota.oil = 5000/6` vs Class A 7,500/12).
- **Driving-condition multipliers only apply when `source !== "oem"`.** A
  manufacturer's own severe-service schedule already accounts for city driving.
  ⚠️ This is the most user-visible number in the change: a city-driven Toyota's
  oil interval goes from `5000 × 0.8 = 4,000` to `7500 × 0.8 = 6,000` miles.
  Yassin has not signed this off — see the open questions below.
- **`getInterval` returns `{...interval, source}`** and `ratioToStatus` is
  deleted in favour of `ratioToBand` from the new `intervalBands` module.
- **`getMonthlyMiles` is exported** so `quickCheckAnchor` shares the one
  `{light:500, average:1000, heavy:1500}` map rather than copying it.
- **`estimateServiceAnchorFromRecency` is deleted.** It spoke the v1 recency
  buckets, which v2 replaces; keeping it alive kept a second vocabulary alive.
  Neither repo has a caller. `tests/catalogRecencyAnswer.test.ts` went with it.
- **Tire symptoms now affect status.** `symptom === "losing_air" | "vibration"`
  outranks a healthy interval. The v1 vocabulary has no field for these —
  `tireRepaired` means an already-patched puncture, a different thing with
  different copy — so the answer was being collected and ignored.
- **`computeHybridStatus` emits `bandStatus`, `intervalSource`,
  `factorApplied`,** and `rawScore` only when held.

---

## 5. New modules — port verbatim, but only these four

The interval engine:

| file | what it is |
|---|---|
| `utils/intervalBands.ts` | 0.8 / 1.0 / 1.5 cutoffs, band → factor, band → status, the confidence hold |
| `utils/vehicleClass.ts` | tier → A/B/C plus the three exceptions, `MAKE_TO_CLASS_FALLBACK` |
| `utils/classIntervals.ts` | the v2 table, slug-keyed, with the turbo and drivetrain modifiers |
| `utils/serviceIntervalGuardrails.ts` | bounds + `safeInterval` + `isTrustedInterval` + `clampClassIntervalToBounds` |

The Quick Check screen modules — `quickCheckFiring`, `quickCheckAnchor`,
`quickCheckBiggerServices`, `quickCheckDraft`, and everything under
`components/cars/quickcheck/` — are **mobile-only**. Web has no Quick Check
surface, so there is nothing on your side to consume them.

Two things in the guardrails module are worth reading before you use them:

- **`safeInterval` snaps an untrusted value to the bounds FLOOR.** Run the
  class table through it and Class A spark plugs go from 90,000 miles to
  20,000 — the floor — which would flag every driver's plugs at 16,000 miles.
  The confidence machinery defends against bad scraped data, not against our
  own engineering constants. Use `clampClassIntervalToBounds` for class values.
- **Enrichment has to be trustworthy to outrank the class table.** The pipeline
  writes `default_fallback` rows at confidence 0.5, and a floored guess is
  worse information than the table. `isTrustedInterval` is the gate.

---

## 6. What does NOT port

`utils/mergedMaintenance.ts` — the catalog-coverage pass. Web's file is 283
lines to mobile's 642 and has no `computeFromOdometerStatus` at all, so the
pass this change touches does not exist on your side. Skip it.

---

## 7. Parity coverage — a real gap

`tests/webHealthScoreParity.test.ts` feeds `computeVehicleHealthScore`
hand-built items whose statuses are **already decided**. It never exercises
`computeMaintenanceStatus` or `getInterval`, so the entire interval-resolution
half of this work would ship across two repos with zero automated parity
coverage — verified by eye only.

Worth adding a sibling `tests/webIntervalParity.test.ts` driving
`computeMaintenanceStatus` over a make × class × drivetrain × turbo × odometer
grid, with the same skip-if-absent and byte-identical-deps guards the existing
harness uses.

---

## 8. Open with Yassin, not with us

Ten spec-vs-code conflicts came out of this build. Two change what drivers see
and neither is signed off:

1. **Driving conditions × the class table** — the 4,000 → 6,000 mile oil
   interval above. The spec is silent on driving conditions entirely.
2. **Engine-air and cabin filters share one taxonomy slug.**
   `filter_replacement` covers both, so the spec's separate 30,000/40,000/20,000
   and flat-20,000 intervals are not expressible. Shipped at the stricter value
   (20,000/24 — cabin wins) pending a spec amendment.
