/**
 * CarInfoStepper
 *
 * PURPOSE: Inline stepper that collects 9 vehicle data points for non-Smartcar
 *          vehicles. Replaces the bottom-sheet wizard — renders in-place inside
 *          the scroll view with horizontal slide transitions between steps.
 *
 * PHASES:
 *   "intro"    — marketing card (benefits + Get Started CTA)
 *   "stepping"  — 9-step form with progress bar, Back/Next, carousel-like slides
 *   "complete"  — brief checkmark + "All set!" before parent success overlay
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
  TextInput,
  UIManager,
  View,
} from "react-native";
// DateTimePicker removed — we now use date-range option cards instead
import { useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/shared-ui";
import { FontFamily, FontSize, Spacing } from "@/constants/theme";
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
const TOTAL_STEPS = 9;
const SLIDE_DURATION = 300;
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

// Step metadata
const STEP_META: { title: string; subtitle: string }[] = [
  { title: "Current Mileage", subtitle: "Almost every service interval is mileage-based." },
  { title: "Average Monthly Driving", subtitle: "Helps us predict when services will be due." },
  { title: "Last Oil Change", subtitle: "Oil is the most common and predictable service." },
  { title: "Last Tire Service", subtitle: "Lets us estimate tire age and rotation schedule." },
  { title: "Last Brake Service", subtitle: "Brake pads typically last 30K\u201370K miles." },
  { title: "Battery Install Date", subtitle: "Car batteries last 3\u20135 years on average." },
  { title: "Last State Inspection", subtitle: "We\u2019ll set a 12-month reminder for you." },
  { title: "Driving Conditions", subtitle: "Adjusts service intervals for your driving style." },
  { title: "Any Known Issues?", subtitle: "Helps us flag things that need attention right now." },
];

const KNOWN_ISSUE_OPTIONS = [
  { id: "check_engine", label: "Check engine light on" },
  { id: "weird_noise", label: "Weird noise" },
  { id: "something_off", label: "Something feels off" },
  { id: "all_good", label: "All good" },
] as const;

const LAYOUT_ANIM_CONFIG = LayoutAnimation.create(
  200,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.scaleY,
);

/** Date-range options shown instead of a calendar picker */
const DATE_RANGE_OPTIONS = [
  { id: "lt6m", label: "Less than 6 months ago" },
  { id: "6m1y", label: "6 months to a year ago" },
  { id: "gt1y", label: "Over a year ago" },
  { id: "never", label: "Don't know / Never" },
] as const;

type DateRangeId = (typeof DATE_RANGE_OPTIONS)[number]["id"];

