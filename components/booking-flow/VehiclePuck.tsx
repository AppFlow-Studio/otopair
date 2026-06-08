/**
 * VehiclePuck — persistent active-vehicle indicator pinned to the
 * top-right of every booking-flow screen.
 *
 * Circular chrome-look button showing the vehicle's image (or a
 * silhouette fallback). Tap behavior is TBD per Ahmad — for now it
 * fires `onPress` which a parent can wire to a vehicle-switcher
 * sheet, or omit to render a non-interactive puck.
 *
 * Spec: ~/Downloads/<figma frames> (all 4 mockup screens carry this
 * puck in the top-right).
 */

import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { CarSilhouette } from "@/components/shared-ui/CarSilhouette";
import { useVehicleStore } from "@/stores/useVehicleStore";

interface VehiclePuckProps {
  size?: number;
  onPress?: () => void;
}

export function VehiclePuck({ size = 44, onPress }: VehiclePuckProps) {
  const vehicle = useVehicleStore((s) => s.getSelectedVehicle());

  const radius = size / 2;
  const body = (
    <View style={[styles.ring, { width: size, height: size, borderRadius: radius }]}>
      <View
        style={[
          styles.inner,
          { width: size - 4, height: size - 4, borderRadius: radius - 2 },
        ]}
      >
        {vehicle?.imageSource ? (
          <Image source={vehicle.imageSource} style={styles.image} resizeMode="cover" />
        ) : (
          <CarSilhouette variant="suv" width={size - 12} height={size - 18} />
        )}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel="Switch vehicle">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: "rgba(15, 23, 42, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  inner: {
    backgroundColor: "#E5EBF1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
