import React, { forwardRef } from "react";
import { Pressable, StyleSheet, Text as RNText, View, useWindowDimensions } from "react-native";

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
    const { height: screenHeight } = useWindowDimensions();

    return (
      <FloatingSheet
        ref={ref}
        snapHeights={[screenHeight * 0.5]}
        showBackdrop
        onClose={onClose}
      >
        <View style={[styles.sheetContentContainer, styles.noVehicleContent]}>
          <View style={styles.sheetTitleWrap}>
            <View style={styles.noVehicleIconWrap}>
              <RNText style={styles.noVehicleIcon}>🚗</RNText>
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
  noVehicleIcon: {
    fontSize: 26,
    lineHeight: 28,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    transform: [{ translateY: -2 }],
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
