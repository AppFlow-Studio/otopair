// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import ReAnimated, {
  Easing as ReEasing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft, Check as CheckIcon, Copy, Info, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { WebView } from "react-native-webview";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

// 3. Convex & hooks
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useMergedMaintenance } from "@/hooks/useMaintenanceData";
import { useDriverRecommendationsFromConvex } from "@/hooks/useDriverRecommendationsFromConvex";
import { useBookingStore } from "@/stores/useBookingStore";
import { useTireBookingStore } from "@/stores/useTireBookingStore";
import type { Id } from "@/convex/_generated/dataModel";
import { ALL_MAINTENANCE_TYPES, MAINTENANCE_LABELS, type MaintenanceType } from "@/utils/maintenanceStatus";
import { computeVehicleHealthScore, type HealthScoreInput } from "@/utils/healthScore";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { OilIcon, BrakesIcon, TireIcon, BatteryIcon, WarningIcon } from "@/components/cars/ServiceIcons";
import { fetchVehicleImageUrl } from "@/utils/vehicleImage";
import { isDarkColor } from "@/utils/contrast";
import { scale, verticalScale, moderateScale } from '@/utils/responsive';

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 5. Flow-specific components
import CarCarousel, { Vehicle } from "@/components/cars/CarCarousel";
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";
import LoyaltyPoints from "@/components/cars/LoyaltyPoints";
import MaintenanceTracker from "@/components/cars/MaintenanceTracker";
import MaintenanceInputModal from "@/components/cars/MaintenanceInputModal";
import { CheckinBanner } from "@/components/cars/CheckinBanner";
import UpcomingFollowUpsCard from "@/components/cars/UpcomingFollowUpsCard";
import CarInfoStepper, { type CarInfoStepperHandle } from "@/components/cars/CarInfoStepper";
import { AnimatedGradientBackground } from "@/components/shared-ui/AnimatedGradientBackground";
import ServiceHistory, { ServiceRecord, type PickedDocument } from "@/components/cars/ServiceHistory";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { PostOptimizeBookingSheet } from "@/components/cars/PostOptimizeBookingSheet";

// ============================================================================
// HELPERS
// ============================================================================

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================================
// VEHICLE-SPECIFIC DATA
// ============================================================================

// Light-mode palettes — top stop is a soft, color-tinted shade and the
// bottom stop is near-white. The natural transition between them lands
// in the tire zone of the carousel hero and reads as a subtle "floor"
// without needing a hard-coded hairline. Matches the rest of the app's
// light surface so the cars page no longer feels like a dark island.
// Top stop holds a saturated-but-still-light tint of the car's paint,
// middle stop is a small step lighter, bottom stop is near-white. The
// strong contrast between the top pair and the bottom + a tight
// transition window (see `locations` below) is what produces the
// visible "floor line" at the tire zone.
// Three-stop palettes that mirror the home screen's brightness curve
// (`STATIC_GRADIENT` in ScrollDrivenGradientBackground:
// ['#86C2E8','#B0D6F0','#EAF2FA']) — saturated mid-tone at the top,
// a softer tint in the middle, near-white at the bottom — tinted per
// car color so the cars page reads as part of the same light-mode app.
// Stops are evenly distributed (no `locations` prop) for the same
// smooth top→bottom fade home uses.
const DEFAULT_GRADIENTS = [
  ["#A6B5D0", "#C5CFDE", "#EDF0F5"],
  ["#86C2E8", "#B0D6F0", "#EAF2FA"],
];

/**
 * Derives the desaturated-dark RGB triple ("r, g, b", no alpha) from a
 * hex color. Parses #RRGGBB, darkens each channel toward black, and
 * mixes in a small amount of gray to drop saturation. Used as the
 * shared base for both the ground line and ground shadow tints —
 * the line composes `rgba(${rgb}, 0.32)`, the shadow uses the rgb
 * directly with its own per-stop opacity. Tuned so the result reads
 * as shadow on the light-mode palettes currently in use (blue → dark
 * slate-blue, red → dark plum, etc.) without going pure-black.
 */
function darkRgbFromHex(hex: string): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const darken = 0.30;
  const grayMix = 0.20;
  const dr = Math.round(r * darken * (1 - grayMix) + 60 * grayMix);
  const dg = Math.round(g * darken * (1 - grayMix) + 60 * grayMix);
  const db = Math.round(b * darken * (1 - grayMix) + 60 * grayMix);
  return `${dr}, ${dg}, ${db}`;
}

/** rgba string from a hex base + alpha — convenience wrapper around `darkRgbFromHex`. */
function shadowTintFromHex(hex: string, alpha: number): string {
  return `rgba(${darkRgbFromHex(hex)}, ${alpha})`;
}

const COLOR_GRADIENTS: Record<string, string[]> = {
  black:            ["#8E96A7", "#B8BFCD", "#ECEFF4"],
  "midnight-silver":["#8190A5", "#AEB9C9", "#EAEEF3"],
  silver:           ["#8290A0", "#AEB7C6", "#EAEDF2"],
  white:            ["#B8C2D0", "#D0D7E1", "#F2F5F9"],
  gray:             ["#525C70", "#8B96A8", "#EBEEF3"],
  red:              ["#E8909C", "#F0B5BE", "#FBE2E5"],
  blue:             ["#86C2E8", "#B0D6F0", "#EAF2FA"],
  green:            ["#7BCBA7", "#A8DDC1", "#E4F3EB"],
  beige:            ["#D4B189", "#E4CCAE", "#F6EAD6"],
  brown:            ["#B98D6A", "#D0AC8D", "#EFE0CD"],
};


