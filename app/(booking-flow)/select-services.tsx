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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Search, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CategoryListRow } from "@/components/booking-flow/CategoryListRow";
import {
  GlassSheetBackground,
  GlassSheetHandle,
} from "@/components/booking-flow/GlassSheet";
import { HeroCardClosestShop } from "@/components/booking-flow/HeroCardClosestShop";
import { HeroCardMostBooked } from "@/components/booking-flow/HeroCardMostBooked";
import { QuickBookRow } from "@/components/booking-flow/QuickBookRow";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { TABS, type TaxonomyTab } from "@/constants/serviceTaxonomy";
import { useBookingStore } from "@/stores/useBookingStore";

const FALLBACK_REGION: Region = {
  latitude: 41.1959,
  longitude: -73.4365,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// Same snap points the legacy ServiceBottomSheet used (see
// components/booking/ServiceBottomSheet.tsx:171 `SNAP_POINTS_CONFIG.discovery`).
// `enableDynamicSizing` is intentionally off so the heights here are
// authoritative; otherwise gorhom can try to fit content height and
// fight the user-driven drag.
const SNAP_POINTS = ["23%", "38%", "55%", "92%"] as const;
const INITIAL_SNAP_INDEX = 3; // enter at "expanded"

export default function SelectServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const availableServices = useBookingStore((s) => s.availableServices);
  const sheetRef = useRef<BottomSheet>(null);

  // Map region — locked (no interaction). Uses cached location
  // permission when granted; falls back to a NY metro region.
  const [region, setRegion] = useState<Region | null>(null);
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
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        if (!cancelled) setRegion(FALLBACK_REGION);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <View style={styles.root}>
      {/* Full-bleed map underneath the sheet */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {region ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            region={region}
            showsUserLocation
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
        )}
      </View>

      {/* Draggable glassy sheet — same snap config as the legacy flow */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={SNAP_POINTS as unknown as string[]}
        index={INITIAL_SNAP_INDEX}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backgroundComponent={GlassSheetBackground}
        handleComponent={GlassSheetHandle}
      >
        {/* BottomSheetView (not the ScrollView variant) — Ahmad's PM
            wants the content fixed in place while the user can still
            drag the sheet up/down. A plain View doesn't capture
            vertical pan, so the sheet's drag gesture stays smooth. */}
        <BottomSheetView
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
            <VehiclePuck />
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
        </BottomSheetView>
      </BottomSheet>
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
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
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
