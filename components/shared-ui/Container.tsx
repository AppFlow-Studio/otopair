import { Colors, Spacing, type SpacingKey } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import {
    StyleSheet,
    View,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ============================================================================
// TYPES
// ============================================================================

export interface ContainerProps extends ViewProps {
    /** Use SafeAreaView instead of regular View */
    safe?: boolean;
    /** Padding preset or custom number */
    padding?: SpacingKey | number;
    /** Horizontal padding only */
    paddingHorizontal?: SpacingKey | number;
    /** Vertical padding only */
    paddingVertical?: SpacingKey | number;
    /** Background color (defaults to theme background) */
    backgroundColor?: string;
    /** Use light color in dark mode, dark color in light mode */
    lightColor?: string;
    darkColor?: string;
    /** Flex value */
    flex?: number;
    /** Center content */
    center?: boolean;
    /** Gap between children */
    gap?: SpacingKey | number;
    /** Row direction */
    row?: boolean;
    /** Custom style */
    style?: StyleProp<ViewStyle>;
}

// ============================================================================
// HELPERS
// ============================================================================

function resolveSpacing(value: SpacingKey | number | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return value;
    return Spacing[value];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Container({
    safe = false,
    padding,
    paddingHorizontal,
    paddingVertical,
    backgroundColor,
    lightColor,
    darkColor,
    flex,
    center = false,
    gap,
    row = false,
    style,
    children,
    ...viewProps
}: ContainerProps) {
    const colorScheme = useColorScheme() ?? 'light';

    // Determine background color
    let bgColor = backgroundColor;
    if (!bgColor) {
        if (lightColor && darkColor) {
            bgColor = colorScheme === 'dark' ? darkColor : lightColor;
        } else {
            bgColor = Colors[colorScheme].background;
        }
    }

    const resolvedPadding = resolveSpacing(padding);
    const resolvedPaddingH = resolveSpacing(paddingHorizontal);
    const resolvedPaddingV = resolveSpacing(paddingVertical);
    const resolvedGap = resolveSpacing(gap);

    const containerStyle: ViewStyle = {
        backgroundColor: bgColor,
        flex,
        padding: resolvedPadding,
        paddingHorizontal: resolvedPaddingH,
        paddingVertical: resolvedPaddingV,
        gap: resolvedGap,
        flexDirection: row ? 'row' : 'column',
        ...(center && {
            alignItems: 'center',
            justifyContent: 'center',
        }),
    };

    const Wrapper = safe ? SafeAreaView : View;

    return (
        <Wrapper style={[containerStyle, style]} {...viewProps}>
            {children}
        </Wrapper>
    );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/** Screen container with safe area and full flex */
export function ScreenContainer(props: Omit<ContainerProps, 'safe' | 'flex'>) {
    return <Container safe flex={1} {...props} />;
}

/** Card container with padding and rounded corners */
export function Card({
    style,
    ...props
}: Omit<ContainerProps, 'padding'> & { padding?: SpacingKey | number }) {
    const colorScheme = useColorScheme() ?? 'light';

    return (
        <Container
            padding="lg"
            backgroundColor={colorScheme === 'dark' ? '#1E2329' : '#FFFFFF'}
            style={[styles.card, style]}
            {...props}
        />
    );
}

/** Row container for horizontal layout */
export function Row(props: Omit<ContainerProps, 'row'>) {
    return <Container row {...props} />;
}

/** Spacer component for adding space between elements */
export function Spacer({ size = 'md' }: { size?: SpacingKey | number }) {
    const height = typeof size === 'number' ? size : Spacing[size];
    return <View style={{ height }} />;
}

/** Horizontal spacer for row layouts */
export function HSpacer({ size = 'md' }: { size?: SpacingKey | number }) {
    const width = typeof size === 'number' ? size : Spacing[size];
    return <View style={{ width }} />;
}

/** Divider line */
export function Divider({
    color,
    thickness = 1,
    marginVertical,
}: {
    color?: string;
    thickness?: number;
    marginVertical?: SpacingKey | number;
}) {
    const colorScheme = useColorScheme() ?? 'light';
    const dividerColor = color ?? (colorScheme === 'dark' ? '#2D3339' : '#E5E7EB');
    const margin = resolveSpacing(marginVertical);

    return (
        <View
            style={{
                height: thickness,
                backgroundColor: dividerColor,
                marginVertical: margin,
                width: '100%',
            }}
        />
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
});

