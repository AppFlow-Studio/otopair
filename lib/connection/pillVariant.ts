/**
 * Pure pill-variant decision. NO React / native imports — imported directly by
 * Vitest (edge-runtime), same as deriveConnState.ts.
 */
import type { ConnState } from "./deriveConnState";

export type PillVariant = "reconnecting" | "offline" | "recovering";

/** Whether this launch started with a valid session cache (see useBootCacheStatus). */
export type BootCacheStatus = "checking" | "valid" | "none";

/**
 * Whether the pill may render before the app has connected once this launch.
 *
 * Normally it stays hidden then, for two reasons: OfflineBootGate's full-screen
 * OfflineScreen already says "You're offline", and a healthy start briefly
 * reads as `reconnecting`, which would flash a pill on every launch. The
 * exception is the cached offline mode: a cold start with no network but a
 * valid session cache boots straight into the app, nothing full-screen covers
 * it, and without the pill nothing tells the user their data is from their
 * last visit or why actions are disabled. Only a genuine `offline` qualifies —
 * never `reconnecting` — so healthy starts stay quiet.
 */
export function isPillAllowedBeforeFirstConnect(args: {
  conn: ConnState;
  bootCache: BootCacheStatus;
}): boolean {
  return args.bootCache === "valid" && args.conn === "offline";
}

/**
 * Which connection pill to show, or `null` for none.
 *
 * `retrying` is a transient flag the host raises when the user taps Retry: we
 * surface "Reconnecting…" for immediate feedback rather than leaving the pill
 * silently on "No connection". Once we're actually back online the recovery
 * flash takes over, so a live connection is never masked by a pending retry.
 */
export function computePillVariant(args: {
  conn: ConnState;
  showRecovery: boolean;
  retrying: boolean;
}): PillVariant | null {
  const { conn, showRecovery, retrying } = args;
  // A tapped Retry shows "Reconnecting…" for feedback — unless we've already
  // reconnected, in which case the recovery flash below wins.
  if (retrying && conn !== "online") return "reconnecting";
  if (conn === "reconnecting") return "reconnecting";
  if (conn === "offline") return "offline";
  if (conn === "online" && showRecovery) return "recovering";
  return null;
}
