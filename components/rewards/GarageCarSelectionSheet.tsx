/**
 * GarageCarSelectionSheet
 *
 * PURPOSE: My Garage vehicle selector bottom sheet for rewards/membership page.
 *          Lets the user quickly pick a vehicle to switch from pooled → individual stats,
 *          or tap "All Vehicles" to return to the pooled view.
 *
 * USED IN: app/membership.tsx
 */

import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrandColors, Text } from "@/components/shared-ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { getVehicleImageUrl } from "@/utils/vehicleImage";
import {
  GarageCarouselCard,
  CARD_GAP,
  CARD_HORIZONTAL_PADDING,
  type GarageCarouselCardVehicle,
} from "./GarageCarouselCard";
import type { VehicleTier } from "./GarageCarSelectionCard";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

export interface GarageCarSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface GarageCarSelectionSheetProps {
  /** Ref to control present/dismiss */
  innerRef: React.RefObject<GarageCarSheetRef | null>;
  /** Called when user taps a tier badge — open Driver/Preferred/Elite Status modal */
  onStatusBadgePress: (tier: VehicleTier) => void;
  /** Called when user taps a vehicle card — switch to individual view */
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
  const { vehicles: rawVehicles } = useVehicleOwnershipFromConvex();
  const vehicleTiers = useQuery(api.rewards.getVehicleTiersByUser, userId ? { userId } : "skip");
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  const [visible, setVisible] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const vehiclesList = useMemo((): GarageCarouselCardVehicle[] => {
    if (!rawVehicles?.length) return [];
    return rawVehicles
      .filter((r: any) => r.vehicle != null)
      .map((r: any) => {
        const v = r.vehicle;
        const o = r.ownership;
        const meta = (v?.metadata as { make?: string; model?: string; trim?: string }) ?? {};
        const make = meta.make ?? "Vehicle";
        const model = meta.model ?? "";
        const year = v?.year ?? new Date().getFullYear();
        const imageSource: ImageSourcePropType | undefined = v?.image_url
          ? { uri: v.image_url }
          : make && model
            ? { uri: getVehicleImageUrl(make, model, year) }
            : undefined;

        return {
          id: r.vin,
          vin: r.vin,
          year,
          make,
          model,
          trim: meta.trim,
          mileage: o?.mileage,
          imageSource,
          isDefault: o?.is_primary ?? false,
          connectionStatus: r.connectionStatus,
          fuelPercent: null,
        };
      });
  }, [rawVehicles]);

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
        // Convex will refetch
      }
      onCarSelected?.(vin);
      dismiss();
    },
    [userId, updateOwnershipPrimary, dismiss, onCarSelected, selectVehicle]
  );

  const handleTierPress = useCallback(
    (vin: string) => {
      onStatusBadgePress(tierByVin[vin] ?? "driver");
    },
    [onStatusBadgePress, tierByVin]
  );

  const handleAddVehicle = useCallback(() => {
    dismiss();
    router.replace("/(main-tabs)/cars");
  }, [dismiss, router]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[sheetStyles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[sheetStyles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
        <View style={sheetStyles.dragHandleContainer}>
          <View style={sheetStyles.dragHandle} />
        </View>

        <View style={sheetStyles.sheetContent}>
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [sheetStyles.closeButton, pressed && { opacity: 0.7 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#1F2937" />
          </Pressable>

          {/* Header */}
          <View style={sheetStyles.header}>
            <Text size="2xl" weight="bold" color="#1F2937">
              My Garage
            </Text>
          </View>

          {/* Horizontal vehicle carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sheetStyles.carouselContent}
            style={sheetStyles.carousel}
            decelerationRate="fast"
          >
            {vehiclesList.map((vehicle) => (
              <GarageCarouselCard
                key={vehicle.id}
                vehicle={vehicle}
                tier={tierByVin[vehicle.id] ?? "driver"}
                onPress={() => handleSelectVehicle(vehicle.id)}
                onTierPress={() => handleTierPress(vehicle.id)}
              />
            ))}
          </ScrollView>

          {/* Add a vehicle — compact text link */}
          <Pressable
            style={({ pressed }) => [sheetStyles.addLink, pressed && sheetStyles.addLinkPressed]}
            onPress={handleAddVehicle}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <Text size="md" weight="medium" color={BrandColors.secondary}>
              + Add a vehicle
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

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
    paddingBottom: 20,
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
    paddingHorizontal: 24,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  carousel: {
    marginHorizontal: -24,
    marginTop: 0,
    alignSelf: "flex-start",
  },
  carouselContent: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 6, // room for card bottom shadow to render
    alignItems: "flex-start",
  },
  addLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginTop: 0,
    marginBottom: 0,
  },
  addLinkPressed: {
    opacity: 0.6,
  },
});
