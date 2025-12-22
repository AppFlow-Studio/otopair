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
import React, { useCallback, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BadgeCheck, ChevronRight, Clock, Star, User, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Local components
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
// MAIN COMPONENT
// ============================================================================

export function BookingDetailsContent({ onAddMore }: BookingDetailsContentProps) {
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
        <View style={styles.servicesSectionHeader}>
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
          <View style={styles.availabilitySection}>
            <Text size="sm" weight="bold" color={BrandColors.primary} style={styles.availabilityTitle}>
              Next Availability
            </Text>
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
            <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.7}>
              <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                View All Availability
              </Text>
              <ChevronRight size={18} color={BrandColors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetScrollView>

      {/* Discard Service Confirmation Modal */}
      <DiscardServiceModal
        visible={showDiscardModal}
        onClose={handleCloseDiscardModal}
        onConfirm={handleConfirmRemove}
      />
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

  // Selected Services
  servicesSectionHeader: {
    marginBottom: Spacing.md,
  },
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
    marginTop: Spacing.lg,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  availabilityTitle: {
    marginBottom: Spacing.md,
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
});
