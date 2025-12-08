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
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

type OptionValue = string | number;

interface OnboardingOptionProps<T extends OptionValue> {
    label: string;
    value: T;
    selected: boolean;
    onSelect: (value: T) => void;
    size?: 'sm' | 'md';
    style?: StyleProp<ViewStyle>;
}

export function OnboardingOption<T extends OptionValue>({
    label,
    value,
    selected,
    onSelect,
    size = 'md',
    style,
}: OnboardingOptionProps<T>) {
    const paddingStyle =
        size === 'sm'
            ? onboardingOptionStyles.optionSm
            : onboardingOptionStyles.optionMd;
    const textStyle =
        size === 'sm'
            ? onboardingOptionStyles.optionTextSm
            : onboardingOptionStyles.optionTextMd;
    const textSelectedStyle =
        size === 'sm'
            ? onboardingOptionStyles.optionTextSelectedSm
            : onboardingOptionStyles.optionTextSelectedMd;
    const iconSize = size === 'sm' ? FontSize.lg : FontSize.xl;

    return (
        <Pressable
            style={[
                onboardingOptionStyles.optionBase,
                paddingStyle,
                selected && onboardingOptionStyles.optionSelected,
                style,
            ]}
            onPress={() => onSelect(value)}
        >
            <Text style={selected ? textSelectedStyle : textStyle}>
                {label}
            </Text>
            <Check
                size={iconSize}
                color={selected ? BrandColors.secondary : Colors.light.icon}
                strokeWidth={2.5}
            />
        </Pressable>
    );
}

export const onboardingOptionStyles = StyleSheet.create({
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
    optionSm: {
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignSelf: 'flex-start',
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
    optionTextSm: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        color: Colors.light.icon,
    },
    optionTextSelectedSm: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.primary,
    },
});

