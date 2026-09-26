/**
 * Pure rules behind Settings → Change / Create Password
 * (app/settings/change-password.tsx). NO React / native imports — imported
 * directly by Vitest.
 *
 * An account made with Google or Apple has no password (Clerk's
 * `passwordEnabled` is false). Settings used to hide the password row for
 * those accounts, and the screen behind it demanded a current password, so a
 * Google user who wanted to log in with email + password had no way to get
 * one (#296). Clerk sets a first password with the same call as a change,
 * minus `currentPassword`.
 */

export type AccountPasswordMode = "create" | "change";

/** "create" for an account with no password yet, "change" otherwise. */
export function getAccountPasswordMode(passwordEnabled: boolean | undefined): AccountPasswordMode {
  return passwordEnabled === true ? "change" : "create";
}

export function canSubmitAccountPassword({
  mode,
  currentPassword,
  newPassword,
  confirmPassword,
}: {
  mode: AccountPasswordMode;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): boolean {
  if (newPassword.length < 8 || newPassword !== confirmPassword) return false;
  // Creating one there is no current password to type, or to repeat.
  if (mode === "create") return true;
  return currentPassword.length > 0 && newPassword !== currentPassword;
}

/**
 * Clerk refuses a password change from a session that last proved who it is
 * more than ~10 minutes ago, with this code. It is a request to verify, not a
 * failure — the screen verifies and retries.
 */
export function isReverificationRequired(error: unknown): boolean {
  const errors = (error as { errors?: unknown } | null | undefined)?.errors;
  return (
    Array.isArray(errors) &&
    errors.some((e) => (e as { code?: unknown } | null)?.code === "session_reverification_required")
  );
}
