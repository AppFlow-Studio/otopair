/**
 * OfflineBootGate — renders the full-screen OfflineScreen when the app opens
 * offline with nothing cached, else renders children. Keys on `offline` (never
 * raw !isWebSocketConnected) so a healthy startup — which is briefly
 * `reconnecting` — does NOT flash the offline page. `useHasEverConnected()`
 * resets to false on each app launch, so it's a reliable cold-start tell.
 * (Convex 1.42 removed connectionState().hasEverConnected — we track our own.)
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
import React, { type ReactNode } from "react";

import { useConnection, useHasEverConnected, nudgeReconnect } from "@/hooks/useConnection";
import { OfflineScreen } from "./OfflineScreen";

interface OfflineBootGateProps {
  children: ReactNode;
  /** RootLayout's fonts-loaded (or errored) signal; gates the offline page. */
  fontsReady: boolean;
}

export function OfflineBootGate({ children, fontsReady }: OfflineBootGateProps) {
  const conn = useConnection();
  const hasEverConnected = useHasEverConnected();

  if (fontsReady && conn === "offline" && !hasEverConnected) {
    return <OfflineScreen onRetry={nudgeReconnect} />;
  }
  return <>{children}</>;
}
