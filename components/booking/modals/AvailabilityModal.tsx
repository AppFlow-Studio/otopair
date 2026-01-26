/**
 * AvailabilityModal
 *
 * PURPOSE: Full-screen modal for viewing all availability and selecting date/time
 *          Uses React Native Modal for reliable rendering outside scroll containers
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id]/index.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { useScheduleStore } from "@/stores/useScheduleStore";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface AvailabilityModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Mechanic ID to load schedule for */
  mechanicId: number | null;
  /** Called when modal should close */
  onClose: () => void;
  /** Called when user confirms selection */
  onConfirm?: (date: Date, time: string) => void;
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

export function AvailabilityModal({ visible, mechanicId, onClose, onConfirm }: AvailabilityModalProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

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

  // ═══════════════ EFFECTS ═══════════════
  useEffect(() => {
    if (visible && mechanicId !== null) {
      loadMechanicSchedule(mechanicId);
    }
  }, [visible, mechanicId, loadMechanicSchedule]);

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

  const handleConfirm = useCallback(() => {
    if (selectedDate && selectedTime && mechanicId !== null) {
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
      selectMechanic(mechanicId);

      onConfirm?.(selectedDate, selectedTime);
    }
    onClose();
  }, [selectedDate, selectedTime, mechanicId, confirmSelection, setScheduledAppointment, selectMechanic, onConfirm, onClose]);

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
            All Availability
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>

        {/* Footer Buttons */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.7}>
            <Text size="md" weight="semiBold" color={BrandColors.primary}>
              Cancel
            </Text>
          </TouchableOpacity>

          <PrimaryButton
            style={[styles.confirmButton, (!selectedDate || !selectedTime) && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedDate || !selectedTime}
          >
            <Text size="md" weight="bold" color={BrandColors.white}>
              Confirm Date & Time
            </Text>
          </PrimaryButton>
        </View>
      </View>
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

  // Footer
  footer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    ...Shadows.sm,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
  confirmButton: {
    flex: 1.5,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
});
