/**
 * useWalkInClaimStore
 *
 * Holds the claim resolved from a walk-in deep link (`otopair://claim/<token>`)
 * for the duration of the claim flow, so the `(walk-in)` screens can render the
 * real shop / vehicle / customer instead of the preview MOCK.
 *
 * Convex is the source of truth — this is a transient mirror of one
 * `walkin_claims.resolveClaimToken` result, populated by `app/claim/[token]`
 * and cleared once the claim completes or is abandoned. Nothing here is
 * persisted.
 */

import { create } from "zustand";

/** The happy-path payload from `walkin_claims.resolveClaimToken`. */
export interface WalkInClaim {
  email: string | null;
  /** E.164 from users.phone. The shop collected it; the customer never types it. */
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  shopName: string | null;
  vehicleSummary: string | null;
}

/** `walkin_claims.getTrackerData` — the live job behind the same token. */
export interface WalkInTracker {
  shopName: string | null;
  firstName: string | null;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    plateLast4: string | null;
    /** Cached VDB photo, resolved server-side so the VIN never leaves Convex. */
    imageUrl: string | null;
  };
  primaryService: string | null;
  estimatedReadyIso: string | null;
  mechanic: {
    displayName: string;
    aseCertified?: boolean | null;
    yearsAtShop?: number | null;
  } | null;
  displayStatus: string | null;
  timeline: { key: string; label: string; atMs: number | null; reached: boolean }[];
}

interface WalkInClaimState {
  /** The token from the deep link, kept so the claim can be completed later. */
  token: string | null;
  claim: WalkInClaim | null;
  tracker: WalkInTracker | null;
  setClaim: (token: string, claim: WalkInClaim) => void;
  setTracker: (tracker: WalkInTracker) => void;
  clear: () => void;
}

export const useWalkInClaimStore = create<WalkInClaimState>((set) => ({
  token: null,
  claim: null,
  tracker: null,
  setClaim: (token, claim) => set({ token, claim }),
  setTracker: (tracker) => set({ tracker }),
  clear: () => set({ token: null, claim: null, tracker: null }),
}));
