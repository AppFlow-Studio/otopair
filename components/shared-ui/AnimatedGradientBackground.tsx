/**
 * AnimatedGradientBackground
 *
 * PURPOSE: Shared animated gradient background used across onboarding and tell-us-about flows.
 *          Handles the physical movement of gradient coordinates based on index transitions.
 *
 * USED IN: OnboardingFlow.tsx, TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - progress (SharedValue<number>): Animation progress from 0 to 1
 *   - fromIndex (number): The starting configuration index
 *   - toIndex (number): The target configuration index
 *   - colors (optional string[]): Custom gradient colors (minimum 2 colors). If not provided, uses colors from config.
 *
 * EXAMPLE:
 *   <AnimatedGradientBackground progress={animationProgress} fromIndex={0} toIndex={1} />
 *   <AnimatedGradientBackground progress={animationProgress} fromIndex={0} toIndex={1} colors={['#FF0000', '#00FF00']} />
 *   <AnimatedGradientBackground progress={animationProgress} fromIndex={0} toIndex={1} colors={['#FF0000', '#00FF00', '#0000FF', '#FFFF00']} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
    interpolate,
    runOnJS,
    useAnimatedReaction,
    type SharedValue,
} from 'react-native-reanimated';
import { BrandColors } from '@/constants/theme';

// Default gradient colors used across all steps
const DEFAULT_GRADIENT_COLORS: [string, string, string] = [
    '#203f7dff',
    BrandColors.secondary,
    '#203f7dff',
];

export interface GradientConfig {
    colors: [string, string, string];
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

/**
 * Shared gradient configurations indexed by number.
 * Caller determines which index maps to which logical step.
 */
export const SHARED_GRADIENT_CONFIGS: GradientConfig[] = [
    { startX: 0, startY: 0, endX: 0.4, endY: 0.5, colors: DEFAULT_GRADIENT_COLORS },      // Index 0
    { startX: 0, startY: 0.1, endX: 0.2, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },    // Index 1
    { startX: 0.5, startY: 0.2, endX: 0.7, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },  // Index 2
    { startX: 0.7, startY: 0, endX: 0.2, endY: 0.5, colors: DEFAULT_GRADIENT_COLORS },    // Index 3
    { startX: 0.3, startY: 0.2, endX: 0.5, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },  // Index 4
    { startX: 0.4, startY: 0.3, endX: 0.6, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },  // Index 5
    { startX: 0.6, startY: 0.1, endX: 0.3, endY: 0.83, colors: DEFAULT_GRADIENT_COLORS },  // Index 6
    { startX: 0.2, startY: 0.2, endX: 0.8, endY: 1, colors: DEFAULT_GRADIENT_COLORS },    // Index 7
    { startX: 0.1, startY: 0.3, endX: 0.5, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },  // Index 8
    { startX: 0.5, startY: 0.1, endX: 0.4, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },  // Index 9
    { startX: 0.3, startY: 0.0, endX: 0.6, endY: 0.9, colors: DEFAULT_GRADIENT_COLORS },  // Index 10
    { startX: 0.2, startY: 0.2, endX: 0.8, endY: 1, colors: DEFAULT_GRADIENT_COLORS },    // Index 11
    { startX: 0.7, startY: 0.1, endX: 0.3, endY: 0.9, colors: DEFAULT_GRADIENT_COLORS },    // Index 12
    { startX: 0.1, startY: 0.6, endX: 0.9, endY: 0.4, colors: DEFAULT_GRADIENT_COLORS },    // Index 13
    { startX: 0.8, startY: 0.3, endX: 0.2, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },    // Index 14
    { startX: 0.4, startY: 0.0, endX: 0.6, endY: 1.0, colors: DEFAULT_GRADIENT_COLORS },    // Index 15
    { startX: 0.0, startY: 0.5, endX: 1.0, endY: 0.5, colors: DEFAULT_GRADIENT_COLORS },    // Index 16
    { startX: 0.5, startY: 0.2, endX: 0.5, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },    // Index 17
    // Light/white-appearing configurations - spread gradient widely to emphasize middle color
    { startX: 0.0, startY: 0.0, endX: 1.0, endY: 1.0, colors: DEFAULT_GRADIENT_COLORS },    // Index 18 - Full diagonal spread
    { startX: 0.2, startY: 0.0, endX: 0.8, endY: 1.0, colors: DEFAULT_GRADIENT_COLORS },    // Index 19 - Wide vertical spread
    { startX: 0.0, startY: 0.3, endX: 1.0, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },    // Index 20 - Horizontal spread with vertical offset
    // Solid color configurations - use minimal gradient span to show single color
    { startX: 0.5, startY: 0.5, endX: 0.5001, endY: 0.5001, colors: DEFAULT_GRADIENT_COLORS },    // Index 21 - All white (minimal gradient shows middle color)
    { startX: 0.0, startY: 0.0, endX: 0.0001, endY: 0.0001, colors: DEFAULT_GRADIENT_COLORS },    // Index 22 - All blue (minimal gradient at edge shows first blue color)
];

