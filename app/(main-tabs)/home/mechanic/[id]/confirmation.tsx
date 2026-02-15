/**
 * Confirmation Screen
 *
 * PURPOSE: Full-screen confirmation page after successful booking.
 *          Shows success animation, booking details card, ownership credit, and action buttons.
 *          Styled to match the payment screen design.
 *
 * FLOW: mechanic detail → booking-details → payment → confirmation
 *
 * ROUTE: /home/mechanic/[id]/confirmation
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo } from "react";
import { Alert, Image, Platform, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import * as Calendar from "expo-calendar";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Check, Gift, Navigation, Phone, Star } from "lucide-react-native";
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
import { useQuery } from "convex/react";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BorderRadius, Shadows } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { openMapsForAddress, openPhone } from "@/utils/linking";

// ============================================================================
// CONSTANTS
// ============================================================================

const CONFETTI_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181", "#AA96DA", "#A8D8EA", "#FCBAD3"];

// Mock ownership credit data (in production, this would come from a user/rewards store)
const OWNERSHIP_CREDIT_EARNED = 1.51;
const OWNERSHIP_BALANCE = 27.51;

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
      withSequence(withTiming(1, { duration: 200 }), withDelay(800, withTiming(0, { duration: 400 }))),
    );
    translateY.value = withDelay(delay, withSpring(-endY, { damping: 8, stiffness: 100 }));
    translateX.value = withDelay(delay, withSpring(endX, { damping: 10, stiffness: 80 }));
    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), 2));
    scale.value = withDelay(
      delay,
      withSequence(withSpring(1, { damping: 8 }), withDelay(600, withTiming(0, { duration: 300 }))),
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
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 200,
      startX: 32 + Math.random() * 16,
      startY: 32 + Math.random() * 16,
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
          <Check size={32} color="#FFFFFF" strokeWidth={3} />
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
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);
  const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);
  const getSelectedVehicle = useVehicleStore((state) => state.getSelectedVehicle);

  // ═══════════════ COMPUTED ═══════════════
  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  // Shop from DB (for address, phone, name)
  const shopId = selectedMechanicSlot?.shopId ?? (mechanic?.shopId as Id<"shops"> | undefined);
  const shop = useQuery(api.shops.getById, shopId ? { id: shopId as Id<"shops"> } : "skip");

  const selectedVehicle = getSelectedVehicle();

  const fullAddress = useMemo(() => {
    if (!shop) return "";
    return [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(", ");
  }, [shop]);

  // Format date with day name (e.g., "Fri, Oct 24")
  const formattedDate = useMemo(() => {
    if (scheduledAppointment?.date) {
      const date = new Date(scheduledAppointment.date);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dayNames[futureDate.getDay()]}, ${monthNames[futureDate.getMonth()]} ${futureDate.getDate()}`;
  }, [scheduledAppointment]);

  // Format time (e.g., "10:00 AM")
  const formattedTime = useMemo(() => {
    if (scheduledAppointment?.time) {
      return scheduledAppointment.time;
    }
    return "1:00 PM";
  }, [scheduledAppointment]);

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  const shopLocation = fullAddress || mechanic?.shopName || "Shop Location";

  // ═══════════════ HANDLERS ═══════════════
  const handleBackToHome = useCallback(() => {
    router.dismissTo("/home");
    resetBookingFlow();
  }, [resetBookingFlow, router]);

  const handleDirections = useCallback(() => {
    if (fullAddress) openMapsForAddress(fullAddress);
  }, [fullAddress]);

  const handleContact = useCallback(() => {
    if (shop?.phone) openPhone(shop.phone);
  }, [shop?.phone]);

  const handleAddToCalendar = useCallback(async () => {
    const shopName = shop?.name ?? mechanic?.shopName ?? "Shop";
    const dateStr = scheduledAppointment?.date;
    const timeStr = scheduledAppointment?.time ?? "2:00 PM";
    if (!dateStr) {
      Alert.alert("No date", "Appointment date is missing.");
      return;
    }
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Calendar access", "Calendar permission is required to add the appointment.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = calendars.filter((c) => c.allowsModifications !== false);
      const calendarId = writable[0]?.id ?? calendars[0]?.id;
      if (!calendarId) {
        Alert.alert("Calendar", "No calendar available to add the event.");
        return;
      }
      const [year, month, day] = dateStr.split("-").map(Number);
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      let hour = 14;
      let minute = 0;
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
        if ((timeMatch[3] ?? "").toUpperCase() === "PM" && hour < 12) hour += 12;
        if ((timeMatch[3] ?? "").toUpperCase() === "AM" && hour === 12) hour = 0;
      }
      const startDate = new Date(year, month - 1, day, hour, minute, 0, 0);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      await Calendar.createEventAsync(calendarId, {
        title: `Service at ${shopName}`,
        startDate,
        endDate,
        location: fullAddress || undefined,
      });
      Alert.alert("Added", "Appointment added to your calendar.");
    } catch (e) {
      if (Platform.OS === "web") {
        Alert.alert("Not supported", "Adding to calendar is not supported on web.");
        return;
      }
      Alert.alert("Error", "Could not add to calendar. Please try again.");
    }
  }, [shop?.name, mechanic?.shopName, scheduledAppointment?.date, scheduledAppointment?.time, fullAddress]);

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Main Content */}
      <View style={styles.content}>
        {/* Success Animation */}
        <SuccessCheckmark />

        {/* Title */}
        <Text size="2xl" weight="bold" color={BrandColors.primary} center style={styles.title}>
          You're all set.
        </Text>

        {/* Subtitle */}
        <Text size="md" weight="regular" color="#6B7280" center style={styles.subtitle}>
          Your appointment with {mechanic?.name || "your mechanic"} is{"\n"}confirmed.
        </Text>

        {/* Mechanic Card - Matching Payment Screen Style */}
        {mechanic && (
          <View style={styles.mechanicCard}>
            {/* Mechanic Info Row */}
            <View style={styles.mechanicRow}>
              <View style={styles.avatarWrapper}>
                {mechanic.photoUrl ? (
                  <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text size="xl" weight="bold" color="#9CA3AF">
                      {mechanic.name.charAt(0)}
                    </Text>
                  </View>
                )}
                {/* Rating Badge */}
                <View style={styles.ratingBadge}>
                  <Star size={10} color="#FCD34D" fill="#FCD34D" />
                  <Text size="xs" weight="bold" color={BrandColors.white}>
                    {mechanic.rating.toFixed(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.mechanicInfo}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                  {mechanic.name}
                </Text>
                <Text size="sm" weight="medium" color="#6B7280">
                  {mechanic.title ?? mechanic.shopName}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.cardDivider} />

            {/* Details Grid - 2x2 Layout */}
            <View style={styles.detailsGrid}>
              {/* Row 1: DATE and TIME */}
              <View style={styles.detailsGridRow}>
                <View style={styles.detailsGridItem}>
                  <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                    DATE
                  </Text>
                  <Text size="sm" weight="medium" color={BrandColors.primary}>
                    {formattedDate}
                  </Text>
                </View>
                <View style={styles.detailsGridItem}>
                  <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                    TIME
                  </Text>
                  <Text size="sm" weight="medium" color={BrandColors.primary}>
                    {formattedTime}
                  </Text>
                </View>
              </View>

              {/* Row 2: LOCATION and VEHICLE */}
              <View style={styles.detailsGridRow}>
                <View style={styles.detailsGridItem}>
                  <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                    LOCATION
                  </Text>
                  <Text size="sm" weight="medium" color={BrandColors.primary}>
                    {shopLocation}
                  </Text>
                </View>
                <View style={styles.detailsGridItem}>
                  <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                    VEHICLE
                  </Text>
                  <Text size="sm" weight="medium" color={BrandColors.primary}>
                    {vehicleDisplay}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.cardDivider} />

            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={handleDirections}
                disabled={!fullAddress}
              >
                <Navigation
                  size={16}
                  color={fullAddress ? "#6B7280" : "#9CA3AF"}
                  fill={fullAddress ? "#6B7280" : "#9CA3AF"}
                />
                <Text size="sm" weight="medium" color={fullAddress ? "#6B7280" : "#9CA3AF"}>
                  Directions
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={handleContact}
                disabled={!shop?.phone}
              >
                <Phone
                  size={16}
                  color={shop?.phone ? "#6B7280" : "#9CA3AF"}
                  fill={shop?.phone ? "#6B7280" : "#9CA3AF"}
                />
                <Text size="sm" weight="medium" color={shop?.phone ? "#6B7280" : "#9CA3AF"}>
                  Contact
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Ownership Credit Section */}
        <View style={styles.ownershipCreditCard}>
          <View style={styles.ownershipLeft}>
            <View style={styles.giftIconContainer}>
              <Gift size={20} color={BrandColors.secondary} />
            </View>
            <View style={styles.ownershipContent}>
              <Text size="md" weight="semiBold" color={BrandColors.secondary}>
                +${OWNERSHIP_CREDIT_EARNED.toFixed(2)} Ownership Credit
              </Text>
              <Text size="sm" weight="regular" color="#6B7280">
                Added to your rewards
              </Text>
            </View>
          </View>
          <View style={styles.ownershipRight}>
            <Text size="xs" weight="medium" color="#6B7280">
              BALANCE
            </Text>
            <Text size="lg" weight="bold" color={BrandColors.secondary}>
              ${OWNERSHIP_BALANCE.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Add to Calendar Button */}
        <TouchableOpacity style={styles.calendarButton} onPress={handleAddToCalendar} activeOpacity={0.8}>
          <Text size="md" weight="semiBold" color={BrandColors.white}>
            Add to Calendar
          </Text>
        </TouchableOpacity>

        {/* Back to Home Link */}
        <TouchableOpacity style={styles.backToHomeButton} onPress={handleBackToHome} activeOpacity={0.7}>
          <Text size="md" weight="medium" color={BrandColors.secondary}>
            Back to Home
          </Text>
        </TouchableOpacity>
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
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    alignItems: "center",
  },

  // Success Animation
  successContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  confettiContainer: {
    position: "absolute",
    width: 80,
    height: 80,
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },

  // Title & Subtitle
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },

  // Mechanic Card - Matching Payment Screen
  mechanicCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: "100%",
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  mechanicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: -4,
    left: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: BrandColors.white,
  },
  mechanicInfo: {
    flex: 1,
    gap: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.lg,
  },

  // Details Grid - 2x2 Layout
  detailsGrid: {
    gap: Spacing.md,
  },
  detailsGridRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  detailsGridItem: {
    flex: 1,
    gap: Spacing.xs,
  },
  detailLabel: {
    letterSpacing: 0.5,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  // Ownership Credit Card
  ownershipCreditCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: "100%",
    marginBottom: Spacing.xl,
  },
  ownershipLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  giftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  ownershipContent: {
    flex: 1,
    gap: 2,
  },
  ownershipRight: {
    alignItems: "flex-end",
    gap: 2,
  },

  // Buttons
  calendarButton: {
    backgroundColor: BrandColors.secondary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  backToHomeButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
});
