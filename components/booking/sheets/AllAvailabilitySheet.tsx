/**
 * AllAvailabilitySheet
 *
 * PURPOSE: Full calendar view for selecting availability slots
 *          Shows month navigation, day grid with availability states, and time slots
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { useScheduleStore } from "@/stores/useScheduleStore";

// ============================================================================
// TYPES
// ============================================================================

export interface AllAvailabilitySheetRef {
  open: (mechanicId: number) => void;
  close: () => void;
}

interface AllAvailabilitySheetProps {
  /** Called when user confirms selection */
  onConfirm?: (date: Date, time: string) => void;
  /** Called when sheet is closed */
  onClose?: () => void;
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

export const AllAvailabilitySheet = forwardRef<AllAvailabilitySheetRef, AllAvailabilitySheetProps>(
  function AllAvailabilitySheet({ onConfirm, onClose }, ref) {
    // ═══════════════ REFS ═══════════════
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

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

    // ═══════════════ SNAP POINTS ═══════════════
    const snapPoints = useMemo(() => ["92%"], []);

    // ═══════════════ COMPUTED VALUES ═══════════════

    // Get available and booked days from store
    const availableDays = getAvailableDayNumbers();
    const bookedDays = getBookedDayNumbers();

    // Get time slots for selected date
    const timeSlots = useMemo(() => {
      const slots = getTimeSlotsForSelectedDate();
      return slots.length > 0 ? slots : DEFAULT_TIME_SLOTS;
    }, [selectedDate, getTimeSlotsForSelectedDate]);

    // Selected day number for comparison
    const selectedDayNumber = selectedDate?.getDate() ?? null;

    // Generate calendar days for current month
    const calendarDays = useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      // First day of month (0 = Sunday, 1 = Monday, etc.)
      const firstDay = new Date(year, month, 1).getDay();
      // Convert Sunday = 0 to Monday-based index (Monday = 0)
      const startOffset = firstDay === 0 ? 6 : firstDay - 1;

      // Days in current month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      // Days in previous month
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
          // Check if it's Sunday (shop closed)
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

      // Next month days to fill remaining cells (always have 6 rows)
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

    // Split days into weeks for cleaner rendering
    const calendarWeeks = useMemo(() => {
      const weeks: CalendarDay[][] = [];
      for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
      }
      return weeks;
    }, [calendarDays]);

    // ═══════════════ IMPERATIVE HANDLE ═══════════════
    useImperativeHandle(ref, () => ({
      open: (mechanicId: number) => {
        // loadMechanicSchedule will restore any previous selection for this mechanic
        loadMechanicSchedule(mechanicId);
        bottomSheetModalRef.current?.present();
      },
      close: () => {
        bottomSheetModalRef.current?.dismiss();
      },
    }));

    // ═══════════════ HANDLERS ═══════════════
    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose?.();
        }
      },
      [onClose]
    );

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
      bottomSheetModalRef.current?.dismiss();
    }, []);

    const handleConfirm = useCallback(() => {
      if (selectedDate && selectedTime) {
        confirmSelection();
        onConfirm?.(selectedDate, selectedTime);
      }
      bottomSheetModalRef.current?.dismiss();
    }, [selectedDate, selectedTime, confirmSelection, onConfirm]);

    // ═══════════════ RENDER HELPERS ═══════════════
    const renderBackdrop = useCallback(
      (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
      []
    );

    const renderDayCell = useCallback(
      (day: CalendarDay, index: number) => {
        const isDisabled = !day.isCurrentMonth;
        const isBooked = day.status === "booked";
        const isSelected = day.status === "selected";
        const isAvailable = day.status === "available";

        // Determine background style
        let circleStyle = styles.circleNormal;
        if (isSelected) {
          circleStyle = styles.circleSelected;
        } else if (isAvailable) {
          circleStyle = styles.circleAvailable;
        } else if (isBooked && day.isCurrentMonth) {
          circleStyle = styles.circleBooked;
        }

        // Determine text color
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
      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handleContainer}
        onChange={handleSheetChange}
      >
        <BottomSheetScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text size="xl" weight="bold" color={BrandColors.primary}>
              All Availability
            </Text>
          </View>

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

            {/* Calendar Grid - Row by Row */}
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

          {/* Footer Buttons */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
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
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    ...Shadows.lg,
  },
  handleContainer: {
    paddingVertical: Spacing.sm,
  },
  handleIndicator: {
    backgroundColor: "#E5E7EB",
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },

  // Month Navigation
  monthNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
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
    paddingTop: Spacing.xl,
    gap: Spacing.md,
    marginTop: Spacing.lg,
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
