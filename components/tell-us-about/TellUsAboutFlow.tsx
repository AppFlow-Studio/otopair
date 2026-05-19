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
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { usePrefetchOnboardingQuestions } from '@/hooks/usePrefetchOnboardingQuestions';

// Import step components
import { ExperienceStep } from "./steps/ExperienceStep";
import { CarUsageStep } from "./steps/CarUsageStep";
import { ServicePrioritiesStep } from "./steps/ServicePrioritiesStep";
import { MaintenanceFrustrationStep } from "./steps/MaintenanceFrustrationStep";
import { MaintenanceTrackingStep } from "./steps/MaintenanceTrackingStep";
import { ShopTypeStep } from "./steps/ShopTypeStep";
import { RepairQuoteNeedsStep } from "./steps/RepairQuoteNeedsStep";
import { ServiceHistoryStep } from "./steps/ServiceHistoryStep";
import { PartsPhilosophyStep } from "./steps/PartsPhilosophyStep";
import { MaintenanceApproachStepLevel3 } from "./steps/MaintenanceApproachStepLevel3";
import { MaintenanceApproachStepLevel1 } from "./steps/MaintenanceApproachStepLevel1";
import { ShopPrioritiesStep } from "./steps/ShopPrioritiesStep";
import { HouseholdRoleStep } from "./steps/HouseholdRoleStep";
import { DecisionStyleStep } from "./steps/DecisionStyleStep";

// Define the steps in the flow
export type TellUsAboutStep =
  | "experience"
  | "carUsage"
  | "servicePriorities"
  | "maintenanceFrustration"
  | "maintenanceTracking"
  | "shopType"
  | "repairQuoteNeeds"
  | "serviceHistory"
  | "partsPhilosophy"
  | "maintenanceApproachLevel1"
  | "maintenanceApproachLevel3"
  | "shopPriorities"
  | "householdRole"
  | "decisionStyle"
  | "complete";

// Light palette: white at the top, gentle mid-blue, blue-300 at the
// saturated end. Airy and clearly branded without overwhelming the
// content. Bottom stop is matched by FadeFooterContainer so the
// fade above the CTA blends invisibly.
const LIGHT_PALETTE: [string, string, string] = ['#7BB8FF', '#BFDBFE', '#FFFFFF'];

// Step indices for interpolation mapping to SHARED_GRADIENT_CONFIGS
const STEP_INDICES: Record<TellUsAboutStep, number> = {
  experience: 0,
  carUsage: 1,
  shopType: 2,
  maintenanceFrustration: 3,
  servicePriorities: 5,
  maintenanceTracking: 6,
  repairQuoteNeeds: 9,
  serviceHistory: 10,
  partsPhilosophy: 11,
  maintenanceApproachLevel1: 4,
  maintenanceApproachLevel3: 12,
  shopPriorities: 13,
  householdRole: 14,
  decisionStyle: 15,
  complete: 16,
};

interface TellUsAboutFlowProps {
  initialStep?: TellUsAboutStep;
}

