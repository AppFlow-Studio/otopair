/**
 * BookingDetailsScreen
 *
 * PURPOSE: Full-screen page displaying booking details after mechanic selection.
 *          Shows mechanic info, selected services with remove option, availability,
 *          and customer reviews.
 *
 * FLOW: Booking (mechanic detail → booking-details → payment → confirmation)
 *
 * ROUTE: /home/mechanic/[id]/booking-details
 *
 * OWNER: Temurbek Sayfutdinov
 *
 * TICKET: OTO-145
 */

// DEPRECATED FOR NOW!!: WE USE  /components/booking/sheets/BookingDetailsContent.tsx INSTEAD OF THIS PAGE
// TODO: Will speak with team on best approach to handle this.


// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, ChevronRight, Clock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { BookingPageFooter, BookingPageHeader } from "@/components/booking/pages";
import { MechanicInfoCard, ServiceRow } from "@/components/booking/shared";
import { AddServicesModal } from "@/components/booking/modals";
import { DiscardServiceModal } from "@/components/booking/sheets/DiscardServiceModal";

// 5. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingDetailsScreen() {
    // ═══════════════ HOOKS ═══════════════
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();

    // ═══════════════ BOOKING STORE ═══════════════
    const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
    const availableServices = useBookingStore((state) => state.availableServices);
    const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
    const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
    const skipServiceRemovalConfirm = useBookingStore((state) => state.skipServiceRemovalConfirm);
    const setSkipServiceRemovalConfirm = useBookingStore((state) => state.setSkipServiceRemovalConfirm);
    const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);
    const getFormattedAppointmentDate = useBookingStore((state) => state.getFormattedAppointmentDate);
    const getFormattedAppointmentTime = useBookingStore((state) => state.getFormattedAppointmentTime);
    const setBookingStage = useBookingStore((state) => state.setBookingStage);

    // ═══════════════ MECHANIC STORE ═══════════════
    const getMechanicById = useMechanicStore((state) => state.getMechanicById);

    // ═══════════════ SHOP STORE (for shop-specific pricing) ═══════════════
    const getShopById = useShopStore((state) => state.getShopById);

    // ═══════════════ LOCAL STATE ═══════════════
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [pendingRemoveServiceId, setPendingRemoveServiceId] = useState<string | null>(null);
    const [showAddServicesModal, setShowAddServicesModal] = useState(false);

    // ═══════════════ COMPUTED VALUES ═══════════════
    const mechanic = useMemo(() => {
        if (!selectedMechanicId) return null;
        return getMechanicById(selectedMechanicId);
    }, [selectedMechanicId, getMechanicById]);

    const selectedServices = useMemo(
        () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
        [availableServices, selectedServiceIds]
    );

    // Shop-specific pricing: labor_rate × default_labor_hours + default_parts_estimate (matches ShopDetails)
    const shop = useMemo(
        () => (mechanic?.shopId ? getShopById(mechanic.shopId) : null),
        [mechanic?.shopId, getShopById]
    );
    const laborRate = shop?.labor_rate ?? 80;
    const totalPrice = useMemo(
        () =>
            selectedServices.reduce(
                (total, service) =>
                    total +
                    laborRate * (service.default_labor_hours ?? 0) +
                    (service.default_parts_estimate ?? 0),
                0
            ),
        [selectedServices, laborRate]
    );
    const getServicePrice = useCallback(
        (service: (typeof selectedServices)[0]) =>
            laborRate * (service.default_labor_hours ?? 0) + (service.default_parts_estimate ?? 0),
        [laborRate]
    );

    const ratingCount = mechanic ? Math.floor(mechanic.rating * 25 + 27) : 0;

    // Get formatted date and time from store
    const appointmentDate = getFormattedAppointmentDate();
    const appointmentTime = getFormattedAppointmentTime();

    // Check if we can proceed (requires at least one service)
    const canProceed = selectedServices.length > 0;

    // ═══════════════ HANDLERS ═══════════════
    const handleBack = useCallback(() => {
        // Reset booking stage back to mechanic_selection so bottom sheet renders correctly
        setBookingStage("mechanic_selection", "backward");
        router.back();
    }, [router, setBookingStage]);

    const handleContinue = useCallback(() => {
        router.push(`/home/mechanic/${id}/payment`);
    }, [router, id]);

    const handleAddMore = useCallback(() => {
        setShowAddServicesModal(true);
    }, []);

    const handleCloseAddServicesModal = useCallback(() => {
        setShowAddServicesModal(false);
    }, []);

    const handleRemoveService = useCallback((serviceId: string) => {
        if (skipServiceRemovalConfirm) {
            toggleServiceSelection(serviceId);
            return;
        }
        setPendingRemoveServiceId(serviceId);
        setShowDiscardModal(true);
    }, [skipServiceRemovalConfirm, toggleServiceSelection]);

    const handleConfirmRemove = useCallback(() => {
        if (pendingRemoveServiceId) {
            toggleServiceSelection(pendingRemoveServiceId);
        }
        setShowDiscardModal(false);
        setPendingRemoveServiceId(null);
    }, [pendingRemoveServiceId, toggleServiceSelection]);

    const handleCloseDiscardModal = useCallback(() => {
        setShowDiscardModal(false);
        setPendingRemoveServiceId(null);
    }, []);

    const handleDontAskAgain = useCallback(() => {
        setSkipServiceRemovalConfirm(true);
        handleConfirmRemove();
    }, [setSkipServiceRemovalConfirm, handleConfirmRemove]);

    // ═══════════════ RENDER ═══════════════
    if (!mechanic) {
        return (
            <View style={styles.container}>
                <BookingPageHeader title="Booking Details" onBack={handleBack} />
                <View style={styles.errorContainer}>
                    <Text size="md" weight="medium" color="#6B7280" center>
                        No mechanic selected
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <BookingPageHeader title="Booking Details" onBack={handleBack} />

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Mechanic Info Section */}
                <MechanicInfoCard mechanic={mechanic} ratingCount={ratingCount} />

                {/* Selected Services Section */}
                <View style={styles.sectionHeader}>
                    <Text size="md" weight="bold" color="#9CA3AF">
                        Selected Services ({selectedServices.length})
                    </Text>
                </View>

                <View style={styles.servicesContainer}>
                    {selectedServices.map((service) => (
                        <ServiceRow
                            key={service.id}
                            service={service}
                            onRemove={() => handleRemoveService(service.id)}
                        />
                    ))}

                    {/* Total and Add More Row */}
                    <View style={styles.servicesFooter}>
                        <View style={styles.totalBadge}>
                            <Text size="md" weight="bold" color="#6B7280">
                                In total ${totalPrice}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addMoreRowButton}
                            onPress={handleAddMore}
                            activeOpacity={0.7}
                        >
                            <Text size="md" weight="bold" color={BrandColors.primary}>
                                Add More
                            </Text>
                            <ChevronRight size={18} color={BrandColors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Scheduled Appointment Section */}
                {scheduledAppointment && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text size="md" weight="bold" color="#9CA3AF">
                                Appointment
                            </Text>
                        </View>
                        <View style={styles.appointmentCard}>
                            <View style={styles.appointmentRow}>
                                <View style={styles.appointmentItem}>
                                    <View style={styles.appointmentIconContainer}>
                                        <Calendar size={20} color={BrandColors.secondary} />
                                    </View>
                                    <View>
                                        <Text size="xs" weight="medium" color="#9CA3AF">
                                            Date
                                        </Text>
                                        <Text size="md" weight="bold" color={BrandColors.primary}>
                                            {appointmentDate}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.appointmentDivider} />
                                <View style={styles.appointmentItem}>
                                    <View style={styles.appointmentIconContainer}>
                                        <Clock size={20} color={BrandColors.secondary} />
                                    </View>
                                    <View>
                                        <Text size="xs" weight="medium" color="#9CA3AF">
                                            Time
                                        </Text>
                                        <Text size="md" weight="bold" color={BrandColors.primary}>
                                            {appointmentTime}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </>
                )}

            </ScrollView>

            {/* Footer */}
            <BookingPageFooter
                buttonText="Continue to Payment"
                onPress={handleContinue}
                totalAmount={totalPrice}
                disabled={!canProceed}
            />

            {/* Modals and Sheets */}
            <DiscardServiceModal
                visible={showDiscardModal}
                onClose={handleCloseDiscardModal}
                onConfirm={handleConfirmRemove}
                onDontAskAgain={handleDontAskAgain}
            />
            <AddServicesModal visible={showAddServicesModal} onClose={handleCloseAddServicesModal} />
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BrandColors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    sectionHeader: {
        marginBottom: Spacing.md,
    },
    servicesContainer: {
        backgroundColor: "#F9FAFB",
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    servicesFooter: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: Spacing.lg,
        gap: Spacing.md,
    },
    totalBadge: {
        flex: 1,
        backgroundColor: "#E5E7EB",
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: "center",
    },
    addMoreRowButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BrandColors.white,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: 4,
        borderWidth: 1,
        borderColor: "#F3F4F6",
    },
    appointmentCard: {
        backgroundColor: "#F0F7FF",
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: BrandColors.secondary + "30",
    },
    appointmentRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
    appointmentItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    appointmentIconContainer: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.lg,
        backgroundColor: BrandColors.white,
        alignItems: "center",
        justifyContent: "center",
    },
    appointmentDivider: {
        width: 1,
        height: 40,
        backgroundColor: BrandColors.secondary + "30",
    },
});
