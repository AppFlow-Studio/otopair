import {
    ButtonStyles,
    FontFamily,
    type ButtonVariant
} from '@/constants/theme';
import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    type PressableProps,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { Text } from './Text';

// ============================================================================
// TYPES
// ============================================================================

export interface ButtonProps extends Omit<PressableProps, 'style'> {
    /** Button variant: 'primary' | 'secondary' | 'ghost' */
    variant?: ButtonVariant;
    /** Button label text */
    children: string;
    /** Custom container style */
    style?: StyleProp<ViewStyle>;
    /** Custom text style */
    textStyle?: StyleProp<TextStyle>;
    /** Full width button */
    fullWidth?: boolean;
    /** Disabled state */
    disabled?: boolean;
    /** Loading state */
    loading?: boolean;
    /** Custom background color (overrides variant) */
    backgroundColor?: string;
    /** Custom text color (overrides variant) */
    textColor?: string;
    /** Custom border radius (overrides variant) */
    borderRadius?: number;
    /** Custom padding vertical */
    paddingVertical?: number;
    /** Custom padding horizontal */
    paddingHorizontal?: number;
    /** Size preset */
    size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// SIZE PRESETS
// ============================================================================

const sizePresets = {
    sm: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    md: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    lg: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        fontSize: 18,
    },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function Button({
    variant = 'primary',
    children,
    style,
    textStyle,
    fullWidth = false,
    disabled = false,
    loading = false,
    backgroundColor,
    textColor,
    borderRadius,
    paddingVertical,
    paddingHorizontal,
    size = 'md',
    ...pressableProps
}: ButtonProps) {
    const variantStyles = ButtonStyles[variant];
    const sizeStyles = sizePresets[size];

    // Determine final styles with overrides
    const finalBackgroundColor = backgroundColor ?? variantStyles.backgroundColor;
    const finalTextColor = textColor ?? variantStyles.textColor;
    const finalBorderRadius = borderRadius ?? variantStyles.borderRadius;
    const finalPaddingVertical = paddingVertical ?? sizeStyles.paddingVertical;
    const finalPaddingHorizontal = paddingHorizontal ?? sizeStyles.paddingHorizontal;

    const isSecondary = variant === 'secondary';
    const borderStyles = isSecondary
        ? {
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth,
        }
        : {};

    return (
        <Pressable
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                {
                    backgroundColor: finalBackgroundColor,
                    borderRadius: finalBorderRadius,
                    paddingVertical: finalPaddingVertical,
                    paddingHorizontal: finalPaddingHorizontal,
                    opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
                },
                borderStyles,
                fullWidth && styles.fullWidth,
                style,
            ]}
            {...pressableProps}
        >
            {loading ? (
                <ActivityIndicator color={finalTextColor} size="small" />
            ) : (
                <Text
                    style={[
                        styles.text,
                        {
                            color: finalTextColor,
                            fontSize: sizeStyles.fontSize,
                        },
                        textStyle,
                    ]}
                    weight="semiBold"
                >
                    {children}
                </Text>
            )}
        </Pressable>
    );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/** Primary button with dark background and white text */
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
    return <Button variant="primary" {...props} />;
}

/** Secondary button with border and blue text */
export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
    return <Button variant="secondary" {...props} />;
}

/** Ghost button with no background */
export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
    return <Button variant="ghost" {...props} />;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    text: {
        fontFamily: FontFamily.semiBold,
        textAlign: 'center',
    },
});

