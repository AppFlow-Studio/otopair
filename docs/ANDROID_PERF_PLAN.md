# Android Performance Plan — `android-repair`

**Written:** 2026-09-17 · **For:** the next Claude session (Opus) executing the fixes · **Owner:** Waleed

## 0. The rules (read before touching anything)

1. **Android only.** Every code change is gated with `Platform.OS === "android"` or lives in Android-only config/props. iOS behaviour and iOS code paths must be byte-identical after your work. If a change can't be gated, it's out of scope.
2. **No visual change on Android.** Same pixels, same animations when visible, same layout. The only sanctioned exception is item A8 (selected map pin stops bobbing) and it needs Waleed's explicit yes.
3. **Measure before and after every item** with the harness in `scripts/android-perf/` on the budget emulator. An item that doesn't move the numbers gets reverted, not kept "because it should help".
4. **One commit per item**, conventional message (`perf(android): …`), `Co-Authored-By` trailer per the session reminder. Don't push until Waleed says so; when you do, the convex-drift pre-push hook needs `OTOPAIR_ALLOW_CONVEX_DRIFT=1` (branch work, intentional — see REFERENCES.md).
5. **Don't touch:** `convex/`, `ios/`, anything under `docs/HANDOFF_*`, the booking crash investigation (separate track), the Maps API key / EAS env question (needs the EAS owner).

## 1. Where things stand

