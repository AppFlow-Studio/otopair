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
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { EnrichmentStatusPill } from "@/components/booking-flow/EnrichmentStatusPill";
import { TabBar } from "@/components/navigation/TabBar";
import { TAB_ITEMS } from "@/components/navigation/tabItems";
import { useBookingsFromConvex } from "@/hooks/useBookingsFromConvex";
import { useUnseenBookingsCount } from "@/hooks/useUnseenBookingsCount";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { NotificationsSheet } from "@/components/notifications/NotificationsSheet";
import { RescheduleDecisionOverlay } from "@/components/notifications/RescheduleDecisionOverlay";
import { shouldRedirectSignedOutFromMainTabs } from "@/lib/auth-routing";
import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
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
  const { isLoaded, isSignedIn } = useAuth();
  const shouldRedirect = shouldRedirectSignedOutFromMainTabs(isLoaded, isSignedIn);

  // Render null to protect main-tabs content when signed out. Navigation to
  // onboarding is handled exclusively by app/index.tsx (cold start) and
  // SettingsContent.tsx (runtime logout) to prevent competing router.replace
  // calls that cause double-screen and "navigate before mounting" errors.
  if (!isLoaded || shouldRedirect) {
    return null;
  }

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
      <>
        <HydrateBookingData />
        <OfflinePreload />
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
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
      </>
    );
  }

  return (
    <>
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
    </>
  );
}
