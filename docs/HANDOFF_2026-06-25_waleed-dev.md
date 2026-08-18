# Handoff — Waleed-Dev — 2026-06-25

Session covered: Oto vehicle-truth feature, full `convex/` parity with otopair-web
PR #29, test-suite port, Ahmad-dev merge, and an (in-progress, throwaway) attempt
to run the app on a real iPhone via **Expo Go** by downgrading to SDK 54.

---

## 1. Branch / git state

- Working branch: **`Waleed-Dev`**.
- **`origin/Waleed-Dev` = `91bd491`** (pushed). Local is **4 commits ahead, NOT pushed**:
  - `cbdef1c` feat(oto): wire render_reasoning + render_sources to mobile components
  - `3c04d33` chore: add expo-dev-client for EAS dev builds
  - `b2af400` chore(eas): temp point to waleedmansourr account (for an EAS build)
  - `313385b` Revert b2af400 (back to otopair-dev) ← so app.json net = otopair-dev
  - Push is a fast-forward (no force needed) when ready.
- **Uncommitted working-tree changes (the SDK-54 Expo Go experiment — throwaway):**
  - `package.json` + `package-lock.json` — DOWNGRADED to **Expo SDK 54** (expo `^54`,
    react `19.1.0`, react-native `0.81.5`, expo-router `6.0.24`, reanimated `4.1.7`,
    **react-native-screens `4.16.0`**). The COMMITTED branch is SDK 55.
  - `metro.config.js` — added an `EXPO_GO_STUBS=1`-gated resolver block (see §4).
  - `expo-go-stubs/` (untracked) — 5 stub modules.
  - `.git/info/exclude` — locally ignores the 4 untracked `OTO_GREAT_AGAIN_*.md` /
    `docs/TICKET_PACKAGE_QUESTIONS.md` planning docs (so they don't dirty EAS builds).

### Restore SDK 55 (undo the experiment)
```bash
git checkout package.json package-lock.json metro.config.js
rm -rf expo-go-stubs
npm install
```
The stubs are gated behind `EXPO_GO_STUBS=1`, so even without reverting, a normal
`expo start` / dev build / EAS build uses the REAL native modules.

---

## 2. What shipped this session (all committed)

1. **Completed-service at a PAST mileage/date** (`bf9f3bd`) — the headline feature.
   `render_vehicle_update` service_claims now carry `service_mileage` /
   `service_age_days` (relative, server-resolved) / `service_date` (abs ms).
   `applyVehicleTruth` records the `maintenance_record` at the PAST anchor (not
   now/current) so the maintenance pipeline re-anchors `due = anchor + interval`.
   **Backward guard stays scoped to the current odometer only** (a past service
   mileage is legitimately below current). Files: `convex/vehicleTruth.ts`,
   `convex/oto/tools.ts`, `convex/oto/prompt/stable.ts`, `services/ai/types.ts`,
   `components/ai-chat/AIVehicleUpdate.tsx`, `tests/applyVehicleTruth.test.ts`
   (5 new cases, 19/19 pass). The pipeline (`convex/lib/intervals.ts`) needed NO
   change — it already projects from the anchor.
2. **Mobile Vehicle-Update card** (`78a7892`) — `AIVehicleUpdate.tsx` wired into
   `app/(main-tabs)/ai-chat/index.tsx` for `showVehicleUpdate` (→ `applyVehicleTruth`).
3. **render_reasoning + render_sources wired** (`cbdef1c`) — backend produced them
   but the mobile Oto path dropped both. Added shape adapters + a generic
   `reference` SourceType in `AISources.tsx`. **All 9 Oto render tools now have a
   wired mobile component.**
4. **Full `convex/` parity with otopair-web `waleed-fix` (PR #29)** (`62deca9`) —
   imported all of `convex/` (parts-pricing, labor multi-source, RepairPal endpoint,
   Oto/health). Schema gained `repairpal_endpoint_estimates`. `convex codegen` exit 0.
   Mobile `convex/` is byte-for-byte the web backend.
5. **PR #29 vitest suite ported** (`78c5da0`) — 600/604 pass. 2 web-only tests
   removed (`info-card`, `renderDirectiveSummary`). 2–3 remaining failures are
   flaky/pre-existing-on-web (verified `partSelector`, `customer_late` fail on web too).
6. **Merged Ahmad-dev latest** (`91bd491`) — his mobile UI (booking-flow, toast
   system, home/maintenance cards, warning-lights, `useUpdateMileage` hook,
   `convex/vehicles.ts`). Clean merge, 0 conflicts.
7. **Theme fix** (`449be35`) — narrowed the `hooks/use-color-scheme.ts` wrapper return
   to `'light' | 'dark' | null | undefined` (the TS7053 `ColorSchemeName` cascade was
   reaching `convex/oto` via `components/cars/MaintenanceTracker` → shared-ui and
   blocking `convex codegen`).

---

## 3. Backend / how to run

- **Convex backend lives on the CLOUD dev deployment** `flippant-mink-750`
  (`appflow-studios:otopair:dev/waleed-mansour`, https://flippant-mink-750.convex.cloud).
  All the backend work above is deployed there (pushed via `convex codegen`). The app
  reads `EXPO_PUBLIC_CONVEX_URL` from `.env.local` → hits this cloud deployment, so the
  app works without a local `convex dev`. Run `npx convex dev` to re-sync edits.
- `metro.config.js` redirects `@/convex/*` to the sibling `../otopair-web/convex` when
  that repo is present locally (it is, at `C:\Users\manso\Desktop\otopair-web`) — pre-existing.

---

## 4. The Expo Go SDK-54 experiment (in progress, blocked)

**Why:** the user's iPhone Expo Go supports SDK **54**; the project is SDK **55**
(→ "requires a newer version of Expo Go"). To test in Expo Go we downgraded the
project to SDK 54 and stubbed the native modules Expo Go doesn't bundle.

**Stubs** (`expo-go-stubs/*`, aliased in `metro.config.js` only when `EXPO_GO_STUBS=1`):
`@stripe/stripe-react-native`, `react-native-keyboard-controller` (loaded in
`app/_layout.tsx`!), `react-native-maps`, `@react-native-menu/menu`,
`@react-native-segmented-control/segmented-control`. The iOS bundle compiles CLEAN
(38.8 MB) with these.

**Fixed:** `react-native-screens` was pinned at `4.24.0` (SDK 55) via
`expo.install.exclude`; downgraded it to `4.16.0` (SDK 54) — cleared a native
`"expected boolean, had string"` RNSScreen prop error.

**CURRENT BLOCKER (next session):** app crashes at startup with
`[TypeError: Cannot read property 'duration' of undefined]` at
`components/booking-flow/CategoryListRow.tsx:33`:
```js
export const categoryTitleTransition = SharedTransition.duration(320).easing(...)
```
`SharedTransition` (from `react-native-reanimated`) is **undefined in reanimated
4.1.7 (SDK 54)** — it's a reanimated-4.2 / SDK-55 API. It runs at MODULE level so it
crashes the whole app at boot. Options:
  (a) guard/stub it for the SDK-54 test (and expect MORE SDK-55 APIs to surface), or
  (b) **abandon the downgrade** and use a real **dev build** (runs SDK 55 natively —
      the right tool; see §6).

### Run Metro for the Expo Go test
```bash
# Tailscale (iPhone needs Tailscale on the same tailnet → exp://100.82.95.62:8081):
REACT_NATIVE_PACKAGER_HOSTNAME=100.82.95.62 EXPO_GO_STUBS=1 npx expo start --go --port 8081
# or tunnel (any network; ngrok can be flaky, gives exp://wji797w-waleedmansourr-8081.exp.direct):
EXPO_GO_STUBS=1 npx expo start --go --tunnel --port 8081
```
On Windows the dev-server port often lingers after stop — free it with:
`taskkill //F //PID $(netstat -ano | grep ":8081" | grep -i listening | awk '{print $NF}' | head -1)`.

---

## 5. Known issues / TODO

- **[Expo-Go test] `SharedTransition` crash** — see §4. Blocks boot on SDK 54 only.
- **§6 mileage-path divergence (verified, not fixed):** the cars-page MileageEditModal
  uses Ahmad's `useUpdateMileage` → `api.vehicles.updateMileage`, which writes **only
  `mileage`** (no `mileage_source`, no `mileage_updated_at`, no `runPipeline`). The Oto
  card uses `applyVehicleTruth` (hardened: guard + reconfirm + source/timestamp +
  pipeline). So the two paths produce inconsistent `vehicle_owners` rows, and a
  cars-page mileage change leaves the persisted `vehicle_service_states.urgency` (which
  Oto reads) stale until the next pipeline trigger. **Convergence fix:** make
  `vehicles.updateMileage` also stamp `mileage_source` + `mileage_updated_at` and
  schedule `runPipeline` (gated on `preOnboardingComplete`).
- **EAS "Install dependencies" failure:** BOTH the local Android Gradle build and the
  EAS cloud Android build failed. EAS failed at the npm install phase; locally the
  SDK-54 `expo install --fix` hit `ERESOLVE` on `@react-native-community/datetimepicker`
  ↔ `react-native-windows` optional peer (cleared with `--legacy-peer-deps`). A real dev
  build needs this resolved (likely add `legacy-peer-deps=true` to `.npmrc` or fix the
  peer set).
- **EAS account mismatch:** the EAS project (`otopair`, id `556287b6…`) is owned by the
  **`otopair-dev`** Expo account; the machine is logged into **`waleedmansourr`** (no
  access → "Entity not authorized"). For an EAS build: log in as `otopair-dev`, OR add
  `waleedmansourr` to that org, OR temporarily repoint `app.json` owner/projectId to
  `waleedmansourr` (a throwaway project `d79a7759…` already exists under that account).
- **142 pre-existing project `tsc` errors** (expo-router path typing, reanimated
  shared-transition, implicit-any) — unrelated to this work; none block `convex codegen`.
- **Push pending:** 4 local commits ahead of `origin/Waleed-Dev`.
- **`stash@{0}`** — old 655-line `convex/lib/vehicleDatabases.ts` edit, still parked.

---

## 6. Recommendation for "see it on the iPhone"

Expo Go is a dead end for this app long-term (SDK-55 APIs like `SharedTransition`, and
the native modules require stubbing). The proper path is a **dev build** — a one-time
install, after which `npx expo start` hot-reloads JS exactly like Expo Go but runs the
real SDK 55. For iPhone that means an **EAS iOS dev build**, which needs: (1) the EAS
account access (§5), (2) the deps/`ERESOLVE` fix (§5), and (3) the user's Apple
Developer account + iPhone UDID registration (EAS prompts for these). Once installed,
no SDK-version games and no stubs.
