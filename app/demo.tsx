import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { BrandColors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type StepKey = "vehicle" | "service" | "shop" | "time" | "mechanic" | "confirm";

const STEPS: { key: StepKey; label: string; number: number }[] = [
  { key: "vehicle", label: "Select Vehicle", number: 1 },
  { key: "service", label: "Select Service", number: 2 },
  { key: "shop", label: "Find a Shop", number: 3 },
  { key: "time", label: "Pick a Time", number: 4 },
  { key: "mechanic", label: "Choose Mechanic", number: 5 },
  { key: "confirm", label: "Confirm & Book", number: 6 },
];

export default function DemoScreen() {
  const router = useRouter();

  // Current open step
  const [activeStep, setActiveStep] = useState<StepKey>("vehicle");

  // Selections
  const [selectedMake, setSelectedMake] = useState<Id<"makes"> | null>(null);
  const [selectedModel, setSelectedModel] = useState<Id<"models"> | null>(null);
  const [selectedTrim, setSelectedTrim] = useState<Id<"trims"> | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<Id<"engines"> | null>(null);
  const [selectedService, setSelectedService] = useState<Id<"services"> | null>(null);
  const [selectedShop, setSelectedShop] = useState<Id<"shops"> | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [resolvedTimeSlotId, setResolvedTimeSlotId] = useState<Id<"time_slots"> | null>(null);
  const [resolvedTimeSlotData, setResolvedTimeSlotData] = useState<{
    start_time: string;
    end_time: string;
  } | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<Id<"mechanics"> | null | "none">(null);
  const [bookingComplete, setBookingComplete] = useState(false);

  // Display labels for collapsed steps
  const [makeLabel, setMakeLabel] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [trimLabel, setTrimLabel] = useState("");
  const [engineLabel, setEngineLabel] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [shopLabel, setShopLabel] = useState("");
  const [shopRate, setShopRate] = useState(0);
  const [dateLabel, setDateLabel] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [mechanicLabel, setMechanicLabel] = useState("");

  // Queries — cascading, each conditional on previous selection
  const makes = useQuery(api.makes.list);
  const models = useQuery(api.models.getByMakeId, selectedMake ? { makeId: selectedMake } : "skip");
  const trims = useQuery(api.trims.getByModelId, selectedModel ? { modelId: selectedModel } : "skip");
  const engines = useQuery(api.engines.getByTrimId, selectedTrim ? { trimId: selectedTrim } : "skip");
  const services = useQuery(api.services.list);
  const shopServices = useQuery(
    api.shop_services.getByServiceId,
    selectedService ? { serviceId: selectedService } : "skip",
  );
  const allShopSlots = useQuery(api.time_slots.getAvailableByShopId, selectedShop ? { shopId: selectedShop } : "skip");
  const mechanics = useQuery(api.mechanics.getByShopId, selectedShop ? { shopId: selectedShop } : "skip");
  const mechanicSlots = useQuery(
    api.time_slots.getAvailableByShopAndDateTime,
    selectedShop && selectedDate && selectedTime
      ? { shopId: selectedShop, date: selectedDate, startTime: selectedTime }
      : "skip",
  );
  const users = useQuery(api.users.list);
  const vehicleOwnerships = useQuery(api.vehicle_owners.getByUser, users?.[0]?._id ? { userId: users[0]._id } : "skip");

  const createBooking = useMutation(api.bookings.create);

  // Derive available dates from actual slot data
  const availableDates = (() => {
    if (!allShopSlots) return [];
    const uniqueDates = [...new Set(allShopSlots.map((s) => s.date))].sort();
    return uniqueDates.map((dateStr) => {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return { date: dateStr, label };
    });
  })();

  // Derive deduplicated times for the selected date
  const uniqueTimesForDate = (() => {
    if (!allShopSlots || !selectedDate) return [];
    const slotsForDate = allShopSlots.filter((s) => s.date === selectedDate);
    const seen = new Set<string>();
    const result: { start_time: string; end_time: string }[] = [];
    for (const slot of slotsForDate) {
      if (!seen.has(slot.start_time)) {
        seen.add(slot.start_time);
        result.push({ start_time: slot.start_time, end_time: slot.end_time });
      }
    }
    result.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return result;
  })();

  const isStepComplete = (step: StepKey): boolean => {
    switch (step) {
      case "vehicle":
        return !!selectedEngine;
      case "service":
        return !!selectedService;
      case "shop":
        return !!selectedShop;
      case "time":
        return !!selectedTime;
      case "mechanic":
        return selectedMechanic !== null;
      case "confirm":
        return bookingComplete;
      default:
        return false;
    }
  };

  const goToStep = (step: StepKey) => {
    setActiveStep(step);
  };

  const handleBook = async () => {
    if (!selectedService || !selectedShop || !resolvedTimeSlotId || !selectedDate || !resolvedTimeSlotData) return;

    const user = users?.[0];
    const ownership = vehicleOwnerships?.[0];
    if (!user || !ownership) {
      Alert.alert("Error", "No demo user/vehicle found. Run the seed script first.");
      return;
    }

    // Calculate price
    const service = services?.find((s) => s._id === selectedService);
    const laborHours = service?.default_labor_hours ?? 1;
    const laborCost = laborHours * shopRate;
    const partsCost = 45; // mid-range estimate
    const totalCost = laborCost + partsCost;

    // Resolve mechanic_id from the resolved slot
    const resolvedSlot = mechanicSlots?.find((s) => s._id === resolvedTimeSlotId);
    const mechanicId = resolvedSlot?.mechanic_id ?? undefined;

    try {
      await createBooking({
        user_id: user._id,
        vin: ownership.vin,
        shop_id: selectedShop,
        mechanic_id: mechanicId,
        service_id: selectedService,
        time_slot_id: resolvedTimeSlotId,
        scheduled_date: selectedDate,
        scheduled_time: resolvedTimeSlotData.start_time,
        labor_cost: laborCost,
        parts_cost: partsCost,
        total_cost: totalCost,
      });
      setBookingComplete(true);
    } catch (e: any) {
      Alert.alert("Booking Failed", e.message);
    }
  };

  // ---------- Renderers ----------

  const renderStepHeader = (step: (typeof STEPS)[number]) => {
    const isActive = activeStep === step.key;
    const complete = isStepComplete(step.key);

    return (
      <TouchableOpacity
        style={[styles.stepHeader, isActive && styles.stepHeaderActive]}
        onPress={() => goToStep(step.key)}
        activeOpacity={0.7}
      >
        <View style={[styles.stepBadge, complete && styles.stepBadgeComplete]}>
          <Text style={[styles.stepBadgeText, complete && styles.stepBadgeTextComplete]}>
            {complete ? "\u2713" : step.number}
          </Text>
        </View>
        <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>{step.label}</Text>
        {complete && !isActive && (
          <Text style={styles.stepSummary} numberOfLines={1}>
            {getStepSummary(step.key)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const getStepSummary = (step: StepKey): string => {
    switch (step) {
      case "vehicle":
        return `${makeLabel} ${modelLabel} ${trimLabel}`;
      case "service":
        return serviceLabel;
      case "shop":
        return shopLabel;
      case "time":
        return `${dateLabel} ${timeLabel}`;
      case "mechanic":
        return mechanicLabel;
      case "confirm":
        return bookingComplete ? "Booked!" : "";
      default:
        return "";
    }
  };

  const renderOptionButton = (label: string, isSelected: boolean, onPress: () => void, subtitle?: string) => (
    <TouchableOpacity
      key={label}
      style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{label}</Text>
      {subtitle && <Text style={[styles.optionSubtext, isSelected && styles.optionSubtextSelected]}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={BrandColors.secondary} />
    </View>
  );

  const renderVehicleStep = () => (
    <View style={styles.stepContent}>
      {/* Makes */}
      <Text style={styles.subLabel}>Make</Text>
      {!makes ? (
        renderLoading()
      ) : (
        <View style={styles.optionGrid}>
          {makes.map((make) =>
            renderOptionButton(make.name, selectedMake === make._id, () => {
              setSelectedMake(make._id);
              setMakeLabel(make.name);
              setSelectedModel(null);
              setSelectedTrim(null);
              setSelectedEngine(null);
              setModelLabel("");
              setTrimLabel("");
              setEngineLabel("");
            }),
          )}
        </View>
      )}

      {/* Models */}
      {selectedMake && (
        <>
          <Text style={styles.subLabel}>Model</Text>
          {!models ? (
            renderLoading()
          ) : (
            <View style={styles.optionGrid}>
              {models.map((model) =>
                renderOptionButton(model.name, selectedModel === model._id, () => {
                  setSelectedModel(model._id);
                  setModelLabel(model.name);
                  setSelectedTrim(null);
                  setSelectedEngine(null);
                  setTrimLabel("");
                  setEngineLabel("");
                }),
              )}
            </View>
          )}
        </>
      )}

      {/* Trims */}
      {selectedModel && (
        <>
          <Text style={styles.subLabel}>Trim</Text>
          {!trims ? (
            renderLoading()
          ) : (
            <View style={styles.optionGrid}>
              {trims.map((trim) =>
                renderOptionButton(
                  trim.name,
                  selectedTrim === trim._id,
                  () => {
                    setSelectedTrim(trim._id);
                    setTrimLabel(trim.name);
                    setSelectedEngine(null);
                    setEngineLabel("");
                  },
                  `${trim.year_start}–${trim.year_end}`,
                ),
              )}
            </View>
          )}
        </>
      )}

      {/* Engines */}
      {selectedTrim && (
        <>
          <Text style={styles.subLabel}>Engine</Text>
          {!engines ? (
            renderLoading()
          ) : (
            <View style={styles.optionGrid}>
              {engines.map((engine) =>
                renderOptionButton(
                  engine.engine_code,
                  selectedEngine === engine._id,
                  () => {
                    setSelectedEngine(engine._id);
                    setEngineLabel(engine.engine_code);
                    setActiveStep("service");
                  },
                  `${engine.displacement_liters}L ${engine.cylinders}-cyl ${engine.fuel_type}`,
                ),
              )}
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderServiceStep = () => (
    <View style={styles.stepContent}>
      {!services ? (
        renderLoading()
      ) : (
        <View style={styles.optionGrid}>
          {services.map((service) =>
            renderOptionButton(
              service.name,
              selectedService === service._id,
              () => {
                setSelectedService(service._id);
                setServiceLabel(service.name);
                setSelectedShop(null);
                setShopLabel("");
                setActiveStep("shop");
              },
              service.description,
            ),
          )}
        </View>
      )}
    </View>
  );

  const renderShopStep = () => (
    <View style={styles.stepContent}>
      {!shopServices ? (
        renderLoading()
      ) : shopServices.length === 0 ? (
        <Text style={styles.emptyText}>No shops offer this service.</Text>
      ) : (
        <View style={styles.optionGrid}>
          {shopServices.map((ss) =>
            ss.shop
              ? renderOptionButton(
                  ss.shop.name,
                  selectedShop === ss.shop._id,
                  () => {
                    setSelectedShop(ss.shop!._id);
                    setShopLabel(ss.shop!.name);
                    setShopRate(ss.shop!.labor_rate);
                    setSelectedDate(null);
                    setSelectedTime(null);
                    setResolvedTimeSlotId(null);
                    setResolvedTimeSlotData(null);
                    setSelectedMechanic(null);
                    setMechanicLabel("");
                    setDateLabel("");
                    setTimeLabel("");
                    setActiveStep("time");
                  },
                  `${ss.shop.rating}\u2605 (${ss.shop.review_count}) \u00B7 $${ss.shop.labor_rate}/hr`,
                )
              : null,
          )}
        </View>
      )}
    </View>
  );

  const renderTimeStep = () => {
    if (!allShopSlots) return renderLoading();

    return (
      <View style={styles.stepContent}>
        <Text style={styles.subLabel}>Date</Text>
        {availableDates.length === 0 ? (
          <Text style={styles.emptyText}>No available dates for this shop.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.optionRow}>
              {availableDates.map((day) =>
                renderOptionButton(day.label, selectedDate === day.date, () => {
                  setSelectedDate(day.date);
                  setDateLabel(day.label);
                  setSelectedTime(null);
                  setResolvedTimeSlotId(null);
                  setResolvedTimeSlotData(null);
                  setSelectedMechanic(null);
                  setMechanicLabel("");
                  setTimeLabel("");
                }),
              )}
            </View>
          </ScrollView>
        )}

        {selectedDate && (
          <>
            <Text style={styles.subLabel}>Available Times</Text>
            {uniqueTimesForDate.length === 0 ? (
              <Text style={styles.emptyText}>No available slots for this date.</Text>
            ) : (
              <View style={styles.optionGrid}>
                {uniqueTimesForDate.map((t) =>
                  renderOptionButton(`${t.start_time} – ${t.end_time}`, selectedTime === t.start_time, () => {
                    setSelectedTime(t.start_time);
                    setResolvedTimeSlotId(null);
                    setResolvedTimeSlotData(null);
                    setSelectedMechanic(null);
                    setMechanicLabel("");
                    setTimeLabel(`${t.start_time} – ${t.end_time}`);
                    setActiveStep("mechanic");
                  }),
                )}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderMechanicStep = () => {
    if (!mechanics || !mechanicSlots) return renderLoading();

    // Only show mechanics who have an available slot at the selected time
    const availableMechanicIds = new Set(mechanicSlots.map((s) => s.mechanic_id).filter(Boolean));
    const availableMechanics = mechanics.filter((m) => availableMechanicIds.has(m._id));

    const resolveMechanicSlot = (mechanicId: string | null) => {
      if (!mechanicSlots || mechanicSlots.length === 0) return;
      const slot = mechanicId ? mechanicSlots.find((s) => s.mechanic_id === mechanicId) : mechanicSlots[0];
      if (slot) {
        setResolvedTimeSlotId(slot._id);
        setResolvedTimeSlotData({ start_time: slot.start_time, end_time: slot.end_time });
      }
    };

    return (
      <View style={styles.stepContent}>
        {availableMechanics.length === 0 ? (
          <Text style={styles.emptyText}>No mechanics available at this time.</Text>
        ) : (
          <View style={styles.optionGrid}>
            {renderOptionButton(
              "No Preference",
              selectedMechanic === "none",
              () => {
                setSelectedMechanic("none");
                setMechanicLabel("No Preference");
                resolveMechanicSlot(null);
                setActiveStep("confirm");
              },
              "First available technician",
            )}
            {availableMechanics.map((mech) =>
              renderOptionButton(
                `${mech.first_name} ${mech.last_name}`,
                selectedMechanic === mech._id,
                () => {
                  setSelectedMechanic(mech._id);
                  setMechanicLabel(`${mech.first_name} ${mech.last_name}`);
                  resolveMechanicSlot(mech._id as string);
                  setActiveStep("confirm");
                },
                `${mech.rating}\u2605 (${mech.review_count} reviews)`,
              ),
            )}
          </View>
        )}
      </View>
    );
  };

  const renderConfirmStep = () => {
    if (bookingComplete) {
      return (
        <View style={styles.stepContent}>
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>{"\u2713"}</Text>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successDetail}>
              {serviceLabel} at {shopLabel}
            </Text>
            <Text style={styles.successDetail}>
              {dateLabel} {timeLabel}
            </Text>
            {mechanicLabel !== "No Preference" && <Text style={styles.successDetail}>Mechanic: {mechanicLabel}</Text>}
          </View>
        </View>
      );
    }

    const service = services?.find((s) => s._id === selectedService);
    const laborHours = service?.default_labor_hours ?? 1;
    const laborCost = laborHours * shopRate;
    const partsCost = 45;
    const totalCost = laborCost + partsCost;

    return (
      <View style={styles.stepContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Vehicle: </Text>
            {makeLabel} {modelLabel} {trimLabel}
          </Text>
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service: </Text>
            {serviceLabel}
          </Text>
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shop: </Text>
            {shopLabel}
          </Text>
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date/Time: </Text>
            {dateLabel} {timeLabel}
          </Text>
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mechanic: </Text>
            {mechanicLabel}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Labor: </Text>
            {laborHours}hr x ${shopRate}/hr = ${laborCost.toFixed(2)}
          </Text>
          <Text style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Parts (est.): </Text>${partsCost.toFixed(2)}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.totalRow}>Total: ${totalCost.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.bookButton} onPress={handleBook} activeOpacity={0.8}>
          <Text style={styles.bookButtonText}>Confirm Booking</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStepContent = (step: StepKey) => {
    if (activeStep !== step) return null;
    switch (step) {
      case "vehicle":
        return renderVehicleStep();
      case "service":
        return renderServiceStep();
      case "shop":
        return renderShopStep();
      case "time":
        return renderTimeStep();
      case "mechanic":
        return renderMechanicStep();
      case "confirm":
        return renderConfirmStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demo Booking</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {STEPS.map((step) => (
          <View key={step.key} style={styles.stepCard}>
            {renderStepHeader(step)}
            {renderStepContent(step.key)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.primary,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  backText: {
    color: BrandColors.white,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
  },
  headerTitle: {
    color: BrandColors.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["5xl"],
  },
  // Step card
  stepCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
    overflow: "hidden",
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  stepHeaderActive: {
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAED",
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8EAED",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  stepBadgeComplete: {
    backgroundColor: BrandColors.secondary,
  },
  stepBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: "#687076",
  },
  stepBadgeTextComplete: {
    color: BrandColors.white,
  },
  stepTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: BrandColors.primary,
  },
  stepTitleActive: {
    color: BrandColors.secondary,
  },
  stepSummary: {
    flex: 1,
    textAlign: "right",
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: "#687076",
    marginLeft: Spacing.sm,
  },
  // Step content
  stepContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  subLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: "#687076",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionGrid: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  optionButton: {
    borderWidth: 1.5,
    borderColor: "#E8EAED",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  optionButtonSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#EEF4FF",
  },
  optionText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: BrandColors.primary,
  },
  optionTextSelected: {
    color: BrandColors.secondary,
  },
  optionSubtext: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: "#687076",
    marginTop: 2,
  },
  optionSubtextSelected: {
    color: BrandColors.secondary,
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: "#687076",
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
  // Confirm step
  summaryCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  summaryRow: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: BrandColors.primary,
    marginBottom: Spacing.xs,
  },
  summaryLabel: {
    fontFamily: FontFamily.semiBold,
  },
  divider: {
    height: 1,
    backgroundColor: "#E8EAED",
    marginVertical: Spacing.sm,
  },
  totalRow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: BrandColors.primary,
  },
  bookButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  bookButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: BrandColors.white,
  },
  // Success
  successContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  successIcon: {
    fontSize: 48,
    color: "#22C55E",
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize["2xl"],
    color: BrandColors.primary,
    marginBottom: Spacing.sm,
  },
  successDetail: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: "#687076",
    marginBottom: Spacing.xs,
  },
});
