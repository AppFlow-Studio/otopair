/**
 * CarCarousel
 *
 * PURPOSE: Displays a 3D circular carousel of vehicle cards that rotate like
 *          a spinning platform. Drag to rotate or tap thumbnails to select.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (My Cars screen)
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

// 2. Expo & Third-party
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Info, Plus, X, XCircle } from 'lucide-react-native';
import { CarSelectionContent } from '@/components/booking/sheets/CarSelectionContent';
import { FloatingSheet, type FloatingSheetRef } from '@/components/shared-ui/FloatingSheet';
import { useVehicleStore } from '@/stores/useVehicleStore';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { Easing } from 'react-native';
import ReAnimated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  SharedValue,
  Easing as REasing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { router } from 'expo-router';

// 5. Responsive utilities
import { scale, verticalScale, moderateScale, isTablet } from '@/utils/responsive';
import { computeHealthScoreFactors, type HealthFactor } from '@/utils/healthScore';


// ============================================================================
// TYPES
// ============================================================================

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  mileage: number;
  nextServiceDate?: string;
  isDefault: boolean;
  imageSource?: ImageSourcePropType;
  logoSource?: ImageSourcePropType;
  condition?: number;
  nextUnlock?: string;
  gradientColors?: string[];
  /** Body style from `vehicles.metadata.body_style` — drives the
   *  per-car ground-line tire offset (trucks/SUVs sit higher in the
   *  frame than sedans/coupes). */
  bodyStyle?: string;
}

interface CarCarouselProps {
  vehicles: Vehicle[];
  onEditMileage?: (vehicleId: string) => void;
  onToggleDefault?: (vehicleId: string, isDefault: boolean) => void;
  onActiveIndexChange?: (index: number) => void;
  isFocused?: boolean;
  /** Real maintenance items for computing health score */
  maintenanceItems?: import("@/components/cars/MaintenanceTracker").MaintenanceItem[];
  /** Current odometer reading in miles */
  currentMileage?: number | null;
  /** Whether to show the health ring (hidden until onboarding is complete for non-connected vehicles) */
  showHealthRing?: boolean;
  /** Pre-computed unified health score (0–100) from utils/healthScore.ts */
  healthScore?: number;
  /** True when showing the pipeline estimate (pre-onboarding done, CarInfoStepper not done) */
  isEstimatedScore?: boolean;
  /** Called when the user taps to resume the Quick Read from the estimated modal */
  onResumeCheckin?: () => void;
  /** Parent has determined the active vehicle's gradient top is dark
   *  enough that the hero text must flip to light to stay readable. */
  isDarkBg?: boolean;
  /** Solid color used for the ground-line shadow under the active car.
   *  Should be a desaturated dark tint of the page's background hue
   *  so the line reads as a natural shadow on the current screen.
   *  Defaults to the GroundLine component's neutral dark-pink tint. */
  groundLineTint?: string;
  /** Same hue as `groundLineTint` with alpha 0 — used for the two
   *  outer stops of the line's gradient. Override together with
   *  `groundLineTint` so both ends fade to transparency cleanly. */
  groundLineTintTransparent?: string;
  /** RGB triple ("r, g, b", no alpha) for the elliptical drop shadow
   *  under the car. Should be the desaturated dark version of the
   *  active background hue so the shadow tints to match the screen. */
  groundShadowTintRgb?: string;
  /** When true, skips rendering the elliptical ground shadow under
   *  the active car. Used for covered-car fallback states where the
   *  cloth illustration shouldn't cast a contact-patch shadow. The
   *  `<GroundLine>` still renders. */
  hideGroundShadow?: boolean;
  /** Active vehicle's known dashboard warning lights — feeds the
   *  Score Factors breakdown inside the Vehicle Health sheet. */
  knownIssues?: string[];
  /** Health Points bonus buffer (0–3) — shown as a positive factor. */
  hpBuffer?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAR_CARD_WIDTH = Math.min(scale(320), 420);
const CAR_CARD_HEIGHT = scale(240);

// ============================================================================
// GROUND LINE
// ============================================================================

/**
 * GroundLine
 *
 * Soft horizontal "ground plane" line that grounds the active car in
 * the carousel. Renders a thin horizontal LinearGradient that fades
 * transparent → solid → transparent across its width, so the line
 * eases out at both ends instead of hard-cutting. Reads as the
 * surface the car is resting on without feeling like a screen-wide
 * divider.
 *
 * Standalone so it scales (via `width`) when the active vehicle
 * changes between body styles in the carousel.
 */
function GroundLine({
  width,
  bottomOffset,
  tint = "rgba(60, 15, 25, 0.35)",
  tintTransparent = "rgba(60, 15, 25, 0)",
  height = 1.5,
}: {
  /** Pixel width of the line — typically the car image container
   *  width (e.g. `CAR_CARD_WIDTH`), NOT the screen width, so the line
   *  stays anchored to the car rather than reading as a screen-wide
   *  divider. */
  width: number;
  /** Distance from the parent's bottom edge, in pixels. Aligns the
   *  line vertically with the tire contact point. */
  bottomOffset: number;
  /** Solid middle color. Defaults to a desaturated dark-pink so the
   *  line matches the warm-toned cars page background and reads as a
   *  soft ground plane rather than a pure-black hairline. */
  tint?: string;
  /** Same hue, alpha=0. Override only when `tint` is customized. */
  tintTransparent?: string;
  /** Line thickness in px. 1.5 reads as a hairline at retina density
   *  without disappearing. */
  height?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 0,
      }}
      pointerEvents="none"
    >
      <LinearGradient
        // Horizontal gradient — transparent at both edges, solid
        // through the middle 60%. Two solid stops (20% and 80%) give
        // a flat core instead of a single peak, so the line reads as
        // a band of ground rather than a diamond-shaped highlight.
        colors={[tintTransparent, tint, tint, tintTransparent]}
        locations={[0, 0.2, 0.8, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width, height }}
      />
    </View>
  );
}

// ============================================================================
// GROUND SHADOW
// ============================================================================

/**
 * CarGroundShadow
 *
 * Soft elliptical drop shadow that sits under the active car beneath
 * the GroundLine. Renders a radial-gradient ellipse (dark at center,
 * fading to transparent at the edges) so the car reads as casting a
 * shadow onto the surface, not just resting on a line.
 *
 * `tintRgb` is the RGB triple (no alpha) — the component composes
 * `rgb(${tintRgb})` for the two SVG stop colors and applies
 * `centerOpacity` / 0 separately via `stopOpacity`. Lets the parent
 * pass a hue derived from the active background gradient.
 */
function CarGroundShadow({
  width,
  bottom,
  offsetY = 0,
  offsetX = 0,
  height = 22,
  tintRgb = "60, 15, 25",
  centerOpacity = 0.45,
}: {
  /** Pixel width of the ellipse — typically ~75% of the car card width. */
  width: number;
  /** Anchor distance from the parent's bottom edge, in pixels. */
  bottom: number;
  /** Additional upward offset added to `bottom`. Negative drops the
   *  shadow lower in the frame, positive pushes it up. */
  offsetY?: number;
  /** Horizontal translation in pixels — aligns the shadow with the
   *  car's visual center of mass on 3/4-angle renders. */
  offsetX?: number;
  /** Vertical thickness of the ellipse. */
  height?: number;
  /** RGB triple ("r, g, b") for the shadow tint. Compose from the
   *  active background gradient's top stop so the shadow desaturates
   *  to the screen's own hue. */
  tintRgb?: string;
  /** Alpha at the ellipse center; falls to half at 70% radius, 0 at
   *  the edge. Gives a punchier falloff than a linear fade. */
  centerOpacity?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: bottom + offsetY,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 0,
        transform: [{ translateX: offsetX }],
      }}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id="carGroundShadow"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fx="50%"
            fy="50%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={`rgb(${tintRgb})`} stopOpacity={centerOpacity} />
            <Stop offset="70%" stopColor={`rgb(${tintRgb})`} stopOpacity={centerOpacity / 2} />
            <Stop offset="100%" stopColor={`rgb(${tintRgb})`} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill="url(#carGroundShadow)"
        />
      </Svg>
    </View>
  );
}

// Width per segment in the SegmentedControl-based thumbnail selector.
// Drives both the rail layout and the absolute-positioned thumbnail
// overlays so they line up over each segment's center.
const SEGMENT_WIDTH = scale(56);
// Compact-mode (5+ cars) the strip is only 3 segments — we can hold
// the natural segment width but keep room for the active-car pill
// + add button + health ring on the same row.
const COMPACT_SEGMENT_WIDTH = scale(46);
const COMPACT_THUMB_SIZE = scale(32);
const RADIUS = SCREEN_WIDTH * 0.5;

// Fallback image used only when no dynamic imageSource is available
const FALLBACK_VEHICLE_IMAGE = require('@/assets/images/covered-car.png');

/**
 * Best-effort body-style classifier from a car's make/model. Used when
 * `vehicle.bodyStyle` (from Convex metadata) is missing so the
 * ground-line + shadow sizing still varies per vehicle shape.
 *
 * Covers popular nameplates seen in test data plus generic keyword
 * matches (e.g. "truck", "convertible") in the model name. Returns
 * one of: "truck" | "suv" | "coupe" | "convertible" | "sedan" | "".
 * Empty string falls through to the default sizing in the consuming
 * useMemo.
 */
