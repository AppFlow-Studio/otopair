/**
 * SolidProgressBar
 *
 * PURPOSE: Render a solid progress bar with customizable fill based on current/max values.
 *
 * USED IN: PaymentsScreen (Rewards section), and anywhere a continuous progress indicator is needed.
 *
 * PROPS:
 *   - current (number): Current progress value.
 *   - max (number): Maximum progress value.
 *   - height (number): Height of the progress bar [default: 8].
 *   - filledColor (string): Color for the filled portion [default: '#60A5FA'].
 *   - unfilledColor (string): Color for the unfilled portion [default: 'rgba(255,255,255,0.2)'].
 *   - borderRadius (number): Border radius of the bar [default: 4].
 *
 * EXAMPLE:
 *   <SolidProgressBar current={420} max={500} />
 *   <SolidProgressBar current={75} max={100} filledColor="#10B981" height={12} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface SolidProgressBarProps {
    current: number;
    max: number;
    height?: number;
    filledColor?: string;
    unfilledColor?: string;
    borderRadius?: number;
    style?: ViewStyle;
}

export function SolidProgressBar({
    current,
    max,
    height = 8,
    filledColor = '#60A5FA',
    unfilledColor = 'rgba(255,255,255,0.2)',
    borderRadius = 4,
    style,
}: SolidProgressBarProps) {
    const progress = Math.min(Math.max(current / max, 0), 1); // Clamp between 0 and 1

    return (
        <View 
            style={[
                styles.container, 
                { height, borderRadius, backgroundColor: unfilledColor },
                style,
            ]}
        >
            <View
                style={[
                    styles.filled,
                    {
                        width: `${progress * 100}%`,
                        height,
                        borderRadius,
                        backgroundColor: filledColor,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        overflow: 'hidden',
    },
    filled: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
});

export default SolidProgressBar;

