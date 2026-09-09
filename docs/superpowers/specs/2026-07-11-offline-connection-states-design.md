# OtoPair — Offline & Connection States (Pass A) — Design Spec

**Date:** 2026-07-11
**Branch:** `waleed/oto-warning-lights-health-fixes`
**Source concept:** "Pill system design feedback" zip → `Offline State.dc.html` + `IMPLEMENTATION.md`
**Status:** Approved design, ready for implementation plan.

---

## 0. Decisions locked

| Decision | Choice | Rationale |
|---|---|---|
| Cache scope | **Current session only** (Convex in-memory cache) | Keeps the 3-way split exact; a force-close with no wifi lands on the Offline page, never a half-stale screen. No custom persistence layer. |
| Delivery cut | **Approach A** — infra + all 4 UI surfaces + gate the two highest-value writes now; sweep the rest as a fast follow-up | First PR stays reviewable; ships the whole *visible* system + the writes users hit most. |
| Offline detection | **Add `@react-native-community/netinfo`** | Standard Expo dep, no native config. Airplane-mode / no-signal flips to `offline` instantly instead of reading as `reconnecting` for ~10s. |

---

## 1. Core principle

**Reads degrade to view-only; writes are blocked up front.** No optimistic saves, no silent offline queue. Cached data stays on screen and usable; anything that must reach the backend is disabled *before* the user commits, with a reason.

---

## 2. The three surfaces — one signal

Every surface is driven by a single connection signal derived from Convex's live connection state (+ NetInfo).

| # | Trigger | Surface | Behavior |
|---|---------|---------|----------|
| 1 | **Cold start, offline** — no connection before anything loads | Full-screen **`OfflineScreen`** | Blocks entry until connectivity returns. Not a modal. |
| 2 | **Connection drops while on an already-loaded (cached) screen** | Cached data stays (view-only) + **`ConnectionPill`** + **writeable buttons disabled** | Recover → pill flashes "Back online" ~2s, auto-dismiss. |
| 3 | **Navigate to a never-loaded screen while offline** | **`CantLoadModal`** | Dismiss → back to the previous cached page. |

---

## 3. Architecture

### 3.1 Connection signal — `hooks/useConnection.ts`

The one hook every surface reads. **No component calls NetInfo or `convex.connectionState()` directly.**

```ts
export type ConnState = "online" | "reconnecting" | "offline";

// Reactive: useSyncExternalStore over the Convex client's connection subscription,
// combined with NetInfo's reachability.
//   const convex = useConvex();
//   const cs   = useSyncExternalStore(convex.subscribeToConnectionState, () => convex.connectionState());
//   const net  = <NetInfo reachability>;
//   return deriveConnState(cs, net);

// Pure, unit-testable derivation:
export function deriveConnState(cs: ConnectionState, net: NetInfoState): ConnState;

export function useCanWrite(): boolean; // === useConnection() === "online"
```

**Verified Convex 1.31.6 API** (`ConvexReactClient`):
- `connectionState(): ConnectionState`
- `subscribeToConnectionState(cb): () => void`
- `ConnectionState = { isWebSocketConnected, hasEverConnected, hasInflightRequests, connectionCount, /* + running failed-connection count */ }`

**Derivation rules:**
- `cs.isWebSocketConnected` → **`online`**.
- Socket down + NetInfo reports a network + within backoff ceiling (~3 failures / ~10s) → **`reconnecting`**.
- NetInfo reports no network, **or** backoff ceiling exceeded → **`offline`**.
- `reconnecting → offline` is keyed to Convex's failure count, **not a fixed timer that lies**.

`cs.hasEverConnected` is exposed for the boot gate (§3.3).

### 3.2 Two global hosts — app shell singletons

Mirror the existing `errorBus` / `ErrorModalHost` pattern (`lib/error-ui`, mounted at `app/_layout.tsx:267`). Both mount once, right after `<ErrorModalHost />`, inside the providers and above the `Stack`. They overlay any screen; they do **not** reflow layout.

