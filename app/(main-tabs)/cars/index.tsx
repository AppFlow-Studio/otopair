// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";

// 3. Convex & hooks
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useSmartcarData } from "@/hooks/useSmartcarData";
import { useMergedMaintenance } from "@/hooks/useMaintenanceData";
import type { Id } from "@/convex/_generated/dataModel";
import type { MaintenanceType } from "@/utils/maintenanceStatus";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { getVehicleImageUrl } from "@/utils/vehicleImage";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 5. Flow-specific components
import CarCarousel, { Vehicle } from "@/components/cars/CarCarousel";
import LoyaltyPoints from "@/components/cars/LoyaltyPoints";
import MaintenanceTracker from "@/components/cars/MaintenanceTracker";
import MaintenanceInputModal from "@/components/cars/MaintenanceInputModal";
import VehicleProfileFields from "@/components/cars/VehicleProfileFields";
import ServiceHistory, { ServiceRecord } from "@/components/cars/ServiceHistory";
import VehicleStatsCard from "@/components/cars/VehicleStatsCard";

// ============================================================================
// VEHICLE-SPECIFIC DATA
// ============================================================================

// Default gradient sets for carousel (alternate by index when Convex has no metadata)
const DEFAULT_GRADIENTS = [
  ["#9a9cc0", "#e7e3fd", "#e0dcf4", "#f1ecfe"],
  ["#5090d8", "#c0daf8", "#b8d4f8", "#d8ecff"],
];

// (Service history is now sourced from Smartcar data via useSmartcarData)

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// ANIMATED CHECKMARK (matches vehicle-added.tsx)
// ============================================================================

const AnimatedPath = Animated.createAnimatedComponent(Path);

