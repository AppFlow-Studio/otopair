import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FooterButton, Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, FontFamily, Spacing } from "@/constants/theme";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";

type StepId =
  | "ownershipType"
  | "ownedSinceNew"
  | "mileageAtPurchase"
  | "currentMileage"
  | "mileageAndUsage";

type OwnershipType = "leased" | "owned";
type AnnualMileageBand = "light" | "avg" | "heavy" | "very_heavy";
type UsagePattern = "mostly_local" | "mostly_highway" | "mixed";

const STEP_COPY: Record<StepId, { title: string; subtitle: string }> = {
  ownershipType: {
    title: "How do you own this vehicle?",
    subtitle: "This helps us tailor maintenance plans to your situation.",
  },
  ownedSinceNew: {
    title: "Did you buy it new?",
    subtitle: "First owners tend to have more complete service history.",
  },
  mileageAtPurchase: {
    title: "What was the mileage when you got it?",
    subtitle: "A rough estimate is fine — we'll refine over time.",
  },
  currentMileage: {
    title: "What's on the odometer right now?",
    subtitle: "An estimate is fine — we'll refine over time.",
  },
  mileageAndUsage: {
    title: "How do you drive?",
    subtitle: "This helps us build your maintenance profile.",
  },
};

function toNumber(raw: string): number | undefined {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const FOOTER_AREA_HEIGHT = 110;
const OPTION_CARD_HEIGHT = SCREEN_HEIGHT * 0.065;
const OPTION_CARD_HEIGHT_COMPACT = SCREEN_HEIGHT * 0.055;


function getEncouragementText(index: number): string {
  if (index === 0) return "Let's get to know your car";
  if (index === 1) return "Looking good";
  if (index === 2) return "Almost there";
  return "Last question";
}

export default function CarPreOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleOwnerId?: string; flow?: string }>();
  const { userId } = useUserFromConvex();
  const savePreOnboarding = useMutation(api.vehicles.saveVehiclePreOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownershipType, setOwnershipType] = useState<OwnershipType | undefined>();
  const [ownedSinceNew, setOwnedSinceNew] = useState<boolean | undefined>();
  const [mileageAtPurchase, setMileageAtPurchase] = useState("");
  const [mileageAtPurchaseNotSure, setMileageAtPurchaseNotSure] = useState(false);
  const [currentMileage, setCurrentMileage] = useState("");
  const [annualMileageBand, setAnnualMileageBand] = useState<AnnualMileageBand | undefined>();
  const [usagePattern, setUsagePattern] = useState<UsagePattern | undefined>();
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const ctaWrapRef = useRef<View>(null);
  const buttonOpacity = useSharedValue(0.4);
  const ctaLiftAnim = useSharedValue(0);
  const stepTranslateX = useSharedValue(0);
  const stepOpacity = useSharedValue(1);
  const progressWidth = useSharedValue(0);


  const vehicleOwnerId = useMemo(
    () => (typeof params.vehicleOwnerId === "string" && params.vehicleOwnerId ? params.vehicleOwnerId : ""),
    [params.vehicleOwnerId],
  );
  const flow = useMemo(
    () => (typeof params.flow === "string" ? params.flow : ""),
    [params.flow],
  );

  const steps = useMemo(() => {
    const ordered: StepId[] = ["ownershipType"];
    if (ownershipType === "owned") {
      ordered.push("ownedSinceNew");
      if (ownedSinceNew === false) {
        ordered.push("mileageAtPurchase");
      }
    }
    ordered.push("currentMileage", "mileageAndUsage");
    return ordered;
  }, [ownershipType, ownedSinceNew]);

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1));
    }
  }, [stepIndex, steps.length]);

  useEffect(() => {
    progressWidth.value = withTiming(((stepIndex + 1) / steps.length) * 100, { duration: 400, easing: Easing.out(Easing.ease) });
  }, [stepIndex, steps.length]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      const nextTop =
        event.endCoordinates?.screenY ??
        (SCREEN_HEIGHT - (event.endCoordinates?.height ?? 0));
      setKeyboardTop(nextTop);
    });
    const frameSub = Keyboard.addListener("keyboardDidChangeFrame", (event) => {
      const nextTop =
        event.endCoordinates?.screenY ??
        (SCREEN_HEIGHT - (event.endCoordinates?.height ?? 0));
      setKeyboardTop(nextTop);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardTop(null);
      ctaLiftAnim.value = withTiming(0, { duration: 250 });
    });

    return () => {
      showSub.remove();
      frameSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardTop === null) return;

    requestAnimationFrame(() => {
      ctaWrapRef.current?.measureInWindow((_x, y, _width, height) => {
        const desiredBottom = keyboardTop - 8;
        const currentBottom = y + height;
        const overlap = currentBottom - desiredBottom;
        ctaLiftAnim.value = withTiming(overlap > 0 ? -overlap : 0, { duration: 250 });
      });
    });
  }, [keyboardTop, currentMileage, mileageAtPurchase, stepIndex]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const animateTransition = useCallback((nextIndex: number, direction: 'forward' | 'back') => {
    const exitTo = direction === 'forward' ? -300 : 300;
    const enterFrom = direction === 'forward' ? 300 : -300;
    stepTranslateX.value = withTiming(exitTo, { duration: 300, easing: Easing.in(Easing.ease) });
    stepOpacity.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.ease) }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(setStepIndex)(nextIndex);
        stepTranslateX.value = enterFrom;
        stepOpacity.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }));
        stepTranslateX.value = withDelay(400, withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) }));
      }
    });
  }, []);

  const transitionToStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === stepIndex) return;
    animateTransition(nextIndex, 'forward');
  }, [steps.length, stepIndex, animateTransition]);

  const canContinue = useMemo(() => {
    switch (currentStep) {
      case "ownershipType":
        return !!ownershipType;
      case "ownedSinceNew":
        return ownedSinceNew !== undefined;
      case "mileageAtPurchase":
        return mileageAtPurchaseNotSure || toNumber(mileageAtPurchase) !== undefined;
      case "currentMileage":
        return toNumber(currentMileage) !== undefined;
      case "mileageAndUsage":
        return !!annualMileageBand && !!usagePattern;
      default:
        return true;
    }
  }, [
    currentStep,
    ownershipType,
    ownedSinceNew,
    mileageAtPurchaseNotSure,
    mileageAtPurchase,
    currentMileage,
    annualMileageBand,
    usagePattern,
  ]);

  const ctaDisabled = isSubmitting || !canContinue;

  useEffect(() => {
    buttonOpacity.value = withTiming(ctaDisabled ? 0.5 : 1, { duration: 200 });
  }, [ctaDisabled]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const ctaLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaLiftAnim.value }],
  }));

  const buttonScale = useSharedValue(1);
  const buttonScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const stepAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
    transform: [{ translateX: stepTranslateX.value }],
  }));

  const progressBarAnimStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handleBack = () => {
    Keyboard.dismiss();
    setKeyboardTop(null);
    ctaLiftAnim.value = withTiming(0, { duration: 250 });
    if (stepIndex === 0) {
      router.back();
      return;
    }
    animateTransition(stepIndex - 1, 'back');
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    setKeyboardTop(null);
    ctaLiftAnim.value = withTiming(0, { duration: 250 });
    if (!isLastStep) {
      transitionToStep(stepIndex + 1);
      return;
    }

    await submitAndComplete();
  };

  const submitAndComplete = async () => {
    if (!vehicleOwnerId) {
      router.replace("/(main-tabs)/cars");
      return;
    }
    const parsedCurrentMileage = toNumber(currentMileage);
    if (parsedCurrentMileage === undefined || !ownershipType || !annualMileageBand || !usagePattern) {
      return;
    }
    try {
      setIsSubmitting(true);
      await savePreOnboarding({
        vehicleOwnerId: vehicleOwnerId as Id<"vehicle_owners">,
        ownershipType,
        ownedSinceNew,
        mileageAtPurchase: mileageAtPurchaseNotSure ? undefined : toNumber(mileageAtPurchase),
        currentMileage: parsedCurrentMileage,
        annualMileageBand,
        usagePattern,
      });
    } catch (err) {
      console.warn("[car-pre-onboarding] Failed to save pre-onboarding", err);
    } finally {
      setIsSubmitting(false);
      if (flow === "manual") {
        router.replace({
          pathname: "/vehicle-added",
          params: {
            flow: "manual",
            vehicleOwnerId,
            fromPreOnboarding: "true",
          },
        });
      } else {
        router.replace("/(main-tabs)/cars");
      }
    }
  };

  const renderQuestionContent = () => {
    switch (currentStep) {
      case "ownershipType":
        return (
          <View style={styles.optionList}>
            <OptionCard label="Leased" selected={ownershipType === "leased"} onPress={() => setOwnershipType("leased")} />
            <OptionCard label="Owned" selected={ownershipType === "owned"} onPress={() => setOwnershipType("owned")} />
          </View>
        );
      case "ownedSinceNew":
        return (
          <View style={styles.optionList}>
            <OptionCard label="Yes, since new" selected={ownedSinceNew === true} onPress={() => setOwnedSinceNew(true)} />
            <OptionCard label="No, bought used" selected={ownedSinceNew === false} onPress={() => setOwnedSinceNew(false)} />
          </View>
        );
      case "mileageAtPurchase":
        return (
          <View>
            <TextInput
              style={styles.input}
              value={mileageAtPurchase}
              onChangeText={(v) => {
                setMileageAtPurchase(v);
                if (v.trim().length > 0) setMileageAtPurchaseNotSure(false);
              }}
              keyboardType="number-pad"
              placeholder="e.g. 42,000"
              placeholderTextColor="#829BAD"
            />
            <Pressable onPress={() => setMileageAtPurchaseNotSure((v) => !v)} style={styles.notSureRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size="sm" weight="medium" color={mileageAtPurchaseNotSure ? BrandColors.secondary : "#64748B"}>
                  Not sure
                </Text>
                {mileageAtPurchaseNotSure && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <Check size={16} color={BrandColors.secondary} strokeWidth={2.5} />
                  </Animated.View>
                )}
              </View>
            </Pressable>
          </View>
        );
      case "currentMileage":
        return (
          <TextInput
            style={styles.input}
            value={currentMileage}
            onChangeText={setCurrentMileage}
            keyboardType="number-pad"
            placeholder="e.g. 45,000"
            placeholderTextColor="#829BAD"
          />
        );
      case "mileageAndUsage":
        return (
          <View style={styles.optionList}>
            <Text weight="semiBold" size="sm" color="#64748B" style={{ marginBottom: 4 }}>
              Miles per year
            </Text>
            <OptionCard label="Light (< 7,500 mi)" selected={annualMileageBand === "light"} onPress={() => setAnnualMileageBand("light")} />
            <OptionCard label="Average (7,500 – 12k)" selected={annualMileageBand === "avg"} onPress={() => setAnnualMileageBand("avg")} />
            <OptionCard label="Heavy (12k – 18k)" selected={annualMileageBand === "heavy"} onPress={() => setAnnualMileageBand("heavy")} />
            <OptionCard label="Very Heavy (18k+)" selected={annualMileageBand === "very_heavy"} onPress={() => setAnnualMileageBand("very_heavy")} />
            <Text weight="semiBold" size="sm" color="#64748B" style={{ marginTop: 16, marginBottom: 4 }}>
              Driving style
            </Text>
            <OptionCard label="Mostly local (short trips)" selected={usagePattern === "mostly_local"} onPress={() => setUsagePattern("mostly_local")} compact />
            <OptionCard label="Mostly highway (long drives)" selected={usagePattern === "mostly_highway"} onPress={() => setUsagePattern("mostly_highway")} compact />
            <OptionCard label="Mix of both" selected={usagePattern === "mixed"} onPress={() => setUsagePattern("mixed")} compact />
          </View>
        );
      default:
        return null;
    }
  };

  const { title: stepTitle, subtitle: stepSubtitle } = STEP_COPY[currentStep];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={undefined}
    >
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#D6EAF8']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.screen, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            hitSlop={12}
          >
            <BlurView intensity={60} tint="light" style={styles.backButtonBlur}>
              <ArrowLeft size={20} color={BrandColors.black} />
            </BlurView>
          </Pressable>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                progressBarAnimStyle,
              ]}
            />
          </View>
        </View>
        <Animated.View
          key={getEncouragementText(stepIndex)}
          entering={FadeIn.duration(300)}
          style={styles.encouragementRow}
        >
          <Text size="xs" weight="medium" color="#829BAD">
            {getEncouragementText(stepIndex)}
          </Text>
        </Animated.View>

        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={[{ flex: 1 }, stepAnimatedStyle]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollArea}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
            >
              <View
                style={[styles.cardContent, { paddingBottom: 0 }]}
                pointerEvents="box-none"
              >
                <Text weight="bold" size="3xl" color="#0F172A" style={[styles.title, { fontFamily: FontFamily.serifBold }]}>
                  {stepTitle}
                </Text>
                <Text weight="medium" size="md" color="#829BAD" style={[styles.subtitle, { fontFamily: FontFamily.serif }]}>
                  {stepSubtitle}
                </Text>
                <View style={[styles.questionBody, (currentStep === "currentMileage" || currentStep === "mileageAtPurchase") && { justifyContent: "flex-start" }]}>
                  {renderQuestionContent()}
                </View>
                <View style={{ height: FOOTER_AREA_HEIGHT + insets.bottom + 24 }} />
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <View
          ref={ctaWrapRef}
          style={[styles.pinnedFooter, { paddingBottom: insets.bottom + 12 }]}
        >
          <Animated.View style={[styles.footerContent, ctaLiftStyle]}>
            <Pressable
              disabled={ctaDisabled}
              onPressIn={() => { buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 200 }); }}
              onPressOut={() => { buttonScale.value = withSpring(1.0, { damping: 15, stiffness: 200 }); }}
              style={{ alignSelf: "stretch" }}
            >
              <Animated.View style={[animatedButtonStyle, buttonScaleStyle, { alignSelf: "stretch" }]} pointerEvents={ctaDisabled ? "none" : "auto"}>
                <FooterButton
                  label={isLastStep ? "Finish Setup" : "Continue"}
                  onPress={handleContinue}
                  backgroundColor={BrandColors.secondary}
                  rightIcon={isSubmitting ? <ActivityIndicator size="small" color={BrandColors.white} /> : undefined}
                />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function OptionCard({
  label,
  selected,
  onPress,
  compact,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const scaleAnim = useSharedValue(1);
  const prevSelectedRef = React.useRef(selected);

  useEffect(() => {
    const wasSelected = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    progress.value = withTiming(selected ? 1 : 0, { duration: 150 });
    if (selected && !wasSelected) {
      scaleAnim.value = withSequence(
        withSpring(1.012, { damping: 12, stiffness: 180 }),
        withSpring(1.0, { damping: 16, stiffness: 200 })
      );
    }
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], ["#A0AEC0", "#5299FE"]),
    backgroundColor: interpolateColor(progress.value, [0, 1], ["#FFFFFF", "#EFF6FF"]),
    transform: [{ scale: scaleAnim.value }],
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      <Animated.View style={[styles.optionCard, animatedStyle, { height: compact ? OPTION_CARD_HEIGHT_COMPACT : OPTION_CARD_HEIGHT }]}>
        <Text weight={selected ? "semiBold" : "medium"} size="md" color={selected ? "#1E40AF" : "#374151"}>
          {label}
        </Text>
        {selected && (
          <Animated.View entering={FadeIn.duration(150)}>
            <Check size={20} color={BrandColors.secondary} strokeWidth={2.5} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
  fullWidth,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 150 });
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], ["#A0AEC0", "#5299FE"]),
    backgroundColor: interpolateColor(progress.value, [0, 1], ["#FFFFFF", "#EFF6FF"]),
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [fullWidth && { width: "100%", alignItems: "flex-start" }, pressed && { opacity: 0.85 }]}>
      <Animated.View style={[styles.chip, animatedStyle]}>
        <Text weight={selected ? "semiBold" : "medium"} size="md" color={selected ? "#1E40AF" : "#374151"}>
          {label}
        </Text>
        {selected && (
          <Animated.View entering={FadeIn.duration(150)}>
            <Check size={16} color={BrandColors.secondary} strokeWidth={2.5} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    alignItems: "flex-start",
  },
  progressBarContainer: {
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  progressBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: BrandColors.secondary,
  },
  encouragementRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: 4,
    marginBottom: Spacing.sm,
    alignItems: "flex-end",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    overflow: "hidden",
  },
  backButtonPressed: {
    opacity: 0.65,
  },
  scrollArea: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  cardContent: {
    flex: 1,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["2xl"],
    position: "relative",
    zIndex: 1,
  },
  title: {
    textAlign: "left",
    marginBottom: Spacing.xs,
    lineHeight: 38,
  },
  subtitle: {
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  questionBody: {
    flex: 1,
    justifyContent: "flex-start",
    marginTop: Spacing.sm,
  },
  pinnedFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  footerContent: {
    gap: Spacing.sm,
    alignItems: "center",
  },
  optionList: {
    flexDirection: "column",
    gap: 12,
    marginTop: Spacing.xl,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  input: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "#D7DBE2",
    backgroundColor: BrandColors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: "#111827",
  },
  notSureRow: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: Spacing.xl,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "#D7DBE2",
    backgroundColor: BrandColors.white,
  },
});
