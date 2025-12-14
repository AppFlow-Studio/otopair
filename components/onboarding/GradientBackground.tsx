/**
 * GradientBackground
 *
 * PURPOSE: Reusable gradient background component using LinearGradient.
 *
 * USED IN: Onboarding screens that need gradient backgrounds (e.g., PhoneNumber)
 *
 * PROPS:
 *   - colors (string[]): Array of color values for the gradient
 *   - start (object): Starting point of gradient { x: 0-1, y: 0-1 }
 *   - end (object): Ending point of gradient { x: 0-1, y: 0-1 }
 *   - children (ReactNode): Content to render inside the gradient
 *   - style (ViewStyle): Optional custom styles
 *
 * EXAMPLE:
 *   <GradientBackground
 *     colors={['#1E3A5F', '#0F1E3A', '#050A14']}
 *     start={{ x: 0, y: 0 }}
 *     end={{ x: 0, y: 1 }}
 *   >
 *     <YourContent />
 *   </GradientBackground>
 */

import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BrandColors } from '@/components/shared-ui';

export interface GradientBackgroundProps {
    /** Array of color values for the gradient */
    colors?: string[];
    /** Starting point of gradient (0-1 range) */
    start?: { x: number; y: number };
    /** Ending point of gradient (0-1 range) */
    end?: { x: number; y: number };
    /** Content to render inside the gradient */
    children: ReactNode;
    /** Optional custom styles */
    style?: StyleProp<ViewStyle>;
}

const defaultColors = [BrandColors.secondary, '#1d2c46ff', '#050A14'] as const;

export function GradientBackground({
    colors = [...defaultColors],
    start = { x: 0, y: 0 },
    end = { x: 0, y: 1 },
    children,
    style,
}: GradientBackgroundProps) {
    return (
        <LinearGradient
            colors={colors as [string, string, ...string[]]}
            start={start}
            end={end}
            style={[styles.gradient, style]}
        >
            {children}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
});

