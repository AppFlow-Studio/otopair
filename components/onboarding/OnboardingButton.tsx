/**
 * OnboardingButton
 *
 * PURPOSE: Shared onboarding option button styling and renderer for selection lists.
 *
 * USED IN: Onboarding slides (e.g., CarExperienceSlide, OilChangeSlide)
 *
 * PROPS:
 *   - label (string): Text to display
 *   - value (T): Value passed to onSelect
 *   - selected (boolean): Whether this option is active
 *   - onSelect ((value: T) => void): Callback when pressed
 *
 * EXAMPLE:
 *   <OnboardingOption
 *     label="Beginner"
 *     value="beginner"
 *     selected={selected === 'beginner'}
 *     onSelect={setSelected}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-011
 */

import {
    BorderRadius,
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

type OptionValue = string | number;

interface OnboardingOptionProps<T extends OptionValue> {
    label: string;
    value: T;
    selected: boolean;
    onSelect: (value: T) => void;
}

export function OnboardingOption<T extends OptionValue>({
    label,
    value,
    selected,
    onSelect,
}: OnboardingOptionProps<T>) {
    return (
        <Pressable
            style={[onboardingOptionStyles.option, selected && onboardingOptionStyles.optionSelected]}
            onPress={() => onSelect(value)}
        >
            <Text style={selected ? onboardingOptionStyles.optionTextSelected : onboardingOptionStyles.optionText}>
                {label}
            </Text>
            <Check
                size={FontSize.xl}
                color={selected ? BrandColors.secondary : Colors.light.icon}
                strokeWidth={2.5}
            />
        </Pressable>
    );
}

export const onboardingOptionStyles = StyleSheet.create({
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#e4e8f1',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionSelected: {
        borderColor: BrandColors.secondary,
        backgroundColor: 'white',
    },
    optionText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.light.icon,
    },
    optionTextSelected: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.primary,
    },
});

