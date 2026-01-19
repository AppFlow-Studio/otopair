/**
 * AIInputBox
 *
 * PURPOSE: ChatGPT-style text input with auto-expand, send/mic buttons, inline voice recording
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (bottom input area)
 *
 * PROPS:
 *   - value (string): Current input text value
 *   - onChangeText ((text: string) => void): Callback when text changes
 *   - onSend (() => void): Callback when send button is pressed
 *   - isLoading (boolean): Whether AI is processing (disables input)
 *   - placeholder (string): Input placeholder text (default: "Ask anything")
 *   - disabled (boolean): Whether input is disabled
 *   - onFocus (() => void): Callback when input gains focus
 *   - onMicPressIn (() => void): Callback when microphone button is pressed in
 *   - onMicPressOut (() => void): Callback when microphone button is released
 *   - isRecording (boolean): Whether voice recording is in progress
 *   - isTranscribing (boolean): Whether transcription is in progress
 *   - meteringValue (number): Audio level for waveform visualization (-160 to 0 dB)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
} from 'react-native';

// 2. Expo & Third-party
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import { Plus, Mic, ArrowUp } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, Spacing, FontFamily } from '@/constants/theme';


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
  onMicPressIn?: () => void;
  onMicPressOut?: () => void;
  isRecording?: boolean;
  isTranscribing?: boolean;
  meteringValue?: number;
  transcript?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// TextInput height constants
const LINE_HEIGHT = 22;
const VERTICAL_PADDING = 10; // padding top + bottom inside input
const MIN_HEIGHT = LINE_HEIGHT + VERTICAL_PADDING; // Single line ~32px
const MAX_HEIGHT = LINE_HEIGHT * 6 + VERTICAL_PADDING; // ~6 lines max ~142px

const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.8 };
const TIMING_CONFIG = { duration: 150 };

// Compact waveform for ChatGPT-style
const WAVEFORM_BAR_COUNT = 12;
const WAVEFORM_BAR_WIDTH = 3;
const WAVEFORM_BAR_GAP = 3;
const WAVEFORM_MAX_HEIGHT = 16;
const WAVEFORM_MIN_HEIGHT = 4;

// ============================================================================
// ANIMATED WAVEFORM BAR
// ============================================================================

function AnimatedWaveformBar({ 
  index, 
  meteringValue, 
  totalBars 
}: { 
  index: number; 
  meteringValue: number; 
  totalBars: number;
}) {
  const animatedHeight = useSharedValue(WAVEFORM_MIN_HEIGHT);
  const phaseOffset = useSharedValue(0);

  useEffect(() => {
    phaseOffset.value = withRepeat(
      withTiming(Math.PI * 2, { 
        duration: 1200 + (index % 3) * 150, 
        easing: Easing.linear 
      }),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    const normalizedMetering = Math.max(0, Math.min(1, (meteringValue + 60) / 60));
    const centerDistance = Math.abs(index - totalBars / 2) / (totalBars / 2);
    const positionFactor = 1 - centerDistance * 0.4;
    
    const targetHeight = WAVEFORM_MIN_HEIGHT + 
      (WAVEFORM_MAX_HEIGHT - WAVEFORM_MIN_HEIGHT) * normalizedMetering * positionFactor;
    
    animatedHeight.value = withSpring(targetHeight, {
      damping: 12,
      stiffness: 200,
      mass: 0.4,
    });
  }, [meteringValue]);

  const barStyle = useAnimatedStyle(() => {
    const waveOffset = Math.sin(phaseOffset.value + (index * 0.4)) * 1.5;
    const height = Math.max(WAVEFORM_MIN_HEIGHT, animatedHeight.value + waveOffset);
    
    return {
      height,
      opacity: interpolate(height, [WAVEFORM_MIN_HEIGHT, WAVEFORM_MAX_HEIGHT], [0.6, 1]),
    };
  });

  return (
    <Animated.View style={[styles.waveformBar, barStyle]} />
  );
}

// ============================================================================
// COMPACT WAVEFORM
// ============================================================================

function CompactWaveform({ meteringValue }: { meteringValue: number }) {
  return (
    <View style={styles.waveformContainer}>
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <AnimatedWaveformBar
          key={index}
          index={index}
          meteringValue={meteringValue}
          totalBars={WAVEFORM_BAR_COUNT}
        />
      ))}
    </View>
  );
}

// ============================================================================
// TRANSCRIBING INDICATOR
// ============================================================================

function TranscribingIndicator() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    const timer1 = setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, 100);
    
    const timer2 = setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, 200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot1.value, [0, 1], [0.4, 1]),
    transform: [{ scale: interpolate(dot1.value, [0, 1], [0.85, 1.15]) }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot2.value, [0, 1], [0.4, 1]),
    transform: [{ scale: interpolate(dot2.value, [0, 1], [0.85, 1.15]) }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: interpolate(dot3.value, [0, 1], [0.4, 1]),
    transform: [{ scale: interpolate(dot3.value, [0, 1], [0.85, 1.15]) }],
  }));

  return (
    <View style={styles.transcribingContainer}>
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.transcribingDot, dot1Style]} />
        <Animated.View style={[styles.transcribingDot, dot2Style]} />
        <Animated.View style={[styles.transcribingDot, dot3Style]} />
      </View>
      <Text style={styles.transcribingText}>Transcribing</Text>
    </View>
  );
}

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
  onMicPressIn,
  onMicPressOut,
  isRecording = false,
  isTranscribing = false,
  meteringValue = -160,
  transcript = '',
}: AIInputBoxProps) {
  const showRecordingUI = isRecording || isTranscribing;
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const [isFocused, setIsFocused] = useState(false);
  
  // Animation values
  const sendButtonScale = useSharedValue(0);
  const sendButtonOpacity = useSharedValue(0);

  const hasText = value.trim().length > 0;
  const canSend = hasText && !isLoading && !disabled;

  // Animate send button visibility
  useEffect(() => {
    if (hasText) {
      sendButtonScale.value = withSpring(1, SPRING_CONFIG);
      sendButtonOpacity.value = withTiming(1, TIMING_CONFIG);
    } else {
      sendButtonScale.value = withSpring(0, SPRING_CONFIG);
      sendButtonOpacity.value = withTiming(0, TIMING_CONFIG);
    }
  }, [hasText]);

  // Handle content size changes for auto-expand/shrink
  const handleContentSizeChange = useCallback((event: any) => {
    const contentHeight = event.nativeEvent.contentSize.height;
    // Clamp between min and max
    const newHeight = Math.max(MIN_HEIGHT, Math.min(contentHeight, MAX_HEIGHT));
    setInputHeight(newHeight);
  }, []);

  // Reset height when value is cleared
  useEffect(() => {
    if (value === '') {
      setInputHeight(MIN_HEIGHT);
    }
  }, [value]);

  const handleSend = useCallback(() => {
    if (canSend) {
      Keyboard.dismiss();
      onSend();
    }
  }, [canSend, onSend]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocusProp?.();
  }, [onFocusProp]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Animated styles
  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
    opacity: sendButtonOpacity.value,
  }));

  const micButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sendButtonOpacity.value, [0, 1], [1, 0], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(sendButtonOpacity.value, [0, 1], [1, 0.8], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <View style={styles.container}>
      <View style={[
        styles.inputCard, 
        isFocused && styles.inputCardFocused,
        showRecordingUI && styles.inputCardRecording,
      ]}>
        <View style={styles.inputRow}>
          {/* Left side - Plus button or Recording indicator */}
          {!showRecordingUI ? (
            <Pressable
              style={({ pressed }) => [
                styles.plusBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={() => {
                // TODO: Open attachment menu
              }}
            >
              <Plus size={20} color="#9CA3AF" strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.recordingIndicator}>
              {isTranscribing ? (
                <TranscribingIndicator />
              ) : (
                <View style={styles.recordingLeft}>
                  <CompactWaveform meteringValue={meteringValue} />
                  <Text style={styles.releaseText} numberOfLines={1}>
                    {transcript || 'Release to send'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Center - Text Input (hidden when recording) */}
          {!showRecordingUI && (
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { height: inputHeight }]}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              multiline
              scrollEnabled
              maxLength={4000}
              editable={!isLoading && !disabled}
              onContentSizeChange={handleContentSizeChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          )}

          {/* Right side buttons */}
          <View style={styles.rightButtons}>
            {/* Mic button - always visible when no text */}
            <Animated.View style={[
              styles.buttonWrapper, 
              !showRecordingUI && micButtonAnimatedStyle
            ]}>
              <Pressable
                style={({ pressed }) => [
                  showRecordingUI ? styles.micBtnRecording : styles.micBtn,
                  !showRecordingUI && pressed && styles.micBtnPressed,
                ]}
                onPressIn={onMicPressIn}
                onPressOut={onMicPressOut}
                delayLongPress={0}
                pointerEvents={hasText && !showRecordingUI ? 'none' : 'auto'}
                disabled={isLoading || disabled}
              >
                {showRecordingUI ? (
                  <ArrowUp size={16} color={BrandColors.white} strokeWidth={2.5} />
                ) : (
                  <Mic size={18} color="#9CA3AF" strokeWidth={2} />
                )}
              </Pressable>
            </Animated.View>

            {/* Send button - shown when text exists */}
            {!showRecordingUI && (
              <Animated.View style={[styles.buttonWrapper, sendButtonAnimatedStyle]}>
                <Pressable
                  onPress={handleSend}
                  disabled={!canSend}
                  style={[styles.sendBtn, isLoading && styles.sendBtnLoading]}
                >
                  <ArrowUp size={16} color={BrandColors.white} strokeWidth={2.5} />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    </View>
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
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputCardFocused: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  inputCardRecording: {
    backgroundColor: '#EEF2FF',
    borderColor: BrandColors.secondary,
    borderWidth: 1.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  plusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  btnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    lineHeight: LINE_HEIGHT,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  rightButtons: {
    width: 32,
    height: 32,
    position: 'relative',
  },
  buttonWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 32,
    height: 32,
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnPressed: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  micBtnRecording: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnLoading: {
    backgroundColor: '#9CA3AF',
  },
  recordingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WAVEFORM_BAR_GAP,
    height: WAVEFORM_MAX_HEIGHT + 4,
  },
  waveformBar: {
    width: WAVEFORM_BAR_WIDTH,
    backgroundColor: BrandColors.secondary,
    borderRadius: WAVEFORM_BAR_WIDTH / 2,
  },
  releaseText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: '#6B7280',
  },
  transcribingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  transcribingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.secondary,
  },
  transcribingText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    color: '#6B7280',
  },
});
