/**
 * CarInfoStepper — Quick Read Flow
 *
 * PURPOSE: Post-onboarding vehicle condition check. Captures brake health,
 *          tire status, oil recency, battery status, and warning light data
 *          via a 2×2 service grid + question overlay.
 *
 * PHASES:
 *   "intro"    — marketing card (benefits + Get Started CTA)
 *   "stepping"  — service grid with question overlay per service
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolateColor,
  Easing as REasing,
  Layout,
} from "react-native-reanimated";

import { ArrowLeft } from "lucide-react-native";
import { Text } from "@/components/shared-ui";
import { BrakesIcon, TireIcon, OilIcon, BatteryIcon, WarningIcon } from "@/components/cars/ServiceIcons";
import { Wrench } from "lucide-react-native";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import SquircleRing from "@/components/cars/SquircleRing";
import { QuickCheckSheet } from "@/components/cars/quickcheck/QuickCheckSheet";
import { TILE_SPECS, catalogTileSpec, type QuickCheckAnswer } from "@/components/cars/quickcheck/tileSpecs";
import { BiggerServicesSheet } from "@/components/cars/quickcheck/BiggerServicesSheet";
import {
  quickCheckRecordWrites,
  resolveQuickCheckAnchor,
  type QuickCheckServiceTile,
} from "@/utils/quickCheckAnchor";
import {
  biggerServiceCandidates,
  type BiggerServiceCandidate,
} from "@/utils/quickCheckBiggerServices";
import { hydrateServiceHistoryDraft } from "@/utils/quickCheckDraft";
import {
  useOemServiceIntervals,
  useVehicleFallbackProfile,
} from "@/hooks/useOemServiceIntervals";
import { useBookableServices } from "@/hooks/useBookableServices";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { scale, verticalScale, moderateScale } from '@/utils/responsive';
import { firedTiles, type QuickCheckTileId } from "@/utils/quickCheckFiring";


// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_CARD_WIDTH = SCREEN_WIDTH - scale(80);

const GRID_H_PAD = scale(16);
const GRID_GAP = scale(14);
const GRID_CONTENT_W = SCREEN_WIDTH - scale(48) - GRID_H_PAD * 2;
const CARD_W = Math.floor((GRID_CONTENT_W - GRID_GAP) / 2);
const CARD_H = scale(163);
const CARD_RX = moderateScale(22);
const CARD_RING_INSET = 4;
const CARD_INNER_W = CARD_W - CARD_RING_INSET * 2;
const CARD_INNER_H = CARD_H - CARD_RING_INSET * 2;

const WIDE_CARD_W = GRID_CONTENT_W;
const WIDE_CARD_H = scale(150);
const WIDE_INNER_W = WIDE_CARD_W - CARD_RING_INSET * 2;
const WIDE_INNER_H = WIDE_CARD_H - CARD_RING_INSET * 2;


// ============================================================================
// TYPES
// ============================================================================

export interface CarInfoStepperHandle {
  isExpanded: () => boolean;
  goBack: () => void;
}

interface CarInfoStepperProps {
  vehicleOwnerId: Id<"vehicle_owners">;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  onComplete: () => void;
  /** Called from the "Finish for now" link (partial exit). Falls back to
   *  `onComplete` when omitted. Lets callers route the early-exit path
   *  away from the full celebration flow — e.g. just close the sheet. */
  onFinishForNow?: () => void;
  skipIntro?: boolean;
  onBack?: () => void;
  /** Fires whenever the "all 5 answered" state changes. Lets the parent
   *  header hide its back button on the "You're all set!" screen. */
  onAllDoneChange?: (allDone: boolean) => void;
  /** Previously saved (via "Finish for now") Service History answers, so the
   *  grid rehydrates already-answered cards as complete. See
   *  `vehicle_owners.serviceHistoryDraft`. */
  initialDraft?: ServiceHistoryDraft | null;
  /** Current odometer, from `vehicle_owners.mileage`. Drives the miles half of
   *  the firing rules (Quick Check Spec v2 §4). Null is honest — the miles arm
   *  simply never fires and tiles come from age alone. Note callers must pass
   *  the raw ownership mileage, NOT the Cars tab's `currentOdometer`, which is
   *  deliberately null until onboarding completes. */
  currentMiles?: number | null;
  /** `vehicle_owners.avgMonthlyDriving` — turns a month/year answer into a
   *  mileage anchor when the driver doesn't type one. */
  avgMonthlyDriving?: string | null;
  /** Resolved Convex config for this vehicle. Feeds OEM intervals + the
   *  vehicle-class profile that Bigger Services assembles from. */
  vehicleConfigId?: Id<"vehicle_configs"> | null;
}

/** What this component writes. Reading is deliberately looser — see
 *  `ServiceHistoryDraftRaw`, which is what actually comes back off a row that
 *  may have been written by any earlier version. */
interface ServiceHistoryDraft {
  answers?: Partial<Record<ServiceCardId, Record<string, string | number | string[]>>>;
  progress?: Partial<Record<ServiceCardId, number>>;
  completed?: ServiceCardId[];
}

type Phase = "intro" | "stepping";

type StepId = "serviceGrid";

// Mirrors `QuickCheckTileId` — every tile that can render a card in the grid,
// Bigger Services included. The four that write a per-type maintenance record
// are narrower and live in `TILE_RECORD_TYPE`.
type ServiceCardId = "brakes" | "tires" | "oil" | "battery" | "warningLights" | "biggerServices";

const SERVICE_CARD_IMAGES: Partial<Record<ServiceCardId, any>> = {
  brakes:  require("@/assets/images/services/newIcons/brakesicon.png"),
  tires:   require("@/assets/images/services/newIcons/tiresicon.png"),
  oil:     require("@/assets/images/services/newIcons/oilchangeicon.png"),
  battery: require("@/assets/images/services/newIcons/batteryicon.png"),
};

const SERVICE_CARDS: Record<ServiceCardId, { label: string; icon: string; color: string }> = {
  brakes:        { label: "Brakes",         icon: "disc-outline",             color: "#5299FE" },
  tires:         { label: "Tires",          icon: "ellipse-outline",          color: "#5299FE" },
  oil:           { label: "Oil",            icon: "water-outline",            color: "#5299FE" },
  battery:       { label: "Battery",        icon: "battery-charging-outline", color: "#5299FE" },
  warningLights: { label: "Warning Lights", icon: "warning-outline",          color: "#5299FE" },
  biggerServices:{ label: "Bigger Services", icon: "construct-outline",       color: "#5299FE" },
};

