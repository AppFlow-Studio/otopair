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
  /** VIN of the car this job is about, once `claimByToken` has confirmed the
   *  caller owns it. Lets "Go to my Garage" open ON that vehicle rather than
   *  on whichever one happens to be primary. Never populated from the public
   *  tracker payload, which withholds the VIN by design. */
  vin: string | null;
  setVin: (vin: string | null) => void;
  /** DEV ONLY. Forces the flow to render as a first-time or a returning
   *  customer regardless of whether anyone is actually signed in, so both
   *  branches can be demoed back to back from one link. Null in production —
   *  the chooser that sets it is behind `__DEV__` and never renders. */
  demoFlow: 'new' | 'existing' | null;
  setDemoFlow: (flow: 'new' | 'existing' | null) => void;
  claim: WalkInClaim | null;
  tracker: WalkInTracker | null;
  setClaim: (token: string, claim: WalkInClaim) => void;
  setTracker: (tracker: WalkInTracker) => void;
  clear: () => void;
}

export const useWalkInClaimStore = create<WalkInClaimState>((set) => ({
  token: null,
  vin: null,
  demoFlow: null,
  claim: null,
  tracker: null,
  setClaim: (token, claim) => set({ token, claim }),
  setVin: (vin) => set({ vin }),
  setDemoFlow: (demoFlow) => set({ demoFlow }),
  setTracker: (tracker) => set({ tracker }),
  clear: () => set({ token: null, vin: null, demoFlow: null, claim: null, tracker: null }),
}));
