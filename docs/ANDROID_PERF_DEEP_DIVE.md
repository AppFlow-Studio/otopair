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

## 5. Measuring the next pass

The Pixel now runs `16-tree-dbg` (versionCode 14, key present, C4, the four
crash fixes) on Waleed's signed-in account; the budget AVD is still on its
login screen. Then per phase: `scripts/android-perf/rotate.sh` paired rounds as before, plus the
three cheap checks used today — per-thread CPU over a 10 s idle and a
6-swipe scroll (`/proc/<pid>/task/*/stat`), `REQUEST_PERMISSIONS` count on
Map tap, and the `content-desc="Google Map"` count in a `uiautomator dump`
of the peek screen (target: 1).
