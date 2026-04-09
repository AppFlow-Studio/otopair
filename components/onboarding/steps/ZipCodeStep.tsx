/**
 * ZipCodeStep
 *
 * PURPOSE: Collects the user's zip code during onboarding.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <ZipCodeStep
 *     onNext={handleNext}
 *     onBack={handleBack}
 *     progress={{ total: 8, filled: 0 }}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useMemo, useState } from 'react';
import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
  ProgressBar,
  FooterButton,
  BackButton,
  FinishLater,
} from '@/components/shared-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingQuestion } from '@/hooks/useOnboardingQuestion';

interface ZipCodeStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

export function ZipCodeStep({ onNext, onBack, progress }: ZipCodeStepProps) {
  const insets = useSafeAreaInsets();
  const { updateData, data } = useOnboardingStore();
  const { saveAnswer } = useOnboardingQuestion('zipCode');

  const [zipCode, setZipCode] = useState(data.zipCode ?? '');

  const sanitizedZip = useMemo(() => zipCode.trim(), [zipCode]);
  const isValidZip = useMemo(() => /^\d{5}(-\d{4})?$/.test(sanitizedZip), [sanitizedZip]);

  const handleContinue = async () => {
    if (!isValidZip) return;
    updateData({ zipCode: sanitizedZip });
    await saveAnswer({ freeTextAnswer: sanitizedZip });
    onNext();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <ProgressBar
          total={progress.total}
          filled={progress.filled}
          leftElement={<BackButton onBack={onBack} alwaysShow />}
        />
        <FinishLater />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContent}>
            <Text style={styles.title}>What&apos;s your zip code?</Text>
            <Text style={styles.subtitle}>
              We use this to confirm service availability and tailor nearby recommendations.
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Zip code"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="number-pad"
              autoFocus
              maxLength={10}
            />
          </View>
        </ScrollView>

        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <FooterButton label="Continue" onPress={handleContinue} disabled={!isValidZip} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing['2xl'],
  },
  headerContent: {
    marginBottom: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    marginBottom: Spacing.md,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.9,
    lineHeight: 28,
  },
  inputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  input: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: BrandColors.white,
  },
  bottomContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
  },
});
