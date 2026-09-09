# Vehicle Gate Before Booking — Design Spec

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** `app/(main-tabs)/home/index.tsx` only

---

## Problem

Users can tap into the booking flow from the home screen without having added a vehicle. The booking flow requires a vehicle to function correctly, so reaching the map screen without one causes problems.

## Goal

Intercept the booking entry point when no vehicle exists. Show a contextual bottom sheet that explains the requirement and gives the user a direct path to fix it. Do not hide or disable booking UI elements.

---

## Trigger Points

Three handlers in `home/index.tsx` route into `/booking/map`:

| Handler | Needs gate? | Reason |
|---|---|---|
| `handleMapPress` (line 417) | **Yes** | Primary booking entry point, no prior vehicle check |
| `onResumePress` (line 737) | No | Resuming implies a vehicle was selected in a prior session |
| `onBookNow` in `VehicleMaintenanceCard` (line 781) | No | Already inside `{hasVehicles ? …}`, never renders without a vehicle |

Only `handleMapPress` is modified.

---

## The Check

`hasVehicles` and `vehiclesLoading` (as `isLoading`) are already returned by `useVehicleOwnershipFromConvex` at line 127 — no new data fetching needed.

Updated `handleMapPress` logic:

```
if (vehiclesLoading) return           // data not ready — do nothing, avoid false flash
if (!hasVehicles) {
  noVehicleSheetRef.current?.present()
  return
}
router.push("/booking/map")           // normal path, unchanged
```

The early return when `vehiclesLoading` is true prevents the sheet from flashing on cold start before vehicle data arrives.

---

## Bottom Sheet — Option A (Minimal)

A new `BottomSheetModal` added alongside the existing reactivation sheet in `home/index.tsx`.

**Ref:** `noVehicleSheetRef` (`useRef<BottomSheetModal>(null)`)  
**Sizing:** `enableDynamicSizing` — sheet height follows content. `maxDynamicContentSize` capped at 46% of screen height (`screenHeight * 0.46`) so it never dominates on tall devices.  
**Backdrop:** `BlurBackdrop` (matches existing sheet)

### Content

| Element | Value |
|---|---|
| Icon | Car emoji in a `#5299FE1A` tinted circle (52×52, border-radius 50%) |
| Headline | **"Add a vehicle first"** |
| Body | *"We need to know your vehicle to match you with the right mechanic and services."* |
| Primary button | **"Add a vehicle"** — full-width, `#5299FE` background → `noVehicleSheetRef.current?.dismiss()` then `router.push('/add-vehicle')` (dismiss first so the sheet doesn't fight the screen transition) |
| Secondary action | **"Maybe later"** — text-only link → `noVehicleSheetRef.current?.dismiss()` only |

### "Maybe later" behaviour

Dismissing the sheet is the complete action. Because `handleMapPress` blocked `router.push("/booking/map")` before it fired, the user never left the home screen. Dismissing returns them to exactly where they were — no additional navigation call needed.

### Styles

Reuse existing style keys already in the home screen's `StyleSheet`:
- `sheetBackground`, `sheetHandle` — sheet chrome
- `sheetContentContainer` — scroll view padding
- `sheetActions` — button wrapper
- `sheetPrimaryButton`, `sheetPrimaryButtonText`, `sheetPressed` — primary CTA
- `sheetTitle`, `sheetBody`, `sheetBodyText` — typography

New styles needed (additions only):
- `noVehicleIconWrap` — circle container for the car icon
- `noVehicleSecondaryAction` — "Maybe later" text link

---

## What Is Not Changing

- The home screen's existing reactivation sheet (`sheetRef`) — untouched
- `onResumePress` and `onBookNow` — untouched
- `useVehicleOwnershipFromConvex` hook — untouched (no new fields needed)
- The `/booking/map` screen itself — untouched
- The `/add-vehicle` screen — untouched
