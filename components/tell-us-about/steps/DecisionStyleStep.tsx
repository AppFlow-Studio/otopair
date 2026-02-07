/**
 * DecisionStyleStep
 *
 * PURPOSE: Allows users to specify how they usually seek car advice and make decisions.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * OWNER: Daniel Chelala
 */

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
} from "@/components/shared-ui";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingStore } from "@/stores/useOnboardingStore";

interface DecisionStyleStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

const STYLE_OPTIONS = [
  { emoji: "🔍", label: "Research online first" },
  { emoji: "👨‍🔧", label: "Ask someone who knows cars" },
  { emoji: "🗣️", label: "Just want someone to tell me what to do" },
  { emoji: "🏢", label: "Go to the dealer/shop and trust them" },
] as const;

export function DecisionStyleStep({
  onNext,
  onBack,
  progress,
}: DecisionStyleStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { updateData, data } = useOnboardingStore();

  const [selectedOption, setSelectedOption] = useState<string | null>(
    data.decisionMakingStyle ?? null,
  );

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const handleSelectOption = (option: (typeof STYLE_OPTIONS)[number]) => {
    const value = `${option.emoji} ${option.label}`;
    setSelectedOption(value);
    updateData({ decisionMakingStyle: value });
  };

  const handleContinue = () => {
    if (selectedOption) {
      onNext();
    }
  };

  const canContinue = selectedOption !== null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardView}
    >
      <View style={[styles.container, dynamicStyles.container]}>
        <ProgressBar
          total={progress.total}
          filled={progress.filled}
          leftElement={<BackButton onBack={onBack} alwaysShow />}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>
              When you need car advice, what do you usually do?
            </Text>
            <Text style={styles.subtitle}>
              Select the option that best describes you
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {STYLE_OPTIONS.map((option) => {
              const value = `${option.emoji} ${option.label}`;
              const isSelected = selectedOption === value;

              return (
                <Pressable
                  key={option.label}
                  onPress={() => handleSelectOption(option)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                    pressed && styles.optionButtonPressed,
                  ]}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <FadeFooterContainer paddingBottom={insets.bottom + Spacing.lg}>
          <FooterButton
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            size={buttonSize}
            paddingVertical={buttonPaddingVertical}
            variant={canContinue ? "primary" : undefined}
          />
        </FadeFooterContainer>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  headerContent: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    marginBottom: Spacing.md,
    lineHeight: Spacing["5xl"],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.9,
    lineHeight: Spacing["2xl"],
  },
  optionsContainer: {
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  optionButtonSelected: {
    backgroundColor: BrandColors.white,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  optionButtonPressed: { opacity: 0.7 },
  optionEmoji: { fontSize: FontSize["2xl"] },
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
