/**
 * LoginMethodsStep
 *
 * PURPOSE: Provides various login options (Email, Google, Apple) following the initial welcome.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useEffect } from "react";
import { StyleSheet, View, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandColors, Spacing, Text, FontSize, FontFamily } from "@/components/shared-ui";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import { BackButton } from "@/components/shared-ui/BackButton";
import { FontAwesome } from "@expo/vector-icons";
import { Mail } from "lucide-react-native";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { router } from "expo-router";
import { useAuth, useSignIn } from "@clerk/clerk-expo";
import { useAuthStore } from "@/stores/useAuthStore";

interface LoginMethodsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function LoginMethodsStep({ onNext, onBack }: LoginMethodsStepProps) {
  const insets = useSafeAreaInsets();
  const { updateData } = useOnboardingStore();
  const { setIsNewUser, setIsAuthenticated } = useAuthStore();
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const guestEmail = process.env.EXPO_PUBLIC_GUEST_EMAIL;
  const guestPassword = process.env.EXPO_PUBLIC_GUEST_PASSWORD;

  const handleSuccessfulLogin = () => {
    setIsNewUser(false);
    setIsAuthenticated(true);
    router.replace("/(main-tabs)/home");
    onBack();
  };

  // Already signed in → go to index so it can gate on Convex user
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setIsNewUser(false);
      setIsAuthenticated(true);
      router.replace("/(main-tabs)/home");
    }
  }, [isLoaded, isSignedIn, setIsAuthenticated, setIsNewUser]);

  const handleEmailLogin = () => {
    updateData({ signUpMethod: "email" }); // Re-using this to track choice
    onNext();
  };

  const handleGoogleLogin = () => {
    console.log("Google Log In");
    handleLogIn();
  };

  const handleAppleLogin = () => {
    console.log("Apple Log In");
    handleLogIn();
  };

  const handleLogIn = async () => {
    if (loginLoading) return;

    if (isSignedIn) {
      console.log("Guest already signed in, routing to home");
      handleSuccessfulLogin();
      return;
    }

    if (!isLoaded || !signIn) {
      setLoginError("Sign in is not ready. Please try again.");
      return;
    }

    if (!guestEmail || !guestPassword) {
      setLoginError("Guest credentials are not configured.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      await signIn.create({
        identifier: guestEmail,
      });

      const attempt = await signIn.attemptFirstFactor({
        strategy: "password",
        password: guestPassword,
      });

      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        console.log("Guest login response", JSON.stringify(attempt, null, 2));
        throw new Error("Unable to create a session.");
      }

      await setActive?.({ session: attempt.createdSessionId });
      console.log("Guest login successful for", guestEmail);
      handleSuccessfulLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      // Clerk can throw "already signed in" when user is authenticated; treat as success and go home
      if (message.toLowerCase().includes("already signed in")) {
        handleSuccessfulLogin();
        return;
      }
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.backButtonContainer}>
        <BackButton onBack={onBack} alwaysShow />
      </View>

      <View style={styles.content}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Log in to continue your journey</Text>
        </View>

        <View style={styles.buttonContainer}>
          <FooterButton
            label="Continue with email"
            onPress={handleEmailLogin}
            variant="primary"
            leftIcon={<Mail size={20} color={BrandColors.white} />}
            disabled={loginLoading}
          />

          <FooterButton
            label={loginLoading ? "Logging In..." : "Continue with Google"}
            onPress={handleGoogleLogin}
            disabled={loginLoading}
            variant="secondary"
            backgroundColor="rgba(255, 255, 255, 0.1)"
            textColor={BrandColors.white}
            leftIcon={<FontAwesome name="google" size={20} color={BrandColors.white} />}
            style={styles.socialButton}
          />

          {Platform.OS === "ios" && (
            <FooterButton
              label={loginLoading ? "Logging In..." : "Continue with Apple"}
              onPress={handleAppleLogin}
              disabled={loginLoading}
              variant="secondary"
              backgroundColor="rgba(255, 255, 255, 0.1)"
              textColor={BrandColors.white}
              leftIcon={<FontAwesome name="apple" size={22} color={BrandColors.white} style={{ marginBottom: 2 }} />}
              style={styles.socialButton}
            />
          )}
        </View>

        {loginError && (
          <Text style={styles.loginErrorText} accessibilityRole="alert">
            {loginError}
          </Text>
        )}

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account?</Text>
          <Pressable onPress={onBack}>
            <Text weight="bold" style={styles.signUpLink}>
              Sign up
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButtonContainer: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "center",
    paddingBottom: 60,
  },
  headerContent: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    textAlign: "center",
    lineHeight: 44,
  },
  buttonContainer: {
    gap: Spacing.md,
    width: "100%",
  },
  socialButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing["3xl"],
    gap: 8,
  },
  signUpText: {
    color: BrandColors.white,
    opacity: 0.8,
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
  },
  signUpLink: {
    color: BrandColors.white,
    fontSize: FontSize.md,
    fontFamily: FontFamily.bold,
    textDecorationLine: "underline",
  },
  loginErrorText: {
    textAlign: "center",
    color: "#FCA5A5",
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.md,
  },
});
