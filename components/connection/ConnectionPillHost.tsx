/**
 * ConnectionPillHost — app-shell singleton. Reads useConnection(), maps it to a
 * pill variant, and owns the ~2s "Back online" recovery flash. Renders nothing
 * when steady-online, and nothing until the app has connected at least once —
 * cold-start reconnect/offline is owned by OfflineBootGate (the full-screen
 * OfflineScreen), so the pill must not double up on it.
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
