import { describe, expect, it } from "vitest";

import { shouldResumeMidSetup } from "../lib/auth-routing";

/**
 * Bug #235, part two. Google/Apple sign-ups arrive with name and email filled
 * in, so "essential onboarding" completes the moment the phone is verified —
 * the first step — and every relaunch after that went straight to Home,
 * skipping the rest of onboarding for good. A saved in-progress step now
 * brings them back to it.
 */
describe("shouldResumeMidSetup", () => {
  it("resumes a Google/Apple user who closed the app right after the phone step", () => {
    expect(
      shouldResumeMidSetup({
        onboardingCompleted: false,
        essentialOnboardingCompleted: true,
        hasSetupInProgress: true,
      }),
    ).toBe(true);
  });

  it("goes Home after 'Finish later', which clears the saved step", () => {
    expect(
      shouldResumeMidSetup({
        onboardingCompleted: false,
        essentialOnboardingCompleted: true,
        hasSetupInProgress: false,
      }),
    ).toBe(false);
  });

  it("never pulls a fully onboarded user back into setup, even with a leftover step", () => {
    expect(
      shouldResumeMidSetup({
        onboardingCompleted: true,
        essentialOnboardingCompleted: true,
        hasSetupInProgress: true,
      }),
    ).toBe(false);
  });

  it("leaves users without essential setup to the existing resume path", () => {
    // app/index already sends them into onboarding; this rule is only about
    // overriding the essential-complete shortcut to Home.
    expect(
      shouldResumeMidSetup({
        onboardingCompleted: false,
        essentialOnboardingCompleted: false,
        hasSetupInProgress: true,
      }),
    ).toBe(false);
    expect(
      shouldResumeMidSetup({ essentialOnboardingCompleted: undefined, hasSetupInProgress: true }),
    ).toBe(false);
  });
});
