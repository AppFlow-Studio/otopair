/**
 * CarExperienceScreen
 *
 * PURPOSE: Ask the user about their car experience level (Beginner/Average/Professional)
 *          and route them to the appropriate onboarding path based on their selection.
 *
 * USED IN: app/(onboarding)/car-experience.tsx
 *
 * PROPS:
 *   - None (self-contained screen component)
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-011
 */

// TODO: Remove color hardcoding once theme.ts is updated
// TODO: Remove console.log statements


import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingOption } from './OnboardingButton';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { OnboardingScreenLayout } from './OnboardingScreenLayout';

type ExperienceLevel = 'beginner' | 'average' | 'professional';

// Map UI values to store values (1-5 scale)
const experienceToLevel: Record<ExperienceLevel, 1 | 3 | 5> = {
    beginner: 1,
    average: 3,
    professional: 5,
};

export function CarExperienceSlide() {
    
    const [selected, setSelected] = useState<ExperienceLevel | null>(null);

    // Get store actions
    const { updateData, completeStep, setStep } = useOnboardingStore();

    useEffect(() => {
        setStep('car_knowledge');
        //console.log('onboarding currentStep', useOnboardingStore.getState().currentStep);
        //console.log('completed steps', useOnboardingStore.getState().completedSteps);
    }, [setStep]);

    const handleNext = () => {
        if (!selected) return;

        // Save selection to store
        updateData({ carKnowledgeLevel: experienceToLevel[selected] });

        // Navigate based on experience level
        switch (selected) {
            case 'beginner':
                router.push('/(onboarding)/beginner-oil-change');
                break;
            case 'average':
                router.push('/(onboarding)/average-oil-change');
                break;
            case 'professional':
                // TODO: Create professional flow
                router.push('/(onboarding)/pro-services');
                break;
        }
    };

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingProgress total={1} filled={0} leftElement={<OnboardingBackButton />} />
                    {/* Header */}
                    <View style={[styles.headerContent, layout.headerContent]}>
                        <Text style={[styles.title, layout.title]}>
                            How would you explain your experience with cars in general?
                        </Text>
                    </View>

                    {/* Options */}
                    <View
                        style={[styles.optionsContainer, layout.optionsContainer]}
                    >
                        <OnboardingOption
                            label="Beginner"
                            value="beginner"
                            selected={selected === 'beginner'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="Average"
                            value="average"
                            selected={selected === 'average'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="Professional"
                            value="professional"
                            selected={selected === 'professional'}
                            onSelect={setSelected}
                        />
                    </View>

                    {/* Spacer to push button to bottom */}
                    <View style={[styles.spacer, layout.spacer]} />

                    {/* Bottom Button */}
                    <View
                        style={[styles.bottomContainer, layout.bottomContainer]}
                    >
                        <OnboardingFooterButton
                            label="Next"
                            onPress={handleNext}
                            disabled={!selected}
                            size={layout.buttonSize}
                            paddingVertical={layout.buttonPaddingVertical}
                        />
                    </View>
                </>
            )}
        </OnboardingScreenLayout>
    );
}

const styles = StyleSheet.create({
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        marginTop: Spacing['2xl'],
        marginBottom: Spacing['3xl'],
    },
    title: {
        lineHeight: 40,
        letterSpacing: -0.5,
        fontSize: FontSize['3xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
    },
    optionsContainer: {
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.md,
    },
    spacer: {
        flex: 1,
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
    },
});
