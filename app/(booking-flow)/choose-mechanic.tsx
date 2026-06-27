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
import { useFocusEffect, useNavigation } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { ArrowLeft, Crosshair, Minus, Plus } from "lucide-react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { Text } from "@/components/shared-ui";
import { useBookingFlowMap } from "@/components/booking-flow/BookingFlowMap";
import { MapShopCard } from "@/components/booking-flow/MapShopCard";
import { RatingMarkerPill } from "@/components/booking-flow/RatingMarkerPill";
import { ShopPage } from "@/components/booking-flow/ShopPage";
import { StickyContinueBar } from "@/components/booking-flow/StickyContinueBar";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { distanceBetween } from "@/utils/geo";
import { useNearbyBookingShops } from "@/hooks/useNearbyBookingShops";
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useBookingLaborHoursMap } from "@/hooks/useBookingLaborHoursMap";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { useShopFixedPricesForServices } from "@/hooks/useShopFixedPricesForServices";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { buildShopPriceLabel } from "@/lib/shopPriceLabel";

const SCREEN_WIDTH = Dimensions.get("window").width;
// Three snap points: low peek (~12% — handle visible, map fully
// revealed for the ChatGPT-style "browse pins" mode), standard
// (~53%, the historical default that fits the active shop card +
// mechanic strip), and expanded (~82% for scrolling reviews etc).
// Initial index = 1 so the standard view is what users land on; 0
// is reached only via a deliberate swipe-down.
const SNAP_POINTS = ["12%", "53%", "82%"] as const;

