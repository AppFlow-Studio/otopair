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
