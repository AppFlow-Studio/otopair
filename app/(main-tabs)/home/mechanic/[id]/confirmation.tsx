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
import { Alert, Image, Platform, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";

// 2. Expo & Third-party
import * as Calendar from "expo-calendar";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { useShopStore } from "@/stores/useShopStore";
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

function SuccessCheckmark({ compact = false, veryCompact = false }: { compact?: boolean; veryCompact?: boolean }) {
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

  const checkIconSize = veryCompact ? 26 : compact ? 28 : 32;

  return (
    <View style={[styles.successContainer, compact && styles.successContainerCompact, veryCompact && styles.successContainerVeryCompact]}>
      <ConfettiExplosion />
      <Animated.View
        style={[
          styles.successCircle,
          compact && styles.successCircleCompact,
          veryCompact && styles.successCircleVeryCompact,
          circleStyle,
        ]}
      >
        <Animated.View style={checkStyle}>
          <Check size={checkIconSize} color="#FFFFFF" strokeWidth={3} />
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
  const { height: windowHeight } = useWindowDimensions();
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const isCompactLayout = windowHeight < 860;
  const isVeryCompactLayout = windowHeight < 760;

  // ═══════════════ STORES ═══════════════
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);
  const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
  const getBookingById = useBookingStore((state) => state.getBookingById);
  const availableServices = useBookingStore((state) => state.availableServices);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const getSelectedVehicle = useVehicleStore((state) => state.getSelectedVehicle);
  const getShopById = useShopStore((state) => state.getShopById);

  // Look up local booking by route param (fallback when booking flow is reset)
  const localBooking = useMemo(() => {
    if (!bookingId) return null;
    return getBookingById(bookingId);
  }, [bookingId, getBookingById]);

  // ═══════════════ COMPUTED ═══════════════
  const mechanic = useMemo(() => {
    // Try active flow state first
    if (selectedMechanicId) return getMechanicById(selectedMechanicId) ?? null;
    // Fallback: look up mechanic from local booking's shop
    if (localBooking?.shopId) {
      const mechanics = getMechanicsByShopId(localBooking.shopId);
      if (mechanics.length > 0) return mechanics[0];
    }
    return null;
  }, [selectedMechanicId, getMechanicById, localBooking, getMechanicsByShopId]);

  // Shop from DB (for address, phone, name)
  // Only query Convex if shopId looks like a real Convex ID (not a mock like "1", "2")
  const rawShopId = selectedMechanicSlot?.shopId ?? localBooking?.shopId ?? (mechanic?.shopId as string | undefined);
  const isConvexId = rawShopId && rawShopId.length > 10;
  const shop = useQuery(api.shops.getById, isConvexId ? { id: rawShopId as Id<"shops"> } : "skip");

  // Fallback to local shop store for mock IDs
  const localShop = useMemo(() => {
    if (shop) return null; // Convex shop found, no need for local
    if (!rawShopId) return null;
    return getShopById(rawShopId);
  }, [shop, rawShopId, getShopById]);

  const getVehicleById = useVehicleStore((state) => state.getVehicleById);

  // Try selected vehicle first, then look up by booking's vehicleId
  const selectedVehicle = useMemo(() => {
    const active = getSelectedVehicle();
    if (active) return active;
    if (localBooking?.vehicleId) return getVehicleById(localBooking.vehicleId);
    return undefined;
  }, [getSelectedVehicle, localBooking, getVehicleById]);

  const fullAddress = useMemo(() => {
    if (shop) return [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(", ");
    if (localShop?.address) return localShop.address;
    return "";
  }, [shop, localShop]);

  // Format date with day name (e.g., "Fri, Oct 24")
  const formattedDate = useMemo(() => {
    const dateStr = scheduledAppointment?.date ?? localBooking?.scheduledDate;
    if (dateStr) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dayNames[futureDate.getDay()]}, ${monthNames[futureDate.getMonth()]} ${futureDate.getDate()}`;
  }, [scheduledAppointment, localBooking]);

  // Format time (e.g., "10:00 AM")
  const formattedTime = useMemo(() => {
    if (scheduledAppointment?.time) return scheduledAppointment.time;
    if (localBooking?.scheduledTime) return localBooking.scheduledTime;
    return "1:00 PM";
  }, [scheduledAppointment, localBooking]);

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  const shopLocation = fullAddress || shop?.name || localShop?.name || mechanic?.shopName || "Shop Location";

  // ═══════════════ HANDLERS ═══════════════
  // If we're viewing a past booking (local booking exists, flow already reset), just go back
  const isViewingPastBooking = !!localBooking && !selectedMechanicId;

  const handleBackToHome = useCallback(() => {
    if (isViewingPastBooking) {
      router.back();
    } else {
      router.dismissTo("/home");
      resetBookingFlow();
    }
  }, [isViewingPastBooking, resetBookingFlow, router]);

  const handleDirections = useCallback(() => {
    if (fullAddress) openMapsForAddress(fullAddress);
  }, [fullAddress]);

  const handleContact = useCallback(() => {
    if (shop?.phone) openPhone(shop.phone);
  }, [shop?.phone]);

  const handleAddToCalendar = useCallback(async () => {
    const shopName = shop?.name ?? localShop?.name ?? mechanic?.shopName ?? "Shop";
    const dateStr = scheduledAppointment?.date ?? localBooking?.scheduledDate;
    const timeStr = scheduledAppointment?.time ?? localBooking?.scheduledTime ?? "2:00 PM";
    if (!dateStr) {
      Alert.alert("No date", "Appointment date is missing.");
      return;
    }
    try {
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
      const eventDetails = {
        title: `Service at ${shopName}`,
        startDate,
        endDate,
        location: fullAddress || undefined,
        notes: mechanic?.name ? `Appointment with ${mechanic.name}` : undefined,
      };

      if (Platform.OS === "android") {
        await Calendar.createEventInCalendarAsync(eventDetails, {
          startNewActivityTask: false,
        });
        return;
      }

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
      await Calendar.createEventAsync(calendarId, eventDetails);
      Alert.alert("Added", "Appointment added to your calendar.");
    } catch (e) {
      if (Platform.OS === "web") {
        Alert.alert("Not supported", "Adding to calendar is not supported on web.");
        return;
      }
      Alert.alert("Error", "Could not add to calendar. Please try again.");
    }
  }, [shop?.name, localShop?.name, mechanic?.name, mechanic?.shopName, scheduledAppointment?.date, scheduledAppointment?.time, localBooking, fullAddress]);

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isCompactLayout && styles.scrollContentCompact,
          isVeryCompactLayout && styles.scrollContentVeryCompact,
          {
            minHeight: windowHeight,
            paddingTop: insets.top + (isVeryCompactLayout ? Spacing.sm : isCompactLayout ? Spacing.md : Spacing.lg),
            paddingBottom: insets.bottom + (isVeryCompactLayout ? Spacing.xl : Spacing["3xl"]),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content */}
        <View style={[styles.content, isCompactLayout && styles.contentCompact, isVeryCompactLayout && styles.contentVeryCompact]}>
          {/* Success Animation */}
          <SuccessCheckmark compact={isCompactLayout} veryCompact={isVeryCompactLayout} />

          {/* Title */}
          <Text
            size={isVeryCompactLayout ? "xl" : "2xl"}
            weight="bold"
            color={BrandColors.primary}
            center
            style={[styles.title, isCompactLayout && styles.titleCompact]}
          >
            You&apos;re all set!
          </Text>

          {/* Subtitle */}
          <Text
            size={isVeryCompactLayout ? "sm" : "md"}
            weight="regular"
            color="#6B7280"
            center
            style={[styles.subtitle, isCompactLayout && styles.subtitleCompact, isVeryCompactLayout && styles.subtitleVeryCompact]}
          >
            Your appointment with {mechanic?.name || "your mechanic"} is{"\n"}confirmed.
          </Text>

          {/* Mechanic Card - Matching Payment Screen Style */}
          {mechanic && (
            <View style={[styles.mechanicCard, isCompactLayout && styles.mechanicCardCompact, isVeryCompactLayout && styles.mechanicCardVeryCompact]}>
              {/* Mechanic Info Row */}
              <View style={[styles.mechanicRow, isCompactLayout && styles.mechanicRowCompact]}>
                <View style={styles.avatarWrapper}>
                  {mechanic.photoUrl ? (
                    <Image source={{ uri: mechanic.photoUrl }} style={[styles.avatar, isCompactLayout && styles.avatarCompact]} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, isCompactLayout && styles.avatarCompact]}>
                      <Text size={isVeryCompactLayout ? "lg" : "xl"} weight="bold" color="#9CA3AF">
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
              <View style={[styles.cardDivider, isCompactLayout && styles.cardDividerCompact]} />

              {/* Details Grid - 2x2 Layout */}
              <View style={[styles.detailsGrid, isCompactLayout && styles.detailsGridCompact]}>
                {/* Row 1: DATE and TIME */}
                <View style={[styles.detailsGridRow, isCompactLayout && styles.detailsGridRowCompact]}>
                  <View style={styles.detailsGridItem}>
                    <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                      DATE
                    </Text>
                    <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="medium" color={BrandColors.primary}>
                      {formattedDate}
                    </Text>
                  </View>
                  <View style={styles.detailsGridItem}>
                    <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                      TIME
                    </Text>
                    <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="medium" color={BrandColors.primary}>
                      {formattedTime}
                    </Text>
                  </View>
                </View>

                {/* Row 2: LOCATION and VEHICLE */}
                <View style={[styles.detailsGridRow, isCompactLayout && styles.detailsGridRowCompact]}>
                  <View style={styles.detailsGridItem}>
                    <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                      LOCATION
                    </Text>
                    <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="medium" color={BrandColors.primary}>
                      {shopLocation}
                    </Text>
                  </View>
                  <View style={styles.detailsGridItem}>
                    <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                      VEHICLE
                    </Text>
                    <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="medium" color={BrandColors.primary}>
                      {vehicleDisplay}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={[styles.cardDivider, isCompactLayout && styles.cardDividerCompact]} />

              {/* Action Buttons Row */}
              <View style={[styles.actionButtonsRow, isCompactLayout && styles.actionButtonsRowCompact]}>
                <TouchableOpacity
                  style={[styles.actionButton, isCompactLayout && styles.actionButtonCompact]}
                  activeOpacity={0.7}
                  onPress={handleDirections}
                  disabled={!fullAddress}
                >
                  <Navigation
                    size={16}
                    color={fullAddress ? "#6B7280" : "#9CA3AF"}
                    fill={fullAddress ? "#6B7280" : "#9CA3AF"}
                  />
                  <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="medium" color={fullAddress ? "#6B7280" : "#9CA3AF"}>
                    Directions
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, isCompactLayout && styles.actionButtonCompact]}
                  activeOpacity={0.7}
                  onPress={handleContact}
                  disabled={!shop?.phone}
                >
                  <Phone
                    size={16}
                    color={shop?.phone ? "#6B7280" : "#9CA3AF"}
                    fill={shop?.phone ? "#6B7280" : "#9CA3AF"}
                  />
                  <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="medium" color={shop?.phone ? "#6B7280" : "#9CA3AF"}>
                    Contact
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Ownership Credit Section */}
          <View style={[styles.ownershipCreditCard, isCompactLayout && styles.ownershipCreditCardCompact]}>
            <View style={[styles.ownershipLeft, isCompactLayout && styles.ownershipLeftCompact]}>
              <View style={[styles.giftIconContainer, isCompactLayout && styles.giftIconContainerCompact]}>
                <Gift size={20} color={BrandColors.secondary} />
              </View>
              <View style={styles.ownershipContent}>
                <Text size={isVeryCompactLayout ? "sm" : "md"} weight="semiBold" color={BrandColors.secondary}>
                  +${OWNERSHIP_CREDIT_EARNED.toFixed(2)} Ownership Credit
                </Text>
                <Text size={isVeryCompactLayout ? "xs" : "sm"} weight="regular" color="#6B7280">
                  Added to your rewards
                </Text>
              </View>
            </View>
            <View style={styles.ownershipRight}>
              <Text size="xs" weight="medium" color="#6B7280">
                BALANCE
              </Text>
              <Text size={isVeryCompactLayout ? "md" : "lg"} weight="bold" color={BrandColors.secondary}>
                ${OWNERSHIP_BALANCE.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Add to Calendar Button */}
          <TouchableOpacity
            style={[styles.calendarButton, isCompactLayout && styles.calendarButtonCompact]}
            onPress={handleAddToCalendar}
            activeOpacity={0.8}
          >
            <Text size={isVeryCompactLayout ? "sm" : "md"} weight="semiBold" color={BrandColors.white}>
              Add to Calendar
            </Text>
          </TouchableOpacity>

          {/* Back to Home Link */}
          <TouchableOpacity style={[styles.backToHomeButton, isCompactLayout && styles.backToHomeButtonCompact]} onPress={handleBackToHome} activeOpacity={0.7}>
            <Text size={isVeryCompactLayout ? "sm" : "md"} weight="medium" color={BrandColors.secondary}>
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  scrollContentCompact: {
    paddingHorizontal: Spacing.md,
  },
  scrollContentVeryCompact: {
    paddingHorizontal: Spacing.sm,
  },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  contentCompact: {
    justifyContent: "flex-start",
  },
  contentVeryCompact: {
    justifyContent: "flex-start",
  },

  // Success Animation
  successContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  successContainerCompact: {
    width: 72,
    height: 72,
    marginBottom: Spacing.sm,
  },
  successContainerVeryCompact: {
    width: 64,
    height: 64,
    marginBottom: Spacing.xs,
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
  successCircleCompact: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  successCircleVeryCompact: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  // Title & Subtitle
  title: {
    marginBottom: Spacing.sm,
  },
  titleCompact: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  subtitleCompact: {
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  subtitleVeryCompact: {
    marginBottom: Spacing.md,
    lineHeight: 18,
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
  mechanicCardCompact: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  mechanicCardVeryCompact: {
    padding: Spacing.sm + 2,
  },
  mechanicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  mechanicRowCompact: {
    gap: Spacing.sm,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
  },
  avatarCompact: {
    width: 56,
    height: 56,
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
  cardDividerCompact: {
    marginVertical: Spacing.md,
  },

  // Details Grid - 2x2 Layout
  detailsGrid: {
    gap: Spacing.md,
  },
  detailsGridCompact: {
    gap: Spacing.sm,
  },
  detailsGridRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  detailsGridRowCompact: {
    gap: Spacing.sm,
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
  actionButtonsRowCompact: {
    gap: Spacing.sm,
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
  actionButtonCompact: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
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
  ownershipCreditCardCompact: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  ownershipLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  ownershipLeftCompact: {
    gap: Spacing.sm,
  },
  giftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  giftIconContainerCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  calendarButtonCompact: {
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  backToHomeButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  backToHomeButtonCompact: {
    paddingVertical: Spacing.sm,
  },
});
