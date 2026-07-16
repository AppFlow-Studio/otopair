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
  // Device says there is definitively no network → offline right away, even if
  // the socket still claims connected. A silently-dead link (elevator, parking
  // garage, emulator airplane mode) can leave a stale-"connected" websocket for
  // minutes, and trusting it suppressed every mid-session offline surface. The
  // cost is an honest momentary "No connection" during rare NetInfo blips,
  // which beats a permanently silent pill.
  if (s.netReachable === false) return "offline";
  // Socket up (and the device isn't reporting no-network) → online.
  if (s.isWebSocketConnected) return "online";
  // Socket down but a network exists (or NetInfo is still unresolved): let
  // Convex's backoff run and call it reconnecting until the ceiling.
  if (s.connectionRetries <= RECONNECT_FAILURE_CEILING) return "reconnecting";
  // Backoff ceiling exceeded → stop pretending, call it offline.
  return "offline";
}
