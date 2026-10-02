/**
 * pendingWalkInClaim — the claim token, parked across the auth round trip.
 *
 * The walk-in flow now requires an account before it shows the job, so the
 * customer leaves for sign-in / sign-up and has to come back to the SAME job.
 * `useWalkInClaimStore` holds the token in memory, which is fine for an email
 * signup that never leaves the app — and useless for OAuth, which bounces
 * through a browser and can cold-start the process on the way back.
 *
 * So the token gets a small AsyncStorage parking space. Written when the gate
 * sends someone to auth, read once on the way back in, cleared immediately.
 *
 * Deliberately not part of the zustand store: the store is session UI state
 * and gets `clear()`ed at points that would throw this away.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "otopair.pendingWalkInClaim.v1";
const INTENT_KEY = "otopair.pendingWalkInIntent.v1";

/** Which button they pressed at the gate. This is what decides the branch on
 *  the way back: everyone returns signed in, so `isSignedIn` can no longer
 *  tell a brand-new account from one that already existed. Their own choice
 *  can. */
export type WalkInAuthIntent = "new" | "existing";

export async function parkClaimToken(
  token: string,
  intent: WalkInAuthIntent,
): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [KEY, token],
      [INTENT_KEY, intent],
    ]);
  } catch {
    // In-memory store still carries the token for the common in-app path.
  }
}

/** The branch the customer chose at the gate. Survives until the next park —
 *  read on the walk-in landing screen, which is the only thing that needs it. */
export async function readWalkInIntent(): Promise<WalkInAuthIntent | null> {
  try {
    const v = await AsyncStorage.getItem(INTENT_KEY);
    return v === "new" || v === "existing" ? v : null;
  } catch {
    return null;
  }
}

/** Reads AND clears. A parked token is good for exactly one resume — leaving
 *  it would drag a driver back into a walk-in job on every later launch. */
export async function takeParkedClaimToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token) await AsyncStorage.removeItem(KEY);
    return token;
  } catch {
    return null;
  }
}

export async function clearParkedClaimToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
