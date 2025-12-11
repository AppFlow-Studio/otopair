/**
 * BeginnerBrakes
 *
 * PURPOSE: Ask beginner users if they've recently replaced their brakes.
 *
 * USED IN: app/(onboarding)/beginner-brakes.tsx
 *
 * PROPS:
 *   - None (self-contained screen component)
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
import { OnboardingBackButton } from './OnboardingBackButton';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { OnboardingScreenLayout } from './OnboardingScreenLayout';

type BrakeOption = 'recently' | 'not_recently' | 'dont_remember';

export function BeginnerBrakes() {
    const [selected, setSelected] = useState<BrakeOption | null>(null);
    const { updateData } = useOnboardingStore();

    const handleNext = () => {
        if (!selected) return;
        updateData({ brakesReplaced: selected });
        router.push('/(onboarding)/beginner-inspection');
    };

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingProgress total={4} filled={2} leftElement={<OnboardingBackButton />} />
                    {/* Header */}
                    <View style={[styles.headerContent, layout.headerContent]}>
                        <Text style={[styles.title, layout.title]}>
                            Have you had your brakes replaced recently?
                        </Text>
                    </View>

                    {/* Options */}
                    <View
                        style={[styles.optionsContainer, layout.optionsContainer]}
                    >
                        <OnboardingOption
                            label="Yes"
                            value="recently"
                            selected={selected === 'recently'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="No"
                            value="not_recently"
                            selected={selected === 'not_recently'}
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

