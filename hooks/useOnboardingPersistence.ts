import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";

/**
 * Bridge between Zustand and Convex for persisting onboarding profile data.
 * Retries with exponential backoff to handle JWT propagation delays.
 */
export function useOnboardingPersistence() {
  const { isSignedIn } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);

  const persistProfileField = useCallback(
    async (fields: Record<string, any>) => {
      if (!isSignedIn) {
        console.log("Not signed in, skipping persistence");
        return;
      }
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          await updateProfile(fields);
          return;
        } catch (error: any) {
          const isRetryable =
            error?.message?.includes("Not authenticated") ||
            error?.message?.includes("User not found");
          if (attempt === 3 || !isRetryable) {
            console.error("Failed to persist profile field:", error);
            return;
          }
          console.log(`Persist retry ${attempt + 1}/3 for fields:`, Object.keys(fields));
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        }
      }
    },
    [isSignedIn, updateProfile]
  );

  return { persistProfileField };
}
