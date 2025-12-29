/**
 * AI Suggestion Tile Component
 * Displays a tappable suggestion card
 */

import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '@/components/shared-ui';
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

