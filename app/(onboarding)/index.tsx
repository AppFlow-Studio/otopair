import { useLocalSearchParams } from 'expo-router';
import { OnboardingFlow, OnboardingStep } from '@/components/onboarding/OnboardingFlow';

export default function OnboardingScreen() {
    const params = useLocalSearchParams<{
        initialStep?: string;
        filteredSteps?: string;
        isResumeMode?: string;
    }>();

    // Parse filtered steps from route params if provided
    const filteredSteps = params.filteredSteps 
        ? JSON.parse(params.filteredSteps) as OnboardingStep[]
        : undefined;
    
    const initialStep = (params.initialStep as OnboardingStep) || 'welcome';
    const isResumeMode = params.isResumeMode === 'true';

    return (
        <OnboardingFlow 
            initialStep={initialStep}
            filteredSteps={filteredSteps}
            isResumeMode={isResumeMode}
        />
    );
}
