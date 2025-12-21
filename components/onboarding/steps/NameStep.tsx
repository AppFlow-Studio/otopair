/**
 * NameStep
 *
 * PURPOSE: Name entry step for OnboardingFlow.
 *
 * OWNER: Daniel Chelala
 */

import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
} from "@/components/shared-ui";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingProgress } from "../common/OnboardingProgress";
import { OnboardingFooterButton } from "../common/OnboardingFooterButton";
import { OnboardingBackButton } from "../common/OnboardingBackButton";
import { useOnboardingStore } from "@/stores/useOnboardingStore";

interface NameStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function NameStep({ onNext, onBack }: NameStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { updateData } = useOnboardingStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [alias, setAlias] = useState("");

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const handleContinue = () => {
    updateData({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      alias: alias.trim(),
    });

    console.log("Name saved:", { firstName, lastName, alias });
    onNext();
  };

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      style={styles.keyboardView}
    >
      <View style={[styles.container, dynamicStyles.container]}>
        <OnboardingProgress
          total={6}
          filled={2}
          leftElement={<OnboardingBackButton onBack={onBack} alwaysShow />}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>
              Let us know how to properly address you
            </Text>
          </View>

          <View style={styles.inputsContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#9CA3AF"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                autoFocus={true}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#9CA3AF"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Alias"
                placeholderTextColor="#9CA3AF"
                value={alias}
                onChangeText={setAlias}
                autoCapitalize="words"
              />
              <Text style={styles.helperText}>Optional</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
          <OnboardingFooterButton
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            size={buttonSize}
            paddingVertical={buttonPaddingVertical}
            variant={canContinue ? "primary" : undefined}
            backgroundColor={canContinue ? undefined : "#6B7280"}
            textColor={canContinue ? undefined : BrandColors.white}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  container: { flex: 1 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  headerContent: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
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
  inputsContainer: { paddingHorizontal: Spacing["2xl"], gap: Spacing.lg },
  inputWrapper: { marginBottom: Spacing.md },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  helperText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.7,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  bottomContainer: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    backgroundColor: 'transparent',
  },
});
