/**
 * OilChangeScreen
 *
 * PURPOSE: Ask beginner users about their last oil change
 *
 * USED IN: app/(onboarding)/oil-change.tsx
 *
 * PATH: Beginner flow only
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

// TODO: Remove color hardcoding once theme.ts is updated
// TODO: Create dashed component animation at top of screen to fill during onboarding progression

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
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OnboardingScreenLayout } from './OnboardingScreenLayout';
import { OnboardingBackButton } from './OnboardingBackButton';

type OilChangeOption = 'last_3_months' | '3_6_months' | '6_plus_months' | 'dont_remember';

export function BeginnerOilChange() {
    const [selected, setSelected] = useState<OilChangeOption | null>(null);

    const { updateData, completeStep } = useOnboardingStore();

    const handleNext = () => {
        if (!selected) return;

        // Save selection to store
        updateData({ lastOilChange: selected });

        // Navigate to next step or main app
        router.push('/(onboarding)/beginner-brakes');
    };

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingProgress total={4} filled={1} leftElement={<OnboardingBackButton />} />
                    {/* Header */}
                    <View style={[styles.headerContent, layout.headerContent]}>
                        <Text style={[styles.title, layout.title]}>
                            When was your last oil change?
                        </Text>
                    </View>

                    {/* Options */}
                    <View
                        style={[styles.optionsContainer, layout.optionsContainer]}
                    >
                        <OnboardingOption
                            label="Last 3 months"
                            value="last_3_months"
                            selected={selected === 'last_3_months'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="3–6 months ago"
                            value="3_6_months"
                            selected={selected === '3_6_months'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="6+ months ago"
                            value="6_plus_months"
                            selected={selected === '6_plus_months'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="I don't remember"
                            value="dont_remember"
                            selected={selected === 'dont_remember'}
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
