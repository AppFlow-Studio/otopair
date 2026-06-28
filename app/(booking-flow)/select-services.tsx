/**
 * Screen 1 · Select Services — booking-flow entry.
 *
 * Full-bleed map underneath, draggable `@gorhom/bottom-sheet` over
 * it with the same 4 snap points the legacy ServiceBottomSheet used
 * (23 / 38 / 55 / 98%). Glass styling supplied through gorhom's
 * backgroundComponent + handleComponent slots so the frosted blue
 * animates in sync with snap transitions.
 *
 * Sheet content (BottomSheetScrollView):
 *  - close + search + vehicle puck top row
 *  - "Select Services" + subtitle
 *  - 2 hero cards (Closest Shop + Most Booked)
 *  - 4 category list rows (v5 tabs)
 *  - Quick Book horizontal chip row at the bottom
 *
 * Spec: ~/Downloads/<figma frames> Screen 1.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow } from "@/constants/theme";
import { useBookingFlowMap } from "@/components/booking-flow/BookingFlowMap";
import { CategoryListRow } from "@/components/booking-flow/CategoryListRow";
import { GlassSheetHandle } from "@/components/booking-flow/GlassSheet";
import { HeroCardClosestShop } from "@/components/booking-flow/HeroCardClosestShop";
import { HeroCardMostBooked } from "@/components/booking-flow/HeroCardMostBooked";
import { MapBrowseShopCard } from "@/components/booking-flow/MapBrowseShopCard";
import { PinnedShopChip } from "@/components/booking-flow/PinnedShopChip";
import { QuickBookRow } from "@/components/booking-flow/QuickBookRow";
import { RatingMarkerPill } from "@/components/booking-flow/RatingMarkerPill";
import { useNearbyBookingShops } from "@/hooks/useNearbyBookingShops";
import { SelectedServicesFab } from "@/components/booking-flow/SelectedServicesFab";
import {
  SelectedServicesSheet,
  type SelectedServicesSheetRef,
} from "@/components/booking-flow/SelectedServicesSheet";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { useToast } from "@/hooks/useToast";
import { useVehicleEnrichmentStatus } from "@/hooks/useVehicleEnrichmentStatus";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { TABS, type TaxonomyTab } from "@/constants/serviceTaxonomy";
import { useBookingStore } from "@/stores/useBookingStore";
import type { ServiceCategory } from "@/stores/types/store.types";

/** Map the legacy `initialServiceCategory` signal (set by home cards /
 *  maintenance / recommendation deep-links pre-v5) onto a v5 tab.
 *  Kept identical to the legacy ServiceSelectionContent mapping so the
 *  same deep-link lands on the same tab in either flow. */
function legacyCategoryToTab(
  category: ServiceCategory | null | undefined,
): TaxonomyTab | null {
  if (!category) return null;
  switch (category) {
    case "basic_maintenance":
      return "routine_upkeep";
    case "tires_wheels":
    case "brakes_suspension":
      return "tires_brakes";
    case "system_diagnostics":
      return "inspections";
    default:
      return null;
  }
}

// Sheet is a fixed-height frosted card by default — the content
// inside scrolls. Two heights:
//   - SHEET_H_FULL: default open state (search-entry path + after
//     the user expands the peek).
//   - SHEET_H_PEEK: low peek shown when the user enters via the
//     map button on Home. Map underneath is interactive so they
//     can pan around looking for shops; a tap on the sheet
//     animates it up to full.
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const SHEET_H_FULL = SCREEN_HEIGHT * 0.92;
const SHEET_H_PEEK = SCREEN_HEIGHT * 0.18;

