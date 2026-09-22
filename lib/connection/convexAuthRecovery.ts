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

/**
 * Floor between token fetches that fail on the network. Clerk already spends
 * ~160s retrying before it throws, so this only matters if that ever changes.
 */
export const TOKEN_FETCH_RETRY_FLOOR_MS = 3_000;

/**
 * True when Clerk could not reach its servers — as opposed to reaching them and
 * being refused. Returning "no token" to Convex means "this user is logged
 * out"; a dead network says nothing of the kind, so the fetch waits instead.
 * Clerk throws ClerkRuntimeError { code: "network_error" } because the resource
 * cache in app/_layout.tsx turns on rethrowOfflineNetworkErrors.
 */
export function isTokenFetchNetworkError(error: unknown): boolean {
  return (error as { code?: unknown } | null | undefined)?.code === "network_error";
}

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

/**
 * `getMe` answers an anonymous connection with `null`. While Clerk has the user
 * signed in but Convex is not authenticated, that null describes the
 * connection, not the account — app/index.tsx reads it the same way. Taking it
 * at face value reset the Finish-setup card for as long as recovery took, and
 * wrote the null over the offline cache's last good record (#269).
 *
 * Returns the record last seen for THIS Clerk user, or `undefined` ("not known
 * yet") so the offline cache answers instead.
 */
export function resolveTrustedMe<T extends { clerkUserId?: string }>({
  live,
  lastGood,
  clerkSignedIn,
  convexAuthenticated,
  clerkUserId,
}: {
  live: T | null | undefined;
  /** The last non-null record this mount saw. */
  lastGood: T | undefined;
  clerkSignedIn: boolean;
  convexAuthenticated: boolean;
  clerkUserId: string | null | undefined;
}): T | null | undefined {
  if (live !== null || !clerkSignedIn || convexAuthenticated) return live;
  // Never hand one account's record to another after a user switch.
  return lastGood && lastGood.clerkUserId === clerkUserId ? lastGood : undefined;
}
