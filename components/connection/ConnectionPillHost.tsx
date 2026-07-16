/**
 * ConnectionPillHost — app-shell singleton. Reads useConnection(), maps it to a
 * pill variant, and owns the ~2s "Back online" recovery flash. Renders nothing
 * when steady-online, and nothing until the app has connected at least once —
 * cold-start reconnect/offline is owned by OfflineBootGate (the full-screen
 * OfflineScreen), so the pill must not double up on it.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConnection, useHasEverConnected, nudgeReconnect } from "@/hooks/useConnection";
import type { ConnState } from "@/lib/connection/deriveConnState";
import { computePillVariant } from "@/lib/connection/pillVariant";
import { ConnectionPill } from "./ConnectionPill";

const RECOVERY_MS = 2000;
// How long a tapped Retry shows "Reconnecting…" before falling back to
// "No connection" if the socket didn't come back. Roughly matches the
// OfflineScreen's "Connecting…" feedback window.
const RETRY_FEEDBACK_MS = 2500;

export function ConnectionPillHost() {
  const conn = useConnection();
  // Convex 1.42 removed connectionState().hasEverConnected — use our tracker.
  const hasEverConnected = useHasEverConnected();
  const insets = useSafeAreaInsets();
  const [showRecovery, setShowRecovery] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const prevConn = useRef<ConnState | null>(null);

  useEffect(() => {
    // Until the socket has connected once, OfflineBootGate owns the screen.
    // Don't track transitions or flash recovery here — avoids a duplicate
    // "No connection" at cold start and a spurious "Back online" on first connect.
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

  // Clear the transient "Reconnecting…" feedback: immediately once we're online,
  // otherwise after a bounded window so a retry that didn't restore the socket
  // falls back to "No connection" instead of spinning forever.
  useEffect(() => {
    if (!retrying) return;
    if (conn === "online") {
      setRetrying(false);
      return;
    }
    const t = setTimeout(() => setRetrying(false), RETRY_FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [retrying, conn]);

  // Retry: actually re-probe the network AND show "Reconnecting…" right away so
  // the tap has visible feedback even when we're still offline.
  const handleRetry = useCallback(() => {
    nudgeReconnect();
    setRetrying(true);
  }, []);

  // Cold-start phase: the full-screen OfflineScreen covers this; the pill stays
  // out of the way until we've connected at least once.
  if (!hasEverConnected) return null;

  const variant = computePillVariant({ conn, showRecovery, retrying });
  if (!variant) return null;

  return (
    <View
      style={[styles.anchor, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <ConnectionPill variant={variant} onRetry={handleRetry} />
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
