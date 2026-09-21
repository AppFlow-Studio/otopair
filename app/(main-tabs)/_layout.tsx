// `Badge`, `Icon`, `Label` are NOT top-level exports of
// `expo-router/unstable-native-tabs` — they are statics on
// `NativeTabs.Trigger` (e.g. `NativeTabs.Trigger.Icon`). The earlier
// destructured import silently resolved them to `undefined`, which made
// every `<Icon sf="..." />` a no-op and removed the tab icons. Reach for
// the statics via the namespace.
import { NativeTabs } from "expo-router/unstable-native-tabs";
const Label = NativeTabs.Trigger.Label;
const Icon = NativeTabs.Trigger.Icon;
const Badge = NativeTabs.Trigger.Badge;
import { Tabs, usePathname, useRootNavigationState } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useConvexAuth } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { EnrichmentStatusPill } from "@/components/booking-flow/EnrichmentStatusPill";
import { TabBar } from "@/components/navigation/TabBar";
import { TAB_ITEMS } from "@/components/navigation/tabItems";
import { useBookingsFromConvex } from "@/hooks/useBookingsFromConvex";
import { useUnseenBookingsCount } from "@/hooks/useUnseenBookingsCount";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { NotificationsSheet } from "@/components/notifications/NotificationsSheet";
import { RescheduleDecisionOverlay } from "@/components/notifications/RescheduleDecisionOverlay";
import { getMainTabsAccess } from "@/lib/auth-routing";
import { getOnboardingFinishedLaterKey } from "@/lib/onboarding-resume";
import { useConnection } from "@/hooks/useConnection";
import { useMeFromConvex } from "@/hooks/useMeFromConvex";
import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
import { CoachProvider } from "@/components/coach/CoachContext";
import { CoachTour } from "@/components/coach/CoachTour";
import { OfflinePreload } from "@/components/connection/OfflinePreload";
// OTA update banner only matters in EAS builds. In a local dev build
// expo-updates' native module isn't linked, and the static import chain
// (UpdateAvailableBanner → useEasUpdate → expo-updates) throws "Cannot
// find native module 'ExpoUpdates'" at MODULE-LOAD time — before any
// render-time gate can run. A conditional require keeps the chain from
// loading at all in dev; in EAS builds (__DEV__ false, expo-updates
// linked) the real component loads and works as designed.
const UpdateAvailableBanner: React.ComponentType = __DEV__
  ? () => null
  : require("@/components/system/UpdateAvailableBanner").UpdateAvailableBanner;
// SettingsOverlay is mounted here at the layout level (back from being
// a /profile-overlay route). Sticking it in the route system put iOS
// into modal-stack mode and forced all child screens pushed from inside
// the overlay to slide-from-bottom. As a layout-mounted component it
// renders absolutely over the tabs; child routes (Saved Addresses,
// Payment Methods, etc.) push onto the root Stack normally and use the
// default ios_from_right animation. Open/close is driven by
// useSettingsOverlayStore (open(rect) / close()).

/** Hydrates vehicle and booking stores with Convex data when main tabs are active. */
function HydrateBookingData() {
  useVehicleOwnershipFromConvex();
  useBookingsFromConvex();
  return null;
}

/** Tab pages that show the persistent "Connecting to your car" pill while
 *  any garage vehicle is enriching. Add a path prefix here to toggle the
 *  pill on for another page. Oto (ai-chat) is deliberately left off — the
 *  chat has its own vehicle context UI and the pill would fight it.
 *  Settings is covered for free: it's an overlay above these tab routes
 *  (pathname doesn't change), and the pill renders above it. */
const ENRICHMENT_PILL_PATHS = ["/home", "/bookings", "/cars"];

function MainTabsEnrichmentPill() {
  const pathname = usePathname();
  const show = ENRICHMENT_PILL_PATHS.some((p) => pathname.startsWith(p));
  if (!show) return null;
  // scope "any": a just-added enriching car is usually not the selected
  // one, so the tabs watch the whole garage. Bottom placement hovers the
  // pill above the tab bar, Airbnb-style.
  return <EnrichmentStatusPill placement="bottom" scope="any" />;
}

export default function TabLayout() {
  return (
    <SignedOutMainTabsGuard>
      <ProtectedTabLayout />
    </SignedOutMainTabsGuard>
  );
}

function SignedOutMainTabsGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  const conn = useConnection();
  const { value: me } = useMeFromConvex();
  const rootNavigationState = useRootNavigationState();
  // `stale` is typed as always-false, but it is true at runtime while the
  // navigator rehydrates — navigating then throws, so widen the type to read it.
  const navStale = (rootNavigationState as { stale?: boolean } | undefined)?.stale === true;
  const navReady = Boolean(rootNavigationState?.key) && !navStale;
  const [finishedLaterFlag, setFinishedLaterFlag] = useState<boolean | null>(null);
  const [hasShownApp, setHasShownApp] = useState(false);

  // "Finish later" is also recorded on the device, as a fallback for when the
  // server flag could not be written. app/index honours it, so this must too,
  // or the two would bounce the user between Home and setup.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    SecureStore.getItemAsync(getOnboardingFinishedLaterKey(userId))
      .then((value) => {
        if (!cancelled) setFinishedLaterFlag(value === "true");
      })
      .catch(() => {
        if (!cancelled) setFinishedLaterFlag(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const access = getMainTabsAccess({
    isLoaded,
    isSignedIn,
    me,
    convexAuthenticated,
    offline: conn === "offline",
    finishedLaterFlag,
  });

  // Redirect only when the tabs were REACHED blocked — a direct link such as
  // otopair://home opened while signed out or before the required setup is
  // done, where app/index never ran. If the tabs were showing and then became
  // blocked, that is a runtime logout and SettingsContent.tsx owns the
  // navigation; redirecting here as well is what used to cause the
  // double-screen and "navigate before mounting" errors, so this stays out.
  useEffect(() => {
    if (access === "allow") {
      setHasShownApp(true);
      return;
    }
    if (hasShownApp || !navReady) return;
    try {
      if (access === "signedOut") {
        router.replace("/(onboarding)");
      } else if (access === "setupIncomplete") {
        router.replace({ pathname: "/(onboarding)", params: { isResumeMode: "true" } });
      }
    } catch (e) {
      // Navigator mid-rehydration; the effect re-runs once navReady settles.
      console.warn("[main-tabs guard] navigation not ready:", e);
    }
  }, [access, hasShownApp, navReady]);

  // Once the tabs have been shown in this mount, only a sign-out hides them
  // again — as before this guard learned about setup. A slow or missing
  // account record must never blank out someone already using the app.
  const show = access === "allow" || (hasShownApp && access !== "signedOut");
  if (!show) return null;

  return <>{children}</>;
}

function ProtectedTabLayout() {
  const isIOS26OrNewer =
    Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

  // Plain red-dot indicator on the Bookings tab — matches the trophy
  // and bell dots so the visual language stays consistent. Native iOS
  // renders a dot when `<Badge>` is given empty children.
  const unseenBookingsCount = useUnseenBookingsCount();
  const showBookingsBadge = unseenBookingsCount > 0;

  // Use custom tab bar for Android and iOS <= 25.
  if (!isIOS26OrNewer) {
    return (
      <CoachProvider>
        <HydrateBookingData />
        <OfflinePreload />
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
            // Android: a visited tab stays mounted, so Cars and Bookings
            // kept re-rendering on every Convex push while Home was in
            // front (Cars alone is ~4,000 lines and re-runs a dozen
            // queries). Freezing a blurred tab suspends its renders until
            // it comes back, where it catches up in one pass.
            freezeOnBlur: Platform.OS === "android",
          }}
        >
          {/* Labels come from TAB_ITEMS so this bar and the NativeTabs one
              below can't drift — "My Cars" here versus "Cars" there was
              exactly that drift. */}
          {TAB_ITEMS.map((t) => (
            <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
          ))}
          <Tabs.Screen
            name="index"
            options={{
              href: null,
            }}
          />
        </Tabs>
        <NotificationsSheet />
        <RescheduleDecisionOverlay />
        <SettingsOverlay />
        <UpdateAvailableBanner />
        <MainTabsEnrichmentPill />
        <CoachTour />
      </CoachProvider>
    );
  }

  return (
    <CoachProvider>
      <HydrateBookingData />
      <OfflinePreload />
      {/* Same TAB_ITEMS list the custom bar above uses — order, labels and
          glyph pairing live in one place. `drawable` is intentionally absent:
          this branch only ever runs on iOS 26+, so an Android drawable name
          here was dead config that read as parity without providing it. */}
      <NativeTabs>
        {TAB_ITEMS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <Icon sf={t.sf} />
            <Label>{t.label}</Label>
            {t.name === "bookings" && showBookingsBadge ? (
              <Badge>{" "}</Badge>
            ) : null}
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
      <NotificationsSheet />
      <RescheduleDecisionOverlay />
      <SettingsOverlay />
      <UpdateAvailableBanner />
      <MainTabsEnrichmentPill />
      <CoachTour />
    </CoachProvider>
  );
}
