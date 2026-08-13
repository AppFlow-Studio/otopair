import React, { forwardRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Car } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BrandColors } from "@/constants/theme";

interface AddVehicleRequiredSheetProps {
  onAddVehicle: () => void;
  onMaybeLater: () => void;
  onClose?: () => void;
}

export const AddVehicleRequiredSheet = forwardRef<FloatingSheetRef, AddVehicleRequiredSheetProps>(
  function AddVehicleRequiredSheet({ onAddVehicle, onMaybeLater, onClose }, ref) {
    return (
      <FloatingSheet
        ref={ref}
        // Fixed, content-fit height — the previous 50%-of-screen snap left a
        // big empty gap under "Maybe later" and pushed the sheet up high.
        // This sizes to the actual content so it sits lower + hugs it.
        snapHeights={[380]}
        // Sit closer to the bottom edge (default floats ~insets.bottom/2 up).
        floatBottomInset={8}
        showBackdrop
        onClose={onClose}
      >
        <View style={[styles.sheetContentContainer, styles.noVehicleContent]}>
          <View style={styles.sheetTitleWrap}>
            <View style={styles.noVehicleIconWrap}>
              <Car size={28} color={BrandColors.secondary} strokeWidth={2} />
            </View>
            <Text style={styles.sheetTitle}>Add a vehicle first</Text>
          </View>

          <View style={styles.sheetBody}>
            <Text style={styles.sheetBodyText}>
              We need to know your vehicle to match you with the right mechanic and services.
            </Text>
          </View>

          <View style={styles.sheetActions}>
            <Pressable
              style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.sheetPressed]}
              onPress={onAddVehicle}
              accessibilityRole="button"
              accessibilityLabel="Add a vehicle"
            >
              <Text weight="semiBold" color="#FFF" style={styles.sheetPrimaryButtonText}>
                Add a vehicle
              </Text>
            </Pressable>

            <Pressable
              onPress={onMaybeLater}
              style={styles.noVehicleSecondaryAction}
              accessibilityRole="button"
              accessibilityLabel="Maybe later"
            >
              <Text style={styles.noVehicleSecondaryText}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </FloatingSheet>
    );
  },
);

AddVehicleRequiredSheet.displayName = "AddVehicleRequiredSheet";

const styles = StyleSheet.create({
  sheetContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetTitleWrap: {
    marginTop: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: "#1d1d1f",
    fontWeight: "700",
  },
  sheetBody: {
    gap: 12,
  },
  sheetBodyText: {
    fontSize: 17,
    lineHeight: 25,
    color: "#1d1d1f",
    textAlign: "center",
  },
  sheetActions: {
    marginTop: 28,
    gap: 12,
  },
  sheetPrimaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetPrimaryButtonText: {
    fontSize: 17,
  },
  sheetPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  noVehicleContent: {
    paddingBottom: 24,
  },
  noVehicleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${BrandColors.secondary}1A`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  noVehicleSecondaryAction: {
    alignItems: "center",
    paddingVertical: 8,
  },
  noVehicleSecondaryText: {
    fontSize: 15,
    color: "#8A97A8",
  },
});
