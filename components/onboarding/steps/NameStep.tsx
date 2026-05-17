/**
 * NameStep
 *
 * PURPOSE: Collects the user's first name and last name.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <NameStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 8, filled: 2 }} 
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
} from "@/components/shared-ui";
import { ProgressBar } from "@/components/shared-ui/ProgressBar";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import { BackButton } from "@/components/shared-ui/BackButton";
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
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";

interface NameStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

export function NameStep({ onNext, onBack, progress }: NameStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { data, updateData } = useOnboardingStore();
  const { persistProfileField } = useOnboardingPersistence();

  const [firstName, setFirstName] = useState(data.firstName || "");
  const [lastName, setLastName] = useState(data.lastName || "");

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const handleContinue = async () => {
    updateData({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    await persistProfileField({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      ...(data.authProvider && { auth_provider: data.authProvider }),
    });

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
        <ProgressBar
          total={progress.total}
          filled={progress.filled}
          leftElement={<BackButton onBack={onBack} alwaysShow />}
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

            <View style={styles.continueButtonContainer}>
              <FooterButton
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
        </ScrollView>
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
  inputsContainer: { paddingHorizontal: Spacing["2xl"], gap: Spacing.lg },
  inputWrapper: { marginBottom: 0 },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  helperText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.7,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  continueButtonContainer: { marginTop: 0 },
});
