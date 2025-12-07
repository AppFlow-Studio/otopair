/**
 * OnboardingDatePicker
 *
 * PURPOSE: Reusable date picker row styled like onboarding options.
 *
 * USED IN: Onboarding flows where a month/year (or date) selection is needed.
 *
 * PROPS:
 *   - value (Date | null): Current selected date.
 *   - onChange ((date: Date) => void): Called when a date is picked.
 *   - placeholder (string): Text to show when no date is selected.
 *   - minimumDate/maximumDate (Date): Optional bounds for selection.
 *
 * EXAMPLE:
 *   <OnboardingDatePicker
 *     value={selectedDate}
 *     onChange={(d) => setSelectedDate(d)}
 *     placeholder="Select month & year"
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-010
 */

import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import {
    BrandColors,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { FontFamily } from '@/components/shared-ui';
import { onboardingOptionStyles } from './OnboardingButton';
import { Calendar } from 'lucide-react-native';
import DateTimePicker, {
    DateTimePickerAndroid,
    type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

interface OnboardingDatePickerProps {
    value: Date | null;
    onChange: (date: Date) => void;
    placeholder?: string;
    minimumDate?: Date;
    maximumDate?: Date;
}

export function OnboardingDatePicker({
    value,
    onChange,
    placeholder = 'Select month & year',
    minimumDate,
    maximumDate,
}: OnboardingDatePickerProps) {
    const [showIOSPicker, setShowIOSPicker] = useState(false);
    const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

    const normalized = (date: Date) => {
        const d = new Date(date);
        d.setDate(1); // normalize day since UI is month/year focused
        return d;
    };

    const handleAndroidChange = (_event: DateTimePickerEvent, date?: Date) => {
        if (date) {
            onChange(normalized(date));
        }
    };

    const openPicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: value ?? new Date(),
                mode: 'date',
                onChange: handleAndroidChange,
                minimumDate,
                maximumDate,
            });
        } else {
            setTempDate(value ?? new Date());
            setShowIOSPicker(true);
        }
    };

    const handleIOSChange = (_event: any, date?: Date) => {
        if (Platform.OS === 'ios' && date) {
            setTempDate(date);
        }
    };

    const handleIOSDone = () => {
        onChange(normalized(tempDate));
        setShowIOSPicker(false);
    };

    const handleIOSCancel = () => {
        setShowIOSPicker(false);
    };

    const formatted = value
        ? value.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : placeholder;

    const isSelected = Boolean(value);

    return (
        <>
            <Pressable
                style={[
                    onboardingOptionStyles.option,
                    styles.dateOption,
                    isSelected ? styles.optionSelected : null,
                ]}
                onPress={openPicker}
            >
                <Text
                    style={
                        isSelected
                            ? onboardingOptionStyles.optionTextSelected
                            : onboardingOptionStyles.optionText
                    }
                >
                    {formatted}
                </Text>
                <Calendar
                    size={FontSize.md}
                    color={
                        isSelected
                            ? BrandColors.secondary
                            : (onboardingOptionStyles.optionText.color as string)
                    }
                    strokeWidth={2.5}
                />
            </Pressable>

            {showIOSPicker && Platform.OS === 'ios' && (
                <View style={styles.iosPicker}>
                    <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="spinner"
                        themeVariant="light"
                        textColor={BrandColors.primary}
                        onChange={handleIOSChange}
                        minimumDate={minimumDate}
                        maximumDate={maximumDate}
                        style={styles.iosPickerControl}
                    />
                    <View style={styles.iosActions}>
                        <Pressable onPress={handleIOSCancel}>
                            <Text style={styles.iosActionText}>Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handleIOSDone}>
                            <Text style={[styles.iosActionText, styles.iosActionPrimary]}>Done</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    dateOption: {
        borderColor: '#f0f1f6',
        marginBottom: Spacing.sm,
    },
    optionSelected: {
        borderColor: BrandColors.secondary,
        backgroundColor: 'white',
    },
    iosPicker: {
        backgroundColor: 'white',
        borderRadius: Spacing.sm,
        marginBottom: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    iosPickerControl: {
        width: '100%',
    },
    iosActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    iosActionText: {
        fontSize: FontSize.md,
        color: BrandColors.primary,
    },
    iosActionPrimary: {
        color: BrandColors.secondary,
        fontFamily: FontFamily.semiBold,
    },
});