const SERVICE_ICON_COMPONENTS: Record<ServiceCardId, React.FC<{ size?: number; color?: string }>> = {
  brakes: BrakesIcon,
  tires: TireIcon,
  oil: OilIcon,
  battery: BatteryIcon,
  warningLights: WarningIcon,
  // ServiceIcons has no wrench and this tile is a grouping rather than one
  // component, so lucide's does the job without inventing a custom glyph.
  // Defaults to the same blue the ServiceIcons set use internally — the grid
  // renders an un-completed icon with no colour prop and expects blue.
  biggerServices: ({ size, color }) => (
    <Wrench size={size} color={color ?? "#5299FE"} strokeWidth={1.6} />
  ),
};


const STEP_META: Record<StepId, { title: string; subtitle: string }> = {
  serviceGrid: { title: "Service History", subtitle: "Tap each item to tell us what you know." },
};


// ============================================================================
// DECLARATIVE QUESTION DATA
// ============================================================================



// ============================================================================
// CardGridItem (with completion animation)
// ============================================================================

function CardGridItem({ cardId, isDone, isJustCompleted, progress, onPress, isWide, subtitle, height, compact }: {
  cardId: ServiceCardId;
  isDone: boolean;
  isJustCompleted: boolean;
  progress: number;
  onPress: () => void;
  isWide?: boolean;
  /** Second line under the label on a wide card. Was hardcoded to the warning
   *  lights copy off `isWide` — fine while Warning Lights was the only wide
   *  card, wrong now that Bigger Services is one too. */
  subtitle?: string;
  /** Shrinks a square card so the grid fits the space it actually has. The
   *  tile count is per-vehicle now, so a fixed CARD_H that fit four tiles
   *  overflows at five and would overflow further at six. */
  height?: number;
  /** Lays a wide card out horizontally — icon left, text right — instead of
   *  the icon-over-label stack. Two full-height wide cards plus four squares
   *  do not fit a 6.3" screen, and compressing is the call over scrolling. */
  compact?: boolean;
}) {
  const pressScale = useSharedValue(1);
  const card = SERVICE_CARDS[cardId];
  const IconComponent = SERVICE_ICON_COMPONENTS[cardId];
  const isCompleted = isDone || isJustCompleted;

  const outerW = isWide ? WIDE_CARD_W : CARD_W;
  const outerH = height ?? (isWide ? WIDE_CARD_H : CARD_H);
  const innerW = isWide ? WIDE_INNER_W : CARD_INNER_W;
  const innerH = outerH - CARD_RING_INSET * 2;

  const completionAnim = useSharedValue(isDone ? 1 : 0);
  const pulseScale = useSharedValue(1);
  const glowShadowOpacity = useSharedValue(isDone ? 0.32 : 0);
  const glowShadowRadius = useSharedValue(isDone ? 18 : 0);
  const burstScale = useSharedValue(1);
  const burstOpacity = useSharedValue(0);
  const checkScale = useSharedValue(isDone ? 1 : 0);
  const checkRotation = useSharedValue(isDone ? 0 : -15);

  useEffect(() => {
    if (!isJustCompleted) return;

    completionAnim.value = withTiming(1, {
      duration: 800,
      easing: REasing.bezier(0.16, 1, 0.3, 1),
    });

    pulseScale.value = withSequence(
      withTiming(1.06, { duration: 250 }),
      withTiming(1, { duration: 500, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );

    glowShadowOpacity.value = withSequence(
      withTiming(0.45, { duration: 250 }),
      withTiming(0.32, { duration: 600 }),
    );
    glowShadowRadius.value = withSequence(
      withTiming(28, { duration: 250 }),
      withTiming(18, { duration: 600 }),
    );

    burstOpacity.value = withSequence(
      withTiming(0.3, { duration: 10 }),
      withTiming(0, { duration: 600 }),
    );
    burstScale.value = withTiming(1.3, { duration: 600 });

    checkScale.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 180 }));
    checkRotation.value = withDelay(400, withSpring(0, { damping: 12, stiffness: 180 }));
  }, [isJustCompleted]);

  // Snap the completed visuals on when a card is already done but ISN'T
  // mid-pop-animation — e.g. a draft rehydrated from "Finish for now",
  // where `isDone` flips true after mount. The shared values were seeded
  // from the initial `isDone`, so a later flip needs to push them here or
  // the blue fill / check / glow never appear. No animation on purpose:
  // this is a restore, not a fresh completion.
  useEffect(() => {
    if (!isDone || isJustCompleted) return;
    completionAnim.value = 1;
    glowShadowOpacity.value = 0.32;
    glowShadowRadius.value = 18;
    checkScale.value = 1;
    checkRotation.value = 0;
  }, [isDone, isJustCompleted]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const glowWrapperStyle = useAnimatedStyle(() => ({
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowShadowOpacity.value,
    shadowRadius: glowShadowRadius.value,
  }));

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const gradientOverlayStyle = useAnimatedStyle(() => ({
    opacity: completionAnim.value,
  }));

  const burstAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstScale.value }],
    opacity: burstOpacity.value,
  }));

  const checkmarkAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: checkScale.value },
      { rotate: `${checkRotation.value}deg` },
    ],
  }));

  const labelColor = isCompleted ? "#FFFFFF" : "#33475B";

  return (
    <ReAnimated.View
      layout={Layout.springify().damping(50)}
      style={{ alignItems: "center" }}
    >
      <ReAnimated.View style={pressStyle}>
        <Pressable
          // Completed cards stay tappable so the user can re-open the
          // overlay and change a previous answer. The overlay prefills
          // from serviceAnswers, so they pick up right where they left off.
          onPressIn={() => { pressScale.value = withSpring(0.96, { damping: 20, stiffness: 300 }); }}
          onPressOut={() => { pressScale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
          onPress={onPress}
        >
          <ReAnimated.View style={glowWrapperStyle}>
            <ReAnimated.View style={pulseAnimStyle}>
              <View style={{ width: outerW, height: outerH, alignItems: "center", justifyContent: "center" }}>
                {!isCompleted ? (
                  <View
                    style={[
                      s.cardOuterFill,
                      { width: outerW, height: outerH, borderRadius: CARD_RX },
                    ]}
                  />
                ) : null}
                <SquircleRing width={outerW} height={outerH} rx={CARD_RX} progress={progress} isDone={isCompleted} />

                {/* Default glass card */}
                <View style={[
                  s.card,
                  { width: innerW, height: innerH, borderRadius: CARD_RX },
                  compact
                    ? { flexDirection: "row", alignItems: "center", paddingHorizontal: scale(20), gap: scale(14) }
                    : { flexDirection: "column" },
                ]}>
                  <View style={
                    compact
                      ? { alignItems: "center", justifyContent: "center" }
                      : {
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          // Was a flat scale(25) nudge, which does not shrink:
                          // on a short card it pushed the icon down onto the
                          // label. Proportional keeps the optical centring at
                          // full height and simply stops mattering as the card
                          // compresses.
                          marginTop: isWide ? 0 : Math.min(scale(25), innerH * 0.16),
                        }
                  }>
                    <IconComponent size={compact ? scale(34) : isWide ? scale(46) : Math.min(scale(42), innerH * 0.34)} />
                  </View>
                  <View style={
                    compact
                      ? { flex: 1, alignItems: "flex-start" }
                      : { paddingBottom: isWide ? scale(12) : scale(14), marginTop: isWide ? scale(-6) : 0, alignItems: "center" }
                  }>
                    <Text
                      weight="semiBold"
                      size="sm"
                      color={labelColor}
                      style={{ fontSize: moderateScale(17), textAlign: compact ? "left" : "center" }}
                    >
                      {card.label}
                    </Text>
                    {isWide && subtitle ? (
                      <Text
                        weight="medium"
                        size="xs"
                        color={labelColor}
                        style={{ fontSize: moderateScale(11.5), opacity: isCompleted ? 0.7 : 0.55, marginTop: scale(2), textAlign: compact ? "left" : "center" }}
                      >
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Gradient overlay (fades in on completion) */}
                <ReAnimated.View style={[s.cardGradientOverlay, { width: innerW, height: innerH, borderRadius: CARD_RX }, gradientOverlayStyle]}>
                  <LinearGradient
                    colors={["#5299FE", "#70B7FF"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    // The completed card is a SECOND render of the same
                    // layout, so every sizing rule above has to be mirrored
                    // here — an answered wide card was still stacking (and
                    // overflowing) at the compact height because this branch
                    // was missed.
                    style={[
                      { width: innerW, height: innerH, borderRadius: CARD_RX },
                      compact
                        ? { flexDirection: "row", alignItems: "center", paddingHorizontal: scale(20), gap: scale(14) }
                        : { flexDirection: "column", alignItems: "center", justifyContent: "center" },
                    ]}
                  >
                    <View style={
                      compact
                        ? { alignItems: "center", justifyContent: "center" }
                        : {
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: isWide ? 0 : Math.min(scale(25), innerH * 0.16),
                          }
                    }>
                      <IconComponent size={compact ? scale(34) : isWide ? scale(46) : Math.min(scale(42), innerH * 0.34)} color="#FFFFFF" />
                    </View>
                    <View style={
                      compact
                        ? { flex: 1, alignItems: "flex-start" }
                        : { paddingBottom: isWide ? scale(12) : scale(14), marginTop: isWide ? scale(-6) : 0, alignItems: "center" }
                    }>
                      <Text
                        weight="semiBold"
                        size="sm"
                        color="#FFFFFF"
                        style={{ fontSize: moderateScale(17), textAlign: compact ? "left" : "center" }}
                      >
                        {card.label}
                      </Text>
                      {isWide && subtitle ? (
                        <Text
                          weight="medium"
                          size="xs"
                          color="#FFFFFF"
                          style={{ fontSize: moderateScale(11.5), opacity: 0.7, marginTop: scale(2), textAlign: "center" }}
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </LinearGradient>
                </ReAnimated.View>

                {/* Ring burst */}
                <ReAnimated.View style={[{
                  position: "absolute",
                  top: CARD_RING_INSET, left: CARD_RING_INSET,
                  width: innerW, height: innerH,
                  borderRadius: CARD_RX,
                  borderWidth: 2, borderColor: "#5299FE",
                }, burstAnimStyle]} />

                {/* Checkmark badge */}
                <ReAnimated.View style={[s.checkBadge, checkmarkAnimStyle]}>
                  <Ionicons name="checkmark-sharp" size={scale(14)} color="#5299FE" />
                </ReAnimated.View>
              </View>
            </ReAnimated.View>
          </ReAnimated.View>
        </Pressable>
      </ReAnimated.View>
    </ReAnimated.View>
  );
}


// ============================================================================
// FooterDot (animated background color)
// ============================================================================

function FooterDot({ isDone }: { isDone: boolean }) {
  const bg = useSharedValue(isDone ? 1 : 0);

  useEffect(() => {
    bg.value = withTiming(isDone ? 1 : 0, { duration: 350 });
  }, [isDone]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      bg.value,
      [0, 1],
      ["rgba(82,153,254,0.13)", "#5299FE"],
    ),
    shadowOpacity: bg.value,
    shadowRadius: bg.value * 8,
  }));

  return (
    <ReAnimated.View
      style={[s.dot, s.dotShadowBase, animStyle]}
    />
  );
}


// ============================================================================
// COMPONENT
// ============================================================================

const CarInfoStepper = forwardRef<CarInfoStepperHandle, CarInfoStepperProps>(function CarInfoStepper({
  vehicleOwnerId,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  onComplete,
  onFinishForNow,
  skipIntro = false,
  onBack,
  initialDraft,
  onAllDoneChange,
  currentMiles = null,
  avgMonthlyDriving = null,
  vehicleConfigId = null,
}: CarInfoStepperProps, ref) {
  const insets = useSafeAreaInsets();

  // Which tiles this specific car is worth asking about — Quick Check Spec v2
  // §4. Single source of truth: the grid, the "N of M" counter, canGoNext,
  // allDone and both write loops all read this, so they cannot disagree the way
  // the hardcoded ALL_CARD_IDS list let them.
  //
  // biggerServiceCandidates is 0 until that tile is built (step 8) — the tile
  // simply doesn't render, which is exactly the spec's behaviour when nothing
  // qualifies.
  // Fetched here rather than prop-drilled: `ServiceBottomSheet` is one of
  // three call sites and has never needed either query.
  const oemIntervals = useOemServiceIntervals(vehicleConfigId);
  const profile = useVehicleFallbackProfile(vehicleConfigId);
  // `useBookableServices` speaks Convex service ids; the interval tables are
  // slug-keyed. Translate rather than re-deriving fitment client-side —
  // `convex/services.ts` already ran `lib/serviceApplicability`, and a second
  // implementation is how the two answers drift apart.
  const { applicableIds, missingDataIds } = useBookableServices(vehicleOwnerId);
  const allServices = useQuery(api.services.list);
  const applicableSlugs = useMemo(() => {
    const fitted = new Set([...applicableIds, ...missingDataIds]);
    if (!allServices || fitted.size === 0) return undefined;
    const out = new Set<string>();
    for (const doc of allServices as Array<{ _id: string; slug?: string }>) {
      if (!fitted.has(doc._id)) continue;
      // The DB still holds hyphenated legacy slugs for some rows; TAXONOMY
      // accepts either form and hands back the canonical one.
      const canonical = doc.slug ? TAXONOMY[doc.slug]?.slug : undefined;
      if (canonical) out.add(canonical);
    }
    return out;
    // `missing_data` is folded in on purpose. That state means the backend
    // could not produce parts data — a reason we cannot SELL the service, not
    // evidence the car lacks the component. A service the vehicle genuinely
    // does not have is absent from every bucket. Excluding missing_data left a
    // 300,000-mile Q5 with one Bigger Service instead of five, because its
    // enrichment had not finished.
  }, [allServices, applicableIds, missingDataIds]);
  const existingRecords = useQuery(
    api.maintenance.getRecordsByVehicle,
    vehicleOwnerId ? { vehicleOwnerId } : "skip",
  );

  const answeredSlugs = useMemo(() => {
    const out = new Set<string>();
    for (const r of existingRecords ?? []) {
      if (typeof r.type === "string" && r.type.startsWith("catalog_")) {
        out.add(r.type.slice("catalog_".length));
      }
    }
    return out;
  }, [existingRecords]);

  const biggerServices = useMemo(
    () =>
      biggerServiceCandidates({
        currentOdometer: currentMiles ?? null,
        modelYear: vehicleYear ?? null,
        vehicleClass: profile?.vehicleClass ?? null,
        classOptions: {
          turbo: profile?.turbo,
          drivetrain: profile?.drivetrain,
          hasDifferential: profile?.hasDifferential,
        },
        oemIntervals,
        applicableSlugs,
        answeredSlugs,
      }),
    [currentMiles, vehicleYear, profile, oemIntervals, applicableSlugs, answeredSlugs],
  );

  const fired = useMemo(
    () =>
      firedTiles({
        currentMiles,
        modelYear: vehicleYear ?? null,
        biggerServiceCandidates: biggerServices.length,
      }),
    [currentMiles, vehicleYear, biggerServices.length],
  );
  const firedSet = useMemo(() => new Set<QuickCheckTileId>(fired), [fired]);
  const saveField = useMutation(api.vehicles.saveOnboardingField);
  const upsertRecord = useMutation(api.maintenance.upsertRecord);
  const saveServiceHistoryDraft = useMutation(api.vehicle_owners.saveServiceHistoryDraft);
  const markComplete = useMutation(api.vehicle_owners.markOnboardingComplete);

  // ── Phase & step state ──────────────────────────────────────
  const [phase, setPhase] = useState<Phase>(skipIntro ? "stepping" : "intro");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Mount fade-in (when entering stepping directly) ────────
  const mountHeaderFade = useRef(new Animated.Value(skipIntro ? 0 : 1)).current;
  const mountGridFade = useRef(new Animated.Value(skipIntro ? 0 : 1)).current;
  const mountGridTranslateY = useRef(
    new Animated.Value(skipIntro && Platform.OS === "android" ? scale(18) : 0),
  ).current;
  const mountGridScale = useRef(
    new Animated.Value(skipIntro && Platform.OS === "android" ? 0.985 : 1),
  ).current;
  const mountFooterFade = useRef(new Animated.Value(skipIntro ? 0 : 1)).current;

  useEffect(() => {
    if (!skipIntro) return;
    Animated.stagger(180, [
      Animated.timing(mountHeaderFade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ...(Platform.OS === "android"
        ? [
            Animated.parallel([
              Animated.timing(mountGridFade, {
                toValue: 1,
                duration: 420,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(mountGridTranslateY, {
                toValue: 0,
                duration: 420,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(mountGridScale, {
                toValue: 1,
                duration: 420,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
          ]
        : [
            Animated.timing(mountGridFade, {
              toValue: 1,
              duration: 500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
      Animated.timing(mountFooterFade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Slide animation ─────────────────────────────────────────
  const slideX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);
  // Height the grid actually has. Measured rather than assumed because the
  // fired tile count varies per vehicle — four squares under the wide Warning
  // Lights card overflowed the footer on a 6.3" screen at the fixed CARD_H.
  const [gridHeight, setGridHeight] = useState(0);

  // ── Grid / overlay state ──────────────────────────────────
  const [activeCard, setActiveCard] = useState<ServiceCardId | null>(null);
  // Which Bigger Service row is currently being asked about. Separate from
  // `activeCard` because the list sheet and the question sheet are two levels
  // of the same tile — answering a row returns to the list rather than
  // closing the tile.
  const [activeBigger, setActiveBigger] = useState<BiggerServiceCandidate | null>(null);
  const [completedCards, setCompletedCards] = useState<Set<ServiceCardId>>(new Set());
  const [justCompletedId, setJustCompletedId] = useState<ServiceCardId | null>(null);
  const [serviceAnswers, setServiceAnswers] = useState<
    Partial<Record<ServiceCardId, Record<string, string | number | string[]>>>
  >({});
  const [serviceProgress, setServiceProgress] = useState<
    Partial<Record<ServiceCardId, number>>
  >({});

  // ── Rehydrate a saved "Finish for now" draft ───────────────
  // Restores the answers, per-card progress, and completed set so a
  // returning user sees the cards they already answered marked complete.
  // Runs once, when the draft first becomes available.
  const hydratedDraftRef = useRef(false);
  useEffect(() => {
    if (hydratedDraftRef.current || !initialDraft) return;
    // Wait for the firing set — hydrating against an empty `fired` would
    // discard everything.
    if (fired.length === 0) return;
    hydratedDraftRef.current = true;
    // The draft is `v.any()` and outlives the code that wrote it, so every
    // entry has to prove it is a v2 answer for a tile this car is still being
    // asked about. A v1 draft otherwise rehydrates as ticked tiles that write
    // nothing on Complete.
    const hydrated = hydrateServiceHistoryDraft<ServiceCardId>(initialDraft, fired as ServiceCardId[]);
    setServiceAnswers(hydrated.answers as typeof serviceAnswers);
    setServiceProgress(hydrated.progress);
    setCompletedCards(new Set(hydrated.completed));
  }, [initialDraft, fired]);

  // ── Finalize completion after animation ─────────────────────
  useEffect(() => {
    if (!justCompletedId) return;
    const timer = setTimeout(() => {
      setCompletedCards(prev => new Set(prev).add(justCompletedId));
      setJustCompletedId(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [justCompletedId]);

  // The footer counter + dots should reflect a card the instant it's
  // completed — not wait out the 900ms settle animation above (which
  // only exists so the card's checkmark can finish popping). Fold the
  // just-completed card into a display set so "X of 5" and the dots
  // update in sync with the checkmark.
  const displayedCompleted = useMemo(() => {
    if (justCompletedId && !completedCards.has(justCompletedId)) {
      return new Set(completedCards).add(justCompletedId);
    }
    return completedCards;
  }, [completedCards, justCompletedId]);

  // ── Steps (no branching) ────────────────────────────────────
  const steps: StepId[] = ["serviceGrid"];
  const totalSteps = steps.length;

  // ── Slide helper (two-phase: quick exit → swap → smooth enter) ──
  const animateSlide = useCallback(
    (
      direction: "forward" | "back",
      newPhase: Phase | null,
      newStep: number | null,
    ) => {
      if (isAnimating.current) return;
      isAnimating.current = true;
      Keyboard.dismiss();

      const exitTo = direction === "forward" ? cardWidth : -cardWidth;
      const enterFrom = direction === "forward" ? -cardWidth : cardWidth;

      Animated.timing(slideX, {
        toValue: exitTo,
        duration: 120,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        slideX.setValue(enterFrom);
        if (newPhase !== null) setPhase(newPhase);
        if (newStep !== null) setStep(newStep);

        Animated.timing(slideX, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      });
    },
    [slideX, cardWidth],
  );

  // ── Navigation ──────────────────────────────────────────────
  const currentStepId = steps[step];

  const canGoNext = useCallback((): boolean => {
    switch (currentStepId) {
      case "serviceGrid": return fired.every((id) => completedCards.has(id as ServiceCardId));
      default: return false;
    }
  }, [fired, currentStepId, completedCards]);

  const handleGetStarted = useCallback(() => {
    animateSlide("forward", "stepping", 0);
  }, [animateSlide]);

  const handleNext = useCallback(() => {
    if (step < totalSteps - 1) {
      animateSlide("forward", null, step + 1);
    }
  }, [step, totalSteps, animateSlide]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      animateSlide("back", null, step - 1);
    }
  }, [step, animateSlide]);

  const handleDismiss = useCallback(() => {
    animateSlide("back", "intro", 0);
  }, [animateSlide]);

  // ── Card tap → open overlay ────────────────────────────────
  const handleCardTap = useCallback((cardId: ServiceCardId) => {
    setActiveCard(cardId);
  }, []);

  // ── Sheet callbacks ────────────────────────────────────────
  // One save per tile now, rather than the old per-question answer stream —
  // the v2 sheet is a single screen with a single Save, so there is no
  // question index to track.
  /**
   * A Bigger Service answer. Writes straight through rather than waiting for
   * Complete: the row is a catalog service, not one of the five tiles, so
   * there is no batch to join and the driver returns to the list expecting it
   * to say "Answered".
   */
  const handleBiggerSave = useCallback(async (
    slug: string,
    answer: QuickCheckAnswer,
  ) => {
    setActiveBigger(null);
    const anchor = resolveQuickCheckAnchor({
      answer,
      currentOdometer: currentMiles ?? null,
      avgMonthlyDriving,
      vehicleYear,
    });
    try {
      await upsertRecord({
        vehicleOwnerId,
        type: `catalog_${slug}`,
        ...anchor,
        customInputs: {
          source: "quick_check_v2",
          answerType: answer.answerType,
          ...(answer.month != null ? { answerMonth: answer.month } : {}),
          ...(answer.year != null ? { answerYear: answer.year } : {}),
          ...(answer.miles != null ? { answerMiles: answer.miles } : {}),
        },
      });
    } catch (err) {
      console.warn("[CarInfoStepper] Bigger Service save failed:", err);
    }
  }, [vehicleOwnerId, currentMiles, avgMonthlyDriving, vehicleYear, upsertRecord]);

  const handleTileSave = useCallback((
    id: string,
    answer: QuickCheckAnswer,
  ) => {
    if (activeBigger) {
      void handleBiggerSave(id, answer);
      return;
    }
    const tileId = id as ServiceCardId;
    setServiceAnswers(prev => ({
      ...prev,
      [tileId]: answer as unknown as Record<string, string | number | string[]>,
    }));
    setServiceProgress(prev => ({ ...prev, [tileId]: 1 }));
    setJustCompletedId(tileId);
    // Deliberately NOT clearing activeCard here. The sheet fires onClose after
    // its 280ms slide-down; clearing now would unmount it mid-animation.
  }, [activeBigger, handleBiggerSave]);

  const handleOverlayDismiss = useCallback(() => {
    // Closing a Bigger Service question returns to its list, not out of the
    // tile — `activeCard` stays "biggerServices".
    if (activeBigger) {
      setActiveBigger(null);
      return;
    }
    setActiveCard(null);
  }, [activeBigger]);

  useImperativeHandle(ref, () => ({
    isExpanded: () => !!activeCard,
    goBack: () => { if (activeCard) handleOverlayDismiss(); },
  }), [activeCard, handleOverlayDismiss]);

  /**
   * Write every answered tile.
   *
   * Two things about the order matter, both load-bearing:
   *
   * 1. Service records go through `api.maintenance.upsertRecord` rather than
   *    `saveOnboardingField`. The latter parses the v1 answer shape — recency
   *    buckets and per-tile follow-up ids — which v2 no longer produces, so it
   *    would quietly write nothing. `upsertRecord` takes the anchor directly.
   *
   * 2. Warning lights are written LAST, after every record. `upsertRecord`
   *    clears the matching light from `knownIssues` when a service is recorded
   *    done (convex/maintenance.ts) — so "oil changed in March" wipes an
   *    active oil-pressure light. Writing the driver's own lights answer after
   *    all of them makes the driver's answer the one that survives.
   *
   * Sequential `await`s on purpose: `upsertRecord` schedules the maintenance
   * pipeline on every call, and awaiting lets the scheduler coalesce them
   * instead of firing one run per record.
   *
   * `includeLights` is false on the Finish-for-now path. Writing `knownIssues`
   * is what trips `saveOnboardingField`'s auto-complete branch — it flips
   * `onboardingComplete` on `mileage > 0 && knownIssues != null` alone — so
   * answering one tile and bailing would finish onboarding, bank the +5 HP,
   * and clear the mandatory booking check-in gate. The service records are
   * still written: they are facts the driver gave us, `upsertRecord` has no
   * auto-complete branch, and the score stays hidden until onboarding really
   * completes. Only the lights wait, and the draft carries them until then.
   */
  const persistAnswers = useCallback(async (includeLights: boolean) => {
    // Explicit list rather than `fired` itself: `fired` also carries
    // `biggerServices`, which writes catalog rows through its own path.
    const serviceTiles: QuickCheckServiceTile[] = ["oil", "tires", "brakes", "battery"];
    for (const tileId of serviceTiles) {
      if (!firedSet.has(tileId)) continue;
      const answer = serviceAnswers[tileId] as unknown as QuickCheckAnswer | undefined;
      if (!answer?.answerType) continue;

      const writes = quickCheckRecordWrites(
        tileId,
        answer,
        {
          currentOdometer: currentMiles ?? null,
          avgMonthlyDriving,
          vehicleYear,
        },
      );
      for (const w of writes) {
        await upsertRecord({ vehicleOwnerId, ...w });
      }
    }

    // Lights last. See (2) above.
    const lights = serviceAnswers["warningLights"] as unknown as QuickCheckAnswer | undefined;
    if (includeLights && lights?.answerType) {
      // The `knownIssues` field rather than `warningLights`: the latter
      // prepends a `status` sentinel to whatever lights are listed, and v2 has
      // no sentinel that means "yes, and here they are" — every candidate
      // (`other`, `different_light`) is itself a bare marker, so it would ride
      // along as a phantom sixth issue. Writing the array directly says
      // exactly what the driver said.
      //
      // `no_all_clear` is the canonical "nothing lit" marker; `not_sure` is
      // its own answer and deliberately NOT a lit light — conflating them is
      // the bug where "not sure if one is on" scored as a confirmed
      // unidentified light.
      const issues =
        lights.answerType === "when" ? (lights.lights ?? [])
          : lights.answerType === "never" ? ["no_all_clear"]
            : ["not_sure"];
      await saveField({ vehicleOwnerId, field: "knownIssues", value: issues });
    }
  }, [
    firedSet, serviceAnswers, vehicleOwnerId, currentMiles,
    avgMonthlyDriving, vehicleYear, upsertRecord, saveField,
  ]);

  // ── Complete handler (all tiles answered → "Complete" button) ──────
  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      await persistAnswers(true);
      await markComplete({ vehicleOwnerId });
      onComplete();
    } catch (err) {
      console.error("[CarInfoStepper] Save failed:", err);
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [persistAnswers, vehicleOwnerId, markComplete, onComplete]);

  // ── Finish-for-now handler (partial exit) ──────────────────────────
  // Saves any answered fields (so progress isn't lost on re-open) but
  // intentionally does NOT call `markComplete` — the user opted out, so
  // `onboardingComplete` stays false. That keeps the Cars page in its
  // pre-onboarding view (estimated score + "Get a quick read" CTA) and
  // lets the user re-open the sheet via the CTA whenever they're ready.
  // Routes to `onFinishForNow` (typically the parent's close-sheet
  // handler), falling back to `onComplete` for legacy callers.
  const handleFinishForNow = useCallback(async () => {
    setSaving(true);
    try {
      await persistAnswers(false);
      // Persist the raw draft so re-opening the sheet rehydrates the
      // already-answered cards as complete. `displayedCompleted` folds in
      // any card mid-settle so nothing is dropped if the user exits fast.
      await saveServiceHistoryDraft({
        vehicleOwnerId,
        draft: {
          answers: serviceAnswers,
          progress: serviceProgress,
          completed: [...displayedCompleted],
        },
      });
      (onFinishForNow ?? onComplete)();
    } catch (err) {
      console.error("[CarInfoStepper] Finish-for-now save failed:", err);
      (onFinishForNow ?? onComplete)();
    } finally {
      setSaving(false);
    }
  }, [persistAnswers, vehicleOwnerId, serviceAnswers, serviceProgress, displayedCompleted, saveServiceHistoryDraft, onFinishForNow, onComplete]);

  // ── All-done state ──────────────────────────────────────────
  // Every tile this car was actually asked. A one-tile car is "all done" after
  // one answer — counting to five would leave it permanently incomplete.
  const allDone = fired.every((id) => completedCards.has(id as ServiceCardId));
  const allDoneTriggered = useRef(false);
  const lottieOpacity = useSharedValue(0);
  const lottieTranslateY = useSharedValue(-20);
  const gridOpacity = useSharedValue(1);

  useEffect(() => {
    if (allDone && !allDoneTriggered.current) {
      allDoneTriggered.current = true;
      // Fade out the grid cards
      gridOpacity.value = withTiming(0, { duration: 500, easing: REasing.out(REasing.ease) });
      // Then fade in the lottie + text after cards are gone
      lottieOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
      lottieTranslateY.value = withDelay(300, withTiming(0, { duration: 500, easing: REasing.out(REasing.ease) }));
    }
  }, [allDone]);

  // Let the parent header hide its back button on the "You're all set!"
  // screen (all 5 answered). Fires on mount too, so a rehydrated all-done
  // draft opens with the back button already hidden.
  useEffect(() => {
    onAllDoneChange?.(allDone);
  }, [allDone, onAllDoneChange]);

  const lottieStyle = useAnimatedStyle(() => ({
    opacity: lottieOpacity.value,
    transform: [{ translateY: lottieTranslateY.value }],
  }));

  const gridFadeStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }));

  // ── Render the service grid ─────────────────────────────────
  const renderServiceGrid = () => {
    // Spec §3 order: Warning Lights full-width on top, then the squares, then
    // Bigger Services full-width at the bottom. Only fired tiles render.
    const squareCards = (["oil", "tires", "brakes", "battery"] as ServiceCardId[])
      .filter((id) => firedSet.has(id as QuickCheckTileId));

    // Squares shrink to fit whatever the grid was given, never grow past the
    // designed CARD_H, and stop at a floor where the icon + label still read.
    // Before the first layout `gridHeight` is 0, so the full height applies —
    // the same as the old fixed behaviour.
    const squareRows = Math.ceil(squareCards.length / 2);
    // Bigger Services is a second wide card when it fires, and a shorter one:
    // it carries a count rather than an icon-led prompt, and two full-height
    // wide cards plus four squares do not fit a 6.3" screen.
    const hasBigger = firedSet.has("biggerServices");

    // Six tiles do not fit a 6.3" screen at full size, and Ahmad's call is to
    // compress rather than scroll. So when Bigger Services fires, BOTH wide
    // cards switch to the horizontal icon-left layout: that is where the space
    // is, because a stacked wide card spends 160pt to say two words.
    const compactWides = hasBigger;
    const wideCardHeight = compactWides ? scale(92) : WIDE_CARD_H;
    const biggerCardHeight = scale(84);

    // The floor is the height at which a square card still reads. With the
    // wides compacted there is room to stay above it.
    const SQUARE_MIN_H = scale(96);
    const wideBlock =
      wideCardHeight + GRID_GAP + (hasBigger ? biggerCardHeight + GRID_GAP : 0);
    const squareBudget = gridHeight
      ? gridHeight - scale(8) - wideBlock - (squareRows - 1) * GRID_GAP
      : 0;
    const squareCardHeight = (() => {
      if (!gridHeight || squareRows === 0) return CARD_H;
      return Math.max(SQUARE_MIN_H, Math.min(CARD_H, Math.floor(squareBudget / squareRows)));
    })();

    return (
      <View style={{ flex: 1 }}>
        {allDone && (
          <ReAnimated.View style={[{ alignItems: "center", justifyContent: "center", gap: scale(8), flex: 1 }, lottieStyle]}>
            <LottieView
              source={require("@/assets/animations/success.json")}
              autoPlay
              loop={false}
              style={{ width: scale(140), height: scale(140) }}
            />
            <Text weight="bold" size="xl" color="#0F172A">You&apos;re all set!</Text>
            <Text weight="medium" size="md" color="#829BAD">Your vehicle health score is ready.</Text>
          </ReAnimated.View>
        )}
        {!allDone && <ReAnimated.View
          style={[s.cardGrid, { flex: 1 }, gridFadeStyle]}
          onLayout={e => setGridHeight(e.nativeEvent.layout.height)}
        >
          {/* Always first, always present — the only live-malfunction signal. */}
          <CardGridItem
            key="warningLights"
            cardId="warningLights"
            isDone={completedCards.has("warningLights")}
            isJustCompleted={justCompletedId === "warningLights"}
            progress={serviceProgress["warningLights"] ?? (completedCards.has("warningLights") ? 1 : 0)}
            onPress={() => handleCardTap("warningLights")}
            isWide
            compact={compactWides}
            height={wideCardHeight}
            subtitle="Any dashboard warnings on?"
          />
          {/* Spec §3: Bigger Services is a second wide card, below the
              squares. It renders only when something actually qualified —
              `fired` already excludes it at zero candidates. */}
          {squareCards.length > 0 && (
            <View style={s.cardGridSquares}>
              {squareCards.map(cardId => (
                <CardGridItem
                  key={cardId}
                  cardId={cardId}
                  isDone={completedCards.has(cardId)}
                  isJustCompleted={justCompletedId === cardId}
                  progress={serviceProgress[cardId] ?? (completedCards.has(cardId) ? 1 : 0)}
                  onPress={() => handleCardTap(cardId)}
                  height={squareCardHeight}
                />
              ))}
            </View>
          )}
          {firedSet.has("biggerServices") && (
            <CardGridItem
              key="biggerServices"
              cardId="biggerServices"
              isDone={completedCards.has("biggerServices")}
              isJustCompleted={justCompletedId === "biggerServices"}
              progress={serviceProgress["biggerServices"] ?? (completedCards.has("biggerServices") ? 1 : 0)}
              onPress={() => handleCardTap("biggerServices")}
              isWide
              compact
              height={biggerCardHeight}
              subtitle={`${biggerServices.length} may be coming up`}
            />
          )}
        </ReAnimated.View>}
      </View>
    );
  };

  // ── Render intro content ────────────────────────────────────
  const displayName = vehicleMake && vehicleModel ? `${vehicleMake} ${vehicleModel}` : "your vehicle";

  const renderIntro = () => (
    <View style={s.introContent}>
      <View style={s.iconContainer}>
        <Ionicons name="pulse-outline" size={scale(32)} color="#5299FE" />
      </View>
      <Text weight="bold" size="lg" color="#0F172A" style={s.introTitle}>
        Let&apos;s get a quick read on your {displayName}
      </Text>
      <Text weight="medium" size="sm" color="#829BAD" style={s.introSubtitle}>
        A few quick checks to understand your vehicle&apos;s current condition.
      </Text>
      <View style={s.benefitsList}>
        {["Brake health assessment", "Tire life estimation", "Warning light detection"].map((b) => (
          <View key={b} style={s.benefitRow}>
            <Ionicons name="checkmark-circle" size={scale(16)} color="#5299FE" />
            <Text weight="medium" size="sm" color="#0F172A">{b}</Text>
          </View>
        ))}
      </View>
      <Pressable style={({ pressed }) => [s.ctaButton, pressed && s.ctaButtonPressed]} onPress={handleGetStarted}>
        <LinearGradient
          colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.ctaButtonGradient}
        >
          <Text weight="bold" size="md" color="#FFFFFF">Get Started</Text>
          <Ionicons name="arrow-forward" size={scale(18)} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
      <Text weight="medium" size="xs" color="#829BAD" style={{ marginTop: scale(10), opacity: 0.7 }}>Takes about 30 seconds</Text>
    </View>
  );

  // ── Render stepping content ─────────────────────────────────
  const renderStepping = (forStep: number) => {
    const stepId = steps[forStep];
    const isLast = forStep === totalSteps - 1;
    const meta = STEP_META[stepId];
    return (
      <View style={{ flex: 1 }}>
        {/* Background is owned by the parent (e.g. cars/index.tsx renders an
            AnimatedGradientBackground across the entire modal; ServiceBottomSheet
            uses a solid white). The local white→blue gradient we used to layer
            here only covered the body, so it created a visible seam where the
            parent's gradient ended and this one began. Let the parent's
            background bleed through unbroken. */}
        <View style={s.steppingPage}>
          {/* Header */}
          <Animated.View style={[s.steppingHeader, { opacity: mountHeaderFade }]}>
            {/* Long-form vehicle name above the title — spec §3. Grounds the
                questions in the specific car, which matters now that the tile
                set differs per vehicle. */}
            {vehicleYear && vehicleMake ? (
              <Text weight="bold" size="xs" color="#5299FE" style={s.steppingEyebrow}>
                {`YOUR ${vehicleYear} ${vehicleMake} ${vehicleModel}`.trim().toUpperCase()}
              </Text>
            ) : null}
            <Text weight="bold" size="xl" color="#0F172A" style={s.steppingTitle}>
              {meta.title}
            </Text>
            <Text weight="medium" size="sm" color="#829BAD" style={s.steppingSubtitle}>
              {meta.subtitle}
            </Text>
          </Animated.View>

          {/* Grid */}
          <Animated.View
            needsOffscreenAlphaCompositing={Platform.OS === "android"}
            renderToHardwareTextureAndroid={Platform.OS === "android"}
            style={[
              s.steppingBody,
              {
                opacity: mountGridFade,
                transform: [
                  { translateY: mountGridTranslateY },
                  { scale: mountGridScale },
                ],
              },
            ]}
          >
            {renderServiceGrid()}
          </Animated.View>

          {/* Footer */}
          {/* paddingBottom was originally `insets.bottom + scale(4)`
              (~38pt above screen bottom), then scale(4) (flush with
              home indicator). Ahmad asked for "slightly higher" than
              flush — scale(20) lands the Finish for now link a clean
              ~20pt above the home indicator. Dots / Complete pill
              ride above that. */}
          <Animated.View style={[s.steppingFooter, { paddingBottom: scale(20), opacity: mountFooterFade }]}>
            {/* Progress dots */}
            <View style={s.dotsRow}>
              {fired.map((id) => (
                <FooterDot key={id} isDone={displayedCompleted.has(id as ServiceCardId)} />
              ))}
              <Text weight="semiBold" size="xs" color="#829BAD" style={s.dotsCounter}>
                {displayedCompleted.size} of {fired.length}
              </Text>
            </View>

            {/* Complete button */}
            <Pressable
              onPress={isLast ? handleComplete : handleNext}
              disabled={!canGoNext() || saving}
              style={({ pressed }) => [
                s.completeButton,
                !canGoNext() && s.completeButtonDisabled,
                pressed && canGoNext() && { opacity: 0.9 },
              ]}
            >
              <LinearGradient
                colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.completeButtonGradient}
              >
                <Text weight="bold" size="md" color="#FFFFFF" style={{ fontSize: moderateScale(17) }}>
                  {saving ? "Saving..." : isLast ? "Complete" : "Next"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Finish for now — unconditional. It used to hide once every
                tile was answered, which is precisely when a driver might
                still want out without committing: the escape hatch should
                not disappear at the last step. */}
            {(
              <Pressable
                style={({ pressed }) => [s.finishForNowButton, pressed && { opacity: 0.7 }]}
                onPress={handleFinishForNow}
                disabled={saving}
              >
                <Text weight="medium" size="sm" color="#829BAD" style={{ fontSize: moderateScale(14), textDecorationLine: "underline" }}>
                  Finish for now
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>

        {/* Bigger Services — the list, and the question sheet it opens. */}
        <BiggerServicesSheet
          candidates={biggerServices}
          visible={activeCard === "biggerServices" && activeBigger === null}
          onClose={() => setActiveCard(null)}
          onPick={setActiveBigger}
          onDone={() => {
            // Nothing here is required, so "done" means the driver looked —
            // that is enough for the tile to count towards the progress
            // counter and unblock Complete.
            setServiceProgress(prev => ({ ...prev, biggerServices: 1 }));
            setJustCompletedId("biggerServices");
            setActiveCard(null);
          }}
        />

        <QuickCheckSheet
          spec={
            activeBigger
              ? catalogTileSpec(activeBigger.slug, activeBigger.label)
              : activeCard && activeCard !== "biggerServices"
                ? TILE_SPECS[activeCard]
                : null
          }
          visible={activeBigger !== null || (activeCard !== null && activeCard !== "biggerServices")}
          vehicleYear={vehicleYear}
          onClose={handleOverlayDismiss}
          onSubmit={handleTileSave}
        />
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────
  const renderForPhase = (p: Phase, currentStep: number) => {
    switch (p) {
      case "intro": return renderIntro();
      case "stepping": return renderStepping(currentStep);
    }
  };

  return (
    <View style={s.container}>
      <View
        style={s.pageContent}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideX }] }]}>
          {renderForPhase(phase, step)}
        </Animated.View>
      </View>

    </View>
  );
});

export default CarInfoStepper;

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
  },

  // ── Intro ──
  introContent: {
    alignItems: "center",
  },
  iconContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: moderateScale(28),
    backgroundColor: "rgba(82, 153, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(16),
  },
  introTitle: {
    textAlign: "center",
    marginBottom: scale(8),
  },
  introSubtitle: {
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginBottom: scale(20),
    paddingHorizontal: scale(8),
  },
  benefitsList: {
    alignSelf: "stretch",
    gap: scale(10),
    marginBottom: scale(24),
    paddingHorizontal: scale(8),
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  ctaButton: {
    borderRadius: moderateScale(24),
    width: "100%",
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    paddingVertical: scale(14),
    paddingHorizontal: scale(32),
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },

  // ── Stepping (full-page layout) ──
  steppingPage: {
    flex: 1,
    paddingHorizontal: scale(24),
  },
  steppingHeader: {
    marginBottom: scale(8),
  },
  backButton: {
    position: "absolute",
    top: scale(4),
    left: scale(20),
    width: scale(40),
    height: scale(40),
    justifyContent: "center",
    alignItems: "flex-start",
    zIndex: 10,
  },
  steppingEyebrow: {
    textAlign: "center",
    letterSpacing: 0.8,
    marginBottom: scale(4),
    fontSize: moderateScale(11),
  },
  steppingTitle: {
    fontSize: moderateScale(24),
    letterSpacing: -0.3,
  },
  steppingSubtitle: {
    fontSize: moderateScale(15),
    marginTop: scale(4),
  },
  steppingBody: {
    flex: 1,
    // Slight breathing room below the title/subtitle.
    marginTop: scale(20),
  },
  steppingFooter: {
    // Was scale(16) — Ahmad called out the dots row + Complete pill
    // + "Finish for now" sitting too high against the Warning Lights
    // card. scale(48) is the sweet spot: enough breathing room that
    // the footer reads as its own block, but small enough that the
    // flex:1 body doesn't shrink below the cards' fixed heights
    // (going to scale(96) made the cards overflow up into the
    // header).
    paddingTop: scale(48),
    gap: scale(12),
    alignItems: "center",
  },

  // ── Card grid ──
  cardGrid: {
    // Cards anchor to the TOP of the body so they sit right under
    // the title — Ahmad wants them as high as possible while
    // letting the footer (dots / Complete / Finish for now) hang
    // at the bottom with a big gap between.
    justifyContent: "flex-start",
    alignItems: "center",
    gap: GRID_GAP,
    paddingHorizontal: GRID_H_PAD,
    paddingTop: scale(8),
  },
  cardGridSquares: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: GRID_GAP,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 28,
    elevation: 4,
  },
  cardOuterFill: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#FFFFFF",
  },
  cardGradientOverlay: {
    position: "absolute",
    top: CARD_RING_INSET,
    left: CARD_RING_INSET,
    overflow: "hidden",
  },
  checkBadge: {
    position: "absolute",
    bottom: scale(2),
    right: scale(2),
    width: scale(24),
    height: scale(24),
    borderRadius: moderateScale(12),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 2,
    borderColor: "rgba(82,153,254,0.12)",
  },

  // ── Progress dots ──
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    marginBottom: scale(4),
  },
  dot: {
    width: scale(10),
    height: scale(10),
    borderRadius: moderateScale(5),
  },
  dotShadowBase: {
    shadowColor: "rgba(82,153,254,0.35)",
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  dotsCounter: {
    fontSize: moderateScale(13),
    marginLeft: scale(4),
  },

  // ── Complete button ──
  completeButton: {
    width: "100%",
    borderRadius: moderateScale(24),
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonGradient: {
    paddingVertical: scale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  finishForNowButton: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(16),
  },
});
