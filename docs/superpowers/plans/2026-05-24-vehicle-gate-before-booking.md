# Vehicle Gate Before Booking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercept the booking flow entry point on the home screen when the user has no vehicle, showing a bottom sheet that gates them to add one first.

**Architecture:** All changes are confined to `app/(main-tabs)/home/index.tsx`. The data needed (`hasVehicles`, `vehiclesLoading`) is already fetched by the existing `useVehicleOwnershipFromConvex` hook on that screen. A new `BottomSheetModal` ref is added alongside the existing reactivation sheet; `handleMapPress` is updated to open it instead of navigating when no vehicle exists.

**Tech Stack:** React Native, `@gorhom/bottom-sheet` (`BottomSheetModal`), Expo Router, existing OtoPair style keys

---

## File Map

| File | Action | What changes |
|---|---|---|
| `app/(main-tabs)/home/index.tsx` | Modify | Add `noVehicleSheetRef`, call `useWindowDimensions()`, update `handleMapPress`, add sheet JSX, add 2 new style keys |

---

### Task 1: Wire up `useWindowDimensions` and add the new sheet ref

**Files:**
- Modify: `app/(main-tabs)/home/index.tsx:124–144`

`useWindowDimensions` is already imported (line 3) but never called in the component body. We need screen height to cap the sheet's dynamic size.

- [ ] **Step 1: Add `useWindowDimensions` call**

Find this block (around line 124):

```tsx
  const stableInsetTop = initialInsetTopRef.current;
  const router = useRouter();
  const { isNewUser, shouldShowReactivationSheet, setShouldShowReactivationSheet } = useAuthStore();
```

Add the `useWindowDimensions` call on a new line immediately after `const stableInsetTop`:

```tsx
  const stableInsetTop = initialInsetTopRef.current;
  const { height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const { isNewUser, shouldShowReactivationSheet, setShouldShowReactivationSheet } = useAuthStore();
```

- [ ] **Step 2: Add the new ref alongside the reactivation sheet ref**

Find this block (around line 141):

```tsx
  // Reactivation bottom sheet (from temur-dev)
  const sheetRef = useRef<BottomSheetModal>(null);
  const hasPresentedReactivationRef = useRef(false);
  const snapPoints = useMemo(() => ["42%"], []);
```

Add the new ref on a new line directly after `sheetRef`:

```tsx
  // Reactivation bottom sheet (from temur-dev)
  const sheetRef = useRef<BottomSheetModal>(null);
  const hasPresentedReactivationRef = useRef(false);
  const snapPoints = useMemo(() => ["42%"], []);
  const noVehicleSheetRef = useRef<BottomSheetModal>(null);
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

---

### Task 2: Update `handleMapPress` to gate on vehicle state

**Files:**
- Modify: `app/(main-tabs)/home/index.tsx:417–419`

- [ ] **Step 1: Replace `handleMapPress`**

Find the current implementation (around line 417):

```tsx
  const handleMapPress = () => {
    router.push("/booking/map");
  };
```

Replace it with:

```tsx
  const handleMapPress = () => {
    if (vehiclesLoading) return;
    if (!hasVehicles) {
      noVehicleSheetRef.current?.present();
      return;
    }
    router.push("/booking/map");
  };
```

`vehiclesLoading` and `hasVehicles` are already destructured at line 127:
```tsx
const { vehicles: listVehicles, hasVehicles, isLoading: vehiclesLoading } = useVehicleOwnershipFromConvex();
```
No new imports or hook calls needed.

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(main-tabs)/home/index.tsx"
git commit -m "feat: gate handleMapPress behind vehicle check"
```

---

### Task 3: Add the bottom sheet JSX

**Files:**
- Modify: `app/(main-tabs)/home/index.tsx` — JSX return, after the closing `</BottomSheetModal>` of the reactivation sheet (around line 859)

The new sheet goes inside the fragment (`<>`) that wraps the whole return, alongside the existing sheets (`BookingDetailsSheet`, `LeaveReviewSheet`, `FinishCarSetupPickerSheet`).

