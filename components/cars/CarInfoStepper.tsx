/**
 * CarInfoStepper — Quick Read Flow
 *
 * PURPOSE: Post-onboarding vehicle condition check. Captures brake health,
 *          tire status, oil recency, battery status, and warning light data
 *          via a 2×2 service grid + warning lights step.
 *
 * PHASES:
 *   "intro"    — marketing card (benefits + Get Started CTA)
 *   "stepping"  — service grid + warning lights step with progress bar
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useImperativeHandle, useRef, useState, forwardRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  Layout,
  FadeOut,
} from "react-native-reanimated";
import { AlertTriangle } from "lucide-react-native";
import LottieView from "lottie-react-native";

import { Text } from "@/components/shared-ui";

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

const SERVICE_CARDS: Record<ServiceCardId, { label: string; color: string }> = {
  brakes:        { label: "Brakes",         color: "#EF4444" },
  tires:         { label: "Tires",          color: "#F59E0B" },
  oil:           { label: "Oil",            color: "#3B82F6" },
  battery:       { label: "Battery",        color: "#22C55E" },
  warningLights: { label: "Warning Lights", color: "#F97316" },
};

const ALL_CARD_IDS: ServiceCardId[] = ["brakes", "tires", "oil", "battery", "warningLights"];

const STEP_META: Record<StepId, { title: string; subtitle: string }> = {
  serviceGrid: { title: "Vehicle Check-in", subtitle: "Tap each to tell us what you know." },
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

  // ── Grid / expansion state ─────────────────────────────────
  const [activeCard, setActiveCard] = useState<ServiceCardId | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [completedCards, setCompletedCards] = useState<Set<ServiceCardId>>(new Set());
  const cardRefs = useRef<Record<string, any>>({});
  const expansionProgress = useSharedValue(0);
  const expandOriginX = useSharedValue(0);
  const expandOriginY = useSharedValue(0);
  const expandOriginW = useSharedValue(0);
  const expandOriginH = useSharedValue(0);
  const containerOriginY = useSharedValue(0);
  const containerRef = useRef<View>(null);

  // ── Quick Read form state ───────────────────────────────────
  const [brakeRecency, setBrakeRecency] = useState<string | null>(null);
  const [brakeFeel, setBrakeFeel] = useState<string | null>(null);
  const [tireRecency, setTireRecency] = useState<string | null>(null);
  const [tireOriginal, setTireOriginal] = useState<string | null>(null);
  const [oilRecency, setOilRecency] = useState<string | null>(null);
  const [batteryRecency, setBatteryRecency] = useState<string | null>(null);
  const [batteryReplaced, setBatteryReplaced] = useState<string | null>(null);
  const [warningLight, setWarningLight] = useState<string | null>(null);
  const [warningLightTypes, setWarningLightTypes] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState<Set<ServiceCardId>>(new Set());

  // ── Steps (no branching) ────────────────────────────────────
  const steps: StepId[] = ["serviceGrid"];
  const totalSteps = steps.length;

  // ── Animated styles for shared element transition ──────────
  const HERO_Y = -20;
  const HERO_Y_COMPACT = -70;
  const HERO_Y_WARNING = 20;
  const HERO_Y_COMPACT_WARNING = -50;
  const HERO_SCALE = 2.4;
  const HERO_SCALE_COMPACT = 1.0;
  const compactProgress = useSharedValue(0);
  const isWarningCardSV = useSharedValue(0);

  const floatingCardStyle = useAnimatedStyle(() => {
    const p = expansionProgress.value;
    const cp = compactProgress.value;
    const w = isWarningCardSV.value;
    const heroY = interpolate(w, [0, 1], [HERO_Y, HERO_Y_WARNING]);
    const heroYCompact = interpolate(w, [0, 1], [HERO_Y_COMPACT, HERO_Y_COMPACT_WARNING]);
    const currentScale = interpolate(cp, [0, 1], [HERO_SCALE, HERO_SCALE_COMPACT]);
    const currentY = interpolate(cp, [0, 1], [heroY, heroYCompact]);
    const destW = expandOriginW.value * currentScale;
    const destH = expandOriginH.value * currentScale;
    const destX = (SCREEN_WIDTH - destW) / 2;
    const originYRelative = expandOriginY.value - containerOriginY.value;
    return {
      position: 'absolute' as const,
      left: interpolate(p, [0, 1], [expandOriginX.value, destX]),
      top: interpolate(p, [0, 1], [originYRelative, currentY]),
      width: interpolate(p, [0, 1], [expandOriginW.value, destW]),
      height: interpolate(p, [0, 1], [expandOriginH.value, destH]),
      zIndex: 300,
      transform: [{ scale: interpolate(p, [0, 1], [1, currentScale]) }],
      opacity: interpolate(p, [0.05, 0.2], [0, 1]),
    };
  });

  const gridFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansionProgress.value, [0, 0.15], [1, 0]),
  }));

  const questionFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansionProgress.value, [0.6, 1], [0, 1]),
  }));

  const spacerAnimatedStyle = useAnimatedStyle(() => {
    const w = isWarningCardSV.value;
    const expandedH = interpolate(w, [0, 1], [380, 400]);
    const compactH = interpolate(w, [0, 1], [110, 120]);
    return {
      height: interpolate(compactProgress.value, [0, 1], [expandedH, compactH]),
    };
  });

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

  // ── Card tap → expand to question page ──────────────────────
  const startExpansion = useCallback((cardId: ServiceCardId) => {
    setActiveCard(cardId);
    isWarningCardSV.value = cardId === "warningLights" ? 1 : 0;
    expansionProgress.value = withTiming(1, { duration: 400 }, () => {
      runOnJS(setShowQuestion)(true);
    });
  }, [expansionProgress, isWarningCardSV]);

  const handleCardTap = useCallback((cardId: ServiceCardId) => {
    const ref = cardRefs.current[cardId];
    if (ref?.measureInWindow) {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        expandOriginX.value = x;
        expandOriginY.value = y;
        expandOriginW.value = w;
        expandOriginH.value = h;
        containerRef.current?.measureInWindow((_cx: number, cy: number) => {
          containerOriginY.value = cy;
          startExpansion(cardId);
        });
      });
    } else {
      startExpansion(cardId);
    }
  }, [startExpansion, expandOriginX, expandOriginY, expandOriginW, expandOriginH, containerOriginY]);

  // ── Back to grid (dismiss without completing) ──────────────
  const resetAfterDismiss = useCallback((cardId: ServiceCardId | null) => {
    if (cardId) {
      setFollowUp(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      if (cardId === "brakes") { setBrakeRecency(null); setBrakeFeel(null); }
      if (cardId === "tires") { setTireRecency(null); setTireOriginal(null); }
      if (cardId === "oil") { setOilRecency(null); }
      if (cardId === "battery") { setBatteryRecency(null); setBatteryReplaced(null); }
      if (cardId === "warningLights") { setWarningLight(null); setWarningLightTypes([]); }
    }
    requestAnimationFrame(() => setActiveCard(null));
  }, []);

  const handleBackToGrid = useCallback(() => {
    const dismissedCard = activeCard;
    setShowQuestion(false);
    compactProgress.value = withTiming(0, { duration: 250 });
    expansionProgress.value = withTiming(0, { duration: 400 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(resetAfterDismiss)(dismissedCard);
      }
    });
  }, [expansionProgress, compactProgress, activeCard, resetAfterDismiss]);

  useImperativeHandle(ref, () => ({
    isExpanded: () => !!activeCard,
    goBack: () => handleBackToGrid(),
  }), [activeCard, handleBackToGrid]);

  // ── Transition to follow-up question ───────────────────────
  const transitionToFollowUp = useCallback((cardId: ServiceCardId) => {
    setFollowUp(prev => new Set(prev).add(cardId));
    if (cardId === "warningLights") {
      compactProgress.value = withTiming(1, { duration: 350 });
    }
  }, [compactProgress]);

  // ── Card answer → collapse back to grid + mark completed ───
  const finishCardAnswer = useCallback((cardId: ServiceCardId) => {
    requestAnimationFrame(() => {
      setActiveCard(null);
      setCompletedCards(prev => new Set(prev).add(cardId));
    });
  }, []);

  const handleCardAnswer = useCallback((cardId: ServiceCardId) => {
    setShowQuestion(false);
    compactProgress.value = withTiming(0, { duration: 250 });
    expansionProgress.value = withTiming(0, { duration: 400 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(finishCardAnswer)(cardId);
      }
    });
  }, [expansionProgress, compactProgress, finishCardAnswer]);

  // ── Complete handler ────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      if (brakeRecency !== null || brakeFeel !== null)
        await saveField({ vehicleOwnerId, field: "brakes", value: { recency: brakeRecency, feel: brakeFeel } });
      if (tireRecency !== null || tireOriginal !== null)
        await saveField({ vehicleOwnerId, field: "tires", value: { recency: tireRecency, original: tireOriginal } });
      if (oilRecency !== null)
        await saveField({ vehicleOwnerId, field: "oil", value: { recency: oilRecency } });
      if (batteryRecency !== null || batteryReplaced !== null)
        await saveField({ vehicleOwnerId, field: "battery", value: { recency: batteryRecency, replaced: batteryReplaced } });
      await saveField({ vehicleOwnerId, field: "warningLights", value: { status: warningLight, lightTypes: warningLightTypes } });
      onComplete();
    } catch (err) {
      console.error("[CarInfoStepper] Save failed:", err);
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [
    vehicleOwnerId,
    brakeRecency, brakeFeel, tireRecency, tireOriginal,
    oilRecency, batteryRecency, batteryReplaced,
    warningLight, warningLightTypes,
    saveField, onComplete,
  ]);

  // ── Render card question (shown in the bottom sheet) ────────
  const renderCardQuestion = (cardId: ServiceCardId) => {
    switch (cardId) {
      case "brakes":
        if (followUp.has("brakes")) {
          return (
            <View style={s.fieldGroup}>
              <Text weight="semiBold" size="md" color="#1F2937">How do your brakes feel?</Text>
              <View style={s.chipColumn}>
                {([
                  { id: "fine",      label: "Fine" },
                  { id: "noise",     label: "They make noise" },
                  { id: "soft_slow", label: "They feel soft or slow" },
                ]).map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[s.optionCard, brakeFeel === opt.id && s.optionCardActive]}
                    onPress={() => { setBrakeFeel(opt.id); handleCardAnswer("brakes"); }}
                  >
                    <Text weight={brakeFeel === opt.id ? "bold" : "semiBold"} size="md" color={brakeFeel === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                    {brakeFeel === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When were your brakes last serviced?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "recently",   label: "Recently" },
                { id: "few_months", label: "A few months ago" },
                { id: "over_6mo",   label: "Over 6 months ago" },
                { id: "not_sure",   label: "I'm not sure" },
              ]).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[s.optionCard, brakeRecency === opt.id && s.optionCardActive]}
                  onPress={() => {
                    setBrakeRecency(opt.id);
                    if (opt.id === "not_sure") {
                      transitionToFollowUp("brakes");
                    } else {
                      handleCardAnswer("brakes");
                    }
                  }}
                >
                  <Text weight={brakeRecency === opt.id ? "bold" : "semiBold"} size="md" color={brakeRecency === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {brakeRecency === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "tires":
        if (followUp.has("tires")) {
          return (
            <View style={s.fieldGroup}>
              <Text weight="semiBold" size="md" color="#1F2937">Are these the original tires?</Text>
              <View style={s.chipColumn}>
                {([
                  { id: "yes",      label: "Yes" },
                  { id: "no",       label: "No" },
                  { id: "not_sure", label: "Not sure" },
                ]).map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[s.optionCard, tireOriginal === opt.id && s.optionCardActive]}
                    onPress={() => { setTireOriginal(opt.id); handleCardAnswer("tires"); }}
                  >
                    <Text weight={tireOriginal === opt.id ? "bold" : "semiBold"} size="md" color={tireOriginal === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                    {tireOriginal === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When were your tires last replaced?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "recently",   label: "Recently" },
                { id: "few_months", label: "A few months ago" },
                { id: "over_6mo",   label: "Over 6 months ago" },
                { id: "not_sure",   label: "I'm not sure" },
              ]).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[s.optionCard, tireRecency === opt.id && s.optionCardActive]}
                  onPress={() => {
                    setTireRecency(opt.id);
                    if (opt.id === "not_sure") {
                      transitionToFollowUp("tires");
                    } else {
                      handleCardAnswer("tires");
                    }
                  }}
                >
                  <Text weight={tireRecency === opt.id ? "bold" : "semiBold"} size="md" color={tireRecency === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {tireRecency === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "oil":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Know when your last oil change was?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "recently",   label: "Recently" },
                { id: "few_months", label: "A few months ago" },
                { id: "over_6mo",   label: "Over 6 months ago" },
                { id: "not_sure",   label: "Not sure" },
              ]).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[s.optionCard, oilRecency === opt.id && s.optionCardActive]}
                  onPress={() => { setOilRecency(opt.id); handleCardAnswer("oil"); }}
                >
                  <Text weight={oilRecency === opt.id ? "bold" : "semiBold"} size="md" color={oilRecency === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {oilRecency === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "battery":
        if (followUp.has("battery")) {
          return (
            <View style={s.fieldGroup}>
              <Text weight="semiBold" size="md" color="#1F2937">Has your battery ever been replaced?</Text>
              <View style={s.chipColumn}>
                {([
                  { id: "yes",      label: "Yes" },
                  { id: "no",       label: "No" },
                  { id: "not_sure", label: "Not sure" },
                ]).map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[s.optionCard, batteryReplaced === opt.id && s.optionCardActive]}
                    onPress={() => { setBatteryReplaced(opt.id); handleCardAnswer("battery"); }}
                  >
                    <Text weight={batteryReplaced === opt.id ? "bold" : "semiBold"} size="md" color={batteryReplaced === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                    {batteryReplaced === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When was your battery last replaced?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "recently",   label: "Recently" },
                { id: "few_months", label: "A few months ago" },
                { id: "over_6mo",   label: "Over 6 months ago" },
                { id: "not_sure",   label: "I'm not sure" },
              ]).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[s.optionCard, batteryRecency === opt.id && s.optionCardActive]}
                  onPress={() => {
                    setBatteryRecency(opt.id);
                    if (opt.id === "not_sure") {
                      transitionToFollowUp("battery");
                    } else {
                      handleCardAnswer("battery");
                    }
                  }}
                >
                  <Text weight={batteryRecency === opt.id ? "bold" : "semiBold"} size="md" color={batteryRecency === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {batteryRecency === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "warningLights":
        if (followUp.has("warningLights")) {
          return (
            <View style={s.fieldGroup}>
              <Text weight="semiBold" size="md" color="#1F2937">Which warning lights are on?</Text>
              <View style={s.chipColumn}>
                {WARNING_LIGHT_TYPE_OPTIONS.map((opt) => {
                  const selected = warningLightTypes.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      style={[s.optionCard, selected && s.optionCardActive]}
                      onPress={() => {
                        setWarningLightTypes((prev) =>
                          prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                        );
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name={opt.icon} size={20} color={selected ? "#5299FE" : "#6B7280"} />
                        <Text weight={selected ? "bold" : "semiBold"} size="md" color={selected ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                    </Pressable>
                  );
                })}
              </View>
              {warningLightTypes.length > 0 && (
                <Pressable
                  style={({ pressed }) => [s.ctaButton, pressed && s.ctaButtonPressed, { marginTop: 8 }]}
                  onPress={() => handleCardAnswer("warningLights")}
                >
                  <Text weight="bold" size="md" color="#FFFFFF">Done</Text>
                </Pressable>
              )}
            </View>
          );
        }
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Any dashboard warning lights on right now?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "no_all_clear", label: "No, all clear" },
                { id: "check_engine", label: "Yes, check engine" },
                { id: "other",        label: "Yes, something else" },
                { id: "not_sure",     label: "Not sure" },
              ]).map((opt) => {
                const isClear = opt.id === "no_all_clear" && warningLight === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[s.optionCard, warningLight === opt.id && s.optionCardActive, isClear && s.optionCardGood]}
                    onPress={() => {
                      setWarningLight(opt.id);
                      if (opt.id === "other") {
                        transitionToFollowUp("warningLights");
                      } else {
                        handleCardAnswer("warningLights");
                      }
                    }}
                  >
                    <Text weight={warningLight === opt.id ? "bold" : "semiBold"} size="md" color={warningLight === opt.id ? (isClear ? "#166534" : "#1E40AF") : "#1F2937"}>{opt.label}</Text>
                    {warningLight === opt.id && <Ionicons name="checkmark-circle" size={22} color={isClear ? "#22C55E" : "#5299FE"} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  // ── Render the service grid ─────────────────────────────────
  const renderServiceGrid = () => {
    const remaining = ALL_CARD_IDS.filter(id => !completedCards.has(id));

    if (remaining.length === 0) {
      return (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
          <LottieView
            source={require("@/assets/animations/success.json")}
            autoPlay
            loop={false}
            style={{ width: 160, height: 160 }}
          />
          <Text weight="bold" size="xl" color="#0F172A">You're all set!</Text>
          <Text weight="medium" size="md" color="#94A3B8">Your vehicle health score is ready.</Text>
        </View>
      );
    }

    return (
      <ReAnimated.View style={s.serviceGrid} layout={Layout.duration(400)}>
        {remaining.map((cardId) => {
          const cardData = SERVICE_CARDS[cardId];
          const isWarning = cardId === "warningLights";
          return (
            <ReAnimated.View
              key={cardId}
              layout={Layout.duration(400)}
              exiting={FadeOut.duration(200)}
              style={s.serviceCard}
            >
              <Pressable
                ref={(r) => { cardRefs.current[cardId] = r; }}
                style={({ pressed }) => [s.serviceCardInner, pressed && { opacity: 0.85 }]}
                onPress={() => handleCardTap(cardId)}
              >
                {isWarning ? (
                  <View style={s.warningIconBg}>
                    <AlertTriangle size={54} color="#F97316" strokeWidth={2} />
                  </View>
                ) : (
                  <Image source={SERVICE_CARD_IMAGES[cardId]} style={s.serviceCardImage} />
                )}
                <Text weight="semiBold" size="md" color="#1F2937" style={{ marginTop: isWarning ? -2 : -28 }}>{cardData.label}</Text>
              </Pressable>
            </ReAnimated.View>
          );
        })}
      </ReAnimated.View>
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
    const isExpanded = !!activeCard;
    return (
      <View ref={containerRef} style={s.steppingPage}>
        {/* Header — fades out during expansion */}
        <ReAnimated.View style={[s.steppingHeader, gridFadeStyle]}>
          <Text weight="bold" size="3xl" color="#0F172A">{meta.title}</Text>
          <Text weight="medium" size="md" color="#94A3B8" style={{ marginTop: 4 }}>{meta.subtitle}</Text>
        </ReAnimated.View>

        {/* Grid — fades out during expansion */}
        <ReAnimated.View style={[s.steppingBody, gridFadeStyle]}>
          {renderServiceGrid()}
        </ReAnimated.View>

        {/* Floating card (shared element transition) */}
        {activeCard && (
          <ReAnimated.View pointerEvents="none" style={[floatingCardStyle, s.floatingCard]}>
            {activeCard === "warningLights" ? (
              <View style={s.warningIconBg}>
                <AlertTriangle size={44} color="#F97316" strokeWidth={2} />
              </View>
            ) : (
              <Image source={SERVICE_CARD_IMAGES[activeCard]} style={s.serviceCardImage} />
            )}
            <Text weight="semiBold" size="md" color="#1F2937" style={{ marginTop: activeCard === "warningLights" ? -2 : -28 }}>
              {SERVICE_CARDS[activeCard].label}
            </Text>
          </ReAnimated.View>
        )}

        {/* Question content — fades in after expansion */}
        {showQuestion && activeCard && (
          <ReAnimated.View style={[s.questionOverlay, questionFadeStyle]}>
            <ReAnimated.View style={spacerAnimatedStyle} />
            <ScrollView style={s.questionContent} showsVerticalScrollIndicator={false} bounces={false}>
              {renderCardQuestion(activeCard)}
            </ScrollView>
          </ReAnimated.View>
        )}

        {/* Footer — hidden during expansion */}
        {!isExpanded && (
          <View style={[s.steppingFooter, { marginTop: 20, paddingBottom: insets.bottom + 24 }]}>
            <Pressable
              style={({ pressed }) => [s.nextButton, !canGoNext() && s.nextButtonDisabled, pressed && canGoNext() && s.nextButtonPressed]}
              onPress={isLast ? handleComplete : handleNext}
              disabled={!canGoNext() || saving}
            >
              <Text weight="bold" size="xl" color="#FFFFFF">
                {saving ? "Saving..." : isLast ? "Complete" : "Next"}
              </Text>
            </Pressable>
            {!canGoNext() && (
              <Pressable
                style={({ pressed }) => [s.finishForNowButton, pressed && { opacity: 0.7 }]}
                onPress={handleComplete}
                disabled={saving}
              >
                <Text weight="semiBold" size="md" color="#6B7280">Finish for now</Text>
              </Pressable>
            )}
          </View>
        )}
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
    marginTop: 0,
    marginBottom: -15,
  },
  steppingBody: {
    flex: 1,
  },
  steppingFooter: {
    paddingTop: 8,
    gap: 12,
    alignItems: "center",
  },
  finishForNowButton: {
    paddingVertical: 10,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: 16,
    width: "100%",
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonPressed: {
    opacity: 0.9,
  },

  // ── Form fields ──
  fieldGroup: {
    gap: 10,
  },
  chipColumn: {
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  optionCardActive: {
    backgroundColor: "rgba(82, 153, 254, 0.08)",
    borderColor: "#5299FE",
    borderWidth: 2,
  },
  optionCardGood: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderColor: "#22C55E",
    borderWidth: 2,
  },

  // ── Service grid ──
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  serviceCard: {
    width: "48%",
    aspectRatio: 1,
  },
  serviceCardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCardImage: {
    width: 160,
    height: 160,
    resizeMode: "contain",
  },
  warningIconBg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Floating card (shared element) ──
  floatingCard: {
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Question overlay (full-page, over grid) ──
  questionOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
  },
  questionContent: {
    flex: 1,
  },
});
