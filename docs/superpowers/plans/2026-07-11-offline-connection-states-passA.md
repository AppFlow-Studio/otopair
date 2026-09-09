# Offline & Connection States (Pass A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OtoPair's offline/connection-states system — a single connection signal, a floating status pill, a never-cached "can't load" modal, a cold-start offline page, and write-gating on the two highest-value writes (booking-confirm + Oto-send).

**Architecture:** One hook (`useConnection`) derives `online | reconnecting | offline` from Convex's `connectionState()` + NetInfo; every surface reads it. Two app-shell singleton hosts (pill + modal) mirror the existing `errorBus`/`ErrorModalHost` pattern. A root gate renders a full-screen offline page on cold-start-offline. Writes are disabled *before* commit with an inline reason. Pure decision logic is extracted into native-import-free modules so Vitest can test it in the `edge-runtime` environment.

**Tech Stack:** React Native 0.83 / Expo 55, Convex 1.31.6 (`connectionState()` + `subscribeToConnectionState()`), `@react-native-community/netinfo` (new dep), `expo-blur` (installed), reanimated, Vitest (`tests/**/*.test.ts`, `edge-runtime`).

**Spec:** `docs/superpowers/specs/2026-07-11-offline-connection-states-design.md`

**Branch:** `waleed/oto-warning-lights-health-fixes`

---

## File Structure

**New — pure logic (Vitest-testable, no React/native imports):**
- `lib/connection/deriveConnState.ts` — `ConnState` type, `ConnSignal` input, `deriveConnState()`, `RECONNECT_FAILURE_CEILING`
- `lib/connection/offlineGuard.ts` — `shouldShowCantLoad()`
- `tests/connection/deriveConnState.test.ts`
- `tests/connection/offlineGuard.test.ts`

**New — React:**
- `hooks/useConnection.ts` — `useConnection()`, `useCanWrite()`, `nudgeReconnect()`
- `hooks/useOfflineGuard.ts` — never-cached → modal helper
- `lib/connection-ui.tsx` — `cantLoadBus` + `CantLoadModalHost` (mirrors `lib/error-ui.tsx`)
- `components/connection/ConnectionPill.tsx` — presentational pill
- `components/connection/ConnectionPillHost.tsx` — reads `useConnection()`, owns the ~2s recovery flash
- `components/connection/CantLoadModal.tsx` — presentational modal (mirrors `ErrorOccurredModal`)
- `components/connection/OfflineScreen.tsx` — full-screen offline page
- `components/connection/OfflineBootGate.tsx` — cold-start gate

**Modified:**
- `package.json` — `@react-native-community/netinfo`
- `app/_layout.tsx` — add `SafeAreaProvider`, mount two hosts, wrap `Stack` in `OfflineBootGate`
- `app/settings/past-service/[bookingId].tsx` — `useOfflineGuard` anchor (+ any further query-driven detail screens per Task 8 criteria)
- `app/booking/mechanic/[id]/payment.tsx` — gate confirm + wallet CTAs
- `app/(main-tabs)/ai-chat/index.tsx` — gate Oto send

**Design-system tokens (use these, no new hardcoded hex):** `SemanticColors.warningAmber` `#D97706`, `SemanticColors.errorRed` `#DC2626`, `SemanticColors.successGreen` `#059669`, `SemanticColors.primaryBlueDark` `#1D4ED8`, `SemanticColors.textDisabled` `#9CA3AF`, `SemanticColors.textMuted` `#6B7280`, all from `@/constants/theme`. Booking-blocked amber text `#92400E` is a one-off literal (not in the token set).

---

## Task 0: Add the NetInfo dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install via Expo (pins an SDK-55-compatible version)**

Run: `npx expo install @react-native-community/netinfo`
Expected: `package.json` gains `"@react-native-community/netinfo"` under `dependencies`; install completes without peer-dep errors.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require.resolve('@react-native-community/netinfo'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(offline): add @react-native-community/netinfo for connection detection"
```

---

## Task 1: Pure connection-state derivation (TDD)

The core of the whole feature: a pure function mapping a connection signal to `online | reconnecting | offline`. No React, no native modules — so Vitest runs it in `edge-runtime`.

**Files:**
- Create: `lib/connection/deriveConnState.ts`
- Test: `tests/connection/deriveConnState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/connection/deriveConnState.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { deriveConnState } from "@/lib/connection/deriveConnState";

describe("deriveConnState", () => {
  it("is online whenever the websocket is connected", () => {
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 0, netReachable: true }),
    ).toBe("online");
  });

  it("stays online even if NetInfo reports no network (socket wins)", () => {
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 9, netReachable: false }),
    ).toBe("online");
  });

  it("is reconnecting on a healthy startup (socket down, no retries, NetInfo unresolved)", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 0, netReachable: null }),
    ).toBe("reconnecting");
  });

  it("is reconnecting while retries are within the ceiling and a network exists", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 2, netReachable: true }),
    ).toBe("reconnecting");
  });

  it("is offline immediately when the device has no network", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 0, netReachable: false }),
    ).toBe("offline");
  });

  it("is offline once the reconnect ceiling is exceeded", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 4, netReachable: true }),
    ).toBe("offline");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/connection/deriveConnState.test.ts`
Expected: FAIL — cannot resolve `@/lib/connection/deriveConnState` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/connection/deriveConnState.ts`:

