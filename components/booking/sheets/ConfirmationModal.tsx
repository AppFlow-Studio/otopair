/**
 * ConfirmationModal
 *
 * PURPOSE: Displays booking confirmation as a detached modal overlay
 *          Shows success animation, booking details, and action buttons
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * DESIGN: Floating modal with confetti celebration, mechanic info,
 *         date/time display, and dual action buttons
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
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

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// TYPES
// ============================================================================

export interface ConfirmationModalRef {
  open: () => void;
  close: () => void;
}

interface ConfirmationModalProps {
  /** Called when user presses "Back To Home" */
  onBackToHome: () => void;
  /** Called when user presses "Add To Calendar" */
  onAddToCalendar?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_WIDTH = SCREEN_WIDTH - 48; // 24px margin on each side

// Confetti colors
const CONFETTI_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181", "#AA96DA", "#A8D8EA", "#FCBAD3"];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Animated confetti particle */
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
    // Random end positions
    const endX = (Math.random() - 0.5) * 150;
    const endY = Math.random() * 80 + 40;

    opacity.value = withDelay(delay, withSequence(withTiming(1, { duration: 200 }), withDelay(800, withTiming(0, { duration: 400 }))));
    translateY.value = withDelay(delay, withSpring(-endY, { damping: 8, stiffness: 100 }));
    translateX.value = withDelay(delay, withSpring(endX, { damping: 10, stiffness: 80 }));
    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), 2));
    scale.value = withDelay(delay, withSequence(withSpring(1, { damping: 8 }), withDelay(600, withTiming(0, { duration: 300 }))));
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

/** Confetti explosion effect */
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

/** Success checkmark with animation */
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

/** Compact mechanic info card */
function CompactMechanicCard() {
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  if (!mechanic) return null;

  return (
    <View style={styles.mechanicCard}>
      {/* Avatar */}
      <View style={styles.mechanicAvatar}>
        {mechanic.photoUrl ? (
          <Image source={{ uri: mechanic.photoUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={24} color="#9CA3AF" strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Info */}
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

      {/* Rating & Verified */}
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
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConfirmationModal = forwardRef<ConfirmationModalRef, ConfirmationModalProps>(function ConfirmationModal(
  { onBackToHome, onAddToCalendar },
  ref
) {
  // ═══════════════ REFS ═══════════════
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();

  // ═══════════════ STORES ═══════════════
  const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);

  // ═══════════════ LOCAL STATE ═══════════════
  const [isOpen, setIsOpen] = useState(false);

  // ═══════════════ COMPUTED ═══════════════
  // Format the scheduled date and time, or use defaults
  const appointmentDate = useMemo(() => {
    if (scheduledAppointment?.date) {
      const date = new Date(scheduledAppointment.date);
      return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }
    // Default to a future date
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

  // ═══════════════ IMPERATIVE HANDLE ═══════════════
  useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpen(true);
      bottomSheetModalRef.current?.present();
    },
    close: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  // ═══════════════ HANDLERS ═══════════════
  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setIsOpen(false);
    }
  }, []);

  const handleBackToHome = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onBackToHome();
    // Navigate to home screen
    router.replace("/home");
  }, [onBackToHome, router]);

  const handleAddToCalendar = useCallback(() => {
    onAddToCalendar?.();
  }, [onAddToCalendar]);

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="none"
      />
    ),
    []
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      enablePanDownToClose={false}
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
      onChange={handleSheetChange}
      detached={true}
      bottomInset={SCREEN_HEIGHT * 0.2}
      style={styles.modalStyle}
    >
      <BottomSheetView style={styles.container}>
        {/* Success Animation */}
        {isOpen && <SuccessCheckmark />}

        {/* Title */}
        <Text size="xl" weight="bold" color={BrandColors.primary} center style={styles.title}>
          Thank you! Your booking has{"\n"}been confirmed.
        </Text>

        {/* Mechanic Info Card */}
        <CompactMechanicCard />

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
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToHome} activeOpacity={0.7}>
            <Text size="sm" weight="semiBold" color={BrandColors.primary}>
              Back To Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddToCalendar} activeOpacity={0.7}>
            <Text size="sm" weight="semiBold" color={BrandColors.white}>
              Add To Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  modalStyle: {
    marginHorizontal: 24,
  },
  bottomSheetBackground: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius["2xl"],
    ...Shadows.lg,
  },
  handleContainer: {
    display: "none",
  },
  handleIndicator: {
    display: "none",
  },
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["2xl"],
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

