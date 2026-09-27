# Android performance deep dive — why it is still sluggish (2026-09-18)

Branch `android-repair`, HEAD `b265816c`. Android only; every fix below is
gated on `Platform.OS === "android"` where it could change behaviour, and
none of them changes a pixel. Companion docs: `ANDROID_PERF_PLAN.md` (what
was tried, what survived) and `ANDROID_CRASH_AUDIT.md` §6 (the crash and
dead-end paths found in the same pass).

Evidence labels used below: **measured** = observed on the Pixel API 34
emulator today; **code-verified** = I read the lines; **investigator** =
found by one of the six read-only sweeps and spot-checked but not fully
re-read by me.

## 0. The short version

The earlier pass removed the obvious idle burners (console forwarding, the
booking-idle typewriter, the marker bob loop). What is left is structural,
and it is the same four things on Home and in the booking flow:

1. **Every Home mount and every booking entry launches Android's permission
   Activity** even though location is already granted. That pauses the whole
   app for ~200 ms, flips AppState, and triggers an over-the-air update check.
   (measured, code-verified)
2. **The React Compiler is skipping the three screens you tap on most** —
   Home, select-services, choose-mechanic — so every store write, query push
   and context tick re-renders 1,200–2,200 lines with fresh closures. Taps
   land in the middle of that. (code-verified: compiler bail-outs reproduced)
3. **Home re-renders itself per animation frame** through the coach-mark
   registry whenever any of three `height` animations inside the scroll
   content runs, and it keeps running under the booking flow because no tab
   or stack screen is ever frozen. (code-verified)
4. **The booking flow runs three Google MapViews, three location pipelines
   and up to six camera animations per entry.** (measured: two map views on
   the peek screen; code-verified: third on choose-mechanic)

Underneath that, Home never goes idle: the build on the Pixel draws 17
frames a second doing nothing because the JS typewriter runs in two search
bars (one invisible), and the Cars/Bookings tabs keep infinite Reanimated
loops alive once visited.

## 1. Runtime evidence (Pixel API 34 emulator, `15-A8b-dbg` = HEAD + A8b, no C4/C5)

The budget AVD could not be used today: it is parked on the login screen
with a "Password is incorrect" message and I do not enter credentials.
RenderThread numbers on the emulator are host-GL artefacts and are quoted
only for completeness; JS-thread, UI-thread, frame counts, Activity starts
and logcat timelines are trustworthy.

| Scenario | What was observed |
|---|---|
| Cold start | `Displayed` at **+5.27 s**; Choreographer skipped 50, 40 and 47 frames on the main thread; permission Activity launched 0.65 s after first paint; **two** expo-updates checks within 4.3 s (launch check + the one the permission round-trip triggers) |
| Home idle, 10 s, no input | **170 frames drawn** (60 % flagged janky); JS thread **900 ms**, UI thread **840 ms**, RenderThread 1,960 ms. Six screenshots 150 ms apart differ only in the header avatar and the search-bar placeholder text |
| Home scroll, 6 swipes in 9.5 s | JS thread **1,060–1,090 ms**, UI thread 900–920 ms. Exact per-frame UI-thread time (`gfxinfo framestats`, 120 frames): p50 2.5 ms, p90 4.9 ms, max 14.4 ms — **no frame over 16 ms on the UI thread**. Scroll cost is JS work plus draw, not layout |
| Tap "Map" on Home | logcat, one entry: `START … REQUEST_PERMISSIONS … GrantPermissionsActivity` → `onHostPause` → **214 ms** → `onHostResume` → `Updates state change: Check` (network to u.expo.dev) → two `MapsInitializer` → first map "Initial labeling completed" at +1.6 s, second at +2.3 s |
| Map entry, 12 s window | 52 frames, 73 % janky, p99 **500 ms**, 27 slow-UI-thread frames. Per-thread CPU: GL-Map 1,020 ms, RenderThread 780, UI 720, androidmapsapi 410, JS 280, HeapTaskDaemon 220, JIT 170 |
| Memory on map entry | Java heap 49 → 63 MB, native 123 → 149 MB; concurrent GC bursts of 280–710 ms logged |
| UI hierarchy on the peek map screen | **two** `content-desc="Google Map"` views, both live |
| Permission state | `ACCESS_FINE_LOCATION: granted=true`, `ACCESS_COARSE_LOCATION: granted=true` — the Activity launch is not asking for anything |
| Warnings | 4× `source.uri should not be an empty string` on Home (an `Image` with `uri: ""`; candidates `NowTierCallout.tsx:109/197`, `UpcomingAppointmentHero.tsx:126`, `ProfileInitialsButton.tsx:156`, `FinishCarSetupPickerSheet.tsx:85`) |

