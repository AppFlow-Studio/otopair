/**
 * AISuggestionTile
 *
 * PURPOSE: Displays a single tappable suggestion card with text (legacy)
 *
 * USED IN: Not currently used (consider AIGreeting or PromptSuggestions instead)
 *
 * PROPS:
 *   - text (string): Suggestion text to display
 *   - onPress (() => void): Callback when tile is pressed
 *   - style (ViewStyle): Optional custom styles [optional]
 *
 * EXAMPLE:
 *   <AISuggestionTile text="Fix brake noise" onPress={() => handleSuggestion()} />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

// 2. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 3. Constants, hooks, types
import { BrandColors, BorderRadius, Shadows, Spacing } from '@/constants/theme';

interface AISuggestionTileProps {
  text: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function AISuggestionTile({ text, onPress, style }: AISuggestionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && styles.tilePressed,
        style,
      ]}
    >
      <Text style={styles.text} size="sm" weight="medium">
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minWidth: 150,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    ...Shadows.sm,
  },
  tilePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: BrandColors.secondary,
    lineHeight: 20,
  },
});

