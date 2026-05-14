import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { OnboardingFlow, OnboardingStep } from '@/components/onboarding/OnboardingFlow';
import { api } from '@/convex/_generated/api';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import {
    buildOnboardingResumeData,
    getDevicePermissionState,
} from '@/lib/onboarding-resume';

export default function OnboardingScreen() {
    const params = useLocalSearchParams<{
        initialStep?: string;
        filteredSteps?: string;
        isResumeMode?: string;
    }>();
    const me = useQuery(api.users.getMe);
    const onboardingQa = useQuery(api.onboarding_questions_answers.getMyQuestionsAndAnswers);
    const updateOnboardingData = useOnboardingStore((state) => state.updateData);

    // Parse filtered steps from route params if provided
    const filteredSteps = params.filteredSteps 
        ? JSON.parse(params.filteredSteps) as OnboardingStep[]
        : undefined;
    
    const initialStep = (params.initialStep as OnboardingStep) || 'signup';
    const isResumeMode = params.isResumeMode === 'true';

    useEffect(() => {
        let cancelled = false;

        const hydrateFromConvex = async () => {
            if (!me) return;

            const resumeData = buildOnboardingResumeData(me, onboardingQa);
            const devicePermissions = await getDevicePermissionState();
            if (cancelled) return;

            updateOnboardingData({
                ...resumeData,
                pushNotificationStatus: devicePermissions.pushNotificationStatus,
                pushNotificationsGranted:
                    devicePermissions.pushNotificationStatus === 'granted' ||
                    devicePermissions.pushNotificationStatus === 'provisional',
                locationPermissionStatus: devicePermissions.locationPermissionStatus,
                locationGranted: devicePermissions.locationPermissionStatus === 'granted',
            });
        };

        hydrateFromConvex().catch((error) => {
            console.error('Failed to hydrate onboarding resume state:', error);
        });

        return () => {
            cancelled = true;
        };
    }, [me, onboardingQa, updateOnboardingData]);

    return (
        <OnboardingFlow 
            initialStep={initialStep}
            filteredSteps={filteredSteps}
            isResumeMode={isResumeMode}
        />
    );
}