function inferBodyStyleFromModel(_make?: string, model?: string): string {
  const m = (model ?? "").toLowerCase().trim();
  if (!m) return "";

  // Direct keyword cues in the model name.
  if (/\b(truck|pickup|f-?\d{2,3}|silverado|ram\s*\d|tundra|tacoma|frontier|colorado|ridgeline|maverick)\b/.test(m)) {
    return "truck";
  }
  if (/\b(suv|crossover|wagon|van)\b/.test(m)) return "suv";
  if (/\b(convertible|cabriolet|spyder|spider|roadster)\b/.test(m)) return "convertible";
  if (/\b(coupe|gt|gtr|gt-r)\b/.test(m)) return "coupe";
  if (/\b(sedan|saloon|hatchback)\b/.test(m)) return "sedan";

  // Popular nameplate → body style. Loose substring match so trims
  // (e.g. "911 Turbo", "Blazer RS") still resolve.
  const SUV = /(explorer|blazer|tahoe|suburban|expedition|escalade|navigator|highlander|4runner|rav4|cr-?v|hr-?v|pilot|passport|telluride|palisade|sorento|sportage|tucson|santa\s?fe|santa\s?cruz|outback|forester|ascent|tiguan|atlas|rogue|murano|pathfinder|armada|cx-?\d|mkx|mkc|mkz|aviator|nautilus|corsair|x[1-7]\b|q[3-8]\b|gle|glc|gls|glb|gla|grand\s?cherokee|wrangler|bronco|edge|escape|equinox|trailblazer|venza|kicks|seltos|trax|encore|envision|enclave|q-?[357]|qx[3-8]|macan|cayenne|range\s?rover|discovery|defender)/;
  const COUPE = /(911|cayman|boxster|gt[3-4]|corvette|mustang|camaro|challenger|charger|supra|gr\s?86|brz|nsx|i8|m[2-4]\b|amg\s?gt|r8|huracan|aventador)/;
  const TRUCK = /(silverado|sierra|f-?(150|250|350)|ranger|titan|tundra|tacoma|frontier|colorado|canyon|ridgeline|maverick|cybertruck|gladiator)/;
  const CONVERTIBLE = /(miata|mx-?5|z[34]\b|s2000|elise|exige|spider|spyder|roadster|cabriolet)/;

  if (TRUCK.test(m)) return "truck";
  if (SUV.test(m)) return "suv";
  if (CONVERTIBLE.test(m)) return "convertible";
  if (COUPE.test(m)) return "coupe";

  // Common sedan letter/number patterns (A4, 3-Series, C-Class, etc.)
  // — last resort before falling through to default.
  if (/^(a[3-8]\b|s[3-8]\b|rs[3-8]\b|q50|q60|[3-7]\s?series|[gm][3-7]|c-?class|e-?class|s-?class|civic|accord|camry|corolla|altima|sentra|maxima|impala|malibu|fusion|focus|elantra|sonata|optima|forte|jetta|passat|3\b|6\b|mazda\s?[346])/.test(m)) {
    return "sedan";
  }

  return "";
}


// ============================================================================
// RING CONFIGURATION & TYPES
// ============================================================================

interface RingConfig {
  percentage: number;
  strokeWidth: number;
  radius: number;
  gradientId: string;
  colors: string[];
  trackOpacity: number;
  maxPercentage: number;
  showGlow: boolean;
  name: string;
  description: string;
}

// Metric configuration for breakdown rows
interface MetricConfig {
  name: string;
  subtitle: string;
  color: string;
  percentage: number; // Used for progress bar and overall calculation
  displayValue: string; // What to show instead of percentage (e.g., "5/10" or "45,000 mi")
  scoreImpact: number; // How much this metric is affecting overall score
}

// ============================================================================
// VEHICLE HEALTH MODAL COMPONENT
// ============================================================================

interface VehicleHealthModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleName: string;
  healthPercentage: number;
  maintenancePercentage: number;
  servicePercentage: number;
  maintenanceItems?: import("@/components/cars/MaintenanceTracker").MaintenanceItem[];
  currentMileage?: number;
  isEstimated?: boolean;
  onResumeCheckin?: () => void;
  knownIssues?: string[];
  hpBuffer?: number;
}

