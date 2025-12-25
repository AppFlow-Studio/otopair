/**
 * FinishAccountSetupCard
 *
 * PURPOSE: Displays a prompt card encouraging users to complete their account setup with dismiss and action buttons
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
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { useRouter } from 'expo-router';
import { ArrowRight, X } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

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

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default: navigate to onboarding/setup flow
      router.push('/coming-soon');
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header - Empty to maintain consistent spacing */}
      <Text size="md" color="#6B7280" style={styles.sectionHeader}>
        Account Setup
      </Text>

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
            Finish Setting Up Your Account
          </Text>
          <Text size="sm" color="#6B7280" style={styles.subtitle}>
            Complete your setup so you can book faster and get full access.
          </Text>
        </View>

        {/* CTA Button */}
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed,
          ]}
        >
          <Text weight="semiBold" size="md" color="#FFFFFF">
            Finish Setup
          </Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </Pressable>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  contentSection: {
    marginBottom: 16,
    paddingRight: 30, // Space for close button
  },
  subtitle: {
    marginTop: 8,
    lineHeight: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5299FE',
    paddingVertical: 14,
    borderRadius: 10,
  },
  ctaButtonPressed: {
    opacity: 0.8,
  },
});

export default FinishAccountSetupCard;