export default function SelectServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  // Peek mode: home's Map button passes `?entry=map` so the picker
  // mounts low and lets the user interact with the map first. They
  // tap the sheet to expand into the normal full-picker UI.
  const isPeekEntry = entry === "map";
  const [isPeekExpanded, setIsPeekExpanded] = useState(!isPeekEntry);
  const sheetHeight = useSharedValue(
    isPeekEntry ? SHEET_H_PEEK : SHEET_H_FULL,
  );
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));
  const expandPeekSheet = useCallback(() => {
    if (isPeekExpanded) return;
    // Timing curve instead of a spring — the spring's slight
    // overshoot at the top of the sheet read as a "jump" once the
    // sheet hit its full height. A monotonic ease-out lands cleanly.
    sheetHeight.value = withTiming(SHEET_H_FULL, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
    setIsPeekExpanded(true);
  }, [isPeekExpanded, sheetHeight]);
  // Mirror — swipe the expanded sheet back down to peek so the user
  // can re-reveal the rating pins on the map (ChatGPT-style). Same
  // timing curve as expand so the motion reads as one continuous
  // tween in either direction.
  const collapsePeekSheet = useCallback(() => {
    if (!isPeekExpanded) return;
    sheetHeight.value = withTiming(SHEET_H_PEEK, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
    setIsPeekExpanded(false);
  }, [isPeekExpanded, sheetHeight]);

  // Vertical-only Pan gesture that fires `collapsePeekSheet` on a
  // clean downward swipe (>= 60pt translation). We don't drive
  // sheetHeight continuously off the gesture — that was the
  // jumpy-feeling shape we ripped out a few iterations ago. Just a
  // discrete "user wants peek" signal.
  const collapsePanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-20, 20])
        .onEnd((e) => {
          "worklet";
          if (e.translationY > 60) {
            runOnJS(collapsePeekSheet)();
          }
        }),
    [collapsePeekSheet],
  );

  // Rating-pin shop list for the LOCAL MapView in peek mode. We
  // re-use the same hook choose-mechanic uses; it's free of side
  // effects on its own (the booking-flow Stack stays mounted in
  // either case).
  //
  // `selectedShopId` doubles as the visual-select signal for the
  // map pins AND the page index for the browse-card carousel
  // mounted above the peek sheet. Pin tap → setSelectedShopId →
  // useEffect scrolls the carousel; carousel swipe → setSelectedShopId
  // → marker `tracksViewChanges` flips the pill to selected.
  const { results: nearbyShops } = useNearbyBookingShops(5);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const browseScrollRef = useRef<ScrollView | null>(null);
  // Local map ref so the camera can pan to the selected shop as
  // the user swipes the carousel. Same pattern choose-mechanic
  // uses for its sheet's internal pager.
  const localMapRef = useRef<MapView | null>(null);
  const selectedIndex = useMemo(() => {
    if (!selectedShopId) return 0;
    const i = nearbyShops.findIndex((r) => r.shop.id === selectedShopId);
    return i >= 0 ? i : 0;
  }, [selectedShopId, nearbyShops]);
  // Pin tap / selectedShopId change → scroll the browse carousel to
  // match. Skip when the carousel hasn't mounted yet (peek mode is
  // gated on isPeekEntry && !isPeekExpanded).
  useEffect(() => {
    browseScrollRef.current?.scrollTo({
      x: selectedIndex * SCREEN_WIDTH,
      animated: true,
    });
  }, [selectedIndex]);
  // Pan the camera to the selected shop. Fixed neighborhood-scale
  // zoom (~1mi) — same magic number choose-mechanic uses for its
  // default. Skipping when the shop has no real coords (dev
  // fixtures) so we don't fly to (0, 0).
  useEffect(() => {
    const r = nearbyShops[selectedIndex];
    if (!r || !localMapRef.current) return;
    const { latitude, longitude } = r.shop;
    if (latitude === 0 && longitude === 0) return;
    localMapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      },
      450,
    );
  }, [selectedIndex, nearbyShops]);
  const onBrowsePageChange = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const shop = nearbyShops[idx]?.shop;
      if (shop) setSelectedShopId(shop.id);
    },
    [nearbyShops],
  );

  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const initialServiceCategory = useBookingStore((s) => s.initialServiceCategory);
  const setInitialServiceCategory = useBookingStore(
    (s) => s.setInitialServiceCategory,
  );

  // Deep-link seeding. Home cards / maintenance / recommendation entries
  // seed the booking store with a target category (and often a
  // pre-selected service) before navigating here. When such intent is
  // present, skip the landing and drop straight onto the matching
  // category screen — `selectedServiceIds` carry through and render
  // already-checked there (category/[tab] reads them). Fires once; the
  // one-shot `initialServiceCategory` signal is consumed so a later
  // plain entry (e.g. the Home search field) stays on the landing.
  // Only the EXPLICIT one-shot `initialServiceCategory` signal seeds
  // a category jump. The previous fallback that derived a target
  // tab from `selectedServiceIds` made the cart stickier than
  // intended: once a service was in the cart, every plain entry
  // (Home search, map icon) auto-bounced past Screen 1 — and
  // because back from Screen 2 normalizes to Screen 1, the seed
  // re-fired and the user got trapped in a Screen 1 ↔ Screen 2
  // loop with no way out except clearing the cart.
  const seedHandledRef = useRef(false);
  const reviewSheetRef = useRef<SelectedServicesSheetRef>(null);
  useEffect(() => {
    if (seedHandledRef.current) return;
    const targetTab = legacyCategoryToTab(initialServiceCategory);
    if (!targetTab) return;
    seedHandledRef.current = true;
    setInitialServiceCategory(null);
    router.replace({
      pathname: "/(booking-flow)/category/[tab]",
      params: { tab: targetTab },
    });
  }, [initialServiceCategory, router, setInitialServiceCategory]);

  // Shared persistent map (lives in the layout). Locked backdrop by
  // default, but in peek mode (entered via Home's Map button) it
  // unlocks while the sheet is still low so the user can pan/zoom
  // around looking for shops. Once they tap the peek and the sheet
  // expands, we re-lock so the map doesn't intercept gestures meant
  // for the now-full sheet.
  const { setInteractive, setMarkers, mapRef, region } = useBookingFlowMap();
  const mapShouldBeInteractive = isPeekEntry && !isPeekExpanded;
  useFocusEffect(
    useCallback(() => {
      setInteractive(mapShouldBeInteractive);
      setMarkers([]);
      if (region) mapRef.current?.animateToRegion(region, 300);
    }, [setInteractive, setMarkers, mapRef, region, mapShouldBeInteractive]),
  );
  // Also flip interactivity whenever the peek state changes mid-focus
  // (without waiting for the next focus tick) so tap → expand
  // immediately disables the map underneath.
  useEffect(() => {
    setInteractive(mapShouldBeInteractive);
  }, [setInteractive, mapShouldBeInteractive]);

  // Enrichment-in-progress nudge. If the currently selected vehicle
  // is still being enriched by the v3 pipeline (i.e. server-side
  // booking creation would throw VEHICLE_ENRICHMENT_INCOMPLETE), pop
  // a toast on every focus telling the user to check back in N
  // minutes. Toast-only — no in-screen block per Ahmad. Dedupe by
  // `${vin}:${isInProgress}` so we don't re-fire on tab switches if
  // the underlying state hasn't changed.
  const toast = useToast();
  const selectedVin = useVehicleStore((s) => s.getSelectedVehicle()?.vin ?? null);
  const enrichment = useVehicleEnrichmentStatus(selectedVin);
  const lastEnrichmentToastRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!selectedVin || !enrichment?.isInProgress) {
        // Reset the dedupe key so re-entering with the same vehicle
        // after it finishes & re-starts (very rare) fires fresh.
        lastEnrichmentToastRef.current = null;
        return;
      }
      const dedupeKey = `${selectedVin}:in-progress`;
      if (lastEnrichmentToastRef.current === dedupeKey) return;
      lastEnrichmentToastRef.current = dedupeKey;

      const eta = enrichment.etaMinutes ?? 0;
      const baselineElapsed =
        enrichment.elapsedMs != null && enrichment.elapsedMs > 7 * 60 * 1000;

      // Universal-language pass per Ahmad: "connecting" instead of
      // "enriching" / "prepping" so any user understands what's
      // happening. Body stays informational but trimmed — single
      // short line with the ETA.
      const title = "Still connecting to your car";
      const body = baselineElapsed
        ? "Almost there."
        : `Try again in ~${eta} minute${eta === 1 ? "" : "s"}.`;

      toast.trust(title, body);
    }, [selectedVin, enrichment?.isInProgress, enrichment?.etaMinutes, enrichment?.elapsedMs, toast]),
  );

  // Per-tab service counts from the live catalog. Drops services
  // without a v5 taxonomy entry (the hook already does this) and
  // groups by `tab`.
  const countByTab = useMemo<Record<TaxonomyTab, number>>(() => {
    const counts: Record<TaxonomyTab, number> = {
      routine_upkeep: 0,
      tires_brakes: 0,
      major_service: 0,
      inspections: 0,
    };
    for (const svc of availableServices) {
      if (svc.tab) counts[svc.tab] = (counts[svc.tab] ?? 0) + 1;
    }
    return counts;
  }, [availableServices]);

  const onClose = () => {
    // X = "close the booking flow", NOT "back one step". The
    // previous canGoBack() / router.back() shape walked the user
    // through every intermediate screen the booking-flow stack had
    // accumulated (e.g. Home → search → shop-detail → replaced
    // select-services left both the search screen AND the original
    // select-services below in the stack, so X took two back-taps
    // to reach Home and showed both surfaces flashing past).
    //
    // dismissTo (not replace) pops the entire booking-flow stack and
    // lands on the ALREADY-MOUNTED Home tab — same primitive
    // `app/booking/mechanic/[id]/confirmation.tsx:405` uses for the
    // post-confirm exit. Using replace was forcing Home to unmount
    // + remount, which made the cards re-render in slowly.
    // dismissTo keeps Home's existing instance alive so the cards
    // are already there when the user lands.
    //
    // The Home focus effect on `app/(main-tabs)/home/index.tsx`
    // clears the pre-pinned shop on arrival so the next booking
    // attempt starts fresh.
    router.dismissTo("/(main-tabs)/home");
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Map is normally the shared persistent backdrop from the
          layout, but in peek mode (Home → Map button) we render a
          LOCAL interactive MapView right here inside the screen.
          The layout-level map's touches were being eaten by
          react-navigation's native-stack Card before they could
          fall through to the map sibling — a known quirk of
          UIViewController-based screens absorbing touches at the
          native frame boundary. Mounting the map as a direct child
          of the screen's view tree gives it touches naturally.
          On expand we drop this back to the shared map (the sheet
          covers the area so the map isn't visible anyway). */}
      {isPeekEntry && !isPeekExpanded && region ? (
        <MapView
          ref={localMapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          showsUserLocation
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          rotateEnabled
        >
          {nearbyShops
            .filter((r) => r.shop.latitude !== 0 && r.shop.longitude !== 0)
            .map((r) => (
              <Marker
                key={r.shop.id}
                coordinate={{
                  latitude: r.shop.latitude,
                  longitude: r.shop.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={r.shop.id === selectedShopId}
                onPress={() => setSelectedShopId(r.shop.id)}
              >
                <RatingMarkerPill
                  rating={r.shop.rating}
                  shopName={r.shop.name}
                  isSelected={r.shop.id === selectedShopId}
                />
              </Marker>
            ))}
        </MapView>
      ) : null}

      {/* Browse-card carousel — peek mode only. Sits just above the
          peek sheet so the cards and the "Tap to pick a service"
          handle don't visually compete. Swipe to flip pin
          selection on the map; tap a card → MapBrowseShopCard's
          default route, which is the shop detail page. */}
      {isPeekEntry && !isPeekExpanded ? (
        <View
          style={[styles.browseStrip, { bottom: SHEET_H_PEEK + 16 }]}
          pointerEvents="box-none"
        >
          <ScrollView
            ref={browseScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onBrowsePageChange}
            decelerationRate="fast"
            contentOffset={{ x: selectedIndex * SCREEN_WIDTH, y: 0 }}
          >
            {nearbyShops.map((r) => (
              <View key={r.shop.id} style={styles.browseCardSlot}>
                <MapBrowseShopCard
                  shopId={r.shop.id}
                  shopName={r.shop.name}
                  imageUrl={r.shop.imageUrl}
                  rating={r.shop.rating}
                  category="Auto repair shop"
                  isOpen={r.shop.hasAvailableSlots}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Frosted sheet — fixed height by default, animates from peek
          to full height when the user enters via Home's map button
          and taps the sheet. Content scrolls inside (no Pan gesture
          that resizes the sheet mid-scroll). */}
      <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          {/* Real frosted-glass sheet — same pattern Settings uses
              for its blurred header. On iOS BlurView blurs the
              map underneath; on Android we fall back to a thick
              translucent white since BlurView there is unreliable. */}
          {Platform.OS === "ios" ? (
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, styles.sheetAndroidFallback]}
              pointerEvents="none"
            />
          )}
          {/* GestureDetector wraps just the handle area — a vertical
              swipe-down here collapses the sheet back to peek so the
              user can browse rating pins on the map. The 20pt
              activeOffsetY keeps casual touches on the handle (e.g.
              tap to focus) from kicking off the pan. */}
          <GestureDetector gesture={collapsePanGesture}>
            <View>
              <GlassSheetHandle />
            </View>
          </GestureDetector>
          {/* Peek body — only rendered while the map-entry user
              hasn't tapped to expand. Whole peek is a Pressable so
              the entire visible sheet area is a tap target. Picking
              a separate component instead of an overlay avoids the
              tap conflicting with any nested Pressables (X / search
              icons) since those don't render until after expansion. */}
          {isPeekEntry && !isPeekExpanded ? (
            <Pressable
              onPress={expandPeekSheet}
              style={styles.peekBody}
              accessibilityRole="button"
              accessibilityLabel="Browse services"
              accessibilityHint="Expands the service picker"
            >
              <Text
                size="lg"
                weight="semiBold"
                color="#0F172A"
                style={styles.peekTitle}
              >
                Find shops on the map
              </Text>
              <Text size="sm" weight="regular" color="#6B7280" center>
                Tap to pick a service
              </Text>
            </Pressable>
          ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 32 },
            ]}
            showsVerticalScrollIndicator={false}
          >
          {/* Top control row */}
          <View style={styles.topRow}>
            <Pressable
              style={styles.iconBtn}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
            >
              <X size={20} color="#1F2937" strokeWidth={2} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.iconBtn}
              onPress={() => router.push("/(booking-flow)/search")}
              hitSlop={8}
              accessibilityLabel="Search services"
            >
              <Search size={20} color="#1F2937" strokeWidth={2} />
            </Pressable>
            <View style={{ width: 8 }} />
            <VehiclePuck interactive />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text size="3xl" weight="bold" color="#0F172A" style={styles.title}>
              Select Services
            </Text>
            <Text size="md" weight="regular" color="#6B7280">
              What does your car need?
            </Text>
          </View>

          {/* Pre-pinned shop indicator. Only renders when the user came
              in from the shop-detail Book CTA; tapping the X clears the
              pin in-place so they can switch shops without backing
              out to Home. */}
          <PinnedShopChip />

          {/* Hero pair */}
          <View style={styles.heroRow}>
            <HeroCardClosestShop />
            <HeroCardMostBooked />
          </View>

          {/* Category list */}
          <View style={styles.list}>
            {Platform.OS === "ios" ? (
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
            ) : null}
            {TABS.map((tab, idx) => (
              <View key={tab.key}>
                {idx > 0 ? <View style={styles.divider} /> : null}
                <CategoryListRow
                  tabKey={tab.key}
                  label={tab.label}
                  serviceCount={countByTab[tab.key] ?? 0}
                />
              </View>
            ))}
          </View>

          {/* Quick Book */}
          <View style={styles.quickBookWrap}>
            <QuickBookRow />
          </View>
          </ScrollView>
          )}
      </Animated.View>

      {/* Cart review FAB — same one Screen 2 has so the user can
          see + edit the multi-tab selection from Screen 1 too.
          Bottom-right, count-gated by the FAB itself (renders null
          when count === 0). Screen 1 has no Continue pill below
          it, so we sit a little lower than on Screen 2. */}
      <View
        pointerEvents="box-none"
        style={[styles.fabHost, { bottom: insets.bottom + 24 }]}
      >
        <SelectedServicesFab
          count={selectedServiceIds.length}
          onPress={() => reviewSheetRef.current?.open()}
        />
      </View>

      <SelectedServicesSheet ref={reviewSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  fabHost: {
    position: "absolute",
    right: 16,
    // `bottom` is set inline from insets. pointerEvents: 'box-none'
    // on the host so empty space around the FAB doesn't block sheet
    // taps underneath.
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  browseStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    // `bottom` is set inline from SHEET_H_PEEK so the carousel
    // sits just above the peek sheet's top edge.
  },
  browseCardSlot: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
  },
  sheetAndroidFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 32,
    flex: 1,
  },
  peekBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 16,
    gap: 6,
  },
  peekTitle: {
    textAlign: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 6,
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  list: {
    marginHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    overflow: "hidden",
    marginBottom: 22,
    boxShadow: CardShadow.default,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(15, 23, 42, 0.07)",
    marginHorizontal: 16,
  },
  quickBookWrap: {
    marginBottom: 8,
  },
});