function AnimatedCheckmark({ size, color, strokeWidth, progress }: {
  size: number; color: string; strokeWidth: number; progress: Animated.Value;
}) {
  const checkPath = "M6 12L10 16L18 8";
  const pathLength = 24;
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [pathLength, 0],
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <AnimatedPath
        d={checkPath}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={pathLength}
        strokeDashoffset={strokeDashoffset}
      />
    </Svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CarsHomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);

  // ── Profile-complete success overlay ──
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const successOverlayOpacity = useRef(new Animated.Value(0)).current;
  const successCheckScale = useRef(new Animated.Value(0)).current;
  const successCheckDraw = useRef(new Animated.Value(0)).current;
  const successTextOpacity = useRef(new Animated.Value(0)).current;
  const successTextY = useRef(new Animated.Value(20)).current;
  const successBtnOpacity = useRef(new Animated.Value(0)).current;
  const successBtnY = useRef(new Animated.Value(100)).current;
  const successImageScale = useRef(new Animated.Value(1)).current;

  const handleProfileComplete = useCallback(() => {
    setShowProfileSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Fade in overlay
    Animated.timing(successOverlayOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Checkmark bounce in
    Animated.spring(successCheckScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 12,
      stiffness: 180,
    }).start();

    // Draw checkmark
    setTimeout(() => {
      Animated.timing(successCheckDraw, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 200);

    // Text fade in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(successTextOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(successTextY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 100 }),
      ]).start();
    }, 300);

    // Button slide up
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(successBtnY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 120 }),
        Animated.timing(successBtnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 500);

    // Subtle image zoom
    Animated.timing(successImageScale, {
      toValue: 1.05,
      duration: 3000,
      useNativeDriver: true,
    }).start();
  }, [successOverlayOpacity, successCheckScale, successCheckDraw, successTextOpacity, successTextY, successBtnOpacity, successBtnY, successImageScale]);

  const dismissProfileSuccess = useCallback(() => {
    Animated.timing(successOverlayOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowProfileSuccess(false);
      // Reset animation values for potential reuse
      successCheckScale.setValue(0);
      successCheckDraw.setValue(0);
      successTextOpacity.setValue(0);
      successTextY.setValue(20);
      successBtnOpacity.setValue(0);
      successBtnY.setValue(100);
      successImageScale.setValue(1);
    });
  }, [successOverlayOpacity, successCheckScale, successCheckDraw, successTextOpacity, successTextY, successBtnOpacity, successBtnY, successImageScale]);

  // Convex: user's vehicles
  const { userId } = useUserFromConvex();
  const { vehicles: listVehicles, isLoading } = useVehicleOwnershipFromConvex();
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const resetOnboarding = useMutation(api.vehicles.resetVehicleOnboarding);
  const fetchVehicleData = useAction(api.smartcar.fetchVehicleData);
  const [isRefreshingSmartcar, setIsRefreshingSmartcar] = useState(false);

  // Map Convex list to Vehicle[] for CarCarousel (also track ownership IDs + raw ownership)
  const { vehicles, ownershipIds, ownerships } = useMemo(() => {
    if (!listVehicles?.length) return {
      vehicles: [] as Vehicle[],
      ownershipIds: [] as (Id<"vehicle_owners"> | undefined)[],
      ownerships: [] as (Record<string, any> | undefined)[],
    };

    // Build paired list of vehicles + ownership IDs + raw ownership records
    const paired: { vehicle: Vehicle; ownershipId: Id<"vehicle_owners"> | undefined; ownership: Record<string, any> | undefined }[] = [];
    listVehicles.forEach((r: any, i: number) => {
      const v = r.vehicle;
      const o = r.ownership;
      const meta = v ? (v as { metadata?: { make?: string; model?: string } }).metadata : undefined;
      const gradient = DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length];
      const displayMake = meta?.make ?? o?.nickname?.split(" ")[1] ?? "Vehicle";
      const displayModel = meta?.model ?? o?.nickname?.split(" ").slice(2).join(" ") ?? r.vin.slice(-6);
      paired.push({
        vehicle: {
          id: r.vin,
          year: v?.year ?? 0,
          make: displayMake,
          model: displayModel,
          vin: r.vin,
          mileage: o?.mileage ?? 0,
          nextServiceDate: undefined,
          isDefault: o?.is_primary ?? false,
          imageSource: v?.image_url
            ? { uri: `${v.image_url}?v=${v.updated_at || v._creationTime}` }
            : displayMake && displayModel
              ? { uri: getVehicleImageUrl(displayMake, displayModel, v?.year) }
              : undefined,
          logoSource: undefined,
          condition: undefined,
          nextUnlock: undefined,
          gradientColors: gradient,
          connectionStatus: r.connectionStatus || "unconnected",
        },
        ownershipId: o?._id,
        ownership: o,
      });
    });

    // Sort to match CarCarousel's internal sort (default car first)
    paired.sort((a, b) => {
      if (a.vehicle.isDefault && !b.vehicle.isDefault) return -1;
      if (!a.vehicle.isDefault && b.vehicle.isDefault) return 1;
      return 0;
    });

    return {
      vehicles: paired.map((p) => p.vehicle),
      ownershipIds: paired.map((p) => p.ownershipId),
      ownerships: paired.map((p) => p.ownership),
    };
  }, [listVehicles]);

  // Clamp active index when list changes
  useEffect(() => {
    if (vehicles.length > 0 && activeVehicleIndex >= vehicles.length) {
      setActiveVehicleIndex(Math.max(0, vehicles.length - 1));
    }
  }, [vehicles.length, activeVehicleIndex]);

  // Memoize current vehicle and its data
  const activeVehicle = useMemo(() => vehicles[activeVehicleIndex], [vehicles, activeVehicleIndex]);
  const activeOwnershipId = useMemo(() => ownershipIds[activeVehicleIndex], [ownershipIds, activeVehicleIndex]);
  const activeOwnership = useMemo(() => ownerships[activeVehicleIndex], [ownerships, activeVehicleIndex]);

  // Onboarding state for non-Smartcar vehicles
  const isOnboardingComplete = activeOwnership?.onboardingComplete === true;
  const prevOnboardingComplete = useRef<boolean | null>(null);
  const trackedOwnershipId = useRef<string | null>(null);
  const activeOwnershipDrivingConditions = activeOwnership?.drivingConditions as string | undefined;
  const activeOwnershipAvgMonthlyDriving = activeOwnership?.avgMonthlyDriving as string | undefined;
  // Smartcar data for the active vehicle
  const {
    stats: smartcarStats,
    maintenanceItems: smartcarMaintenanceItems,
    healthScore,
    tripStats,
    nextServicePrediction,
    isConnected: isActiveVehicleConnected,
  } = useSmartcarData(activeOwnershipId);

  // Detect when onboarding just completed (false → true) and show success overlay.
  // Resets tracking when active vehicle changes so switching cars doesn't trigger it.
  useEffect(() => {
    if (!activeOwnershipId || !activeOwnership) return;

    // If we switched vehicles, reset tracking for the new vehicle
    if (trackedOwnershipId.current !== activeOwnershipId) {
      trackedOwnershipId.current = activeOwnershipId;
      prevOnboardingComplete.current = isOnboardingComplete;
      return;
    }

    if (isOnboardingComplete && prevOnboardingComplete.current === false && !isActiveVehicleConnected) {
      handleProfileComplete();
    }
    prevOnboardingComplete.current = isOnboardingComplete;
  }, [isOnboardingComplete, activeOwnershipId, activeOwnership, isActiveVehicleConnected, handleProfileComplete]);

  // Merged maintenance: Smartcar items + user-provided records (with per-make intervals)
  // For non-connected vehicles with onboarding, use ownership.mileage as the odometer
  const currentOdometer = smartcarStats?.odometer?.distance
    ?? (isOnboardingComplete ? (activeOwnership?.mileage ?? null) : null);
  const { mergedItems: mergedMaintenanceItems, recordsByType } = useMergedMaintenance(
    smartcarMaintenanceItems,
    activeOwnershipId,
    currentOdometer,
    activeVehicle?.make,
    activeOwnershipDrivingConditions,
    activeOwnershipAvgMonthlyDriving
  );

  // Compute overall vehicle health score from real data
  // Formula: Overall = (Maintenance × 70%) + (Usage × 30%)
  const computedHealthScore = useMemo(() => {
    const getMileageScore = (miles: number) => {
      if (miles <= 30000) return 100;
      if (miles <= 60000) return 90;
      if (miles <= 100000) return 75;
      if (miles <= 150000) return 55;
      return 35;
    };
    const knownItems = mergedMaintenanceItems.filter((i) => i.status !== "unknown");
    const onTimeItems = knownItems.filter((i) => i.status === "on_time");
    const total = Math.max(knownItems.length, 1);
    const maintenancePct = Math.round((onTimeItems.length / total) * 100);
    const usagePct = getMileageScore(currentOdometer ?? activeVehicle?.mileage ?? 0);
    return Math.round((maintenancePct * 0.7) + (usagePct * 0.3));
  }, [mergedMaintenanceItems, currentOdometer, activeVehicle?.mileage]);

  // Maintenance input modal state
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [maintenanceModalType, setMaintenanceModalType] = useState<MaintenanceType>("oil");

  // Map Smartcar service history to ServiceHistory component format
  const serviceRecords: ServiceRecord[] = useMemo(() => {
    if (!smartcarStats?.serviceHistory || smartcarStats.serviceHistory.length === 0) return [];
    return smartcarStats.serviceHistory.map((r, i) => {
      const tasks = (r.serviceTasks || []).map((t) => t.taskDescription).filter(Boolean) as string[];
      const dateStr = r.serviceDate
        ? new Date(r.serviceDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Unknown date";
      return {
        id: r.serviceId || `smartcar-service-${i}`,
        date: dateStr,
        facilityName: "Service Center",
        services: tasks.length > 0 ? tasks : ["Service performed"],
        totalCost: r.serviceCost?.totalCost ?? 0,
      };
    });
  }, [smartcarStats?.serviceHistory]);

  // Refresh Smartcar data
  const handleSmartcarRefresh = useCallback(async () => {
    console.log("[Refresh] handleSmartcarRefresh called, activeOwnershipId=", activeOwnershipId);
    if (!activeOwnershipId) {
      console.log("[Refresh] No activeOwnershipId, aborting");
      return;
    }
    setIsRefreshingSmartcar(true);
    try {
      console.log("[Refresh] Calling fetchVehicleData...");
      await fetchVehicleData({ vehicleOwnerId: activeOwnershipId });
      console.log("[Refresh] fetchVehicleData completed");
    } catch (err) {
      console.warn("[Refresh] Smartcar refresh failed:", err);
    } finally {
      setIsRefreshingSmartcar(false);
    }
  }, [activeOwnershipId, fetchVehicleData]);


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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Also trigger Smartcar refresh if connected
    if (activeOwnershipId && activeVehicle?.connectionStatus === "connected") {
      setIsRefreshingSmartcar(true);
      try {
        await fetchVehicleData({ vehicleOwnerId: activeOwnershipId });
      } catch (err) {
        console.warn("Pull-to-refresh Smartcar failed:", err);
      } finally {
        setIsRefreshingSmartcar(false);
      }
    }
    setRefreshing(false);
  }, [activeOwnershipId, activeVehicle?.connectionStatus, fetchVehicleData]);

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
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6B7280" />}
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
            maintenanceItems={mergedMaintenanceItems}
            currentMileage={currentOdometer}
          />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            SMARTCAR STATS (only for connected vehicles)
        ═══════════════════════════════════════════════════════════════════ */}
        {isActiveVehicleConnected && activeVehicle?.connectionStatus === 'connected' && smartcarStats && (
          <VehicleStatsCard
            stats={smartcarStats}
            tripStats={tripStats}
            nextServicePrediction={nextServicePrediction}
            onRefresh={handleSmartcarRefresh}
            isRefreshing={isRefreshingSmartcar}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM SECTION: Maintenance, Service History, Loyalty
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.bottomSection}>
          {/* Non-connected + no onboarding (or success overlay showing) → show inline profile fields */}
          {!isActiveVehicleConnected && (!isOnboardingComplete || showProfileSuccess) && activeOwnershipId ? (
            <VehicleProfileFields
              vehicleOwnerId={activeOwnershipId}
              ownership={activeOwnership ?? {}}
              vehicleYear={activeVehicle?.year}
              scrollViewRef={scrollViewRef}
              scrollOffset={scrollOffsetRef}
            />
          ) : (
            /* Connected OR onboarding complete → show maintenance tracker */
            <>
            {/* For connected vehicles: show inline fields for things Smartcar doesn't cover */}
            {isActiveVehicleConnected && activeOwnershipId && (() => {
              // Check which non-Smartcar fields are still missing
              const hasBrakes = recordsByType.has("brakes");
              const hasBattery = recordsByType.has("battery");
              const hasInspection = recordsByType.has("inspection");
              const hasDriving = !!activeOwnership?.drivingConditions;
              const hasUsage = !!activeOwnership?.avgMonthlyDriving;
              const allDone = hasBrakes && hasBattery && hasInspection && hasDriving && hasUsage;
              if (allDone) return null;
              return (
                <VehicleProfileFields
                  vehicleOwnerId={activeOwnershipId}
                  ownership={activeOwnership ?? {}}
                  vehicleYear={activeVehicle?.year}
                  scrollViewRef={scrollViewRef}
                  scrollOffset={scrollOffsetRef}
                  visibleFields={["brakes", "battery", "inspection", "drivingConditions", "avgMonthlyDriving"]}
                  headerTitle="Complete Your Profile"
                  headerSubtitle="Add the details Smartcar doesn't cover to unlock full predictive maintenance."
                />
              );
            })()}

            {/* Reset onboarding button for non-connected vehicles */}
            {!isActiveVehicleConnected && isOnboardingComplete && activeOwnershipId && (
              <Pressable
                style={({ pressed }) => [
                  {
                    flexDirection: 'row' as const,
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                    gap: 6,
                    alignSelf: 'center' as const,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    backgroundColor: 'rgba(82,153,254,0.1)',
                    marginBottom: 12,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={async () => {
                  try {
                    await resetOnboarding({ vehicleOwnerId: activeOwnershipId });
                  } catch (err) {
                    console.warn("Reset onboarding failed:", err);
                  }
                }}
              >
                <Text weight="semiBold" size="sm" color="#5299FE">
                  Redo Vehicle Info
                </Text>
              </Pressable>
            )}
            <MaintenanceTracker
              items={mergedMaintenanceItems}
              vehicleCondition={isActiveVehicleConnected && activeVehicle?.connectionStatus === 'connected' ? (healthScore ?? computedHealthScore) : computedHealthScore}
              onBookNow={(id) => {
                // Navigate to booking flow with selected service
                router.push('/home/map');
              }}
              onAddInfo={(id) => {
                const type = id.replace(/^(unknown-|user-)/, "") as MaintenanceType;
                setMaintenanceModalType(type);
                setMaintenanceModalVisible(true);
              }}
              onEditInfo={(id) => {
                const type = id.replace(/^(unknown-|user-)/, "") as MaintenanceType;
                setMaintenanceModalType(type);
                setMaintenanceModalVisible(true);
              }}
            />
            </>
          )}

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
              // Navigate to full membership/loyalty page
              router.push('/membership');
            }}
          />
        </View>
      </ScrollView>

      {/* Maintenance Input Modal */}
      {activeOwnershipId && (
        <MaintenanceInputModal
          visible={maintenanceModalVisible}
          maintenanceType={maintenanceModalType}
          vehicleOwnerId={activeOwnershipId}
          existingRecord={
            recordsByType.get(maintenanceModalType)
              ? {
                  lastServiceDate: recordsByType.get(maintenanceModalType)!.lastServiceDate ?? undefined,
                  lastServiceMileage: recordsByType.get(maintenanceModalType)!.lastServiceMileage ?? undefined,
                  customInputs: recordsByType.get(maintenanceModalType)!.customInputs as Record<string, unknown> | undefined,
                }
              : undefined
          }
          onClose={() => setMaintenanceModalVisible(false)}
          onSaved={() => {
            // Convex reactivity will auto-update the merged items
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PROFILE COMPLETE SUCCESS OVERLAY
      ═══════════════════════════════════════════════════════════════════ */}
      {showProfileSuccess && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            successOverlayStyles.overlay,
            { opacity: successOverlayOpacity },
          ]}
          pointerEvents="auto"
        >
          {/* Background image with subtle zoom */}
          <Animated.Image
            source={require("@/assets/images/carComplete.jpeg")}
            style={[
              successOverlayStyles.bgImage,
              { transform: [{ scale: successImageScale }] },
            ]}
            resizeMode="cover"
          />

          {/* Content */}
          <View style={[successOverlayStyles.content, { top: insets.top + 40 }]}>
            {/* Checkmark circle */}
            <Animated.View
              style={[
                successOverlayStyles.checkCircle,
                { transform: [{ scale: successCheckScale }] },
              ]}
            >
              <AnimatedCheckmark size={40} color="#FFFFFF" strokeWidth={3} progress={successCheckDraw} />
            </Animated.View>

            {/* Text */}
            <Animated.View style={{ opacity: successTextOpacity, transform: [{ translateY: successTextY }] }}>
              <Text weight="bold" size="2xl" color="#333333" style={successOverlayStyles.title}>
                VEHICLE PROFILE COMPLETE
              </Text>
              <Text size="sm" color="#666666" style={successOverlayStyles.description}>
                Your vehicle's health score is now active. We'll help you stay ahead of maintenance.
              </Text>
            </Animated.View>
          </View>

          {/* Bottom button */}
          <Animated.View
            style={[
              successOverlayStyles.btnContainer,
              {
                paddingBottom: insets.bottom + 20,
                opacity: successBtnOpacity,
                transform: [{ translateY: successBtnY }],
              },
            ]}
          >
            <Pressable
              onPress={dismissProfileSuccess}
              style={({ pressed }) => [
                successOverlayStyles.btn,
                pressed && successOverlayStyles.btnPressed,
              ]}
            >
              <Text weight="semiBold" size="md" color="#FFFFFF" style={{ letterSpacing: 0.5 }}>
                VIEW HEALTH SCORE
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

    </View>
  );
}

// ============================================================================
// PROFILE-COMPLETE OVERLAY STYLES
// ============================================================================

const successOverlayStyles = StyleSheet.create({
  overlay: {
    zIndex: 100,
    backgroundColor: "#f8f8f8",
  },
  bgImage: {
    position: "absolute",
    top: SCREEN_HEIGHT * -0.05,
    left: -SCREEN_WIDTH * 0.15,
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_HEIGHT * 1.1,
    zIndex: 1,
  },
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#5299FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  description: {
    textAlign: "center",
    lineHeight: 20,
  },
  btnContainer: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 20,
  },
  btn: {
    backgroundColor: "#5299FE",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.8,
  },
});

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
