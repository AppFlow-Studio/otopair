/**
 * MechanicServicesSection
 *
 * PURPOSE: Displays selected services for booking in the mechanic detail page
 *
 * USED IN: app/(booking)/mechanic/[id].tsx (Services tab)
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

// 2. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 3. Constants
import { BorderRadius } from "@/constants/theme";

// 4. Stores
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicServicesSection() {
    // ═══════════════ STORES ═══════════════
    const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
    const availableServices = useBookingStore((state) => state.availableServices);
    const getSelectedServices = useBookingStore((state) => state.getSelectedServices);

    // ═══════════════ COMPUTED VALUES ═══════════════
    const selectedServices = useMemo(() => getSelectedServices(), [getSelectedServices, selectedServiceIds]);

    const totalPrice = useMemo(
        () => selectedServices.reduce((total, service) => total + service.price, 0),
        [selectedServices]
    );

    // ═══════════════ RENDER ═══════════════
    if (selectedServices.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text size="md" weight="medium" color="#9CA3AF" center>
                    No services selected
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                    Selected Services ({selectedServices.length})
                </Text>
            </View>

            <View style={styles.servicesList}>
                {selectedServices.map((service, index) => (
                    <View key={service.id} style={styles.serviceCard}>
                        <View style={styles.serviceInfo}>
                            <Text size="md" weight="semiBold" color={BrandColors.primary}>
                                {service.name}
                            </Text>
                            <Text size="xs" weight="regular" color="#6B7280" style={styles.serviceDescription}>
                                {service.description}
                            </Text>
                        </View>
                        <View style={styles.priceContainer}>
                            <Text size="sm" weight="bold" color={BrandColors.secondary}>
                                ${service.price}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.totalContainer}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                    Total
                </Text>
                <Text size="lg" weight="bold" color={BrandColors.secondary}>
                    ${totalPrice}
                </Text>
            </View>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    header: {
        marginBottom: Spacing.md,
    },
    servicesList: {
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    serviceCard: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        backgroundColor: "#F9FAFB",
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    serviceInfo: {
        flex: 1,
        marginRight: Spacing.md,
    },
    serviceDescription: {
        marginTop: Spacing.xs,
    },
    priceContainer: {
        alignItems: "flex-end",
    },
    totalContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: Spacing.md,
        borderTopWidth: 2,
        borderTopColor: "#E5E7EB",
    },
    emptyContainer: {
        paddingVertical: Spacing.xl,
        alignItems: "center",
    },
});

