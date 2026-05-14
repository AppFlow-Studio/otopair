/**
 * FinishAccountSetupCard
 *
 * PURPOSE: Displays a prompt card encouraging users to complete their account setup with dismiss and action buttons.
 *          "Create Account" button navigates to incomplete onboarding steps with a filtered progress bar.
 *          "About You" button navigates to the TellUsAboutFlow.
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/ActionCardsCarousel.tsx
 *
 * PROPS:
 *   - onPress (() => void): Called when card is pressed to navigate to account setup [optional]
 *   - onDismiss (() => void): Called when dismiss button is pressed [optional]
 *
 * EXAMPLE:
 *   <FinishAccountSetupCard
 *     onPress={() => router.push('/onboarding/profile')}
 *     onDismiss={() => hideAccountSetupPrompt()}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { useRouter } from "expo-router";
import { X, Shuffle, Landmark } from "lucide-react-native";
import { PlusCircleIcon, ShuffleIcon, UserCircleIcon, CarIcon, BankIcon } from "phosphor-react-native";

// 3. Shared UI
import { Text } from "@/components/shared-ui";
import { GradientPlusCircle } from "@/components/icons/gradient-plus-circle";

// 4. Convex & Store & Utilities
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import {
  buildOnboardingResumeData,
  getDevicePermissionState,
  getIncompleteOnboardingStepsFromResumeData,
} from "@/lib/onboarding-resume";

// ============================================================================
// TYPES
// ============================================================================

interface FinishAccountSetupCardProps {
  onPress?: () => void;
  onDismiss?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FinishAccountSetupCard({
  onPress,
  onDismiss,
}: FinishAccountSetupCardProps) {
  const router = useRouter();
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

  // Use persisted Convex completion flags for the home-card status so
  // "Finish later" never leaves the tile looking complete just because
  // the in-memory onboarding store still has partial answers.
  const isCreateAccountComplete = me?.onboardingCompleted === true;
  const isTellUsAboutYourselfComplete = me?.tellUsAboutCompleted === true;

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
      router.push("/add-vehicle");
      return;
    }

    if (stepId === "account") {
      const resumeData = buildOnboardingResumeData(me, onboardingQa);
      const devicePermissions = await getDevicePermissionState();
      const incompleteSteps = getIncompleteOnboardingStepsFromResumeData(
        resumeData,
        devicePermissions,
      );

      if (incompleteSteps.length === 0) {
        // All steps complete - could show a message or navigate elsewhere
        return;
      }

      updateOnboardingData({
        ...resumeData,
        pushNotificationStatus: devicePermissions.pushNotificationStatus,
        pushNotificationsGranted:
          devicePermissions.pushNotificationStatus === "granted" ||
          devicePermissions.pushNotificationStatus === "provisional",
        locationPermissionStatus: devicePermissions.locationPermissionStatus,
        locationGranted: devicePermissions.locationPermissionStatus === "granted",
      });

      // Navigate to onboarding with filtered steps
      router.push({
        pathname: "/(onboarding)",
        params: {
          initialStep: incompleteSteps[0],
          filteredSteps: JSON.stringify(incompleteSteps),
          isResumeMode: "true",
        },
      });
      return;
    }

    if (stepId === "car") {
      router.push("/add-vehicle");
      return;
    }

    if (onPress) {
      onPress();
    } else {
      // Default: navigate to onboarding/setup flow
      router.push("/coming-soon");
    }
  };

  const steps = [
    { id: "account", label: "Create Account", icon: GradientPlusCircle },
    { id: "personalize", label: "About You", icon: UserCircleIcon },
    { id: "car", label: "Add Car", icon: CarIcon },
    { id: "payment", label: "Payment Method", icon: BankIcon },
  ];

  return (
    <View style={styles.container}>
      {/* Card */}
      <View style={styles.card}>
        {/* Close Button */}
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

        {/* Content */}
        <View style={styles.contentSection}>
          <Text weight="bold" size="xl" color="#141C24">
            Finish setup
          </Text>
          <Text size="sm" color="#6B7280" style={styles.subtitle}>
            Complete the steps to get full access.
          </Text>
        </View>

        {/* Steps Horizontal List */}
        <View style={styles.stepsContainer}>
          {steps.map((step) => {
            const isComplete =
              (step.id === "account" && isCreateAccountComplete) ||
              (step.id === "personalize" && isTellUsAboutYourselfComplete) ||
              (step.id === "car" && hasCarRegistered) ||
              step.id === "payment";
            
            return (
              <Pressable
                key={step.id}
                onPress={() => !isComplete && handlePress(step.id)}
                disabled={isComplete}
                style={({ pressed }) => [
                  styles.stepTile,
                  pressed && !isComplete && styles.stepTilePressed,
                  isComplete && styles.stepTileDisabled,
                ]}
              >
                <View style={[styles.iconWrapper, isComplete && styles.iconWrapperDisabled]}>
                  {step.id === "account" ? (
                    <step.icon size={34} color={isComplete ? "#9CA3AF" : undefined} />
                  ) : step.id === "personalize" ? (
                    <step.icon size={38} color={isComplete ? "#9CA3AF" : "#6B7280"} />
                  ) : step.id === "car" ? (
                    <step.icon size={36} color={isComplete ? "#9CA3AF" : "#6B7280"} />
                  ) : step.id === "payment" ? (
                    <step.icon size={36} color="#6B7280" />
                  ) : (
                    <step.icon size={30} color="#6B7280" strokeWidth={1.5} />
                  )}
                </View>
                <Text
                  size="xs"
                  color={isComplete ? "#9CA3AF" : "#141C24"}
                  weight="medium"
                  center
                  style={styles.stepLabel}
                >
                  {step.label}
                </Text>
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
  container: {
    // No gap needed here as we removed sectionHeader
  },
  card: {
    backgroundColor: "#F3F7FF", // Light bluish background like in screenshot
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
    paddingRight: 30, // Space for close button
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
  stepTile: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 110,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stepTilePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  stepTileDisabled: {
    backgroundColor: "#F9FAFB",
    opacity: 0.6,
  },
  iconWrapper: {
    marginBottom: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperDisabled: {
    opacity: 0.5,
  },
  stepLabel: {
    lineHeight: 12,
    marginTop: 2,
  },
});

export default FinishAccountSetupCard;
