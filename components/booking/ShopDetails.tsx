/**
 * ShopDetails
 *
 * PURPOSE: Displays breakdown of all mechanics at a shop with their availability
 *          slots, allowing users to see available bays/mechanics and time slots
 *          Also shows selected services with ability to add more
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx (Services tab)
 *
 * PROPS:
 *   - shopId (number): The shop ID to get mechanics for
 *
 * EXAMPLE:
 *   <ShopDetails shopId={shop.id} />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ChevronRight, Plus, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { ServiceRow } from "@/components/booking/shared";
import { DiscardServiceModal } from "@/components/booking/sheets/DiscardServiceModal";

// 5. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import type { MechanicAvailabilitySlot, ScheduledAppointment } from "@/stores/types/store.types";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useNextAvailabilityPerMechanicForShop } from "@/hooks/useNextAvailabilityPerMechanicForShop";

// ============================================================================
// TYPES
// ============================================================================

interface ShopDetailsProps {
  /** The shop ID to get mechanics for (Convex _id as string) */
  shopId: string;
  /** Called when "Book Now" is pressed, receives mechanic ID */
  onBookNow?: (mechanicId: string) => void;
  /** Called when "Add More" or "Add Services" is pressed */
  onAddMoreServices?: () => void;
  /** Called when "View All Availability" is pressed, receives mechanic ID */
  onViewAllAvailability?: (mechanicId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShopDetails({ shopId, onBookNow, onAddMoreServices, onViewAllAvailability }: ShopDetailsProps) {
  // ═══════════════ STORES ═══════════════
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const getShopById = useShopStore((state) => state.getShopById);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const skipServiceRemovalConfirm = useBookingStore((state) => state.skipServiceRemovalConfirm);
  const setSkipServiceRemovalConfirm = useBookingStore((state) => state.setSkipServiceRemovalConfirm);
  const selectMechanic = useBookingStore((state) => state.selectMechanic);
  const setSelectedMechanicSlot = useBookingStore((state) => state.setSelectedMechanicSlot);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);

  // Convex time slots per mechanic for this shop (each mechanic gets their own slots)
  const { slotsByMechanicId: slotsByMechanicIdFromHook } = useNextAvailabilityPerMechanicForShop(shopId, 48);

  // ═══════════════ STATE ═══════════════
  // Track selected slot index for each mechanic
  const [selectedSlots, setSelectedSlots] = useState<Record<string, number | null>>({});
  // Discard service modal state
  const [discardModalVisible, setDiscardModalVisible] = useState(false);
  const [serviceToRemove, setServiceToRemove] = useState<string | null>(null);

  // Track if inline selection is active (to differentiate from modal selection)
  const hasInlineSelectionRef = useRef(false);
  // Track previous scheduled appointment to detect modal confirmations
  const prevScheduledAppointmentRef = useRef<typeof scheduledAppointment>(null);

  // ═══════════════ EFFECTS ═══════════════
  // When modal confirms a time (external change), clear any inline slot selection
  useEffect(() => {
    // Detect when appointment was set externally (not from inline slot selection)
    if (
      scheduledAppointment !== null &&
      prevScheduledAppointmentRef.current !== scheduledAppointment &&
      !hasInlineSelectionRef.current
    ) {
      // Clear all inline slot selections - modal selection takes priority
      setSelectedSlots({});
    }
    prevScheduledAppointmentRef.current = scheduledAppointment;
    // Reset the inline selection flag after processing
    if (hasInlineSelectionRef.current) {
      hasInlineSelectionRef.current = false;
    }
  }, [scheduledAppointment]);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const shop = useMemo(() => getShopById(shopId), [shopId, getShopById]);
  const mechanics = useMemo(() => getMechanicsByShopId(shopId), [shopId, getMechanicsByShopId]);

  // Get selected services
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds],
  );

  // Shop-specific pricing: labor_rate × default_labor_hours + default_parts_estimate (shop rate only)
  const laborRate = shop?.labor_rate;
  const totalPrice = useMemo(
    () =>
      selectedServices.reduce(
        (total, service) =>
          total + (laborRate ?? 0) * (service.default_labor_hours ?? 0) + (service.default_parts_estimate ?? 0),
        0,
      ),
    [selectedServices, laborRate],
  );

  // Per-service shop price for display (for ServiceRow priceOverride)
  const getServicePrice = useCallback(
    (service: (typeof selectedServices)[0]) =>
      (laborRate ?? 0) * (service.default_labor_hours ?? 0) + (service.default_parts_estimate ?? 0),
    [laborRate],
  );

  // Slots per mechanic from Convex (each mechanic has their own list)
  const slotsByMechanicId = slotsByMechanicIdFromHook;

  // Map specialty IDs to service names and merge Convex availability per mechanic
  const mechanicsWithSpecialties = useMemo(() => {
    const serviceMap = new Map<string, string>();
    availableServices.forEach((service) => {
      serviceMap.set(service.id, service.name);
    });

    return mechanics.map((mechanic) => {
      const specialtyNames = mechanic.specialties
        .map((specialtyId) => serviceMap.get(specialtyId))
        .filter((name): name is string => !!name);
      const nextAvailability = slotsByMechanicId[mechanic.id] ?? mechanic.nextAvailability ?? [];

      return {
        ...mechanic,
        specialtyNames,
        nextAvailability,
      };
    });
  }, [mechanics, availableServices, slotsByMechanicId]);

  // ═══════════════ HANDLERS ═══════════════
  // Helper to convert slot data to ScheduledAppointment
  const convertSlotToAppointment = useCallback(
    (slot: { day: string; dayOfWeek: string; time: string }): ScheduledAppointment => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const dayNum = parseInt(slot.day, 10);

      // Construct date from slot day (assuming current month/year, adjust if in past)
      let targetDate = new Date(currentYear, currentMonth, dayNum);
      if (targetDate < now) {
        // If the date is in the past, use next month
        targetDate = new Date(currentYear, currentMonth + 1, dayNum);
      }

      // Format date as ISO string (YYYY-MM-DD)
      const isoDate = targetDate.toISOString().split("T")[0];

      // Format display date (e.g., "20 Aug. 2025")
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      const displayDate = `${targetDate.getDate()} ${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

      return {
        date: isoDate,
        time: slot.time,
        displayDate,
      };
    },
    [],
  );

  const handleSlotSelect = useCallback(
    (mechanicId: string, slotIndex: number) => {
      setSelectedSlots((prev) => {
        const isCurrentlySelected = prev[mechanicId] === slotIndex;

        if (isCurrentlySelected) {
          // Deselect - clear store state
          setScheduledAppointment(null);
          selectMechanic(null);
          return {
            ...prev,
            [mechanicId]: null,
          };
        } else {
          // Select new slot - only update local state, don't touch store yet
          // Store will be updated when "Book Now" is pressed
          // Clear all other slots, only this mechanic has the selection
          return {
            [mechanicId]: slotIndex,
          };
        }
      });
    },
    [setScheduledAppointment, selectMechanic],
  );

  const handleViewAllAvailability = useCallback(
    (mechanicId: string) => {
      onViewAllAvailability?.(mechanicId);
    },
    [onViewAllAvailability],
  );

  const handleBookNow = useCallback(
    (mechanicId: string, slotIndex: number | null) => {
      const mechanic = mechanicsWithSpecialties.find((m) => m.id === mechanicId);
      if (!mechanic) return;

      if (slotIndex !== null && mechanic.nextAvailability?.[slotIndex]) {
        const slot = mechanic.nextAvailability[slotIndex];
        const appointment = convertSlotToAppointment(slot);
        hasInlineSelectionRef.current = true;
        setScheduledAppointment(appointment);
        selectMechanic(mechanicId);
        // Set selectedMechanicSlot so payment screen has shopId and can insert Convex booking
        if (shop) {
          setSelectedMechanicSlot({
            shopId: shop.id,
            shopName: shop.name,
            mechanicId,
            mechanicName: mechanic.name,
            slot: { day: slot.day, dayOfWeek: slot.dayOfWeek, time: slot.time },
            scheduledDate: appointment.date,
            scheduledTime: appointment.time,
          });
        }
      }

      onBookNow?.(mechanicId);
    },
    [
      shop,
      mechanicsWithSpecialties,
      convertSlotToAppointment,
      setScheduledAppointment,
      selectMechanic,
      setSelectedMechanicSlot,
      onBookNow,
    ],
  );

  const handleAddServices = useCallback(() => {
    onAddMoreServices?.();
  }, [onAddMoreServices]);

  const handleRemoveServicePress = useCallback(
    (serviceId: string) => {
      if (skipServiceRemovalConfirm) {
        toggleServiceSelection(serviceId);
        return;
      }
      setServiceToRemove(serviceId);
      setDiscardModalVisible(true);
    },
    [skipServiceRemovalConfirm, toggleServiceSelection],
  );

  const handleConfirmRemoveService = useCallback(() => {
    if (serviceToRemove) {
      toggleServiceSelection(serviceToRemove);
    }
    setDiscardModalVisible(false);
    setServiceToRemove(null);
  }, [serviceToRemove, toggleServiceSelection]);

  const handleCancelRemoveService = useCallback(() => {
    setDiscardModalVisible(false);
    setServiceToRemove(null);
  }, []);

  const handleDontAskAgain = useCallback(() => {
    setSkipServiceRemovalConfirm(true);
    handleConfirmRemoveService();
  }, [setSkipServiceRemovalConfirm, handleConfirmRemoveService]);

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      {/* No Mechanics Message - Show when shop has no mechanics */}
      {mechanics.length === 0 && (
        <View style={styles.noMechanicsContainer}>
          <Text size="md" weight="semiBold" color="#6B7280" style={styles.noMechanicsText}>
            No mechanics are currently available at this shop.
          </Text>
          <Text size="sm" weight="regular" color="#9CA3AF" style={styles.noMechanicsSubtext}>
            Please check back later or try another shop nearby.
          </Text>
        </View>
      )}

      {/* Selected Services Section */}
      <View style={styles.sectionHeader}>
        <Text size="md" weight="bold" color="#9CA3AF">
          Selected Services ({selectedServices.length})
        </Text>
      </View>

      <View style={styles.servicesContainer}>
        {selectedServices.length > 0 ? (
          <>
            {selectedServices.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                onRemove={() => handleRemoveServicePress(service.id)}
                priceOverride={getServicePrice(service)}
              />
            ))}

            {/* Total and Add More Row */}
            <View style={styles.servicesFooter}>
              <View style={styles.totalBadge}>
                <Text size="md" weight="bold" color="#6B7280">
                  In total ${totalPrice.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity style={styles.addMoreRowButton} onPress={handleAddServices} activeOpacity={0.7}>
                <Text size="md" weight="bold" color={BrandColors.primary}>
                  Add More
                </Text>
                <ChevronRight size={18} color={BrandColors.primary} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.addServicesButton} onPress={handleAddServices} activeOpacity={0.7}>
            <Plus size={20} color={BrandColors.secondary} />
            <Text size="md" weight="semiBold" color={BrandColors.secondary}>
              Add Services
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mechanics Section - Only show if mechanics exist */}
      {mechanics.length > 0 && (
        <>
          <View style={styles.header}>
            <Text size="lg" weight="bold" color={BrandColors.primary}>
              Available Mechanics & Bays
            </Text>
            <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
              Select a mechanic and time slot to book
            </Text>
          </View>

          <View style={styles.mechanicsList}>
            {mechanicsWithSpecialties.map((mechanic) => {
              const selectedSlotIndex = selectedSlots[mechanic.id] ?? null;

              return (
                <View key={mechanic.id} style={styles.mechanicCard}>
                  {/* Mechanic Header */}
                  <View style={styles.mechanicHeader}>
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatarPlaceholder}>
                        <User size={24} color="#9CA3AF" />
                      </View>
                    </View>
                    <View style={styles.mechanicInfo}>
                      <View style={styles.mechanicNameRow}>
                        <Text size="md" weight="bold" color={BrandColors.primary}>
                          {mechanic.name}
                        </Text>
                        {mechanic.isAvailable && (
                          <View style={styles.availableBadge}>
                            <View style={styles.availableDot} />
                            <Text size="xs" weight="medium" color="#10B981">
                              Available
                            </Text>
                          </View>
                        )}
                      </View>
                      {mechanic.specialtyNames.length > 0 && (
                        <View style={styles.specialtiesContainer}>
                          {mechanic.specialtyNames.slice(0, 3).map((specialty, index) => (
                            <View key={index} style={styles.specialtyTag}>
                              <Text size="xs" weight="medium" color={BrandColors.primary}>
                                {specialty}
                              </Text>
                            </View>
                          ))}
                          {mechanic.specialtyNames.length > 3 && (
                            <Text size="xs" weight="medium" color="#6B7280">
                              +{mechanic.specialtyNames.length - 3} more
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Show confirmed appointment from modal if this mechanic has one */}
                  {selectedMechanicId === mechanic.id &&
                    scheduledAppointment !== null &&
                    selectedSlotIndex === null && (
                      <View style={styles.confirmedAppointmentBadge}>
                        <Text size="sm" weight="semiBold" color={BrandColors.secondary}>
                          Confirmed: {scheduledAppointment.displayDate} at {scheduledAppointment.time}
                        </Text>
                      </View>
                    )}

                  {/* Inline Availability Slots (like MechanicCard) */}
                  {mechanic.nextAvailability && mechanic.nextAvailability.length > 0 && (
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
                              onPress={() => handleSlotSelect(mechanic.id, index)}
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
                      <TouchableOpacity
                        style={styles.viewAllButton}
                        activeOpacity={0.7}
                        onPress={() => handleViewAllAvailability(mechanic.id)}
                      >
                        <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                          View All Availability
                        </Text>
                        <ChevronRight size={18} color={BrandColors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Action Button - Closer to availability like MechanicCard */}
                  {(() => {
                    // Check if this mechanic has an inline slot selected OR has a confirmed appointment from modal
                    const hasInlineSelection = selectedSlotIndex !== null;
                    const hasModalConfirmation = selectedMechanicId === mechanic.id && scheduledAppointment !== null;
                    const canBook = hasInlineSelection || hasModalConfirmation;

                    return (
                      <View style={styles.actionButtons}>
                        <PrimaryButton
                          style={[styles.bookButton, !canBook && styles.bookButtonDisabled]}
                          onPress={() => handleBookNow(mechanic.id, selectedSlotIndex)}
                          disabled={!canBook}
                        >
                          <Text size="sm" weight="semiBold" color={!canBook ? "#9CA3AF" : BrandColors.white}>
                            Book Now
                          </Text>
                        </PrimaryButton>
                      </View>
                    );
                  })()}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Discard Service Modal - Uses React Native Modal which has built-in portal behavior */}
      <DiscardServiceModal
        visible={discardModalVisible}
        onClose={handleCancelRemoveService}
        onConfirm={handleConfirmRemoveService}
        onDontAskAgain={handleDontAskAgain}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
  },
  noMechanicsContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  noMechanicsText: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  noMechanicsSubtext: {
    textAlign: "center",
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
  addServicesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: BrandColors.secondary,
    borderRadius: BorderRadius.lg,
    borderStyle: "dashed",
  },
  header: {
    marginBottom: Spacing.lg,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  mechanicsList: {
    gap: Spacing.lg,
  },
  mechanicCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  mechanicHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  mechanicInfo: {
    flex: 1,
  },
  mechanicNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
  },
  specialtiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
  },
  specialtyTag: {
    backgroundColor: "#F0F7FF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.secondary + "30",
  },
  // Confirmed appointment badge (when selected from modal)
  confirmedAppointmentBadge: {
    marginTop: Spacing.lg,
    backgroundColor: "#F0F7FF",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: BrandColors.secondary,
    alignItems: "center",
  },
  // Inline availability section (similar to MechanicCard)
  availabilitySection: {
    marginTop: Spacing.lg,
  },
  availabilitySlotsContent: {
    gap: Spacing.sm,
  },
  availabilitySlot: {
    width: 80,
    alignItems: "center",
    paddingVertical: Spacing.md,
    backgroundColor: "#F9FAFB",
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
    marginTop: Spacing.md,
    gap: 4,
  },
  // Action buttons closer to availability (like MechanicCard)
  actionButtons: {
    marginTop: Spacing.md,
  },
  bookButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  bookButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
});
