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
import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
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

/** How long the finished card lingers before it collapses away. */
const HOLD_MS = 1500;

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
  /** True when this card is the one the carousel is actually showing. The
   *  completion animation ends by dismissing the card, so it must not run
   *  while parked off-screen. */
  isVisible?: boolean;
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
  isVisible = true,
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
  // `has_saved_payment_method` is stamped by the setup_intent.succeeded
  // webhook (see convex/http.ts) so this tile is fully reactive: the
  // moment Stripe confirms a saved card, the flag flips and the tile
  // becomes complete without a remount.
  //
  // "Create Account" is the post-signup onboarding flow (phone → name
  // → photo → intent → …), completed when AnalyzingScreen finishes
  // and stamps `onboardingCompleted`.
  // "About You" is the branching TellUsAboutFlow (5–8 questions
  // depending on carKnowledgeLevel), completed when it finishes and
  // stamps `tellUsAboutCompleted`.
  const isCreateAccountComplete = me?.onboardingCompleted === true;
  const isTellUsAboutYourselfComplete = me?.tellUsAboutCompleted === true;
  const isPaymentComplete = me?.has_saved_payment_method === true;

  const completed = [
    isCreateAccountComplete,
    isTellUsAboutYourselfComplete,
    hasCarRegistered,
    isPaymentComplete,
  ];
  // The card is kept mounted after the last step lands so the user sees
  // four ticks and can acknowledge it with the × (the parent only supplies
  // `onDismiss` in that state), so the header copy has to survive it.
  const allComplete = completed.every(Boolean);

  /*
   * Completion moment. The parent only supplies `onDismiss` once every step
   * is done, so that prop doubles as "this card has earned its send-off".
   * Runs when Home renders the card in the finished state — the user
   * completes the last step elsewhere and sees the payoff on returning here.
   *
   * `played` guards it: the card re-renders on every reactive query tick, and
   * without the ref the sequence would restart (and re-fire onDismiss) each
   * time. onDismiss is deliberately not in the dep array for the same reason —
   * the parent rebuilds that closure on render.
   */
  const played = useRef(false);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const overlayProgress = useSharedValue(0);
  const badgeScale = useSharedValue(0.5);

  useEffect(() => {
    if (!allComplete || !onDismiss || !isVisible || played.current) return;
    played.current = true;

    overlayProgress.value = withTiming(1, { duration: 220 });
    badgeScale.value = withSequence(
      withTiming(1.12, { duration: 280, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160 }),
    );

    // Hold the moment, then collapse. Persisting the dismissal is the very
    // last step so the card cannot vanish before the animation is seen.
    cardScale.value = withDelay(HOLD_MS, withTiming(0.97, { duration: 320 }));
    cardOpacity.value = withDelay(
      HOLD_MS,
      withTiming(0, { duration: 320 }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allComplete, isVisible]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayProgress.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: overlayProgress.value,
    transform: [{ scale: badgeScale.value }],
  }));
  const firstIncompleteIdx = completed.findIndex((c) => !c);
  const stateFor = (idx: number): TileState => {
    if (completed[idx]) return "completed";
    if (idx === firstIncompleteIdx) return "current";
    return "locked";
  };

  const handlePress = async (stepId?: string) => {
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

    // About You — routes into the branching TellUsAboutFlow.
    if (stepId === "personalize") {
      router.push("/flow");
      return;
    }

    // Create Account — resume the post-signup onboarding at the first
    // incomplete step.
    if (stepId === "account") {
      const permissions = await getDevicePermissionState();
      const resumeData = buildOnboardingResumeData(me, onboardingQa);
      const rawRemaining = getIncompleteOnboardingStepsFromResumeData(
        resumeData,
        permissions,
      );
      // Only filter `phone` when the Convex record actually confirms
      // the number is verified — Clerk phone auth guarantees this,
      // but OAuth users (Google/Apple) sign in with zero phone data,
      // so unconditionally dropping `phone` would let an OAuth user
      // skip the phone step entirely.
      // `name` filters when a name is on the record (same defensive
      // handling for silent persistProfileField failures).
      const hasName = !!(me?.first_name && me?.last_name);
      const isPhoneVerified = me?.phoneVerified === true && !!me?.phone;
      const remaining = rawRemaining.filter((s) => {
        if (s === "phone" && isPhoneVerified) return false;
        // OAuth auto-populates first/last name from the provider, so
        // `hasName` alone isn't proof the user saw NameStep. Require
        // phoneVerified as the "walked through onboarding" signal.
        if (s === "name" && hasName && isPhoneVerified) return false;
        return true;
      });

      // Prefer step sources in this priority:
      //   1. `me.onboardingDeferredStep` — server-persisted step from
      //      the last "Finish later" tap; survives sign-outs.
      //   2. `getSavedOnboardingCurrentStep` — SecureStore fallback
      //      (in-session mid-flow closes).
      // Both take precedence over the earliest missing field.
      const deferredStep = (me as { onboardingDeferredStep?: string } | null | undefined)?.onboardingDeferredStep;
      const savedStep = deferredStep ?? await getSavedOnboardingCurrentStep(clerkUserId, remaining);
      let resumeSteps: typeof remaining;
      if (savedStep) {
        const savedIdx = remaining.indexOf(savedStep as (typeof remaining)[number]);
        resumeSteps = savedIdx >= 0
          ? remaining.slice(savedIdx)                                        // drop steps before saved
          : [savedStep as (typeof remaining)[number], ...remaining];         // savedStep not in remaining — prepend it
      } else {
        resumeSteps = remaining;
      }

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
      <Animated.View style={[styles.card, cardAnimStyle]}>
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
            {allComplete ? "You're all set" : "Finish setup"}
          </Text>
          <Text size="sm" color="#6B7280" style={styles.subtitle}>
            {allComplete
              ? "Full access unlocked."
              : "Complete the steps to get full access."}
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

        {/* Completion moment. Sits over the finished tiles rather than
            replacing them, so the four ticks stay visible underneath and the
            card reads as "done" rather than as a different card. */}
        <Animated.View
          style={[styles.celebration, overlayStyle]}
          pointerEvents="none"
        >
          {/* Badge only — the card's own header already reads "You're all
              set / Full access unlocked" underneath, so repeating it here
              just doubled the words on screen. */}
          <Animated.View style={[styles.celebrationBadge, badgeStyle]}>
            <CheckGlyph color="#FFFFFF" size={38} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {},
  celebration: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    // Card's own background, near-opaque: the ticked tiles stay faintly
    // visible through it instead of being blanked out.
    backgroundColor: "rgba(243,247,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  celebrationBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
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
