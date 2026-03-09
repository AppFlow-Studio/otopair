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
// OrbGridItem (with completion animation)
// ============================================================================

function OrbGridItem({ cardId, isDone, isJustCompleted, progress, onPress }: {
  cardId: ServiceCardId;
  isDone: boolean;
  isJustCompleted: boolean;
  progress: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const card = SERVICE_CARDS[cardId];
  const IconComponent = SERVICE_ICON_COMPONENTS[cardId];
  const isCompleted = isDone || isJustCompleted;

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

  return (
    <ReAnimated.View
      layout={Layout.springify().damping(50)}
      style={s.orbItemWrapper}
    >
      <ReAnimated.View style={pressStyle}>
        <Pressable
          disabled={isCompleted}
          onPressIn={() => { scale.value = withSpring(0.95, { damping: 15, stiffness: 200 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 180 }); }}
          onPress={onPress}
        >
          <ReAnimated.View style={glowWrapperStyle}>
            <ReAnimated.View style={pulseAnimStyle}>
              <View style={s.orbOuter}>
                <SquircleRing progress={progress} isDone={isCompleted} />

                {/* Default white squircle with colored icon */}
                <View style={s.squircle}>
                  <IconComponent size={48} />
                </View>

                {/* Gradient overlay (fades in on completion) */}
                <ReAnimated.View style={[s.gradientOverlay, gradientOverlayStyle]}>
                  <LinearGradient
                    colors={["#8AC2FF", "#5299FE", "#3B7FEB", "#2D6AD9"]}
                    locations={[0, 0.4, 0.8, 1]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={s.gradientOverlayInner}
                  >
                    <IconComponent size={48} color="#FFFFFF" />
                  </LinearGradient>
                </ReAnimated.View>

                {/* Ring burst circle */}
                <ReAnimated.View style={[s.burstCircle, burstAnimStyle]} />

                {/* Checkmark badge */}
                <ReAnimated.View style={[s.checkBadge, checkmarkAnimStyle]}>
                  <Ionicons name="checkmark-sharp" size={14} color="#5299FE" />
                </ReAnimated.View>
              </View>
            </ReAnimated.View>
          </ReAnimated.View>
        </Pressable>
      </ReAnimated.View>
      <Text weight="semiBold" size="sm" color="#33475B" style={s.orbLabel}>{card.label}</Text>
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

      const exitTo = direction === "forward" ? -cardWidth : cardWidth;
      const enterFrom = direction === "forward" ? cardWidth : -cardWidth;

      Animated.timing(slideX, {
        toValue: exitTo,
        duration: 120,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (newPhase !== null) setPhase(newPhase);
        if (newStep !== null) setStep(newStep);

        slideX.setValue(enterFrom);
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

  // ── Render the service grid ─────────────────────────────────
  const renderServiceGrid = () => {
    return (
      <View style={s.orbGrid}>
        {ALL_CARD_IDS.map(cardId => (
          <OrbGridItem
            key={cardId}
            cardId={cardId}
            isDone={completedCards.has(cardId)}
            isJustCompleted={justCompletedId === cardId}
            progress={serviceProgress[cardId] ?? (completedCards.has(cardId) ? 1 : 0)}
            onPress={() => handleCardTap(cardId)}
          />
        ))}
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
      <Text weight="bold" size="lg" color="#1F2937" style={s.introTitle}>
        Let&apos;s get a quick read on your {displayName}
      </Text>
      <Text weight="medium" size="sm" color="#6B7280" style={s.introSubtitle}>
        Three quick checks to understand your vehicle&apos;s current condition.
      </Text>
      <View style={s.benefitsList}>
        {["Brake health assessment", "Tire life estimation", "Warning light detection"].map((b) => (
          <View key={b} style={s.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text weight="medium" size="sm" color="#374151">{b}</Text>
          </View>
        ))}
      </View>
      <Pressable style={({ pressed }) => [s.ctaButton, pressed && s.ctaButtonPressed]} onPress={handleGetStarted}>
        <Text weight="bold" size="md" color="#FFFFFF">Get Started</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
      <Text weight="medium" size="xs" color="#9CA3AF" style={{ marginTop: 10 }}>Takes about 30 seconds</Text>
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
            <Text weight="bold" size="xl" color="#16293B" style={s.steppingTitle}>
              {meta.title}
            </Text>
            <Text weight="medium" size="sm" color="#829BAD" style={s.steppingSubtitle}>
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
                <Text weight="semiBold" size="md" color="#FFFFFF" style={{ fontSize: 17 }}>
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
                <Text weight="medium" size="sm" color="#A3B5C4" style={{ fontSize: 14 }}>
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
              heroIcon={<HeroIcon size={32} color="#FFFFFF" />}
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
    paddingLeft: 8,
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
    marginTop: 6,
  },
  steppingSubtitle: {
    fontSize: 15,
    marginTop: 6,
  },
  steppingBody: {
    flex: 1,
    marginTop: 12,
  },
  steppingFooter: {
    paddingTop: 8,
    gap: 12,
    alignItems: "center",
  },

  // ── Orb grid ──
  orbGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    gap: 16,
    paddingHorizontal: 8,
  },
  orbItemWrapper: {
    alignItems: "center",
  },
  orbOuter: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  squircle: {
    width: 110,
    height: 110,
    borderRadius: 30,
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
  gradientOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 110,
    height: 110,
    borderRadius: 30,
    overflow: "hidden",
  },
  gradientOverlayInner: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  burstCircle: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 110,
    height: 110,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#5299FE",
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
  orbLabel: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
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
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  completeButtonDisabled: {
    opacity: 0.4,
  },
  completeButtonGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  finishForNowButton: {
    paddingVertical: 8,
  },
});
