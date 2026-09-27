import { describe, expect, it } from "vitest";

import { getSignUpErrorMessage } from "@/lib/signup-password-error";

const clerkError = (...errors: { code: string; message?: string; longMessage?: string }[]) => ({
  errors,
});

describe("getSignUpErrorMessage", () => {
  it("THE BUG: a breached password (\"12345678\") says what to do instead", () => {
    const message = getSignUpErrorMessage(
      clerkError({
        code: "form_password_pwned",
        longMessage:
          "Password has been found in an online data breach. For account safety, please use a different password.",
      }),
    );
    expect(message).toMatch(/too common/);
    expect(message).toMatch(/longer/);
  });

  it("lists every failed rule, not just the first", () => {
    const message = getSignUpErrorMessage(
      clerkError({ code: "form_password_no_uppercase" }, { code: "form_password_no_special_char" }),
    );
    expect(message).toBe("Add a capital letter. Add a symbol, like ! or #.");
  });

  it("names the length rule", () => {
    expect(getSignUpErrorMessage(clerkError({ code: "form_password_length_too_short" }))).toBe(
      "Use at least 8 characters.",
    );
  });

  it("keeps Clerk's own text for errors that are not password rules", () => {
    expect(
      getSignUpErrorMessage(
        clerkError({ code: "form_identifier_exists", longMessage: "That email address is taken. Please try another." }),
      ),
    ).toBe("That email address is taken. Please try another.");
  });

  it("falls back when there is nothing to show", () => {
    expect(getSignUpErrorMessage(new Error("Network request failed"))).toBe("Network request failed");
    expect(getSignUpErrorMessage(null)).toBe("Failed to create account");
  });
});
