import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";

export type PersistPreferencesOptions = {
  /** When true, attempt Convex persistence even if Clerk isSignedIn is still false. */
  skipSignedInCheck?: boolean;
};

/**
 * Bridge between UI and Convex for persisting user settings preferences.
 * Retries with exponential backoff to handle JWT propagation delays.
 * Specifically for the user_settings_preferences table.
 */
export function usePreferencesPersistence() {
  const { isSignedIn } = useAuth();
  const updateGeneralPrefs = useMutation(api.preferences.updateGeneralPreferences);
  const updateNotificationPrefs = useMutation(api.preferences.updateNotificationPreferences);

  const persistGeneralPreferences = useCallback(
    async (fields: { language?: string; units?: string }, options?: PersistPreferencesOptions) => {
      const skipCheck = options?.skipSignedInCheck === true;
      if (!skipCheck && !isSignedIn) {
        console.log("Not signed in, skipping preferences persistence");
        return;
      }
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          await updateGeneralPrefs(fields);
          return;
        } catch (error: any) {
          const isRetryable =
            error?.message?.includes("Not authenticated") ||
            error?.message?.includes("User not found");
          if (attempt === 3 || !isRetryable) {
            console.error("Failed to persist general preferences:", error);
            throw error;
          }
          console.log(`Preferences persist retry ${attempt + 1}/3 for fields:`, Object.keys(fields));
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        }
      }
    },
    [isSignedIn, updateGeneralPrefs]
  );

  const persistNotificationPreferences = useCallback(
    async (fields: { offers: boolean; rewards: boolean; pass: boolean; bookings: boolean; other: boolean }, options?: PersistPreferencesOptions) => {
      const skipCheck = options?.skipSignedInCheck === true;
      if (!skipCheck && !isSignedIn) {
        console.log("Not signed in, skipping notification persistence");
        return;
      }
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          await updateNotificationPrefs(fields);
          return;
        } catch (error: any) {
          const isRetryable =
            error?.message?.includes("Not authenticated") ||
            error?.message?.includes("User not found");
          if (attempt === 3 || !isRetryable) {
            console.error("Failed to persist notification preferences:", error);
            throw error;
          }
          console.log(`Notification persist retry ${attempt + 1}/3`);
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        }
      }
    },
    [isSignedIn, updateNotificationPrefs]
  );

  return { persistGeneralPreferences, persistNotificationPreferences };
}