interface AnimatedGradientBackgroundProps {
    progress: SharedValue<number>;
    fromIndex?: number;
    toIndex?: number;
    fromIndexSV?: SharedValue<number>;
    toIndexSV?: SharedValue<number>;
    colors?: string[]; // Minimum 2 colors required
}

export function AnimatedGradientBackground({ 
    progress, 
    fromIndex,
    toIndex,
    fromIndexSV,
    toIndexSV,
    colors
}: AnimatedGradientBackgroundProps) {
    const safeFrom = useMemo(() => {
        const base = fromIndex ?? 0;
        return Math.min(Math.max(0, base), SHARED_GRADIENT_CONFIGS.length - 1);
    }, [fromIndex]);
    const safeTo = useMemo(() => {
        const base = toIndex ?? 1;
        return Math.min(Math.max(0, base), SHARED_GRADIENT_CONFIGS.length - 1);
    }, [toIndex]);

    const gradientColors = useMemo(() => {
        if (colors) {
            if (colors.length < 2) {
                console.warn('AnimatedGradientBackground: colors array must have at least 2 colors. Falling back to default colors.');
                return SHARED_GRADIENT_CONFIGS[safeTo].colors;
            }
            return colors;
        }
        return SHARED_GRADIENT_CONFIGS[safeTo].colors;
    }, [colors, safeTo]);

    const [gradientPos, setGradientPos] = useState(() => {
        const fromConfig = SHARED_GRADIENT_CONFIGS[safeFrom];
        return {
            startX: fromConfig.startX,
            startY: fromConfig.startY,
            endX: fromConfig.endX,
            endY: fromConfig.endY,
        };
    });

    const updatePositions = useCallback((p: number, fromIdx: number, toIdx: number) => {
        const fromConfig = SHARED_GRADIENT_CONFIGS[fromIdx];
        const toConfig = SHARED_GRADIENT_CONFIGS[toIdx];
        setGradientPos({
            startX: interpolate(p, [0, 1], [fromConfig.startX, toConfig.startX]),
            startY: interpolate(p, [0, 1], [fromConfig.startY, toConfig.startY]),
            endX: interpolate(p, [0, 1], [fromConfig.endX, toConfig.endX]),
            endY: interpolate(p, [0, 1], [fromConfig.endY, toConfig.endY]),
        });
    }, []);

    useAnimatedReaction(
        () => {
            const rawFrom = fromIndexSV ? fromIndexSV.value : safeFrom;
            const rawTo = toIndexSV ? toIndexSV.value : safeTo;
            const fromIdx = Math.min(Math.max(0, rawFrom), SHARED_GRADIENT_CONFIGS.length - 1);
            const toIdx = Math.min(Math.max(0, rawTo), SHARED_GRADIENT_CONFIGS.length - 1);
            return { p: progress.value, fromIdx, toIdx };
        },
        (state) => {
            runOnJS(updatePositions)(state.p, state.fromIdx, state.toIdx);
        },
        [safeFrom, safeTo, fromIndexSV, toIndexSV]
    );

    return (
        <LinearGradient
            colors={gradientColors as [string, string, ...string[]]}
            start={{ x: gradientPos.startX, y: gradientPos.startY }}
            end={{ x: gradientPos.endX, y: gradientPos.endY }}
            style={styles.gradient}
        />
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
});

