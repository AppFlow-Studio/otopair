/**
 * AvailabilityModal
 *
 * PURPOSE: Full-screen modal for viewing all availability and selecting date/time.
 *          Uses React Native Modal for reliable rendering outside scroll containers.
 *          Includes mechanic selector to switch between mechanics in the shop.
 *
 * FLOW: Booking
 *
 * USED IN: app/(booking)/mechanic/[id]/index.tsx
 *          components/booking/sheets/MechanicSelectionContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, User, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { useCalendarAvailabilityForShop } from "@/hooks/useCalendarAvailabilityForShop";
import { useTimeSlotsForShop } from "@/hooks/useTimeSlotsForShop";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";
import { BorderRadius, Shadows } from "@/constants/theme";
import { AnimationDuration } from "@/constants/animations";
import { useScheduleStore } from "@/stores/useScheduleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// TYPES
// ============================================================================

interface AvailabilityModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Mechanic ID to load schedule for (initial selection) */
  mechanicId: string | null;
  /** Shop ID to get all mechanics for mechanic selector (optional) */
  shopId?: string | null;
  /** Called when modal should close */
  onClose: () => void;
  /** Called when user confirms selection */
  onConfirm?: (date: Date, time: string, mechanicId: string) => void;
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

const SHORT_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

