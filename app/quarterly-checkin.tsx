import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FooterButton, Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WARNING_LIGHT_TYPE_OPTIONS = [
  { value: "tpms",             label: "Tire pressure (TPMS)" },
  { value: "battery_charging", label: "Battery / charging" },
  { value: "temperature",      label: "Temperature / overheating" },
  { value: "oil_pressure",     label: "Oil pressure" },
  { value: "abs",              label: "ABS / braking system" },
  { value: "airbag_srs",       label: "Airbag / SRS" },
  { value: "transmission",     label: "Transmission" },
  { value: "not_sure_which",   label: "Not sure which one" },
];

type Answers = Record<string, string | string[]>;

/** Props for embedding the check-in inline (e.g. inside a Modal over
 *  the booking sheet, where router.push doesn't navigate reliably).
 *  When omitted, the screen falls back to its route params. */
interface QuarterlyCheckinProps {
  vehicleOwnerId?: Id<"vehicle_owners">;
  vehicleName?: string;
  /** Called instead of `router.back()` — lets the embedder dismiss its
   *  containing Modal. Also fired after a successful submit when
   *  `returnTo === "booking"` so the booking sheet auto-resumes. */
  onClose?: () => void;
}

export default function QuarterlyCheckinScreen(props: QuarterlyCheckinProps = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    vehicleOwnerId: string;
    vehicleName?: string;
    returnTo?: string;
  }>();
  const vehicleOwnerId =
    props.vehicleOwnerId ?? (params.vehicleOwnerId as Id<"vehicle_owners">);
  const vehicleNameFromProps = props.vehicleName ?? params.vehicleName;
  const returnToBooking = params.returnTo === "booking" || props.onClose != null;
  const dismiss = useCallback(() => {
    if (props.onClose) props.onClose();
    else router.back();
  }, [props, router]);

  const questionSet = useQuery(api.checkin.getCheckinQuestionSet, { vehicleOwnerId });

  const startCheckin = useMutation(api.checkin.startCheckin);
  const completeCheckin = useMutation(api.checkin.completeCheckin);

  const [checkinId, setCheckinId] = useState<Id<"vehicle_checkins"> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [modeTransitioned, setModeTransitioned] = useState(false);
  const [symptomsText, setSymptomsText] = useState("");
  const [mileageInput, setMileageInput] = useState("");
  const [warningConcernChoice, setWarningConcernChoice] = useState<string | null>(null);
  const [warningLightTypes, setWarningLightTypes] = useState<string[]>([]);

  const scrollRef = useRef<ScrollView>(null);

  // Filter questions based on conditional logic
  type CheckinQuestion = NonNullable<typeof questionSet>["questions"][number];
  type CheckinOption = NonNullable<CheckinQuestion["options"]>[number];
  const visibleQuestions = useMemo(() => {
    if (!questionSet?.questions) return [];
    return questionSet.questions.filter((q: CheckinQuestion) => {
      // Q5 is absorbed into Q4's inline rendering
      if (q.id === "Q5") return false;
      // Q6 only shown for endurance and weekend modes
      if (q.id === "Q6") {
        return (
          questionSet.mode === "owned_endurance" ||
          questionSet.mode === "owned_weekend"
        );
      }
      // Q3 conditional: only show when Q2 has services reported
      if (q.conditionalOn) {
        const priorAnswer = answers[q.conditionalOn.questionId];
        if (q.conditionalOn.notEqual) {
          if (Array.isArray(priorAnswer)) {
            return !priorAnswer.includes(q.conditionalOn.notEqual);
          }
          return priorAnswer !== q.conditionalOn.notEqual;
        }
      }
      // Q9_detail: only show when Q9 = "different"
      if (q.id === "Q9_detail") {
        return answers.Q9 === "different";
      }
      // Q10_role: only show when Q10 = "changed"
      if (q.id === "Q10_role") {
        return answers.Q10 === "changed";
      }
      return true;
    });
  }, [questionSet?.questions, questionSet?.mode, answers]);

  const currentQuestion = visibleQuestions[currentIndex];
  const isLast = currentIndex === visibleQuestions.length - 1;
  const progress = visibleQuestions.length > 0
    ? (currentIndex + 1) / visibleQuestions.length
    : 0;

  const handleStart = useCallback(async () => {
    try {
      const result = await startCheckin({ vehicleOwnerId });
      setCheckinId(result.checkinId);
      if (questionSet?.projectedMileage) {
        setMileageInput(questionSet.projectedMileage.toString());
      }
    } catch (e) {
      console.error("Failed to start check-in:", e);
    }
  }, [startCheckin, vehicleOwnerId, questionSet?.projectedMileage]);

  const setAnswer = useCallback((questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleMultiSelect = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) ?? [];
      if (value === "none") return { ...prev, [questionId]: ["none"] };
      const filtered = current.filter((v) => v !== "none");
      if (filtered.includes(value)) {
        return { ...prev, [questionId]: filtered.filter((v) => v !== value) };
      }
      return { ...prev, [questionId]: [...filtered, value] };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const isOptional = currentQuestion?.visibility === "optional";

  const canAdvance = useMemo(() => {
    if (!currentQuestion) return false;
    const qId = currentQuestion.id;
    if (qId === "Q1") return mileageInput.length > 0 && !isNaN(Number(mileageInput));
    if (qId === "Q4") return warningConcernChoice !== null;
    const answer = answers[qId];
    if (!answer) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    return answer.length > 0;
  }, [currentQuestion, answers, mileageInput, warningConcernChoice]);

  const handleSkip = useCallback(async () => {
    if (!currentQuestion) return;
    if (isLast) {
      await handleSubmit();
    } else {
      setCurrentIndex((i) => i + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [currentQuestion, isLast]);

  const handleNext = useCallback(async () => {
    if (!currentQuestion) return;

    // Save Q1 mileage into answers
    if (currentQuestion.id === "Q1") {
      setAnswer("Q1", mileageInput);
    }

    if (isLast) {
      await handleSubmit();
    } else {
      setCurrentIndex((i) => i + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [currentQuestion, isLast, mileageInput]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      dismiss();
    }
  }, [currentIndex, dismiss]);

  const handleSubmit = useCallback(async () => {
    if (!checkinId || submitting) return;
    setSubmitting(true);
    try {
      const allAnswers = { ...answers };
      if (symptomsText) allAnswers.Q5_text = symptomsText;

      const mileage = Number(mileageInput) || 0;
      await completeCheckin({
        checkinId,
        vehicleOwnerId,
        answers: allAnswers,
        mileageReported: mileage,
      });
      const didTransition =
        allAnswers.Q7 === "bought_out" || allAnswers.Q10 === "changed";
      setModeTransitioned(didTransition);
      setCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // When the user was forced here by the booking gate, skip the
      // celebration screen and pop straight back so the ServiceBottomSheet
      // can auto-advance to the next stage as soon as Convex reactivity
      // reports the check-in is on file.
      if (returnToBooking) {
        dismiss();
      }
    } catch (e) {
      console.error("Failed to complete check-in:", e);
    } finally {
      setSubmitting(false);
    }
  }, [checkinId, answers, mileageInput, symptomsText, completeCheckin, vehicleOwnerId, submitting, returnToBooking, dismiss]);

  // ── Loading state ──
  if (!questionSet) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BrandColors.secondary} />
      </View>
    );
  }

  // ── Completion state ──
  if (completed) {
    const vehicleName = vehicleNameFromProps ?? "vehicle";
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.completionContainer}>
          <View style={styles.checkCircleOuter}>
            <LinearGradient
              colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.checkCircleGradient}
            >
              <Check size={40} color={BrandColors.white} strokeWidth={3} />
            </LinearGradient>
          </View>
          <Text variant="h2" style={styles.completionTitle}>
            All set — your {vehicleName} is up to date.
          </Text>
          {modeTransitioned && (
            <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.modeTransitionBanner}>
              <Text variant="body" style={styles.modeTransitionText}>
                We've updated how we track your {vehicleName} based on your answers. Your recommendations have been adjusted.
              </Text>
            </Animated.View>
          )}
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [
              styles.doneButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <LinearGradient
              colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneButtonGradient}
            >
              <Text weight="bold" size="md" color="#FFFFFF">
                Done
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ── Intro state (before starting) ──
  if (!checkinId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.introContainer}>
          <View style={styles.introTextBlock}>
            <Text variant="h2" style={styles.introTitle}>
              Quick check-in
            </Text>
            <Text variant="body" style={styles.introSubtitle}>
              A few questions to keep your{" "}
              {vehicleNameFromProps ?? "vehicle"}'s recommendations accurate.
              Takes about a minute.
            </Text>
            <Text variant="caption" style={styles.questionCount}>
              {visibleQuestions.length} questions for your vehicle
            </Text>
          </View>
          <View>
            <FooterButton
              label="Let's go"
              onPress={handleStart}
              variant="secondary"
              style={styles.startButton}
            />
            <Pressable onPress={dismiss} style={styles.skipLink}>
              <Text variant="caption" style={styles.skipText}>
                Not now
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ── Question flow ──
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <ArrowLeft size={24} color={BrandColors.primary} />
        </Pressable>
        <View style={styles.progressBar}>
          <Animated.View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
        <Text variant="caption" style={styles.stepLabel}>
          {currentIndex + 1}/{visibleQuestions.length}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {currentQuestion && (
          <Animated.View
            key={currentQuestion.id}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(100)}
          >
            <Text variant="h3" style={styles.questionText}>
              {currentQuestion.label.replace(
                "{{role}}",
                questionSet.garageRole ?? "primary"
              )}
            </Text>

            {/* Q1: Mileage number input */}
            {currentQuestion.id === "Q1" && (
              <View style={styles.mileageContainer}>
                <TextInput
                  style={styles.mileageInput}
                  value={mileageInput}
                  onChangeText={setMileageInput}
                  keyboardType="number-pad"
                  placeholder={questionSet.projectedMileage?.toString()}
                  placeholderTextColor="#999"
                  autoFocus
                />
                <Text variant="caption" style={styles.mileageHint}>
                  We projected ~{questionSet.projectedMileage?.toLocaleString()} miles
                </Text>
              </View>
            )}

            {/* Multi-select (Q2) */}
            {currentQuestion.type === "multi_select" && currentQuestion.options && (
              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((opt: CheckinOption) => {
                  const selected = ((answers[currentQuestion.id] as string[]) ?? []).includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => handleMultiSelect(currentQuestion.id, opt.value)}
                    >
                      <Text
                        variant="body"
                        style={[styles.chipText, selected && styles.chipTextSelected]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Q4: merged warning lights + concerns */}
            {currentQuestion.id === "Q4" && (() => {
              const handleWarningConcernSelect = (choice: string) => {
                setWarningConcernChoice(choice);
                setWarningLightTypes([]);
                setSymptomsText("");
                if (choice === "warning_light") {
                  setAnswer("Q4", "yes");
                  setAnswer("Q5", "no");
                } else if (choice === "feels_off") {
                  setAnswer("Q4", "no");
                  setAnswer("Q5", "yes");
                } else {
                  setAnswer("Q4", "no");
                  setAnswer("Q5", "no");
                }
              };
              const toggleWarningLightType = (val: string) => {
                setWarningLightTypes((prev) => {
                  const next = prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val];
                  setAnswer("Q4_detail", next);
                  return next;
                });
              };
              return (
                <View style={styles.optionsContainer}>
                  {[
                    { value: "all_good",     label: "All good" },
                    { value: "warning_light", label: "Warning light on" },
                    { value: "feels_off",    label: "Something feels off" },
                  ].map((opt) => {
                    const selected = warningConcernChoice === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                        onPress={() => handleWarningConcernSelect(opt.value)}
                      >
                        <Text
                          variant="body"
                          style={[styles.optionText, selected && styles.optionTextSelected]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {warningConcernChoice === "warning_light" && (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.optionsContainer}>
                      {WARNING_LIGHT_TYPE_OPTIONS.map((opt) => {
                        const selected = warningLightTypes.includes(opt.value);
                        return (
                          <Pressable
                            key={opt.value}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => toggleWarningLightType(opt.value)}
                          >
                            <Text
                              variant="body"
                              style={[styles.chipText, selected && styles.chipTextSelected]}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </Animated.View>
                  )}
                  {warningConcernChoice === "feels_off" && (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <TextInput
                        style={styles.textArea}
                        value={symptomsText}
                        onChangeText={setSymptomsText}
                        multiline
                        placeholder="Describe what you're noticing..."
                        placeholderTextColor="#999"
                      />
                    </Animated.View>
                  )}
                </View>
              );
            })()}

            {/* Binary / Three-option / Four-option */}
            {currentQuestion.id !== "Q4" &&
              (currentQuestion.type === "binary" ||
                currentQuestion.type === "three_option" ||
                currentQuestion.type === "four_option") &&
              currentQuestion.options && (
                <View style={styles.optionsContainer}>
                  {currentQuestion.options.map((opt: CheckinOption) => {
                    const selected = answers[currentQuestion.id] === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                        onPress={() => setAnswer(currentQuestion.id, opt.value)}
                      >
                        <Text
                          variant="body"
                          style={[styles.optionText, selected && styles.optionTextSelected]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

            {/* Text expand (Q5 symptoms) */}
            {currentQuestion.type === "text_expand" && currentQuestion.options && (
              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((opt: CheckinOption) => {
                  const selected = answers[currentQuestion.id] === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.optionCard, selected && styles.optionCardSelected]}
                      onPress={() => setAnswer(currentQuestion.id, opt.value)}
                    >
                      <Text
                        variant="body"
                        style={[styles.optionText, selected && styles.optionTextSelected]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {answers[currentQuestion.id] === "yes" && (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <TextInput
                      style={styles.textArea}
                      value={symptomsText}
                      onChangeText={setSymptomsText}
                      placeholder="Describe what you're noticing..."
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={3}
                    />
                  </Animated.View>
                )}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {isOptional && !canAdvance && (
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text size="sm" weight="medium" color="#9CA3AF">
              Skip
            </Text>
          </Pressable>
        )}
        <FooterButton
          label={isLast ? (submitting ? "Updating..." : "Finish") : "Next"}
          onPress={handleNext}
          disabled={!canAdvance || submitting}
          variant="secondary"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: BrandColors.secondary,
    borderRadius: 2,
  },
  stepLabel: {
    color: "#6B7280",
    minWidth: 32,
    textAlign: "right",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: 100,
  },
  questionText: {
    color: BrandColors.primary,
    marginBottom: Spacing.xl,
    lineHeight: 32,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignSelf: "flex-start",
  },
  chipSelected: {
    backgroundColor: BrandColors.secondary,
  },
  chipText: {
    color: BrandColors.primary,
  },
  chipTextSelected: {
    color: BrandColors.white,
  },
  optionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  optionCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#EFF6FF",
  },
  optionText: {
    color: BrandColors.primary,
  },
  optionTextSelected: {
    color: BrandColors.secondary,
    fontWeight: "600",
  },
  mileageContainer: {
    gap: Spacing.sm,
  },
  mileageInput: {
    fontSize: 32,
    fontWeight: "700",
    color: BrandColors.primary,
    borderBottomWidth: 2,
    borderBottomColor: BrandColors.secondary,
    paddingVertical: Spacing.md,
  },
  mileageHint: {
    color: "#9CA3AF",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 80,
    fontSize: 16,
    color: BrandColors.primary,
    textAlignVertical: "top",
    marginTop: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  skipButton: {
    alignSelf: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  introContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: 408,
  },
  introTextBlock: {
  },
  introTitle: {
    color: BrandColors.primary,
    marginBottom: Spacing.md,
  },
  introSubtitle: {
    color: "#6B7280",
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  questionCount: {
    color: "#9CA3AF",
    marginBottom: Spacing["2xl"],
  },
  startButton: {
    marginBottom: Spacing.lg,
  },
  skipLink: {
    alignSelf: "center",
    padding: Spacing.md,
  },
  skipText: {
    color: "#9CA3AF",
  },
  completionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  checkCircleOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    marginBottom: Spacing.xl,
    shadowColor: "rgba(82,153,254,0.35)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  checkCircleGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  completionTitle: {
    color: BrandColors.primary,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  completionSubtitle: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing["2xl"],
  },
  modeTransitionBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
    marginHorizontal: Spacing.md,
  },
  modeTransitionText: {
    color: "#1E40AF",
    textAlign: "center",
    lineHeight: 22,
  },
  doneButton: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  doneButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: 32,
  },
});
