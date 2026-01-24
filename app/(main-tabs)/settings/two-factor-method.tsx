/**
 * TwoFactorMethodScreen
 *
 * PURPOSE: Allows users to choose and manage their two-factor authentication method (SMS or Email).
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <TwoFactorMethodScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, X, Mail, MessageSquareText } from 'lucide-react-native';

import { BrandColors, Button, FontFamily, FontSize, Shadows, Spacing, Text } from '@/components/shared-ui';
import { Layout } from '@/constants/theme';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

type VerificationMethod = 'sms' | 'email';

export default function TwoFactorMethodScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { data, updateData } = useOnboardingStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeMethod, setRemoveMethod] = useState<VerificationMethod | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;

  const handleSelectMethod = (method: VerificationMethod) => {
    setErrorMessage(null);

    const isEnabled =
      method === 'email' ? data.twoFactorEmailEnabled : data.twoFactorSmsEnabled;
    if (isEnabled) {
      setRemoveMethod(method);
      setShowRemoveModal(true);
      return;
    }

    if (method === 'email' && !data.email) {
      setErrorMessage('No email added yet. Please add an email to your profile first.');
      return;
    }
    if (method === 'sms' && !data.phoneNumber) {
      setErrorMessage('No phone number added yet. Please add a phone number to your profile first.');
      return;
    }

    router.push({ pathname: '/settings/two-factor-verify', params: { method } });
  };

  useEffect(() => {
    if (showRemoveModal) {
      slideAnim.setValue(height);
      requestAnimationFrame(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [height, showRemoveModal, slideAnim]);

  const handleCloseRemoveModal = () => {
    setShowRemoveModal(false);
    setRemoveMethod(null);
  };

  const handleRemoveMethod = () => {
    if (removeMethod === 'email') {
      updateData({ twoFactorEmailEnabled: false });
    } else if (removeMethod === 'sms') {
      updateData({ twoFactorSmsEnabled: false });
    }
    handleCloseRemoveModal();
  };

  const optionData = useMemo(
    () => [
      { id: 'sms' as const, label: 'Text message', icon: MessageSquareText },
      { id: 'email' as const, label: 'Email', icon: Mail },
    ],
    []
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <X size={18} color="#111827" />
        </Pressable>
        <Text weight="semiBold" size="lg" color="#111827" style={styles.headerTitle}>
          Two-Factor Authentication
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text weight="bold" size="3xl" color="#111827" style={styles.title}>
          Add an extra layer of security to your account
        </Text>
        <Text size="md" color="#6B7280" style={styles.subtitle}>
          This helps keep things secure by verifying that it's really you.
        </Text>

        <View style={styles.optionsList}>
          {optionData.map((option) => {
            const isEnabled =
              option.id === 'email' ? data.twoFactorEmailEnabled : data.twoFactorSmsEnabled;
            const Icon = option.icon;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleSelectMethod(option.id)}
                style={[
                  styles.optionItem,
                  isEnabled && styles.optionItemSelected,
                ]}
              >
                <View style={[styles.optionIconBox, isEnabled && styles.optionIconBoxSelected]}>
                  <Icon size={20} color={isEnabled ? BrandColors.secondary : '#111827'} />
                </View>
                <Text weight="semiBold" size="md" color="#111827" style={styles.optionLabel}>
                  {option.label}
                </Text>
                {isEnabled ? <Check size={18} color={BrandColors.secondary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text size="sm" color="#EF4444" style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        )}
      </View>

      <Modal
        visible={showRemoveModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseRemoveModal}
      >
        <Pressable style={styles.removeModalBackdrop} onPress={handleCloseRemoveModal}>
          <Animated.View
            style={[
              styles.removeModal,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.removeModalHandle} />
            <Text weight="bold" size="2xl" color="#111827" style={styles.removeTitle}>
              Remove verification method?
            </Text>
            <Text size="md" color="#6B7280" style={styles.removeMessage}>
              This will disable {removeMethod === 'email' ? 'email' : 'text message'} verification for your account.
            </Text>
            <View style={styles.removeActions}>
              <Button
                variant="ghost"
                fullWidth
                style={styles.removeButtonNo}
                onPress={handleCloseRemoveModal}
              >
                No
              </Button>
              <Button
                variant="primary"
                fullWidth
                style={[styles.removeButtonYes, { backgroundColor: '#EF4444' }]}
                onPress={handleRemoveMethod}
              >
                Yes
              </Button>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    paddingHorizontal: Spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingTop: Spacing['2xl'],
  },
  title: {
    lineHeight: 38,
    marginBottom: Spacing.md,
  },
  subtitle: {
    lineHeight: 22,
    marginBottom: Spacing['3xl'],
  },
  optionsList: {
    gap: Spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  optionItemSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: '#F5F8FF',
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  optionIconBoxSelected: {
    backgroundColor: '#E0ECFF',
  },
  optionLabel: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  errorText: {
    textAlign: 'center',
  },
  removeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  removeModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    padding: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    width: '95%',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  removeModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  removeTitle: {
    fontSize: FontSize['2xl'],
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  removeMessage: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    lineHeight: 22,
  },
  removeActions: {
    width: '100%',
    gap: Spacing.md,
  },
  removeButtonNo: {
    borderRadius: 12,
  },
  removeButtonYes: {
    borderRadius: 12,
  },
});
