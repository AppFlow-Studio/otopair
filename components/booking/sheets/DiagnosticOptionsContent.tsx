/**
 * DiagnosticOptionsContent
 *
 * PURPOSE: Booking-sheet content for the Diagnostic Scan service. Lets the
 *          customer pick one of five diagnostic areas (system) and optionally
 *          add free-text notes for the mechanic. Mirrors the web portal's
 *          create-booking-drawer diagnostic block.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 */

// 1. React & React Native
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  Battery,
  ChevronLeft,
  CircleDot,
  Disc,
  HelpCircle,
  Zap,
} from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import type { DiagnosticSystem } from "@/lib/diagnostic-checklist-templates";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_NOTES = 1000;

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

interface DiagnosticOptionsContentProps {
  onGoBack: () => void;
}

export function DiagnosticOptionsContent({ onGoBack }: DiagnosticOptionsContentProps) {
  const selectedDiagnosticSystem = useBookingStore((s) => s.selectedDiagnosticSystem);
  const setSelectedDiagnosticSystem = useBookingStore((s) => s.setSelectedDiagnosticSystem);
  const customerNotes = useBookingStore((s) => s.customerNotes);
  const setCustomerNotes = useBookingStore((s) => s.setCustomerNotes);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onGoBack} hitSlop={8}>
          <ChevronLeft size={24} color={BrandColors.primary} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text size="xl" weight="bold" color={BrandColors.primary}>
            What needs service?
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableFooterMarginAdjustment
        keyboardShouldPersistTaps="handled"
      >
        <Text size="sm" weight="medium" color="#6B7280" style={styles.subtitle}>
          Select the main issue you're experiencing
        </Text>

        <View style={styles.optionsContainer}>
          {DIAGNOSTIC_AREAS.map((area) => {
            const isSelected = selectedDiagnosticSystem === area.value;
            return (
              <AreaCard
                key={area.value}
                area={area}
                isSelected={isSelected}
                onSelect={() => setSelectedDiagnosticSystem(area.value)}
              />
            );
          })}
        </View>

        <View style={styles.notesSection}>
          <Text size="md" weight="semiBold" color={BrandColors.primary}>
            Notes from the customer (optional)
          </Text>
          <TextInput
            value={customerNotes}
            onChangeText={(t) => setCustomerNotes(t.slice(0, MAX_NOTES))}
            placeholder="Thudding from the front, gets worse around 50 mph. Started a week ago."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            maxLength={MAX_NOTES}
            style={styles.notesInput}
            textAlignVertical="top"
          />
          <Text size="xs" weight="regular" color="#9CA3AF" style={styles.notesCounter}>
            {customerNotes.length}/{MAX_NOTES}
          </Text>
        </View>
      </BottomSheetScrollView>
    </View>
  );
}

// ============================================================================
// AREA CARD
// ============================================================================

interface AreaCardProps {
  area: DiagnosticArea;
  isSelected: boolean;
  onSelect: () => void;
}

function AreaCard({ area, isSelected, onSelect }: AreaCardProps) {
  const { Icon, label, hint } = area;
  const iconColor = isSelected ? BrandColors.secondary : "#6B7280";

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
    >
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
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  subtitle: {
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "transparent",
    gap: Spacing.md,
  },
  optionCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
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
  optionContent: {
    flex: 1,
  },
  optionHint: {
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: BrandColors.secondary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.secondary,
  },
  notesSection: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  notesInput: {
    minHeight: 96,
    padding: Spacing.md,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    color: BrandColors.primary,
    fontSize: 14,
  },
  notesCounter: {
    textAlign: "right",
  },
});
