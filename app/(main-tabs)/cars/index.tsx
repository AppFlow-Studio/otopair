// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import { useSharedValue } from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import LottieView from "lottie-react-native";

// 3. Convex & hooks
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useSmartcarData } from "@/hooks/useSmartcarData";
import { useMergedMaintenance } from "@/hooks/useMaintenanceData";
import type { Id } from "@/convex/_generated/dataModel";
import { ALL_MAINTENANCE_TYPES, MAINTENANCE_LABELS, type MaintenanceType } from "@/utils/maintenanceStatus";
import { computeVehicleHealthScore, type HealthScoreInput } from "@/utils/healthScore";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { OilIcon, BrakesIcon, TireIcon, BatteryIcon, WarningIcon } from "@/components/cars/ServiceIcons";
import { FontFamily } from "@/constants/theme";
import { getVehicleImageUrl } from "@/utils/vehicleImage";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 5. Flow-specific components
import CarCarousel, { Vehicle } from "@/components/cars/CarCarousel";
import LoyaltyPoints from "@/components/cars/LoyaltyPoints";
import MaintenanceTracker from "@/components/cars/MaintenanceTracker";
import MaintenanceInputModal from "@/components/cars/MaintenanceInputModal";
import { CheckinBanner } from "@/components/cars/CheckinBanner";
import CarInfoStepper, { type CarInfoStepperHandle } from "@/components/cars/CarInfoStepper";
import { AnimatedGradientBackground } from "@/components/shared-ui/AnimatedGradientBackground";
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