/** Convert a selected range into an approximate past timestamp */
function dateRangeToTimestamp(range: DateRangeId): number | undefined {
  const now = Date.now();
  const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
  switch (range) {
    case "lt6m":
      return now - 3 * MS_PER_MONTH;
    case "6m1y":
      return now - 9 * MS_PER_MONTH;
    case "gt1y":
      return now - 18 * MS_PER_MONTH;
    case "never":
      return undefined;
  }
}

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

  // ── Form state (persists across steps) ──────────────────────
  const [currentMileage, setCurrentMileage] = useState("");
  const [avgMonthlyDriving, setAvgMonthlyDriving] = useState<string>("");

  const [oilDateRange, setOilDateRange] = useState<DateRangeId | null>(null);
  const [oilMileage, setOilMileage] = useState("");
  const [oilDontRemember, setOilDontRemember] = useState(false);

  const [tireType, setTireType] = useState<string>("");
  const [tireDateRange, setTireDateRange] = useState<DateRangeId | null>(null);

  const [brakeDateRange, setBrakeDateRange] = useState<DateRangeId | null>(null);

  const [batteryDateRange, setBatteryDateRange] = useState<DateRangeId | null>(null);
  const [batteryOriginal, setBatteryOriginal] = useState(false);

  const [inspectionDateRange, setInspectionDateRange] = useState<DateRangeId | null>(null);

  const [drivingConditions, setDrivingConditions] = useState<string>("");

  const [knownIssues, setKnownIssues] = useState<Set<string>>(new Set());
  const [knownIssuesFreeText, setKnownIssuesFreeText] = useState("");

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
  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 0: return !!currentMileage && parseFloat(currentMileage) > 0;
      case 1: return !!avgMonthlyDriving;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      case 6: return true;
      case 7: return !!drivingConditions;
      case 8: return knownIssues.size > 0;
      default: return false;
    }
  }, [step, currentMileage, avgMonthlyDriving, drivingConditions, knownIssues]);

  const handleGetStarted = useCallback(() => {
    animateSlide("forward", "stepping", 0);
  }, [animateSlide]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      animateSlide("forward", null, step + 1);
    }
  }, [step, animateSlide]);

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
    // Signal parent immediately BEFORE saves so it blocks content rendering
    // before any Convex subscription update can flip isOnboardingComplete
    onComplete();
    try {
      await saveField({ vehicleOwnerId, field: "mileage", value: parseFloat(currentMileage) });
      await saveField({ vehicleOwnerId, field: "avgMonthlyDriving", value: avgMonthlyDriving });
      await saveField({ vehicleOwnerId, field: "oil", value: { date: oilDateRange ? dateRangeToTimestamp(oilDateRange) : undefined, mileage: oilMileage ? parseFloat(oilMileage) : undefined } });
      await saveField({ vehicleOwnerId, field: "tires", value: { type: tireType || "dont_remember", date: tireDateRange ? dateRangeToTimestamp(tireDateRange) : undefined } });
      await saveField({ vehicleOwnerId, field: "brakes", value: { date: brakeDateRange ? dateRangeToTimestamp(brakeDateRange) : undefined } });
      await saveField({ vehicleOwnerId, field: "battery", value: { date: batteryDateRange && !batteryOriginal ? dateRangeToTimestamp(batteryDateRange) : undefined, isOriginal: batteryOriginal || undefined, modelYear: vehicleYear || undefined } });
      if (inspectionDateRange) {
        await saveField({ vehicleOwnerId, field: "inspection", value: { date: dateRangeToTimestamp(inspectionDateRange) } });
      }
      await saveField({ vehicleOwnerId, field: "drivingConditions", value: drivingConditions });
      const issuesArr = [...knownIssues];
      if (knownIssuesFreeText.trim()) issuesArr.push(knownIssuesFreeText.trim());
      await saveField({ vehicleOwnerId, field: "knownIssues", value: issuesArr });
    } catch (err) {
      console.error("[CarInfoStepper] Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [
    vehicleOwnerId, currentMileage, avgMonthlyDriving,
    oilDateRange, oilMileage, tireType, tireDateRange,
    brakeDateRange, batteryDateRange, batteryOriginal,
    vehicleYear, inspectionDateRange, drivingConditions,
    knownIssues, knownIssuesFreeText,
    saveField, onComplete, animateSlide,
  ]);

  const toggleIssue = (id: string) => {
    setKnownIssues((prev) => {
      const next = new Set(prev);
      if (id === "all_good") {
        if (next.has("all_good")) { next.delete("all_good"); } else { next.clear(); next.add("all_good"); }
      } else {
        next.delete("all_good");
        if (next.has(id)) { next.delete(id); } else { next.add(id); }
      }
      return next;
    });
  };

  // ── Render step content (verbatim from wizard) ──────────────
  const renderStepContent = (stepIdx: number) => {
    switch (stepIdx) {
      case 0:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">What is your current mileage?</Text>
            <View style={s.inputRow}>
              <TextInput style={s.textInput} value={currentMileage} onChangeText={setCurrentMileage} placeholder="67,450" placeholderTextColor="rgba(0,0,0,0.3)" keyboardType="numeric" />
              <Text size="sm" color="rgba(0,0,0,0.4)" style={s.inputSuffix}>mi</Text>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">How much do you drive per month?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "light", label: "Light", desc: "Under 500 mi/month" },
                { id: "average", label: "Average", desc: "500\u20131,000 mi/month" },
                { id: "heavy", label: "Heavy", desc: "Over 1,000 mi/month" },
              ] as const).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, avgMonthlyDriving === opt.id && s.optionCardActive]} onPress={() => setAvgMonthlyDriving(opt.id)}>
                  <View style={s.optionCardContent}>
                    <Text weight={avgMonthlyDriving === opt.id ? "bold" : "semiBold"} size="md" color={avgMonthlyDriving === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                    <Text weight="medium" size="sm" color={avgMonthlyDriving === opt.id ? "#5299FE" : "#6B7280"}>{opt.desc}</Text>
                  </View>
                  {avgMonthlyDriving === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When was your last oil change?</Text>
            <View style={s.chipColumn}>
              {DATE_RANGE_OPTIONS.map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, oilDateRange === opt.id && s.optionCardActive]} onPress={() => setOilDateRange(opt.id)}>
                  <Text weight={oilDateRange === opt.id ? "bold" : "semiBold"} size="md" color={oilDateRange === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {oilDateRange === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
            {oilDateRange && oilDateRange !== "never" && !oilDontRemember && (
              <View style={[s.fieldGroup, { marginTop: 16 }]}>
                <Text weight="semiBold" size="md" color="#1F2937">Mileage at last oil change</Text>
                <View style={s.inputRow}>
                  <TextInput style={s.textInput} value={oilMileage} onChangeText={setOilMileage} placeholder="e.g. 62000" placeholderTextColor="rgba(0,0,0,0.3)" keyboardType="numeric" />
                  <Text size="sm" color="rgba(0,0,0,0.4)" style={s.inputSuffix}>mi</Text>
                </View>
              </View>
            )}
            {oilDateRange && oilDateRange !== "never" && (
              <Pressable style={s.toggleChip} onPress={() => { setOilDontRemember(!oilDontRemember); if (!oilDontRemember) setOilMileage(""); }}>
                <Ionicons name={oilDontRemember ? "checkbox" : "square-outline"} size={20} color={oilDontRemember ? "#5299FE" : "#9CA3AF"} />
                <Text weight="medium" size="sm" color={oilDontRemember ? "#5299FE" : "#6B7280"}>I don&apos;t remember the mileage</Text>
              </Pressable>
            )}
          </View>
        );

      case 3:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">What was your last tire service?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "rotation", label: "Tire Rotation" },
                { id: "new_tires", label: "New Tires Installed" },
                { id: "dont_remember", label: "Don\u2019t Remember / Never" },
              ] as const).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, tireType === opt.id && s.optionCardActive]} onPress={() => setTireType(opt.id)}>
                  <Text weight={tireType === opt.id ? "bold" : "semiBold"} size="md" color={tireType === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {tireType === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
            {(tireType === "rotation" || tireType === "new_tires") && (
              <View style={[s.fieldGroup, { marginTop: 16 }]}>
                <Text weight="semiBold" size="md" color="#1F2937">When was this done?</Text>
                <View style={s.chipColumn}>
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <Pressable key={opt.id} style={[s.optionCard, tireDateRange === opt.id && s.optionCardActive]} onPress={() => setTireDateRange(opt.id)}>
                      <Text weight={tireDateRange === opt.id ? "bold" : "semiBold"} size="md" color={tireDateRange === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                      {tireDateRange === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        );

      case 4:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When were your brakes last serviced?</Text>
            <View style={s.chipColumn}>
              {DATE_RANGE_OPTIONS.map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, brakeDateRange === opt.id && s.optionCardActive]} onPress={() => setBrakeDateRange(opt.id)}>
                  <Text weight={brakeDateRange === opt.id ? "bold" : "semiBold"} size="md" color={brakeDateRange === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {brakeDateRange === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 5:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When was your battery installed?</Text>
            {!batteryOriginal && (
              <View style={s.chipColumn}>
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <Pressable key={opt.id} style={[s.optionCard, batteryDateRange === opt.id && s.optionCardActive]} onPress={() => setBatteryDateRange(opt.id)}>
                    <Text weight={batteryDateRange === opt.id ? "bold" : "semiBold"} size="md" color={batteryDateRange === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                    {batteryDateRange === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable style={s.toggleChip} onPress={() => { setBatteryOriginal(!batteryOriginal); if (!batteryOriginal) setBatteryDateRange(null); }}>
              <Ionicons name={batteryOriginal ? "checkbox" : "square-outline"} size={20} color={batteryOriginal ? "#5299FE" : "#9CA3AF"} />
              <Text weight="medium" size="sm" color={batteryOriginal ? "#5299FE" : "#6B7280"}>Original battery (came with the car)</Text>
            </Pressable>
            {batteryOriginal && vehicleYear > 0 && (
              <Text size="xs" color="#9CA3AF" style={{ marginTop: 4 }}>We&apos;ll estimate based on your {vehicleYear} model year.</Text>
            )}
          </View>
        );

      case 6:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When was your last state inspection?</Text>
            <View style={s.chipColumn}>
              {DATE_RANGE_OPTIONS.map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, inspectionDateRange === opt.id && s.optionCardActive]} onPress={() => setInspectionDateRange(opt.id)}>
                  <Text weight={inspectionDateRange === opt.id ? "bold" : "semiBold"} size="md" color={inspectionDateRange === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                  {inspectionDateRange === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 7:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">What are your typical driving conditions?</Text>
            <View style={s.chipColumn}>
              {([
                { id: "city", label: "Mostly City", desc: "Stop-and-go, short trips", icon: "business" as const },
                { id: "highway", label: "Mostly Highway", desc: "Long stretches, steady speed", icon: "car" as const },
                { id: "mixed", label: "Mixed", desc: "A bit of both", icon: "swap-horizontal" as const },
              ] as const).map((opt) => (
                <Pressable key={opt.id} style={[s.optionCard, drivingConditions === opt.id && s.optionCardActive]} onPress={() => setDrivingConditions(opt.id)}>
                  <View style={s.optionCardContent}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name={opt.icon} size={20} color="#5299FE" />
                      <Text weight={drivingConditions === opt.id ? "bold" : "semiBold"} size="md" color={drivingConditions === opt.id ? "#1E40AF" : "#1F2937"}>{opt.label}</Text>
                    </View>
                    <Text weight="medium" size="sm" color={drivingConditions === opt.id ? "#5299FE" : "#6B7280"}>{opt.desc}</Text>
                  </View>
                  {drivingConditions === opt.id && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 8:
        return (
          <View style={s.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Any known issues right now?</Text>
            <View style={s.chipColumn}>
              {KNOWN_ISSUE_OPTIONS.map((opt) => {
                const selected = knownIssues.has(opt.id);
                const isGood = opt.id === "all_good" && selected;
                return (
                  <Pressable key={opt.id} style={[s.optionCard, selected && s.optionCardActive, isGood && s.optionCardGood]} onPress={() => toggleIssue(opt.id)}>
                    <Text weight={selected ? "bold" : "semiBold"} size="md" color={selected ? (isGood ? "#166534" : "#1E40AF") : "#1F2937"}>{opt.label}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={isGood ? "#22C55E" : "#5299FE"} />}
                  </Pressable>
                );
              })}
            </View>
            {!knownIssues.has("all_good") && (
              <View style={[s.fieldGroup, { marginTop: 12 }]}>
                <Text weight="medium" size="sm" color="#6B7280">Anything else? (optional)</Text>
                <TextInput style={[s.textInput, s.inputRowBorder]} value={knownIssuesFreeText} onChangeText={setKnownIssuesFreeText} placeholder="Describe any issues..." placeholderTextColor="rgba(0,0,0,0.3)" multiline numberOfLines={3} />
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // ── Render intro content ────────────────────────────────────
  const displayName = vehicleMake && vehicleModel ? `${vehicleMake} ${vehicleModel}` : "Your Vehicle";

  const renderIntro = () => (
    <View style={s.introContent}>
      <View style={s.iconContainer}>
        <Ionicons name="clipboard-outline" size={32} color="#5299FE" />
      </View>
      <Text weight="bold" size="lg" color="#1F2937" style={s.introTitle}>
        Tell us about your {displayName}
      </Text>
      <Text weight="medium" size="sm" color="#6B7280" style={s.introSubtitle}>
        Answer a few quick questions to unlock your vehicle health score and maintenance tracking.
      </Text>
      <View style={s.benefitsList}>
        {["Personalized maintenance schedule", "Service due date predictions", "Vehicle health score"].map((b) => (
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
      <Text weight="medium" size="xs" color="#9CA3AF" style={{ marginTop: 10 }}>Takes about 2 minutes</Text>
    </View>
  );

  // ── Render stepping content ─────────────────────────────────
  const renderStepping = (forStep: number) => {
    const isLast = forStep === TOTAL_STEPS - 1;
    const meta = STEP_META[forStep];
    return (
      <View>
        {/* Header with close button */}
        <View style={s.stepHeader}>
          <View style={{ flex: 1 }}>
            <View style={s.progressContainer}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${((forStep + 1) / TOTAL_STEPS) * 100}%` }]} />
              </View>
              <Text weight="medium" size="xs" color="#9CA3AF">Step {forStep + 1} of {TOTAL_STEPS}</Text>
            </View>
            <Text weight="bold" size="lg" color="#1F2937" style={{ marginTop: 12 }}>{meta.title}</Text>
            <Text weight="medium" size="sm" color="#6B7280" style={{ marginTop: 2 }}>{meta.subtitle}</Text>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={12} style={s.closeButton}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Step content */}
        <View style={s.stepBody}>
          {renderStepContent(forStep)}
        </View>

        {/* Footer */}
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
          {forStep >= 2 && forStep <= 6 && (
            <Pressable style={({ pressed }) => [s.skipButton, pressed && { opacity: 0.7 }]} onPress={handleNext}>
              <Text weight="medium" size="sm" color="#9CA3AF">Skip this step</Text>
            </Pressable>
          )}
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
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  // ── Form fields ──
  fieldGroup: {
    gap: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputRowBorder: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    minHeight: 80,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: "#1F2937",
    paddingVertical: 14,
  },
  inputSuffix: {
    marginLeft: 6,
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
  optionCardContent: {
    flex: 1,
    gap: 2,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
});