const VehicleHealthModal = ({
  visible,
  onClose,
  vehicleName,
  healthPercentage,
  maintenancePercentage,
  servicePercentage,
  maintenanceItems: realItems,
  currentMileage: realMileage,
  isEstimated,
  onResumeCheckin,
  knownIssues,
  hpBuffer,
}: VehicleHealthModalProps) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringScaleAnim = useRef(new Animated.Value(1)).current;
  const ringGlowAnim = useRef(new Animated.Value(0)).current;
  const ringPulseAnim = useRef(new Animated.Value(1)).current;
  
  // Animated ring values for staggered animation
  const [animatedHealth, setAnimatedHealth] = useState(0);
  const [animatedMaintenance, setAnimatedMaintenance] = useState(0);
  const [animatedService, setAnimatedService] = useState(0);
  
  // Progress bar animations
  const [progressHealth, setProgressHealth] = useState(0);
  const [progressMaintenance, setProgressMaintenance] = useState(0);
  const [progressService, setProgressService] = useState(0);

  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Calculate overall score (average of all three)
  const overallScore = Math.round((healthPercentage + maintenancePercentage + servicePercentage) / 3);

  // Score factors breakdown — same formula as the displayed score, but
  // split into "what's helping" vs "what's hurting" with pts deltas.
  const { positives: factorsPositive, negatives: factorsNegative } = useMemo(() => {
    if (!realItems || realItems.length === 0) {
      return { positives: [] as HealthFactor[], negatives: [] as HealthFactor[] };
    }
    return computeHealthScoreFactors({
      maintenanceItems: realItems,
      odometerMiles: realMileage ?? 0,
      knownIssues,
      hpBuffer,
    });
  }, [realItems, realMileage, knownIssues, hpBuffer]);

  // Use the unified health score passed from parent
  const calculatedCondition = healthPercentage;

  // Sub-scores for display breakdown
  const knownItems = (realItems ?? []).filter((i) => i.status !== "unknown");
  const onTimeItems = knownItems.filter((i) => i.status === "on_time");
  const maintenanceCompleted = onTimeItems.length;
  const maintenanceTotal = Math.max(knownItems.length, 1);
  const maintenanceScore = maintenancePercentage;

  const vehicleMileage = realMileage ?? 0;
  const usageScore = servicePercentage;

  // Format mileage for display
  const formatMileage = (miles: number) => {
    if (miles >= 1000) {
      return `${(miles / 1000).toFixed(0)}k mi`;
    }
    return `${miles} mi`;
  };

  // Metric configurations with clear names and explanations
  const metrics: MetricConfig[] = [
    {
      name: 'Overall Vehicle Condition',
      subtitle: 'Based on your maintenance and Usage',
      color: '#30D158',
      percentage: calculatedCondition,
      displayValue: `${calculatedCondition}%`,
      scoreImpact: 0, // No separate impact since it's derived from the below
    },
    {
      name: 'Maintenance',
      subtitle: 'More services completed = higher score',
      color: maintenanceScore >= 75 ? '#30D158' : maintenanceScore >= 60 ? '#FFEA00' : '#FF3B5C',
      percentage: maintenanceScore,
      displayValue: `${maintenanceCompleted}/${maintenanceTotal}`,
      // Weighted impact: (75 - score) × 0.7 weight
      scoreImpact: maintenanceScore >= 75 ? 0 : -Math.round((75 - maintenanceScore) * 0.7),
    },
    {
      name: 'Usage & Wear',
      subtitle: 'Lower mileage = higher score',
      color: usageScore >= 75 ? '#30D158' : usageScore >= 60 ? '#FFEA00' : '#FF3B5C',
      percentage: usageScore,
      displayValue: formatMileage(vehicleMileage),
      // Weighted impact: (75 - score) × 0.3 weight
      scoreImpact: usageScore >= 75 ? 0 : -Math.round((75 - usageScore) * 0.3),
    },
  ];

  const hasFactors = factorsPositive.length > 0 || factorsNegative.length > 0;

  useEffect(() => {
    if (visible) {
      // Reset slide position before animating
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
      
      // Reset animations
      setAnimatedHealth(0);
      setAnimatedMaintenance(0);
      setAnimatedService(0);
      setProgressHealth(0);
      setProgressMaintenance(0);
      setProgressService(0);
      ringScaleAnim.setValue(1);
      ringGlowAnim.setValue(0);
      ringPulseAnim.setValue(1);

      // Open modal + glow + pulse all at once
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 120,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringGlowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
          Animated.timing(ringPulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
      ).start();

      // Staggered ring animations
      const animateRing = (
        setter: (val: number) => void,
        target: number,
        delay: number
      ) => {
        setTimeout(() => {
          const duration = 1000;
          const steps = 60;
          const stepDuration = duration / steps;
          let currentStep = 0;

          const interval = setInterval(() => {
            currentStep++;
            const progress = 1 - Math.pow(1 - currentStep / steps, 3);
            setter(progress * target);
            if (currentStep >= steps) clearInterval(interval);
          }, stepDuration);
        }, delay);
      };

      animateRing(setAnimatedService, calculatedCondition, 0);
      animateRing(setProgressService, calculatedCondition, 0);
      animateRing(setAnimatedHealth, maintenanceScore, 200);
      animateRing(setProgressHealth, maintenanceScore, 200);
      animateRing(setAnimatedMaintenance, usageScore, 400);
      animateRing(setProgressMaintenance, usageScore, 400);
    } else {
      // Close modal animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SCREEN_HEIGHT,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, calculatedCondition, maintenanceScore, usageScore]);

  // Single large ring configuration
  const modalRingSize = scale(180);
  const ringStrokeWidth = scale(12);
  const ringRadius = (modalRingSize / 2) - (ringStrokeWidth / 2) - scale(8);
  const circumference = 2 * Math.PI * ringRadius;
  const center = modalRingSize / 2;
  
  // Use calculated condition as the overall health score (animated value)
  const overallPercentage = animatedService;
  const strokeDashoffset = circumference * (1 - overallPercentage / 100);
  
  // Determine ring color based on calculated condition
  const getRingColor = () => {
    if (calculatedCondition >= 75) return '#30D158'; // Green
    if (calculatedCondition >= 60) return '#FFEA00'; // Yellow
    return '#FF3B5C'; // Red
  };
  
  const ringColor = getRingColor();

  const renderRings = () => (
    <View style={modalStyles.ringsContainer}>
      <Animated.View style={[modalStyles.ringGlow, {
        backgroundColor: ringColor,
        opacity: Animated.multiply(ringGlowAnim, new Animated.Value(0.12)),
        transform: [{ scale: ringPulseAnim }],
      }]} />
      <Animated.View style={[modalStyles.ringGlowInner, {
        backgroundColor: ringColor,
        opacity: Animated.multiply(ringGlowAnim, new Animated.Value(0.06)),
        transform: [{ scale: ringPulseAnim }],
      }]} />
      <Animated.View style={{ transform: [{ scale: ringScaleAnim }] }}>
        <Svg width={modalRingSize} height={modalRingSize}>
          <Defs>
            <SvgLinearGradient id="mainRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={ringColor} />
              <Stop offset="50%" stopColor={ringColor} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={ringColor} stopOpacity={0.8} />
            </SvgLinearGradient>
          </Defs>

          <Circle cx={center} cy={center} r={ringRadius} stroke={ringColor} strokeWidth={ringStrokeWidth} fill="none" opacity={0.15} />
          <Circle cx={center} cy={center} r={ringRadius} stroke="url(#mainRingGradient)" strokeWidth={ringStrokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} />
          <Circle cx={center} cy={center} r={ringRadius} stroke={ringColor} strokeWidth={ringStrokeWidth + 4} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} opacity={0.2} />
        </Svg>
      </Animated.View>
      
      <View style={modalStyles.ringCenterContent}>
        <Text style={modalStyles.percentageText}>{Math.round(overallPercentage)}</Text>
        <Text style={modalStyles.ringSubLabel}>out of 100</Text>
      </View>
    </View>
  );

  const renderBreakdownRow = (
    color: string,
    name: string,
    subtitle: string,
    percentage: number,
    animatedPercentage: number,
    displayValue: string,
    scoreImpact: number
  ) => (
    <View style={modalStyles.breakdownRow}>
      <View style={modalStyles.breakdownLeft}>
        <View style={[modalStyles.colorDot, { backgroundColor: color }]} />
        <View style={modalStyles.breakdownTextContainer}>
          <View style={modalStyles.breakdownHeader}>
            <Text style={modalStyles.breakdownName}>{name}</Text>
            <Text style={modalStyles.breakdownPercentage}>{displayValue}</Text>
          </View>
          <Text style={modalStyles.breakdownSubtitle}>{subtitle}</Text>
          <View style={modalStyles.progressBarRow}>
            <View style={modalStyles.progressBarContainer}>
              <View 
                style={[
                  modalStyles.progressBar, 
                  { 
                    backgroundColor: color,
                    width: `${animatedPercentage}%`,
                  }
                ]} 
              />
            </View>
            {scoreImpact !== 0 && (
              <View style={[
                modalStyles.scoreImpactBadge,
                { backgroundColor: 'rgba(255, 59, 92, 0.15)' }
              ]}>
                <Text style={[
                  modalStyles.scoreImpactText,
                  { color: '#FF3B5C' }
                ]}>
                  {scoreImpact}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dark overlay - fades in */}
      <Animated.View style={[modalStyles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={modalStyles.overlayPressable} onPress={onClose} />
      </Animated.View>
        
      {/* Bottom sheet content - slides up */}
      <Animated.View style={[modalStyles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Drag handle */}
          <View style={modalStyles.dragHandleContainer}>
            <View style={modalStyles.dragHandle} />
          </View>

          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerTitleContainer}>
              <Text style={modalStyles.headerTitle}>Vehicle Health</Text>
              <Text style={modalStyles.headerSubtitle}>{vehicleName} • Premium Package</Text>
            </View>
            <Pressable style={modalStyles.closeButton} onPress={onClose}>
              <X size={scale(18)} color="#666" />
            </Pressable>
          </View>

          <View style={modalStyles.headerSeparator} />

          {isEstimated ? (
            /* ── Simplified estimated view ── */
            <View style={modalStyles.scrollContent}>
              {renderRings()}

              <Text style={modalStyles.estimatedLabel}>Estimated Score</Text>
              <Text style={modalStyles.estimatedSubtitle}>
                Based on your vehicle's age, mileage, and driving habits.
              </Text>

              <Pressable
                style={({ pressed }) => [modalStyles.resumeCheckinButton, pressed && { opacity: 0.85 }]}
                onPress={() => { onClose(); setTimeout(() => onResumeCheckin?.(), 350); }}
              >
                <Text style={modalStyles.resumeCheckinText}>
                  Get my complete score
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ── Full breakdown view ── */
            <>
          <ScrollView 
            style={modalStyles.scrollView}
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {renderRings()}

            <View style={modalStyles.breakdownSection}>
              <View style={modalStyles.sectionTitleRow}>
                <Text style={modalStyles.sectionTitle}>WHAT AFFECTS YOUR SCORE</Text>
                <Pressable 
                  onPress={() => setShowInfoModal(true)}
                  hitSlop={scale(10)}
                  style={modalStyles.infoButton}
                >
                  <Info size={scale(16)} color="#888" />
                </Pressable>
              </View>
              
              {renderBreakdownRow(
                metrics[0].color,
                metrics[0].name,
                metrics[0].subtitle,
                metrics[0].percentage,
                progressService,
                metrics[0].displayValue,
                metrics[0].scoreImpact
              )}
              {renderBreakdownRow(
                metrics[1].color,
                metrics[1].name,
                metrics[1].subtitle,
                metrics[1].percentage,
                progressHealth,
                metrics[1].displayValue,
                metrics[1].scoreImpact
              )}
              {renderBreakdownRow(
                metrics[2].color,
                metrics[2].name,
                metrics[2].subtitle,
                metrics[2].percentage,
                progressMaintenance,
                metrics[2].displayValue,
                metrics[2].scoreImpact
              )}
            </View>

            {hasFactors && (
              <View style={modalStyles.factorsCard}>
                <Text style={modalStyles.factorsTitle}>Score Factors</Text>

                {factorsPositive.length > 0 && (
                  <View style={modalStyles.factorsGroup}>
                    <Text style={modalStyles.factorsGroupLabel}>What&apos;s helping</Text>
                    {factorsPositive.map((f, i) => (
                      <View key={`pos-${i}`} style={modalStyles.factorRow}>
                        <View style={[modalStyles.factorDot, { backgroundColor: '#30D158' }]} />
                        <View style={modalStyles.factorBody}>
                          <Text style={modalStyles.factorLabel}>{f.label}</Text>
                          {f.detail ? (
                            <Text style={modalStyles.factorDetail}>{f.detail}</Text>
                          ) : null}
                        </View>
                        <View style={[modalStyles.factorPill, modalStyles.factorPillPositive]}>
                          <Text style={[modalStyles.factorPillText, modalStyles.factorPillTextPositive]}>
                            +{f.pts}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {factorsNegative.length > 0 && (
                  <View style={modalStyles.factorsGroup}>
                    <Text style={modalStyles.factorsGroupLabel}>What&apos;s hurting</Text>
                    {factorsNegative.map((f, i) => (
                      <View key={`neg-${i}`} style={modalStyles.factorRow}>
                        <View style={[modalStyles.factorDot, { backgroundColor: '#FF3B5C' }]} />
                        <View style={modalStyles.factorBody}>
                          <Text style={modalStyles.factorLabel}>{f.label}</Text>
                          {f.detail ? (
                            <Text style={modalStyles.factorDetail}>{f.detail}</Text>
                          ) : null}
                        </View>
                        <View style={[modalStyles.factorPill, modalStyles.factorPillNegative]}>
                          <Text style={[modalStyles.factorPillText, modalStyles.factorPillTextNegative]}>
                            −{f.pts}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={{ height: scale(20) }} />
          </ScrollView>
            </>
          )}
        </Animated.View>

        {/* Info Modal - Explains the formula */}
        <Modal
          visible={showInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInfoModal(false)}
        >
          <Pressable 
            style={modalStyles.infoModalOverlay} 
            onPress={() => setShowInfoModal(false)}
          >
            <View style={modalStyles.infoModalContent}>
              <View style={modalStyles.infoModalHeader}>
                <Text style={modalStyles.infoModalTitle}>How We Calculate Your Score</Text>
                <Pressable onPress={() => setShowInfoModal(false)}>
                  <X size={scale(20)} color="#666" />
                </Pressable>
              </View>
              
              <View style={modalStyles.infoModalBody}>
                <Text style={modalStyles.infoFormulaTitle}>Formula:</Text>
                <View style={modalStyles.formulaBox}>
                  <Text style={modalStyles.formulaText}>
                    Overall = (Maintenance × 70%) + (Usage × 30%)
                  </Text>
                </View>
                
                <View style={modalStyles.infoSection}>
                  <Text style={modalStyles.infoLabel}>Maintenance (70% weight)</Text>
                  <Text style={modalStyles.infoDescription}>
                    Based on services completed out of total scheduled. Example: 7/10 = 70%
                  </Text>
                </View>
                
                <View style={modalStyles.infoSection}>
                  <Text style={modalStyles.infoLabel}>Usage & Wear (30% weight)</Text>
                  <Text style={modalStyles.infoDescription}>
                    Based on mileage:{'\n'}
                    • 0-30k mi = 100%{'\n'}
                    • 30k-60k mi = 90%{'\n'}
                    • 60k-100k mi = 75%{'\n'}
                    • 100k-150k mi = 55%{'\n'}
                    • 150k+ mi = 35%
                  </Text>
                </View>
                
                <View style={modalStyles.infoExample}>
                  <Text style={modalStyles.infoExampleTitle}>Example:</Text>
                  <Text style={modalStyles.infoExampleText}>
                    7/10 maintenance (70%) × 0.7 = 49%{'\n'}
                    45k miles (90%) × 0.3 = 27%{'\n'}
                    <Text style={{ fontFamily: 'Urbanist-Bold', color: '#30D158' }}>
                      Total: 76%
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Modal>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayPressable: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: scale(12),
    paddingBottom: scale(8),
  },
  dragHandle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 2,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: {
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(24),
    paddingTop: scale(20),
    paddingBottom: scale(16),
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: scale(2),
  },
  closeButton: {
    position: 'absolute',
    right: scale(20),
    top: scale(20),
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: scale(24),
  },
  ringsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: scale(20),
    position: 'relative',
    width: Math.min(scale(200), 260),
    height: Math.min(scale(200), 260),
  },
  ringGlow: {
    position: 'absolute',
    width: Math.min(scale(220), 280),
    height: Math.min(scale(220), 280),
    borderRadius: Math.min(scale(220), 280) / 2,
  },
  ringGlowInner: {
    position: 'absolute',
    width: Math.min(scale(170), 220),
    height: Math.min(scale(170), 220),
    borderRadius: Math.min(scale(170), 220) / 2,
  },
  ringCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: moderateScale(42),
    fontFamily: 'Urbanist-Bold',
    color: '#1F2937',
    lineHeight: moderateScale(46),
  },
  ringSubLabel: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#9CA3AF',
    marginTop: scale(-2),
  },
  breakdownSection: {
    marginTop: scale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#888',
    letterSpacing: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(16),
  },
  infoButton: {
    padding: scale(4),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  colorDot: {
    width: scale(12),
    height: scale(12),
    borderRadius: moderateScale(6),
    marginRight: scale(12),
    marginTop: scale(4),
  },
  breakdownTextContainer: {
    flex: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  breakdownName: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  breakdownSubtitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-Regular',
    color: '#888',
    marginBottom: scale(8),
    lineHeight: moderateScale(16),
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  progressBarContainer: {
    height: scale(6),
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    flex: 1,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownPercentage: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  scoreImpactBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: moderateScale(6),
  },
  scoreImpactText: {
    fontSize: moderateScale(11),
    fontFamily: 'Urbanist-Bold',
  },
  factorsCard: {
    marginTop: scale(24),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  factorsTitle: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
    marginBottom: scale(12),
  },
  factorsGroup: {
    marginTop: scale(8),
  },
  factorsGroupLabel: {
    fontSize: moderateScale(11),
    fontFamily: 'Urbanist-Bold',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: scale(8),
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    gap: scale(12),
  },
  factorDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  factorBody: {
    flex: 1,
  },
  factorLabel: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Medium',
    color: '#1a1a1a',
  },
  factorDetail: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: scale(2),
  },
  factorPill: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: moderateScale(10),
    minWidth: scale(44),
    alignItems: 'center',
  },
  factorPillPositive: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  factorPillNegative: {
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
  },
  factorPillText: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Bold',
  },
  factorPillTextPositive: {
    color: '#30D158',
  },
  factorPillTextNegative: {
    color: '#FF3B5C',
  },
  estimatedLabel: {
    fontSize: moderateScale(13),
    fontFamily: 'Urbanist-SemiBold',
    color: '#9CA3AF',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: scale(-4),
  },
  estimatedSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: moderateScale(20),
    marginTop: scale(8),
    paddingHorizontal: scale(8),
  },
  resumeCheckinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: '#5299FE',
    borderRadius: moderateScale(25),
    paddingVertical: scale(16),
    paddingHorizontal: scale(24),
    marginTop: scale(24),
    width: '100%',
  },
  resumeCheckinText: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  // Info Modal Styles
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  infoModalContent: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(20),
    width: '100%',
    maxWidth: scale(340),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  infoModalTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Urbanist-Bold',
    color: '#1a1a1a',
  },
  infoModalBody: {
    padding: scale(20),
  },
  infoFormulaTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: scale(8),
  },
  formulaBox: {
    backgroundColor: 'rgba(82, 153, 254, 0.1)',
    borderRadius: moderateScale(12),
    padding: scale(16),
    marginBottom: scale(20),
  },
  formulaText: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-Bold',
    color: '#5299FE',
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: scale(16),
  },
  infoLabel: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
    marginBottom: scale(4),
  },
  infoDescription: {
    fontSize: moderateScale(13),
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: moderateScale(20),
  },
  infoExample: {
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    borderRadius: moderateScale(12),
    padding: scale(16),
    marginTop: scale(8),
  },
  infoExampleTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#30D158',
    marginBottom: scale(8),
  },
  infoExampleText: {
    fontSize: moderateScale(13),
    fontFamily: 'Urbanist-Medium',
    color: '#1a1a1a',
    lineHeight: moderateScale(22),
  },
});

// ============================================================================
// APPLE ACTIVITY RINGS COMPONENT
// ============================================================================

interface ActivityRingsProps {
  healthPercentage: number;
  maintenancePercentage?: number;
  servicePercentage?: number;
  size?: number;
  onPress?: () => void;
  /** Flip the centered percentage to white when the page bg is dark
   *  enough that the default dark navy is unreadable. */
  isDarkBg?: boolean;
}

const ActivityRings = ({
  healthPercentage,
  size = scale(72),
  onPress,
  isDarkBg = false,
}: ActivityRingsProps) => {
  const [animatedHealth, setAnimatedHealth] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = 1 - Math.pow(1 - currentStep / steps, 3);
      setAnimatedHealth(progress * healthPercentage);

      if (currentStep >= steps) clearInterval(interval);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [healthPercentage]);

  const strokeWidth = scale(8);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedHealth / 100);
  const center = size / 2;

  // Color based on health percentage
  const getColor = () => {
    if (healthPercentage >= 75) return '#30D158'; // Green
    if (healthPercentage >= 60) return '#FFEA00'; // Yellow
    return '#FF3B30'; // Red
  };
  const ringColor = getColor();

  const content = (
    <View style={{ position: 'relative' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={ringColor} />
            <Stop offset="50%" stopColor={ringColor} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={ringColor} stopOpacity={0.8} />
          </SvgLinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.15}
        />
        {/* Progress ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
        {/* Glow effect */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth + 4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
          opacity={0.2}
        />
      </Svg>
      {/* Centered percentage */}
      <View style={activityRingStyles.centerContainer}>
        <Text style={[activityRingStyles.percentageText, { color: isDarkBg ? '#FFFFFF' : '#1F2937' }]}>
          {Math.round(animatedHealth)}%
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};

const activityRingStyles = StyleSheet.create({
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: moderateScale(16),
    fontFamily: 'Urbanist-Bold',
  },
});

// ============================================================================
// 3D CAROUSEL ITEM COMPONENT
// ============================================================================

interface CarouselItemProps {
  item: Vehicle;
  index: number;
  rotation: SharedValue<number>;
  totalItems: number;
}

const CircularCarouselItem = memo(({ item, index, rotation, totalItems }: CarouselItemProps) => {
  const [hasImageError, setHasImageError] = useState(false);
  const imageSource = hasImageError ? FALLBACK_VEHICLE_IMAGE : (item.imageSource || FALLBACK_VEHICLE_IMAGE);

  const animatedStyle = useAnimatedStyle(() => {
    const anglePerItem = (2 * Math.PI) / totalItems;
    const baseAngle = index * anglePerItem;
    // `rotation` is set as `-activeIndex * anglePerItem` elsewhere in this file
    // (see the useEffect re-center and rotateToIndex). For the active item's
    // `currentAngle` to land at 0 (front), we need `baseAngle + rotation`, not
    // minus. With 2 items the two forms are equivalent mod 2π, which is why
    // the original `-` worked in testing; at 3+ items, the wrong item was
    // rendered at the front — see the fallback-Lexus-as-hero regression.
    const currentAngle = baseAngle + rotation.value;

    // Calculate position on a wider arc (not full circle). When there
    // are 4+ vehicles the per-item angle gets small enough that
    // neighbors overlap the active car visually — push them out
    // proportionally so they read as distinct silhouettes.
    const xMultiplier = 1.2 + Math.max(0, totalItems - 3) * 0.2;
    const x = Math.sin(currentAngle) * RADIUS * xMultiplier;
    const z = Math.cos(currentAngle) * RADIUS - RADIUS;

    // Scale based on Z position - front car is full size
    const scale = interpolate(
      z,
      [-RADIUS * 2, -RADIUS, 0],
      [0.5, 0.65, 1],
      Extrapolate.CLAMP
    );

    // Opacity - hide cars further back more aggressively
    const opacity = interpolate(
      z,
      [-RADIUS * 2, -RADIUS * 1.2, -RADIUS * 0.5, 0],
      [0, 0.15, 0.4, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: x },
        { scale },
      ],
      opacity,
      zIndex: Math.round(z + 1000),
    };
  });

  return (
    <ReAnimated.View style={[styles.carouselCard, animatedStyle]}>
      {/* Logo - Absolutely positioned behind car */}
      {item.logoSource && (
        <View style={[
          styles.logoContainer,
          item.make === 'Lamborghini' ? styles.logoContainerLambo : styles.logoContainerLexus
        ]}>
          <Image
            source={item.logoSource}
            style={[
              styles.carouselLogo,
              item.make === 'Lamborghini' ? styles.carouselLogoLambo : styles.carouselLogoLexus
            ]}
            resizeMode="contain"
          />
        </View>
      )}
      
      {/* Car Image */}
      <Image
        source={imageSource}
        style={[
          styles.carouselCarImage,
          item.make === 'Lexus' && styles.carouselCarImageLexus,
          item.make === 'Lamborghini' && styles.carouselCarImageLambo,
        ]}
        resizeMode="contain"
        onError={() => setHasImageError(true)}
      />
      
      {/* Reflection removed — car images have white backgrounds */}
    </ReAnimated.View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CarCarousel({
  vehicles,
  onEditMileage,
  onToggleDefault,
  onActiveIndexChange,
  isFocused,
  maintenanceItems,
  currentMileage,
  showHealthRing = true,
  healthScore: parentHealthScore,
  isEstimatedScore,
  onResumeCheckin,
  isDarkBg = false,
  groundLineTint,
  groundLineTintTransparent,
  groundShadowTintRgb,
  hideGroundShadow = false,
  knownIssues,
  hpBuffer,
}: CarCarouselProps) {
  "use no memo";
  // ↑ Opt this file out of React Compiler. The compiler was freezing
  //   ref objects (`prevStoreVinRef`, `prevActiveIndexRef`,
  //   `activeVehicleIdRef`) and refusing assignments to `.current`,
  //   causing "set the key `current` with undefined on a frozen
  //   object" runtime errors on every render. The carousel has its
  //   own carefully-tuned memoization already; auto-memoization
  //   isn't safe here.

  // Trust parent ordering to keep indices consistent across screens.
  const sortedVehicles = useMemo(() => vehicles, [vehicles]);

  const [activeIndex, setActiveIndex] = useState(0);
  const rotation = useSharedValue(0);
  const anglePerItem = sortedVehicles.length > 0 ? (2 * Math.PI) / sortedVehicles.length : 0;

  // Thumbnail-rail segment width adapts to vehicle count so the rail
  // doesn't push the health ring off-screen. Floor of scale(40) keeps
  // the thumbnail image readable; cap of SEGMENT_WIDTH (scale 56) is
  // the natural size when there's room.
  const segmentWidth = Math.max(
    scale(40),
    Math.min(SEGMENT_WIDTH, Math.floor((SCREEN_WIDTH - scale(180)) / Math.max(1, sortedVehicles.length))),
  );
  const thumbnailSize = Math.min(scale(36), segmentWidth - scale(8));

  // Past this threshold the thumbnail strip can't physically fit a
  // legible image AND the health ring on the same row. In compact
  // mode we show 3 thumbnails centered on the active car (with
  // wraparound) plus an "+N ⌄" overflow pill that opens the full
  // CarSelectionContent sheet.
  const COMPACT_SELECTOR_THRESHOLD = 5;
  const useCompactSelector = sortedVehicles.length >= COMPACT_SELECTOR_THRESHOLD;
  const [showCarSheet, setShowCarSheet] = useState(false);
  const carSheetRef = useRef<FloatingSheetRef>(null);
  useEffect(() => {
    if (showCarSheet) carSheetRef.current?.open();
  }, [showCarSheet]);

  // The 3 vehicle indices visible in compact mode are FIXED — always
  // the first three cars in `sortedVehicles`. They never reshuffle
  // as the user swipes. The active-car highlight on the segmented
  // control follows `activeIndex` when it's one of the visible three;
  // for cars 4+ the strip stays unhighlighted and the dropdown pill
  // (which shows the current car's name) is the active-state cue.
  const compactVisibleIndices = useMemo(() => {
    const total = sortedVehicles.length;
    const count = Math.min(3, total);
    return Array.from({ length: count }, (_, i) => i);
  }, [sortedVehicles.length]);

  // Relative position of the active car within the visible 3, or -1
  // if the active car is car #4 or later (and therefore not on the
  // strip).
  const compactRelativeActive = compactVisibleIndices.indexOf(activeIndex);
  const lastUpdatedIndex = useSharedValue(0);
  const isUserAnimating = useRef(false);

  // Remember the active vehicle's id (VIN) so list reorders — adding a car,
  // removing one, or a resort — don't scramble the selection. Updated ONLY
  // when activeIndex changes (intentional dep omission below) so the next
  // re-anchor pass can look up the previously-selected id.
  const activeVehicleIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const current = sortedVehicles[activeIndex];
    if (current) activeVehicleIdRef.current = current.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // When the vehicle list changes (reorder / add / remove), map the remembered
  // id back to its new index. Keeps title, hero rotation, and thumbnail
  // underline in sync.
  useEffect(() => {
    if (sortedVehicles.length === 0 || !activeVehicleIdRef.current) return;
    const newIdx = sortedVehicles.findIndex((v) => v.id === activeVehicleIdRef.current);
    if (newIdx < 0) {
      // Active vehicle was removed — fall back to first.
      setActiveIndex(0);
      onActiveIndexChange?.(0);
      return;
    }
    // Notify the parent OUTSIDE of the setState updater. React 18
    // treats updater-function bodies as part of the render phase,
    // so calling `onActiveIndexChange` (a parent setState) inside
    // the updater warns "Cannot update a component while rendering
    // a different component."
    if (newIdx !== activeIndex) {
      setActiveIndex(newIdx);
      onActiveIndexChange?.(newIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedVehicles, onActiveIndexChange]);

  // Bottom sheet state
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<'main' | 'modelYear' | 'mileage' | 'nextService'>('main');
  const [editMileage, setEditMileage] = useState('');
  const [editYear, setEditYear] = useState('');

  // Vehicle Health Modal state
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Bottom sheet animation values
  const sheetTranslateY = useRef(new Animated.Value(scale(300))).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(new Animated.Value(scale(280))).current;

  const SHEET_HEIGHTS = {
    main: scale(280),
    modelYear: scale(200),
    mileage: scale(200),
    nextService: scale(320),
  };

  const activeVehicle = sortedVehicles[activeIndex];

  // Ground-line tire offset, per body style. The car image is
  // bottom-aligned in the carousel card with `resizeMode: contain`,
  // but body styles sit differently in the frame — trucks/SUVs are
  // tall (tires higher up the image) while sedans/coupes are flat
  // (tires close to the bottom edge). These offsets are relative to
  // the bottom of the carousel hero container; bigger value = line
  // moves up.
  // Combined body-style signal: prefer the Convex-sourced `bodyStyle`
  // when present, fall back to a model-keyword heuristic so cars
  // without populated metadata still get a per-shape shadow/line. The
  // heuristic covers popular makes/models seen in test data; unknown
  // models fall through to the default case.
  const effectiveBodyStyle = useMemo(() => {
    const explicit = (activeVehicle?.bodyStyle ?? "").toLowerCase().trim();
    if (explicit) return explicit;
    return inferBodyStyleFromModel(activeVehicle?.make, activeVehicle?.model);
  }, [activeVehicle?.bodyStyle, activeVehicle?.make, activeVehicle?.model]);

  // Single stable vertical anchor for the ground line + shadow. The
  // car PNG renders are all built with their tires near the bottom of
  // the image bounding box, so per-body-style offsets only added
  // jitter (coupes ended up too low, SUVs too high). One value keeps
  // the horizon consistent across vehicles. Tune this number alone if
  // the line drifts in either direction.
  const groundLineBottom = 75;

  // Per-body-style ground-shadow footprint + vertical offset. SUVs
  // (Lincoln MKX) were the "perfect" reference; coupes/sedans have
  // tires sitting higher in their PNG frames so the shadow needs to
  // rise to keep landing at the tire contact point. Width/height
  // track body proportions too. `effectiveBodyStyle` uses the
  // inferred body style when Convex metadata is missing.
  const groundShadowSize = useMemo(() => {
    const style = effectiveBodyStyle;
    if (/truck|pickup/.test(style)) return { widthFactor: 0.92, height: 26, offsetY: -44 };
    if (/suv|crossover|wagon|van/.test(style)) return { widthFactor: 0.88, height: 24, offsetY: -40 };
    if (/convertible|roadster/.test(style)) return { widthFactor: 0.74, height: 18, offsetY: -26 };
    if (/coupe/.test(style)) return { widthFactor: 0.78, height: 20, offsetY: -28 };
    if (/sedan|hatchback|saloon/.test(style)) return { widthFactor: 0.84, height: 22, offsetY: -32 };
    return { widthFactor: 0.85, height: 22, offsetY: -34 };
  }, [effectiveBodyStyle]);

  useEffect(() => {
    if (sortedVehicles.length === 0) {
      setActiveIndex(0);
      rotation.value = 0;
      lastUpdatedIndex.value = 0;
      return;
    }
    const nextIndex = Math.min(activeIndex, sortedVehicles.length - 1);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
      onActiveIndexChange?.(nextIndex);
    }
    if (!isUserAnimating.current) {
      rotation.value = -nextIndex * anglePerItem;
    }
    lastUpdatedIndex.value = nextIndex;
  }, [sortedVehicles.length, activeIndex, anglePerItem, onActiveIndexChange, rotation, lastUpdatedIndex]);

  // Use the unified health score from the parent (computed by utils/healthScore.ts)
  const overallCondition = parentHealthScore ?? 0;

  // Sub-scores for the detail modal rings (maintenance = % of known items on_time, usage = mileage curve)
  const knownItems = (maintenanceItems ?? []).filter((i) => i.status !== "unknown");
  const onTimeItems = knownItems.filter((i) => i.status === "on_time");
  const maintenanceTotal = Math.max(knownItems.length, 1);
  const maintenanceCompleted = onTimeItems.length;
  const maintenanceScoreForRing = knownItems.length > 0
    ? Math.round((maintenanceCompleted / maintenanceTotal) * 100)
    : overallCondition; // no known items → match overall so it doesn't look broken

  const vehicleMileage = currentMileage ?? activeVehicle?.mileage ?? 0;
  const getMileageScoreForRing = (miles: number) => {
    if (miles <= 30000) return 100;
    if (miles <= 60000) return 90;
    if (miles <= 100000) return 75;
    if (miles <= 150000) return 55;
    return 35;
  };
  const usageScoreForRing = getMileageScoreForRing(vehicleMileage);

  const setAnimatingTrue = useCallback(() => { isUserAnimating.current = true; }, []);
  const finishAnimation = useCallback((newIndex: number) => {
    isUserAnimating.current = false;
    setActiveIndex(newIndex);
    onActiveIndexChange?.(newIndex);
  }, [onActiveIndexChange]);

  const SETTLE_EASING = REasing.bezier(0.16, 1, 0.3, 1);

  // Pan gesture for rotating carousel
  const lastTranslationX = useSharedValue(0);
  // 0 when the carousel is at rest, 1 while the user is panning.
  // Drives a fade on the ground line + shadow so they hide as cars
  // swipe across them — at rest we re-show under the active car.
  const panActive = useSharedValue(0);

  const groundFadeStyle = useAnimatedStyle(() => ({
    opacity: 1 - panActive.value,
  }));

  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslationX.value = 0;
      panActive.value = withTiming(1, { duration: 100 });
    })
    .onUpdate((e) => {
      const delta = e.translationX - lastTranslationX.value;
      // Signs flipped alongside CircularCarouselItem's `baseAngle + rotation`
      // change so the content follows the finger naturally (drag right → the
      // left-back neighbor comes to front).
      rotation.value += delta * 0.008;
      lastTranslationX.value = e.translationX;

      const currentRotationInSteps = Math.round(rotation.value / anglePerItem);
      const currentClosestIndex = (((-currentRotationInSteps % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
      lastUpdatedIndex.value = currentClosestIndex;
    })
    .onEnd((e) => {
      const velocity = e.velocityX * 0.0005;
      const targetRotation = rotation.value + velocity;
      const nearestIndex = Math.round(targetRotation / anglePerItem);
      const snappedRotation = nearestIndex * anglePerItem;

      const normalizedIndex = (((-nearestIndex % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
      lastUpdatedIndex.value = normalizedIndex;
      runOnJS(setAnimatingTrue)();

      // Notify the parent of the new active index IMMEDIATELY on
      // swipe end (rather than waiting for the rotation to settle)
      // so the cars-page background crossfade starts in parallel with
      // the rotation animation. Cuts the ~350ms "nothing's happening"
      // gap before the bg actually begins changing.
      runOnJS(finishAnimation)(normalizedIndex);

      rotation.value = withTiming(snappedRotation, {
        duration: 350,
        easing: SETTLE_EASING,
      }, (finished) => {
        'worklet';
        if (finished) {
          // Fade the ground line + shadow back in under the now-active
          // car after the settle completes, so they appear with the
          // car instead of mid-swipe.
          panActive.value = withTiming(0, { duration: 180 });
        }
      });
    });

  // Rotate to specific index
  const rotateToIndex = useCallback((targetIndex: number) => {
    lastUpdatedIndex.value = targetIndex;
    isUserAnimating.current = true;
    
    const currentRotationInSteps = Math.round(rotation.value / anglePerItem);
    const currentIndex = (((-currentRotationInSteps % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
    
    let indexDiff = targetIndex - currentIndex;
    
    if (indexDiff > sortedVehicles.length / 2) {
      indexDiff -= sortedVehicles.length;
    } else if (indexDiff < -sortedVehicles.length / 2) {
      indexDiff += sortedVehicles.length;
    }

    const targetRotation = rotation.value - (indexDiff * anglePerItem);
    
    rotation.value = withTiming(targetRotation, {
      duration: 400,
      easing: SETTLE_EASING,
    }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(finishAnimation)(targetIndex);
      }
    });
    
    if (showBottomSheet) {
      closeBottomSheet();
    }
  }, [anglePerItem, sortedVehicles.length, showBottomSheet, finishAnimation, SETTLE_EASING]);

  // Two-way bridge between carousel and `useVehicleStore`.
  //
  // Effect A (store → carousel): on bottom-sheet pick. Guarded by
  // `prevStoreVinRef` so spurious dep-ref changes (sortedVehicles /
  // rotateToIndex re-deriving on parent re-renders) don't trigger
  // a rotation — only an actual VALUE change of `storeSelectedVin`
  // does anything. Blocks the rubber-band loop we hit before.
  //
  // Effect B (carousel → store): on swipe / compact-thumb tap.
  // Mirrors the active VIN onto the store so the "Select Vehicle"
  // sheet's row checkmark and other subscribers reflect what's
  // actually active. Loop-safe because Effect A's prev-value guard
  // ignores writes that don't change the value.
  const storeSelectedVin = useVehicleStore((s) => s.selectedVehicleId);
  const selectVehicleInStore = useVehicleStore((s) => s.selectVehicle);
  const prevStoreVinRef = useRef<string | null>(storeSelectedVin);
  const prevActiveIndexRef = useRef<number>(activeIndex);

  // Effect A — only acts on actual storeSelectedVin VALUE change.
  useEffect(() => {
    if (storeSelectedVin === prevStoreVinRef.current) return;
    prevStoreVinRef.current = storeSelectedVin;
    if (!storeSelectedVin) return;
    const target = storeSelectedVin.toUpperCase().trim();
    const idx = sortedVehicles.findIndex(
      (v) => v.id.toUpperCase().trim() === target,
    );
    if (idx >= 0 && idx !== activeIndex) {
      rotateToIndex(idx);
      carSheetRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSelectedVin, sortedVehicles, rotateToIndex]);

  // Effect B — only acts on actual activeIndex VALUE change. Without
  // this guard, sortedVehicles re-deriving (parent re-render from a
  // Convex push, image URL load, new car added, etc.) would fire
  // Effect B even when the user didn't switch cars, which combined
  // with Effect A creates a maximum-update-depth loop.
  useEffect(() => {
    if (activeIndex === prevActiveIndexRef.current) return;
    prevActiveIndexRef.current = activeIndex;
    const v = sortedVehicles[activeIndex];
    if (!v) return;
    const normalized = v.id.toUpperCase().trim();
    if (normalized !== storeSelectedVin) {
      selectVehicleInStore(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, sortedVehicles, selectVehicleInStore]);

  // Bottom sheet functions
  const openBottomSheet = () => {
    setShowBottomSheet(true);
    sheetTranslateY.setValue(scale(300));
    backdropOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeBottomSheet = () => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: scale(300),
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowBottomSheet(false);
      setSheetMode('main');
      sheetHeight.setValue(SHEET_HEIGHTS.main);
    });
  };

  const detailItems = [
    { label: 'Model Year', value: String(activeVehicle?.year || ''), mode: 'modelYear' as const },
    { label: 'Mileage', value: `${Math.ceil(activeVehicle?.mileage || 0).toLocaleString()} mi`, mode: 'mileage' as const },
    { label: 'Next Service', value: activeVehicle?.nextServiceDate || 'Not Set', mode: 'nextService' as const },
  ];

  const handleDetailPress = (mode: 'modelYear' | 'mileage' | 'nextService') => {
    if (mode === 'mileage') {
      setEditMileage(String(activeVehicle?.mileage || ''));
    } else if (mode === 'modelYear') {
      setEditYear(String(activeVehicle?.year || ''));
    }
    setSheetMode(mode);
    
    Animated.spring(sheetHeight, {
      toValue: SHEET_HEIGHTS[mode],
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  const handleBackToMain = () => {
    setSheetMode('main');
    
    Animated.spring(sheetHeight, {
      toValue: SHEET_HEIGHTS.main,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* 3D Circular Carousel */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.carouselContainer}>
          {/* Shadow + line are wrapped in a faded ReAnimated.View so
              they disappear while the user is swiping between cars
              (cars passing over a stationary shadow looks broken)
              and reappear once the carousel settles on a new active
              car. Driven by `panActive` (0 → 1 on swipe). */}
          <ReAnimated.View
            style={[StyleSheet.absoluteFill, groundFadeStyle]}
            pointerEvents="none"
          >
            {/* Ground shadow temporarily disabled — re-enable by
                uncommenting the block below. */}
            {/* {hideGroundShadow ? null : (
              <CarGroundShadow
                width={CAR_CARD_WIDTH * groundShadowSize.widthFactor}
                height={groundShadowSize.height}
                bottom={groundLineBottom}
                offsetY={groundShadowSize.offsetY}
                offsetX={0}
                centerOpacity={0.85}
                tintRgb="0, 0, 0"
              />
            )} */}
            <GroundLine
              width={SCREEN_WIDTH}
              bottomOffset={groundLineBottom}
              tint={groundLineTint}
              tintTransparent={groundLineTintTransparent}
              height={StyleSheet.hairlineWidth}
            />
          </ReAnimated.View>

          {sortedVehicles.map((item, index) => (
            <CircularCarouselItem
              key={item.id}
              item={item}
              index={index}
              rotation={rotation}
              totalItems={sortedVehicles.length}
            />
          ))}
        </View>
      </GestureDetector>

      {/* Active Car Info */}
      <View style={styles.activeCarInfo}>
        <Text style={[
          styles.heroCarName,
          isDarkBg && styles.heroCarNameLight,
        ]}>{activeVehicle?.make} {activeVehicle?.model}</Text>
        <Text style={[
          styles.heroCarMeta,
          isDarkBg && styles.heroCarMetaLight,
        ]}>
          {Math.ceil(activeVehicle?.mileage || 0).toLocaleString()} mi  |  {activeVehicle?.year}
        </Text>
      </View>


      {/* Thumbnail Selector with Activity Rings.
          The car-selector rail is a native iOS SegmentedControl,
          which on iOS 26+ gets the real liquid-glass treatment for
          free from the OS — same mechanism as the bookings tab
          switcher. SegmentedControl only supports text segments, so
          we feed it blank (space) labels for layout/hit-testing and
          overlay the car thumbnails on top with `pointerEvents="none"`
          so taps fall through to the rail. */}
      <View style={styles.thumbnailRow}>
        <View style={styles.thumbnailLeftGroup}>
          {useCompactSelector ? (
            // Compact mode (5+ cars): same liquid-glass SegmentedControl
            // as the full strip, but only 3 segments at a time
            // (prev / active / next, with wraparound). A pill to the
            // right shows the active car's name + chevron and opens
            // CarSelectionContent for the rest of the garage.
            <>
              <View style={[styles.thumbnailSelector, { width: COMPACT_SEGMENT_WIDTH * 3 }]}>
                <SegmentedControl
                  values={[' ', ' ', ' ']}
                  selectedIndex={compactRelativeActive >= 0 ? compactRelativeActive : -1}
                  appearance="light"
                  tintColor={isDarkBg ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.55)"}
                  onChange={(e) => {
                    const relIdx = e.nativeEvent.selectedSegmentIndex;
                    const absIdx = compactVisibleIndices[relIdx];
                    if (absIdx !== undefined && absIdx !== activeIndex) {
                      rotateToIndex(absIdx);
                    }
                  }}
                  style={[styles.segmentedRail, { width: COMPACT_SEGMENT_WIDTH * 3 }]}
                />
                {compactVisibleIndices.map((idx, relIdx) => {
                  const vehicle = sortedVehicles[idx];
                  const imageSource = vehicle.imageSource || FALLBACK_VEHICLE_IMAGE;
                  return (
                    <Image
                      key={vehicle.id}
                      source={imageSource}
                      style={[
                        styles.thumbnailOverlay,
                        {
                          width: COMPACT_THUMB_SIZE,
                          height: COMPACT_THUMB_SIZE,
                          top: (scale(48) - COMPACT_THUMB_SIZE) / 2,
                          left: relIdx * COMPACT_SEGMENT_WIDTH + (COMPACT_SEGMENT_WIDTH - COMPACT_THUMB_SIZE) / 2,
                        },
                      ]}
                      resizeMode="contain"
                      pointerEvents="none"
                    />
                  );
                })}
              </View>
              <Pressable
                style={styles.overflowPill}
                onPress={() => setShowCarSheet(true)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text weight="semiBold" size="sm" color={BrandColors.primary} numberOfLines={1}>
                  {activeVehicle?.model}
                </Text>
                <ChevronDown size={14} color={BrandColors.primary} />
              </Pressable>
            </>
          ) : (
            <View style={[styles.thumbnailSelector, { width: segmentWidth * sortedVehicles.length }]}>
              <SegmentedControl
                values={sortedVehicles.map(() => ' ')}
                selectedIndex={activeIndex}
                appearance="light"
                // Translucent indicator so the active segment reads as
                // frosted glass over whatever paint gradient is behind it
                // — a stark opaque white pill clashed on saturated bgs
                // like the green Tiguan.
                tintColor={isDarkBg ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.55)"}
                onChange={(e) => rotateToIndex(e.nativeEvent.selectedSegmentIndex)}
                style={[styles.segmentedRail, { width: segmentWidth * sortedVehicles.length }]}
              />
              {sortedVehicles.map((vehicle, index) => {
                const imageSource = vehicle.imageSource || FALLBACK_VEHICLE_IMAGE;
                return (
                  <Image
                    key={vehicle.id}
                    source={imageSource}
                    style={[
                      styles.thumbnailOverlay,
                      {
                        width: thumbnailSize,
                        height: thumbnailSize,
                        top: (scale(48) - thumbnailSize) / 2,
                        left: index * segmentWidth + (segmentWidth - thumbnailSize) / 2,
                      },
                    ]}
                    resizeMode="contain"
                    pointerEvents="none"
                  />
                );
              })}
            </View>
          )}

          <Pressable style={styles.addCarButton} onPress={() => router.push('/add-vehicle')}>
            <Plus size={scale(18)} color="#000000" />
          </Pressable>
        </View>

        {/* Activity Rings - Vehicle Condition (hidden until onboarding is complete) */}
        {showHealthRing && (
          <ActivityRings
            healthPercentage={overallCondition}
            maintenancePercentage={maintenanceScoreForRing}
            servicePercentage={usageScoreForRing}
            size={scale(72)}
            onPress={() => setShowHealthModal(true)}
            isDarkBg={isDarkBg}
          />
        )}
      </View>

      {/* Separator — only in strip mode (the underline is positioned
          to track the segmented control's active segment). */}
      {!useCompactSelector && (
        <View style={[
          styles.separatorContainer,
          { width: (sortedVehicles.length * scale(48)) + ((sortedVehicles.length - 1) * Spacing.sm) }
        ]}>
          <View style={styles.separator} />
          <View
            style={[
              styles.separatorIndicator,
              { left: activeIndex * (scale(48) + Spacing.sm) }
            ]}
          />
        </View>
      )}

      {/* Bottom Sheet Modal */}
      <Modal
        visible={showBottomSheet}
        transparent
        animationType="none"
        onRequestClose={closeBottomSheet}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={scale(40)}
        >
          <Animated.View 
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeBottomSheet} />
          </Animated.View>

          <Animated.View 
            style={[
              styles.bottomSheet,
              { 
                transform: [{ translateY: sheetTranslateY }],
                height: sheetHeight,
              }
            ]}
          >
            {sheetMode !== 'main' && (
              <Pressable style={styles.backButton} onPress={handleBackToMain}>
                <ChevronLeft size={scale(24)} color="#6B7280" />
              </Pressable>
            )}

            <Pressable style={styles.closeButton} onPress={closeBottomSheet}>
              <X size={scale(24)} color="#6B7280" />
            </Pressable>

            {/* Main View */}
            {sheetMode === 'main' && (
              <View style={styles.sheetContent}>
                <Image
                  source={
                    activeVehicle?.make === 'Lamborghini'
                      ? require('@/assets/images/LamboLogo.png')
                      : require('@/assets/images/LexusLogo.png')
                  }
                  style={styles.sheetLogo}
                  resizeMode="contain"
                />

                <View style={styles.detailsGrid}>
                  {detailItems.map((detailItem) => (
                    <Pressable 
                      key={detailItem.label} 
                      style={({ pressed }) => [
                        styles.sheetDetailItem,
                        pressed && styles.detailItemPressed,
                      ]}
                      onPress={() => handleDetailPress(detailItem.mode)}
                    >
                      <Text size="xs" color="#6B7280" style={styles.detailLabel}>
                        {detailItem.label}
                      </Text>
                      <View style={styles.valueRow}>
                        <Text weight="bold" size="lg" color={Colors.light.text}>
                          {detailItem.value}
                        </Text>
                        <ChevronRight size={scale(18)} color="#9CA3AF" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Model Year Edit */}
            {sheetMode === 'modelYear' && (
              <View style={styles.sheetContent}>
                <Text weight="bold" size="xl" color={Colors.light.text} style={styles.sheetTitle}>
                  Edit Model Year
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editYear}
                  onChangeText={setEditYear}
                  keyboardType="number-pad"
                  placeholder="Enter year"
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable 
                  style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
                  onPress={handleBackToMain}
                >
                  <Text weight="semiBold" size="md" color="#FFFFFF">Save Changes</Text>
                </Pressable>
              </View>
            )}

            {/* Mileage Edit */}
            {sheetMode === 'mileage' && (
              <View style={styles.sheetContent}>
                <Text weight="bold" size="xl" color={Colors.light.text} style={styles.sheetTitle}>
                  Update Mileage
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editMileage}
                  onChangeText={setEditMileage}
                  keyboardType="number-pad"
                  placeholder="Enter mileage"
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable 
                  style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
                  onPress={() => {
                    if (activeVehicle && onEditMileage) {
                      onEditMileage(activeVehicle.id);
                    }
                    handleBackToMain();
                  }}
                >
                  <Text weight="semiBold" size="md" color="#FFFFFF">Save Changes</Text>
                </Pressable>
              </View>
            )}

            {/* Next Service Options */}
            {sheetMode === 'nextService' && (
              <View style={styles.sheetContent}>
                <Text weight="bold" size="xl" color={Colors.light.text} style={styles.sheetTitle}>
                  Service Options
                </Text>
                <View style={styles.serviceOptions}>
                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#EBF5FF' }]}>
                      <Calendar size={scale(20)} color={BrandColors.secondary} />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Reschedule</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                      <XCircle size={scale(20)} color="#EF4444" />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Cancel</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Check size={scale(20)} color="#10B981" />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Mark as Done</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vehicle Health Modal */}
      <VehicleHealthModal
        visible={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        vehicleName={activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : 'Vehicle'}
        healthPercentage={overallCondition}
        maintenancePercentage={maintenanceScoreForRing}
        servicePercentage={usageScoreForRing}
        maintenanceItems={maintenanceItems}
        currentMileage={vehicleMileage}
        isEstimated={isEstimatedScore}
        onResumeCheckin={onResumeCheckin}
        knownIssues={knownIssues}
        hpBuffer={hpBuffer}
      />

      {/* Compact-mode vehicle picker. Mounted lazily — `showCarSheet`
          flag flips on pill tap, the effect above calls .open(). */}
      <FloatingSheet
        ref={carSheetRef}
        snapHeights={[Math.min(540, 200 + sortedVehicles.length * 78)]}
        showBackdrop
        onClose={() => setShowCarSheet(false)}
      >
        <CarSelectionContent onClose={() => carSheetRef.current?.close()} />
      </FloatingSheet>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // 3D Carousel Styles
  carouselContainer: {
    height: SCREEN_HEIGHT * 0.24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginTop: 0,
  },
  carouselCard: {
    width: CAR_CARD_WIDTH,
    height: CAR_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    overflow: 'visible',
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainerLexus: {
    top: verticalScale(-280),
  },
  logoContainerLambo: {
    top: verticalScale(-240),
  },
  carouselLogo: {
    opacity: 0.08,
  },
  carouselLogoLexus: {
    width: scale(280),
    height: scale(280),
  },
  carouselLogoLambo: {
    width: scale(240),
    height: scale(240),
  },
  carouselCarImage: {
    width: '100%',
    height: '100%',
    zIndex: 1,
    // `scale: 0.85` zooms out the car a touch so it doesn't dominate
    // the frame. `translateY` keeps the bottom (tires) at roughly the
    // same Y after the scale-down so the ground line still lands at
    // the tire base without retuning per-body-style offsets.
    transform: [{ translateY: scale(22) }, { scale: 0.85 }],
  },
  carouselCarImageLexus: {
    // No longer needed — dynamic images have consistent sizing
  },
  carouselCarImageLambo: {
    // No longer needed — dynamic images have consistent sizing
  },
  carouselReflection: {
    width: '100%',
    height: scale(180),
    transform: [{ scaleY: -1 }],
    opacity: 0.03,
    marginTop: scale(-165),
  },
  carouselReflectionLexus: {
    // No longer needed
  },
  carouselReflectionLambo: {
    width: '130%',
    height: scale(260),
    opacity: 0.04,
    marginTop: scale(-175),
    transform: [{ scaleY: -1 }, { translateY: 40 }],
  },

  // Active Car Info
  activeCarInfo: {
    alignItems: 'center',
    marginTop: scale(8),
  },
  heroCarName: {
    color: '#000000',
    fontSize: moderateScale(24),
    fontWeight: '700',
  },
  heroCarNameLight: {
    color: '#ffffff',
  },
  heroCarMeta: {
    marginTop: scale(4),
    color: '#000000',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  heroCarMetaLight: {
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // Thumbnail Row
  thumbnailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  // Wraps the SegmentedControl rail + the "+" add-vehicle button so
  // they stay grouped on the left side of the row, with the
  // ActivityRings pushed to the right via the parent's space-between.
  thumbnailLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thumbnailSelector: {
    height: scale(48),
    justifyContent: 'center',
    position: 'relative',
  },
  // Native iOS UISegmentedControl backing the thumbnail row.
  // Height matches the thumbnails so the overlay images stay
  // visually centered over each segment. Width is set inline so it
  // tracks the vehicle count.
  segmentedRail: {
    height: scale(48),
  },
  // Absolute-positioned car image on top of each segment. Driven by
  // `left = index * SEGMENT_WIDTH + (SEGMENT_WIDTH - thumb)/2` so it
  // sits centered above each segment. `pointerEvents="none"` on the
  // overlay lets taps fall through to the SegmentedControl underneath.
  thumbnailOverlay: {
    position: 'absolute',
    top: (scale(48) - scale(36)) / 2,
    width: scale(36),
    height: scale(36),
  },
  addCarButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },

  // Compact-mode (5+ cars) overflow pill — sits next to the 3-thumb
  // liquid-glass selector and shows the active car's model name +
  // chevron. Tap opens the full CarSelectionContent sheet.
  overflowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    maxWidth: scale(110),
  },

  // Separator
  separatorContainer: {
    position: 'absolute',
    left: Spacing.lg,
    bottom: 0,
  },
  separator: {
    height: 1.5,
    backgroundColor: '#C4C9D4',
  },
  separatorIndicator: {
    position: 'absolute',
    top: -1,
    width: scale(48),
    height: 3,
    backgroundColor: BrandColors.secondary,
    borderRadius: 1.5,
  },


  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingBottom: scale(24),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(50),
    width: '100%',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    marginBottom: scale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  backButton: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.lg,
    padding: scale(8),
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    padding: scale(8),
  },
  sheetContent: {
    alignItems: 'center',
    paddingTop: scale(40),
  },
  sheetLogo: {
    width: scale(80),
    height: scale(90),
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  detailsGrid: {
    width: '100%',
    gap: Spacing.sm,
  },
  sheetDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
  },
  detailItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  detailLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: moderateScale(11),
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  sheetTitle: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.lg,
  },
  saveButton: {
    width: '100%',
    backgroundColor: BrandColors.secondary,
    borderRadius: moderateScale(12),
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  serviceOptions: {
    width: '100%',
    gap: Spacing.sm,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  serviceOptionPressed: {
    backgroundColor: '#F3F4F6',
  },
  serviceOptionIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CarCarousel;
