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

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
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
import { useMutation } from "convex/react";
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
import SquircleRing from "@/components/cars/SquircleRing";
import QuestionOverlay from "@/components/cars/QuestionOverlay";
import type { QuestionDef } from "@/components/cars/QuestionOverlay";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { scale, verticalScale, moderateScale } from '@/utils/responsive';


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
}

type Phase = "intro" | "stepping";

type StepId = "serviceGrid";

type ServiceCardId = "brakes" | "tires" | "oil" | "battery" | "warningLights";

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
};

const SERVICE_ICON_COMPONENTS: Record<ServiceCardId, React.FC<{ size?: number; color?: string }>> = {
  brakes: BrakesIcon,
  tires: TireIcon,
  oil: OilIcon,
  battery: BatteryIcon,
  warningLights: WarningIcon,
};

const ALL_CARD_IDS: ServiceCardId[] = ["brakes", "tires", "oil", "battery", "warningLights"];

const STEP_META: Record<StepId, { title: string; subtitle: string }> = {
  serviceGrid: { title: "Service History", subtitle: "Tap each item to tell us what you know." },
};

const WARNING_LIGHT_TYPE_OPTIONS = [
  { id: "tpms" as const, label: "Tire pressure (TPMS)", icon: "speedometer-outline" as const },
  { id: "battery_charging" as const, label: "Battery / charging", icon: "battery-half-outline" as const },
  { id: "temperature" as const, label: "Temperature / overheating", icon: "thermometer-outline" as const },
  { id: "oil_pressure" as const, label: "Oil pressure", icon: "water-outline" as const },
  { id: "abs" as const, label: "ABS / braking system", icon: "warning-outline" as const },
  { id: "airbag_srs" as const, label: "Airbag / SRS", icon: "shield-outline" as const },
  { id: "transmission" as const, label: "Transmission", icon: "cog-outline" as const },
  { id: "not_sure_which" as const, label: "I\u2019m not sure which one", icon: "help-circle-outline" as const },
];

// ============================================================================
// DECLARATIVE QUESTION DATA
// ============================================================================

const SERVICE_QUESTIONS: Record<ServiceCardId, QuestionDef[]> = {
  brakes: [
    {
      key: "recency",
      text: "When were your brakes last serviced?",
      options: [
        { id: "recently", label: "Recently" },
        { id: "few_months", label: "A few months ago" },
        { id: "over_6mo", label: "Over 6 months ago" },
        { id: "exact_date", label: "Specific date" },
        { id: "never", label: "Never" },
        { id: "not_sure", label: "I\u2019m not sure" },
      ],
      triggerFollowUp: "not_sure",
    },
    {
      key: "feel",
      text: "How do your brakes feel?",
      options: [
        { id: "fine", label: "Fine" },
        { id: "noise", label: "They make noise" },
        { id: "soft_slow", label: "They feel soft or slow" },
      ],
    },
  ],
  tires: [
    {
      key: "recency",
      text: "When were your tires last replaced?",
      options: [
        { id: "recently", label: "Recently" },
        { id: "few_months", label: "A few months ago" },
        { id: "over_6mo", label: "Over 6 months ago" },
        { id: "exact_date", label: "Specific date" },
        { id: "never", label: "Never" },
        { id: "not_sure", label: "I\u2019m not sure" },
      ],
      triggerFollowUp: "not_sure",
    },
    {
      key: "original",
      text: "Are these the original tires?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
        { id: "not_sure", label: "Not sure" },
      ],
    },
  ],
  oil: [
    {
      key: "recency",
      text: "Know when your last oil change was?",
      options: [
        { id: "recently", label: "Recently" },
        { id: "few_months", label: "A few months ago" },
        { id: "over_6mo", label: "Over 6 months ago" },
        { id: "exact_date", label: "Specific date" },
        { id: "never", label: "Never" },
        { id: "not_sure", label: "Not sure" },
      ],
    },
  ],
  battery: [
    {
      key: "recency",
      text: "When was your battery last replaced?",
      options: [
        { id: "recently", label: "Recently" },
        { id: "few_months", label: "A few months ago" },
        { id: "over_6mo", label: "Over 6 months ago" },
        { id: "exact_date", label: "Specific date" },
        { id: "never", label: "Never" },
        { id: "not_sure", label: "I\u2019m not sure" },
      ],
      triggerFollowUp: "not_sure",
    },
    {
      key: "replaced",
      text: "Has your battery ever been replaced?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
        { id: "not_sure", label: "Not sure" },
      ],
    },
  ],
  warningLights: [
    {
      key: "status",
      text: "Any dashboard warning lights on right now?",
      options: [
        { id: "no_all_clear", label: "No, all clear" },
        { id: "check_engine", label: "Yes, check engine" },
        { id: "other", label: "Yes, something else" },
        { id: "not_sure", label: "Not sure" },
      ],
      triggerFollowUp: "other",
    },
    {
      key: "lightTypes",
      text: "Which warning lights are on?",
      multiSelect: true,
      options: WARNING_LIGHT_TYPE_OPTIONS.map((o) => ({ id: o.id, label: o.label, icon: o.icon })),
    },
  ],
};


