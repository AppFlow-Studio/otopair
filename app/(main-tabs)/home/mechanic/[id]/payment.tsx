/**
 * Payment Screen (Review & Pay)
 *
 * PURPOSE: Full-screen page for reviewing booking and payment details.
 *          Shows shop info, selected services, payment method, and appointment time.
 *
 * FLOW: mechanic detail → booking-details → payment → confirmation
 *
 * ROUTE: /home/mechanic/[id]/payment
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useCallback, useMemo, useRef } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { useLocalSearchParams, useRouter } from "expo-router";
import { BadgeCheck, Calendar, Clock, Star, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { BookingPageFooter, BookingPageHeader } from "@/components/booking/pages";
import { NoPaymentMethod, PaymentMethodCard, PayOptionButton } from "@/components/booking/shared";
import { AllAvailabilitySheet, type AllAvailabilitySheetRef } from "@/components/booking/sheets/AllAvailabilitySheet";

// 5. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";

// ============================================================================
// COMPONENT
// ============================================================================

export default function PaymentScreen() {
    // ═══════════════ HOOKS ═══════════════
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    // ═══════════════ REFS ═══════════════
    const allAvailabilityRef = useRef<AllAvailabilitySheetRef>(null);

    // ═══════════════ BOOKING STORE ═══════════════
    const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
    const availableServices = useBookingStore((state) => state.availableServices);
    const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
    const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
    const getFormattedAppointmentDate = useBookingStore((state) => state.getFormattedAppointmentDate);
    const getFormattedAppointmentTime = useBookingStore((state) => state.getFormattedAppointmentTime);
    const createBooking = useBookingStore((state) => state.createBooking);
    const bookingType = useBookingStore((state) => state.bookingType);

    // ═══════════════ MECHANIC STORE ═══════════════
    const getMechanicById = useMechanicStore((state) => state.getMechanicById);

    // ═══════════════ PAYMENT STORE ═══════════════
    const selectedPaymentMethod = usePaymentStore((state) => state.getSelectedPaymentMethod());
    const hasPaymentMethods = usePaymentStore((state) => state.hasPaymentMethods());

    // ═══════════════ COMPUTED ═══════════════
    const appointmentDate = getFormattedAppointmentDate();
    const appointmentTime = getFormattedAppointmentTime();

    const mechanic = useMemo(() => {
        if (!selectedMechanicId) return null;
        return getMechanicById(selectedMechanicId);
    }, [selectedMechanicId, getMechanicById]);

    const selectedServices = useMemo(
        () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
        [availableServices, selectedServiceIds]
    );

    const totalPrice = useMemo(
        () => selectedServices.reduce((total, service) => total + service.price, 0),
        [selectedServices]
    );

    // ═══════════════ HANDLERS ═══════════════
    const handleBack = useCallback(() => {
        router.back();
    }, [router]);

    const handleConfirmPayment = useCallback(() => {
        // Create the booking before navigating to confirmation
        if (selectedMechanicId) {
            try {
                createBooking(selectedMechanicId, bookingType || "book_now");
                router.push(`/home/mechanic/${id}/confirmation`);
            } catch (error) {
                console.error("Failed to create booking:", error);
                // TODO: Show error toast to user
            }
        }
    }, [router, id, selectedMechanicId, createBooking, bookingType]);

    const handleChangePayment = useCallback(() => {
        // TODO: Navigate to payment method selection
        console.log("Change payment method");
    }, []);

    const handleAddPayment = useCallback(() => {
        // TODO: Navigate to add payment method
        console.log("Add payment method");
    }, []);

    const handleApplePay = useCallback(() => {
        // TODO: Initiate Apple Pay
        console.log("Apple Pay");
    }, []);

    const handleGooglePay = useCallback(() => {
        // TODO: Initiate Google Pay
        console.log("Google Pay");
    }, []);

    const handleChangeDateTimePress = useCallback(() => {
        if (mechanic?.id) {
            allAvailabilityRef.current?.open(mechanic.id);
        }
    }, [mechanic?.id]);

    const handleAvailabilityConfirm = useCallback(
        (date: Date, time: string) => {
            const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
            const displayDate = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
            const isoDate = date.toISOString().split("T")[0];

            setScheduledAppointment({
                date: isoDate,
                time,
                displayDate,
            });
        },
        [setScheduledAppointment]
    );

    // ═══════════════ RENDER ═══════════════
    if (!mechanic) {
        return (
            <View style={styles.container}>
                <BookingPageHeader title="Review & Pay" onBack={handleBack} />
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
            <BookingPageHeader title="Review & Pay" onBack={handleBack} />

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Shop/Mechanic Info */}
                <View style={styles.shopInfoCard}>
                    <View style={styles.shopInfoRow}>
                        <View style={styles.avatarContainer}>
                            {mechanic.photoUrl ? (
                                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <User size={28} color="#9CA3AF" strokeWidth={1.5} />
                                </View>
                            )}
                        </View>

                        <View style={styles.shopDetails}>
                            <Text size="lg" weight="bold" color={BrandColors.primary}>
                                {mechanic.shopName}
                            </Text>
                            <Text size="sm" weight="medium" color="#6B7280">
                                {mechanic.name}
                            </Text>
                            <Text size="xs" weight="regular" color="#9CA3AF">
                                {mechanic.distanceMi} mi
                            </Text>
                        </View>

                        {/* Rating & Verified Badges */}
                        <View style={styles.badgesContainer}>
                            <View style={styles.ratingBadge}>
                                <Star size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />
                                <Text size="sm" weight="bold" color={BrandColors.primary}>
                                    {mechanic.rating.toFixed(1)}
                                </Text>
                            </View>
                            {mechanic.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <BadgeCheck size={16} color="#10B981" />
                                    <Text size="xs" weight="bold" color="#10B981">
                                        Verified
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Services List */}
                <View style={styles.servicesSection}>
                    {selectedServices.map((service, index) => (
                        <View key={service.id}>
                            <View style={styles.serviceRow}>
                                <Text size="md" weight="regular" color={BrandColors.primary}>
                                    {service.name}
                                </Text>
                                <Text size="md" weight="regular" color="#6B7280">
                                    ${service.price}
                                </Text>
                            </View>
                            {index < selectedServices.length - 1 && <View style={styles.serviceDivider} />}
                        </View>
                    ))}

                    {/* Total */}
                    <View style={styles.totalRow}>
                        <Text size="sm" weight="regular" color={BrandColors.secondary}>
                            In Total
                        </Text>
                        <Text size="sm" weight="semiBold" color={BrandColors.secondary}>
                            ${totalPrice}
                        </Text>
                    </View>
                </View>

                {/* Pay With Section */}
                <View style={styles.sectionHeader}>
                    <Text size="md" weight="medium" color="#6B7280">
                        Pay With
                    </Text>
                </View>

                <View style={styles.paymentSection}>
                    {selectedPaymentMethod ? (
                        <PaymentMethodCard
                            paymentMethod={selectedPaymentMethod}
                            onChangePress={handleChangePayment}
                        />
                    ) : (
                        <NoPaymentMethod onAddPress={handleAddPayment} />
                    )}

                    {/* Apple Pay / Google Pay Options */}
                    <View style={styles.payOptionsRow}>
                        <PayOptionButton type="apple" onPress={handleApplePay} />
                        <PayOptionButton type="google" onPress={handleGooglePay} />
                    </View>
                </View>

                {/* Date & Time Section */}
                <View style={styles.sectionHeader}>
                    <Text size="md" weight="medium" color="#6B7280">
                        Date & Time
                    </Text>
                </View>

                <View style={styles.dateTimeSection}>
                    <View style={styles.dateTimeBox}>
                        <View style={styles.dateTimeItem}>
                            <Calendar size={18} color={BrandColors.primary} />
                            <Text size="md" weight="medium" color={BrandColors.primary}>
                                {appointmentDate}
                            </Text>
                        </View>
                        <View style={styles.dateTimeItem}>
                            <Clock size={18} color={BrandColors.primary} />
                            <Text size="md" weight="medium" color={BrandColors.primary}>
                                {appointmentTime}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.changeDateButton}
                        onPress={handleChangeDateTimePress}
                        activeOpacity={0.7}
                    >
                        <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                            Change Date & Time
                        </Text>
                    </TouchableOpacity>

                    <Text size="xs" weight="regular" color="#EF4444" style={styles.warningText}>
                        Changes can't be made within 10 hours of your appointment.
                    </Text>
                </View>
            </ScrollView>

            {/* Footer */}
            <BookingPageFooter
                buttonText="Confirm & Pay"
                onPress={handleConfirmPayment}
                totalAmount={totalPrice}
                showArrow={false}
            />

            {/* All Availability Sheet */}
            <AllAvailabilitySheet ref={allAvailabilityRef} onConfirm={handleAvailabilityConfirm} />
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

    // Shop Info Card
    shopInfoCard: {
        marginBottom: Spacing.lg,
    },
    shopInfoRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    avatarContainer: {
        marginRight: Spacing.md,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: BorderRadius.full,
    },
    avatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: BorderRadius.full,
        borderWidth: 1.5,
        borderColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAFAFA",
    },
    shopDetails: {
        flex: 1,
        gap: 2,
    },
    badgesContainer: {
        alignItems: "flex-end",
        gap: Spacing.xs,
    },
    ratingBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },

    // Services Section
    servicesSection: {
        marginBottom: Spacing.xl,
    },
    serviceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: Spacing.md,
    },
    serviceDivider: {
        height: 1,
        backgroundColor: "#E5E7EB",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        marginTop: Spacing.xs,
    },

    // Section Header
    sectionHeader: {
        marginBottom: Spacing.md,
    },

    // Payment Section
    paymentSection: {
        marginBottom: Spacing.xl,
    },
    payOptionsRow: {
        flexDirection: "row",
        gap: Spacing.md,
    },

    // Date & Time Section
    dateTimeSection: {
        backgroundColor: "#F9FAFB",
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    dateTimeBox: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: BrandColors.white,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    dateTimeItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    changeDateButton: {
        alignItems: "center",
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: BrandColors.white,
        marginBottom: Spacing.md,
    },
    warningText: {
        textAlign: "center",
        fontStyle: "italic",
    },
});

