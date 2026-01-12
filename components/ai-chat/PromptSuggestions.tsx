/**
 * PromptSuggestions Component
 * Stage-aware suggestion pills that appear above the input box
 * Inspired by prompt-kit's PromptSuggestion component
 */

import React from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export type ConversationStage = 
  | 'welcome'
  | 'diagnosis'
  | 'question'
  | 'service_selection'
  | 'priority_selection'
  | 'shop_selection'
  | 'time_selection'
  | 'confirmation'
  | 'success';

export interface Suggestion {
  id: string;
  text: string;
  subtitle?: string; // Optional subtitle for ChatGPT-style chips
  value?: string; // Optional different value to send
}

interface PromptSuggestionsProps {
  stage: ConversationStage;
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  disabled?: boolean;
}

// ============================================================================
// ANIMATED PILL COMPONENT
// ============================================================================

function SuggestionPill({ 
  suggestion, 
  onPress, 
  disabled 
}: { 
  suggestion: Suggestion; 
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.pill,
          pressed && styles.pillPressed,
          disabled && styles.pillDisabled,
        ]}
      >
        <Text style={styles.pillText} size="sm" weight="medium">
          {suggestion.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PromptSuggestions({
  stage,
  suggestions,
  onSelect,
  disabled = false,
}: PromptSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((suggestion) => (
          <SuggestionPill
            key={suggestion.id}
            suggestion={suggestion}
            onPress={() => onSelect(suggestion)}
            disabled={disabled}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// DEFAULT SUGGESTIONS BY STAGE
// ============================================================================

export const DEFAULT_SUGGESTIONS: Record<ConversationStage, Suggestion[]> = {
  welcome: [
    { id: 'brake', text: 'My brakes are squeaking' },
    { id: 'oil', text: 'I need an oil change' },
    { id: 'check_engine', text: 'Check engine light is on' },
    { id: 'vague', text: 'Something feels off' },
    { id: 'tire', text: 'My tire pressure is low' },
  ],
  diagnosis: [
    { id: 'high_pitch', text: 'High-pitched squeal' },
    { id: 'grinding', text: 'Grinding sound' },
    { id: 'vibration', text: 'Vibration when braking' },
  ],
  question: [
    { id: 'yes', text: 'Yes', value: 'yes' },
    { id: 'no', text: 'No', value: 'no' },
  ],
  service_selection: [],
  priority_selection: [
    { id: 'closest', text: 'Closest', value: 'closest' },
    { id: 'best_rated', text: 'Best rated', value: 'best_rated' },
    { id: 'best_price', text: 'Best price', value: 'best_price' },
  ],
  shop_selection: [
    { id: 'shop_1', text: 'Quick Lube Express' },
    { id: 'shop_2', text: 'Euro Auto Care' },
    { id: 'shop_3', text: "Joe's Auto" },
  ],
  time_selection: [
    { id: 'time_1', text: 'Tomorrow 9:00 AM' },
    { id: 'time_2', text: 'Tomorrow 11:30 AM' },
    { id: 'time_3', text: 'Thursday 10:00 AM' },
  ],
  confirmation: [
    { id: 'confirm', text: 'Yes, book it' },
    { id: 'change_time', text: 'Change time' },
    { id: 'cancel', text: 'Cancel' },
  ],
  success: [],
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // Semi-transparent, faded white
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    // No shadow for cleaner, more faded look
  },
  pillPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  pillDisabled: {
    opacity: 0.4,
  },
  pillText: {
    color: '#4A5568', // Softer, muted dark gray
    fontFamily: FontFamily.medium,
  },
});