export default function ChooseMechanicScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedServiceOptions = useBookingStore((s) => s.selectedServiceOptions);
  // Pre-pinned shop from the shop-detail "Book a Service" CTA. When
  // set, the carousel below filters down to JUST this shop so the
  // user lands on the shop they came in for. Cleared via
  // `clearPreSelections` (booking store) on flow reset.
  const preSelectedShopId = useBookingStore((s) => s.preSelectedShopId);
  const ownershipId = useVehicleStore((s) => s.getSelectedVehicle())?.ownershipId;

  // Engine-adjusted + director-rounded labor (empirical → book →
  // engine-tier → catalog-default) — same source as Review & Pay so the
  // estimate breakdown on each shop page matches what the customer pays.
  const { laborHoursMap } = useBookingLaborHoursMap(ownershipId, selectedServiceIds);

  // Real per-vehicle OEM parts totals (winning fitments × unit price) — the
  // same source as Review & Pay. Without this the estimate is labor-only,
  // because the catalog `default_parts_estimate` fallback is ~$0 for most
  // parts-bearing services (e.g. spark plugs).
  const { breakdown: pricedPartsByService } = useBookingPartsBreakdown(
    ownershipId,
    selectedServiceIds,
    selectedServiceOptions,
  );
  const realPartsCostMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of pricedPartsByService) {
      if (row.winner !== null && row.partsTotal > 0) {
        m.set(String(row.serviceId), row.partsTotal);
      }
    }
    return m;
  }, [pricedPartsByService]);

  const selectedServices = useMemo(
    () => availableServices.filter((s) => selectedServiceIds.includes(s.id)),
    [availableServices, selectedServiceIds],
  );

  // Overlay the real OEM parts total onto each service so the price band
  // (buildShopPriceLabel → deriveDisclosedRange) brackets the actual parts
  // cost rather than the ~$0 catalog default. Falls back to the default when
  // the resolver has no winner (unenriched vehicle/service).
  const selectedServicesForPricing = useMemo(
    () =>
      selectedServices.map((s) => {
        const realParts = realPartsCostMap.get(String(s.id));
        return realParts != null
          ? { ...s, default_parts_estimate: realParts }
          : s;
      }),
    [selectedServices, realPartsCostMap],
  );

  const { results: nearbyResults, isLoading: shopsLoading } = useNearbyBookingShops(5);
  const getShopById = useShopStore((s) => s.getShopById);
  const userLocationForDistance = useBookingStore((s) => s.userLocation);

  // When the user entered via the shop-detail Book CTA, the booking
  // store has `preSelectedShopId` set — surface that shop as the
  // FIRST page of the swipe deck, but keep the rest of the nearby
  // shops available so the user can still browse alternatives.
  //
  // Two sub-cases for sourcing the pinned shop's NearbyShopResult:
  //   1. It's already in the top-5 nearby (the common case) — pull
  //      it out of nearbyResults so distance + coversAll stay
  //      accurate, then put it at index 0 with the others behind.
  //   2. It isn't in the top-5 (user searched a far-away shop) —
  //      synthesize a NearbyShopResult from useShopStore +
  //      userLocation so the pinned shop still surfaces, then
  //      append the regular nearby list behind it.
  const KM_PER_MI = 1.609344;
  const nearbyShops = useMemo(() => {
    if (!preSelectedShopId) return nearbyResults;
    const matchInNearby = nearbyResults.find((r) => r.shop.id === preSelectedShopId);
    if (matchInNearby) {
      // Move the matched shop to the front, keep the rest in order.
      const rest = nearbyResults.filter((r) => r.shop.id !== preSelectedShopId);
      return [matchInNearby, ...rest];
    }
    const shop = getShopById(preSelectedShopId);
    if (!shop) return nearbyResults;
    const km =
      userLocationForDistance && shop.latitude !== 0 && shop.longitude !== 0
        ? distanceBetween(
            { latitude: userLocationForDistance.latitude, longitude: userLocationForDistance.longitude },
            { latitude: shop.latitude, longitude: shop.longitude },
          )
        : null;
    const coversAll =
      selectedServiceIds.length === 0
        ? true
        : selectedServiceIds.every((sid) => shop.serviceIds.includes(sid));
    const synthesized = {
      shop,
      distanceMi: km != null ? km / KM_PER_MI : 0,
      coversAll,
    };
    return [synthesized, ...nearbyResults];
  }, [nearbyResults, preSelectedShopId, getShopById, userLocationForDistance, selectedServiceIds]);

  // Active page index = which shop the user is currently viewing.
  const [activeIndex, setActiveIndex] = useState(0);
  const activeShop = nearbyShops[activeIndex]?.shop ?? null;

  // Per-(shop, service, tier) flat-price overrides for the active shop.
  // When a service is offered at a fixed rate the price renders as a
  // single guaranteed `$N` instead of an estimate range.
  const { map: activeFixedMap } = useShopFixedPricesForServices(
    activeShop?.id ?? null,
    ownershipId ?? null,
    selectedServiceIds,
  );
  const activePriceLabel = useMemo(
    () =>
      activeShop
        ? buildShopPriceLabel({
            shop: activeShop,
            selectedServices: selectedServicesForPricing,
            laborHoursMap,
            fixedPriceMap: activeFixedMap,
          })
        : { text: null, isFixed: false },
    [activeShop, selectedServicesForPricing, laborHoursMap, activeFixedMap],
  );

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
  // When the user arrives with an empty cart (e.g. the Home map-browse
  // entry), the sheet doubles as a shop browser and the CTA becomes a
  // "pick services" affordance instead of advancing to date/time.
  const hasServices = selectedServiceIds.length > 0;
  const continueLabel = hasServices
    ? `Continue with ${selectedMechanic?.name ?? "Any"}`
    : "Select services";

  // Map setup. We mount a LOCAL MapView as a direct child of this
  // screen (see render below) instead of driving the shared
  // persistent map — same fix select-services peek mode uses. The
  // shared map's MapView sits behind react-navigation's native-stack
  // Card, which absorbs finger gestures at the UIViewController
  // frame boundary on iOS, so pan/zoom never reaches the shared
  // map even with the `box-none` chain in place. A local MapView
  // sidesteps that.
  //
  // `region` from the booking-flow context is still our source of
  // truth for the initial camera so the shared map and the local
  // map line up if the user ever sees both during a transition.
  const userLocation = useBookingStore((s) => s.userLocation);
  const { setInteractive, setMarkers, setShopPins, region } = useBookingFlowMap();
  const mapRef = useRef<MapView | null>(null);
  // Ref to the paged carousel ScrollView so a pin tap can scroll
  // the bottom sheet to that shop's page (the reverse direction of
  // the existing swipe → setActiveIndex flow).
  const pagerScrollRef = useRef<ScrollView | null>(null);

  // Lock the SHARED map down (no touches, no pins) so it doesn't
  // compete with the local MapView for gestures or render duplicate
  // markers. Other booking-flow screens reset this on their own
  // focus effects.
  useFocusEffect(
    useCallback(() => {
      setInteractive(false);
      setMarkers([]);
      setShopPins([]);
    }, [setInteractive, setMarkers, setShopPins]),
  );

  // Tap a rating pin on the map → swap the active shop, scroll the
  // carousel below to that shop's page, and re-render the pins so
  // the new shop's pill goes black. The camera-pan effect further
  // down already fires off activeIndex changes (~line 258), so we
  // don't need to call mapRef directly here.
  const onPinTap = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= nearbyShops.length) return;
      setActiveIndex(idx);
      pagerScrollRef.current?.scrollTo({
        x: idx * SCREEN_WIDTH,
        animated: true,
      });
    },
    [nearbyShops.length],
  );

  // Pin rendering moved onto the local MapView in the render block —
  // no need to push pins through the shared BookingFlowMap context.

  // Animate the map camera to the active shop whenever it changes.
  // Center on the shop with a fixed neighborhood-scale zoom (~1mi
  // visible) rather than trying to frame user + shop together —
  // shops can be far from the user in dev data, and an auto-fit
  // would zoom out continent-scale.
  //
  // Zoom delta is tracked in a ref so the +/- rail buttons can
  // mutate the zoom without re-triggering the shop-swipe effect.
  // The effect uses whatever the current ref value is so a user
  // who's zoomed in stays zoomed in across shops.
  const DEFAULT_DELTA = 0.035;
  const MIN_DELTA = 0.002;
  const MAX_DELTA = 1.0;
  const zoomDeltaRef = useRef(DEFAULT_DELTA);

  useEffect(() => {
    if (!activeShop || !mapRef.current) return;
    if (activeShop.latitude === 0 && activeShop.longitude === 0) return;
    mapRef.current.animateToRegion(
      {
        latitude: activeShop.latitude,
        longitude: activeShop.longitude,
        latitudeDelta: zoomDeltaRef.current,
        longitudeDelta: zoomDeltaRef.current,
      },
      450,
    );
  }, [activeShop]);

  const animateZoom = useCallback(
    (factor: number) => {
      if (!mapRef.current || !activeShop) return;
      const next = Math.min(
        MAX_DELTA,
        Math.max(MIN_DELTA, zoomDeltaRef.current * factor),
      );
      zoomDeltaRef.current = next;
      mapRef.current.animateToRegion(
        {
          latitude: activeShop.latitude,
          longitude: activeShop.longitude,
          latitudeDelta: next,
          longitudeDelta: next,
        },
        220,
      );
    },
    [activeShop],
  );

  const onZoomIn = useCallback(() => animateZoom(0.5), [animateZoom]);
  const onZoomOut = useCallback(() => animateZoom(2), [animateZoom]);

  const onRecenter = useCallback(() => {
    if (!mapRef.current) return;
    // Crosshair = "where am I" — prefer the user's coords. If we
    // don't have them (permission denied / not yet resolved), fall
    // back to recentering on the active shop at default zoom.
    zoomDeltaRef.current = DEFAULT_DELTA;
    if (userLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        320,
      );
      return;
    }
    if (activeShop && activeShop.latitude !== 0) {
      mapRef.current.animateToRegion(
        {
          latitude: activeShop.latitude,
          longitude: activeShop.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        320,
      );
    }
  }, [activeShop, userLocation]);

  // Selection summary — shared across all pages (it's about the
  // user's cart, not the per-shop view). Per-shop pricing lives in
  // buildShopPriceLabel (here for the active card, in ShopPage per page).
  const { selectedCount, totalMinutes } = useMemo(() => {
    let mins = 0;
    for (const svc of selectedServices) {
      const h = laborHoursMap.get(svc.id) ?? svc.default_labor_hours ?? 0;
      mins += Math.round(h * 60);
    }
    return { selectedCount: selectedServices.length, totalMinutes: mins };
  }, [selectedServices, laborHoursMap]);

  // Horizontal-paged scroll handler. Pages snap by screen width so
  // every page lines up edge-to-edge inside the sheet.
  const onPageChange = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  }, []);

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

  // Back normalizes to Screen 1 when we're the first route in the
  // (booking-flow) stack — i.e. the user got here via a direct
  // entry point (Most Booked card, Quick Book, etc.) rather than
  // walking 1 → 2 → 3. Length > 1 means a real in-flow back exists.
  // For the reset path we use navigation.reset (not router.replace)
  // since replace within the same Stack occasionally no-op'd.
  const onBack = () => {
    const state = navigation.getState?.();
    const stackLength = state?.routes?.length ?? 0;
    if (stackLength > 1) {
      router.back();
      return;
    }
    (navigation.reset as ((state: { index: number; routes: { name: string }[] }) => void) | undefined)?.({
      index: 0,
      routes: [{ name: "select-services" }],
    });
  };

  const onContinue = () => {
    if (!hasServices) {
      router.push("/(booking-flow)/select-services");
      return;
    }
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
    <View style={styles.root} pointerEvents="box-none">
      {/* Local interactive MapView. The shared layout-level
          BookingFlowMap is locked behind us (its touches were being
          eaten by react-navigation's native-stack Card before they
          could fall through — same UIViewController quirk that
          forced the local-MapView fix on select-services peek
          mode). Mounting the map as a direct child of the screen
          gives it touches naturally. */}
      {region ? (
        <MapView
          ref={mapRef}
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
            .map((r, idx) => (
              <Marker
                key={r.shop.id}
                coordinate={{
                  latitude: r.shop.latitude,
                  longitude: r.shop.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={idx === activeIndex}
                onPress={() => onPinTap(idx)}
              >
                <RatingMarkerPill
                  rating={r.shop.rating}
                  shopName={r.shop.name}
                  isSelected={idx === activeIndex}
                />
              </Marker>
            ))}
        </MapView>
      ) : null}

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
            priceRange={activePriceLabel.text}
            isFixed={activePriceLabel.isFixed}
            nextSlotLabel={activeNextSlotLabel}
          />
        </View>
      ) : null}

      {/* Floating right rail — visual only for Phase 3 */}
      <View style={[styles.rightRail, { top: insets.top + 200 }]} pointerEvents="box-none">
        <Pressable
          style={styles.railBtn}
          onPress={onZoomIn}
          accessibilityLabel="Zoom in"
        >
          <Plus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.railBtn}
          onPress={onZoomOut}
          accessibilityLabel="Zoom out"
        >
          <Minus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.railBtn}
          onPress={onRecenter}
          accessibilityLabel="Recenter"
        >
          <Crosshair size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Bottom sheet — plain white. Horizontal-paged ShopPage
          carousel lives inside it; vertical drag of the handle still
          resizes the sheet (gorhom's vertical pan + our horizontal
          ScrollView don't conflict). */}
      <BottomSheet
        snapPoints={SNAP_POINTS as unknown as string[]}
        // Start at index 1 = the standard 53% peek. Index 0 is the
        // new low 12% peek; reached only via a deliberate swipe-down
        // so users can browse rating pins on the map ChatGPT-style.
        index={1}
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
              ref={pagerScrollRef}
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
                  selectedCount={selectedCount}
                  selectedServices={selectedServicesForPricing}
                  laborHoursMap={laborHoursMap}
                  vehicleOwnerId={ownershipId}
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
    backgroundColor: "transparent",
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

