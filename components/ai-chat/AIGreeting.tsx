/**
 * AI Greeting Component
 * Displays the welcome greeting and suggestion tiles
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/shared-ui';
import { AISuggestionTile } from './AISuggestionTile';
import { Spacing } from '@/constants/theme';
import type { SuggestionTile } from '@/services/types/ai.types';

interface AIGreetingProps {
  greeting: string;
  suggestions: SuggestionTile[];
  onSuggestionPress: (text: string) => void;
}

export function AIGreeting({ greeting, suggestions, onSuggestionPress }: AIGreetingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting} size="4xl" weight="regular">
        {greeting}
      </Text>

      <View style={styles.suggestionsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsContent}
        >
          {suggestions.map((suggestion) => (
            <AISuggestionTile
              key={suggestion.id}
              text={suggestion.text}
              onPress={() => onSuggestionPress(suggestion.text)}
              style={styles.suggestionTile}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  greeting: {
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: Spacing['4xl'],
  },
  suggestionsWrapper: {
    width: '100%',
  },
  suggestionsContent: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
  },
  suggestionTile: {
    marginRight: Spacing.sm,
  },
});