const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CarsHomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const params = useLocalSearchParams<{ openStepper?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  // Active vehicle is tracked by VIN so adding/removing a car (which can
  // re-sort the list via `isDefault` then VIN) doesn't scramble which car is
  // selected. The numeric `activeVehicleIndex` is derived from the VIN.
  const [activeVehicleVin, setActiveVehicleVin] = useState<string | null>(null);
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
  const [healthPageReady, setHealthPageReady] = useState(false);

  // Post-celebration reveal animation
  const [revealingDashboard, setRevealingDashboard] = useState(false);
  const dashboardFade = useRef(new Animated.Value(0)).current;
  const dashboardSlide = useRef(new Animated.Value(20)).current;
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;

  // Post-optimize booking sheet: opens once when the gears overlay
  // dismisses, then stays closed until the user re-runs Optimize.
  const [showOptimizeBookingSheet, setShowOptimizeBookingSheet] = useState(false);

  // Fullscreen gears overlay
  const [pickedDocuments, setPickedDocuments] = useState<PickedDocument[]>([]);
  const [viewingDocument, setViewingDocument] = useState<PickedDocument | null>(null);
  const [gearsOverlayVisible, setGearsOverlayVisible] = useState(false);
  const [gearsPhase, setGearsPhase] = useState<'looping' | 'building' | 'ready'>('looping');
  const gearsOverlayOpacity = useRef(new Animated.Value(1)).current;
  const gearsBtnOpacity = useRef(new Animated.Value(0)).current;
  const lottieFadeOut = useRef(new Animated.Value(1)).current;
  const carImageFadeIn = useRef(new Animated.Value(0)).current;
  // AI profile building steps (Claude-like sequential task list)
  const AI_STEPS = [
    { icon: "car-sport-outline" as const, label: "Reading vehicle identification data…" },
    { icon: "search-outline" as const, label: "Cross-referencing VIN with manufacturer records…" },
    { icon: "speedometer-outline" as const, label: "Analyzing odometer and driving patterns…" },
    { icon: "construct-outline" as const, label: "Evaluating maintenance history and service gaps…" },
    { icon: "analytics-outline" as const, label: "Computing health score from 12 data signals…" },
    { icon: "calendar-outline" as const, label: "Generating personalized maintenance schedule…" },
    { icon: "shield-checkmark-outline" as const, label: "Finalizing vehicle profile and recommendations…" },
  ];
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const stepOpacities = useRef(AI_STEPS.map(() => new Animated.Value(0))).current;
  const stepIconScales = useRef(AI_STEPS.map(() => new Animated.Value(0.5))).current;
  const lineHeights = useRef(AI_STEPS.map(() => new Animated.Value(0))).current;
  const aiStepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carPulseAnim = useRef(new Animated.Value(1)).current;
  const carPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

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
        setHealthPageReady(false);
        setShowHealthRingSheet(false);
      });
    } else {
      // Confirmed mode: slide health page left (reveals gears underneath), then run gears flow
      Animated.parallel([
        Animated.timing(healthPageSlideX, { toValue: -300, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(healthPageFade, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        setHealthPageVisible(false);
        setHealthPageReady(false);
        setShowHealthRingSheet(false);
        setPendingHealthSheet(false);
        // Transition gears overlay to building phase
        lottieFadeOut.setValue(1);
        carImageFadeIn.setValue(0);
        setGearsPhase('building');
        gearsBtnOpacity.setValue(0);

        // Reset step state
        setCompletedSteps(0);
        setActiveStep(0);
        stepOpacities.forEach(o => o.setValue(0));
        stepIconScales.forEach(s => s.setValue(0.5));
        lineHeights.forEach(h => h.setValue(0));

        // Start pulsing car image
        carPulseAnim.setValue(1);
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(carPulseAnim, { toValue: 0.6, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(carPulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        );
        carPulseLoopRef.current = pulse;
        pulse.start();

        // Sequentially reveal each step (Claude-like)
        const STEP_DELAY = 1800; // ms between each step appearing
        const revealStep = (idx: number) => {
          if (idx >= AI_STEPS.length) {
            // All steps done — transition to ready phase after a pause
            aiStepTimeoutRef.current = setTimeout(() => {
              if (carPulseLoopRef.current) carPulseLoopRef.current.stop();
              carPulseAnim.setValue(1);
              setCompletedSteps(AI_STEPS.length);

              Animated.parallel([
                Animated.timing(lottieFadeOut, { toValue: 0, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(carImageFadeIn, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
              ]).start();

              setGearsPhase('ready');
              Animated.timing(gearsBtnOpacity, { toValue: 1, duration: 400, delay: 600, useNativeDriver: true }).start();
            }, 1200);
            return;
          }

          setActiveStep(idx);
          // Animate step appearing
          Animated.parallel([
            Animated.timing(stepOpacities[idx], { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.spring(stepIconScales[idx], { toValue: 1, damping: 15, stiffness: 200, useNativeDriver: true }),
          ]).start();

          // Animate connecting line growing (after step is visible)
          if (idx > 0) {
            Animated.timing(lineHeights[idx - 1], { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
          }

          // Mark previous step as completed after a brief delay
          if (idx > 0) {
            setTimeout(() => setCompletedSteps(idx), 300);
          }

          // Schedule next step
          aiStepTimeoutRef.current = setTimeout(() => revealStep(idx + 1), STEP_DELAY);
        };

        // Start first step after a short pause
        aiStepTimeoutRef.current = setTimeout(() => revealStep(0), 600);
      });
    }
  }, [healthPageSlideX, healthPageFade, mainPageSlideX, mainPageFade, gearsBtnOpacity]);

  const dismissGearsOverlay = useCallback(() => {
    // Clean up AI step sequencing & car pulse
    if (aiStepTimeoutRef.current) { clearTimeout(aiStepTimeoutRef.current); aiStepTimeoutRef.current = null; }
    if (carPulseLoopRef.current) { carPulseLoopRef.current.stop(); carPulseLoopRef.current = null; }
    // Bring main page back in underneath, then fade out gears
    mainPageSlideX.setValue(0);
    mainPageFade.setValue(1);
    Animated.timing(gearsOverlayOpacity, { toValue: 0, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      setGearsOverlayVisible(false);
      setGearsPhase('looping');
      celebrationFlowActive.current = false;
      setCelebrationActive(false);
      // Optimize flow just finished — surface the booking sheet on the
      // car's dashboard. Opens once per cycle; dismissed-on-its-own = stays
      // closed until the user runs Optimize again.
      setShowOptimizeBookingSheet(true);
    });
  }, [gearsOverlayOpacity, mainPageSlideX, mainPageFade]);

  // Convex: user's vehicles
  const { userId } = useUserFromConvex();
  const { vehicles: listVehicles, isLoading } = useVehicleOwnershipFromConvex();
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const resetOnboarding = useMutation(api.vehicles.resetVehicleOnboarding);
  const removeOwner = useMutation(api.vehicles.removeOwner);
  const autoCompleteNewVehicle = useMutation(api.vehicles.autoCompleteNewVehicleOnboarding);
  const saveVehicleImageUrl = useMutation(api.vehicles.saveVehicleImageUrl);
  const clearVehicleImageUrl = useMutation(api.vehicles.clearVehicleImageUrl);
  const [vehicleImageUrls, setVehicleImageUrls] = useState<Record<string, string>>({});

  // Use cached image_url from Convex, or fetch from API and save it
  useEffect(() => {
    if (!listVehicles?.length) return;
    const TARGET_VIN = "1FMUK8KHXSGD02351"; // temp: force Ford back to exterior[] front-angle shot
    listVehicles.forEach((r: any) => {
      if (!r.vin || vehicleImageUrls[r.vin]) return;

      if (r.vin === TARGET_VIN) {
        // temp: restore original Ford exterior image
        const originalUrl = "https://vhr.nyc3.cdn.digitaloceanspaces.com/vehiclemedia/gallery/2025/ford/explorer/st-line-four-wheel-drive/ext-925d7ee283.jpg";
        setVehicleImageUrls((prev) => ({ ...prev, [r.vin]: originalUrl }));
        saveVehicleImageUrl({ vin: r.vin, image_url: originalUrl });
        return;
      }

      // Reuse cached image_url IF it's from the new transparent-bg
      // endpoint (URLs include "/transparent/" in the path). Older
      // cached URLs point at white-background renders from the legacy
      // `vehicle-media/v2` endpoint — refetch those once so they upgrade
      // to the new transparent images.
      const cachedUrl = r.vehicle?.image_url;
      const isTransparent = typeof cachedUrl === "string" && cachedUrl.includes("/transparent/");

      const doFetch = () => {
        const veh = r.vehicle;
        const meta = veh?.metadata as { make?: string; model?: string; color?: string } | undefined;
        const make = meta?.make ?? "";
        const model = meta?.model ?? "";
        const color = meta?.color ?? r.ownership?.color ?? "";
        const trim = r.trimName ?? undefined;
        if (!make || !model) return;
        fetchVehicleImageUrl(make, model, veh?.year, r.vin, color, trim).then((url) => {
          if (!url) return;
          setVehicleImageUrls((prev) => ({ ...prev, [r.vin]: url }));
          saveVehicleImageUrl({ vin: r.vin, image_url: url });
        });
      };

      if (cachedUrl && isTransparent) {
        // Validate the cached URL belongs to the correct vehicle by checking
        // that make/model appear in the URL path. If mismatched (e.g. a Lexus
        // image cached for a Honda), clear and re-fetch.
        const meta = r.vehicle?.metadata as { make?: string; model?: string } | undefined;
        const make = (meta?.make ?? "").toLowerCase();
        const model = (meta?.model ?? "").toLowerCase();
        const urlLower = cachedUrl.toLowerCase();
        const mismatch = (make && model) && !urlLower.includes(make) && !urlLower.includes(model);
        if (mismatch) {
          clearVehicleImageUrl({ vin: r.vin }).then(doFetch);
          return;
        }
        setVehicleImageUrls((prev) => ({ ...prev, [r.vin]: cachedUrl }));
        return;
      }

      // No cached URL (or stale white-bg one) → fetch the API and persist
      // via saveVehicleImageUrl so subsequent loads short-circuit above.
      doFetch();
    });
  }, [listVehicles]);

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
      const meta = v ? (v as { metadata?: { make?: string; model?: string; color?: string; body_style?: string } }).metadata : undefined;
      const paintColor = meta?.color;
      const gradient =
        (paintColor && COLOR_GRADIENTS[paintColor]) ||
        DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length];
      const displayMake = titleCase(meta?.make || o?.nickname?.split(" ")[1] || "Vehicle");
      const displayModel = titleCase(meta?.model || o?.nickname?.split(" ").slice(2).join(" ") || r.vin.slice(-6));
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
          imageSource: vehicleImageUrls[r.vin]
            ? { uri: vehicleImageUrls[r.vin] }
            : undefined,
          logoSource: undefined,
          condition: undefined,
          nextUnlock: undefined,
          gradientColors: gradient,
          bodyStyle: meta?.body_style,
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
  }, [listVehicles, vehicleImageUrls]);

  // Derive the active index from the VIN anchor. If the anchored VIN isn't in
  // the list (first load, or active vehicle was removed), fall back to 0.
  const activeVehicleIndex = useMemo(() => {
    if (vehicles.length === 0) return 0;
    const idx = vehicles.findIndex((v) => v.vin === activeVehicleVin);
    return idx >= 0 ? idx : 0;
  }, [vehicles, activeVehicleVin]);

  // Seed / heal the VIN anchor when vehicles load or the active vehicle disappears.
  useEffect(() => {
    if (vehicles.length === 0) return;
    if (!activeVehicleVin || !vehicles.some((v) => v.vin === activeVehicleVin)) {
      setActiveVehicleVin(vehicles[0].vin);
    }
  }, [vehicles, activeVehicleVin]);

  // Callback for CarCarousel — it speaks in indices, we translate back to VIN.
  const handleActiveIndexChange = useCallback(
    (idx: number) => {
      const vin = vehicles[idx]?.vin;
      if (vin) setActiveVehicleVin(vin);
    },
    [vehicles],
  );

  // Memoize current vehicle and its data
  const activeVehicle = useMemo(() => vehicles[activeVehicleIndex], [vehicles, activeVehicleIndex]);
  const activeVehicleLabel = useMemo(() => {
    if (!activeVehicle) return undefined;
    return `${activeVehicle.year} ${titleCase(activeVehicle.make)} ${activeVehicle.model}`;
  }, [activeVehicle]);
  const activeOwnershipId = useMemo(() => ownershipIds[activeVehicleIndex], [ownershipIds, activeVehicleIndex]);
  const activeOwnership = useMemo(() => ownerships[activeVehicleIndex], [ownerships, activeVehicleIndex]);
  const isPreOnboardingComplete = activeOwnership?.preOnboardingComplete === true;

  // Onboarding state.
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

  const currentOdometer = isOnboardingComplete ? (activeOwnership?.mileage ?? null) : null;
  const activeOwnershipKnownIssues = activeOwnership?.knownIssues as string[] | undefined;
  // Mechanic-submitted job recommendations for the active vehicle. Already
  // cross-shop deduped server-side; merged with mechanic-wins precedence
  // inside useMergedMaintenance.
  const { recommendations: driverRecommendations } = useDriverRecommendationsFromConvex(
    activeVehicle?.vin,
  );

  const { mergedItems: mergedMaintenanceItems, recordsByType } = useMergedMaintenance(
    activeOwnershipId,
    currentOdometer,
    activeVehicle?.make,
    activeOwnershipDrivingConditions,
    activeOwnershipAvgMonthlyDriving,
    activeOwnershipKnownIssues,
    activeVehicle?.year,
    driverRecommendations,
  );

  // HP buffer for the active vehicle — every 15 HP yields +1 on the
  // displayed score, capped at +3 (Rewards Framework v3 §11).
  const hpForUser = useQuery(
    api.healthPoints.getPointsForUser,
    userId ? { userId } : "skip",
  );
  const activeVehicleHpBuffer = useMemo(() => {
    if (!hpForUser || !activeVehicle?.vin) return 0;
    const match = (hpForUser as Array<{ vin: string; buffer: number }>).find(
      (r) => r.vin === activeVehicle.vin,
    );
    return match?.buffer ?? 0;
  }, [hpForUser, activeVehicle?.vin]);

  // Completed bookings for the active vehicle — feeds the Vehicle
  // Health sheet's "What's helping" list so the per-booking entries
  // replace the abstract per-item "On-time: X" entries.
  const allUserBookings = useQuery(
    api.bookings.getByUserIdWithDetails,
    userId ? { userId } : "skip",
  );
  const completedBookingsForVehicle = useMemo(() => {
    if (!allUserBookings || !activeVehicle?.vin) return [];
    const activeVin = activeVehicle.vin.toUpperCase().trim();
    return (allUserBookings as any[])
      .filter(
        (r) =>
          r.status === "completed" &&
          String(r.vin ?? "").toUpperCase().trim() === activeVin,
      )
      .map((r) => ({
        id: String(r._id),
        services: (r.serviceNames as string[] | undefined) ?? [],
        completedAt:
          (r.completed_at_ms as number | undefined) ??
          (r.completed_at as number | undefined) ??
          (r._creationTime as number | undefined) ??
          null,
        shopName: (r.shopName as string | undefined) ?? "",
      }));
  }, [allUserBookings, activeVehicle?.vin]);

  // Unified vehicle health score — graduated maintenance statuses
  // and warning-light penalty.
  const healthScoreInput: HealthScoreInput = useMemo(() => ({
    maintenanceItems: mergedMaintenanceItems,
    odometerMiles: currentOdometer ?? activeVehicle?.mileage ?? 0,
    knownIssues: activeOwnershipKnownIssues,
    pipelineHealthScore: activeOwnership?.health_score as number | undefined,
    pipelineIsEstimated: activeOwnership?.health_score_is_estimated as boolean | undefined,
    hpBuffer: activeVehicleHpBuffer,
    recPenalty: activeOwnership?.health_score_rec_penalty as number | undefined,
    mileageRecs: driverRecommendations
      .filter((r: any) => typeof r.target_mileage === "number" && r.target_mileage > 0)
      .map((r: any) => ({ target_mileage: r.target_mileage as number })),
  }), [mergedMaintenanceItems, currentOdometer, activeVehicle?.mileage, activeOwnershipKnownIssues, activeOwnership?.health_score, activeOwnership?.health_score_is_estimated, activeOwnership?.health_score_rec_penalty, activeVehicleHpBuffer, driverRecommendations]);

  const computedHealthScore = useMemo(() => {
    return computeVehicleHealthScore(healthScoreInput);
  }, [healthScoreInput]);

  // Pulse animation for inline Quick Read health ring
  const showQuickReadCard = isPreOnboardingComplete && !isOnboardingComplete && !isNewVehicle;
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

    setHealthPageReady(false);
    Animated.parallel([
      Animated.timing(mainPageSlideX, { toValue: -300, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(mainPageFade, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(healthPageSlideX, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(healthPageFade, { toValue: 1, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      mainPageSlideX.setValue(0);
      mainPageFade.setValue(1);
      setHealthPageReady(true);
    });
  }, [mainPageSlideX, mainPageFade, healthPageSlideX, healthPageFade, pageSlideX, pageFade]);

  // Auto-open stepper when navigated from Home's "Finish Setup" button
  const openStepperFired = useRef(false);
  useEffect(() => {
    if (
      params.openStepper === 'true' &&
      !openStepperFired.current &&
      activeOwnershipId &&
      isFocused
    ) {
      openStepperFired.current = true;
      openStepperDirectly();
    }
  }, [params.openStepper, activeOwnershipId, isFocused, openStepperDirectly]);

  // Maintenance input modal state
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [maintenanceModalType, setMaintenanceModalType] = useState<MaintenanceType>("oil");

  // VIN info modal — opened from the (i) button in the top-right of the
  // cars page header. Shows the active vehicle's VIN.
  const [vinModalVisible, setVinModalVisible] = useState(false);
  const [vinCopied, setVinCopied] = useState(false);
  const handleCopyVin = useCallback(async () => {
    if (!activeVehicle?.vin) return;
    await Clipboard.setStringAsync(activeVehicle.vin);
    setVinCopied(true);
    setTimeout(() => setVinCopied(false), 1500);
  }, [activeVehicle?.vin]);

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

  const serviceRecords: ServiceRecord[] = [];


  // True when the active vehicle is showing the covered-car fallback
  // (no `imageSource` has been resolved yet). In that case the page
  // gets the blue palette and skips the elliptical ground shadow
  // entirely — the cloth illustration doesn't read as a real car
  // casting a contact shadow.
  const isCoveredCar = !activeVehicle?.imageSource;

  // Active vehicle's gradient colors for the background. Covered cars
  // get the canonical blue palette regardless of their stored color.
  const activeGradient = useMemo(
    () =>
      isCoveredCar
        ? COLOR_GRADIENTS.blue
        : (activeVehicle?.gradientColors ?? DEFAULT_GRADIENTS[0]),
    [isCoveredCar, activeVehicle?.gradientColors]
  );
  // Static text on this page (vehicle name, mileage, "Maintenance
  // Tracker" header) sits over the top stop of the gradient. When
  // that stop is dark — black, midnight-silver, gray, etc. — dark
  // text becomes unreadable, so swap to light. Computed once per
  // active vehicle and passed down to the consuming components.
  // Page-level text (vehicle name, mileage, section headers) always
  // renders dark now that every palette in `COLOR_GRADIENTS` is
  // light-mode. Forcing `false` keeps downstream components from
  // flipping their text to white on the (still-light) "darker" gray
  // / midnight-silver palettes. The prop is kept on the API so
  // consumers' types don't change.
  const isDarkBg = false;

  // ── Gradient crossfade ────────────────────────────────────────
  // Smooth color transition between cars without the white screen
  // bleed-through that a two-layer mutual crossfade produces.
  //
  // Setup:
  //   • Bottom layer: ALWAYS opacity 1. Shows the last-settled
  //     gradient (`settledGradient`). Acts as the opaque base so
  //     the page's underlying white background never shows through
  //     at any point during the transition.
  //   • Top layer: opacity 0 → 1. Shows the incoming gradient
  //     (`incomingGradient`). When the fade completes, we copy the
  //     incoming colors into `settledGradient` and reset the top
  //     layer's opacity back to 0 — ready for the next swap.
  //
  // Because the bottom is always fully opaque, the composite is
  // never partially transparent. The user sees a clean blend between
  // two fully opaque gradients instead of both fading through their
  // midpoint (which previously revealed the white screen behind).
  const [settledGradient, setSettledGradient] = useState<readonly string[]>(activeGradient);
  const [incomingGradient, setIncomingGradient] = useState<readonly string[]>(activeGradient);
  const overlayOpacity = useSharedValue(0);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  useEffect(() => {
    if (settledGradient === activeGradient) return;
    // Load the incoming colors into the top layer first. Since its
    // opacity is currently 0 (either initial or just reset after a
    // previous fade), this state update is invisible to the user.
    setIncomingGradient(activeGradient);
    overlayOpacity.value = withTiming(
      1,
      { duration: 1100, easing: ReEasing.inOut(ReEasing.cubic) },
      (finished) => {
        "worklet";
        if (finished) {
          // Lock in the new gradient as the "settled" base. We do
          // NOT reset overlayOpacity here — that would briefly leave
          // the bottom showing the OLD settled gradient (React state
          // updates are async, but `overlayOpacity = 0` applies on
          // the next UI-thread frame). The reset happens in the
          // useEffect below once settled has committed.
          runOnJS(setSettledGradient)(activeGradient);
        }
      },
    );
  }, [activeGradient, settledGradient, overlayOpacity]);

  // Reset the overlay only after `settledGradient` has committed and
  // the bottom layer is now painting the new colors. Now we can hide
  // the overlay safely — bottom + overlay both show the same colors
  // for a moment, then the overlay drops to 0 ready for the next swap.
  useEffect(() => {
    overlayOpacity.value = 0;
  }, [settledGradient, overlayOpacity]);

  // Shadow tint base, derived from the active gradient's top stop.
  // Each background color (blue, red, green, …) gets a desaturated
  // dark version of its own hue so both the ground line and the
  // ellipse beneath the car read as a natural shadow on whatever
  // screen the user is looking at, instead of a hardcoded dark-pink
  // that only looks right on warm palettes.
  const groundShadowTintRgb = useMemo(
    () => darkRgbFromHex(activeGradient[0]),
    [activeGradient]
  );
  const groundLineTint = useMemo(
    () => `rgba(${groundShadowTintRgb}, 0.18)`,
    [groundShadowTintRgb]
  );
  const groundLineTintTransparent = useMemo(
    () => `rgba(${groundShadowTintRgb}, 0)`,
    [groundShadowTintRgb]
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
    setRefreshing(false);
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
        {/* Scrolling Gradient — uses the active vehicle's color tinted
            into the same brightness curve as the home screen's static
            gradient: saturated tint at the top → soft mid → near-white
            at the bottom. The container is `SCREEN_HEIGHT * 2.5` tall
            so it can cover the scroll area, which means only ~40% of
            the gradient is visible at rest (positions 0.20–0.60).
            Locations compress the three stops into that window so the
            visible page reads as a clean top→bottom fade, identical
            to home's `[0, 0.5, 1]` on its absoluteFill gradient. */}
        <View style={styles.scrollingGradientContainer} pointerEvents="none">
          {/* Bottom — always opaque. Shows the last-settled gradient
              so the white page background never bleeds through during
              transitions. Gets updated to match the incoming gradient
              only after the overlay fade completes. */}
          <LinearGradient
            colors={settledGradient as [string, string, ...string[]]}
            locations={[0.20, 0.40, 0.60]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Top overlay — fades 0 → 1 to bring the incoming gradient
              on top of the still-opaque bottom. Resets to 0 after the
              fade settles and the bottom adopts the new colors. */}
          <ReAnimated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
            <LinearGradient
              colors={incomingGradient as [string, string, ...string[]]}
              locations={[0.20, 0.40, 0.60]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </ReAnimated.View>
        </View>

        {/* Profile button (far left) + dev pills + VIN info button (right) */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: scale(16), marginBottom: scale(4), zIndex: 10, position: "relative" }}>
          <ProfileInitialsButton />
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: scale(6), marginLeft: scale(12) }}>
            {/* Redo Info — commented out (dev-only). Uncomment to restore.
            {isPreOnboardingComplete && showPostOnboardingContent && activeOwnershipId && (
              <Pressable
                style={({ pressed }) => [{ paddingVertical: scale(4), paddingHorizontal: scale(10), borderRadius: moderateScale(12), backgroundColor: "rgba(82,153,254,0.1)" }, pressed && { opacity: 0.7 }]}
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
            */}
            {/* Remove — commented out (dev-only). Uncomment to restore.
            {!!activeVehicle?.vin && !!userId && (
              <Pressable
                style={({ pressed }) => [{ paddingVertical: scale(4), paddingHorizontal: scale(10), borderRadius: moderateScale(12), backgroundColor: "rgba(239,68,68,0.12)" }, pressed && { opacity: 0.7 }]}
                onPress={handleRemoveActiveVehicle}
              >
                <Text weight="semiBold" size="xs" color="#DC2626">Remove</Text>
              </Pressable>
            )}
            */}
            {/* Demo Check-In — commented out (dev-only). Uncomment to restore.
            {activeOwnershipId && isPreOnboardingComplete && (
              <Pressable
                style={({ pressed }) => [{ paddingVertical: scale(4), paddingHorizontal: scale(10), borderRadius: moderateScale(12), backgroundColor: "rgba(0,0,0,0.05)" }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: "/quarterly-checkin", params: { vehicleOwnerId: activeOwnershipId, vehicleName: activeVehicle?.make ? `${activeVehicle.make} ${activeVehicle.model ?? ""}`.trim() : undefined } })}
              >
                <Text weight="semiBold" size="xs" color="#6B7280">Demo Check-In</Text>
              </Pressable>
            )}
            */}
          </View>
          {!!activeVehicle?.vin && (
            <Pressable
              accessibilityLabel="Show VIN"
              hitSlop={10}
              onPress={() => setVinModalVisible(true)}
              style={({ pressed }) => [
                {
                  width: scale(28),
                  height: scale(28),
                  borderRadius: scale(14),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(15,23,42,0.06)",
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Info size={scale(16)} color="#475569" strokeWidth={2.2} />
            </Pressable>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            TOP SECTION: Vehicle Carousel
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.topSection}>
          <CarCarousel
            vehicles={vehicles}
            onActiveIndexChange={handleActiveIndexChange}
            onEditMileage={(id) => {
              // TODO: Implement mileage edit flow - open modal or inline edit
            }}
            onToggleDefault={handleToggleDefault}
            isFocused={isFocused}
            maintenanceItems={mergedMaintenanceItems}
            currentMileage={currentOdometer}
            isDarkBg={isDarkBg}
            groundLineTint={groundLineTint}
            groundLineTintTransparent={groundLineTintTransparent}
            groundShadowTintRgb={groundShadowTintRgb}
            hideGroundShadow={isCoveredCar}
            showHealthRing={celebrationDismissed || (isOnboardingComplete && !celebrationActive && !healthPageVisible)}
            healthScore={isPreOnboardingComplete && !isOnboardingComplete
              ? (activeOwnership?.health_score as number | undefined) ?? computedHealthScore
              : computedHealthScore}
            isEstimatedScore={isPreOnboardingComplete && !isOnboardingComplete}
            onResumeCheckin={openEstimatedHealthSheet}
            knownIssues={activeOwnershipKnownIssues}
            hpBuffer={activeVehicleHpBuffer}
            completedBookings={completedBookingsForVehicle}
          />
        </View>

        {/* Quick Read intro card — shown when pre-onboarding done but onboarding not yet complete */}
        {isPreOnboardingComplete && !isOnboardingComplete && !isNewVehicle && (() => {
          const estScore = (activeOwnership?.health_score as number | undefined) ?? computedHealthScore;
          const ringSize = 120;
          const strokeWidth = 10;
          const radius = (ringSize - strokeWidth) / 2;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference * (1 - estScore / 100);
          const center = ringSize / 2;
          return (
          <View style={styles.quickReadCard}>
            <View style={{ alignItems: "center", justifyContent: "center", width: scale(140), height: scale(140), marginBottom: scale(12) }}>
              <Animated.View style={{ position: "absolute", width: scale(160), height: scale(160), borderRadius: scale(80), backgroundColor: "#94A3B8", opacity: 0.12, transform: [{ scale: quickReadPulse }] }} />
              <Animated.View style={{ position: "absolute", width: scale(130), height: scale(130), borderRadius: scale(65), backgroundColor: "#94A3B8", opacity: 0.06, transform: [{ scale: quickReadPulse }] }} />
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
            <Text weight="bold" size="lg" color="#0F172A" style={{ textAlign: "center" }}>
              Here&apos;s an estimate of where your {activeVehicle?.make && activeVehicle?.model ? `${activeVehicle.make} ${activeVehicle.model}` : "vehicle"} stands
            </Text>
            <Text weight="medium" size="sm" color="#829BAD" style={{ textAlign: "center", marginTop: scale(6) }}>
              Five quick checks to understand your vehicle&apos;s current condition.
            </Text>
            <View style={styles.quickReadBenefits}>
              {["Brake health assessment", "Tire life estimation", "Oil service status", "Battery condition check", "Warning light detection"].map((b) => (
                <View key={b} style={styles.quickReadBenefitRow}>
                  <Ionicons name="checkmark-circle" size={scale(16)} color="#5299FE" />
                  <Text weight="medium" size="sm" color="#0F172A">{b}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.quickReadCta, pressed && { opacity: 0.85 }]}
              onPress={openStepperDirectly}
            >
              <LinearGradient
                colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickReadCtaGradient}
              >
                <Text
                  weight="bold"
                  size="md"
                  color="#FFFFFF"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={{ flexShrink: 1, marginRight: scale(8) }}
                >
                  Get a quick read on your {activeVehicle?.make && activeVehicle?.model ? `${activeVehicle.make} ${activeVehicle.model}` : "vehicle"}
                </Text>
                <Ionicons name="arrow-forward" size={scale(18)} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <Text weight="medium" size="xs" color="#829BAD" style={{ marginTop: scale(10), opacity: 0.7 }}>Takes about 30 seconds</Text>
          </View>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM SECTION: Maintenance, Service History, Loyalty
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.bottomSection}>
          {/* Pre-onboarding incomplete → show continue prompt */}
          {!isPreOnboardingComplete && activeOwnershipId && (
            <View style={styles.preOnboardingCard}>
              <Text weight="semiBold" size="md" color="#111827" style={{ textAlign: "center" }}>
                Continue setup to unlock your maintenance dashboard
              </Text>
              <Text size="sm" color="#6B7280" style={{ textAlign: "center", marginTop: scale(6), marginBottom: scale(12) }}>
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

          {/* Maintenance tracker (shown after onboarding + sheet dismissed) */}
          {showPostOnboardingContent && (
            <MaintenanceTracker
              items={mergedMaintenanceItems}
              vehicleCondition={computedHealthScore}
              healthScoreInput={healthScoreInput}
              isDarkBg={isDarkBg}
              onBookNow={(id) => {
                const vin = activeVehicle?.vin;
                if (vin) useVehicleStore.getState().selectVehicle(vin.toUpperCase().trim());
                // If this item was sourced from a mechanic recommendation,
                // stash the rec id so createBatch wires it into the booking
                // (auto-closes the rec on completion).
                const tapped = mergedMaintenanceItems.find((m) => m.id === id);
                useBookingStore.getState().setSourceRecommendationId(
                  tapped?.sourceRecommendationId ?? null,
                );
                router.push('/booking/map');
              }}
              onTakeAction={(item) => {
                const vin = activeVehicle?.vin;
                if (vin) useVehicleStore.getState().selectVehicle(vin.toUpperCase().trim());
                if (!item.sourceRecommendationId) return;
                router.push(`/recommendation/${item.sourceRecommendationId}`);
              }}
              onAddInfo={(id) => {
                const type = id.replace(/^(unknown-|user-)/, "") as MaintenanceType;
                setMaintenanceModalType(type);
                setMaintenanceModalVisible(true);
              }}
              onEditPressed={() => openEditPicker()}
            />
          )}

          {showPostOnboardingContent && activeVehicle?.vin ? (
            <UpcomingFollowUpsCard
              vin={activeVehicle.vin}
              currentMileage={currentOdometer ?? activeVehicle?.mileage ?? null}
              onConfirmBooking={({ recommendationId, serviceId, selectedServiceOption, tireSpecs }) => {
                const vin = activeVehicle?.vin;
                if (vin) useVehicleStore.getState().selectVehicle(vin.toUpperCase().trim());
                const bookingStore = useBookingStore.getState();
                bookingStore.setSourceRecommendationId(recommendationId);
                if (selectedServiceOption && serviceId) {
                  bookingStore.setSelectedServiceOption(serviceId, {
                    optionId: selectedServiceOption.option_id as any,
                    optionLabel: selectedServiceOption.option_label,
                  } as any);
                }
                if (tireSpecs) {
                  const tireStore = useTireBookingStore.getState();
                  tireStore.setSize(tireSpecs.size);
                  tireStore.setType(tireSpecs.type as any);
                  tireStore.setTier(tireSpecs.tier as any);
                }
                router.push('/booking/map');
              }}
            />
          ) : null}

          {/* Service History Section (hidden until onboarding complete) */}
          {isOnboardingComplete && <ServiceHistory
            isDarkBg={isDarkBg}
            records={serviceRecords}
            onAddNotes={(id) => {
              // TODO: Open notes modal/screen for this service record
              console.log("Add Notes for record", id);
            }}
            onDownloadReceipt={(id) => {
              // TODO: Download PDF receipt for this service record
              console.log("Download Receipt for record", id);
            }}
            onAddServiceHistory={async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: [
                    'application/pdf',
                    'image/*',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  ],
                  multiple: true,
                  copyToCacheDirectory: true,
                });
                if (!result.canceled && result.assets.length > 0) {
                  const newDocs: PickedDocument[] = result.assets.map(asset => ({
                    uri: asset.uri,
                    name: asset.name,
                    mimeType: asset.mimeType ?? 'application/octet-stream',
                    size: asset.size ?? undefined,
                  }));
                  setPickedDocuments(prev => [...prev, ...newDocs]);
                }
              } catch (err) {
                console.error("Document picker error:", err);
              }
            }}
            documents={pickedDocuments}
            onRemoveDocument={(index) => {
              setPickedDocuments(prev => prev.filter((_, i) => i !== index));
            }}
            onOpenDocument={(doc) => setViewingDocument(doc)}
          />}

          {/* Loyalty Points Section (hidden until onboarding complete) */}
          {isOnboardingComplete && <LoyaltyPoints
            isDarkBg={isDarkBg}
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
          VIN INFO MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={vinModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVinModalVisible(false)}
      >
        <Pressable
          style={vinModalStyles.backdrop}
          onPress={() => setVinModalVisible(false)}
        >
          <View
            style={vinModalStyles.card}
            onStartShouldSetResponder={() => true}
          >
            <Pressable
              accessibilityLabel="Close"
              hitSlop={16}
              onPress={() => setVinModalVisible(false)}
              style={({ pressed }) => [vinModalStyles.closeBtn, pressed && { opacity: 0.6 }]}
            >
              <X size={22} color="#475569" strokeWidth={2.4} />
            </Pressable>
            <Text weight="bold" size="lg" color="#0F172A" style={vinModalStyles.title}>
              Vehicle VIN
            </Text>
            {activeVehicle ? (
              <Text weight="semiBold" size="sm" color="#64748B" style={vinModalStyles.subtitle}>
                {`${activeVehicle.year ?? ""} ${activeVehicle.make ?? ""} ${activeVehicle.model ?? ""}`.trim()}
              </Text>
            ) : null}
            <View style={vinModalStyles.vinBox}>
              <Text style={vinModalStyles.vinText} numberOfLines={1}>
                {activeVehicle?.vin || "—"}
              </Text>
              <Pressable
                accessibilityLabel={vinCopied ? "VIN copied" : "Copy VIN"}
                hitSlop={8}
                onPress={handleCopyVin}
                disabled={!activeVehicle?.vin}
                style={({ pressed }) => [vinModalStyles.copyIconBtn, pressed && { opacity: 0.6 }]}
              >
                {vinCopied ? (
                  <CheckIcon size={scale(16)} color="#10B981" strokeWidth={2.4} />
                ) : (
                  <Copy size={scale(16)} color="#5299FE" strokeWidth={2.2} />
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

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
                }} hitSlop={12} style={({ pressed }) => [healthSheetStyles.fullPageBackBtn, pressed && { opacity: 0.6 }]}>
                  <ArrowLeft size={scale(24)} color="#141C24" strokeWidth={2} />
                </Pressable>
                <View style={{ width: scale(40) }} />
              </View>
            ) : (
              <View style={{ paddingTop: Platform.OS === "ios" ? scale(70) : scale(50) }} />
            )
          ) : (
            <View style={{ paddingTop: Platform.OS === "ios" ? 70 : 50 }} />
          )}

          {/* --- Page content --- */}
          <Animated.View style={{ flex: 1, opacity: pageFade, transform: [{ translateX: pageSlideX }] }}>
          {healthSheetMode === 'estimated' && estimatedPage === 'checkin' ? (
            <View style={{ flex: 1, width: '100%' }}>
              {activeOwnershipId && healthPageReady && (
                <CarInfoStepper
                  ref={stepperRef}
                  vehicleOwnerId={activeOwnershipId}
                  vehicleMake={activeVehicle?.make ?? ''}
                  vehicleModel={activeVehicle?.model ?? ''}
                  vehicleYear={activeVehicle?.year ?? 0}
                  skipIntro
                  onBack={closeHealthSheet}
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
                          <Text weight="bold" size="3xl" color="#1F2937">{activeOwnership?.health_score_is_estimated ? "~" : ""}{displayedScore}</Text>
                          <Text weight="semiBold" size="xs" color="#9CA3AF" style={{ marginTop: scale(-2) }}>{activeOwnership?.health_score_is_estimated ? "estimated" : "out of 100"}</Text>
                        </View>
                      </View>
                    );
                  })()}
                </Animated.View>
              </View>
                );
              })()}

              {/* Title */}
              <Animated.View style={{ opacity: titleFade, marginTop: healthSheetMode === 'confirmed' ? scale(50) : 0, transform: [{ translateY: titleFade.interpolate({ inputRange: [0, 1], outputRange: [scale(12), 0] }) }] }}>
                <Text weight="bold" size="xl" color="#1F2937" style={healthSheetStyles.title}>
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
              <Animated.View style={{ opacity: subtitleFade, transform: [{ translateY: subtitleFade.interpolate({ inputRange: [0, 1], outputRange: [scale(12), 0] }) }] }}>
                <Text weight="medium" size="sm" color="#6B7280" style={healthSheetStyles.subtitle}>
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
                <Animated.View style={[{ width: "100%", marginTop: scale(8) }, { opacity: benefitsFade, transform: [{ translateY: benefitsFade.interpolate({ inputRange: [0, 1], outputRange: [scale(16), 0] }) }] }]}>
                  <View style={healthSheetStyles.introCard}>
                    <View style={healthSheetStyles.introIconContainer}>
                      <Ionicons name="pulse-outline" size={scale(28)} color="#5299FE" />
                    </View>
                    <Text weight="bold" size="md" color="#1F2937" style={{ marginTop: scale(12), textAlign: "center" }}>
                      Let&apos;s get a quick read on your {activeVehicle?.make ?? "vehicle"}
                    </Text>
                    <Text weight="medium" size="sm" color="#6B7280" style={{ marginTop: scale(4), textAlign: "center" }}>
                      Five quick checks to understand your vehicle&apos;s current condition.
                    </Text>
                    <View style={healthSheetStyles.introBenefits}>
                      {["Brake health assessment", "Tire life estimation", "Oil service status", "Battery condition check", "Warning light detection"].map((b) => (
                        <View key={b} style={healthSheetStyles.introBenefitRow}>
                          <Ionicons name="checkmark-circle" size={scale(16)} color="#5299FE" />
                          <Text weight="medium" size="sm" color="#374151" style={{ marginLeft: scale(8) }}>{b}</Text>
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
                        <Text weight="bold" size="md" color="#FFFFFF" style={{ fontSize: moderateScale(17) }}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={scale(18)} color="#FFFFFF" style={{ marginLeft: scale(8) }} />
                      </LinearGradient>
                    </Pressable>
                    <Text weight="medium" size="xs" color="#9CA3AF" style={{ marginTop: scale(10) }}>Takes about 30 seconds</Text>
                    <Pressable
                      onPress={closeHealthSheet}
                      style={({ pressed }) => [{ marginTop: scale(14), paddingVertical: scale(10), paddingHorizontal: scale(24) }, pressed && { opacity: 0.6 }]}
                    >
                      <Text weight="semiBold" size="sm" color="#6B7280">I'll finish later</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ) : (
                <>
                  {/* What optimization will do for the user — replaces the
                      old in-sheet booking cards so the only forward action
                      is "Optimize my vehicle profile". */}
                  <Animated.View style={[{ alignSelf: "stretch", marginTop: scale(12), flex: 1 }, { opacity: benefitsFade, transform: [{ translateY: benefitsFade.interpolate({ inputRange: [0, 1], outputRange: [scale(16), 0] }) }] }]}>
                    <View style={{ gap: scale(14), paddingHorizontal: scale(4) }}>
                      {[
                        "We'll scan your VIN against open recalls",
                        "We'll match your maintenance history to manufacturer intervals",
                        "We'll pre-load nearby shops with the services you need",
                      ].map((label, idx) => (
                        <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: scale(12) }}>
                          <View style={{
                            width: scale(28), height: scale(28), borderRadius: scale(14),
                            backgroundColor: "rgba(82,153,254,0.12)",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <Ionicons name="checkmark" size={scale(16)} color="#5299FE" />
                          </View>
                          <Text
                            weight="medium"
                            style={{ fontSize: moderateScale(14), color: "#1F2937", flex: 1 }}
                          >
                            {label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>

                  <Animated.View style={[{ width: "100%", marginTop: "auto", paddingBottom: insets.bottom + scale(24) }, { opacity: buttonFade, transform: [{ translateY: buttonFade.interpolate({ inputRange: [0, 1], outputRange: [scale(16), 0] }) }] }]}>
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
                        <Text weight="bold" size="md" color="#FFFFFF" style={{ fontSize: moderateScale(17) }}>Optimize my vehicle profile</Text>
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
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} pointerEvents="none" />
          {/* Building phase: car image + sequential AI task list */}
          {gearsPhase !== 'looping' && (
            <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: lottieFadeOut }}>
              {/* Car image at top — VDB image if available, otherwise
                  the covered-car placeholder (manual-entry vehicles). */}
              <Animated.View style={{ opacity: carPulseAnim, width: scale(280), height: scale(170), alignSelf: 'center', marginTop: verticalScale(100) }}>
                <Image
                  source={activeVehicle?.imageSource ?? require('@/assets/images/covered-car.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </Animated.View>
              {/* Sequential step list */}
              <View style={{ paddingHorizontal: scale(28), marginTop: scale(24) }}>
                {AI_STEPS.map((step, idx) => {
                  const isCompleted = idx < completedSteps;
                  const isActive = idx === activeStep && idx >= completedSteps;
                  return (
                    <Animated.View key={idx} style={{ opacity: stepOpacities[idx] }}>
                      {/* Connecting line from previous step */}
                      {idx > 0 && (
                        <View style={{ marginLeft: scale(15), width: 2, overflow: 'hidden' }}>
                          <Animated.View style={{ width: 2, height: lineHeights[idx - 1].interpolate({ inputRange: [0, 1], outputRange: [0, scale(16)] }), backgroundColor: isCompleted ? '#5299FE' : '#E2E8F0' }} />
                        </View>
                      )}
                      {/* Step row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(6) }}>
                        {/* Icon circle */}
                        <Animated.View style={{
                          width: scale(32), height: scale(32), borderRadius: scale(16),
                          backgroundColor: isCompleted ? '#5299FE' : isActive ? 'rgba(82,153,254,0.12)' : '#F1F5F9',
                          alignItems: 'center', justifyContent: 'center',
                          transform: [{ scale: stepIconScales[idx] }],
                        }}>
                          {isCompleted ? (
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          ) : (
                            <Ionicons name={step.icon} size={16} color={isActive ? '#5299FE' : '#94A3B8'} />
                          )}
                        </Animated.View>
                        {/* Label */}
                        <Text
                          weight={isActive ? 'semiBold' : 'medium'}
                          style={{
                            fontSize: moderateScale(13.5),
                            color: isCompleted ? '#64748B' : isActive ? '#0F172A' : '#94A3B8',
                            marginLeft: scale(12),
                            flex: 1,
                          }}
                        >
                          {step.label}
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          )}
          {/* Ready phase: title + car image + completed steps */}
          {gearsPhase === 'ready' && (
            <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: carImageFadeIn }}>
              {/* Title — near top */}
              <View style={{ alignItems: 'center', marginTop: verticalScale(72) }}>
                <Text weight="bold" size="3xl" color="#0F172A" style={{ textAlign: 'center' }}>
                  Vehicle profile optimized
                </Text>
              </View>
              {/* Car image — VDB if available, covered-car otherwise. */}
              <Animated.View style={{ alignSelf: 'center', marginTop: scale(16), transform: [{ scale: carImageFadeIn.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
                <View style={{ width: scale(280), height: scale(170), alignItems: 'center', justifyContent: 'center' }}>
                  <Image
                    source={activeVehicle?.imageSource ?? require('@/assets/images/covered-car.png')}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>
              {/* Completed steps list */}
              <View style={{ paddingHorizontal: scale(28), marginTop: scale(20) }}>
                {AI_STEPS.map((step, idx) => (
                  <View key={idx}>
                    {idx > 0 && (
                      <View style={{ marginLeft: scale(15), width: 2, height: scale(16), backgroundColor: '#5299FE' }} />
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(6) }}>
                      <View style={{
                        width: scale(32), height: scale(32), borderRadius: scale(16),
                        backgroundColor: '#5299FE',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                      <Text
                        weight="medium"
                        style={{ fontSize: moderateScale(13.5), color: '#64748B', marginLeft: scale(12), flex: 1 }}
                      >
                        {step.label.replace('…', '')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
          {gearsPhase === 'ready' && (
            <Animated.View style={{ opacity: gearsBtnOpacity, zIndex: 1, position: 'absolute', bottom: insets.bottom, left: scale(24), right: scale(24) }}>
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
                  <Text weight="bold" size="md" color="#FFFFFF" style={{ fontSize: moderateScale(17) }}>View My Dashboard</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      )}
      </Modal>

      {/* Post-optimize booking sheet — pops on the car's dashboard right
          after `dismissGearsOverlay` runs. */}
      <PostOptimizeBookingSheet
        visible={showOptimizeBookingSheet}
        onClose={() => setShowOptimizeBookingSheet(false)}
        maintenanceItems={mergedMaintenanceItems}
        vehicleLabel={activeVehicleLabel}
      />

      {/* Document Viewer Modal */}
      <Modal
        visible={!!viewingDocument}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewingDocument(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: verticalScale(56), paddingHorizontal: scale(16), paddingBottom: scale(12), borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <Text weight="semiBold" style={{ fontSize: moderateScale(16), color: '#16293B', flex: 1 }} numberOfLines={1}>
              {viewingDocument?.name ?? 'Document'}
            </Text>
            <Pressable onPress={() => setViewingDocument(null)} hitSlop={12}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </Pressable>
          </View>
          {viewingDocument?.mimeType.startsWith('image/') ? (
            <Image
              source={{ uri: viewingDocument.uri }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          ) : (
            <WebView
              source={{ uri: viewingDocument?.uri ?? '' }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
              startInLoadingState
            />
          )}
        </View>
      </Modal>

    </View>
  );
}

// ============================================================================
// EDIT PICKER BOTTOM SHEET STYLES
// ============================================================================

const vinModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(24),
  },
  card: {
    width: "100%",
    maxWidth: scale(360),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    paddingTop: scale(20),
    paddingBottom: scale(20),
    paddingHorizontal: scale(20),
  },
  closeBtn: {
    position: "absolute",
    top: scale(8),
    right: scale(8),
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  title: {
    marginBottom: scale(4),
    paddingRight: scale(44),
  },
  subtitle: {
    marginBottom: scale(14),
  },
  vinBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.04)",
    borderRadius: moderateScale(12),
    paddingVertical: scale(12),
    paddingLeft: scale(14),
    paddingRight: scale(8),
    gap: scale(8),
  },
  vinText: {
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: moderateScale(15),
    color: "#0F172A",
    letterSpacing: 1.2,
  },
  copyIconBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    alignItems: "center",
    justifyContent: "center",
  },
});

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
    borderRadius: moderateScale(40),
    paddingHorizontal: scale(24),
    paddingBottom: Platform.OS === "ios" ? scale(34) : scale(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: scale(40),
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    alignSelf: "center",
    marginTop: scale(12),
    marginBottom: scale(16),
  },
  title: {
    marginBottom: scale(16),
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: scale(14),
    paddingHorizontal: scale(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  rowIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(82, 153, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(14),
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
    paddingTop: Platform.OS === "ios" ? scale(56) : scale(16),
    paddingHorizontal: scale(20),
    paddingBottom: scale(4),
  },
  fullPageCloseBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullPageBackBtn: {
    width: scale(40),
    height: scale(40),
    justifyContent: "center",
    alignItems: "flex-start",
  },
  introCard: {
    alignItems: "center",
    backgroundColor: "#F0F4FF",
    borderRadius: moderateScale(20),
    paddingVertical: scale(16),
    paddingHorizontal: scale(20),
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.15)",
  },
  introIconContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: "rgba(82, 153, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  introBenefits: {
    alignSelf: "stretch",
    marginTop: scale(12),
    marginBottom: scale(14),
    gap: scale(8),
  },
  introBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: scale(24),
    paddingTop: scale(12),
    paddingBottom: scale(8),
  },
  ringContainer: {
    marginBottom: scale(16),
    alignItems: "center",
    justifyContent: "center",
    width: scale(160),
    height: scale(160),
  },
  ringGlow: {
    position: "absolute",
    width: scale(180),
    height: scale(180),
    borderRadius: scale(90),
  },
  ringGlowInner: {
    position: "absolute",
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
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
    marginBottom: scale(6),
  },
  subtitle: {
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginBottom: scale(12),
    paddingHorizontal: scale(4),
  },
  benefitsContainer: {
    alignSelf: "stretch",
    backgroundColor: "#F9FAFB",
    borderRadius: moderateScale(20),
    paddingVertical: scale(20),
    paddingHorizontal: scale(20),
    marginBottom: scale(20),
    gap: scale(16),
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },
  benefitIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: "rgba(82, 153, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButton: {
    width: "100%",
    borderRadius: moderateScale(16),
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaButtonGradient: {
    paddingVertical: scale(17),
    alignItems: "center",
    justifyContent: "center",
  },
});

const revealStyles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(16),
    marginTop: scale(8),
    marginBottom: scale(16),
  },
  card: {
    borderRadius: moderateScale(24),
    padding: scale(28),
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.15)",
    backgroundColor: "#F0F4FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    height: scale(260),
  },
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  dot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    overflow: "hidden",
  },
  pulsingDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: "#5299FE",
  },
  skeletonGroup: {
    alignSelf: "stretch",
    marginTop: scale(20),
    gap: scale(10),
  },
  skeletonLine: {
    height: scale(12),
    borderRadius: moderateScale(6),
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  emptyContainer: {
    justifyContent: "center",
  },
  emptyContent: {
    paddingHorizontal: scale(24),
    alignItems: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    marginBottom: scale(8),
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: scale(24),
  },
  emptyButton: {
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingVertical: scale(14),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(24),
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
    paddingHorizontal: scale(16),
    paddingBottom: scale(12),
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: scale(120),
  },
  // ═══════════════ SECTION CONTAINERS ═══════════════
  topSection: {
    zIndex: 1,
  },
  bottomSection: {
    zIndex: 1,
  },
  preOnboardingCard: {
    marginHorizontal: scale(16),
    marginTop: scale(8),
    marginBottom: scale(12),
    paddingVertical: scale(16),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(16),
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  preOnboardingButton: {
    alignSelf: "center",
    paddingVertical: scale(10),
    paddingHorizontal: scale(18),
    borderRadius: moderateScale(20),
    backgroundColor: "#5299FE",
  },
  quickReadCard: {
    marginHorizontal: scale(16),
    marginTop: scale(12),
    marginBottom: scale(12),
    paddingVertical: scale(24),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(20),
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
  },
  quickReadIconWrap: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: "rgba(82,153,254,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickReadBenefits: {
    alignSelf: "stretch",
    gap: scale(8),
    marginTop: scale(16),
    marginBottom: scale(20),
    paddingLeft: scale(8),
  },
  quickReadBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  quickReadCta: {
    alignSelf: "stretch",
    borderRadius: moderateScale(24),
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  quickReadCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    paddingVertical: scale(14),
  },
});
