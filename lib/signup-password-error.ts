/**
 * Plain-language message for a failed Clerk sign-up (#311).
 *
 * The sign-up screen showed Clerk's first error verbatim. For the passwords
 * testers tried ("12345678", "kim12345") that is the breach check —
 * `form_password_pwned`; the Clerk instance has breach checking on and no
 * character rules — whose text says the password was "found in an online data
 * breach" without saying what would work instead. Each password code maps to
 * an instruction, and every failed rule is listed, not only the first.
 */

interface ClerkApiError {
  code?: string;
  message?: string;
  longMessage?: string;
}

const PASSWORD_RULE_MESSAGES: Record<string, string> = {
  form_password_pwned:
    "This password is too common — it has shown up in a data breach, so it is easy to guess. Try something longer, like a few unrelated words with a number or symbol.",
  form_password_not_strong_enough:
    "This password is too easy to guess. Make it longer, or mix in capital letters, numbers and symbols.",
  form_password_length_too_short: "Use at least 8 characters.",
  form_password_no_uppercase: "Add a capital letter.",
  form_password_no_lowercase: "Add a lowercase letter.",
  form_password_no_number: "Add a number.",
  form_password_no_special_char: "Add a symbol, like ! or #.",
};

export function getSignUpErrorMessage(err: unknown): string {
  const errors: ClerkApiError[] = (err as { errors?: ClerkApiError[] } | null)?.errors ?? [];

  const rules = errors
    .map((e) => (e.code ? PASSWORD_RULE_MESSAGES[e.code] : undefined))
    .filter((m): m is string => Boolean(m));
  if (rules.length > 0) return [...new Set(rules)].join(" ");

  return (
    errors[0]?.longMessage ||
    errors[0]?.message ||
    (err as { message?: string } | null)?.message ||
    "Failed to create account"
  );
}
