import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { FontFamily } from "@/constants/theme";
import SquircleRing from "@/components/cars/SquircleRing";

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionDef {
  key: string;
  text: string;
  options: { id: string; label: string; icon?: string }[];
  multiSelect?: boolean;
  triggerFollowUp?: string;
}

interface QuestionOverlayProps {
  serviceId: string;
  serviceName: string;
  heroIcon: React.ReactNode;
  questions: QuestionDef[];
  initialQuestionIndex: number;
  initialAnswers: Record<string, string | string[]>;
  onAnswerUpdate: (
    answers: Record<string, string | string[]>,
    questionIndex: number,
    progress: number,
  ) => void;
  onComplete: () => void;
  onDismiss: () => void;
}

// ============================================================================
// OVERLAY
// ============================================================================

export default function QuestionOverlay({
  serviceId,
  serviceName,
  heroIcon,
  questions,
  initialQuestionIndex,
  initialAnswers,
  onAnswerUpdate,
  onComplete,
  onDismiss,
}: QuestionOverlayProps) {
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialAnswers);
  const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);
  const isClosing = useRef(false);
  const processing = useRef(false);
  const exitCallback = useRef<(() => void) | null>(null);

  const backdropOpacity = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const heroScale = useSharedValue(0.3);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 300 });
    contentProgress.value = withTiming(1, {
      duration: 450,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    heroScale.value = withSpring(1, { damping: 30, stiffness: 400 });
  }, []);

  const animateOut = useCallback((callback: () => void) => {
    if (isClosing.current) return;
    isClosing.current = true;
    exitCallback.current = callback;
    backdropOpacity.value = withTiming(0, { duration: 200 });
    contentProgress.value = withTiming(0, { duration: 250 }, (finished) => {
      "worklet";
      if (finished && exitCallback.current) {
        runOnJS(exitCallback.current)();
      }
    });
  }, [backdropOpacity, contentProgress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0, 0.4, 1], [0, 0.6, 1]),
    transform: [{ translateY: interpolate(contentProgress.value, [0, 1], [50, 0]) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroAnimStyle = useAnimatedStyle(() => {
    const scrollScale = interpolate(
      scrollY.value,
      [0, 150],
      [1, 0.55],
      Extrapolation.CLAMP,
    );
    const scrollOpacity = interpolate(
      scrollY.value,
      [0, 120],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: heroScale.value * scrollScale }],
      opacity: scrollOpacity,
    };
  });

  const currentQuestion = questions[questionIndex];
  const totalQuestions = questions.length;

  const computeProgress = useCallback(
    (qi: number, completed: boolean) => (completed ? 1 : qi / totalQuestions),
    [totalQuestions],
  );

  const handleOptionTap = useCallback(
    (optionId: string) => {
      if (isClosing.current || processing.current) return;
      processing.current = true;

      const question = questions[questionIndex];
      const updatedAnswers = { ...answers, [question.key]: optionId };
      setAnswers(updatedAnswers);

      setTimeout(() => {
        const hasFollowUp =
          question.triggerFollowUp && optionId === question.triggerFollowUp;

        if (hasFollowUp && questionIndex < totalQuestions - 1) {
          const nextIndex = questionIndex + 1;
          const progress = computeProgress(nextIndex, false);
          setQuestionIndex(nextIndex);
          processing.current = false;
          onAnswerUpdate(updatedAnswers, nextIndex, progress);
        } else {
          onAnswerUpdate(updatedAnswers, questionIndex, 1);
          animateOut(onComplete);
        }
      }, 300);
    },
    [answers, questionIndex, questions, totalQuestions, computeProgress, onAnswerUpdate, onComplete, animateOut],
  );

  const handleMultiSelectToggle = useCallback((optionId: string) => {
    setMultiSelectValues((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
    );
  }, []);

  const handleMultiSelectDone = useCallback(() => {
    if (isClosing.current) return;
    const question = questions[questionIndex];
    const updatedAnswers = { ...answers, [question.key]: multiSelectValues };
    setAnswers(updatedAnswers);
    onAnswerUpdate(updatedAnswers, questionIndex, 1);
    animateOut(onComplete);
  }, [answers, questionIndex, questions, multiSelectValues, onAnswerUpdate, onComplete, animateOut]);

  const handleClose = useCallback(() => {
    animateOut(onDismiss);
  }, [animateOut, onDismiss]);

  if (!currentQuestion) return null;

  const isMultiSelect = !!currentQuestion.multiSelect;
  const ringProgress = computeProgress(questionIndex, false);

  return (
    <View style={st.container} pointerEvents={isClosing.current ? "none" : "auto"}>
      {/* Backdrop */}
      <ReAnimated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[
            "rgba(208,231,244,0.93)",
            "rgba(235,242,248,0.96)",
            "rgba(250,252,253,0.98)",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </ReAnimated.View>

      {/* Content */}
      <ReAnimated.View style={[st.content, contentStyle]}>
        {/* Close button */}
        <Pressable style={st.closeButton} onPress={handleClose}>
          <Text style={st.closeButtonText}>{"\u2715"}</Text>
        </Pressable>

        <ReAnimated.ScrollView
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* Hero card */}
          <ReAnimated.View style={[st.heroWrapper, heroAnimStyle]}>
            <SquircleRing width={164} height={163} rx={22} progress={ringProgress} isDone={false} />
            <View style={st.heroCardOuter}>
              <LinearGradient
                colors={["#5299FE", "#70B7FF"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={st.heroCard}
              >
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: 25 }}>
                  {heroIcon}
                </View>
                <Text
                  weight="semiBold"
                  size="sm"
                  color="#FFFFFF"
                  style={{ fontFamily: FontFamily.serifSemiBold, fontSize: 17, textAlign: "center", paddingBottom: 14 }}
                >
                  {serviceName}
                </Text>
              </LinearGradient>
            </View>
          </ReAnimated.View>

          {/* Question text */}
          <ReAnimated.View
            key={`q-${serviceId}-${questionIndex}`}
            entering={FadeIn.duration(300).delay(150)}
            exiting={FadeOut.duration(150)}
          >
            <Text weight="bold" size="xl" color="#16293B" style={[st.questionText, { fontFamily: FontFamily.serifBold, marginBottom: isMultiSelect ? 20 : 72 }]}>
              {currentQuestion.text}
            </Text>
          </ReAnimated.View>

          {/* Options */}
          <View style={st.optionsStack}>
            {currentQuestion.options.map((opt) => {
              const isSelected = isMultiSelect
                ? multiSelectValues.includes(opt.id)
                : answers[currentQuestion.key] === opt.id;

              return (
                <OptionButton
                  key={opt.id}
                  label={opt.label}
                  icon={opt.icon}
                  isSelected={isSelected}
                  isMultiSelect={isMultiSelect}
                  onPress={() => {
                    if (isMultiSelect) {
                      handleMultiSelectToggle(opt.id);
                    } else {
                      handleOptionTap(opt.id);
                    }
                  }}
                />
              );
            })}
          </View>

          {isMultiSelect && multiSelectValues.length > 0 && (
            <Pressable
              style={({ pressed }) => [st.doneButton, pressed && { opacity: 0.9 }]}
              onPress={handleMultiSelectDone}
            >
              <LinearGradient
                colors={["#7BB8FF", "#5299FE", "#3B7FEB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.doneButtonGradient}
              >
                <Text weight="semiBold" size="md" color="#FFFFFF" style={{ fontSize: 17 }}>
                  Done
                </Text>
              </LinearGradient>
            </Pressable>
          )}
        </ReAnimated.ScrollView>
      </ReAnimated.View>
    </View>
  );
}

// ============================================================================
// OptionButton (per-button spring animation)
// ============================================================================

function OptionButton({
  label,
  icon,
  isSelected,
  isMultiSelect,
  onPress,
}: {
  label: string;
  icon?: string;
  isSelected: boolean;
  isMultiSelect: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReAnimated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 20, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 20, stiffness: 300 });
        }}
        onPress={onPress}
        style={[st.optionButton, isSelected && st.optionButtonSelected]}
      >
        {isSelected && (
          <LinearGradient
            colors={["#EEF4FF", "#E3EDFF"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <View style={st.optionContent}>
          {icon ? (
            <Ionicons
              name={icon as any}
              size={20}
              color={isSelected ? "#5299FE" : "#6B7280"}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <Text
            weight={isSelected ? "semiBold" : "medium"}
            size="md"
            color={isSelected ? "#3B7FEB" : "#2D3F52"}
            style={st.optionText}
          >
            {label}
          </Text>
        </View>
        {isMultiSelect && isSelected && (
          <Ionicons name="checkmark-circle" size={22} color="#5299FE" />
        )}
      </Pressable>
    </ReAnimated.View>
  );
}

// ============================================================================
// ProgressDot (animated width)
// ============================================================================

function ProgressDot({ isDone, isActive }: { isDone: boolean; isActive: boolean }) {
  const width = useSharedValue(isActive ? 28 : 6);

  useEffect(() => {
    width.value = withTiming(isActive ? 28 : 6, { duration: 350 });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDone || isActive ? "#5299FE" : "rgba(82,153,254,0.18)",
  }));

  return <ReAnimated.View style={animatedStyle} />;
}

// ============================================================================
// STYLES
// ============================================================================

const st = StyleSheet.create({
  container: {
    position: "absolute",
    top: -150,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 140,
    right: 24,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 15,
    color: "#4A6F8A",
  },
  heroWrapper: {
    width: 164,
    height: 163,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  heroCardOuter: {
    shadowColor: "#5299FE",
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  heroCard: {
    width: 156,
    height: 155,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 200,
    paddingBottom: 60,
  },
  serviceLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  questionText: {
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.4,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 24,
    marginBottom: 20,
    alignSelf: "center",
  },
  optionsStack: {
    width: "100%",
    gap: 12,
  },
  optionButton: {
    width: "100%",
    paddingVertical: 17,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 0,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionButtonSelected: {
    borderWidth: 1.5,
    borderColor: "#5299FE",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionText: {
    fontSize: 16,
  },
  doneButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 16,
    shadowColor: "rgba(82,153,254,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  doneButtonGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
