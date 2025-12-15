/**
 * OnboardingFlow
 *
 * PURPOSE: Single container for onboarding flow with animated gradient transitions.
 *          Manages step state and renders appropriate child components.
 *
 * USED IN: app/(onboarding)/flow.tsx
 *
 * FEATURES:
 *   - Smooth gradient coordinate transitions between steps
 *   - Gradient positions physically animate on screen
 *   - Centralized step management
 *   - Back navigation support
 *
 * OWNER: Daniel Chelala
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
    useSharedValue, 
    withTiming, 
    interpolate,
    Easing,
    runOnJS,
    useAnimatedReaction,
} from 'react-native-reanimated';
import { BrandColors } from '@/components/shared-ui';
import { WelcomeStep } from './steps/WelcomeStep';
import { PhoneNumberStep } from './steps/PhoneNumberStep';
import { ConfirmPhoneNumberStep } from './steps/ConfirmPhoneNumberStep';
import { NameStep } from './steps/NameStep';
import { UserIntentStep } from './steps/UserIntentStep';
import { PushNotificationsStep } from './steps/PushNotificationsStep';
import { LocationServicesStep } from './steps/LocationServicesStep';

// Define the steps in the flow
export type OnboardingStep = 'welcome' | 'phone' | 'confirm' | 'name' | 'userIntent' | 'pushNotifications' | 'locationServices' | 'complete';

// Step indices for interpolation
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

// Default gradient colors used across all steps
const DEFAULT_GRADIENT_COLORS: [string, string, string] = [
    BrandColors.secondary,
    '#050A14',
    '#1d2c46ff'
    
];

// Gradient configurations for each step - more dramatic position changes
const GRADIENT_CONFIGS: Record<OnboardingStep, {
    colors: [string, string, string];
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}> = {
    welcome: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0,
        startY: 0,
        endX: 0.4,
        endY: 0.6,
    },
    phone: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0,
        startY: 0.1,
        endX: 0.2,
        endY: 0.8,
    },
    confirm: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.5,
        startY: 0.2,
        endX: 0.7,
        endY: 0.9,
    },
    name: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.7,
        startY: 0,
        endX: 0.2,
        endY: 0.5,
    },
    userIntent: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.3,
        startY: 0.2,
        endX: 0.5,
        endY: 0.7,
    },
    pushNotifications: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.4,
        startY: 0.3,
        endX: 0.6,
        endY: 0.8,
    },
    locationServices: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.6,
        startY: 0.1,
        endX: 0.3,
        endY: 0.9,
    },
    complete: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.2,
        startY: 0.2,
        endX: 0.8,
        endY: 1,
    },
};

interface OnboardingFlowProps {
    initialStep?: OnboardingStep;
}

// Animated gradient component that physically moves gradient coordinates
function AnimatedGradientBackground({ 
    progress, 
    fromStep, 
    toStep
}: {
    progress: import('react-native-reanimated').SharedValue<number>;
    fromStep: OnboardingStep;
    toStep: OnboardingStep;
}) {
    const fromConfig = GRADIENT_CONFIGS[fromStep];
    const toConfig = GRADIENT_CONFIGS[toStep];
    
    // State for current gradient positions
    const [gradientPos, setGradientPos] = useState({
        startX: fromConfig.startX,
        startY: fromConfig.startY,
        endX: fromConfig.endX,
        endY: fromConfig.endY,
    });
    
    // Callback to update positions from the UI thread
    const updatePositions = useCallback((p: number) => {
        setGradientPos({
            startX: interpolate(p, [0, 1], [fromConfig.startX, toConfig.startX]),
            startY: interpolate(p, [0, 1], [fromConfig.startY, toConfig.startY]),
            endX: interpolate(p, [0, 1], [fromConfig.endX, toConfig.endX]),
            endY: interpolate(p, [0, 1], [fromConfig.endY, toConfig.endY]),
        });
    }, [fromConfig, toConfig]);
    
    // React to animation progress changes and update gradient positions
    useAnimatedReaction(
        () => progress.value,
        (currentValue) => {
            runOnJS(updatePositions)(currentValue);
        },
        [updatePositions]
    );
    
    return (
        <LinearGradient
            colors={toConfig.colors}
            start={{ x: gradientPos.startX, y: gradientPos.startY }}
            end={{ x: gradientPos.endX, y: gradientPos.endY }}
            style={styles.gradient}
        />
    );
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
                    fromStep={fromStep}
                    toStep={toStep}
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

