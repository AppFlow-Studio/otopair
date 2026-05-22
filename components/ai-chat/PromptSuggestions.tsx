/**
 * PromptSuggestions
 *
 * PURPOSE: Displays stage-aware suggestion pills above the input box for quick responses
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown above AIInputBox when suggestions exist)
 *
 * PROPS:
 *   - stage (ConversationStage): Current conversation stage for context
 *   - suggestions (Suggestion[]): Array of suggestion objects to display
 *   - onSelect ((suggestion: Suggestion) => void): Callback when a suggestion is selected
 *   - disabled (boolean): Whether suggestions are disabled
 *
 * EXAMPLE:
 *   <PromptSuggestions
 *     stage="priority_selection"
 *     suggestions={[{ id: 'closest', text: 'Closest', value: 'closest' }]}
 *     onSelect={(suggestion) => handleSuggestion(suggestion)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { haptics } from "@/lib/haptics";

// 2. Expo & Third-party
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// 3. Shared UI (design system)
import { Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from "@/constants/theme";

// 5. Native iOS 26 liquid glass (optional)
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch (e) {}

// ============================================================================
// TYPES
// ============================================================================

export type ConversationStage =
  | "welcome"
  | "diagnosis"
  | "question"
  | "service_selection"
  | "diagnostic_form"
  | "priority_selection"
  | "shop_selection"
  | "time_selection"
  | "confirmation"
  | "success";

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
// SUGGESTION CARD COMPONENT
// ============================================================================

function SuggestionCard({
  suggestion,
  onPress,
  disabled,
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
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    haptics.selection();
    onPress();
  };

  const label = suggestion.subtitle
    ? `${suggestion.text} ${suggestion.subtitle}`
    : suggestion.text;

  if (isLiquidGlassEnabled && LiquidGlassView) {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
        >
          <LiquidGlassView
            interactive
            effect="regular"
            style={[
              styles.glassCard,
              disabled && styles.cardDisabled,
            ]}
          >
            <Text style={styles.cardText} weight="medium">
              {label}
            </Text>
          </LiquidGlassView>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
          disabled && styles.cardDisabled,
        ]}
      >
        <Text style={styles.cardText} weight="medium">
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PromptSuggestions({ stage, suggestions, onSelect, disabled = false }: PromptSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  const filtered = suggestions.filter((s) => s.id !== 'new_vehicle');
  const reordered = [
    ...filtered.filter((s) => s.id === 'oil'),
    ...filtered.filter((s) => s.id !== 'oil'),
  ];

  return (
    <View style={styles.container}>
      {reordered.map((suggestion, index) => (
        <Animated.View
          key={suggestion.id}
          entering={FadeInUp.delay(index * 350)
            .springify()
            .damping(14)
            .stiffness(70)
            .mass(1)}
        >
          <SuggestionCard
            suggestion={suggestion}
            onPress={() => onSelect(suggestion)}
            disabled={disabled}
          />
        </Animated.View>
      ))}
    </View>
  );
}

// ============================================================================
// DEFAULT SUGGESTIONS BY STAGE
// ============================================================================

export const DEFAULT_SUGGESTIONS: Record<ConversationStage, Suggestion[]> = {
  welcome: [
    { id: "brake", text: "My brakes are squeaking" },
    { id: "oil", text: "I need an oil change" },
    { id: "check_engine", text: "Check engine light is on" },
    { id: "vague", text: "Something feels off" },
    { id: "tire", text: "My tire pressure is low" },
  ],
  diagnosis: [
    { id: "high_pitch", text: "High-pitched squeal" },
    { id: "grinding", text: "Grinding sound" },
    { id: "vibration", text: "Vibration when braking" },
  ],
  question: [
    { id: "yes", text: "Yes", value: "yes" },
    { id: "no", text: "No", value: "no" },
  ],
  service_selection: [],
  diagnostic_form: [],
  priority_selection: [
    { id: "closest", text: "Closest", value: "closest" },
    { id: "best_rated", text: "Best rated", value: "best_rated" },
    { id: "best_price", text: "Best price", value: "best_price" },
  ],
  shop_selection: [
    { id: "shop_1", text: "Quick Lube Express" },
    { id: "shop_2", text: "Euro Auto Care" },
    { id: "shop_3", text: "Joe's Auto" },
  ],
  time_selection: [
    { id: "time_1", text: "Tomorrow 9:00 AM" },
    { id: "time_2", text: "Tomorrow 11:30 AM" },
    { id: "time_3", text: "Thursday 10:00 AM" },
  ],
  confirmation: [
    { id: "confirm", text: "Yes, book it" },
    { id: "change_time", text: "Change time" },
    { id: "cancel", text: "Cancel" },
  ],
  success: [],
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    alignItems: 'stretch',
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  glassCard: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  cardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    opacity: 0.85,
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardText: {
    color: "#1A202C",
    fontSize: 14,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
    textAlign: 'center',
  },
});
