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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Local components
import { AvailabilitySlots, MechanicInfoCard, ServiceRow } from "../shared";
import { AllAvailabilitySheet, AllAvailabilitySheetRef } from "./AllAvailabilitySheet";
import { DiscardServiceModal } from "./DiscardServiceModal";

// 5. Constants, hooks, types
import { BorderRadius, getSheetContentPadding } from "@/constants/theme";
import type { ScheduledAppointment } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useScheduleStore } from "@/stores/useScheduleStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// TYPES
// ============================================================================

interface BookingDetailsContentProps {
  /** Called when user wants to add more services */
  onAddMore?: () => void;
  /** Whether this is rendered in full-screen mode (outside bottom sheet) */
  isFullScreen?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BookingDetailsContent({ onAddMore, isFullScreen = false }: BookingDetailsContentProps) {
  // ═══════════════ REFS ═══════════════
  const allAvailabilityRef = useRef<AllAvailabilitySheetRef>(null);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const contentPadding = getSheetContentPadding(true, insets.bottom);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const skipServiceRemovalConfirm = useBookingStore((state) => state.skipServiceRemovalConfirm);
  const setSkipServiceRemovalConfirm = useBookingStore((state) => state.setSkipServiceRemovalConfirm);

  // ═══════════════ SCHEDULE STORE ═══════════════
  const confirmedSelections = useScheduleStore((state) => state.confirmedSelections);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ SHOP STORE (for shop-specific pricing) ═══════════════
  const getShopById = useShopStore((state) => state.getShopById);

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
    [availableServices, selectedServiceIds],
  );

  // Shop-specific pricing: labor_rate × default_labor_hours + default_parts_estimate (shop rate only)
  const shop = useMemo(
    () => (mechanic?.shopId ? getShopById(mechanic.shopId) : null),
    [mechanic?.shopId, getShopById],
  );
  const laborRate = shop?.labor_rate;
  const totalPrice = useMemo(
    () =>
      selectedServices.reduce(
        (total, service) =>
          total +
          (laborRate ?? 0) * (service.default_labor_hours ?? 0) +
          (service.default_parts_estimate ?? 0),
        0,
      ),
    [selectedServices, laborRate],
  );
  const getServicePrice = useCallback(
    (service: (typeof selectedServices)[0]) =>
      (laborRate ?? 0) * (service.default_labor_hours ?? 0) + (service.default_parts_estimate ?? 0),
    [laborRate],
  );

  // Rating and review count from Convex (mechanic.rating / mechanic.reviewCount)
  const ratingCount = mechanic?.reviewCount ?? 0;

  // ═══════════════ HELPER FUNCTIONS ═══════════════
  /** Create a ScheduledAppointment from a slot */
  const createAppointmentFromSlot = useCallback(
    (slotIndex: number): ScheduledAppointment | null => {
      if (!mechanic?.nextAvailability || slotIndex < 0 || slotIndex >= mechanic.nextAvailability.length) {
        return null;
      }
      const slot = mechanic.nextAvailability[slotIndex];
      const now = new Date();
      const dayNum = parseInt(slot.day, 10);

      // Determine the date (assume current month, adjust if day is in past)
      let targetMonth = now.getMonth();
      let targetYear = now.getFullYear();
      if (dayNum < now.getDate()) {
        // Slot is in next month
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }

      const date = new Date(targetYear, targetMonth, dayNum);
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      const displayDate = `${dayNum} ${months[targetMonth]} ${targetYear}`;
      const isoDate = date.toISOString().split("T")[0];

      return {
        date: isoDate,
        time: slot.time,
        displayDate,
      };
    },
    [mechanic?.nextAvailability],
  );

  // ═══════════════ EFFECTS ═══════════════
  // Sync selected slot to booking store
  useEffect(() => {
    if (selectedSlotIndex !== null) {
      const appointment = createAppointmentFromSlot(selectedSlotIndex);
      setScheduledAppointment(appointment);
    } else {
      // Check if there's a confirmed selection from the schedule store
      if (selectedMechanicId && confirmedSelections[selectedMechanicId]) {
        const confirmed = confirmedSelections[selectedMechanicId];
        const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
        const displayDate = `${confirmed.date.getDate()} ${
          months[confirmed.date.getMonth()]
        } ${confirmed.date.getFullYear()}`;
        const isoDate = confirmed.date.toISOString().split("T")[0];
        setScheduledAppointment({
          date: isoDate,
          time: confirmed.time,
          displayDate,
        });
      } else {
        setScheduledAppointment(null);
      }
    }
  }, [selectedSlotIndex, createAppointmentFromSlot, setScheduledAppointment, selectedMechanicId, confirmedSelections]);

  // ═══════════════ HANDLERS ═══════════════
  const handleAddMore = useCallback(() => {
    onAddMore?.();
  }, [onAddMore]);

  const handleRemoveService = useCallback(
    (serviceId: string) => {
      if (skipServiceRemovalConfirm) {
        toggleServiceSelection(serviceId);
        return;
      }
      setPendingRemoveServiceId(serviceId);
      setShowDiscardModal(true);
    },
    [skipServiceRemovalConfirm, toggleServiceSelection],
  );

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

  const handleDontAskAgain = useCallback(() => {
    setSkipServiceRemovalConfirm(true);
    handleConfirmRemove();
  }, [setSkipServiceRemovalConfirm, handleConfirmRemove]);

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
        (slot) => parseInt(slot.day, 10) === dayOfMonth && slot.time === time,
      );
      if (matchingIndex !== undefined && matchingIndex >= 0) {
        setSelectedSlotIndex(matchingIndex);
      } else {
        // Slot not in quick availability list, set appointment directly
        const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
        const displayDate = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
        const isoDate = date.toISOString().split("T")[0];
        setScheduledAppointment({
          date: isoDate,
          time,
          displayDate,
        });
      }
    },
    [mechanic?.nextAvailability, setScheduledAppointment],
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

  // Choose the appropriate ScrollView component based on mode
  const ScrollComponent = isFullScreen ? ScrollView : BottomSheetScrollView;

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollComponent
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mechanic Info Section */}
        <MechanicInfoCard mechanic={mechanic} ratingCount={ratingCount} />

        {/* Selected Services Section */}
        <View style={styles.sectionHeader}>
          <Text size="md" weight="bold" color="#9CA3AF">
            Selected Services ({selectedServices.length})
          </Text>
        </View>

        <View style={styles.servicesContainer}>
          {selectedServices.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              onRemove={() => handleRemoveService(service.id)}
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
            <AvailabilitySlots
              slots={mechanic.nextAvailability}
              selectedIndex={selectedSlotIndex}
              onSlotSelect={setSelectedSlotIndex}
              onViewAll={handleViewAllAvailability}
            />
          </>
        )}
      </ScrollComponent>

      {/* Discard Service Confirmation Modal */}
      <DiscardServiceModal
        visible={showDiscardModal}
        onClose={handleCloseDiscardModal}
        onConfirm={handleConfirmRemove}
        onDontAskAgain={handleDontAskAgain}
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
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

  // Customer Reviews Section
});
