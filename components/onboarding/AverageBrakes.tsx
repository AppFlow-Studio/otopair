
/**
 * AverageTire
 *
 * PURPOSE: Ask average users about their last tire service
 *
 * USED IN: app/(onboarding)/average-tire.tsx
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
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BrakeOption = 'lt_1_year' | '1_2_years' | '2_plus_years' | 'dont_remember';

export function AverageBrakes() {
    const insets = useSafeAreaInsets();
    const [selected, setSelected] = useState<BrakeOption | null>(null);
    const { updateData } = useOnboardingStore();

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing['2xl'] },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const handleNext = () => {
        if (!selected) return;
        updateData({ brakesReplaced: selected });
        router.push('/(onboarding)/average-inspection');
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <OnboardingProgress total={6} filled={4} />

            <View style={styles.headerContent}>
                <Text style={styles.title}>
                    When were your brakes{'\n'}last replaced?
                </Text>
            </View>

            <View style={styles.optionsContainer}>
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

            <View style={styles.spacer} />

            <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                <OnboardingFooterButton
                    label="Next"
                    onPress={handleNext}
                    disabled={!selected}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dee2ee',
    },
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


