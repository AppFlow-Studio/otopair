/**
 * AIGreeting
 *
 * PURPOSE: Displays ChatGPT-style greeting with horizontal scrolling suggestion chips
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when no messages exist)
 *
 * PROPS:
 *   - userName (string): User's name to display in greeting (default: "User")
 *   - suggestions (Suggestion[]): Array of suggestion objects to display
 *   - onSuggestionPress ((text: string) => void): Callback when a suggestion is pressed
 *
 * EXAMPLE:
 *   <AIGreeting
 *     userName="John"
 *     suggestions={[{ id: '1', text: 'Fix', subtitle: 'brake noise' }]}
 *     onSuggestionPress={(text) => console.log(text)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface Suggestion {
  id: string;
  text: string;
  subtitle?: string;
  value?: string;
}

interface AIGreetingProps {
  userName?: string;
  suggestions: Suggestion[];
  onSuggestionPress: (text: string) => void;
}

// ============================================================================
// CHATGPT-STYLE HORIZONTAL SUGGESTIONS
// ============================================================================

const HORIZONTAL_SUGGESTIONS: Suggestion[] = [
  {
    id: 'brake',
    text: 'Fix',
    subtitle: 'brake noise',
  },
  {
    id: 'engine',
    text: 'Check',
    subtitle: 'engine light',
  },
  {
    id: 'oil',
    text: 'Schedule',
    subtitle: 'a service',
  },
  {
    id: 'vague',
    text: 'Not sure',
    subtitle: "what's wrong",
  },
];

// ============================================================================
// SUGGESTION CHIP COMPONENT
// ============================================================================

function SuggestionChip({
  suggestion,
  onPress,
  index,
}: {
  suggestion: Suggestion;
  onPress: () => void;
  index: number;
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

  return (
    <Animated.View
      entering={FadeInUp.delay(400 + index * 80).duration(300)}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.suggestionChip,
            pressed && styles.suggestionChipPressed,
          ]}
        >
          <Text style={styles.suggestionTitle} weight="semiBold">
            {suggestion.text}
          </Text>
            {suggestion.subtitle && (
              <Text style={styles.suggestionSubtitle}>
                {suggestion.subtitle}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIGreeting({ userName = 'User', suggestions, onSuggestionPress }: AIGreetingProps) {
  // Use provided suggestions or fallback to defaults
  const displaySuggestions = suggestions.length > 0 ? suggestions : HORIZONTAL_SUGGESTIONS;

  return (
    <View style={styles.container}>
      {/* Greeting - Centered in middle of screen */}
      <View style={styles.greetingContainer}>
        <Animated.View entering={FadeIn.delay(100).duration(500)}>
          <Text style={styles.greeting} weight="semiBold">
            Hello, {userName}
          </Text>
        </Animated.View>
      </View>

      {/* Horizontal Scrolling Suggestions - At bottom */}
      <View style={styles.suggestionsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsScroll}
        >
          {displaySuggestions.map((suggestion, index) => (
            <SuggestionChip
              key={suggestion.id}
              suggestion={suggestion}
              onPress={() => onSuggestionPress(
                suggestion.value ||
                (suggestion.subtitle 
                  ? `${suggestion.text} ${suggestion.subtitle}` 
                  : suggestion.text)
              )}
              index={index}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  greeting: {
    fontSize: 38,
    lineHeight: 48,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  suggestionsContainer: {
    paddingBottom: Platform.OS === 'android' ? Spacing.md : Spacing.xs,
  },
  suggestionsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // Semi-transparent white
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 0,
    minWidth: 120,
  },
  suggestionChipPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  suggestionTitle: {
    color: '#4A5568', // Softer, muted dark gray
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
  suggestionSubtitle: {
    color: '#A0AEC0', // Softer gray for subtitle
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
});
