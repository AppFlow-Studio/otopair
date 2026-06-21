/**
 * Screen 4 · Pick a date & time — booking-flow.
 *
 * Full-screen frosted blue background (no map). Top row with ←
 * back, centered header, and the vehicle puck. Scroll page below
 * with a summary card, a horizontal day picker, and a sectioned
 * time-of-day grid. Sticky Confirm bar at the bottom with the
 * chosen date+time inline and the cancellation caption.
 *
 * On Confirm: writes the slot to the booking store and calls the
 * existing `useCreateBookingConvex` wrapper, then routes to the
 * legacy post-booking confirmation screen at
 * `/booking/mechanic/[id]/confirmation`.
 *
 * Spec: ~/Downloads/<figma frames> Screen 4.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Briefcase, ChevronDown } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { ConfirmBookingBar } from "@/components/booking-flow/ConfirmBookingBar";
import { DateChipRow, type DateChipItem } from "@/components/booking-flow/DateChipRow";
import { MonthPickerSheet, type MonthOption } from "@/components/booking-flow/MonthPickerSheet";
import { TimeSlotGrid } from "@/components/booking-flow/TimeSlotGrid";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { useBookingLaborHoursMap } from "@/hooks/useBookingLaborHoursMap";
import { useCalendarAvailabilityForShop } from "@/hooks/useCalendarAvailabilityForShop";
import { useTimeSlotsForShop } from "@/hooks/useTimeSlotsForShop";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { displayTimeToHHMM, minBookableHHMM, todayLocalISO } from "@/utils/timeSlotUtils";

const FRAME_GRADIENT = ["#CFE0EB", "#DCE7EF", "#E8EEF3"] as const;

const MONTH_LABELS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_LABELS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DATE_RANGE_DAYS = 14; // how many days from today to render in the picker

export default function PickDateTimeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ shopId?: string; mechanicId?: string }>();
  const shopId = params.shopId ?? null;
  const mechanicId = params.mechanicId && params.mechanicId.length > 0 ? params.mechanicId : null;

  // Bounce home if shopId is missing / invalid.
  useEffect(() => {
    if (!shopId) router.replace("/(booking-flow)/select-services");
  }, [shopId, router]);

  // Store reads
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);
  const setSelectedMechanicSlot = useBookingStore((s) => s.setSelectedMechanicSlot);
  const setScheduledAppointment = useBookingStore((s) => s.setScheduledAppointment);
  const selectMechanic = useBookingStore((s) => s.selectMechanic);
  const getShopById = useShopStore((s) => s.getShopById);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);

  const shop = shopId ? getShopById(shopId) ?? null : null;
  const mechanic = mechanicId ? getMechanicById(mechanicId) ?? null : null;

  // Engine-adjusted + director-rounded labor (empirical → book →
  // engine-tier → catalog-default) — same source as Review & Pay so the
  // "~Xh Ym" on the confirm card matches what the customer pays.
  const ownershipId = useVehicleStore((s) => s.getSelectedVehicle())?.ownershipId;
  const { laborHoursMap } = useBookingLaborHoursMap(ownershipId, selectedServiceIds);

  // Selection summary — services count + total minutes for the card.
  const { selectedCount, totalMinutes } = useMemo(() => {
    let mins = 0;
    const selected = availableServices.filter((s) => selectedServiceIds.includes(s.id));
    for (const s of selected) {
      const h = laborHoursMap.get(s.id) ?? s.default_labor_hours ?? 0;
      mins += Math.round(h * 60);
    }
    return { selectedCount: selected.length, totalMinutes: mins };
  }, [availableServices, selectedServiceIds, laborHoursMap]);

  // Which month the day picker is showing. null = the default
  // today-anchored view (current month). A non-null value comes from
  // the month picker and jumps the row forward into a future month.
  const [viewMonth, setViewMonth] = useState<MonthOption | null>(null);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  // The date chips we'll render. For the current month we anchor on
  // today and render DATE_RANGE_DAYS forward (no past days). For a
  // chosen future month we render every day of that month from the 1st.
  const dateChipItems = useMemo<DateChipItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isCurrentMonth =
      !viewMonth ||
      (viewMonth.year === today.getFullYear() &&
        viewMonth.month === today.getMonth() + 1);

    let start: Date;
    let count: number;
    if (isCurrentMonth) {
      start = today;
      count = DATE_RANGE_DAYS;
    } else {
      start = new Date(viewMonth.year, viewMonth.month - 1, 1);
      // Day 0 of the next month = last day of this month → days-in-month.
      count = new Date(viewMonth.year, viewMonth.month, 0).getDate();
    }

    const items: DateChipItem[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      items.push({
        isoDate: toIsoDate(d),
        dayOfWeek: DAY_OF_WEEK[d.getDay()].toUpperCase(),
        dayNumber: d.getDate(),
        hasAvailability: true, // overwritten below once the calendar query resolves
      });
    }
    return items;
  }, [viewMonth]);

  // The first date chip we'd LIKE to anchor on — used for the calendar query.
  const anchorDate = dateChipItems[0]?.isoDate ?? toIsoDate(new Date());
  const anchorMonth = parseInt(anchorDate.slice(5, 7), 10);
  const anchorYear = parseInt(anchorDate.slice(0, 4), 10);
  const { availableDayNumbers } = useCalendarAvailabilityForShop(
    shopId,
    anchorYear,
    anchorMonth,
    mechanicId,
    totalMinutes > 0 ? totalMinutes : undefined,
  );

  // Merge availability into the chip items (same month only — chips beyond
  // the current month fall back to "TBD = render as available, query on tap").
  const chipItemsWithAvailability = useMemo<DateChipItem[]>(() => {
    const availSet = new Set(availableDayNumbers);
    return dateChipItems.map((item) => {
      const m = parseInt(item.isoDate.slice(5, 7), 10);
      const d = item.dayNumber;
      if (m !== anchorMonth) return { ...item, hasAvailability: true };
      return { ...item, hasAvailability: availSet.has(d) };
    });
  }, [dateChipItems, availableDayNumbers, anchorMonth]);

  // Default-select the first day with availability.
  const [selectedDateISO, setSelectedDateISO] = useState<string | null>(null);
  useEffect(() => {
    if (selectedDateISO) return;
    const firstAvail = chipItemsWithAvailability.find((c) => c.hasAvailability);
    if (firstAvail) setSelectedDateISO(firstAvail.isoDate);
  }, [chipItemsWithAvailability, selectedDateISO]);

  // Slots for the selected day. The Convex query returns ONE row
  // per (mechanic, time), so a shop with 3 mechanics has 3 "9:00 AM"
  // entries. Dedupe by startTime here — the grid only needs one
  // chip per time, and getSlotIdByDisplayTime resolves the right
  // mechanic-specific slot at confirm time.
  const {
    slots: rawSlots,
    getSlotIdByDisplayTime,
    isLoading: slotsLoading,
  } = useTimeSlotsForShop(
    shopId,
    selectedDateISO,
    mechanicId,
    totalMinutes > 0 ? totalMinutes : undefined,
  );
  const slots = useMemo(() => {
    // For today, hide any slot earlier than the minimum bookable time —
    // now + 15 min, rounded up to the next 15-min boundary (same cutoff the
    // calendar query uses). `startTime` is 24h "HH:MM", so a lexical
    // compare is chronological. Future days have no time cutoff; their
    // availability already excludes blocked times + booked slots server-side.
    const isToday = selectedDateISO === todayLocalISO();
    const minTime = minBookableHHMM();
    const seen = new Set<string>();
    const out: typeof rawSlots = [];
    for (const s of rawSlots) {
      if (isToday && s.startTime < minTime) continue;
      if (seen.has(s.startTime)) continue;
      seen.add(s.startTime);
      out.push(s);
    }
    return out;
  }, [rawSlots, selectedDateISO]);

  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Reset time selection whenever the day changes.
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDateISO]);

  // Selection label for the Confirm bar: "Mon, June 9 · 9:00 AM".
  const selectionLabel = useMemo(() => {
    if (!selectedDateISO || !selectedTime) return null;
    const d = isoToDate(selectedDateISO);
    const dow = DAY_OF_WEEK[d.getDay()];
    const month = MONTH_LABELS_LONG[d.getMonth()];
    return `${dow}, ${month} ${d.getDate()} · ${selectedTime}`;
  }, [selectedDateISO, selectedTime]);

  const selectedDateHeader = useMemo(() => {
    if (!selectedDateISO) return null;
    const d = isoToDate(selectedDateISO);
    const dow = DAY_OF_WEEK[d.getDay()];
    const month = MONTH_LABELS_LONG[d.getMonth()];
    return `${dow}, ${month} ${d.getDate()}`;
  }, [selectedDateISO]);

  const monthYearLabel = useMemo(() => {
    const d = selectedDateISO ? isoToDate(selectedDateISO) : new Date();
    return `${MONTH_LABELS_LONG[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
  }, [selectedDateISO]);

  const summarySubtitle = useMemo(() => {
    const mechLabel = mechanic ? mechanic.name : "Any mechanic";
    const minsText = totalMinutes > 0 ? `~${formatMinutes(totalMinutes)}` : "Time TBD";
    return `${mechLabel} · ${selectedCount} service${selectedCount === 1 ? "" : "s"} · ${minsText}`;
  }, [mechanic, totalMinutes, selectedCount]);

  // Confirm flow — Screen 4's Confirm pill hands off to the legacy
  // payment-method picker (`/booking/mechanic/[id]/payment`). That
  // screen pushes to `/confirming` which runs createBookingConvex
  // and lands on the existing `/confirmation` route. The booking
  // mutation itself stays where it always lived; this screen's job
  // is just to seed the booking store with the slot + appointment
  // so the payment page has everything it needs to render the
  // breakdown.
  const onConfirm = () => {
    if (!shopId || !shop || !selectedDateISO || !selectedTime) return;
    const timeSlotId = getSlotIdByDisplayTime(selectedTime);
    const slotRow = slots.find((s) => s.displayTime === selectedTime);
    const startHHMM = slotRow?.startTime ?? displayTimeToHHMM(selectedTime);

    // Resolve concrete mechanic id for the post-booking URL when "Any"
    // is selected. Falls back to shopId so the route param is non-empty.
    const urlMechanicId =
      mechanicId ?? findFirstMechanicForShop(shopId, getMechanicById) ?? shopId;

    const d = isoToDate(selectedDateISO);
    const dowAbbrev = DAY_OF_WEEK[d.getDay()];

    setSelectedMechanicSlot({
      shopId,
      shopName: shop.name,
      mechanicId,
      mechanicName: mechanic?.name ?? null,
      slot: {
        dayOfWeek: dowAbbrev,
        day: String(d.getDate()),
        time: selectedTime,
        timeSlotId: timeSlotId ?? undefined,
        scheduledDate: selectedDateISO,
        scheduledTime: startHHMM,
        mechanicId: mechanicId ?? undefined,
      },
      timeSlotId: timeSlotId ?? undefined,
      scheduledDate: selectedDateISO,
      scheduledTime: startHHMM,
    });

    setScheduledAppointment({
      date: selectedDateISO,
      time: selectedTime,
      displayDate: selectedDateHeader ?? selectedDateISO,
    });
    selectMechanic(mechanicId);

    router.push({
      pathname: "/booking/mechanic/[id]/payment",
      params: { id: urlMechanicId },
    });
  };

  // Back normalizes to Screen 1 when the user landed on Pick
  // Date & Time without walking the rest of the flow first.
  // Length > 1 means a real in-flow back exists. The first-in-
  // stack case uses navigation.reset (not router.replace) since
  // replace within the same Stack occasionally no-op'd.
  const onBack = () => {
    const state = navigation.getState?.();
    const stackLength = state?.routes?.length ?? 0;
    if (stackLength > 1) {
      router.back();
      return;
    }
    (navigation.reset as ((state: { index: number; routes: { name: string }[] }) => void) | undefined)?.({
      index: 0,
      routes: [{ name: "select-services" }],
    });
  };

  // Jump the day picker to the chosen month. Clearing the selected day
  // lets the default-select effect re-anchor on the first available day
  // of the new month once its availability resolves.
  const onSelectMonth = (option: MonthOption) => {
    setViewMonth(option);
    setSelectedDateISO(null);
    setMonthPickerVisible(false);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={FRAME_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 200 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top control row */}
        <View style={styles.topRow}>
          <Pressable
            style={styles.iconBtn}
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#1F2937" strokeWidth={2} />
          </Pressable>
          <Text size="md" weight="bold" color="#0F172A" style={styles.headerTitle}>
            Pick a date & time
          </Text>
          <VehiclePuck />
        </View>

        {/* Summary card */}
        {shop ? (
          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <Briefcase size={18} color="#4B5563" strokeWidth={2} />
            </View>
            <View style={styles.summaryBody}>
              <Text size="md" weight="bold" color="#0F172A" numberOfLines={1}>
                {shop.name}
              </Text>
              <Text size="sm" weight="regular" color="#6B7280" numberOfLines={1}>
                {summarySubtitle}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Date row */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size="lg" weight="bold" color="#0F172A">
              Choose a date
            </Text>
            <Pressable
              style={styles.monthPill}
              onPress={() => setMonthPickerVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Change month, currently ${monthYearLabel}`}
            >
              <Text size="xs" weight="semiBold" color="rgba(15, 23, 42, 0.55)" style={styles.monthLabel}>
                {monthYearLabel}
              </Text>
              <ChevronDown size={14} color="rgba(15, 23, 42, 0.55)" strokeWidth={2.5} />
            </Pressable>
          </View>
          <DateChipRow
            items={chipItemsWithAvailability}
            selectedIsoDate={selectedDateISO}
            onSelect={setSelectedDateISO}
          />
        </View>

        {/* Time grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size="lg" weight="bold" color="#0F172A">
              Available times
            </Text>
            {selectedDateHeader ? (
              <Text size="sm" weight="regular" color="#6B7280">
                {selectedDateHeader}
              </Text>
            ) : null}
          </View>
          {/* Key on the selected day so swapping dates remounts the
              grid — that re-triggers the FadeInUp cascade so the new
              day's slots animate in like MaintenanceTracker does
              when the user switches cars. */}
          <TimeSlotGrid
            key={selectedDateISO ?? "no-date"}
            slots={slots}
            selectedTime={selectedTime}
            onSelect={setSelectedTime}
            isLoading={slotsLoading}
          />
        </View>
      </ScrollView>

      <ConfirmBookingBar
        selectionLabel={selectionLabel}
        onPress={onConfirm}
      />

      <MonthPickerSheet
        visible={monthPickerVisible}
        selectedYear={anchorYear}
        selectedMonth={anchorMonth}
        onSelect={onSelectMonth}
        onClose={() => setMonthPickerVisible(false)}
      />
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min - hrs * 60;
  if (rem === 0) return `${hrs} hr`;
  return `${hrs} hr ${rem} min`;
}

function findFirstMechanicForShop(
  shopId: string,
  getMechanicById: (id: string) => { shopId: string; id: string } | undefined,
): string | null {
  // Walks the entire mechanic store via getMechanicById is impractical;
  // the caller will only land here when user picked "Any" and we want
  // any concrete mechanic id from the shop. Returning null is safe —
  // pick-datetime falls back to shopId for the URL when this returns
  // null. (Cheap implementation; revisit if confirmation route needs
  // a real mechanic.)
  void shopId;
  void getMechanicById;
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E8EEF3",
  },
  scrollContent: {
    paddingHorizontal: 0,
    gap: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBody: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  monthPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  monthLabel: {
    letterSpacing: 0.8,
  },
});
