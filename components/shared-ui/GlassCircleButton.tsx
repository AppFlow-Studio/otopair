/**
 * GlassCircleButton
 * 
 * A reusable button component that uses advanced SVG techniques to create a 
 * 3D "glass bubble" effect. It simulates varying light thickness and depth 
 * using layered gradients.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

interface GlassCircleButtonProps {
    size?: number;
    strokeWidth?: number;
    onPress?: () => void;
    children?: React.ReactNode;
    style?: ViewStyle;
    /** Screen-reader label — the icon children are decorative SVG */
    accessibilityLabel?: string;
}

export function GlassCircleButton({
    size = 40,
    strokeWidth = 2,
    onPress,
    children,
    style,
    accessibilityLabel,
}: GlassCircleButtonProps) {
    const center = size / 2;
    const radius = (size / 2) - strokeWidth / 2;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            style={[styles.container, { width: size, height: size }, style]}
        >
            <View style={StyleSheet.absoluteFill}>
                <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <Defs>
                        {/* Rim Highlight: Bright top-left, fades to transparent bottom-right */}
                        <LinearGradient id="rimGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="white" stopOpacity="0.9" />
                            <Stop offset="40%" stopColor="white" stopOpacity="0.4" />
                            <Stop offset="100%" stopColor="white" stopOpacity="0.05" />
                        </LinearGradient>

                        {/* Inner Depth Glow: Adds a soft light refraction inside the glass */}
                        <RadialGradient 
                            id="innerGlow" 
                            cx="35%" 
                            cy="35%" 
                            rx="45%" 
                            ry="45%" 
                            fx="35%" 
                            fy="35%"
                            gradientUnits="userSpaceOnUse"
                        >
                            <Stop offset="0%" stopColor="white" stopOpacity="0.3" />
                            <Stop offset="100%" stopColor="white" stopOpacity="0" />
                        </RadialGradient>

                        {/* Subtle Bottom-Right Shadow: Adds a touch of darkness to the opposite side */}
                        <RadialGradient 
                            id="bottomShadow" 
                            cx="75%" 
                            cy="75%" 
                            rx="40%" 
                            ry="40%" 
                            fx="75%" 
                            fy="75%"
                            gradientUnits="userSpaceOnUse"
                        >
                            <Stop offset="0%" stopColor="black" stopOpacity="0.1" />
                            <Stop offset="100%" stopColor="black" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>

                    {/* 1. Base Glass Tint: Catches background colors */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="rgba(255, 255, 255, 0.12)"
                    />

                    {/* 2. Inner Glow Layer */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="url(#innerGlow)"
                    />

                    {/* 3. Bottom-Right Depth Layer */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="url(#bottomShadow)"
                    />

                    {/* 4. Variable Rim Stroke: The "varying thickness" effect */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="url(#rimGradient)"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                </Svg>
            </View>
            
            {/* Centered content (icon) */}
            <View style={styles.content}>
                {children}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        // Outer soft glow
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 4,
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
});
