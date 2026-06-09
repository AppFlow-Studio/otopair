/**
 * Screen 3 · Choose Mechanic — booking-flow.
 *
 * Map is the full-bleed canvas. Bottom sheet hosts a horizontal-
 * paged carousel of nearby shops (closest first, "covers all
 * selected services" prioritized). As the user swipes between
 * pages, the map camera animates to the active shop and the
 * mechanic selection resets (mechanics are per-shop). Sticky
 * Continue at the bottom shows "Continue with <Any | Name>" for
 * the active shop's choice and pushes shopId + mechanicId to
 * Screen 4.
 *
 * Spec: ~/Downloads/<figma frames> Screen 3 + Ahmad's per-page
 * swipe interaction.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from "react-native-maps";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { ArrowLeft, Crosshair, Minus, Plus } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { MapShopCard } from "@/components/booking-flow/MapShopCard";
import { ShopPage } from "@/components/booking-flow/ShopPage";
import { StickyContinueBar } from "@/components/booking-flow/StickyContinueBar";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useNearbyBookingShops } from "@/hooks/useNearbyBookingShops";
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useBookingStore } from "@/stores/useBookingStore";

const FALLBACK_REGION: Region = {
  latitude: 41.1959,
  longitude: -73.4365,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const SNAP_POINTS = ["52%", "82%"] as const;

export default function ChooseMechanicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);

  const { results: nearbyShops, isLoading: shopsLoading } = useNearbyBookingShops(5);

  // Active page index = which shop the user is currently viewing.
  const [activeIndex, setActiveIndex] = useState(0);
  const activeShop = nearbyShops[activeIndex]?.shop ?? null;

  // Per-shop mechanic selection — null = Any. Reset when the active
  // shop changes; mechanics are scoped to a shop.
  const [selectedMechanicByShop, setSelectedMechanicByShop] = useState<
    Record<string, string | null>
  >({});
  const selectedMechanicId = activeShop
    ? selectedMechanicByShop[activeShop.id] ?? null
    : null;

  const allMechanicsMap = useMechanicStore((s) => s.mechanics);
  const selectedMechanic = selectedMechanicId
    ? allMechanicsMap[selectedMechanicId] ?? null
    : null;
  const continueLabel = `Continue with ${selectedMechanic?.name ?? "Any"}`;

  // Map setup
  const userLocation = useBookingStore((s) => s.userLocation);
  const [region, setRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setRegion(FALLBACK_REGION);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        });
      } catch {
        if (!cancelled) setRegion(FALLBACK_REGION);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Animate the map camera to the active shop whenever it changes.
  // Center on the shop with a fixed neighborhood-scale zoom (~1mi
  // visible) rather than trying to frame user + shop together —
  // shops can be far from the user in dev data, and an auto-fit
  // would zoom out continent-scale.
  useEffect(() => {
    if (!activeShop || !mapRef.current) return;
    if (activeShop.latitude === 0 && activeShop.longitude === 0) return;
    mapRef.current.animateToRegion(
      {
        latitude: activeShop.latitude,
        longitude: activeShop.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      },
      450,
    );
  }, [activeShop]);

  // Selection summary — shared across all pages (it's about the
  // user's cart, not the per-shop view).
  const { selectedCount, totalMinutes, partsEstimate, laborHoursTotal } =
    useMemo(() => {
      let mins = 0;
      let parts = 0;
      let laborH = 0;
      const selectedSvcs = availableServices.filter((s) =>
        selectedServiceIds.includes(s.id),
      );
      for (const svc of selectedSvcs) {
        const h = svc.default_labor_hours ?? 0;
        mins += Math.round(h * 60);
        laborH += h;
        parts += svc.default_parts_estimate ?? 0;
      }
      return {
        selectedCount: selectedSvcs.length,
        totalMinutes: mins,
        partsEstimate: parts,
        laborHoursTotal: laborH,
      };
    }, [availableServices, selectedServiceIds]);

  // Horizontal-paged scroll handler. Pages snap by screen width so
  // every page lines up edge-to-edge inside the sheet.
  const onPageChange = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  }, []);

  // Active-shop derivations for the floating MapShopCard. Mirrors
  // the math inside ShopPage so the card stays in sync as the user
  // swipes between shops.
  const activeFlatEstimate = useMemo(() => {
    if (!activeShop) return null;
    const rate = activeShop.labor_rate ?? 0;
    return Math.round(rate * laborHoursTotal + partsEstimate);
  }, [activeShop, laborHoursTotal, partsEstimate]);

  const activePriceRange = useMemo(() => {
    if (activeFlatEstimate == null || activeFlatEstimate <= 0) return null;
    const low = Math.round(activeFlatEstimate * 0.9);
    const high = Math.round(activeFlatEstimate * 1.1);
    if (low === high) return `~$${low}`;
    return `~$${low} – $${high}`;
  }, [activeFlatEstimate]);

  const { slots: activeShopSlots } = useNextAvailabilityForShop(
    activeShop?.id ?? null,
    null,
    1,
  );
  const activeNextSlotLabel = useMemo(() => {
    if (activeShopSlots.length === 0) return null;
    const s = activeShopSlots[0];
    return `Next: ${s.dayOfWeek} ${s.time}`;
  }, [activeShopSlots]);

  const activeDistanceMi = nearbyShops[activeIndex]?.distanceMi ?? 0;

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(booking-flow)/select-services");
  };

  const onContinue = () => {
    if (!activeShop) return;
    router.push({
      pathname: "/(booking-flow)/pick-datetime",
      params: {
        shopId: activeShop.id,
        mechanicId: selectedMechanicId ?? "",
      },
    });
  };

  return (
    <View style={styles.root}>
      {/* Full-bleed map */}
      <View style={StyleSheet.absoluteFill}>
        {region ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={region}
            showsUserLocation
          >
            {activeShop && activeShop.latitude !== 0 ? (
              <Marker
                coordinate={{
                  latitude: activeShop.latitude,
                  longitude: activeShop.longitude,
                }}
                title={activeShop.name}
              />
            ) : null}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
        )}
      </View>

      {/* Top floating chrome */}
      <View
        style={[styles.topStack, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerPill}>
          <Pressable
            style={styles.iconBtn}
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#1F2937" strokeWidth={2} />
          </Pressable>
          <Text size="md" weight="bold" color="#0F172A" style={styles.headerTitle}>
            Choose Mechanic
          </Text>
          <VehiclePuck />
        </View>
      </View>

      {/* Floating glassy shop card — syncs to the active shop. */}
      {activeShop ? (
        <View style={styles.shopCardWrap} pointerEvents="box-none">
          <MapShopCard
            shopId={activeShop.id}
            shopName={activeShop.name}
            rating={activeShop.rating}
            distanceMi={activeDistanceMi}
            priceRange={activePriceRange}
            nextSlotLabel={activeNextSlotLabel}
          />
        </View>
      ) : null}

      {/* Floating right rail — visual only for Phase 3 */}
      <View style={[styles.rightRail, { top: insets.top + 200 }]} pointerEvents="box-none">
        <Pressable style={styles.railBtn} accessibilityLabel="Zoom in">
          <Plus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable style={styles.railBtn} accessibilityLabel="Zoom out">
          <Minus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable style={styles.railBtn} accessibilityLabel="Recenter">
          <Crosshair size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Bottom sheet — plain white. Horizontal-paged ShopPage
          carousel lives inside it; vertical drag of the handle still
          resizes the sheet (gorhom's vertical pan + our horizontal
          ScrollView don't conflict). */}
      <BottomSheet
        snapPoints={SNAP_POINTS as unknown as string[]}
        index={0}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandleIndicator}
      >
        <BottomSheetView
          style={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
        >
          {nearbyShops.length === 0 ? (
            <View style={styles.empty}>
              <Text size="md" weight="medium" color="#9CA3AF" center>
                {shopsLoading ? "Finding shops near you…" : "No shops available."}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPageChange}
              decelerationRate="fast"
            >
              {nearbyShops.map((r) => (
                <ShopPage
                  key={r.shop.id}
                  shop={r.shop}
                  pageWidth={SCREEN_WIDTH}
                  totalMinutes={totalMinutes}
                  partsEstimate={partsEstimate}
                  laborHoursTotal={laborHoursTotal}
                  selectedCount={selectedCount}
                  selectedMechanicId={
                    selectedMechanicByShop[r.shop.id] ?? null
                  }
                  onSelectMechanic={(mId) =>
                    setSelectedMechanicByShop((prev) => ({
                      ...prev,
                      [r.shop.id]: mId,
                    }))
                  }
                />
              ))}
            </ScrollView>
          )}

          {/* Page indicator dots */}
          {nearbyShops.length > 1 ? (
            <View style={styles.dots}>
              {nearbyShops.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeIndex ? styles.dotActive : null,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>

      <StickyContinueBar count={1} label={continueLabel} onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  mapFallback: {
    backgroundColor: "#C8D7DE",
  },
  topStack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  shopCardWrap: {
    position: "absolute",
    top: "30%",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  rightRail: {
    position: "absolute",
    right: 14,
    gap: 8,
  },
  railBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandleIndicator: {
    backgroundColor: "rgba(15, 23, 42, 0.2)",
    width: 44,
  },
  sheetContent: {
    flex: 1,
    paddingTop: 0,
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  dotActive: {
    backgroundColor: "#0F172A",
    width: 18,
  },
});

