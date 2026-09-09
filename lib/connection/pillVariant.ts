/**
 * Pure pill-variant decision. NO React / native imports — imported directly by
 * Vitest (edge-runtime), same as deriveConnState.ts.
 */
import type { ConnState } from "./deriveConnState";

export type PillVariant = "reconnecting" | "offline" | "recovering";

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
