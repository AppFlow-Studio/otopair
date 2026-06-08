/**
 * Screen 1 · Select Services — booking-flow entry.
 *
 * Map peek at top, glassy frosted sheet over it with:
 *  - close + search + vehicle puck top row
 *  - "Select Services" + subtitle
 *  - 2 hero cards (Closest Shop + Most Booked)
 *  - 4 category list rows (v5 tabs)
 *  - Quick Book horizontal chip row at the bottom
 *
 * Spec: ~/Downloads/<figma frames> Screen 1.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { Search, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CategoryListRow } from "@/components/booking-flow/CategoryListRow";
import { GlassSheet } from "@/components/booking-flow/GlassSheet";
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

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.22);

export default function SelectServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const availableServices = useBookingStore((s) => s.availableServices);

  // Map backdrop region — reuses the same pattern as tire-booking's
  // RequestingMapBackground but locked (no interaction).
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
      {/* Map backdrop */}
      <View style={[styles.mapLayer, { height: MAP_HEIGHT }]} pointerEvents="none">
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

      {/* Glassy sheet covering the rest */}
      <View style={[styles.sheet, { top: MAP_HEIGHT - 12 }]}>
        <GlassSheet>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 24 },
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
                onPress={() => {
                  /* TODO Screen-1 search overlay — Phase 2 */
                }}
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
          </ScrollView>
        </GlassSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  mapLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  mapFallback: {
    backgroundColor: "#C8D7DE",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
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
