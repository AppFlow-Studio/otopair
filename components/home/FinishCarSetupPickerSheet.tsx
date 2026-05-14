/**
 * FinishCarSetupPickerSheet
 *
 * PURPOSE: Bottom sheet that lists every vehicle with incomplete onboarding so
 *          the user can pick which one to finish setting up. Opened from the
 *          Finish Setting Up Your Car home-screen action card when more than
 *          one incomplete vehicle exists.
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Car, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { formatMake } from "@/utils/formatMake";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Row shape expected from the home screen — keeps the sheet decoupled from
// the Convex schema. Anything that can produce { vin, make, model, year,
// imageUrl, ownershipId, preOnboardingComplete } works.
export interface IncompleteVehicleRow {
  ownershipId: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  imageUrl: string | null;
  preOnboardingComplete: boolean;
}

export interface FinishCarSetupPickerSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  vehicles: IncompleteVehicleRow[];
  onSelect: (vehicle: IncompleteVehicleRow) => void;
}

export const FinishCarSetupPickerSheet = forwardRef<FinishCarSetupPickerSheetRef, Props>(
  ({ vehicles, onSelect }, ref) => {
    const sheetRef = useRef<FloatingSheetRef>(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }));

    // Size the sheet to fit the rows, capped at 60% screen height.
    const sheetHeight = Math.min(SCREEN_HEIGHT * 0.6, 120 + vehicles.length * 82);

    const handlePress = (vehicle: IncompleteVehicleRow) => {
      sheetRef.current?.close();
      onSelect(vehicle);
    };

    return (
      <FloatingSheet ref={sheetRef} snapHeights={[sheetHeight]} showBackdrop>
        <View style={styles.content}>
          <Text size="lg" weight="bold" color="#1A1A1A" style={styles.title}>
            Which car?
          </Text>
          <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
            Pick the vehicle you'd like to finish setting up.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {vehicles.map((v) => (
              <Pressable
                key={v.ownershipId}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => handlePress(v)}
              >
                <View style={styles.thumb}>
                  {v.imageUrl ? (
                    <Image source={{ uri: v.imageUrl }} style={styles.thumbImage} resizeMode="contain" />
                  ) : (
                    <Image
                      source={require("@/assets/images/covered-car.png")}
                      style={{ width: 36, height: 22 }}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <View style={styles.text}>
                  <Text size="md" weight="semiBold" color="#1A1A1A">
                    {v.year} {formatMake(v.make)} {v.model}
                  </Text>
                  <Text size="xs" weight="regular" color="#8E8E93">
                    VIN · {v.vin}
                  </Text>
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </FloatingSheet>
    );
  },
);

FinishCarSetupPickerSheet.displayName = "FinishCarSetupPickerSheet";

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    marginBottom: 10,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: {
    width: 48,
    height: 48,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
