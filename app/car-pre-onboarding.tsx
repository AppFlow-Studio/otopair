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
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FooterButton, Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";

type StepId =
  | "ownershipType"
  | "ownedSinceNew"
  | "mileageAtPurchase"
  | "ownershipDuration"
  | "currentMileage"
  | "annualMileageBand"
  | "usagePattern"
  | "optionalGate"
  | "lastServiceWhen"
  | "lastServiceWhat"
  | "serviceLocationPreference"
  | "concerns"
  | "garageRole";

type OwnershipType = "leased" | "owned";
type AnnualMileageBand = "light" | "avg" | "heavy" | "very_heavy";
type UsagePattern = "mostly_local" | "mostly_highway" | "mixed";
type OwnershipDuration = "lt1" | "y1_2" | "y2_4" | "gt4";
type LastServiceWhen = "recently" | "few_months" | "over_6_months" | "not_sure";
type ServiceLocationPreference = "dealer" | "independent" | "wherever" | "no_goto";
type GarageRole = "primary" | "secondary" | "weekend" | "stored";
type ConcernChoice = "yes" | "no";

const SERVICE_WHAT_OPTIONS = [
  { id: "oil_change", label: "Oil change" },
  { id: "brakes", label: "Brakes" },
  { id: "tires", label: "Tires" },
  { id: "inspection", label: "Inspection" },
  { id: "other", label: "Other" },
  { id: "dont_remember", label: "Don't remember" },
] as const;

const OPTIONAL_STEPS = new Set<StepId>([
  "lastServiceWhen",
  "lastServiceWhat",
  "serviceLocationPreference",
  "concerns",
  "garageRole",
]);

