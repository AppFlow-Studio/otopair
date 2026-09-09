import { useCallback } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession, useAuth } from '@clerk/clerk-expo';
import { Alert } from 'react-native';

/**
 * useAccountDeletion
 * 
 * Centralized hook for managing the account deletion grace period flow.
 * Handles:
 * 1. Sending email verification codes via Clerk.
 * 2. Verifying codes and marking accounts for soft-deletion in Convex.
 * 3. Reactivating accounts that are pending deletion.
 */
export function useAccountDeletion() {
  type DeletionSurveyPayload = {
    response?: string;
    skipped?: boolean;
  };

  const { session, isLoaded: isSessionLoaded } = useSession();
  const { signOut, isLoaded: isAuthLoaded } = useAuth();
  const me = useQuery(api.users.getMe);
  
  const requestDeletionMutation = useMutation(api.users.requestAccountDeletion);
  const revokeClerkSessionsAction = useAction(api.users.revokeMyActiveClerkSessions);
  const reactivateMutation = useMutation(api.users.reactivateAccount);

  /**
   * Triggers a 6-digit re-verification code from Clerk session verification.
   */
  const sendVerificationCode = useCallback(async () => {
    if (!session) throw new Error("Session not loaded");

    const verification = await session.startVerification({ level: "first_factor" });
    if (verification.status !== "needs_first_factor") {
      throw new Error("Unable to start verification right now. Please try again.");
    }

    const emailCodeFactor = verification.supportedFirstFactors?.find(
      (factor) => factor.strategy === "email_code" && "emailAddressId" in factor,
    );

    if (!emailCodeFactor || !("emailAddressId" in emailCodeFactor)) {
      throw new Error("Email code verification is not available for this account.");
    }

    await session.prepareFirstFactorVerification({
      strategy: "email_code",
      emailAddressId: emailCodeFactor.emailAddressId,
    });
  }, [session]);

  /**
   * Verifies a 6-digit code with Clerk session verification.
   */
  const verifyDeletionCode = useCallback(async (code: string) => {
    if (!session) throw new Error("Session not loaded");

    const result = await session.attemptFirstFactorVerification({
      strategy: "email_code",
      code,
    });

    if (result.status !== "complete") {
      throw new Error("Verification incomplete. Please try again.");
    }
  }, [session]);

  /**
   * Marks account as pending deletion in Convex and signs out.
   */
  const markAccountForDeletion = useCallback(async (survey?: DeletionSurveyPayload) => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        await requestDeletionMutation({
          response: survey?.response,
          skipped: survey?.skipped,
        });
        break; // Success
      } catch (error: any) {
        const isRetryable =
          error?.message?.includes("Not authenticated") ||
          error?.message?.includes("User not found") ||
          error?.message?.includes("Failed to fetch");

        if (attempt === 3 || !isRetryable) throw error;
        
        console.log(`Deletion request retry ${attempt + 1}/3`);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        await revokeClerkSessionsAction({
          excludeSessionId: session?.id,
        });
        break;
      } catch (error: any) {
        const isRetryable =
          error?.message?.includes("Failed to list Clerk sessions") ||
          error?.message?.includes("Failed to revoke") ||
          error?.message?.includes("Failed to fetch");

        if (attempt === 3 || !isRetryable) throw error;

        console.log(`Clerk session revocation retry ${attempt + 1}/3`);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    await signOut();
  }, [requestDeletionMutation, revokeClerkSessionsAction, session?.id, signOut]);

  /**
   * Cancels the pending deletion and restores the account.
   */
  const reactivateAccount = useCallback(async (silent = false) => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        await reactivateMutation();
        if (!silent) {
          Alert.alert("Success", "Your account has been reactivated!");
        }
        return;
      } catch (error: any) {
        const isRetryable =
          error?.message?.includes("Not authenticated") ||
          error?.message?.includes("User not found") ||
          error?.message?.includes("Failed to fetch");

        if (attempt === 3 || !isRetryable) {
          console.error("Reactivation failed:", error);
          if (!silent) {
            Alert.alert("Error", "Could not reactivate account. Please try again.");
          }
          throw error;
        }
        
        console.log(`Reactivation retry ${attempt + 1}/3`);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }, [reactivateMutation]);

  return {
    isPendingDeletion: me?.isPendingDeletion ?? false,
    deletionRequestedAt: me?.deletionRequestedAt,
    isLoaded: isSessionLoaded && isAuthLoaded && me !== undefined,
    sendVerificationCode,
    verifyDeletionCode,
    markAccountForDeletion,
    reactivateAccount,
  };
}
