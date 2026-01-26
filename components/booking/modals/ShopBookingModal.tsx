/**
 * ShopBookingModal
 *
 * PURPOSE: Full-screen modal for complete booking experience in shop details
 *          Includes mechanic selector, calendar, time selection, services, and booking flow
 *          Uses React Native Modal for reliable rendering outside scroll containers
 *
 * USED IN: app/(main-tabs)/home/shop/[id]/index.tsx
 *          app/(main-tabs)/home/mechanic/[id]/index.tsx (Services tab)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ChevronLeft, ChevronRight, Plus, User, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { AddServicesModal } from "./AddServicesModal";

// 5. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { useScheduleStore } from "@/stores/useScheduleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import type { Service } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface ShopBookingModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Shop ID to get all mechanics for */
  shopId: number | null;
  /** Mechanic ID for initial selection (optional) */
  mechanicId?: number | null;
  /** Called when modal should close */
  onClose: () => void;
  /** Called when user presses Continue to go to payment */
  onContinue?: (date: Date, time: string, mechanicId: number) => void;
}

type DayStatus = "available" | "booked" | "selected" | "disabled" | "normal";

interface CalendarDay {
  date: number;
  status: DayStatus;
  isCurrentMonth: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_TIME_SLOTS = ["9:00 AM", "10:00 AM", "1:00 PM", "2:00 PM", "3:00 PM"];

const SCREEN_WIDTH = Dimensions.get("window").width;
const CALENDAR_PADDING = Spacing.xl * 2;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - CALENDAR_PADDING) / 7);
const CIRCLE_SIZE = CELL_SIZE - 8;

// ============================================================================
// COMPONENT
// ============================================================================

