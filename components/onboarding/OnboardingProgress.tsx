/**
 * OnboardingProgress
 *
 * PURPOSE: Render segmented progress bars for onboarding flows.
 *
 * USED IN: Onboarding slides (e.g., CarExperience, Beginner flows)
 *
 * PROPS:
 *   - total (number): Total number of segments to display.
 *   - filled (number): How many segments are completed (shown in BrandColors.secondary).
 *   - leftElement (optional): Element to display on the left side (e.g., back button).
 *
 * EXAMPLE:
 *   <OnboardingProgress total={4} filled={1} leftElement={<OnboardingBackButton />} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-010
 */

// TODO: Remove color hardcoding once theme.ts is updated

import { BrandColors, Colors, Spacing } from '@/components/shared-ui';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface OnboardingProgressProps {
    total: number;
    filled: number;
    leftElement?: ReactNode;
}

const unfilledColor = '#cfd6e6'; // light gray that stands out on onboarding background

export function OnboardingProgress({ total, filled, leftElement }: OnboardingProgressProps) {
    const segments = Array.from({ length: total });

    return (
        <View style={styles.container}>
            {leftElement && <View style={styles.leftElement}>{leftElement}</View>}
            <View style={styles.progressContainer}>
                {segments.map((_, idx) => {
                    const isFilled = idx < filled;
                    return (
                        <View
                            key={idx}
                            style={[
                                styles.segment,
                                { backgroundColor: isFilled ? BrandColors.secondary : unfilledColor },
                            ]}
                        />
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing.xl,
        paddingTop: Spacing.sm,
    },
    leftElement: {
        marginRight: Spacing.md,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    segment: {
        height: 6,
        borderRadius: 999,
        flex: 1,
    },
});


