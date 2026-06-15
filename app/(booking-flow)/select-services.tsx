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

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow, SurfaceColors } from "@/constants/theme";
import { useBookingFlowMap } from "@/components/booking-flow/BookingFlowMap";
import { CategoryListRow } from "@/components/booking-flow/CategoryListRow";
import { GlassSheetHandle } from "@/components/booking-flow/GlassSheet";
import { HeroCardClosestShop } from "@/components/booking-flow/HeroCardClosestShop";
import { HeroCardMostBooked } from "@/components/booking-flow/HeroCardMostBooked";
import { QuickBookRow } from "@/components/booking-flow/QuickBookRow";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
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

// Per Ahmad's PM: drop-where-you-release behavior. gorhom's
// snap-to-nearest with velocity fling kept throwing the sheet to
// the max even on a tiny upward drag, so we replace the library
// here with a minimal Pan + Reanimated drag that just clamps the
// sheet height to [MIN_H, MAX_H] and leaves it there.
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_H = SCREEN_HEIGHT * 0.23;
const MAX_H = SCREEN_HEIGHT * 1.0;
const INITIAL_H = SCREEN_HEIGHT * 0.92;

export default function SelectServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const availableServices = useBookingStore((s) => s.availableServices);
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

  // Sheet height in pixels — driven by the Pan gesture below. Mounts
  // already at INITIAL_H: the screen enters via the stack's cross-fade
  // over the shared static map, so re-animating the sheet up from 0 on
  // every screen entry only fought that transition. User can drag up
  // to MAX_H (full screen) or down to MIN_H; release-where-you-let-go
  // behavior (no snap).
  const sheetHeight = useSharedValue(INITIAL_H);
  const startHeight = useSharedValue(0);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        // 20pt threshold so taps on the X / search / vehicle puck
        // (sitting inside the drag chrome) never get swallowed by
        // the pan handler — only deliberate swipes win.
        .activeOffsetY([-20, 20])
        .onBegin(() => {
          startHeight.value = sheetHeight.value;
        })
        .onUpdate((e) => {
          const next = startHeight.value - e.translationY;
          sheetHeight.value = Math.max(MIN_H, Math.min(MAX_H, next));
        }),
    [sheetHeight, startHeight],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  // Shared persistent map (lives in the layout) — this screen uses it
  // as a locked backdrop. Re-assert locked mode + recenter on every
  // focus so coming back from the interactive choose-mechanic screen
  // resets the camera.
  const { setInteractive, setMarkers, mapRef, region } = useBookingFlowMap();
  useFocusEffect(
    useCallback(() => {
      setInteractive(false);
      setMarkers([]);
      if (region) mapRef.current?.animateToRegion(region, 300);
    }, [setInteractive, setMarkers, mapRef, region]),
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
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Map is the shared persistent backdrop rendered by the layout;
          this screen only paints its sheet over it. */}

      {/* Custom free-drag sheet — stays exactly where the user lets
          go. Pan gesture covers the whole sheet so dragging from
          anywhere (handle or content) works. */}
      <GestureDetector gesture={dragGesture}>
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GlassSheetHandle />
          <View
            style={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 32 },
            ]}
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

          {/* Hero pair */}
          <View style={styles.heroRow}>
            <HeroCardClosestShop />
            <HeroCardMostBooked />
          </View>

          {/* Category list */}
          <View style={styles.list}>
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
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 32,
    flex: 1,
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
    backgroundColor: "#F1F5F9",
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
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 22,
    boxShadow: CardShadow.default,
    overflow: "hidden",
    marginBottom: 22,
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
