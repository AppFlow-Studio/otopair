import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";

export type PersistProfileOptions = {
  /** When true, attempt Convex persistence even if Clerk isSignedIn is still false (e.g. right after setActive). Use after phone/email verification. */
  skipSignedInCheck?: boolean;
};

/**
 * Bridge between Zustand and Convex for persisting onboarding profile data.
 * Retries with exponential backoff to handle JWT propagation delays.
 */
export function useOnboardingPersistence() {
  const { isSignedIn } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);

  const persistProfileField = useCallback(
    async (fields: Record<string, any>, options?: PersistProfileOptions) => {
      const skipCheck = options?.skipSignedInCheck === true;
      if (!skipCheck && !isSignedIn) {
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
