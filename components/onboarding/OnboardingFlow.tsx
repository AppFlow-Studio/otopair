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
 *   <OnboardingFlow initialStep="welcome" />
 *   <OnboardingFlow 
 *     initialStep="profilePhoto" 
 *     filteredSteps={['profilePhoto', 'userIntent']} 
 *     isResumeMode={true} 
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
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
import { WelcomeStep } from './steps/WelcomeStep';
import { SignUpMethodsStep } from './steps/SignUpMethodsStep';
import { PhoneNumberStep } from './steps/PhoneNumberStep';
import { ConfirmPhoneNumberStep } from './steps/ConfirmPhoneNumberStep';
import { NameStep } from './steps/NameStep';
import { ProfilePhotoStep } from './steps/ProfilePhotoStep';
import { UserIntentStep } from './steps/UserIntentStep';
import { PushNotificationsStep } from './steps/PushNotificationsStep';
import { LocationServicesStep } from './steps/LocationServicesStep';

// Define the steps in the flow
export type OnboardingStep = 'welcome' | 'signUpMethods' | 'phone' | 'confirm' | 'name' | 'profilePhoto' | 'userIntent' | 'pushNotifications' | 'locationServices' | 'complete';

// Step indices mapping to SHARED_GRADIENT_CONFIGS
const STEP_INDICES: Record<OnboardingStep, number> = {
    welcome: 0,
    signUpMethods: 4,
    phone: 1,
    confirm: 2,
    name: 3,
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

// Steps that show in the progress bar (excludes welcome and complete)
const PROGRESS_STEPS: OnboardingStep[] = [
    'signUpMethods',
    'phone',
    'confirm',
    'name',
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
        { step: 'confirm', isComplete: () => !!data.phoneNumber }, // Same as phone
        { step: 'name', isComplete: () => !!(data.firstName && data.lastName) },
        { step: 'profilePhoto', isComplete: () => !!data.profilePhotoUri },
        { step: 'userIntent', isComplete: () => !!(data.userIntentions && data.userIntentions.length > 0) },
        // Permissions are considered complete if user has made a choice (granted or denied)
        { step: 'pushNotifications', isComplete: () => data.pushNotificationStatus !== null },
        { step: 'locationServices', isComplete: () => data.locationPermissionStatus !== null },
    ];

    return stepChecks
        .filter(({ isComplete }) => !isComplete())
        .map(({ step }) => step);
}

export function OnboardingFlow({ 
    initialStep = 'welcome',
    filteredSteps,
    isResumeMode = false,
}: OnboardingFlowProps) {
    const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
    const [fromStep, setFromStep] = useState<OnboardingStep>(initialStep);
    const [toStep, setToStep] = useState<OnboardingStep>(initialStep);
    
    // Animation progress (0 = from step, 1 = to step)
    const animationProgress = useSharedValue(1);

    // Use filtered steps if provided (resume mode), otherwise use all progress steps
    const activeSteps = filteredSteps || PROGRESS_STEPS;

    // Get progress info for the current step
    const getProgressInfo = () => {
        const stepIndex = activeSteps.indexOf(currentStep);
        if (stepIndex === -1) {
            // Welcome or complete step - no progress bar
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
        // In resume mode, navigate within filtered steps
        if (isResumeMode && filteredSteps) {
            const currentIndex = activeSteps.indexOf(currentStep);
            if (currentIndex <= 0) {
                // First step in resume mode - go back to home
                router.back();
                return;
            }
            // Go to previous step in filtered list
            goToStep(activeSteps[currentIndex - 1]);
            return;
        }

        // Normal mode navigation
        switch (currentStep) {
            case 'welcome':
                goToStep('complete');
                break;
            case 'signUpMethods':
                goToStep('welcome');
                break;
            case 'phone':
                goToStep('signUpMethods');
                break;
            case 'confirm':
                goToStep('phone');
                break;
            case 'name':
                goToStep('confirm');
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
        // In resume mode, navigate within filtered steps
        if (isResumeMode && filteredSteps) {
            const currentIndex = activeSteps.indexOf(currentStep);
            if (currentIndex >= activeSteps.length - 1) {
                // Last step in resume mode - complete and go back to home
                goToStep('complete');
                return;
            }
            // Go to next step in filtered list
            goToStep(activeSteps[currentIndex + 1]);
            return;
        }

        // Normal mode navigation
        switch (currentStep) {
            case 'welcome':
                goToStep('signUpMethods');
                break;
            case 'signUpMethods':
                goToStep('phone');
                break;
            case 'phone':
                goToStep('confirm');
                break;
            case 'confirm':
                goToStep('name');
                break;
            case 'name':
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
            if (isResumeMode) {
                // In resume mode, go back to where user came from
                router.back();
            } else {
                // In normal onboarding, replace with home
                router.replace('/(main-tabs)/home');
            }
        }
    }, [currentStep, isResumeMode]);

    // Render the current step component
    const renderStep = () => {
        switch (currentStep) {
            case 'welcome':
                return <WelcomeStep onNext={goNext} onBack={goBack} />;
            case 'signUpMethods':
                return <SignUpMethodsStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'phone':
                return <PhoneNumberStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'confirm':
                return <ConfirmPhoneNumberStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'name':
                return <NameStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'profilePhoto':
                return <ProfilePhotoStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'userIntent':
                return <UserIntentStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'pushNotifications':
                return <PushNotificationsStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
            case 'locationServices':
                return <LocationServicesStep onNext={goNext} onBack={goBack} progress={progressInfo} />;
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

