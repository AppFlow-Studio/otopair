/**
 * GarageCarSelectionSheet
 *
 * PURPOSE: My Garage car selection bottom sheet for rewards page.
 *          Uses same Modal + Animated implementation as Driver Status for floating look.
 *          Design: vehicle cards, status badges, add vehicle. Selecting opens Driver Status.
 *
 * USED IN: app/membership.tsx
 */

import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Plus, X } from "lucide-react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrandColors, Text } from "@/components/shared-ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleStore, type Vehicle } from "@/stores/useVehicleStore";
import { GarageCarSelectionCard, type VehicleTier } from "./GarageCarSelectionCard";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;

export interface GarageCarSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface GarageCarSelectionSheetProps {
  /** Ref to control present/dismiss */
  innerRef: React.RefObject<GarageCarSheetRef | null>;
  /** Called when user taps a status badge - open Driver Status modal with this tier */
  onStatusBadgePress: (tier: VehicleTier) => void;
  /** Called when user confirms car selection - switch to individual view (vin) */
  onCarSelected?: (vin: string) => void;
  /** Called when sheet is dismissed */
  onClose?: () => void;
}

export function GarageCarSelectionSheet({
  innerRef,
  onStatusBadgePress,
  onCarSelected,
  onClose,
}: GarageCarSelectionSheetProps) {
  const router = useRouter();
  const { userId } = useUserFromConvex();
  const vehicleTiers = useQuery(api.rewards.getVehicleTiersByUser, userId ? { userId } : "skip");
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);

  const vehicles = useVehicleStore((s) => s.vehicles);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  const [visible, setVisible] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const vehiclesList = useMemo(
    () => vehicleIds.map((id) => vehicles[id]).filter((v): v is Vehicle => Boolean(v)),
    [vehicleIds, vehicles]
  );

  const tierByVin = useMemo(() => {
    const map: Record<string, VehicleTier> = {};
    (vehicleTiers ?? []).forEach((t) => {
      map[t.vin] = t.tier;
    });
    return map;
  }, [vehicleTiers]);

  const present = useCallback(() => {
    setVisible(true);
    sheetTranslateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 40,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetTranslateY, backdropOpacity]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_HEIGHT,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      onClose?.();
    });
  }, [sheetTranslateY, backdropOpacity, onClose]);

  useImperativeHandle(innerRef, () => ({ present, dismiss }), [present, dismiss]);

  const handleSelectVehicle = useCallback(
    async (vin: string) => {
      if (!userId) return;
      selectVehicle(vin);
      try {
        await updateOwnershipPrimary({
          vin,
          userId: userId as Id<"users">,
          is_primary: true,
        });
      } catch {
        // Convex will refetch; tier/badge will update
      }
      onCarSelected?.(vin);
      dismiss();
    },
    [userId, updateOwnershipPrimary, dismiss, onCarSelected, selectVehicle]
  );

  const handleAddVehicle = useCallback(() => {
    dismiss();
    router.replace("/(main-tabs)/cars");
  }, [dismiss, router]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
        {/* Backdrop - same as Driver Status */}
        <Animated.View style={[sheetStyles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        {/* Bottom Sheet - same positioning as Driver Status (eliteStyles) */}
        <Animated.View style={[sheetStyles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          {/* Drag Handle */}
          <View style={sheetStyles.dragHandleContainer}>
            <View style={sheetStyles.dragHandle} />
          </View>

          <View style={sheetStyles.sheetContent}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [sheetStyles.closeButton, pressed && { opacity: 0.7 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={BrandColors.primary} />
            </Pressable>

            <View style={sheetStyles.header}>
              <Text size="xl" weight="bold" color="#1F2937" style={sheetStyles.headerTitle}>
                My Garage
              </Text>
              <Text size="sm" color="#6B7280" style={sheetStyles.subtitle}>
                {vehiclesList.length} vehicle{vehiclesList.length !== 1 ? "s" : ""}
              </Text>
            </View>

            <ScrollView
              style={sheetStyles.scrollView}
              contentContainerStyle={sheetStyles.scrollContent}
              showsVerticalScrollIndicator={vehiclesList.length > 5}
            >
              {vehiclesList.map((vehicle) => (
                <GarageCarSelectionCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  tier={tierByVin[vehicle.id] ?? "driver"}
                  isSelected={false}
                  onSelect={() => handleSelectVehicle(vehicle.id)}
                  onStatusPress={() => onStatusBadgePress(tierByVin[vehicle.id] ?? "driver")}
                />
              ))}

              <Pressable
                style={({ pressed }) => [sheetStyles.addButton, pressed && sheetStyles.addButtonPressed]}
                onPress={handleAddVehicle}
              >
                <View style={sheetStyles.addButtonIconCircle}>
                  <Plus size={18} color="#5299FE" strokeWidth={2.5} />
                </View>
                <Text size="md" weight="bold" color="#FFFFFF">
                  Add a vehicle
                </Text>
              </Pressable>
            </ScrollView>
          </View>
      </Animated.View>
    </Modal>
  );
}

// Same styles as Driver Status (eliteStyles) - floating bottom sheet
const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    maxHeight: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 2,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    minHeight: 0,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  headerTitle: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.sm,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: "#5299FE",
    borderRadius: 24,
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonPressed: {
    opacity: 0.9,
  },
  addButtonIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
