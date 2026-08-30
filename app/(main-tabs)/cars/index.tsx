// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { MenuView } from "@react-native-menu/menu";
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
import { ArrowLeft, Briefcase, Car, Check as CheckIcon, ChevronDown, Copy, Ellipsis, Gauge, Info, Plus, Route, Sparkles, Star, Sun, Users, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

// Native iOS 26 liquid glass (optional). Mirrors the home / map-controls
// pattern — falls back to a frosted BlurView when the lib is unavailable.
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Not available — BlurView fallback.
}

// Native context-menu (@react-native-menu/menu) availability probe — mirrors
// the guard in the AI Chat screen. When present, the header "⋯" opens a native
// OS menu; otherwise we fall back to firing the remove confirm directly.
const isMenuViewAvailable = !!UIManager.getViewManagerConfig?.("MenuView");

import { haptics } from "@/lib/haptics";
import { useToast } from "@/hooks/useToast";
import { useUpdateMileage } from "@/hooks/useUpdateMileage";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

// 3. Convex & hooks
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useMergedMaintenance } from "@/hooks/useMaintenanceData";
import { useOemServiceIntervals } from "@/hooks/useOemServiceIntervals";
import { useUrgencyRankedItems } from "@/hooks/useUrgencyRankedItems";
import { useDriverRecommendationsFromConvex } from "@/hooks/useDriverRecommendationsFromConvex";
import { useBookingStore } from "@/stores/useBookingStore";
import {
  MAINTENANCE_TYPE_TO_CATEGORY,
  extractMaintenanceType,
  findServiceForMaintenanceType,
  findServiceFromDescription,
} from "@/lib/maintenanceServiceMapping";
import { useTireBookingStore } from "@/stores/useTireBookingStore";
import type { Id } from "@/convex/_generated/dataModel";
import { isPseudoVin } from "@/convex/lib/vinIdentity";
import { ALL_MAINTENANCE_TYPES, MAINTENANCE_LABELS, type MaintenanceType } from "@/utils/maintenanceStatus";
import { computeVehicleHealthScore, type HealthScoreInput } from "@/utils/healthScore";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { OilIcon, BrakesIcon, TireIcon, BatteryIcon, WarningIcon } from "@/components/cars/ServiceIcons";
import { fetchVehicleImageUrl, inferColorFamily, pickPaintFamilyFromSwatches } from "@/utils/vehicleImage";
import { COLOR_GRADIENTS, DEFAULT_GRADIENTS } from "@/constants/colorGradients";
import { isDarkColor } from "@/utils/contrast";
import { scale, verticalScale, moderateScale } from '@/utils/responsive';

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 5. Flow-specific components
import CarCarousel, { Vehicle } from "@/components/cars/CarCarousel";
import { DataAccuracyDisclaimer } from "@/components/cars/DataAccuracyDisclaimer";
import { VehicleRoleSheet } from "@/components/cars/VehicleRoleSheet";
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";
// MVP-DISABLED: loyalty/rewards — re-enable post-launch
// import LoyaltyPoints from "@/components/cars/LoyaltyPoints";
import MaintenanceTracker from "@/components/cars/MaintenanceTracker";
import MaintenanceInputModal from "@/components/cars/MaintenanceInputModal";
import { MileageEditModal } from "@/components/cars/MileageEditModal";
import { CheckinBanner } from "@/components/cars/CheckinBanner";
import UpcomingFollowUpsCard from "@/components/cars/UpcomingFollowUpsCard";
import CarInfoStepper, { type CarInfoStepperHandle } from "@/components/cars/CarInfoStepper";
import { AnimatedGradientBackground } from "@/components/shared-ui/AnimatedGradientBackground";
import { VehicleServiceHistory } from "@/components/cars/VehicleServiceHistory";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { PostOptimizeBookingSheet } from "@/components/cars/PostOptimizeBookingSheet";
import { PackageQuestionsSheet } from "@/components/cars/PackageQuestionsSheet";
import { useVehicleReadiness } from "@/hooks/useVehicleReadiness";
import { ChevronRight, ScanLine, Wrench } from "lucide-react-native";

// ============================================================================
// HELPERS
// ============================================================================

// Brand acronyms that should stay fully uppercase even after title-casing
// (e.g. "BMW 740" was reading as "Bmw 740" before this list). Add new
// acronyms here rather than special-casing at call sites.
const BRAND_ACRONYMS = new Set([
  "BMW",
  "GMC",
  "MG",
  "RAM",
  "FIAT",
  "SRT",
  "BYD",
  "AMG",
]);

function titleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => {
      const upper = w.toUpperCase();
      if (BRAND_ACRONYMS.has(upper)) return upper;
      const lower = w.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
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
// COLOR_GRADIENTS + DEFAULT_GRADIENTS are shared with add-vehicle-review.tsx;
// see constants/colorGradients.ts for the source.

// react-native-image-colors is a native (autolinked) module. Guard the
// require so a build that hasn't linked it yet (i.e. before the next
// dev/EAS build) silently falls back to the default gradient instead of
// crashing at import. Used to tint the background from the car image
// when a vehicle has no stored paint color (e.g. a VDB exterior-only car).
let getImageColors:
  | ((uri: string, config?: Record<string, unknown>) => Promise<any>)
  | null = null;
try {
  getImageColors = require("react-native-image-colors").getColors;
} catch {
  getImageColors = null;
}

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

/**
 * Desaturate + lighten a hex color to the "hero tint" band. Original
 * PM spec called for sat ≤ 0.25 and lightness ≥ 0.92, but that made
 * every car's hero look near-white on the compressed 360pt band —
 * you couldn't tell a green Tiguan from a red BMW. Relaxed to
 * sat ≤ 0.45 / lightness ≥ 0.85 so each vehicle keeps a visible
 * per-color identity while still reading as a soft wash, not a
 * saturated block.
 */
function desaturateForHeroTint(
  hex: string,
  satTarget = 0.45,
  lumMin = 0.85,
): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l0 > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  const s2 = Math.min(s, satTarget);
  const l2 = Math.max(l0, lumMin);
  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r2 = 0;
  let g2 = 0;
  let b2 = 0;
  if (hp >= 0 && hp < 1) [r2, g2, b2] = [c, x, 0];
  else if (hp < 2) [r2, g2, b2] = [x, c, 0];
  else if (hp < 3) [r2, g2, b2] = [0, c, x];
  else if (hp < 4) [r2, g2, b2] = [0, x, c];
  else if (hp < 5) [r2, g2, b2] = [x, 0, c];
  else [r2, g2, b2] = [c, 0, x];
  const m = l2 - c / 2;
  const to2 = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to2(r2)}${to2(g2)}${to2(b2)}`;
}



const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CarsHomeScreen() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const aiStepBottomClearance = scale(118) + insets.bottom;
  const isFocused = useIsFocused();
  const router = useRouter();
  const params = useLocalSearchParams<{ openStepper?: string; focusVin?: string; openItemDetail?: string }>();
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
  // Optimistic "just finished onboarding" flag, scoped to the specific
  // vehicle it was set for (not a global boolean) so it can't leak to
  // other carousel cars. Derived into `localOnboardingDone` once
  // activeOwnershipId is known.
  const [onboardingDoneForId, setOnboardingDoneForId] = useState<string | null>(null);
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
  const [visibleAiStepCount, setVisibleAiStepCount] = useState(0);
  const stepOpacities = useRef(AI_STEPS.map(() => new Animated.Value(0))).current;
  const stepIconScales = useRef(AI_STEPS.map(() => new Animated.Value(0.5))).current;
  const lineHeights = useRef(AI_STEPS.map(() => new Animated.Value(0))).current;
  const aiStepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carPulseAnim = useRef(new Animated.Value(1)).current;
  const carPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const aiStepsScrollRef = useRef<ScrollView>(null);

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
  // True on the stepper's "You're all set!" screen (all 5 answered) — hides
  // the health-sheet back button there.
  const [stepperAllDone, setStepperAllDone] = useState(false);
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
      haptics.success();
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
          haptics.cta();
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
        haptics.step();
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
          haptics.success();
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
              haptics.cta();
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

  // One scroll surface now (title + car + steps share a ScrollView), so
  // just scroll to the bottom to keep the newest step visible. When the
  // content fits, scrollToEnd is a no-op.
  const scrollAiStepsToLatest = useCallback((animated = true) => {
    aiStepsScrollRef.current?.scrollToEnd({ animated });
  }, []);

  const closeHealthSheet = useCallback(() => {
    if (scoreCountRef.current) clearInterval(scoreCountRef.current);
    setStepperAllDone(false);

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
        setVisibleAiStepCount(0);
        aiStepsScrollRef.current?.scrollTo({ y: 0, animated: false });
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
              setVisibleAiStepCount(AI_STEPS.length);

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
          setVisibleAiStepCount(idx + 1);
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

  useEffect(() => {
    if (!gearsOverlayVisible || gearsPhase === 'looping' || visibleAiStepCount === 0) {
      return;
    }

    const timer = setTimeout(() => {
      scrollAiStepsToLatest(true);
    }, 120);

    return () => clearTimeout(timer);
  }, [gearsOverlayVisible, gearsPhase, scrollAiStepsToLatest, visibleAiStepCount]);

  useEffect(() => {
    if (gearsPhase !== 'ready') {
      return;
    }

    const timer = setTimeout(() => {
      scrollAiStepsToLatest(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [gearsPhase, scrollAiStepsToLatest]);

  // Convex: user's vehicles
  const { userId } = useUserFromConvex();
  const { vehicles: listVehicles, isLoading } = useVehicleOwnershipFromConvex();
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const setVehicleRole = useMutation(api.vehicles.setVehicleRole);
  // Role picker (garageRole). Opened by the role tag, and auto-shown once
  // after onboarding completes (deferred until the celebration settles).
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [pendingRoleAsk, setPendingRoleAsk] = useState(false);
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
      if (!r.vin) return;

      const localUrl = vehicleImageUrls[r.vin];
      const convexImageUrl =
        typeof r.vehicle?.image_url === "string" &&
        r.vehicle.image_url.includes("/transparent/")
          ? r.vehicle.image_url
          : null;

      // Skip the effect body only when local state already matches
      // Convex's authoritative URL. Without this, the old write-once
      // guard (`if vehicleImageUrls[r.vin] return`) latched the FIRST
      // value forever — so a remove + re-add (same VIN, new color)
      // kept showing the prior color in the carousel even though
      // Convex's `image_url` had updated. Reading from Convex on
      // mismatch keeps the carousel in sync without a relaunch.
      if (localUrl && localUrl === convexImageUrl) return;

      // Local and Convex disagree (or local hadn't been populated
      // yet) — adopt Convex's URL as truth and let the next render
      // settle. Falls through to the existing cached/fetch flow
      // below when Convex has no usable transparent URL of its own.
      if (convexImageUrl && localUrl !== convexImageUrl) {
        setVehicleImageUrls((prev) => ({ ...prev, [r.vin]: convexImageUrl }));
        return;
      }

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
  const { vehicles, ownershipIds, ownerships, colorFamilies, vehicleConfigIds } = useMemo(() => {
    if (!listVehicles?.length) return {
      vehicles: [] as Vehicle[],
      ownershipIds: [] as (Id<"vehicle_owners"> | undefined)[],
      ownerships: [] as (Record<string, any> | undefined)[],
      colorFamilies: [] as (string | null)[],
      vehicleConfigIds: [] as (Id<"vehicle_configs"> | undefined)[],
    };

    // Build paired list of vehicles + ownership IDs + raw ownership records
    const paired: { vehicle: Vehicle; ownershipId: Id<"vehicle_owners"> | undefined; ownership: Record<string, any> | undefined; colorFamily: string | null; vehicleConfigId: Id<"vehicle_configs"> | undefined }[] = [];
    listVehicles.forEach((r: any, i: number) => {
      const v = r.vehicle;
      const o = r.ownership;
      const meta = v ? (v as { metadata?: { make?: string; model?: string; color?: string; body_style?: string } }).metadata : undefined;
      const paintColor = meta?.color;
      // `metadata.color` may be a legacy family id ("red") OR a VDB
      // filename slug ("delmonico-red-pearl-coat"). Reverse-match to a
      // family id so the gradient lookup hits — otherwise we'd fall
      // through to DEFAULT_GRADIENTS and the bg would tint by list
      // index (e.g. a red Ram getting a saturated blue background).
      const familyId = inferColorFamily(paintColor);
      const gradient =
        (familyId && COLOR_GRADIENTS[familyId]) ||
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
        colorFamily: familyId,
        // Threaded through to useOemServiceIntervals — null/undefined
        // when the v3 pipeline hasn't resolved a config yet (the
        // ~7-min enrichment window after a vehicle is added).
        vehicleConfigId: (v?.vehicle_config_id as Id<"vehicle_configs"> | undefined) ?? undefined,
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
      colorFamilies: paired.map((p) => p.colorFamily),
      vehicleConfigIds: paired.map((p) => p.vehicleConfigId),
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
  // Prefer the store's selectedVehicleId so an upstream `selectVehicle(vin)`
  // call (e.g. home's View button or whole-card tap) is honored on first mount.
  // Falls back to the first vehicle (primary) only when the store is empty or
  // out of sync.
  useEffect(() => {
    if (vehicles.length === 0) return;
    if (!activeVehicleVin || !vehicles.some((v) => v.vin === activeVehicleVin)) {
      const storeVin = useVehicleStore.getState().selectedVehicleId;
      const target =
        storeVin && vehicles.some((v) => v.vin === storeVin)
          ? storeVin
          : vehicles[0].vin;
      setActiveVehicleVin(target);
    }
  }, [vehicles, activeVehicleVin]);

  // One-shot: when navigated here with `?focusVin=...` (e.g. from
  // health-estimating after onboarding a new car), anchor the carousel
  // to that vehicle once it appears in the list. Fires only once so the
  // user can swipe to a different car afterwards without snapping back.
  const focusVinApplied = useRef(false);
  useEffect(() => {
    if (focusVinApplied.current) return;
    const target = params.focusVin?.toUpperCase().trim();
    if (!target) return;
    if (vehicles.some((v) => v.vin === target)) {
      setActiveVehicleVin(target);
      focusVinApplied.current = true;
    }
  }, [params.focusVin, vehicles]);

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
  // Any car without a real VIN — one the owner added by hand (MANUAL-…) OR one
  // a shop created as a walk-in (SHOP…). isPseudoVin is the complement of the
  // ISO 3779 charset test, so it catches every placeholder format we mint
  // without enumerating them. Both can have a real VIN attached: see "Add VIN"
  // in the ⋯ menu and the prompt on the card.
  const activeVehicleIsManual = useMemo(() => isPseudoVin(activeVehicle?.vin), [activeVehicle?.vin]);
  // Dismissal is per-vehicle and per-session. The ask is worth repeating — a
  // placeholder VIN costs the owner their maintenance schedule and exact-fit
  // parts on every future booking — but not worth nagging within one sitting.
  const [vinPromptDismissed, setVinPromptDismissed] = useState<Set<string>>(new Set());
  const showVinPrompt =
    activeVehicleIsManual &&
    !!activeVehicle?.vin &&
    !vinPromptDismissed.has(activeVehicle.vin);
  // Active vehicle's resolved Convex config — fed to useOemServiceIntervals
  // so the maintenance calc can prefer per-vehicle OEM cadences from
  // the v3 enrichment over the hardcoded MAKE_OVERRIDES / DEFAULT_INTERVALS.
  const activeVehicleConfigId = useMemo(
    () => vehicleConfigIds[activeVehicleIndex],
    [vehicleConfigIds, activeVehicleIndex],
  );
  const oemIntervals = useOemServiceIntervals(activeVehicleConfigId);

  // ── Vehicle readiness (status pill + package-question CTA) ──
  // See docs/TICKET_PACKAGE_QUESTIONS.md. While the pipeline runs, shows
  // "Setting up your car…". Once data exists, surfaces a CTA for any
  // unanswered package questions; answers persist to vehicle_owner_specs.
  const vehicleReadiness = useVehicleReadiness(activeOwnershipId);
  const [showPackageQuestionsSheet, setShowPackageQuestionsSheet] = useState(false);

  // Completion toast — fires when readiness transitions from
  // "enriching" → "ready" for a given VIN. Reuses the unified toast
  // (`toast.success`) so it wears the same shape and motion as every
  // other toast in the app. Deduped so we don't re-fire on tab
  // returns while the vehicle stays ready.
  const prevReadinessStatusRef = useRef<string | null>(null);
  const dedupeRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const status = vehicleReadiness.status ?? null;
    const vin = activeVehicle?.vin ?? null;
    const prev = prevReadinessStatusRef.current;
    prevReadinessStatusRef.current = status;
    if (!vin) return;
    if (
      prev === "enriching" &&
      status === "ready" &&
      !dedupeRef.current.has(vin)
    ) {
      dedupeRef.current.add(vin);
      const yr = activeVehicle?.year ? `${activeVehicle.year} ` : "";
      const mk = activeVehicle?.make
        ? `${titleCase(activeVehicle.make)} `
        : "";
      const md = activeVehicle?.model ? titleCase(activeVehicle.model) : "";
      const label = `${yr}${mk}${md}`.trim();
      toast.success(
        label ? `${label} connected` : "Vehicle connected",
        "Maintenance plan updated",
        { icon: Car },
      );
    }
  }, [
    vehicleReadiness.status,
    activeVehicle?.vin,
    activeVehicle?.year,
    activeVehicle?.make,
    activeVehicle?.model,
    toast,
  ]);

  const handleSelectRole = useCallback(
    (role: string | null) => {
      const vin = activeVehicle?.vin;
      if (!vin || !userId) return;
      // garageRole is the single source of truth; "Primary" also flips the
      // default car (handled server-side in setVehicleRole).
      setVehicleRole({ vin, userId, role })
        .then(() => {
          toast.success(role ? "Role saved" : "Role cleared", undefined, { icon: Users });
        })
        .catch(() => {
          toast.error("Couldn't save role. Try again.");
        });
    },
    [activeVehicle?.vin, userId, setVehicleRole, toast],
  );

  // The active vehicle's stored paint-color family (null when none was
  // saved — e.g. a VDB exterior-only car like a single-color CR-V).
  const activeColorFamily = useMemo(() => colorFamilies[activeVehicleIndex], [colorFamilies, activeVehicleIndex]);

  // Background gradient sampled from the car image, keyed by VIN. Only
  // filled for vehicles with no stored paint color, and only when the
  // native image-colors module is linked (after the next dev/EAS build);
  // until then it stays empty and the default gradient shows.
  const [imageGradientByVin, setImageGradientByVin] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!getImageColors) return; // native module not linked yet
    if (activeColorFamily) return; // already has a stored color
    const vin = activeVehicle?.vin;
    const uri = (activeVehicle?.imageSource as { uri?: string } | undefined)?.uri;
    if (!vin || !uri) return;
    if (imageGradientByVin[vin]) return; // already sampled this car

    let cancelled = false;
    (async () => {
      try {
        const FALLBACK = "#9aa4b2";
        const res = await getImageColors!(uri, { fallback: FALLBACK, cache: true, key: vin });
        // Candidate swatches, PROMINENT-FIRST per platform. pickPaint…
        // chooses the most saturated (the car body) over neutral
        // wheels/glass/lighting, then classifies by hue.
        const candidates: (string | undefined)[] =
          res?.platform === "ios"
            ? [res.background, res.primary, res.secondary, res.detail]
            : res?.platform === "android"
              ? [res.dominant, res.vibrant, res.darkVibrant, res.lightVibrant, res.muted, res.darkMuted, res.lightMuted, res.average]
              : [res?.dominant, res?.vibrant, res?.darkVibrant, res?.lightVibrant, res?.muted];
        const family = pickPaintFamilyFromSwatches(
          candidates.filter((c) => c && c.toLowerCase() !== FALLBACK),
        );
        const gradient = family ? COLOR_GRADIENTS[family] : null;
        if (gradient && !cancelled) {
          setImageGradientByVin((prev) => ({ ...prev, [vin]: gradient }));
        }
      } catch {
        // Native module missing or sampling failed — keep the default bg.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeColorFamily, activeVehicle?.vin, activeVehicle?.imageSource, imageGradientByVin]);

  const isPreOnboardingComplete = activeOwnership?.preOnboardingComplete === true;

  // Onboarding state.
  // localOnboardingDone is the optimistic flag set when the stepper/auto-
  // complete finishes, working around a Convex subscription delay that can
  // leave the field undefined. Scoped to the active vehicle so it never
  // leaks to other carousel cars.
  const localOnboardingDone =
    onboardingDoneForId != null && onboardingDoneForId === activeOwnershipId;
  const isOnboardingComplete = activeOwnership?.onboardingComplete === true || localOnboardingDone;
  // True only when onboarding is done AND the entire celebration flow is finished.
  // celebrationFlowActive.current is the synchronous guard that prevents any flash
  // between Convex pushing isOnboardingComplete and React applying state updates.
  const celebrationDismissed = isOnboardingComplete && !pendingHealthSheet && !showHealthRingSheet && !celebrationActive;
  // Show post-onboarding content (MaintenanceTracker, etc.) once onboarding is
  // confirmed and the reveal animation has finished. The health page is a
  // full-screen overlay so content behind it is not visible — no need to gate on sheet flags.
  const showPostOnboardingContent =
    isPreOnboardingComplete && isOnboardingComplete && !gearsOverlayVisible;

  // After onboarding finishes (onComplete sets pendingRoleAsk), wait for the
  // celebration/gears overlay to settle, then auto-open the role picker once.
  // Must not open while the post-optimize booking sheet (or health sheet) is
  // up — two sheets presenting at the same instant freezes the app. The gears
  // dismiss flips gearsOverlayVisible→false AND showOptimizeBookingSheet→true
  // in one batch, so we gate on those and let this re-fire once they close
  // (pendingRoleAsk stays set until the role sheet actually opens).
  useEffect(() => {
    if (
      pendingRoleAsk &&
      showPostOnboardingContent &&
      !showOptimizeBookingSheet &&
      !showHealthRingSheet &&
      !showRoleSheet
    ) {
      // Defer so the prior sheet's RN Modal has time to dismiss + unmount
      // before we mount the role-sheet Modal. Two simultaneous Modals
      // freeze the JS thread on iOS — happens when tapping "Book Later"
      // on PostOptimizeBookingSheet: state flips synchronously but the
      // Modal stays mounted through its ~300ms close animation. 500ms
      // covers that plus a safety buffer. Cleanup clears the timer if
      // any guard dep changes during the delay (e.g. user re-opens the
      // optimize sheet), so no stale opens slip through.
      const t = setTimeout(() => {
        setPendingRoleAsk(false);
        setShowRoleSheet(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [
    pendingRoleAsk,
    showPostOnboardingContent,
    showOptimizeBookingSheet,
    showHealthRingSheet,
    showRoleSheet,
  ]);
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
        setOnboardingDoneForId(activeOwnershipId);
        celebrationFlowActive.current = true;
        setCelebrationActive(true);
        setPendingHealthSheet(true);
      } catch (err) {
        console.warn("[AutoComplete] Failed for new vehicle:", err);
        autoCompleteFired.current = false;
        toast.error(
          "Couldn't auto-fill vehicle details.",
          "Enter them manually below.",
        );
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
    oemIntervals,
  );

  // Action Engine ranking (Yassin v1.1 §3): computes urgency + tier per
  // item and bucket-groups them for MaintenanceTracker's tier-aware
  // render. Side effect: emits tier-change events to Convex
  // (`urgency_tier_events`) for post-launch calibration of the 75/55/25
  // cutoffs. The MaintenanceTracker on this page is the authoritative
  // emitter — other surfaces (Home callout) compute tiers without
  // logging to avoid double-counting.
  const { byTier: urgencyTierBuckets } = useUrgencyRankedItems(
    mergedMaintenanceItems,
    activeVehicle?.vin,
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

  // Director-adjustable outer weights (Upkeep vs. Warning Lights, plus the
  // Open-recs cap) — reactive so a director's change is picked up live, and
  // kept in step with the exact same weights Oto's server score reads
  // (convex/oto/vehicleHealth.ts), per the "must agree" contract.
  const healthScoreWeights = useQuery(api.healthScoreWeights.getWeights);

  /*
   * True while the post-service health write is still queued.
   *
   * applyBookingStatusTransition schedules the inspection-health job two hours
   * after a booking reaches a terminal state and stamps
   * health_score_pending_until for that window; the job clears it when it
   * lands. Until then the score on screen is pre-service — the grades, the
   * recommendation reveal and the mechanic's warning-light changes all apply
   * together, later.
   *
   * Compared against now rather than trusting the clear: if a job fails the
   * timestamp is left behind, and a stale one must read as "not pending"
   * rather than pinning the ring forever. A booking that re-enters a terminal
   * state reschedules and pushes the timestamp out again, so this can
   * legitimately return true a second time.
   */
  const healthScorePending = useMemo(() => {
    const until = activeOwnership?.health_score_pending_until as number | undefined;
    return typeof until === "number" && until > Date.now();
  }, [activeOwnership?.health_score_pending_until]);

  const computedHealthScore = useMemo(() => {
    return computeVehicleHealthScore(healthScoreInput, healthScoreWeights);
  }, [healthScoreInput, healthScoreWeights]);

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
  const [mileageEditOpen, setMileageEditOpen] = useState(false);
  // Shared mileage-update hook — wraps `api.vehicles.updateMileage`
  // with validation, toast, and the reactive maintenance recompute
  // (no extra call needed; the tracker re-tiers on the next render
  // tick automatically). Same hook is the entry point for Oto AI's
  // mileage-update flow.
  const { updateMileage: updateMileageWithUx } = useUpdateMileage();
  const editPickerY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const editPickerBackdrop = useRef(new Animated.Value(0)).current;

  const openEditPicker = useCallback(() => {
    setEditPickerModal(true);
    setShowEditPicker(true);
    editPickerY.setValue(SCREEN_HEIGHT);
    editPickerBackdrop.setValue(0);
    Animated.parallel([
      // translateY MUST run on the native driver. Under the New Architecture
      // (Fabric — mandatory for reanimated 4), a JS-driven transform on an
      // absolute-positioned view inside a Modal re-lays-out every frame and
      // re-jitters on each parent re-render (Convex subscriptions), which
      // reads as the sheet "seizing". Native driver moves it to the UI thread.
      Animated.spring(editPickerY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }),
      Animated.timing(editPickerBackdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [editPickerY, editPickerBackdrop]);

  const closeEditPicker = useCallback((cb?: () => void) => {
    Animated.parallel([
      // Must match the open animation's driver — an Animated.Value can't mix
      // native and JS drivers across animations without throwing.
      Animated.timing(editPickerY, { toValue: SCREEN_HEIGHT, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(editPickerBackdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setShowEditPicker(false);
      setEditPickerModal(false);
      cb?.();
    });
  }, [editPickerY, editPickerBackdrop]);

  // True when the active vehicle is showing the covered-car fallback
  // (no `imageSource` has been resolved yet). In that case the page
  // gets the blue palette and skips the elliptical ground shadow
  // entirely — the cloth illustration doesn't read as a real car
  // casting a contact shadow.
  const isCoveredCar = !activeVehicle?.imageSource;

  // Active vehicle's gradient colors for the background. Covered cars
  // get the canonical blue palette regardless of their stored color.
  const activeGradient = useMemo(
    () => {
      if (isCoveredCar) return COLOR_GRADIENTS.blue;
      // No stored paint color → prefer a gradient sampled from the car
      // image (populated once the native image-colors module is linked).
      if (!activeColorFamily && activeVehicle?.vin) {
        const sampled = imageGradientByVin[activeVehicle.vin];
        if (sampled) return sampled;
      }
      return activeVehicle?.gradientColors ?? DEFAULT_GRADIENTS[0];
    },
    [isCoveredCar, activeColorFamily, activeVehicle?.vin, activeVehicle?.gradientColors, imageGradientByVin]
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
        toast.success(isDefault ? "Primary vehicle updated" : "No primary vehicle", undefined, { icon: Star });
      } catch (e) {
        console.warn("Failed to set primary vehicle", e);
        toast.error("Couldn't set as primary. Try again.");
      }
    },
    [userId, updateOwnershipPrimary, toast],
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
              toast.error("Couldn't remove this vehicle. Try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [activeVehicle?.vin, userId, removeOwner]);

  // Attach a real VIN to a manually-added car. Routes into the normal VIN
  // decode/review flow, carrying the manual ownership's id so the review
  // screen can correct this car's VIN in place (keeping all its history).
  // See attachRealVinToManualVehicle in convex/vehicles.
  const handleAddVinToManualVehicle = useCallback(() => {
    if (!activeVehicle?.vin || !activeOwnershipId) return;
    router.push({
      pathname: "/add-vehicle",
      params: {
        migrateFromOwnerId: String(activeOwnershipId),
        migrateFromVin: activeVehicle.vin,
        // Carried so the review screen can warn if the entered VIN decodes to a
        // different make/model than this car.
        migrateFromMake: activeVehicle.make ?? "",
        migrateFromModel: activeVehicle.model ?? "",
        migrateFromYear: activeVehicle.year != null ? String(activeVehicle.year) : "",
      },
    });
  }, [activeVehicle?.vin, activeVehicle?.make, activeVehicle?.model, activeVehicle?.year, activeOwnershipId, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshing(false);
  }, []);

  // Empty state: no vehicles from Convex
  if (!isLoading && vehicles.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        {/* Brand-blue background, matching the Home tab's gradient. */}
        <LinearGradient colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]} style={StyleSheet.absoluteFill} />
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
          {/* Per PM: the extracted vehicle tint is a HERO TINT, not a
              page background. Compress the 3 vehicle-tint stops into
              the top ~360pt of the visible screen, then resolve into
              #F8FAFC so every card below (Confirm specs, checkin
              banner, tracker) sits on a solid neutral surface. This
              is what fixes the contrast issues across the whole page.

              Fraction math: container = 5× SCREEN_HEIGHT starting at
              -0.5× SCREEN_HEIGHT. Screen y=0 → 0.10; screen y=360 →
              (360/(5·SCREEN_HEIGHT)) + 0.10 ≈ 0.177. */}
          <LinearGradient
            colors={
              [
                ...settledGradient.map((c) => desaturateForHeroTint(c)),
                "#F8FAFC",
              ] as unknown as [string, string, ...string[]]
            }
            locations={[0.10, 0.135, 0.16, 0.177]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Top overlay — fades 0 → 1 to bring the incoming gradient
              on top of the still-opaque bottom. Resets to 0 after the
              fade settles and the bottom adopts the new colors. */}
          <ReAnimated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
            <LinearGradient
              colors={
                [
                  ...incomingGradient.map((c) => desaturateForHeroTint(c)),
                  "#F8FAFC",
                ] as unknown as [string, string, ...string[]]
              }
              locations={[0.10, 0.135, 0.16, 0.177]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </ReAnimated.View>
        </View>

        {/* Profile button (far left) + dev pills + VIN info button (right) */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginTop: 20, marginBottom: scale(4), zIndex: 10, position: "relative" }}>
          <ProfileInitialsButton />
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: scale(6), marginLeft: scale(12) }}>
            {!!activeVehicle?.vin && (() => {
              const role = activeOwnership?.garageRole?.trim() ?? "";
              const hasRole = role.length > 0;
              // Match the role-sheet's icon language so the pill, the
              // sheet rows, and the sheet's hero card all read as one
              // visual system. Custom strings fall to Sparkles; empty
              // state uses Plus to read as an invitation.
              const RoleIcon = !hasRole
                ? Plus
                : (() => {
                    switch (role.toLowerCase()) {
                      case "primary": return Star;
                      case "secondary": return Car;
                      case "commuter": return Route;
                      case "family": return Users;
                      case "weekend": return Sun;
                      case "work": return Briefcase;
                      default: return Sparkles;
                    }
                  })();
              const isPrimary = role.toLowerCase() === "primary";
              return (
                <Pressable
                  onPress={() => setShowRoleSheet(true)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: scale(5),
                      backgroundColor: hasRole ? "#FFFFFF" : "#EEF4FF",
                      paddingHorizontal: scale(10),
                      paddingVertical: scale(5),
                      borderRadius: moderateScale(14),
                      shadowColor: "#0F172A",
                      shadowOpacity: 0.08,
                      shadowRadius: scale(5),
                      shadowOffset: { width: 0, height: scale(1) },
                      elevation: 2,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <RoleIcon
                    size={scale(12)}
                    color="#5299FE"
                    strokeWidth={2.2}
                    {...(isPrimary ? { fill: "#5299FE" } : {})}
                  />
                  <Text weight="bold" size="xs" color="#5299FE">
                    {hasRole ? titleCase(role) : "Add role"}
                  </Text>
                  <ChevronDown size={scale(12)} color="#5299FE" />
                </Pressable>
              );
            })()}
            {/* Redo Info — commented out (dev-only). Uncomment to restore.
            {isPreOnboardingComplete && showPostOnboardingContent && activeOwnershipId && (
              <Pressable
                style={({ pressed }) => [{ paddingVertical: scale(4), paddingHorizontal: scale(10), borderRadius: moderateScale(12), backgroundColor: "rgba(82,153,254,0.1)" }, pressed && { opacity: 0.7 }]}
                onPress={async () => {
                  try {
                    await resetOnboarding({ vehicleOwnerId: activeOwnershipId });
                    setOnboardingDoneForId(null);
                  } catch (err) {
                    console.warn("Reset onboarding failed:", err);
                  }
                }}
              >
                <Text weight="semiBold" size="xs" color="#5299FE">Redo Info</Text>
              </Pressable>
            )}
            */}
            {/* Remove Vehicle moved to the bottom of the page as a primary
                red CTA. See the section below LoyaltyPoints. */}
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
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setVinModalVisible(true)}
              style={({ pressed }) => [styles.infoGlassButton, pressed && styles.infoGlassButtonPressed]}
            >
              {/* Plain frosted-white chip. On the light Cars background the
                  native liquid-glass material renders off-center, so a solid
                  chip keeps the icon perfectly centered (and reads clearly). */}
              <View style={styles.infoSolidChip}>
                <Info size={24} color="#4B5563" strokeWidth={2} />
              </View>
            </Pressable>
          )}

          {/* Overflow "⋯" menu — the destructive Remove Vehicle action lives
              here (native OS context menu) instead of as a prominent CTA at
              the bottom of the page. Same glass treatment as the Info button.
              Falls back to firing the confirm directly when the native menu
              view isn't available. */}
          {!!activeVehicle?.vin && !!userId && (() => {
            const ellipsisIcon = (
              <View style={styles.infoSolidChip}>
                <Ellipsis size={24} color="#4B5563" strokeWidth={2} />
              </View>
            );
            return isMenuViewAvailable ? (
              <MenuView
                title="Vehicle options"
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === "addVin") {
                    haptics.selection();
                    handleAddVinToManualVehicle();
                  } else if (nativeEvent.event === "remove") {
                    haptics.selection();
                    handleRemoveActiveVehicle();
                  }
                }}
                actions={[
                  ...(activeVehicleIsManual
                    ? [{
                        id: "addVin",
                        title: "Add VIN",
                        image: Platform.OS === "ios" ? "barcode.viewfinder" : undefined,
                      }]
                    : []),
                  {
                    id: "remove",
                    title: "Remove Vehicle",
                    image: Platform.OS === "ios" ? "trash" : undefined,
                    attributes: { destructive: true },
                  },
                ]}
              >
                <View style={styles.infoGlassButton}>{ellipsisIcon}</View>
              </MenuView>
            ) : (
              <Pressable
                accessibilityLabel="Vehicle options"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => {
                  // Fallback when the native menu is unavailable — a manual car
                  // gets both actions via an ActionSheet-style Alert; otherwise
                  // the ⋯ goes straight to the sole Remove action.
                  if (activeVehicleIsManual) {
                    Alert.alert("Vehicle options", undefined, [
                      { text: "Add VIN", onPress: handleAddVinToManualVehicle },
                      { text: "Remove Vehicle", style: "destructive", onPress: handleRemoveActiveVehicle },
                      { text: "Cancel", style: "cancel" },
                    ]);
                  } else {
                    handleRemoveActiveVehicle();
                  }
                }}
                style={({ pressed }) => [styles.infoGlassButton, pressed && styles.infoGlassButtonPressed]}
              >
                {ellipsisIcon}
              </Pressable>
            );
          })()}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            TOP SECTION: Vehicle Carousel
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.topSection} className="">
        {/* 120pt bottom scrim per PM spec — softens the transition
            from the hero image into the surface color below so the
            car doesn't have a hard edge floating over the next
            section. Positioned inside topSection so it clips to the
            hero rather than overlapping content. */}
        <LinearGradient
          colors={["rgba(248,250,252,0)", "#F8FAFC"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroBottomScrim}
          pointerEvents="none"
        />
          <CarCarousel
            vehicles={vehicles}
            activeVehicleId={activeVehicleVin ?? undefined}
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
            healthScorePending={healthScorePending}
            onResumeCheckin={openEstimatedHealthSheet}
            knownIssues={activeOwnershipKnownIssues}
            hpBuffer={activeVehicleHpBuffer}
            completedBookings={completedBookingsForVehicle}
          />
        </View>

        {/* Reduced-accuracy notice for 2012-or-older vehicles (self-hides otherwise) */}
        <DataAccuracyDisclaimer
          year={activeVehicle?.year ?? 0}
          make={activeVehicle?.make}
          model={activeVehicle?.model}
        />

        {/* Quick Read intro card — shown when pre-onboarding done but onboarding not yet complete */}
        {isPreOnboardingComplete && !isOnboardingComplete && !isNewVehicle && (() => {
          // No score is shown here. Pre-onboarding there are no service
          // records, and utils/mergedMaintenance.ts fills the gap with assumed
          // statuses — brakes/tires/battery "on time", oil "due soon" — which
          // produced a fixed 93 for EVERY vehicle regardless of age or
          // mileage (odometerMiles is not even an input to the score). It
          // could only fall from there: this Q5 goes 93 → 24 once the user
          // answers honestly, which punished them for telling us the truth at
          // the exact moment we were asking for it. Ahmad, 2026-08-27.
          const ringSize = 120;
          const strokeWidth = 10;
          const radius = (ringSize - strokeWidth) / 2;
          const circumference = 2 * Math.PI * radius;
          const center = ringSize / 2;
          return (
          // key on vin so swiping between two no-tracker cars
          // remounts the card — pulse rings + content arrive fresh
          // every time, same feel as today's tracker↔placeholder switch.
          <View key={activeVehicle?.vin ?? "no-vehicle"} style={styles.quickReadCard}>
            <View style={{ alignItems: "center", justifyContent: "center", width: scale(140), height: scale(140), marginBottom: scale(12) }}>
              <Animated.View style={{ position: "absolute", width: scale(160), height: scale(160), borderRadius: scale(80), backgroundColor: "#94A3B8", opacity: 0.12, transform: [{ scale: quickReadPulse }] }} />
              <Animated.View style={{ position: "absolute", width: scale(130), height: scale(130), borderRadius: scale(65), backgroundColor: "#94A3B8", opacity: 0.06, transform: [{ scale: quickReadPulse }] }} />
              <View style={{ width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
                <Svg width={ringSize} height={ringSize}>
                  <Circle cx={center} cy={center} r={radius} stroke="rgba(0,0,0,0.06)" strokeWidth={strokeWidth} fill="none" />
                </Svg>
                <View style={{ position: "absolute", alignItems: "center" }}>
                  <Text weight="bold" size="2xl" color="#94A3B8">· · ·</Text>
                  <Text weight="medium" size="xs" color="#94A3B8">Not scored yet</Text>
                </View>
              </View>
            </View>
            <Text weight="bold" size="lg" color="#0F172A" style={{ textAlign: "center" }}>
              Let&apos;s score your {activeVehicle?.make && activeVehicle?.model ? `${activeVehicle.make} ${activeVehicle.model}` : "vehicle"}
            </Text>
            <Text weight="medium" size="sm" color="#829BAD" style={{ textAlign: "center", marginTop: scale(6) }}>
              We don&apos;t have your service history yet. Five quick checks and you&apos;ll have a real health score.
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
                <View style={styles.quickReadCtaTextWrap}>
                  <Text
                    weight="semiBold"
                    size="xs"
                    color="rgba(255,255,255,0.92)"
                    style={styles.quickReadCtaEyebrow}
                  >
                    Get a quick read on
                  </Text>
                  <Text
                    weight="bold"
                    size="md"
                    color="#FFFFFF"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={styles.quickReadCtaTitle}
                  >
                    Your {activeVehicle?.make && activeVehicle?.model ? `${activeVehicle.make} ${activeVehicle.model}` : "Vehicle"}
                  </Text>
                </View>
                <View style={styles.quickReadCtaArrowWrap}>
                  <Ionicons name="arrow-forward" size={scale(18)} color="#FFFFFF" />
                </View>
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

          {/* No real VIN on this car. Sits ABOVE readiness deliberately: without
              a VIN there is nothing for the pipeline to be ready about, so
              asking about package questions first would be asking the second
              question before the first. Names what's lost rather than just
              flagging a missing field — "(Optional)" with no reason is why
              these go unfilled. */}
          {showVinPrompt && (
            <Pressable
              onPress={handleAddVinToManualVehicle}
              style={({ pressed }) => [
                readinessStyles.cta,
                pressed && readinessStyles.ctaPressed,
              ]}
            >
              <View style={readinessStyles.ctaIcon}>
                <ScanLine size={20} color="#2563EB" strokeWidth={2} />
              </View>
              <View style={readinessStyles.pillBody}>
                <Text size="md" weight="semiBold" color="#1A1A1A">
                  Add your VIN
                </Text>
                <Text size="sm" weight="regular" color="#2563EB">
                  Unlocks this car&apos;s real maintenance schedule and
                  exact-fit parts
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Dismiss VIN prompt"
                accessibilityRole="button"
                hitSlop={12}
                onPress={(event) => {
                  // Stop the press bubbling into the row's own onPress, which
                  // would open the scanner the driver just declined.
                  event.stopPropagation();
                  const vin = activeVehicle?.vin;
                  if (!vin) return;
                  setVinPromptDismissed((prev) => new Set(prev).add(vin));
                }}
                style={styles.vinPromptDismiss}
              >
                <X size={16} color="#94A3B8" strokeWidth={2} />
              </Pressable>
            </Pressable>
          )}

          {/* Vehicle readiness — "Setting up your car…" while enriching,
              "Confirm your car's specs" CTA when package questions are pending.
              See docs/TICKET_PACKAGE_QUESTIONS.md. */}
          {activeOwnershipId && vehicleReadiness.status === "enriching" && (
            <View style={readinessStyles.pill}>
              <View style={readinessStyles.pillIcon}>
                <Wrench size={20} color="#475569" strokeWidth={2} />
              </View>
              <View style={readinessStyles.pillBody}>
                <Text size="md" weight="semiBold" color="#1A1A1A">
                  Setting up your car…
                </Text>
                <Text size="sm" weight="regular" color="#64748B">
                  Building your vehicle profile. Services will appear when
                  ready.
                </Text>
              </View>
            </View>
          )}
          {activeOwnershipId &&
            vehicleReadiness.status === "ready" &&
            vehicleReadiness.pendingPackages.length > 0 && (
              <Pressable
                onPress={() => setShowPackageQuestionsSheet(true)}
                style={({ pressed }) => [
                  readinessStyles.cta,
                  pressed && readinessStyles.ctaPressed,
                ]}
              >
                <View style={readinessStyles.ctaIcon}>
                  <Wrench size={20} color="#2563EB" strokeWidth={2} />
                </View>
                <View style={readinessStyles.pillBody}>
                  <Text size="md" weight="semiBold" color="#1A1A1A">
                    Confirm your car&apos;s specs
                  </Text>
                  <Text size="sm" weight="regular" color="#2563EB">
                    {vehicleReadiness.pendingPackages.length}{" "}
                    {vehicleReadiness.pendingPackages.length === 1
                      ? "question"
                      : "questions"}{" "}
                    to make booking accurate
                  </Text>
                </View>
                <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
              </Pressable>
            )}

          {/* Maintenance tracker (shown after onboarding + sheet dismissed) */}
          {showPostOnboardingContent && (
            <MaintenanceTracker
              key={activeVehicle?.vin ?? "no-vehicle"}
              items={mergedMaintenanceItems}
              tieredItems={urgencyTierBuckets}
              openItemId={params.openItemDetail}
              vehicleCondition={computedHealthScore}
              healthScoreInput={healthScoreInput}
              vehicleLabel={activeVehicle?.model ?? undefined}
              isDarkBg={isDarkBg}
              isEnriching={vehicleReadiness.status === "enriching"}
              onBookNow={(id) => {
                // Backstop for the disabled CTAs above — never open the booking
                // flow while the vehicle is still enriching (no parts data yet).
                if (vehicleReadiness.status === "enriching") return;
                const vin = activeVehicle?.vin;
                if (vin) useVehicleStore.getState().selectVehicle(vin.toUpperCase().trim());
                // If this item was sourced from a mechanic recommendation,
                // stash the rec id so createBatch wires it into the booking
                // (auto-closes the rec on completion).
                const tapped = mergedMaintenanceItems.find((m) => m.id === id);
                const store = useBookingStore.getState();
                store.setSourceRecommendationId(tapped?.sourceRecommendationId ?? null);
                // Deep-link the service selector and pre-attach the natural
                // primary service so the cart isn't empty when the sheet
                // opens. User can swap in the selector.
                const itemType = extractMaintenanceType(id);
                // Prefer a description-matched service (e.g. "Brake System
                // Inspection" from "have brakes inspected soon"). Falls back
                // to the slug default for the type when the description
                // doesn't literally name a catalog service.
                // A mechanic's recommendation names its catalog service
                // outright (job_recommendations.service_id), so use that
                // rather than guessing. Without it a rec fell through to
                // description matching — extractMaintenanceType("rec-<id>")
                // yields "rec", which maps to no slug — so "Coolant Flush
                // flagged on eye-check (monitor)" had to happen to contain a
                // catalog name or the user landed on the empty service picker.
                const fromRec = tapped?.serviceId
                  ? store.availableServices.find((sv) => sv.id === tapped.serviceId)
                  : undefined;
                const explicit = fromRec ?? (tapped?.description
                  ? findServiceFromDescription(tapped.description, store.availableServices)
                  : undefined);
                const matched = explicit ?? findServiceForMaintenanceType(itemType, store.availableServices);
                // Use the matched service's own category for the tab —
                // important when the matcher picks across categories (e.g.
                // Brake System Inspection lives in system_diagnostics).
                store.setInitialServiceCategory(
                  matched?.category ?? MAINTENANCE_TYPE_TO_CATEGORY[itemType] ?? 'basic_maintenance',
                );
                store.clearSelectedServices();
                if (matched) store.toggleServiceSelection(matched.id);
                // Same behavior as the Home surfaces: when we can
                // pre-select the service, skip the service picker and
                // jump straight to Choose Mechanic. Falls back to
                // select-services if the maintenance type doesn't
                // resolve to a catalog service.
                router.push(
                  matched
                    ? '/(booking-flow)/choose-mechanic'
                    : '/(booking-flow)/select-services',
                );
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
                // Add the recommendation's service to the cart so
                // Choose Mechanic has something to price / filter
                // shops against. Clear first so this doesn't append
                // to whatever the user last picked.
                if (serviceId) {
                  bookingStore.clearSelectedServices();
                  bookingStore.toggleServiceSelection(serviceId);
                }
                // Skip the service picker when we know the specific
                // serviceId (the follow-up card always carries one
                // for a recommendation). Falls back to
                // select-services when serviceId is missing.
                router.push(
                  serviceId
                    ? '/(booking-flow)/choose-mechanic'
                    : '/(booking-flow)/select-services',
                );
              }}
            />
          ) : null}

          {/* Unified Service History — Otopair completed bookings + parsed
              user uploads, filtered to the active VIN. Upload picker lives
              inside the component (Reducto-parse flow), and row tap opens
              ReceiptSheet (booking row) or ParsedDocumentSheet (doc row). */}
          {isOnboardingComplete && (
            <VehicleServiceHistory
              vin={activeVehicle?.vin}
              vehicleOwnerId={activeOwnershipId}
              isDarkBg={isDarkBg}
            />
          )}

          {/* MVP-DISABLED: loyalty/rewards — re-enable post-launch */}
          {/*
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
          */}

        </View>
      </ScrollView>

      {/* Status-bar scrim — 80pt dark fade behind the status bar so
          the clock / Dynamic Island stay readable when the vehicle
          hero image drifts up under it. Overlay above the ScrollView
          (fixed to the screen top), pointer-events none so it doesn't
          eat touches meant for the header pills right below it. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.statusBarScrim}
        pointerEvents="none"
      />

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

          {/* Mileage row — sits above the maintenance-type rows
              since the odometer drives every interval calc. Opens
              the MileageEditModal which patches vehicle_owners.mileage
              via `api.vehicles.updateMileage`. */}
          <Pressable
            style={({ pressed }) => [pickerStyles.row, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }]}
            onPress={() => {
              closeEditPicker(() => setMileageEditOpen(true));
            }}
          >
            <View style={pickerStyles.rowIcon}>
              <Gauge size={22} color="#5299FE" strokeWidth={2} />
            </View>
            <Text weight="medium" size="md" color="#1F2937" style={{ flex: 1 }}>
              Mileage
            </Text>
            <Text weight="semiBold" size="sm" color="#5299FE">
              {currentOdometer != null
                ? `${Math.round(currentOdometer).toLocaleString()} mi`
                : "Update"}
            </Text>
          </Pressable>

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
                {/* Hidden on the "You're all set!" screen — nothing to go
                    back to once every item is answered. */}
                {stepperAllDone ? (
                  <View style={healthSheetStyles.fullPageBackBtn} />
                ) : (
                  <Pressable onPress={() => {
                    if (stepperRef.current?.isExpanded()) {
                      stepperRef.current.goBack();
                    } else {
                      closeHealthSheet();
                    }
                  }} hitSlop={12} style={({ pressed }) => [healthSheetStyles.fullPageBackBtn, pressed && { opacity: 0.6 }]}>
                    <ArrowLeft size={scale(24)} color="#141C24" strokeWidth={2} />
                  </Pressable>
                )}
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
                  initialDraft={activeOwnership?.serviceHistoryDraft ?? null}
                  onAllDoneChange={setStepperAllDone}
                  skipIntro
                  onBack={closeHealthSheet}
                  onFinishForNow={closeHealthSheet}
                  onComplete={() => {
                    console.log('[CarInfoStepper] onComplete fired — SHEET instance');
                    setOnboardingDoneForId(activeOwnershipId);
                    celebrationFlowActive.current = true;
                    setCelebrationActive(true);
                    animateToConfirmedScore();
                    // Ask for the car's role once the celebration settles.
                    setPendingRoleAsk(true);
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
                    // Empty arc in the estimated state — drawing progress would
                    // trace a score that does not exist yet.
                    const strokeDashoffset =
                      circumference * (1 - (healthSheetMode === 'estimated' ? 0 : ringProgress) / 100);
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
                          {/* `healthSheetMode === 'estimated'` means onboarding is
                              incomplete — no records, so nothing to score. That is a
                              different thing from `health_score_is_estimated`, which
                              marks a REAL score gone stale (check-in 30+ days overdue)
                              and keeps its "~" qualifier. */}
                          <Text weight="bold" size="3xl" color={healthSheetMode === 'estimated' ? "#9CA3AF" : "#1F2937"}>
                            {healthSheetMode === 'estimated'
                              ? "· · ·"
                              : `${activeOwnership?.health_score_is_estimated ? "~" : ""}${displayedScore}`}
                          </Text>
                          <Text weight="semiBold" size="xs" color="#9CA3AF" style={{ marginTop: scale(-2) }}>
                            {healthSheetMode === 'estimated'
                              ? "not scored yet"
                              : activeOwnership?.health_score_is_estimated ? "estimated" : "out of 100"}
                          </Text>
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
                    ? `Let's score your ${activeVehicle?.make ?? "vehicle"}`
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
                    ? "We don't have your service history yet, so there's nothing to score. Answer a few quick questions and you'll have a real one."
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
                      <Text weight="semiBold" size="sm" color="#6B7280">I&apos;ll finish later</Text>
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
          <LinearGradient
            colors={['#FFFFFF', '#FFFFFF', '#D6EAF8']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Building phase: car image + sequential AI task list, all in
              ONE ScrollView so title + car + steps scroll as a single
              surface (no fixed/scroll boundary = no seam). */}
          {gearsPhase !== 'looping' && (
            <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: lottieFadeOut }}>
              <ScrollView
                ref={aiStepsScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: insets.top + scale(12), paddingHorizontal: scale(28), paddingBottom: aiStepBottomClearance }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onContentSizeChange={() => {
                  if (visibleAiStepCount > 0) {
                    scrollAiStepsToLatest(true);
                  }
                }}
              >
                {/* Title */}
                <View style={{ alignItems: 'center' }}>
                  <Text weight="bold" size="3xl" color="#0F172A" style={{ textAlign: 'center' }}>
                    Building your vehicle profile
                  </Text>
                </View>
                {/* Car image — VDB image if available, otherwise
                    the covered-car placeholder (manual-entry vehicles). */}
                <Animated.View style={{ opacity: carPulseAnim, width: scale(140), height: scale(85), alignSelf: 'center', marginTop: scale(8), marginBottom: scale(16) }}>
                  <Image
                    source={activeVehicle?.imageSource ?? require('@/assets/images/covered-car.png')}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                </Animated.View>
                {/* Sequential step list */}
                {AI_STEPS.slice(0, visibleAiStepCount).map((step, idx) => {
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
              </ScrollView>
            </Animated.View>
          )}
          {/* Ready phase: title + car image + completed steps, all in ONE
              ScrollView (single surface, no seam — same as building). */}
          {gearsPhase === 'ready' && (
            <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: carImageFadeIn }}>
              <ScrollView
                ref={aiStepsScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: insets.top + scale(12), paddingHorizontal: scale(28), paddingBottom: aiStepBottomClearance }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
              >
                {/* Title */}
                <View style={{ alignItems: 'center' }}>
                  <Text weight="bold" size="3xl" color="#0F172A" style={{ textAlign: 'center' }}>
                    Vehicle profile optimized
                  </Text>
                </View>
                {/* Car image — VDB if available, covered-car otherwise. */}
                <Animated.View style={{ alignSelf: 'center', marginTop: scale(8), marginBottom: scale(16), transform: [{ scale: carImageFadeIn.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
                  <View style={{ width: scale(140), height: scale(85), alignItems: 'center', justifyContent: 'center' }}>
                    <Image
                      source={activeVehicle?.imageSource ?? require('@/assets/images/covered-car.png')}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  </View>
                </Animated.View>
                {/* Completed steps list */}
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
              </ScrollView>
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

      {/* COMMENTED-OUT: post-add-car booking prompt — restore when ready */}
      {/* Post-optimize booking sheet — pops on the car's dashboard right
          after `dismissGearsOverlay` runs. */}
      {/*
      <PostOptimizeBookingSheet
        visible={showOptimizeBookingSheet}
        onClose={() => setShowOptimizeBookingSheet(false)}
        maintenanceItems={mergedMaintenanceItems}
        vehicleLabel={activeVehicleLabel}
      />
      */}

<VehicleRoleSheet
        visible={showRoleSheet}
        currentRole={activeOwnership?.garageRole as string | undefined}
        vehicleName={activeVehicleLabel}
        onClose={() => setShowRoleSheet(false)}
        onSelect={handleSelectRole}
      />

      {/* Package questions — opens from the "Confirm your car's specs" CTA. */}
      {activeOwnershipId && (
        <PackageQuestionsSheet
          visible={showPackageQuestionsSheet}
          vehicleOwnerId={activeOwnershipId}
          questions={vehicleReadiness.pendingPackages}
          vehicleLabel={activeVehicleLabel ?? ""}
          onClose={() => setShowPackageQuestionsSheet(false)}
        />
      )}

      {/* Mileage edit — opened from the Edit Maintenance Info sheet's
          Mileage row. Patches vehicle_owners.mileage so every interval
          calc downstream sees the new odometer immediately. */}
      <MileageEditModal
        visible={mileageEditOpen}
        initialMileage={currentOdometer}
        onClose={() => setMileageEditOpen(false)}
        onSave={async (mileage) => {
          const vin = activeVehicle?.vin;
          if (!vin || !userId) {
            throw new Error("Sign in and pick a vehicle to update mileage.");
          }
          // Hook fires its own toast on success AND on validation /
          // mutation failure. Re-throwing on !ok preserves the
          // MileageEditModal's inline-error contract.
          const result = await updateMileageWithUx({ vin, userId, mileage });
          if (!result.ok) throw new Error(result.error);
        }}
      />

    </View>
  );
}

// ============================================================================
// READINESS PILL / CTA STYLES (Setting up… / Confirm your car's specs)
// ============================================================================

const readinessStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: scale(16),
    marginTop: scale(8),
    paddingVertical: scale(12),
    paddingHorizontal: scale(14),
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Per PM: solid #FFFFFF, 1pt #E2E8F0 border, 16pt radius,
  // shadow 0/2/8/rgba(15,23,42,0.06). Wrench in a 40pt #EFF6FF
  // circle, icon #2563EB. No more translucent gray that read as
  // disabled in iOS grammar.
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: scale(16),
    marginTop: scale(8),
    paddingVertical: scale(12),
    paddingHorizontal: scale(14),
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  pillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pillBody: {
    flex: 1,
    gap: 2,
  },
});

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
  // Small tap target on the VIN prompt's trailing edge. Sized past the visual
  // glyph so a thumb finds it without stealing the row's own press.
  vinPromptDismiss: {
    padding: 4,
    marginLeft: 2,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  // VIN info button — same liquid-glass treatment as the Home
  // notification bell (see app/(main-tabs)/home/index.tsx).
  infoGlassButton: {
    padding: 4,
  },
  infoGlassButtonPressed: {
    opacity: 0.7,
  },
  // Solid frosted-white chip for the Cars-tab header icon buttons. A plain
  // View (not liquid glass) guarantees the glyph is dead-centered on the light
  // background; shadow mirrors the "Add role" pill so the pair feels cohesive.
  infoSolidChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  infoGlassIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    // Sits on the light Cars-tab background: a frosted-white chip with a
    // hairline dark edge so the button reads (the glass alone is invisible
    // white-on-white).
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
  },
  infoGlassContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    // Dark hairline (was white/0.5, invisible on the light background).
    borderColor: "rgba(15,23,42,0.12)",
  },
  infoGlassBlur: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Lift the frosted fill so the circle is a visible chip on light.
    backgroundColor: "rgba(255,255,255,0.45)",
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
    // 5× screen height so pages with long service-history / loyalty
    // sections stay covered. Past ~2× the white container would bleed
    // through. Beyond the last gradient stop the bottom color holds, so
    // extending the container is safe.
    height: SCREEN_HEIGHT * 5,
    zIndex: 0,
  },
  statusBarScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 5,
  },
  heroBottomScrim: {
    // Sits at the bottom of the hero (topSection) so the car photo
    // fades cleanly into the F8FAFC surface below. Absolute so it
    // overlays without pushing content, height 120pt per PM spec.
    // NO zIndex — the switcher pills + health ring (rendered later
    // in tree via CarCarousel) need to draw on top, otherwise the
    // fade veils them and they become unreadable.
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
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
    position: "relative",
    minHeight: scale(54),
    paddingLeft: scale(18),
    paddingRight: scale(52),
    paddingVertical: scale(10),
    alignItems: "center",
    justifyContent: "center",
  },
  quickReadCtaTextWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },
  quickReadCtaEyebrow: {
    lineHeight: moderateScale(14),
  },
  quickReadCtaTitle: {
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginTop: scale(1),
  },
  quickReadCtaArrowWrap: {
    position: "absolute",
    right: scale(18),
    top: 0,
    bottom: 0,
    width: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },
});
