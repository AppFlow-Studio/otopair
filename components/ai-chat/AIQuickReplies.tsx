/**
 * AIQuickReplies Component
 * Prominent reply buttons for in-conversation choices
 * Different style from PromptSuggestions - more prominent
 */

import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface QuickReply {
  id: string;
  text: string;
  value?: string;
  variant?: 'default' | 'primary' | 'outline';
}

interface AIQuickRepliesProps {
  replies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
  disabled?: boolean;
}

// ============================================================================
// QUICK REPLY BUTTON COMPONENT
// ============================================================================

function QuickReplyButton({
  reply,
  onPress,
  disabled,
  index,
}: {
  reply: QuickReply;
  onPress: () => void;
  disabled?: boolean;
  index: number;
}) {
  const scale = useSharedValue(1);
  const variant = reply.variant || 'default';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.buttonPrimary;
      case 'outline':
        return styles.buttonOutline;
      default:
        return styles.buttonDefault;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.textPrimary;
      case 'outline':
        return styles.textOutline;
      default:
        return styles.textDefault;
    }
  };

  return (
    <Animated.View
      style={animatedStyle}
      entering={FadeInUp.delay(index * 50).duration(200).springify()}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          getButtonStyle(),
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
      >
        <Text style={[styles.text, getTextStyle()]} size="sm" weight="semiBold">
          {reply.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIQuickReplies({
  replies,
  onSelect,
  disabled = false,
}: AIQuickRepliesProps) {
  if (replies.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {replies.map((reply, index) => (
        <QuickReplyButton
          key={reply.id}
          reply={reply}
          onPress={() => onSelect(reply)}
          disabled={disabled}
          index={index}
        />
      ))}
    </View>
  );
}

// ============================================================================
// PRESET QUICK REPLIES
// ============================================================================

export const PRIORITY_REPLIES: QuickReply[] = [
  { id: 'closest', text: 'Closest', value: 'closest', variant: 'default' },
  { id: 'best_rated', text: 'Best rated', value: 'best_rated', variant: 'default' },
  { id: 'best_price', text: 'Best price', value: 'best_price', variant: 'default' },
];

export const CONFIRMATION_REPLIES: QuickReply[] = [
  { id: 'confirm', text: 'Yes, book it', value: 'confirm', variant: 'primary' },
  { id: 'change', text: 'Change time', value: 'change', variant: 'outline' },
];

export const YES_NO_REPLIES: QuickReply[] = [
  { id: 'yes', text: 'Yes', value: 'yes', variant: 'primary' },
  { id: 'no', text: 'No', value: 'no', variant: 'outline' },
];

export const NOISE_TYPE_REPLIES: QuickReply[] = [
  { id: 'high_pitch', text: 'High-pitched squeal', value: 'high_pitch' },
  { id: 'grinding', text: 'Grinding sound', value: 'grinding' },
];

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  button: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    minWidth: 100,
    alignItems: 'center',
    ...Shadows.sm,
  },
  buttonDefault: {
    backgroundColor: BrandColors.white,
    borderColor: BrandColors.secondary,
  },
  buttonPrimary: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: FontFamily.semiBold,
  },
  textDefault: {
    color: BrandColors.secondary,
  },
  textPrimary: {
    color: BrandColors.white,
  },
  textOutline: {
    color: '#6B7280',
  },
});
