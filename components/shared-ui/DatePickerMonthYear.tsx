/**
 * DatePickerMonthYear
 *
 * PURPOSE: Reusable month/year picker styled like onboarding options.
 *
 * USED IN: Onboarding flows that need month/year input (e.g., oil change, inspection).
 *
 * PROPS:
 *   - value (Date | null): Current selected date (only month/year is used).
 *   - onChange ((date: Date) => void): Called with a normalized date (day set to 1).
 *   - placeholder (string): Text shown when no date is selected.
 *   - title (string): Modal title.
 *   - minimumDate/maximumDate (Date): Optional bounds.
 *
 * EXAMPLE:
 *   <DatePickerMonthYear
 *     value={selectedDate}
 *     onChange={(d) => setSelectedDate(d)}
 *     placeholder="Select month & year"
 *     minimumDate={new Date(2000, 0, 1)}
 *     maximumDate={new Date()}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-010
 */

import React, { useMemo, useState } from 'react';
import {
    View,
    TouchableOpacity,
    TextInput,
    Text,
    StyleSheet,
    Modal,
    Pressable,
} from 'react-native';
import { Calendar } from 'lucide-react-native';
import {
    BorderRadius,
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    Spacing,
} from '@/components/shared-ui';

const MONTHS = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
];

interface DatePickerMonthYearProps {
    value: Date | null;
    onChange: (date: Date) => void;
    placeholder?: string;
    title?: string;
    minimumDate?: Date;
    maximumDate?: Date;
}

export function DatePickerMonthYear({
    value,
    onChange,
    placeholder = 'Select month & year',
    title = 'Select month & year',
    minimumDate,
    maximumDate,
}: DatePickerMonthYearProps) {
    const [isPickerVisible, setPickerVisible] = useState(false);
    const [tempMonth, setTempMonth] = useState<number>(new Date().getMonth());
    const [tempYear, setTempYear] = useState<number>(new Date().getFullYear());

    const minYear = minimumDate ? minimumDate.getFullYear() : undefined;
    const maxYear = maximumDate ? maximumDate.getFullYear() : undefined;

    const formattedDate = useMemo(() => {
        return value
            ? value.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
            : '';
    }, [value]);

    const openPicker = () => {
        const base = value ?? new Date();
        setTempMonth(base.getMonth());
        setTempYear(base.getFullYear());
        setPickerVisible(true);
    };

    const applySelection = () => {
        let normalized = new Date(tempYear, tempMonth, 1);
        if (minimumDate && normalized < minimumDate) {
            normalized = minimumDate;
        }
        if (maximumDate && normalized > maximumDate) {
            normalized = maximumDate;
        }
        onChange(normalized);
        setPickerVisible(false);
    };

    const cancelSelection = () => {
        setPickerVisible(false);
    };

    const canStepDown = minYear === undefined || tempYear > minYear;
    const canStepUp = maxYear === undefined || tempYear < maxYear;

    return (
        <View>
            <TouchableOpacity onPress={openPicker}>
                <View style={[
                    styles.optionBase,
                    styles.optionMd,
                    styles.dateOption,
                    value ? styles.optionSelected : null,
                ]}>
                    <Text
                        style={
                            value
                                ? styles.optionTextSelectedMd
                                : styles.optionTextMd
                        }
                    >
                        {formattedDate || placeholder}
                    </Text>
                    <Calendar
                        size={FontSize.md}
                        color={
                            value
                                ? BrandColors.secondary
                                : '#687076'
                        }
                        strokeWidth={2.5}
                    />
                </View>
            </TouchableOpacity>

            <Modal
                transparent
                visible={isPickerVisible}
                animationType="fade"
                onRequestClose={cancelSelection}
            >
                <View style={styles.backdrop}>
                    <View style={styles.sheet}>
                        <Text style={styles.sheetTitle}>{title}</Text>

                        <View style={styles.yearRow}>
                            <Pressable
                                style={[styles.stepper, !canStepDown && styles.stepperDisabled]}
                                onPress={() => canStepDown && setTempYear((y) => y - 1)}
                            >
                                <Text style={styles.stepperText}>{'<'}</Text>
                            </Pressable>
                            <Text style={styles.yearText}>{tempYear}</Text>
                            <Pressable
                                style={[styles.stepper, !canStepUp && styles.stepperDisabled]}
                                onPress={() => canStepUp && setTempYear((y) => y + 1)}
                            >
                                <Text style={styles.stepperText}>{'>'}</Text>
                            </Pressable>
                        </View>

                        <View style={styles.monthGrid}>
                            {MONTHS.map((m, idx) => {
                                const isSelected = idx === tempMonth;
                                return (
                                    <Pressable
                                        key={m}
                                        style={[styles.monthCell, isSelected && styles.monthCellSelected]}
                                        onPress={() => setTempMonth(idx)}
                                    >
                                        <Text style={[styles.monthText, isSelected && styles.monthTextSelected]}>
                                            {m.slice(0, 3)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={styles.actions}>
                            <Pressable onPress={cancelSelection} style={styles.actionBtn}>
                                <Text style={styles.actionText}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={applySelection} style={[styles.actionBtn, styles.primaryBtn]}>
                                <Text style={[styles.actionText, styles.primaryText]}>Done</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    optionBase: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#e4e8f1',
        borderWidth: 2,
        borderColor: '#f0f1f6',
    },
    optionMd: {
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
    },
    optionSelected: {
        borderColor: BrandColors.secondary,
        backgroundColor: 'white',
    },
    optionTextMd: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.light.icon,
    },
    optionTextSelectedMd: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.primary,
    },
    dateOption: {
        borderColor: '#f0f1f6',
        marginBottom: Spacing.sm,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    sheet: {
        width: '100%',
        borderRadius: 12,
        backgroundColor: 'white',
        padding: 16,
        gap: 12,
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        fontFamily: FontFamily.semiBold,
    },
    yearRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    yearText: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: FontFamily.bold,
    },
    stepper: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#eef1f6',
    },
    stepperDisabled: {
        opacity: 0.4,
    },
    stepperText: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: FontFamily.semiBold,
    },
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    monthCell: {
        width: '30%',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#d7dce7',
        alignItems: 'center',
    },
    monthCellSelected: {
        borderColor: '#5299FE',
        backgroundColor: '#eaf2ff',
    },
    monthText: {
        fontSize: 14,
        color: '#111',
        fontFamily: FontFamily.regular,
    },
    monthTextSelected: {
        color: '#246BFE',
        fontWeight: '700',
        fontFamily: FontFamily.semiBold,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    actionBtn: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#eef1f6',
    },
    primaryBtn: {
        backgroundColor: '#5299FE',
    },
    actionText: {
        fontSize: 14,
        color: '#111',
        fontFamily: FontFamily.regular,
    },
    primaryText: {
        color: 'white',
        fontWeight: '700',
        fontFamily: FontFamily.semiBold,
    },
});


