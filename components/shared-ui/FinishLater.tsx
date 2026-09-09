import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
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

interface FinishLaterProps {
  /** Onboarding step the user is currently on. Persisted to Convex
   *  so the home-page "Finish setup" card can resume from the exact
   *  spot, even across sign-outs. */
  currentStep?: string;
}

/**
 * FinishLater
 *
 * PURPOSE: A simple text button that allows users to skip the remaining onboarding
 * steps and go straight to the home screen.
 *
 * USED IN: Onboarding steps (ProfilePhotoStep, UserIntentStep, etc.)
 */
export function FinishLater({ currentStep }: FinishLaterProps = {}) {
  const router = useRouter();
  const { userId: clerkUserId } = useAuth();
  // Best-effort: mark essential onboarding complete if all six fields
  // are filled (email/emailConfirmed/phone/phoneVerified/name). For
  // most OAuth users mid-flow this throws — that's fine, the
  // unconditional `deferOnboarding` below is the real re-login gate.
  const completeEssentialOnboarding = useMutation(api.users.completeEssentialOnboarding);
  // Always succeeds — flips `users.onboardingDeferred = true` so the
  // startup redirect at `app/index.tsx` sends the user home instead
  // of restarting onboarding at the phone step.
  const deferOnboarding = useMutation(api.users.deferOnboarding);

  const handlePress = async () => {
    await Promise.all([
      deferOnboarding(currentStep ? { step: currentStep } : {}).catch((error) => {
        console.error('Failed to defer onboarding:', error);
      }),
      completeEssentialOnboarding().catch(() => {
        // Expected to fail for users whose email/name isn't fully in
        // Convex yet — `deferOnboarding` above is the source of truth
        // for re-login routing, so this is best-effort only.
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
