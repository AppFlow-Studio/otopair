/**
 * EmailSignupStep
 *
 * PURPOSE: Email + Password signup form using Clerk.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 */

import { useState, useEffect } from "react";
import { useSignUp } from "@clerk/clerk-expo";
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
import {
  BackHandler,
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

interface EmailSignupStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

export function EmailSignupStep({
  onNext,
  onBack,
  progress,
}: EmailSignupStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { updateData } = useOnboardingStore();
  const { signUp, isLoaded } = useSignUp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const canContinue = email.trim().length > 0 && password.length >= 8;

  const handleSignup = async () => {
    if (!isLoaded || !signUp || loading) return;
    setLoading(true);
    setError(null);

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      updateData({
        email: email.trim(),
        authProvider: "email",
      });

      onNext();
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        "Failed to create account";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Enter your email and create a password
            </Text>
          </View>

          <View style={styles.inputsContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                autoFocus
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Text style={styles.helperText}>At least 8 characters</Text>
            </View>

            <View style={styles.continueButtonContainer}>
              <FooterButton
                label={loading ? "Creating Account..." : "Continue"}
                onPress={handleSignup}
                disabled={!canContinue || loading}
                size={buttonSize}
                paddingVertical={buttonPaddingVertical}
                variant={canContinue ? "primary" : undefined}
                backgroundColor={canContinue ? undefined : "#6B7280"}
                textColor={canContinue ? undefined : BrandColors.white}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  container: { flex: 1 },
  scrollView: { flex: 1 },
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
    lineHeight: Spacing["5xl"],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.9,
    lineHeight: Spacing["2xl"],
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
  errorText: {
    textAlign: "center",
    color: "#DC2626",
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
  },
});
