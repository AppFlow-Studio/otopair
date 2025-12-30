/**
 * BookingPageHeader
 *
 * PURPOSE: Consistent header component for booking flow pages.
 *          Provides back button, centered title, and optional right action.
 *
 * USED IN: booking-details.tsx, payment.tsx
 *
 * PROPS:
 *   - title (string): Header title text
 *   - onBack (() => void): Called when back button is pressed
 *   - rightAction (ReactNode): Optional right side content
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, Shadows, Spacing, Text } from "@/components/shared-ui";

// ============================================================================
// TYPES
// ============================================================================

interface BookingPageHeaderProps {
    /** Header title text */
    title: string;
    /** Called when back button is pressed */
    onBack: () => void;
    /** Optional right side content */
    rightAction?: ReactNode;
    /** Whether to show border at bottom */
    showBorder?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingPageHeader({
    title,
    onBack,
    rightAction,
    showBorder = true,
}: BookingPageHeaderProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top + Spacing.sm },
                showBorder && styles.withBorder,
            ]}
        >
            <View style={styles.content}>
                {/* Back Button */}
                <Pressable
                    onPress={onBack}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.backButtonWrapper}
                >
                    <View style={styles.backButton}>
                        <ArrowLeft size={24} color={BrandColors.primary} />
                    </View>
                </Pressable>

                {/* Title */}
                <View style={styles.titleContainer}>
                    <Text size="lg" weight="bold" color={BrandColors.primary} numberOfLines={1}>
                        {title}
                    </Text>
                </View>

                {/* Right Action or Spacer */}
                <View style={styles.rightContainer}>
                    {rightAction || <View style={styles.spacer} />}
                </View>
            </View>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        backgroundColor: BrandColors.white,
        paddingBottom: Spacing.sm,
    },
    withBorder: {
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing.lg,
    },
    backButtonWrapper: {
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.full,
        backgroundColor: BrandColors.white,
        alignItems: "center",
        justifyContent: "center",
        ...Shadows.sm,
    },
    titleContainer: {
        flex: 1,
        alignItems: "center",
        marginHorizontal: Spacing.md,
    },
    rightContainer: {
        minWidth: 40,
        alignItems: "flex-end",
    },
    spacer: {
        width: 40,
        height: 40,
    },
});

