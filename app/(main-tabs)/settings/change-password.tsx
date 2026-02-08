/**
 * ChangePasswordScreen
 *
 * PURPOSE: Allows users to update their account password.
 *          Features a glass-morphism card, password strength meter, and validation.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (via navigation)
 */

import React, { useState, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';

import { BrandColors, Spacing, Text, BlurHeaderOverlay } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

// Initialize zxcvbn options
zxcvbnOptions.setOptions({
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
});

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password strength logic using zxcvbn-ts
  const strength = useMemo(() => {
    if (!newPassword) return 0;
    const result = zxcvbn(newPassword);
    // zxcvbn score is 0-4. We'll map it directly.
    // 0: too guessable, 1: very guessable, 2: somewhat guessable, 3: safely unguessable, 4: very unguessable
    // We'll treat 0 as 1 for the UI segments if there's any text, or just use it as is.
    return Math.max(result.score, 1);
  }, [newPassword]);

  const strengthLabel = useMemo(() => {
    if (!newPassword) return '';
    switch (strength) {
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      default: return '';
    }
  }, [newPassword, strength]);

  const strengthColor = useMemo(() => {
    if (!newPassword) return '#E5E7EB';
    switch (strength) {
      case 1: return '#f87171'; // red-400
      case 2: return '#fb923c'; // orange-400
      case 3: return '#fbbf24'; // amber-400
      case 4: return '#4ade80'; // green-400
      default: return '#E5E7EB';
    }
  }, [newPassword, strength]);

  const canSubmit = currentPassword && newPassword && confirmPassword && newPassword === confirmPassword && !isSubmitting;

  const handleUpdatePassword = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Settings" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 80,
              paddingBottom: getSheetContentPadding(true, insets.bottom)
            }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroArea}>
            <Text weight="bold" style={styles.heroTitle}>Change password</Text>
            <Text size="md" color="#86868b">Update your account security.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.glassCard}>
            {/* Current Password */}
            <View style={styles.formRow}>
              <View style={styles.inputWrapper}>
                <Text weight="medium" size="xs" color="#86868b" style={styles.rowLabel}>
                  CURRENT PASSWORD*
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.rowInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#aeaeb2"
                    secureTextEntry={!showCurrent}
                  />
                  <Pressable onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeIcon}>
                    {showCurrent ? <Eye size={20} color="#86868b" /> : <EyeOff size={20} color="#86868b" />}
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            {/* New Password */}
            <View style={styles.formRow}>
              <View style={styles.inputWrapper}>
                <Text weight="medium" size="xs" color="#86868b" style={styles.rowLabel}>
                  NEW PASSWORD*
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.rowInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#aeaeb2"
                    secureTextEntry={!showNew}
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeIcon}>
                    {showNew ? <Eye size={20} color="#86868b" /> : <EyeOff size={20} color="#86868b" />}
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            {/* Confirm Password */}
            <View style={styles.formRow}>
              <View style={styles.inputWrapper}>
                <Text weight="medium" size="xs" color="#86868b" style={styles.rowLabel}>
                  CONFIRM PASSWORD*
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.rowInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#aeaeb2"
                    secureTextEntry={!showConfirm}
                  />
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                    {showConfirm ? <Eye size={20} color="#86868b" /> : <EyeOff size={20} color="#86868b" />}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Strength Meter */}
          <View style={styles.strengthArea}>
            <View style={styles.strengthHeader}>
              <Text size="xs" weight="medium" color="#86868b">Password Strength</Text>
              <Text size="xs" weight="bold" color={strengthColor}>{strengthLabel}</Text>
            </View>
            <View style={styles.strengthBarContainer}>
              {[1, 2, 3, 4].map((seg) => (
                <View
                  key={seg}
                  style={[
                    styles.strengthSegment,
                    { backgroundColor: strength >= seg ? strengthColor : '#E5E7EB' }
                  ]}
                />
              ))}
            </View>
            <Text size="xs" color="#86868b" style={styles.strengthHint}>
              8+ characters{"\n\n"}Use a longer phrase for better security (e.g. 12–16+ characters)
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          {/* Submit Area */}
          <View style={styles.submitArea}>
            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleUpdatePassword}
              disabled={!canSubmit}
            >
              <Text weight="semiBold" size="md" color="#FFF">
                {isSubmitting ? 'Updating...' : 'Update password'}
              </Text>
            </Pressable>
            <Pressable style={styles.forgotButton}>
              <Text weight="medium" size="md" color={BrandColors.secondary}>
                Forgot password?
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  heroArea: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: '#111318',
    marginBottom: 8,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    width: '100%',
  },
  rowLabel: {
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowInput: {
    flex: 1,
    fontSize: 17,
    color: '#1d1d1f',
    padding: 0,
    height: 24,
  },
  eyeIcon: {
    padding: 4,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    marginLeft: 16,
  },
  strengthArea: {
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    height: 6,
    gap: 6,
  },
  strengthSegment: {
    flex: 1,
    borderRadius: 3,
  },
  strengthHint: {
    marginTop: 8,
    lineHeight: 16,
  },
  submitArea: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  forgotButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
