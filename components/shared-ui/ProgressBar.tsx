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
 *   - filledColor (optional): Color for filled segments [default: BrandColors.white].
 *   - unfilledColor (optional): Color for unfilled segments [default: '#0F1E3A'].
 *
 * EXAMPLE:
 *   <ProgressBar total={4} filled={1} leftElement={<BackButton />} />
 *   <ProgressBar total={5} filled={2} filledColor="#3B82F6" unfilledColor="#E5E7EB" />
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
    filledColor?: string;
    unfilledColor?: string;
    reserveLeftSpace?: boolean;
}

const DEFAULT_UNFILLED_COLOR = '#0F1E3A';

export function ProgressBar({
    total,
    filled,
    leftElement,
    filledColor = BrandColors.white,
    unfilledColor = DEFAULT_UNFILLED_COLOR,
    reserveLeftSpace = false,
}: ProgressBarProps) {
    const segments = Array.from({ length: total });
    const showLeftSlot = !!leftElement || reserveLeftSpace;

    return (
        <View style={styles.container}>
            {showLeftSlot && <View style={styles.leftElement}>{leftElement}</View>}
            <View style={styles.progressContainer}>
                {segments.map((_, idx) => {
                    const isFilled = idx < filled;
                    return (
                        <View
                            key={idx}
                            style={[
                                styles.segment,
                                { backgroundColor: isFilled ? filledColor : unfilledColor },
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
        minWidth: 42,
        height: 38,
        justifyContent: 'center',
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