### 1.1 A/B: JS typewriter (installed build) vs the tree's worklet typewriter (C4)

Same signed-in account, same emulator, ten minutes apart, identical script
(`scratchpad/deep/baseline_then_build.sh`). `16-tree-dbg` is HEAD + the
uncommitted working tree (C4 `AndroidTypewriterPlaceholder`, C5
`CarCarousel`, Waleed's `search.tsx`/`MechanicCarouselCard.tsx` edits) built
with versionCode 14, the Maps key injected into the local manifest for the
build only, signed with `~/.android/debug.keystore`, installed **over** the
existing app (data kept).

| Home, signed in | `15-A8b-dbg` (JS typewriter) | `16-tree-dbg` (C4 worklet) |
|---|---|---|
| Idle 10 s, frames drawn | 120 / 145 | 128 / 123 |
| Idle 10 s, **JS thread** | **570 / 650 ms** | **< 10 ms** (not in the top five threads) |
| Idle 10 s, UI thread | 730 / 670 ms | 560 / 610 ms |
| Scroll (6 swipes), **JS thread** | **870 ms** | **150 ms** |
| Scroll, UI thread | 910 ms | 750 ms |
| Scroll, UI-thread ms/frame p50 / p90 / max | 2.5 / 4.5 / 12.5 | 2.5 / 3.7 / 5.7 |

Verdict: the JS typewriter was the entire idle JS cost of Home and most of
the JS cost during a scroll. C4 is verified for performance. The frames
still drawn at idle (~12 a second) are the visible typing itself plus the
hidden pinned copy (§2.5) — pass `active={false}` to the pinned copy and the
idle draw count drops too. C4's *pixel* identity (TextInput placeholder vs
the old Text) still needs the `stylecheck_searchbar.py` + capture diff from
the plan before it is committed.

Map entry on the two builds (one run each, so state noise applies): the
baseline run saw three `MapsInitializer` starts and no "Initial labeling
completed" inside 10 s with the UI thread at 2,560 ms; the C4 run saw two
starts, both labeled, UI thread 560 ms. Both runs: one `REQUEST_PERMISSIONS`
Activity, one host pause, one update check, two live Google Map views.

Attempted first and abandoned: an A/B of the older `10-C5.apk` /
`11-C4.apk` pair by fresh install. A fresh install lands on the sign-up
screen with no guest path, and the uninstall wiped the signed-in session on
the Pixel, which Waleed had to re-create. Never uninstall on the emulators;
install over with a higher versionCode and the matching keystore.

## 2. Root causes, ranked

### 2.1 Location permission Activity on every mount — High (measured)

`expo-modules-core`'s Android `PermissionsService.askForPermissions` →
`askForManifestPermissions` → `delegateRequestToActivity` calls
`currentActivity.requestPermissions(...)` **unconditionally**
(`node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt:246-267`);
there is no "already granted" short-circuit. Android then starts
`GrantPermissionsActivity` (translucent, finishes itself), which pauses the
app: `onHostPause` → RN stops timers/Choreographer → `onHostResume` →
`AppState` flips background → active.

Who calls it: `hooks/useStagedLocation.ts:84`
`Location.requestForegroundPermissionsAsync()` in an effect with `[]` deps,
so once per mount of every consumer:

- `app/(main-tabs)/home/index.tsx:245` (Home; used only for the label string)
- `components/booking-flow/BookingFlowMap.tsx:118` (the provider behind the booking Stack — every booking entry)
- `components/home/NavigationETABar.tsx:99` (inside `ActionCardsCarousel`)
- `components/home/MapScreen.tsx:72` (dead code, imported by nothing)

What each mount then does on top of the Activity round-trip:
`getLastKnownPositionAsync` → `getCurrentPositionAsync(Balanced)` →
`getCurrentPositionAsync(High)` → a `reverseGeocodeAsync` after each publish
(`useStagedLocation.ts:67-109`). Three fixes and up to three geocoder RPCs per
mount, per consumer.

Knock-on: `hooks/useEasUpdate.ts:53-57` runs `Updates.checkForUpdateAsync()`
on every AppState `active`, so every booking entry also makes a network
request to u.expo.dev; `ToastProvider` and (when mounted) `payment.tsx`
listeners fire too.

