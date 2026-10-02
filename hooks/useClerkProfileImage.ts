/**
 * useClerkProfileImage
 *
 * The photo on the user's Clerk account (their Google or Apple photo). Every
 * avatar falls back to it when the user hasn't uploaded a photo of their own,
 * so removing an upload shows the account photo again (#475).
 *
 * Null when the account has no photo: Clerk's `imageUrl` is then a generated
 * gradient, and the app's initials placeholder is shown instead.
 *
 * USED IN: app/settings/edit-profile.tsx,
 *          components/home/ProfileInitialsButton.tsx,
 *          components/settings/SettingsContent.tsx,
 *          components/settings/SettingsOverlay.tsx,
 *          components/settings/SettingsContainerTransformOverlay.tsx
 */
import { useUser } from "@clerk/clerk-expo";

export function useClerkProfileImage(): string | null {
  const { user } = useUser();
  return user?.hasImage ? user.imageUrl : null;
}
