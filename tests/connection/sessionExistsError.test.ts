import { describe, expect, it } from "vitest";

import { isSessionExistsError } from "@/lib/auth-routing";

/**
 * LoginStep used to print Clerk's raw "You're already signed in." and leave the
 * user stuck, with every login button failing identically. The session was
 * valid, so the screen now treats the error as a successful login and routes on
 * — which depends on recognising the error in every shape it arrives in.
 */
describe("isSessionExistsError", () => {
  it("recognises Clerk's structured session_exists error", () => {
    expect(
      isSessionExistsError({
        errors: [{ code: "session_exists", message: "You're already signed in." }],
      }),
    ).toBe(true);
  });

  it("recognises the code even when it is not the first error", () => {
    expect(
      isSessionExistsError({ errors: [{ code: "other" }, { code: "session_exists" }] }),
    ).toBe(true);
  });

  it("recognises a plain Error carrying only the message", () => {
    expect(isSessionExistsError(new Error("You're already signed in."))).toBe(true);
  });

  it("does not treat ordinary login failures as a stale session", () => {
    // Treating these as success would send someone into the app after a
    // failed login, so the match must stay narrow.
    expect(
      isSessionExistsError({ errors: [{ code: "form_password_incorrect" }] }),
    ).toBe(false);
    expect(isSessionExistsError(new Error("Password is incorrect. Try again."))).toBe(false);
    expect(isSessionExistsError(new Error("Authentication failed"))).toBe(false);
  });

  it("is safe on values that are not errors at all", () => {
    expect(isSessionExistsError(null)).toBe(false);
    expect(isSessionExistsError(undefined)).toBe(false);
    expect(isSessionExistsError("already signed in")).toBe(false);
    expect(isSessionExistsError({ message: 42 })).toBe(false);
  });
});
