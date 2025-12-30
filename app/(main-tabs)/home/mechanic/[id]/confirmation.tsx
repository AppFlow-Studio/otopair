/**
 * Confirmation Screen
 *
 * PURPOSE: Full-screen confirmation page after successful booking.
 *          Shows success animation, mechanic info, date/time, and action buttons.
 *
 * FLOW: mechanic detail → booking-details → payment → confirmation
 *
 * ROUTE: /home/mechanic/[id]/confirmation
 *
 * OWNER: Temurbek Sayfutdinov
 */

// DEPRECATED FOR NOW!!: WE USE  /components/booking/sheets/ConfirmationContent.tsx INSTEAD OF THIS PAGE
// TODO: Will speak with team on best approach to handle this.


// 1. React & React Native
import React, { useCallback, useEffect, useMemo } from "react";
import { Image, InteractionManager, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { useRouter } from "expo-router";
import { BadgeCheck, Calendar, Check, Clock, Star, User } from "lucide-react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, Shadows, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// CONSTANTS
// ============================================================================

const CONFETTI_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181", "#AA96DA", "#A8D8EA", "#FCBAD3"];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ConfettiParticle({
    color,
    delay,
    startX,
    startY,
}: {
    color: string;
    delay: number;
    startX: number;
    startY: number;
}) {
    const translateY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(0);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        const endX = (Math.random() - 0.5) * 150;
        const endY = Math.random() * 80 + 40;

        opacity.value = withDelay(
            delay,
            withSequence(withTiming(1, { duration: 200 }), withDelay(800, withTiming(0, { duration: 400 })))
        );
        translateY.value = withDelay(delay, withSpring(-endY, { damping: 8, stiffness: 100 }));
        translateX.value = withDelay(delay, withSpring(endX, { damping: 10, stiffness: 80 }));
        rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), 2));
        scale.value = withDelay(
            delay,
            withSequence(withSpring(1, { damping: 8 }), withDelay(600, withTiming(0, { duration: 300 })))
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotate.value}deg` },
            { scale: scale.value },
        ],
        opacity: opacity.value,
    }));

    const size = Math.random() * 6 + 4;
    const isCircle = Math.random() > 0.5;

    return (
        <Animated.View
            style={[
                {
                    position: "absolute",
                    left: startX,
                    top: startY,
                    width: size,
                    height: isCircle ? size : size * 1.5,
                    backgroundColor: color,
                    borderRadius: isCircle ? size / 2 : 2,
                },
                animatedStyle,
            ]}
        />
    );
}

function ConfettiExplosion() {
    const particles = useMemo(() => {
        return Array.from({ length: 24 }, (_, i) => ({
            id: i,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            delay: Math.random() * 200,
            startX: 40 + Math.random() * 20,
            startY: 40 + Math.random() * 20,
        }));
    }, []);

    return (
        <View style={styles.confettiContainer} pointerEvents="none">
            {particles.map((particle) => (
                <ConfettiParticle
                    key={particle.id}
                    color={particle.color}
                    delay={particle.delay}
                    startX={particle.startX}
                    startY={particle.startY}
                />
            ))}
        </View>
    );
}

function SuccessCheckmark() {
    const scale = useSharedValue(0);
    const checkScale = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 150 });
        checkScale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 120 }));
    }, []);

    const circleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));

    return (
        <View style={styles.successContainer}>
            <ConfettiExplosion />
            <Animated.View style={[styles.successCircle, circleStyle]}>
                <Animated.View style={checkStyle}>
                    <Check size={40} color="#FFFFFF" strokeWidth={3} />
                </Animated.View>
            </Animated.View>
        </View>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConfirmationScreen() {
    // ═══════════════ HOOKS ═══════════════
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // ═══════════════ STORES ═══════════════
    const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
    const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);
    const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
    const getMechanicById = useMechanicStore((state) => state.getMechanicById);

    // ═══════════════ COMPUTED ═══════════════
    const mechanic = useMemo(() => {
        if (!selectedMechanicId) return null;
        return getMechanicById(selectedMechanicId);
    }, [selectedMechanicId, getMechanicById]);

    const appointmentDate = useMemo(() => {
        if (scheduledAppointment?.date) {
            const date = new Date(scheduledAppointment.date);
            return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
        }
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 2);
        return futureDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }, [scheduledAppointment]);

    const appointmentTime = useMemo(() => {
        if (scheduledAppointment?.time) {
            return scheduledAppointment.time;
        }
        return "1:00 PM";
    }, [scheduledAppointment]);

    // ═══════════════ HANDLERS ═══════════════
    const handleBackToHome = useCallback(() => {
        // Navigate to bookings tab first
        router.replace("/bookings");
        // Reset booking flow after navigation animation completes
        InteractionManager.runAfterInteractions(() => {
            resetBookingFlow();
        });
    }, [resetBookingFlow, router]);

    const handleAddToCalendar = useCallback(() => {
        // TODO: Implement calendar integration
        console.log("Add to calendar");
    }, []);

    // ═══════════════ RENDER ═══════════════
    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Content Container - Centered */}
            <View style={styles.contentContainer}>
                {/* Success Animation */}
                <SuccessCheckmark />

                {/* Title */}
                <Text size="xl" weight="bold" color={BrandColors.primary} center style={styles.title}>
                    Thank you! Your booking has{"\n"}been confirmed.
                </Text>

                {/* Mechanic Info Card */}
                {mechanic && (
                    <View style={styles.mechanicCard}>
                        <View style={styles.mechanicAvatar}>
                            {mechanic.photoUrl ? (
                                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatarImage} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <User size={24} color="#9CA3AF" strokeWidth={1.5} />
                                </View>
                            )}
                        </View>

                        <View style={styles.mechanicInfo}>
                            <Text size="md" weight="bold" color={BrandColors.primary} numberOfLines={1}>
                                {mechanic.shopName}
                            </Text>
                            <Text size="sm" weight="medium" color="#6B7280" numberOfLines={1}>
                                {mechanic.name}
                            </Text>
                            <Text size="xs" weight="regular" color="#9CA3AF">
                                {mechanic.distanceMi} mi
                            </Text>
                        </View>

                        <View style={styles.mechanicBadges}>
                            <View style={styles.ratingBadge}>
                                <Star size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />
                                <Text size="sm" weight="bold" color={BrandColors.primary}>
                                    {mechanic.rating.toFixed(1)}
                                </Text>
                            </View>
                            {mechanic.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <BadgeCheck size={14} color="#10B981" />
                                    <Text size="xs" weight="semiBold" color="#10B981">
                                        Verified
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Date & Time Row */}
                <View style={styles.dateTimeRow}>
                    <View style={styles.dateTimeItem}>
                        <Calendar size={18} color="#6B7280" />
                        <Text size="sm" weight="medium" color={BrandColors.primary}>
                            {appointmentDate}
                        </Text>
                    </View>
                    <View style={styles.dateTimeItem}>
                        <Clock size={18} color="#6B7280" />
                        <Text size="sm" weight="medium" color={BrandColors.primary}>
                            {appointmentTime}
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleAddToCalendar} activeOpacity={0.7}>
                        <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                            Add To Calendar
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryButton} onPress={handleBackToHome} activeOpacity={0.7}>
                        <Text size="sm" weight="semiBold" color={BrandColors.white}>
                            View Booking
                        </Text>
                    </TouchableOpacity>
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
        flex: 1,
        backgroundColor: BrandColors.white,
        justifyContent: "center",
        alignItems: "center",
    },
    contentContainer: {
        width: "100%",
        paddingHorizontal: Spacing.xl,
        alignItems: "center",
    },

    // Success Animation
    successContainer: {
        width: 100,
        height: 100,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: Spacing.lg,
    },
    confettiContainer: {
        position: "absolute",
        width: 100,
        height: 100,
    },
    successCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#10B981",
        alignItems: "center",
        justifyContent: "center",
        ...Shadows.md,
    },

    // Title
    title: {
        marginBottom: Spacing.xl,
        lineHeight: 28,
    },

    // Mechanic Card
    mechanicCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FAFAFA",
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        width: "100%",
        marginBottom: Spacing.lg,
    },
    mechanicAvatar: {
        marginRight: Spacing.md,
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.full,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.full,
        backgroundColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
    },
    mechanicInfo: {
        flex: 1,
        gap: 2,
    },
    mechanicBadges: {
        alignItems: "flex-end",
        gap: 4,
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

    // Date & Time Row
    dateTimeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing["3xl"],
        marginBottom: Spacing.xl,
        width: "100%",
    },
    dateTimeItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },

    // Buttons
    buttonRow: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 1.5,
        borderColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        backgroundColor: BrandColors.secondary,
        alignItems: "center",
        justifyContent: "center",
    },
});