Fix (no visual change):
- In `useStagedLocation`, call `getForegroundPermissionsAsync()` first and
  only `requestForegroundPermissionsAsync()` when `status !== "granted"`.
  `getPermissions` never touches the Activity (`PermissionsService.kt:108-121`).
- Resolve location once, in one place (a small store or the existing
  `useBookingStore.userLocation`), and have Home, the provider and the ETA
  bar read it, so a booking entry does not re-run three fixes and three
  geocodes. Seed the provider's `region` from the store so the MapView mounts
  on the first frame instead of after the first fix.
- Pass `{ mayShowUserSettingsDialog: false }` from Home (label only) so a
  phone with location services off does not get Google's "turn on location"
  dialog seconds after onboarding (`LocationModule.kt:400-420`).

### 2.2 React Compiler bail-outs on the hot screens — High (code-verified)

`app.json:115` enables `experiments.reactCompiler`. Running
`babel-plugin-react-compiler` over the hot files (script left in the
session scratchpad, `compiler-check.js`) shows:

| File | Result | Cause |
|---|---|---|
| `app/(main-tabs)/home/index.tsx` | **BAIL** | ref read/written during render, lines 235-239 (`initialInsetTopRef`); after that, a `\|\|`-inside-`\|\|` comparator at 584-586 trips a compiler invariant |
| `app/(booking-flow)/select-services.tsx` | **BAIL** ×4 | `sharedValue.value = …` writes at 123, 155, 160, 173 |
| `app/(booking-flow)/choose-mechanic.tsx` | **BAIL** | ternaries / `??` / `?.` inside the `try` at 677-696 |
| `components/home/ActionCardsCarousel.tsx` | BAIL | `eslint-disable react-hooks/exhaustive-deps` |
| `components/coach/CoachTarget.tsx`, `useCoachAnchor.ts` | BAIL | ref access in render |
| `components/home/AndroidTypewriterPlaceholder.tsx` (uncommitted C4) | BAIL | `.value =` writes |
| Everything else checked (`category/[tab]`, `search`, `BookingFlowMap`, `ShopPage`, `VehicleMaintenanceCard`, `NowTierCallout`, `MechanicSearchBar`, `Text`, …) | OK | — |

Consequence: on those three screens none of the 20–40 inline handlers are
memoized, so every render hands new props to every (compiled) child and
invalidates their memo too. Home renders on: ~6 `useStagedLocation`
publishes at mount, every Convex push (≥8 subscriptions), every cart toggle
(`selectedServiceIds` selector at 555-557, including toggles made *inside
the booking flow*), every coach rect report (§2.3), `setActiveCardIndex`,
and two `setIsCardSwiping` flips per horizontal card swipe (1684-1685, sent
via `runOnJS` from the gesture). choose-mechanic renders ~20 times in its
first second (5 `onLayout` heights, ~19 query deliveries, up to 6
`userLocation` writes). Taps that arrive during those renders wait.

Fixes verified to compile (in-memory, by the investigator; 265 / 113 / 198
memo slots afterwards):
- Home: `const [stableInsetTop] = useState(() => insets.top);` and rewrite
  the sort comparator as a block (`byDate` then time).
- select-services: use `sheetHeight.set(...)` / `.get()` (available on
  Reanimated 4.2.1 mutables) for the four writes and two reads.
- choose-mechanic: build `holdArgs` before the `try`, keep only
  `await holdSlot(holdArgs)` inside it, move the `setSlotHold` ternary after
  the `catch`.

### 2.3 Coach registry re-render storm — High (code-verified)

`components/coach/CoachContext.tsx:96-128`: `report()` dedupes only
identical rounded rects, then `setRects(...)` → new context value → every
consumer re-renders. `useCoachAnchor` (`useCoachAnchor.ts:51-84`) returns an
`onLayout` that measures and reports, and Home spreads it onto the wrapper
around `VehicleMaintenanceCard` (`home/index.tsx:464-465, 1641-1644`).
Home itself consumes the registry (via `useCoachAnchor`), so **every layout
change of that wrapper re-renders the entire Home screen** plus every
`CoachTarget`.

What moves the wrapper (all `height` animations inside the scroll content):
- `VehicleMaintenanceCard.tsx:586-599` — 420 ms `withTiming` on mount and after each swipe
- `ActionCardsCarousel.tsx:200-231` — 280 ms per carousel page
- `NowTierCallout.tsx:355-365` — interpolated per frame of a horizontal drag

Each frame → `onLayout` → rAF → `measureInWindow` → `report` → full Home
render. The tour is off essentially always, so it is pure waste.

