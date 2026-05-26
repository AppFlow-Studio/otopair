import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth, useSignUp, useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";

import { BrandColors } from "@/constants/theme";
import { Text } from "@/components/shared-ui";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { api } from "@/convex/_generated/api";

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

export default function OAuthCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signUp } = useSignUp();
  const isNewUser = useAuthStore((state) => state.isNewUser);
  const updateOnboardingData = useOnboardingStore((state) => state.updateData);
  const me = useQuery(api.users.getMe, isLoaded && isSignedIn ? undefined : "skip");

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !isNewUser && me === undefined) return;

    const draftEmail =
      signUp?.emailAddress ||
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;
    const draftFirstName = signUp?.firstName || user?.firstName || null;
    const draftLastName = signUp?.lastName || user?.lastName || null;

    if (draftEmail || draftFirstName || draftLastName) {
      updateOnboardingData({
        email: draftEmail,
        firstName: draftFirstName,
        lastName: draftLastName,
      });
    }

    const timeout = setTimeout(() => {
      if (isNewUser) {
        router.replace({
          pathname: "/(onboarding)",
          params: {
            initialStep: "phone",
            filteredSteps: JSON.stringify(OAUTH_SIGNUP_STEPS),
          },
        });
        return;
      }

      if (isSignedIn) {
        if (me?.onboardingCompleted === true || me?.essentialOnboardingCompleted === true) {
          router.replace("/(main-tabs)/home");
          return;
        }

        router.replace({
          pathname: "/(onboarding)",
          params: { isResumeMode: "true" },
        });
        return;
      }

      router.replace({
        pathname: "/(onboarding)",
        params: { initialStep: "login" },
      });
    }, 750);

    return () => clearTimeout(timeout);
  }, [isLoaded, isNewUser, isSignedIn, me, signUp, updateOnboardingData, user]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text style={styles.title}>Signing you in</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.primary,
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    borderRadius: 24,
    backgroundColor: BrandColors.white,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  title: {
    color: BrandColors.primary,
    fontSize: 20,
  },
});
