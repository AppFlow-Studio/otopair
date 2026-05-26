/**
 * useRefreshPushToken — keep the Expo push token on the Convex users row
 * fresh.
 *
 * Runs on app open (called from RootLayout once the user is signed in).
 * If permission is already granted, fetches the current Expo push token
 * and registers it. If permission was previously denied, no-ops — the
 * onboarding step (PushNotificationsStep) is the only surface that asks
 * for permission.
 *
 * The mutation itself is idempotent — re-registering the same token only
 * bumps the `push_token_updated_at_ms`.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation } from "convex/react";
import Constants from "expo-constants";
import { api } from "@/convex/_generated/api";

export function useRefreshPushToken() {
  const { isSignedIn } = useAuth();
  const registerPushToken = useMutation(api.users.registerExpoPushToken);
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        // @ts-ignore — expo-notifications may not be linked in some dev builds.
        const mod = await import("expo-notifications");
        const perms = await mod.getPermissionsAsync();
        const status = perms.status as unknown as string;
        const granted = status === "granted" || status === "provisional";
        if (!granted) return;

        const projectId =
          (Constants?.expoConfig?.extra as any)?.eas?.projectId ??
          (Constants as any)?.easConfig?.projectId ??
          undefined;
        const tokenRes = await mod.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token: string | undefined = tokenRes?.data;
        if (!token) return;
        if (cancelled) return;
        if (lastTokenRef.current === token) return;
        await registerPushToken({ token });
        if (!cancelled) lastTokenRef.current = token;
      } catch {
        // Module missing / API error — silently skip. The onboarding step
        // is the authoritative permission flow.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, registerPushToken]);
}
