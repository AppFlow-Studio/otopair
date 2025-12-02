import {
    BorderRadius,
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    Spacing,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import {
    StyleSheet,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { Text } from './Text';

// ============================================================================
// TYPES
// ============================================================================

export interface InputProps extends Omit<TextInputProps, 'style'> {
    /** Input label */
    label?: string;
    /** Helper text below input */
    helperText?: string;
    /** Error message */
    error?: string;
    /** Container style */
    containerStyle?: StyleProp<ViewStyle>;
    /** Input style */
    style?: StyleProp<TextStyle>;
    /** Left icon or element */
    leftElement?: React.ReactNode;
    /** Right icon or element */
    rightElement?: React.ReactNode;
    /** Full width input */
    fullWidth?: boolean;
    /** Disabled state */
    disabled?: boolean;
    /** Size preset */
    size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// SIZE PRESETS
// ============================================================================

const sizePresets = {
    sm: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        fontSize: FontSize.sm,
    },
    md: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: FontSize.md,
    },
    lg: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        fontSize: FontSize.lg,
    },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function Input({
    label,
    helperText,
    error,
    containerStyle,
    style,
    leftElement,
    rightElement,
    fullWidth = false,
    disabled = false,
    size = 'md',
    onFocus,
    onBlur,
    ...inputProps
}: InputProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const [isFocused, setIsFocused] = useState(false);

    const sizeStyles = sizePresets[size];

    const isDark = colorScheme === 'dark';
    const backgroundColor = isDark ? '#1E2329' : '#F5F7FA';
    const textColor = Colors[colorScheme].text;
    const placeholderColor = isDark ? '#6B7280' : '#9CA3AF';
    const borderColor = error
        ? '#EF4444'
        : isFocused
            ? BrandColors.secondary
            : 'transparent';

    const handleFocus = (e: any) => {
        setIsFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        onBlur?.(e);
    };

    return (
        <View style={[fullWidth && styles.fullWidth, containerStyle]}>
            {label && (
                <Text weight="medium" size="sm" style={styles.label}>
                    {label}
                </Text>
            )}

            <View
                style={[
                    styles.inputContainer,
                    {
                        backgroundColor,
                        borderColor,
                        paddingVertical: sizeStyles.paddingVertical,
                        paddingHorizontal: sizeStyles.paddingHorizontal,
                    },
                    disabled && styles.disabled,
                ]}
            >
                {leftElement && <View style={styles.leftElement}>{leftElement}</View>}

                <TextInput
                    style={[
                        styles.input,
                        {
                            color: textColor,
                            fontSize: sizeStyles.fontSize,
                            fontFamily: FontFamily.regular,
                        },
                        style,
                    ]}
                    placeholderTextColor={placeholderColor}
                    editable={!disabled}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    {...inputProps}
                />

                {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
            </View>

            {(helperText || error) && (
                <Text
                    size="xs"
                    color={error ? '#EF4444' : placeholderColor}
                    style={styles.helperText}
                >
                    {error || helperText}
                </Text>
            )}
        </View>
    );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/** Password input with toggle visibility */
export function PasswordInput(props: Omit<InputProps, 'secureTextEntry'>) {
    const [isSecure, setIsSecure] = useState(true);

    return (
        <Input
            secureTextEntry={isSecure}
            rightElement={
                <Text
                    color={BrandColors.secondary}
                    onPress={() => setIsSecure(!isSecure)}
                    size="sm"
                    weight="medium"
                >
                    {isSecure ? 'Show' : 'Hide'}
                </Text>
            }
            {...props}
        />
    );
}

/** Search input with search icon placeholder */
export function SearchInput(props: InputProps) {
    return (
        <Input
            placeholder="Search..."
            {...props}
        />
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    fullWidth: {
        width: '100%',
    },
    label: {
        marginBottom: Spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
    },
    input: {
        flex: 1,
        padding: 0,
        margin: 0,
    },
    leftElement: {
        marginRight: Spacing.sm,
    },
    rightElement: {
        marginLeft: Spacing.sm,
    },
    helperText: {
        marginTop: Spacing.xs,
    },
    disabled: {
        opacity: 0.5,
    },
});

