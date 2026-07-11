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
