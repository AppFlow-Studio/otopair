/**
 * useOtopairDeepLinks — Installs all the listeners needed to route incoming
 * `otopair://` URLs to the right screen.
 *
 * Three entry points (one hook so the surface stays single):
 *   1. Cold launch via tapped notification or system handoff →
 *      `Linking.getInitialURL()` is read once on mount.
 *   2. Warm launch via OS handoff or another app handing us a URL →
 *      `Linking.addEventListener("url", ...)`.
 *   3. Push notification tap while app is foreground/background →
 *      `Notifications.addNotificationResponseReceivedListener(...)`. The
 *      push payload's `data.deepLink` field is what we route on (set by
 *      `convex/booking_approvals.ts`).
 *
 * Lazy-loads `expo-notifications` so dev builds without the native module
 * still boot cleanly (matches the pattern used in `useRefreshPushToken.ts`).
 */

import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { routeOtopairDeepLink } from "@/utils/linking";

export function useOtopairDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    // 1. Cold-launch URL
    Linking.getInitialURL()
      .then((url) => {
        if (cancelled || !url) return;
        routeOtopairDeepLink(router, url);
      })
      .catch(() => {
        // Cold-launch URL is best-effort; never throw at the user.
      });

    // 2. Warm-launch URL events (OS handoff)
    const urlSub = Linking.addEventListener("url", ({ url }) => {
      if (!url) return;
      routeOtopairDeepLink(router, url);
    });

    // 3. Push notification taps
    let notifSubRemove: (() => void) | null = null;
    (async () => {
      try {
        // @ts-ignore — expo-notifications may not be linked in some dev builds.
        const mod = await import("expo-notifications");
        if (cancelled) return;
        const sub = mod.addNotificationResponseReceivedListener((response: any) => {
          const data = response?.notification?.request?.content?.data;
          const deepLink = typeof data?.deepLink === "string" ? data.deepLink : null;
          if (!deepLink) return;
          routeOtopairDeepLink(router, deepLink);
        });
        notifSubRemove = () => sub.remove();
      } catch {
        // No-op when expo-notifications isn't available (Expo Go,
        // pre-prebuild dev clients). Push-tap routing simply won't fire.
      }
    })();

    return () => {
      cancelled = true;
      urlSub.remove();
      notifSubRemove?.();
    };
  }, [router]);
}
