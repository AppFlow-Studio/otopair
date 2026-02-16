/**
 * GarageCarSelectionSheet
 *
 * PURPOSE: My Garage car selection bottom sheet for rewards page.
 *          Design from 1st image: circular car images, "X vehicles", status badges.
 *          Similar to Select Vehicle (2nd image): list, Add vehicle, Confirm.
 *          Tapping status badge opens Driver Status modal.
 *
 * USED IN: app/membership.tsx
 */

import React, { useCallback, useMemo } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAX_VISIBLE_ROWS = 5;
const ROW_HEIGHT = 88;
const SNAP_PERCENT = Math.min(85, Math.max(45, ((MAX_VISIBLE_ROWS * ROW_HEIGHT + 180) / SCREEN_HEIGHT) * 100));

export interface GarageCarSelectionSheetProps {
  /** Ref to control present/dismiss */
  innerRef: React.RefObject<BottomSheetModal | null>;
  /** Called when user taps a status badge - open Driver Status modal with this tier */
  onStatusBadgePress: (tier: VehicleTier) => void;
  /** Called when sheet is dismissed */
  onClose?: () => void;
}

export function GarageCarSelectionSheet({ innerRef, onStatusBadgePress, onClose }: GarageCarSelectionSheetProps) {
  const router = useRouter();
  const { userId } = useUserFromConvex();
  const vehicleTiers = useQuery(api.rewards.getVehicleTiersByUser, userId ? { userId } : "skip");
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);

  const vehicles = useVehicleStore((s) => s.vehicles);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const selectedVehicleId = useVehicleStore((s) => s.selectedVehicleId);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

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

  const snapPoints = useMemo(() => [`${SNAP_PERCENT}%`], []);

  const handleClose = useCallback(() => {
    innerRef.current?.dismiss();
    onClose?.();
  }, [innerRef, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!selectedVehicleId || !userId) return;
    try {
      await updateOwnershipPrimary({
        vin: selectedVehicleId,
        userId: userId as Id<"users">,
        is_primary: true,
      });
    } catch {
      // Convex will refetch; tier/badge will update
    }
    handleClose();
  }, [selectedVehicleId, userId, updateOwnershipPrimary, handleClose]);

  const handleAddVehicle = useCallback(() => {
    handleClose();
    router.replace("/(main-tabs)/cars");
  }, [handleClose, router]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  return (
    <BottomSheetModal
      ref={innerRef}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheet}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.container}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={20} color={BrandColors.primary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerTitleBlock}>
            <Text size="xl" weight="bold" color="#1F2937" style={styles.headerTitle}>
              My Garage
            </Text>
            <Text size="sm" color="#6B7280" style={styles.subtitle}>
              {vehiclesList.length} vehicle{vehiclesList.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={vehiclesList.length > MAX_VISIBLE_ROWS}
        >
          {vehiclesList.map((vehicle) => (
            <GarageCarSelectionCard
              key={vehicle.id}
              vehicle={vehicle}
              tier={tierByVin[vehicle.id] ?? "driver"}
              isSelected={vehicle.id === selectedVehicleId}
              onSelect={() => selectVehicle(vehicle.id)}
              onStatusPress={() => onStatusBadgePress(tierByVin[vehicle.id] ?? "driver")}
            />
          ))}

          <TouchableOpacity style={styles.addRow} onPress={handleAddVehicle} activeOpacity={0.7}>
            <Plus size={20} color="#9CA3AF" />
            <Text size="md" weight="medium" color="#9CA3AF">
              Add a vehicle
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <Pressable
          style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmButtonPressed]}
          onPress={handleConfirm}
        >
          <Text weight="bold" size="md" color="#FFFFFF">
            Confirm
          </Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  headerTitleBlock: {
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
    paddingBottom: Spacing.lg,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
  },
  confirmButton: {
    backgroundColor: "#5299FE",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  confirmButtonPressed: {
    opacity: 0.9,
  },
});
