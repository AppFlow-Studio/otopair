/**
 * ProgressBar
 *
 * PURPOSE: Render segmented progress bars for multi-step flows.
 *
 * USED IN: Multi-step flows (Onboarding, TellUsAbout, etc.).
 *
 * PROPS:
 *   - total (number): Total number of segments to display.
 *   - filled (number): How many segments are completed.
 *   - leftElement (optional): Element to display on the left side (e.g., back button).
 *
 * EXAMPLE:
 *   <ProgressBar total={4} filled={1} leftElement={<BackButton />} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { BrandColors, Spacing } from '@/constants/theme';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface ProgressBarProps {
    total: number;
    filled: number;
    leftElement?: ReactNode;
}

const unfilledColor = '#0F1E3A';

export function ProgressBar({ total, filled, leftElement }: ProgressBarProps) {
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
                                { backgroundColor: isFilled ? BrandColors.white : unfilledColor },
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

