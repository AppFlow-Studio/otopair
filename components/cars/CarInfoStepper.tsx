/**
 * CarInfoStepper — Quick Read Flow
 *
 * PURPOSE: Post-onboarding vehicle condition check. Captures brake health,
 *          tire status, and warning light data in 5–8 taps (~30s). Branching
 *          logic adds conditional follow-up questions based on answers.
 *
 * PHASES:
 *   "intro"    — marketing card (benefits + Get Started CTA)
 *   "stepping"  — 5–8 step form with progress bar, Back/Next, carousel-like slides
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/shared-ui";
import { Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_CARD_WIDTH = SCREEN_WIDTH - 80;

// ============================================================================
// TYPES
// ============================================================================

interface CarInfoStepperProps {
  vehicleOwnerId: Id<"vehicle_owners">;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  onComplete: () => void;
}

type Phase = "intro" | "stepping";

type StepId =
  | "brakeLastDone"
  | "brakeFeel"
  | "brakeAction"
  | "tireReplaced"
  | "tireReplacedWhen"
  | "tireRepaired"
  | "warningLight"
  | "warningLightType";

type BrakeLastDone = "within_6m" | "6m_to_1y" | "over_1y" | "never_on_this_car" | "dont_know";
type BrakeFeel = "normal" | "squeak" | "soft_slow" | "not_noticed";
type BrakeAction = "waiting_quote" | "not_scheduled" | "no_not_yet";
type TireReplaced = "yes_new" | "original" | "dont_know";
type TireReplacedWhen = "within_6m" | "6m_to_1y" | "1_to_2y" | "over_2y";
type TireRepaired = "yes" | "no" | "not_sure";
type WarningLight = "no_all_clear" | "check_engine" | "different_light" | "not_sure";
type WarningLightType = "tpms" | "battery_charging" | "temperature" | "oil_pressure" | "abs" | "airbag_srs" | "transmission" | "not_sure_which";

const STEP_META: Record<StepId, { title: string; subtitle: string }> = {
  brakeLastDone:     { title: "Brakes", subtitle: "Helps us estimate brake pad life from your history." },
  brakeFeel:         { title: "Brakes", subtitle: "Symptoms help separate normal wear from other issues." },
  brakeAction:       { title: "Brakes", subtitle: "Let\u2019s help you get this handled." },
  tireReplaced:      { title: "Tires", subtitle: "Helps us estimate tread life accurately." },
  tireReplacedWhen:  { title: "Tires", subtitle: "We\u2019ll project when replacements may be needed." },
  tireRepaired:      { title: "Tires", subtitle: "A repaired tire has a different lifespan than an intact one." },
  warningLight:      { title: "Warning Lights", subtitle: "Active warnings change what we recommend first." },
  warningLightType:  { title: "Warning Lights", subtitle: "Helps us route to the right diagnostic." },
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

const LAYOUT_ANIM_CONFIG = LayoutAnimation.create(
  200,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.scaleY,
);

// ============================================================================
// COMPONENT
// ============================================================================

export default function CarInfoStepper({
  vehicleOwnerId,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  onComplete,
}: CarInfoStepperProps) {
  const saveField = useMutation(api.vehicles.saveOnboardingField);

  // ── Phase & step state ──────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Slide animation ─────────────────────────────────────────
  const slideX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);

  // ── Quick Read form state ───────────────────────────────────
  const [brakeLastDone, setBrakeLastDone] = useState<BrakeLastDone | null>(null);
  const [brakeFeel, setBrakeFeel] = useState<BrakeFeel | null>(null);
  const [brakeAction, setBrakeAction] = useState<BrakeAction | null>(null);
  const [tireReplaced, setTireReplaced] = useState<TireReplaced | null>(null);
  const [tireReplacedWhen, setTireReplacedWhen] = useState<TireReplacedWhen | null>(null);
  const [tireRepaired, setTireRepaired] = useState<TireRepaired | null>(null);
  const [warningLight, setWarningLight] = useState<WarningLight | null>(null);
  const [warningLightTypes, setWarningLightTypes] = useState<WarningLightType[]>([]);

  // ── Dynamic step list (branching logic) ─────────────────────
  const steps: StepId[] = (() => {
    const ordered: StepId[] = ["brakeLastDone", "brakeFeel"];
    if (brakeFeel === "soft_slow") ordered.push("brakeAction");
    ordered.push("tireReplaced");
    if (tireReplaced === "yes_new") ordered.push("tireReplacedWhen");
    ordered.push("tireRepaired", "warningLight");
    if (warningLight === "different_light") ordered.push("warningLightType");
    return ordered;
  })();

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

      // Phase 1: slide current content out (fast)
      Animated.timing(slideX, {
        toValue: exitTo,
        duration: 120,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // Swap content
        LayoutAnimation.configureNext(LAYOUT_ANIM_CONFIG);
        if (newPhase !== null) setPhase(newPhase);
        if (newStep !== null) setStep(newStep);

        // Phase 2: slide new content in (slightly slower for deceleration feel)
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
      case "brakeLastDone":    return brakeLastDone !== null;
      case "brakeFeel":        return brakeFeel !== null;
      case "brakeAction":      return brakeAction !== null;
      case "tireReplaced":     return tireReplaced !== null;
      case "tireReplacedWhen": return tireReplacedWhen !== null;
      case "tireRepaired":     return tireRepaired !== null;
      case "warningLight":     return warningLight !== null;
      case "warningLightType": return warningLightTypes.length > 0;
      default: return false;
    }
  }, [currentStepId, brakeLastDone, brakeFeel, brakeAction, tireReplaced, tireReplacedWhen, tireRepaired, warningLight, warningLightTypes]);

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

  // ── Complete handler ────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    setSaving(true);
    onComplete();
    try {
      await saveField({
        vehicleOwnerId,
        field: "brakes",
        value: {
          lastDone: brakeLastDone,
          feel: brakeFeel,
          actionStatus: brakeAction ?? undefined,
        },
      });
      await saveField({
        vehicleOwnerId,
        field: "tires",
        value: {
          replaced: tireReplaced,
          replacedWhen: tireReplacedWhen ?? undefined,
          repaired: tireRepaired,
        },
      });
      await saveField({
        vehicleOwnerId,
        field: "warningLights",
        value: {
          status: warningLight,
          lightTypes: warningLightTypes.length > 0 ? warningLightTypes : undefined,
        },
      });
    } catch (err) {
      console.error("[CarInfoStepper] Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [
    vehicleOwnerId, brakeLastDone, brakeFeel, brakeAction,
    tireReplaced, tireReplacedWhen, tireRepaired,
    warningLight, warningLightTypes,
    saveField, onComplete,
  ]);

  // ── Render step content ──────────────────────────────────────
  const renderStepContent = (stepId: StepId) => {
    switch (stepId) {
      case "brakeLastDone":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When were your brakes last done?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "within_6m" as const, label: "Within the last 6 months" },
                { id: "6m_to_1y" as const, label: "6 months to a year ago" },
                { id: "over_1y" as const, label: "Over a year ago" },
                { id: "never_on_this_car" as const, label: "I\u2019ve never had them done on this car" },
                { id: "dont_know" as const, label: "I don\u2019t know" },
              ]).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, brakeLastDone === opt.id && s.optionCardActive]} onPress={() => setBrakeLastDone(opt.id)}>
                  <Text weight={brakeLastDone === opt.id ? "bold" : "semiBold"} size="md" color={brakeLastDone === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {brakeLastDone === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "brakeFeel":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">How do your brakes feel right now?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "normal" as const, label: "They feel normal" },
                { id: "squeak" as const, label: "They squeak or make noise" },
                { id: "soft_slow" as const, label: "They feel soft or take longer to stop" },
                { id: "not_noticed" as const, label: "I haven\u2019t noticed anything either way" },
              ]).map((opt) => {
                const isNormal = opt.id === "normal" && brakeFeel === opt.id;
                return (
                  <Pressable key={opt.id} style={[s.optionCard, brakeFeel === opt.id && s.optionCardActive, isNormal && s.optionCardGood]} onPress={() => setBrakeFeel(opt.id)}>
                    <Text weight={brakeFeel === opt.id ? "bold" : "semiBold"} size="md" color={brakeFeel === opt.id ? (isNormal ? "#166534" : "#1E40AF") : "#1F2937"}>{opt.label}</Text>
                    {brakeFeel === opt.id && <Ionicons name="checkmark-circle" size={22} color={isNormal ? "#22C55E" : "#5299FE"} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case "brakeAction":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Have you had them looked at yet?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "waiting_quote" as const, label: "Yes, waiting on a quote" },
                { id: "not_scheduled" as const, label: "Yes, but haven\u2019t scheduled yet" },
                { id: "no_not_yet" as const, label: "No, not yet" },
              ]).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, brakeAction === opt.id && s.optionCardActive]} onPress={() => setBrakeAction(opt.id)}>
                  <Text weight={brakeAction === opt.id ? "bold" : "semiBold"} size="md" color={brakeAction === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {brakeAction === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "tireReplaced":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Have your tires been replaced on this car?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "yes_new" as const, label: "Yes, I put new tires on" },
                { id: "original" as const, label: "No, they\u2019re the original tires" },
                { id: "dont_know" as const, label: "I don\u2019t know (I bought it this way)" },
              ]).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, tireReplaced === opt.id && s.optionCardActive]} onPress={() => setTireReplaced(opt.id)}>
                  <Text weight={tireReplaced === opt.id ? "bold" : "semiBold"} size="md" color={tireReplaced === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {tireReplaced === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "tireReplacedWhen":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Roughly when?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "within_6m" as const, label: "Within the last 6 months" },
                { id: "6m_to_1y" as const, label: "6 months to a year ago" },
                { id: "1_to_2y" as const, label: "1 to 2 years ago" },
                { id: "over_2y" as const, label: "Over 2 years ago" },
              ]).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, tireReplacedWhen === opt.id && s.optionCardActive]} onPress={() => setTireReplacedWhen(opt.id)}>
                  <Text weight={tireReplacedWhen === opt.id ? "bold" : "semiBold"} size="md" color={tireReplacedWhen === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {tireReplacedWhen === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "tireRepaired":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Have any of your tires been repaired? (Patched, plugged, etc.)</Text>
            <View style={s.chipColumn}>
              {([
                { id: "yes" as const, label: "Yes" },
                { id: "no" as const, label: "No" },
                { id: "not_sure" as const, label: "I\u2019m not sure" },
              ]).map((opt) => {
                const isNo = opt.id === "no" && tireRepaired === opt.id;
                return (
                  <Pressable key={opt.id} style={[s.optionCard, tireRepaired === opt.id && s.optionCardActive, isNo && s.optionCardGood]} onPress={() => setTireRepaired(opt.id)}>
                    <Text weight={tireRepaired === opt.id ? "bold" : "semiBold"} size="md" color={tireRepaired === opt.id ? (isNo ? "#166534" : "#1E40AF") : "#1F2937"}>{opt.label}</Text>
                    {tireRepaired === opt.id && <Ionicons name="checkmark-circle" size={22} color={isNo ? "#22C55E" : "#5299FE"} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case "warningLight":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Is your car showing any dashboard warning lights right now?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "no_all_clear" as const, label: "No, all clear" },
                { id: "check_engine" as const, label: "Yes, check engine light" },
                { id: "different_light" as const, label: "Yes, a different warning light" },
                { id: "not_sure" as const, label: "There might be, I\u2019m not sure" },
              ]).map((opt) => {
                const isClear = opt.id === "no_all_clear" && warningLight === opt.id;
                return (
                  <Pressable key={opt.id} style={[s.optionCard, warningLight === opt.id && s.optionCardActive, isClear && s.optionCardGood]} onPress={() => setWarningLight(opt.id)}>
                    <Text weight={warningLight === opt.id ? "bold" : "semiBold"} size="md" color={warningLight === opt.id ? (isClear ? "#166534" : "#1E40AF") : "#1F2937"}>{opt.label}</Text>
                    {warningLight === opt.id && <Ionicons name="checkmark-circle" size={22} color={isClear ? "#22C55E" : "#5299FE"} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case "warningLightType":
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Which ones? Select all that apply.</Text>
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
          </View>
        );

      default:
        return null;
    }
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
      <View>
        <View style={s.stepHeader}>
          <View style={{ flex: 1 }}>
            <View style={s.progressContainer}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${((forStep + 1) / totalSteps) * 100}%` }]} />
              </View>
              <Text weight="medium" size="xs" color="#9CA3AF">{forStep + 1} of {totalSteps}</Text>
            </View>
            <Text weight="bold" size="lg" color="#1F2937" style={{ marginTop: 12 }}>{meta.title}</Text>
            <Text weight="medium" size="sm" color="#6B7280" style={{ marginTop: 2 }}>{meta.subtitle}</Text>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={12} style={s.closeButton}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={s.stepBody}>
          {renderStepContent(stepId)}
        </View>

        <View style={s.footer}>
          <View style={s.footerButtons}>
            {forStep > 0 ? (
              <Pressable style={({ pressed }) => [s.backButton, pressed && { opacity: 0.7 }]} onPress={handleBack}>
                <Ionicons name="arrow-back" size={18} color="#6B7280" />
                <Text weight="semiBold" size="md" color="#6B7280">Back</Text>
              </Pressable>
            ) : (
              <View style={{ width: 80 }} />
            )}
            <Pressable
              style={({ pressed }) => [s.nextButton, !canGoNext() && s.nextButtonDisabled, pressed && canGoNext() && s.nextButtonPressed]}
              onPress={isLast ? handleComplete : handleNext}
              disabled={!canGoNext() || saving}
            >
              <Text weight="bold" size="md" color="#FFFFFF">
                {saving ? "Saving..." : isLast ? "Complete" : "Next"}
              </Text>
              {!isLast && !saving && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
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
      <LinearGradient
        colors={["#F0F4FF", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.card}
      >
        <View
          style={s.slideClip}
          onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View style={{ transform: [{ translateX: slideX }] }}>
            {renderForPhase(phase, step)}
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.15)",
  },
  slideClip: {
    overflow: "hidden",
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

  // ── Stepping ──
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5299FE",
    borderRadius: 2,
  },
  stepBody: {
    marginBottom: 16,
  },

  // ── Footer ──
  footer: {
    alignItems: "center",
  },
  footerButtons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: 16,
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: Spacing.md,
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
});
