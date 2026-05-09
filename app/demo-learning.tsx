import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

type Phase = "seeding" | "ready" | "in_progress" | "questionnaire" | "completed";

interface PartRow {
  part_name: string;
  oem_number: string;
  cost: number;
  included: boolean;
}

export default function DemoLearningScreen() {
  const router = useRouter();

  // --- Phase state machine ---
  const [phase, setPhase] = useState<Phase>("seeding");
  const [loading, setLoading] = useState(false);

  // --- IDs from seed ---
  const [bookingId, setBookingId] = useState<Id<"bookings"> | null>(null);
  const [mechanicId, setMechanicId] = useState<Id<"mechanics"> | null>(null);
  const [engineId, setEngineId] = useState<Id<"engines"> | null>(null);
  const [seedSummary, setSeedSummary] = useState("");

  // --- Timer ---
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [jobStartedAtLocal, setJobStartedAtLocal] = useState<Date | null>(null);

  // --- Questionnaire state ---
  const [parts, setParts] = useState<PartRow[]>([]);
  const [difficultyRating, setDifficultyRating] = useState(3);
  const [techNotes, setTechNotes] = useState("");
  const [completedMinutes, setCompletedMinutes] = useState(0);

  // --- Mutations ---
  const seedDemo = useMutation(api.seed.seedLearningPipelineDemo);
  const startJob = useMutation(api.job_actuals.startJob);
  const completeJob = useMutation(api.job_actuals.completeJob);
  const submitJobActuals = useMutation(api.job_actuals.submitJobActuals);

  // --- Queries (conditional) ---
  const prefillData = useQuery(
    api.job_actuals.getPrefillData,
    bookingId ? { bookingId } : "skip"
  );
  const booking = useQuery(
    api.bookings.getById,
    bookingId ? { id: bookingId } : "skip"
  );
  const serviceInsight = useQuery(
    api.service_insights.getByServiceAndEngine,
    engineId && prefillData?.serviceId
      ? { serviceId: prefillData.serviceId, engineId }
      : "skip"
  );

  // --- Timer effect ---
  useEffect(() => {
    if (phase === "in_progress") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // --- Format time ---
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeAMPM = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  // --- Handlers ---

  const handleSeed = async () => {
    setLoading(true);
    try {
      const result = await seedDemo();
      setBookingId(result.bookingId as Id<"bookings">);
      setMechanicId(result.mechanicId as Id<"mechanics">);
      setEngineId(result.engineId as Id<"engines">);
      setSeedSummary(result.summary);
      setPhase("ready");
    } catch (e: any) {
      Alert.alert("Seed Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async () => {
    if (!bookingId || !mechanicId) return;
    setLoading(true);
    try {
      await startJob({ bookingId, mechanicId });
      setJobStartedAtLocal(new Date());
      setElapsedSeconds(0);
      setPhase("in_progress");
    } catch (e: any) {
      Alert.alert("Start Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const result = await completeJob({ bookingId });
      setCompletedMinutes(result.elapsedMinutes);
      if (timerRef.current) clearInterval(timerRef.current);

      // Populate parts from prefill data
      if (prefillData?.suggestedParts) {
        setParts(
          prefillData.suggestedParts.map((p) => ({
            ...p,
            included: true,
          }))
        );
      }
      setDifficultyRating(3);
      setTechNotes("");
      setPhase("questionnaire");
    } catch (e: any) {
      Alert.alert("Complete Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const includedParts = parts
        .filter((p) => p.included)
        .map(({ part_name, oem_number, cost }) => ({ part_name, oem_number, cost }));
      const totalPartsCost = includedParts.reduce((sum, p) => sum + p.cost, 0);

      await submitJobActuals({
        bookingId,
        parts_used: includedParts,
        actual_parts_cost: totalPartsCost,
        difficulty_rating: difficultyRating,
        technician_notes: techNotes,
      });
      setPhase("completed");
    } catch (e: any) {
      Alert.alert("Submit Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgain = () => {
    setPhase("seeding");
    setBookingId(null);
    setMechanicId(null);
    setEngineId(null);
    setSeedSummary("");
    setElapsedSeconds(0);
    setJobStartedAtLocal(null);
    setParts([]);
    setDifficultyRating(3);
    setTechNotes("");
    setCompletedMinutes(0);
  };

  // --- Part helpers ---
  const togglePart = (index: number) => {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, included: !p.included } : p))
    );
  };

  const updatePartCost = (index: number, costStr: string) => {
    const cost = parseFloat(costStr) || 0;
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, cost } : p))
    );
  };

  const addPart = () => {
    setParts((prev) => [
      ...prev,
      { part_name: "", oem_number: "", cost: 0, included: true },
    ]);
  };

  const updatePartField = (
    index: number,
    field: "part_name" | "oem_number",
    value: string
  ) => {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const totalPartsCost = parts
    .filter((p) => p.included)
    .reduce((sum, p) => sum + p.cost, 0);

  // --- Renders ---

  const renderSeeding = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Learning Pipeline Demo</Text>
      <Text style={styles.cardDescription}>
        This demo walks through the mechanic-facing job completion flow:{"\n\n"}
        1. Seed demo data (booking){"\n"}
        2. Start the job (timer begins){"\n"}
        3. Complete the job (timer stops){"\n"}
        4. Fill quick questionnaire (parts, difficulty){"\n"}
        5. View captured data + service insights
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSeed}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={BrandColors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Seed Demo Data</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderReady = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Job Ready</Text>
      <Text style={styles.seedSummary}>{seedSummary}</Text>

      {prefillData && (
        <View style={styles.infoBlock}>
          <InfoRow label="Vehicle" value={prefillData.vehicleLabel} />
          <InfoRow label="Service" value={prefillData.serviceName} />
          <InfoRow label="Engine" value={prefillData.engineCode} />
          <InfoRow label="Mechanic" value={prefillData.mechanicName} />
          {booking && (
            <>
              <InfoRow label="Date" value={booking.scheduled_date} />
              <InfoRow label="Time" value={booking.scheduled_time} />
            </>
          )}
          <InfoRow label="Status" value={booking?.status ?? "confirmed"} />
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: "#F59E0B" }]}
        onPress={handleStartJob}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={BrandColors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Start Job</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderInProgress = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Job In Progress</Text>

      {prefillData && (
        <View style={styles.infoBlock}>
          <InfoRow label="Vehicle" value={prefillData.vehicleLabel} />
          <InfoRow label="Service" value={prefillData.serviceName} />
          <InfoRow label="Mechanic" value={prefillData.mechanicName} />
        </View>
      )}

      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>Elapsed Time</Text>
        <Text style={styles.timerValue}>{formatTime(elapsedSeconds)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: "#EF4444" }]}
        onPress={handleCompleteJob}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={BrandColors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Complete Job</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderQuestionnaire = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Job Report</Text>

      {/* Prefilled read-only info */}
      <Text style={styles.sectionLabel}>JOB DETAILS</Text>
      <View style={styles.infoBlock}>
        {prefillData && (
          <>
            <InfoRow label="Vehicle" value={prefillData.vehicleLabel} />
            <InfoRow label="Service" value={prefillData.serviceName} />
            <InfoRow label="Engine" value={prefillData.engineCode} />
          </>
        )}
        {jobStartedAtLocal && (
          <InfoRow
            label="Started"
            value={formatTimeAMPM(jobStartedAtLocal.toISOString())}
          />
        )}
        <InfoRow label="Duration" value={`${completedMinutes} minutes`} />
      </View>

      {/* Parts */}
      <Text style={styles.sectionLabel}>PARTS USED</Text>
      {parts.map((part, index) => (
        <View key={index} style={styles.partRow}>
          <TouchableOpacity
            style={[styles.checkbox, part.included && styles.checkboxChecked]}
            onPress={() => togglePart(index)}
          >
            {part.included && <Text style={styles.checkMark}>{"\u2713"}</Text>}
          </TouchableOpacity>
          <View style={styles.partInfo}>
            {part.part_name ? (
              <Text style={styles.partName}>{part.part_name}</Text>
            ) : (
              <TextInput
                style={styles.partInput}
                placeholder="Part name"
                placeholderTextColor="#9CA3AF"
                value={part.part_name}
                onChangeText={(v) => updatePartField(index, "part_name", v)}
              />
            )}
            {part.oem_number ? (
              <Text style={styles.partOem}>{part.oem_number}</Text>
            ) : (
              <TextInput
                style={[styles.partInput, styles.partInputSmall]}
                placeholder="OEM #"
                placeholderTextColor="#9CA3AF"
                value={part.oem_number}
                onChangeText={(v) => updatePartField(index, "oem_number", v)}
              />
            )}
          </View>
          <View style={styles.partCostContainer}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.costInput}
              keyboardType="numeric"
              value={part.cost.toString()}
              onChangeText={(v) => updatePartCost(index, v)}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addPartButton} onPress={addPart}>
        <Text style={styles.addPartText}>+ Add Part</Text>
      </TouchableOpacity>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Parts Cost</Text>
        <Text style={styles.totalValue}>${totalPartsCost.toFixed(2)}</Text>
      </View>

      {/* Difficulty */}
      <Text style={styles.sectionLabel}>DIFFICULTY</Text>
      <View style={styles.difficultyRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.difficultyButton,
              difficultyRating === n && styles.difficultyButtonActive,
            ]}
            onPress={() => setDifficultyRating(n)}
          >
            <Text
              style={[
                styles.difficultyText,
                difficultyRating === n && styles.difficultyTextActive,
              ]}
            >
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.difficultyLabels}>
        <Text style={styles.difficultyLabel}>Easy</Text>
        <Text style={styles.difficultyLabel}>Hard</Text>
      </View>

      {/* Notes */}
      <Text style={styles.sectionLabel}>NOTES</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Optional notes..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={3}
        value={techNotes}
        onChangeText={setTechNotes}
      />

      {/* Submit */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: "#22C55E" }]}
        onPress={handleSubmit}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={BrandColors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Submit Job Report</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCompleted = () => (
    <View style={styles.card}>
      <View style={styles.successHeader}>
        <Text style={styles.successIcon}>{"\u2713"}</Text>
        <Text style={styles.cardTitle}>Job Complete</Text>
      </View>

      <Text style={styles.sectionLabel}>JOB SUMMARY</Text>
      <View style={styles.infoBlock}>
        {prefillData && (
          <>
            <InfoRow label="Vehicle" value={prefillData.vehicleLabel} />
            <InfoRow label="Service" value={prefillData.serviceName} />
            <InfoRow label="Engine" value={prefillData.engineCode} />
            <InfoRow label="Mechanic" value={prefillData.mechanicName} />
          </>
        )}
        <InfoRow label="Duration" value={`${completedMinutes} min`} />
        <InfoRow label="Parts Cost" value={`$${totalPartsCost.toFixed(2)}`} />
        <InfoRow label="Difficulty" value={`${difficultyRating}/5`} />
        {techNotes ? <InfoRow label="Notes" value={techNotes} /> : null}
      </View>

      <Text style={styles.sectionLabel}>LABOR TIMES</Text>
      {serviceInsight ? (
        <View style={styles.infoBlock}>
          <InfoRow
            label="Book Hours"
            value={`${(serviceInsight.book_hours ?? 0).toFixed(2)} hrs`}
          />
          <InfoRow
            label="Empirical Hours"
            value={`${(serviceInsight.empirical_hours ?? 0).toFixed(2)} hrs`}
          />
          <InfoRow
            label="Sample Size"
            value={(serviceInsight.empirical_sample_size ?? 0).toString()}
          />
          <InfoRow
            label="Confidence"
            value={`${((serviceInsight.confidence ?? 0) * 100).toFixed(0)}%`}
          />
          <InfoRow
            label="Data Quality"
            value={serviceInsight.data_quality ?? "unknown"}
          />
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={BrandColors.secondary} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleRunAgain}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Run Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhase = () => {
    switch (phase) {
      case "seeding":
        return renderSeeding();
      case "ready":
        return renderReady();
      case "in_progress":
        return renderInProgress();
      case "questionnaire":
        return renderQuestionnaire();
      case "completed":
        return renderCompleted();
    }
  };

  // --- Phase indicator ---
  const phases: { key: Phase; label: string }[] = [
    { key: "seeding", label: "Seed" },
    { key: "ready", label: "Ready" },
    { key: "in_progress", label: "Working" },
    { key: "questionnaire", label: "Report" },
    { key: "completed", label: "Done" },
  ];

  const currentPhaseIndex = phases.findIndex((p) => p.key === phase);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Learning Pipeline</Text>
      </View>

      {/* Phase progress bar */}
      <View style={styles.progressBar}>
        {phases.map((p, i) => (
          <View key={p.key} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                i <= currentPhaseIndex && styles.progressDotActive,
              ]}
            />
            <Text
              style={[
                styles.progressLabel,
                i <= currentPhaseIndex && styles.progressLabelActive,
              ]}
            >
              {p.label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderPhase()}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Info row helper ---
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  // Progress bar
  progressBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAED",
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D1D5DB",
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: BrandColors.secondary,
  },
  progressLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: "#9CA3AF",
  },
  progressLabelActive: {
    color: BrandColors.secondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["5xl"],
  },
  // Card
  card: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize["2xl"],
    color: BrandColors.primary,
    marginBottom: Spacing.md,
  },
  cardDescription: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: "#687076",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  seedSummary: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: BrandColors.secondary,
    marginBottom: Spacing.lg,
  },
  // Info block
  infoBlock: {
    backgroundColor: "#F8F9FA",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: "#687076",
  },
  infoValue: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: BrandColors.primary,
    flex: 1,
    textAlign: "right",
  },
  // Timer
  timerContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  timerLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: "#687076",
    marginBottom: Spacing.sm,
  },
  timerValue: {
    fontFamily: FontFamily.bold,
    fontSize: 56,
    color: BrandColors.primary,
    letterSpacing: 2,
  },
  // Buttons
  primaryButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: BrandColors.white,
  },
  // Section labels
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: "#687076",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  // Parts
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  checkboxChecked: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  checkMark: {
    color: BrandColors.white,
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  partInfo: {
    flex: 1,
  },
  partName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: BrandColors.primary,
  },
  partOem: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: "#687076",
    marginTop: 2,
  },
  partInput: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: BrandColors.primary,
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    paddingVertical: 2,
  },
  partInputSmall: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  partCostContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.md,
  },
  dollarSign: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: "#687076",
  },
  costInput: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: BrandColors.primary,
    width: 50,
    textAlign: "right",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    paddingVertical: 2,
  },
  addPartButton: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  addPartText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: BrandColors.secondary,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E8EAED",
    marginBottom: Spacing.md,
  },
  totalLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: BrandColors.primary,
  },
  totalValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: BrandColors.primary,
  },
  // Difficulty
  difficultyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  difficultyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  difficultyButtonActive: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  difficultyText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: "#687076",
  },
  difficultyTextActive: {
    color: BrandColors.white,
  },
  difficultyLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  difficultyLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: "#9CA3AF",
  },
  // Notes
  notesInput: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: BrandColors.primary,
    backgroundColor: "#F8F9FA",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.lg,
  },
  // Success
  successHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  successIcon: {
    fontSize: 32,
    color: "#22C55E",
    marginRight: Spacing.md,
  },
  // Loading
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: "#687076",
    marginTop: Spacing.sm,
  },
});
