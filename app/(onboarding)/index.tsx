import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { OnboardingFlow, OnboardingStep } from '@/components/onboarding/OnboardingFlow';
import { api } from '@/convex/_generated/api';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import {
    buildOnboardingResumeData,
    getSavedOnboardingCurrentStep,
    getDevicePermissionState,
    getIncompleteOnboardingStepsFromResumeData,
    RESUMABLE_STEPS,
} from '@/lib/onboarding-resume';
import { BrandColors } from '@/constants/theme';

export default function OnboardingScreen() {
    const { isLoaded, isSignedIn, userId: clerkUserId } = useAuth();
    const params = useLocalSearchParams<{
        initialStep?: string;
        filteredSteps?: string;
        isResumeMode?: string;
    }>();
    const rawMe = useQuery(api.users.getMe, isLoaded && isSignedIn ? undefined : 'skip');
    const me =
        rawMe === undefined
            ? undefined
            : rawMe === null
                ? null
                : rawMe.clerkUserId === clerkUserId
                    ? rawMe
                    : undefined;
    const rawOnboardingQa = useQuery(
        api.onboarding_questions_answers.getMyQuestionsAndAnswers,
        me ? undefined : 'skip',
    );
    const onboardingQa =
        me === null
            ? null
            : rawOnboardingQa === undefined
            ? undefined
            : rawOnboardingQa === null
                ? null
                : me && rawOnboardingQa.user_id === me._id
                    ? rawOnboardingQa
                    : undefined;
    const updateOnboardingData = useOnboardingStore((state) => state.updateData);
    const resetOnboardingData = useOnboardingStore((state) => state.reset);

    const isResumeMode = params.isResumeMode === 'true';
    const hasExplicitResumeTarget = !!params.initialStep || !!params.filteredSteps;
    const shouldAutoResumeSignedInEntryRef = useRef<boolean | null>(null);
    if (isLoaded && shouldAutoResumeSignedInEntryRef.current === null) {
        shouldAutoResumeSignedInEntryRef.current = !hasExplicitResumeTarget && isSignedIn === true;
    }
    // Auto-resume when index.tsx sends isResumeMode, and also when a signed-in
    // user initially lands on the onboarding group without params. Freezing the
    // signed-in fallback on entry prevents a normal signup flow from switching
    // into auto-resume after Clerk creates the session.
    const isAutoResume =
        !hasExplicitResumeTarget &&
        (isResumeMode || shouldAutoResumeSignedInEntryRef.current === true);

    const [autoResumeStep, setAutoResumeStep] = useState<OnboardingStep | null>(null);
    const [autoResumeFiltered, setAutoResumeFiltered] = useState<OnboardingStep[] | undefined>(undefined);
    // Not ready until auto-resume computation finishes; immediately ready for non-auto-resume.
    const [autoResumeReady, setAutoResumeReady] = useState(!isAutoResume);

    useEffect(() => {
        console.log('[onboarding-resume:screen] route params/state', {
            params,
            isLoaded,
            isSignedIn,
            clerkUserId,
            rawMeState: rawMe === undefined ? 'loading' : rawMe === null ? 'null' : 'loaded',
            meState: me === undefined ? 'loading' : me === null ? 'null' : 'loaded',
            rawOnboardingQaState:
                rawOnboardingQa === undefined ? 'loading' : rawOnboardingQa === null ? 'null' : 'loaded',
            onboardingQaState:
                onboardingQa === undefined ? 'loading' : onboardingQa === null ? 'null' : 'loaded',
            isResumeMode,
            hasExplicitResumeTarget,
            shouldAutoResumeSignedInEntry: shouldAutoResumeSignedInEntryRef.current,
            isAutoResume,
            autoResumeReady,
        });
    }, [
        autoResumeReady,
        clerkUserId,
        hasExplicitResumeTarget,
        isAutoResume,
        isLoaded,
        isResumeMode,
        isSignedIn,
        me,
        onboardingQa,
        params,
        rawMe,
        rawOnboardingQa,
    ]);

    useEffect(() => {
        if (isAutoResume) {
            setAutoResumeReady(false);
            setAutoResumeStep(null);
            setAutoResumeFiltered(undefined);
            return;
        }

        setAutoResumeReady(true);
    }, [isAutoResume]);

    useEffect(() => {
        if (!isLoaded || isSignedIn) return;
        resetOnboardingData();
    }, [isLoaded, isSignedIn, resetOnboardingData]);

    // Auto-resume: wait for Convex data, compute first incomplete step, hydrate store.
    useEffect(() => {
        if (!isAutoResume) return;
        // Wait for both queries to finish loading (undefined = still in flight)
        if (me === undefined || onboardingQa === undefined) return;

        let cancelled = false;

        const resolve = async () => {
            const resumeData = buildOnboardingResumeData(me, onboardingQa);
            const devicePermissions = await getDevicePermissionState();
            if (cancelled) return;

            updateOnboardingData({
                authProvider: resumeData.authProvider,
                email: resumeData.email,
                emailConfirmed: resumeData.emailConfirmed,
                firstName: resumeData.firstName,
                lastName: resumeData.lastName,
                phoneNumber: resumeData.phoneNumber,
                phoneVerified: resumeData.phoneVerified,
                profilePhotoUri: resumeData.profilePhotoUri,
                userIntentions: resumeData.userIntentions,
                heardAboutOtopair: resumeData.heardAboutOtopair,
                visitReason: resumeData.visitReason,
                zipCode: resumeData.zipCode,
                pushNotificationStatus: devicePermissions.pushNotificationStatus,
                pushNotificationsGranted:
                    devicePermissions.pushNotificationStatus === 'granted' ||
                    devicePermissions.pushNotificationStatus === 'provisional',
                locationPermissionStatus: devicePermissions.locationPermissionStatus,
                locationGranted: devicePermissions.locationPermissionStatus === 'granted',
            });

            const incompleteSteps = getIncompleteOnboardingStepsFromResumeData(resumeData, devicePermissions);
            const savedStep = await getSavedOnboardingCurrentStep(clerkUserId, incompleteSteps);

            if (cancelled) return;

            const savedStepIsResumable =
                typeof savedStep === 'string' && (RESUMABLE_STEPS as Set<string>).has(savedStep);

            if (incompleteSteps.length === 0 && !savedStepIsResumable) {
                // All data-steps are complete — nothing left to do, go home
                console.log('[onboarding-resume:screen] navigating home: no incomplete or saved step', {
                    savedStep,
                    incompleteSteps,
                    clerkUserId,
                    convexUserId: me?._id,
                });
                router.replace('/(main-tabs)/home');
                return;
            }

            // If the saved step is still in the incomplete list, resume there.
            // Otherwise fall back to the first incomplete step from data-completeness.
            const startStep = savedStepIsResumable
                ? (savedStep as OnboardingStep)
                : incompleteSteps[0];
            const filteredSteps =
                savedStepIsResumable && !incompleteSteps.includes(savedStep as OnboardingStep)
                    ? [savedStep as OnboardingStep, ...incompleteSteps]
                    : incompleteSteps;

            console.log('[onboarding-resume:screen] resolved auto-resume step', {
                savedStep,
                savedStepIsResumable,
                startStep,
                incompleteSteps,
                filteredSteps,
                devicePermissions,
                resumeData: {
                    authProvider: resumeData.authProvider,
                    hasEmail: !!resumeData.email,
                    emailConfirmed: resumeData.emailConfirmed,
                    hasFirstName: !!resumeData.firstName,
                    hasLastName: !!resumeData.lastName,
                    hasPhoneNumber: !!resumeData.phoneNumber,
                    phoneVerified: resumeData.phoneVerified,
                    hasProfilePhotoUri: !!resumeData.profilePhotoUri,
                    hasUserIntentions: !!resumeData.userIntentions?.length,
                    hasHeardAboutOtopair: !!resumeData.heardAboutOtopair,
                    hasVisitReason: !!resumeData.visitReason,
                    hasZipCode: !!resumeData.zipCode,
                },
                clerkUserId,
                convexUserId: me?._id,
            });

            setAutoResumeStep(startStep);
            setAutoResumeFiltered(undefined);
            setAutoResumeReady(true);
        };

        resolve().catch((error) => {
            console.error('Failed to resolve auto-resume step:', error);
            if (!cancelled) {
                // Fall back to the phone step (first post-auth step) so the user
                // is never stuck on a blank screen.
                setAutoResumeStep('phone');
                setAutoResumeFiltered(undefined);
                setAutoResumeReady(true);
            }
        });

        return () => { cancelled = true; };
    }, [clerkUserId, isAutoResume, me, onboardingQa, updateOnboardingData]);

    // Normal mode (explicit params or fresh start): hydrate store from Convex in background.
    useEffect(() => {
        if (isAutoResume) return; // auto-resume handles its own hydration above
        let cancelled = false;

        const hydrateFromConvex = async () => {
            if (!me) return;

            const resumeData = buildOnboardingResumeData(me, onboardingQa);
            const devicePermissions = await getDevicePermissionState();
            if (cancelled) return;
            const currentData = useOnboardingStore.getState().data;

            updateOnboardingData({
                authProvider: resumeData.authProvider ?? currentData.authProvider,
                email: resumeData.email ?? currentData.email,
                emailConfirmed: resumeData.emailConfirmed || currentData.emailConfirmed,
                firstName: resumeData.firstName ?? currentData.firstName,
                lastName: resumeData.lastName ?? currentData.lastName,
                phoneNumber: resumeData.phoneNumber ?? currentData.phoneNumber,
                phoneVerified: resumeData.phoneVerified || currentData.phoneVerified,
                profilePhotoUri: resumeData.profilePhotoUri ?? currentData.profilePhotoUri,
                userIntentions: resumeData.userIntentions ?? currentData.userIntentions,
                heardAboutOtopair: resumeData.heardAboutOtopair ?? currentData.heardAboutOtopair,
                visitReason: resumeData.visitReason ?? currentData.visitReason,
                zipCode: resumeData.zipCode ?? currentData.zipCode,
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

        return () => { cancelled = true; };
    }, [isAutoResume, me, onboardingQa, updateOnboardingData]);

    if (!autoResumeReady) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={BrandColors.white} />
            </View>
        );
    }

    // For auto-resume, use computed step/filter and isResumeMode=false so completion
    // calls router.replace("/(main-tabs)/home") rather than router.back().
    const resolvedInitialStep = autoResumeStep ?? ((params.initialStep as OnboardingStep) || 'signup');
    const resolvedFilteredSteps = autoResumeFiltered ?? (
        params.filteredSteps ? JSON.parse(params.filteredSteps) as OnboardingStep[] : undefined
    );
    const resolvedIsResumeMode = isAutoResume ? false : isResumeMode;

    return (
        <OnboardingFlow
            initialStep={resolvedInitialStep}
            filteredSteps={resolvedFilteredSteps}
            isResumeMode={resolvedIsResumeMode}
            disableBack={isAutoResume}
        />
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BrandColors.primary,
    },
});