Fix: in `report`, return early unless `useCoachTourStore.getState().running`
(still process `rect === null` unregisters). `CoachTour` already re-measures
on start (`remeasure()` + 200 ms interval), so nothing is lost. Follow-up:
animate `translateY` on the sections below instead of `height`, and snap
`NowTierCallout`'s height on `onMomentumScrollEnd`.

### 2.4 Three MapViews and six camera animations per booking entry — High (measured + code-verified)

- `components/booking-flow/BookingFlowMap.tsx:208` — the persistent provider map behind the Stack
- `app/(booking-flow)/select-services.tsx:457` — a second, local map in peek mode (Home → Map), added because the layout map's touches were eaten by the native-stack card
- `app/(booking-flow)/choose-mechanic.tsx:829` — a third local map, same reason

All three set `showsUserLocation` (a FusedLocation subscription each). The
peek screen therefore runs two full Google Maps renderers (measured: GL-Map
1,020 ms + androidmapsapi 410 ms in 12 s, two `MapsInitializer`, two "Initial
labeling completed"). choose-mechanic stacks a third on top of the provider
map while select-services' peek map may still be mounted underneath.

Camera churn: `region` is memoized on `resolvedLocation` **identity**
(`BookingFlowMap.tsx:119-130`), and `useStagedLocation` publishes up to six
objects (three fixes + three label patches, `useStagedLocation.ts:67-79`),
so `animateToRegion` fires up to six times (`:157-159`); select-services'
focus effect re-fires on each (`select-services.tsx:384-390`). The context
value is a fresh object every provider render (`:184-192`), so all mounted
flow screens re-render each time (and per §2.2 none are memoized).

Fixes: key the `region` memo on lat/lng; `useMemo` the context value; on
Android render the provider map inside the screen tree (or unmount the
local maps with `useIsFocused`) so there is exactly one MapView (B11); seed
`region` from the store.

### 2.5 Home never idles — Medium-High (measured + code-verified)

- **JS typewriter ×2 — measured, C4 fixes it (§1.1).** The installed build
  lacked the uncommitted C4 rewrite (checked: `androidPlaceholderInput`
  absent from its bundle), so `useTypewriterText` ran the JS
  `setState`-per-character loop while Home was focused, in the in-flow
  search bar **and** the pinned copy that is hidden by opacity/height
  (`home/index.tsx:1479, 1772, 1794`). That was 570–650 ms of JS per 10 s of
  idle and 870 ms per scroll; with C4 both drop to ~0 and 150 ms. C4 still
  runs the hidden copy on the UI thread (`MechanicSearchBar.tsx:166-171`
  gates on `screenFocused` only) — pass `active={false}` to the pinned copy.
- **Tabs are never frozen.** No `freezeOnBlur` / `enableFreeze` anywhere;
  `app/(main-tabs)/_layout.tsx:112-130`. Once Cars or Bookings has been
  opened it keeps re-rendering on every push and keeps its loops:
  `MaintenanceTracker.tsx:440-560` starts ten infinite `withRepeat`s *inside*
  `useAnimatedStyle` (restarted on every re-render, never focus-gated);
  `BookingProgressBar.tsx:101-122` animates `width: '%'` forever per live
  card. Home also keeps rendering under the booking flow (§2.2 triggers).
  Fix: `freezeOnBlur: true` on the Tabs and on the `(main-tabs)` stack
  screen (Android), plus `useIsFocused` gates on those two loop sites.
- **N+2 vehicle cards.** `VehicleMaintenanceCard.tsx:625-635` renders every
  vehicle's full card at opacity 0 as a measurement layer, forever, plus
  back / promoting / front copies (666-706). Each copy carries a white→white
  `LinearGradient`, a remote `Image` without downsampling, two
  `adjustsFontSizeToFit` texts, three Pressables and a `CoachTarget`; the
  three gestures are rebuilt every render (293-350, 544-563). Fix: measure
  once and unmount the hidden copy, memo the gestures, drop the no-op
  gradient, `expo-image` for the render.

### 2.6 Data volume and subscription amplification — Medium (investigator, spot-checked)

- `convex/shop_services.ts:4-16` returns every row **joined with the full
  shop and service documents**; the client uses three fields
  (`hooks/useShopsFromConvex.ts:64-83`). Subscribed for the life of the Home
  tab (`home/_layout.tsx:20`) and again by `search.tsx:86`, whose mount
  re-hydrates the shop store with new identities → select-services
  re-render → camera re-animate. Fix: return `{ shop_id, service_id }` for
  offered rows.
- Same query mounted 2–4× in the Home tree (`getMe` ×4, `listVehiclesByUser`
  ×2, `getByUserIdWithDetails` ×3, full `getMyNotifications` on Home just for
  a count). Each `useVehicleOwnershipFromConvex` instance rebuilds every
  Vehicle object and `JSON.stringify`s + `AsyncStorage.multiSet`s the payload
  on every push (`lib/offlineSessionCache.ts:158-177`,
  `useVehicleOwnershipFromConvex.ts:34-64`). Fix: one writer (the layout
  hydrator), Home reads the store; `getMyUnreadCount` only.
- `bookings.getByUserId` and `getByUserIdWithDetails` are unbounded full
  history (~12 db reads per booking). Fix: active + last N server-side.
- choose-mechanic mounts 15–19 subscriptions; the ten availability queries
  re-issue once `totalMinutes` lands (`choose-mechanic.tsx:566-573`,
  `ShopPage.tsx:113-116`). Fix: hold `durationMinutes` until labor hours load.
- `EnrichmentStatusPill.tsx:155-169` runs `getEnrichmentDetail` (10–20
  sequential reads) + an external image fetch on every flow entry even while
  invisible. Fix: `"skip"` until `visible`.
- `components/home/FinishAccountSetupCard.tsx:39` imports two icons from the
  `phosphor-react-native` barrel (1,512 icon modules evaluated on first Home
  paint). `hooks/use-fonts.ts:32-53` loads 20 font files before the splash
  hides; only Urbanist is the design system.

### 2.7 Draw cost on Android (RenderThread) — Medium (investigator)

~20 elevated views and ~15 rounded `overflow: hidden` clips inside the Home
scroll content, several multiplied by the vehicle-card copies
(`VehicleMaintenanceCard.tsx:787-860`, `NowTierCallout.tsx:437-449`,
`ProviderTypesSection.tsx:177-201`, `MoreServicesSection.tsx:295-302`,
`FinishAccountSetupCard.tsx:510-561`, `ServiceBundlesSection.tsx:389-396`,
fixed layers at `home/index.tsx:2001-2108`, `TabBar.tsx:177-195`). This is
GPU/RenderThread work invisible to JS sampling. Not measurable on the
emulator; needs a phone. Cheapest trims: no `elevation` on the hidden card
copies, `zIndex` instead of `elevation: 20` on the fixed chrome layers, drop
redundant nested `overflow: hidden`.

## 3. Checked and found clean

- Vertical scroll pipeline is UI-thread only (`home/index.tsx:285-401`
  derived values / animated props; the single JS hop is the status-bar flip).
- `expo-blur` on Android defaults to `blurMethod: 'none'` — the BlurViews are
  tints, no per-frame capture (they also do not blur).
- RN 0.83 `Pressable`: `delayPressIn` defaults to 0, no press delay inside
  ScrollViews; no haptics, no `InteractionManager`, no JS-driven `Animated`,
  no AsyncStorage/SecureStore in tap handlers on either path.
- Zustand: no `persist`; selectors are field-level or `useShallow` except
  `useAuthStore()` at `home/index.tsx:241` (three rarely-changing booleans).
- Convex args never churn identity; closed sheets render `null`; skipped
  queries stay skipped.
- No `watchPositionAsync` anywhere; every reachable expo-location call is in
  try/catch.
- `sharedTransitionTag` props are no-ops (Reanimated 4.2.1 flag off), so the
  320 ms fade in `(booking-flow)/_layout.tsx:73-74` accommodates a morph that
  never runs — it can be shortened without visual loss.
- Console removal, marker bob gating and the bounded console forwarder
  behave as intended in the installed build.

## 4. Order of work

Phase 1 — no visual change, each a small diff, together they address the
measured symptoms:

0. Commit C4 once its pixel check passes (§1.1) — the only item here that
   is already measured end to end.
1. §2.1 permission short-circuit + single location resolver + region keyed
   on lat/lng + memoized provider context. Pass/fail: zero
   `REQUEST_PERMISSIONS` starts on Map tap (`adb logcat | grep
   REQUEST_PERMISSIONS`), one `Updates state change: Check` per launch.
2. §2.2 the three compiler unblocks. Pass/fail: `compiler-check.js` shows
   OK for the three screens.
3. §2.3 coach `report` gated on `running`.
4. §2.5 `freezeOnBlur` (Android) + focus-gated loops + `active={false}` on
   the pinned search bar; verify and commit C4.
5. §2.6 `shop_services.list` projection, single cache writer,
   `getMyUnreadCount` only, `totalMinutes` gating, pill `"skip"`.

Phase 2 — structural, still pixel-identical: one MapView (B11) by rendering
the provider map inside the screen tree on Android or unmounting local maps
on blur; measurement-copy removal in `VehicleMaintenanceCard`; height
animations → transforms.

Phase 3 — draw cost on a real phone: elevation/clip trims, `expo-image`,
phosphor import, deferred fonts.

## 4.1 Booking-flow pass — shipped 2026-09-18 (Android only)

What changed, all gated on `Platform.OS === "android"` where behaviour could
differ, nothing visual:

| Item | Where | Change |
|---|---|---|
| §2.1 permission Activity | `hooks/useStagedLocation.ts` | `getForegroundPermissionsAsync` first; `request` only when not granted |
| §2.4 region churn | `components/booking-flow/BookingFlowMap.tsx` | `region` keyed on latitude/longitude, not object identity; context value memoised; camera seeded from the store's last fix so the MapView mounts on the first frame of a repeat entry |
| §2.4 three MapViews | `BookingFlowMap.tsx`, `select-services.tsx`, `choose-mechanic.tsx` | `registerLocalMap()` — while a screen's own full-screen map is mounted (peek mode, choose-mechanic) the provider unmounts its map; skeleton re-runs when it comes back |
| §2.2 compiler bail-outs | `select-services.tsx` (`.set()/.get()`), `choose-mechanic.tsx` (`holdArgs` hoisted out of `try`) | both screens now compile: 117 and 203 memo slots |
| §2.6 doubled availability queries | `choose-mechanic.tsx`, `ShopPage.tsx` (`durationReady`) | slot queries wait for labor hours instead of being issued twice |
| §2.6 invisible pill work | `EnrichmentStatusPill.tsx` | `getEnrichmentDetail` + car-image fetch skipped until the pill is visible |
| §2.5 Home under the flow | `app/_layout.tsx` | `freezeOnBlur` on the `(main-tabs)` stack screen |

Measured on the Pixel AVD, signed-in account, same script as §1.1
(`16-tree-dbg` before, `17-flow-dbg` after, warm process):

| Map tap, 10 s window | before | after |
|---|---|---|
| `REQUEST_PERMISSIONS` Activity starts | 1 | **0** |
| App pauses / update checks triggered | 1 / 1 | **0 / 0** |
| Google Map views on the peek screen | 2 | **1** |
| Google Map views on choose-mechanic | 2 | **1** |
| "Initial labeling completed" (map inits) | 2–3 | **1** |
| UI thread | 2,560 ms | **520 ms** |
| GL-Map + androidmapsapi threads | 1,330 + 1,360 ms | **650 + 300 ms** |
| RenderThread (emulator-inflated) | 4,370 ms | 460 ms |
| p99 frame | 400 ms | 200 ms |

Pixel check (`diff_states.py` over eight captured states): category,
choose-mechanic, back-to-category at 1 s and at 3 s all **0 px** changed.
Peek differs only in a Google POI label the tile renderer placed differently
(0.15 %); the expanded sheet differs by 503 px of sub-pixel edge blending on
row icons over the translucent sheet (shapes and positions identical, no
whole-pixel shift explains it).

**The one visible difference:** entering from Home in peek mode now mounts
only the peek map. The layout map behind the frosted sheet is created when
the sheet is first expanded, so for up to ~1 s after that first tap the
sheet shows the skeleton shimmer instead of the already-loaded map (blank
at 600 ms, fully painted by 1.8 s in the capture). Everything after that,
including returning from choose-mechanic, is pixel-identical at 1 s. To
restore the old two-maps-at-entry behaviour, make `registerLocalMap` a
no-op (one line in `BookingFlowMap.tsx`).

Not done in this pass (Home-side or product-visible): the coach registry
gate (§2.3), `freezeOnBlur` on the Tabs themselves, the `shop_services.list`
projection, `search.tsx` re-hydration (Waleed's uncommitted edit is in that
file), and shortening the 320 ms fade that accommodates a shared-element
morph that never runs.

## 4.2 Home pass — shipped 2026-09-20 (Android only)

The other half of §4's Phase 1. Android-gated where behaviour could differ,
behaviour-neutral everywhere else.

| Item | Where | Change |
|---|---|---|
| §2.2 Home compiler bail-out | `app/(main-tabs)/home/index.tsx` | the `initialInsetTopRef` lock is a lazy `useState`; the upcoming-booking comparator is a block instead of `\|\|` inside `\|\|`. **BAIL → OK, 267 memo slots** |
| §2.3 coach registry | `components/coach/CoachContext.tsx` | `report()` publishes nothing unless a tour is running (unregisters still process) |
| §2.5 unfrozen tabs | `app/(main-tabs)/_layout.tsx` | `freezeOnBlur` on the Tabs |
| §2.5 infinite loops | `components/cars/MaintenanceTracker.tsx`, `components/bookings/BookingProgressBar.tsx` | five tier-label pulses share one focus-scoped driver instead of each building a `withRepeat` inside `useAnimatedStyle`; the Bookings layout-prop sweep is focus-scoped too |
| §2.6 duplicate subscriptions | `hooks/useNotificationsFromConvex.ts` + Home + Bookings | new `useUnreadNotificationCount()`; the badge no longer drags in the whole enriched feed |
| §2.6 store churn | `stores/useVehicleStore.ts` | `setVehiclesFromConvex` bails when the mapped result equals what is stored |
| §2.6 duplicate cache writes | `lib/offlineSessionCache.ts` | one `JSON.stringify` + AsyncStorage write per payload, not per mounted hook |
| §2.5 card copies | `components/home/VehicleMaintenanceCard.tsx` | the white→white `LinearGradient` is a `backgroundColor` (it was a native gradient view per card copy, and the card renders N+2) |

### What the emulator says: nothing, and that is the finding

Four paired samples per build (`18-flow-dbg` vs `20-home-dbg`), each a fresh
install + force-stop + cold launch on the same signed-in account:

| Home, per 10 s | before (4 samples) | after (4 samples) |
|---|---|---|
| idle, UI thread | 780 / 760 / 770 / 760 ms | 750 / 730 / 750 / 780 ms |
| idle, JS thread | 0 ms | 0–10 ms |
| scroll ×6, UI thread | 1010 / 1010 / 970 / 940 ms | 990 / 960 / 1070 / 1010 ms |
| scroll ×6, JS thread | 230 / 210 / 190 / 210 ms | 200 / 190 / 240 / 180 ms |
| idle after visiting Cars | 780 / 760 ms | 760 / 840 ms |

The first paired round moved consistently in the right direction and the
second did not reproduce it, which by this project's own rule (§9.3 of the
plan: a verdict needs two rounds agreeing) means **no measurable change**.
An earlier single run that appeared to halve Home's UI thread — 1,420 ms
down to 780 ms — was a warm-state artefact, not the build: the same old
build measured 750 ms and 1,600 ms in two different sessions.

