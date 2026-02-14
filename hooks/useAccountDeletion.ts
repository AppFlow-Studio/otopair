import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser, useAuth } from '@clerk/clerk-expo';
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
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut, isLoaded: isAuthLoaded } = useAuth();
  const me = useQuery(api.users.getMe);
  
  const requestDeletionMutation = useMutation(api.users.requestAccountDeletion);
  const reactivateMutation = useMutation(api.users.reactivateAccount);

  /**
   * Triggers a 6-digit email verification code from Clerk.
   */
  const sendVerificationCode = useCallback(async () => {
    if (!user) throw new Error("User not loaded");
    if (!user.primaryEmailAddress) throw new Error("No primary email address found");
    await user.primaryEmailAddress.prepareVerification({ strategy: "email_code" });
  }, [user]);

  /**
   * Verifies the 6-digit code with Clerk, marks the account as pending deletion in Convex,
   * and signs the user out.
   */
  const confirmDeletion = useCallback(async (code: string) => {
    if (!user) throw new Error("User not loaded");
    if (!user.primaryEmailAddress) throw new Error("No primary email address found");
    
    // 1. Verify with Clerk
    await user.primaryEmailAddress.attemptVerification({ code });
    
    // 2. Mark in Convex (Soft Delete) with retry logic
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        await requestDeletionMutation();
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
    
    // 3. Sign out
    await signOut();
  }, [user, requestDeletionMutation, signOut]);

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
    isLoaded: isUserLoaded && isAuthLoaded && me !== undefined,
    sendVerificationCode,
    confirmDeletion,
    reactivateAccount,
  };
}
