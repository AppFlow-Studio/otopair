/**
 * useMeFromConvex
 *
 * `api.users.getMe`, backed by the session-scoped offline cache
 * (lib/offlineSessionCache.ts). Online it is exactly `useQuery(getMe)`; on an
 * offline cold start it returns the last record seen online instead of
 * `undefined` forever.
 *
 * For screens that GATE their render on the user record. Home holds a
 * full-screen spinner until `me` settles, so an offline start that
 * OfflineBootGate had deliberately let through into the cached offline mode
 * still stalled one screen later, on Home's own spinner.
 *
 * It also refuses the `null` an anonymous connection gets from getMe while
 * Clerk still has the user signed in (see resolveTrustedMe) — the record last
 * seen stands in until Convex is authenticated again.
 *
 * Not a drop-in for every getMe read: a cached record can be stale, so
 * anything that writes on the strength of it should keep reading live.
 *
 * USED IN: app/(main-tabs)/_layout.tsx, app/(main-tabs)/home/index.tsx,
 *          components/home/FinishAccountSetupCard.tsx,
 *          components/home/ProfileInitialsButton.tsx
 */
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { resolveTrustedMe } from "@/lib/connection/convexAuthRecovery";
import { useSessionCachedQuery } from "@/lib/offlineSessionCache";

export function useMeFromConvex() {
  const { isSignedIn, userId: clerkUserId } = useAuth();
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  const live = useQuery(api.users.getMe);
  const [lastGood, setLastGood] = useState<NonNullable<typeof live> | undefined>(undefined);

  useEffect(() => {
    if (live) setLastGood(live);
  }, [live]);

  const trusted = resolveTrustedMe({
    live,
    lastGood,
    clerkSignedIn: isSignedIn === true,
    convexAuthenticated,
    clerkUserId,
  });
  return useSessionCachedQuery("users_me", trusted);
}
