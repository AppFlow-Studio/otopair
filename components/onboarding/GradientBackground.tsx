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
import { ReactNode, useMemo } from 'react';
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
    start,
    end,
    children,
    style,
}: GradientBackgroundProps) {
    // Generate random gradient direction for each screen instance
    // This creates a shifting effect when navigating between screens
    const randomGradient = useMemo(() => {
        // Generate random values between 0 and 1 for start and end points
        // This creates varied gradient directions (diagonal, vertical, horizontal)
        const randomStart = {
            x: Math.random(),
            y: Math.random(),
        };
        
        // End point should be different from start to create a visible gradient
        // We'll ensure it's at least 0.3 away from start in at least one direction
        const randomEnd = {
            x: Math.max(0, Math.min(1, randomStart.x + (Math.random() - 0.5) * 0.6)),
            y: Math.max(0, Math.min(1, randomStart.y + (Math.random() - 0.5) * 0.6)),
        };
        
        // Ensure minimum distance for visible gradient
        const distance = Math.sqrt(
            Math.pow(randomEnd.x - randomStart.x, 2) + 
            Math.pow(randomEnd.y - randomStart.y, 2)
        );
        
        if (distance < 0.2) {
            // If too close, push end point further
            randomEnd.x = Math.max(0, Math.min(1, randomStart.x + (Math.random() > 0.5 ? 0.4 : -0.4)));
            randomEnd.y = Math.max(0, Math.min(1, randomStart.y + (Math.random() > 0.5 ? 0.4 : -0.4)));
        }
        
        return {
            start: randomStart,
            end: randomEnd,
        };
    }, []); // Empty dependency array = generate once per component instance

    // Use provided values if given, otherwise use randomized values
    const gradientStart = start ?? randomGradient.start;
    const gradientEnd = end ?? randomGradient.end;

    return (
        <LinearGradient
            colors={colors as [string, string, ...string[]]}
            start={gradientStart}
            end={gradientEnd}
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

