/**
 * Pure recovery decision for Convex auth. NO React / native imports — imported
 * directly by Vitest, same as deriveConnState.ts.
 *
 * When Convex fails to fetch a fresh auth token — the device is offline at a
 * scheduled refresh, or it reconnects on a shaky link after the token expired —
 * its AuthenticationManager marks the session logged out ("noAuth") and never
 * asks again on its own: only a new `setAuth` call revives it. Every query then
 * runs unauthenticated, so `getMe` returns null and anything built on it reads
 * as a brand-new account — the Finish-setup card showed all four steps undone,
 * and stayed that way after the connection came back (#269). Clerk, meanwhile,
 * still has the user signed in.
 */

/** Wait between recovery attempts while Convex keeps refusing, so a permanent
 *  failure cannot become a tight re-authentication loop. */
export const CONVEX_AUTH_RETRY_MS = 10_000;

export function shouldRecoverConvexAuth({
  clerkSignedIn,
  convexLoading,
  convexAuthenticated,
  online,
}: {
  clerkSignedIn: boolean;
  /** useConvexAuth().isLoading — true while an authentication is in flight. */
  convexLoading: boolean;
  convexAuthenticated: boolean;
  /** Only retry with a live connection; offline the fetch would just fail again. */
  online: boolean;
}): boolean {
  return clerkSignedIn && !convexLoading && !convexAuthenticated && online;
}