| What | State |
|---|---|
| Branch | `android-repair`, pushed, based on `origin/hamoudeh-dev` @ `2b5e5526`. Will later be rebased onto `temur-dev` / `temur-dev-2` (Waleed's call). |
| Last commit | `64c1176e chore(deps): align to latest Expo SDK 55 patch set + RN 0.83.10` — expo 55.0.31, RN 0.83.10, react stays 19.2.8, gradle-plugin patch removed. `npm ci` reproduces it. |
| Native dir | `android/` is **gitignored** and was freshly generated on 2026-09-16 with `npx expo prebuild --platform android --no-install` (same as EAS). The previous hand-edited `android/` is backed up at `C:\Users\manso\Desktop\otopair-android-backup-2026-09-16`. Don't restore it. |
| Maps key | Injected into the manifest by `app.config.js` from `.env.local` at prebuild. Present in local builds. Production/EAS presence is **unverified** — not your problem here. |
| Release build | `cd android && ./gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 -Pkotlin.jvm.target.validation.mode=warning -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease` with `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` and `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`. ~2–8 min. APK: `android/app/build/outputs/apk/release/app-release.apk`. Debug-signed, connects to **dev** Convex/Clerk. |
| Emulators | **A** `OtoQA_A_Android9_Budget` (port 5554, Android 9, 2 GB, 2 cores, 720×1280) — the device that matters. **B** `Pixel_API_34` (port 5556, Android 14, 6 GB). Both already signed in with Waleed's dev account (BMW M2 CS). **C** Android-16 tablet AVD is broken on this host (surfaceflinger `hasReadColorBufferDma` assert) — ignore it. Launch: `emulator -avd <name> -port <port> -dns-server 8.8.8.8,1.1.1.1 -no-snapshot-load`. |
| adb from Git Bash | `export MSYS_NO_PATHCONV=1` or device paths like `/sdcard/ui.xml` get rewritten. |

## 2. Baseline (2026-09-16, current code, release build)

Same flows on all three devices. `settle_s` = seconds from input until the screen stopped changing (screenshot-polled, ±0.3 s). Frame stats are `dumpsys gfxinfo` for the window between input and settle.

| Flow | iPhone 15 Pro (prod) | Pixel / Android 14 | Budget / Android 9 |
|---|---|---|---|
| Tab → Home | 1.4 s | 0.4 s · 34% janky · p50 19 / p99 61 ms | 0.5 s · **100% janky** · p50 109 / p99 150 ms |
| Tab → Bookings | 1.2 s | 0.6 s · 33% · 20 / 61 | 0.9 s · 100% · 85 / 150 |
| Tab → Cars | 1.7 s | 1.1 s · 20% · 29 / 150 | 2.2 s · 100% · **200 / 300** |
| Tab → Oto | 2.3 s | 0.7 s · 14% · 27 / 97 | 2.3 s · 100% · 105 / 200 |
| Home scroll (4 flings each way) | — | 2.0 s · 9% · 22 / 34 | **7.9 s** · 100% · 150 / **900** |
| Open booking flow (home "Map") | 1.9 s | 0.9 s · 44% · 32 / 53 | (button not found — scroll position) |
| Booking screen idle 10 s | — | 0 frames drawn | 0 frames drawn |

Control: Android's own **Settings** app scrolled on emulator A = p50 34 / p99 73 ms. So OtoPair is ~4× slower than native on typical frames and ~12× on worst frames, on the same hardware. On the Pixel, scrolling is fine; screen/tab changes are where it stutters.

Raw JSON: `scripts/android-perf/baseline/`.

## 3. How to measure

```bash
# from scripts/android-perf, emulator A booted and app installed
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8
py -3 perf_compare.py android emulator-5554     # ~4 min, writes perf/emulator-5554.json
py -3 perf_compare.py android emulator-5556
```

- Install the fresh APK first: `adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk`.
- The harness force-stops, relaunches, skips the intro carousel (it reappears every launch — `users:markTutorialSeen` returns a Convex Server Error on dev; not yours to fix), then runs the flows.
- Compare against the baseline table above. Report p50/p90/p99 and janky % per flow, before → after, in the commit body.
- Needs `Pillow` (`py -3 -m pip install --user pillow`, already installed on this PC).
- `ios` mode needs the Remote-phone rig (`C:\Users\manso\Desktop\Remote-phone`, WebDriverAgent on :8100). Optional; iOS numbers are only a reference and must not change anyway.

## 4. Group A — Android-only, pixel-identical. Do these in order.

### A1. Tab bar: drop `BlurView` on Android
- **File:** `components/navigation/TabBar.tsx:108-163` (also styles at `:177-185`).
- **Fact:** expo-blur only blurs on Android when `experimentalBlurMethod` is passed; it isn't. Android is already rendering a flat translucent tint, but through a BlurView + `overflow:hidden` + `borderRadius:35` layer that's re-composited under every screen.
- **Change:** on Android render a plain `View` with the same style and an explicit `backgroundColor` matching what `tint="light"` / `intensity={80}` currently produces on Android (take a screenshot before and after; pick the rgba that matches). iOS path unchanged.
- **Verify:** before/after screenshot of the tab bar on emulator A must be visually identical; harness tab-switch numbers.

### A2. Freeze unfocused tab screens
- **File:** `app/(main-tabs)/_layout.tsx` (custom `Tabs` branch, used on Android and iOS < 26).
- **Fact:** no `enableFreeze` / `freezeOnBlur` anywhere in the app. Hidden tabs re-render on every Convex/Zustand update.
- **Change:** `import { enableFreeze } from "react-native-screens"; if (Platform.OS === "android") enableFreeze(true);` at module scope, or `freezeOnBlur: true` in `screenOptions` gated by platform.
- **Watch for:** anything that relies on a hidden tab staying live (the Bookings live-tracking screen? `HydrateBookingData`/`OfflinePreload` are in the layout, not a tab, so they're safe). Check `useFocusEffect` users still fire on return.
- **Verify:** all 4 tabs still show fresh data when switched to; harness tab-switch numbers.

### A3. Strip `console.log` from release
- **Fact:** 84 `console.log/info/debug` calls in `app/ components/ hooks/ stores/ services/ lib/`; `app/index.tsx:66-153` logs on every route check and these lines appear in the **release** logcat. There is no `babel.config.js` (Expo default preset).
- **Change:** add `babel.config.js` with `babel-preset-expo` plus `transform-remove-console` (`babel-plugin-transform-remove-console`, `{ exclude: ["error", "warn"] }`) under `env.production`. Platform-neutral file, but it only removes logs — no runtime behaviour change on either OS. Clear Metro cache after adding it.
- **Verify:** `grep -c "ReactNativeJS: '\[onboarding-resume" <logcat>` is 0 on the new release build.

### A4. Stop hidden infinite animations
- **`components/booking-flow/EnrichmentStatusPill.tsx:110-118`:** `withRepeat(-1)` starts on mount even when `visible` is false and the component returns `null` (`:162-164`). Mounted twice (main-tabs layout with `placement="bottom"`, booking-flow layout). Start the pulse in an effect keyed on `visible`; `cancelAnimation` when it goes false.
- **`components/cars/MaintenanceTracker.tsx:439-495`** (`OverdueLabel`, `NowLabel`, and 2 more further down — 8 `withRepeat` calls in the file): `withRepeat` is created **inside** `useAnimatedStyle`, so it's re-instantiated on every worklet re-evaluation. Move each into `useSharedValue` + `useEffect` (start once, cancel on unmount), read the value in the style. Same visible animation.
- **`components/booking-flow/RatingMarkerPill.tsx:81`:** already gated on `isSelected` — fine, leave it.
- **Verify:** same animation visible on the Cars tab / pill; `dumpsys gfxinfo` frames drawn during 10 s idle on Cars tab and Home should be 0 (baseline Home idle was already 0; Cars idle not measured — measure it first).

### A5. `removeClippedSubviews` on long vertical scrolls
- **Files:** `app/(main-tabs)/home/index.tsx:1337` (`Animated.ScrollView`), `app/(main-tabs)/bookings/index.tsx:490`, Cars tab scroll. Only `components/booking/sheets/MechanicSelectionContent.tsx:559` uses it today.
- **Change:** `removeClippedSubviews={Platform.OS === "android"}`.
- **Watch for:** children with `overflow: visible` shadows or absolutely-positioned overlays can get clipped early; check hero cards and the tab bar overlap area.
- **Verify:** scroll harness numbers; visual scroll-through on A.

### A6. Downscale oversized PNGs
- **Fact (bytes):** `assets/images/settings/stack-blue-tokens.png` 2.2 MB, `payments/empty-wallet.png` 2.1 MB, `lexus.png` 1.9 MB (AI-chat avatar, `app/(main-tabs)/ai-chat/index.tsx:325`), `addcar4.png` 1.8 MB, `addCar.png` 1.8 MB, `services/redesign-using-more…png` 1.3 MB, `car-silhouette-{sedan,suv,truck}.png` 1.0–1.2 MB (`components/shared-ui/CarSilhouette.tsx:42-58`, rendered ~100 px), `addcar2.png` 1.1 MB.
- **Change:** find the largest rendered size for each (grep the `width`/`style` at each `require`), export at 2× that size (3× for the largest phone density if it's full-bleed), keep PNG if it needs alpha, else WebP. Use `sharp` or Pillow. Keep the same filename so no code changes.
- **Verify:** side-by-side screenshot at 1:1 on emulator B (420 dpi) shows no softness; app heap via `adb shell dumpsys meminfo com.otopair.app` on A before/after opening Cars + AI chat.

### A7. R8 minify + resource shrinking in release
- **Change:** add `expo-build-properties` to `app.json` plugins: `{ android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }`. iOS block untouched. Re-run `npx expo prebuild --platform android --no-install` (it regenerates `android/`; the Maps key comes from `.env.local` again).
- **Watch for:** R8 stripping reflection-based native modules (Stripe, Maps, Lottie usually ship consumer proguard rules; verify each screen opens). This affects startup and APK size, not scroll smoothness — do it last in group A.
- **Verify:** APK size before/after; cold-start time (`adb shell am start -W com.otopair.app/.MainActivity` ×3, `TotalTime`); smoke every tab + booking flow + a Stripe screen.

### A8. Marker repaint gating — **ask Waleed first**
- **Files:** `app/(booking-flow)/select-services.tsx:478`, `app/(booking-flow)/choose-mechanic.tsx:869` keep `tracksViewChanges` permanently `true` for the selected marker, which re-snapshots the marker view every frame.
- **Change:** the 200 ms on-then-off pattern already implemented in `components/booking-flow/BookingFlowMap.tsx:293-322` (`BookingFlowShopPinMarker`). Reuse that wrapper.
- **Visual cost:** the selected pin's bob animation (`RatingMarkerPill`) stops rendering on those two screens on Android. It already doesn't render on the layout map. Waleed decides.

## 5. Group B — same look, structural. Only if group A leaves the budget phone still above ~50 ms p50.

- **B9.** Home carousels to `FlatList horizontal` with `initialNumToRender`/`windowSize`: `components/home/ActionCardsCarousel.tsx`, `ServiceBundlesSection.tsx`, `SuggestionsSection.tsx`, `NowTierCallout.tsx` — all `.map()` inside horizontal `ScrollView`, no FlatList. Pixel-match paging/snap behaviour.
- **B10.** Bookings list `bookings.map()` (`app/(main-tabs)/bookings/index.tsx:643`) to `FlatList` with `keyExtractor`.
- **B11.** Unmount/`display:none` the layout-level `BookingFlowMap` on Android while `select-services` (peek mode) or `choose-mechanic` renders its own local `MapView` on top (`select-services.tsx:457`, `choose-mechanic.tsx:829`). Two live Google maps at once is the likeliest cause of the budget-phone ANR in the booking flow, but that's the crash track's call; here it's a perf lever.
- **B12.** Move the large/remote `Image` usages (38 files on RN `Image`, 8 on `expo-image`) to `expo-image` where the source is a network URL or one of the A6 assets.

## 6. Not worth doing (checked)

- Removing `shadow*` styles: Android ignores them; only `elevation` draws, and reducing elevation changes visuals.
- `components/shared-ui/ScrollFadeIn.tsx` 80 ms `setInterval`: dead code, zero importers. Delete for hygiene only.
- Lottie `logo-loading-animation.json` (646 KB): only on loading screens.

## 7. Known traps

- **Pixel emulator never resolves a location** in the booking flow ("Finding your location…" / "Enable location to see nearby shops") even with permission granted and `emu geo fix`. Budget emulator A does resolve. Use A for anything map-related.
- **Budget phone can ANR/white-screen on booking entry** intermittently (reproduced live, not yet captured in a trace). If it happens during measurement, `adb -s emulator-5554 root` then pull `/data/anr/*` and attach to the commit — the crash track wants it.
- **`am_kill … stop com.otopair.app` in logcat is the harness force-stop**, not a crash.
- **Screen readers on A**: `uiautomator dump` needs `MSYS_NO_PATHCONV=1`; zero-size nodes exist for off-screen buttons — the harness already filters them.
- `expo install --fix` downgrades React; don't. `npm ci` is the truth.

## 8. Deliverable

A commit per item with before → after numbers in the body, then a final short table in this file's §2 with a new "after" column. Waleed will re-run the iPhone reference himself if needed; don't try to prove iOS unchanged by measurement — prove it by diff (`git diff --stat` must show no `ios/`, no un-gated component changes).

---

## 9. v2 course correction (2026-09-17)

Written at the end of the first measuring pass, after sorting the working tree. Read this before
§4 — it changes what the rest of the plan is worth.

### 9.1 What survived

Five items are committed. Two of them are proven by round-robin runs on the budget emulator where
every round agreed; two are kept on their mechanism alone and say so in their own commit body; the
fifth (C6) has no rounds at all, because the rig had been taken over by the time it was written —
its commit body states the absence rather than borrowing a neighbour's numbers.

| Item | Verdict | The numbers that hold up (budget emulator, paired rounds, JS-thread CPU per 10 s window unless stated) |
|---|---|---|
| **A3** console.log out of release | **proven** | Home idle 480 → 380 ms (−25%), Cars idle 1,020 → 690 ms (−27%), booking screen idle 870 → 630 ms (−31%), all 3/3 rounds agreeing. Tap Cars also settled 1.59 → 1.46 s (−16%) with UI thread 13 → 11 ms/frame. |
| **C3** off-screen typewriter + avatar stand down | **proven** | booking screen idle 940 → 10 ms (−99%), Cars idle 755 → 0 ms (−100%), tap Bookings 405 → 80 ms (−80%), open booking flow 915 → 200 ms (−76%) with UI thread 13 → 8.3 ms/frame (−36%) and settle 3.38 → 2.96 s, tap Home 460 → 255 ms (−34%) with settle 0.72 → 0.52 s. All 2/2 rounds agreeing. |
| **A4** enrichment pill pulses only when visible | kept, not proven | Home/Cars idle UI thread −15% / −14% over 2 rounds; everything else inside noise. Kept because the pill is mounted on four screens, renders `null` on nearly all of them, and was re-evaluating two animated styles per frame for no pixels. |
| **A6** right-sized Android images | kept, size win | 5.4 MB of PNG → 1.6 MB; uncompressed APK contents 158.0 → 155.4 MB. No runtime change in the measured flows. |
| **C6** Cars scroll stops waking the JS thread | kept, **not measured** | No rounds exist — see §9.6. Kept on a mechanism that is checkable without a device: the per-frame `onScroll` hop only ever wrote `scrollOffsetRef`, which nothing in the repo reads, and the native gate means the old `scrollEventThrottle={16}` never throttled anything. Expect `cpu_js_ms` on the cars-scroll window to fall toward the floor and `ui_mean_ms` to stay flat; that is a prediction until 08-locked is run against 09-C6. |

### 9.2 What was reverted, and why

Rule 3 of §0 was applied literally: an item that does not move the numbers is reverted, not kept
because it should help. These three are gone from the working tree; their measurements and their
write-ups stay in the report so nobody re-derives them from scratch.

- **A1 — tab bar without `BlurView`.** The first two rounds showed Home/Cars idle CPU −22%/−18%,
  but that reading came from an ordering artefact (documented in the report), and no later round
  reproduced it. Worth revisiting **only** once there are real-device numbers: the mechanism —
  Android paying for a blur wrapper to draw a flat `#F9F9F99F` tint — is real, it just doesn't
  show up on this rig.
- **A2 — `freezeOnBlur` on Android tabs.** No consistent improvement across rounds, and it forced
  `HydrateConvexData` (services, categories, shops, mechanics → booking store) out of the Home tab
  to avoid freezing the syncs that every tab reads. That's a correctness risk taken for an
  unmeasurable gain. If it comes back, it comes back with the hydration move as its own reviewed
  commit first.
- **A5 — `removeClippedSubviews` on the three long scrolls.** No consistent change, and the flag
  can clip overflowing shadows and absolutely-positioned overlays. Nothing gained, something to
  lose.

### 9.3 The measurement lesson — these are not phone numbers

Both AVDs render through a GL translation layer onto the host GPU, repaint the whole screen every
frame, and share a host that is also somebody's desktop. That inflates exactly the numbers that
look most like performance:

- **Do not decide on:** `rt_mean_ms` / `cpu_rt_ms` (RenderThread), whole-process `cpu_ms`, and any
  frame *duration* (`fs_mean_ms`, `fs_p50/p90_ms`, `janky_pct`). RenderThread here is measuring the
  emulator, not the app. Quote them, if at all, as "emulator, directional".
- **Decide on:** `cpu_js_ms` (JS-thread CPU in the window), `ui_mean_ms` (UI thread per frame),
  `fs_frames` (frames drawn at all — a frame is a frame on any device; it is now in
  `summarize.py`'s `COMPARE`), `settle_s`, and `app_alive`.
- **And:** one round proves nothing. `summarize.py --paired` only calls a delta *clear* when at
  least two rounds agree on the direction; treat anything else as noise even when the median is
  big.

The exec summary in the report has been corrected accordingly: the "two thirds of a CPU core" and
"half of the phone's two cores" idle figures are emulator figures, and are labelled as such.

### 9.4 Next pass belongs on real hardware

Stop tuning against emulators. The next measuring pass wants:

- **A real low-end Android phone** (an entry-level Android 11–13 device, 2–4 GB RAM), USB-attached,
  not an AVD. Every figure above should be re-taken there before it is quoted outside the team.
- **Perfetto** rather than `dumpsys gfxinfo` sampling: `record_android_trace` with the `sched`,
  `gfx`, `view`, `am`, `wm`, `hal` and `binder_driver` categories plus the RN/Hermes ATrace slices.
  That gives per-frame attribution (which thread, which slice) instead of a per-window average, and
  it is the only way to tell a slow JS callback from a slow layout.
- The same round-robin discipline: alternate builds within a session, shuffle the order, ≥ 2 rounds.

### 9.5 Queue, in order

**Where C6, C5 and C4 landed (close-out pass, 2026-09-17).** All three were written and built;
none could be measured or pixel-checked, because the rig was gone (§9.6). One is committed, two
are deliberately not.

- **C6 — Cars scroll off the JS thread. Committed** (`573afcdf`), **not measured.** Two corrections
  to what this entry used to say. First, the prescription above — move it to a Reanimated
  `useAnimatedScrollHandler` — was the wrong fix: the handler had no consumer at all.
  `scrollOffsetRef` is written on every scrolled frame and **read nowhere in the repository**, so
  there was nothing to move, only something to stop. Second, deleting the `onScroll` prop would
  *not* have stopped it: `ScrollView.js:1787` wires `onScroll` to the native view unconditionally,
  and Android drops a SCROLL event only when `scrollEventThrottle >= max(17, now - lastDispatch)`
  (`ReactScrollViewHelper.emitScrollEvent`), so the old `16` never throttled anything and an
  omitted throttle (default `0`) would not either. The fix is the throttle: parked at 1,000,000 on
  Android, with the ref fed from `onScrollEndDrag` / `onMomentumScrollEnd`, which the gate exempts.
  Checked and clear: no `stickyHeaderIndices` (would force throttle 1), no native scroll listeners,
  no `scrollPerfTag`, and `sendMomentumEvents` gates only event emission — fling, paging snap and
  the post-touch runnable are untouched.
- **C5 — Cars health-ring count-up onto the UI thread. Written, in the working tree, NOT committed.**
  Patch at `scripts/android-perf/report/patches/C5.patch`. Also a correction: of the four count-ups
  this entry pointed at, `MaintenanceTracker.tsx:341` `VehicleHealthRing` is **dead code** — declared
  and never rendered, so converting it would have bought nothing. The live one on the Cars entry path
  is `CarCarousel.tsx:1503` `ActivityRings`, which is the one that was done; `MaintenanceDetailView.tsx:115`
  and `CarCarousel.tsx:~640` are modal-only and still open.
- **C4 — Home typewriter onto the UI thread. Written, in the working tree, NOT committed.** Patch at
  `report/patches/C4.patch`. Worth knowing: Home mounts **two** `MechanicSearchBar`s at once when an
  upcoming-booking hero is showing (`home/index.tsx:1428` and `:1704`), each running its own
  typewriter, so the JS churn here is doubled in that state.

  **Why C5 and C4 are not committed.** Both replace a `<Text>` with a non-editable `TextInput` — the
  only RN text node a worklet can write — on visible UI (the Cars hero ring, the Home search bar).
  Android measures those two view classes differently, and vertical baseline placement is exactly
  what a screenshot diff settles and what reasoning cannot. §0 rule 2 is pixel-identical, so they
  wait for the check rather than being argued in. C6 was committed on the same day under the same
  blackout because its pixel question is answerable from the code: it renders nothing.

**Then, in order:**

0. **Restore the rig and settle the backlog** (§9.6 for the exact ask). Four builds are stacked up
   unverified: `08-locked`, `09-C6`, `10-C5`, `11-C4`. Settle them **in sequence**, not in one jump,
   or a failed diff won't say which change caused it. For C5 the screen that matters is
   `05_cars_top`; for C4 the whole-screen diff is **not** sufficient — `capture_states.py` masks the
   placeholder as an animated region, so use `stylecheck_searchbar.py` (written for this) and check
   the absolute numbers against `evidence/11-C4/groundtruth/geometry.json`.
   *2026-09-18:* C4's **performance** side is settled — on the signed-in Home it takes idle JS from
   570–650 ms per 10 s to ~0 and scroll JS from 870 to 150 ms (`ANDROID_PERF_DEEP_DIVE.md` §1.1).
   The pixel check above is the only thing left before committing it. The rest of "why still
   sluggish" is in that doc: permission Activity per mount, React Compiler bail-outs, coach
   registry, three MapViews. *Later the same day:* the booking-flow half of that list shipped
   (`ANDROID_PERF_DEEP_DIVE.md` §4.1) — one MapView at a time, no permission Activity on entry,
   both map screens compiler-memoised; map-tap UI thread 2,560 → 520 ms. Item 8 (B11) below is
   therefore done for Android.
1. **P0 — booking-entry crash/ANR on the budget device.** Reproduced live, still uncaptured. Blocks
   clean measurement of the booking flow (the harness already logs the window as dropped). Belongs to
   the crash track but nothing below it is trustworthy while it fires.
2. **A8 — marker repaint gating.** Needs Waleed's yes: the selected pin stops bobbing on
   `select-services` and `choose-mechanic`. Pure product call, not a technical one.
3. **B9 / B10 — list virtualisation.** Home carousels and the Bookings list from `.map()` inside a
   `ScrollView` to `FlatList`, paging and snap behaviour matched pixel for pixel.
4. **A7 — R8 minify + resource shrinking.** `expo-build-properties` is already in `package.json`
   (landed with A3, unused); it needs the `app.json` block, a prebuild and a smoke pass over every
   screen that touches Stripe, Maps or Lottie.
5. **Overdraw pass.** `adb shell setprop debug.hwui.overdraw show` on the real phone, then flatten
   the worst stacked backgrounds. Cheap, and it is the kind of thing an emulator cannot tell you.

### 9.6 The emulators are no longer in a measurable state — read before the next stage

At **2026-09-17 19:17** something outside this workflow uninstalled `com.otopair.app` from **both**
emulators and installed a different build in its place: `versionCode=13` (every APK in
`scripts/android-perf/apks/` is `versionCode=1`), `firstInstallTime == lastUpdateTime`, so the app
data went with it. As of 21:15 that is still what is installed:

- **A (budget, 5554)** — sitting on the sign-up / login screen. Waleed's dev session is gone.
- **B (Pixel, 5556)** — signed in to a *different* account (a BMW M5, not the BMW M2 CS this
  evidence was recorded against) and showing a four-tab navigation bar, i.e. not this branch's app.

Two consequences, both already handled in the evidence but not fixable from here:

1. **Round 4 of the rotation is quarantined.** `rotate.sh` installs before it measures, but
   `adb install -r` of a `versionCode=1` APK over `versionCode=13` fails with
   `INSTALL_FAILED_VERSION_DOWNGRADE`, and the script does not stop on a failed install — from
   19:17 onward it measured the foreign, logged-out app. Files moved to
   `evidence/rot/_quarantine-round4/`, with the timeline in its `README.txt`. Everything in this
   section was recomputed from rounds 1–3; the conclusions did not change. **Both fixes landed in
   the C6 pass:** `rotate.sh` now `break`s the round when `adb install` does not print `Success`,
   and `perf_compare.py` stamps `version_code` (read from `dumpsys package`) into every run JSON,
   so a swapped build is visible in the evidence instead of averaged into a median.
2. **The `08-locked` baseline could not be installed or captured.** The APK is built and sitting at
   `scripts/android-perf/apks/08-locked.apk` (95.3 MB, x86_64 release, contents verified: no
   `console.log(` in the bundle, the `.android.png` assets present). **So the 08-locked pixel
   comparison against 07-A6 has not been run.**

   **Correction (C6 pass, 2026-09-17 21:30) — the blocker is the signing key, not the version.**
   `adb install -r -d` (allow-downgrade) was tried on A and returns
   `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match previously installed version`,
   not `INSTALL_FAILED_VERSION_DOWNGRADE`. The foreign build (`versionName` 1.3.1, `versionCode` 13,
   `targetSdk` 36, sideloaded, no installer package) is signed with a different key, so **bumping
   `versionCode` would not have helped either** — Android refuses a differently-signed replacement
   at any version, and will not hand it the old app data. `adb uninstall` is the only way in.
   That is worth doing only together with a sign-in, because:
   - neither AVD has an OS-level Google account (`dumpsys account` is empty on both), so
     "Continue with Google" is not a shortcut back into the app;
   - the only snapshots are `snapshots/default_boot/ram.img` on each AVD, both dated 17:26 with
     `ram.img.dirty` set — they are the running instances' boot RAM, not a good-state save, so
     there is no restore point behind the 19:17 install.

   **This needs Waleed.** Uninstall on both AVDs, install `apks/08-locked.apk`, sign in as the dev
   account (BMW M2 CS) — the credentials are the part no agent here can supply.

**To restart measuring:** put both AVDs back on Waleed's dev account (BMW M2 CS) with a clean
install of `apks/08-locked.apk`, confirm `adb shell dumpsys package com.otopair.app | grep
versionCode` reads 1 on both, then re-run `capture_states.py` on both and
`diff_states.py evidence/07-A6/<dev>/shots evidence/08-locked/<dev>/shots` — the A1/A2/A5 reverts
should come back pixel-identical outside the animated regions. Until then, treat `08-locked` as
built-but-unverified.
