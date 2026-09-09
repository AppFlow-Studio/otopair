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
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

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

  const persistProfilePhoto = useCallback(
    async (uri: string | null, options?: PersistProfileOptions) => {
      const skipCheck = options?.skipSignedInCheck === true;
      if (!skipCheck && !isSignedIn) {
        console.log("Not signed in, skipping photo persistence");
        return;
      }

      if (!uri) {
        // Handle removal
        await persistProfileField({ 
          profile_photo_url: null,
          profile_photo_storage_id: null 
        }, options);
        return;
      }

      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          // 1. Get a short-lived upload URL from Convex
          const uploadUrl = await generateUploadUrl();

          // 2. Fetch the image data from the local URI
          const response = await fetch(uri);
          const blob = await response.blob();

          // 3. Upload the blob to Convex storage
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });

          if (!result.ok) throw new Error("Failed to upload image to Convex storage");

          const { storageId } = await result.json();

          // 4. Save the storageId to the user record
          await persistProfileField({ 
            profile_photo_storage_id: storageId,
            profile_photo_url: null 
          }, options);
          
          console.log("Successfully uploaded and persisted profile photo:", storageId);
          return storageId;
        } catch (error: any) {
          const isRetryable =
            error?.message?.includes("Not authenticated") ||
            error?.message?.includes("User not found") ||
            error?.message?.includes("Failed to fetch"); // Network errors

          if (attempt === 3 || !isRetryable) {
            console.error("Error persisting profile photo to Convex:", error);
            throw error;
          }
          console.log(`Photo persist retry ${attempt + 1}/3`);
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        }
      }
    },
    [isSignedIn, generateUploadUrl, persistProfileField]
  );

  return { persistProfileField, persistProfilePhoto };
}
