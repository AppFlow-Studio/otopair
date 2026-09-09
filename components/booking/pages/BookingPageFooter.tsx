/**
 * BookingPageFooter
 *
 * PURPOSE: Sticky footer component for booking flow pages.
 *          Displays primary action button with optional total amount.
 *
 * USED IN: booking-details.tsx, payment.tsx
 *
 * PROPS:
 *   - buttonText (string): Primary button text
 *   - onPress (() => void): Called when button is pressed
 *   - totalAmount (number): Optional total amount to display
 *   - disabled (boolean): Whether button is disabled
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, Shadows, Spacing, Text } from "@/components/shared-ui";

// ============================================================================
// TYPES
// ============================================================================

interface BookingPageFooterProps {
    /** Primary button text */
    buttonText: string;
    /** Called when button is pressed */
    onPress: () => void;
    /** Optional total amount to display */
    totalAmount?: number;
    /** Whether button is disabled */
    disabled?: boolean;
    /** Show arrow icon in button */
    showArrow?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingPageFooter({
    buttonText,
    onPress,
    totalAmount,
    disabled = false,
    showArrow = true,
}: BookingPageFooterProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.md }]}>
            {/* Total Amount Display */}
            {totalAmount !== undefined && (
                <View style={styles.totalRow}>
                    <Text size="md" weight="medium" color="#6B7280">
                        Total
                    </Text>
                    <Text size="xl" weight="bold" color={BrandColors.primary}>
                        ${totalAmount}
                    </Text>
                </View>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity
                style={[styles.button, disabled && styles.buttonDisabled]}
                onPress={onPress}
                activeOpacity={0.8}
                disabled={disabled}
            >
                <Text size="md" weight="bold" color={BrandColors.white}>
                    {buttonText}
                </Text>
                {showArrow && <ChevronRight size={20} color={BrandColors.white} />}
            </TouchableOpacity>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        backgroundColor: BrandColors.white,
        paddingTop: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        ...Shadows.lg,
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: Spacing.md,
    },
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BrandColors.secondary,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.xl,
        gap: Spacing.xs,
    },
    buttonDisabled: {
        backgroundColor: "#9CA3AF",
    },
});

