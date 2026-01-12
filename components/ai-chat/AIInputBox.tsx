/**
 * AI Input Box Component
 * ChatGPT-style input with smooth animations
 * Two-row layout: text input on top, action buttons below
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
import { Plus, Mic, ArrowUp } from 'lucide-react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  onFocus?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_INPUT_HEIGHT = 24;
const MAX_INPUT_HEIGHT = 120; // ~5 lines
const LINE_HEIGHT = 22;
const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.8 };
const TIMING_CONFIG = { duration: 200 };

// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIInputBox({
  value,
  onChangeText,
  onSend,
  isLoading = false,
  placeholder = 'Ask anything',
  disabled = false,
  onFocus: onFocusProp,
}: AIInputBoxProps) {
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [isFocused, setIsFocused] = useState(false);
  
  // Animated values
  const sendButtonScale = useSharedValue(0);
  const sendButtonOpacity = useSharedValue(0);
  const containerScale = useSharedValue(1);

  const hasText = value.trim().length > 0;
  const canSend = hasText && !isLoading && !disabled;

  // Animate send button visibility based on text input
  useEffect(() => {
    if (hasText) {
      sendButtonScale.value = withSpring(1, SPRING_CONFIG);
      sendButtonOpacity.value = withTiming(1, TIMING_CONFIG);
    } else {
      sendButtonScale.value = withSpring(0, SPRING_CONFIG);
      sendButtonOpacity.value = withTiming(0, TIMING_CONFIG);
    }
  }, [hasText]);

  // Handle content size change for auto-expanding with smooth animation
  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    const { height } = e.nativeEvent.contentSize;
    const newHeight = Math.min(Math.max(height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
    
    if (newHeight !== inputHeight) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          150,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.scaleY
        )
      );
      setInputHeight(newHeight);
    }
  };

  const handleSend = () => {
    if (canSend) {
      Keyboard.dismiss();
      onSend();
    }
  };

  const handleSendPressIn = () => {
    if (canSend) {
      sendButtonScale.value = withSpring(0.85, { damping: 15, stiffness: 400 });
    }
  };

  const handleSendPressOut = () => {
    if (hasText) {
      sendButtonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    containerScale.value = withSpring(1.01, SPRING_CONFIG);
    onFocusProp?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    containerScale.value = withSpring(1, SPRING_CONFIG);
  };

  // Animated styles
  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
    opacity: sendButtonOpacity.value,
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }));

  const micButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sendButtonOpacity.value,
      [0, 1],
      [1, 0],
      Extrapolate.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          sendButtonOpacity.value,
          [0, 1],
          [1, 0.8],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      <View style={[styles.inputCard, isFocused && styles.inputCardFocused]}>
        {/* Text Input Row */}
        <View style={styles.inputRow}>
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
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          {/* Left side: Plus button */}
          <View style={styles.leftActions}>
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
          </View>

          {/* Right side: Mic and Send buttons stacked */}
          <View style={styles.rightActions}>
            <View style={styles.buttonStack}>
              {/* Microphone Button - positioned under send button */}
              <Animated.View style={[styles.micButtonContainer, micButtonAnimatedStyle]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={() => {
                    // TODO: Voice input
                  }}
                  pointerEvents={hasText ? 'none' : 'auto'}
                >
                  <Mic size={20} color="#6B7280" strokeWidth={2} />
                </Pressable>
              </Animated.View>

              {/* Send Button - appears on top when there's text */}
              <Animated.View style={[styles.sendButtonContainer, sendButtonAnimatedStyle]}>
                <Pressable
                  onPress={handleSend}
                  onPressIn={handleSendPressIn}
                  onPressOut={handleSendPressOut}
                  disabled={!canSend}
                  style={[styles.sendBtn, isLoading && styles.sendBtnLoading]}
                >
                  <ArrowUp 
                    size={18} 
                    color={BrandColors.white} 
                    strokeWidth={2.5}
                  />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  inputCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  inputCardFocused: {
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  inputRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  textInput: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    lineHeight: LINE_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  buttonStack: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  micButtonContainer: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  sendButtonContainer: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnLoading: {
    backgroundColor: '#6B7280',
  },
});
