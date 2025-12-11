/**
 * OilChangeScreen
 *
 * PURPOSE: Ask average users about their last oil change
 *
 * USED IN: app/(onboarding)/oil-change.tsx
 *
 * PATH: Average flow only
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

// TODO: Remove color hardcoding once theme.ts is updated

import {
    BorderRadius,
    BrandColors,
    Button,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingOption } from './OnboardingButton';
import { OnboardingDatePickerMonthYear } from './OnboardingDatePickerMonthYear';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OnboardingScreenLayout } from './OnboardingScreenLayout';

type OilChangeOption = 'last_3_months' | '3_6_months' | '6_plus_months' | 'dont_remember';

export function AverageOilChange() {
    const [selected, setSelected] = useState<OilChangeOption | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const { updateData, completeStep } = useOnboardingStore();

    const handleNext = () => {
        if (!selected && !selectedDate) return;

        // Save selection to store
        if (selected) {
            updateData({ lastOilChange: selected });
        } else if (selectedDate) {
            updateData({ lastOilChange: selectedDate.toISOString() });
        }

        // Navigate to next step or main app
        router.push('/(onboarding)/average-tire');
    };

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        setSelected(null); // ensure mutual exclusivity
    };

    return (
        <OnboardingScreenLayout>
            {(layout) => (
                <>
                    <OnboardingProgress total={6} filled={1} leftElement={<OnboardingBackButton />} />
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
                        <View
                            style={[
                                styles.datePickerWrapper,
                                layout.datePickerWrapper,
                            ]}
                        >
                            <OnboardingDatePickerMonthYear
                                value={selectedDate}
                                onChange={handleDateChange}
                                placeholder="Select month & year"
                                minimumDate={new Date(2000, 0, 1)}
                                maximumDate={new Date()}
                            />
                        </View>

                        <OnboardingOption
                            label="Last 3 months"
                            value="last_3_months"
                            selected={selected === 'last_3_months'}
                            onSelect={(value) => {
                                setSelected(value);
                                setSelectedDate(null); // clear date when preset selected
                            }}
                        />
                        <OnboardingOption
                            label="3–6 months ago"
                            value="3_6_months"
                            selected={selected === '3_6_months'}
                            onSelect={(value) => {
                                setSelected(value);
                                setSelectedDate(null);
                            }}
                        />
                        <OnboardingOption
                            label="6+ months ago"
                            value="6_plus_months"
                            selected={selected === '6_plus_months'}
                            onSelect={(value) => {
                                setSelected(value);
                                setSelectedDate(null);
                            }}
                        />
                        <OnboardingOption
                            label="I don't remember"
                            value="dont_remember"
                            selected={selected === 'dont_remember'}
                            onSelect={(value) => {
                                setSelected(value);
                                setSelectedDate(null);
                            }}
                        />
                    </View>

                    {/* Spacer to push button to bottom */}
                    <View style={[styles.spacer, layout.spacer]} />

                    {/* Bottom Button */}
                    <View
                        style={[styles.bottomContainer, layout.bottomContainer]}
                    >
                        <Button
                            fullWidth
                            size={layout.buttonSize}
                            borderRadius={BorderRadius.full}
                            paddingVertical={layout.buttonPaddingVertical}
                            onPress={handleNext}
                            disabled={!selected && !selectedDate}
                        >
                            Next
                        </Button>
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
    datePickerWrapper: {
        marginBottom: Spacing['3xl'],
    },
    spacer: {
        flex: 1,
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
    },
});
