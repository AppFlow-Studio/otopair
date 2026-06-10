/**
 * VehiclePuck — persistent active-vehicle indicator pinned to the
 * top-right of every booking-flow screen.
 *
 * Circular chrome-look button showing the vehicle's image (or a
 * silhouette fallback). Tap opens the VehicleSwitcherSheet so the
 * user can switch the active car for this booking. Parent screens
 * can override tap behavior via `onPress`.
 *
 * Spec: ~/Downloads/<figma frames> (all 4 mockup screens carry this
 * puck in the top-right).
 */

import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { CarSilhouette } from "@/components/shared-ui/CarSilhouette";
import { VehicleSwitcherSheet } from "@/components/booking-flow/VehicleSwitcherSheet";
import { useVehicleStore } from "@/stores/useVehicleStore";

interface VehiclePuckProps {
  size?: number;
  /** Overrides the default tap behavior (open the switcher sheet).
   *  Ignored unless `interactive` is true. */
  onPress?: () => void;
  /** Whether the puck is tappable. Only Screen 1 of the booking
   *  flow passes `true`; Screens 2-4 carry the puck purely as a
   *  context indicator (the active car never changes once the user
   *  is past the service-selection step). */
  interactive?: boolean;
}

export function VehiclePuck({ size = 44, onPress, interactive = false }: VehiclePuckProps) {
  const vehicle = useVehicleStore((s) => s.getSelectedVehicle());
  const [switcherOpen, setSwitcherOpen] = useState(false);

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
          <Image source={vehicle.imageSource} style={styles.image} resizeMode="contain" />
        ) : (
          <CarSilhouette variant="suv" width={size - 12} height={size - 18} />
        )}
      </View>
    </View>
  );

  if (!interactive) {
    // Display-only puck — no Pressable, no hit slop, no switcher.
    return <View accessibilityLabel="Active vehicle">{body}</View>;
  }

  const handlePress = onPress ?? (() => setSwitcherOpen(true));

  return (
    <>
      <Pressable onPress={handlePress} hitSlop={8} accessibilityLabel="Switch vehicle">
        {body}
      </Pressable>
      {switcherOpen ? (
        <VehicleSwitcherSheet onClose={() => setSwitcherOpen(false)} />
      ) : null}
    </>
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
    width: "82%",
    height: "82%",
  },
});
