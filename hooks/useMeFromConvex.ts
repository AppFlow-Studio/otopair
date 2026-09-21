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
 * Not a drop-in for every getMe read: a cached record can be stale, so
 * anything that writes on the strength of it should keep reading live.
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/FinishAccountSetupCard.tsx
 */
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useSessionCachedQuery } from "@/lib/offlineSessionCache";

export function useMeFromConvex() {
  const live = useQuery(api.users.getMe);
  return useSessionCachedQuery("users_me", live);
}