```ts
/**
 * Pure connection-state derivation. NO React / native imports — this file is
 * imported by Vitest (edge-runtime) directly. See vitest.config.ts.
 */

export type ConnState = "online" | "reconnecting" | "offline";

export interface ConnSignal {
  /** convex.connectionState().isWebSocketConnected */
  isWebSocketConnected: boolean;
  /** convex.connectionState().connectionRetries — failed reconnect attempts. */
  connectionRetries: number;
  /**
   * Device reachability from NetInfo (`isInternetReachable ?? isConnected`).
   * `null` = NetInfo hasn't resolved yet; treat as "might have a network" so a
   * healthy cold start reads as `reconnecting`, never a false `offline` flash.
   */
  netReachable: boolean | null;
}

/** Failed reconnect attempts we tolerate before calling it `offline`. */
export const RECONNECT_FAILURE_CEILING = 3;

export function deriveConnState(s: ConnSignal): ConnState {
  // Socket up → online, unconditionally.
  if (s.isWebSocketConnected) return "online";
  // Device says there is definitively no network → offline right away.
  if (s.netReachable === false) return "offline";
  // Socket down but a network exists (or NetInfo is still unresolved): let
  // Convex's backoff run and call it reconnecting until the ceiling.
  if (s.connectionRetries <= RECONNECT_FAILURE_CEILING) return "reconnecting";
  // Backoff ceiling exceeded → stop pretending, call it offline.
  return "offline";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/connection/deriveConnState.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/connection/deriveConnState.ts tests/connection/deriveConnState.test.ts
git commit -m "feat(offline): pure connection-state derivation + tests"
```

---

## Task 2: Never-cached guard decision (TDD)

**Files:**
- Create: `lib/connection/offlineGuard.ts`
- Test: `tests/connection/offlineGuard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/connection/offlineGuard.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { shouldShowCantLoad } from "@/lib/connection/offlineGuard";

describe("shouldShowCantLoad", () => {
  it("fires when an unresolved query is stuck offline", () => {
    expect(shouldShowCantLoad({ queryUnresolved: true, conn: "offline" })).toBe(true);
  });

  it("does not fire once the query has resolved (data is cached)", () => {
    expect(shouldShowCantLoad({ queryUnresolved: false, conn: "offline" })).toBe(false);
  });

  it("does not fire while online, even if the query is still loading", () => {
    expect(shouldShowCantLoad({ queryUnresolved: true, conn: "online" })).toBe(false);
  });

  it("does not fire while reconnecting (give the socket a chance)", () => {
    expect(shouldShowCantLoad({ queryUnresolved: true, conn: "reconnecting" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/connection/offlineGuard.test.ts`
Expected: FAIL — cannot resolve `@/lib/connection/offlineGuard`.

- [ ] **Step 3: Write the implementation**

Create `lib/connection/offlineGuard.ts`:

```ts
import type { ConnState } from "./deriveConnState";

/**
 * Decide whether the "Can't load this right now" modal should show.
 *
 * Cache is session-only (Convex in-memory), so an unresolved query
 * (`data === undefined`) while `offline` reliably means "never cached this
 * session." We wait until `offline` — not `reconnecting` — so a brief socket
 * blip on a slow-but-online screen never throws the modal.
 */
export function shouldShowCantLoad(args: {
  queryUnresolved: boolean;
  conn: ConnState;
}): boolean {
  return args.queryUnresolved && args.conn === "offline";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/connection/offlineGuard.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/connection/offlineGuard.ts tests/connection/offlineGuard.test.ts
git commit -m "feat(offline): never-cached guard decision + tests"
```

---

## Task 3: `useConnection` / `useCanWrite` / `nudgeReconnect` hook

Wires the pure function to live Convex + NetInfo. **Uses a manual subscription (not `useSyncExternalStore`)** because `convex.connectionState()` returns a fresh object each call — a `useSyncExternalStore` getSnapshot would loop. We store the *derived string* in state, so React bails out of re-renders when it's unchanged (same pattern as `lib/error-ui.tsx`).

**Files:**
- Create: `hooks/useConnection.ts`

- [ ] **Step 1: Write the hook**

