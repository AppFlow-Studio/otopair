/**
 * SingleServiceOptionsSheet
 *
 * Per-service option picker shown when the user taps a service with
 * has_options=true (e.g. Brake Pad Replacement → Front/Rear/Both,
 * Tire Rotation → All 4 / Front 2 / Rear 2, Battery → Standard/AGM/EFB).
 *
 * Mirrors the Tire Replacement modal pattern: full-screen slide-up Modal
 * that resolves the picker before the service is added to the cart.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 */

import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ServiceOptionItem } from "@/hooks/useServiceOptionsForSelected";

interface SingleServiceOptionsSheetProps {
  visible: boolean;
  serviceId: string | null;
  serviceName: string;
  onClose: () => void;
  onConfirm: (option: ServiceOptionItem) => void;
}

function formatOptionType(optionType: string): string {
  const label = optionType.replace(/_/g, " ");
  return `Select ${label}`;
}

export function SingleServiceOptionsSheet({
  visible,
  serviceId,
  serviceName,
  onClose,
  onConfirm,
}: SingleServiceOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const raw = useQuery(
    api.service_options.getByServiceIds,
    serviceId ? { serviceIds: [serviceId as Id<"services">] } : "skip",
  );

  const options = (raw?.[0]?.options ?? []) as unknown as ServiceOptionItem[];
  const optionType = options[0]?.option_type ?? "";

  // Reset selection each time the sheet opens for a fresh service.
  useEffect(() => {
    if (visible) setSelectedId(null);
  }, [visible, serviceId]);

  const handleConfirm = () => {
    const picked = options.find((o) => o._id === selectedId);
    if (picked) onConfirm(picked);
  };

  const isLoading = raw === undefined && serviceId != null;

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
          <Text size="xl" weight="bold" color={BrandColors.primary}>
            Option Selection
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text size="lg" weight="bold" color={BrandColors.primary}>
            {serviceName}
          </Text>
          <Text size="sm" weight="medium" color="#6B7280" style={styles.optionTypeLabel}>
            {isLoading ? "Loading options..." : formatOptionType(optionType)}
          </Text>

          <View style={styles.optionsContainer}>
            {options.map((option) => {
              const isSelected = selectedId === option._id;
              return (
                <Pressable
                  key={option._id}
                  onPress={() => setSelectedId(option._id)}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                >
                  <View style={styles.optionContent}>
                    <Text
                      size="md"
                      weight={isSelected ? "semiBold" : "regular"}
                      color={BrandColors.primary}
                    >
                      {option.option_label}
                    </Text>
                  </View>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity
            style={[styles.confirmButton, !selectedId && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedId}
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
  headerSpacer: { width: 36 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing["2xl"],
  },
  optionTypeLabel: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  optionsContainer: { gap: Spacing.sm },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  optionContent: { flex: 1, marginRight: Spacing.md },
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
