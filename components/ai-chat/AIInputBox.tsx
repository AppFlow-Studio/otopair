/**
 * AI Input Box Component
 * ChatGPT-style input with + button, microphone, and send
 */

import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
import { Plus, Mic, ArrowUp } from 'lucide-react-native';

// ============================================================================
// TYPES
// ============================================================================

interface AIInputBoxProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_INPUT_HEIGHT = 24;
const MAX_INPUT_HEIGHT = 100; // ~4 lines
const LINE_HEIGHT = 22;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIInputBox({
  value,
  onChangeText,
  onSend,
  isLoading = false,
  placeholder = 'Ask Otopair AI',
  disabled = false,
}: AIInputBoxProps) {
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const sendButtonScale = useSharedValue(1);

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  // Handle content size change for auto-expanding
  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    const { height } = e.nativeEvent.contentSize;
    const newHeight = Math.min(Math.max(height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
    setInputHeight(newHeight);
  };

  const handleSend = () => {
    if (canSend) {
      Keyboard.dismiss();
      onSend();
    }
  };

  const handleSendPressIn = () => {
    if (canSend) {
      sendButtonScale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    }
  };

  const handleSendPressOut = () => {
    sendButtonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        {/* Plus Button */}
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          onPress={() => {
            // TODO: Open attachment menu
          }}
        >
          <Plus size={20} color="#6B7280" strokeWidth={2} />
        </Pressable>

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, { minHeight: inputHeight }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={4000}
          editable={!isLoading && !disabled}
          onContentSizeChange={handleContentSizeChange}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />

        {/* Microphone Button (when no text) */}
        {!value.trim() && (
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            onPress={() => {
              // TODO: Voice input
            }}
          >
            <Mic size={20} color="#6B7280" strokeWidth={2} />
          </Pressable>
        )}

        {/* Send Button */}
        <Animated.View style={[styles.sendButtonWrapper, sendButtonAnimatedStyle]}>
          <Pressable
            onPress={handleSend}
            onPressIn={handleSendPressIn}
            onPressOut={handleSendPressOut}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              canSend && styles.sendBtnEnabled,
            ]}
          >
            <ArrowUp 
              size={18} 
              color={canSend ? BrandColors.white : '#9CA3AF'} 
              strokeWidth={2.5}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    ...Shadows.sm,
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnPressed: {
    backgroundColor: '#F3F4F6',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    lineHeight: LINE_HEIGHT,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sendButtonWrapper: {
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnEnabled: {
    backgroundColor: BrandColors.secondary,
  },
});
