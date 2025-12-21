/**
 * TellUsAboutFlow
 *
 * PURPOSE: Single container for "Tell us about yourself" flow with animated gradient transitions.
 *          Manages step state and renders appropriate child components.
 *          Mirrors the style and structure of OnboardingFlow.
 *
 * USED IN: app/(tell-us-about)/flow.tsx
 *
 * FEATURES:
 *   - Smooth gradient coordinate transitions between steps
 *   - Gradient positions physically animate on screen
 *   - Centralized step management
 *   - Back navigation support
 *   - Dynamic path based on car knowledge level
 *
 * OWNER: Daniel Chelala
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { 
    useSharedValue, 
    withTiming, 
    interpolate,
    Easing,
    runOnJS,
    useAnimatedReaction,
} from 'react-native-reanimated';
import { BrandColors } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

// Import step components
import { ExperienceStep } from './steps/ExperienceStep';
import { CarUsageStep } from './steps/CarUsageStep';
import { ServicePrioritiesStep } from './steps/ServicePrioritiesStep';
import { DecisionHelperStep } from './steps/DecisionHelperStep';
import { StressNoteStep } from './steps/StressNoteStep';
import { MaintenanceTrackingStep } from './steps/MaintenanceTrackingStep';
import { MonthlyMileageStep } from './steps/MonthlyMileageStep';
import { ShopTypeStep } from './steps/ShopTypeStep';
import { WhyNewOptionStep } from './steps/WhyNewOptionStep';
import { TerminologyComfortStep } from './steps/TerminologyComfortStep';
import { RepairQuoteNeedsStep } from './steps/RepairQuoteNeedsStep';

// Define the steps in the flow
export type TellUsAboutStep = 
    | 'experience' 
    | 'carUsage' 
    | 'servicePriorities' 
    | 'decisionHelper' 
    | 'stressNote'
    | 'maintenanceTracking'
    | 'monthlyMileage'
    | 'shopType'
    | 'whyNewOption'
    | 'terminologyComfort'
    | 'repairQuoteNeeds'
    | 'complete';

// Step indices for interpolation
const STEP_INDICES: Record<TellUsAboutStep, number> = {
    experience: 0,
    carUsage: 1,
    servicePriorities: 2,
    decisionHelper: 3,
    stressNote: 4,
    maintenanceTracking: 5,
    monthlyMileage: 6,
    shopType: 7,
    whyNewOption: 8,
    terminologyComfort: 9,
    repairQuoteNeeds: 10,
    complete: 11,
};

// Default gradient colors used across all steps (same as OnboardingFlow)
const DEFAULT_GRADIENT_COLORS: [string, string, string] = [
    BrandColors.secondary,
    '#050A14',
    '#1d2c46ff'
];

// Gradient configurations for each step - more dramatic position changes
const GRADIENT_CONFIGS: Record<TellUsAboutStep, {
    colors: [string, string, string];
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}> = {
    experience: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0,
        startY: 0,
        endX: 0.4,
        endY: 0.6,
    },
    carUsage: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0,
        startY: 0.1,
        endX: 0.2,
        endY: 0.8,
    },
    servicePriorities: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.5,
        startY: 0.2,
        endX: 0.7,
        endY: 0.9,
    },
    decisionHelper: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.7,
        startY: 0,
        endX: 0.2,
        endY: 0.5,
    },
    stressNote: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.3,
        startY: 0.2,
        endX: 0.5,
        endY: 0.7,
    },
    maintenanceTracking: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.4,
        startY: 0.3,
        endX: 0.6,
        endY: 0.8,
    },
    monthlyMileage: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.6,
        startY: 0.1,
        endX: 0.3,
        endY: 0.9,
    },
    shopType: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.2,
        startY: 0.2,
        endX: 0.8,
        endY: 1,
    },
    whyNewOption: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.1,
        startY: 0.3,
        endX: 0.5,
        endY: 0.7,
    },
    terminologyComfort: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.5,
        startY: 0.1,
        endX: 0.4,
        endY: 0.8,
    },
    repairQuoteNeeds: {
        colors: DEFAULT_GRADIENT_COLORS,
        startX: 0.3,
        startY: 0.0,
        endX: 0.6,
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

interface TellUsAboutFlowProps {
    initialStep?: TellUsAboutStep;
}

// Animated gradient component that physically moves gradient coordinates
function AnimatedGradientBackground({ 
    progress, 
    fromStep, 
    toStep
}: {
    progress: import('react-native-reanimated').SharedValue<number>;
    fromStep: TellUsAboutStep;
    toStep: TellUsAboutStep;
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

export function TellUsAboutFlow({ initialStep = 'experience' }: TellUsAboutFlowProps) {
    const [currentStep, setCurrentStep] = useState<TellUsAboutStep>(initialStep);
    const [fromStep, setFromStep] = useState<TellUsAboutStep>(initialStep);
    const [toStep, setToStep] = useState<TellUsAboutStep>(initialStep);
    const { data, updateData } = useOnboardingStore();
    
    // Animation progress (0 = from step, 1 = to step)
    const animationProgress = useSharedValue(1);
    
    // Handle step changes with animation
    const goToStep = (nextStep: TellUsAboutStep) => {
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
    
    // Get total steps and current step index based on knowledge level
    const getProgressInfo = () => {
        const level = data.carKnowledgeLevel;
        
        if (level === 1) {
            // Level 1 path: experience -> carUsage -> servicePriorities -> decisionHelper -> stressNote
            const steps: TellUsAboutStep[] = ['experience', 'carUsage', 'servicePriorities', 'decisionHelper', 'stressNote'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        } else if (level === 2) {
            // Level 2 path: experience -> maintenanceTracking -> monthlyMileage -> shopType -> whyNewOption -> terminologyComfort -> repairQuoteNeeds
            const steps: TellUsAboutStep[] = ['experience', 'maintenanceTracking', 'monthlyMileage', 'shopType', 'whyNewOption', 'terminologyComfort', 'repairQuoteNeeds'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        } else {
            // Level 3/4 path: experience -> shopType -> whyNewOption -> terminologyComfort -> servicePriorities -> decisionHelper -> stressNote -> repairQuoteNeeds
            const steps: TellUsAboutStep[] = ['experience', 'shopType', 'whyNewOption', 'terminologyComfort', 'servicePriorities', 'decisionHelper', 'stressNote', 'repairQuoteNeeds'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        }
    };

    const goBack = () => {
        const level = data.carKnowledgeLevel;
        
        switch (currentStep) {
            case 'experience':
                // Go back to home screen
                router.back();
                break;
            
            // Level 1 back navigation
            case 'carUsage':
                goToStep('experience');
                break;
            case 'servicePriorities':
                if (level === 1) {
                    goToStep('carUsage');
                } else if (level === 3 || level === 4) {
                    goToStep('terminologyComfort');
                }
                break;
            case 'decisionHelper':
                goToStep('servicePriorities');
                break;
            case 'stressNote':
                if (level === 1) {
                    goToStep('decisionHelper');
                } else {
                    goToStep('decisionHelper');
                }
                break;
            
            // Level 2 back navigation
            case 'maintenanceTracking':
                goToStep('experience');
                break;
            case 'monthlyMileage':
                goToStep('maintenanceTracking');
                break;
            case 'shopType':
                if (level === 2) {
                    goToStep('monthlyMileage');
                } else {
                    goToStep('experience');
                }
                break;
            case 'whyNewOption':
                goToStep('shopType');
                break;
            case 'terminologyComfort':
                goToStep('whyNewOption');
                break;
            case 'repairQuoteNeeds':
                if (level === 2) {
                    goToStep('terminologyComfort');
                } else {
                    goToStep('stressNote');
                }
                break;
            
            default:
                router.back();
                break;
        }
    };
    
    const goNext = () => {
        const level = data.carKnowledgeLevel;
        
        switch (currentStep) {
            case 'experience':
                if (level === 1) {
                    goToStep('carUsage');
                } else if (level === 2) {
                    goToStep('maintenanceTracking');
                } else {
                    goToStep('shopType');
                }
                break;
            
            // Level 1 forward navigation
            case 'carUsage':
                goToStep('servicePriorities');
                break;
            case 'servicePriorities':
                goToStep('decisionHelper');
                break;
            case 'decisionHelper':
                if (level === 1) {
                    goToStep('stressNote');
                } else {
                    goToStep('stressNote');
                }
                break;
            case 'stressNote':
                if (level === 1) {
                    // Finish for Level 1
                    goToStep('complete');
                } else {
                    goToStep('repairQuoteNeeds');
                }
                break;
            
            // Level 2 forward navigation
            case 'maintenanceTracking':
                goToStep('monthlyMileage');
                break;
            case 'monthlyMileage':
                goToStep('shopType');
                break;
            case 'shopType':
                goToStep('whyNewOption');
                break;
            case 'whyNewOption':
                goToStep('terminologyComfort');
                break;
            case 'terminologyComfort':
                if (level === 2) {
                    goToStep('repairQuoteNeeds');
                } else {
                    goToStep('servicePriorities');
                }
                break;
            case 'repairQuoteNeeds':
                // Finish
                goToStep('complete');
                break;
            
            default:
                break;
        }
    };

    // Navigate back to home screen when flow is complete
    useEffect(() => {
        if (currentStep === 'complete') {
            updateData({ isTellUsAboutYourselfComplete: true });
            router.back();
        }
    }, [currentStep, updateData]);

    const progressInfo = getProgressInfo(); 

    // Render the current step component
    const renderStep = () => {
        switch (currentStep) {
            case 'experience':
                return (
                    <ExperienceStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'carUsage':
                return (
                    <CarUsageStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'servicePriorities':
                return (
                    <ServicePrioritiesStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'decisionHelper':
                return (
                    <DecisionHelperStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'stressNote':
                return (
                    <StressNoteStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                        isLastStep={data.carKnowledgeLevel === 1}
                    />
                );
            case 'maintenanceTracking':
                return (
                    <MaintenanceTrackingStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'monthlyMileage':
                return (
                    <MonthlyMileageStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'shopType':
                return (
                    <ShopTypeStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'whyNewOption':
                return (
                    <WhyNewOptionStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'terminologyComfort':
                return (
                    <TerminologyComfortStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'repairQuoteNeeds':
                return (
                    <RepairQuoteNeedsStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
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

