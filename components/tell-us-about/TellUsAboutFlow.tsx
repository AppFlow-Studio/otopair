/**
 * TellUsAboutFlow
 *
 * PURPOSE: Single container for the "Tell us about yourself" flow with animated gradient transitions.
 *
 * USED IN: app/(tell-us-about)/flow.tsx
 *
 * PROPS:
 *   - initialStep (TellUsAboutStep): The step to start the flow from [optional, default: 'experience']
 *
 * EXAMPLE:
 *   <TellUsAboutFlow initialStep="experience" />
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
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { AnimatedGradientBackground } from '@/components/shared-ui';

// Import step components
import { ExperienceStep } from './steps/ExperienceStep';
import { CarUsageStep } from './steps/CarUsageStep';
import { ServicePrioritiesStep } from './steps/ServicePrioritiesStep';
import { MaintenanceFrustrationStep } from './steps/MaintenanceFrustrationStep';
import { MaintenanceTrackingStep } from './steps/MaintenanceTrackingStep';
import { ShopTypeStep } from './steps/ShopTypeStep';
import { WhyNewOptionStep } from './steps/WhyNewOptionStep';
import { TerminologyComfortStep } from './steps/TerminologyComfortStep';
import { RepairQuoteNeedsStep } from './steps/RepairQuoteNeedsStep';
import { DoItYourselfStep } from './steps/DoItYourselfStep';
import { MaintenanceApproachStepLevel3 } from './steps/MaintenanceApproachStepLevel3';
import { PrimaryReasonStep } from './steps/PrimaryReasonStep';
import { ShopPrioritiesStep } from './steps/ShopPrioritiesStep';
import { CommunicationPreferenceStep } from './steps/CommunicationPreferenceStep';
import { AdditionalPreferencesStep } from './steps/AdditionalPreferencesStep';

// Define the steps in the flow
export type TellUsAboutStep = 
    | 'experience' 
    | 'carUsage' 
    | 'servicePriorities' 
    | 'maintenanceFrustration'
    | 'maintenanceTracking'
    | 'shopType'
    | 'whyNewOption'
    | 'terminologyComfort'
    | 'repairQuoteNeeds'
    | 'doItYourself'
    | 'maintenanceApproachLevel3'
    | 'primaryReason'
    | 'shopPriorities'
    | 'communicationPreference'
    | 'additionalPreferences'
    | 'complete';

// Step indices for interpolation mapping to SHARED_GRADIENT_CONFIGS
const STEP_INDICES: Record<TellUsAboutStep, number> = {
    experience: 0,
    carUsage: 1,
    shopType: 2,
    maintenanceFrustration: 3,
    maintenanceApproachLevel3: 4,
    servicePriorities: 5,
    maintenanceTracking: 6,
    whyNewOption: 7,
    terminologyComfort: 8,
    repairQuoteNeeds: 9,
    doItYourself: 10,
    primaryReason: 11,
    shopPriorities: 12,
    communicationPreference: 13,
    additionalPreferences: 14,
    complete: 15,
};

interface TellUsAboutFlowProps {
    initialStep?: TellUsAboutStep;
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
            // Level 1 path: experience -> carUsage -> shopType -> maintenanceFrustration -> maintenanceApproachLevel3 -> servicePriorities
            const steps: TellUsAboutStep[] = ['experience', 'carUsage', 'shopType', 'maintenanceFrustration', 'maintenanceApproachLevel3', 'servicePriorities'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        } else if (level === 2) {
            // Level 2 path: experience -> maintenanceTracking -> shopType -> whyNewOption -> terminologyComfort -> repairQuoteNeeds
            const steps: TellUsAboutStep[] = ['experience', 'maintenanceTracking', 'shopType', 'whyNewOption', 'terminologyComfort', 'repairQuoteNeeds'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        } else {
            // Level 3 path: experience -> doItYourself -> maintenanceApproachLevel3 -> primaryReason -> shopPriorities -> communicationPreference -> additionalPreferences
            const steps: TellUsAboutStep[] = ['experience', 'doItYourself', 'maintenanceApproachLevel3', 'primaryReason', 'shopPriorities', 'communicationPreference', 'additionalPreferences'];
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
            case 'shopType':
                if (level === 1) {
                    goToStep('carUsage');
                } else if (level === 2) {
                    goToStep('maintenanceTracking');
                } else {
                    goToStep('experience');
                }
                break;
            case 'maintenanceFrustration':
                goToStep('shopType');
                break;
            case 'maintenanceApproachLevel3':
                if (level === 1) {
                    goToStep('maintenanceFrustration');
                } else {
                    goToStep('doItYourself');
                }
                break;
            case 'servicePriorities':
                if (level === 1) {
                    goToStep('maintenanceApproachLevel3');
                } else if (level === 3) {
                    goToStep('terminologyComfort');
                }
                break;
            
            // Level 2 back navigation
            case 'maintenanceTracking':
                goToStep('experience');
                break;
            case 'doItYourself':
                goToStep('experience');
                break;
            case 'primaryReason':
                goToStep('maintenanceApproachLevel3');
                break;
            case 'shopPriorities':
                goToStep('primaryReason');
                break;
            case 'communicationPreference':
                goToStep('shopPriorities');
                break;
            case 'additionalPreferences':
                goToStep('communicationPreference');
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
                    // Level 1: no longer exists, but keeping fallback
                    goToStep('experience');
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
                } else if (level === 3) {
                    goToStep('doItYourself');
                } else {
                    goToStep('shopType');
                }
                break;
            
            case 'doItYourself':
                goToStep('maintenanceApproachLevel3');
                break;
            
            case 'maintenanceApproachLevel3':
                if (level === 3) {
                    goToStep('primaryReason');
                } else {
                    goToStep('shopType');
                }
                break;
            
            case 'primaryReason':
                goToStep('shopPriorities');
                break;
            
            case 'shopPriorities':
                goToStep('communicationPreference');
                break;
            
            case 'communicationPreference':
                goToStep('additionalPreferences');
                break;
            
            case 'additionalPreferences':
                goToStep('complete');
                break;
            
            // Level 1 forward navigation
            case 'carUsage':
                goToStep('shopType');
                break;
            case 'shopType':
                if (level === 1) {
                    goToStep('maintenanceFrustration');
                } else {
                    goToStep('whyNewOption');
                }
                break;
            case 'maintenanceFrustration':
                goToStep('maintenanceApproachLevel3');
                break;
            case 'maintenanceApproachLevel3':
                if (level === 1) {
                    goToStep('servicePriorities');
                } else if (level === 3) {
                    goToStep('primaryReason');
                } else {
                    goToStep('shopType');
                }
                break;
            case 'servicePriorities':
                goToStep('complete');
                break;
            
            // Level 2 forward navigation
            case 'maintenanceTracking':
                goToStep('shopType');
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
            case 'maintenanceFrustration':
                return (
                    <MaintenanceFrustrationStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
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
            case 'shopType':
                return (
                    <ShopTypeStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'whyNewOption':
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
            case 'doItYourself':
                return (
                    <DoItYourselfStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'maintenanceApproachLevel3':
                return (
                    <MaintenanceApproachStepLevel3 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'primaryReason':
                return (
                    <PrimaryReasonStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'shopPriorities':
                return (
                    <ShopPrioritiesStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'communicationPreference':
                return (
                    <CommunicationPreferenceStep 
                        onNext={goNext} 
                        onBack={goBack}
                        progress={{ total: progressInfo.total, filled: progressInfo.filled - 1 }}
                    />
                );
            case 'additionalPreferences':
                return (
                    <AdditionalPreferencesStep 
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
