/**
 * FinishAccountSetupCard
 *
 * PURPOSE: Home-page card prompting users to complete account setup.
 *          Four sequential tiles — Create Account, About You, Add Car,
 *          Payment Method — each rendered with a per-state palette:
 *            • current   → first incomplete step (green-tinted face,
 *              green icon, solid green badge with white numeral).
 *            • completed → step finished (green face, green check badge).
 *            • locked    → step gated behind an earlier incomplete one
 *              (light-surface face, gray icon, light badge).
 *
 *          Completion flags are derived from Convex (`onboardingCompleted`,
 *          `tellUsAboutCompleted`, vehicle ownerships); payment is
 *          hardcoded as always-complete until the payments flow lands.
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/ActionCardsCarousel.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { X } from "lucide-react-native";
import { Car as PhosphorCar, Check as PhosphorCheck } from "phosphor-react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// 3. Shared UI
import { Text } from "@/components/shared-ui";

// 4. Convex & Store & Utilities
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import {
  buildOnboardingResumeData,
  getDevicePermissionState,
  getIncompleteOnboardingStepsFromResumeData,
  getSavedOnboardingCurrentStep,
} from "@/lib/onboarding-resume";

// ============================================================================
// DESIGN TOKENS (mirrors the Python tile generator)
// ============================================================================

type TileState = "current" | "completed" | "locked";

const PALETTE: Record<
  TileState,
  {
    face: string;
    icon: string;
    badgeRing: string;
    badge: string;
    badgeText: string;
    label: string;
  }
> = {
  // Incomplete tiles (whether "current" or "locked") share the same
  // quiet gray look per the design reference — only completed tiles
  // get the OtoPair-blue treatment. Keeping the keys split so we can
  // re-introduce a distinct "current" cue later (e.g. a thin blue
  // border) without restructuring the palette.
  current: {
    face: "#FFFFFF",
    icon: "#6B7280",
    badgeRing: "#FFFFFF",
    badge: "#F1F5F9",
    badgeText: "#1F2937",
    label: "#374151",
  },
  completed: {
    face: "#DBEAFE",
    icon: "#5299FE",
    badgeRing: "#FFFFFF",
    badge: "#5299FE",
    badgeText: "#FFFFFF",
    label: "#374151",
  },
  locked: {
    face: "#FFFFFF",
    icon: "#6B7280",
    badgeRing: "#FFFFFF",
    badge: "#F1F5F9",
    badgeText: "#1F2937",
    label: "#374151",
  },
};

// ============================================================================
// ICONS — react-native-svg ports of the Python generator paths
// ============================================================================

interface IconProps {
  color: string;
  size?: number;
}

const ICON_VIEWBOX = "26 28 40 40";

/** Person head + shoulders + plus — `icon_create_account`. */
function CreateAccountIcon({ color, size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Circle cx={43} cy={40} r={5.2} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 59 a9 9 0 0 1 18 0" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M57 34 V42 M53 38 H61" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** ID card + avatar + info lines — `icon_about_you`. */
function AboutYouIcon({ color, size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Rect x={33} y={37} width={26} height={18} rx={3} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={40} cy={44} r={2.8} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M36 51 a4 4 0 0 1 8 0" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M49 43 H55 M49 47 H55 M49 51 H53" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Phosphor `car` regular — same glyph the Python generator scaled
 *  manually, but via the vendored phosphor-react-native component
 *  (react-native-svg doesn't support nested <Svg> for the viewBox
 *  scaling trick). */
function AddCarIcon({ color, size = 32 }: IconProps) {
  return <PhosphorCar size={size} color={color} weight="regular" />;
}

/** Bank / columns — `icon_payment`. */
function PaymentMethodIcon({ color, size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Path d="M32 43 L46 34 L60 43" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M34 44 H58" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M37 46 V56 M43 46 V56 M49 46 V56 M55 46 V56" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M31 58 H61" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Check-mark for the "completed" badge — uses Phosphor's `Check`
 *  (weight `bold`) so the glyph is self-centered within its viewBox,
 *  matching how the AddCarIcon delegates to PhosphorCar. */
function CheckGlyph({ color, size = 12 }: IconProps) {
  return <PhosphorCheck size={size} color={color} weight="bold" />;
}

// ============================================================================
// TYPES
// ============================================================================

interface FinishAccountSetupCardProps {
  onPress?: () => void;
  onDismiss?: () => void;
}

interface StepConfig {
  id: "account" | "personalize" | "car" | "payment";
  label: string;
  Icon: React.ComponentType<IconProps>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FinishAccountSetupCard({
  onPress,
  onDismiss,
}: FinishAccountSetupCardProps) {
  const router = useRouter();
  const { userId: clerkUserId } = useAuth();
  const me = useQuery(api.users.getMe);
  const onboardingQa = useQuery(
    api.onboarding_questions_answers.getMyQuestionsAndAnswers,
  );
  const activeVehicleOwnerships = useQuery(
    api.vehicle_owners.getActiveByUser,
    me?._id ? { userId: me._id } : "skip",
  );
  const hasCarRegistered = (activeVehicleOwnerships?.length ?? 0) > 0;
  const updateOnboardingData = useOnboardingStore((state) => state.updateData);

  // Persisted Convex completion flags — these never reflect partial
  // in-memory progress, so "Finish later" doesn't paint a tile complete.
  const isCreateAccountComplete = me?.onboardingCompleted === true;
  const isTellUsAboutYourselfComplete = me?.tellUsAboutCompleted === true;

  const completed = [
    isCreateAccountComplete,
    isTellUsAboutYourselfComplete,
    hasCarRegistered,
    true, // payment hardcoded until the payments flow ships
  ];
  const firstIncompleteIdx = completed.findIndex((c) => !c);
  const stateFor = (idx: number): TileState => {
    if (completed[idx]) return "completed";
    if (idx === firstIncompleteIdx) return "current";
    return "locked";
  };

  const handlePress = async (stepId?: string) => {
    if (stepId === "personalize") {
      router.push("/flow");
      return;
    }

    if (stepId === "payment") {
      router.push("/payments");
      return;
    }

    if (stepId === "car") {
      router.push({
        pathname: "/(main-tabs)/cars",
        params: { openStepper: "true" },
      });
      return;
    }

    // Create Account — resume onboarding at first incomplete step.
    if (stepId === "account") {
      const permissions = await getDevicePermissionState();
      const resumeData = buildOnboardingResumeData(me, onboardingQa);
      const remaining = getIncompleteOnboardingStepsFromResumeData(
        resumeData,
        permissions,
      );
      const savedStep = await getSavedOnboardingCurrentStep(clerkUserId, remaining);
      const resumeSteps = savedStep
        ? remaining.includes(savedStep)
          ? remaining
          : [savedStep, ...remaining]
        : remaining;

      if (resumeSteps.length === 0) {
        return;
      }

      updateOnboardingData(resumeData);
      router.push({
        pathname: "/(onboarding)",
        params: {
          initialStep: resumeSteps[0],
          filteredSteps: JSON.stringify(resumeSteps),
          isResumeMode: "true",
          resumeSource: "createAccount",
        },
      });
      return;
    }

    if (onPress) {
      onPress();
      return;
    }

    router.push("/coming-soon");
  };

  const steps: StepConfig[] = [
    { id: "account", label: "Create\nAccount", Icon: CreateAccountIcon },
    { id: "personalize", label: "About\nYou", Icon: AboutYouIcon },
    { id: "car", label: "Add\nCar", Icon: AddCarIcon },
    { id: "payment", label: "Payment\nMethod", Icon: PaymentMethodIcon },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <X size={20} color="#9CA3AF" />
          </Pressable>
        )}

        <View style={styles.contentSection}>
          <Text weight="bold" size="xl" color="#141C24">
            Finish setup
          </Text>
          <Text size="sm" color="#6B7280" style={styles.subtitle}>
            Complete the steps to get full access.
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {steps.map((step, idx) => {
            const tileState = stateFor(idx);
            const palette = PALETTE[tileState];
            const isInteractive = tileState === "current";

            return (
              <Pressable
                key={step.id}
                onPress={() => isInteractive && handlePress(step.id)}
                disabled={!isInteractive}
                style={({ pressed }) => [
                  styles.stepTile,
                  { backgroundColor: palette.face },
                  pressed && isInteractive && styles.stepTilePressed,
                ]}
              >
                <View style={styles.iconWrapper}>
                  <step.Icon color={palette.icon} size={32} />
                </View>
                <Text
                  size="xs"
                  color={palette.label}
                  weight="medium"
                  center
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  ellipsizeMode="clip"
                  style={styles.stepLabel}
                >
                  {step.label}
                </Text>

                {/* Corner badge — overlaps the tile's top-right corner */}
                <View style={styles.badgeWrap} pointerEvents="none">
                  <View style={[styles.badgeRing, { backgroundColor: palette.badgeRing }]}>
                    <View style={[styles.badgeInner, { backgroundColor: palette.badge }]}>
                      {tileState === "completed" ? (
                        <CheckGlyph color={palette.badgeText} />
                      ) : (
                        <Text style={[styles.badgeNumeral, { color: palette.badgeText }]}>
                          {idx + 1}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {},
  card: {
    backgroundColor: "#F3F7FF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  contentSection: {
    marginBottom: 20,
    paddingRight: 30,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 20,
  },
  stepsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  // Soft shadow matches the Python generator's iOS-equivalent values
  // (color #E2E8F0, dy 6, blur 16, opacity 0.9).
  stepTile: {
    flex: 1,
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 96,
    position: "relative",
    overflow: "visible",
    shadowColor: "#E2E8F0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 4,
  },
  stepTilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconWrapper: {
    marginBottom: 6,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    width: "100%",
    lineHeight: 14,
    marginTop: 2,
  },
  // Corner badge — outer white ring + inner colored circle, anchored
  // so its center sits on the tile's top-right corner (overlapping by
  // half its size, per the spec).
  badgeWrap: {
    position: "absolute",
    top: -12,
    right: -12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badgeRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNumeral: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "Urbanist-Bold",
    lineHeight: 13,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});

export default FinishAccountSetupCard;
