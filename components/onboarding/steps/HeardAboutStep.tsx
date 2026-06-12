/**
 * HeardAboutStep
 *
 * PURPOSE: Ask how the user heard about Otopair.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <HeardAboutStep
 *     onNext={handleNext}
 *     onBack={handleBack}
 *     progress={{ total: 8, filled: 0 }}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useEffect } from 'react';
import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
  BorderRadius,
  ProgressBar,
  FooterButton,
  BackButton,
  FadeFooterContainer,
  FinishLater,
} from '@/components/shared-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// MVP-DISABLED: loyalty/rewards — re-enable post-launch (drop TextInput)
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingQuestion } from '@/hooks/useOnboardingQuestion';
// MVP-DISABLED: loyalty/rewards — re-enable post-launch
// import { useMutation } from 'convex/react';
// import { api } from '@/convex/_generated/api';
// import { useUserFromConvex } from '@/hooks/useUserFromConvex';
import {
  Users,
  Share2,
  Megaphone,
  Search,
  Wrench,
  Newspaper,
  MoreHorizontal,
} from 'lucide-react-native';

interface HeardAboutStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

const FALLBACK_OPTIONS = [
  { id: 'referral', label: 'Friend or family recommended it', icon: Users },
  { id: 'social', label: 'Social media (TikTok, Instagram)', icon: Share2 },
  { id: 'ad', label: 'Saw an ad', icon: Megaphone },
  { id: 'search', label: 'Search (Google, App Store)', icon: Search },
  { id: 'mechanic', label: 'My mechanic told me about it', icon: Wrench },
  { id: 'news', label: 'News or article', icon: Newspaper },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export function HeardAboutStep({ onNext, onBack, progress }: HeardAboutStepProps) {
  const insets = useSafeAreaInsets();
  const { updateData, data } = useOnboardingStore();
  const { saveQuestionAnswer } = useOnboardingQuestion('heardAboutOtopair');

  const [selected, setSelected] = useState<string | null>(data.heardAboutOtopair ?? null);
  // MVP-DISABLED: loyalty/rewards — re-enable post-launch
  // const [referralCode, setReferralCode] = useState<string>('');
  // const submitReferralCode = useMutation(api.referrals.submitCode);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);
  // MVP-DISABLED: loyalty/rewards — re-enable post-launch
  // const { userId } = useUserFromConvex();

  const handleContinue = async () => {
    if (!selected) return;
    updateData({ heardAboutOtopair: selected });

    const option = FALLBACK_OPTIONS.find((item) => item.id === selected);
    await saveQuestionAnswer(
      'How did you hear about Otopair?',
      option?.label ?? selected
    );

    // MVP-DISABLED: loyalty/rewards — re-enable post-launch
    // Optional: redeem a referral code if user pasted one. Non-blocking
    // — failures (already submitted, code not found) just continue
    // onboarding silently.
    // const trimmedCode = referralCode.trim();
    // if (trimmedCode && userId) {
    //   try {
    //     await submitReferralCode({ refereeUserId: userId, code: trimmedCode });
    //   } catch {
    //     // swallow; never block onboarding on referral failure
    //   }
    // }

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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>How did you hear about Otopair?</Text>
            <Text style={styles.subtitle}>This helps us understand which channels are working best.</Text>
          </View>

          <View style={styles.optionsContainer}>
            {FALLBACK_OPTIONS.map((option) => {
              const isSelected = selected === option.id;
              const Icon = option.icon;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelected(option.id)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                    pressed && styles.optionButtonPressed,
                  ]}
                >
                  <Icon
                    size={24}
                    color={isSelected ? BrandColors.secondary : BrandColors.white}
                  />
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* MVP-DISABLED: loyalty/rewards — re-enable post-launch */}
          {/*
          {selected === 'referral' && (
            <View style={styles.referralContainer}>
              <Text style={styles.referralLabel}>Have a referral code? (optional)</Text>
              <TextInput
                value={referralCode}
                onChangeText={setReferralCode}
                placeholder="otopair-…"
                placeholderTextColor="#829BAD"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.referralInput}
              />
            </View>
          )}
          */}
        </ScrollView>

        <FadeFooterContainer paddingBottom={insets.bottom + Spacing.lg}>
          <FooterButton label="Continue" onPress={handleContinue} disabled={!selected} />
        </FadeFooterContainer>
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
    paddingBottom: Spacing.xl,
  },
  headerContent: {
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    marginBottom: Spacing.md,
    lineHeight: Spacing['5xl'],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.9,
    lineHeight: Spacing['2xl'],
  },
  optionsContainer: {
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionButtonSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#5299FE',
  },
  optionButtonPressed: {
    opacity: 0.7,
  },
  optionText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    flex: 1,
  },
  optionTextSelected: {
    color: BrandColors.secondary,
    fontFamily: FontFamily.semiBold,
  },
  referralContainer: {
    paddingHorizontal: Spacing['2xl'],
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  referralLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: '#0F172A',
    opacity: 0.9,
  },
  referralInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: '#0F172A',
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
  },
});