Create `hooks/useConnection.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { useConvex } from "convex/react";
import NetInfo, { useNetInfo } from "@react-native-community/netinfo";

import { deriveConnState, type ConnState } from "@/lib/connection/deriveConnState";

/**
 * App-wide connection signal. Every offline surface reads THIS — no component
 * calls NetInfo or convex.connectionState() directly.
 */
export function useConnection(): ConnState {
  const convex = useConvex();
  const net = useNetInfo();
  const netReachable = net.isInternetReachable ?? net.isConnected;

  const compute = useCallback((): ConnState => {
    const cs = convex.connectionState();
    return deriveConnState({
      isWebSocketConnected: cs.isWebSocketConnected,
      connectionRetries: cs.connectionRetries,
      netReachable,
    });
  }, [convex, netReachable]);

  const [state, setState] = useState<ConnState>(compute);

  useEffect(() => {
    // Re-evaluate now (netReachable may have changed) and on every Convex
    // connection-state change. setState with an identical string is a no-op
    // re-render (React bails via Object.is), so this is cheap.
    setState(compute());
    const unsubscribe = convex.subscribeToConnectionState(() => setState(compute()));
    return unsubscribe;
  }, [convex, compute]);

  return state;
}

/** Write-gate primitive: only `online` may reach the backend. */
export function useCanWrite(): boolean {
  return useConnection() === "online";
}

/**
 * "Retry" mechanism. Convex 1.31.6 exposes no public forceReconnect(); it
 * auto-reconnects with backoff once the network returns. NetInfo.refresh()
 * forces a fresh reachability probe, which is what unblocks the socket after
 * the device regains a connection. Safe to call from any Retry affordance.
 */
export function nudgeReconnect(): void {
  void NetInfo.refresh();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `hooks/useConnection.ts`.

- [ ] **Step 3: Commit**

```bash
git add hooks/useConnection.ts
git commit -m "feat(offline): useConnection/useCanWrite/nudgeReconnect hook"
```

---

## Task 4: `ConnectionPill` (presentational)

Three visual states driven entirely by a `variant` prop. Glass = `expo-blur` `BlurView` over a solid fallback fill; the specular sheen is a top-edge strip. Colored dot + label; `offline` adds a hairline + blue **Retry** text action. Pulsing dot for `reconnecting`.

**Files:**
- Create: `components/connection/ConnectionPill.tsx`

- [ ] **Step 1: Write the component**

Create `components/connection/ConnectionPill.tsx`:

```tsx
/**
 * ConnectionPill — floating glass status pill. Presentational only; the host
 * (ConnectionPillHost) decides which variant to show and when.
 */
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { BrandColors, SemanticColors } from "@/constants/theme";

export type PillVariant = "reconnecting" | "offline" | "recovering";

interface ConnectionPillProps {
  variant: PillVariant;
  /** Only used by the `offline` variant's Retry action. */
  onRetry?: () => void;
}

const DOT_COLOR: Record<PillVariant, string> = {
  reconnecting: SemanticColors.warningAmber, // #D97706
  offline: SemanticColors.errorRed, // #DC2626
  recovering: SemanticColors.successGreen, // #059669
};

const LABEL: Record<PillVariant, string> = {
  reconnecting: "Reconnecting…",
  offline: "No connection",
  recovering: "Back online",
};

