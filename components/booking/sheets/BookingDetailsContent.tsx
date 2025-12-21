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
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BadgeCheck, ChevronRight, Clock, Star, User, X } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius } from "@/constants/theme";
import type { Service } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// TYPES
// ============================================================================

interface BookingDetailsContentProps {
  /** Called when user confirms the booking */
  onConfirmBooking?: () => void;
  /** Called when user presses back button */
  onBackPress?: () => void;
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
        <Text size="md" weight="medium" color={BrandColors.primary}>
          {service.name}
        </Text>
        <Text size="sm" weight="regular" color="#9CA3AF">
          ${service.price}
        </Text>
      </View>
      <TouchableOpacity style={styles.removeButton} onPress={onRemove} activeOpacity={0.7}>
        <X size={16} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BookingDetailsContent({ onConfirmBooking, onBackPress, onAddMore }: BookingDetailsContentProps) {
  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const bookingType = useBookingStore((state) => state.bookingType);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const prevBookingStage = useBookingStore((state) => state.prevBookingStage);
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

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

  const totalPrice = getSelectedServicesTotal();
  const buttonText = bookingType === "schedule_later" ? "Schedule For Later" : "Book Appointment";

  // Mock rating count based on mechanic rating
  const ratingCount = mechanic ? Math.floor(mechanic.rating * 25 + 27) : 0;

  // ═══════════════ HANDLERS ═══════════════
  const handleBackPress = useCallback(() => {
    if (onBackPress) {
      onBackPress();
    } else {
      prevBookingStage();
    }
  }, [onBackPress, prevBookingStage]);

  const handleConfirmBooking = useCallback(() => {
    onConfirmBooking?.();
  }, [onConfirmBooking]);

  const handleAddMore = useCallback(() => {
    if (onAddMore) {
      onAddMore();
    } else {
      // Go back to service selection
      prevBookingStage();
      prevBookingStage();
    }
  }, [onAddMore, prevBookingStage]);

  const handleRemoveService = useCallback(
    (serviceId: string) => {
      toggleServiceSelection(serviceId);
    },
    [toggleServiceSelection]
  );

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
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Mechanic Info Section */}
        <View style={styles.mechanicSection}>
          {/* Avatar and Basic Info */}
          <View style={styles.mechanicHeader}>
            <View style={styles.avatarContainer}>
              {mechanic.photoUrl ? (
                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={28} color="#9CA3AF" strokeWidth={1.5} />
                </View>
              )}
            </View>

            <View style={styles.mechanicInfo}>
              <View style={styles.nameRow}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                  {mechanic.shopName}
                </Text>
                <View style={styles.ratingVerifiedRow}>
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

              <Text size="sm" weight="medium" color={BrandColors.secondary}>
                {mechanic.name}
              </Text>

              <Text size="xs" weight="regular" color={BrandColors.secondary}>
                {mechanic.distanceMi} mi
              </Text>
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
                weight="semiBold"
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
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Clock size={16} color={BrandColors.secondary} />
              </View>
              <View style={styles.statTextContainer}>
                <Text size="xs" weight="regular" color="#9CA3AF">
                  Total Experience
                </Text>
                <Text size="md" weight="bold" color={BrandColors.primary}>
                  {mechanic.yearsExperience < 10 ? `0${mechanic.yearsExperience}` : mechanic.yearsExperience}+ Years
                </Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Star size={16} color={BrandColors.secondary} fill={BrandColors.secondary} />
              </View>
              <View style={styles.statTextContainer}>
                <Text size="xs" weight="regular" color="#9CA3AF">
                  Rating
                </Text>
                <View style={styles.ratingStatRow}>
                  <Text size="md" weight="bold" color={BrandColors.primary}>
                    {mechanic.rating.toFixed(1)}
                  </Text>
                  <Text size="sm" weight="regular" color="#9CA3AF">
                    ({ratingCount})
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Selected Services Section */}
        <View style={styles.section}>
          <Text size="md" weight="semiBold" color={BrandColors.primary} style={styles.sectionTitle}>
            Selected Services ({selectedServices.length})
          </Text>

          {selectedServices.map((service) => (
            <ServiceRow key={service.id} service={service} onRemove={() => handleRemoveService(service.id)} />
          ))}

          {/* Total and Add More */}
          <View style={styles.totalRow}>
            <Text size="md" weight="bold" color={BrandColors.primary}>
              In total ${totalPrice}
            </Text>
            <TouchableOpacity style={styles.addMoreButton} onPress={handleAddMore} activeOpacity={0.7}>
              <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                Add More
              </Text>
              <ChevronRight size={16} color={BrandColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomAction}>
        <PrimaryButton style={styles.confirmButton} onPress={handleConfirmBooking}>
          <Text size="md" weight="semiBold" color={BrandColors.white}>
            {buttonText}
          </Text>
          <ChevronRight size={20} color={BrandColors.white} />
        </PrimaryButton>
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  // Mechanic Section
  mechanicSection: {
    marginBottom: Spacing.lg,
  },
  mechanicHeader: {
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
    borderColor: "#E5E7EB",
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
    marginBottom: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  servicesDescription: {
    marginTop: Spacing.md,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  availableTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  responseTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statTextContainer: {
    gap: 2,
  },
  ratingStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },

  // Service Row
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  serviceRowLeft: {
    flex: 1,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  // Total Row
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // Bottom Action
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
