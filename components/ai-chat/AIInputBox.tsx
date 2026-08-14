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
  ScrollView,
} from 'react-native';

// 2. Expo & Third-party
import { Image } from 'expo-image';
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
import { ImagePlus, Mic, ArrowUp, X } from 'lucide-react-native';

// Native iOS 26 liquid glass (optional)
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch (e) {}

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
  /** Whether attachment panel is open */
  isAttachmentOpen?: boolean;
  /** Callback when plus button is pressed to toggle attachment panel */
  onToggleAttachment?: () => void;
  /** Whether there are images selected (enables send without text) */
  hasImages?: boolean;
  /** Selected image URIs — rendered as thumbnails INSIDE the composer
   *  (ChatGPT-style), so the box grows to hold them. */
  selectedImages?: string[];
  /** Remove a selected image by URI. */
  onRemoveImage?: (uri: string) => void;
  /** InputAccessoryView ID for keyboard docking */
  inputAccessoryViewID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// TextInput height constants. Keep VERTICAL_PADDING in sync with the
// textInput style's actual paddingVertical (4 top + 4 bottom = 8).
const LINE_HEIGHT = 22;
const VERTICAL_PADDING = 8;
const MIN_HEIGHT = LINE_HEIGHT + VERTICAL_PADDING; // 1 line, ~30px
const MAX_HEIGHT = LINE_HEIGHT * 8 + VERTICAL_PADDING; // 8 lines, then scroll

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
  placeholder = 'Ask Oto',
  disabled = false,
  onFocus: onFocusProp,
  onMicPressIn,
  onMicPressOut,
  isRecording = false,
  isTranscribing = false,
  meteringValue = -160,
  transcript = '',
  isAttachmentOpen = false,
  onToggleAttachment,
  hasImages = false,
  selectedImages = [],
  onRemoveImage,
  inputAccessoryViewID,
}: AIInputBoxProps) {
  const showRecordingUI = isRecording || isTranscribing;
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const [isFocused, setIsFocused] = useState(false);
  
  // Animation values
  const sendButtonScale = useSharedValue(0);
  const sendButtonOpacity = useSharedValue(0);
  const plusRotation = useSharedValue(0);

  const hasText = value.trim().length > 0;
  // Allow sending if there's text OR images
  const canSend = (hasText || hasImages) && !isLoading && !disabled;

  // Animate send button visibility (show when there's text OR images)
  useEffect(() => {
    if (hasText || hasImages) {
      sendButtonScale.value = withSpring(1, SPRING_CONFIG);
      sendButtonOpacity.value = withTiming(1, TIMING_CONFIG);
    } else {
      sendButtonScale.value = withSpring(0, SPRING_CONFIG);
      sendButtonOpacity.value = withTiming(0, TIMING_CONFIG);
    }
  }, [hasText, hasImages]);

  // Animate plus button rotation when attachment panel opens/closes
  useEffect(() => {
    plusRotation.value = withSpring(isAttachmentOpen ? 45 : 0, {
      damping: 15,
      stiffness: 300,
      mass: 0.6,
    });
  }, [isAttachmentOpen]);

  // Handle content size changes for auto-expand/shrink. `contentSize.height`
  // is the height of the text content only — it does NOT include the
  // TextInput's own padding. Add VERTICAL_PADDING so the rendered box is
  // tall enough to show the last line without clipping the descenders.
  const handleContentSizeChange = useCallback((event: any) => {
    const contentHeight = event.nativeEvent.contentSize.height;
    const newHeight = Math.max(
      MIN_HEIGHT,
      Math.min(contentHeight + VERTICAL_PADDING, MAX_HEIGHT),
    );
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

  // Animated style for plus button rotation (rotates 45deg to become X)
  const plusButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plusRotation.value}deg` }],
  }));

  const inputCardContent = (
    <View style={[
      styles.inputCardInner,
      showRecordingUI && styles.inputCardRecording,
    ]}>
      {/* Selected image thumbnails INSIDE the composer (ChatGPT-style) —
          the box grows to hold them, above the text row. */}
      {selectedImages.length > 0 && !showRecordingUI && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.attachedRowContent}
          style={styles.attachedRow}
        >
          {selectedImages.map((uri) => (
            <View key={uri} style={styles.attachedThumbWrap}>
              <Image source={{ uri }} style={styles.attachedThumb} contentFit="cover" transition={120} />
              <Pressable
                style={styles.attachedRemove}
                onPress={() => onRemoveImage?.(uri)}
                hitSlop={8}
              >
                <X size={11} color="#FFF" strokeWidth={3} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={[styles.inputRow, isFocused && !showRecordingUI && styles.inputRowFocused]}>
        {/* Recording indicator (replaces input when recording) */}
        {showRecordingUI ? (
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
        ) : (
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
            inputAccessoryViewID={inputAccessoryViewID}
          />
        )}

        {/* Right side buttons */}
        <View style={styles.rightButtonsRow}>
          {/* Plus / Add button */}
          {!showRecordingUI && (
            <Pressable
              style={({ pressed }) => [
                styles.plusBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={onToggleAttachment}
            >
              <Animated.View style={plusButtonAnimatedStyle}>
                <ImagePlus size={20} color={isAttachmentOpen ? BrandColors.secondary : (hasText ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)")} strokeWidth={2} />
              </Animated.View>
            </Pressable>
          )}

          <View style={styles.rightButtons}>
            {/* Mic button */}
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
                  <Mic size={18} color={hasText ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)"} strokeWidth={2} />
                )}
              </Pressable>
            </Animated.View>

            {/* Send button */}
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

          {/* X dismiss button removed (QA p.7): it sat one slip away from
              send. Keyboard dismissal is tap-anywhere-outside now — handled
              at the screen level (ai-chat/index.tsx), not by a button. */}
        </View>
      </View>
    </View>
  );

  if (isLiquidGlassEnabled && LiquidGlassView) {
    return (
      <View style={styles.container}>
        <LiquidGlassView interactive effect="regular" style={styles.glassCard}>
          {inputCardContent}
        </LiquidGlassView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[
        styles.inputCardOuter,
        showRecordingUI && styles.inputCardRecording,
        isFocused && !showRecordingUI && styles.inputCardOuterFocused,
      ]}>
        {inputCardContent}
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
    paddingTop: Spacing.xs,
  },
  glassCard: {
    borderRadius: 24,
  },
  inputCardOuter: {
    borderRadius: 24,
    // Softer opacity so the input reads as a glass card on the gradient.
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  inputCardOuterFocused: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(0,0,0,0.08)',
  },
  inputCardInner: {
  },
  attachedRow: {
    maxHeight: 78,
  },
  attachedRowContent: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 2,
  },
  attachedThumbWrap: {
    position: 'relative',
    paddingTop: 6,
    paddingRight: 6,
  },
  attachedThumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  attachedRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  inputCardRecording: {
    backgroundColor: '#EEF2FF',
    borderColor: BrandColors.secondary,
    borderWidth: 1.5,
    borderRadius: 28,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  inputRowFocused: {
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
    color: '#000000',
    lineHeight: LINE_HEIGHT,
    paddingVertical: 4,
    paddingHorizontal: 8,
    // Vertical-center the placeholder/single-line text; on iOS multiline
    // TextInputs ignore this and flow top-down naturally, so it doesn't
    // re-introduce the long-message clipping issue we fixed earlier.
    textAlignVertical: 'center',
  },
  rightButtonsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
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