function toNumber(raw: string): number | undefined {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function CarPreOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleOwnerId?: string; flow?: string }>();
  const { userId } = useUserFromConvex();
  const listVehicles = useQuery(api.vehicles.listVehiclesByUser, userId ? { userId } : "skip");
  const savePreOnboarding = useMutation(api.vehicles.saveVehiclePreOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownershipType, setOwnershipType] = useState<OwnershipType | undefined>();
  const [ownedSinceNew, setOwnedSinceNew] = useState<boolean | undefined>();
  const [mileageAtPurchase, setMileageAtPurchase] = useState("");
  const [mileageAtPurchaseNotSure, setMileageAtPurchaseNotSure] = useState(false);
  const [ownershipDuration, setOwnershipDuration] = useState<OwnershipDuration | undefined>();
  const [currentMileage, setCurrentMileage] = useState("");
  const [annualMileageBand, setAnnualMileageBand] = useState<AnnualMileageBand | undefined>();
  const [usagePattern, setUsagePattern] = useState<UsagePattern | undefined>();
  const [lastServiceWhen, setLastServiceWhen] = useState<LastServiceWhen | undefined>();
  const [lastServiceWhat, setLastServiceWhat] = useState<string[]>([]);
  const [serviceLocationPreference, setServiceLocationPreference] = useState<ServiceLocationPreference | undefined>();
  const [concernChoice, setConcernChoice] = useState<ConcernChoice | undefined>();
  const [concernText, setConcernText] = useState("");
  const [garageRole, setGarageRole] = useState<GarageRole | undefined>();
  const [includeOptionalSection, setIncludeOptionalSection] = useState<boolean | undefined>();
  const [ctaLift, setCtaLift] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const ctaWrapRef = useRef<View>(null);

  const vehicleOwnerId = useMemo(
    () => (typeof params.vehicleOwnerId === "string" && params.vehicleOwnerId ? params.vehicleOwnerId : ""),
    [params.vehicleOwnerId],
  );
  const flow = useMemo(
    () => (typeof params.flow === "string" ? params.flow : ""),
    [params.flow],
  );

  const isSecondVehicle = (listVehicles?.length ?? 0) > 1;

  const parsedMileageForSteps = toNumber(currentMileage);
  const isNewVehicleMileage = parsedMileageForSteps != null && parsedMileageForSteps <= 1000;

  const steps = useMemo(() => {
    const ordered: StepId[] = ["ownershipType"];
    if (ownershipType === "owned") {
      ordered.push("ownedSinceNew");
      if (ownedSinceNew === false) {
        ordered.push("mileageAtPurchase", "ownershipDuration");
      }
    }
    ordered.push(
      "currentMileage",
      "annualMileageBand",
      "usagePattern",
    );
    // ≤1,000 mi → brand new vehicle, skip optional questions entirely
    if (!isNewVehicleMileage) {
      ordered.push("optionalGate");
      if (includeOptionalSection !== false) {
        ordered.push(
          "lastServiceWhen",
          "lastServiceWhat",
          "serviceLocationPreference",
          "concerns",
        );
      }
      if (isSecondVehicle) {
        if (includeOptionalSection !== false) {
          ordered.push("garageRole");
        }
      }
    }
    return ordered;
  }, [ownershipType, ownedSinceNew, isSecondVehicle, includeOptionalSection, isNewVehicleMileage]);

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1));
    }
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
      setCtaLift(0);
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
      ctaWrapRef.current?.measureInWindow((x, y, width, height) => {
        const desiredBottom = keyboardTop - 8;
        const currentBottom = y + height;
        const overlap = currentBottom - desiredBottom;
        setCtaLift(overlap > 0 ? -overlap : 0);
      });
    });
  }, [keyboardTop, currentMileage, mileageAtPurchase, concernText, stepIndex]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const transitionToStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === stepIndex) return;
    setStepIndex(nextIndex);
  }, [steps.length, stepIndex]);

  const canContinue = useMemo(() => {
    switch (currentStep) {
      case "ownershipType":
        return !!ownershipType;
      case "ownedSinceNew":
        return ownedSinceNew !== undefined;
      case "mileageAtPurchase":
        return mileageAtPurchaseNotSure || toNumber(mileageAtPurchase) !== undefined;
      case "ownershipDuration":
        return !!ownershipDuration;
      case "currentMileage":
        return toNumber(currentMileage) !== undefined;
      case "annualMileageBand":
        return !!annualMileageBand;
      case "usagePattern":
        return !!usagePattern;
      case "optionalGate":
        return includeOptionalSection !== undefined;
      default:
        return true;
    }
  }, [
    currentStep,
    ownershipType,
    ownedSinceNew,
    mileageAtPurchaseNotSure,
    mileageAtPurchase,
    ownershipDuration,
    currentMileage,
    annualMileageBand,
    usagePattern,
    includeOptionalSection,
  ]);

  const handleSkipOptional = () => {
    Keyboard.dismiss();
    setKeyboardTop(null);
    setCtaLift(0);
    if (!OPTIONAL_STEPS.has(currentStep)) return;
    if (currentStep === "lastServiceWhen") setLastServiceWhen(undefined);
    if (currentStep === "lastServiceWhat") setLastServiceWhat([]);
    if (currentStep === "serviceLocationPreference") setServiceLocationPreference(undefined);
    if (currentStep === "concerns") {
      setConcernChoice("no");
      setConcernText("");
    }
    if (currentStep === "garageRole") setGarageRole(undefined);
    transitionToStep(stepIndex + 1);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    setKeyboardTop(null);
    setCtaLift(0);
    if (stepIndex === 0) {
      router.back();
      return;
    }
    transitionToStep(stepIndex - 1);
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    setKeyboardTop(null);
    setCtaLift(0);
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
        ownershipDuration,
        currentMileage: parsedCurrentMileage,
        annualMileageBand,
        usagePattern,
        lastServiceWhen: includeOptionalSection === false ? undefined : lastServiceWhen,
        lastServiceWhat: includeOptionalSection === false ? undefined : (lastServiceWhat.length ? lastServiceWhat : undefined),
        serviceLocationPreference: includeOptionalSection === false ? undefined : serviceLocationPreference,
        concernText: includeOptionalSection === false ? undefined : (concernChoice === "yes" ? concernText : undefined),
        garageRole: includeOptionalSection === false ? undefined : garageRole,
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

  const toggleServiceWhat = (id: string) => {
    if (id === "dont_remember") {
      setLastServiceWhat((prev) => (prev.includes("dont_remember") ? [] : ["dont_remember"]));
      return;
    }
    setLastServiceWhat((prev) => {
      const next = prev.filter((v) => v !== "dont_remember");
      return next.includes(id) ? next.filter((v) => v !== id) : [...next, id];
    });
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
              placeholderTextColor="#94A3B8"
            />
            <Pressable onPress={() => setMileageAtPurchaseNotSure((v) => !v)} style={styles.notSureRow}>
              <Text size="sm" color={mileageAtPurchaseNotSure ? "#2563EB" : "#475569"}>
                {mileageAtPurchaseNotSure ? "Not sure selected" : "Not sure"}
              </Text>
            </Pressable>
          </View>
        );
      case "ownershipDuration":
        return (
          <View style={styles.optionList}>
            <OptionCard label="< 1 year" selected={ownershipDuration === "lt1"} onPress={() => setOwnershipDuration("lt1")} />
            <OptionCard label="1 - 2 years" selected={ownershipDuration === "y1_2"} onPress={() => setOwnershipDuration("y1_2")} />
            <OptionCard label="2 - 4 years" selected={ownershipDuration === "y2_4"} onPress={() => setOwnershipDuration("y2_4")} />
            <OptionCard label="4+ years" selected={ownershipDuration === "gt4"} onPress={() => setOwnershipDuration("gt4")} />
          </View>
        );
      case "currentMileage":
        return (
          <TextInput
            style={styles.input}
            value={currentMileage}
            onChangeText={setCurrentMileage}
            keyboardType="number-pad"
            placeholder="What's on the odometer?"
            placeholderTextColor="#94A3B8"
          />
        );
      case "annualMileageBand":
        return (
          <View style={styles.optionList}>
            <OptionCard label="Light (<7.5k)" selected={annualMileageBand === "light"} onPress={() => setAnnualMileageBand("light")} />
            <OptionCard label="Avg (7.5k-12k)" selected={annualMileageBand === "avg"} onPress={() => setAnnualMileageBand("avg")} />
            <OptionCard label="Heavy (12k-18k)" selected={annualMileageBand === "heavy"} onPress={() => setAnnualMileageBand("heavy")} />
            <OptionCard label="Very Heavy (18k+)" selected={annualMileageBand === "very_heavy"} onPress={() => setAnnualMileageBand("very_heavy")} />
          </View>
        );
      case "usagePattern":
        return (
          <View style={styles.optionList}>
            <OptionCard
              label="Mostly local (short trips)"
              selected={usagePattern === "mostly_local"}
              onPress={() => setUsagePattern("mostly_local")}
            />
            <OptionCard
              label="Mostly highway (long drives)"
              selected={usagePattern === "mostly_highway"}
              onPress={() => setUsagePattern("mostly_highway")}
            />
            <OptionCard label="Mix of both" selected={usagePattern === "mixed"} onPress={() => setUsagePattern("mixed")} />
          </View>
        );
      case "optionalGate":
        return (
          <View style={styles.optionList}>
            <OptionCard
              label="Continue with extra questions"
              selected={includeOptionalSection === true}
              onPress={() => setIncludeOptionalSection(true)}
            />
            <OptionCard
              label="Finish now"
              selected={includeOptionalSection === false}
              onPress={() => setIncludeOptionalSection(false)}
            />
          </View>
        );
      case "lastServiceWhen":
        return (
          <View style={styles.optionList}>
            <OptionCard label="Recently (within a month)" selected={lastServiceWhen === "recently"} onPress={() => setLastServiceWhen("recently")} />
            <OptionCard label="Few months ago" selected={lastServiceWhen === "few_months"} onPress={() => setLastServiceWhen("few_months")} />
            <OptionCard label="Over 6 months" selected={lastServiceWhen === "over_6_months"} onPress={() => setLastServiceWhen("over_6_months")} />
            <OptionCard label="I'm not sure" selected={lastServiceWhen === "not_sure"} onPress={() => setLastServiceWhen("not_sure")} />
          </View>
        );
      case "lastServiceWhat":
        return (
          <View style={styles.chipWrap}>
            {SERVICE_WHAT_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={lastServiceWhat.includes(option.id)}
                onPress={() => toggleServiceWhat(option.id)}
              />
            ))}
          </View>
        );
      case "serviceLocationPreference":
        return (
          <View style={styles.optionList}>
            <OptionCard label="Dealership" selected={serviceLocationPreference === "dealer"} onPress={() => setServiceLocationPreference("dealer")} />
            <OptionCard
              label="Independent shop"
              selected={serviceLocationPreference === "independent"}
              onPress={() => setServiceLocationPreference("independent")}
            />
            <OptionCard label="Wherever's convenient" selected={serviceLocationPreference === "wherever"} onPress={() => setServiceLocationPreference("wherever")} />
            <OptionCard label="No go-to spot" selected={serviceLocationPreference === "no_goto"} onPress={() => setServiceLocationPreference("no_goto")} />
          </View>
        );
      case "concerns":
        return (
          <View>
            <View style={styles.optionList}>
              <OptionCard label="Nope, all good" selected={concernChoice === "no"} onPress={() => setConcernChoice("no")} />
              <OptionCard label="Yes, something's bugging me" selected={concernChoice === "yes"} onPress={() => setConcernChoice("yes")} />
            </View>
            {concernChoice === "yes" && (
              <TextInput
                style={[styles.input, { marginTop: 10, minHeight: 92 }]}
                value={concernText}
                onChangeText={setConcernText}
                placeholder="What's on your mind?"
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
              />
            )}
          </View>
        );
      case "garageRole":
        return (
          <View style={styles.optionList}>
            <OptionCard label="Primary" selected={garageRole === "primary"} onPress={() => setGarageRole("primary")} />
            <OptionCard label="Secondary" selected={garageRole === "secondary"} onPress={() => setGarageRole("secondary")} />
            <OptionCard label="Weekend" selected={garageRole === "weekend"} onPress={() => setGarageRole("weekend")} />
            <OptionCard label="Stored" selected={garageRole === "stored"} onPress={() => setGarageRole("stored")} />
          </View>
        );
      default:
        return null;
    }
  };

  const stepTitle =
    currentStep === "ownershipType" ? "This vehicle is..." :
    currentStep === "ownedSinceNew" ? "Have you had this car since new?" :
    currentStep === "mileageAtPurchase" ? "Roughly, what was the mileage when you got it?" :
    currentStep === "ownershipDuration" ? "How long have you had this vehicle?" :
    currentStep === "currentMileage" ? "What's on the odometer?" :
    currentStep === "annualMileageBand" ? "How much do you drive in a typical year?" :
    currentStep === "usagePattern" ? "How do you mostly drive?" :
    currentStep === "optionalGate" ? "Want a head start with extra questions?" :
    currentStep === "lastServiceWhen" ? "When was your car last serviced?" :
    currentStep === "lastServiceWhat" ? "What was done? Select all that apply." :
    currentStep === "serviceLocationPreference" ? "Where do you usually go?" :
    currentStep === "concerns" ? "Anything on your mind about your car right now?" :
    "How does this car fit into your garage?";

  const isOptionalStep = OPTIONAL_STEPS.has(currentStep);
  const stepBadge: { label: string; bg: string; color: string } | null =
    currentStep === "currentMileage" || currentStep === "optionalGate"
      ? null
      : isOptionalStep
        ? { label: "Optional", bg: "#FFF7ED", color: "#92400E" }
        : { label: "Required", bg: "#EEF4FF", color: "#1E3A8A" };

  const stepDescriptionText =
    currentStep === "currentMileage"
      ? "An estimate is fine - we'll refine over time."
      : currentStep === "optionalGate"
        ? "These are optional. You can finish now or continue with extra setup."
        : null;

  const entering = FadeIn.duration(250);
  const exiting = FadeOut.duration(150);

  const cardMinHeight = 420;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
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
        <ScrollView
          contentContainerStyle={styles.scrollArea}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { minHeight: cardMinHeight }]}>
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.6)", "rgba(255, 255, 255, 0.55)"]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.7)", "rgba(255, 255, 255, 0.3)", "rgba(255, 255, 255, 0)"]}
              locations={[0, 0.2, 0.5]}
              style={styles.glossyHighlight}
            />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.5)", "rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0)"]}
              locations={[0, 0.15, 0.4]}
              style={styles.glossyShine}
            />

            <View style={styles.cardContent} pointerEvents="box-none">
              <Animated.View
                key={currentStep}
                entering={entering}
                exiting={exiting}
              >
                <Text weight="bold" size="3xl" color="#0F172A" style={styles.title}>
                  {stepTitle}
                </Text>
                {stepBadge ? (
                  <View style={[styles.pillBadge, { backgroundColor: stepBadge.bg }]}>
                    <Text weight="semiBold" size="sm" color={stepBadge.color}>
                      {stepBadge.label}
                    </Text>
                  </View>
                ) : stepDescriptionText ? (
                  <Text size="md" color="#64748B" style={styles.description}>
                    {stepDescriptionText}
                  </Text>
                ) : null}
                <View style={styles.questionBody}>
                  {renderQuestionContent()}
                </View>
              </Animated.View>
              <View style={styles.actionSection}>
                <View ref={ctaWrapRef} style={styles.ctaButtonWrap}>
                  <View style={{ transform: [{ translateY: ctaLift }] }}>
                    {currentStep === "optionalGate" && includeOptionalSection === false ? (
                      <FooterButton
                        label="Finish Setup"
                        onPress={submitAndComplete}
                        disabled={isSubmitting || !canContinue}
                        backgroundColor={BrandColors.secondary}
                        rightIcon={isSubmitting ? <ActivityIndicator size="small" color={BrandColors.white} /> : undefined}
                      />
                    ) : (
                      <FooterButton
                        label={isLastStep ? "Finish Setup" : "Continue"}
                        onPress={handleContinue}
                        disabled={isSubmitting || !canContinue}
                        backgroundColor={BrandColors.secondary}
                        rightIcon={isSubmitting ? <ActivityIndicator size="small" color={BrandColors.white} /> : undefined}
                      />
                    )}
                  </View>
                </View>
                {OPTIONAL_STEPS.has(currentStep) && (
                  <Pressable onPress={handleSkipOptional} style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.75 }]}>
                    <Text weight="semiBold" size="sm" color="#475569">Skip</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function OptionCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.optionCard, selected && styles.optionCardSelected, pressed && { opacity: 0.9 }]}>
      <Text weight="semiBold" size="md" color={selected ? "#1E3A8A" : "#111827"}>
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.85 }]}>
      <Text weight="medium" size="md" color={selected ? "#1E3A8A" : "#334155"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    alignItems: "flex-start",
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
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius["2xl"],
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    overflow: "hidden",
    position: "relative",
    ...Shadows.md,
  },
  cardContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"] + 2,
    paddingBottom: Spacing["2xl"] + 6,
    position: "relative",
    zIndex: 1,
    flex: 1,
  },
  glossyHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "52%",
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
  },
  glossyShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "36%",
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
  },
  title: {
    textAlign: "left",
    marginBottom: Spacing.sm,
    lineHeight: 36,
  },
  description: {
    lineHeight: 24,
  },
  pillBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  questionBody: {
    marginTop: Spacing.lg,
  },
  actionSection: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
  },
  ctaButtonWrap: {
    marginTop: Spacing.xs,
  },
  optionList: {
    gap: 12,
  },
  optionCard: {
    borderRadius: BorderRadius.lg,
    backgroundColor: BrandColors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.md + 2,
  },
  optionCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#EEF4FF",
  },
  input: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#D7DBE2",
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md + 2,
    fontSize: 18,
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
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D7DBE2",
    backgroundColor: BrandColors.white,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md + 2,
  },
  chipSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#EEF4FF",
  },
  skipButton: {
    alignSelf: "center",
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "#D7DBE2",
    backgroundColor: BrandColors.white,
  },
});

