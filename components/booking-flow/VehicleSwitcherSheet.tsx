/**
 * VehicleSwitcherSheet — opens on the VehiclePuck tap.
 *
 * Lists the user's vehicles and lets them switch the active one
 * for this booking. Single-snap FloatingSheet with dim backdrop;
 * tap a row → updates useVehicleStore.selectVehicle() and dismisses.
 */

import React, { useEffect, useMemo, useRef } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateVerticalScale } from "react-native-size-matters";

import { CarSilhouette } from "@/components/shared-ui/CarSilhouette";
import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { GlassSheetBackground } from "@/components/booking-flow/GlassSheet";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { BrandColors } from "@/constants/theme";
import {
  getCappedSheetHeight,
  getOverlayClearance,
} from "@/components/booking-flow/responsiveSheetLayout";

interface VehicleSwitcherSheetProps {
  onClose: () => void;
}

const ROW_HEIGHT = 88;

export function VehicleSwitcherSheet({ onClose }: VehicleSwitcherSheetProps) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listBottomPadding = getOverlayClearance({
    safeAreaBottom: insets.bottom,
    overlayHeight: 0,
    extraSpacing: moderateVerticalScale(16, 0.3),
  });

  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const selectedVehicleId = useVehicleStore((s) => s.selectedVehicleId);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  useEffect(() => {
    sheetRef.current?.open();
  }, []);

  // Single snap height — title + N rows + bottom safe area.
  const snapHeight = useMemo(() => {
    const headerH = 64;
    const listH = Math.max(1, vehicleIds.length) * ROW_HEIGHT;
    const padding = 60;
    return getCappedSheetHeight({
      viewportHeight,
      desiredHeight: headerH + listH + padding,
      minimumHeight: 240,
      maximumRatio: 0.7,
      absoluteMaximum: Number.POSITIVE_INFINITY,
    });
  }, [vehicleIds.length, viewportHeight]);

  const onPick = (id: string) => {
    selectVehicle(id);
    sheetRef.current?.close();
  };

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[snapHeight]}
      showBackdrop
      backdropMode="dim"
      onClose={onClose}
      backgroundElement={<GlassSheetBackground style={StyleSheet.absoluteFill} />}
    >
      <View style={styles.body}>
        <Text size={28} weight="extraBold" color={BrandColors.primary} style={styles.title}>
          Choose a vehicle
        </Text>
        {vehicleIds.length === 0 ? (
          <Text size="sm" weight="regular" color="#6B7280" style={styles.empty}>
            No vehicles yet. Add one from your garage to switch.
          </Text>
        ) : (
          // Sheet's snap height is clamped at 0.7 of the viewport; on
          // larger garages the row list overflows. Wrap in ScrollView
          // so the user can reach every car, including newly added
          // ones at the bottom of the list.
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
          >
            {vehicleIds.map((id) => {
              const v = vehicles[id];
              if (!v) return null;
              const isActive = id === selectedVehicleId;
              return (
                <Pressable
                  key={id}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => onPick(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${v.year} ${v.make} ${v.model}`}
                >
                  <View style={styles.thumb}>
                    {v.imageSource ? (
                      <Image source={v.imageSource} style={styles.thumbImage} resizeMode="contain" />
                    ) : (
                      <CarSilhouette variant="suv" width={64} height={44} />
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text size="md" weight="bold" color="#0F172A" numberOfLines={1}>
                      {v.year} {v.make} {v.model}
                    </Text>
                    {v.vin ? (
                      <Text size="xs" weight="regular" color="#6B7280" numberOfLines={1}>
                        VIN ending {v.vin.slice(-6)}
                      </Text>
                    ) : null}
                  </View>
                  {isActive ? (
                    <View style={styles.check}>
                      <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </FloatingSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  title: {
    marginBottom: 14,
  },
  empty: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    marginBottom: 8,
  },
  rowActive: {
    backgroundColor: "rgba(82, 153, 254, 0.22)",
    borderColor: "rgba(82, 153, 254, 0.55)",
  },
  thumb: {
    width: 72,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
});
