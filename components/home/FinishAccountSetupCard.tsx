/**
 * FinishAccountSetupCard
 *
 * PURPOSE: Displays a prompt card encouraging users to complete their account setup with step cards
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/ActionCardsCarousel.tsx
 *
 * PROPS:
 *   - onStepPress ((stepId: string) => void): Called when a step card is pressed [optional]
 *   - onDismiss (() => void): Called when dismiss button is pressed [optional]
 *   - completedSteps (string[]): Array of completed step IDs [optional]
 *
 * EXAMPLE:
 *   <FinishAccountSetupCard
 *     onStepPress={(stepId) => router.push(`/onboarding/${stepId}`)}
 *     onDismiss={() => hideAccountSetupPrompt()}
 *     completedSteps={['create-account']}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check, CreditCard, Shuffle, UserPlus, X } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Icons
import { GradientPlusCircle } from '@/components/icons/GradientPlusCircle';

// ============================================================================
// TYPES
// ============================================================================

interface FinishAccountSetupCardProps {
  onStepPress?: (stepId: string) => void;
  onDismiss?: () => void;
  completedSteps?: string[];
}

interface SetupStep {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SETUP_STEPS: SetupStep[] = [
  { id: 'create-account', label: 'Create Account', icon: UserPlus },
  { id: 'personalize', label: 'Personalize', icon: Shuffle },
  { id: 'payment-method', label: 'Payment Method', icon: CreditCard },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function FinishAccountSetupCard({
  onStepPress,
  onDismiss,
  completedSteps = [],
}: FinishAccountSetupCardProps) {
  const router = useRouter();

  const handleStepPress = (stepId: string) => {
    if (onStepPress) {
      onStepPress(stepId);
    } else {
      // Default: navigate to step
      router.push('/coming-soon');
    }
  };

  const isStepCompleted = (stepId: string) => {
    return completedSteps.includes(stepId);
  };

  const allStepsCompleted = SETUP_STEPS.every((step) => isStepCompleted(step.id));

  // Hide card if all steps are completed
  if (allStepsCompleted && onDismiss) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header - Empty to maintain consistent spacing */}
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        Account Setup
      </Text>

      {/* Card */}
      <View style={styles.card}>
        <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.55)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Glossy top highlight - stronger */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.2, 0.5]}
          style={styles.glossyHighlight}
        />
        {/* Additional shine layer */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.15, 0.4]}
          style={styles.glossyShine}
        />
        <View style={styles.cardContent}>
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

          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text weight="bold" size="xl" color="#141C24">
              Finish setup
            </Text>
            <Text size="sm" color="#6B7280" style={styles.subtitle}>
              Complete the steps to get full access.
            </Text>
          </View>

          {/* Step Cards Row */}
          <View style={styles.stepsRow}>
          {SETUP_STEPS.map((step) => {
            const completed = isStepCompleted(step.id);
            const IconComponent = step.icon;

            return (
        <Pressable
                key={step.id}
                onPress={() => handleStepPress(step.id)}
          style={({ pressed }) => [
                  styles.stepCard,
                  completed && styles.stepCardCompleted,
                  pressed && styles.stepCardPressed,
          ]}
        >
                <View style={[styles.stepIconContainer, step.id === 'personalize' && styles.personalizeIconContainer]}>
                  {completed ? (
                    <Check size={28} color="#5299FE" />
                  ) : step.id === 'create-account' ? (
                    <GradientPlusCircle size={28} strokeWidth={2.5} />
                  ) : (
                    <IconComponent
                      size={28}
                      color="#6B7280"
                    />
                  )}
                </View>
                <Text
                  size="sm"
                  weight="medium"
                  color={completed ? '#141C24' : '#141C24'}
                  style={[styles.stepLabel, step.id === 'personalize' && styles.personalizeLabel]}
                >
                  {step.label}
          </Text>
        </Pressable>
            );
          })}
          </View>
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
    gap: 12,
  },
  sectionHeader: {
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContent: {
    padding: 16,
    position: 'relative',
  },
  glossyHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  glossyShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  headerSection: {
    marginBottom: 16,
    paddingRight: 30, // Space for close button
  },
  subtitle: {
    marginTop: 8,
    lineHeight: 20,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  stepCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 60,
  },
  stepCardCompleted: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
  },
  stepCardPressed: {
    opacity: 0.7,
  },
  stepIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  personalizeIconContainer: {
    marginTop: 8,
  },
  stepLabel: {
    textAlign: 'center',
  },
  personalizeLabel: {
    marginTop: 4,
  },
});

export default FinishAccountSetupCard;