function formatSelectedDate(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Parses "9:00 AM" → { hours: 9, minutes: 0 } in 24-hour values */
function parseDisplayTime(displayTime: string): { hours: number; minutes: number } | null {
  const match = displayTime.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

/** Returns the earliest bookable minute-of-day: now + 15 min, rounded up to next 15-min boundary */
function getMinBookableMinutes(): number {
  const now = new Date();
  const rawMinutes = now.getHours() * 60 + now.getMinutes() + 15;
  return Math.ceil(rawMinutes / 15) * 15;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CALENDAR_PADDING = Spacing.xl * 2;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - CALENDAR_PADDING) / 7);
const CIRCLE_SIZE = CELL_SIZE - 8;

// ============================================================================
// COMPONENT
// ============================================================================

export function AvailabilityModal({ visible, mechanicId, shopId, onClose, onConfirm }: AvailabilityModalProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ LOCAL STATE ═══════════════
  // Track selected mechanic within the modal (null = "Any")
  // For single mechanic shops, auto-select that mechanic instead of "Any"
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(mechanicId ?? null);

  // Calendar collapses into a compact selected-date row after a date is picked.
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCollapseTimeout = useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // Get mechanics for the shop (if shopId provided)
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

  // Check if shop has only one mechanic (no "Any" option needed)
  const hasSingleMechanic = shopMechanics.length === 1;

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

  const effectiveShopId =
    shopId ?? shopMechanics[0]?.shopId ?? (mechanicId ? getMechanicById(mechanicId)?.shopId : null);
  // When the user explicitly picked "Any mechanic" (selectedMechanicId === null)
  // we keep it null so the downstream Convex queries omit `mechanic_id` and
  // return the shop-wide UNION of every mechanic's open slots. A prior
  // `?? shopMechanics[0]?.id` fallback collapsed "Any" → the first mechanic,
  // making "Any" and a specific pick return identical slot lists.
  const effectiveMechanicId = selectedMechanicId ?? mechanicId ?? undefined;

  // ═══════════════ CONVEX: calendar availability (Available / Booked highlighting) ═══════════════
  const convexCalendar = useCalendarAvailabilityForShop(
    effectiveShopId,
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    effectiveMechanicId ?? undefined,
  );

  const selectedDateISO = selectedDate ? selectedDate.toISOString().split("T")[0] : null;
  const { timeOptions: convexTimeOptions, getSlotIdByDisplayTime } = useTimeSlotsForShop(
    effectiveShopId,
    selectedDateISO,
    effectiveMechanicId ?? undefined,
  );

  // ═══════════════ BOOKING STORE ═══════════════
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const selectMechanic = useBookingStore((state) => state.selectMechanic);
  const setSelectedMechanicSlot = useBookingStore((state) => state.setSelectedMechanicSlot);

  // ═══════════════ COMPUTED SERVICE INFO ═══════════════
  // Compute shop name from mechanic or shopId
  const shopName = useMemo(() => {
    if (selectedMechanicId) {
      const mech = getMechanicById(selectedMechanicId);
      return mech?.shopName || "Shop";
    }
    if (shopMechanics.length > 0) {
      return shopMechanics[0].shopName || "Shop";
    }
    if (mechanicId) {
      const mech = getMechanicById(mechanicId);
      return mech?.shopName || "Shop";
    }
    return "Shop";
  }, [selectedMechanicId, shopMechanics, mechanicId, getMechanicById]);

  // Get selected mechanic name
  const selectedMechanicName = useMemo(() => {
    if (selectedMechanicId === null) return null;
    const mech = getMechanicById(selectedMechanicId);
    return mech?.name || null;
  }, [selectedMechanicId, getMechanicById]);

  const canConfirmSelection = Boolean(selectedDate && selectedTime);

  // ═══════════════ EFFECTS ═══════════════
  // Reset selected mechanic when modal opens
  // For single mechanic shops, auto-select that mechanic
  useEffect(() => {
    if (visible) {
      if (hasSingleMechanic) {
        // Auto-select the only mechanic
        setSelectedMechanicId(shopMechanics[0].id);
      } else {
        // Use provided mechanicId or null for "Any"
        setSelectedMechanicId(mechanicId);
      }
      // Reset collapse state so the calendar is always expanded on open.
      clearCollapseTimeout();
      setIsCalendarExpanded(true);
    } else {
      // Closing the modal: cancel any pending collapse to avoid setting
      // state after unmount and ensure next open starts clean.
      clearCollapseTimeout();
    }
  }, [visible, mechanicId, hasSingleMechanic, shopMechanics, clearCollapseTimeout]);

  // Re-expand calendar when the user switches mechanics so they can re-pick
  // against the new mechanic's availability.
  useEffect(() => {
    clearCollapseTimeout();
    setIsCalendarExpanded(true);
  }, [selectedMechanicId, clearCollapseTimeout]);

  // Clean up any pending collapse timer on unmount.
  useEffect(() => {
    return () => {
      clearCollapseTimeout();
    };
  }, [clearCollapseTimeout]);

  // Load schedule when mechanic selection changes
  useEffect(() => {
    if (visible) {
      // Use selected mechanic, or first mechanic if "Any" is selected
      const effectiveMechanicId = selectedMechanicId ?? shopMechanics[0]?.id ?? mechanicId;
      if (effectiveMechanicId !== null) {
        loadMechanicSchedule(effectiveMechanicId);
      }
    }
  }, [visible, selectedMechanicId, shopMechanics, mechanicId, loadMechanicSchedule]);

  // ═══════════════ MECHANIC SELECTOR HANDLER ═══════════════
  const handleMechanicSelect = useCallback((id: string | null) => {
    setSelectedMechanicId(id);
  }, []);

  // ═══════════════ COMPUTED VALUES ═══════════════
  // Use Convex calendar data when we have a shop (so Available/Booked highlighting reflects real data)
  const useConvexCalendar = Boolean(effectiveShopId);
  const availableDays = useConvexCalendar ? convexCalendar.availableDayNumbers : getAvailableDayNumbers();
  const bookedDays = useConvexCalendar ? convexCalendar.bookedDayNumbers : getBookedDayNumbers();

  const timeSlots = useMemo(() => {
    let slots: string[];
    if (effectiveShopId && selectedDateISO && convexTimeOptions.length > 0) {
      slots = convexTimeOptions;
    } else {
      const s = getTimeSlotsForSelectedDate();
      slots = s.length > 0 ? s : DEFAULT_TIME_SLOTS;
    }

    // When the selected date is today, strip slots before now + 15 min (rounded to 15-min boundary)
    if (selectedDate) {
      const now = new Date();
      const isToday =
        selectedDate.getFullYear() === now.getFullYear() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getDate() === now.getDate();

      if (isToday) {
        const minMinutes = getMinBookableMinutes();
        slots = slots.filter((slot) => {
          const parsed = parseDisplayTime(slot);
          if (!parsed) return true;
          return parsed.hours * 60 + parsed.minutes >= minMinutes;
        });
      }
    }

    return slots;
  }, [effectiveShopId, selectedDateISO, convexTimeOptions, selectedDate, getTimeSlotsForSelectedDate]);

  const selectedDayNumber = selectedDate?.getDate() ?? null;

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: CalendarDay[] = [];

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: daysInPrevMonth - i,
        status: "disabled",
        isCurrentMonth: false,
      });
    }

    // Current month days (when using Convex we only use available/booked from data; no Sunday default)
    for (let i = 1; i <= daysInMonth; i++) {
      let status: DayStatus = "normal";

      const dayDate = new Date(year, month, i);
      if (dayDate < today) {
        // Past days are not selectable
        status = "disabled";
      } else if (i === selectedDayNumber) {
        status = "selected";
      } else if (availableDays.includes(i)) {
        status = "available";
      } else if (bookedDays.includes(i)) {
        status = "booked";
      } else if (!useConvexCalendar) {
        const dayOfWeek = new Date(year, month, i).getDay();
        if (dayOfWeek === 0) status = "booked"; // mock: Sunday = booked
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
  }, [currentMonth, selectedDayNumber, availableDays, bookedDays, useConvexCalendar]);

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
      if (!day.isCurrentMonth || day.status === "booked" || day.status === "disabled") return;
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day.date);
      selectDate(newDate);
      // Let the selection circle highlight for a beat before the calendar
      // collapses, so the user sees their choice land.
      clearCollapseTimeout();
      collapseTimeoutRef.current = setTimeout(() => {
        setIsCalendarExpanded(false);
        collapseTimeoutRef.current = null;
      }, 200);
    },
    [currentMonth, selectDate, clearCollapseTimeout],
  );

  const handleExpandCalendar = useCallback(() => {
    clearCollapseTimeout();
    setIsCalendarExpanded(true);
  }, [clearCollapseTimeout]);

  const handleTimePress = useCallback(
    (time: string) => {
      selectTime(time);
    },
    [selectTime],
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    // Use selected mechanic, or first mechanic if "Any" is selected
    const effectiveMechanicId = selectedMechanicId ?? shopMechanics[0]?.id ?? mechanicId;
    const effectiveShopId =
      shopId ?? shopMechanics[0]?.shopId ?? (mechanicId ? getMechanicById(mechanicId)?.shopId : null);

    if (selectedDate && selectedTime && effectiveMechanicId !== null) {
      confirmSelection();

      // Format date as "DD Mon. YYYY"
      const displayDate = formatSelectedDate(selectedDate);
      const isoDate = selectedDate.toISOString().split("T")[0];

      // Update booking store with scheduled appointment and selected mechanic
      setScheduledAppointment({
        date: isoDate,
        time: selectedTime,
        displayDate,
      });
      selectMechanic(effectiveMechanicId);

      // Also update selectedMechanicSlot for footer visibility
      // Get day of week from date
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayOfWeek = dayNames[selectedDate.getDay()];

      if (effectiveShopId) {
        const timeSlotId = getSlotIdByDisplayTime(selectedTime);
        setSelectedMechanicSlot({
          shopId: effectiveShopId,
          shopName: shopName,
          mechanicId: selectedMechanicId,
          mechanicName: selectedMechanicName,
          slot: {
            day: String(selectedDate.getDate()),
            dayOfWeek: dayOfWeek,
            time: selectedTime,
          },
          ...(timeSlotId && { timeSlotId: timeSlotId as string }),
          scheduledDate: isoDate,
          scheduledTime: displayTimeToHHMM(selectedTime),
        });
      }

      onConfirm?.(selectedDate, selectedTime, effectiveMechanicId);
    }
    onClose();
  }, [
    selectedDate,
    selectedTime,
    selectedMechanicId,
    shopMechanics,
    mechanicId,
    shopId,
    shopName,
    selectedMechanicName,
    confirmSelection,
    setScheduledAppointment,
    selectMechanic,
    setSelectedMechanicSlot,
    getMechanicById,
    getSlotIdByDisplayTime,
    onConfirm,
    onClose,
  ]);

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderDayCell = useCallback(
    (day: CalendarDay, index: number) => {
      const isDisabled = !day.isCurrentMonth || day.status === "disabled";
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
    [handleDayPress],
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCancel}>
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
          {/* Mechanic Selector - Only show if we have multiple mechanics */}
          {shopMechanics.length > 1 && (
            <View style={styles.mechanicSection}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                SELECT MECHANIC
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mechanicAvatarsContent}
              >
                {/* "Any" option - only show if multiple mechanics */}
                <TouchableOpacity
                  style={styles.mechanicAvatarWrapper}
                  onPress={() => handleMechanicSelect(null)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.mechanicAvatar, selectedMechanicId === null && styles.mechanicAvatarSelected]}>
                    <Text
                      size="xs"
                      weight="bold"
                      color={selectedMechanicId === null ? BrandColors.secondary : "#6B7280"}
                    >
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

          {/* Calendar (full) or compact selected-date row.
              LinearTransition animates the height delta between the two views;
              FadeIn/FadeOut handles the cross-fade — matching the spirit of the
              ProfileInitialsButton transition pattern. */}
          <Animated.View layout={LinearTransition.duration(AnimationDuration.standard)}>
            {isCalendarExpanded || !selectedDate ? (
              <Animated.View
                key="calendar-full"
                entering={FadeIn.duration(AnimationDuration.standard)}
                exiting={FadeOut.duration(AnimationDuration.fast)}
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
              </Animated.View>
            ) : (
              <Animated.View
                key="calendar-collapsed"
                entering={FadeIn.duration(AnimationDuration.standard)}
                exiting={FadeOut.duration(AnimationDuration.fast)}
              >
                <TouchableOpacity
                  style={styles.selectedDateRow}
                  onPress={handleExpandCalendar}
                  activeOpacity={0.7}
                >
                  <View style={styles.selectedDateLeft}>
                    <View style={styles.selectedDateIconWrap}>
                      <CalendarIcon size={20} color={BrandColors.secondary} />
                    </View>
                    <Text size="md" weight="semiBold" color={BrandColors.primary}>
                      {formatSelectedDate(selectedDate)}
                    </Text>
                  </View>
                  <ChevronDown size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>

          {/* Time Selection */}
          <Animated.View
            layout={LinearTransition.duration(AnimationDuration.standard)}
            style={styles.timeSection}
          >
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
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.7}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Cancel
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              style={[
                styles.confirmButton,
                !canConfirmSelection && styles.confirmButtonDisabled,
                canConfirmSelection && styles.confirmButtonActive,
              ]}
              disabled={!canConfirmSelection}
              onPress={handleConfirm}
            >
              <Text size="md" weight="bold" color={BrandColors.white}>
                Select Date & Time
              </Text>
            </PrimaryButton>
          </View>
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

  // Selected Date Row (compact view after a date is picked)
  selectedDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedDateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  selectedDateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    ...Shadows.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
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
  confirmButtonActive: {
    shadowColor: BrandColors.secondary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
