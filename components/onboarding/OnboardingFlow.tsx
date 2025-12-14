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
import { PhoneNumberStep } from './steps/PhoneNumberStep';
import { ConfirmPhoneNumberStep } from './steps/ConfirmPhoneNumberStep';
import { NameStep } from './steps/NameStep';

// Define the steps in the flow
export type OnboardingStep = 'phone' | 'confirm' | 'name' | 'complete';

// Step indices for interpolation
const STEP_INDICES: Record<OnboardingStep, number> = {
    phone: 0,
    confirm: 1,
    name: 2,
    complete: 3,
};

// Gradient configurations for each step - more dramatic position changes
const GRADIENT_CONFIGS: Record<OnboardingStep, {
    colors: [string, string, string];
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}> = {
    phone: {
        colors: [BrandColors.secondary, '#1d2c46ff', '#050A14'],
        startX: 0,
        startY: 0,
        endX: 0.2,
        endY: 0.8,
    },
    confirm: {
        colors: [BrandColors.secondary, '#1d2c46ff', '#050A14'],
        startX: 0.3,
        startY: 0,
        endX: 0.7,
        endY: 0.9,
    },
    name: {
        colors: [BrandColors.secondary, '#1d2c46ff', '#050A14'],
        startX: 0.5,
        startY: 0.1,
        endX: 1,
        endY: 0.85,
    },
    complete: {
        colors: [BrandColors.secondary, '#1d2c46ff', '#050A14'],
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

export function OnboardingFlow({ initialStep = 'phone' }: OnboardingFlowProps) {
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
            duration: 600,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        
        // Update current step
        setCurrentStep(nextStep);
    };
    
    const goBack = () => {
        switch (currentStep) {
            case 'confirm':
                goToStep('phone');
                break;
            case 'name':
                goToStep('confirm');
                break;
            default:
                break;
        }
    };
    
    const goNext = () => {
        switch (currentStep) {
            case 'phone':
                goToStep('confirm');
                break;
            case 'confirm':
                goToStep('name');
                break;
            case 'name':
                goToStep('complete');
                break;
            default:
                break;
        }
    };

    // Render the current step component
    const renderStep = () => {
        switch (currentStep) {
            case 'phone':
                return <PhoneNumberStep onNext={goNext} onBack={goBack} />;
            case 'confirm':
                return <ConfirmPhoneNumberStep onNext={goNext} onBack={goBack} />;
            case 'name':
                return <NameStep onNext={goNext} onBack={goBack} />;
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

