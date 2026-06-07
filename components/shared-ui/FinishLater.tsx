import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Text } from './Text';
import { api } from '@/convex/_generated/api';
import { BrandColors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import {
  clearOnboardingCurrentStepState,
  getOnboardingFinishedLaterKey,
} from '@/lib/onboarding-resume';

/**
 * FinishLater
 *
 * PURPOSE: A simple text button that allows users to skip the remaining onboarding
 * steps and go straight to the home screen.
 *
 * USED IN: Onboarding steps (ProfilePhotoStep, UserIntentStep, etc.)
 */
export function FinishLater() {
  const router = useRouter();
  const { userId: clerkUserId } = useAuth();
  const completeEssentialOnboarding = useMutation(api.users.completeEssentialOnboarding);

  const handlePress = async () => {
    await Promise.all([
      completeEssentialOnboarding().catch((error) => {
        console.error('Failed to mark essential onboarding complete:', error);
      }),
      SecureStore.setItemAsync(getOnboardingFinishedLaterKey(clerkUserId), 'true').catch(() => {
        // Do not block navigation on local storage failure.
      }),
      clearOnboardingCurrentStepState(clerkUserId).catch(() => {
        // Do not block navigation on local storage failure.
      }),
    ]);

    router.replace('/(main-tabs)/home');
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
    >
      <Text style={styles.text}>Finish later</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing['2xl'],
    marginTop: -Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    color: BrandColors.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    opacity: 0.8,
  },
});
