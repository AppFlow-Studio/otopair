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

import { useState, useEffect, useCallback } from "react";
import { useAuth, useSSO } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { useConvex } from "convex/react";
import { BrandColors, FontFamily, FontSize, Spacing, Text } from "@/components/shared-ui";
import { Image } from "expo-image";
import Animated, {
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
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
import { FontAwesome } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";

// OAuth users skip the email steps entirely — pass this into the
// onboarding route params so the filtered flow drops them straight
// on `phone`. Kept in sync with `app/oauth-callback.tsx`.
const OAUTH_SIGNUP_STEPS = [
  "phone",
  "confirm",
  "name",
  "profilePhoto",
  "userIntent",
  "heardAbout",
  "visitReason",
  "zipCode",
  "pushNotifications",
  "locationServices",
] as const;

/** Official Google G — 4-color mark from Google's brand guidelines.
 *  Kept inline (only consumer) so we don't add another asset file. */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <Path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <Path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <Path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </Svg>
  );
}
import { useAuthStore } from "@/stores/useAuthStore";
import { guardedRouter as router } from "@/lib/navigationLock";
import { api } from "@/convex/_generated/api";
import { getAndroidSmsRetrieverHash } from "@/lib/android-app-signature";

WebBrowser.maybeCompleteAuthSession();

interface SignupStepProps {
  onNext: () => void;
  onBack: () => void;
  onEmailSignup: () => void;
  onLogin: () => void;
}