That is the expected result once you look at what the emulator is doing.
Idle JS on this account is already **0 ms**, so auto-memoisation has no
re-renders to skip; the coach storm fires during the card height animations,
which need a second vehicle or a data change to trigger; and Android's
bottom-tabs already detaches a blurred tab's views, so its loops were
costing UI-thread mapper time but no frames. Every cost removed here is a
cost this test environment does not generate: live Convex pushes, several
vehicles, an account with an active tour, a device that keeps blurred tabs
attached.

So this pass is justified by what it removes, not by a number on this
emulator, and it is worth re-measuring on a real phone with a busy account
before claiming a user-visible win. It is also verified not to regress:
same numbers within noise, and pixels below.

### Pixels

`capture_states.py` on both builds, `diff_states.py` between them:

- **0 px changed:** `01_home_top`, `02_home_scroll3`, `03_bookings_top`,
  `04_bookings_scroll1`, `05_cars_top`, `07_oto`, `08_booking_flow`.
- 1–2 px vertical shift with 13–740 px residual: `02_home_scroll1/2`,
  `06_cars_scroll1/2/3` — the scroll-offset artefact `SHIFT_TOLERANCE`
  exists for, sub-pixel text at a different offset.

`05_cars_top` at 0 px is the one that matters for the animation refactor:
that screen carries the five pulsing tier dots, and the burst detector
reports the same animated area on both builds (9,540 px before, 9,479 px
after), so the dots still pulse and still pulse the same way. `capture_states`
also walked Home → Bookings → Cars → Oto → booking flow on the new build and
every screen rendered, which is the functional check on `freezeOnBlur`.

