/**
 * FadeHeaderContainer
 *
 * PURPOSE: Header container with gradient fade effect at bottom to blend content
 *          into the header area smoothly.
 *
 * USED IN: refer-a-friend.tsx and other screens with list-style content.
 *
 * PROPS:
 *   - children (ReactNode): Header content (typically back button and title)
 *   - paddingTop (number): Top padding including safe area [optional]
 *   - fadeHeight (number): Height of the fade gradient [optional, default: 64]
 *   - colors (string[]): Gradient colors (opaque at top, transparent at bottom)
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing } from '@/constants/theme';

interface FadeHeaderContainerProps {
    children: ReactNode;
    paddingTop?: number;
    paddingHorizontal?: number;
    fadeHeight?: number;
    colors: [string, string, string, string];
}

export function FadeHeaderContainer({
    children,
    paddingTop = Spacing.lg,
    paddingHorizontal = Spacing['2xl'],
    fadeHeight = 64,
    colors,
}: FadeHeaderContainerProps) {
    const headerBackgroundColor = colors[0]; // Use the first color (opaque) for the header background

    return (
        <View style={styles.wrapper}>
            {/* Header content with solid background */}
            <View style={[styles.contentContainer, { paddingTop, paddingHorizontal, backgroundColor: headerBackgroundColor }]}>
                {children}
            </View>

            {/* Gradient fade overlay positioned below the header content */}
            <View 
                style={[
                    styles.fadeContainer, 
                    { height: fadeHeight, top: '100%' }
                ]} 
                pointerEvents="none"
            >
                <LinearGradient
                    colors={colors}
                    locations={[0, 0.4, 0.7, 1]}
                    style={styles.fadeGradient}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    fadeContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1,
    },
    fadeGradient: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: Spacing.sm,
        backgroundColor: 'transparent',
    },
});
