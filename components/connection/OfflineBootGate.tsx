/**
 * OfflineBootGate — renders the full-screen OfflineScreen when the app opens
 * offline with nothing cached, else renders children. "Cached" is the
 * session-scoped offline cache (lib/offlineSessionCache.ts): when the saved
 * Clerk session hasn't expired and bookings/vehicle data was cached on a
 * previous online run, the app boots into it instead of the offline page.
 * Keys on `offline` (never raw !isWebSocketConnected) so a healthy startup —
 * which is briefly `reconnecting` — does NOT flash the offline page.
 * `useHasEverConnected()` resets to false on each app launch, so it's a
 * reliable cold-start tell. (Convex 1.42 removed
 * connectionState().hasEverConnected — we track our own.)
 *
 * `fontsReady` gate: this is the ONLY surface that can mount at t=0, before
 * Urbanist registers. If OfflineScreen commits its first render pre-fonts,
 * Android measures the text against the fallback font and does NOT re-measure
 * when the custom font lands — the wider glyphs draw into stale widths and the
 * last word clips ("You're |offline", "Try |again"). Waiting for `fontsReady`
 * (same signal StartupSplashGate uses to drop the native splash) means the
 * screen's first measure always uses the real font. While fonts load, children
 * render underneath the still-visible native splash exactly as before.
 */
import React, { useEffect, useState, type ReactNode } from "react";

import { useConnection, useHasEverConnected, nudgeReconnect } from "@/hooks/useConnection";
import { hasValidOfflineSessionCache } from "@/lib/offlineSessionCache";
import { OfflineScreen } from "./OfflineScreen";

interface OfflineBootGateProps {
  children: ReactNode;
  /** RootLayout's fonts-loaded (or errored) signal; gates the offline page. */
  fontsReady: boolean;
}

export function OfflineBootGate({ children, fontsReady }: OfflineBootGateProps) {
  const conn = useConnection();
  const hasEverConnected = useHasEverConnected();
  // "Do we have session-scoped cached data to show?" — checked once per
  // launch. While 'checking' (a couple ms of AsyncStorage) an offline
  // cold start renders nothing rather than flashing OfflineScreen at a
  // user whose cache is about to let them through.
  const [cacheStatus, setCacheStatus] = useState<"checking" | "valid" | "none">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;
    void hasValidOfflineSessionCache().then((valid) => {
      if (!cancelled) setCacheStatus(valid ? "valid" : "none");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (fontsReady && conn === "offline" && !hasEverConnected) {
    // Valid unexpired session cache → boot the app; the bookings and
    // car-health screens hydrate from disk and the connection pill
    // already tells the user they're offline.
    if (cacheStatus === "valid") return <>{children}</>;
    if (cacheStatus === "checking") return null;
    return <OfflineScreen onRetry={nudgeReconnect} />;
  }
  return <>{children}</>;
}
