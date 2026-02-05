// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

// 3. Convex & hooks
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";

// 4. Shared UI
import { Text } from "@/components/shared-ui";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 5. Flow-specific components
import CarCarousel, { Vehicle } from "@/components/cars/CarCarousel";
import LoyaltyPoints from "@/components/cars/LoyaltyPoints";
import MaintenanceTracker, { MaintenanceItem } from "@/components/cars/MaintenanceTracker";
import ServiceHistory, { ServiceRecord } from "@/components/cars/ServiceHistory";

// ============================================================================
// VEHICLE-SPECIFIC DATA
// ============================================================================

// Default gradient sets for carousel (alternate by index when Convex has no metadata)
const DEFAULT_GRADIENTS = [
  ["#9a9cc0", "#e7e3fd", "#e0dcf4", "#f1ecfe"],
  ["#5090d8", "#c0daf8", "#b8d4f8", "#d8ecff"],
];

// Maintenance data per vehicle (keyed by VIN; mock until Convex maintenance)
const maintenanceByVehicle: Record<string, MaintenanceItem[]> = {};

// Service history per vehicle (keyed by VIN; mock until Convex)
const serviceHistoryByVehicle: Record<string, ServiceRecord[]> = {};

export default function CarsHomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);

  // Convex: user's vehicles
  const { userId } = useUserFromConvex();
  const { vehicles: listVehicles, isLoading } = useVehicleOwnershipFromConvex();
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);

  // Map Convex list to Vehicle[] for CarCarousel
  const vehicles: Vehicle[] = useMemo(() => {
    if (!listVehicles?.length) return [];
    return listVehicles
      .filter((r) => r.vehicle != null)
      .map((r, i) => {
        const v = r.vehicle!;
        const o = r.ownership;
        const meta = (v as { metadata?: { make?: string; model?: string } }).metadata;
        const gradient = DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length];
        return {
          id: r.vin,
          year: v.year ?? 0,
          make: meta?.make ?? "Vehicle",
          model: meta?.model ?? r.vin.slice(-6),
          vin: r.vin,
          mileage: o?.mileage ?? 0,
          nextServiceDate: undefined,
          isDefault: o?.is_primary ?? false,
          imageSource: undefined,
          logoSource: undefined,
          condition: undefined,
          nextUnlock: undefined,
          gradientColors: gradient,
        };
      });
  }, [listVehicles]);

  // Clamp active index when list changes
  useEffect(() => {
    if (vehicles.length > 0 && activeVehicleIndex >= vehicles.length) {
      setActiveVehicleIndex(Math.max(0, vehicles.length - 1));
    }
  }, [vehicles.length, activeVehicleIndex]);

  // Memoize current vehicle and its data
  const activeVehicle = useMemo(() => vehicles[activeVehicleIndex], [vehicles, activeVehicleIndex]);
  const maintenanceItems = useMemo(() => maintenanceByVehicle[activeVehicle?.id ?? ""] || [], [activeVehicle?.id]);
  const serviceRecords = useMemo(() => serviceHistoryByVehicle[activeVehicle?.id ?? ""] || [], [activeVehicle?.id]);

  // Pre-render gradients - animate opacity by active index
  const lamboOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(lamboOpacity, {
      toValue: activeVehicleIndex === 1 ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeVehicleIndex]);

  // Handle default toggle via Convex
  const handleToggleDefault = useCallback(
    async (vehicleId: string, isDefault: boolean) => {
      if (!userId) return;
      try {
        await updateOwnershipPrimary({ vin: vehicleId, userId, is_primary: isDefault });
      } catch (e) {
        console.warn("Failed to set primary vehicle", e);
      }
    },
    [userId, updateOwnershipPrimary],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Empty state: no vehicles from Convex
  if (!isLoading && vehicles.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <LinearGradient colors={["#9a9cc0", "#e7e3fd", "#e0dcf4", "#f1ecfe"]} style={StyleSheet.absoluteFill} />
        <View style={styles.emptyContent}>
          <Text weight="semiBold" size="xl" style={styles.emptyTitle}>
            My Cars
          </Text>
          <Text size="md" style={styles.emptySubtitle}>
            Add your first vehicle to see maintenance, history, and book services.
          </Text>
          <Pressable
            onPress={() => router.push("/add-vehicle")}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
          >
            <Text weight="semiBold" size="md" color="#FFFFFF">
              Add vehicle
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full Page Scroll */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />}
      >
        {/* Scrolling Gradient - PRE-RENDERED for both cars, only opacity animates */}
        <View style={styles.scrollingGradientContainer} pointerEvents="none">
          {/* LEXUS gradient - always rendered, fades out when Lambo selected */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, lamboOpacity) }]}>
            <LinearGradient
              colors={["#9a9cc0", "#e7e3fd", "#e0dcf4", "#f1ecfe"]}
              locations={[0, 0.33, 0.33, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.35)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.1)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* LAMBO gradient - always rendered, fades in when Lambo selected */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lamboOpacity }]}>
            <LinearGradient
              colors={["#5090d8", "#c0daf8", "#b8d4f8", "#d8ecff"]}
              locations={[0, 0.33, 0.335, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.3)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(180, 210, 255, 0.15)", "rgba(255, 255, 255, 0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            TOP SECTION: Vehicle Carousel
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.topSection}>
          <CarCarousel
            vehicles={vehicles}
            onActiveIndexChange={setActiveVehicleIndex}
            onEditMileage={(id) => {
              // TODO: Implement mileage edit flow - open modal or inline edit
            }}
            onToggleDefault={handleToggleDefault}
            isFocused={isFocused}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM SECTION: Maintenance, Service History, Loyalty
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.bottomSection}>
          {/* Maintenance Tracker Section */}
          <MaintenanceTracker
            items={maintenanceItems}
            vehicleCondition={activeVehicle?.condition}
            onBookNow={(id) => {
              // TODO: Navigate to booking flow with selected service
              console.log("Book Now for service", id);
            }}
            onAddInfo={(id) => {
              // TODO: Navigate to maintenance history form
              console.log("Add Info for service", id);
            }}
          />

          {/* Service History Section */}
          <ServiceHistory
            records={serviceRecords}
            onAddNotes={(id) => {
              // TODO: Open notes modal/screen for this service record
              console.log("Add Notes for record", id);
            }}
            onDownloadReceipt={(id) => {
              // TODO: Download PDF receipt for this service record
              console.log("Download Receipt for record", id);
            }}
          />

          {/* Loyalty Points Section */}
          <LoyaltyPoints
            totalPoints={1240}
            currentTier="Gold Member"
            currentPoints={240}
            pointsToNextTier={260}
            nextTier="Platinum"
            maxPoints={500}
            onViewFullPage={() => {
              // TODO: Navigate to full loyalty page
              console.log("View Full Loyalty Page");
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1ecfe", // Fallback
  },
  emptyContainer: {
    justifyContent: "center",
  },
  emptyContent: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  emptyButtonPressed: {
    opacity: 0.9,
  },
  scrollingGradientContainer: {
    position: "absolute",
    top: -SCREEN_HEIGHT * 0.5, // Extend above to cover when scrolling down
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 2.5, // Much taller to cover entire scroll content
    zIndex: 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 120,
  },
  // ═══════════════ SECTION CONTAINERS ═══════════════
  topSection: {
    zIndex: 1,
  },
  bottomSection: {
    zIndex: 1,
  },
});
