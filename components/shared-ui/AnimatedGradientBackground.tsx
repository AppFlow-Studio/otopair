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
 *
 * EXAMPLE:
 *   <AnimatedGradientBackground progress={animationProgress} fromIndex={0} toIndex={1} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useCallback } from 'react';
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
    { startX: 0, startY: 0, endX: 0.4, endY: 0.6, colors: DEFAULT_GRADIENT_COLORS },      // Index 0
    { startX: 0, startY: 0.1, endX: 0.2, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },    // Index 1
    { startX: 0.5, startY: 0.2, endX: 0.7, endY: 0.9, colors: DEFAULT_GRADIENT_COLORS },  // Index 2
    { startX: 0.7, startY: 0, endX: 0.2, endY: 0.5, colors: DEFAULT_GRADIENT_COLORS },    // Index 3
    { startX: 0.3, startY: 0.2, endX: 0.5, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },  // Index 4
    { startX: 0.4, startY: 0.3, endX: 0.6, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },  // Index 5
    { startX: 0.6, startY: 0.1, endX: 0.3, endY: 0.9, colors: DEFAULT_GRADIENT_COLORS },  // Index 6
    { startX: 0.2, startY: 0.2, endX: 0.8, endY: 1, colors: DEFAULT_GRADIENT_COLORS },    // Index 7
    { startX: 0.1, startY: 0.3, endX: 0.5, endY: 0.7, colors: DEFAULT_GRADIENT_COLORS },  // Index 8
    { startX: 0.5, startY: 0.1, endX: 0.4, endY: 0.8, colors: DEFAULT_GRADIENT_COLORS },  // Index 9
    { startX: 0.3, startY: 0.0, endX: 0.6, endY: 0.9, colors: DEFAULT_GRADIENT_COLORS },  // Index 10
    { startX: 0.2, startY: 0.2, endX: 0.8, endY: 1, colors: DEFAULT_GRADIENT_COLORS },    // Index 11
];

interface AnimatedGradientBackgroundProps {
    progress: SharedValue<number>;
    fromIndex: number;
    toIndex: number;
    colors?: [string, string, string];
}

export function AnimatedGradientBackground({ 
    progress, 
    fromIndex, 
    toIndex,
    colors
}: AnimatedGradientBackgroundProps) {
    // Ensure we stay within bounds of the config array
    const safeFrom = Math.min(Math.max(0, fromIndex), SHARED_GRADIENT_CONFIGS.length - 1);
    const safeTo = Math.min(Math.max(0, toIndex), SHARED_GRADIENT_CONFIGS.length - 1);
    
    const fromConfig = { ...SHARED_GRADIENT_CONFIGS[safeFrom] };
    const toConfig = { ...SHARED_GRADIENT_CONFIGS[safeTo] };
    
    // Override colors if provided
    if (colors) {
        fromConfig.colors = colors;
        toConfig.colors = colors;
    }
    
    // State for current gradient positions (interpolated during animation)
    const [gradientPos, setGradientPos] = useState({
        startX: fromConfig.startX,
        startY: fromConfig.startY,
        endX: fromConfig.endX,
        endY: fromConfig.endY,
    });
    
    // Callback to update positions from the UI thread via runOnJS
    const updatePositions = useCallback((p: number) => {
        setGradientPos({
            startX: interpolate(p, [0, 1], [fromConfig.startX, toConfig.startX]),
            startY: interpolate(p, [0, 1], [fromConfig.startY, toConfig.startY]),
            endX: interpolate(p, [0, 1], [fromConfig.endX, toConfig.endX]),
            endY: interpolate(p, [0, 1], [fromConfig.endY, toConfig.endY]),
        });
    }, [fromConfig, toConfig]);
    
    // React to animation progress changes
    useAnimatedReaction(
        () => progress.value,
        (currentValue) => {
            runOnJS(updatePositions)(currentValue);
        },
        [updatePositions]
    );
    
    return (
        <LinearGradient
            colors={toConfig.colors}
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

