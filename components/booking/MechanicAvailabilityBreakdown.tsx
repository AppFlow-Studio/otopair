/**
 * MechanicAvailabilityBreakdown
 *
 * PURPOSE: Displays breakdown of all mechanics at a shop with their availability
 *          slots, allowing users to see available bays/mechanics and time slots
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx (Services tab)
 *
 * PROPS:
 *   - shopId (number): The shop ID to get mechanics for
 *
 * EXAMPLE:
 *   <MechanicAvailabilityBreakdown shopId={shop.id} />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { AvailabilitySlots } from "@/components/booking/shared";

// 5. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface MechanicAvailabilityBreakdownProps {
    /** The shop ID to get mechanics for */
    shopId: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicAvailabilityBreakdown({ shopId }: MechanicAvailabilityBreakdownProps) {
    // ═══════════════ STORES ═══════════════
    const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
    const availableServices = useBookingStore((state) => state.availableServices);

    // ═══════════════ STATE ═══════════════
    // Track selected slot index for each mechanic
    const [selectedSlots, setSelectedSlots] = useState<Record<number, number | null>>({});

    // ═══════════════ COMPUTED VALUES ═══════════════
    const mechanics = useMemo(() => getMechanicsByShopId(shopId), [shopId, getMechanicsByShopId]);

    // Map specialty IDs to service names for each mechanic
    const mechanicsWithSpecialties = useMemo(() => {
        const serviceMap = new Map<string, string>();
        availableServices.forEach((service) => {
            serviceMap.set(service.id, service.name);
        });

        return mechanics.map((mechanic) => {
            const specialtyNames = mechanic.specialties
                .map((specialtyId) => serviceMap.get(specialtyId))
                .filter((name): name is string => !!name);

            return {
                ...mechanic,
                specialtyNames,
            };
        });
    }, [mechanics, availableServices]);

    // ═══════════════ HANDLERS ═══════════════
    const handleSlotSelect = useCallback((mechanicId: number, slotIndex: number) => {
        setSelectedSlots((prev) => ({
            ...prev,
            [mechanicId]: prev[mechanicId] === slotIndex ? null : slotIndex,
        }));
    }, []);

    const handleViewAllAvailability = useCallback((mechanicId: number) => {
        // TODO: Open full availability sheet/modal
        console.log("View all availability for mechanic:", mechanicId);
    }, []);

    // ═══════════════ RENDER ═══════════════
    if (mechanics.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text size="md" weight="medium" color="#9CA3AF" center>
                    No mechanics available at this shop
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                    Available Mechanics & Bays
                </Text>
                <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
                    Select a mechanic and time slot to book
                </Text>
            </View>

            <View style={styles.mechanicsList}>
                {mechanicsWithSpecialties.map((mechanic) => {
                    const selectedSlotIndex = selectedSlots[mechanic.id] ?? null;

                    return (
                        <View key={mechanic.id} style={styles.mechanicCard}>
                            {/* Mechanic Header */}
                            <View style={styles.mechanicHeader}>
                                <View style={styles.avatarContainer}>
                                    {mechanic.photoUrl ? (
                                        <View style={styles.avatarPlaceholder}>
                                            <User size={24} color="#9CA3AF" />
                                        </View>
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <User size={24} color="#9CA3AF" />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.mechanicInfo}>
                                    <View style={styles.mechanicNameRow}>
                                        <Text size="md" weight="bold" color={BrandColors.primary}>
                                            {mechanic.name}
                                        </Text>
                                        {mechanic.isAvailable && (
                                            <View style={styles.availableBadge}>
                                                <View style={styles.availableDot} />
                                                <Text size="xs" weight="medium" color="#10B981">
                                                    Available
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    {mechanic.specialtyNames.length > 0 && (
                                        <View style={styles.specialtiesContainer}>
                                            {mechanic.specialtyNames.slice(0, 3).map((specialty, index) => (
                                                <View key={index} style={styles.specialtyTag}>
                                                    <Text size="xs" weight="medium" color={BrandColors.primary}>
                                                        {specialty}
                                                    </Text>
                                                </View>
                                            ))}
                                            {mechanic.specialtyNames.length > 3 && (
                                                <Text size="xs" weight="medium" color="#6B7280">
                                                    +{mechanic.specialtyNames.length - 3} more
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Availability Slots */}
                            {mechanic.nextAvailability && mechanic.nextAvailability.length > 0 && (
                                <View style={styles.availabilitySection}>
                                    <AvailabilitySlots
                                        slots={mechanic.nextAvailability}
                                        selectedIndex={selectedSlotIndex}
                                        onSlotSelect={(index) => handleSlotSelect(mechanic.id, index)}
                                        onViewAll={() => handleViewAllAvailability(mechanic.id)}
                                    />
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.lg,
    },
    header: {
        marginBottom: Spacing.lg,
    },
    subtitle: {
        marginTop: Spacing.xs,
    },
    mechanicsList: {
        gap: Spacing.lg,
    },
    mechanicCard: {
        backgroundColor: BrandColors.white,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    mechanicHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: Spacing.md,
    },
    avatarContainer: {
        marginRight: Spacing.md,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.full,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "#E5E7EB",
    },
    mechanicInfo: {
        flex: 1,
    },
    mechanicNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    availableBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0FDF4",
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.md,
        gap: 4,
    },
    availableDot: {
        width: 6,
        height: 6,
        borderRadius: BorderRadius.full,
        backgroundColor: "#10B981",
    },
    specialtiesContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: Spacing.xs,
    },
    specialtyTag: {
        backgroundColor: "#F0F7FF",
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: BrandColors.secondary + "30",
    },
    availabilitySection: {
        marginTop: Spacing.md,
    },
    emptyContainer: {
        paddingVertical: Spacing.xl,
        alignItems: "center",
    },
});

