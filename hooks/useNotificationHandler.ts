/**
 * useNotificationHandler — register the global foreground presentation handler.
 *
 * Runs once on app open (called from RootLayout). On SDK 53+ a notification
 * that arrives while the app is in the foreground is NOT shown unless a
 * handler is registered via `setNotificationHandler`; without it, pushes only
 * surface when the app is backgrounded. This hook makes foreground pushes
 * present a banner + sound + badge like backgrounded ones.
 *
 * It also (re)creates the Android "default" channel — the push dispatcher
 * sends every message with `channelId: "default"` (see
 * convex/lib/push_dispatcher.ts), and Android drops a push whose channel does
 * not exist. The onboarding step creates it on grant, but a user who enables
 * notifications from OS settings (or reinstalls) may never hit that path, so
 * we ensure it on every app open. Both calls are idempotent.
 *
 * Defensive lazy import: expo-notifications may not be linked in some dev
 * builds (matches the pattern in useRefreshPushToken.ts) — failures no-op.
 */

import { useEffect } from "react";
import { Platform } from "react-native";

export function useNotificationHandler() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // @ts-ignore — expo-notifications may not be linked in some dev builds.
        const mod = await import("expo-notifications");
        if (cancelled) return;

        mod.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        if (Platform.OS === "android") {
          await mod.setNotificationChannelAsync("default", {
            name: "Default",
            importance: mod.AndroidImportance?.DEFAULT ?? 3,
          });
        }
      } catch {
        // Module missing / API error — silently skip. Foreground presentation
        // just falls back to the OS default (background-only display).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