### Still open on Home

The coach anchors themselves (`useCoachAnchor`, `CoachTarget`) still bail the
compiler on a ref written during render — cheap now that `report()` is gated.
`VehicleMaintenanceCard` still renders one hidden full-card copy per vehicle
forever to measure heights; unmounting them after the first measure needs a
content-keyed invalidation or it goes stale, so it was left alone.
`convex/shop_services.ts` still joins the full shop and service documents onto
every row (§2.6) — **that file belongs to otopair-web**, which is the
canonical source and rsyncs over this copy, so the projection has to be made
there or it will be wiped.

## 4.3 Frame-level trace of booking entry — 2026-09-20

`scratchpad/deep/trace_entry.sh` + `analyze_trace.py`: `gfxinfo framestats`
(per-frame phase breakdown), a 200 ms per-thread CPU timeline off
`/proc/<pid>/task/*/stat`, and timestamped logcat, all anchored on the tap.

**Environment note.** The Pixel AVD's Play services stopped serving location
after a cold boot: `expo-location` rejects before it ever registers a request
(`gps provider: ProviderRequest[OFF]`, `last location=null` on every
provider), so the flow renders its no-location fallback and never mounts a
map. `adb emu geo fix` does not help — nothing is listening. The traces below
therefore ran on a **throwaway build** whose `useStagedLocation` publishes a
fixed Staten Island position; that hack was never committed. It is also a
live demonstration of crash-audit §6 #21: no fix means no booking flow at
all, with no retry and no fallback.

