/**
 * useAccountPassword
 *
 * Sets or changes the signed-in user's Clerk password, including the
 * re-verification Clerk requires when the session last proved who it is more
 * than ~10 minutes ago (`session_reverification_required`).
 *
 * - Changing: the current password the user has just typed is the proof, so
 *   the retry is silent.
 * - Creating (Google / Apple accounts have no password, #296): Clerk emails a
 *   6-digit code — the same check Delete Account uses (useAccountDeletion).
 *
 * USED IN: app/settings/change-password.tsx
 */
import { useCallback } from "react";
import { useSession, useUser } from "@clerk/clerk-expo";

import { isReverificationRequired, type AccountPasswordMode } from "@/lib/account-password";

export type SaveAccountPasswordResult =
  | { status: "saved" }
  /** A 6-digit code went to `email`; finish with verifyCodeAndSave. */
  | { status: "needsEmailCode"; email: string };

export function useAccountPassword() {
  const { user } = useUser();
  const { session } = useSession();

  const sendEmailCode = useCallback(async (): Promise<string> => {
    if (!session) throw new Error("Session not loaded");
    const verification = await session.startVerification({ level: "first_factor" });
    const factor = verification.supportedFirstFactors?.find(
      (candidate) => candidate.strategy === "email_code" && "emailAddressId" in candidate,
    );
    if (!factor || factor.strategy !== "email_code") {
      throw new Error("Email code verification is not available for this account.");
    }
    await session.prepareFirstFactorVerification({
      strategy: "email_code",
      emailAddressId: factor.emailAddressId,
    });
    return factor.safeIdentifier;
  }, [session]);

  const save = useCallback(
    async ({
      mode,
      currentPassword,
      newPassword,
    }: {
      mode: AccountPasswordMode;
      currentPassword: string;
      newPassword: string;
    }): Promise<SaveAccountPasswordResult> => {
      if (!user || !session) throw new Error("Account not loaded");
      const params = mode === "change" ? { currentPassword, newPassword } : { newPassword };
      try {
        await user.updatePassword(params);
        return { status: "saved" };
      } catch (error) {
        if (!isReverificationRequired(error)) throw error;
      }

      if (mode === "create") {
        return { status: "needsEmailCode", email: await sendEmailCode() };
      }

      const verification = await session.startVerification({ level: "first_factor" });
      if (verification.status === "needs_first_factor") {
        const result = await session.attemptFirstFactorVerification({
          strategy: "password",
          password: currentPassword,
        });
        if (result.status !== "complete") {
          throw new Error("Verification incomplete. Please try again.");
        }
      }
      await user.updatePassword(params);
      return { status: "saved" };
    },
    [sendEmailCode, session, user],
  );

  const verifyCodeAndSave = useCallback(
    async ({ code, newPassword }: { code: string; newPassword: string }) => {
      if (!user || !session) throw new Error("Account not loaded");
      const result = await session.attemptFirstFactorVerification({ strategy: "email_code", code });
      if (result.status !== "complete") {
        throw new Error("Verification incomplete. Please try again.");
      }
      await user.updatePassword({ newPassword });
    },
    [session, user],
  );

  return { save, verifyCodeAndSave, resendEmailCode: sendEmailCode };
}
