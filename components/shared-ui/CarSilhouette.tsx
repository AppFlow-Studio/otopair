/**
 * CarSilhouette — designed-asset line drawing of a 3/4 car view.
 *
 * Two variants ship today: a sedan side-3/4 and an SUV side-3/4. The
 * caller picks the right one based on the decoded vehicle's body class
 * (see `utils/vehicleImage.ts:isSuvBodyClass`). Rendered via React
 * Native `Image` with `tintColor` so callers can recolor the strokes
 * to match the surrounding surface.
 *
 * Used by `VehicleImageSkeleton` as the loading-state placeholder for
 * vehicle preview images. Reusable anywhere a clean "vehicle" cue is
 * needed.
 */

import React from "react";
import { Image } from "react-native";

export type CarSilhouetteVariant = "sedan" | "suv" | "truck";

interface CarSilhouetteProps {
  width: number;
  /** When omitted, height is derived from the asset's native aspect. */
  height?: number;
  /** Optional tint via `tintColor` — recolors the line strokes.
   *  Omit to render in the asset's native stroke color. */
  color?: string;
  /** Sedan side-3/4 (default) vs SUV side-3/4. */
  variant?: CarSilhouetteVariant;
}

// Both source PNGs are roughly 3:2 (sedan 612×408, SUV close to same).
// The Image's resizeMode="contain" handles minor differences inside
// the calling layout — we just need a representative ratio to derive
// the default height.
const ASSET_W = 612;
const ASSET_H = 408;

const SOURCES: Record<CarSilhouetteVariant, number> = {
  sedan: require("@/assets/images/car-silhouette-sedan.png"),
  suv: require("@/assets/images/car-silhouette-suv.png"),
  truck: require("@/assets/images/car-silhouette-truck.png"),
};

export function CarSilhouette({
  width,
  height,
  color,
  variant = "sedan",
}: CarSilhouetteProps) {
  const h = height ?? Math.round((width * ASSET_H) / ASSET_W);
  return (
    <Image
      source={SOURCES[variant]}
      style={[{ width, height: h }, color ? { tintColor: color } : null]}
      resizeMode="contain"
    />
  );
}

export default CarSilhouette;
