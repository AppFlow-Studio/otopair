/**
 * BookingDetailsSheet
 *
 * PURPOSE: Bottom sheet showing full booking details when "View Details" is pressed.
 *          Matches the floating-card style used in the My Cars screen.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { Calendar, Car, Clock, User, Wrench, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import type { Booking } from "./BookingCard";

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;

// ============================================================================
// TYPES
// ============================================================================

export interface BookingDetailsSheetRef {
  open: (booking: Booking) => void;
  close: () => void;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: "Pending", bgColor: "#fff6ee", textColor: "#f89829" },
  confirmed: { label: "Confirmed", bgColor: "#e8f5e9", textColor: "#4CAF50" },
  in_progress: { label: "In Progress", bgColor: "#E0E7FF", textColor: "#4F46E5" },
  completed: { label: "Completed", bgColor: "#f0fcf5", textColor: "#60d17e" },
  cancelled: { label: "Cancelled", bgColor: "#FEE2E2", textColor: "#DC2626" },
  delayed: { label: "Delayed", bgColor: "#FEF3C7", textColor: "#D97706" },
};

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BookingDetailsSheet = forwardRef<BookingDetailsSheetRef>((_props, ref) => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);

  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(SHEET_HEIGHT);

  const open = useCallback((b: Booking) => {
    setBooking(b);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 250 });
    setTimeout(() => setVisible(false), 300);
  }, [backdropOpacity, translateY]);

  useImperativeHandle(ref, () => ({ open, close }));

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 400 });
      translateY.value = withTiming(0, { duration: 450 });
    }
  }, [visible, backdropOpacity, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!booking) return null;

  const statusConfig = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text size="xl" weight="semiBold" color="#1F2937">
            Booking Details
          </Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text weight="semiBold" size="sm" color={statusConfig.textColor}>
              {statusConfig.label}
            </Text>
          </View>

          {/* Services */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Wrench size={18} color={BrandColors.secondary} />
              <Text size="md" weight="bold" color={BrandColors.primary}>
                Services
              </Text>
            </View>
            {booking.services.map((service, i) => (
              <View key={i} style={styles.serviceRow}>
                <View style={styles.serviceDot} />
                <Text size="md" weight="medium" color="#374151">
                  {service}
                </Text>
              </View>
            ))}
          </View>

          {/* Vehicle */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.vehicleImageContainer}>
                {booking.makeLogoUrl?.trim() ? (
                  <Image source={{ uri: booking.makeLogoUrl }} style={styles.vehicleImage} resizeMode="contain" />
                ) : (
                  <Car size={28} color="#9CA3AF" />
                )}
              </View>
              <View style={styles.cardContent}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                  {titleCase(booking.carModel)}
                </Text>
                {booking.carYear ? (
                  <Text size="sm" weight="regular" color="#6B7280">
                    {booking.carYear}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Mechanic & Shop */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.mechanicAvatarContainer}>
                {booking.mechanicImage ? (
                  <Image source={{ uri: booking.mechanicImage }} style={styles.mechanicAvatar} />
                ) : (
                  <User size={24} color="#9CA3AF" />
                )}
              </View>
              <View style={styles.cardContent}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                  {booking.mechanicName}
                </Text>
                <Text size="sm" weight="regular" color="#6B7280">
                  {booking.shopName}
                </Text>
              </View>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Calendar size={18} color={BrandColors.secondary} />
              </View>
              <View>
                <Text size="xs" weight="bold" color="#9CA3AF">
                  DATE
                </Text>
                <Text size="md" weight="semiBold" color={BrandColors.primary}>
                  {booking.date}
                </Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Clock size={18} color={BrandColors.secondary} />
              </View>
              <View>
                <Text size="xs" weight="bold" color="#9CA3AF">
                  TIME
                </Text>
                <Text size="md" weight="semiBold" color={BrandColors.primary}>
                  {booking.time}
                </Text>
              </View>
            </View>
          </View>

          {/* Total Cost */}
          {booking.totalCost != null && (
            <View style={styles.costCard}>
              <Text size="sm" weight="medium" color="#6B7280">
                Total Cost
              </Text>
              <Text size="2xl" weight="bold" color={BrandColors.primary}>
                ${booking.totalCost.toFixed(2)}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
});

BookingDetailsSheet.displayName = "BookingDetailsSheet";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    height: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  content: {
    paddingTop: Spacing.sm,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: 8,
  },
  serviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.secondary,
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  vehicleImageContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vehicleImage: {
    width: 56,
    height: 56,
  },
  mechanicAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mechanicAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  detailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  costCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
