import type { ConnState } from "./deriveConnState";

/**
 * Decide whether the "Can't load this right now" modal should show.
 *
 * Cache is session-only (Convex in-memory), so an unresolved query
 * (`data === undefined`) while `offline` reliably means "never cached this
 * session." We wait until `offline` — not `reconnecting` — so a brief socket
 * blip on a slow-but-online screen never throws the modal.
 */
export function shouldShowCantLoad(args: {
  queryUnresolved: boolean;
  conn: ConnState;
}): boolean {
  return args.queryUnresolved && args.conn === "offline";
}