export function SignupStep({ onBack, onEmailSignup, onLogin }: SignupStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { isSignedIn, isLoaded } = useAuth();
  const { updateData } = useOnboardingStore();
  const ensureConvexUser = useEnsureConvexUser();
  const convex = useConvex();
  const { isNewUser, setIsNewUser, setIsAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smsHash, setSmsHash] = useState<string | null>(null);
  const [smsHashLoading, setSmsHashLoading] = useState(false);
  const [ssoNavigationPending, setSsoNavigationPending] = useState(false);

  // Floating "teardrop" bob for the pin logo — matches the map-pin
  // hover motion. `reverse: true` on withRepeat ping-pongs between
  // the two values with a matching curve at each end so the top of
  // the bob and the bottom both ease-out cleanly. No visual seam
  // between iterations (the seq-based version was giving a "jump
  // back to top" because it ended one cycle before starting the next).
  const logoBob = useSharedValue(0);
  useEffect(() => {
    logoBob.value = withRepeat(
      withTiming(-8, { duration: 1600, easing: REasing.inOut(REasing.sin) }),
      -1,
      true,
    );
  }, [logoBob]);
  const logoBobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoBob.value }],
  }));

  const { startSSOFlow: startGoogleSSO } = useSSO();
  const { startSSOFlow: startAppleSSO } = useSSO();
  const isCompact = height < 720;

  const navigateAfterExistingAccountAuth = useCallback(async () => {
    let me: {
      onboardingCompleted?: boolean;
      essentialOnboardingCompleted?: boolean;
    } | null = null;

    try {
      me = await convex.query(api.users.getMe, {});
    } catch (error) {
      console.error("Failed to load onboarding state after signup auth:", error);
    }

    if (me?.onboardingCompleted === true || me?.essentialOnboardingCompleted === true) {
      router.replace("/(main-tabs)/home");
      return;
    }

    router.replace({
      pathname: "/(onboarding)",
      params: { isResumeMode: "true" },
    });
  }, [convex]);

  // Already signed in: route by Convex onboarding state, not directly home.
  useEffect(() => {
    if (loading !== null || ssoNavigationPending || isNewUser) {
      return;
    }

    if (isLoaded && isSignedIn) {
      setIsNewUser(false);
      setIsAuthenticated(true);
      navigateAfterExistingAccountAuth().catch((error) => {
        console.error("Failed to navigate existing signed-in user:", error);
      });
    }
  }, [
    isLoaded,
    isNewUser,
    isSignedIn,
    loading,
    navigateAfterExistingAccountAuth,
    setIsAuthenticated,
    setIsNewUser,
    ssoNavigationPending,
  ]);

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
  };

  const handleOAuthSignup = async (strategy: "google" | "apple") => {
    if (loading) return;
    setLoading(strategy);
    setError(null);
    setIsNewUser(true);
    setSsoNavigationPending(true);

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
        setSsoNavigationPending(false);
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
        // Release the useEffect navigation gate + navigate inline.
        // The `otopair://oauth-callback` deep link route may or may
        // not fire depending on the SSO strategy — inline nav here
        // guarantees the user leaves the signup screen either way.
        // (If the callback route also fires, it router.replaces to
        // the same destination — a benign remount, not a loop.)
        setSsoNavigationPending(false);
        if (signIn) {
          setIsNewUser(false);
          await navigateAfterExistingAccountAuth();
        } else {
          // New OAuth user: skip email steps, drop them onto phone
          // step (mirrors oauth-callback route's new-user branch).
          router.replace({
            pathname: "/(onboarding)",
            params: {
              initialStep: "phone",
              filteredSteps: JSON.stringify(OAUTH_SIGNUP_STEPS),
            },
          });
        }
      } else if (signUp && signUp.status === "missing_requirements") {
        // OAuth succeeded but Clerk requires phone before completing sign-up (e.g. instance config)
        // signUp is in memory; PhoneNumberStep will use signUp.update + preparePhoneNumberVerification
        // ConfirmPhoneNumberStep will complete verification and set session - no re-auth needed
        // The oauth-callback route owns post-SSO navigation to avoid duplicate onboarding remounts.
      }
    } catch (err) {
      setSsoNavigationPending(false);
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

  const handleGetAndroidSmsHash = async () => {
    if (smsHashLoading) return;

    setSmsHashLoading(true);
    setError(null);

    try {
      const hash = await getAndroidSmsRetrieverHash();
      if (!hash) {
        setError("Android SMS hash is only available on Android.");
        return;
      }

      setSmsHash(hash);
      await Clipboard.setStringAsync(hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get Android SMS hash.";
      setError(message);
    } finally {
      setSmsHashLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
      <View style={[styles.container, dynamicStyles.container]}>
        {/* Brand — pin logo bobs like a teardrop hovering over the
            surface. Same asset as map pins / search screen. */}
        <View style={[styles.content, isCompact && styles.contentCompact]}>
          <Animated.View style={logoBobStyle}>
            <Image
              source={require("@/assets/images/pin-logo-3d.png")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="Otopair"
            />
          </Animated.View>
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
                <GoogleG size={20} />
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
              <>
                <FontAwesome name="apple" size={22} color={BrandColors.white} style={{ marginBottom: 2 }} />
                <Text style={styles.appleText}>Continue with Apple</Text>
              </>
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

          {__DEV__ && Platform.OS === "android" ? (
            <View style={styles.smsHashPanel}>
              <Pressable
                accessibilityRole="button"
                style={styles.smsHashButton}
                onPress={handleGetAndroidSmsHash}
                disabled={smsHashLoading}
              >
                {smsHashLoading ? (
                  <ActivityIndicator size="small" color={BrandColors.secondary} />
                ) : (
                  <Text style={styles.smsHashButtonText}>Get Android SMS hash</Text>
                )}
              </Pressable>
              {smsHash ? (
                <Text selectable style={styles.smsHashText}>
                  {smsHash} copied
                </Text>
              ) : null}
            </View>
          ) : null}

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
  logo: {
    width: 220,
    height: 220,
    alignSelf: "center",
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
  googleText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: "#000000",
  },
  appleButton: {
    backgroundColor: "#000000",
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
  smsHashPanel: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  smsHashButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  smsHashButtonText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.secondary,
  },
  smsHashText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: "#0F172A",
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
