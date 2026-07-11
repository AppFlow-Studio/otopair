/**
 * ConnectionPillHost — app-shell singleton. Reads useConnection(), maps it to a
 * pill variant, and owns the ~2s "Back online" recovery flash. Renders nothing
 * when steady-online.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConnection, nudgeReconnect } from "@/hooks/useConnection";
import { ConnectionPill, type PillVariant } from "./ConnectionPill";

const RECOVERY_MS = 2000;

export function ConnectionPillHost() {
  const conn = useConnection();
  const insets = useSafeAreaInsets();
  const [showRecovery, setShowRecovery] = useState(false);
  const prevConn = useRef(conn);

  useEffect(() => {
    const was = prevConn.current;
    prevConn.current = conn;
    // Only flash recovery when we were genuinely disconnected and just came back.
    if (conn === "online" && was !== "online") {
      setShowRecovery(true);
      const t = setTimeout(() => setShowRecovery(false), RECOVERY_MS);
      return () => clearTimeout(t);
    }
    if (conn !== "online") setShowRecovery(false);
  }, [conn]);

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
