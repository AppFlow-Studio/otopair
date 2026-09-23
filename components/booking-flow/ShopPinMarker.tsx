/**
 * ShopPinMarker — a shop's `RatingMarkerPill` inside a `<Marker>`, with the
 * repaint window handled per platform.
 *
 * react-native-maps only re-snapshots a marker's view while
 * `tracksViewChanges` is true, and on Android it does so on the UI thread
 * every 40 ms for as long as the prop stays true. The two booking screens
 * kept it on permanently for the selected pin so its bob animation would
 * show. Measured on the Pixel AVD, that cost ~1 s of UI-thread CPU per 10 s
 * of sitting on the screen — and drew nothing: the bob never reaches the
 * marker bitmap on Android (the screen is pixel-static with a pin selected).
 *
 * So on Android the marker tracks for RATING_MARKER_REPAINT_MS after every
 * selection change (long enough for the selected/unselected styles to land,
 * the same pattern BookingFlowMap's own pins use) and then stops. iOS keeps
 * the original permanent tracking, so its bob keeps rendering as before.
 */

import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Marker } from "react-native-maps";

import { RATING_MARKER_REPAINT_MS, RatingMarkerPill } from "./RatingMarkerPill";

interface ShopPinMarkerProps {
  latitude: number;
  longitude: number;
  rating: number | null;
  shopName: string;
  isSelected: boolean;
  onPress: () => void;
}

/** Android only: true for RATING_MARKER_REPAINT_MS after mount and after each
 *  `isSelected` flip, false otherwise. Always called so hook order is stable. */
function useAndroidRepaintWindow(isSelected: boolean): boolean {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    setTrack(true);
    const t = setTimeout(() => setTrack(false), RATING_MARKER_REPAINT_MS);
    return () => clearTimeout(t);
  }, [isSelected]);
  return track;
}

export function ShopPinMarker({
  latitude,
  longitude,
  rating,
  shopName,
  isSelected,
  onPress,
}: ShopPinMarkerProps) {
  const androidTrack = useAndroidRepaintWindow(isSelected);
  const tracksViewChanges = Platform.OS === "android" ? androidTrack : isSelected;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
    >
      <RatingMarkerPill rating={rating} shopName={shopName} isSelected={isSelected} />
    </Marker>
  );
}
