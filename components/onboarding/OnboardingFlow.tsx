/**
 * OnboardingFlow
 *
 * PURPOSE: Single container for onboarding flow with animated gradient transitions.
 *
 * USED IN: app/(onboarding)/index.tsx
 *
 * PROPS:
 *   - initialStep (OnboardingStep): The step to start the onboarding flow from [optional]
 *
 * EXAMPLE:
 *   <OnboardingFlow initialStep="welcome" />
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
import { AnimatedGradientBackground } from '@/components/shared-ui/AnimatedGradientBackground';
import { WelcomeStep } from './steps/WelcomeStep';
import { PhoneNumberStep } from './steps/PhoneNumberStep';
import { ConfirmPhoneNumberStep } from './steps/ConfirmPhoneNumberStep';
import { NameStep } from './steps/NameStep';
import { UserIntentStep } from './steps/UserIntentStep';
import { PushNotificationsStep } from './steps/PushNotificationsStep';
import { LocationServicesStep } from './steps/LocationServicesStep';

// Define the steps in the flow
export type OnboardingStep = 'welcome' | 'phone' | 'confirm' | 'name' | 'userIntent' | 'pushNotifications' | 'locationServices' | 'complete';

// Step indices mapping to SHARED_GRADIENT_CONFIGS
const STEP_INDICES: Record<OnboardingStep, number> = {
    welcome: 0,
    phone: 1,
    confirm: 2,
    name: 3,
    userIntent: 4,
    pushNotifications: 5,
    locationServices: 6,
    complete: 7,
};

interface OnboardingFlowProps {
    initialStep?: OnboardingStep;
}

export function OnboardingFlow({ initialStep = 'welcome' }: OnboardingFlowProps) {
    const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
    const [fromStep, setFromStep] = useState<OnboardingStep>(initialStep);
    const [toStep, setToStep] = useState<OnboardingStep>(initialStep);
    
    // Animation progress (0 = from step, 1 = to step)
    const animationProgress = useSharedValue(1);
    
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
        switch (currentStep) {
            case 'welcome':
                goToStep('complete');
                break;
            case 'phone':
                goToStep('welcome');
                break;
            case 'confirm':
                goToStep('phone');
                break;
            case 'name':
                goToStep('confirm');
                break;
            case 'userIntent':
                goToStep('name');
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
        switch (currentStep) {
            case 'welcome':
                goToStep('phone');
                break;
            case 'phone':
                goToStep('confirm');
                break;
            case 'confirm':
                goToStep('name');
                break;
            case 'name':
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
            router.replace('/(main-tabs)/home');
        }
    }, [currentStep]);

    // Render the current step component
    const renderStep = () => {
        switch (currentStep) {
            case 'welcome':
                return <WelcomeStep onNext={goNext} onBack={goBack} />;
            case 'phone':
                return <PhoneNumberStep onNext={goNext} onBack={goBack} />;
            case 'confirm':
                return <ConfirmPhoneNumberStep onNext={goNext} onBack={goBack} />;
            case 'name':
                return <NameStep onNext={goNext} onBack={goBack} />;
            case 'userIntent':
                return <UserIntentStep onNext={goNext} onBack={goBack} />;
            case 'pushNotifications':
                return <PushNotificationsStep onNext={goNext} onBack={goBack} />;
            case 'locationServices':
                return <LocationServicesStep onNext={goNext} onBack={goBack} />;
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
