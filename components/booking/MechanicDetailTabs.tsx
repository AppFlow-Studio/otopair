/**
 * MechanicDetailTabs
 *
 * PURPOSE: Tab navigation component for mechanic detail page with Services,
 *          Reviews, Portfolio, and Staff tabs.
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx
 *
 * PROPS:
 *   - activeTab ('services' | 'reviews' | 'portfolio' | 'staff'): Currently active tab
 *   - onTabChange ((tab) => void): Called when a tab is selected
 *
 * EXAMPLE:
 *   <MechanicDetailTabs
 *     activeTab="services"
 *     onTabChange={(tab) => setActiveTab(tab)}
 *   />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 3. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export type MechanicDetailTab = "services" | "reviews" | "portfolio" | "staff";

interface MechanicDetailTabsProps {
    /** Currently active tab */
    activeTab: MechanicDetailTab;
    /** Called when a tab is selected */
    onTabChange: (tab: MechanicDetailTab) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS: { id: MechanicDetailTab; label: string }[] = [
    { id: "services", label: "SERVICES" },
    { id: "reviews", label: "REVIEWS" },
    { id: "portfolio", label: "PORTFOLIO" },
    { id: "staff", label: "STAFF" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicDetailTabs({ activeTab, onTabChange }: MechanicDetailTabsProps) {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={styles.tab}
                            onPress={() => onTabChange(tab.id)}
                            activeOpacity={0.7}
                        >
                            <Text
                                size="sm"
                                weight={isActive ? "bold" : "medium"}
                                color={isActive ? BrandColors.primary : "#6B7280"}
                                style={styles.tabLabel}
                            >
                                {tab.label}
                            </Text>
                            {isActive && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        backgroundColor: BrandColors.white,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        gap: Spacing.xl,
    },
    tab: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xs,
        position: "relative",
    },
    tabLabel: {
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    activeIndicator: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: BrandColors.secondary,
        borderRadius: BorderRadius.full,
    },
});