### What the trace found

| | before | no create/destroy | + deferred mount |
|---|---|---|---|
| frames over 100 ms | 7 | 5 | **2** |
| p90 frame | 104 ms | 117 ms | **50 ms** |
| Maps SDK init starts | +390 ms (during the fade) | +351 ms (during the fade) | **+557 ms (after it)** |
| provider map created then destroyed | yes, with an NPE | no | no |
| tiles labeled | +2,230 ms | +1,964 ms | +2,167 ms |

**1. A whole MapView was being created and thrown away.** The log has the
entire arc: `MapsInitializer` at +390 ms, `Making Creator dynamically` →
`early loading native code` → `loadedRenderer` (the Play services Maps
renderer, loaded synchronously on the main thread), then at +625 ms
`MapView: exception with destroying` — a `NullPointerException` out of
`DeferredLifecycleHelper.onPause`, via `rnmaps MapView.doDestroy` ←
`onDropViewInstance` ← Fabric's `deleteView`. That is the layout's map being
dropped one commit after it was created, because the screens that bring their
own map call `registerLocalMap` from an effect, and effects run after the
provider has already rendered. Holding the provider's map back one commit
removes it.

**2. The remaining cost is one ~650 ms main-thread block, and it was landing
inside the transition.** `Choreographer: Skipped 39 frames` sits right in the
middle of the 320 ms fade, and the frame breakdown shows the time is not in
any drawing phase — the frame simply starts ~650 ms after its intended vsync
because the main thread is busy. Deferring the mount to `transitionEnd` moves
that block onto a still screen behind the skeleton. The map appears ~200 ms
later; the animation stops dropping frames.

