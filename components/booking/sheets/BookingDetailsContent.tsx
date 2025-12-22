/**
 * BookingDetailsContent
 *
 * PURPOSE: Displays the booking details after user selects "Book Now" or "Schedule For Later"
 *          Shows mechanic info, selected services with remove option, and total
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * PROPS:
 *   - onConfirmBooking (() => void): Called when user confirms the booking [optional]
 *   - onBackPress (() => void): Called when user presses back button [optional]
 *   - onAddMore (() => void): Called when user wants to add more services [optional]
 *
 * EXAMPLE:
 *   <BookingDetailsContent onConfirmBooking={handleConfirm} />
 *
 * OWNER: Waleed Mansour
 * TICKET: OTO-145
 */

// 1. React & React Native
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BadgeCheck, ChevronRight, Clock, MoreVertical, Star, User, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Local components
import { AllAvailabilitySheet, AllAvailabilitySheetRef } from "./AllAvailabilitySheet";
import { AllReviewsSheet, AllReviewsSheetRef } from "./AllReviewsSheet";
import { DiscardServiceModal } from "./DiscardServiceModal";

// 5. Constants, hooks, types
import { BorderRadius, getSheetContentPadding } from "@/constants/theme";
import type { Service } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// CONSTANTS
// ============================================================================

// Note: Footer button is now rendered by ServiceBottomSheet.footerComponent
// This ensures the BottomSheet knows about the footer and adjusts scroll area automatically

// ============================================================================
// TYPES
// ============================================================================

interface BookingDetailsContentProps {
  /** Called when user wants to add more services */
  onAddMore?: () => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Individual service row with price and remove button */
function ServiceRow({ service, onRemove }: { service: Service; onRemove: () => void }) {
  return (
    <View style={styles.serviceRow}>
      <View style={styles.serviceRowLeft}>
        <Text size="md" weight="bold" color={BrandColors.primary}>
          {service.name}
        </Text>
        <Text size="sm" weight="regular" color="#9CA3AF">
          ${service.price}
        </Text>
      </View>
      <TouchableOpacity style={styles.removeButton} onPress={onRemove} activeOpacity={0.7}>
        <X size={18} color={BrandColors.white} />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// MOCK REVIEWS DATA
// ============================================================================

interface Review {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  timeAgo: string;
  text: string;
}

const mockReviews: Review[] = [
  {
    id: "1",
    userName: "Mathew L.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    timeAgo: "2 Mins Ago",
    text: "Consequat velit qui adipisicing sunt do rependerit ad laborum tempor ullamco exercitation. Ullamco tempor adipisicing et voluptate duis sit esse aliqua",
  },
  {
    id: "2",
    userName: "Curt K.",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    rating: 4,
    timeAgo: "2 Mins Ago",
    text: "Consequat velit qui adipisicing sunt do rependerit ad laborum tempor ullamco.",
  },
  {
    id: "3",
    userName: "Ramy J.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    rating: 3,
    timeAgo: "2 Mins Ago",
    text: "Ullamco tempor adipisicing et voluptate duis sit esse aliqua esse ex.",
  },
];

// Rating distribution percentages (for the bar chart)
const ratingDistribution = {
  5: 0.85,
  4: 0.65,
  3: 0.45,
  2: 0.15,
  1: 0.05,
};

/** Star rating display component */
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRatingContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= rating ? BrandColors.secondary : "#E5E7EB"}
          fill={star <= rating ? BrandColors.secondary : "transparent"}
        />
      ))}
    </View>
  );
}

/** Individual review card */
function ReviewCard({ review }: { review: Review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatarContainer}>
          {review.avatarUrl ? (
            <Image source={{ uri: review.avatarUrl }} style={styles.reviewAvatar} />
          ) : (
            <View style={styles.reviewAvatarPlaceholder}>
              <User size={20} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={styles.reviewHeaderInfo}>
          <Text size="sm" weight="bold" color={BrandColors.primary}>
            {review.userName}
          </Text>
          <View style={styles.reviewRatingRow}>
            <StarRating rating={review.rating} size={12} />
            <Text size="xs" weight="regular" color="#9CA3AF">
              {review.timeAgo}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.reviewMenuButton} activeOpacity={0.7}>
          <MoreVertical size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <Text size="sm" weight="regular" color="#6B7280" style={styles.reviewText}>
        {review.text}
      </Text>
    </View>
  );
}

