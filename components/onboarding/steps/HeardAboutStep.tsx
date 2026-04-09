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

import React, { useMemo, useState } from 'react';
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
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingQuestion } from '@/hooks/useOnboardingQuestion';
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
  const { answers, saveAnswer } = useOnboardingQuestion('heardAboutOtopair');

  const options = useMemo(
    () =>
      answers.length > 0
        ? answers.map((a) => {
            const fallback = FALLBACK_OPTIONS.find((f) => f.id === a.answer_value);
            return {
              id: a.answer_value,
              label: a.answer_text,
              icon: fallback?.icon || MoreHorizontal,
            };
          })
        : FALLBACK_OPTIONS,
    [answers],
  );

  const [selected, setSelected] = useState<string | null>(data.heardAboutOtopair ?? null);

  const handleContinue = async () => {
    if (!selected) return;
    updateData({ heardAboutOtopair: selected });

    const answer = answers.find((a) => a.answer_value === selected);
    if (answer) {
      await saveAnswer({ answerId: answer._id });
    }

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
            {options.map((option) => {
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
    color: BrandColors.white,
    marginBottom: Spacing.md,
    lineHeight: Spacing['5xl'],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionButtonSelected: {
    backgroundColor: BrandColors.white,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  optionButtonPressed: {
    opacity: 0.7,
  },
  optionText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    flex: 1,
  },
  optionTextSelected: {
    color: BrandColors.secondary,
    fontFamily: FontFamily.semiBold,
  },
});
