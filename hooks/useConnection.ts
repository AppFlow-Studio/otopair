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
