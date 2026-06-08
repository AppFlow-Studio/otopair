/**
 * Screen 3 · Choose Mechanic — booking-flow.
 *
 * Map becomes the full-bleed canvas; floating chrome on top
 * (header pill, service-summary chip, map shop card, +/− and
 * recenter on the right rail). Smaller white bottom sheet
 * surfaces shop name, ⭐ rating, the service-cost summary, and
 * the horizontal mechanic carousel. Vehicle puck still persists.
 *
 * Spec: ~/Downloads/<figma frames> Screen 3.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from "react-native-maps";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ArrowLeft, Crosshair, Minus, Plus, Star, Wrench } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { MapShopCard } from "@/components/booking-flow/MapShopCard";
import {
  MechanicCarousel,
  type MechanicCarouselItem,
} from "@/components/booking-flow/MechanicCarousel";
import { ServiceSummaryChip } from "@/components/booking-flow/ServiceSummaryChip";
import { StickyContinueBar } from "@/components/booking-flow/StickyContinueBar";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { useDefaultBookingShop } from "@/hooks/useDefaultBookingShop";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useNextAvailabilityPerMechanicForShop } from "@/hooks/useNextAvailabilityPerMechanicForShop";
import { useBookingStore } from "@/stores/useBookingStore";

const FALLBACK_REGION: Region = {
  latitude: 41.1959,
  longitude: -73.4365,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const SNAP_POINTS = ["48%", "75%"] as const;

export default function ChooseMechanicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);

  const { result: shopResult, isLoading: shopLoading } = useDefaultBookingShop();
  const shop = shopResult?.shop ?? null;
  const shopId = shop?.id ?? null;

  // Default-shop pin position derives the initial region — center
  // somewhere between the user and the shop so both fit nicely.
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

  // Recenter region when shop loads so the marker is in view.
  useEffect(() => {
    if (!shop || !userLocation || !mapRef.current) return;
    const midLat = (shop.latitude + userLocation.latitude) / 2;
    const midLng = (shop.longitude + userLocation.longitude) / 2;
    const latDelta = Math.max(
      0.02,
      Math.abs(shop.latitude - userLocation.latitude) * 2.4,
    );
    const lngDelta = Math.max(
      0.02,
      Math.abs(shop.longitude - userLocation.longitude) * 2.4,
    );
    mapRef.current.animateToRegion(
      {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      },
      400,
    );
  }, [shop, userLocation]);

  // Selection summary — services count + total minutes.
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

  // Shop labor rate × hours + parts → flat estimate, range = ±10%.
  const flatEstimate = useMemo(() => {
    if (!shop) return null;
    const laborRate = shop.labor_rate ?? 0;
    const labor = laborRate * laborHoursTotal;
    return Math.round(labor + partsEstimate);
  }, [shop, laborHoursTotal, partsEstimate]);

  const priceRangeFormatted = useMemo(() => {
    if (flatEstimate == null) return null;
    const low = Math.round(flatEstimate * 0.9);
    const high = Math.round(flatEstimate * 1.1);
    if (low === high) return `~$${low}`;
    return `~$${low} – $${high}`;
  }, [flatEstimate]);

  // Next slot for the shop overall (for the map card "Next: …" line).
  const { slots: shopSlots } = useNextAvailabilityForShop(shopId, null, 1);
  const nextSlotLabel = useMemo(() => {
    if (shopSlots.length === 0) return null;
    const s = shopSlots[0];
    return `Next: ${s.dayOfWeek} ${s.time}`;
  }, [shopSlots]);

  // Per-mechanic earliest slots → carousel labels.
  const { slotsByMechanicId } = useNextAvailabilityPerMechanicForShop(shopId);
  const allMechanicsMap = useMechanicStore((s) => s.mechanics);

  const carouselItems = useMemo<MechanicCarouselItem[]>(() => {
    const items: MechanicCarouselItem[] = [
      {
        mechanicId: null,
        name: "Any",
        photoUrl: null,
        slotLabel: shopSlots.length > 0 ? "Earliest" : "Availability TBD",
      },
    ];
    if (!shop) return items;
    for (const mechId of Object.keys(slotsByMechanicId)) {
      const mech = allMechanicsMap[mechId];
      if (!mech) continue;
      const earliest = slotsByMechanicId[mechId]?.[0];
      const slotLabel = earliest
        ? `${earliest.dayOfWeek} ${earliest.time}`
        : "TBD";
      items.push({
        mechanicId: mechId,
        name: mech.name,
        photoUrl: mech.photoUrl,
        slotLabel,
        verified: mech.isVerified,
      });
    }
    return items;
  }, [shop, slotsByMechanicId, allMechanicsMap, shopSlots.length]);

  // Local mechanic selection — null = Any.
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);

  const selectedMechanic = selectedMechanicId
    ? allMechanicsMap[selectedMechanicId]
    : null;
  const continueLabel = `Continue with ${selectedMechanic?.name ?? "Any"}`;

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(booking-flow)/select-services");
  };

  const onContinue = () => {
    if (!shopId) return;
    // Pass shop + mechanic via route params — selectedMechanicSlot
    // requires a real slot, which Phase 4 (pick-datetime) chooses.
    router.push({
      pathname: "/(booking-flow)/pick-datetime",
      params: {
        shopId,
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
            {shop && shop.latitude !== 0 ? (
              <Marker
                coordinate={{
                  latitude: shop.latitude,
                  longitude: shop.longitude,
                }}
                title={shop.name}
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

        {selectedCount > 0 ? (
          <View style={styles.summaryChipWrap}>
            <ServiceSummaryChip count={selectedCount} totalMinutes={totalMinutes} />
          </View>
        ) : null}
      </View>

      {/* Map shop card */}
      {shop ? (
        <View style={styles.shopCardWrap} pointerEvents="box-none">
          <MapShopCard
            shopId={shop.id}
            shopName={shop.name}
            rating={shop.rating}
            distanceMi={shopResult?.distanceMi ?? 0}
            priceRange={priceRangeFormatted}
            nextSlotLabel={nextSlotLabel}
          />
        </View>
      ) : null}

      {/* Floating right rail — visual only for Phase 3 */}
      <View style={[styles.rightRail, { top: insets.top + 200 }]} pointerEvents="box-none">
        <Pressable
          style={styles.railBtn}
          accessibilityLabel="Zoom in"
          onPress={() => {
            /* TODO Phase 3.5 */
          }}
        >
          <Plus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.railBtn}
          accessibilityLabel="Zoom out"
          onPress={() => {
            /* TODO Phase 3.5 */
          }}
        >
          <Minus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.railBtn}
          accessibilityLabel="Recenter"
          onPress={() => {
            /* TODO Phase 3.5 */
          }}
        >
          <Crosshair size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Bottom sheet — plain white */}
      <BottomSheet
        snapPoints={SNAP_POINTS as unknown as string[]}
        index={0}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandleIndicator}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {shop ? (
            <>
              <View style={styles.shopHeader}>
                <View style={styles.shopHeaderText}>
                  <Text size="xl" weight="bold" color="#0F172A">
                    {shop.name}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/booking/shop/[id]",
                        params: { id: shop.id },
                      })
                    }
                  >
                    <Text size="sm" weight="semiBold" color="#2563EB" style={styles.detailLink}>
                      View shop details
                    </Text>
                  </Pressable>
                </View>
                {shop.rating != null ? (
                  <View style={styles.ratingChip}>
                    <Star size={13} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
                    <Text size="sm" weight="semiBold" color="#0F172A">
                      {shop.rating.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <Wrench size={18} color="#4B5563" strokeWidth={2} />
                </View>
                <View style={styles.summaryBody}>
                  <Text size="md" weight="bold" color="#0F172A">
                    {selectedCount} service{selectedCount === 1 ? "" : "s"} ·{" "}
                    {formatTotalMinutes(totalMinutes)}
                  </Text>
                  {flatEstimate != null ? (
                    <Text size="sm" weight="regular" color="#6B7280">
                      Estimated <Text weight="bold" color="#0F172A">${flatEstimate}</Text>
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
                CHOOSE YOUR MECHANIC
              </Text>
              <MechanicCarousel
                items={carouselItems}
                selectedMechanicId={selectedMechanicId}
                onSelect={setSelectedMechanicId}
              />
            </>
          ) : (
            <View style={styles.empty}>
              <Text size="md" weight="medium" color="#9CA3AF" center>
                {shopLoading ? "Finding a shop near you…" : "No shop available."}
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      <StickyContinueBar count={1} label={continueLabel} onPress={onContinue} />
    </View>
  );
}

function formatTotalMinutes(min: number): string {
  if (min <= 0) return "Time TBD";
  if (min < 60) return `~${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min - hrs * 60;
  if (rem === 0) return `~${hrs} hr`;
  return `~${hrs} hr ${rem} min`;
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
  summaryChipWrap: {
    alignItems: "center",
  },
  shopCardWrap: {
    position: "absolute",
    top: "32%",
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
    paddingTop: 8,
  },
  shopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  shopHeaderText: {
    flex: 1,
    gap: 4,
  },
  detailLink: {
    marginTop: 2,
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    letterSpacing: 0.7,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
});
