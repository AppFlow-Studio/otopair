# Responsive Booking-Flow Sheets

## Goal

Make every sheet used by the newer `app/(booking-flow)` route usable across supported phone sizes, including iPhone SE-class screens, without shrinking typography or reducing interactive controls below accessible touch-target sizes.

## Scope

This change covers sheet-like surfaces owned or directly used by the newer booking flow:

- `app/(booking-flow)/select-services.tsx`
- `app/(booking-flow)/category/[tab].tsx`
- `app/(booking-flow)/choose-mechanic.tsx`
- `components/booking-flow/SelectedServicesSheet.tsx`
- `components/booking-flow/VehicleSwitcherSheet.tsx`
- `components/booking-flow/ServiceInfoSheet.tsx`
- `components/booking-flow/MonthPickerSheet.tsx`
- Shared booking-flow CTA and sheet layout helpers required by those surfaces

The booking-flow search and date/time screens are full-screen routes rather than bottom sheets. Their existing scroll behavior remains unchanged except where their overlaid booking-flow sheet or CTA requires safe-area clearance.

Sheets imported from legacy booking components by the category route are outside this change unless a booking-flow wrapper must provide clearance for them. Their internal behavior is not redesigned.

## Current Problems

The booking flow currently mixes custom animated sheets, `FloatingSheet`, a Gorhom bottom sheet, and a modal card. Their sizing is inconsistent:

- Several dimensions are derived from `Dimensions.get("window")` at module load, so they do not respond to viewport changes.
- The Select Services body is a non-scrollable `View`, allowing content to be clipped on short screens.
- The category service list does not scroll and does not reserve enough space for the overlaid Continue bar.
- Floating sheets cap their height but do not consistently provide a scrollable overflow region or safe-area bottom padding.
- Fixed percentages and unscaled spacing leave too little breathing room near the bottom edge on some devices.

## Chosen Approach

Use a shared responsive sizing policy with targeted updates to each sheet.

1. Add `react-native-size-matters`.
2. Use its moderated scaling functions for spacing, radii, offsets, row estimates, and sheet geometry.
3. Preserve existing text sizes and interactive control sizes. Touch targets remain at least 44 points.
4. Use `useWindowDimensions` inside responsive sheet components so viewport-dependent heights are recalculated when dimensions change.
5. Make content scroll when it exceeds the available sheet height.
6. Include safe-area insets and overlaid CTA heights when calculating bottom content padding.

This avoids a broad rewrite of all sheets onto a single sheet library. Existing gestures and visual structure remain intact.

## Responsive Layout Policy

The implementation will introduce a small booking-flow-specific helper module for pure layout calculations. It will:

- Clamp initial and maximum sheet heights to the current viewport.
- Calculate content bottom padding from safe-area inset, CTA height, and moderated spacing.
- Calculate floating-sheet heights from content estimates while respecting a viewport-relative ceiling.
- Expose pure functions that can be tested against small, standard, and large phone dimensions.

`react-native-size-matters` will be used directly or through these helpers. It will not replace the existing app-wide responsive utility in unrelated screens.

Typography will not be scaled down for small screens. Horizontal and vertical whitespace may reduce moderately, but controls will retain accessible dimensions.

## Surface Changes

### Select Services

- Replace module-level screen-height constants with values derived from `useWindowDimensions`.
- Recalculate the animated sheet height bounds when the viewport changes.
- Render the body in a gesture-compatible scroll view.
- Add safe-area-aware bottom padding so Quick Book pills can scroll fully above the device edge.
- Preserve the custom release-where-dragged sheet behavior.

### Category Detail

- Replace module-level screen-height constants with reactive dimensions.
- Put the service list in a gesture-compatible vertical scroll container.
- Reserve bottom content space for the sticky Continue bar and safe area.
- Preserve the custom sheet drag behavior and service selection interactions.

### Choose Mechanic

- Replace fixed screen width with `useWindowDimensions` for carousel page width and page-index calculations.
- Derive snap heights from the current viewport while preserving the current compact and expanded states.
- Ensure the carousel content can fit or scroll vertically within the active sheet height.
- Keep the Continue bar outside the sheet and reserve enough content space above it.

### Selected Services

- Compute its snap height from current viewport height rather than a module-level constant.
- Keep the header fixed and the service rows scrollable.
- Add safe-area-aware list padding.

### Vehicle Switcher

- Compute its snap height from current viewport height.
- Make the vehicle list scroll when it exceeds the available height.
- Preserve row and thumbnail sizes.

### Service Info

- Compute its height from the current viewport.
- Allow content to scroll if accessibility text sizing or a short viewport causes overflow.

### Month Picker

- Replace the fixed percentage-only cap with a viewport-aware maximum height.
- Add safe-area bottom padding and keep the month list scrollable.

### Shared CTAs

- Keep button text and touch targets unchanged.
- Use moderated spacing for outer padding.
- Publish or reuse a single CTA-clearance value so sheet content consistently scrolls above overlaid bars.

## Error and Edge Handling

- Empty lists continue to render their existing empty states.
- A viewport resize clamps the current custom sheet height into the new valid range rather than resetting navigation or selection state.
- Safe-area values are additive and never reduce the minimum content padding.
- Very large carts, vehicle lists, or month lists scroll inside the capped sheet.
- Existing drag-to-dismiss and backdrop dismissal behavior remains unchanged.

## Testing

Add focused unit tests for the pure layout helper functions:

- Short phone height representative of an iPhone SE.
- Current design/reference phone dimensions.
- Taller phone dimensions.
- Content-height clamping at minimum and maximum bounds.
- CTA and safe-area clearance calculations.

Verification will also include:

- TypeScript and lint checks for changed files.
- Existing source tests.
- UI audit for theme usage, shared UI patterns, types, accessibility, and bottom-sheet conventions.
- Manual browser/device verification where the local Expo target is available, checking that the last item or pill can be fully scrolled above the bottom edge on a short viewport.

## Non-Goals

- Redesigning the booking flow.
- Converting every sheet to `@gorhom/bottom-sheet`.
- Scaling typography down on small devices.
- Refactoring legacy booking sheets.
- Changing booking state, navigation, pricing, or service-selection behavior.