export function TellUsAboutFlow({ initialStep = 'experience' }: TellUsAboutFlowProps) {
    const [currentStep, setCurrentStep] = useState<TellUsAboutStep>(initialStep);
    const [fromStep, setFromStep] = useState<TellUsAboutStep>(initialStep);
    const [toStep, setToStep] = useState<TellUsAboutStep>(initialStep);
    const { data, updateData } = useOnboardingStore();
    const { isSignedIn } = useAuth();
    const updateProfile = useMutation(api.users.updateProfile);
    const { isLoaded: questionsLoaded } = usePrefetchOnboardingQuestions();
    
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
            // Level 1 path: experience -> carUsage -> shopType -> maintenanceFrustration -> maintenanceApproachLevel1 -> servicePriorities
            const steps: TellUsAboutStep[] = ['experience', 'carUsage', 'shopType', 'maintenanceFrustration', 'maintenanceApproachLevel1', 'servicePriorities'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        } else if (level === 2) {
            // Level 2 path: experience -> maintenanceTracking -> shopType -> repairQuoteNeeds -> servicePriorities
            const steps: TellUsAboutStep[] = ['experience', 'maintenanceTracking', 'shopType', 'repairQuoteNeeds', 'servicePriorities'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        } else {
            // Level 3 path: experience -> serviceHistory -> partsPhilosophy -> maintenanceApproachLevel3 -> shopPriorities -> householdRole -> decisionStyle -> servicePriorities
            const steps: TellUsAboutStep[] = ['experience', 'serviceHistory', 'partsPhilosophy', 'maintenanceApproachLevel3', 'shopPriorities', 'householdRole', 'decisionStyle', 'servicePriorities'];
            const current = steps.indexOf(currentStep) + 1;
            return { total: steps.length, filled: current > 0 ? current : 1 };
        }
    };

  const goBack = () => {
    const level = data.carKnowledgeLevel;

    switch (currentStep) {
      case "experience":
        // Go back to home screen
        router.back();
        break;

      // Level 1 back navigation
      case "carUsage":
        goToStep("experience");
        break;
      case "shopType":
        if (level === 1) {
          goToStep("carUsage");
        } else if (level === 2) {
          goToStep("maintenanceTracking");
        } else {
          goToStep("experience");
        }
        break;
      case "maintenanceFrustration":
        goToStep("shopType");
        break;
      case "maintenanceApproachLevel1":
        goToStep("maintenanceFrustration");
        break;
      case "serviceHistory":
        goToStep("experience");
        break;
      case "partsPhilosophy":
        goToStep("serviceHistory");
        break;
      case "maintenanceApproachLevel3":
        if (level === 1) {
          goToStep("maintenanceFrustration");
        } else if (level === 3) {
          goToStep("partsPhilosophy");
        } else {
          goToStep("shopType");
        }
        break;
      case "servicePriorities":
        if (level === 1) {
          goToStep("maintenanceApproachLevel1");
        } else if (level === 2) {
          goToStep("repairQuoteNeeds");
        } else if (level === 3) {
          goToStep("decisionStyle");
        }
        break;

      // Level 2 back navigation
      case "maintenanceTracking":
        goToStep("experience");
        break;
      case "repairQuoteNeeds":
        if (level === 2) {
          goToStep("shopType");
        } else {
          // Level 1: no longer exists, but keeping fallback
          goToStep("experience");
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
      case "experience":
        if (level === 1) {
          goToStep("carUsage");
        } else if (level === 2) {
          goToStep("maintenanceTracking");
        } else if (level === 3) {
          goToStep("serviceHistory");
        } else {
          goToStep("shopType");
        }
        break;

      case "serviceHistory":
        goToStep("partsPhilosophy");
        break;

      case "partsPhilosophy":
        goToStep("maintenanceApproachLevel3");
        break;

      case "shopPriorities":
        goToStep("householdRole");
        break;

      case "householdRole":
        goToStep("decisionStyle");
        break;

      case "decisionStyle":
        goToStep("servicePriorities");
        break;

      case "servicePriorities":
        goToStep("complete");
        break;

      // Level 1 forward navigation
      case "carUsage":
        goToStep("shopType");
        break;
      case "shopType":
        if (level === 1) {
          goToStep("maintenanceFrustration");
        } else {
          goToStep("repairQuoteNeeds");
        }
        break;
      case "maintenanceFrustration":
        goToStep("maintenanceApproachLevel1");
        break;
      case "maintenanceApproachLevel1":
        goToStep("servicePriorities");
        break;
      case "maintenanceApproachLevel3":
        if (level === 1) {
          goToStep("servicePriorities");
        } else if (level === 3) {
          goToStep("shopPriorities");
        } else {
          goToStep("shopType");
        }
        break;

      // Level 2 forward navigation
      case "maintenanceTracking":
        goToStep("shopType");
        break;
      case "repairQuoteNeeds":
        if (level === 2) {
          goToStep("servicePriorities");
        } else {
          goToStep("complete");
        }
        break;

      default:
        break;
    }
  };

    // Navigate back to home screen when flow is complete
    useEffect(() => {
        if (currentStep === 'complete') {
            updateData({ isTellUsAboutYourselfComplete: true });
            if (isSignedIn) {
                updateProfile({ tellUsAboutCompleted: true })
                    .then(() => console.log('Tell Us About marked complete'))
                    .catch((err) => console.error('Failed to mark Tell Us About complete:', err));
            }
            router.back();
        }
    }, [currentStep, updateData]);

  const progressInfo = getProgressInfo();

  // Render the current step component
  const renderStep = () => {
    switch (currentStep) {
      case "experience":
        return (
          <ExperienceStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "carUsage":
        return (
          <CarUsageStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "servicePriorities":
        return (
          <ServicePrioritiesStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "maintenanceFrustration":
        return (
          <MaintenanceFrustrationStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "maintenanceTracking":
        return (
          <MaintenanceTrackingStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "shopType":
        return (
          <ShopTypeStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "repairQuoteNeeds":
        return (
          <RepairQuoteNeedsStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "serviceHistory":
        return (
          <ServiceHistoryStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "partsPhilosophy":
        return (
          <PartsPhilosophyStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "maintenanceApproachLevel1":
        return (
          <MaintenanceApproachStepLevel1
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "maintenanceApproachLevel3":
        return (
          <MaintenanceApproachStepLevel3
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "shopPriorities":
        return (
          <ShopPrioritiesStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "householdRole":
        return (
          <HouseholdRoleStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "decisionStyle":
        return (
          <DecisionStyleStep
            onNext={goNext}
            onBack={goBack}
            progress={{
              total: progressInfo.total,
              filled: progressInfo.filled - 1,
            }}
          />
        );
      case "complete":
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
          colors={LIGHT_PALETTE}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>{renderStep()}</View>
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