- [ ] **Step 1: Add the sheet**

Find this comment (around line 864):

```tsx
    {/* Booking details sheet — opened by the upcoming appointment card's
        View Details button. Mirrors the bookings tab's wiring. */}
    <BookingDetailsSheet ref={detailsSheetRef} />
```

Insert the new sheet immediately before it:

```tsx
    {/* No-vehicle gate — shown when user taps into booking without a vehicle */}
    <BottomSheetModal
      ref={noVehicleSheetRef}
      enableDynamicSizing
      maxDynamicContentSize={screenHeight * 0.46}
      backdropComponent={BlurBackdrop}
      enableContentPanningGesture={false}
      handleIndicatorStyle={styles.sheetHandle}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.sheetContentContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.sheetTitleWrap}>
          <View style={styles.noVehicleIconWrap}>
            <Text style={{ fontSize: 26 }}>🚗</Text>
          </View>
          <Text style={styles.sheetTitle}>Add a vehicle first</Text>
        </View>

        <View style={styles.sheetBody}>
          <Text style={styles.sheetBodyText}>
            We need to know your vehicle to match you with the right mechanic and services.
          </Text>
        </View>

        <View style={styles.sheetActions}>
          <Pressable
            style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.sheetPressed]}
            onPress={() => {
              noVehicleSheetRef.current?.dismiss();
              router.push('/add-vehicle');
            }}
          >
            <Text weight="semiBold" color="#FFF" style={styles.sheetPrimaryButtonText}>
              Add a vehicle
            </Text>
          </Pressable>

          <Pressable
            onPress={() => noVehicleSheetRef.current?.dismiss()}
            style={styles.noVehicleSecondaryAction}
          >
            <Text style={styles.noVehicleSecondaryText}>Maybe later</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>

    {/* Booking details sheet — opened by the upcoming appointment card's
        View Details button. Mirrors the bookings tab's wiring. */}
    <BookingDetailsSheet ref={detailsSheetRef} />
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

---

### Task 4: Add new style keys

**Files:**
- Modify: `app/(main-tabs)/home/index.tsx` — the `StyleSheet.create({...})` block at the bottom of the file

- [ ] **Step 1: Add the two new style keys**

Find the `sheetPressed` style (the last sheet-related style, around line 1076):

```tsx
  sheetPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
```

Add the two new keys immediately after it:

```tsx
  sheetPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  noVehicleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5299FE1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noVehicleSecondaryAction: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  noVehicleSecondaryText: {
    fontSize: 15,
    color: '#8A97A8',
  },
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(main-tabs)/home/index.tsx"
git commit -m "feat: add no-vehicle gate bottom sheet to home screen"
```

---

### Task 5: Manual verification

**Files:** None — observation only

- [ ] **Step 1: Start the dev server**

```bash
npx expo start
```

- [ ] **Step 2: Test the gate (no vehicle)**

Sign in with a test account that has **no vehicles**. Tap the booking CTA on the home screen (the map/find-a-mechanic button).

Expected:
- The "Add a vehicle first" bottom sheet appears.
- Sheet height fits content on a small screen (e.g. iPhone SE) and doesn't exceed ~46% on a large screen (e.g. iPhone 15 Pro Max).
- Tapping **"Add a vehicle"** dismisses the sheet and navigates to `/add-vehicle`.
- Tapping **"Maybe later"** dismisses the sheet and leaves the user on the home screen — no navigation.

- [ ] **Step 3: Test the happy path (vehicle exists)**

Sign in with a test account that has **at least one vehicle**. Tap the same booking CTA.

Expected:
- No sheet appears — navigates directly to `/booking/map`.

- [ ] **Step 4: Test cold-start loading guard**

On a slow network or in dev with throttling, observe behavior while `vehiclesLoading` is still `true`.

Expected:
- Tapping the CTA while loading does nothing (no sheet, no navigation). Once data resolves the button works normally.

- [ ] **Step 5: Final commit if all good**

```bash
git add "app/(main-tabs)/home/index.tsx"
git commit -m "feat: vehicle gate before booking complete"
```
