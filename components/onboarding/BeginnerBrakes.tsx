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
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

type BrakeOption = 'recently' | 'not_recently' | 'dont_remember';

export function BeginnerBrakes() {
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
        router.push('/(onboarding)/beginner-inspection');
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <OnboardingProgress total={4} filled={2} />
            {/* Header */}
            <View style={styles.headerContent}>
                <Text style={styles.title}>
                    Have you had your brakes replaced recently?
                </Text>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
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
            <View style={styles.spacer} />

            {/* Bottom Button */}
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

