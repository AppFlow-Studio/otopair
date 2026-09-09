import {
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    type FontSizeKey
} from '@/constants/theme';
import { resolveThemeColorScheme } from '@/constants/themeColorScheme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import {
    Text as RNText,
    type TextProps as RNTextProps,
    type StyleProp,
    type TextStyle
} from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export type TextVariant =
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'body'
    | 'bodyBold'
    | 'caption'
    | 'small'
    | 'xsmall'
    | 'label';

export interface TextProps extends RNTextProps {
    /** Semantic style preset. Sets defaults for size+weight; explicit
     *  size/weight props still win if also supplied. */
    variant?: TextVariant;
    /** Font weight preset */
    weight?: 'light' | 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold';
    /** Font size preset or custom number */
    size?: FontSizeKey | number;
    /** Text color (defaults to theme text color) */
    color?: string;
    /** Use light color in dark mode, dark color in light mode */
    lightColor?: string;
    darkColor?: string;
    /** Center text */
    center?: boolean;
    /** Italic text */
    italic?: boolean;
    /** Custom line height multiplier */
    lineHeight?: number;
    /** Custom letter spacing */
    letterSpacing?: number;
    /** Uppercase text */
    uppercase?: boolean;
    /** Custom style */
    style?: StyleProp<TextStyle>;
}

const variantDefaults: Record<
    TextVariant,
    { size: FontSizeKey; weight: NonNullable<TextProps['weight']> }
> = {
    h1: { size: '4xl', weight: 'bold' },
    h2: { size: '3xl', weight: 'bold' },
    h3: { size: '2xl', weight: 'semiBold' },
    h4: { size: 'xl', weight: 'semiBold' },
    body: { size: 'md', weight: 'regular' },
    bodyBold: { size: 'md', weight: 'bold' },
    caption: { size: 'sm', weight: 'regular' },
    small: { size: 'sm', weight: 'regular' },
    xsmall: { size: 'xs', weight: 'regular' },
    label: { size: 'sm', weight: 'medium' },
};

// ============================================================================
// WEIGHT MAPPING
// ============================================================================

const weightToFamily: Record<NonNullable<TextProps['weight']>, string> = {
    light: FontFamily.light,
    regular: FontFamily.regular,
    medium: FontFamily.medium,
    semiBold: FontFamily.semiBold,
    bold: FontFamily.bold,
    extraBold: FontFamily.extraBold,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function Text({
    variant,
    weight,
    size,
    color,
    lightColor,
    darkColor,
    center = false,
    italic = false,
    lineHeight,
    letterSpacing,
    uppercase = false,
    style,
    children,
    ...textProps
}: TextProps) {
    const colorScheme = resolveThemeColorScheme(useColorScheme());

    // Variant sets defaults; explicit size/weight props override.
    const resolvedSize = size ?? (variant ? variantDefaults[variant].size : 'md');
    const resolvedWeight = weight ?? (variant ? variantDefaults[variant].weight : 'regular');

    // Determine font family
    const fontFamily = italic ? FontFamily.italic : weightToFamily[resolvedWeight];

    // Determine font size
    const fontSize = typeof resolvedSize === 'number' ? resolvedSize : FontSize[resolvedSize];

    // Determine text color
    let textColor = color;
    if (!textColor) {
        if (lightColor && darkColor) {
            textColor = colorScheme === 'dark' ? darkColor : lightColor;
        } else {
            textColor = Colors[colorScheme].text;
        }
    }

    // Calculate line height
    const calculatedLineHeight = lineHeight
        ? fontSize * lineHeight
        : fontSize * 1.5;

    return (
        <RNText
            style={[
                {
                    fontFamily,
                    fontSize,
                    color: textColor,
                    lineHeight: calculatedLineHeight,
                    letterSpacing,
                    textAlign: center ? 'center' : undefined,
                    textTransform: uppercase ? 'uppercase' : undefined,
                },
                style,
            ]}
            {...textProps}
        >
            {children}
        </RNText>
    );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/** Heading 1 - Extra large bold text */
export function H1(props: Omit<TextProps, 'size' | 'weight'>) {
    return <Text size="4xl" weight="bold" {...props} />;
}

/** Heading 2 - Large bold text */
export function H2(props: Omit<TextProps, 'size' | 'weight'>) {
    return <Text size="3xl" weight="bold" {...props} />;
}

/** Heading 3 - Medium-large bold text */
export function H3(props: Omit<TextProps, 'size' | 'weight'>) {
    return <Text size="2xl" weight="semiBold" {...props} />;
}

/** Heading 4 - Medium semibold text */
export function H4(props: Omit<TextProps, 'size' | 'weight'>) {
    return <Text size="xl" weight="semiBold" {...props} />;
}

/** Body text - Regular paragraph text */
export function Body(props: Omit<TextProps, 'size' | 'weight'>) {
    return <Text size="md" weight="regular" {...props} />;
}

/** Small text - Caption or helper text */
export function Small(props: Omit<TextProps, 'size'>) {
    return <Text size="sm" {...props} />;
}

/** Extra small text - Fine print */
export function XSmall(props: Omit<TextProps, 'size'>) {
    return <Text size="xs" {...props} />;
}

/** Label text - Form labels with medium weight */
export function Label(props: Omit<TextProps, 'size' | 'weight'>) {
    return <Text size="sm" weight="medium" {...props} />;
}

/** Link text - Blue colored clickable text */
export function LinkText(props: Omit<TextProps, 'color'>) {
    return <Text color={BrandColors.secondary} {...props} />;
}

