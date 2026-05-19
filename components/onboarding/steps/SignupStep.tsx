/**
 * SignupStep
 *
 * PURPOSE: First screen in the onboarding process with Google, Apple, and Email signup options.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step (phone)
 *   - onBack (() => void): Callback to navigate back
 *   - onEmailSignup (() => void): Callback to navigate to email signup flow
 *   - onLogin (() => void): Callback to navigate to login screen
 */

import { useState, useEffect } from "react";
import { useAuth, useSSO } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { BrandColors, FontFamily, FontSize, Spacing, Text } from "@/components/shared-ui";
import { Image } from "expo-image";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useEnsureConvexUser } from "@/hooks/useEnsureConvexUser";
import { Mail } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

interface SignupStepProps {
  onNext: () => void;
  onBack: () => void;
  onEmailSignup: () => void;
  onLogin: () => void;
}

export function SignupStep({ onNext, onBack, onEmailSignup, onLogin }: SignupStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { isSignedIn, isLoaded } = useAuth();
  const { updateData } = useOnboardingStore();
  const ensureConvexUser = useEnsureConvexUser();
  const { isNewUser, setIsNewUser, setIsAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { startSSOFlow: startGoogleSSO } = useSSO();
  const { startSSOFlow: startAppleSSO } = useSSO();
  const isCompact = height < 720;

  // Already signed in → redirect to home (index may have sent here if me was loading)
  useEffect(() => {
    if (loading !== null || isNewUser) {
      return;
    }

    if (isLoaded && isSignedIn) {
      setIsNewUser(false);
      setIsAuthenticated(true);
      router.replace("/(main-tabs)/home");
    }
  }, [isLoaded, isNewUser, isSignedIn, loading, setIsAuthenticated, setIsNewUser]);

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
  };

  const handleOAuthSignup = async (strategy: "google" | "apple") => {
    if (loading) return;
    setLoading(strategy);
    setError(null);
    setIsNewUser(true);

    try {
      const startSSO = strategy === "google" ? startGoogleSSO : startAppleSSO;
      const ssoStrategy = strategy === "google" ? "oauth_google" : "oauth_apple";

      const { createdSessionId, setActive, signIn, signUp, authSessionResult } = await startSSO({
        strategy: ssoStrategy,
        redirectUrl: "otopair://oauth-callback",
      });

      // User cancelled OAuth (dismissed browser) - do not proceed
      const cancelled = authSessionResult && "type" in authSessionResult && authSessionResult.type !== "success";
      if (cancelled) {
        return;
      }

      // Prefill data from OAuth (signUp has user profile; signIn = existing user)
      const firstName = signUp?.firstName ?? undefined;
      const lastName = signUp?.lastName ?? undefined;
      const email = signUp?.emailAddress ?? undefined;
      updateData({
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        authProvider: strategy,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        setIsAuthenticated(true);
        try {
          await ensureConvexUser();
        } catch (e) {
          console.error("Failed to ensure Convex user", e);
        }
        // signIn = existing account (email matched); signUp = new account
        if (signIn) {
          setIsNewUser(false);
          router.replace("/(main-tabs)/home");
        } else {
          onNext();
        }
      } else if (signUp && signUp.status === "missing_requirements") {
        // OAuth succeeded but Clerk requires phone before completing sign-up (e.g. instance config)
        // signUp is in memory; PhoneNumberStep will use signUp.update + preparePhoneNumberVerification
        // ConfirmPhoneNumberStep will complete verification and set session - no re-auth needed
        // Do NOT use || !createdSessionId - that would incorrectly proceed when user cancels OAuth
        onNext();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      console.error(`${strategy} OAuth error:`, err);
    } finally {
      setLoading(null);
    }
  };

  const handleEmailSignupPress = () => {
    setIsNewUser(true);
    onEmailSignup();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
      <View style={[styles.container, dynamicStyles.container]}>
        {/* Header Content */}
        <View style={[styles.content, isCompact && styles.contentCompact]}>
          <View style={styles.logoFrame}>
            <Image
              source={require("@/assets/images/homelogo.png")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="Otopair"
            />
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.title}>Welcome to Otopair</Text>
            <Text style={styles.subtitle}>
              Your smart assistant for car health, repair tips, and maintenance reminders.
            </Text>
          </View>
        </View>

        {/* Auth Buttons */}
        <View style={[styles.buttonsContainer, dynamicStyles.bottomContainer]}>
          {/* Google */}
          <Pressable
            style={[styles.oauthButton, styles.googleButton]}
            onPress={() => handleOAuthSignup("google")}
            disabled={loading !== null}
          >
            {loading === "google" ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {/* Apple */}
          <Pressable
            style={[styles.oauthButton, styles.appleButton]}
            onPress={() => handleOAuthSignup("apple")}
            disabled={loading !== null}
          >
            {loading === "apple" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.appleText}>Continue with Apple</Text>
            )}
          </Pressable>

          {/* Email */}
          <Pressable
            style={[styles.oauthButton, styles.emailButton]}
            onPress={handleEmailSignupPress}
            disabled={loading !== null}
          >
            <Mail size={20} color={BrandColors.white} />
            <Text style={styles.emailText}>Continue with Email</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Login link */}
          <Pressable onPress={onLogin} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Log In</Text>
            </Text>
          </Pressable>
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
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing["2xl"],
  },
  contentCompact: {
    gap: Spacing.xl,
  },
  headerContent: {
    alignItems: "center",
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    marginBottom: Spacing.sm,
    lineHeight: Spacing["5xl"],
    textAlign: "center",
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.9,
    lineHeight: Spacing["2xl"],
    textAlign: "center",
    maxWidth: 320,
  },
  logoFrame: {
  width: 175,
  height: 175,
  alignSelf: "center",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 90,
  backgroundColor: "rgba(255, 255, 255, 0.72)",
  borderWidth: 1.5,
  borderColor: "rgba(255, 255, 255, 1)",
  shadowColor: "#1E40AF",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.10,
  shadowRadius: 20,
  elevation: 6,
},
  logo: {
    width: 226,
    height: 226,
    transform: [{ translateX: -11 }, { translateY: -14 }],
  },
  buttonsContainer: {
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.md,
  },
  oauthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: 16,
    gap: Spacing.sm,
    minHeight: 54,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.10)",
  },
  googleIcon: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.bold,
    color: "#4285F4",
  },
  googleText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: "#000000",
  },
  appleButton: {
    backgroundColor: "#000000",
  },
  appleIcon: {
    fontSize: FontSize.xl,
    color: BrandColors.white,
  },
  appleText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.white,
  },
  emailButton: {
    backgroundColor: "#5299FE",
    borderWidth: 1,
    borderColor: "#5299FE",
  },
  emailText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.white,
  },
  errorText: {
    textAlign: "center",
    color: "#DC2626",
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  loginLinkText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.8,
  },
  loginLinkBold: {
    fontFamily: FontFamily.semiBold,
    color: "#1E40AF",
    opacity: 1,
  },
});
