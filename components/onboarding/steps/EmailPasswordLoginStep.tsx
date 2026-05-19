/**
 * EmailPasswordLoginStep
 *
 * PURPOSE: Collects user's email and password and signs in with Clerk (the account they enter).
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandColors, Spacing, Text, FontSize, FontFamily } from "@/components/shared-ui";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import { BackButton } from "@/components/shared-ui/BackButton";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { Eye, EyeOff } from "lucide-react-native";
import { router } from "expo-router";
import { useAuth, useSignIn } from "@clerk/clerk-expo";
import { useAuthStore } from "@/stores/useAuthStore";

interface EmailPasswordLoginStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function EmailPasswordLoginStep({ onNext, onBack }: EmailPasswordLoginStepProps) {
  const insets = useSafeAreaInsets();
  const { updateData, data } = useOnboardingStore();
  const { setIsNewUser, setIsAuthenticated } = useAuthStore();
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState(data.email || "");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Already signed in → go straight to home
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setIsNewUser(false);
      setIsAuthenticated(true);
      router.replace("/(main-tabs)/home");
    }
  }, [isLoaded, isSignedIn, setIsAuthenticated, setIsNewUser]);

  const handleLogIn = async () => {
    if (loginLoading) return;
    setLoginError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLoginError("Please enter both email and password.");
      return;
    }

    if (!isLoaded || !signIn) {
      setLoginError("Sign in is not ready. Please try again.");
      return;
    }

    setLoginLoading(true);
    try {
      await signIn.create({
        identifier: trimmedEmail,
      });

      const attempt = await signIn.attemptFirstFactor({
        strategy: "password",
        password,
      });

      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        console.log("Login response", JSON.stringify(attempt, null, 2));
        throw new Error("Unable to create a session.");
      }

      await setActive?.({ session: attempt.createdSessionId });
      updateData({ email: trimmedEmail });
      setIsNewUser(false);
      setIsAuthenticated(true);
      router.replace("/(main-tabs)/home");
      onNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      if (message.toLowerCase().includes("already signed in")) {
        setIsNewUser(false);
        setIsAuthenticated(true);
        router.replace("/(main-tabs)/home");
        onNext();
        return;
      }
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePasswordlessLogIn = () => {
    // Placeholder for future screen
    console.log("Passwordless login selected");
  };

  const isEmailValid = (emailStr: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const canContinue = email.trim().length > 0 && isEmailValid(email.trim()) && password.length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.backButtonContainer}>
          <BackButton onBack={onBack} alwaysShow />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>Log in to Otopair</Text>
            <Text style={styles.subtitle}>Enter your credentials to continue your journey.</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor="#829BAD"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#829BAD"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={styles.eyeIcon}
                  hitSlop={10}
                >
                  {isPasswordVisible ? (
                    <EyeOff size={20} color="#374151" />
                  ) : (
                    <Eye size={20} color="#374151" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {loginError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{loginError}</Text>
              </View>
            )}

            <TouchableOpacity onPress={handlePasswordlessLogIn} style={styles.passwordlessLink}>
              <Text style={styles.passwordlessText}>Passwordless log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <FooterButton
            label={loginLoading ? "Logging in..." : "Log in"}
            onPress={handleLogIn}
            disabled={!canContinue || loginLoading}
          />
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
  backButtonContainer: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
    alignItems: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
  },
  headerContent: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    marginBottom: Spacing.md,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.9,
    lineHeight: 28,
  },
  formContainer: {
    gap: Spacing.xl,
  },
  inputWrapper: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semiBold,
    color: '#0F172A',
    opacity: 0.8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === "ios" ? Spacing.lg : Spacing.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: '#0F172A',
  },
  eyeIcon: {
    marginLeft: Spacing.sm,
  },
  passwordlessLink: {
    alignSelf: "center",
    marginTop: Spacing.sm,
  },
  passwordlessText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: '#0F172A',
    textDecorationLine: "underline",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: "#DC2626",
    textAlign: "center",
  },
  bottomContainer: {
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.md,
  },
});