// Map car colors to background gradient palettes
const COLOR_GRADIENTS: Record<string, string[]> = {
  black:            ["#3a3a3a", "#5c5c5c", "#787878", "#a0a0a0"],
  "midnight-silver":["#4a4a5a", "#7a7a8a", "#9a9aaa", "#c0c0d0"],
  silver:           ["#9a9cc0", "#e7e3fd", "#e0dcf4", "#f1ecfe"],
  white:            ["#b8c0cc", "#d8dce6", "#e8ecf2", "#f4f6fa"],
  gray:             ["#6b7080", "#8e929e", "#adb0ba", "#cdd0d8"],
  red:              ["#a03030", "#d06868", "#e09898", "#f0c8c8"],
  blue:             ["#5090d8", "#c0daf8", "#b8d4f8", "#d8ecff"],
  green:            ["#2a7a4a", "#60b080", "#90d0a8", "#c8f0d8"],
  beige:            ["#b8a080", "#d4c0a8", "#e4d8c4", "#f2ece0"],
  brown:            ["#6b4030", "#8b6050", "#b08878", "#d8b8a8"],
};

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
  // State mirror of celebrationFlowActive so ref mutations trigger re-renders
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [pendingHealthSheet, setPendingHealthSheet] = useState(false);
  const [showHealthRingSheet, setShowHealthRingSheet] = useState(false);
  const [localOnboardingDone, setLocalOnboardingDone] = useState(false);
  // Page-transition animated values (replaces bottom-sheet slide-up)
  const mainPageSlideX = useRef(new Animated.Value(0)).current;
  const mainPageFade = useRef(new Animated.Value(1)).current;
  const healthPageSlideX = useRef(new Animated.Value(300)).current;
  const healthPageFade = useRef(new Animated.Value(0)).current;
  const [healthPageVisible, setHealthPageVisible] = useState(false);

  // Post-celebration reveal animation
  const [revealingDashboard, setRevealingDashboard] = useState(false);
  const dashboardFade = useRef(new Animated.Value(0)).current;
  const dashboardSlide = useRef(new Animated.Value(20)).current;
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;

  // Fullscreen gears overlay
  const [gearsOverlayVisible, setGearsOverlayVisible] = useState(false);
  const [gearsPhase, setGearsPhase] = useState<'looping' | 'building' | 'ready'>('looping');
  const gearsOverlayOpacity = useRef(new Animated.Value(1)).current;
  const gearsBtnOpacity = useRef(new Animated.Value(0)).current;
  const gearsLottieRef = useRef<any>(null);
  const lottieFadeOut = useRef(new Animated.Value(1)).current;
  const carImageFadeIn = useRef(new Animated.Value(0)).current;

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
  // Ref that holds the latest estimated (pre-confirmed) score
  const latestEstimatedScoreRef = useRef(0);

  // Health sheet display mode: 'estimated' shows stepper inside, 'confirmed' shows benefits + CTA
  const [healthSheetMode, setHealthSheetMode] = useState<'estimated' | 'confirmed'>('confirmed');
  const [estimatedPage, setEstimatedPage] = useState<'score' | 'checkin'>('score');
  const pageSlideX = useRef(new Animated.Value(0)).current;
  const pageFade = useRef(new Animated.Value(1)).current;
  const stepperRef = useRef<CarInfoStepperHandle>(null);
  const stepperGradientProgress = useSharedValue(1);
  // Mirrors healthSheetMode for use inside closeHealthSheet's stale closure
  const healthSheetModeRef = useRef<'estimated' | 'confirmed'>('confirmed');
  // Inline Quick Read card pulse animation
  const quickReadPulse = useRef(new Animated.Value(1)).current;

  // Guards the estimated sheet trigger so it fires once per tab mount cycle
  const estimatedSheetShownRef = useRef(false);

  const openHealthSheet = useCallback(() => {
    setHealthSheetMode('confirmed');
    const target = latestScoreRef.current;
    setHealthPageVisible(true);
    setShowHealthRingSheet(true);
    setDisplayedScore(0);
    setRingProgress(0);

    // Reset content animations
    ringScale.setValue(0.3);
    ringGlow.setValue(0);
    titleFade.setValue(0);
    subtitleFade.setValue(0);
    benefitsFade.setValue(0);
    buttonFade.setValue(0);
    pulseAnim.setValue(1);
    pageSlideX.setValue(0);
    pageFade.setValue(1);

    // Reset page-transition positions
    healthPageSlideX.setValue(300);
    healthPageFade.setValue(0);

    // Phase 1: Health page slides in from right
    Animated.parallel([
      Animated.timing(healthPageSlideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(healthPageFade, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      // Phase 2: Ring bounces in with glow
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.spring(ringScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(ringGlow, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start(() => {
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
  }, [healthPageSlideX, healthPageFade, ringScale, ringGlow, titleFade, subtitleFade, benefitsFade, buttonFade, pulseAnim]);

  const openEstimatedHealthSheet = useCallback(() => {
    setHealthSheetMode('estimated');
    setEstimatedPage('score');
    pageSlideX.setValue(0);
    pageFade.setValue(1);
    const target = latestEstimatedScoreRef.current;
    setHealthPageVisible(true);
    setShowHealthRingSheet(true);
    setDisplayedScore(0);
    setRingProgress(0);

    // Reset content animations
    ringScale.setValue(0.3);
    ringGlow.setValue(0);
    titleFade.setValue(0);
    subtitleFade.setValue(0);
    benefitsFade.setValue(0);
    buttonFade.setValue(0);
    pulseAnim.setValue(1);

    // Reset page-transition positions
    healthPageSlideX.setValue(300);
    healthPageFade.setValue(0);

    // Phase 1: Main page slides left + health page slides in from right
    Animated.parallel([
      Animated.timing(mainPageSlideX, { toValue: -300, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(mainPageFade, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(healthPageSlideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(healthPageFade, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        // Phase 2: Ring bounces in with lighter haptic
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.parallel([
          Animated.spring(ringScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
          Animated.timing(ringGlow, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]).start(() => {
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
    }, 50);
  }, [mainPageSlideX, mainPageFade, healthPageSlideX, healthPageFade, ringScale, ringGlow, titleFade, subtitleFade, benefitsFade, buttonFade, pulseAnim]);

  const animateToCheckin = useCallback(() => {
    Animated.parallel([
      Animated.timing(pageSlideX, { toValue: -300, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(pageFade, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setEstimatedPage('checkin');
      pageSlideX.setValue(300);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pageSlideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pageFade, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start();
      }, 50);
    });
  }, [pageSlideX, pageFade]);

  const animateBackToScore = useCallback(() => {
    Animated.parallel([
      Animated.timing(pageSlideX, { toValue: 300, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(pageFade, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setEstimatedPage('score');
      pageSlideX.setValue(-300);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pageSlideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pageFade, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start();
      }, 50);
    });
  }, [pageSlideX, pageFade]);

  const animateToConfirmedScore = useCallback(() => {
    // Slide stepper content out to the left + fade (within the health page)
    Animated.parallel([
      Animated.timing(pageSlideX, { toValue: -300, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(pageFade, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      // Switch to confirmed mode and reset internal page anim
      setHealthSheetMode('confirmed');
      healthSheetModeRef.current = 'confirmed';
      setEstimatedPage('score');
      pageSlideX.setValue(300);
      pageFade.setValue(0);

      // Show gears behind the health page before confirmed content slides in
      setGearsOverlayVisible(true);
      setGearsPhase('looping');
      gearsOverlayOpacity.setValue(1);
      gearsBtnOpacity.setValue(0);
      lottieFadeOut.setValue(1);
      carImageFadeIn.setValue(0);

      // Reset confirmed content animations
      ringScale.setValue(0.3);
      ringGlow.setValue(0);
      titleFade.setValue(0);
      subtitleFade.setValue(0);
      benefitsFade.setValue(0);
      buttonFade.setValue(0);
      pulseAnim.setValue(1);
      setDisplayedScore(0);
      setRingProgress(0);

      setTimeout(() => {
        // Slide confirmed content in from right
        Animated.parallel([
          Animated.timing(pageSlideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pageFade, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start(() => {
          const target = latestScoreRef.current;
          // Ring bounce + glow
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.parallel([
            Animated.spring(ringScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
            Animated.timing(ringGlow, { toValue: 1, duration: 600, useNativeDriver: true }),
          ]).start(() => {
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              ]),
            ).start();
          });

          // Score count-up
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

          // Staggered content fade-ins
          Animated.stagger(180, [
            Animated.timing(titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(benefitsFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(buttonFade, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]).start();
        });
      }, 100);
    });
  }, [pageSlideX, pageFade, gearsOverlayOpacity, gearsBtnOpacity, ringScale, ringGlow, titleFade, subtitleFade, benefitsFade, buttonFade, pulseAnim]);

  const closeHealthSheet = useCallback(() => {
    if (scoreCountRef.current) clearInterval(scoreCountRef.current);

    if (healthSheetModeRef.current === 'estimated') {
      // Reset main page to normal position behind the modal
      mainPageSlideX.setValue(0);
      mainPageFade.setValue(1);

      // Slide health page right and fade out — main page is visible behind (transparent modal)
      Animated.parallel([
        Animated.timing(healthPageSlideX, { toValue: 300, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(healthPageFade, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        setHealthPageVisible(false);
        setShowHealthRingSheet(false);
      });
    } else {
      // Confirmed mode: slide health page right (reveals gears underneath), then run gears flow
      Animated.parallel([
        Animated.timing(healthPageSlideX, { toValue: 300, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(healthPageFade, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        setHealthPageVisible(false);
        setShowHealthRingSheet(false);
        setPendingHealthSheet(false);
        // Transition gears overlay to building phase (Lottie mounts & autoPlays here)
        lottieFadeOut.setValue(1);
        carImageFadeIn.setValue(0);
        setGearsPhase('building');
        gearsBtnOpacity.setValue(0);

        setTimeout(() => {
          setGearsPhase('ready');
          Animated.timing(gearsBtnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        }, 8000);
      });
    }
  }, [healthPageSlideX, healthPageFade, mainPageSlideX, mainPageFade, gearsBtnOpacity]);

  const dismissGearsOverlay = useCallback(() => {
    // Bring main page back in underneath, then fade out gears
    mainPageSlideX.setValue(0);
    mainPageFade.setValue(1);
    Animated.timing(gearsOverlayOpacity, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      setGearsOverlayVisible(false);
      setGearsPhase('looping');
      celebrationFlowActive.current = false;
      setCelebrationActive(false);
    });
  }, [gearsOverlayOpacity, mainPageSlideX, mainPageFade]);

  // Convex: user's vehicles
  const { userId } = useUserFromConvex();
  const { vehicles: listVehicles, isLoading } = useVehicleOwnershipFromConvex();
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const resetOnboarding = useMutation(api.vehicles.resetVehicleOnboarding);
  const removeOwner = useMutation(api.vehicles.removeOwner);
  const autoCompleteNewVehicle = useMutation(api.vehicles.autoCompleteNewVehicleOnboarding);
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
      const meta = v ? (v as { metadata?: { make?: string; model?: string; color?: string } }).metadata : undefined;
      const paintColor = meta?.color;
      const gradient = (paintColor && COLOR_GRADIENTS[paintColor])
        || DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length];
      const displayMake = meta?.make || o?.nickname?.split(" ")[1] || "Vehicle";
      const displayModel = meta?.model || o?.nickname?.split(" ").slice(2).join(" ") || r.vin.slice(-6);
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
          imageSource: displayMake && displayModel
            ? { uri: getVehicleImageUrl(displayMake, displayModel, v?.year, r.vin, paintColor) }
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

  // Onboarding state for non-Smartcar vehicles.
  // localOnboardingDone is set immediately when the stepper finishes saving,
  // working around a Convex subscription delay that can leave the field undefined.
  const isOnboardingComplete = activeOwnership?.onboardingComplete === true || localOnboardingDone;
  // True only when onboarding is done AND the entire celebration flow is finished.
  // celebrationFlowActive.current is the synchronous guard that prevents any flash
  // between Convex pushing isOnboardingComplete and React applying state updates.
  const celebrationDismissed = isOnboardingComplete && !pendingHealthSheet && !showHealthRingSheet && !celebrationActive;
  // Show post-onboarding content (MaintenanceTracker, etc.) once onboarding is
  // confirmed and the reveal animation has finished. The health page is a
  // full-screen overlay so content behind it is not visible — no need to gate on sheet flags.
  const showPostOnboardingContent = isOnboardingComplete && !gearsOverlayVisible;
  const activeOwnershipMileage = activeOwnership?.mileage as number | undefined;
  const isNewVehicle = isPreOnboardingComplete && !isOnboardingComplete
    && activeOwnershipMileage != null && activeOwnershipMileage <= 1000;

  // Auto-complete onboarding for brand-new vehicles (≤1,000 mi) — skip the Quick Read
  const autoCompleteFired = useRef(false);
  useEffect(() => {
    if (!isNewVehicle || !activeOwnershipId || autoCompleteFired.current) return;
    autoCompleteFired.current = true;
    (async () => {
      try {
        await autoCompleteNewVehicle({ vehicleOwnerId: activeOwnershipId });
        setLocalOnboardingDone(true);
        celebrationFlowActive.current = true;
        setCelebrationActive(true);
        setPendingHealthSheet(true);
      } catch (err) {
        console.warn("[AutoComplete] Failed for new vehicle:", err);
        autoCompleteFired.current = false;
      }
    })();
  }, [isNewVehicle, activeOwnershipId, autoCompleteNewVehicle]);

  const activeOwnershipDrivingConditions = activeOwnership?.drivingConditions as string | undefined;
  const activeOwnershipAvgMonthlyDriving = activeOwnership?.avgMonthlyDriving as string | undefined;
  // Smartcar data for the active vehicle
  const {
    stats: smartcarStats,
    maintenanceItems: smartcarMaintenanceItems,
    tripStats,
    nextServicePrediction,
    isConnected: isActiveVehicleConnected,
  } = useSmartcarData(activeOwnershipId);

  // Merged maintenance: Smartcar items + user-provided records (with per-make intervals)
  // For non-connected vehicles with onboarding, use ownership.mileage as the odometer
  const currentOdometer = smartcarStats?.odometer?.distance
    ?? (isOnboardingComplete ? (activeOwnership?.mileage ?? null) : null);
  const activeOwnershipKnownIssues = activeOwnership?.knownIssues as string[] | undefined;
  const { mergedItems: mergedMaintenanceItems, recordsByType } = useMergedMaintenance(
    smartcarMaintenanceItems,
    activeOwnershipId,
    currentOdometer,
    activeVehicle?.make,
    activeOwnershipDrivingConditions,
    activeOwnershipAvgMonthlyDriving,
    activeOwnershipKnownIssues,
    activeVehicle?.year
  );

  // Unified vehicle health score — graduated maintenance statuses, warning-light
  // penalty, and Smartcar live-sensor blend when connected.
  const healthScoreInput: HealthScoreInput = useMemo(() => ({
    maintenanceItems: mergedMaintenanceItems,
    odometerMiles: currentOdometer ?? activeVehicle?.mileage ?? 0,
    knownIssues: activeOwnershipKnownIssues,
    smartcar: smartcarStats ? {
      oilLife: smartcarStats.oilLife,
      tirePressure: smartcarStats.tirePressure,
      fuelPercent: smartcarStats.fuel?.percentRemaining,
    } : undefined,
    pipelineHealthScore: activeOwnership?.health_score as number | undefined,
    pipelineIsEstimated: activeOwnership?.health_score_is_estimated as boolean | undefined,
  }), [mergedMaintenanceItems, currentOdometer, activeVehicle?.mileage, activeOwnershipKnownIssues, smartcarStats, activeOwnership?.health_score, activeOwnership?.health_score_is_estimated]);

  const computedHealthScore = useMemo(() => {
    return computeVehicleHealthScore(healthScoreInput);
  }, [healthScoreInput]);

  // Pulse animation for inline Quick Read health ring
  const showQuickReadCard = !isActiveVehicleConnected && isPreOnboardingComplete && !isOnboardingComplete && !isNewVehicle;
  useEffect(() => {
    if (!showQuickReadCard) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(quickReadPulse, { toValue: 1.08, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(quickReadPulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showQuickReadCard, quickReadPulse]);

  // Keep refs in sync so openHealthSheet/openEstimatedHealthSheet always read the latest scores
  latestScoreRef.current = computedHealthScore;
  latestEstimatedScoreRef.current = (activeOwnership?.health_score as number | undefined) ?? 0;
  healthSheetModeRef.current = healthSheetMode;

  // Open the confirmed health sheet once onboarding data has propagated.
  // Skip if the sheet is already visible (e.g. the estimated sheet transitioned
  // to confirmed mode in-place) to avoid a double-animation glitch.
  useEffect(() => {
    if (pendingHealthSheet && isOnboardingComplete && currentOdometer != null && !healthPageVisible) {
      setPendingHealthSheet(false);
      setTimeout(() => openHealthSheet(), 1200);
    }
  }, [pendingHealthSheet, isOnboardingComplete, currentOdometer, openHealthSheet, healthPageVisible]);

  // Keep the health sheet score/ring in sync when computedHealthScore updates
  // after the animation already finished (e.g. subscription delivers new data).
  useEffect(() => {
    if (showHealthRingSheet && healthSheetMode === 'confirmed') {
      setDisplayedScore(computedHealthScore);
      setRingProgress(computedHealthScore);
    }
  }, [computedHealthScore, showHealthRingSheet, healthSheetMode]);

  // Opens the full-screen stepper directly (skips the score page, goes straight to checkin/grid).
  const openStepperDirectly = useCallback(() => {
    setHealthSheetMode('estimated');
    setEstimatedPage('checkin');
    healthSheetModeRef.current = 'estimated';
    setHealthPageVisible(true);
    setShowHealthRingSheet(true);

    healthPageSlideX.setValue(300);
    healthPageFade.setValue(0);
    pageSlideX.setValue(0);
    pageFade.setValue(1);

    Animated.parallel([
      Animated.timing(mainPageSlideX, { toValue: -300, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(mainPageFade, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(healthPageSlideX, { toValue: 0, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(healthPageFade, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        mainPageSlideX.setValue(0);
        mainPageFade.setValue(1);
      });
    }, 400);
  }, [mainPageSlideX, mainPageFade, healthPageSlideX, healthPageFade, pageSlideX, pageFade]);

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


  // Active vehicle's gradient colors for the background
  const activeGradient = useMemo(
    () => activeVehicle?.gradientColors ?? DEFAULT_GRADIENTS[0],
    [activeVehicle?.gradientColors]
  );

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
      {/* Main page wrapper — animated out when health page slides in */}
      <Animated.View style={{ flex: 1, opacity: mainPageFade, transform: [{ translateX: mainPageSlideX }] }}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6B7280" />}
      >
        {/* Scrolling Gradient - uses active vehicle's color */}
        <View style={styles.scrollingGradientContainer} pointerEvents="none">
          <LinearGradient
            colors={activeGradient as [string, string, ...string[]]}
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
        </View>

        {/* Dev/debug buttons — top left */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, marginBottom: 4, zIndex: 10, position: "relative" }}>
          {!isActiveVehicleConnected && isPreOnboardingComplete && showPostOnboardingContent && activeOwnershipId && (
            <Pressable
              style={({ pressed }) => [{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(82,153,254,0.1)" }, pressed && { opacity: 0.7 }]}
              onPress={async () => {
                try {
                  await resetOnboarding({ vehicleOwnerId: activeOwnershipId });
                  setLocalOnboardingDone(false);
                } catch (err) {
                  console.warn("Reset onboarding failed:", err);
                }
              }}
            >
              <Text weight="semiBold" size="xs" color="#5299FE">Redo Info</Text>
            </Pressable>
          )}
          {!!activeVehicle?.vin && !!userId && (
            <Pressable
              style={({ pressed }) => [{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.12)" }, pressed && { opacity: 0.7 }]}
              onPress={handleRemoveActiveVehicle}
            >
              <Text weight="semiBold" size="xs" color="#DC2626">Remove</Text>
            </Pressable>
          )}
          {activeOwnershipId && isPreOnboardingComplete && (
            <Pressable
              style={({ pressed }) => [{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.05)" }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push({ pathname: "/quarterly-checkin", params: { vehicleOwnerId: activeOwnershipId, vehicleName: activeVehicle?.make ? `${activeVehicle.make} ${activeVehicle.model ?? ""}`.trim() : undefined } })}
            >
              <Text weight="semiBold" size="xs" color="#6B7280">Demo Check-In</Text>
            </Pressable>
          )}
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
            showHealthRing={isActiveVehicleConnected || celebrationDismissed || (isOnboardingComplete && !celebrationActive && !healthPageVisible)}
            healthScore={isPreOnboardingComplete && !isOnboardingComplete
              ? (activeOwnership?.health_score as number | undefined) ?? computedHealthScore
              : computedHealthScore}
            isEstimatedScore={isPreOnboardingComplete && !isOnboardingComplete}
            onResumeCheckin={openEstimatedHealthSheet}
          />
        </View>

        {/* Quick Read intro card — shown when pre-onboarding done but onboarding not yet complete */}
        {!isActiveVehicleConnected && isPreOnboardingComplete && !isOnboardingComplete && !isNewVehicle && (() => {
          const estScore = (activeOwnership?.health_score as number | undefined) ?? computedHealthScore;
          const ringSize = 120;
          const strokeWidth = 10;
          const radius = (ringSize - strokeWidth) / 2;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference * (1 - estScore / 100);
          const center = ringSize / 2;
          return (
          <View style={styles.quickReadCard}>
            <View style={{ alignItems: "center", justifyContent: "center", width: 140, height: 140, marginBottom: 12 }}>
              <Animated.View style={{ position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "#94A3B8", opacity: 0.12, transform: [{ scale: quickReadPulse }] }} />
              <Animated.View style={{ position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "#94A3B8", opacity: 0.06, transform: [{ scale: quickReadPulse }] }} />
              <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
                <Svg width={ringSize} height={ringSize}>
                  <Circle cx={center} cy={center} r={radius} stroke="rgba(0,0,0,0.06)" strokeWidth={strokeWidth} fill="none" />
                  <Circle
                    cx={center} cy={center} r={radius}
                    stroke="#94A3B8"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90 ${center} ${center})`}
                  />
                </Svg>
                <View style={{ position: "absolute", alignItems: "center" }}>
                  <Text weight="bold" size="2xl" color="#1F2937">{estScore}</Text>
                  <Text weight="medium" size="xs" color="#94A3B8">Estimated</Text>
                </View>
              </View>
            </View>
            <Text weight="bold" size="lg" color="#1F2937" style={{ textAlign: "center" }}>
              Here&apos;s an estimate of where your {activeVehicle?.make && activeVehicle?.model ? `${activeVehicle.make} ${activeVehicle.model}` : "vehicle"} stands
            </Text>
            <Text weight="medium" size="sm" color="#6B7280" style={{ textAlign: "center", marginTop: 6 }}>
              Five quick checks to understand your vehicle&apos;s current condition.
            </Text>
            <View style={styles.quickReadBenefits}>
              {["Brake health assessment", "Tire life estimation", "Oil service status", "Battery condition check", "Warning light detection"].map((b) => (
                <View key={b} style={styles.quickReadBenefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#5299FE" />
                  <Text weight="medium" size="sm" color="#374151">{b}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.quickReadCta, pressed && { opacity: 0.85 }]}
              onPress={openStepperDirectly}
            >
              <Text weight="bold" size="md" color="#FFFFFF">Get a quick read on your {activeVehicle?.make && activeVehicle?.model ? `${activeVehicle.make} ${activeVehicle.model}` : "vehicle"}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
            <Text weight="medium" size="xs" color="#9CA3AF" style={{ marginTop: 10 }}>Takes about 30 seconds</Text>
          </View>
          );
        })()}

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

          

          {/* Quarterly Check-in Banner */}
          {activeOwnershipId && isPreOnboardingComplete && (
            <CheckinBanner
              vehicleOwnerId={activeOwnershipId}
              vehicleName={activeVehicle?.make ? `${activeVehicle.make} ${activeVehicle.model ?? ""}`.trim() : undefined}
            />
          )}

          {/* Maintenance tracker (shown for connected vehicles, or non-connected after onboarding + sheet dismissed) */}
          {(isActiveVehicleConnected || showPostOnboardingContent) && (
            <MaintenanceTracker
              items={mergedMaintenanceItems}
              vehicleCondition={computedHealthScore}
              healthScoreInput={healthScoreInput}
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

          {/* Service History Section (hidden until onboarding complete) */}
          {(isActiveVehicleConnected || isOnboardingComplete) && <ServiceHistory
            records={serviceRecords}
            onAddNotes={(id) => {
              // TODO: Open notes modal/screen for this service record
              console.log("Add Notes for record", id);
            }}
            onDownloadReceipt={(id) => {
              // TODO: Download PDF receipt for this service record
              console.log("Download Receipt for record", id);
            }}
          />}

          {/* Loyalty Points Section (hidden until onboarding complete) */}
          {(isActiveVehicleConnected || isOnboardingComplete) && <LoyaltyPoints
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
          />}
        </View>
      </ScrollView>
      </Animated.View>

      {/* Maintenance Input Modal */}
      {activeOwnershipId && (
        <MaintenanceInputModal
          visible={maintenanceModalVisible}
          maintenanceType={maintenanceModalType}
          vehicleOwnerId={activeOwnershipId}
          vehicleYear={activeVehicle?.year}
          knownIssues={activeOwnershipKnownIssues}
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
            const renderIcon = () => {
              switch (type) {
                case "oil":     return <OilIcon size={22} color="#5299FE" />;
                case "brakes":  return <BrakesIcon size={22} color="#5299FE" />;
                case "tires":   return <TireIcon size={22} color="#5299FE" />;
                case "battery": return <BatteryIcon size={22} color="#5299FE" />;
                default:        return <WarningIcon size={22} color="#5299FE" />;
              }
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
                  {renderIcon()}
                </View>
                <Text weight="medium" size="md" color="#1F2937" style={{ flex: 1 }}>
                  {MAINTENANCE_LABELS[type]}
                </Text>
                <Text weight="semiBold" size="sm" color="#5299FE">Edit</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          HEALTH PAGE + GEARS OVERLAY (full-screen modal, covers tab bar)
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={healthPageVisible || gearsOverlayVisible}
        transparent={true}
        animationType="none"
        statusBarTranslucent
        presentationStyle="fullScreen"
        onRequestClose={closeHealthSheet}
      >
      {healthPageVisible && (
        <Animated.View style={[healthSheetStyles.fullPage, { zIndex: 40, opacity: healthPageFade, transform: [{ translateX: healthPageSlideX }] }]}>
          {healthSheetMode === 'estimated' && estimatedPage === 'checkin' && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <AnimatedGradientBackground
                progress={stepperGradientProgress}
                fromIndex={0}
                toIndex={1}
                colors={['#EDF4FC', '#D6E8F8', '#B8D4F0']}
              />
            </View>
          )}
          {healthSheetMode === 'confirmed' && (
            <LinearGradient
              colors={['#D0E7F4', '#DFEDF6', '#EBF2F8', '#F3F7FA', '#FAFCFD', '#FFFFFF']}
              locations={[0, 0.18, 0.35, 0.5, 0.7, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          {/* --- Header --- */}
          {healthSheetMode === 'estimated' ? (
            estimatedPage === 'checkin' ? (
              <View style={healthSheetStyles.fullPageHeader}>
                <Pressable onPress={() => {
                  if (stepperRef.current?.isExpanded()) {
                    stepperRef.current.goBack();
                  } else {
                    closeHealthSheet();
                  }
                }} hitSlop={12} style={healthSheetStyles.fullPageCloseBtn}>
                  <Ionicons name="chevron-back" size={22} color="#6B7280" />
                </Pressable>
                <View style={{ width: 36 }} />
              </View>
            ) : (
              <View style={{ paddingTop: Platform.OS === "ios" ? 70 : 50 }} />
            )
          ) : (
            <View style={{ paddingTop: Platform.OS === "ios" ? 70 : 50 }} />
          )}

          {/* --- Page content --- */}
          <Animated.View style={{ flex: 1, opacity: pageFade, transform: [{ translateX: pageSlideX }] }}>
          {healthSheetMode === 'estimated' && estimatedPage === 'checkin' ? (
            <View style={{ flex: 1, width: '100%' }}>
              {activeOwnershipId && (
                <CarInfoStepper
                  ref={stepperRef}
                  vehicleOwnerId={activeOwnershipId}
                  vehicleMake={activeVehicle?.make ?? ''}
                  vehicleModel={activeVehicle?.model ?? ''}
                  vehicleYear={activeVehicle?.year ?? 0}
                  skipIntro
                  onComplete={() => {
                    console.log('[CarInfoStepper] onComplete fired — SHEET instance');
                    setLocalOnboardingDone(true);
                    celebrationFlowActive.current = true;
                    setCelebrationActive(true);
                    animateToConfirmedScore();
                  }}
                />
              )}
            </View>
          ) : (
            <View style={[healthSheetStyles.content, { flex: 1, justifyContent: "center" }]}>
              {/* SVG health ring */}
              {(() => {
                const ringColor = healthSheetMode === 'estimated'
                  ? '#94A3B8'
                  : computedHealthScore >= 75 ? '#30D158'
                  : computedHealthScore >= 60 ? '#FFEA00'
                  : '#FF3B30';
                return (
              <View style={healthSheetStyles.ringContainer}>
                <Animated.View style={[
                  healthSheetStyles.ringGlow,
                  {
                    opacity: Animated.multiply(ringGlow, new Animated.Value(0.35)),
                    transform: [{ scale: pulseAnim }],
                    backgroundColor: ringColor,
                  },
                ]} />
                <Animated.View style={[
                  healthSheetStyles.ringGlowInner,
                  {
                    opacity: Animated.multiply(ringGlow, new Animated.Value(0.15)),
                    transform: [{ scale: pulseAnim }],
                    backgroundColor: ringColor,
                  },
                ]} />
                <Animated.View style={{ transform: [{ scale: ringScale }] }}>
                  {(() => {
                    const ringSize = 140;
                    const strokeWidth = 10;
                    const radius = (ringSize - strokeWidth) / 2;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference * (1 - ringProgress / 100);
                    const center = ringSize / 2;
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
                          <Circle cx={center} cy={center} r={radius} stroke={ringColor} strokeWidth={strokeWidth} fill="none" opacity={0.15} />
                          <Circle cx={center} cy={center} r={radius} stroke="url(#healthSheetRingGrad)" strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} />
                          <Circle cx={center} cy={center} r={radius} stroke={ringColor} strokeWidth={strokeWidth + 4} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} opacity={0.2} />
                        </Svg>
                        <View style={healthSheetStyles.ringCenterLabel}>
                          <Text weight="bold" size="3xl" color="#1F2937" style={{ fontFamily: FontFamily.serifBold }}>{activeOwnership?.health_score_is_estimated ? "~" : ""}{displayedScore}</Text>
                          <Text weight="semiBold" size="xs" color="#9CA3AF" style={{ marginTop: -2, fontFamily: FontFamily.serif }}>{activeOwnership?.health_score_is_estimated ? "estimated" : "out of 100"}</Text>
                        </View>
                      </View>
                    );
                  })()}
                </Animated.View>
              </View>
                );
              })()}

              {/* Title */}
              <Animated.View style={{ opacity: titleFade, marginTop: healthSheetMode === 'confirmed' ? 50 : 0, transform: [{ translateY: titleFade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
                <Text weight="bold" size="xl" color="#1F2937" style={[healthSheetStyles.title, { fontFamily: FontFamily.serifBold }]}>
                  {healthSheetMode === 'estimated'
                    ? `Here's where your ${activeVehicle?.make ?? "vehicle"} stands`
                    : computedHealthScore >= 80
                      ? `Your ${activeVehicle?.make ?? "vehicle"} is in great shape`
                      : computedHealthScore >= 60
                        ? `Your ${activeVehicle?.make ?? "vehicle"} is looking solid`
                        : `We've got a plan for your ${activeVehicle?.make ?? "vehicle"}`}
                </Text>
              </Animated.View>

              {/* Subtitle */}
              <Animated.View style={{ opacity: subtitleFade, transform: [{ translateY: subtitleFade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
                <Text weight="medium" size="sm" color="#6B7280" style={[healthSheetStyles.subtitle, { fontFamily: FontFamily.serif }]}>
                  {healthSheetMode === 'estimated'
                    ? "Answer a few quick questions to get your confirmed health score."
                    : computedHealthScore >= 80
                      ? "You're clearly someone who takes care of their ride. We'll make sure it stays that way."
                      : computedHealthScore >= 60
                        ? "A few things could use attention, but nothing we can't help with. You're in good hands."
                        : "Don't worry — now that we know what's going on, we'll guide you through every service it needs."}
                </Text>
              </Animated.View>

              {/* Estimated: Quick Read intro card  |  Confirmed: Benefits + Done CTA */}
              {healthSheetMode === 'estimated' ? (
                <Animated.View style={[{ width: "100%", marginTop: 8 }, { opacity: benefitsFade, transform: [{ translateY: benefitsFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
                  <View style={healthSheetStyles.introCard}>
                    <View style={healthSheetStyles.introIconContainer}>
                      <Ionicons name="pulse-outline" size={28} color="#5299FE" />
                    </View>
                    <Text weight="bold" size="md" color="#1F2937" style={{ marginTop: 12, textAlign: "center", fontFamily: FontFamily.serifBold }}>
                      Let&apos;s get a quick read on your {activeVehicle?.make ?? "vehicle"}
                    </Text>
                    <Text weight="medium" size="sm" color="#6B7280" style={{ marginTop: 4, textAlign: "center", fontFamily: FontFamily.serif }}>
                      Five quick checks to understand your vehicle&apos;s current condition.
                    </Text>
                    <View style={healthSheetStyles.introBenefits}>
                      {["Brake health assessment", "Tire life estimation", "Oil service status", "Battery condition check", "Warning light detection"].map((b) => (
                        <View key={b} style={healthSheetStyles.introBenefitRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#5299FE" />
                          <Text weight="medium" size="sm" color="#374151" style={{ marginLeft: 8, fontFamily: FontFamily.serif }}>{b}</Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={animateToCheckin}
                      style={({ pressed }) => [healthSheetStyles.ctaButton, pressed && { opacity: 0.9 }]}
                    >
                      <LinearGradient
                        colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[healthSheetStyles.ctaButtonGradient, { flexDirection: "row" }]}
                      >
                        <Text weight="semiBold" size="md" color="#FFFFFF" style={{ fontSize: 17, fontFamily: FontFamily.serifBold }}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                      </LinearGradient>
                    </Pressable>
                    <Text weight="medium" size="xs" color="#9CA3AF" style={{ marginTop: 10, fontFamily: FontFamily.serif }}>Takes about 30 seconds</Text>
                    <Pressable
                      onPress={closeHealthSheet}
                      style={({ pressed }) => [{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 24 }, pressed && { opacity: 0.6 }]}
                    >
                      <Text weight="semiBold" size="sm" color="#6B7280" style={{ fontFamily: FontFamily.serif }}>I'll finish later</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ) : (
                <>
                  <Animated.View style={[{ alignSelf: "stretch", marginTop: 20, marginBottom: 20, gap: 28, paddingHorizontal: 8 }, { opacity: benefitsFade, transform: [{ translateY: benefitsFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
                    {[
                      { icon: "shield-checkmark" as const, text: "Health monitoring active" },
                      { icon: "notifications" as const, text: "Service reminders enabled" },
                      { icon: "trending-up" as const, text: "Maintenance predictions on" },
                    ].map((benefit) => (
                      <View key={benefit.text} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                        <View style={healthSheetStyles.benefitIcon}>
                          <Ionicons name={benefit.icon} size={24} color="#5299FE" />
                        </View>
                        <Text weight="medium" size="xl" color="#1F2937" style={{ fontFamily: FontFamily.serif }}>{benefit.text}</Text>
                      </View>
                    ))}
                  </Animated.View>
                  <Animated.View style={[{ width: "100%", marginTop: "auto", paddingBottom: insets.bottom + 24 }, { opacity: buttonFade, transform: [{ translateY: buttonFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
                    <Pressable
                      onPress={closeHealthSheet}
                      style={({ pressed }) => [healthSheetStyles.ctaButton, pressed && { opacity: 0.9 }]}
                    >
                      <LinearGradient
                        colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={healthSheetStyles.ctaButtonGradient}
                      >
                        <Text weight="semiBold" size="md" color="#FFFFFF" style={{ fontSize: 17, fontFamily: FontFamily.serifBold }}>Optimize my vehicle profile</Text>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                </>
              )}
            </View>
          )}
          </Animated.View>
        </Animated.View>
      )}

      {/* Fullscreen gears overlay */}
      {gearsOverlayVisible && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: gearsOverlayOpacity, zIndex: 35 }]}>
          <LinearGradient
            colors={['#D0E7F4', '#DFEDF6', '#EBF2F8', '#F3F7FA', '#FAFCFD', '#FFFFFF']}
            locations={[0, 0.18, 0.35, 0.5, 0.7, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {gearsPhase !== 'looping' && (
            <Animated.View style={{ position: 'absolute', top: '28%', left: '15%', right: '15%', bottom: '27%', opacity: lottieFadeOut }}>
              <LottieView
                ref={gearsLottieRef}
                source={require("@/assets/animations/loading-bar.json")}
                loop={false}
                autoPlay={false}
                onLayout={() => gearsLottieRef.current?.play(100, 275)}
                onAnimationFinish={(isCancelled) => {
                  if (isCancelled) return;
                  Animated.parallel([
                    Animated.timing(lottieFadeOut, { toValue: 0, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    Animated.timing(carImageFadeIn, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                  ]).start();
                }}
                colorFilters={[
                  { keypath: 'progress', color: '#5299FE' },
                  { keypath: '0% ', color: '#5299FE' },
                  { keypath: 'bg', color: '#E8F1FE' },
                ]}
                style={{ flex: 1 }}
                resizeMode="contain"
              />
            </Animated.View>
          )}
          {activeVehicle?.imageSource && (
            <Animated.View style={{ position: 'absolute', top: '35%', left: 0, right: 0, alignItems: 'center', opacity: carImageFadeIn, transform: [{ scale: carImageFadeIn.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
              <View style={{ width: 320, height: 240, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={activeVehicle.imageSource}
                  style={{ width: '100%', height: 180, zIndex: 1, transform: [{ translateY: 155 }] }}
                  resizeMode="stretch"
                />
                <Image
                  source={activeVehicle.imageSource}
                  style={{ width: '100%', height: 180, transform: [{ scaleY: -1 }], opacity: 0.03, marginTop: -40 }}
                  resizeMode="stretch"
                />
              </View>
            </Animated.View>
          )}
          {gearsPhase !== 'looping' && (
            <View style={{ zIndex: 1, marginTop: Platform.OS === 'ios' ? 140 : 96, alignItems: 'center', paddingHorizontal: 24 }}>
              <Animated.View style={{ position: 'absolute', opacity: carImageFadeIn.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
                <Text weight="bold" size="3xl" color="#0F172A" style={{ textAlign: 'center', fontFamily: FontFamily.serifBold }}>
                  Optimizing your vehicle profile...
                </Text>
              </Animated.View>
              <Animated.View style={{ opacity: carImageFadeIn }}>
                <Text weight="bold" size="3xl" color="#0F172A" style={{ textAlign: 'center', fontFamily: FontFamily.serifBold }}>
                  Vehicle profile optimized
                </Text>
              </Animated.View>
            </View>
          )}
          {gearsPhase === 'ready' && (
            <Animated.View style={{ opacity: gearsBtnOpacity, zIndex: 1, position: 'absolute', bottom: insets.bottom + 40, left: 24, right: 24 }}>
              <Pressable
                onPress={dismissGearsOverlay}
                style={({ pressed }) => [healthSheetStyles.ctaButton, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={healthSheetStyles.ctaButtonGradient}
                >
                  <Text weight="semiBold" size="md" color="#FFFFFF" style={{ fontSize: 17, fontFamily: FontFamily.serifBold }}>View My Dashboard</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      )}
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
  fullPage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  fullPageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  fullPageCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  introCard: {
    alignItems: "center",
    backgroundColor: "#F0F4FF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.15)",
  },
  introIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(82, 153, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  introBenefits: {
    alignSelf: "stretch",
    marginTop: 12,
    marginBottom: 14,
    gap: 8,
  },
  introBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  ringContainer: {
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
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
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  benefitsContainer: {
    alignSelf: "stretch",
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(82, 153, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaButtonGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "#F0F4FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    height: 260,
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
  quickReadCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
  },
  quickReadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(82,153,254,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickReadBenefits: {
    alignSelf: "stretch",
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
    paddingLeft: 8,
  },
  quickReadBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickReadCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: "#5299FE",
  },
});