// ============================================================================
// CardGridItem (with completion animation)
// ============================================================================

function CardGridItem({ cardId, isDone, isJustCompleted, progress, onPress, isWide }: {
  cardId: ServiceCardId;
  isDone: boolean;
  isJustCompleted: boolean;
  progress: number;
  onPress: () => void;
  isWide?: boolean;
}) {
  const pressScale = useSharedValue(1);
  const card = SERVICE_CARDS[cardId];
  const IconComponent = SERVICE_ICON_COMPONENTS[cardId];
  const isCompleted = isDone || isJustCompleted;

  const outerW = isWide ? WIDE_CARD_W : CARD_W;
  const outerH = isWide ? WIDE_CARD_H : CARD_H;
  const innerW = isWide ? WIDE_INNER_W : CARD_INNER_W;
  const innerH = isWide ? WIDE_INNER_H : CARD_INNER_H;

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
                <View style={[s.card, { width: innerW, height: innerH, borderRadius: CARD_RX, flexDirection: "column" }]}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: isWide ? 0 : scale(25) }}>
                    <IconComponent size={isWide ? scale(46) : scale(42)} />
                  </View>
                  <View style={{ paddingBottom: isWide ? scale(12) : scale(14), marginTop: isWide ? scale(-6) : 0, alignItems: "center" }}>
                    <Text
                      weight="semiBold"
                      size="sm"
                      color={labelColor}
                      style={{ fontSize: moderateScale(17), textAlign: "center" }}
                    >
                      {card.label}
                    </Text>
                    {isWide && (
                      <Text
                        weight="medium"
                        size="xs"
                        color={labelColor}
                        style={{ fontSize: moderateScale(11.5), opacity: isCompleted ? 0.7 : 0.55, marginTop: scale(2), textAlign: "center" }}
                      >
                        Any dashboard warnings on?
                      </Text>
                    )}
                  </View>
                </View>

                {/* Gradient overlay (fades in on completion) */}
                <ReAnimated.View style={[s.cardGradientOverlay, { width: innerW, height: innerH, borderRadius: CARD_RX }, gradientOverlayStyle]}>
                  <LinearGradient
                    colors={["#5299FE", "#70B7FF"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{ width: innerW, height: innerH, alignItems: "center", justifyContent: "center", borderRadius: CARD_RX, flexDirection: "column" }}
                  >
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: isWide ? 0 : scale(25) }}>
                      <IconComponent size={isWide ? scale(46) : scale(42)} color="#FFFFFF" />
                    </View>
                    <View style={{ paddingBottom: isWide ? scale(12) : scale(14), marginTop: isWide ? scale(-6) : 0, alignItems: "center" }}>
                      <Text
                        weight="semiBold"
                        size="sm"
                        color="#FFFFFF"
                        style={{ fontSize: moderateScale(17), textAlign: "center" }}
                      >
                        {card.label}
                      </Text>
                      {isWide && (
                        <Text
                          weight="medium"
                          size="xs"
                          color="#FFFFFF"
                          style={{ fontSize: moderateScale(11.5), opacity: 0.7, marginTop: scale(2), textAlign: "center" }}
                        >
                          Any dashboard warnings on?
                        </Text>
                      )}
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
}: CarInfoStepperProps, ref) {
  console.log('[CarInfoStepper] rendering — vehicleOwnerId:', vehicleOwnerId);
  const insets = useSafeAreaInsets();
  const saveField = useMutation(api.vehicles.saveOnboardingField);
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

  // ── Grid / overlay state ──────────────────────────────────
  const [activeCard, setActiveCard] = useState<ServiceCardId | null>(null);
  const [completedCards, setCompletedCards] = useState<Set<ServiceCardId>>(new Set());
  const [justCompletedId, setJustCompletedId] = useState<ServiceCardId | null>(null);
  const [serviceAnswers, setServiceAnswers] = useState<
    Partial<Record<ServiceCardId, Record<string, string | number | string[]>>>
  >({});
  const [serviceQuestionIndex, setServiceQuestionIndex] = useState<
    Partial<Record<ServiceCardId, number>>
  >({});
  const [serviceProgress, setServiceProgress] = useState<
    Partial<Record<ServiceCardId, number>>
  >({});

  // ── Finalize completion after animation ─────────────────────
  useEffect(() => {
    if (!justCompletedId) return;
    const timer = setTimeout(() => {
      setCompletedCards(prev => new Set(prev).add(justCompletedId));
      setJustCompletedId(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [justCompletedId]);

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
      case "serviceGrid": return completedCards.size === ALL_CARD_IDS.length;
      default: return false;
    }
  }, [currentStepId, completedCards]);

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

  // ── Overlay callbacks ──────────────────────────────────────
  const handleOverlayAnswer = useCallback((
    answers: Record<string, string | number | string[]>,
    questionIndex: number,
    progress: number,
  ) => {
    if (!activeCard) return;
    setServiceAnswers(prev => ({ ...prev, [activeCard]: answers }));
    setServiceQuestionIndex(prev => ({ ...prev, [activeCard]: questionIndex }));
    setServiceProgress(prev => ({ ...prev, [activeCard]: progress }));
  }, [activeCard]);

  const handleOverlayComplete = useCallback(() => {
    if (!activeCard) return;
    setServiceProgress(prev => ({ ...prev, [activeCard]: 1 }));
    setJustCompletedId(activeCard);
    setActiveCard(null);
  }, [activeCard]);

  const handleOverlayDismiss = useCallback(() => {
    setActiveCard(null);
  }, []);

  useImperativeHandle(ref, () => ({
    isExpanded: () => !!activeCard,
    goBack: () => { if (activeCard) handleOverlayDismiss(); },
  }), [activeCard, handleOverlayDismiss]);

  // ── Complete handler (all 5 answered → "Complete" button) ──────────
  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      for (const cardId of ALL_CARD_IDS) {
        const answers = serviceAnswers[cardId];
        if (answers && Object.keys(answers).length > 0) {
          await saveField({ vehicleOwnerId, field: cardId, value: answers });
        }
      }
      await markComplete({ vehicleOwnerId });
      onComplete();
    } catch (err) {
      console.error("[CarInfoStepper] Save failed:", err);
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [vehicleOwnerId, serviceAnswers, saveField, markComplete, onComplete]);

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
      for (const cardId of ALL_CARD_IDS) {
        const answers = serviceAnswers[cardId];
        if (answers && Object.keys(answers).length > 0) {
          await saveField({ vehicleOwnerId, field: cardId, value: answers });
        }
      }
      (onFinishForNow ?? onComplete)();
    } catch (err) {
      console.error("[CarInfoStepper] Finish-for-now save failed:", err);
      (onFinishForNow ?? onComplete)();
    } finally {
      setSaving(false);
    }
  }, [vehicleOwnerId, serviceAnswers, saveField, onFinishForNow, onComplete]);

  // ── All-done state ──────────────────────────────────────────
  const allDone = completedCards.size === ALL_CARD_IDS.length;
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

  const lottieStyle = useAnimatedStyle(() => ({
    opacity: lottieOpacity.value,
    transform: [{ translateY: lottieTranslateY.value }],
  }));

  const gridFadeStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }));

  // ── Render the service grid ─────────────────────────────────
  const renderServiceGrid = () => {
    const squareCards: ServiceCardId[] = ["brakes", "tires", "oil", "battery"];
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
        {!allDone && <ReAnimated.View style={[s.cardGrid, { flex: 1 }, gridFadeStyle]}>
          <View style={s.cardGridSquares}>
            {squareCards.map(cardId => (
              <CardGridItem
                key={cardId}
                cardId={cardId}
                isDone={completedCards.has(cardId)}
                isJustCompleted={justCompletedId === cardId}
                progress={serviceProgress[cardId] ?? (completedCards.has(cardId) ? 1 : 0)}
                onPress={() => handleCardTap(cardId)}
              />
            ))}
          </View>
          <CardGridItem
            key="warningLights"
            cardId="warningLights"
            isDone={completedCards.has("warningLights")}
            isJustCompleted={justCompletedId === "warningLights"}
            progress={serviceProgress["warningLights"] ?? (completedCards.has("warningLights") ? 1 : 0)}
            onPress={() => handleCardTap("warningLights")}
            isWide
          />
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
          {/* paddingBottom was `insets.bottom + scale(4)` — content was
              floating ~38pt above the screen bottom. Ahmad wants the
              dots / Complete / Finish for now block physically lower
              on the screen. Since the flex:1 body absorbs any paddingTop
              bump, the only way to actually drop the block is to shrink
              the bottom pad. Drop to a flat `scale(4)` so the Finish for
              now link sits right above the home indicator. */}
          <Animated.View style={[s.steppingFooter, { paddingBottom: scale(4), opacity: mountFooterFade }]}>
            {/* Progress dots */}
            <View style={s.dotsRow}>
              {ALL_CARD_IDS.map((id) => (
                <FooterDot key={id} isDone={completedCards.has(id)} />
              ))}
              <Text weight="semiBold" size="xs" color="#829BAD" style={s.dotsCounter}>
                {completedCards.size} of 5
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

            {/* Finish for now */}
            {!canGoNext() && (
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

        {/* Question overlay */}
        {activeCard && (() => {
          const HeroIcon = SERVICE_ICON_COMPONENTS[activeCard];
          return (
            <QuestionOverlay
              serviceId={activeCard}
              serviceName={SERVICE_CARDS[activeCard].label}
              heroIcon={<HeroIcon size={scale(40)} color="#FFFFFF" />}
              questions={SERVICE_QUESTIONS[activeCard]}
              initialQuestionIndex={serviceQuestionIndex[activeCard] ?? 0}
              initialAnswers={serviceAnswers[activeCard] ?? {}}
              onAnswerUpdate={handleOverlayAnswer}
              onComplete={handleOverlayComplete}
              onDismiss={handleOverlayDismiss}
            />
          );
        })()}
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
