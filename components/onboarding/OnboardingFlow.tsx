/**
 * OnboardingFlow
 *
 * PURPOSE: Single container for onboarding flow with animated gradient transitions.
 *
 * USED IN: app/(onboarding)/index.tsx
 *
 * PROPS:
 *   - initialStep (OnboardingStep): The step to start the onboarding flow from [optional]
 *   - filteredSteps (OnboardingStep[]): Optional array of steps to show (for resuming incomplete setup)
 *   - isResumeMode (boolean): Whether this is a resume flow (affects completion behavior)
 *
 * EXAMPLE:
 *   <OnboardingFlow initialStep="signup" />
 *   <OnboardingFlow
 *     initialStep="profilePhoto"
 *     filteredSteps={['profilePhoto', 'userIntent']}
 *     isResumeMode={true}
 *   />
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Keyboard } from 'react-native';
import { router } from 'expo-router';
import Animated, {
    useSharedValue,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { AnimatedGradientBackground } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useAuth } from '@clerk/clerk-expo';
import { usePrefetchOnboardingQuestions } from '@/hooks/usePrefetchOnboardingQuestions';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SignupStep } from './steps/SignupStep';
import { EmailSignupStep } from './steps/EmailSignupStep';
import { EmailVerificationStep } from './steps/EmailVerificationStep';
import { LoginStep } from './steps/LoginStep';
import { PhoneNumberStep } from './steps/PhoneNumberStep';
import { ConfirmPhoneNumberStep } from './steps/ConfirmPhoneNumberStep';
import { NameStep } from './steps/NameStep';
import { EmailConfirmStep } from './steps/EmailConfirmStep';
import { ProfilePhotoStep } from './steps/ProfilePhotoStep';
import { UserIntentStep } from './steps/UserIntentStep';
import { PushNotificationsStep } from './steps/PushNotificationsStep';
import { LocationServicesStep } from './steps/LocationServicesStep';
import { WelcomeStep } from './steps/WelcomeStep';

// Define the steps in the flow
export type OnboardingStep =
    | 'welcome'
    | 'signup'
    | 'emailSignup'
    | 'emailVerify'
    | 'login'
    | 'phone'
    | 'confirm'
    | 'name'
    | 'emailConfirm'
    | 'profilePhoto'
    | 'userIntent'
    | 'pushNotifications'
    | 'locationServices'
    | 'complete';

// Step indices mapping to SHARED_GRADIENT_CONFIGS
const STEP_INDICES: Record<OnboardingStep, number> = {
    welcome: 0,
    signup: 0,
    emailSignup: 0,
    emailVerify: 0,
    login: 0,
    phone: 1,
    confirm: 2,
    name: 3,
    emailConfirm: 3,
    profilePhoto: 5,
    userIntent: 6,
    pushNotifications: 7,
    locationServices: 8,
    complete: 9,
};

interface OnboardingFlowProps {
    initialStep?: OnboardingStep;
    filteredSteps?: OnboardingStep[];
    isResumeMode?: boolean;
}

// Steps that show in the progress bar (excludes signup/login screens and complete)
const PROGRESS_STEPS: OnboardingStep[] = [
    'phone',
    'confirm',
    'name',
    'emailConfirm',
    'profilePhoto',
    'userIntent',
    'pushNotifications',
    'locationServices',
];

// Helper to get incomplete onboarding steps based on store data
export function getIncompleteOnboardingSteps(): OnboardingStep[] {
    const { data } = useOnboardingStore.getState();

    const stepChecks: { step: OnboardingStep; isComplete: () => boolean }[] = [
        { step: 'phone', isComplete: () => !!data.phoneNumber },
        { step: 'confirm', isComplete: () => !!data.phoneVerified },
        { step: 'name', isComplete: () => !!(data.firstName && data.lastName) },
        { step: 'emailConfirm', isComplete: () => !!data.emailConfirmed },
        { step: 'profilePhoto', isComplete: () => !!data.profilePhotoUri },
        { step: 'userIntent', isComplete: () => !!(data.userIntentions && data.userIntentions.length > 0) },
        { step: 'pushNotifications', isComplete: () => data.pushNotificationStatus !== null },
        { step: 'locationServices', isComplete: () => data.locationPermissionStatus !== null },
    ];

    return stepChecks
        .filter(({ isComplete }) => !isComplete())
        .map(({ step }) => step);
}

export function OnboardingFlow({
    initialStep = 'signup',
    filteredSteps,
    isResumeMode = false,
}: OnboardingFlowProps) {
    const { data } = useOnboardingStore();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
    const [fromStep, setFromStep] = useState<OnboardingStep>(initialStep);
    const [toStep, setToStep] = useState<OnboardingStep>(initialStep);
    const { isSignedIn } = useAuth();
    const completeOnboarding = useMutation(api.users.completeOnboarding);
    usePrefetchOnboardingQuestions();

    // Animation progress (0 = from step, 1 = to step)
    const animationProgress = useSharedValue(1);

    // Use filtered steps if provided (resume mode), otherwise use all progress steps
    const activeSteps = filteredSteps || PROGRESS_STEPS;
    console.log('activeSteps', activeSteps);
    console.log('currentStep', currentStep);
    // Get progress info for the current step
    const getProgressInfo = () => {
        const stepIndex = activeSteps.indexOf(currentStep);
        if (stepIndex === -1) {
            // Signup/login/complete step - no progress bar
            return { total: activeSteps.length, filled: 0 };
        }
        return { total: activeSteps.length, filled: stepIndex };
    };

    const progressInfo = getProgressInfo();

    // Handle step changes with animation
    const goToStep = (nextStep: OnboardingStep) => {
        if (nextStep === currentStep) return;

        // Dismiss keyboard when transitioning
        Keyboard.dismiss();

        // Set up transition
        setFromStep(currentStep);
        setToStep(nextStep);

        // Reset and animate
        animationProgress.value = 0;
        animationProgress.value = withTiming(1, {
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });

        // Update current step
        setCurrentStep(nextStep);
    };

    // Helper function to determine previous step after locationServices based on notification permissions
    const getPreviousStepAfterLocationServices = async (): Promise<OnboardingStep> => {
        const hasNotifications = await checkNotificationPermissions();
        if (hasNotifications) {
            return 'userIntent';
        }
        return 'pushNotifications';
    };

    const goBack = async () => {
        const { data: latestData } = useOnboardingStore.getState();
        
        // In resume mode, navigate within filtered steps
        if (isResumeMode && filteredSteps) {
            const currentIndex = activeSteps.indexOf(currentStep);
            if (currentIndex <= 0) {
                router.back();
                return;
            }
            goToStep(activeSteps[currentIndex - 1]);
            return;
        }

        // Normal mode navigation
        switch (currentStep) {
            case 'signup':
                break;
            case 'emailSignup':
                goToStep('signup');
                break;
            case 'emailVerify':
                goToStep('emailSignup');
                break;
            case 'login':
                goToStep('signup');
                break;
            case 'phone':
                goToStep('signup');
                break;
            case 'confirm':
                goToStep('phone');
                break;
            case 'name':
                goToStep('confirm');
                break;
            case 'emailConfirm':
                goToStep('name');
                break;
            case 'profilePhoto':
                goToStep('name');
                break;
            case 'userIntent':
                goToStep('profilePhoto');
                break;
            case 'pushNotifications':
                goToStep('userIntent');
                break;
            case 'locationServices': {
                const previousStep = await getPreviousStepAfterLocationServices();
                goToStep(previousStep);
                break;
            }
            default:
                break;
        }
    };

    // Helper function to normalize push notification status
    const normalizePushStatus = (s: string | null | undefined): 'granted' | 'provisional' | 'denied' | 'undetermined' => {
        if (s === 'granted' || s === 'provisional' || s === 'denied' || s === 'undetermined') {
            return s;
        }
        return 'undetermined';
    };

    // Helper function to check notification permissions
    const checkNotificationPermissions = async (): Promise<boolean> => {
        try {
            // @ts-ignore
            const mod = await import('expo-notifications');
            const res = await mod.getPermissionsAsync();
            const normalized = normalizePushStatus(res.status);
            return normalized === 'granted' || normalized === 'provisional';
        } catch {
            return false;
        }
    };

    // Helper function to check location permissions
    const checkLocationPermissions = async (): Promise<boolean> => {
        try {
            // @ts-ignore
            const mod = await import('expo-location');
            const res = await mod.getForegroundPermissionsAsync();
            return res.status === 'granted' || res.granted === true;
        } catch {
            return false;
        }
    };

    // Helper function to determine next step after userIntent based on permissions
    const getNextStepAfterUserIntent = async (): Promise<OnboardingStep> => {
        const hasNotifications = await checkNotificationPermissions();
        if (!hasNotifications) {
            return 'pushNotifications';
        }
        const hasLocation = await checkLocationPermissions();
        if (hasLocation) {
            return 'complete';
        }
        return 'locationServices';
    };

    // Helper function to determine next step after pushNotifications based on location permissions
    const getNextStepAfterPushNotifications = async (): Promise<OnboardingStep> => {
        const hasLocation = await checkLocationPermissions();
        if (hasLocation) {
            return 'complete';
        }
        return 'locationServices';
    };

    const goNext = async () => {
        const { data: latestData } = useOnboardingStore.getState();

        // In resume mode, navigate within filtered steps
        if (isResumeMode && filteredSteps) {
            const currentIndex = activeSteps.indexOf(currentStep);
            console.log('currentIndex', currentIndex);
            console.log('activeSteps', activeSteps);
            if (currentIndex >= activeSteps.length - 1) {
                goToStep('complete');
                return;
            }
            goToStep(activeSteps[currentIndex + 1]);
            return;
        }

        // Normal mode navigation
        switch (currentStep) {
            case 'signup':
                // OAuth success goes directly to phone
                goToStep('phone');
                break;
            case 'emailSignup':
                goToStep('emailVerify');
                break;
            case 'emailVerify':
                // Email verified, session created, go to phone
                goToStep('phone');
                break;
            case 'login':
                // Login success - check onboarding status and route accordingly
                // This is handled by the LoginStep component which calls onNext
                // The app/index.tsx will handle routing based on onboardingCompleted
                goToStep('complete');
                break;
            case 'phone':
                goToStep('confirm');
                break;
            case 'confirm':
                goToStep('name');
                break;
            case 'name':
                goToStep('emailConfirm');
                break;
            case 'emailConfirm':
                goToStep('profilePhoto');
                break;
            case 'profilePhoto':
                goToStep('userIntent');
                break;
            case 'userIntent': {
                const nextStep = await getNextStepAfterUserIntent();
                goToStep(nextStep);
                break;
            }
            case 'pushNotifications': {
                const nextStep = await getNextStepAfterPushNotifications();
                goToStep(nextStep);
                break;
            }
            case 'locationServices':
                goToStep('complete');
                break;
            default:
                break;
        }
    };

    // Navigate to home screen when onboarding is complete
    useEffect(() => {
        if (currentStep === 'complete') {
            // Mark onboarding complete in Convex if signed in
            if (isSignedIn) {
                completeOnboarding()
                    .then(() => console.log('Onboarding marked complete'))
                    .catch((err) => console.error('Failed to mark onboarding complete:', err));
            }

            if (isResumeMode) {
                router.back();
            } else {
                router.replace('/(main-tabs)/home');
            }
        }
    }, [currentStep, isResumeMode]);

    // Render the current step component
    const renderStep = () => {
        switch (currentStep) {
            case 'signup':
                return (
                    <SignupStep
                        onNext={goNext}
                        onBack={goBack}
                        onEmailSignup={() => goToStep('emailSignup')}
                        onLogin={() => goToStep('login')}
                    />
                );
            case 'emailSignup':
                return <EmailSignupStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'emailVerify':
                return <EmailVerificationStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'login':
                return <LoginStep onNext={goNext} onBack={goBack} />;
            case 'phone':
                return <PhoneNumberStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'confirm':
                return <ConfirmPhoneNumberStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'name':
                return <NameStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'emailConfirm':
                return <EmailConfirmStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'profilePhoto':
                return <ProfilePhotoStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'userIntent':
                return <UserIntentStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'pushNotifications':
                return <PushNotificationsStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'locationServices':
                return <LocationServicesStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'welcome':
                return <WelcomeStep onNext={goNext} onBack={goBack} />;
            case 'complete':
                return null;
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Animated gradient background */}
            <View style={styles.gradientContainer} pointerEvents="none">
                <AnimatedGradientBackground
                    progress={animationProgress}
                    fromIndex={STEP_INDICES[fromStep]}
                    toIndex={STEP_INDICES[toStep]}
                />
            </View>

            {/* Content */}
            <View style={styles.content}>
                {renderStep()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradientContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    gradient: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});
