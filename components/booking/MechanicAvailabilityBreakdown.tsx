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
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { AvailabilitySlots } from "@/components/booking/shared";

// 5. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import type { ScheduledAppointment } from "@/stores/types/store.types";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface MechanicAvailabilityBreakdownProps {
    /** The shop ID to get mechanics for */
    shopId: number;
    /** Called when "View All" is pressed, receives mechanic ID and optional flag for schedule later */
    onViewAllAvailability?: (mechanicId: number, forScheduleLater?: boolean) => void;
    /** Called when "Book Now" is pressed, receives mechanic ID */
    onBookNow?: (mechanicId: number) => void;
    /** Called when "Schedule Later" is pressed after selecting date/time, receives mechanic ID and appointment */
    onScheduleLater?: (mechanicId: number, appointment: ScheduledAppointment) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicAvailabilityBreakdown({ shopId, onViewAllAvailability, onBookNow, onScheduleLater }: MechanicAvailabilityBreakdownProps) {
    // ═══════════════ STORES ═══════════════
    const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
    const availableServices = useBookingStore((state) => state.availableServices);
    const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);

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
    // Helper to convert slot data to ScheduledAppointment
    const convertSlotToAppointment = useCallback((slot: { day: string; dayOfWeek: string; time: string }): ScheduledAppointment => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const dayNum = parseInt(slot.day, 10);

        // Construct date from slot day (assuming current month/year, adjust if in past)
        let targetDate = new Date(currentYear, currentMonth, dayNum);
        if (targetDate < now) {
            // If the date is in the past, use next month
            targetDate = new Date(currentYear, currentMonth + 1, dayNum);
        }

        // Format date as ISO string (YYYY-MM-DD)
        const isoDate = targetDate.toISOString().split("T")[0];

        // Format display date (e.g., "20 Aug. 2025")
        const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
        const displayDate = `${targetDate.getDate()} ${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

        return {
            date: isoDate,
            time: slot.time,
            displayDate,
        };
    }, []);

    const handleSlotSelect = useCallback(
        (mechanicId: number, slotIndex: number, slot: { day: string; dayOfWeek: string; time: string }) => {
            setSelectedSlots((prev) => {
                const isCurrentlySelected = prev[mechanicId] === slotIndex;

                if (isCurrentlySelected) {
                    // Deselect
                    setScheduledAppointment(null);
                    return {
                        ...prev,
                        [mechanicId]: null,
                    };
                } else {
                    // Select new slot and automatically set scheduled appointment in store
                    const appointment = convertSlotToAppointment(slot);
                    setScheduledAppointment(appointment);
                    return {
                        ...prev,
                        [mechanicId]: slotIndex,
                    };
                }
            });
        },
        [setScheduledAppointment, convertSlotToAppointment]
    );

    const handleViewAllAvailability = useCallback(
        (mechanicId: number, forScheduleLater: boolean = false) => {
            onViewAllAvailability?.(mechanicId, forScheduleLater);
        },
        [onViewAllAvailability]
    );

    const handleBookNow = useCallback(
        (mechanicId: number) => {
            onBookNow?.(mechanicId);
        },
        [onBookNow]
    );

    const handleScheduleLater = useCallback(
        (mechanicId: number, slotIndex: number | null, slot: { day: string; dayOfWeek: string; time: string } | null) => {
            if (slotIndex === null || !slot) {
                // If no slot selected, open calendar sheet with schedule later flag
                onViewAllAvailability?.(mechanicId, true);
                return;
            }

            // Convert slot to appointment and call callback
            const appointment = convertSlotToAppointment(slot);
            setScheduledAppointment(appointment);
            onScheduleLater?.(mechanicId, appointment);
        },
        [onScheduleLater, onViewAllAvailability, setScheduledAppointment, convertSlotToAppointment]
    );

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
                                        onSlotSelect={(index) => {
                                            const slot = mechanic.nextAvailability![index];
                                            handleSlotSelect(mechanic.id, index, slot);
                                        }}
                                        onViewAll={() => handleViewAllAvailability(mechanic.id)}
                                    />
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={styles.scheduleButton}
                                    onPress={() => {
                                        const slotIndex = selectedSlotIndex;
                                        const slot = slotIndex !== null && mechanic.nextAvailability ? mechanic.nextAvailability[slotIndex] : null;
                                        handleScheduleLater(mechanic.id, slotIndex, slot);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                                        Schedule For Later
                                    </Text>
                                </TouchableOpacity>
                                <PrimaryButton
                                    style={[
                                        styles.bookButton,
                                        selectedSlotIndex === null && styles.bookButtonDisabled,
                                    ]}
                                    onPress={() => handleBookNow(mechanic.id)}
                                    disabled={selectedSlotIndex === null}
                                >
                                    <Text
                                        size="sm"
                                        weight="semiBold"
                                        color={selectedSlotIndex === null ? "#9CA3AF" : BrandColors.white}
                                    >
                                        Book Now
                                    </Text>
                                </PrimaryButton>
                            </View>
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
    actionButtons: {
        flexDirection: "row",
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    scheduleButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        backgroundColor: "#E4E7EC",
    },
    bookButton: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
    },
    bookButtonDisabled: {
        backgroundColor: "#E5E7EB",
    },
    emptyContainer: {
        paddingVertical: Spacing.xl,
        alignItems: "center",
    },
});

