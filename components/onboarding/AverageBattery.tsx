
/**
 * Average Battery Replacement Screen
 *
 * PURPOSE: Ask average users about their last battery replacement
 *
 * USED IN: app/(onboarding)/average-battery.tsx
 *
 * PATH: Average flow only
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

// TODO: Remove color hardcoding once theme.ts is updated

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

type BatteryOption = 'within_last_year' | 'more_than_year_ago' | 'dont_remember';

export function AverageBattery() {
    const [selected, setSelected] = useState<BatteryOption | null>(null);
    const { updateData } = useOnboardingStore();

    const handleNext = () => {
        if (!selected) return;
        updateData({ lastBatteryReplacement: selected });
        router.push('/(onboarding)/average-brakes');
    };

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingProgress total={6} filled={3} leftElement={<OnboardingBackButton />} />

                    <View style={[styles.headerContent, layout.headerContent]}>
                        <Text style={[styles.title, layout.title]}>
                            Has your battery been{'\n'}replaced recently?
                        </Text>
                    </View>

                    <View
                        style={[styles.optionsContainer, layout.optionsContainer]}
                    >
                        <OnboardingOption
                            label="Within the last year"
                            value="within_last_year"
                            selected={selected === 'within_last_year'}
                            onSelect={setSelected}
                        />
                        <OnboardingOption
                            label="More than a year ago"
                            value="more_than_year_ago"
                            selected={selected === 'more_than_year_ago'}
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


