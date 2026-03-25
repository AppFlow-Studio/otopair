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

import { Text } from "@/components/shared-ui";
import { BrakesIcon, TireIcon, OilIcon, BatteryIcon, WarningIcon } from "@/components/cars/ServiceIcons";
import SquircleRing from "@/components/cars/SquircleRing";
import QuestionOverlay from "@/components/cars/QuestionOverlay";
import type { QuestionDef } from "@/components/cars/QuestionOverlay";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";


// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_CARD_WIDTH = SCREEN_WIDTH - 80;

const GRID_H_PAD = 16;
const GRID_GAP = 14;
const GRID_CONTENT_W = SCREEN_WIDTH - 48 - GRID_H_PAD * 2;
const CARD_W = Math.floor((GRID_CONTENT_W - GRID_GAP) / 2);
const CARD_H = 163;
const CARD_RX = 22;
const CARD_RING_INSET = 4;
const CARD_INNER_W = CARD_W - CARD_RING_INSET * 2;
const CARD_INNER_H = CARD_H - CARD_RING_INSET * 2;

const WIDE_CARD_W = GRID_CONTENT_W;
const WIDE_CARD_H = 150;
const WIDE_INNER_W = WIDE_CARD_W - CARD_RING_INSET * 2;
const WIDE_INNER_H = WIDE_CARD_H - CARD_RING_INSET * 2;