export function ShopBookingModal({ visible, shopId, mechanicId, onClose, onContinue }: ShopBookingModalProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ═══════════════ LOCAL STATE ═══════════════
  // Track selected mechanic within the modal (null = "Any")
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | null>(mechanicId ?? null);
  // Track if add services modal is open
  const [showAddServicesModal, setShowAddServicesModal] = useState(false);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // Get mechanics for the shop
  const shopMechanics = useMemo(() => {
    if (!shopId) {
      // If no shopId, try to get it from the mechanic
      if (mechanicId) {
        const mechanic = getMechanicById(mechanicId);
        if (mechanic?.shopId) {
          return getMechanicsByShopId(mechanic.shopId);
        }
      }
      return [];
    }
    return getMechanicsByShopId(shopId);
  }, [shopId, mechanicId, getMechanicsByShopId, getMechanicById]);

  // ═══════════════ SCHEDULE STORE ═══════════════
  const currentMonth = useScheduleStore((state) => state.currentMonth);
  const selectedDate = useScheduleStore((state) => state.selectedDate);
  const selectedTime = useScheduleStore((state) => state.selectedTime);
  const loadMechanicSchedule = useScheduleStore((state) => state.loadMechanicSchedule);
  const prevMonth = useScheduleStore((state) => state.prevMonth);
  const nextMonth = useScheduleStore((state) => state.nextMonth);
  const selectDate = useScheduleStore((state) => state.selectDate);
  const selectTime = useScheduleStore((state) => state.selectTime);
  const confirmSelection = useScheduleStore((state) => state.confirmSelection);
  const getAvailableDayNumbers = useScheduleStore((state) => state.getAvailableDayNumbers);
  const getBookedDayNumbers = useScheduleStore((state) => state.getBookedDayNumbers);
  const getTimeSlotsForSelectedDate = useScheduleStore((state) => state.getTimeSlotsForSelectedDate);

  // ═══════════════ BOOKING STORE ═══════════════
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const selectMechanic = useBookingStore((state) => state.selectMechanic);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const setSkippedBookingDetails = useBookingStore((state) => state.setSkippedBookingDetails);

  // ═══════════════ COMPUTED - SELECTED SERVICES ═══════════════
  const selectedServices = useMemo(() => {
    return availableServices.filter((service) => selectedServiceIds.includes(service.id));
  }, [availableServices, selectedServiceIds]);

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((total, service) => total + service.price, 0);
  }, [selectedServices]);

  const totalDuration = useMemo(() => {
    // Estimate 30 min per service for now
    return selectedServices.length * 30;
  }, [selectedServices]);

  // Check if we can proceed (has date, time, and at least one service)
  const canContinue = selectedDate !== null && selectedTime !== null && selectedServices.length > 0;

  // ═══════════════ EFFECTS ═══════════════
  // Reset selected mechanic when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedMechanicId(mechanicId ?? null);
    }
  }, [visible, mechanicId]);

  // Load schedule when mechanic selection changes
  useEffect(() => {
    if (visible) {
      // Use selected mechanic, or first mechanic if "Any" is selected
      const effectiveMechanicId = selectedMechanicId ?? shopMechanics[0]?.id ?? mechanicId;
      if (effectiveMechanicId !== null && effectiveMechanicId !== undefined) {
        loadMechanicSchedule(effectiveMechanicId);
      }
    }
  }, [visible, selectedMechanicId, shopMechanics, mechanicId, loadMechanicSchedule]);

  // ═══════════════ MECHANIC SELECTOR HANDLER ═══════════════
  const handleMechanicSelect = useCallback((id: number | null) => {
    setSelectedMechanicId(id);
  }, []);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const availableDays = getAvailableDayNumbers();
  const bookedDays = getBookedDayNumbers();

  const timeSlots = useMemo(() => {
    const slots = getTimeSlotsForSelectedDate();
    return slots.length > 0 ? slots : DEFAULT_TIME_SLOTS;
  }, [selectedDate, getTimeSlotsForSelectedDate]);

  const selectedDayNumber = selectedDate?.getDate() ?? null;

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: daysInPrevMonth - i,
        status: "disabled",
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      let status: DayStatus = "normal";

      if (i === selectedDayNumber) {
        status = "selected";
      } else if (availableDays.includes(i)) {
        status = "available";
      } else if (bookedDays.includes(i)) {
        status = "booked";
      } else {
        const dayOfWeek = new Date(year, month, i).getDay();
        if (dayOfWeek === 0) {
          status = "booked";
        }
      }

      days.push({
        date: i,
        status,
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        status: "disabled",
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth, selectedDayNumber, availableDays, bookedDays]);

  // Split days into weeks
  const calendarWeeks = useMemo(() => {
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  // ═══════════════ HANDLERS ═══════════════
  const handlePrevMonth = useCallback(() => {
    prevMonth();
  }, [prevMonth]);

  const handleNextMonth = useCallback(() => {
    nextMonth();
  }, [nextMonth]);

  const handleDayPress = useCallback(
    (day: CalendarDay) => {
      if (!day.isCurrentMonth || day.status === "booked") return;
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day.date);
      selectDate(newDate);
    },
    [currentMonth, selectDate]
  );

  const handleTimePress = useCallback(
    (time: string) => {
      selectTime(time);
    },
    [selectTime]
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddService = useCallback(() => {
    setShowAddServicesModal(true);
  }, []);

  const handleCloseAddServicesModal = useCallback(() => {
    setShowAddServicesModal(false);
  }, []);

  const handleContinue = useCallback(() => {
    // Use selected mechanic, or first mechanic if "Any" is selected
    const effectiveMechanicId = selectedMechanicId ?? shopMechanics[0]?.id ?? mechanicId;
    
    if (selectedDate && selectedTime && effectiveMechanicId !== null && effectiveMechanicId !== undefined && selectedServices.length > 0) {
      confirmSelection();

      // Format date as "DD Mon. YYYY"
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      const displayDate = `${selectedDate.getDate()} ${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
      const isoDate = selectedDate.toISOString().split("T")[0];

      // Update booking store with scheduled appointment and selected mechanic
      setScheduledAppointment({
        date: isoDate,
        time: selectedTime,
        displayDate,
      });
      
      // Set booking type and mechanic
      setBookingTypeAndProceed("schedule_later", effectiveMechanicId);
      
      // Skip booking details and go directly to payment
      setSkippedBookingDetails(true);
      setBookingStage("payment", "forward");

      onContinue?.(selectedDate, selectedTime, effectiveMechanicId);
      onClose();
      
      // Navigate to payment screen
      router.push(`/home/mechanic/${effectiveMechanicId}/payment`);
    }
  }, [selectedDate, selectedTime, selectedMechanicId, shopMechanics, mechanicId, selectedServices.length, confirmSelection, setScheduledAppointment, setBookingTypeAndProceed, setSkippedBookingDetails, setBookingStage, onContinue, onClose, router]);

  // Get mechanic name for the service card
  const getSelectedMechanicName = useCallback(() => {
    if (selectedMechanicId === null) {
      return "Any";
    }
    const mechanic = getMechanicById(selectedMechanicId);
    return mechanic?.name.split(" ")[0] || "Any";
  }, [selectedMechanicId, getMechanicById]);

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderDayCell = useCallback(
    (day: CalendarDay, index: number) => {
      const isDisabled = !day.isCurrentMonth;
      const isBooked = day.status === "booked";
      const isSelected = day.status === "selected";
      const isAvailable = day.status === "available";

      let circleStyle = styles.circleNormal;
      if (isSelected) {
        circleStyle = styles.circleSelected;
      } else if (isAvailable) {
        circleStyle = styles.circleAvailable;
      } else if (isBooked && day.isCurrentMonth) {
        circleStyle = styles.circleBooked;
      }

      let textColor = BrandColors.primary;
      if (isDisabled) {
        textColor = "#D1D5DB";
      } else if (isSelected) {
        textColor = BrandColors.white;
      } else if (isBooked) {
        textColor = "#EC4899";
      }

      return (
        <TouchableOpacity
          key={index}
          style={styles.dayCell}
          onPress={() => handleDayPress(day)}
          activeOpacity={isDisabled || isBooked ? 1 : 0.6}
          disabled={isDisabled || isBooked}
        >
          <View style={[styles.dayCircle, circleStyle]}>
            <Text size="md" weight={isSelected ? "bold" : "medium"} color={textColor}>
              {day.date}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleDayPress]
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleCancel} activeOpacity={0.7}>
            <X size={24} color={BrandColors.primary} />
          </TouchableOpacity>
          <Text size="lg" weight="bold" color={BrandColors.primary}>
            Book Appointment
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mechanic Selector - Only show if we have mechanics */}
          {shopMechanics.length > 0 && (
            <View style={styles.mechanicSection}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                SELECT MECHANIC
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mechanicAvatarsContent}
              >
                {/* "Any" option */}
                <TouchableOpacity
                  style={styles.mechanicAvatarWrapper}
                  onPress={() => handleMechanicSelect(null)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.mechanicAvatar,
                      selectedMechanicId === null && styles.mechanicAvatarSelected,
                    ]}
                  >
                    <Text size="xs" weight="bold" color={selectedMechanicId === null ? BrandColors.secondary : "#6B7280"}>
                      Any
                    </Text>
                  </View>
                  <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                    Any
                  </Text>
                </TouchableOpacity>

                {/* Mechanic avatars */}
                {shopMechanics.map((mechanic) => {
                  const isSelected = selectedMechanicId === mechanic.id;
                  const firstName = mechanic.name.split(" ")[0];
                  return (
                    <TouchableOpacity
                      key={mechanic.id}
                      style={styles.mechanicAvatarWrapper}
                      onPress={() => handleMechanicSelect(mechanic.id)}
                      activeOpacity={0.7}
                    >
                      {mechanic.photoUrl ? (
                        <Image
                          source={{ uri: mechanic.photoUrl }}
                          style={[styles.mechanicAvatar, isSelected && styles.mechanicAvatarSelected]}
                        />
                      ) : (
                        <View style={[styles.mechanicAvatar, isSelected && styles.mechanicAvatarSelected]}>
                          <User size={20} color={isSelected ? BrandColors.secondary : "#9CA3AF"} />
                        </View>
                      )}
                      <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                        {firstName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Month Navigation */}
          <View style={styles.monthNavigation}>
            <TouchableOpacity style={styles.navButton} onPress={handlePrevMonth} activeOpacity={0.7}>
              <ChevronLeft size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <Text size="lg" weight="semiBold" color={BrandColors.primary}>
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>

            <TouchableOpacity style={styles.navButton} onPress={handleNextMonth} activeOpacity={0.7}>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Calendar Container */}
          <View style={styles.calendarContainer}>
            {/* Weekday Headers */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((day) => (
                <View key={day} style={styles.weekdayCell}>
                  <Text size="sm" weight="semiBold" color="#9CA3AF">
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {calendarWeeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekRow}>
                  {week.map((day, dayIndex) => renderDayCell(day, weekIndex * 7 + dayIndex))}
                </View>
              ))}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendAvailable]} />
              <Text size="sm" weight="medium" color="#6B7280">
                Available
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendBooked]} />
              <Text size="sm" weight="medium" color="#6B7280">
                Booked
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendSelected]} />
              <Text size="sm" weight="medium" color="#6B7280">
                Selected
              </Text>
            </View>
          </View>

          {/* Time Selection */}
          <View style={styles.timeSection}>
            <Text size="lg" weight="bold" color={BrandColors.primary}>
              Select Time
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeSlotsContent}
            >
              {timeSlots.map((time, index) => {
                const isSelected = selectedTime === time;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                    onPress={() => handleTimePress(time)}
                    activeOpacity={0.7}
                  >
                    <Text
                      size="md"
                      weight={isSelected ? "bold" : "medium"}
                      color={isSelected ? BrandColors.secondary : "#6B7280"}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Selected Services Section */}
          <View style={styles.servicesSection}>
            {selectedServices.length > 0 && (
              <View style={styles.servicesCard}>
                {selectedServices.map((service, index) => (
                  <View key={service.id}>
                    <View style={styles.serviceItem}>
                      <View style={styles.serviceItemHeader}>
                        <Text size="md" weight="semiBold" color={BrandColors.primary}>
                          {service.name}
                        </Text>
                        <Text size="md" weight="semiBold" color={BrandColors.primary}>
                          ${service.price.toFixed(2)}
                        </Text>
                      </View>
                      <Text size="sm" weight="regular" color="#9CA3AF">
                        {selectedTime || "Select time"} - {selectedTime ? `${parseInt(selectedTime) + 0}:30` : ""}
                      </Text>
                      <View style={styles.serviceItemStaff}>
                        <Text size="sm" weight="regular" color="#6B7280">
                          Staff:{" "}
                        </Text>
                        <View style={styles.staffAvatar}>
                          <User size={12} color="#9CA3AF" />
                        </View>
                        <Text size="sm" weight="medium" color="#6B7280">
                          {getSelectedMechanicName()}
                        </Text>
                      </View>
                    </View>
                    {/* Divider between services */}
                    {index < selectedServices.length - 1 && <View style={styles.serviceDivider} />}
                  </View>
                ))}
              </View>
            )}

            {/* Add Another Service Button */}
            <TouchableOpacity 
              style={styles.addServiceButton} 
              onPress={handleAddService}
              activeOpacity={0.7}
            >
              <Plus size={18} color={BrandColors.secondary} />
              <Text size="md" weight="semiBold" color={BrandColors.secondary}>
                Add another service
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer with Continue Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.footerInfo}>
            <Text size="sm" weight="medium" color="#6B7280">
              {selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""} • {totalDuration}min
            </Text>
            <Text size="xl" weight="bold" color={BrandColors.primary}>
              ${totalPrice.toFixed(2)}
            </Text>
          </View>

          <PrimaryButton
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text size="md" weight="bold" color={BrandColors.white}>
              Continue
            </Text>
          </PrimaryButton>
        </View>
      </View>

      {/* Add Services Modal */}
      <AddServicesModal
        visible={showAddServicesModal}
        onClose={handleCloseAddServicesModal}
      />
    </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  // Mechanic Selector
  mechanicSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  mechanicAvatarsContent: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  mechanicAvatarWrapper: {
    alignItems: "center",
    width: 56,
  },
  mechanicAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    marginBottom: 4,
  },
  mechanicAvatarSelected: {
    borderColor: BrandColors.secondary,
    borderWidth: 2,
  },

  // Month Navigation
  monthNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
  },

  // Calendar Container
  calendarContainer: {
    backgroundColor: BrandColors.white,
  },

  // Weekdays
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  weekdayCell: {
    width: CELL_SIZE,
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },

  // Calendar Grid
  calendarGrid: {
    gap: Spacing.xs,
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNormal: {
    backgroundColor: "transparent",
  },
  circleSelected: {
    backgroundColor: BrandColors.secondary,
  },
  circleBooked: {
    backgroundColor: "#FDF2F8",
  },
  circleAvailable: {
    backgroundColor: "#EFF6FF",
  },

  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xl,
    marginTop: Spacing["2xl"],
    paddingVertical: Spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendAvailable: {
    backgroundColor: "#93C5FD",
  },
  legendBooked: {
    backgroundColor: "#F9A8D4",
  },
  legendSelected: {
    backgroundColor: BrandColors.secondary,
  },

  // Time Selection
  timeSection: {
    marginTop: Spacing.lg,
    gap: Spacing.lg,
  },
  timeSlotsContent: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  timeSlot: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 90,
    alignItems: "center",
  },
  timeSlotSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#EFF6FF",
  },

  // Services Section
  servicesSection: {
    marginTop: Spacing["2xl"],
    gap: Spacing.md,
  },
  servicesCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  serviceItem: {
    paddingVertical: Spacing.sm,
  },
  serviceItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  serviceItemStaff: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  serviceDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.md,
  },
  staffAvatar: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  addServiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    ...Shadows.sm,
  },
  footerInfo: {
    flex: 1,
  },
  continueButton: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
  },
  continueButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
});
