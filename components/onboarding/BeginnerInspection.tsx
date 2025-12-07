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
 * TICKET: OTO-XXX
 */

import {
    BorderRadius,
    BrandColors,
    Button,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingOption, onboardingOptionStyles } from './OnboardingButton';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
// @ts-ignore - native date picker module is provided in the app bundle
import { DateTimePickerAndroid, type AndroidEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';

export function BeginnerInspection() {
    const insets = useSafeAreaInsets();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dontRemember, setDontRemember] = useState(false);
    const { updateData } = useOnboardingStore();

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing['2xl'] },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const handleDateChange = (_event: AndroidEvent, date?: Date) => {
        if (date) {
            setSelectedDate(date);
            setDontRemember(false);
        }
    };

    const openDatePicker = () => {
        DateTimePickerAndroid.open({
            value: selectedDate ?? new Date(),
            mode: 'date',
            onChange: handleDateChange,
        });
    };

    const handleDontRemember = () => {
        setDontRemember(true);
        setSelectedDate(null);
    };

    const handleNext = () => {
        if (!selectedDate && !dontRemember) return;

        const lastInspection = dontRemember
            ? 'dont_remember'
            : selectedDate?.toISOString() ?? null;

        updateData({ lastInspection });
        router.replace('/(main-tabs)');
    };

    const formattedDate = selectedDate
        ? selectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : 'January 2025';

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Header */}
            <View style={styles.headerContent}>
                <Text style={styles.title}>
                    When was your last New{'\n'}York State Inspection?
                </Text>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
                <Pressable
                    style={[
                        onboardingOptionStyles.option,
                        styles.dateOption,
                        selectedDate && !dontRemember ? styles.optionSelected : null,
                    ]}
                    onPress={openDatePicker}
                >
                    <Text
                        style={
                            selectedDate && !dontRemember
                                ? onboardingOptionStyles.optionTextSelected
                                : onboardingOptionStyles.optionText
                        }
                    >
                        {selectedDate ? formattedDate : 'January 2025'}
                    </Text>
                    <Calendar
                        size={FontSize.md}
                        color={
                            selectedDate && !dontRemember
                                ? BrandColors.secondary
                                : onboardingOptionStyles.optionText.color as string
                        }
                        strokeWidth={2.5}
                    />
                </Pressable>

                <OnboardingOption
                    label="I don't remember"
                    value="dont_remember"
                    selected={dontRemember}
                    onSelect={handleDontRemember}
                />
            </View>

            {/* Spacer to push button to bottom */}
            <View style={styles.spacer} />

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                <Button
                    fullWidth
                    size="lg"
                    borderRadius={BorderRadius.full}
                    paddingVertical={Spacing.lg}
                    onPress={handleNext}
                    disabled={!selectedDate && !dontRemember}
                >
                    Next
                </Button>
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
    dateOption: {
        borderColor: BrandColors.secondary,
    },
    optionSelected: {
        borderColor: BrandColors.secondary,
        backgroundColor: 'white',
    },
    spacer: {
        flex: 1,
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
    },
});

