/**
 * FadeFooterContainer
 *
 * PURPOSE: Footer container with gradient fade effect at top to blend list content
 *          into the footer button area smoothly.
 *
 * USED IN: Step components in OnboardingFlow, TellUsAboutFlow, and other flows
 *          with list-style content and footer buttons.
 *
 * PROPS:
 *   - children (ReactNode): Footer content (typically FooterButton)
 *   - paddingBottom (number): Bottom padding including safe area [optional]
 *   - fadeHeight (number): Height of the fade gradient [optional, default: 64]
 *   - fadeVariant (0 | 1 | 2): Which fade color set to use (use to adapt to different background colors)
 *       - 0: no gradient overlay
 *       - 1: first color set (default, dark blue)
 *       - 2: second color set (light blue)
 *
 * EXAMPLE:
 *   <FadeFooterContainer paddingBottom={insets.bottom + Spacing.lg} fadeHeight={64} fadeVariant={1}>
 *     <FooterButton label="Continue" onPress={handleContinue} />
 *   </FadeFooterContainer>
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: Adjust so that fade doesn't become obvious during screen background animation.

import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing } from '@/constants/theme';

interface FadeFooterContainerProps {
    children: ReactNode;
    paddingBottom?: number;
    fadeHeight?: number;
    fadeVariant?: 0 | 1 | 2;
}

export function FadeFooterContainer({
    children,
    paddingBottom = Spacing.lg,
    fadeHeight = 64,
    fadeVariant = 1,
}: FadeFooterContainerProps) {
    // Two configurable color sets; second is a copy for now (user will edit later)
    const COLOR_SETS: [string, string, string, string][] = [
        [
            'rgba(32, 63, 125, 0)',       // Transparent at top
            'rgba(32, 63, 125, 0.3)',     // Light blend
            'rgba(32, 63, 125, 0.7)',     // Medium blend
            'rgba(32, 63, 125, 0.95)',    // Nearly opaque at bottom
        ],
        [
            'rgba(82, 153, 254, 0)',       // Transparent at top (copy for now)
            'rgba(82, 153, 254, 0.3)',     // Light blend (copy for now)
            'rgba(82, 153, 254, 0.7)',     // Medium blend (copy for now)
            'rgba(82, 153, 254, 0.95)',    // Nearly opaque at bottom (copy for now)
        ],
    ];

    const colors = fadeVariant === 0 ? null : COLOR_SETS[Math.min(Math.max(fadeVariant, 1), 2) - 1];

    return (
        <View style={styles.wrapper}>
            {/* Gradient fade overlay positioned above the footer content (optional) */}
            {colors && (
                <View 
                    style={[
                        styles.fadeContainer, 
                        { height: fadeHeight, transform: [{ translateY: -fadeHeight }] }
                    ]} 
                    pointerEvents="none"
                >
                    <LinearGradient
                        colors={colors}
                        locations={[0, 0.3, 0.6, 1]}
                        style={styles.fadeGradient}
                    />
                </View>
            )}
            
            {/* Footer content */}
            <View style={[styles.contentContainer, { paddingBottom }]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
    },
    fadeContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    fadeGradient: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
        backgroundColor: 'transparent',
    },
});

