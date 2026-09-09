/**
 * DiagnosticOptionsSheet
 *
 * Per-service picker shown the moment the user taps "Diagnostic Scan" in the
 * service list. Mirrors the SingleServiceOptionsSheet (brake pads, tire
 * rotation, etc.) pattern: full-screen slide-up Modal that resolves the area +
 * customer notes before the service is added to the cart. The selected card
 * expands inline to host the notes input so the customer never leaves the
 * decision they just made.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 */

import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Battery,
  ChevronLeft,
  CircleDot,
  Disc,
  HelpCircle,
  Zap,
} from "lucide-react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import type { DiagnosticSystem } from "@/lib/diagnostic-checklist-templates";

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_NOTES = 1000;
const MIN_NOTES = 10;

type IconComponent = React.ComponentType<{ size: number; color: string }>;

interface DiagnosticArea {
  value: DiagnosticSystem;
  label: string;
  hint: string;
  Icon: IconComponent;
}

const DIAGNOSTIC_AREAS: DiagnosticArea[] = [
  { value: "brakes", label: "Brakes", hint: "Squealing, grinding, soft pedal", Icon: Disc },
  {
    value: "tires_wheels",
    label: "Tires & Wheels",
    hint: "Vibration, thudding, pulling",
    Icon: CircleDot,
  },
  { value: "engine", label: "Engine", hint: "Rattle, rough idle, warning light", Icon: Zap },
  {
    value: "battery_electrical",
    label: "Battery & Electrical",
    hint: "Won't start, dim lights",
    Icon: Battery,
  },
  { value: "not_sure", label: "Not sure", hint: "Let the mechanic look around", Icon: HelpCircle },
];

// ============================================================================
// COMPONENT
// ============================================================================

interface DiagnosticOptionsSheetProps {
  visible: boolean;
  /** Pre-fill when re-opening to edit an existing selection. */
  initialSystem?: DiagnosticSystem | null;
  initialNotes?: string;
  onClose: () => void;
  onConfirm: (system: DiagnosticSystem, notes: string) => void;
}

export function DiagnosticOptionsSheet({
  visible,
  initialSystem,
  initialNotes,
  onClose,
  onConfirm,
}: DiagnosticOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedSystem, setSelectedSystem] = useState<DiagnosticSystem | null>(null);
  const [notes, setNotes] = useState("");

  // Reset (or pre-fill) each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSelectedSystem(initialSystem ?? null);
      setNotes(initialNotes ?? "");
    }
  }, [visible, initialSystem, initialNotes]);

  const trimmedNotesLength = notes.trim().length;
  const notesMeetMinimum = trimmedNotesLength >= MIN_NOTES;
  const canConfirm = selectedSystem != null && notesMeetMinimum;

  const handleConfirm = () => {
    if (!canConfirm || !selectedSystem) return;
    onConfirm(selectedSystem, notes.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} hitSlop={8}>
            <ChevronLeft size={24} color={BrandColors.primary} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text size="xl" weight="bold" color={BrandColors.primary}>
              What needs service?
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text size="sm" weight="medium" color="#6B7280" style={styles.subtitle}>
            Select the main issue you're experiencing. The selected area
            expands so you can describe it in your own words.
          </Text>

          <View style={styles.optionsContainer}>
            {DIAGNOSTIC_AREAS.map((area) => {
              const isSelected = selectedSystem === area.value;
              return (
                <AreaCard
                  key={area.value}
                  area={area}
                  isSelected={isSelected}
                  onSelect={() => setSelectedSystem(area.value)}
                  notes={notes}
                  onChangeNotes={(t) => setNotes(t.slice(0, MAX_NOTES))}
                  notesMeetMinimum={notesMeetMinimum}
                  trimmedNotesLength={trimmedNotesLength}
                />
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text size="md" weight="bold" color={BrandColors.white}>
              Add to cart
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// AREA CARD
// ============================================================================

interface AreaCardProps {
  area: DiagnosticArea;
  isSelected: boolean;
  onSelect: () => void;
  notes: string;
  onChangeNotes: (t: string) => void;
  notesMeetMinimum: boolean;
  trimmedNotesLength: number;
}

function AreaCard({
  area,
  isSelected,
  onSelect,
  notes,
  onChangeNotes,
  notesMeetMinimum,
  trimmedNotesLength,
}: AreaCardProps) {
  const { Icon, label, hint } = area;
  const iconColor = isSelected ? BrandColors.secondary : "#6B7280";

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
    >
      <View style={styles.optionCardHeader}>
        <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
          <Icon size={20} color={iconColor} />
        </View>
        <View style={styles.optionContent}>
          <Text size="md" weight={isSelected ? "semiBold" : "medium"} color={BrandColors.primary}>
            {label}
          </Text>
          <Text size="xs" weight="regular" color="#6B7280" style={styles.optionHint}>
            {hint}
          </Text>
        </View>
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </View>

      {isSelected && (
        <View style={styles.expandedSection}>
          <View style={styles.divider} />
          <View style={styles.notesLabelRow}>
            <Text size="sm" weight="semiBold" color={BrandColors.primary}>
              Describe what you're noticing
            </Text>
            <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
              Required
            </Text>
          </View>
          <Text size="xs" weight="regular" color="#6B7280" style={styles.notesHelper}>
            At least {MIN_NOTES} characters so the mechanic knows what to look for.
          </Text>
          <TextInput
            value={notes}
            onChangeText={onChangeNotes}
            placeholder="Thudding from the front, gets worse around 50 mph. Started a week ago."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            maxLength={MAX_NOTES}
            style={styles.notesInput}
            textAlignVertical="top"
          />
          <Text
            size="xs"
            weight="regular"
            color={notesMeetMinimum ? "#9CA3AF" : "#DC2626"}
            style={styles.notesCounter}
          >
            {notesMeetMinimum
              ? `${notes.length}/${MAX_NOTES}`
              : `${trimmedNotesLength}/${MIN_NOTES} min · ${notes.length}/${MAX_NOTES}`}
          </Text>
        </View>
      )}
    </Pressable>
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerSpacer: { width: 36 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing["2xl"],
  },
  subtitle: {
    marginBottom: Spacing.lg,
  },
  optionsContainer: { gap: Spacing.sm },
  optionCard: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
  },
  optionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapSelected: {
    backgroundColor: "#E0EDFF",
  },
  optionContent: { flex: 1 },
  optionHint: { marginTop: 2 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: BrandColors.secondary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.secondary,
  },
  expandedSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: "#DBEAFE",
    marginBottom: Spacing.xs,
  },
  notesLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notesHelper: {
    marginTop: -Spacing.xs,
  },
  notesInput: {
    minHeight: 96,
    padding: Spacing.md,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    color: BrandColors.primary,
    fontSize: 14,
  },
  notesCounter: {
    textAlign: "right",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
  confirmButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full ?? 100,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: { opacity: 0.4 },
});
