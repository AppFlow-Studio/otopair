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

**Checked and clear** (worth knowing so nobody re-audits them): every map coordinate traces to a finite
number (`shop.lat ?? 0`, null-island filtered at every marker/animate site); no `fitToCoordinates` /
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