function PulsingDot({ color, pulse }: { color: string; pulse: boolean }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (pulse) {
      opacity.value = withRepeat(
        withTiming(0.35, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = 1;
    }
  }, [pulse, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function ConnectionPill({ variant, onRetry }: ConnectionPillProps) {
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(15).stiffness(250)}
      exiting={FadeOutUp.duration(200)}
      style={styles.wrapper}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {/* Solid fallback fill sits under the blur so text stays legible where
            backdrop blur is unsupported. */}
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
        {/* Specular top-edge sheen. */}
        <View style={styles.sheen} pointerEvents="none" />
        <View style={styles.row}>
          <PulsingDot color={DOT_COLOR[variant]} pulse={variant === "reconnecting"} />
          <Text size="sm" weight="semiBold" color={BrandColors.primary}>
            {LABEL[variant]}
          </Text>
          {variant === "offline" && onRetry ? (
            <>
              <View style={styles.hairline} />
              <Pressable onPress={onRetry} hitSlop={8}>
                <Text size="sm" weight="bold" color={SemanticColors.primaryBlueDark}>
                  Retry
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", width: "100%" },
  pill: {
    flexDirection: "row",
    borderRadius: 9999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.92)", // fallback fill
    shadowColor: "#141C24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hairline: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(20,28,36,0.14)",
    marginHorizontal: 2,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `ConnectionPill.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/connection/ConnectionPill.tsx
git commit -m "feat(offline): ConnectionPill presentational component"
```

---

## Task 5: `ConnectionPillHost` + mount in the app shell

Owns the mapping from `useConnection()` to a pill variant, plus the ~2s **recovery flash**: when the state transitions from a non-online state to `online`, show `recovering` for 2s, then hide. Debounced so flaps don't re-trigger.

**Files:**
- Create: `components/connection/ConnectionPillHost.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write the host**

Create `components/connection/ConnectionPillHost.tsx`:

```tsx
/**
 * ConnectionPillHost — app-shell singleton. Reads useConnection(), maps it to a
 * pill variant, and owns the ~2s "Back online" recovery flash. Renders nothing
 * when steady-online.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";

import { useConnection, nudgeReconnect } from "@/hooks/useConnection";
import type { ConnState } from "@/lib/connection/deriveConnState";
import { ConnectionPill, type PillVariant } from "./ConnectionPill";

const RECOVERY_MS = 2000;

export function ConnectionPillHost() {
  const conn = useConnection();
  const convex = useConvex();
  const hasEverConnected = convex.connectionState().hasEverConnected;
  const insets = useSafeAreaInsets();
  const [showRecovery, setShowRecovery] = useState(false);
  const prevConn = useRef<ConnState | null>(null);

  useEffect(() => {
    // Until the socket has connected once, OfflineBootGate owns the screen
    // (full-screen OfflineScreen on cold-start-offline). Don't track
    // transitions or flash recovery here — avoids a duplicate "No connection"
    // at cold start and a spurious "Back online" on the first connect.
    if (!hasEverConnected) {
      prevConn.current = null;
      return;
    }
    const was = prevConn.current;
    prevConn.current = conn;
    // Flash recovery only for a genuine mid-session drop→online (was is a real
    // prior non-online state, not the initial null).
    if (conn === "online" && was != null && was !== "online") {
      setShowRecovery(true);
      const t = setTimeout(() => setShowRecovery(false), RECOVERY_MS);
      return () => clearTimeout(t);
    }
    if (conn !== "online") setShowRecovery(false);
  }, [conn, hasEverConnected]);

  // Cold-start phase: the full-screen OfflineScreen covers this; the pill stays
  // out of the way until we've connected at least once.
  if (!hasEverConnected) return null;

  let variant: PillVariant | null = null;
  if (conn === "reconnecting") variant = "reconnecting";
  else if (conn === "offline") variant = "offline";
  else if (conn === "online" && showRecovery) variant = "recovering";

  if (!variant) return null;

  return (
    <View
      style={[styles.anchor, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <ConnectionPill variant={variant} onRetry={nudgeReconnect} />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40, // above content, below native modals
  },
});
```

- [ ] **Step 2: Wire into the app shell (SafeAreaProvider + mount)**

`ConnectionPillHost` (and `OfflineScreen` in Task 9) call `useSafeAreaInsets()` but mount ABOVE the navigator, and this app has **no root `SafeAreaProvider`** (React Navigation only provides insets *inside* screens). Add one, then mount the host.

In `app/_layout.tsx`, add these imports near the top:

```tsx
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { ConnectionPillHost } from "@/components/connection/ConnectionPillHost";
```

Wrap the `<AppErrorBoundary>` block (child of `<ConvexClerkProvider>`, opens at line 262) in a provider, and mount the host right after `<ErrorModalHost />` (line 267):

```tsx
        <ConvexClerkProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}> {/* prop is initialMetrics; the constant is initialWindowMetrics */}
            <AppErrorBoundary>
              <EnsureConvexUserRecord />
              <SyncAuthStoreWithClerk />
              <StripePaymentMethodsSync />
              <PendingDeletionSessionGuard />
              <ErrorModalHost />
              <ConnectionPillHost />
              {/* ...rest unchanged... */}
            </AppErrorBoundary>
          </SafeAreaProvider>
        </ConvexClerkProvider>
```

Close `</SafeAreaProvider>` after `</AppErrorBoundary>`. (The trailing commented-out block below it can stay as-is.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run the app (`npx expo start`), open on a device/simulator. Toggle airplane mode:
- Within ~10s the amber **"Reconnecting…"** pill appears, then flips to red **"No connection"** + Retry.
- Turn airplane mode off: pill flips to green **"Back online"** and auto-dismisses after ~2s.
- Confirm the pill is centered near the top and does not cover the home logo/greeting.

- [ ] **Step 5: Commit**

```bash
git add components/connection/ConnectionPillHost.tsx app/_layout.tsx
git commit -m "feat(offline): mount ConnectionPill app-shell host + recovery flash"
```

---

## Task 6: `CantLoadModal` (presentational)

Mirrors `ErrorOccurredModal` (same `Modal` + `BlurView` shell) but with connectivity copy, a `wifi-off` icon, and the required **"Dismiss · back to last page"** secondary.

**Files:**
- Create: `components/connection/CantLoadModal.tsx`

- [ ] **Step 1: Write the component**

Create `components/connection/CantLoadModal.tsx`:

```tsx
/**
 * CantLoadModal — shown when a screen requests data that isn't cached this
 * session and we're offline. Page-agnostic: one component covers every screen.
 * Copy is locked by the spec — do not paraphrase.
 */
import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { WifiOff } from "lucide-react-native";

import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";
import { PrimaryButton, Text } from "@/components/shared-ui";

interface CantLoadModalProps {
  visible: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function CantLoadModal({ visible, onRetry, onDismiss }: CantLoadModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <WifiOff size={32} color={BrandColors.primary} />
          </View>

          <Text size="xl" weight="bold" color={BrandColors.primary} style={styles.title}>
            Can&apos;t load this right now
          </Text>

          <Text size="sm" weight="regular" color="#6B7280" style={styles.description}>
            This needs a connection — we&apos;ll load it as soon as you&apos;re back online.
          </Text>

          <View style={styles.buttonColumn}>
            <PrimaryButton style={styles.retryButton} onPress={onRetry}>
              <Text size="md" weight="semiBold" color={BrandColors.white}>
                Retry
              </Text>
            </PrimaryButton>

            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.7}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Dismiss · back to last page
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 28, 36, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  container: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.lg,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    ...Shadows.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: { textAlign: "center", marginBottom: Spacing.md },
  description: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  buttonColumn: { width: "100%", gap: Spacing.md },
  retryButton: { borderRadius: BorderRadius.lg, paddingVertical: Spacing.md },
  dismissButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/connection/CantLoadModal.tsx
git commit -m "feat(offline): CantLoadModal presentational component"
```

---

## Task 7: `cantLoadBus` + `CantLoadModalHost`

The global bus + host, mirroring `lib/error-ui.tsx`. Dismiss backs out to the last cached screen (`router.back()`); Retry nudges a reconnect and hides the modal (the screen's `useOfflineGuard` re-raises it if still offline).

**Files:**
- Create: `lib/connection-ui.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write the bus + host**

Create `lib/connection-ui.tsx`:

```tsx
/**
 * cantLoadBus + CantLoadModalHost. Mirrors lib/error-ui.tsx: a module-level
 * listener list + a bus object + a host that subscribes and renders the modal.
 */
import React from "react";
import { useRouter } from "expo-router";

import { nudgeReconnect } from "@/hooks/useConnection";
import { CantLoadModal } from "@/components/connection/CantLoadModal";

export type CantLoadState = { visible: boolean };

const listeners: Array<() => void> = [];

export const cantLoadBus: {
  state: CantLoadState;
  set: (s: Partial<CantLoadState>) => void;
} = {
  state: { visible: false },
  set(s) {
    Object.assign(this.state, s);
    listeners.forEach((l) => l());
  },
};

export function CantLoadModalHost() {
  const router = useRouter();
  const [state, setState] = React.useState<CantLoadState>(() => ({ ...cantLoadBus.state }));

  React.useEffect(() => {
    const sync = () => setState({ ...cantLoadBus.state });
    listeners.push(sync);
    return () => {
      const i = listeners.indexOf(sync);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);

  const handleDismiss = () => {
    cantLoadBus.set({ visible: false });
    if (router.canGoBack()) router.back();
  };

  const handleRetry = () => {
    nudgeReconnect();
    cantLoadBus.set({ visible: false });
  };

  return <CantLoadModal visible={state.visible} onRetry={handleRetry} onDismiss={handleDismiss} />;
}
```

- [ ] **Step 2: Mount in the app shell**

In `app/_layout.tsx`, add the import:

```tsx
import { CantLoadModalHost } from "@/lib/connection-ui";
```

Mount it right after `<ConnectionPillHost />`:

```tsx
            <ConnectionPillHost />
            <CantLoadModalHost />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/connection-ui.tsx app/_layout.tsx
git commit -m "feat(offline): cantLoadBus + CantLoadModalHost app-shell singleton"
```

---

## Task 8: `useOfflineGuard` + wire into uncached-data entry points

The per-screen helper. A screen passes whether its primary query is still unresolved; when that's true and we're offline, raise the modal.

**Files:**
- Create: `hooks/useOfflineGuard.ts`
- Modify: `app/settings/past-service/[bookingId].tsx` (verified query-driven anchor), plus any additional query-driven detail screens per the Step 2 criteria

> **Scope refinement (found during self-review):** the guard keys on a Convex `useQuery(...)` returning `undefined`. The map/search surfaces the spec listed are **Zustand-store-driven** (`useShopStore`), so they don't fit this mechanism — they degrade to view-only via cached store state + the pill, which is consistent with the spec's core principle. The guard applies to **query-driven detail screens loaded fresh by id** (receipts, booking details, estimates), which is where "navigated fresh while offline → never cached" actually happens (e.g. from a notification deep-link).

- [ ] **Step 1: Write the hook**

Create `hooks/useOfflineGuard.ts`:

```ts
import { useEffect } from "react";

import { useConnection } from "@/hooks/useConnection";
import { shouldShowCantLoad } from "@/lib/connection/offlineGuard";
import { cantLoadBus } from "@/lib/connection-ui";

/**
 * Raise the "Can't load this right now" modal when a screen's primary data was
 * never cached this session and we're offline.
 *
 * @param queryResult the useQuery(...) result for the screen's primary data.
 *   `undefined` means "not resolved yet".
 */
export function useOfflineGuard(queryResult: unknown): void {
  const conn = useConnection();
  const queryUnresolved = queryResult === undefined;

  useEffect(() => {
    if (shouldShowCantLoad({ queryUnresolved, conn })) {
      cantLoadBus.set({ visible: true });
    }
  }, [queryUnresolved, conn]);
}
```

- [ ] **Step 2: Wire the verified anchor screen**

Open `app/settings/past-service/[bookingId].tsx`. It already has (around line 88):

```tsx
const receipt = useQuery(api.bookings.getReceipt, { bookingId });
```

Add the import with the other hook imports, and the guard call right after that query:

```tsx
import { useOfflineGuard } from "@/hooks/useOfflineGuard";
// ...inside the component, right after the useQuery above:
useOfflineGuard(receipt);
```

**Selection criteria for any additional screens (apply, don't guess):** wire `useOfflineGuard(x)` only where `x` is a Convex `useQuery(...)` result that (a) is the screen's primary data (empty/undefined = nothing worth showing) and (b) is fetched fresh-by-id on navigation, so it can genuinely be uncached this session. Good candidates: `app/booking/mechanic/[id]/confirmation.tsx` (`api.bookings.getBookingByIdForCustomer`), `app/booking/approve-estimate/[id].tsx` (`api.bookings.getById`). Do **not** wire store-driven screens (map/search) — see the scope note above.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Cold this screen is fine online. Then: load the app online, navigate away, enable airplane mode, and navigate FRESH into the wired screen (one not visited this session). The **Can't load this right now** modal appears; **Dismiss · back to last page** returns you to the previous screen. Revisiting an already-loaded screen offline does NOT show the modal (data is cached) — it stays view-only.

- [ ] **Step 5: Commit**

```bash
git add hooks/useOfflineGuard.ts "app/settings/past-service/[bookingId].tsx"
git commit -m "feat(offline): useOfflineGuard + wire query-driven detail screens"
```

---

## Task 9: `OfflineScreen` + `OfflineBootGate` (cold-start)

**Files:**
- Create: `components/connection/OfflineScreen.tsx`
- Create: `components/connection/OfflineBootGate.tsx`
- Modify: `app/_layout.tsx`

> Depends on the `SafeAreaProvider` added in Task 5 — `OfflineScreen` uses `useSafeAreaInsets()` and `OfflineBootGate` wraps the `Stack`, which sits inside that provider.

- [ ] **Step 1: Write the full-screen offline page**

Create `components/connection/OfflineScreen.tsx`:

```tsx
/**
 * OfflineScreen — full-screen cold-start offline page (concept id 1a). Shown by
 * OfflineBootGate when the app opens with no connection and nothing cached.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";

import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";
import { PrimaryButton, Text } from "@/components/shared-ui";

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconTile}>
          <WifiOff size={40} color={BrandColors.primary} />
        </View>
        <Text size="2xl" weight="bold" color={BrandColors.primary} style={styles.title}>
          No connection
        </Text>
        <Text size="md" weight="regular" color="#6B7280" style={styles.subtitle}>
          You&apos;re offline. Reconnect to load OtoPair.
        </Text>
        <PrimaryButton style={styles.retry} onPress={onRetry}>
          <Text size="md" weight="semiBold" color={BrandColors.white}>
            Retry
          </Text>
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", paddingHorizontal: Spacing["3xl"] },
  iconTile: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EAECEF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { textAlign: "center", lineHeight: 22, marginBottom: Spacing["2xl"] },
  retry: { borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing["4xl"] },
});
```

- [ ] **Step 2: Write the boot gate**

Create `components/connection/OfflineBootGate.tsx`:

```tsx
/**
 * OfflineBootGate — renders the full-screen OfflineScreen when the app opens
 * offline with nothing cached, else renders children. Keys on `offline` (never
 * raw !isWebSocketConnected) so a healthy startup — which is briefly
 * `reconnecting` — does NOT flash the offline page. `hasEverConnected` resets to
 * false on each fresh client instance, so it's a reliable cold-start tell.
 */
import React, { type ReactNode } from "react";
import { useConvex } from "convex/react";

import { useConnection, nudgeReconnect } from "@/hooks/useConnection";
import { OfflineScreen } from "./OfflineScreen";

export function OfflineBootGate({ children }: { children: ReactNode }) {
  const conn = useConnection();
  const convex = useConvex();
  const hasEverConnected = convex.connectionState().hasEverConnected;

  if (conn === "offline" && !hasEverConnected) {
    return <OfflineScreen onRetry={nudgeReconnect} />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 3: Wrap the Stack in `app/_layout.tsx`**

Add the import:

```tsx
import { OfflineBootGate } from "@/components/connection/OfflineBootGate";
```

Wrap the `<Stack>...</Stack>` (currently opening at line 283) in `<OfflineBootGate>`:

```tsx
                <OfflineBootGate>
                  <Stack screenOptions={{ /* ...unchanged... */ }}>
                    {/* ...unchanged Stack.Screen entries... */}
                  </Stack>
                </OfflineBootGate>
```

Leave `<StatusBar style="auto" />` where it is (after the closing `</OfflineBootGate>` is fine).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Force-close the app. Enable airplane mode. Cold-launch: the **No connection** full-screen page shows (NOT a modal). Turn airplane mode off, tap **Retry** (or wait): once the socket connects, the app renders normally. Then relaunch ONLINE and confirm the offline page does NOT flash during normal startup.

- [ ] **Step 6: Commit**

```bash
git add components/connection/OfflineScreen.tsx components/connection/OfflineBootGate.tsx app/_layout.tsx
git commit -m "feat(offline): cold-start OfflineScreen + OfflineBootGate"
```

---

## Task 10: Write-gate the booking-confirm CTA

Disable the "Confirm Appointment" (saved-card) and wallet CTAs when offline, with an inline reason above the footer. This blocks the write *before* the user reaches the Stripe/`createBookingConvex` flow in `confirming.tsx`.

> **Funnel guard (added after Unit G review):** disabling the CTAs is not enough — `ErrorOccurredModal`'s `onRetry` calls `handleConfirmPayment()` directly, bypassing the button. Also add `if (!canWrite) return;` as the first line of `handleConfirmPayment` (and `canWrite` to its dep array) so every entry into the confirm→`/confirming` write path is gated. (Mid-flow drops *inside* `confirming.tsx` — e.g. `preauthorizePayment` with no timeout — remain a deferred-sweep hardening item, out of Pass A's "block up front" scope.)

**Files:**
- Modify: `app/booking/mechanic/[id]/payment.tsx`

- [ ] **Step 1: Import the gate + icon**

Add to the imports in `app/booking/mechanic/[id]/payment.tsx`:

```tsx
import { WifiOff } from "lucide-react-native";
import { useCanWrite } from "@/hooks/useConnection";
```

- [ ] **Step 2: Read the gate in the component body**

Near the other hooks at the top of the component (before `handleConfirmPayment`), add:

```tsx
const canWrite = useCanWrite();
```

- [ ] **Step 3: Gate the wallet button (currently line ~991)**

Change its `disabled` and disabled-style conditions to include `!canWrite`:

```tsx
            style={[
              styles.walletButton,
              (isSubmitting || walletPending || !canWrite) && styles.confirmButtonDisabled,
            ]}
            onPress={Platform.OS === "android" ? handleGooglePay : handleApplePay}
            activeOpacity={0.85}
            disabled={isSubmitting || walletPending || !canWrite}
```

- [ ] **Step 4: Gate the saved-card "Confirm" CTA (currently line ~1008)**

Change its `disabled` to include `!canWrite`:

```tsx
            style={styles.footerCardRow}
            onPress={handleConfirmPayment}
            activeOpacity={0.85}
            disabled={isSubmitting || !canWrite}
```

- [ ] **Step 5: Add the inline offline note above the footer content**

Immediately inside the footer `View` (currently line 982, right after `<View style={[styles.footer, ...]}>`), add:

```tsx
        {!canWrite ? (
          <View style={styles.offlineNote}>
            <WifiOff size={16} color="#92400E" />
            <Text size="sm" weight="medium" color="#92400E">
              You&apos;ll need a connection to book
            </Text>
          </View>
        ) : null}
```

Add the style to the file's `StyleSheet.create({...})`:

```tsx
  offlineNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingBottom: Spacing.sm,
  },
```

(`Text` and `Spacing` are already imported in this file — verified in use at lines ~1025 and ~982 — so no new import is needed beyond `WifiOff` + `useCanWrite` from Step 1.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual verification**

Get to the Review & Pay / payment screen online. Enable airplane mode: the confirm + wallet CTAs go disabled and the amber **"You'll need a connection to book"** note appears. You cannot start a booking. Turn airplane mode off: CTAs re-enable, note disappears.

- [ ] **Step 8: Commit**

```bash
git add "app/booking/mechanic/[id]/payment.tsx"
git commit -m "feat(offline): write-gate booking-confirm CTAs when offline"
```

---

## Task 11: Write-gate Oto send

Disable the Oto input when offline, swap the placeholder, and show a note. `AIInputBox` already supports `disabled` + `placeholder`.

> **Funnel guard (added after Unit G review):** the disabled input only covers the typed path. `handleQuickReplySelect` and `handleSuggestionPress` call the shared `sendToOtoAI` funnel directly, so quick-reply chips / suggestion tiles would still fire a write offline. Move `const canWrite = useCanWrite();` above `sendToOtoAI`, add `if (!canWrite) return;` as its first statement (and `canWrite` to its dep array). Visually disabling the chips themselves is a deferred-sweep polish item; the funnel guard is what guarantees no write reaches the backend.

**Files:**
- Modify: `app/(main-tabs)/ai-chat/index.tsx`

- [ ] **Step 1: Import the gate**

Add to the imports in `app/(main-tabs)/ai-chat/index.tsx`:

```tsx
import { useCanWrite } from "@/hooks/useConnection";
import { WifiOff } from "lucide-react-native";
```

- [ ] **Step 2: Read the gate in the component body**

Near the other hooks (before `handleSend`, ~line 616), add:

```tsx
const canWrite = useCanWrite();
```

- [ ] **Step 3: Gate the AIInputBox (currently line ~1486)**

The existing element (verified) is `<AIInputBox value={inputValue} onChangeText={setInputValue} onSend={handleSend} isLoading={isProcessing} ...>` and passes **no** `disabled` or `placeholder`. Add exactly those two props — leave every existing prop untouched:

```tsx
          <AIInputBox
            value={inputValue}
            onChangeText={setInputValue}
            onSend={handleSend}
            isLoading={isProcessing}
            disabled={!canWrite}
            placeholder={canWrite ? "Ask Oto" : "Reconnect to chat with Oto"}
            onFocus={handleInputFocus}
            /* ...all other existing props unchanged (onMicPressIn, isRecording,
               meteringValue, hasImages, etc.)... */
          />
```

`AIInputBox` already honors `disabled` (blocks the TextInput + send) and `placeholder`, so no change to that component is needed.

- [ ] **Step 4: Add the offline note above the input**

Immediately before the `<AIInputBox ...>` element, add:

```tsx
          {!canWrite ? (
            <View style={styles.otoOfflineNote}>
              <WifiOff size={14} color="#6B7280" />
              <Text size="xs" weight="regular" color="#6B7280">
                Oto needs a connection to reply
              </Text>
            </View>
          ) : null}
```

Add the style to the file's `StyleSheet.create({...})`:

```tsx
  otoOfflineNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 6,
  },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Open the Oto (AI Chat) tab online. Enable airplane mode: the input goes disabled, placeholder reads **"Reconnect to chat with Oto"**, and the **"Oto needs a connection to reply"** note shows. You cannot send. No fake/queued reply appears. Turn airplane mode off: input re-enables.

- [ ] **Step 7: Commit**

```bash
git add "app/(main-tabs)/ai-chat/index.tsx"
git commit -m "feat(offline): write-gate Oto send when offline"
```

---

## Task 12: Full-suite green + QA checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS — includes `tests/connection/deriveConnState.test.ts` and `tests/connection/offlineGuard.test.ts` (both under the `tests/**` include).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Walk the spec §6 QA checklist**

Verify each on a device:
- [ ] Pill never overlaps the header logo/greeting on any screen or notch size.
- [ ] `reconnecting → offline` matches the backoff ceiling (not a fixed timer).
- [ ] "Back online" shows once (~2s), auto-dismisses, doesn't re-trigger on flaps.
- [ ] Retry (pill + modal + failed CTA) forces a real reconnect/re-request.
- [ ] No write path reachable while `offline` (booking-confirm, Oto send).
- [ ] Cold-start airplane mode → OfflineScreen, not a modal; recovers on reconnect; no flash on healthy startup.
- [ ] Navigate to an uncached screen offline → CantLoadModal; Dismiss → previous page; cached screens stay view-only.
- [ ] Glass falls back to a legible opaque pill where blur is unsupported; sheen not a stray line.
- [ ] Every connectivity affordance uses `wifi-off`, never `cloud-off`.

- [ ] **Step 4: Commit (if any QA-driven tweaks were made)**

```bash
git add -A
git commit -m "chore(offline): QA-pass tweaks for connection states"
```

---

## Deferred to the follow-up sweep (NOT in this plan)

Per the spec §6: write-gating on reschedule / payment-methods / vehicle-edits / other forms; the "Showing your last synced info" + "Last synced HH:MM" view-only strip and lock-glyphs on read affordances; `useOfflineGuard` on the remaining data-driven screens.

**Refinement noted during Unit E:** on the past-service screen, `useOfflineGuard` was wired to `receiptData` (`api.bookings.getReceipt`) per this plan's named query. That screen's actual render-gate is `booking` (from the wrapped `useMyBookingsWithDetails()` hook), so a fresh-offline visit where the booking is cached (from the list) but the receipt is not could bounce the user. For the sweep, prefer guarding each screen's **true primary render-gate** (the value whose absence makes the screen show nothing), and confirm that value's `undefined`-while-unresolved semantics before wiring — wrapped `use[X]FromConvex` hooks may not return raw `undefined`.
