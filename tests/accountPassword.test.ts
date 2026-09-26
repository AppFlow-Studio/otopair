import { describe, expect, it } from "vitest";

import {
  canSubmitAccountPassword,
  getAccountPasswordMode,
  isReverificationRequired,
} from "@/lib/account-password";

describe("getAccountPasswordMode", () => {
  it("THE BUG: an account made with Google has no password, so it gets to create one (#296)", () => {
    expect(getAccountPasswordMode(false)).toBe("create");
  });

  it("an account with a password changes it", () => {
    expect(getAccountPasswordMode(true)).toBe("change");
  });

  it("treats a user record that has not loaded as having no password", () => {
    expect(getAccountPasswordMode(undefined)).toBe("create");
  });
});

describe("canSubmitAccountPassword", () => {
  const good = { currentPassword: "", newPassword: "longenough1", confirmPassword: "longenough1" };

  it("THE BUG: creating needs no current password", () => {
    expect(canSubmitAccountPassword({ mode: "create", ...good })).toBe(true);
  });

  it("changing still needs the current password, and a different new one", () => {
    expect(canSubmitAccountPassword({ mode: "change", ...good })).toBe(false);
    expect(canSubmitAccountPassword({ mode: "change", ...good, currentPassword: "old-password" })).toBe(true);
    expect(canSubmitAccountPassword({ mode: "change", ...good, currentPassword: "longenough1" })).toBe(false);
  });

  it("needs 8+ characters and a matching confirmation either way", () => {
    for (const mode of ["create", "change"] as const) {
      const base = { mode, currentPassword: "old-password" };
      expect(canSubmitAccountPassword({ ...base, newPassword: "short", confirmPassword: "short" })).toBe(false);
      expect(canSubmitAccountPassword({ ...base, newPassword: "longenough1", confirmPassword: "longenough2" })).toBe(false);
    }
  });
});

describe("isReverificationRequired", () => {
  it("recognises Clerk's request to verify before a sensitive change", () => {
    expect(isReverificationRequired({ errors: [{ code: "session_reverification_required" }] })).toBe(true);
  });

  it("leaves every other error alone", () => {
    expect(isReverificationRequired({ errors: [{ code: "form_password_pwned" }] })).toBe(false);
    expect(isReverificationRequired(new Error("network"))).toBe(false);
    expect(isReverificationRequired(null)).toBe(false);
  });
});
