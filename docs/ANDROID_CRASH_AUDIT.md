# Android crash audit — every way a tester's build can die

**Written:** 2026-09-18 · **Branch:** `android-repair` · **Question:** why do testers' builds crash when
Waleed's local build doesn't?

Sources: three read-only code audits (new-user journey, native boundaries + build config, error
containment + platform), plus what was reproduced on the two emulators today. Every item carries
`file:line`, the precondition, what a tester sees, and confidence. Fixes are one line each; the
implementation notes are in §4.

## 1. What was actually reproduced today

| # | Reproduced | Evidence |
|---|---|---|
| R1 | **Keyless build → crash on booking entry.** `java.lang.IllegalStateException: API key not found. Check that <meta-data android:name="com.google.android.geo.API_KEY" .../>` thrown by the Maps SDK's manifest check the moment a `MapView` mounts. | Android dropbox on the Pixel AVD, 10:43, build `v1 (1.3.1)` (a local build without the key). Device/Play-Services independent. |
| R2 | **The preview AAB `d7d8f40f` (versionCode 12) does not crash and its key is authorized.** Booking map rendered fully, no "Authorization failure" in the Maps SDK log. | Fresh-install state on the Pixel AVD after `pm clear`; expo-updates reported "No update available" for runtime 1.3.2 on channel `preview`. |
| R3 | **A key that is present but not authorized for the signing cert gives a blank map, never a crash.** | Waleed's own test; matches the SDK's `Authorization failure` path. |
| R4 | **Different backends per build.** The AAB's bundle inlines Convex deployment `ardent-…`; the local build inlines `flippa-…` (dev). Both inline the *same Clerk **development** instance* (`pk_test_…`, "strict usage limits" warning at launch). | `strings` on the two `index.android.bundle`s. |
| R5 | **White screen on the first launch after installing a build that points at a different backend over an existing install.** Recovered on relaunch. | Pixel AVD, local build over the AAB's data. Exactly what a tester who updates from an older build can hit. |
| R6 | **Booking-entry process death on the 2-core Android 9 AVD**, intermittent, no Java stack — consistent with a low-memory kill. | Harness runs on 2026-09-17 (`app_alive=false` windows; two live `MapView`s, see #9). |

So: R1 explains a crash *only for a build whose manifest has no key*. The build Waleed tests (preview
profile) has one. The build testers have must not — see #1/#5 below for how that happens.

## 2. The ranked list

Severity × how early a brand-new account hits it. "Blank" = the app goes white and stays white
(see #2), which testers report as "it crashed".

| # | What | Where | Precondition | Tester sees | Conf. |
|---|---|---|---|---|---|
| 1 | **Google Maps key silently omitted from EAS builds.** `app.config.js` only injects the meta-data when `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set at config time, and `.env.local` is gitignored so EAS never sees it; the key comes only from the EAS *environment* of the profile. `production` / `production-android` profiles declare **no `environment`** (preview does). | `app.config.js:38-57`, `eas.json:20-33`, `.gitignore:37` | any store build whose EAS environment lacks the key (the Sep 9 production AAB predates the key entirely) | hard crash (R1) on first Map / booking tap, and on Home once a booking exists (`NavigationETABar` mounts a map) | confirmed |
| 2 | **`EnrichmentStatusPill` calls `useMemo` after `if (!visible) return null`.** ESLint-verified hook-order violation. `convex/vehicles.ts:2786-2797` reports *every car created in the last 15 minutes* as `in_progress`, so the pill flips `false → true` ~1 s after a new account adds its first car (throws "Rendered more hooks"), and `true → false` when enrichment finishes (throws "Rendered fewer hooks"). The dev account's garage is all `ready`, so the line never runs for Waleed. | `components/booking-flow/EnrichmentStatusPill.tsx:185,231`; mounted on Home/Bookings/Cars (`app/(main-tabs)/_layout.tsx:70`) and in the booking flow (`app/(booking-flow)/_layout.tsx`) | add a car, land on any main tab | **blank app** (because of #3); again 5–7 min later | high — the strongest "testers only" candidate that is not config |
| 3 | **The root error boundary renders `null` and unmounts the error modal with it.** Any render throw below `AppErrorBoundary` → permanent white screen, no message, no recovery except force-quit. Turns every JS error in the list into "the app crashed". | `lib/error-ui.tsx:83-88`, `app/_layout.tsx:273-278` | any caught render error | blank app | high |
| 4 | **Launch-time throws on missing env.** `new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!)` at module scope (throws "No address provided" before any UI); `ClerkProvider publishableKey={…!}` throws in render. | `app/_layout.tsx:73,269` | store build with an empty EAS environment (same root cause as #1) | instant close on every launch | high mechanism / medium that EAS drops them |
| 5 | **The production Maps key is newer than the production build.** `eas env:list --include-sensitive --format long`: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` was created **Sep 16 18:14** (all three environments); the only production AAB (`c6632691`) was built **Sep 9**, when production already had Convex (Sep 9), Clerk live (Sep 3) and Stripe live (Sep 8) but no Maps key. A production rebuild now picks it up. The `production` profiles omit `environment`, which EAS infers as `production` for store builds — make it explicit anyway so nobody has to know that rule. | `eas.json:20-23,30-33` | — | — | confirmed |
| 6 | **Stripe never initializes when the key is empty, and native calls then throw.** `publishableKey ?? ""` makes `StripeProvider` skip `initStripe`; `handleNextAction`/`confirmSetupIntent`/`isPlatformPaySupported` have no `isInitialized` guard → `UninitializedPropertyAccessException` / `PaymentConfiguration was not initialized`. `.env.local` documents this crash. | `app/_layout.tsx:291`; `confirming.tsx:136`, `approve-estimate/[id].tsx:406`, `hooks/useConfirmHold.ts:101`, `hooks/useWalletCheckout.ts:63` | store build without the Stripe env var | hard crash at Review & Pay | high |
| 7 | **Home's back handler exits the app whenever a sheet/overlay is open.** `hardwareBackPress → BackHandler.exitApp()` is unconditional; `@gorhom/bottom-sheet`, `FloatingSheet`, `NotificationsSheet`, `AddVehicleRequiredSheet` register no handler of their own. | `app/(main-tabs)/home/index.tsx:421-428` | press back with any sheet open on Home | app disappears, nothing logged | high |
| 8 | **OTA can brick every tester at once.** `runtimeVersion: appVersion` + `checkOnLaunch ALWAYS` + `launchWaitMs 0`: an `eas update` published from a tree with different native deps is accepted (same runtime string), applied silently, and throws at module scope on the *next* launch, forever. No rollback path in code. | `app.json:124-129`, generated manifest `EXPO_UPDATES_*` | publish an update without bumping `version` after a native change | white screen or instant close on launch 2+, all testers on the channel | high mechanism |
| 9 | **Two (sometimes three) live Google Maps in the booking flow** on 2–3 GB phones. Layout-level `BookingFlowMapProvider` map under every booking screen + a local map in `select-services` (peek mode) + another in `choose-mechanic`. | `components/booking-flow/BookingFlowMap.tsx:208`, `app/(booking-flow)/select-services.tsx:457`, `choose-mechanic.tsx:829` | booking entry on a low-RAM phone | LMK kill / ANR, no Java stack (R6) | high |
| 10 | **`console.error` forwarding is a single-slot mutex** — the first in-flight log silences all later ones (forever while offline), `JSON.stringify` inside it can throw from the global error handler (error-while-handling-error = hard crash), and Convex's own logger feeds back into it. Not a tester-visible crash by itself, but it is why tester crashes leave no `client_logs` trace. | `lib/consoleToConvex.ts:36,71-90` | any burst of errors, or offline | invisible failures | high |
| 11 | **Error modal's only button backgrounds the app** (`BackHandler.exitApp()` → `moveTaskToBack`), so the tester reopens into the same broken state. | `app/_layout.tsx:254-256`, `MainActivity.kt` override | any error caught by the route boundary | loop | high |
| 12 | **Guest credentials are the Google *and* Apple buttons.** Both call the email/password guest sign-in; without `EXPO_PUBLIC_GUEST_EMAIL/PASSWORD` the tester is stopped at screen one with "Guest credentials are not configured". | `components/onboarding/steps/LoginMethodsStep.tsx:42-43,69-77,91-94` | store build with empty env | cannot sign in | high |
| 13 | **Clerk development instance in testers' builds** (R4). Not a crash; development instances have usage caps and are not meant for distribution. | bundles of both builds | — | auth failures under load | confirmed |
| 14 | **`JSON.parse(params.filteredSteps)` in render** from the Home "Create Account" tile / deep links. | `app/(onboarding)/index.tsx:317` | malformed or duplicated param | blank | low-medium |
| 15 | **`parseVehicleDisplay(row.vehicleDisplay).trim()`** with no guard, on a still-enriching first car. | `utils/bookingAdapter.ts:217,228` | server omits `vehicleDisplay` | blank | low-medium |
| 16 | Missing `queries` for `tel:` / `geo:` — every "Call shop" button is a silent no-op under Android 11 package visibility; directions always fall back to the browser. | `utils/linking.ts:106`, `app.json` | Android 11+ | dead buttons | high (not a crash) |
| 17 | Infinite splash on first launch with no network: `StartupSplashGate` never hides the splash until Clerk loads, and the offline gate renders behind it. | `app/_layout.tsx:160-172`, `components/connection/OfflineBootGate.tsx:55-62` | cold start offline | hang | medium |
| 18 | Latent, unreachable today: conditional `useCallback` in `ShopDetailScreen` (`app/booking/shop/[id]/index.tsx:175`), `STEP_COPY[currentStep]` destructure (`app/car-pre-onboarding.tsx:418`), `r.vin.toUpperCase()` (`stores/useVehicleStore.ts:146`), unguarded `getCurrentPositionAsync` in `components/booking/map.tsx:258-264` (unhandled rejection → global modal). | — | — | — | low |

**Checked and clear** (worth knowing so nobody re-audits them): ~~every map coordinate traces to a finite
number (`shop.lat ?? 0`, null-island filtered at every marker/animate site)~~ — **wrong, see §6 #24:
`?? 0` does not replace `NaN`/`±Infinity`, and the null-island guards let them through**; no `fitToCoordinates` /
`animateCamera` anywhere; all 30 native `.so` files are 16 KB-page aligned; App Bundle density/language
splits carry nothing the app references by name; `Platform.Version` parsing is iOS-gated everywhere;
camera/picker/speech/notifications/calendar/web-browser calls are all permission-checked and wrapped.

## 3. Which of these is "the" tester crash

Three independent lines of evidence point at the same place:

- The only build Waleed can test crashing (R1) is a keyless one, and the only production AAB on EAS
  (Sep 9, `c6632691`) was built a week before the Maps key was added to EAS on Sep 16 (#5). Testers on
  the Play track are almost certainly on that build or older.
- A brand-new account then has a second, code-level crash waiting ~1 s after it adds its first car
  (#2), which the dev account can never trigger.
- Both surface as a blank app (#3), which is what "crashed" means in a tester report.

To close it: confirm the versionCode on the Play testing track and the crash cluster text in Play
Console → Android vitals. If it says `API key not found`, it is #1; if it says
`Rendered more hooks than during the previous render`, it is #2. Either way, both get fixed.

## 4. Fixes, in the order to ship them

1. Rebuild and resubmit production — the production environment now has every key (Maps since Sep 16;
   Convex, Clerk live, Stripe live since Sep 3–9). Add `"environment": "production"` to the two
   production profiles so the rule is explicit, and add the guest credentials there if the guest path
   is meant to work in store builds. The Maps key must be Android-restricted to `com.otopair.app` + the
   Play App Signing cert + the EAS upload cert (+ local debug certs), or the crash becomes a blank map.
2. `app.config.js`: throw when `EAS_BUILD_PROFILE` is a store profile and the Maps key is empty,
   instead of silently dropping the meta-data. Same for the Convex URL and Clerk key.
3. `EnrichmentStatusPill.tsx`: move `facts`/`factsKey`/`useMemo` above `if (!visible) return null`.
   Verify by adding a car on the emulator and watching the pill appear without a blank.
4. `lib/error-ui.tsx`: render a real fallback ("Something went wrong — Reload") calling
   `Updates.reloadAsync()`; hoist `ErrorModalHost`/`ConnectionPillHost` above `AppErrorBoundary`;
   replace the modal's `exitApp` with a reload.
5. Stripe: guard every native call behind an initialized check, or initialize on the payment screens
   the way `AddPaymentScreen` already does (`lib/stripeConfig.ts` + `initStripe`).
6. `home/index.tsx` back handler: only `exitApp()` when no sheet/overlay is open; otherwise `return false`.
7. `app.json`: `runtimeVersion: { policy: "fingerprint" }` so an update can never be served to a binary
   with different native code; keep `react-native-screens` on the SDK-pinned version.
8. Booking flow: one `MapView` at a time (B11) — render the layout map only when the screen doesn't
   mount its own.
9. `lib/consoleToConvex.ts`: bounded queue instead of `isSending`, try/catch around stringify, drop
   messages that start with `[CONVEX`.
10. `app.json` `queries`: add `tel:` and `geo:` intents; fix the `maps.apple.com` link on Android.

Items 3, 4, 6, 9, 10 are code and can ship in this branch today. Items 1, 2, 7 are build config and
must be followed by a new production build. Item 8 is the structural map work already queued in
`docs/ANDROID_PERF_PLAN.md` §9.

## 5. How to verify without guessing

- Play Console → Android vitals → crash clusters, and the versionCode live on the testing track.
- On the emulator, with any build: add a car to the account → within a second the pill appears
  (`in_progress`) — #2 either blanks the app or it doesn't.
- After fixing 1–2: `aapt dump xmltree <apk> AndroidManifest.xml | grep geo.API_KEY` on the EAS
  artifact **before** submitting; both keys must be present.

## 6. Second pass — booking and maps, deeper (2026-09-18)

Everything in §2 stands. This pass went one level down on the booking → map → choose mechanic →
schedule → pay path, on the native map/location layer, and on the build/OTA configuration, after items
2, 3, 7 and 10 were fixed on this branch. Numbering continues from §2. Classification: **FATAL** = a
synchronous throw, a render throw, or a Convex `useQuery` whose server function threw (convex re-throws
it during render; with the fixed boundary that is now the error modal instead of a blank app);
**DEAD-END** = no crash, but the tester cannot continue; **NATIVE** = the process dies with a Java stack;
**RISK** = configuration that can turn any of the above into an all-testers event.

### 6.1 Ranked

| # | Class | What | Where | Precondition / how a tester hits it | Conf. |
|---|---|---|---|---|---|
| 19 | **RISK / FATAL** | **Production is already running an over-the-air update nobody can map to a commit.** Channel `production` → branch `production` → group `020e630b-150d-49b1-8ac7-986ed5227050`, runtime 1.3.1, "feat: shop site and enrichment updates + UI", published ~Sep 12 with **no git hash recorded**, and no commit with that message exists in this clone. The Sep 9 AAB (`c6632691`, commit `9219b069`, vc 11) has `CHECK_ON_LAUNCH=ALWAYS` + `LAUNCH_WAIT_MS=0`, so it downloads that update on launch 1 and runs it from launch 2 on. **Every production tester crash is happening inside that update's JS, not the Sep 9 tree** — reproduce against the update (`eas update:view 020e630b-…`, pull the Android bundle) before assuming the `9219b069` code path. If that tree's lockfile added a native module vs `9219b069`, the module-scope `requireNativeModule` throw is the launch-2 crash. | `eas channel:view production`, `eas update:list --branch production`; manifest `EXPO_UPDATES_CHECK_ON_LAUNCH`/`LAUNCH_WAIT_MS` | Play-track install + one launch | confirmed by EAS |
| 20 | **RISK** | **Two source trees, two runtime strings, one versionCode counter.** HEAD is 1.3.1; the preview AAB `d7d8f40f` was built from commit `4c605eb6` "chore: bump version to 1.3.2" which does not exist in this clone (explains R2). `appVersionSource: remote` + `autoIncrement` share one counter across profiles (11 prod → 12 preview-android → 13 preview), so `version` is the only thing binding an update to a binary: an update from this tree reaches prod vc 11 and preview vc 13 but not vc 12; from the other tree only vc 12. | `eas.json:3-5`, `eas build:list` | any `eas update` | confirmed by EAS |
| 21 | **DEAD-END** | **Location denied, services off, or no fix = the booking flow is unusable.** `useStagedLocation` has no fallback, no retry, no timeout and `[]` deps, so nothing recovers when the user enables location later. With `location === null`: the provider renders "Enable location to see nearby shops" as static text, `useNearbyBookingShops` returns `[]`, Choose Mechanic shows "No shops available." with a CTA back to Screen 1 (a loop), and in peek mode the back button and zoom rail are hidden too, leaving a grey screen with a strip. `getCurrentPositionAsync` has no timeout, so a phone with no fix shows "Finding shops near you…" forever. | `hooks/useStagedLocation.ts:58-122`, `components/booking-flow/BookingFlowMap.tsx:149-155,207,246-254`, `hooks/useNearbyBookingShops.ts:43-44`, `app/(booking-flow)/choose-mechanic.tsx:657-663,1014-1019`, `select-services.tsx:456,487,508` | tap "Don't allow" on the prompt (common), Location toggle off, indoors with no fix, no Google Play services | high |
| 22 | **DEAD-END** | **Zero bookable shops looks exactly like "still loading".** `if (shopIds.length === 0) return { results: [], isLoading: true }` — "no shops" and "not hydrated" are the same state, so Choose Mechanic spins on "Finding shops near you…" forever and `useOfflineGuard` is fed `undefined` forever (any connectivity blip then raises the "Can't load this right now" modal on top). `shops.list` only returns shops that are Stripe charges+payouts live **and** have an active mechanic **and** an offered service; a production deployment where the seed shops are not Stripe-live returns `[]` to every tester. | `hooks/useNearbyBookingShops.ts:43`, `hooks/useClosestShop.ts:37`, `convex/shops.ts:279-292`, `lib/bookableShop.ts:26-64`, `hooks/useShopsFromConvex.ts:409-434` | testers on a deployment with no fully bookable shop (the documented "bookable gate empties the map" state) | high |
| 23 | **FATAL** | **Mock `svc_*` service ids reach `useShopFixedPricesForServices`.** Every sibling hook guards with `areConvexIds` (`!id.startsWith("svc_")`); this one does not, so `v.id("services")` rejects the arg server-side and `useQuery` throws in render on Choose Mechanic (parent + each `ShopPage`) and on Review & Pay (`HeroCardMostBooked`). How mock ids get into the cart: `useBookingStore` starts with `availableServices: MOCK_SERVICES` and `useServicesFromConvex` only replaces it when the catalog is non-empty; the search screen matches "oil" against the mock "Oil Change" and toggles it in. | `hooks/useShopFixedPricesForServices.ts:40-52`, `stores/useBookingStore.ts:476`, `hooks/useServicesFromConvex.ts:124-128`, `app/(booking-flow)/search.tsx:43-56,127-152`, `components/booking-flow/HeroCardMostBooked.tsx:72-82`; server `convex/shopServiceFixedPrices.ts:198-203` | cold start on a slow network → Home → Book → search "oil" → tap → any category → Continue; or a deployment whose `services` rows lack v5 taxonomy slugs (the catalog stays mock forever) | medium × fatal |
| 24 | **FATAL** | **Deep link into approve-estimate before Clerk has a token.** `getPaymentOriginForBooking` **throws** `Not authenticated` / `Not your booking.` and is consumed by an unconditional `useQuery`; `utils/linking.ts` pushes the route straight from the notification URL. Same class: `bookings.getBookingByIdForCustomer` throws "Your session has expired" (used by `confirmation.tsx` and `useBookingStatusToasts` right after paying). The team already documented this race in `usePaymentMethodsFromConvex.ts:27-30`. | `hooks/useConfirmHold.ts:87-90`, `convex/payments_stripe.ts:95-117`, `app/booking/approve-estimate/[id].tsx:196-197`, `utils/linking.ts:166-190`, `convex/bookings.ts:4970-4981` | tap an "approve estimate" / "confirm hold" notification while the app is not running; a booking from another account on the device | medium-high |
| 25 | **FATAL / DEAD-END** | **The offline session cache serves Convex ids minted by a different deployment.** The envelope is keyed by Clerk user + expiry only; the ardent (preview/prod) and flippa (dev) builds share the Clerk dev instance, so a build installed over the other hydrates `useVehicleStore` with foreign `ownershipId` / `engineId`. Either `v.id()` validation throws (table-number mismatch → render throw) or the ids resolve to nothing and every service shows `blocked_by_enrichment`. The live query overwrites the cache once it arrives — which is exactly R5 ("white screen on first launch after installing a build that points at a different backend, recovered on relaunch"). | `lib/offlineSessionCache.ts:42-53,142-181`, `hooks/useVehicleOwnershipFromConvex.ts:34-37,61-62`, consumers `hooks/useBookableServices.ts:55-60`, `useVehicleReadiness.ts:40-45`, `useServiceVehicleSpecsForEngine.ts:29-37`, `useBookingLaborHours.ts:34-42` | install a preview/prod build over a dev build or vice-versa | medium |
| 26 | **NATIVE** | **A non-finite `lat`/`lng` on one shop row reaches Google's `LatLngBounds` and throws on the UI thread.** `shop.lat ?? 0` only replaces `null`/`undefined`; Convex `v.number()` is float64 and accepts `NaN`/`±Infinity`; every guard is `=== 0 && === 0` (false for NaN). The NaN shop sorts anywhere, can become `activeShop`, and `animateToRegion({latitude: NaN})` → `MapManager.java:371-383` `new LatLngBounds(...)` → `IllegalArgumentException("southern latitude exceeds northern latitude")` inside a Fabric view command, no JS boundary → process death. `initialRegion` and `Marker coordinate` take the same path. Sibling bug on the same line: `lat` present + `lng` missing becomes `(lat, 0)`, passes the guard, and can sort as the nearest shop. Corrects §2's "every coordinate is finite". | `hooks/useShopsFromConvex.ts:385-386`; guards `useNearbyBookingShops.ts:50`, `select-services.tsx:242,469`, `choose-mechanic.tsx:496,860`, `ShopMarker.tsx:227-232`; native `react-native-maps/android/.../MapManager.java:371-383`, `MapView.java:855-866`, `MapMarker.java:200-201` | one shop with `lat: NaN` (e.g. `Number("")` from the web admin) | low-medium × fatal |
| 27 | **DEAD-END / UX** | **The Android permission Activity launches on every Home mount and every booking entry even when location is already granted** (measured on the Pixel: `START … REQUEST_PERMISSIONS`, app paused 214 ms, AppState flip, a second expo-updates check). `expo-modules-core` never short-circuits `askForPermissions`; `useStagedLocation` always calls `requestForegroundPermissionsAsync`. With location *services* off, Home's mount (which only needs a label) also triggers Google's "turn on device location?" dialog via `mayShowUserSettingsDialog` (default true); declining it lands in #21. | `hooks/useStagedLocation.ts:84,99-108`, `app/(main-tabs)/home/index.tsx:245`, `expo-modules-core/.../PermissionsService.kt:246-267`, `expo-location/.../LocationModule.kt:400-420` | every user, every entry; the dialog when services are off | confirmed (perf deep-dive §2.1) |
| 28 | DEAD-END | **Android push can never register.** No `android.googleServicesFile` and no `google-services.json` in the repo; both `getExpoPushTokenAsync` sites reject (caught). The `approve-estimate` / `reauth` pushes documented in `utils/linking.ts:112-125` cannot reach Android at all; approvals silently depend on in-app banners. | `app.json` (no `googleServicesFile`), `components/onboarding/steps/PushNotificationsStep.tsx:158`, `hooks/useRefreshPushToken.ts:42` | every Android build | high |
| 29 | DEAD-END | pick-datetime `Confirm` silently returns when the shop is not in the client store while dates and slots still render and the CTA is enabled. | `app/(booking-flow)/pick-datetime.tsx:192,487`; entry via `HeroCardMostBooked.tsx:87-93` | shop id from a past booking that has since dropped out of the gated `shops.list` | medium |
| 30 | DEAD-END | An active `vehicle_owners` row whose `vehicles` doc is missing counts as `hasVehicles` but never enters the vehicle store, so the cart's VIN snapshot is `null` and Continue always toasts "Services are for different vehicles". | `hooks/useVehicleOwnershipFromConvex.ts:61-63,73`, `stores/useVehicleStore.ts:145`, `stores/useBookingStore.ts:570-596`, `utils/bookingVehicle.ts:45-47` | data drift / manual entry | low-medium |
| 31 | DEAD-END → money | "Go back" on the confirming sheet is enabled while `createBookingConvex` is in flight; the mutation completes after `navigatedRef` is set, the navigation is dropped, the booking exists, the hold is consumed, and the tester can Authorize again. | `app/booking/mechanic/[id]/confirming.tsx:174-185,361-362`, `components/booking/BookingConfirmStatus.tsx:150-162` | tap Go back during the 2–5 s submit | low-medium |
| 32 | NATIVE / RISK | A transitive **Solana Mobile Wallet Adapter** native module is autolinked into every Android build via `@clerk/clerk-expo → clerk-js → @solana/wallet-adapter-react`; its JS calls `TurboModuleRegistry.getEnforcing("SolanaMobileWalletAdapter")` at module scope. Not in the bundle today (verified: 0 occurrences in the release bundle), so inert — until a Clerk bump either drops the Android package or starts bundling its Web3 path, at which point it is a launch-time throw. | `android/build/generated/autolinking/autolinking.json`, `PackageList.java`; `@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/index.native.js:54` | lockfile drift between an OTA tree and the binary | low today |
| 33 | FATAL at scale | Availability queries re-scan **every** tire/rotor quote response for the shop on every day iterated (×35 days × mechanics × up to 5 ShopPages, plus two 30-day month scans on pick-datetime) — will hit Convex's per-query read ceiling as quote data grows. | `convex/lib/timeSlotAvailability.ts:181-224,266-305,762-800`, `convex/time_slots.ts:182-220,226-281`, `components/booking-flow/ShopPage.tsx:113-116`, `pick-datetime.tsx:243-248,315-341` | shops with hundreds of quote responses | low today, rising |
| 34 | NATIVE (unverified) | The two **local** MapViews (`select-services` peek, `choose-mechanic`) go through react-native-maps' fragment detach/re-attach path (`onDetachedFromWindow` → `onSaveInstanceState`/`onPause`/`onStop`; `onAttachedToWindow` → `super.onCreate(saved)`/`onStart`/`onResume`/re-add features) whenever a **root-stack** route is pushed over the `(booking-flow)` group — shop detail from a browse card, Review & Pay from `onBookEarliest`. That is the region 1.27 wrapped in `safeRemoveFromParent`/`safeRequestDisallowInterceptTouchEvent` after NPE reports. Not proven by reading; needs the repro: peek map → tap card → shop detail → back → pan; Choose Mechanic → Book → back → swipe shops. If it reproduces, unmount the local maps on blur (`useIsFocused`) instead of letting them detach. | `select-services.tsx:457`, `choose-mechanic.tsx:829`; `MapView.java:319-387,1978-2030` | as above, on a phone | unknown |
| 35 | RISK | **targetSdk 36 on Android 16 large screens ignores `screenOrientation="portrait"`** — the map and carousels assume portrait width; a tester on a Fold/Tab running 16 gets a landscape layout. Predictive back is correctly opted out (`enableOnBackInvokedCallback="false"`). | `expo-modules-core` defaults compileSdk/targetSdk 36 | Android 16 foldable/tablet | medium |
| 36 | RISK (low) | `allowBackup="true"` with SecureStore excluded from backup: a device-to-device restore brings AsyncStorage back without the Clerk session (R5-class white first launch). | generated manifest `fullBackupContent`/`dataExtractionRules` | new-phone restore | low |
| 37 | FATAL (low) | A malformed `quoteAcceptContext.minDate` becomes the server `startDate`; `new Date(...T00:00:00).toISOString()` → `RangeError`. | `convex/lib/timeSlotAvailability.ts:68-70,772`, `pick-datetime.tsx:225-231` | quote acceptance with a non-ISO `availability.date` | low |
| 38 | DEAD-END (low) | `EXPO_PUBLIC_VEHICLE_DB_API_KEY` is read at runtime but is in neither `.env.local` nor the EAS environments listed in §1; empty → every vehicle-image request 401s (all caught) → fallbacks. | `utils/vehicleImage.ts:33,194,432,777,1438,1503` | EAS env lacks it | verify |
| 39 | cosmetic | The booking-flow layout gate is a bare background view while `getMe` loads — no spinner, no timeout. | `app/(booking-flow)/_layout.tsx:54-56` | slow `getMe`, offline cold start without cache | low |

**Not a crash, but worth knowing:**
- R8/ProGuard: HEAD ships **unminified** (no `expo-build-properties` plugin entry; `enableMinifyInReleaseBuilds` defaults false). If A7 (minify) is ever applied, 17 of 27 autolinked libs ship no consumer rules; the ones that actually need explicit keeps are the Solana module (kotlinx-serialization) and `react-native-month-year-picker`; exclude #32 and the dead libs below from autolinking first, then smoke-test Maps, Stripe 3DS, Lottie, DateTimePicker and the menu views.
- Dead native libraries autolinked into every build and imported by nothing: `react-native-month-year-picker` 1.9.0 (expo-doctor: untested on new arch, unmaintained), `react-native-teleport`, `react-native-webview`, `react-native-image-colors`. `expo-dev-client` is inert in release. `eas-cli` is in `dependencies`.
- An OTA published from HEAD onto the Sep 9 binary would be patch-level JS↔native drift only (expo 55.0.26 → 55.0.31, RN 0.83.6 → 0.83.10; no native module added or removed — verified against the Sep 9 lockfile). Fingerprint policy would refuse to serve it, which is the point.
- `hooks/useShopsFromConvex.ts:366,403` declares `setShopCoords` / `attemptedShopGeocode` and never uses them, so geocoded coordinates are never persisted and every mount re-runs `Location.geocodeAsync` per coordinate-less shop (caught; shops just stay hidden). `components/home/NavigationETABar.tsx:193-198` passes a fresh controlled `region` object every render (native `moveCamera` per Home render). `components/booking/map.tsx` (§2 #18) is reachable only by the `otopair://booking/map` deep link; `components/home/MapScreen.tsx` and `components/tire-booking/RequestingMapBackground.tsx` are imported by nothing.
- `Linking.openURL("tel:…")` in `components/shop/ShopHeroCard.tsx:78` works without `queries` (startActivity does not need package visibility); only the `canOpenURL`-gated path in `utils/linking.ts:106` is dead — nuance on §2 #16.
- `.env.local` carries `EXPO_PUBLIC_SMARTCAR_CLIENT_SECRET`; nothing references it today, but the first reference would inline the secret into the bundle.

### 6.2 What was checked and found clean this time

Full reads: every screen under `app/(booking-flow)/` and `app/booking/`, all of `components/booking-flow/`,
the booking/vehicle/shop/mechanic stores, 33 hooks on the path, the Convex read functions they call (all
return `[]`/`null` for a missing shop; the `throw`s in `timeSlotAvailability` are only reachable from
`holdSlot`, which every caller wraps), the Android sources of `react-native-maps@1.27.2`,
`expo-location@55.1.14` and `expo-modules-core` permissions, `app.config.js`/`app.json`/`eas.json`, the
custom back-task plugin against the SDK 55 template, and the generated manifest.

- Camera: only `animateToRegion` is used; native returns early when `map == null` and defers when the
  view has no size, so pre-`onMapReady` / pre-layout calls cannot throw "Map size can't be 0". Every
  region carries positive literal deltas. Every timer-driven ref call clears on cleanup and is `?.`-guarded.
- Markers: literal numeric coordinates, `anchor {0.5,0.5}`, no `image`/`icon`/`Callout`/`Polyline`; every
  custom child has a bounded size and `createDrawable` substitutes 100×100 for ≤0, so `Bitmap.createBitmap`
  cannot get 0. `tracksViewChanges` is windowed on Android.
- MapView props: no `customMapStyle`, `mapPadding`, `liteMode`, `googleRenderer`; `showsUserLocation` is
  enabled natively only when COARSE or FINE is granted; Android 12 "approximate" makes GMS throw a
  `SecurityException` that `FusedLocationSource` catches (blue dot just doesn't update).
- expo-location: every reachable call is in try/catch; no `watchPositionAsync`; concurrent permission
  prompts are queued, not thrown. Manifest declares COARSE+FINE, no background location. No GMS → the
  GMS placeholder view, `onMapLoaded` never fires, the 6 s skeleton timeout drops it, collapses into #21.
- Throw sites in the 1.27.2 Android sources: only the base64 marker image converter (unused) and tile
  overlay workers (unused).
- Native versions match `bundledNativeModules.json` except the deliberate `react-native-screens` 4.24.0
  pin (unchanged since before Sep 9), lottie 7.3.8, expo-updates 55.0.30; React 19.2.8 is within RN's
  peer range and RN 0.83.10 has no version-mismatch check. Pairs OK: reanimated 4.2.1 + worklets 0.7.4,
  keyboard-controller 1.20.7, bottom-sheet 5.2.14, gesture-handler 2.30.1, maps 1.27.2, Stripe 0.63.0.
- Hermes: 67 `toLocale*` calls (`"en-US"` or undefined), one `Intl.NumberFormat`, one `Intl.DateTimeFormat`,
  ten `localeCompare` (no options), one lookbehind regex — all supported on RN 0.83 / API 24+. No
  `structuredClone`, `.at()`, `toSorted`, `findLast`, `BigInt`, `Symbol.asyncIterator`.
- Babel/Metro: `transform-remove-console` fires only for Android release; `EXPO_PUBLIC_*` inlining intact.
- Speech / biometrics / sharing / store review / notifications permission calls are all availability-checked
  and wrapped; no foreground services; no `usesCleartextTraffic`; `patch-package` is a no-op (no `patches/`).
- Gesture/Reanimated: `GestureHandlerRootView` wraps the app; shared values never feed a MapView prop.
- No Zustand store is persisted; `sharedTransitionTag` does not throw at module load; the date helpers
  degrade to `undefined`/`NaN` text rather than throwing; `rating.toFixed` sites are guarded; every
  `holdSlot`/`createBatch`/`preauthorizePayment` call is inside try/catch (rejections, not fatal); list keys
  are unique; no `getItemLayout`/`SectionList` in scope; every `dismissTo`/`replace`/`push` target exists;
  the only external deep links route to approve-estimate and the bookings tab.
- The working-tree changes (`CarCarousel.tsx`, `MechanicSearchBar.tsx`, `MechanicCarouselCard.tsx`,
  `search.tsx`, untracked `AndroidTypewriterPlaceholder.tsx`) add no native imports.

### 6.3 Fixes to add to §4's queue

11. **Before anything else:** `eas update:view 020e630b-150d-49b1-8ac7-986ed5227050`, pull its Android
    bundle and diff its lockfile against `9219b069`; consider `eas update:rollback --branch production`
    (back to the embedded bundle) until the rebuilt AAB ships; publish only with `--auto` so the hash is
    recorded; get `4c605eb6` pushed; `runtimeVersion: { policy: "fingerprint" }` (§4 #7) so neither #19 nor
    #20 can recur. (#19, #20)
12. `useStagedLocation`: permission **get** before **request**; `Promise.race` the position fix against
    ~10 s and treat it as `unavailable`; on `unavailable` fall back to the onboarding zip
    (`geocodeAddress`, already cached) or a metro default, show an "Enable location" banner →
    `Linking.openSettings()`, and re-run on AppState `active`. Pass `mayShowUserSettingsDialog: false`
    from Home. (#21, #27)
13. Shop store `hasLoadedShops` (set when `convexShops !== undefined`); `useNearbyBookingShops` /
    `useClosestShop` return `isLoading: !hasLoadedShops`; Choose Mechanic gets a real empty state with a
    back CTA. (#22)
14. `useShopFixedPricesForServices`: the same `areConvexIds` guard as its siblings; `availableServices`
    default `[]`; drop cart ids that no longer resolve. (#23)
15. `getPaymentOriginForBooking` and `getBookingByIdForCustomer` return `null` instead of throwing; skip
    them until `useConvexAuth().isAuthenticated`. (#24)
16. Offline session cache envelope includes the Convex deployment URL; purge on mismatch
    (`purgeOfflineSessionCache` exists). (#25)
17. `mapConvexShopToStore`: `Number.isFinite(lat) && Number.isFinite(lng)` or drop the shop; tighten the
    `setShopCoords` validator server-side. (#26)
18. `google-services.json` via an EAS file environment variable + `android.googleServicesFile`, or hide
    the push onboarding step on Android and stop promising push approvals there. (#28)
19. `package.json` `expo.autolinking.exclude` for the Solana module; drop the four dead native libraries
    and `eas-cli` from `dependencies`. (#32)
20. `disabled={submitting}` on the confirming sheet's Go back (#31); pick-datetime disables the bar with a
    "shop unavailable" note when `shop` is null (#29); `hasVehicles` from rows with `vehicle != null` (#30).
21. Index quote responses by `shop_id + date` (or compute holds once per query). (#33)
22. Run the #34 repro on a phone before the single-MapView work (B11); if it reproduces, gate the local
    maps on `useIsFocused`.
23. `android.allowBackup: false` (#36); decide landscape handling before Android 16 testers (#35); confirm
    `EXPO_PUBLIC_VEHICLE_DB_API_KEY` exists in the production environment (#38).
