import { describe, expect, it } from "vitest";

import { shouldHideSplash } from "@/lib/auth-routing";

/**
 * Regression cover for the offline cold-launch hang: the app sat on the native
 * splash indefinitely (reported as ~26s with no spinner, no offline message and
 * no timeout) because the gate required Clerk's `isLoaded`, which only resolves
 * after a network round-trip.
 */
describe("shouldHideSplash", () => {
  it("hides on the normal path once fonts and auth are both ready", () => {
    expect(
      shouldHideSplash({ fontsReady: true, authLoaded: true, ceilingReached: false }),
    ).toBe(true);
  });

  it("keeps the splash up while auth is still resolving inside the ceiling", () => {
    expect(
      shouldHideSplash({ fontsReady: true, authLoaded: false, ceilingReached: false }),
    ).toBe(false);
  });

  it("hides once the ceiling is reached even though auth never resolved", () => {
    // THE BUG: offline, `authLoaded` stays false forever. Without the ceiling
    // this returned false on every render and the splash never lifted.
    expect(
      shouldHideSplash({ fontsReady: true, authLoaded: false, ceilingReached: true }),
    ).toBe(true);
  });

  it("never hides before fonts are ready, even at the ceiling", () => {
    // OfflineScreen takes its first text measurement the moment it commits;
    // pre-font it measures against the fallback and clips. useAppFonts resolves
    // from bundled assets (and reports ready on error), so this cannot hang.
    expect(
      shouldHideSplash({ fontsReady: false, authLoaded: false, ceilingReached: true }),
    ).toBe(false);
    expect(
      shouldHideSplash({ fontsReady: false, authLoaded: true, ceilingReached: true }),
    ).toBe(false);
  });
});