import { FontFamily } from "@/constants/theme";

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
  skipIntro?: boolean;
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
  const scale = useSharedValue(1);
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
    transform: [{ scale: scale.value }],
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
          disabled={isCompleted}
          onPressIn={() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 300 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
          onPress={onPress}
        >
          <ReAnimated.View style={glowWrapperStyle}>
            <ReAnimated.View style={pulseAnimStyle}>
              <View style={{ width: outerW, height: outerH, alignItems: "center", justifyContent: "center" }}>
                <SquircleRing width={outerW} height={outerH} rx={CARD_RX} progress={progress} isDone={isCompleted} />

                {/* Default glass card */}
                <View style={[s.card, { width: innerW, height: innerH, borderRadius: CARD_RX, flexDirection: "column" }]}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: isWide ? 0 : 25 }}>
                    <IconComponent size={isWide ? 46 : 42} />
                  </View>
                  <View style={{ paddingBottom: isWide ? 12 : 14, marginTop: isWide ? -6 : 0, alignItems: "center" }}>
                    <Text
                      weight="semiBold"
                      size="sm"
                      color={labelColor}
                      style={{ fontFamily: FontFamily.serifSemiBold, fontSize: 17, textAlign: "center" }}
                    >
                      {card.label}
                    </Text>
                    {isWide && (
                      <Text
                        weight="medium"
                        size="xs"
                        color={labelColor}
                        style={{ fontSize: 11.5, opacity: isCompleted ? 0.7 : 0.55, marginTop: 2, textAlign: "center" }}
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
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: isWide ? 0 : 25 }}>
                      <IconComponent size={isWide ? 46 : 42} color="#FFFFFF" />
                    </View>
                    <View style={{ paddingBottom: isWide ? 12 : 14, marginTop: isWide ? -6 : 0, alignItems: "center" }}>
                      <Text
                        weight="semiBold"
                        size="sm"
                        color="#FFFFFF"
                        style={{ fontFamily: FontFamily.serifSemiBold, fontSize: 17, textAlign: "center" }}
                      >
                        {card.label}
                      </Text>
                      {isWide && (
                        <Text
                          weight="medium"
                          size="xs"
                          color="#FFFFFF"
                          style={{ fontSize: 11.5, opacity: 0.7, marginTop: 2, textAlign: "center" }}
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
                  <Ionicons name="checkmark-sharp" size={14} color="#5299FE" />
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
  skipIntro = false,
}: CarInfoStepperProps, ref) {
  console.log('[CarInfoStepper] rendering — vehicleOwnerId:', vehicleOwnerId);
  const insets = useSafeAreaInsets();
  const saveField = useMutation(api.vehicles.saveOnboardingField);

  // ── Phase & step state ──────────────────────────────────────
  const [phase, setPhase] = useState<Phase>(skipIntro ? "stepping" : "intro");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Slide animation ─────────────────────────────────────────
  const slideX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);

  // ── Grid / overlay state ──────────────────────────────────
  const [activeCard, setActiveCard] = useState<ServiceCardId | null>(null);
  const [completedCards, setCompletedCards] = useState<Set<ServiceCardId>>(new Set());
  const [justCompletedId, setJustCompletedId] = useState<ServiceCardId | null>(null);
  const [serviceAnswers, setServiceAnswers] = useState<
    Partial<Record<ServiceCardId, Record<string, string | string[]>>>
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
    answers: Record<string, string | string[]>,
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

  // ── Complete handler ────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      for (const cardId of ALL_CARD_IDS) {
        const answers = serviceAnswers[cardId];
        if (answers && Object.keys(answers).length > 0) {
          await saveField({ vehicleOwnerId, field: cardId, value: answers });
        }
      }
      onComplete();
    } catch (err) {
      console.error("[CarInfoStepper] Save failed:", err);
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [vehicleOwnerId, serviceAnswers, saveField, onComplete]);

  // ── All-done state ──────────────────────────────────────────
  const allDone = completedCards.size === ALL_CARD_IDS.length;
  const allDoneTriggered = useRef(false);
  const lottieOpacity = useSharedValue(0);
  const lottieTranslateY = useSharedValue(-20);
  const gridScale = useSharedValue(1);
  const gridTranslateY = useSharedValue(0);

  useEffect(() => {
    if (allDone && !allDoneTriggered.current) {
      allDoneTriggered.current = true;
      lottieOpacity.value = withTiming(1, { duration: 500 });
      lottieTranslateY.value = withTiming(0, { duration: 500, easing: REasing.out(REasing.ease) });
      gridScale.value = withTiming(0.75, { duration: 600, easing: REasing.out(REasing.ease) });
      gridTranslateY.value = withTiming(-30, { duration: 600, easing: REasing.out(REasing.ease) });
    }
  }, [allDone]);

  const lottieStyle = useAnimatedStyle(() => ({
    opacity: lottieOpacity.value,
    transform: [{ translateY: lottieTranslateY.value }],
  }));

  const gridShrinkStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: gridScale.value },
      { translateY: gridTranslateY.value },
    ],
  }));

  // ── Render the service grid ─────────────────────────────────
  const renderServiceGrid = () => {
    const squareCards: ServiceCardId[] = ["brakes", "tires", "oil", "battery"];
    return (
      <View style={{ flex: 1 }}>
        {allDone && (
          <ReAnimated.View style={[{ alignItems: "center", gap: 8, marginBottom: 4 }, lottieStyle]}>
            <LottieView
              source={require("@/assets/animations/success.json")}
              autoPlay
              loop={false}
              style={{ width: 140, height: 140 }}
            />
            <Text weight="bold" size="xl" color="#0F172A" style={{ fontFamily: FontFamily.serifBold }}>You&apos;re all set!</Text>
            <Text weight="medium" size="md" color="#829BAD" style={{ fontFamily: FontFamily.serif }}>Your vehicle health score is ready.</Text>
          </ReAnimated.View>
        )}
        <ReAnimated.View style={[s.cardGrid, !allDone && { flex: 1 }, gridShrinkStyle]}>
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
        </ReAnimated.View>
      </View>
    );
  };

  // ── Render intro content ────────────────────────────────────
  const displayName = vehicleMake && vehicleModel ? `${vehicleMake} ${vehicleModel}` : "your vehicle";

  const renderIntro = () => (
    <View style={s.introContent}>
      <View style={s.iconContainer}>
        <Ionicons name="pulse-outline" size={32} color="#5299FE" />
      </View>
      <Text weight="bold" size="lg" color="#0F172A" style={[s.introTitle, { fontFamily: FontFamily.serifBold }]}>
        Let&apos;s get a quick read on your {displayName}
      </Text>
      <Text weight="medium" size="sm" color="#829BAD" style={[s.introSubtitle, { fontFamily: FontFamily.serif }]}>
        A few quick checks to understand your vehicle&apos;s current condition.
      </Text>
      <View style={s.benefitsList}>
        {["Brake health assessment", "Tire life estimation", "Warning light detection"].map((b) => (
          <View key={b} style={s.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text weight="medium" size="sm" color="#374151" style={{ fontFamily: FontFamily.serif }}>{b}</Text>
          </View>
        ))}
      </View>
      <Pressable style={({ pressed }) => [s.ctaButton, pressed && s.ctaButtonPressed]} onPress={handleGetStarted}>
        <Text weight="bold" size="md" color="#FFFFFF" style={{ fontFamily: FontFamily.serifBold }}>Get Started</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
      <Text weight="medium" size="xs" color="#829BAD" style={{ marginTop: 10, fontFamily: FontFamily.serif, opacity: 0.7 }}>Takes about 30 seconds</Text>
    </View>
  );

  // ── Render stepping content ─────────────────────────────────
  const renderStepping = (forStep: number) => {
    const stepId = steps[forStep];
    const isLast = forStep === totalSteps - 1;
    const meta = STEP_META[stepId];
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#D0E7F4', '#DFEDF6', '#EBF2F8', '#F3F7FA', '#FAFCFD', '#FFFFFF']}
          locations={[0, 0.18, 0.35, 0.5, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: -150, left: 0, right: 0, bottom: 0 }}
        />
        <View style={s.steppingPage}>
          {/* Header */}
          <View style={s.steppingHeader}>
            <Text weight="bold" size="xl" color="#0F172A" style={[s.steppingTitle, { fontFamily: FontFamily.serifBold }]}>
              {meta.title}
            </Text>
            <Text weight="medium" size="sm" color="#829BAD" style={[s.steppingSubtitle, { fontFamily: FontFamily.serif }]}>
              {meta.subtitle}
            </Text>
          </View>

          {/* Grid */}
          <View style={s.steppingBody}>
            {renderServiceGrid()}
          </View>

          {/* Footer */}
          <View style={[s.steppingFooter, { paddingBottom: insets.bottom + 24 }]}>
            {/* Progress dots */}
            <View style={s.dotsRow}>
              {ALL_CARD_IDS.map((id) => (
                <FooterDot key={id} isDone={completedCards.has(id)} />
              ))}
              <Text weight="semiBold" size="xs" color="#829BAD" style={[s.dotsCounter, { fontFamily: FontFamily.serif }]}>
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
                <Text weight="semiBold" size="md" color="#FFFFFF" style={{ fontSize: 17, fontFamily: FontFamily.serifBold }}>
                  {saving ? "Saving..." : isLast ? "Complete" : "Next"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Finish for now */}
            {!canGoNext() && (
              <Pressable
                style={({ pressed }) => [s.finishForNowButton, pressed && { opacity: 0.7 }]}
                onPress={handleComplete}
                disabled={saving}
              >
                <Text weight="medium" size="sm" color="#829BAD" style={{ fontSize: 14, fontFamily: FontFamily.serif, textDecorationLine: "underline" }}>
                  Finish for now
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Question overlay */}
        {activeCard && (() => {
          const HeroIcon = SERVICE_ICON_COMPONENTS[activeCard];
          return (
            <QuestionOverlay
              serviceId={activeCard}
              serviceName={SERVICE_CARDS[activeCard].label}
              heroIcon={<HeroIcon size={40} color="#FFFFFF" />}
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(82, 153, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  introTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  introSubtitle: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  benefitsList: {
    alignSelf: "stretch",
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },

  // ── Stepping (full-page layout) ──
  steppingPage: {
    flex: 1,
    paddingHorizontal: 24,
  },
  steppingHeader: {
    marginBottom: 4,
  },
  steppingTitle: {
    fontSize: 30,
    letterSpacing: -0.6,
    marginTop: -10,
  },
  steppingSubtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  steppingBody: {
    flex: 1,
    marginTop: 10,
  },
  steppingFooter: {
    paddingTop: 8,
    gap: 12,
    alignItems: "center",
  },

  // ── Card grid ──
  cardGrid: {
    justifyContent: "center",
    alignItems: "center",
    gap: GRID_GAP,
    paddingHorizontal: GRID_H_PAD,
    marginTop: -14,
  },
  cardGridSquares: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: GRID_GAP,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.85)",
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
  cardGradientOverlay: {
    position: "absolute",
    top: CARD_RING_INSET,
    left: CARD_RING_INSET,
    overflow: "hidden",
  },
  checkBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
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
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotShadowBase: {
    shadowColor: "rgba(82,153,254,0.35)",
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  dotsCounter: {
    fontSize: 13,
    marginLeft: 4,
  },

  // ── Complete button ──
  completeButton: {
    width: "100%",
    borderRadius: 24,
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
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  finishForNowButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
