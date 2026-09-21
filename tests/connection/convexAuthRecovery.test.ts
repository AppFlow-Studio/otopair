import { describe, expect, it } from "vitest";

import { shouldRecoverConvexAuth } from "@/lib/connection/convexAuthRecovery";

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
