import { describe, expect, it } from "vitest";

import { getMainTabsAccess } from "../lib/auth-routing";

/**
 * The main-tabs guard only checked "signed in", so a signed-in user who had not
 * finished the required setup could reach Home through a direct link
 * (otopair://home), and a signed-out one got a blank screen with no way on.
 */
const base = {
  isLoaded: true,
  isSignedIn: true as boolean | undefined,
  me: undefined as
    | { onboardingCompleted?: boolean; essentialOnboardingCompleted?: boolean; onboardingDeferred?: boolean }
    | null
    | undefined,
  convexAuthenticated: true,
  offline: false,
  finishedLaterFlag: false as boolean | null,
};

describe("getMainTabsAccess", () => {
  it("keeps signed-out visitors out", () => {
    expect(getMainTabsAccess({ ...base, isSignedIn: false })).toBe("signedOut");
    expect(getMainTabsAccess({ ...base, isSignedIn: undefined })).toBe("signedOut");
  });

  it("waits while Clerk is still loading", () => {
    expect(getMainTabsAccess({ ...base, isLoaded: false, isSignedIn: false })).toBe("wait");
  });

  it("sends a signed-in user who skipped the required setup back to it", () => {
    expect(
      getMainTabsAccess({
        ...base,
        me: { onboardingCompleted: false, essentialOnboardingCompleted: false, onboardingDeferred: false },
      }),
    ).toBe("setupIncomplete");
  });

  it("treats a signed-in user with no account record yet as setup-incomplete", () => {
    expect(getMainTabsAccess({ ...base, me: null, convexAuthenticated: true })).toBe("setupIncomplete");
  });

  it("LOOP-SAFETY: lets in everyone app/index sends Home", () => {
    // app/index routes Home on any of these; the guard must agree, or the two
    // would bounce the user between Home and setup forever.
    expect(getMainTabsAccess({ ...base, me: { onboardingCompleted: true } })).toBe("allow");
    expect(getMainTabsAccess({ ...base, me: { essentialOnboardingCompleted: true } })).toBe("allow");
    expect(getMainTabsAccess({ ...base, me: { onboardingDeferred: true } })).toBe("allow");
    expect(getMainTabsAccess({ ...base, me: {}, finishedLaterFlag: true })).toBe("allow");
  });

  it("does not redirect before the device-side 'Finish later' flag has been read", () => {
    expect(getMainTabsAccess({ ...base, me: {}, finishedLaterFlag: null })).toBe("wait");
  });

  it("waits for an account record that is still loading, rather than guessing", () => {
    expect(getMainTabsAccess({ ...base, me: undefined })).toBe("wait");
    // A null record before Convex has the new session is "not loaded yet", not "no account".
    expect(getMainTabsAccess({ ...base, me: null, convexAuthenticated: false })).toBe("wait");
  });

  it("lets the offline mode through when the record cannot arrive", () => {
    // Offline starts only reach the tabs through OfflineBootGate's valid cache.
    expect(getMainTabsAccess({ ...base, me: undefined, offline: true })).toBe("allow");
    expect(getMainTabsAccess({ ...base, me: null, convexAuthenticated: false, offline: true })).toBe("allow");
  });

  it("still keeps signed-out visitors out while offline", () => {
    expect(getMainTabsAccess({ ...base, isSignedIn: false, offline: true })).toBe("signedOut");
  });
});
