import { useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useWalkInClaimStore } from "@/stores/useWalkInClaimStore";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForConvexToken(
  getToken: (opts?: { template?: string }) => Promise<string | null>,
  {
    attempts = 8,
    initialDelayMs = 300,
    maxDelayMs = 4000,
  }: { attempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
) {
  let delay = initialDelayMs;

  for (let i = 0; i < attempts; i++) {
    const token = await getToken({ template: "convex" });
    if (token) return token;

    await sleep(delay);
    delay = Math.min(delay * 2, maxDelayMs);
  }

  throw new Error("Convex token not ready");
}

/**
 * Ensures the Convex `users` row exists for the current Clerk user.
 * Waits until Clerk can issue a Convex JWT before calling the mutation so we
 * don't spam the Convex logs with "Not authenticated".
 *
 * Carries the walk-in claim token when there is one. A customer who arrived
 * via `otopair://claim/<token>` has a stub account the shop already built,
 * holding their car and their job; the token tells `getOrCreateMe` to adopt
 * that row instead of minting a second one. Read from the store here rather
 * than threaded through all seven call sites — every one of them wants the
 * same behaviour, and a signup path that forgot to pass it would silently
 * orphan the customer's vehicle.
 */
export function useEnsureConvexUser() {
  const { getToken } = useAuth();
  const ensureUser = useMutation(api.users.getOrCreateMe);
  const inFlightRef = useRef<Promise<any> | null>(null);

  return useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      try {
        // Allow extra time to mint a Convex JWT; better to wait than to sign out and loop.
        await waitForConvexToken(getToken, { attempts: 10, initialDelayMs: 300, maxDelayMs: 5000 });
        const claimToken = useWalkInClaimStore.getState().token ?? undefined;
        try {
          return await ensureUser(claimToken ? { claimToken } : {});
        } catch (err: any) {
          // Rare race: Convex may still reject immediately after token becomes available.
          // Give it one brief retry before surfacing the error.
          const message = err?.message ?? "";
          if (message.includes("Not authenticated")) {
            await sleep(500);
            return await ensureUser(claimToken ? { claimToken } : {});
          }
          throw err;
        }
      } catch (err) {
        throw err;
      }
    })();

    inFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      inFlightRef.current = null;
    }
  }, [ensureUser, getToken]);
}
