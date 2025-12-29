/**
 * FinishCarSetupCard
 *
 * PURPOSE: Displays a checklist card prompting users to complete vehicle setup with progress tracking and action buttons
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/ActionCardsCarousel.tsx
 *
 * PROPS:
 *   - checklist (ChecklistItem[]): Array of checklist items to display [optional]
 *   - onPress (() => void): Called when card is pressed to navigate to car setup [optional]
 *   - onDismiss (() => void): Called when dismiss button is pressed [optional]
 *
 * EXAMPLE:
 *   <FinishCarSetupCard
 *     checklist={setupChecklist}
 *     onPress={() => router.push('/onboarding/add-vehicle')}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { useRouter } from 'expo-router';
import { ArrowRight, Square, X } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

interface FinishCarSetupCardProps {
  checklist?: ChecklistItem[];
  onPress?: () => void;
  onDismiss?: () => void;
}

// Default checklist items
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'vin', label: 'Add your VIN number', completed: false },
  { id: 'mileage', label: 'Enter last known mileage', completed: false },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function FinishCarSetupCard({
  checklist = DEFAULT_CHECKLIST,
  onPress,
  onDismiss,
}: FinishCarSetupCardProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default: navigate to vehicle setup flow
      router.push('/coming-soon');
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#6B7280" style={styles.sectionHeader}>
        Vehicle Setup
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
            Finish Setting Up Your Car
          </Text>
          <Text size="sm" color="#6B7280" style={styles.subtitle}>
            Complete your setup to track services, get reminders, and find the best mechanics.
          </Text>
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          {checklist.map((item) => (
            <View key={item.id} style={styles.checklistItem}>
              <View style={styles.checkbox}>
                <Square size={18} color="#D1D5DB" />
              </View>
              <Text size="sm" color="#374151">
                {item.label}
              </Text>
            </View>
          ))}
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
  checklist: {
    gap: 12,
    marginBottom: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
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

export default FinishCarSetupCard;