`InteractionManager.runAfterInteractions` is **not** usable for this: the
native stack animates natively and never takes an interaction handle, so it
resolved immediately and deferred nothing (measured — the map still
initialised at +351 ms).

### What is left on the entry path

- **The Maps SDK load itself, ~205 ms of the block** (`+351 → +556 ms`:
  creator, native code, renderer). It is once per process, so it is the
  *first* booking entry that pays. Warming it off the critical path would
  remove it from entry entirely, but react-native-maps exposes no
  `MapsInitializer.initialize()` to JS — it needs a small native module, or
  an off-screen MapView warmed during idle after boot, which costs memory.
- **Heap growth of ~40 MB during the mount**, with two concurrent GCs logged
  per entry. Fewer map instances already helps; `liteMode` on a backdrop map
  would help more, at the cost of interactivity.
- **The 320 ms fade** in `(booking-flow)/_layout.tsx` was sized for a
  shared-element morph that never runs (Reanimated has that feature flagged
  off). Shortening it is free perceived latency.
- The traces are single runs. The mechanism findings are solid — a create and
  destroy either happens or it does not — but the frame percentiles should be
  re-measured in rounds before being quoted as a result.

## 5. Measuring the next pass

The Pixel now runs `16-tree-dbg` (versionCode 14, key present, C4, the four
crash fixes) on Waleed's signed-in account; the budget AVD is still on its
login screen. Then per phase: `scripts/android-perf/rotate.sh` paired rounds as before, plus the
three cheap checks used today — per-thread CPU over a 10 s idle and a
6-swipe scroll (`/proc/<pid>/task/*/stat`), `REQUEST_PERMISSIONS` count on
Map tap, and the `content-desc="Google Map"` count in a `uiautomator dump`
of the peek screen (target: 1).
