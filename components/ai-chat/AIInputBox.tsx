/**
 * AI Input Box Component
 * Multi-modal input with text, camera, and voice support
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  type TextInputProps,
} from 'react-native';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
import { Image, Mic, ArrowUp, X } from 'lucide-react-native';

interface AIInputBoxProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCameraPress?: () => void;
  onVoicePress?: () => void;
  isLoading?: boolean;
  isRecording?: boolean;
  selectedImage?: string | null;
  onRemoveImage?: () => void;
  placeholder?: string;
}

export function AIInputBox({
  value,
  onChangeText,
  onSend,
  onCameraPress,
  onVoicePress,
  isLoading = false,
  isRecording = false,
  selectedImage,
  onRemoveImage,
  placeholder = 'Ask RepairConnect AI',
}: AIInputBoxProps) {
  const inputRef = useRef<TextInput>(null);
  const canSend = (value.trim().length > 0 || selectedImage) && !isLoading;

  const handleSend = () => {
    if (canSend) {
      Keyboard.dismiss();
      onSend();
    }
  };

  return (
    <View style={styles.container}>
      {/* Image Preview */}
      {selectedImage && (
        <View style={styles.imagePreview}>
          <View style={styles.imagePreviewContent}>
            <Text size="sm" style={styles.imageText}>📎 Image attached</Text>
            <Pressable onPress={onRemoveImage} style={styles.removeImageBtn}>
              <X size={16} color="#6B7280" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Input Container */}
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={4000}
          editable={!isLoading}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />

        {/* Action Row */}
        <View style={styles.actionsRow}>
          {/* Left Icons */}
          <View style={styles.leftIcons}>
            <Pressable
              onPress={onCameraPress}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              disabled={isLoading}
            >
              <Image size={22} color={BrandColors.secondary} />
            </Pressable>

            <Pressable
              onPress={onVoicePress}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.iconBtnPressed,
                isRecording && styles.recordingBtn,
              ]}
              disabled={isLoading}
            >
              <Mic size={22} color={isRecording ? '#EF4444' : BrandColors.secondary} />
            </Pressable>
          </View>

          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              canSend && styles.sendBtnEnabled,
              pressed && canSend && styles.sendBtnPressed,
            ]}
          >
            <ArrowUp size={18} color={canSend ? BrandColors.white : '#9CA3AF'} />
          </Pressable>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    paddingTop: Spacing.sm,
    backgroundColor: 'transparent',
  },
  imagePreview: {
    marginBottom: Spacing.sm,
  },
  imagePreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.secondary + '15',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  imageText: {
    color: BrandColors.secondary,
  },
  removeImageBtn: {
    padding: Spacing.xs,
  },
  inputWrapper: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: BrandColors.secondary + '40',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.md,
  },
  textInput: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    minHeight: 24,
    maxHeight: 120,
    paddingVertical: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  leftIcons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  iconBtnPressed: {
    backgroundColor: BrandColors.secondary + '15',
  },
  recordingBtn: {
    backgroundColor: '#FEE2E2',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnEnabled: {
    backgroundColor: BrandColors.secondary,
  },
  sendBtnPressed: {
    opacity: 0.8,
  },
});

