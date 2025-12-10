
/**
 * AverageBrakes
 *
 * PURPOSE: Ask average users about their last brakes replacement
 *
 * USED IN: app/(onboarding)/average-brakes.tsx
 *
 * PATH: Average flow only
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingOption } from './OnboardingButton';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OnboardingScreenLayout } from './OnboardingScreenLayout';

type BrakeOption = 'lt_1_year' | '1_2_years' | '2_plus_years' | 'dont_remember';

export function AverageBrakes() {
    const [selected, setSelected] = useState<BrakeOption | null>(null);
    const { updateData } = useOnboardingStore();

    const handleNext = () => {
        if (!selected) return;
        updateData({ brakesReplaced: selected });
        router.push('/(onboarding)/average-inspection');
    };

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingBackButton />
                    <OnboardingProgress total={6} filled={4} />

                    <View style={[styles.headerContent, layout.headerContent]}>
                        <Text style={[styles.title, layout.title]}>
                            When were your brakes{'\n'}last replaced?
                        </Text>
                    </View>

                    <View
                        style={[styles.optionsContainer, layout.optionsContainer]}
                    >
                        <OnboardingOption
                            label="<1 year ago"
                            value="lt_1_year"
                            selected={selected === 'lt_1_year'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="1–2 years ago"
                            value="1_2_years"
                            selected={selected === '1_2_years'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="2+ years ago"
                            value="2_plus_years"
                            selected={selected === '2_plus_years'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="I don't remember"
                            value="dont_remember"
                            selected={selected === 'dont_remember'}
                            onSelect={setSelected}
                        />
                    </View>

                    <View style={[styles.spacer, layout.spacer]} />

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
        lineHeight: 32,
        letterSpacing: -0.5,
        fontSize: FontSize['2xl'],
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


