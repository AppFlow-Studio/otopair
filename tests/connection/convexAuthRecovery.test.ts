import { describe, expect, it } from "vitest";

import {
  isTokenFetchNetworkError,
  resolveTrustedMe,
  shouldRecoverConvexAuth,
} from "@/lib/connection/convexAuthRecovery";

const healthy = { clerkSignedIn: true, convexLoading: false, convexAuthenticated: true, online: true };

describe("shouldRecoverConvexAuth", () => {
  it("THE BUG: recovers a signed-in user Convex has dropped, once back online", () => {
    // #269: a token fetch failed during an outage, Convex went to noAuth and
    // never retried, and the Finish-setup card read as a new account.
    expect(shouldRecoverConvexAuth({ ...healthy, convexAuthenticated: false })).toBe(true);
  });

  it("leaves a healthy session alone", () => {
    expect(shouldRecoverConvexAuth(healthy)).toBe(false);
  });

  it("does not interrupt an authentication already in flight", () => {
    // Startup and sign-in pass through loading with convexAuthenticated false;
    // re-running setAuth then would cancel the attempt it is waiting on.
    expect(
      shouldRecoverConvexAuth({ ...healthy, convexLoading: true, convexAuthenticated: false }),
    ).toBe(false);
  });

  it("waits for the connection instead of failing the retry offline", () => {
    expect(
      shouldRecoverConvexAuth({ ...healthy, convexAuthenticated: false, online: false }),
    ).toBe(false);
  });

  it("never tries to authenticate someone who is signed out", () => {
    expect(
      shouldRecoverConvexAuth({ ...healthy, clerkSignedIn: false, convexAuthenticated: false }),
    ).toBe(false);
  });
});

describe("resolveTrustedMe", () => {
  const waleed = { clerkUserId: "user_waleed", onboardingCompleted: true };
  const dropped = {
    live: null,
    lastGood: waleed,
    clerkSignedIn: true,
    convexAuthenticated: false,
    clerkUserId: "user_waleed",
  };

  it("THE BUG: keeps the last record while Convex has dropped a signed-in user", () => {
    // #269: the anonymous null reset every Finish-setup tile until recovery
    // landed, and was written over the offline cache's good record.
    expect(resolveTrustedMe(dropped)).toBe(waleed);
  });

  it("answers 'not known yet' when this mount never saw the record, so the offline cache serves it", () => {
    // Offline cold start, then the socket reconnects before auth does.
    expect(resolveTrustedMe({ ...dropped, lastGood: undefined })).toBeUndefined();
  });

  it("never hands one account's record to another after a user switch", () => {
    expect(resolveTrustedMe({ ...dropped, clerkUserId: "user_someone_else" })).toBeUndefined();
  });

  it("believes null once Convex is authenticated — a sign-up with no row yet", () => {
    expect(resolveTrustedMe({ ...dropped, convexAuthenticated: true })).toBeNull();
  });

  it("believes null for someone signed out", () => {
    expect(resolveTrustedMe({ ...dropped, clerkSignedIn: false, clerkUserId: null })).toBeNull();
  });

  it("passes a live record and a loading query straight through", () => {
    const fresh = { clerkUserId: "user_waleed", onboardingCompleted: false };
    expect(resolveTrustedMe({ ...dropped, live: fresh })).toBe(fresh);
    expect(resolveTrustedMe({ ...dropped, live: undefined })).toBeUndefined();
  });
});

describe("isTokenFetchNetworkError", () => {
  it("THE BUG: a dead network is not a refusal, so the fetch must wait rather than report 'no token'", () => {
    // What Clerk throws offline, as seen on the device: ClerkRuntimeError
    // 'ClerkJS: Network error at "https://…/tokens/convex"', code network_error.
    const offline = Object.assign(new Error('ClerkJS: Network error at "https://clerk/v1/client/sessions/s/tokens/convex"'), {
      code: "network_error",
      clerkRuntimeError: true,
    });
    expect(isTokenFetchNetworkError(offline)).toBe(true);
  });

  it("lets a real refusal through, so a revoked session still logs Convex out", () => {
    const revoked = Object.assign(new Error("Session not found"), { status: 404, errors: [{ code: "resource_not_found" }] });
    expect(isTokenFetchNetworkError(revoked)).toBe(false);
    expect(isTokenFetchNetworkError(new Error("anything else"))).toBe(false);
  });

  it("copes with whatever else gets thrown", () => {
    expect(isTokenFetchNetworkError(null)).toBe(false);
    expect(isTokenFetchNetworkError(undefined)).toBe(false);
    expect(isTokenFetchNetworkError("network_error")).toBe(false);
  });
});