- **`ConnectionPillHost`** (`components/connection/ConnectionPillHost.tsx`) — reads `useConnection()`, renders `ConnectionPill`. Mounts unconditionally; the pill self-hides when `online` (except the ~2s recovery flash).
- **`CantLoadModalHost`** (`components/connection/CantLoadModalHost.tsx`) — driven by a new `cantLoadBus` (`lib/connection-ui.ts`, a copy of `lib/error-ui`'s bus). Any screen / the `useOfflineGuard` helper can raise it.

### 3.3 Cold-start offline — `components/connection/OfflineBootGate.tsx`

Wraps the `Stack`. Renders the full-screen `OfflineScreen` instead of app content when:

```ts
connection === "offline" && !convex.connectionState().hasEverConnected
```

Clerk restores auth from `tokenCache` (secure-store) offline, but Convex data can't hydrate — so even a signed-in user cold-starting with no wifi correctly sees the Offline page until the socket connects, then it unmounts and the app renders normally. `OfflineScreen`'s Retry forces a reconnect attempt.

**No startup flash:** the gate keys on `connection === "offline"`, **not** on raw `!isWebSocketConnected`. A normal (online) cold start is `reconnecting` for the brief pre-socket window — never `offline` — so `OfflineScreen` does not flash during healthy startup. It appears only once the signal resolves to a true `offline` (NetInfo down or backoff ceiling exceeded). `hasEverConnected` resets to `false` on every fresh client instance (each app launch), so it's a reliable cold-start tell.

### 3.4 Never-cached navigation — `hooks/useOfflineGuard.ts`

A screen passes its primary Convex query result in:

```ts
useOfflineGuard(query); // query === undefined means "not resolved this session"
```

Logic: if `query === undefined` **and** `connection === "offline"` → fire `cantLoadBus`. Because cache = session-only, "undefined while offline" reliably means "never cached." The modal's **"Dismiss · back to last page"** calls `router.back()` to the last cached screen.

**Pass A wires this into the primary uncached-data entry points:** map / shop results, booking-flow entry, search. (Remaining screens: follow-up sweep.)

### 3.5 Write-gating — Pass A gates the two highest-value writes

Gate on `useCanWrite()`. Disabled controls show an inline reason; the tap never fires and fails.

- **Booking confirm** — `components/booking/footers/ConfirmationFooter.tsx`:
  - `!canWrite` → primary CTA disabled (`#E5E7EB` bg, `#9CA3AF` text) + inline `wifi-off` **"You'll need a connection to book"** (`#92400E`).
  - Request failed → re-enable as **"Try again"** + error note **"The slot wasn't held — nothing was booked"** (`#DC2626`). Never imply a partial/queued booking.
- **Oto send** — `components/ai-chat/AIInputBox.tsx`:
  - `offline` → input + send disabled, placeholder **"Reconnect to chat with Oto"**, note **"Oto needs a connection to reply"**. Oto never fakes/queues a reply.

---

## 4. Visual spec (pill + modal)

### 4.1 ConnectionPill

Floats below the header, horizontally centered, over page content — must **not** overlap the logo/greeting. Anchored to safe-area top + header height; `zIndex` above content, below modals.

| State | Leading | Label | Trailing |
|-------|---------|-------|----------|
| `reconnecting` | amber dot, pulsing (`#D97706`) | "Reconnecting…" | — |
| `offline` | solid red dot (`#DC2626`) | "No connection" | 1px hairline (`rgba(20,28,36,0.14)`) + **Retry** text action (`#1D4ED8`) |
| `online` (recovery) | green check (`#059669`) | "Back online" | — |

- **Retry** is a text action, **not** a filled oval. Tapping forces a Convex reconnect attempt.
- `online` pill appears only as a ~2s recovery confirmation, then auto-dismisses (slide/fade). Debounced so connection flaps don't re-trigger it.
- Motion: spring in (damping ~15, stiffness ~250), fade/slide out 200ms; dot pulse ≈ 1.2s ease-in-out loop. Nothing else animates.

### 4.2 Glass look

- **React Native:** wrap in `expo-blur` `<BlurView>` (`intensity≈40`, `tint="light"`) + translucent white overlay (`rgba(255,255,255,0.3)`) + specular top-edge highlight. `expo-blur` is **already installed** (`~55.0.14`).
- **Fallback** (blur unavailable): solid `backgroundColor: rgba(255,255,255,0.92)` so text stays legible; hide the specular sheen so it never looks like a stray line.
- Always render the pill over content (hero/map), never over flat gray.

### 4.3 CantLoadModal

- Centered card over a dimmed scrim (`rgba(20,28,36,0.45)`); app stays mounted underneath.
- Content: `wifi-off` icon tile → **"Can't load this right now"** → **"This needs a connection — we'll load it as soon as you're back online."**
- Primary: **Retry** (re-attempts the request).
- Secondary (**keep exactly**): **"Dismiss · back to last page"** — required escape hatch, backs the user to the last cached screen.

### 4.4 Copy reference (final, on-voice)

Sentence case, second person, no emoji, connectivity = `wifi-off` icon (never `cloud-off`).

- Reconnecting: **"Reconnecting…"**
- Offline pill: **"No connection"** / **"Retry"**
- Recovery: **"Back online"**
- Can't-load modal: **"Can't load this right now"** / **"This needs a connection — we'll load it as soon as you're back online."** / **"Dismiss · back to last page"**
- Booking blocked: **"You'll need a connection to book"**
- Booking failed: **"The slot wasn't held — nothing was booked"**
- Oto blocked: **"Reconnect to chat with Oto"** / **"Oto needs a connection to reply"**
- Reads (deferred sweep): **"Showing your last synced info"** / **"Last synced HH:MM"**

---

## 5. Files

**New:**
- `hooks/useConnection.ts` — signal hook + `deriveConnState` + `useCanWrite`
- `hooks/useOfflineGuard.ts` — never-cached → modal helper
- `lib/connection-ui.ts` — `cantLoadBus` (copy of `lib/error-ui`)
- `components/connection/ConnectionPill.tsx`
- `components/connection/ConnectionPillHost.tsx`
- `components/connection/CantLoadModal.tsx`
- `components/connection/CantLoadModalHost.tsx`
- `components/connection/OfflineScreen.tsx`
- `components/connection/OfflineBootGate.tsx`

**Touched:**
- `app/_layout.tsx` — mount the two hosts + wrap `Stack` in `OfflineBootGate`
- `components/booking/footers/ConfirmationFooter.tsx` — write-gate
- `components/ai-chat/AIInputBox.tsx` — write-gate
- `package.json` — add `@react-native-community/netinfo`

---

## 6. Pass A scope vs. deferred sweep

**Pass A delivers:** `useConnection`/`useCanWrite` + NetInfo dep; `ConnectionPill` (global); `CantLoadModal` + `useOfflineGuard` on map/booking/search; `OfflineBootGate` + `OfflineScreen`; write-gating on booking-confirm + Oto-send.

**Deferred to the follow-up sweep (explicit):**
- Write-gating on reschedule / payment / vehicle-edits / other forms.
- The "Showing your last synced info" + "Last synced HH:MM" view-only strip and lock-glyphs on read affordances (Reschedule, edit).
- `useOfflineGuard` on the remaining data-driven screens.

---

## 7. Edge cases / error handling

- `reconnecting → offline` matches Convex's backoff ceiling, not a fixed timer.
- "Back online" shows once (~2s) and doesn't re-trigger on flaps.
- Retry (pill + modal + failed CTA) forces a real reconnect / re-request.
- No write path is reachable while `offline` (Pass A: booking, Oto send).
- Failed booking leaves **nothing** booked and says so.
- Glass falls back to a legible opaque pill where blur is unsupported; sheen hidden.
- `CantLoadModal` Dismiss returns to the last cached screen, not a blank.
- Every connectivity affordance uses `wifi-off`, never `cloud-off`.

**Open implementation detail (resolve in the plan, not the spec):** Convex auto-reconnects with backoff but does not expose an obvious public `forceReconnect()`. "Retry" will use whatever reconnect hook the client offers, or re-issue the stuck query to prompt reconnection. Verify the exact mechanism when writing the plan.

---

## 8. Testing / QA

**Unit:** `deriveConnState(cs, net)` across the `ConnectionState` × NetInfo matrix (online / socket-down-within-ceiling / socket-down-past-ceiling / no-network).

**Manual (spec §6 checklist):**
- [ ] Pill never overlaps the header logo/greeting on any screen or notch size.
- [ ] `reconnecting → offline` transition matches Convex backoff ceiling.
- [ ] "Back online" shows once, ~2s, auto-dismisses; doesn't re-trigger on flaps.
- [ ] Retry (pill + failed CTA + modal) forces a real reconnect/re-request.
- [ ] No write path reachable while `offline` (booking, Oto send).
- [ ] Failed booking leaves nothing booked and says so.
- [ ] Glass falls back to a legible opaque pill where blur is unsupported; sheen hidden.
- [ ] `CantLoadModal` Dismiss returns to the last cached screen, not a blank.
- [ ] Cold-start in airplane mode → `OfflineScreen`, not a modal; recovers on reconnect.
- [ ] Navigate to an uncached screen while offline → `CantLoadModal`; Dismiss → previous page.
- [ ] Every connectivity affordance uses `wifi-off`, never `cloud-off`.