/** Rating distribution bar */
function RatingBar({ stars, percentage }: { stars: number; percentage: number }) {
  return (
    <View style={styles.ratingBarRow}>
      <Text size="xs" weight="medium" color="#6B7280" style={styles.ratingBarLabel}>
        {stars}
      </Text>
      <Star size={10} color={BrandColors.secondary} fill={BrandColors.secondary} />
      <View style={styles.ratingBarTrack}>
        <View style={[styles.ratingBarFill, { width: `${percentage * 100}%` }]} />
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BookingDetailsContent({ onAddMore }: BookingDetailsContentProps) {
  // ═══════════════ REFS ═══════════════
  const allAvailabilityRef = useRef<AllAvailabilitySheetRef>(null);
  const allReviewsRef = useRef<AllReviewsSheetRef>(null);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const contentPadding = getSheetContentPadding(true, insets.bottom);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ LOCAL STATE ═══════════════
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingRemoveServiceId, setPendingRemoveServiceId] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Get selected mechanic
  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  // Get selected services
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds]
  );

  // Compute total from selected services (reactive)
  const totalPrice = useMemo(
    () => selectedServices.reduce((total, service) => total + service.price, 0),
    [selectedServices]
  );

  // Mock rating count based on mechanic rating
  const ratingCount = mechanic ? Math.floor(mechanic.rating * 25 + 27) : 0;

  // ═══════════════ HANDLERS ═══════════════
  const handleAddMore = useCallback(() => {
    onAddMore?.();
  }, [onAddMore]);

  const handleRemoveService = useCallback((serviceId: string) => {
    setPendingRemoveServiceId(serviceId);
    setShowDiscardModal(true);
  }, []);

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

  const handleViewAllAvailability = useCallback(() => {
    if (mechanic?.id) {
      allAvailabilityRef.current?.open(mechanic.id);
    }
  }, [mechanic?.id]);

  const handleAvailabilityConfirm = useCallback(
    (date: Date, time: string) => {
      // Find the slot index that matches the selected date/time
      const dayOfMonth = date.getDate();
      const matchingIndex = mechanic?.nextAvailability?.findIndex(
        (slot) => parseInt(slot.day, 10) === dayOfMonth && slot.time === time
      );
      if (matchingIndex !== undefined && matchingIndex >= 0) {
        setSelectedSlotIndex(matchingIndex);
      }
    },
    [mechanic?.nextAvailability]
  );

  const handleViewAllReviews = useCallback(() => {
    if (mechanic?.id) {
      allReviewsRef.current?.open(mechanic.id);
    }
  }, [mechanic?.id]);

  // ═══════════════ RENDER ═══════════════
  if (!mechanic) {
    return (
      <View style={styles.container}>
        <Text size="md" weight="medium" color="#6B7280" center>
          No mechanic selected
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <BottomSheetScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mechanic Info Section */}
        <View style={styles.mechanicSection}>
          {/* Avatar and Basic Info */}
          <View style={styles.mechanicHeader}>
            <View style={styles.avatarContainer}>
              {mechanic.photoUrl ? (
                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={32} color="#9CA3AF" strokeWidth={1.5} />
                </View>
              )}
            </View>

            <View style={styles.mechanicInfo}>
              <View style={styles.nameRow}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                  {mechanic.shopName}
                </Text>
                <View style={styles.ratingBadge}>
                  <Star size={16} color={BrandColors.secondary} fill={BrandColors.secondary} />
                  <Text size="sm" weight="bold" color={BrandColors.primary}>
                    {mechanic.rating.toFixed(1)}
                  </Text>
                </View>
              </View>

              <Text size="sm" weight="medium" color="#6B7280" style={{ marginBottom: 2 }}>
                {mechanic.name}
              </Text>

              <View style={styles.distanceRow}>
                <Text size="xs" weight="regular" color="#9CA3AF">
                  {mechanic.distanceMi} mi
                </Text>
                {mechanic.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <BadgeCheck size={18} color="#10B981" />
                    <Text size="xs" weight="bold" color="#10B981">
                      Verified
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Services Description */}
          <Text size="sm" weight="regular" color="#6B7280" style={styles.servicesDescription}>
            {mechanic.services.join(", ")}
          </Text>

          {/* Tags Row */}
          <View style={styles.tagsRow}>
            {mechanic.isAvailable && (
              <View style={styles.availableTag}>
                <View style={styles.availableDot} />
                <Text size="xs" weight="medium" color="#374151">
                  Available
                </Text>
              </View>
            )}
            <View style={styles.responseTag}>
              <Text size="xs" weight="medium" color="#6B7280">
                Response Time:
              </Text>
              <Text
                size="xs"
                weight="bold"
                color={
                  mechanic.responseTime === "Quick"
                    ? "#10B981"
                    : mechanic.responseTime === "Normal"
                    ? "#F59E0B"
                    : "#EF4444"
                }
              >
                {mechanic.responseTime}
              </Text>
            </View>
          </View>

          {/* Experience & Rating Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Clock size={20} color={BrandColors.secondary} />
              </View>
              <View style={styles.statTextContainer}>
                <Text size="xs" weight="bold" color="#6B7280">
                  Total Experience
                </Text>
                <Text size="md" weight="bold" color={BrandColors.primary}>
                  {mechanic.yearsExperience < 10 ? `0${mechanic.yearsExperience}` : mechanic.yearsExperience}+ Years
                </Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Star size={20} color={BrandColors.secondary} fill={BrandColors.secondary} />
              </View>
              <View style={styles.statTextContainer}>
                <Text size="xs" weight="bold" color="#6B7280">
                  Rating
                </Text>
                <View style={styles.ratingStatRow}>
                  <Text size="md" weight="bold" color={BrandColors.primary}>
                    {mechanic.rating.toFixed(1)}
                  </Text>
                  <Text size="sm" weight="regular" color="#6B7280">
                    ({ratingCount})
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Selected Services Section */}
        <View style={styles.sectionHeader}>
          <Text size="md" weight="bold" color="#9CA3AF">
            Selected Services ({selectedServices.length})
          </Text>
        </View>

        <View style={styles.servicesContainer}>
          {selectedServices.map((service) => (
            <ServiceRow key={service.id} service={service} onRemove={() => handleRemoveService(service.id)} />
          ))}

          {/* Total and Add More Row */}
          <View style={styles.servicesFooter}>
            <View style={styles.totalBadge}>
              <Text size="md" weight="bold" color="#6B7280">
                In total ${totalPrice}
              </Text>
            </View>
            <TouchableOpacity style={styles.addMoreRowButton} onPress={handleAddMore} activeOpacity={0.7}>
              <Text size="md" weight="bold" color={BrandColors.primary}>
                Add More
              </Text>
              <ChevronRight size={18} color={BrandColors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Next Availability Section */}
        {mechanic.nextAvailability && mechanic.nextAvailability.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text size="md" weight="bold" color="#9CA3AF">
                Next Availability
              </Text>
            </View>
            <View style={styles.availabilitySection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.availabilitySlotsContent}
              >
                {mechanic.nextAvailability.map((slot, index) => {
                  const isSelected = index === selectedSlotIndex;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.availabilitySlot, isSelected && styles.selectedSlot]}
                      onPress={() => setSelectedSlotIndex(index)}
                      activeOpacity={0.7}
                    >
                      <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"}>
                        {slot.dayOfWeek}
                      </Text>
                      <Text size="lg" weight="bold" color={isSelected ? BrandColors.primary : "#374151"}>
                        {slot.day}
                      </Text>
                      <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"}>
                        {slot.time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* View All Availability Button */}
              <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.7} onPress={handleViewAllAvailability}>
                <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                  View All Availability
                </Text>
                <ChevronRight size={18} color={BrandColors.primary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* What Our Customers Are Saying Section */}
        <View style={styles.sectionHeader}>
          <Text size="md" weight="bold" color="#9CA3AF">
            What Our Customers Are Saying
          </Text>
        </View>

        <View style={styles.reviewsSection}>
          {/* Rating Summary Card */}
          <View style={styles.ratingSummaryCard}>
            {/* Rating Distribution Bars */}
            <View style={styles.ratingDistributionContainer}>
              {[5, 4, 3, 2, 1].map((stars) => (
                <RatingBar
                  key={stars}
                  stars={stars}
                  percentage={ratingDistribution[stars as keyof typeof ratingDistribution]}
                />
              ))}
            </View>

            {/* Overall Rating */}
            <View style={styles.overallRatingContainer}>
              <Text size="3xl" weight="bold" color={BrandColors.primary}>
                {mechanic.rating.toFixed(1)}
              </Text>
              <StarRating rating={Math.round(mechanic.rating)} size={16} />
              <Text size="xs" weight="regular" color="#9CA3AF">
                {ratingCount} Reviews
              </Text>
            </View>
          </View>

          {/* Review Cards */}
          {mockReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}

          {/* View All Reviews Button */}
          <TouchableOpacity style={styles.viewAllReviewsButton} activeOpacity={0.7} onPress={handleViewAllReviews}>
            <Text size="sm" weight="semiBold" color={BrandColors.primary}>
              View All Reviews
            </Text>
            <ChevronRight size={18} color={BrandColors.primary} />
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>

      {/* Discard Service Confirmation Modal */}
      <DiscardServiceModal
        visible={showDiscardModal}
        onClose={handleCloseDiscardModal}
        onConfirm={handleConfirmRemove}
      />

      {/* All Availability Sheet */}
      <AllAvailabilitySheet ref={allAvailabilityRef} onConfirm={handleAvailabilityConfirm} />

      {/* All Reviews Sheet */}
      <AllReviewsSheet ref={allReviewsRef} />
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },

  // Mechanic Section
  mechanicSection: {
    marginBottom: Spacing.lg,
  },
  mechanicHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: Spacing.md,
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
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  mechanicInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  servicesDescription: {
    marginTop: Spacing.lg,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  availableTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  responseTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EBF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statTextContainer: {
    flex: 1,
    gap: 2,
  },
  ratingStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // Shared Section Header
  sectionHeader: {
    marginBottom: Spacing.md,
  },

  // Selected Services
  servicesContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  serviceRowLeft: {
    flex: 1,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary,
    alignItems: "center",
    justifyContent: "center",
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

  // Next Availability Section
  availabilitySection: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  availabilitySlotsContent: {
    gap: Spacing.sm,
  },
  availabilitySlot: {
    width: 80,
    alignItems: "center",
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedSlot: {
    backgroundColor: "#F0F7FF",
    borderColor: BrandColors.secondary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    gap: 4,
  },

  // Customer Reviews Section
  reviewsSection: {
    marginBottom: Spacing.xl,
  },
  ratingSummaryCard: {
    flexDirection: "row",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  ratingDistributionContainer: {
    flex: 1,
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingBarLabel: {
    width: 12,
    textAlign: "right",
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  ratingBarFill: {
    height: "100%",
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full,
  },
  overallRatingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: Spacing.lg,
    minWidth: 80,
  },
  starRatingContainer: {
    flexDirection: "row",
    gap: 2,
    marginVertical: 4,
  },
  reviewCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  reviewAvatarContainer: {
    marginRight: Spacing.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
  },
  reviewAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewHeaderInfo: {
    flex: 1,
  },
  reviewRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  reviewMenuButton: {
    padding: 4,
  },
  reviewText: {
    lineHeight: 20,
  },
  viewAllReviewsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    gap: 4,
  },
});
