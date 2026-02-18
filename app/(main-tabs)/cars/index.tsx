// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

// 3. Convex & hooks
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useSmartcarData } from "@/hooks/useSmartcarData";
import { useMergedMaintenance } from "@/hooks/useMaintenanceData";
import type { Id } from "@/convex/_generated/dataModel";
import { ALL_MAINTENANCE_TYPES, MAINTENANCE_LABELS, type MaintenanceType } from "@/utils/maintenanceStatus";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { getVehicleImageUrl } from "@/utils/vehicleImage";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 5. Flow-specific components
import CarCarousel, { Vehicle } from "@/components/cars/CarCarousel";
import LoyaltyPoints from "@/components/cars/LoyaltyPoints";
import MaintenanceTracker from "@/components/cars/MaintenanceTracker";
import MaintenanceInputModal from "@/components/cars/MaintenanceInputModal";
import CarInfoStepper from "@/components/cars/CarInfoStepper";
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

  // ── Health-ring bottom sheet (shown after onboarding completes) ──
  // celebrationFlowActive ref: set synchronously in onComplete BEFORE any saves,
  // so it's guaranteed true before any Convex subscription update can cause a render.
  // This prevents the maintenance tracker from flashing even for a single frame.
  const celebrationFlowActive = useRef(false);
  const [pendingHealthSheet, setPendingHealthSheet] = useState(false);
  const [showHealthRingSheet, setShowHealthRingSheet] = useState(false);
  const healthSheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const healthSheetBackdrop = useRef(new Animated.Value(0)).current;
  const [healthSheetModal, setHealthSheetModal] = useState(false);

  // Post-celebration reveal animation
  const [revealingDashboard, setRevealingDashboard] = useState(false);
  const dashboardFade = useRef(new Animated.Value(0)).current;
  const dashboardSlide = useRef(new Animated.Value(20)).current;
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;

  // Emotional animation refs
  const [displayedScore, setDisplayedScore] = useState(0);
  const [ringProgress, setRingProgress] = useState(0);
  const ringScale = useRef(new Animated.Value(0.3)).current;
  const ringGlow = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const benefitsFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scoreCountRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref that always holds the latest computed score — avoids stale closures
  const latestScoreRef = useRef(0);

  const openHealthSheet = useCallback(() => {
    const target = latestScoreRef.current;
    setHealthSheetModal(true);
    setShowHealthRingSheet(true);
    setDisplayedScore(0);
    setRingProgress(0);

    // Reset all animations
    healthSheetY.setValue(SCREEN_HEIGHT);
    healthSheetBackdrop.setValue(0);
    ringScale.setValue(0.3);
    ringGlow.setValue(0);
    titleFade.setValue(0);
    subtitleFade.setValue(0);
    benefitsFade.setValue(0);
    buttonFade.setValue(0);
    pulseAnim.setValue(1);

    // Phase 1: Sheet slides up + backdrop fades in
    Animated.parallel([
      Animated.spring(healthSheetY, { toValue: 0, tension: 40, friction: 12, useNativeDriver: false }),
      Animated.timing(healthSheetBackdrop, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // Phase 2: Ring bounces in with glow
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.spring(ringScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(ringGlow, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start(() => {
        // Start gentle pulse loop on the glow
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        ).start();
      });

      // Phase 3: Count up the score number + ring fill simultaneously
      const duration = 1000;
      const steps = 40;
      const stepDuration = duration / steps;
      let currentStep = 0;
      if (scoreCountRef.current) clearInterval(scoreCountRef.current);
      scoreCountRef.current = setInterval(() => {
        currentStep++;
        const progress = 1 - Math.pow(1 - currentStep / steps, 3);
        setDisplayedScore(Math.round(progress * target));
        setRingProgress(progress * target);
        if (currentStep >= steps) {
          if (scoreCountRef.current) clearInterval(scoreCountRef.current);
          setDisplayedScore(target);
          setRingProgress(target);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }, stepDuration);

      // Phase 4: Staggered content fade-ins
      Animated.stagger(180, [
        Animated.timing(titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(benefitsFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, [healthSheetY, healthSheetBackdrop, ringScale, ringGlow, titleFade, subtitleFade, benefitsFade, buttonFade, pulseAnim]);

  const closeHealthSheet = useCallback(() => {
    if (scoreCountRef.current) clearInterval(scoreCountRef.current);
    Animated.parallel([
      Animated.timing(healthSheetY, { toValue: SCREEN_HEIGHT, duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
      Animated.timing(healthSheetBackdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setHealthSheetModal(false);
      setShowHealthRingSheet(false);
      // Start the reveal phase: show loading state, then fade in content
      setRevealingDashboard(true);
      dashboardFade.setValue(0);
      dashboardSlide.setValue(20);
      skeletonPulse.setValue(0.3);

      // Pulse the skeleton lines
      Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, { toValue: 0.8, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(skeletonPulse, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();

      // After the loading phase, fade in the real content
      setTimeout(() => {
        skeletonPulse.stopAnimation();
        Animated.parallel([
          Animated.timing(dashboardFade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dashboardSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start(() => {
          celebrationFlowActive.current = false;
          setRevealingDashboard(false);
        });
      }, 1400);
    });
  }, [healthSheetY, healthSheetBackdrop, dashboardFade, dashboardSlide]);

  // Convex: user's vehicles
  const { userId } = useUserFromConvex();
  const { vehicles: listVehicles, isLoading } = useVehicleOwnershipFromConvex();
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const resetOnboarding = useMutation(api.vehicles.resetVehicleOnboarding);
  const removeOwner = useMutation(api.vehicles.removeOwner);
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
          // Prefer stable stored image_url; fallback to derived URL.
          imageSource: v?.image_url
            ? { uri: `${v.image_url}?v=${v.updated_at || v._creationTime}` }
            : displayMake && displayModel
              ? { uri: getVehicleImageUrl(displayMake, displayModel, v?.year, r.vin) }
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

    // Stable deterministic sort (default first, then VIN) so indices don't shuffle.
    paired.sort((a, b) => {
      if (a.vehicle.isDefault && !b.vehicle.isDefault) return -1;
      if (!a.vehicle.isDefault && b.vehicle.isDefault) return 1;
      return a.vehicle.id.localeCompare(b.vehicle.id);
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
  const isPreOnboardingComplete = activeOwnership?.preOnboardingComplete === true;

  // Onboarding state for non-Smartcar vehicles
  const isOnboardingComplete = activeOwnership?.onboardingComplete === true;
  // True only when onboarding is done AND the entire celebration flow is finished.
  // celebrationFlowActive.current is the synchronous guard that prevents any flash
  // between Convex pushing isOnboardingComplete and React applying state updates.
  const celebrationDismissed = isOnboardingComplete && !pendingHealthSheet && !showHealthRingSheet && !celebrationFlowActive.current;
  const showPostOnboardingContent = celebrationDismissed && !revealingDashboard;
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

  // Keep the ref in sync so openHealthSheet always reads the latest score
  latestScoreRef.current = computedHealthScore;

  // Open the health sheet once Convex data has propagated after onboarding.
  // We wait for isOnboardingComplete (Convex confirmed) AND currentOdometer
  // to be non-null (mileage data is available for score calculation).
  // NOTE: no cleanup/clearTimeout — the setPendingHealthSheet(false) call
  // triggers a re-render whose cleanup would cancel the timer before it fires.
  useEffect(() => {
    if (pendingHealthSheet && isOnboardingComplete && currentOdometer != null) {
      setPendingHealthSheet(false);
      setTimeout(() => openHealthSheet(), 300);
    }
  }, [pendingHealthSheet, isOnboardingComplete, currentOdometer, openHealthSheet]);

  // Maintenance input modal state
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [maintenanceModalType, setMaintenanceModalType] = useState<MaintenanceType>("oil");

  // Edit-picker bottom sheet state
  const [showEditPicker, setShowEditPicker] = useState(false);
  const [editPickerModal, setEditPickerModal] = useState(false);
  const editPickerY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const editPickerBackdrop = useRef(new Animated.Value(0)).current;

  const openEditPicker = useCallback(() => {
    setEditPickerModal(true);
    setShowEditPicker(true);
    editPickerY.setValue(SCREEN_HEIGHT);
    editPickerBackdrop.setValue(0);
    Animated.parallel([
      Animated.spring(editPickerY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: false }),
      Animated.timing(editPickerBackdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [editPickerY, editPickerBackdrop]);

  const closeEditPicker = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(editPickerY, { toValue: SCREEN_HEIGHT, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: false }),
      Animated.timing(editPickerBackdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setShowEditPicker(false);
      setEditPickerModal(false);
      cb?.();
    });
  }, [editPickerY, editPickerBackdrop]);

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

  const handleRemoveActiveVehicle = useCallback(() => {
    const vin = activeVehicle?.vin;
    if (!vin || !userId) return;

    Alert.alert(
      "Remove vehicle?",
      "This will remove the vehicle from your garage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeOwner({ vin, userId });
            } catch (err) {
              console.warn("Remove vehicle failed:", err);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [activeVehicle?.vin, userId, removeOwner]);

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
            showHealthRing={isActiveVehicleConnected || celebrationDismissed}
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
          {/* Non-connected + pre-onboarding incomplete → show continue prompt */}
          {!isActiveVehicleConnected && !isPreOnboardingComplete && activeOwnershipId && (
            <View style={styles.preOnboardingCard}>
              <Text weight="semiBold" size="md" color="#111827" style={{ textAlign: "center" }}>
                Continue setup to unlock your maintenance dashboard
              </Text>
              <Text size="sm" color="#6B7280" style={{ textAlign: "center", marginTop: 6, marginBottom: 12 }}>
                We have added your vehicle. Complete a quick setup first, then we will ask your detailed follow-up questions.
              </Text>
              <Pressable
                onPress={() => {
                  router.push({
                    pathname: "/car-pre-onboarding",
                    params: { vehicleOwnerId: String(activeOwnershipId) },
                  });
                }}
                style={({ pressed }) => [
                  styles.preOnboardingButton,
                  pressed && { opacity: 0.86 },
                ]}
              >
                <Text weight="semiBold" size="sm" color="#FFFFFF">
                  Continue
                </Text>
              </Pressable>
            </View>
          )}

          {/* Non-connected + pre-onboarding complete + no onboarding → show inline stepper */}
          {!isActiveVehicleConnected && isPreOnboardingComplete && !isOnboardingComplete && activeOwnershipId && (
            <CarInfoStepper
              vehicleOwnerId={activeOwnershipId}
              vehicleMake={activeVehicle?.make ?? ""}
              vehicleModel={activeVehicle?.model ?? ""}
              vehicleYear={activeVehicle?.year ?? 0}
              onComplete={() => {
                celebrationFlowActive.current = true;
                setPendingHealthSheet(true);
              }}
            />
          )}

          {/* Post-celebration loading state */}
          {revealingDashboard && (
            <View style={revealStyles.container}>
              <LinearGradient
                colors={["#F0F4FF", "#FFFFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={revealStyles.card}
              >
                <View style={revealStyles.spinnerRow}>
                  <Animated.View style={[revealStyles.dot, { opacity: skeletonPulse }]}>
                    <View style={revealStyles.pulsingDot} />
                  </Animated.View>
                  <Text weight="semiBold" size="md" color="#1F2937">
                    Building your dashboard...
                  </Text>
                </View>
                <Text weight="medium" size="sm" color="#6B7280" style={{ textAlign: "center", marginTop: 6 }}>
                  Setting up health tracking and service reminders
                </Text>
                {/* Skeleton lines */}
                <View style={revealStyles.skeletonGroup}>
                  <Animated.View style={[revealStyles.skeletonLine, { width: "90%", opacity: skeletonPulse }]} />
                  <Animated.View style={[revealStyles.skeletonLine, { width: "70%", opacity: skeletonPulse }]} />
                  <Animated.View style={[revealStyles.skeletonLine, { width: "80%", opacity: skeletonPulse }]} />
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Reset onboarding button for non-connected vehicles */}
          {!isActiveVehicleConnected && isPreOnboardingComplete && showPostOnboardingContent && activeOwnershipId && (
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

          {!!activeVehicle?.vin && !!userId && (
            <Pressable
              style={({ pressed }) => [
                {
                  flexDirection: "row" as const,
                  alignItems: "center" as const,
                  justifyContent: "center" as const,
                  alignSelf: "center" as const,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: "rgba(239,68,68,0.12)",
                  marginBottom: 12,
                },
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleRemoveActiveVehicle}
            >
              <Text weight="semiBold" size="sm" color="#DC2626">
                Remove Vehicle
              </Text>
            </Pressable>
          )}

          {/* Maintenance tracker (shown for connected vehicles, or non-connected after onboarding + sheet dismissed) */}
          {(isActiveVehicleConnected || (isPreOnboardingComplete && showPostOnboardingContent)) && (
            <MaintenanceTracker
              items={mergedMaintenanceItems}
              vehicleCondition={isActiveVehicleConnected && activeVehicle?.connectionStatus === 'connected' ? (healthScore ?? computedHealthScore) : computedHealthScore}
              onBookNow={(id) => {
                router.push('/home/map');
              }}
              onAddInfo={(id) => {
                const type = id.replace(/^(unknown-|user-)/, "") as MaintenanceType;
                setMaintenanceModalType(type);
                setMaintenanceModalVisible(true);
              }}
              onEditPressed={() => openEditPicker()}
            />
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
          EDIT PICKER BOTTOM SHEET
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal visible={editPickerModal} transparent animationType="none" statusBarTranslucent onRequestClose={() => closeEditPicker()}>
        <Animated.View style={[pickerStyles.backdrop, { opacity: editPickerBackdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeEditPicker()} />
        </Animated.View>
        <Animated.View style={[pickerStyles.sheet, { transform: [{ translateY: editPickerY }] }]}>
          <View style={pickerStyles.handle} />
          <Text weight="semiBold" size="xl" color="#1F2937" style={pickerStyles.title}>
            Edit Maintenance Info
          </Text>
          {ALL_MAINTENANCE_TYPES.map((type) => {
            const iconMap: Record<MaintenanceType, string> = {
              oil: "water-outline",
              brakes: "disc-outline",
              tires: "ellipse-outline",
              inspection: "document-text-outline",
              battery: "battery-half-outline",
            };
            return (
              <Pressable
                key={type}
                style={({ pressed }) => [pickerStyles.row, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }]}
                onPress={() => {
                  closeEditPicker(() => {
                    setMaintenanceModalType(type);
                    setMaintenanceModalVisible(true);
                  });
                }}
              >
                <View style={pickerStyles.rowIcon}>
                  <Ionicons name={iconMap[type] as any} size={22} color="#5299FE" />
                </View>
                <Text weight="medium" size="md" color="#1F2937" style={{ flex: 1 }}>
                  {MAINTENANCE_LABELS[type]}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          HEALTH RING BOTTOM SHEET (shown after onboarding completes)
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal visible={healthSheetModal} transparent animationType="none" statusBarTranslucent onRequestClose={closeHealthSheet}>
        <Animated.View style={[StyleSheet.absoluteFill, healthSheetStyles.backdrop, { opacity: healthSheetBackdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeHealthSheet} />
        </Animated.View>
        <Animated.View style={[healthSheetStyles.sheet, { transform: [{ translateY: healthSheetY }] }]}>
          <View style={healthSheetStyles.dragHandleContainer}>
            <View style={healthSheetStyles.dragHandle} />
          </View>
          <View style={healthSheetStyles.content}>
            {/* SVG health ring matching CarCarousel ActivityRings */}
            <View style={healthSheetStyles.ringContainer}>
              {/* Pulsing glow behind the ring */}
              <Animated.View style={[
                healthSheetStyles.ringGlow,
                {
                  opacity: Animated.multiply(ringGlow, new Animated.Value(0.35)),
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: computedHealthScore >= 75 ? '#30D158' : computedHealthScore >= 60 ? '#FFD60A' : '#FF3B30',
                },
              ]} />
              <Animated.View style={[
                healthSheetStyles.ringGlowInner,
                {
                  opacity: Animated.multiply(ringGlow, new Animated.Value(0.15)),
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: computedHealthScore >= 75 ? '#30D158' : computedHealthScore >= 60 ? '#FFD60A' : '#FF3B30',
                },
              ]} />
              {/* Animated SVG ring */}
              <Animated.View style={{ transform: [{ scale: ringScale }] }}>
                {(() => {
                  const ringSize = 140;
                  const strokeWidth = 10;
                  const radius = (ringSize - strokeWidth) / 2;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference * (1 - ringProgress / 100);
                  const center = ringSize / 2;
                  const ringColor = computedHealthScore >= 75 ? '#30D158' : computedHealthScore >= 60 ? '#FFD60A' : '#FF3B30';
                  return (
                    <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
                      <Svg width={ringSize} height={ringSize}>
                        <Defs>
                          <SvgLinearGradient id="healthSheetRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor={ringColor} />
                            <Stop offset="50%" stopColor={ringColor} stopOpacity={0.9} />
                            <Stop offset="100%" stopColor={ringColor} stopOpacity={0.8} />
                          </SvgLinearGradient>
                        </Defs>
                        {/* Background track */}
                        <Circle cx={center} cy={center} r={radius} stroke={ringColor} strokeWidth={strokeWidth} fill="none" opacity={0.15} />
                        {/* Progress ring */}
                        <Circle cx={center} cy={center} r={radius} stroke="url(#healthSheetRingGrad)" strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} />
                        {/* Glow layer */}
                        <Circle cx={center} cy={center} r={radius} stroke={ringColor} strokeWidth={strokeWidth + 4} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} opacity={0.2} />
                      </Svg>
                      {/* Centered score */}
                      <View style={healthSheetStyles.ringCenterLabel}>
                        <Text weight="bold" size="3xl" color="#1F2937">{displayedScore}</Text>
                        <Text weight="semiBold" size="xs" color="#9CA3AF" style={{ marginTop: -2 }}>out of 100</Text>
                      </View>
                    </View>
                  );
                })()}
              </Animated.View>
            </View>

            {/* Title */}
            <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleFade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
              <Text weight="bold" size="xl" color="#1F2937" style={healthSheetStyles.title}>
                {computedHealthScore >= 80
                  ? `Your ${activeVehicle?.make ?? "vehicle"} is in great shape`
                  : computedHealthScore >= 60
                    ? `Your ${activeVehicle?.make ?? "vehicle"} is looking solid`
                    : `We've got a plan for your ${activeVehicle?.make ?? "vehicle"}`}
              </Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.View style={{ opacity: subtitleFade, transform: [{ translateY: subtitleFade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
              <Text weight="medium" size="sm" color="#6B7280" style={healthSheetStyles.subtitle}>
                {computedHealthScore >= 80
                  ? "You're clearly someone who takes care of their ride. We'll make sure it stays that way."
                  : computedHealthScore >= 60
                    ? "A few things could use attention, but nothing we can't help with. You're in good hands."
                    : "Don't worry — now that we know what's going on, we'll guide you through every service it needs."}
              </Text>
            </Animated.View>

            {/* Unlocked benefits */}
            <Animated.View style={[healthSheetStyles.benefitsContainer, { opacity: benefitsFade, transform: [{ translateY: benefitsFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
              {[
                { icon: "shield-checkmark" as const, text: "Health monitoring active" },
                { icon: "notifications" as const, text: "Service reminders enabled" },
                { icon: "trending-up" as const, text: "Maintenance predictions on" },
              ].map((benefit) => (
                <View key={benefit.text} style={healthSheetStyles.benefitRow}>
                  <View style={healthSheetStyles.benefitIcon}>
                    <Ionicons name={benefit.icon} size={16} color="#22C55E" />
                  </View>
                  <Text weight="medium" size="sm" color="#374151">{benefit.text}</Text>
                </View>
              ))}
            </Animated.View>

            {/* CTA button */}
            <Animated.View style={[{ width: "100%" }, { opacity: buttonFade, transform: [{ translateY: buttonFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
              <Pressable
                onPress={closeHealthSheet}
                style={({ pressed }) => [healthSheetStyles.doneBtn, pressed && { opacity: 0.85 }]}
              >
                <Text weight="bold" size="md" color="#FFFFFF">View My Dashboard</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

    </View>
  );
}

// ============================================================================
// EDIT PICKER BOTTOM SHEET STYLES
// ============================================================================

const pickerStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(82, 153, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
});

// ============================================================================
// HEALTH RING BOTTOM SHEET STYLES
// ============================================================================

const healthSheetStyles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
    borderRadius: 2,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  ringContainer: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    width: 180,
    height: 180,
  },
  ringGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  ringGlowInner: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  ringCenterLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  benefitsContainer: {
    alignSelf: "stretch",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtn: {
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
  },
});

const revealStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  card: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.15)",
    alignItems: "center",
  },
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#5299FE",
  },
  skeletonGroup: {
    alignSelf: "stretch",
    marginTop: 20,
    gap: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
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
  preOnboardingCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  preOnboardingButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#5299FE",
  },
});
