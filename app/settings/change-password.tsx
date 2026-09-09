/**
 * ChangePasswordScreen
 *
 * PURPOSE: Allows users to update their account password.
 *          Features a glass-morphism card, password strength meter, and validation.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (via navigation)
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <ChangePasswordScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { Eye, EyeOff } from 'lucide-react-native';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import { useUser } from '@clerk/clerk-expo';

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
  const { user, isLoaded } = useUser();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const passwordsMatch = newPassword === confirmPassword;
  const isPasswordLongEnough = newPassword.length >= 8;
  const isSameAsCurrent = newPassword === currentPassword && currentPassword !== '';
  const canSubmit = currentPassword && newPassword && confirmPassword && passwordsMatch && isPasswordLongEnough && !isSameAsCurrent && !isSubmitting && isLoaded;

  const handleUpdatePassword = async () => {
    if (!canSubmit || !user) return;
    
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
      });
      
      setSuccessMessage('Password updated successfully.');
      
      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Navigate back after a short delay to show success
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage 
        || err?.errors?.[0]?.message 
        || err?.message 
        || 'Unable to update password. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Change Password" />

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
            <Text weight="bold" style={styles.heroTitle}>New Password</Text>
            <Text size="md" color="#86868b">Choose a strong password to protect your account.</Text>
          </View>

          {/* Feedback Messages */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text size="sm" color="#f87171" weight="medium">{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successContainer}>
              <Text size="sm" color="#4ade80" weight="medium">{successMessage}</Text>
            </View>
          )}

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
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    // @ts-ignore
                    autoComplete="password"
                    // @ts-ignore
                    importantForAutofill="yes"
                  />
                  <Pressable onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeIcon}>
                    {showCurrent ? <EyeOff size={20} color="#86868b" /> : <Eye size={20} color="#86868b" />}
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
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    // @ts-ignore
                    autoComplete="new-password"
                    // @ts-ignore
                    importantForAutofill="yes"
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeIcon}>
                    {showNew ? <EyeOff size={20} color="#86868b" /> : <Eye size={20} color="#86868b" />}
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
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    // @ts-ignore
                    autoComplete="new-password"
                    // @ts-ignore
                    importantForAutofill="yes"
                  />
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                    {showConfirm ? <EyeOff size={20} color="#86868b" /> : <Eye size={20} color="#86868b" />}
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
            <View style={styles.validationRow}>
              <Text size="xs" color={newPassword.length > 0 && !isPasswordLongEnough ? "#f87171" : "#86868b"} style={styles.strengthHint}>
                {newPassword.length > 0 && !isPasswordLongEnough ? "• Password must be at least 8 characters" : "• 8+ characters"}
              </Text>
              <Text size="xs" color="#86868b" style={styles.strengthHint}>
              • Use a longer phrase for better security (e.g. 12–16+ characters)
              </Text>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text size="xs" color="#f87171" style={styles.strengthHint}>
                  • Passwords do not match
                </Text>
              )}
              {isSameAsCurrent && (
                <Text size="xs" color="#f87171" style={styles.strengthHint}>
                  • New password must be different from current password
                </Text>
              )}
            </View>
            
          </View>

          <View style={{ flex: 1 }} />

          {/* Submit Area */}
          <View style={styles.submitArea}>
            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleUpdatePassword}
              disabled={!canSubmit}
            >
              {isSubmitting && !successMessage ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text weight="semiBold" size="md" color="#FFF">
                  {successMessage ? 'Updated!' : 'Update password'}
                </Text>
              )}
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
  errorContainer: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  successContainer: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
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
  validationRow: {
    marginTop: 8,
    gap: 4,
  },
  strengthHint: {
    marginTop: 4,
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
});
