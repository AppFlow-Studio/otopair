/**
 * BeginnerInspection
 *
 * PURPOSE: Ask beginner users when their last New York State inspection was.
 *
 * USED IN: app/(onboarding)/beginner-inspection.tsx (to wire)
 *
 * PROPS:
 *   - None (self-contained screen component)
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
import { OnboardingOption, onboardingOptionStyles } from './OnboardingButton';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingDatePickerMonthYear } from './OnboardingDatePickerMonthYear';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { OnboardingScreenLayout } from './OnboardingScreenLayout';

export function ProBrakes() {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dontRemember, setDontRemember] = useState(false);
    const { updateData } = useOnboardingStore(); 

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        setDontRemember(false);
    };

    const handleDontRemember = () => {
        setDontRemember(true);
        setSelectedDate(null);
    };

    const handleNext = () => {
        if (!selectedDate && !dontRemember) return;

        const brakesReplaced = dontRemember
            ? 'dont_remember'
            : selectedDate?.toISOString() ?? null;

        updateData({ brakesReplaced });
        router.push('/(onboarding)/pro-inspection');
    };

    const formattedDate = selectedDate
        ? selectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : 'Select month & year';

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingProgress total={5} filled={3} />
                    {/* Header */}
                    <View style={[styles.headerContent, layout.headerContent]}>
                        <Text style={[styles.title, layout.title]}>
                            When were your brakes last replaced?
                        </Text>
                    </View>

                    {/* Options */}
                    <View
                        style={[styles.optionsContainer, layout.optionsContainer]}
                    >
                        <OnboardingDatePickerMonthYear
                            value={selectedDate}
                            onChange={handleDateChange}
                            placeholder="Select month & year"
                            minimumDate={new Date(2000, 0, 1)}
                            maximumDate={new Date()}
                        />

                        <OnboardingOption
                            label="I don't remember"
                            value="dont_remember"
                            selected={dontRemember}
                            onSelect={handleDontRemember}
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
                            disabled={!selectedDate && !dontRemember}
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

