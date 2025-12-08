/**
 * OnboardingScreenLayout
 *
 * PURPOSE: Shared responsive layout wrapper for onboarding slides to reduce
 * redundant spacing/sizing logic and keep buttons visible on compact screens.
 *
 * USED IN: All onboarding screens (except WelcomeSlide)
 *
 * PROPS:
 *   - children: render prop receiving layout tokens for styling slots
 *
 * EXAMPLE:
 *   <OnboardingScreenLayout>
 *     {(layout) => (
 *       <View style={[styles.section, layout.optionsContainer]}>...</View>
 *     )}
 *   </OnboardingScreenLayout>
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

import { ReactNode } from 'react';
import {
    StyleSheet,
    View,
    useWindowDimensions,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Spacing } from '@/components/shared-ui';

type ButtonSize = 'md' | 'lg';

export type OnboardingLayoutConfig = {
    isCompact: boolean;
    isLarge: boolean;
    container: ViewStyle;
    headerContent: ViewStyle;
    title: TextStyle;
    optionsContainer: ViewStyle;
    datePickerWrapper: ViewStyle;
    spacer: ViewStyle;
    bottomContainer: ViewStyle;
    buttonSize: ButtonSize;
    buttonPaddingVertical: number;
};

interface OnboardingScreenLayoutProps {
    children: (layout: OnboardingLayoutConfig) => ReactNode;
}

export function OnboardingScreenLayout({
    children,
}: OnboardingScreenLayoutProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const isCompact = height < 720;
    const isLarge = height >= 900;

    const layout: OnboardingLayoutConfig = {
        isCompact,
        isLarge,
        container: {
            paddingTop: insets.top + (isCompact ? Spacing.sm : isLarge ? Spacing.md : Spacing.sm),
            paddingBottom: insets.bottom + (isCompact ? Spacing.md : Spacing.lg),
        },
        headerContent: {
            marginTop: isCompact ? Spacing.lg : isLarge ? Spacing['2xl'] : Spacing.md,
            marginBottom: isCompact ? Spacing.xl : isLarge ? Spacing['3xl'] : Spacing['3xl'],
            paddingHorizontal: isCompact ? Spacing.xl : isLarge ? Spacing['3xl'] : Spacing['2xl'],
        },
        title: {
            fontSize: isCompact ? FontSize['2xl'] : isLarge ? FontSize['4xl'] : FontSize['3xl'],
            lineHeight: isCompact ? 32 : isLarge ? 44 : 40,
        },
        optionsContainer: {
            gap: isCompact ? Spacing.sm : isLarge ? Spacing.lg : Spacing.md,
            paddingHorizontal: isCompact ? Spacing.xl : isLarge ? Spacing['3xl'] : Spacing['2xl'],
        },
        datePickerWrapper: {
            marginBottom: isCompact ? Spacing.xl : isLarge ? Spacing['4xl'] : Spacing['3xl'],
        },
        spacer: {
            flex: isCompact ? 0.4 : isLarge ? 0.8 : 1,
        },
        bottomContainer: {
            paddingTop: isCompact ? Spacing.xs : isLarge ? Spacing.md : Spacing.sm,
            paddingHorizontal: isCompact ? Spacing.xl : isLarge ? Spacing['3xl'] : Spacing['2xl'],
        },
        buttonSize: isCompact ? 'md' : 'lg',
        buttonPaddingVertical: isCompact ? Spacing.sm : isLarge ? Spacing['2xl'] : Spacing.lg,
    };

    return (
        <View style={[styles.screen, layout.container]}>
            {children(layout)}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dee2ee',
    },
});

